import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentNorthStar, calcNorthStarDelta } from '@/lib/north-star'
import { getActiveKnowledge, startExperiment, evaluateExperiment } from '@/lib/agent-memory'
import { buildGodPrompt, getPromptSystemTools } from '@/lib/agent-prompt'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { pauseAd, updateCampaignBudget, calculateNewBudget } from '@/lib/meta-actions'
import { sendTelegramDirect } from '@/lib/telegram'
import { hermesClient } from '@/lib/hermes-client'

// ═══════════════════════════════════════════════════════════════
// 🧠 AGENT LOOP UNIFICATO v2 — Runs every 4h via Vercel Cron
//
// 5-Phase Architecture:
//  1. OBSERVE    — Real Meta quad-window (today, 3d, 7d, lifetime) + CRM + NorthStar Δ
//  2. REASON     — Deterministic scoring + LLM hypothesis
//  3. EXECUTE    — Kill underperformers + Scale winners
//  4. MEASURE    — Evaluate pending experiments with real data
//  5. LEARN      — Auto-invalidate knowledge, Telegram report
// ═══════════════════════════════════════════════════════════════

export const maxDuration = 60
const META_API_VERSION = 'v21.0'
const MAX_SCALE_ACTIONS = 2
const MAX_KILLS_PER_RUN = 3

function getAdmin() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    )
}

