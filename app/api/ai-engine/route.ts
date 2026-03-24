import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

// AI Engine API — Generates recommendations and manages AI sessions
export async function GET(req: NextRequest) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: member } = await supabase
        .from('organization_members')
        .select('organization_id')
        .eq('user_id', user.id)
        .single()

    if (!member) return NextResponse.json({ error: 'No organization' }, { status: 404 })

    const orgId = member.organization_id

    const [recommendationsRes, briefsRes, snapshotsRes] = await Promise.all([
        supabase
            .from('ai_ad_recommendations')
            .select('*')
            .eq('organization_id', orgId)
            .order('created_at', { ascending: false })
            .limit(20),
        supabase
            .from('ai_creative_briefs')
            .select('*')
            .eq('organization_id', orgId)
            .order('created_at', { ascending: false })
            .limit(10),
        supabase
            .from('ai_performance_snapshots')
            .select('*')
            .eq('organization_id', orgId)
            .order('snapshot_date', { ascending: false })
            .limit(30),
    ])

    return NextResponse.json({
        recommendations: recommendationsRes.data || [],
        briefs: briefsRes.data || [],
        snapshots: snapshotsRes.data || [],
    })
}

// POST — Create recommendation, brief, or update status
export async function POST(req: NextRequest) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: member } = await supabase
        .from('organization_members')
        .select('organization_id')
        .eq('user_id', user.id)
        .single()

    if (!member) return NextResponse.json({ error: 'No organization' }, { status: 404 })

    const body = await req.json()
    const { action } = body

    if (action === 'generate_recommendations') {
        // Use client-provided campaign data (live, period-filtered) or fallback to cache
        let campaignData = body.campaigns
        if (!campaignData || campaignData.length === 0) {
            const { data: cached } = await supabase
                .from('campaigns_cache')
                .select('*')
                .eq('organization_id', member.organization_id)
            campaignData = cached || []
        }

        const recommendations = generateRecommendations(campaignData)

        // Clear old recommendations and save new ones
        await supabase.from('ai_ad_recommendations')
            .delete()
            .eq('organization_id', member.organization_id)

        if (recommendations.length > 0) {
            await supabase.from('ai_ad_recommendations').insert(
                recommendations.map(r => ({
                    ...r,
                    organization_id: member.organization_id,
                }))
            )
        }

        return NextResponse.json({ recommendations })
    }

    if (action === 'update_recommendation') {
        const { id, status } = body
        await supabase
            .from('ai_ad_recommendations')
            .update({ status })
            .eq('id', id)
            .eq('organization_id', member.organization_id)

        return NextResponse.json({ success: true })
    }

    if (action === 'create_brief') {
        const { brief_data } = body
        const generatedCopies = generateAdCopies(brief_data)

        const { data, error } = await supabase
            .from('ai_creative_briefs')
            .insert({
                organization_id: member.organization_id,
                brief_data,
                generated_copies: generatedCopies,
                status: 'ready',
            })
            .select()
            .single()

        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
        return NextResponse.json({ brief: data })
    }

    if (action === 'save_snapshot') {
        const { data: campaigns } = await supabase
            .from('campaigns_cache')
            .select('*')
            .eq('organization_id', member.organization_id)

        const metrics = calculateMetrics(campaigns || [])

        const { data, error } = await supabase
            .from('ai_performance_snapshots')
            .insert({
                organization_id: member.organization_id,
                metrics,
                ai_commentary: generateCommentary(metrics),
            })
            .select()
            .single()

        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
        return NextResponse.json({ snapshot: data })
    }

    // --- Rules Engine Actions ---

    if (action === 'get_rules') {
        const [rulesRes, targetsRes, historyRes] = await Promise.all([
            supabase.from('ad_automation_rules').select('*')
                .eq('organization_id', member.organization_id)
                .order('category').order('created_at'),
            supabase.from('ad_optimization_targets').select('*')
                .eq('organization_id', member.organization_id).single(),
            supabase.from('ad_rule_executions').select('*')
                .eq('organization_id', member.organization_id)
                .order('executed_at', { ascending: false }).limit(20),
        ])
        return NextResponse.json({
            rules: rulesRes.data || [],
            targets: targetsRes.data || null,
            history: historyRes.data || [],
        })
    }

    if (action === 'toggle_rule') {
        const { rule_id, is_enabled } = body
        if (!rule_id) return NextResponse.json({ error: 'rule_id required' }, { status: 400 })
        const { error } = await supabase.from('ad_automation_rules')
            .update({ is_enabled, updated_at: new Date().toISOString() })
            .eq('id', rule_id).eq('organization_id', member.organization_id)
        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
        return NextResponse.json({ success: true })
    }

    if (action === 'save_targets') {
        const { targets } = body
        const { error } = await supabase.from('ad_optimization_targets')
            .upsert({
                organization_id: member.organization_id,
                ...targets,
                updated_at: new Date().toISOString(),
            }, { onConflict: 'organization_id' })
        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
        return NextResponse.json({ success: true })
    }

    if (action === 'evaluate_rules') {
        // Evaluate rules at ad level (CBO) or campaign level (ABO fallback)
        const adData = body.ads || []
        const campaignData = body.campaigns || []
        const campaignBudgets = body.campaign_budgets || {}
        const { data: rules } = await supabase.from('ad_automation_rules').select('*')
            .eq('organization_id', member.organization_id).eq('is_enabled', true)
        const { data: targets } = await supabase.from('ad_optimization_targets').select('*')
            .eq('organization_id', member.organization_id).single()

        // If we have ad-level data, evaluate at ad level (CBO mode)
        // Otherwise fall back to campaign-level (ABO/legacy)
        const results = adData.length > 0
            ? evaluateRulesAdLevel(rules || [], adData, campaignBudgets, targets)
            : evaluateRules(rules || [], campaignData, targets)

        // Log to ad_rule_executions
        if (results.length > 0) {
            await supabase.from('ad_rule_executions').insert(
                results.map(r => ({
                    organization_id: member.organization_id,
                    rule_id: r.rule_id,
                    rule_name: r.rule_name,
                    campaign_id: r.campaign_id,
                    entity_name: r.entity_name,
                    action_taken: r.action,
                    metrics_snapshot: r.metrics,
                    result: 'dry_run',
                    notes: r.reason,
                }))
            )

            // Log to AI Memory (Diario Episodico)
            await supabase.from('ai_episodes').insert(
                results.map(r => ({
                    organization_id: member.organization_id,
                    episode_type: 'automation',
                    action_type: `rule_${r.action}`,
                    target_type: 'campaign',
                    target_id: r.campaign_id,
                    target_name: r.entity_name,
                    context: {
                        rule_name: r.rule_name,
                        category: r.category,
                        action_value: r.action_value,
                        phase: 'dry_run',
                    },
                    reasoning: r.reason,
                    metrics_before: r.metrics,
                    outcome: r.category === 'creative_winner' ? 'positive' : 
                             r.category === 'creative_kill' ? 'negative' :
                             r.category === 'fatigue' ? 'negative' : 'neutral',
                    outcome_score: r.category === 'creative_winner' ? 0.8 :
                                   r.category === 'creative_kill' ? -0.5 :
                                   r.category === 'budget_scale_up' ? 0.6 : -0.3,
                }))
            )

            // Send Telegram notification
            try {
                const { sendTelegramMessage } = await import('@/lib/telegram')
                const categoryEmoji: Record<string, string> = {
                    creative_kill: '🔴', creative_winner: '🟢',
                    budget_scale_up: '📈', budget_scale_down: '📉',
                    fatigue: '🔄', learning_protection: '⏸',
                }

                const grouped: Record<string, any[]> = results.reduce((acc: Record<string, any[]>, r: any) => {
                    if (!acc[r.category]) acc[r.category] = []
                    acc[r.category].push(r)
                    return acc
                }, {} as Record<string, any[]>)

                let tgMsg = '🤖 <b>AI Rules Engine — Valutazione</b>\n'
                tgMsg += '📊 ' + results.length + ' regole attivate (DRY RUN)\n\n'

                for (const [cat, items] of Object.entries(grouped)) {
                    const emoji = categoryEmoji[cat] || '•'
                    tgMsg += emoji + ' <b>' + cat.replace(/_/g, ' ').toUpperCase() + '</b>\n'
                    for (const r of items) {
                        tgMsg += '  → ' + r.entity_name + ': ' + r.action
                        if (r.action_value) tgMsg += ' (' + r.action_value + '%)'
                        tgMsg += '\n'
                    }
                    tgMsg += '\n'
                }

                tgMsg += `💡 Metriche: SPD €${campaignData.reduce((s: number, c: any) => s + (Number(c.spend) || 0), 0).toFixed(2)} | `
                tgMsg += `${campaignData.reduce((s: number, c: any) => s + (Number(c.leads_count) || 0), 0)} lead | `
                tgMsg += `Target CPL: €${targets?.target_cpl || 20}`

                await sendTelegramMessage(member.organization_id, tgMsg)
            } catch (err) {
                console.error('Telegram notification for rules failed:', err)
            }
        }

        return NextResponse.json({ results, count: results.length })
    }

    if (action === 'get_performance_trend') {
        const days = body.period === '30d' ? 30 : body.period === '14d' ? 14 : 7
        const since = new Date()
        since.setDate(since.getDate() - days)

        const { data: executions } = await supabase.from('ad_rule_executions')
            .select('rule_name, action_taken, metrics_snapshot, executed_at, result')
            .eq('organization_id', member.organization_id)
            .gte('executed_at', since.toISOString())
            .order('executed_at', { ascending: true })

        // Group by date
        const byDate: Record<string, { spend: number; leads: number; cpl: number; ctr: number; rules: number; kills: number; winners: number; scale_ups: number; count: number }> = {}

        ;(executions || []).forEach(e => {
            const dateStr = new Date(e.executed_at).toISOString().slice(0, 10)
            if (!byDate[dateStr]) byDate[dateStr] = { spend: 0, leads: 0, cpl: 0, ctr: 0, rules: 0, kills: 0, winners: 0, scale_ups: 0, count: 0 }
            const d = byDate[dateStr]
            d.rules++
            d.count++

            const m = e.metrics_snapshot || {}
            d.spend = Math.max(d.spend, Number(m.spend) || 0)
            d.leads = Math.max(d.leads, Number(m.leads) || 0)
            d.cpl = Number(m.cpl) || d.cpl
            d.ctr = Number(m.ctr) || d.ctr

            if (e.action_taken === 'pause_ad') d.kills++
            if (e.action_taken === 'flag_winner') d.winners++
            if (e.action_taken === 'increase_budget') d.scale_ups++
        })

        const trend = Object.entries(byDate).map(([date, d]) => ({
            date,
            spend: d.spend,
            leads: d.leads,
            cpl: d.cpl,
            ctr: d.ctr,
            rules_triggered: d.rules,
            kills: d.kills,
            winners: d.winners,
            scale_ups: d.scale_ups,
        })).sort((a, b) => a.date.localeCompare(b.date))

        return NextResponse.json({ trend })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}

