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

            // Fetch ad-level insights (last 7 days)
            const until = new Date().toISOString().slice(0, 10)
            const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
            const timeRange = JSON.stringify({ since, until })

            const insightsUrl = `https://graph.facebook.com/${META_API_VERSION}/${adAccount}/insights?` +
                `fields=ad_id,ad_name,campaign_id,campaign_name,spend,impressions,clicks,ctr,frequency,actions,cost_per_action_type` +
                `&level=ad&time_range=${encodeURIComponent(timeRange)}&limit=500&access_token=${access_token}`

            const insightsRes = await fetch(insightsUrl)
            if (!insightsRes.ok) continue

            const insightsData = await insightsRes.json()

            // Get ad statuses
            const adsUrl = `https://graph.facebook.com/${META_API_VERSION}/${adAccount}/ads?` +
                `fields=id,status,effective_status,campaign_id&limit=500&access_token=${access_token}`
            const adsRes = await fetch(adsUrl)
            const adsData = adsRes.ok ? await adsRes.json() : { data: [] }

            const adStatusMap: Record<string, string> = {}
            for (const ad of (adsData.data || [])) {
                adStatusMap[ad.id] = ad.effective_status
            }

            // Build ad data
            const ads = (insightsData.data || []).map((insight: any) => {
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

            if (ads.length === 0) continue

            // Get campaign budgets
            const campaignIds = [...new Set(ads.map((a: any) => a.campaign_id))]
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

            // Evaluate rules (reuse logic from ai-engine API)
            const results = evaluateRulesAdLevel(rules, ads, campaignBudgets, targets)

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
            ads.forEach((ad: any) => {
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
                await sendCronTelegramReport(orgId, executedResults, isLive, killedAds, ads, skippedSafety)
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
        const activeCount = allAds.filter(a => a.status === 'ACTIVE').length
        const killedCount = killedAds.length
        msg += `📊 Ads attive: ${activeCount - killedCount}/${activeCount}`
        if (killedCount > 0) msg += ` (${killedCount} pausate)`
        msg += '\n'

        // 🎨 CREATIVE REFRESH RECOMMENDATIONS (Andromeda best practices)
        if (killedCount > 0) {
            msg += '\n🎨 <b>NUOVE CREATIVE NECESSARIE</b>\n'
            msg += '─────────────────\n'

            // Extract adset info from killed ads
            const killedByAdset: Record<string, { adset: string, campaign: string, ads: string[] }> = {}
            killedAds.forEach(k => {
                // Extract adset name from entity_name pattern: "AdName (CampaignName)"
                const adName = k.entity_name || ''
                const campaignName = k.metrics?.campaign_name || adName.split('(').pop()?.replace(')', '') || ''
                
                // Detect adset angle from ad name patterns
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

            msg += `\n⚠️ <b>Azione richiesta:</b> crea nuove creative per gli adset sopra e caricale su Meta. L\'AI le valuterà automaticamente.\n`
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
