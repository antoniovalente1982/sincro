import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendTelegramDirect } from '@/lib/telegram'
import { updateCampaignBudget, calculateNewBudget } from '@/lib/meta-actions'

// ═══════════════════════════════════════════════════════════════
// 🧠 MENTE EVOLUTIVA — Intelligence Engine v3 (Ratchet Loop)
//
// Runs every 60 minutes via Vercel Cron.
// Single responsibility: LEARN and STRATEGIZE (not kill).
//
// Loop:
//  1. Fetch tri-window Meta data (3d / 7d / lifetime)
//  2. Fetch CRM funnel data (Lead→Appt→Sale by angle via UTM)
//  3. Score each angle (-1.0 → +1.0) against CAC baseline
//  4. LLM proposes ONE hypothesis (what to change this week)
//  5. Write hypothesis to ai_strategy_log (outcome: 'pending')
//  6. Update ai_angle_scores with latest metrics
//  7. Update ai_funnel_snapshots (daily snapshot)
//  8. Execute approved scaling actions (budget increase only)
//  9. Telegram report with strategy insight
//
// Kill logic → delegated to /api/cron/kill-guardian (runs every 4h)
// ═══════════════════════════════════════════════════════════════

export const maxDuration = 60
const META_API_VERSION = 'v21.0'
const MAX_SCALE_ACTIONS_PER_RUN = 2