export async function GET(req: NextRequest) {
    const authHeader = req.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = getAdmin()
    const allResults: any[] = []

    try {
        // Get all orgs with autopilot active
        const { data: configs } = await supabase
            .from('ai_agent_config')
            .select('organization_id, autopilot_active, execution_mode, objectives, llm_model')
            .eq('autopilot_active', true)

        if (!configs?.length) {
            return NextResponse.json({ ok: true, message: 'No active autopilots' })
        }

        for (const config of configs) {
            const orgId = config.organization_id
            const isLive = config.execution_mode === 'live'
            const objectives = config.objectives || {}
            const llmModel = config.llm_model || 'xiaomi/mimo-v2-pro'
            const targetCPL: number = objectives.target_cpl || 20
            const targetCAC: number = objectives.target_cac || 500
            const killMultiplier: number = objectives.kill_multiplier || 3.0

            const log: string[] = []
            log.push(`[Agent Loop] Org ${orgId} — Mode: ${isLive ? 'LIVE' : 'DRY_RUN'}`)

            // ══════════════════════════════════════════════════════════
            // PHASE 0: MEASURE — Evaluate pending experiments
            // ══════════════════════════════════════════════════════════
            try {
                const { data: activeExps } = await supabase
                    .from('ai_experiments')
                    .select('*')
                    .eq('organization_id', orgId)
                    .eq('outcome', 'active')

                if (activeExps?.length) {
                    for (const exp of activeExps) {
                        // Only evaluate experiments older than 48h
                        const ageHours = (Date.now() - new Date(exp.created_at).getTime()) / 3600000
                        if (ageHours < 48) continue

                        // Check if the experiment target still exists and has performance data
                        const targetId = exp.action_details?.target_id || exp.action_details?.campaign_id
                        if (!targetId) {
                            await supabase.from('ai_experiments').update({ outcome: 'inconclusive' }).eq('id', exp.id)
                            continue
                        }

                        // Compare actual metrics vs baseline
                        const baselineCPL = exp.action_details?.baseline_cpl || targetCPL
                        const actualSpend = exp.meta_results?.spend || 0
                        const actualLeads = exp.meta_results?.leads || 0
                        const actualCPL = actualLeads > 0 ? actualSpend / actualLeads : 0

                        let outcome: 'succeeded' | 'failed' | 'inconclusive' = 'inconclusive'
                        if (actualLeads >= 3) {
                            outcome = actualCPL <= baselineCPL * 1.1 ? 'succeeded' : 'failed'
                        }

                        await supabase.from('ai_experiments').update({
                            outcome,
                            meta_results: { ...exp.meta_results, actualCPL, baselineCPL, evaluated_at: new Date().toISOString() },
                        }).eq('id', exp.id)

                        // Auto-invalidate knowledge on failure
                        if (outcome === 'failed' && exp.related_knowledge_ids?.length) {
                            await supabase.from('agent_knowledge')
                                .update({ still_valid: false, invalidated_at: new Date().toISOString() })
                                .in('id', exp.related_knowledge_ids)
                            log.push(`[LEARN] Knowledge invalidated: ${exp.related_knowledge_ids.join(', ')}`)
                        }

                        log.push(`[MEASURE] Experiment ${exp.id.slice(0, 8)}: ${outcome}`)
                    }
                }
            } catch (e) {
                log.push(`[MEASURE] Error: ${(e as Error).message}`)
            }

            // ══════════════════════════════════════════════════════════
            // PHASE 1: OBSERVE — Real Meta + CRM + NorthStar
            // ══════════════════════════════════════════════════════════

            // Get Meta credentials
            const { data: conn } = await supabase
                .from('connections')
                .select('credentials')
                .eq('organization_id', orgId)
                .eq('provider', 'meta_ads')
                .eq('status', 'active')
                .single()

            if (!conn?.credentials?.access_token) {
                log.push('[OBSERVE] No Meta credentials — skipping org')
                continue
            }

            const { access_token, ad_account_id } = conn.credentials
            const adAccount = `act_${ad_account_id}`

            // Fetch tri-window Meta data
            const today = new Date().toISOString().slice(0, 10)
            const threeDaysAgo = new Date(Date.now() - 3 * 86400000).toISOString().slice(0, 10)
            const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10)

            const insightsFields = 'ad_id,ad_name,adset_id,adset_name,campaign_id,campaign_name,spend,impressions,clicks,ctr,frequency,actions,cost_per_action_type'

            const buildUrl = (since: string, until: string, datePreset?: string) => {
                const base = `https://graph.facebook.com/${META_API_VERSION}/${adAccount}/insights?fields=${insightsFields}&level=ad&limit=500&access_token=${access_token}`
                if (datePreset) return `${base}&date_preset=${datePreset}`
                return `${base}&time_range=${encodeURIComponent(JSON.stringify({ since, until }))}`
            }

            const [resToday, res3d, res7d, resLt, adsRes] = await Promise.all([
                fetch(buildUrl(today, today)),
                fetch(buildUrl(threeDaysAgo, today)),
                fetch(buildUrl(sevenDaysAgo, today)),
                fetch(buildUrl('', '', 'maximum')),
                fetch(`https://graph.facebook.com/${META_API_VERSION}/${adAccount}/ads?fields=id,status,effective_status,campaign_id&limit=500&access_token=${access_token}`),
            ])

            if (!res7d.ok) {
                log.push('[OBSERVE] Meta API 7d failed — skipping')
                continue
            }

            const [dataToday, data3d, data7d, dataLt, adsData] = await Promise.all([
                resToday.ok ? resToday.json() : { data: [] },
                res3d.ok ? res3d.json() : { data: [] },
                res7d.json(),
                resLt.ok ? resLt.json() : { data: [] },
                adsRes.ok ? adsRes.json() : { data: [] },
            ])

            const activeAdIds = new Set<string>(
                (adsData.data || []).filter((a: any) => a.effective_status === 'ACTIVE').map((a: any) => a.id)
            )

            // Build campaign → active ads count mapping
            // A campaign with 0 active ads is effectively INACTIVE even if Meta says it's "ACTIVE"
            const activeAdsByCampaign: Record<string, number> = {}
            for (const ad of (adsData.data || [])) {
                if (ad.effective_status === 'ACTIVE' && ad.campaign_id) {
                    activeAdsByCampaign[ad.campaign_id] = (activeAdsByCampaign[ad.campaign_id] || 0) + 1
                }
            }
            const effectivelyActiveCampaigns = new Set<string>(
                Object.entries(activeAdsByCampaign).filter(([_, count]) => count > 0).map(([cId]) => cId)
            )

            // Parse insights
            const parseAds = (raw: any[]) => (raw || []).map((i: any) => {
                const leads = Number(i.actions?.find((a: any) => a.action_type === 'lead')?.value || 0)
                const cpl = Number(i.cost_per_action_type?.find((a: any) => a.action_type === 'lead')?.value || 0)
                return {
                    ad_id: i.ad_id, ad_name: i.ad_name || '', adset_id: i.adset_id || '',
                    adset_name: i.adset_name || '', campaign_id: i.campaign_id,
                    campaign_name: i.campaign_name || '',
                    status: activeAdIds.has(i.ad_id) ? 'ACTIVE' : 'INACTIVE',
                    campaign_effectively_active: effectivelyActiveCampaigns.has(i.campaign_id),
                    spend: parseFloat(i.spend || '0'), impressions: parseInt(i.impressions || '0'),
                    clicks: parseInt(i.clicks || '0'), ctr: parseFloat(i.ctr || '0'),
                    frequency: parseFloat(i.frequency || '0'), leads_count: leads, cpl,
                    angle: detectAngle(i.ad_name || ''),
                }
            }).filter((a: any) => a.status === 'ACTIVE' || a.spend > 0)

            const adsToday = parseAds(dataToday.data || [])
            const ads3d = parseAds(data3d.data || [])
            const ads7d = parseAds(data7d.data || [])
            const adsLt = parseAds(dataLt.data || [])

            if (ads7d.length === 0) {
                log.push('[OBSERVE] No ads data in 7d — skipping')
                continue
            }

            // Build lookup maps
            const ads3dMap: Record<string, any> = {}
            for (const a of ads3d) ads3dMap[a.ad_id] = a
            const adsTodayMap: Record<string, any> = {}
            for (const a of adsToday) adsTodayMap[a.ad_id] = a
            const adsLtMap: Record<string, any> = {}
            for (const a of adsLt) adsLtMap[a.ad_id] = a

            // Campaign budgets — only fetch for effectively active campaigns
            const campaignIds = [...new Set(ads7d.map(a => a.campaign_id))].filter(cId => effectivelyActiveCampaigns.has(cId))
            const campaignBudgets: Record<string, number> = {}
            await Promise.all(campaignIds.map(async (cId) => {
                try {
                    const r = await fetch(`https://graph.facebook.com/${META_API_VERSION}/${cId}?fields=daily_budget&access_token=${access_token}`)
                    if (r.ok) {
                        const d = await r.json()
                        campaignBudgets[cId] = parseFloat(d.daily_budget || '0') / 100
                    }
                } catch { }
            }))

            // CRM funnel by angle
            const funnelByAngle = await getFunnelByAngle(supabase, orgId, 30)

            // NorthStar Δ
            const northStar = await getCurrentNorthStar(orgId)
            const weeklyTotals = {
                spend: ads7d.reduce((s, a) => s + a.spend, 0),
                leads: ads7d.reduce((s, a) => s + a.leads_count, 0),
                appointments: Object.values(funnelByAngle).reduce((s: number, v: any) => s + (v.appointments || 0), 0),
                sales: Object.values(funnelByAngle).reduce((s: number, v: any) => s + (v.sales || 0), 0),
            }
            const nsDelta = northStar ? calcNorthStarDelta(northStar, weeklyTotals) : null

            // Active Knowledge
            const activeKnowledge = await getActiveKnowledge(orgId)

            // Mission objectives
            const { data: missionObj } = await supabase
                .from('ai_mission_objectives')
                .select('*')
                .eq('organization_id', orgId)
                .single()

            const mission = missionObj || { target_cpl: targetCPL, target_cac: targetCAC, target_lead_to_appt_rate: 0.40, optimize_for: 'cac' }

            const activeAdsCount = ads7d.filter(a => a.status === 'ACTIVE').length
            log.push(`[OBSERVE] ${ads7d.length} ads (${activeAdsCount} active), ${effectivelyActiveCampaigns.size} active campaigns, €${weeklyTotals.spend.toFixed(2)} spend (7d), ${weeklyTotals.leads} leads, ${weeklyTotals.sales} sales`)
            log.push(`[OBSERVE] Today: ${adsToday.length} ads with data, 3d: ${ads3d.length}, Lifetime: ${adsLt.length}`)
            if (nsDelta) log.push(`[OBSERVE] NorthStar: ${nsDelta.summary}`)

            // ══════════════════════════════════════════════════════════
            // PHASE 2: REASON — Deterministic scoring + LLM
            // ══════════════════════════════════════════════════════════

            // Aggregate and score angles
            const metricsByAngle = aggregateByAngle(ads7d, funnelByAngle)
            const existingScores: Record<string, any> = {}
            const { data: currentScores } = await supabase.from('ai_angle_scores').select('*').eq('organization_id', orgId)
            for (const s of (currentScores || [])) existingScores[s.angle] = s

            const scoreResults = computeAllScores(metricsByAngle, existingScores, mission)

            // Upsert angle scores
            for (const [angle, computed] of Object.entries(scoreResults) as [string, any][]) {
                const existing = existingScores[angle]
                const scoreHistory: number[] = existing?.score_history || []
                if (scoreHistory.length >= 14) scoreHistory.shift()
                scoreHistory.push(computed.score)

                await supabase.from('ai_angle_scores').upsert({
                    organization_id: orgId, angle,
                    score: computed.score, score_trend: computeTrend(scoreHistory), score_history: scoreHistory,
                    total_spend: computed.total_spend, total_leads: computed.total_leads,
                    total_appointments: computed.total_appointments, total_showups: computed.total_showups,
                    total_sales: computed.total_sales, avg_cpl: computed.avg_cpl, avg_cac: computed.avg_cac,
                    avg_ctr: computed.avg_ctr, avg_lead_to_appt_rate: computed.lead_to_appt_rate,
                    active_ads: computed.active_ads, recommended_action: computed.recommended_action,
                    recommended_budget_ratio: computed.recommended_budget_ratio,
                    action_reason: computed.action_reason,
                    baseline_cpl: existing?.baseline_cpl || computed.avg_cpl,
                    baseline_cac: existing?.baseline_cac || computed.avg_cac,
                    updated_at: new Date().toISOString(),
                }, { onConflict: 'organization_id,angle' })
            }

            // LLM hypothesis
            const hypothesis = await generateHypothesis(scoreResults, metricsByAngle, mission, targetCPL, targetCAC, llmModel)

            log.push(`[REASON] ${Object.keys(scoreResults).length} angles scored`)

            // ══════════════════════════════════════════════════════════
            // PHASE 3: EXECUTE — Kill + Scale
            // ══════════════════════════════════════════════════════════

            // ── KILL GUARDIAN (inline) ─────────────────────────────────
            const killResults: any[] = []
            const activeByCampaign: Record<string, number> = {}
            const killCountByCampaign: Record<string, number> = {}
            for (const ad of ads7d.filter(a => a.status === 'ACTIVE')) {
                activeByCampaign[ad.campaign_id] = (activeByCampaign[ad.campaign_id] || 0) + 1
            }

            for (const ad7d of ads7d.filter(a => a.status === 'ACTIVE')) {
                if (killResults.length >= MAX_KILLS_PER_RUN) break

                const ad3d = ads3dMap[ad7d.ad_id]
                const adToday = adsTodayMap[ad7d.ad_id]
                const killThreshold = targetCPL * killMultiplier
                // Kill trigger: spent > threshold AND 0 leads in 7d
                if (ad7d.spend <= killThreshold || ad7d.leads_count > 0) continue

                // Protection: has leads TODAY — don't kill active performers
                if ((adToday?.leads_count || 0) >= 1) continue
                // Protection: recent signal (3d leads)
                if ((ad3d?.leads_count || 0) >= 1) continue
                // Protection: CPL in range
                if (ad7d.cpl > 0 && ad7d.cpl <= targetCPL * 1.2) continue
                // Protection: last ad in campaign
                const kills = killCountByCampaign[ad7d.campaign_id] || 0
                const active = activeByCampaign[ad7d.campaign_id] || 0
                if (active - kills <= 1) continue

                let executed = false
                if (isLive) {
                    try {
                        await pauseAd(ad7d.ad_id, access_token)
                        executed = true
                    } catch (e) {
                        log.push(`[EXECUTE] Kill failed ${ad7d.ad_id}: ${(e as Error).message}`)
                    }
                }

                killCountByCampaign[ad7d.campaign_id] = kills + 1
                killResults.push({ ad: ad7d, executed })
                log.push(`[EXECUTE] Kill ${ad7d.ad_name}: €${ad7d.spend.toFixed(0)} spent, 0 leads. ${executed ? 'EXECUTED' : 'DRY_RUN'}`)
            }

            // ── SCALE WINNERS ─────────────────────────────────────────
            const scaleActions: any[] = []
            // Only scale if NorthStar says OK
            if (!nsDelta || nsDelta.recommended_action !== 'REDUCE') {
                const scaleTargets = Object.entries(scoreResults)
                    .filter(([_, s]: [string, any]) => s.recommended_action === 'scale' && s.total_leads >= 3)
                    .slice(0, MAX_SCALE_ACTIONS)

                for (const [angle, scoreData] of scaleTargets as [string, any][]) {
                    const angleCampaigns = ads7d.filter(a => a.angle === angle)
                    const uniqueCampaignIds = [...new Set(angleCampaigns.map(a => a.campaign_id))]

                    for (const cId of uniqueCampaignIds.slice(0, 1)) {
                        const currentBudget = campaignBudgets[cId] || 0
                        if (currentBudget <= 0) continue

                        let executionResult = 'dry_run'
                        if (isLive) {
                            const { newBudgetCents } = calculateNewBudget(currentBudget, 20)
                            const actionRes = await updateCampaignBudget(cId, newBudgetCents, access_token)
                            executionResult = actionRes.success ? 'executed' : 'failed'
                        }

                        scaleActions.push({ angle, campaign_id: cId, result: executionResult, reason: scoreData.action_reason })
                        log.push(`[EXECUTE] Scale ${angle} +20%: ${executionResult}`)
                    }
                }
            }

            // ── SAVE EXPERIMENT ───────────────────────────────────────
            if (killResults.length > 0 || scaleActions.length > 0) {
                await startExperiment(orgId, {
                    cycle_id: `loop-${Date.now()}`,
                    hypothesis: hypothesis?.reasoning || `Auto: ${killResults.length} kills, ${scaleActions.length} scales`,
                    action_type: scaleActions.length > 0 ? 'scale_budget' : 'kill_ads',
                    action_details: { kills: killResults.length, scales: scaleActions.length, angles: Object.keys(scoreResults) },
                    related_knowledge_ids: [],
                    outcome: 'active',
                })
            }

            // Save to ai_episodes
            await supabase.from('ai_episodes').insert({
                organization_id: orgId,
                episode_type: 'automation',
                action_type: 'agent_loop_v2',
                target_type: 'system',
                context: {
                    angles_scored: Object.keys(scoreResults).length,
                    kills: killResults.length,
                    scales: scaleActions.length,
                    is_live: isLive,
                    model: llmModel,
                    north_star_action: nsDelta?.recommended_action || 'unknown',
                },
                reasoning: log.join(' | '),
                outcome: 'positive',
            })

            // Save strategy log
            await supabase.from('ai_strategy_log').insert({
                organization_id: orgId,
                cycle_id: `${getCurrentWeekLabel()}-loop-${Date.now()}`,
                cycle_type: 'agent_loop',
                hypothesis: hypothesis || { message: 'No hypothesis generated' },
                baseline_metrics: {
                    spend_7d: weeklyTotals.spend, leads_7d: weeklyTotals.leads,
                    target_cpl: targetCPL, target_cac: targetCAC,
                    north_star_delta: nsDelta,
                },
            })

            // ══════════════════════════════════════════════════════════
            // PHASE 5: TELEGRAM REPORT
            // ══════════════════════════════════════════════════════════
            await sendAgentReport(supabase, orgId, scoreResults, metricsByAngle, killResults, scaleActions, hypothesis, nsDelta, isLive, targetCPL, llmModel)

            allResults.push({
                orgId, kills: killResults.length, scales: scaleActions.length,
                anglesScored: Object.keys(scoreResults).length,
                northStarAction: nsDelta?.recommended_action,
            })
        }

        return NextResponse.json({ ok: true, results: allResults })
    } catch (err: any) {
        console.error('[AgentLoop] Fatal error:', err)
        return NextResponse.json({ error: err.message }, { status: 500 })
    }
}

