import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendTelegramDirect } from '@/lib/telegram'
import { pauseAd, updateCampaignBudget, calculateNewBudget } from '@/lib/meta-actions'

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
)

const META_API_VERSION = 'v21.0'
const MAX_ACTIONS_PER_RUN = 5
const COOLDOWN_HOURS = 24
const MIN_ACTIVE_ADS_PER_CAMPAIGN = 2 // Safety: never kill ALL ads in a campaign

// AI Engine Cron — called every 60 minutes
// Fetches ad data from Meta, evaluates rules, and optionally executes actions
export const maxDuration = 60

export async function GET(req: NextRequest) {
    const authHeader = req.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
        // Get all orgs with autopilot active
        const { data: configs } = await supabaseAdmin
            .from('ai_agent_config')
            .select('organization_id, autopilot_active, execution_mode, analysis_interval_minutes')
            .eq('autopilot_active', true)

        if (!configs?.length) {
            return NextResponse.json({ ok: true, message: 'No active autopilots' })
        }

        let totalActions = 0

        for (const config of configs) {
            const orgId = config.organization_id
            const isLive = config.execution_mode === 'live'

            // Get Meta credentials
            const { data: conn } = await supabaseAdmin
                .from('connections')
                .select('credentials')
                .eq('organization_id', orgId)
                .eq('provider', 'meta_ads')
                .eq('status', 'active')
                .single()

            if (!conn?.credentials?.access_token) continue

            const { access_token, ad_account_id } = conn.credentials
            const adAccount = `act_${ad_account_id}`

            // Fetch ad-level insights — DUAL WINDOW:
            // 1) Last 7 days → for scale/winner/fatigue rules (need enough data for trends)
            // 2) Today only → for kill rules (catch ads burning money RIGHT NOW)
            const today = new Date().toISOString().slice(0, 10)
            const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

            const buildInsightsUrl = (since: string, until: string) =>
                `https://graph.facebook.com/${META_API_VERSION}/${adAccount}/insights?` +
                `fields=ad_id,ad_name,campaign_id,campaign_name,spend,impressions,clicks,ctr,frequency,actions,cost_per_action_type` +
                `&level=ad&time_range=${encodeURIComponent(JSON.stringify({ since, until }))}&limit=500&access_token=${access_token}`

            const [insights7dRes, insightsTodayRes] = await Promise.all([
                fetch(buildInsightsUrl(sevenDaysAgo, today)),
                fetch(buildInsightsUrl(today, today)),
            ])
            if (!insights7dRes.ok) continue

            const insights7d = await insights7dRes.json()
            const insightsToday = insightsTodayRes.ok ? await insightsTodayRes.json() : { data: [] }

            // Get ad statuses
            const adsUrl = `https://graph.facebook.com/${META_API_VERSION}/${adAccount}/ads?` +
                `fields=id,status,effective_status,campaign_id&limit=500&access_token=${access_token}`
            const adsRes = await fetch(adsUrl)
            const adsData = adsRes.ok ? await adsRes.json() : { data: [] }

            const adStatusMap: Record<string, string> = {}
            for (const ad of (adsData.data || [])) {
                adStatusMap[ad.id] = ad.effective_status
            }

            // Build ad data from insights
            const buildAds = (insightsData: any) =>
                (insightsData.data || []).map((insight: any) => {
                    const leadsCount = insight.actions?.find((a: any) => a.action_type === 'lead')?.value || 0
                    const cplValue = insight.cost_per_action_type?.find((a: any) => a.action_type === 'lead')?.value || 0
                    return {
                        ad_id: insight.ad_id,
                        ad_name: insight.ad_name,
                        campaign_id: insight.campaign_id,
                        campaign_name: insight.campaign_name,
                        status: adStatusMap[insight.ad_id] || 'UNKNOWN',
                        spend: parseFloat(insight.spend || '0'),
                        impressions: parseInt(insight.impressions || '0'),
                        clicks: parseInt(insight.clicks || '0'),
                        ctr: parseFloat(insight.ctr || '0'),
                        frequency: parseFloat(insight.frequency || '0'),
                        leads_count: parseInt(leadsCount),
                        cpl: parseFloat(cplValue),
                    }
                }).filter((a: any) => a.status === 'ACTIVE')

            const ads7d = buildAds(insights7d)
            const adsToday = buildAds(insightsToday)

            if (ads7d.length === 0 && adsToday.length === 0) continue

            // Use ALL active ads for the status map (combines both windows)
            const allActiveAds = ads7d.length > 0 ? ads7d : adsToday

            // Get campaign budgets
            const campaignIds = [...new Set(allActiveAds.map((a: any) => a.campaign_id))]
            const campaignBudgets: Record<string, number> = {}
            for (const cId of campaignIds) {
                try {
                    const cRes = await fetch(`https://graph.facebook.com/${META_API_VERSION}/${cId}?fields=daily_budget&access_token=${access_token}`)
                    if (cRes.ok) {
                        const cData = await cRes.json()
                        campaignBudgets[cId as string] = parseFloat(cData.daily_budget || '0') / 100
                    }
                } catch { }
            }

            // Get rules and targets
            const [rulesRes, targetsRes] = await Promise.all([
                supabaseAdmin.from('ad_automation_rules').select('*')
                    .eq('organization_id', orgId).eq('is_enabled', true),
                supabaseAdmin.from('ad_optimization_targets').select('*')
                    .eq('organization_id', orgId).single(),
            ])

            const rules = rulesRes.data || []
            const targets = targetsRes.data || null

            // DUAL EVALUATION:
            // 1) 7-day data → scale/winner/fatigue rules (need trend data)
            // 2) Today data → kill rules (catch daily money-burners)
            const results7d = evaluateRulesAdLevel(rules, ads7d, campaignBudgets, targets)
            const killRules = rules.filter(r => ['creative_kill'].includes(r.category))
            const resultsToday = adsToday.length > 0
                ? evaluateRulesAdLevel(killRules, adsToday, campaignBudgets, targets)
                : []

            // Merge results, deduplicate by ad_id + action (today's kill takes priority)
            const todayKillAdIds = new Set(resultsToday.map((r: any) => `${r.ad_id}_${r.action}`))
            const results = [
                ...resultsToday.map((r: any) => ({ ...r, source: 'today' })),
                ...results7d.filter((r: any) => !todayKillAdIds.has(`${r.ad_id}_${r.action}`)).map((r: any) => ({ ...r, source: '7d' })),
            ]

            if (results.length === 0) continue

            // Check cooldown — skip ads/campaigns with recent actions
            const { data: recentExecutions } = await supabaseAdmin
                .from('ad_rule_executions')
                .select('campaign_id, entity_name, executed_at')
                .eq('organization_id', orgId)
                .eq('result', 'executed')
                .gte('executed_at', new Date(Date.now() - COOLDOWN_HOURS * 60 * 60 * 1000).toISOString())

            const recentIds = new Set((recentExecutions || []).map(e => e.campaign_id))

            // Filter out cooled-down and limit actions
            const actionable = results
                .filter(r => !recentIds.has(r.ad_id || r.campaign_id))
                .slice(0, MAX_ACTIONS_PER_RUN)

            // Safety guard: count active ads per campaign to prevent killing ALL ads
            const activeAdsPerCampaign: Record<string, number> = {}
            allActiveAds.forEach((ad: any) => {
                if (!activeAdsPerCampaign[ad.campaign_id]) activeAdsPerCampaign[ad.campaign_id] = 0
                activeAdsPerCampaign[ad.campaign_id]++
            })

            // Track kills per campaign during this run
            const killsThisRun: Record<string, number> = {}

            // Execute or dry-run
            const executedResults: any[] = []
            const skippedSafety: any[] = [] // Ads skipped due to safety guard
            for (const result of actionable) {
                let executionResult = 'dry_run'
                let executionDetails: any = null

                if (isLive) {
                    // LIVE: execute real actions on Meta
                    if (result.action === 'pause_ad' && result.ad_id) {
                        // SAFETY: Don't kill if it would leave campaign with < MIN_ACTIVE_ADS
                        const campaignId = result.campaign_id
                        const currentActive = (activeAdsPerCampaign[campaignId] || 0) - (killsThisRun[campaignId] || 0)
                        if (currentActive <= MIN_ACTIVE_ADS_PER_CAMPAIGN) {
                            executionResult = 'skipped_safety'
                            executionDetails = { reason: `Safety guard: solo ${currentActive} ad attive nella campagna, serve minimo ${MIN_ACTIVE_ADS_PER_CAMPAIGN}` }
                            skippedSafety.push(result)
                        } else {
                            const actionRes = await pauseAd(result.ad_id, access_token)
                            executionResult = actionRes.success ? 'executed' : 'failed'
                            executionDetails = actionRes
                            if (actionRes.success) {
                                killsThisRun[campaignId] = (killsThisRun[campaignId] || 0) + 1
                            }
                        }
                    } else if (result.action === 'increase_budget' && result.campaign_id) {
                        const currentBudget = campaignBudgets[result.campaign_id] || 0
                        if (currentBudget > 0) {
                            const { newBudgetCents } = calculateNewBudget(currentBudget, result.action_value || 15)
                            const actionRes = await updateCampaignBudget(result.campaign_id, newBudgetCents, access_token)
                            executionResult = actionRes.success ? 'executed' : 'failed'
                            executionDetails = { ...actionRes, previousBudget: currentBudget }
                        }
                    } else if (result.action === 'decrease_budget' && result.campaign_id) {
                        const currentBudget = campaignBudgets[result.campaign_id] || 0
                        if (currentBudget > 0) {
                            const { newBudgetCents } = calculateNewBudget(currentBudget, -(result.action_value || 15))
                            const actionRes = await updateCampaignBudget(result.campaign_id, newBudgetCents, access_token)
                            executionResult = actionRes.success ? 'executed' : 'failed'
                            executionDetails = { ...actionRes, previousBudget: currentBudget }
                        }
                    } else if (result.action === 'flag_winner' || result.action === 'alert') {
                        executionResult = 'logged' // These don't need Meta API calls
                    }
                }

                executedResults.push({ ...result, executionResult, executionDetails })
            }

            // Log to ad_rule_executions
            if (executedResults.length > 0) {
                await supabaseAdmin.from('ad_rule_executions').insert(
                    executedResults.map(r => ({
                        organization_id: orgId,
                        rule_id: r.rule_id,
                        rule_name: r.rule_name,
                        campaign_id: r.campaign_id || r.ad_id,
                        entity_name: r.entity_name,
                        action_taken: r.action,
                        metrics_snapshot: r.metrics,
                        result: r.executionResult,
                        notes: r.reason + (r.executionDetails ? ` | Details: ${JSON.stringify(r.executionDetails)}` : ''),
                    }))
                )

                // Log to AI Episodes
                await supabaseAdmin.from('ai_episodes').insert(
                    executedResults.map(r => ({
                        organization_id: orgId,
                        episode_type: 'automation',
                        action_type: `rule_${r.action}`,
                        target_type: r.entity_type || 'ad',
                        target_id: r.ad_id || r.campaign_id,
                        target_name: r.entity_name,
                        context: {
                            rule_name: r.rule_name,
                            category: r.category,
                            action_value: r.action_value,
                            phase: r.executionResult,
                            cron: true,
                        },
                        reasoning: r.reason,
                        metrics_before: r.metrics,
                        outcome: r.executionResult === 'executed' ? 'positive' : 'neutral',
                        outcome_score: r.executionResult === 'executed' ? 0.7 : 0,
                    }))
                )

                totalActions += executedResults.length

                // Send Telegram notification with creative refresh recommendations
                const killedAds = executedResults.filter(r => r.action === 'pause_ad' && r.executionResult === 'executed')
                await sendCronTelegramReport(orgId, executedResults, isLive, killedAds, allActiveAds, skippedSafety)
            }
        }

        return NextResponse.json({ ok: true, totalActions })
    } catch (err) {
        console.error('AI Engine cron error:', err)
        return NextResponse.json({ error: 'Internal error' }, { status: 500 })
    }
}