function getSupabaseAdmin() {
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

    const supabase = getSupabaseAdmin()

    try {
        // Get all orgs with autopilot active
        const { data: configs } = await supabase
            .from('ai_agent_config')
            .select('organization_id, autopilot_active, execution_mode, objectives')
            .eq('autopilot_active', true)

        if (!configs?.length) {
            return NextResponse.json({ ok: true, message: 'No active autopilots' })
        }

        let totalActions = 0
        const allResults: any[] = []

        for (const config of configs) {
            const orgId = config.organization_id
            const isLive = config.execution_mode === 'live'
            const objectives = config.objectives || {}
            const targetCPL: number = objectives.target_cpl || 20
            const targetCAC: number = objectives.target_cac || 1500
            const scaleRatio3d: number = objectives.scale_cpl_ratio_3d || 0.85
            const scaleRatio7d: number = objectives.scale_cpl_ratio_7d || 1.0

            // ── Get Meta credentials ──────────────────────────────────
            const { data: conn } = await supabase
                .from('connections')
                .select('credentials')
                .eq('organization_id', orgId)
                .eq('provider', 'meta_ads')
                .eq('status', 'active')
                .single()

            if (!conn?.credentials?.access_token) continue
            const { access_token, ad_account_id } = conn.credentials
            const adAccount = `act_${ad_account_id}`

            // ── Get Mission Objectives ────────────────────────────────
            const { data: missionObj } = await supabase
                .from('ai_mission_objectives')
                .select('*')
                .eq('organization_id', orgId)
                .single()

            const mission = missionObj || {
                target_cpl: targetCPL,
                target_cac: targetCAC,
                target_lead_to_appt_rate: 0.40,
                target_close_rate: 0.35,
                optimize_for: 'cac',
            }

            // ── PHASE 1: Tri-window Meta Fetch ────────────────────────
            const today = new Date().toISOString().slice(0, 10)
            const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
            const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

            const insightsFields = 'ad_id,ad_name,adset_id,adset_name,campaign_id,campaign_name,spend,impressions,clicks,ctr,frequency,actions,cost_per_action_type,inline_link_clicks,inline_link_click_ctr'

            const buildUrl = (since: string, until: string, datePreset?: string) => {
                const base = `https://graph.facebook.com/${META_API_VERSION}/${adAccount}/insights?fields=${insightsFields}&level=ad&limit=500&access_token=${access_token}`
                if (datePreset) return `${base}&date_preset=${datePreset}`
                return `${base}&time_range=${encodeURIComponent(JSON.stringify({ since, until }))}`
            }

            const [res3d, res7d, resLt, adsRes] = await Promise.all([
                fetch(buildUrl(threeDaysAgo, today)),
                fetch(buildUrl(sevenDaysAgo, today)),
                fetch(buildUrl('', '', 'maximum')),
                fetch(`https://graph.facebook.com/${META_API_VERSION}/${adAccount}/ads?fields=id,status,effective_status,campaign_id,adset_id&limit=500&access_token=${access_token}`),
            ])

            if (!res7d.ok) continue

            const [data3d, data7d, dataLt, adsData] = await Promise.all([
                res3d.ok ? res3d.json() : { data: [] },
                res7d.json(),
                resLt.ok ? resLt.json() : { data: [] },
                adsRes.ok ? adsRes.json() : { data: [] },
            ])

            const activeAdIds = new Set<string>(
                (adsData.data || []).filter((a: any) => a.effective_status === 'ACTIVE').map((a: any) => a.id)
            )

            // Parse insights into structured ads
            const parseAds = (raw: any[]) =>
                (raw || []).map((i: any) => {
                    const leads = Number(i.actions?.find((a: any) => a.action_type === 'lead')?.value || 0)
                    const cpl = Number(i.cost_per_action_type?.find((a: any) => a.action_type === 'lead')?.value || 0)
                    return {
                        ad_id: i.ad_id,
                        ad_name: i.ad_name || '',
                        adset_id: i.adset_id || '',
                        adset_name: i.adset_name || '',
                        campaign_id: i.campaign_id,
                        campaign_name: i.campaign_name || '',
                        status: activeAdIds.has(i.ad_id) ? 'ACTIVE' : 'INACTIVE',
                        spend: parseFloat(i.spend || '0'),
                        impressions: parseInt(i.impressions || '0'),
                        clicks: parseInt(i.clicks || '0'),
                        ctr: parseFloat(i.ctr || '0'),
                        frequency: parseFloat(i.frequency || '0'),
                        leads_count: leads,
                        cpl,
                        link_clicks: parseInt(i.inline_link_clicks || '0'),
                        link_ctr: parseFloat(i.inline_link_click_ctr || '0'),
                        angle: detectAngle(i.ad_name || '', i.adset_name || ''),
                    }
                }).filter((a: any) => a.status === 'ACTIVE' || a.spend > 0)

            const ads3d = parseAds(data3d.data || [])
            const ads7d = parseAds(data7d.data || [])
            const adsLt = parseAds(dataLt.data || [])

            if (ads7d.length === 0) continue

            // Build lookup maps
            const ads3dMap: Record<string, any> = {}
            for (const a of ads3d) ads3dMap[a.ad_id] = a
            const adsLtMap: Record<string, any> = {}
            for (const a of adsLt) adsLtMap[a.ad_id] = a

            // ── PHASE 2: Campaign budgets ─────────────────────────────
            const campaignIds = [...new Set(ads7d.map((a: any) => a.campaign_id))]
            const campaignBudgets: Record<string, number> = {}
            await Promise.all(campaignIds.map(async (cId) => {
                try {
                    const r = await fetch(`https://graph.facebook.com/${META_API_VERSION}/${cId}?fields=daily_budget&access_token=${access_token}`)
                    if (r.ok) {
                        const d = await r.json()
                        campaignBudgets[cId as string] = parseFloat(d.daily_budget || '0') / 100
                    }
                } catch { }
            }))

            // ── PHASE 3: CRM Funnel Data by Angle ────────────────────
            const funnelByAngle = await getFunnelByAngle(supabase, orgId, 30)

            // ── PHASE 4: Angle Score Engine ───────────────────────────
            const existingScores: Record<string, any> = {}
            const { data: currentScores } = await supabase
                .from('ai_angle_scores')
                .select('*')
                .eq('organization_id', orgId)

            for (const s of (currentScores || [])) {
                existingScores[s.angle] = s
            }

            // Aggregate metrics by angle from 7d data
            const metricsByAngle = aggregateByAngle(ads7d, funnelByAngle)
            const scoreResults = computeAllScores(metricsByAngle, existingScores, mission)

            // ── PHASE 5: Upsert ai_angle_scores ──────────────────────
            for (const [angle, computed] of Object.entries(scoreResults)) {
                const existing = existingScores[angle]
                const scoreHistory: number[] = existing?.score_history || []
                if (scoreHistory.length >= 14) scoreHistory.shift()
                scoreHistory.push(computed.score)

                const trend = computeTrend(scoreHistory)

                await supabase.from('ai_angle_scores').upsert({
                    organization_id: orgId,
                    angle,
                    score: computed.score,
                    score_trend: trend,
                    score_history: scoreHistory,
                    total_spend: computed.total_spend,
                    total_leads: computed.total_leads,
                    total_appointments: computed.total_appointments,
                    total_showups: computed.total_showups,
                    total_sales: computed.total_sales,
                    avg_cpl: computed.avg_cpl,
                    avg_cac: computed.avg_cac,
                    avg_ctr: computed.avg_ctr,
                    avg_lead_to_appt_rate: computed.lead_to_appt_rate,
                    active_ads: computed.active_ads,
                    recommended_action: computed.recommended_action,
                    recommended_budget_ratio: computed.recommended_budget_ratio,
                    action_reason: computed.action_reason,
                    // Preserve best_pocket_id, best_template_id — only update if we have new data
                    baseline_cpl: existing?.baseline_cpl || computed.avg_cpl,
                    baseline_cac: existing?.baseline_cac || computed.avg_cac,
                    baseline_week: existing?.baseline_week || getCurrentWeekLabel(),
                    updated_at: new Date().toISOString(),
                }, { onConflict: 'organization_id,angle' })
            }

            // ── PHASE 6: Sync ad_creatives performance ────────────────
            try {
                const { data: launchedCreatives } = await supabase
                    .from('ad_creatives')
                    .select('id, meta_ad_id, status')
                    .eq('organization_id', orgId)
                    .in('status', ['launched', 'active'])
                    .not('meta_ad_id', 'is', null)

                if (launchedCreatives?.length) {
                    for (const creative of launchedCreatives) {
                        try {
                            const [insRes, stRes] = await Promise.all([
                                fetch(`https://graph.facebook.com/${META_API_VERSION}/${creative.meta_ad_id}/insights?fields=spend,impressions,clicks,actions,cost_per_action_type,ctr&date_preset=lifetime&access_token=${access_token}`),
                                fetch(`https://graph.facebook.com/${META_API_VERSION}/${creative.meta_ad_id}?fields=effective_status&access_token=${access_token}`),
                            ])
                            const insData = await insRes.json()
                            const stData = await stRes.json()
                            const ins = insData.data?.[0]

                            if (ins) {
                                const spend = Number(ins.spend) || 0
                                const clicks = Number(ins.clicks) || 0
                                const ctr = Number(ins.ctr) || 0
                                const leadAction = (ins.actions || []).find((a: any) => a.action_type === 'lead')
                                const leads = leadAction ? Number(leadAction.value) || 0 : 0
                                const cpl = leads > 0 ? spend / leads : 0
                                const eff = stData.effective_status
                                let newStatus = creative.status
                                let killReason: string | null = null
                                if (eff === 'PAUSED' || eff === 'CAMPAIGN_PAUSED' || eff === 'ADSET_PAUSED') {
                                    newStatus = 'killed'
                                    killReason = `Meta: ${eff}`
                                } else if (eff === 'ACTIVE') {
                                    newStatus = 'active'
                                }
                                await supabase.from('ad_creatives').update({
                                    spend, clicks, impressions: Number(ins.impressions) || 0,
                                    leads_count: leads, cpl: cpl > 0 ? cpl : null,
                                    ctr: ctr > 0 ? ctr : null, status: newStatus,
                                    kill_reason: killReason || undefined,
                                }).eq('id', creative.id)
                            }
                        } catch { }
                    }
                }
            } catch { }

            // ── PHASE 7: LLM Hypothesis Generator ────────────────────
            const hypothesis = await generateHypothesis(scoreResults, metricsByAngle, mission, targetCPL, targetCAC)

            // ── PHASE 8: Scale Actions (budget only, no kills) ────────
            const scaleActions: any[] = []
            const scaleTargets = Object.entries(scoreResults)
                .filter(([_, s]: [string, any]) => s.recommended_action === 'scale' && s.total_leads >= 3)
                .slice(0, MAX_SCALE_ACTIONS_PER_RUN)

            for (const [angle, scoreData] of scaleTargets) {
                // Find best performing campaign for this angle
                const angleCampaigns = ads7d.filter((a: any) => a.angle === angle)
                const uniqueCampaignIds = [...new Set(angleCampaigns.map((a: any) => a.campaign_id))]

                for (const cId of uniqueCampaignIds.slice(0, 1)) {
                    const currentBudget = campaignBudgets[cId as string] || 0
                    if (currentBudget <= 0) continue

                    let executionResult = 'dry_run'
                    if (isLive) {
                        const { newBudgetCents } = calculateNewBudget(currentBudget, 20)
                        const actionRes = await updateCampaignBudget(cId as string, newBudgetCents, access_token)
                        executionResult = actionRes.success ? 'executed' : 'failed'
                    }

                    scaleActions.push({
                        angle,
                        campaign_id: cId,
                        action: 'increase_budget',
                        action_value: 20,
                        result: executionResult,
                        reason: `Score ${(scoreData as any).score.toFixed(2)} — ${(scoreData as any).action_reason}`,
                    })
                    totalActions++
                }
            }

            // ── PHASE 9: Write to ai_strategy_log ────────────────────
            const cycleId = `${getCurrentWeekLabel()}-intelligence-${Date.now()}`
            const topAngleMetrics = Object.entries(scoreResults)
                .sort((a: any, b: any) => b[1].score - a[1].score)
                .slice(0, 3)
                .reduce((acc: any, [angle, s]: [string, any]) => {
                    acc[angle] = { score: s.score, cpl: s.avg_cpl, cac: s.avg_cac, leads: s.total_leads }
                    return acc
                }, {})

            await supabase.from('ai_strategy_log').insert({
                organization_id: orgId,
                cycle_id: cycleId,
                cycle_type: 'intelligence',
                hypothesis: hypothesis || { message: 'Dati insufficienti per generare ipotesi' },
                baseline_metrics: {
                    by_angle: topAngleMetrics,
                    total_spend_7d: ads7d.reduce((s: number, a: any) => s + a.spend, 0),
                    total_leads_7d: ads7d.reduce((s: number, a: any) => s + a.leads_count, 0),
                    target_cpl: targetCPL,
                    target_cac: targetCAC,
                },
            })

            // ── PHASE 10: Daily funnel snapshot ──────────────────────
            await upsertFunnelSnapshot(supabase, orgId, ads7d, funnelByAngle, mission)

            // Log to ai_episodes
            await supabase.from('ai_episodes').insert({
                organization_id: orgId,
                episode_type: 'automation',
                action_type: 'intelligence_v3_cycle',
                target_type: 'system',
                context: {
                    cycle_id: cycleId,
                    angles_scored: Object.keys(scoreResults).length,
                    scale_actions: scaleActions.length,
                    hypothesis_angle: (hypothesis as any)?.angle || null,
                    is_live: isLive,
                },
                reasoning: `Ciclo Intelligence v3: ${Object.keys(scoreResults).length} angoli valutati, ${scaleActions.length} azioni di scala`,
                outcome: 'positive',
                outcome_score: 0.6,
            })

            // ── PHASE 11: Telegram Report ─────────────────────────────
            await sendIntelligenceReport(supabase, orgId, scoreResults, metricsByAngle, scaleActions, hypothesis, mission, isLive, targetCPL, targetCAC)

            allResults.push({ orgId, scaleActions, anglesScored: Object.keys(scoreResults).length })
        }

        return NextResponse.json({ ok: true, totalActions, results: allResults })
    } catch (err: any) {
        console.error('[AI Intelligence Engine v3] Fatal error:', err)
        return NextResponse.json({ error: err.message || 'Internal error' }, { status: 500 })
    }
}