// ═══════════════════════════════════════════════════════════════
// HELPER FUNCTIONS (migrated from ai-engine v3)
// ═══════════════════════════════════════════════════════════════

function detectAngle(adName: string): string {
    const text = adName.toLowerCase()
    
    // Lista completa delle trigger keywords ufficiali (dal database Funnel Routing Engine)
    const validAngles = [
        'gap', 'potenziale', 'system', 'growth', 'trauma', 'talento', 
        'efficiency', 'status', 'authority', 'decision', 'pressione', 
        'emotional', 'education', 'security', 'sport_performance'
    ]

    // 1. Priorità assoluta: se il testo contiene esplicitamente una delle keyword routing ufficiali
    for (const angle of validAngles) {
        if (text.includes(angle)) {
            return angle
        }
    }

    // 2. Fallbacks e vecchie nomenclature
    if (text.includes('emo') || text.includes('dolore') || text.includes('emotional')) return 'emotional'
    if (text.includes('eff') || text.includes('efficiency') || text.includes('split') || text.includes('gap')) return 'efficiency'
    if (text.includes('sys') || text.includes('system') || text.includes('metodo')) return 'system'
    if (text.includes('status') || text.includes('corona') || text.includes('87')) return 'status'
    if (text.includes('edu') || text.includes('lente') || text.includes('lavagna')) return 'education'
    if (text.includes('growth') || text.includes('crescita')) return 'growth'
    if (text.includes('trasf') || text.includes('reels')) return 'transformation'

    // 3. Regex T: ma ignorando articoli o stop-words italiane usate per sbaglio dai media buyer come prima parola
    const tMatch = text.match(/t:\s*([a-z0-9_]+)/i)
    if (tMatch && tMatch[1]) {
        const w = tMatch[1].toLowerCase()
        if (['il', 'lo', 'la', 'i', 'gli', 'le', 'un', 'uno', 'una', 'da', 'di', 'in', 'con', 'su', 'per', 'tra', 'fra', 'non', 'perch', 'stesso', 'decine', 'questo', 'quello'].includes(w)) {
            return 'generic'
        }
        return w
    }

    return 'generic'
}