// --- Telegram Report ---
async function sendCronTelegramReport(
    orgId: string, results: any[], isLive: boolean,
    killedAds: any[] = [], allAds: any[] = [], skippedSafety: any[] = []
) {
    try {
        const { data: conn } = await supabaseAdmin
            .from('connections')
            .select('credentials')
            .eq('organization_id', orgId)
            .eq('provider', 'telegram')
            .eq('status', 'active')
            .single()

        if (!conn?.credentials?.bot_token || !conn?.credentials?.chat_id) return

        const categoryEmoji: Record<string, string> = {
            creative_kill: '🔴', creative_winner: '🟢',
            budget_scale_up: '📈', budget_scale_down: '📉',
            fatigue: '🔄', learning_protection: '⏸',
        }

        const modeLabel = isLive ? '🟢 LIVE' : '🟡 DRY RUN'
        let msg = `🤖 <b>AI Engine — Cron Automatico</b>\n`
        msg += `${modeLabel} • ${results.length} regole attivate\n\n`

        const grouped: Record<string, any[]> = {}
        results.forEach(r => {
            if (!grouped[r.category]) grouped[r.category] = []
            grouped[r.category].push(r)
        })

        for (const [cat, items] of Object.entries(grouped)) {
            const emoji = categoryEmoji[cat] || '•'
            msg += `${emoji} <b>${cat.replace(/_/g, ' ').toUpperCase()}</b>\n`
            for (const r of items) {
                const statusIcon = r.executionResult === 'executed' ? '✅' :
                    r.executionResult === 'failed' ? '❌' :
                    r.executionResult === 'skipped_safety' ? '🛡' : '📝'
                msg += `  ${statusIcon} ${r.entity_name}: ${r.action}`
                if (r.action_value) msg += ` (${r.action_value}%)`
                if (r.executionResult === 'skipped_safety') msg += ' (SAFETY: min ads attive)'
                msg += '\n'
            }
            msg += '\n'
        }

        // Safety guard warning
        if (skippedSafety.length > 0) {
            msg += `🛡 <b>SAFETY GUARD</b>: ${skippedSafety.length} kill bloccate per mantenere minimo ${MIN_ACTIVE_ADS_PER_CAMPAIGN} ads attive per campagna\n\n`
        }

        // Count active ads remaining
        const activeCount = allAds.filter((a: any) => a.status === 'ACTIVE').length
        const killedCount = killedAds.length
        msg += `📊 Ads attive: ${activeCount - killedCount}/${activeCount}`
        if (killedCount > 0) msg += ` (${killedCount} pausate)`
        msg += '\n'

        // 🏆 WINNER INTELLIGENCE — Analyze what's working and WHY
        const adsWithLeads = allAds.filter((a: any) => a.leads_count > 0 && a.spend > 0)
        if (adsWithLeads.length > 0) {
            // Sort by CPL (lowest = best)
            const topPerformers = [...adsWithLeads]
                .sort((a: any, b: any) => (a.spend / a.leads_count) - (b.spend / b.leads_count))
                .slice(0, 3)

            msg += '\n🏆 <b>WINNER INTELLIGENCE</b>\n'
            msg += '─────────────────\n'

            for (const ad of topPerformers) {
                const cpl = (ad.spend / ad.leads_count).toFixed(2)
                const adName = ad.ad_name || ''

                // Detect creative angle from ad name
                let angle = '🎯 Angolo generico'
                let whyItWorks = 'Buone metriche generali'

                if (adName.includes('EMO') || adName.includes('Emozione') || adName.includes('Dolore')) {
                    angle = '😢 EMOTIONAL'
                    whyItWorks = 'Hook emotivo forte → il prospect si identifica nel dolore → azione immediata'
                } else if (adName.includes('EFF') || adName.includes('Effic') || adName.includes('Split') || adName.includes('Gap')) {
                    angle = '⚡ EFFICIENCY'
                    whyItWorks = 'Confronto/gap visivo → il prospect capisce la differenza → urgenza di agire'
                } else if (adName.includes('SYS') || adName.includes('System') || adName.includes('Metodo')) {
                    angle = '⚙️ SYSTEM'
                    whyItWorks = 'Proposta di metodo strutturato → il prospect vede un percorso chiaro → fiducia'
                } else if (adName.includes('Status') || adName.includes('Corona') || adName.includes('87')) {
                    angle = '👑 STATUS'
                    whyItWorks = 'Social proof + aspirazione → il prospect vuole far parte del gruppo vincente'
                } else if (adName.includes('EDU') || adName.includes('Lente') || adName.includes('Lavagna')) {
                    angle = '📚 EDUCATION'
                    whyItWorks = 'Contenuto di valore → il prospect impara qualcosa → autorità del brand'
                } else if (adName.includes('Trasf') || adName.includes('Reels')) {
                    angle = '🔄 TRASFORMAZIONE'
                    whyItWorks = 'Before/after visivo → il prospect visualizza il risultato → desiderio'
                }

                // Detect format from ad name hints
                let format = '📸 Immagine'
                if (adName.toLowerCase().includes('video') || adName.toLowerCase().includes('reel')) format = '🎬 Video/Reel'

                msg += `\n✅ <b>${adName}</b>\n`
                msg += `  📊 CPL: €${cpl} | ${ad.leads_count} leads | €${ad.spend.toFixed(0)} spend\n`
                msg += `  🎨 ${angle}\n`
                msg += `  💡 Perché funziona: ${whyItWorks}\n`
            }

            // Summary insight
            const bestAngle = topPerformers[0]
            const bestAdName = bestAngle?.ad_name || ''
            let bestAngleType = 'generico'
            if (bestAdName.includes('EMO')) bestAngleType = 'EMOTIONAL'
            else if (bestAdName.includes('EFF') || bestAdName.includes('Gap') || bestAdName.includes('Split')) bestAngleType = 'EFFICIENCY'
            else if (bestAdName.includes('SYS')) bestAngleType = 'SYSTEM'
            else if (bestAdName.includes('Status')) bestAngleType = 'STATUS'
            else if (bestAdName.includes('EDU')) bestAngleType = 'EDUCATION'

            msg += `\n🧠 <b>Insight:</b> L'angolo ${bestAngleType} è il più performante. Crea nuove varianti con lo stesso angolo ma diverso hook/visual per scalare.\n`
            msg += `💡 <b>Andromeda tip:</b> duplica la winner, cambia solo l'hook nei primi 3 secondi (video) o nel titolo (immagine). Meta testerà automaticamente.\n`
        }

        // 🎨 CREATIVE REFRESH RECOMMENDATIONS (Andromeda best practices)
        if (killedCount > 0) {
            msg += '\n🎨 <b>NUOVE CREATIVE NECESSARIE</b>\n'
            msg += '─────────────────\n'

            // Extract adset info from killed ads
            const killedByAdset: Record<string, { adset: string, campaign: string, ads: string[] }> = {}
            killedAds.forEach((k: any) => {
                const adName = k.entity_name || ''
                const campaignName = k.metrics?.campaign_name || adName.split('(').pop()?.replace(')', '') || ''
                
                let adsetKey = campaignName
                if (adName.includes('EMO')) adsetKey = 'EMOTIONAL'
                else if (adName.includes('SYS')) adsetKey = 'SYSTEM'
                else if (adName.includes('EFF')) adsetKey = 'EFFICIENCY'
                else if (adName.includes('EDU')) adsetKey = 'EDUCATION'
                else if (adName.includes('Status')) adsetKey = 'STATUS'
                
                if (!killedByAdset[adsetKey]) killedByAdset[adsetKey] = { adset: adsetKey, campaign: campaignName, ads: [] }
                killedByAdset[adsetKey].ads.push(adName.split('(')[0].trim())
            })

            for (const [adsetName, info] of Object.entries(killedByAdset)) {
                const angleGuides: Record<string, string> = {
                    'EMOTIONAL': '😢 Angolo: dolore, frustrazione, paura → Hook emotivo forte, video/immagine impatto',
                    'SYSTEM': '⚙️ Angolo: controllo, metodo, organizzazione → Hook razionale, struttura, step-by-step',
                    'EFFICIENCY': '⚡ Angolo: risultati rapidi, ottimizzazione → Hook con numeri/%, split test, before/after',
                    'STATUS': '👑 Angolo: élite, esclusività, immagine → Hook aspirazionale, lifestyle, social proof',
                    'EDUCATION': '📚 Angolo: consapevolezza, curiosità → Hook educativo, domanda provocatoria, stat',
                }
                const guide = angleGuides[adsetName] || '🎯 Angolo: testare nuovo hook e visual'

                msg += `\n📌 <b>Adset: ${adsetName}</b>\n`
                msg += `  Ads killate: ${info.ads.join(', ')}\n`
                msg += `  ${guide}\n`
                msg += `  💡 Andromeda: crea 2-3 varianti (diverso hook + diverso visual), Meta testerà automaticamente\n`
            }

            msg += `\n⚠️ <b>Azione richiesta:</b> crea nuove creative per gli adset sopra e caricale su Meta. L'AI le valuterà automaticamente.\n`
        }

        msg += `\n⏰ Prossima valutazione tra 60 min`

        await sendTelegramDirect(conn.credentials.bot_token, conn.credentials.chat_id, msg)
    } catch (err) {
        console.error('Telegram cron report error:', err)
    }
}