// ═══════════════════════════════════════════════════════════════
// ANGLE DETECTION — from ad name or adset name
// ═══════════════════════════════════════════════════════════════
function detectAngle(adName: string, adsetName?: string): string {
    const text = `${adName} ${adsetName || ''}`.toLowerCase()
    if (text.includes('emo') || text.includes('dolore') || text.includes('emotional')) return 'emotional'
    if (text.includes('eff') || text.includes('efficiency') || text.includes('split') || text.includes('gap')) return 'efficiency'
    if (text.includes('sys') || text.includes('system') || text.includes('metodo')) return 'system'
    if (text.includes('status') || text.includes('corona') || text.includes('87')) return 'status'
    if (text.includes('edu') || text.includes('lente') || text.includes('lavagna') || text.includes('education')) return 'education'
    if (text.includes('growth') || text.includes('crescita')) return 'growth'
    if (text.includes('trasf') || text.includes('reels')) return 'transformation'
    // Try from adset name angle keywords
    const knownAngles = ['emotional', 'efficiency', 'system', 'status', 'education', 'growth', 'transformation']
    for (const angle of knownAngles) {
        if (text.includes(angle)) return angle
    }
    return 'generic'
}

// ═══════════════════════════════════════════════════════════════
// CRM FUNNEL BY ANGLE — reads real pipeline stage_id + meta_data
// ═══════════════════════════════════════════════════════════════
async function getFunnelByAngle(supabase: any, orgId: string, days: number = 30): Promise<Record<string, any>> {
    try {
        const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

        // ── Fetch leads with their current stage slug ──────────────
        // We JOIN pipeline_stages to convert stage_id → slug name
        // utm_term lives in meta_data JSONB (not a direct column)
        const { data: leads } = await supabase
            .from('leads')
            .select(`
                id,
                utm_term,
                utm_campaign,
                meta_data,
                value,
                created_at,
                pipeline_stages!leads_stage_id_fkey (
                    id, slug, name, is_won, is_lost
                )
            `)
            .eq('organization_id', orgId)
            .gte('created_at', since)

        if (!leads?.length) return {}

        const byAngle: Record<string, {
            leads: number
            qualified: number
            appointments: number
            showups: number
            sales: number
            lost: number
            revenue: number
            // Cost attribution (filled by aggregateByAngle from Meta spend)
            spend?: number
        }> = {}

        for (const lead of leads) {
            // ── Resolve angle: priority order ──────────────────────
            // 1. meta_data.utm_term (set by landing page from adset utm_term)
            // 2. utm_term direct column (legacy fallback)
            // 3. utm_campaign name detection
            // 4. 'unknown' as fallback (not 'generic' — keeps it separate)
            const rawTerm = (
                lead.meta_data?.utm_term ||
                lead.utm_term ||
                ''
            ).toLowerCase().trim()

            const rawCampaign = (lead.utm_campaign || '').toLowerCase()

            // Map to canonical angle names (same as creative pipeline)
            const ANGLE_MAP: Record<string, string> = {
                'efficiency': 'efficiency', 'system': 'system',
                'emotional': 'emotional', 'status': 'status',
                'education': 'education', 'growth': 'growth',
                'authority': 'authority', 'security': 'security',
                'trauma': 'trauma', 'decision': 'decision',
                'sport_performance': 'sport_performance',
                'mental_coaching': 'mental_coaching',
                'generic': 'generic',
            }

            let angle = ANGLE_MAP[rawTerm] || null
            if (!angle) {
                // Partial match on utm_term
                if (rawTerm.includes('efficien')) angle = 'efficiency'
                else if (rawTerm.includes('system') || rawTerm.includes('metodo')) angle = 'system'
                else if (rawTerm.includes('emozion') || rawTerm.includes('trauma')) angle = 'trauma'
                else if (rawTerm.includes('status') || rawTerm.includes('elite')) angle = 'status'
                else if (rawTerm.includes('edu') || rawTerm.includes('learn')) angle = 'education'
                else if (rawTerm.includes('grow') || rawTerm.includes('crescit')) angle = 'growth'
                else if (rawTerm.includes('auth') || rawTerm.includes('leader')) angle = 'authority'
                else if (rawTerm.includes('secur') || rawTerm.includes('sicur')) angle = 'security'
                else if (rawTerm.includes('decis')) angle = 'decision'
                else if (rawTerm.includes('sport') || rawTerm.includes('calcio')) angle = 'sport_performance'
                else if (rawTerm.includes('mental')) angle = 'mental_coaching'
                // Fallback: try campaign name
                else angle = detectAngle('', rawCampaign) || 'unknown'
            }

            if (!byAngle[angle]) {
                byAngle[angle] = { leads: 0, qualified: 0, appointments: 0, showups: 0, sales: 0, lost: 0, revenue: 0 }
            }

            byAngle[angle].leads++

            // ── Resolve funnel stage from pipeline_stages JOIN ──────
            // The slug tells us exactly which step this lead is at
            const stageSlug = (lead.pipeline_stages as any)?.slug || ''
            const stageIsWon = (lead.pipeline_stages as any)?.is_won || false
            const stageIsLost = (lead.pipeline_stages as any)?.is_lost || false

            // Stages: lead → qualificato → appuntamento → show-up → vendita
            //                                                       → perso (is_lost)
            if (stageSlug === 'qualificato')   byAngle[angle].qualified++
            if (stageSlug === 'appuntamento' || stageSlug === 'show-up' || stageIsWon) {
                byAngle[angle].appointments++
            }
            if (stageSlug === 'show-up' || stageIsWon) {
                byAngle[angle].showups++
            }
            if (stageIsWon) {
                byAngle[angle].sales++
                byAngle[angle].revenue += Number(lead.value) || 0
            }
            if (stageIsLost) {
                byAngle[angle].lost++
            }
        }

        return byAngle
    } catch (err) {
        console.error('[CRM getFunnelByAngle] Error:', err)
        return {}
    }
}