async function getFunnelByAngle(supabase: any, orgId: string, days: number = 30) {
    try {
        const since = new Date(Date.now() - days * 86400000).toISOString()
        const { data: leads } = await supabase
            .from('leads')
            .select(`id, utm_campaign, meta_data, value, created_at, pipeline_stages!leads_stage_id_fkey (id, slug, name, is_won, is_lost)`)
            .eq('organization_id', orgId)
            .gte('created_at', since)

        if (!leads?.length) return {}
        const byAngle: Record<string, any> = {}

        for (const lead of leads) {
            const rawTerm = (lead.meta_data?.utm_term || '').toLowerCase()
            const rawContent = (lead.meta_data?.utm_content || '').toLowerCase()
            const rawCampaign = (lead.utm_campaign || '').toLowerCase()
            
            // Il routing angle reale è tracciato principalmente in utm_content (ad.name) o utm_term (adset.name)
            let angle = detectAngle(rawContent)
            
            // Fallback sulla campagna se non trova nulla di meglio
            if (angle === 'generic') {
                angle = detectAngle(rawCampaign) || 'generic'
            }

            if (!byAngle[angle]) byAngle[angle] = { leads: 0, qualified: 0, appointments: 0, showups: 0, sales: 0, lost: 0, revenue: 0 }
            byAngle[angle].leads++

            const stageSlug = (lead.pipeline_stages as any)?.slug || ''
            const stageIsWon = (lead.pipeline_stages as any)?.is_won || false
            const stageIsLost = (lead.pipeline_stages as any)?.is_lost || false

            if (stageSlug === 'qualificato') byAngle[angle].qualified++
            if (['appuntamento', 'show-up'].includes(stageSlug) || stageIsWon) byAngle[angle].appointments++
            if (stageSlug === 'show-up' || stageIsWon) byAngle[angle].showups++
            if (stageIsWon) { byAngle[angle].sales++; byAngle[angle].revenue += Number(lead.value) || 0 }
            if (stageIsLost) byAngle[angle].lost++
        }
        return byAngle
    } catch (err) {
        console.error('[CRM getFunnelByAngle] Error:', err)
        return {}
    }
}