// --- Rules Evaluation Engine ---

// --- CBO Ad-Level Rules Evaluation ---

function evaluateRulesAdLevel(rules: any[], ads: any[], campaignBudgets: Record<string, number>, targets: any) {
    const results: any[] = []
    const targetCPL = targets?.target_cpl || 20

    // Separate rules by level: kill/winner/fatigue act on individual ADS,
    // budget scale acts on CAMPAIGN level (aggregated from ads)
    const adLevelCategories = ['creative_kill', 'creative_winner', 'fatigue', 'learning_protection']
    const campaignLevelCategories = ['budget_scale_up', 'budget_scale_down']

    const adLevelRules = rules.filter(r => adLevelCategories.includes(r.category))
    const campaignLevelRules = rules.filter(r => campaignLevelCategories.includes(r.category))

    // 1. Evaluate ad-level rules (per individual ad/creative)
    ads.forEach(ad => {
        const spend = Number(ad.spend) || 0
        const leads = Number(ad.leads_count) || 0
        const cpl = Number(ad.cpl) || (spend > 0 && leads > 0 ? spend / leads : 0)
        const ctr = Number(ad.ctr) || 0
        const impressions = Number(ad.impressions) || 0
        const frequency = Number(ad.frequency) || 0
        const name = ad.ad_name || 'Ad'
        const campaignName = ad.campaign_name || ''

        adLevelRules.forEach(rule => {
            if (spend < (rule.min_spend_before_eval || 0)) return
            const conditions = Array.isArray(rule.conditions) ? rule.conditions : []
            const allMet = evaluateConditions(conditions, { spend, leads, cpl, ctr, impressions, frequency }, targetCPL)

            if (allMet && conditions.length > 0) {
                const actions = Array.isArray(rule.actions) ? rule.actions : []
                const reason = `${rule.name}: ${conditions.map((c: any) => `${c.metric} ${c.operator} ${c.value || c.value_multiplier + 'x target'}`).join(' AND ')}`
                actions.forEach((act: any) => {
                    results.push({
                        rule_id: rule.id,
                        rule_name: rule.name,
                        category: rule.category,
                        campaign_id: ad.campaign_id,
                        ad_id: ad.ad_id,
                        entity_name: `${name} (${campaignName})`,
                        entity_type: 'ad',
                        action: act.type,
                        action_value: act.value,
                        reason,
                        metrics: { spend, leads, cpl, ctr, impressions, frequency },
                    })
                })
            }
        })
    })

    // 2. Evaluate campaign-level rules (aggregate ads by campaign for budget decisions)
    const byCampaign: Record<string, { spend: number; leads: number; cpl: number; ctr: number; impressions: number; frequency: number; campaign_name: string; ad_count: number }> = {}
    ads.forEach(ad => {
        const cId = ad.campaign_id
        if (!byCampaign[cId]) {
            byCampaign[cId] = { spend: 0, leads: 0, cpl: 0, ctr: 0, impressions: 0, frequency: 0, campaign_name: ad.campaign_name || '', ad_count: 0 }
        }
        const c = byCampaign[cId]
        c.spend += Number(ad.spend) || 0
        c.leads += Number(ad.leads_count) || 0
        c.impressions += Number(ad.impressions) || 0
        c.ad_count++
        // Weighted averages
        c.frequency = Math.max(c.frequency, Number(ad.frequency) || 0)
    })
    // Calculate aggregated CPL and CTR
    Object.values(byCampaign).forEach(c => {
        c.cpl = c.leads > 0 ? c.spend / c.leads : 0
        c.ctr = c.impressions > 0 ? (c.spend > 0 ? (Number(c.impressions) > 0 ? 0 : 0) : 0) : 0
    })

    Object.entries(byCampaign).forEach(([campaignId, c]) => {
        const dailyBudget = campaignBudgets[campaignId] || 0

        campaignLevelRules.forEach(rule => {
            if (c.spend < (rule.min_spend_before_eval || 0)) return
            const conditions = Array.isArray(rule.conditions) ? rule.conditions : []
            const allMet = evaluateConditions(conditions, { spend: c.spend, leads: c.leads, cpl: c.cpl, ctr: c.ctr, impressions: c.impressions, frequency: c.frequency }, targetCPL)

            if (allMet && conditions.length > 0) {
                const actions = Array.isArray(rule.actions) ? rule.actions : []
                const reason = `${rule.name}: ${conditions.map((cd: any) => `${cd.metric} ${cd.operator} ${cd.value || cd.value_multiplier + 'x target'}`).join(' AND ')}`
                actions.forEach((act: any) => {
                    results.push({
                        rule_id: rule.id,
                        rule_name: rule.name,
                        category: rule.category,
                        campaign_id: campaignId,
                        entity_name: `📊 ${c.campaign_name} (${c.ad_count} ads, budget €${dailyBudget.toFixed(0)}/day)`,
                        entity_type: 'campaign',
                        action: act.type,
                        action_value: act.value,
                        reason,
                        metrics: { spend: c.spend, leads: c.leads, cpl: c.cpl, impressions: c.impressions, frequency: c.frequency, daily_budget: dailyBudget },
                    })
                })
            }
        })
    })

    return results
}