// ═══════════════════════════════════════════════════════════════
// AGGREGATE METRICS BY ANGLE FROM ADS + CRM
// ═══════════════════════════════════════════════════════════════
function aggregateByAngle(ads: any[], funnelByAngle: Record<string, any>) {
    const byAngle: Record<string, any> = {}

    for (const ad of ads) {
        const angle = ad.angle || 'generic'
        if (!byAngle[angle]) byAngle[angle] = {
            spend: 0, leads: 0, impressions: 0, clicks: 0, ctr_sum: 0, ad_count: 0, active_ads: 0,
        }
        const a = byAngle[angle]
        a.spend += ad.spend
        a.leads += ad.leads_count
        a.impressions += ad.impressions
        a.clicks += ad.clicks
        a.ctr_sum += ad.ctr
        a.ad_count++
        if (ad.status === 'ACTIVE') a.active_ads++
    }

    // Merge CRM funnel data
    for (const [angle, meta] of Object.entries(byAngle)) {
        const crm = funnelByAngle[angle] || { leads: 0, qualified: 0, appointments: 0, showups: 0, sales: 0, lost: 0, revenue: 0 }
        const m = meta as any
        m.avg_cpl = m.leads > 0 ? m.spend / m.leads : 0
        m.avg_ctr = m.ad_count > 0 ? m.ctr_sum / m.ad_count : 0
        m.crm_leads = crm.leads
        m.crm_qualified = crm.qualified
        m.crm_appointments = crm.appointments
        m.crm_showups = crm.showups
        m.crm_sales = crm.sales
        m.crm_lost = crm.lost
        m.crm_revenue = crm.revenue
        // Use CRM leads as denominator for rates (more accurate than Meta pixel)
        const crmLeads = crm.leads || m.leads
        m.lead_to_appt_rate = crmLeads > 0 ? crm.appointments / crmLeads : 0
        m.appt_show_rate = crm.appointments > 0 ? crm.showups / crm.appointments : 0
        m.close_rate = crm.showups > 0 ? crm.sales / crm.showups : 0
        m.avg_cac = crm.sales > 0 ? m.spend / crm.sales : 0
        // Cost per appointment and cost per showup — key middle-funnel KPIs
        m.avg_cost_per_appt = crm.appointments > 0 ? m.spend / crm.appointments : 0
        m.avg_cost_per_showup = crm.showups > 0 ? m.spend / crm.showups : 0
        m.roas = crm.revenue > 0 && m.spend > 0 ? crm.revenue / m.spend : 0
    }

    return byAngle
}