function aggregateByAngle(ads: any[], funnelByAngle: Record<string, any>) {
    const byAngle: Record<string, any> = {}
    for (const ad of ads) {
        const angle = ad.angle || 'generic'
        if (!byAngle[angle]) byAngle[angle] = { spend: 0, leads: 0, impressions: 0, clicks: 0, ctr_sum: 0, ad_count: 0, active_ads: 0 }
        const a = byAngle[angle]
        a.spend += ad.spend; a.leads += ad.leads_count; a.impressions += ad.impressions
        a.clicks += ad.clicks; a.ctr_sum += ad.ctr; a.ad_count++
        if (ad.status === 'ACTIVE') a.active_ads++
    }
    for (const [angle, meta] of Object.entries(byAngle)) {
        const crm = funnelByAngle[angle] || { leads: 0, qualified: 0, appointments: 0, showups: 0, sales: 0, lost: 0, revenue: 0 }
        const m = meta as any
        m.avg_cpl = m.leads > 0 ? m.spend / m.leads : 0
        m.avg_ctr = m.ad_count > 0 ? m.ctr_sum / m.ad_count : 0
        m.crm_appointments = crm.appointments; m.crm_showups = crm.showups; m.crm_sales = crm.sales
        m.crm_lost = crm.lost; m.crm_revenue = crm.revenue
        const crmLeads = crm.leads || m.leads
        m.lead_to_appt_rate = crmLeads > 0 ? crm.appointments / crmLeads : 0
        m.close_rate = crm.showups > 0 ? crm.sales / crm.showups : 0
        m.avg_cac = crm.sales > 0 ? m.spend / crm.sales : 0
        m.roas = crm.revenue > 0 && m.spend > 0 ? crm.revenue / m.spend : 0
    }
    return byAngle
}