// --- Rules Evaluation (same logic as ai-engine API, duplicated for cron context) ---

function evaluateRulesAdLevel(rules: any[], ads: any[], campaignBudgets: Record<string, number>, targets: any) {
    const results: any[] = []
    const targetCPL = targets?.target_cpl || 20

    const learningRules = rules.filter(r => r.category === 'learning_protection')
    const adLevelRules = rules.filter(r => ['creative_kill', 'creative_winner', 'fatigue'].includes(r.category))
    const campaignLevelRules = rules.filter(r => ['budget_scale_up', 'budget_scale_down'].includes(r.category))

    // 1. Learning phase protection
    // IMPORTANT: Ads that have spent > 2x target CPL are NOT protected — they're past learning
    // and clearly burning money. This ensures kill rules can fire on underperformers.
    const protectedAdIds = new Set<string>()
    ads.forEach(ad => {
        const metrics = extractMetrics(ad)

        // OVERRIDE: If ad spent > 2x target CPL with 0 leads, it's NOT in learning — it's burning money
        if (metrics.spend > targetCPL * 2 && metrics.leads === 0) return
        // OVERRIDE: If ad spent > target CPL, it has had enough budget to prove itself
        if (metrics.spend > targetCPL) return

        learningRules.forEach(rule => {
            const conditions = Array.isArray(rule.conditions) ? rule.conditions : []
            if (evalConditions(conditions, metrics, targetCPL) && conditions.length > 0) {
                protectedAdIds.add(ad.ad_id)
                results.push({
                    rule_id: rule.id, rule_name: rule.name, category: 'learning_protection',
                    campaign_id: ad.campaign_id, ad_id: ad.ad_id,
                    entity_name: `⏸ ${ad.ad_name} (${ad.campaign_name})`,
                    entity_type: 'ad', action: 'block_other_rules', action_value: null,
                    reason: `Learning phase: €${metrics.spend.toFixed(2)} spent, ${metrics.impressions} impressions`,
                    metrics,
                })
            }
        })
    })

    // 2. Ad-level rules (skip protected)
    const evaluableAds = ads.filter(ad => !protectedAdIds.has(ad.ad_id))
    evaluableAds.forEach(ad => {
        const metrics = extractMetrics(ad)
        adLevelRules.forEach(rule => {
            if (metrics.spend < (rule.min_spend_before_eval || 0)) return
            const conditions = Array.isArray(rule.conditions) ? rule.conditions : []
            if (evalConditions(conditions, metrics, targetCPL) && conditions.length > 0) {
                const actions = Array.isArray(rule.actions) ? rule.actions : []
                const reason = `${rule.name}: ${conditions.map((c: any) => `${c.metric} ${c.operator} ${c.value || c.value_multiplier + 'x target'}`).join(' AND ')}`
                actions.forEach((act: any) => {
                    results.push({
                        rule_id: rule.id, rule_name: rule.name, category: rule.category,
                        campaign_id: ad.campaign_id, ad_id: ad.ad_id,
                        entity_name: `${ad.ad_name} (${ad.campaign_name})`,
                        entity_type: 'ad', action: act.type, action_value: act.value, reason, metrics,
                    })
                })
            }
        })
    })

    // 3. Campaign-level rules (aggregate)
    const byCampaign: Record<string, any> = {}
    ads.forEach(ad => {
        if (!byCampaign[ad.campaign_id]) {
            byCampaign[ad.campaign_id] = { spend: 0, leads: 0, impressions: 0, frequency: 0, campaign_name: ad.campaign_name, ad_count: 0 }
        }
        const c = byCampaign[ad.campaign_id]
        c.spend += Number(ad.spend) || 0
        c.leads += Number(ad.leads_count) || 0
        c.impressions += Number(ad.impressions) || 0
        c.ad_count++
        c.frequency = Math.max(c.frequency, Number(ad.frequency) || 0)
    })
    Object.values(byCampaign).forEach((c: any) => {
        c.cpl = c.leads > 0 ? c.spend / c.leads : 0
        c.ctr = c.impressions > 0 ? 0 : 0
    })

    Object.entries(byCampaign).forEach(([campaignId, c]: [string, any]) => {
        campaignLevelRules.forEach(rule => {
            if (c.spend < (rule.min_spend_before_eval || 0)) return
            const conditions = Array.isArray(rule.conditions) ? rule.conditions : []
            if (evalConditions(conditions, { spend: c.spend, leads: c.leads, cpl: c.cpl, ctr: c.ctr, impressions: c.impressions, frequency: c.frequency }, targetCPL) && conditions.length > 0) {
                const actions = Array.isArray(rule.actions) ? rule.actions : []
                const reason = `${rule.name}: ${conditions.map((cd: any) => `${cd.metric} ${cd.operator} ${cd.value || cd.value_multiplier + 'x target'}`).join(' AND ')}`
                actions.forEach((act: any) => {
                    results.push({
                        rule_id: rule.id, rule_name: rule.name, category: rule.category,
                        campaign_id: campaignId, entity_name: `📊 ${c.campaign_name} (${c.ad_count} ads)`,
                        entity_type: 'campaign', action: act.type, action_value: act.value, reason,
                        metrics: { spend: c.spend, leads: c.leads, cpl: c.cpl, impressions: c.impressions, frequency: c.frequency },
                    })
                })
            }
        })
    })

    return results
}

function extractMetrics(ad: any): Record<string, number> {
    const spend = Number(ad.spend) || 0
    const leads = Number(ad.leads_count) || 0
    return {
        spend, leads,
        cpl: Number(ad.cpl) || (spend > 0 && leads > 0 ? spend / leads : 0),
        ctr: Number(ad.ctr) || 0,
        impressions: Number(ad.impressions) || 0,
        frequency: Number(ad.frequency) || 0,
    }
}

function evalConditions(conditions: any[], metrics: Record<string, number>, targetCPL: number): boolean {
    return conditions.every((cond: any) => {
        const metricVal = metrics[cond.metric] ?? 0
        let threshold = Number(cond.value) || 0
        if (cond.value_multiplier && cond.reference === 'target_cpl') threshold = targetCPL * Number(cond.value_multiplier)
        if (cond.value_reference === 'target_cpl') threshold = targetCPL
        switch (cond.operator) {
            case '>': return metricVal > threshold
            case '<': return metricVal < threshold
            case '>=': return metricVal >= threshold
            case '<=': return metricVal <= threshold
            case '=': return metricVal === threshold
            default: return true
        }
    })
}