// ═══════════════════════════════════════════════════════════════
// SCORE ENGINE — computes score [-1, +1] for each angle
// ═══════════════════════════════════════════════════════════════
function computeAllScores(
    metricsByAngle: Record<string, any>,
    existingScores: Record<string, any>,
    mission: any
): Record<string, any> {
    const targetCPL: number = mission.target_cpl || 20
    const targetCAC: number = mission.target_cac || 1500
    const targetLTAR: number = mission.target_lead_to_appt_rate || 0.40
    const optimizeFor: string = mission.optimize_for || 'cac'
    const results: Record<string, any> = {}

    for (const [angle, m] of Object.entries(metricsByAngle)) {
        const existing = existingScores[angle]
        let score = 0

        // ── CPL component (25%) ───────────────────
        if (m.avg_cpl > 0) {
            const cplRatio = (targetCPL - m.avg_cpl) / targetCPL
            score += clamp(cplRatio, -1, 1) * 0.25
        }

        // ── CAC component (35%) — most important ──
        if (m.avg_cac > 0) {
            const cacRatio = (targetCAC - m.avg_cac) / targetCAC
            score += clamp(cacRatio, -1, 1) * 0.35
        } else if (m.crm_appointments > 0 && m.crm_sales === 0) {
            // Has appointments but no sales yet — positive signal (funnel is working)
            // Partial credit based on appointment rate vs target
            const ltar = m.lead_to_appt_rate || 0
            if (ltar > 0.20) score += 0.10  // Good appointment rate → hopeful
            else score -= 0.05              // Low appointment rate → concern
        } else if (m.leads > 0 && m.crm_appointments === 0 && m.spend > targetCPL * 3) {
            // Spending money, lots of leads, zero appointments — punish
            score -= 0.15
        }

        // ── Lead→Appt rate (20%) ──────────────────
        if (m.lead_to_appt_rate > 0) {
            const ltarRatio = (m.lead_to_appt_rate - targetLTAR) / targetLTAR
            score += clamp(ltarRatio, -1, 1) * 0.20
        }

        // ── CTR component (10%) ───────────────────
        if (m.avg_ctr > 0) {
            const ctrBenchmark = 1.5 // 1.5% baseline CTR
            const ctrRatio = (m.avg_ctr - ctrBenchmark) / ctrBenchmark
            score += clamp(ctrRatio, -1, 1) * 0.10
        }

        // ── Data confidence (10% penalty if < 5 leads) ─
        if (m.leads < 3) {
            score = score * 0.5  // halve score if insufficient data
        }

        score = clamp(score, -1, 1)

        // Determine recommended action
        let recommended_action = 'maintain'
        let recommended_budget_ratio = 0.16  // 1/6 default
        let action_reason = 'Stabilità — mantieni il budget corrente'

        if (score >= 0.45) {
            recommended_action = 'scale'
            recommended_budget_ratio = 0.25
            action_reason = `Score ${score.toFixed(2)} eccellente — scala budget +20%`
        } else if (score >= 0.20) {
            recommended_action = 'maintain'
            recommended_budget_ratio = 0.20
            action_reason = `Score ${score.toFixed(2)} positivo — mantieni e ottimizza`
        } else if (score >= -0.10) {
            recommended_action = 'test'
            recommended_budget_ratio = 0.12
            action_reason = `Score ${score.toFixed(2)} neutro — genera nuove ads per testare`
        } else if (score >= -0.40) {
            recommended_action = 'reduce'
            recommended_budget_ratio = 0.08
            action_reason = `Score ${score.toFixed(2)} negativo — riduci budget, non generare nuove ads`
        } else {
            recommended_action = 'pause'
            recommended_budget_ratio = 0
            action_reason = `Score ${score.toFixed(2)} critico — considera pausa angolo`
        }

        results[angle] = {
            score,
            avg_cpl: m.avg_cpl || 0,
            avg_cac: m.avg_cac || 0,
            avg_ctr: m.avg_ctr || 0,
            lead_to_appt_rate: m.lead_to_appt_rate || 0,
            total_spend: m.spend || 0,
            total_leads: m.leads || 0,
            total_appointments: m.crm_appointments || 0,
            total_showups: m.crm_showups || 0,
            total_sales: m.crm_sales || 0,
            active_ads: m.active_ads || 0,
            recommended_action,
            recommended_budget_ratio,
            action_reason,
        }
    }

    return results
}