function computeAllScores(metricsByAngle: Record<string, any>, existingScores: Record<string, any>, mission: any) {
    const targetCPL = mission.target_cpl || 20
    const targetCAC = mission.target_cac || 500
    const targetLTAR = mission.target_lead_to_appt_rate || 0.40
    const results: Record<string, any> = {}

    for (const [angle, m] of Object.entries(metricsByAngle)) {
        let score = 0
        if (m.avg_cpl > 0) score += clamp((targetCPL - m.avg_cpl) / targetCPL, -1, 1) * 0.25
        if (m.avg_cac > 0) score += clamp((targetCAC - m.avg_cac) / targetCAC, -1, 1) * 0.35
        else if (m.crm_appointments > 0 && m.crm_sales === 0) score += m.lead_to_appt_rate > 0.20 ? 0.10 : -0.05
        if (m.lead_to_appt_rate > 0) score += clamp((m.lead_to_appt_rate - targetLTAR) / targetLTAR, -1, 1) * 0.20
        if (m.avg_ctr > 0) score += clamp((m.avg_ctr - 1.5) / 1.5, -1, 1) * 0.10
        if (m.leads < 3) score *= 0.5
        score = clamp(score, -1, 1)

        let recommended_action = 'maintain', recommended_budget_ratio = 0.16, action_reason = 'Stabilità'
        if (score >= 0.45) { recommended_action = 'scale'; recommended_budget_ratio = 0.25; action_reason = `Score ${score.toFixed(2)} — scala +20%` }
        else if (score >= 0.20) { action_reason = `Score ${score.toFixed(2)} — mantieni` }
        else if (score >= -0.10) { recommended_action = 'test'; recommended_budget_ratio = 0.12; action_reason = `Score ${score.toFixed(2)} — testa nuove ads` }
        else if (score >= -0.40) { recommended_action = 'reduce'; recommended_budget_ratio = 0.08; action_reason = `Score ${score.toFixed(2)} — riduci` }
        else { recommended_action = 'pause'; recommended_budget_ratio = 0; action_reason = `Score ${score.toFixed(2)} — pausa` }

        results[angle] = {
            score, avg_cpl: m.avg_cpl || 0, avg_cac: m.avg_cac || 0, avg_ctr: m.avg_ctr || 0,
            lead_to_appt_rate: m.lead_to_appt_rate || 0, total_spend: m.spend || 0, total_leads: m.leads || 0,
            total_appointments: m.crm_appointments || 0, total_showups: m.crm_showups || 0, total_sales: m.crm_sales || 0,
            active_ads: m.active_ads || 0, recommended_action, recommended_budget_ratio, action_reason,
        }
    }
    return results
}