// Shared condition evaluator
function evaluateConditions(conditions: any[], metrics: Record<string, number>, targetCPL: number): boolean {
    return conditions.every((cond: any) => {
        let metricVal = metrics[cond.metric] ?? 0
        let threshold = Number(cond.value) || 0

        if (cond.value_multiplier && cond.reference === 'target_cpl') {
            threshold = targetCPL * Number(cond.value_multiplier)
        }
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

// --- ABO/Legacy Campaign-Level Rules Evaluation ---

function evaluateRules(rules: any[], campaigns: any[], targets: any) {
    const results: any[] = []
    const targetCPL = targets?.target_cpl || 20
    const targetCAC = targets?.target_cac || 500

    campaigns.forEach(c => {
        const spend = Number(c.spend) || 0
        const leads = Number(c.leads_count) || 0
        const cpl = Number(c.cpl) || 0
        const ctr = Number(c.ctr) || 0
        const impressions = Number(c.impressions) || 0
        const frequency = Number(c.frequency) || 0
        const name = c.campaign_name || 'Campagna'

        rules.forEach(rule => {
            // Check min spend
            if (spend < (rule.min_spend_before_eval || 0)) return

            let triggered = false
            let reason = ''

            const conditions = Array.isArray(rule.conditions) ? rule.conditions : []

            // Evaluate each condition
            const allMet = conditions.every((cond: any) => {
                let metricVal = 0
                let threshold = Number(cond.value) || 0

                // Resolve metric
                switch (cond.metric) {
                    case 'spend': metricVal = spend; break
                    case 'leads': metricVal = leads; break
                    case 'cpl': metricVal = cpl; break
                    case 'ctr': metricVal = ctr; break
                    case 'impressions': metricVal = impressions; break
                    case 'frequency': metricVal = frequency; break
                    default: return true // skip unknown
                }

                // Resolve threshold reference
                if (cond.value_multiplier && cond.reference === 'target_cpl') {
                    threshold = targetCPL * Number(cond.value_multiplier)
                }
                if (cond.value_reference === 'target_cpl') {
                    threshold = targetCPL
                }

                // Evaluate operator
                switch (cond.operator) {
                    case '>': return metricVal > threshold
                    case '<': return metricVal < threshold
                    case '>=': return metricVal >= threshold
                    case '<=': return metricVal <= threshold
                    case '=': return metricVal === threshold
                    default: return true
                }
            })

            if (allMet && conditions.length > 0) {
                triggered = true
                const actions = Array.isArray(rule.actions) ? rule.actions : []
                reason = `${rule.name}: ${conditions.map((c: any) => `${c.metric} ${c.operator} ${c.value || c.value_multiplier + 'x target'}`).join(' AND ')}`

                actions.forEach((act: any) => {
                    results.push({
                        rule_id: rule.id,
                        rule_name: rule.name,
                        category: rule.category,
                        campaign_id: c.id || c.external_campaign_id,
                        entity_name: name,
                        action: act.type,
                        action_value: act.value,
                        reason,
                        metrics: { spend, leads, cpl, ctr, impressions, frequency },
                    })
                })
            }
        })
    })

    return results
}

// --- AI Logic (local, no external API needed) ---

function generateRecommendations(campaigns: any[]) {
    const recs: any[] = []
    if (campaigns.length === 0) {
        recs.push({
            recommendation_type: 'general',
            priority: 'high',
            title: 'Nessuna campagna con dati nel periodo',
            description: 'Non ci sono campagne con dati nel periodo selezionato. Prova a selezionare un periodo più ampio o verifica che le campagne siano attive.',
            action_data: {},
            status: 'pending',
            impact_estimate: {},
        })
        return recs
    }

    const activeCampaigns = campaigns.filter(c => c.status === 'ACTIVE')
    const totalSpend = campaigns.reduce((s, c) => s + (Number(c.spend) || 0), 0)
    const totalLeads = campaigns.reduce((s, c) => s + (Number(c.leads_count) || 0), 0)
    const totalClicks = campaigns.reduce((s, c) => s + (Number(c.clicks) || 0), 0)
    const totalImpressions = campaigns.reduce((s, c) => s + (Number(c.impressions) || 0), 0)
    const avgCPL = totalLeads > 0 ? totalSpend / totalLeads : 0
    const avgCTR = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0

    // === ALWAYS: Overall health summary ===
    const healthParts: string[] = []
    if (totalSpend > 0) healthParts.push(`Spesa: €${totalSpend.toFixed(2)}`)
    if (totalLeads > 0) healthParts.push(`${totalLeads} lead (CPL: €${avgCPL.toFixed(2)})`)
    if (avgCTR > 0) healthParts.push(`CTR: ${avgCTR.toFixed(2)}%`)
    healthParts.push(`${activeCampaigns.length} campagne attive su ${campaigns.length}`)

    recs.push({
        recommendation_type: 'general',
        priority: 'low',
        title: '📊 Riepilogo periodo',
        description: healthParts.join(' • '),
        action_data: {},
        status: 'pending',
        impact_estimate: {},
    })

    // === Per-campaign analysis ===
    campaigns.forEach(c => {
        const cpl = Number(c.cpl) || 0
        const ctr = Number(c.ctr) || 0
        const roas = Number(c.roas) || 0
        const spend = Number(c.spend) || 0
        const leads = Number(c.leads_count) || 0
        const clicks = Number(c.clicks) || 0
        const impressions = Number(c.impressions) || 0
        const name = c.campaign_name || 'Campagna'
        const isActive = c.status === 'ACTIVE'

        // Spending but no leads
        if (spend > 5 && leads === 0) {
            recs.push({
                recommendation_type: 'budget',
                priority: 'critical',
                title: `"${name}" — Spesa senza lead`,
                description: `Hai speso €${spend.toFixed(2)} senza ottenere nessun lead. Verifica il targeting, la landing page e il tracciamento delle conversioni.`,
                action_data: { campaign_id: c.id, suggested_action: 'check_tracking' },
                status: 'pending',
                impact_estimate: { wasted_budget: `€${spend.toFixed(2)}` },
            })
        }

        // High CPL (absolute benchmark: > €20)
        if (cpl > 20) {
            recs.push({
                recommendation_type: 'budget',
                priority: 'high',
                title: `"${name}" — CPL alto (€${cpl.toFixed(2)})`,
                description: `Il costo per lead è elevato. Per campagne Lead Gen, un CPL sotto €15 è ideale. Prova a ottimizzare il targeting o testare nuove creativi.`,
                action_data: { campaign_id: c.id, suggested_action: 'optimize_targeting' },
                status: 'pending',
                impact_estimate: { target_cpl: '< €15' },
            })
        } else if (cpl > 10 && cpl <= 20) {
            recs.push({
                recommendation_type: 'budget',
                priority: 'medium',
                title: `"${name}" — CPL nella media (€${cpl.toFixed(2)})`,
                description: `Il CPL è accettabile ma può migliorare. Testa nuove audience o creative per ridurlo sotto €10.`,
                action_data: { campaign_id: c.id },
                status: 'pending',
                impact_estimate: { target_cpl: '< €10' },
            })
        } else if (cpl > 0 && cpl <= 10) {
            recs.push({
                recommendation_type: 'budget',
                priority: 'low',
                title: `"${name}" — CPL ottimo (€${cpl.toFixed(2)}) ✅`,
                description: `Ottimo lavoro! Il CPL è sotto €10. Considera di aumentare il budget del 20-30% per scalare i risultati mantenendo l'efficienza.`,
                action_data: { campaign_id: c.id, suggested_action: 'scale_up' },
                status: 'pending',
                impact_estimate: { potential_increase: '20-30% più lead' },
            })
        }

        // CTR analysis
        if (ctr > 0 && ctr < 1.0 && isActive) {
            recs.push({
                recommendation_type: 'creative',
                priority: 'high',
                title: `"${name}" — CTR basso (${ctr.toFixed(2)}%)`,
                description: `Il CTR è sotto l'1%. Le creativi non catturano l'attenzione. Prova hook diversi, immagini più impattanti o video brevi.`,
                action_data: { campaign_id: c.id, suggested_action: 'refresh_creative' },
                status: 'pending',
                impact_estimate: { target_ctr: '> 2%' },
            })
        } else if (ctr >= 2.0 && ctr < 4.0 && isActive) {
            recs.push({
                recommendation_type: 'creative',
                priority: 'low',
                title: `"${name}" — CTR buono (${ctr.toFixed(2)}%) ✅`,
                description: `Il CTR è sopra il 2%, buon segnale. Le creativi stanno funzionando. Monitora nel tempo per evitare ad fatigue.`,
                action_data: { campaign_id: c.id },
                status: 'pending',
                impact_estimate: {},
            })
        } else if (ctr >= 4.0 && isActive) {
            recs.push({
                recommendation_type: 'creative',
                priority: 'low',
                title: `"${name}" — CTR eccellente (${ctr.toFixed(2)}%) 🔥`,
                description: `CTR sopra il 4%! Le creativi stanno performando alla grande. Scala il budget per massimizzare i risultati.`,
                action_data: { campaign_id: c.id, suggested_action: 'scale_up' },
                status: 'pending',
                impact_estimate: { potential_scale: '30-50% più budget' },
            })
        }

        // ROAS analysis
        if (roas > 0 && roas < 1) {
            recs.push({
                recommendation_type: 'budget',
                priority: 'high',
                title: `"${name}" — ROAS negativo (${roas.toFixed(1)}x)`,
                description: `Stai perdendo soldi: per ogni €1 speso, ne torni solo €${roas.toFixed(2)}. Rivedi audience, offerta e landing page.`,
                action_data: { campaign_id: c.id, suggested_action: 'review_funnel' },
                status: 'pending',
                impact_estimate: { break_even: 'ROAS > 1.0x' },
            })
        } else if (roas >= 3) {
            recs.push({
                recommendation_type: 'budget',
                priority: 'medium',
                title: `"${name}" — ROAS eccellente (${roas.toFixed(1)}x) 🚀`,
                description: `Per ogni €1 speso ne guadagni €${roas.toFixed(1)}. Aumenta il budget per massimizzare i profitti.`,
                action_data: { campaign_id: c.id, suggested_action: 'increase_budget' },
                status: 'pending',
                impact_estimate: { potential_revenue_increase: '20-30%' },
            })
        }

        // High spend, low clicks (bad targeting/creative)
        if (spend > 10 && impressions > 500 && clicks < 5) {
            recs.push({
                recommendation_type: 'audience',
                priority: 'high',
                title: `"${name}" — Impressioni alte, click bassissimi`,
                description: `${impressions} impressioni ma solo ${clicks} click. Il pubblico vede l'ad ma non interagisce. Rivedi targeting e creative.`,
                action_data: { campaign_id: c.id, suggested_action: 'review_audience' },
                status: 'pending',
                impact_estimate: {},
            })
        }
    })

    // No active campaigns
    if (activeCampaigns.length === 0 && campaigns.length > 0) {
        recs.push({
            recommendation_type: 'general',
            priority: 'high',
            title: 'Nessuna campagna attiva',
            description: 'Tutte le campagne sono in pausa nel periodo selezionato. Riattiva almeno una campagna per generare lead.',
            action_data: { suggested_action: 'reactivate' },
            status: 'pending',
            impact_estimate: {},
        })
    }

    // Budget distribution (3+ campaigns)
    if (campaigns.length >= 3) {
        const sorted = [...campaigns].sort((a, b) => (Number(b.roas) || 0) - (Number(a.roas) || 0))
        const best = sorted[0]
        const worst = sorted[sorted.length - 1]
        if (best && worst && best.id !== worst.id && (Number(best.roas) || 0) > (Number(worst.roas) || 0) * 2) {
            recs.push({
                recommendation_type: 'budget',
                priority: 'medium',
                title: 'Ribilancia il budget tra campagne',
                description: `Sposta budget da "${worst.campaign_name}" (ROAS: ${(Number(worst.roas) || 0).toFixed(1)}x) a "${best.campaign_name}" (ROAS: ${(Number(best.roas) || 0).toFixed(1)}x).`,
                action_data: { from_campaign: worst.id, to_campaign: best.id },
                status: 'pending',
                impact_estimate: { overall_improvement: '10-20%' },
            })
        }
    }

    return recs
}

function generateAdCopies(brief: any) {
    const { product, audience, tone, platform, format } = brief
    const toneMap: Record<string, { adj: string; cta: string; style: string }> = {
        professionale: { adj: 'efficace e comprovato', cta: 'Scopri di più', style: 'Chiaro, autorevole, basato su dati' },
        amichevole: { adj: 'perfetto per te', cta: 'Provalo ora!', style: 'Caldo, diretto, conversazionale' },
        urgente: { adj: 'da non perdere', cta: 'Agisci ora ⚡', style: 'Senso di urgenza, FOMO, scarsità' },
        esclusivo: { adj: 'riservato a pochi', cta: 'Richiedi l\'accesso', style: 'Lusso, esclusività, premium' },
        provocatorio: { adj: 'che cambierà tutto', cta: 'Scopri perché', style: 'Sfidante, disruptive, bold' },
    }

    const t = toneMap[tone?.toLowerCase()] || toneMap.amichevole
    const productName = product || 'il tuo prodotto'
    const audienceName = audience || 'il tuo target'

    return [
        {
            variant: 'A',
            headline: `${productName} — ${t.adj} per ${audienceName}`,
            body: `Stai cercando la soluzione giusta? ${productName} è stato progettato pensando a persone come te. Risultati concreti, senza complicazioni.`,
            cta: t.cta,
            link_description: `Scopri ${productName} — La scelta intelligente per chi vuole di più.`,
            style_note: t.style,
        },
        {
            variant: 'B',
            headline: `Perché ${audienceName} stanno scegliendo ${productName}?`,
            body: `Oltre 1.000+ persone hanno già scoperto come ${productName} può fare la differenza. Non restare indietro.`,
            cta: t.cta,
            link_description: `Unisciti a chi ha già scelto ${productName}.`,
            style_note: t.style,
        },
        {
            variant: 'C',
            headline: `${productName}: La rivoluzione per ${audienceName}`,
            body: `Dimentica le soluzioni mediocri. ${productName} è il punto di svolta che aspettavi. Testato, approvato, amato.`,
            cta: t.cta,
            link_description: `Il futuro di ${audienceName} inizia qui.`,
            style_note: t.style,
        },
    ]
}

function calculateMetrics(campaigns: any[]) {
    const totalSpend = campaigns.reduce((s, c) => s + (Number(c.spend) || 0), 0)
    const totalLeads = campaigns.reduce((s, c) => s + (Number(c.leads_count) || 0), 0)
    const totalClicks = campaigns.reduce((s, c) => s + (Number(c.clicks) || 0), 0)
    const totalImpressions = campaigns.reduce((s, c) => s + (Number(c.impressions) || 0), 0)
    const avgCPL = totalLeads > 0 ? totalSpend / totalLeads : 0
    const avgCTR = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0
    const avgROAS = campaigns.length > 0
        ? campaigns.reduce((s, c) => s + (Number(c.roas) || 0), 0) / campaigns.length : 0

    return {
        total_spend: totalSpend,
        total_leads: totalLeads,
        total_clicks: totalClicks,
        total_impressions: totalImpressions,
        avg_cpl: avgCPL,
        avg_ctr: avgCTR,
        avg_roas: avgROAS,
        active_campaigns: campaigns.filter(c => c.status === 'ACTIVE').length,
        total_campaigns: campaigns.length,
    }
}

function generateCommentary(metrics: any) {
    const parts: string[] = []

    if (metrics.total_campaigns === 0) {
        return 'Nessuna campagna attiva. Collega Meta Ads e inizia ad analizzare i tuoi dati.'
    }

    if (metrics.avg_cpl > 0) {
        if (metrics.avg_cpl < 5) parts.push(`✅ CPL eccellente a €${metrics.avg_cpl.toFixed(2)}`)
        else if (metrics.avg_cpl < 15) parts.push(`⚡ CPL nella media a €${metrics.avg_cpl.toFixed(2)}`)
        else parts.push(`⚠️ CPL alto a €${metrics.avg_cpl.toFixed(2)} — rivedi il targeting`)
    }

    if (metrics.avg_ctr > 0) {
        if (metrics.avg_ctr > 2) parts.push(`✅ CTR forte al ${metrics.avg_ctr.toFixed(2)}%`)
        else if (metrics.avg_ctr > 1) parts.push(`⚡ CTR adeguato al ${metrics.avg_ctr.toFixed(2)}%`)
        else parts.push(`⚠️ CTR basso al ${metrics.avg_ctr.toFixed(2)}% — cambia le creativi`)
    }

    if (metrics.avg_roas > 0) {
        if (metrics.avg_roas > 3) parts.push(`🚀 ROAS eccezionale ${metrics.avg_roas.toFixed(1)}x — scala il budget!`)
        else if (metrics.avg_roas > 1.5) parts.push(`✅ ROAS positivo ${metrics.avg_roas.toFixed(1)}x`)
        else parts.push(`⚠️ ROAS basso ${metrics.avg_roas.toFixed(1)}x — ottimizza le conversioni`)
    }

    return parts.join(' • ') || 'Dati insufficienti per un commento dettagliato.'
}