// ═══════════════════════════════════════════════════════════════
// LLM HYPOTHESIS GENERATOR
// ═══════════════════════════════════════════════════════════════
async function generateHypothesis(
    scoreResults: Record<string, any>,
    metricsByAngle: Record<string, any>,
    mission: any,
    targetCPL: number,
    targetCAC: number
): Promise<any> {
    try {
        const apiKey = process.env.OPENROUTER_API_KEY
        if (!apiKey) return null

        const anglesReport = Object.entries(scoreResults)
            .sort((a: any, b: any) => b[1].score - a[1].score)
            .map(([angle, s]: [string, any]) => {
                const m = metricsByAngle[angle] as any
                return `- ${angle.toUpperCase()}: score=${s.score.toFixed(2)} | CPL €${s.avg_cpl.toFixed(2)} | CAC €${s.avg_cac > 0 ? s.avg_cac.toFixed(0) : 'n/d'} | lead: ${s.total_leads} | appt→sale: ${m?.crm_appointments || 0}→${m?.crm_sales || 0} | azione: ${s.recommended_action}`
            }).join('\n')

        const prompt = `Sei il cervello strategico di Metodo Sincro (coaching mentale calcio).
Analizza questi dati degli angoli creativi Meta Ads e proponi UNA SOLA ipotesi strategica da testare questa settimana.

OBIETTIVI SETTIMANA:
- CPL target: €${targetCPL}
- CAC target: €${targetCAC}
- Ottimizza per: ${mission.optimize_for || 'cac'}

SITUAZIONE ANGOLI (7 giorni):
${anglesReport}

REGOLE:
- Proponi UN'UNICA azione concreta e misurabile
- Scegli tra: 'scale_budget_20pct', 'generate_3_new_ads', 'pause_angle', 'test_new_pocket', 'increase_frequency_post'
- Stima l'impatto atteso in % sul CAC o CPL
- Sii specifico sull'angolo e sul motivo

Rispondi SOLO con JSON valido:
{"angle":"...","action":"...","expected_delta_cac_pct":0,"reasoning":"...","confidence":"low|medium|high"}`

        const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
            body: JSON.stringify({
                model: 'google/gemini-2.5-flash',
                messages: [{ role: 'user', content: prompt }],
                temperature: 0.3,
            }),
        })

        if (!res.ok) return null
        const data = await res.json()
        const reply = data.choices?.[0]?.message?.content || ''
        const jsonMatch = reply.match(/\{[\s\S]*\}/)
        if (jsonMatch) return JSON.parse(jsonMatch[0])
        return null
    } catch {
        return null
    }
}