async function generateHypothesis(scores: Record<string, any>, metrics: Record<string, any>, mission: any, targetCPL: number, targetCAC: number, model: string) {
    try {
        const report = Object.entries(scores).sort((a: any, b: any) => b[1].score - a[1].score)
            .map(([angle, s]: [string, any]) => `- ${angle.toUpperCase()}: score=${s.score.toFixed(2)} CPL €${s.avg_cpl.toFixed(2)} CAC ${s.avg_cac > 0 ? '€'+s.avg_cac.toFixed(0) : 'n/d'} leads:${s.total_leads} → ${s.recommended_action}`)
            .join('\n')

        const payload = {
            task: `Sei il cervello strategico di Metodo Sincro. CPL target €${targetCPL}, CAC target €${targetCAC}. Angoli 7gg:\n${report}\nProponi UNA ipotesi strategica. Restituisci SOLO un JSON: {"angle":"...","action":"...","expected_delta_cac_pct":0,"reasoning":"...","confidence":"low|medium|high"}`,
            context: {
                targetCPL,
                targetCAC,
                report
            },
            agent_role: "orchestrator" as const,
            model: model,
        }

        const res = await hermesClient.dispatchTask(payload)
        if (res.choices && res.choices[0]?.message?.content) {
            const reply = res.choices[0].message.content
            const jsonMatch = reply.match(/\{[\s\S]*\}/)
            return jsonMatch ? JSON.parse(jsonMatch[0]) : null
        }
        return null
    } catch { return null }
}