// ═══════════════════════════════════════════════════════════════
// FUNNEL SNAPSHOT UPSERT
// ═══════════════════════════════════════════════════════════════
async function upsertFunnelSnapshot(supabase: any, orgId: string, ads7d: any[], funnelByAngle: Record<string, any>, mission: any) {
    try {
        const totalSpend = ads7d.reduce((s: number, a: any) => s + a.spend, 0)
        const totalLeads = ads7d.reduce((s: number, a: any) => s + a.leads_count, 0)
        const allCRM = Object.values(funnelByAngle).reduce((acc: any, v: any) => ({
            appointments: (acc.appointments || 0) + v.appointments,
            showups: (acc.showups || 0) + v.showups,
            sales: (acc.sales || 0) + v.sales,
            revenue: (acc.revenue || 0) + v.revenue,
        }), {})

        const snap = {
            organization_id: orgId,
            snapshot_date: new Date().toISOString().slice(0, 10),
            total_spend: totalSpend,
            total_leads: totalLeads,
            total_appointments: allCRM.appointments || 0,
            total_showups: allCRM.showups || 0,
            total_sales: allCRM.sales || 0,
            total_revenue: allCRM.revenue || 0,
            cpl: totalLeads > 0 ? totalSpend / totalLeads : null,
            cac: allCRM.sales > 0 ? totalSpend / allCRM.sales : null,
            lead_to_appt_rate: totalLeads > 0 ? (allCRM.appointments || 0) / totalLeads : null,
            appt_show_rate: (allCRM.appointments || 0) > 0 ? (allCRM.showups || 0) / (allCRM.appointments || 0) : null,
            close_rate: (allCRM.showups || 0) > 0 ? (allCRM.sales || 0) / (allCRM.showups || 0) : null,
            roas: allCRM.revenue > 0 && totalSpend > 0 ? allCRM.revenue / totalSpend : null,
            by_angle: funnelByAngle,
            vs_weekly_leads_pct: mission.weekly_leads_target > 0 ? (totalLeads / mission.weekly_leads_target) * 100 : null,
            vs_weekly_sales_pct: mission.weekly_sales_target > 0 ? ((allCRM.sales || 0) / mission.weekly_sales_target) * 100 : null,
            vs_weekly_spend_pct: mission.weekly_spend_budget > 0 ? (totalSpend / mission.weekly_spend_budget) * 100 : null,
            week_label: getCurrentWeekLabel(),
        }

        await supabase.from('ai_funnel_snapshots')
            .upsert(snap, { onConflict: 'organization_id,snapshot_date' })
    } catch (e) {
        console.error('[Intelligence Engine] Snapshot error:', e)
    }
}