async function sendAgentReport(supabase: any, orgId: string, scores: Record<string, any>, metrics: Record<string, any>, kills: any[], scales: any[], hypothesis: any, nsDelta: any, isLive: boolean, targetCPL: number, model: string) {
    try {
        const { data: conn } = await supabase.from('connections').select('credentials')
            .eq('organization_id', orgId).eq('provider', 'telegram').eq('status', 'active').single()
        if (!conn?.credentials?.bot_token) return

        const mode = isLive ? '🟢 LIVE' : '🟡 DRY RUN'
        const bar = (s: number) => '█'.repeat(Math.max(0, Math.round((s + 1) * 5))) + '░'.repeat(Math.max(0, 10 - Math.round((s + 1) * 5)))

        let msg = `🧠 <b>Agent Loop v2</b> [${mode}]\n<i>${model}</i>\n─────────────────\n\n`

        if (nsDelta) {
            const paceIcon = nsDelta.pace === 'ON_TRACK' ? '🟢' : nsDelta.pace === 'AHEAD' ? '🚀' : '🔴'
            msg += `${paceIcon} <b>NorthStar:</b> ${nsDelta.summary}\n\n`
        }

        msg += `📊 <b>ANGOLI</b>\n`
        for (const [angle, s] of Object.entries(scores).sort((a: any, b: any) => b[1].score - a[1].score) as [string, any][]) {
            const emoji = s.score > 0.3 ? '🟢' : s.score > -0.1 ? '🟡' : '🔴'
            msg += `${emoji} <b>${angle.toUpperCase()}</b> [${bar(s.score)}]\n`
            msg += `  CPL €${s.avg_cpl.toFixed(2)} | CAC ${s.avg_cac > 0 ? `€${s.avg_cac.toFixed(0)}` : 'n/d'}\n`
            msg += `  📍 ${s.total_leads}→${s.total_appointments}→${s.total_sales} | ${s.recommended_action.toUpperCase()}\n\n`
        }

        if (kills.length > 0) {
            msg += `🔴 <b>KILLS (${kills.length})</b>\n`
            for (const k of kills) msg += `• ${k.ad.ad_name}: €${k.ad.spend.toFixed(0)}, 0 lead ${k.executed ? '⛔' : '📝'}\n`
            msg += '\n'
        }

        if (scales.length > 0) {
            msg += `📈 <b>SCALE (${scales.length})</b>\n`
            for (const s of scales) msg += `• ${s.angle} +20%: ${s.result}\n`
            msg += '\n'
        }

        if (hypothesis) {
            msg += `💡 <b>Ipotesi:</b> ${hypothesis.reasoning?.slice(0, 200) || 'N/A'}\n`
        }

        msg += `\n⏰ Prossimo ciclo tra 4h`
        await sendTelegramDirect(conn.credentials.bot_token, conn.credentials.chat_id, msg)
    } catch (e) {
        console.error('[AgentLoop] Telegram error:', e)
    }
}

// Utilities
function clamp(v: number, min: number, max: number) { return Math.max(min, Math.min(max, v)) }
function computeTrend(h: number[]) { if (h.length < 3) return 'stable'; const d = h[h.length - 1] - h[h.length - 3]; return d > 0.05 ? 'rising' : d < -0.05 ? 'falling' : 'stable' }
function getCurrentWeekLabel() { const n = new Date(); const s = new Date(n.getFullYear(), 0, 1); return `${n.getFullYear()}-W${String(Math.ceil(((n.getTime() - s.getTime()) / 86400000 + s.getDay() + 1) / 7)).padStart(2, '0')}` }