// ═══════════════════════════════════════════════════════════════
// TELEGRAM REPORT
// ═══════════════════════════════════════════════════════════════
async function sendIntelligenceReport(
    supabase: any, orgId: string,
    scoreResults: Record<string, any>,
    metricsByAngle: Record<string, any>,
    scaleActions: any[],
    hypothesis: any,
    mission: any,
    isLive: boolean,
    targetCPL: number,
    targetCAC: number
) {
    try {
        const { data: conn } = await supabase
            .from('connections')
            .select('credentials')
            .eq('organization_id', orgId)
            .eq('provider', 'telegram')
            .eq('status', 'active')
            .single()

        if (!conn?.credentials?.bot_token || !conn?.credentials?.chat_id) return

        const mode = isLive ? '🟢 LIVE' : '🟡 DRY RUN'
        const scoreBar = (score: number) => {
            const filled = Math.round((score + 1) * 5)
            return '█'.repeat(Math.max(0, filled)) + '░'.repeat(Math.max(0, 10 - filled))
        }
        const trendIcon = (trend: string) => ({ rising: '↑', falling: '↓', stable: '→' })[trend] || '→'

        let msg = `🧠 <b>Intelligence Engine v3</b> [${mode}]\n`
        msg += `─────────────────\n\n`

        msg += `📊 <b>SCORE ANGOLI</b>\n`
        const sorted = Object.entries(scoreResults).sort((a: any, b: any) => b[1].score - a[1].score)
        for (const [angle, s] of sorted as [string, any][]) {
            const m = metricsByAngle[angle] as any
            const emoji = s.score > 0.3 ? '🟢' : s.score > -0.1 ? '🟡' : '🔴'
            const cac = s.avg_cac > 0 ? `CAC €${s.avg_cac.toFixed(0)}` : 'CAC n/d'
            const cpAppt = m?.avg_cost_per_appt > 0 ? ` | CPAppt €${m.avg_cost_per_appt.toFixed(0)}` : ''
            msg += `${emoji} <b>${angle.toUpperCase()}</b> [${scoreBar(s.score)}]\n`
            msg += `  CPL €${s.avg_cpl.toFixed(2)} | ${cac}${cpAppt}\n`
            // Full funnel: lead → appt → show-up → sale
            const appt = m?.crm_appointments ?? s.total_appointments
            const showup = m?.crm_showups ?? s.total_showups
            const sale = m?.crm_sales ?? s.total_sales
            const lost = m?.crm_lost ?? 0
            const roas = m?.roas > 0 ? ` | ROAS ${m.roas.toFixed(1)}x` : ''
            msg += `  📍 ${s.total_leads} lead → ${appt} appt → ${showup} show → ${sale} vendite${roas}`
            if (lost > 0) msg += ` | ❌ ${lost} persi`
            msg += `\n`
            msg += `  → ${s.recommended_action.toUpperCase()}: ${s.action_reason}\n\n`
        }

        if (scaleActions.length > 0) {
            msg += `📈 <b>AZIONI SCALA</b>\n`
            for (const a of scaleActions) {
                const icon = a.result === 'executed' ? '✅' : '📝'
                msg += `${icon} ${a.angle.toUpperCase()} +${a.action_value}% budget\n`
                msg += `  ${a.reason}\n\n`
            }
        }

        if (hypothesis) {
            const confIcon = { high: '🎯', medium: '💡', low: '🔬' }[hypothesis.confidence as string] || '💡'
            msg += `${confIcon} <b>IPOTESI QUESTA SETTIMANA</b>\n`
            msg += `Angolo: <b>${(hypothesis.angle || '').toUpperCase()}</b>\n`
            msg += `Azione: ${hypothesis.action}\n`
            msg += `Impatto atteso: ${hypothesis.expected_delta_cac_pct > 0 ? '+' : ''}${hypothesis.expected_delta_cac_pct}% CAC\n`
            msg += `📝 ${hypothesis.reasoning}\n`
            msg += `Confidence: ${hypothesis.confidence}\n\n`
        }

        msg += `⏰ Prossimo ciclo tra 60 min\n`
        msg += `🔁 Ratchet Evaluator: ore 23:00`

        await sendTelegramDirect(conn.credentials.bot_token, conn.credentials.chat_id, msg)
    } catch (e) {
        console.error('[Intelligence Engine] Telegram error:', e)
    }
}

// ═══════════════════════════════════════════════════════════════
// UTILITIES
// ═══════════════════════════════════════════════════════════════
function clamp(val: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, val))
}

function computeTrend(history: number[]): string {
    if (history.length < 3) return 'stable'
    const recent = history.slice(-3)
    const delta = recent[2] - recent[0]
    if (delta > 0.05) return 'rising'
    if (delta < -0.05) return 'falling'
    return 'stable'
}

function getCurrentWeekLabel(): string {
    const now = new Date()
    const startOfYear = new Date(now.getFullYear(), 0, 1)
    const weekNum = Math.ceil(((now.getTime() - startOfYear.getTime()) / 86400000 + startOfYear.getDay() + 1) / 7)
    return `${now.getFullYear()}-W${String(weekNum).padStart(2, '0')}`
}
