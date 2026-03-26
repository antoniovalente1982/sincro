import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
)

interface TelegramCredentials {
    bot_token: string
    chat_id: string
}

/**
 * Get Telegram credentials from the connections table for an organization
 */
export async function getTelegramCredentials(orgId: string): Promise<TelegramCredentials | null> {
    const { data } = await supabaseAdmin
        .from('connections')
        .select('credentials')
        .eq('organization_id', orgId)
        .eq('provider', 'telegram')
        .eq('status', 'active')
        .single()

    if (!data?.credentials?.bot_token || !data?.credentials?.chat_id) return null
    return {
        bot_token: data.credentials.bot_token,
        chat_id: data.credentials.chat_id,
    }
}

/**
 * Find the organization that owns a specific Telegram chat_id
 */
export async function findOrgByChatId(chatId: string): Promise<string | null> {
    const { data } = await supabaseAdmin
        .from('connections')
        .select('organization_id, credentials')
        .eq('provider', 'telegram')
        .eq('status', 'active')

    if (!data) return null

    const match = data.find((c: any) => String(c.credentials?.chat_id) === String(chatId))
    return match?.organization_id || null
}

/**
 * Send a message via Telegram Bot API
 */
export async function sendTelegramMessage(
    orgId: string,
    text: string,
    parseMode: 'HTML' | 'Markdown' = 'HTML'
): Promise<boolean> {
    const creds = await getTelegramCredentials(orgId)
    if (!creds) return false

    return sendTelegramDirect(creds.bot_token, creds.chat_id, text, parseMode)
}

/**
 * Send a message directly with bot_token and chat_id (no DB lookup)
 */
export async function sendTelegramDirect(
    botToken: string,
    chatId: string,
    text: string,
    parseMode: 'HTML' | 'Markdown' = 'HTML'
): Promise<boolean> {
    try {
        const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: chatId,
                text,
                parse_mode: parseMode,
            }),
        })
        const result = await res.json()
        if (!result.ok) {
            console.error('Telegram API error:', result.description)
        }
        return result.ok === true
    } catch (err) {
        console.error('Telegram send error:', err)
        return false
    }
}

/**
 * Get organization data context for AI analysis
 */
export async function getOrgDataContext(orgId: string) {
    const now = new Date()
    const todayStr = now.toISOString().split('T')[0]
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000)
    const yesterdayStr = yesterday.toISOString().split('T')[0]
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

    const [leadsRes, campaignsRes, stagesRes, submissionsRes, pipelinesRes, operationsRes, paymentsRes] = await Promise.all([
        supabaseAdmin
            .from('leads')
            .select('id, name, email, phone, stage_id, value, product, utm_source, utm_campaign, created_at, source_channel, dna_priority')
            .eq('organization_id', orgId)
            .order('created_at', { ascending: false })
            .limit(50),
        supabaseAdmin
            .from('campaigns_cache')
            .select('campaign_name, status, objective, spend, impressions, clicks, leads_count, cpl, cpc, ctr, conversions, roas, daily_budget, date_range_start, date_range_end')
            .eq('organization_id', orgId),
        supabaseAdmin
            .from('pipeline_stages')
            .select('id, name, slug, sort_order, is_won, is_lost, pipeline_id')
            .eq('organization_id', orgId)
            .order('sort_order', { ascending: true }),
        supabaseAdmin
            .from('funnel_submissions')
            .select('id, created_at')
            .eq('organization_id', orgId)
            .order('created_at', { ascending: false })
            .limit(100),
        supabaseAdmin
            .from('pipelines')
            .select('id, name, source_type')
            .eq('organization_id', orgId)
            .order('sort_order'),
        supabaseAdmin
            .from('ai_episodes')
            .select('action_type, target_name, reasoning, outcome, created_at')
            .eq('organization_id', orgId)
            .order('created_at', { ascending: false })
            .limit(10),
        // Try to get revenue/payment data
        supabaseAdmin
            .from('revenue_attribution')
            .select('amount, currency, attribution_date, source')
            .eq('organization_id', orgId)
            .order('attribution_date', { ascending: false })
            .limit(30),
    ])

    const leads = leadsRes.data || []
    const campaigns = campaignsRes.data || []
    const stages = stagesRes.data || []
    const submissions = submissionsRes.data || []
    const pipelines = pipelinesRes.data || []
    const operations = operationsRes.data || []
    const payments = paymentsRes.data || []

    // Build stage map
    const stageMap = new Map(stages.map(s => [s.id, s]))

    // TIME-BASED stats
    const leadsToday = leads.filter(l => l.created_at?.startsWith(todayStr)).length
    const leadsYesterday = leads.filter(l => l.created_at?.startsWith(yesterdayStr)).length
    const leadsThisWeek = leads.filter(l => new Date(l.created_at) >= weekAgo).length

    // REVENUE stats
    const wonStages = stages.filter(s => s.is_won).map(s => s.id)
    const wonLeads = leads.filter(l => l.stage_id && wonStages.includes(l.stage_id))
    const totalRevenue = wonLeads.reduce((s, l) => s + (l.value || 0), 0)
    const revenueToday = wonLeads.filter(l => l.created_at?.startsWith(todayStr)).reduce((s, l) => s + (l.value || 0), 0)
    const revenueYesterday = wonLeads.filter(l => l.created_at?.startsWith(yesterdayStr)).reduce((s, l) => s + (l.value || 0), 0)
    const pipelineValue = leads.filter(l => l.value && l.stage_id && !wonStages.includes(l.stage_id)).reduce((s, l) => s + (l.value || 0), 0)

    // Attribution revenue
    const attrRevenueToday = payments.filter(p => p.attribution_date?.startsWith(todayStr)).reduce((s, p) => s + (Number(p.amount) || 0), 0)
    const attrRevenueYesterday = payments.filter(p => p.attribution_date?.startsWith(yesterdayStr)).reduce((s, p) => s + (Number(p.amount) || 0), 0)
    const attrRevenueTotal = payments.reduce((s, p) => s + (Number(p.amount) || 0), 0)

    // Campaign stats
    const totalSpend = campaigns.reduce((s, c) => s + (Number(c.spend) || 0), 0)
    const totalCampaignLeads = campaigns.reduce((s, c) => s + (Number(c.leads_count) || 0), 0)
    const avgCPL = totalCampaignLeads > 0 ? totalSpend / totalCampaignLeads : 0
    const activeCampaigns = campaigns.filter(c => c.status === 'ACTIVE')

    // Pipeline-grouped stage distribution
    const pipelineMap = new Map(pipelines.map(p => [p.id, p.name]))
    const stageDist = stages.map(s => ({
        name: s.name,
        pipeline: pipelineMap.get(s.pipeline_id || '') || 'Sconosciuta',
        count: leads.filter(l => l.stage_id === s.id).length,
        is_won: s.is_won || false,
        is_lost: s.is_lost || false,
    })).filter(s => s.count > 0)

    return {
        current_datetime: {
            now: now.toISOString(),
            date: todayStr,
            time: now.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }),
            day_of_week: now.toLocaleDateString('it-IT', { weekday: 'long' }),
            yesterday: yesterdayStr,
            note: 'ATTENZIONE: usa queste date per rispondere a domande temporali. "Oggi" = ' + todayStr + ', "Ieri" = ' + yesterdayStr,
        },
        summary: {
            total_leads: leads.length,
            leads_today: leadsToday,
            leads_yesterday: leadsYesterday,
            leads_this_week: leadsThisWeek,
            total_submissions: submissions.length,
            total_campaigns: campaigns.length,
            active_campaigns: activeCampaigns.length,
            total_spend: totalSpend.toFixed(2),
            avg_cpl: avgCPL.toFixed(2),
        },
        revenue: {
            total_revenue_from_won_leads: totalRevenue,
            revenue_today: revenueToday,
            revenue_yesterday: revenueYesterday,
            pipeline_value: pipelineValue,
            attribution_revenue_total: attrRevenueTotal,
            attribution_revenue_today: attrRevenueToday,
            attribution_revenue_yesterday: attrRevenueYesterday,
            note: 'Il fatturato si calcola dai lead in stage "Vendita" (is_won=true). Se il valore e 0, non ci sono vendite registrate.',
        },
        stage_distribution: stageDist,
        campaigns: campaigns.map(c => ({
            name: c.campaign_name,
            status: c.status,
            spend: c.spend,
            leads: c.leads_count,
            cpl: c.cpl,
            ctr: c.ctr,
            roas: c.roas,
        })),
        recent_leads: leads.slice(0, 10).map(l => {
            const stage = stageMap.get(l.stage_id)
            return {
                name: l.name,
                stage: stage?.name || 'Non assegnato',
                source: l.utm_source || l.source_channel || 'Diretto',
                value: l.value,
                created: l.created_at,
            }
        }),
        recent_operations: operations.map(o => ({
            type: o.action_type,
            action: o.target_name,
            reasoning: o.reasoning,
            outcome: o.outcome,
            date: o.created_at,
        })),
    }
}

/**
 * Lightweight version for Telegram webhook
 * Now fetches LIVE data from Meta API for accuracy
 */
export async function getOrgDataContextLite(orgId: string) {
    const now = new Date()
    const todayISO = now.toLocaleDateString('en-CA', { timeZone: 'Europe/Rome' }) // YYYY-MM-DD in Italian TZ
    const italianNow = now.toLocaleString('it-IT', {
        timeZone: 'Europe/Rome',
        weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
    })

    // Check DST for accurate date boundaries
    const marchLastSunday = new Date(now.getFullYear(), 2, 31)
    marchLastSunday.setDate(marchLastSunday.getDate() - marchLastSunday.getDay())
    const octLastSunday = new Date(now.getFullYear(), 9, 31)
    octLastSunday.setDate(octLastSunday.getDate() - octLastSunday.getDay())
    const isDST = now >= marchLastSunday && now < octLastSunday
    const todayStart = new Date(`${todayISO}T00:00:00${isDST ? '+02:00' : '+01:00'}`)

    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    const sevenDaysAgoStr = sevenDaysAgo.toLocaleDateString('en-CA', { timeZone: 'Europe/Rome' })

    // Parallel: leads, stages, AI Engine config, Meta Ads connection
    const [leadsRes, stagesRes, aiConfigRes, metaConnRes] = await Promise.all([
        supabaseAdmin
            .from('leads')
            .select('id, name, email, phone, stage_id, value, utm_source, utm_campaign, created_at, meta_data, notes')
            .eq('organization_id', orgId)
            .order('created_at', { ascending: false })
            .limit(30),
        supabaseAdmin
            .from('pipeline_stages')
            .select('id, name, is_won, is_lost, sort_order')
            .eq('organization_id', orgId)
            .order('sort_order', { ascending: true }),
        supabaseAdmin
            .from('ai_agent_config')
            .select('autopilot_active, execution_mode, auto_pause_enabled, auto_scale_enabled, auto_creative_refresh, analysis_interval_minutes, risk_tolerance, objectives, budget_daily')
            .eq('organization_id', orgId)
            .single(),
        supabaseAdmin
            .from('connections')
            .select('credentials')
            .eq('organization_id', orgId)
            .eq('provider', 'meta_ads')
            .eq('status', 'active')
            .single(),
    ])

    const leads = leadsRes.data || []
    const stages = stagesRes.data || []
    const stageMap = new Map(stages.map(s => [s.id, s]))
    const aiConfig = aiConfigRes.data

    // Format Italian time helper
    const fmtIT = (iso: string) => {
        try {
            return new Date(iso).toLocaleString('it-IT', {
                timeZone: 'Europe/Rome',
                day: '2-digit', month: '2-digit', year: 'numeric',
                hour: '2-digit', minute: '2-digit'
            })
        } catch { return iso }
    }

    // --- LEADS ---
    const leadsToday = leads.filter(l => new Date(l.created_at) >= todayStart)
    const leadsThisWeek = leads.filter(l => new Date(l.created_at) >= sevenDaysAgo)

    const stageDist = stages.map(s => ({
        name: s.name,
        count: leads.filter(l => l.stage_id === s.id).length,
    })).filter(s => s.count > 0)

    // --- META ADS (LIVE) ---
    let campaignsText = 'Nessun collegamento Meta Ads attivo.'
    let spesaOggiText = 'N/A'
    let spesaSetteGiorniText = 'N/A'
    let activeCampaignCount = 0
    let campaignsData: any[] = []

    if (metaConnRes.data?.credentials?.access_token) {
        const token = metaConnRes.data.credentials.access_token
        const adAccount = `act_${metaConnRes.data.credentials.ad_account_id || '511099830249139'}`

        try {
            // Fetch campaigns status + today's insights + 7-day insights in parallel
            const [campaignsApiRes, todayInsightsRes, weekInsightsRes] = await Promise.all([
                fetch(`https://graph.facebook.com/v21.0/${adAccount}/campaigns?fields=name,status,daily_budget&limit=30&access_token=${token}`),
                fetch(`https://graph.facebook.com/v21.0/${adAccount}/insights?fields=campaign_name,spend,impressions,clicks,actions,cost_per_action_type&level=campaign&time_range=${encodeURIComponent(JSON.stringify({ since: todayISO, until: todayISO }))}&limit=30&access_token=${token}`),
                fetch(`https://graph.facebook.com/v21.0/${adAccount}/insights?fields=campaign_name,spend,impressions,clicks,ctr,actions,cost_per_action_type&level=campaign&time_range=${encodeURIComponent(JSON.stringify({ since: sevenDaysAgoStr, until: todayISO }))}&limit=30&access_token=${token}`),
            ])

            // Parse campaigns
            const campaignsJson = campaignsApiRes.ok ? await campaignsApiRes.json() : { data: [] }
            const campaignsList = campaignsJson.data || []
            const campaignStatusMap: Record<string, { status: string; budget: string }> = {}
            campaignsList.forEach((c: any) => {
                campaignStatusMap[c.name] = {
                    status: c.status,
                    budget: c.daily_budget ? `€${(parseInt(c.daily_budget) / 100).toFixed(0)}/giorno` : 'N/A',
                }
            })

            // Parse today's insights
            const todayJson = todayInsightsRes.ok ? await todayInsightsRes.json() : { data: [] }
            const todayData = todayJson.data || []
            const todaySpendTotal = todayData.reduce((s: number, c: any) => s + (parseFloat(c.spend) || 0), 0)
            const todayLeadsTotal = todayData.reduce((s: number, c: any) => {
                const leads = c.actions?.find((a: any) => a.action_type === 'lead')?.value || 0
                return s + parseInt(leads)
            }, 0)
            spesaOggiText = `€${todaySpendTotal.toFixed(2)}`

            // Parse 7-day insights
            const weekJson = weekInsightsRes.ok ? await weekInsightsRes.json() : { data: [] }
            const weekData = weekJson.data || []
            const weekSpendTotal = weekData.reduce((s: number, c: any) => s + (parseFloat(c.spend) || 0), 0)
            spesaSetteGiorniText = `€${weekSpendTotal.toFixed(2)}`

            // Build campaigns text — separate active from paused
            const active = campaignsList.filter((c: any) => c.status === 'ACTIVE')
            const paused = campaignsList.filter((c: any) => c.status === 'PAUSED')
            activeCampaignCount = active.length

            // Merge insights with campaign status for active ones
            const todayInsightsMap: Record<string, any> = {}
            todayData.forEach((i: any) => { todayInsightsMap[i.campaign_name] = i })
            const weekInsightsMap: Record<string, any> = {}
            weekData.forEach((i: any) => { weekInsightsMap[i.campaign_name] = i })

            let campLines: string[] = []
            campLines.push(`🟢 CAMPAGNE ATTIVE (${active.length}):`)
            if (active.length === 0) {
                campLines.push('  Nessuna campagna attiva al momento.')
            }
            for (const c of active) {
                const ti = todayInsightsMap[c.name]
                const wi = weekInsightsMap[c.name]
                const budget = c.daily_budget ? `€${(parseInt(c.daily_budget) / 100).toFixed(0)}/giorno` : 'N/A'
                const todaySpend = ti ? `€${parseFloat(ti.spend).toFixed(2)}` : '€0'
                const todayLeads = ti?.actions?.find((a: any) => a.action_type === 'lead')?.value || 0
                const todayCpl = ti?.cost_per_action_type?.find((a: any) => a.action_type === 'lead')?.value
                const weekSpend = wi ? `€${parseFloat(wi.spend).toFixed(2)}` : '€0'
                const weekLeads = wi?.actions?.find((a: any) => a.action_type === 'lead')?.value || 0
                const weekCpl = wi?.cost_per_action_type?.find((a: any) => a.action_type === 'lead')?.value
                const weekCtr = wi?.ctr ? `${parseFloat(wi.ctr).toFixed(2)}%` : 'N/A'
                campLines.push(`  • ${c.name}`)
                campLines.push(`    Budget: ${budget} | OGGI: spesa ${todaySpend}, ${todayLeads} lead${todayCpl ? `, CPL €${parseFloat(todayCpl).toFixed(2)}` : ''}`)
                campLines.push(`    7 GIORNI: spesa ${weekSpend}, ${weekLeads} lead${weekCpl ? `, CPL €${parseFloat(weekCpl).toFixed(2)}` : ''}, CTR ${weekCtr}`)
            }

            if (paused.length > 0) {
                campLines.push(`\n🟡 CAMPAGNE IN PAUSA (${paused.length}):`)
                for (const c of paused) {
                    const wi = weekInsightsMap[c.name]
                    if (wi && parseFloat(wi.spend) > 0) {
                        campLines.push(`  • ${c.name} — spesa 7gg: €${parseFloat(wi.spend).toFixed(2)}`)
                    } else {
                        campLines.push(`  • ${c.name}`)
                    }
                }
            }

            campaignsText = campLines.join('\n')
            campaignsData = campaignsList.map((c: any) => ({ name: c.name, status: c.status }))
        } catch (e) {
            console.error('Dante: Meta API fetch error:', e)
            campaignsText = '⚠️ Errore nel caricamento dati Meta Ads.'
        }
    }

    // --- AI ENGINE STATUS ---
    let aiEngineText = 'Non configurato.'
    if (aiConfig) {
        const mode = aiConfig.execution_mode === 'live' ? '🟢 LIVE (esegue azioni reali)' :
            aiConfig.execution_mode === 'dry_run' ? '🟡 DRY RUN (simula, non esegue)' : aiConfig.execution_mode
        const autopilot = aiConfig.autopilot_active ? '✅ ATTIVO' : '❌ DISATTIVO'
        const features = []
        if (aiConfig.auto_pause_enabled) features.push('Auto-Pause')
        if (aiConfig.auto_scale_enabled) features.push('Auto-Scale')
        if (aiConfig.auto_creative_refresh) features.push('Creative Refresh')
        aiEngineText = [
            `Pilota Automatico: ${autopilot}`,
            `Modalità esecuzione: ${mode}`,
            `Funzionalità attive: ${features.length > 0 ? features.join(', ') : 'Nessuna'}`,
            `Intervallo analisi: ogni ${aiConfig.analysis_interval_minutes || 60} minuti`,
            `Rischio: ${aiConfig.risk_tolerance || 'medium'}`,
            aiConfig.budget_daily ? `Budget giornaliero impostato: €${aiConfig.budget_daily}` : '',
        ].filter(Boolean).join('\n')
    }

    // --- FORMAT LEADS ---
    const leadsText = leads.slice(0, 15).map((l, i) => {
        const stageName = stageMap.get(l.stage_id)?.name || 'Non assegnato'
        const time = fmtIT(l.created_at)
        const childAge = l.meta_data?.child_age || ''
        const parts = [
            `${i === 0 ? '⭐' : `#${i + 1}`} ${l.name}`,
            `   Arrivo: ${time} | Stage: ${stageName}`,
            `   Tel: ${l.phone || 'N/A'} | Email: ${l.email || 'N/A'}`,
            l.utm_source ? `   Fonte: ${l.utm_source}${l.utm_campaign ? ` / ${l.utm_campaign}` : ''}` : '',
            l.value ? `   Valore: €${l.value}` : '',
            childAge ? `   Età figlio: ${childAge}` : '',
            l.notes ? `   Note: ${l.notes}` : '',
        ].filter(Boolean)
        return parts.join('\n')
    }).join('\n\n')

    const leadsTodayText = leadsToday.length > 0
        ? leadsToday.map(l => `  • ${l.name} — ${fmtIT(l.created_at)} (${stageMap.get(l.stage_id)?.name || 'N/A'})`).join('\n')
        : '  Nessun lead oggi.'

    // --- PIPELINE ---
    const pipelineText = stageDist.map(s => `  • ${s.name}: ${s.count}`).join('\n') || '  Pipeline vuota.'

    // Return structured for both askAIFast (compact) and askAI (full)
    return {
        current_datetime: { date: todayISO, yesterday: new Date(now.getTime() - 86400000).toLocaleDateString('en-CA', { timeZone: 'Europe/Rome' }) },
        summary: {
            total_leads: leads.length,
            leads_today: leadsToday.length,
            leads_this_week: leadsThisWeek.length,
            active_campaigns: activeCampaignCount,
            total_spend: spesaOggiText, // Now this is TODAY's spend
            avg_cpl: 'vedi dettaglio campagne',
        },
        stage_distribution: stageDist,
        campaigns: campaignsData,
        recent_leads: leads.slice(0, 5).map(l => ({
            name: l.name,
            stage: stageMap.get(l.stage_id)?.name || 'N/A',
            source: l.utm_source || 'Diretto',
            created: l.created_at,
        })),
        // NEW: structured text for AI (much better than JSON)
        structured_text: `📅 DATA E ORA: ${italianNow}

━━━ 📊 RIEPILOGO OGGI ━━━
Lead oggi: ${leadsToday.length}
Spesa ADS oggi: ${spesaOggiText}
Spesa ADS ultimi 7 giorni: ${spesaSetteGiorniText}
Campagne attive: ${activeCampaignCount}
Lead totali in pipeline: ${leads.length}

━━━ 📢 CAMPAGNE META ADS ━━━
${campaignsText}

━━━ 🤖 AI ENGINE (PILOTA AUTOMATICO) ━━━
${aiEngineText}

━━━ 📥 LEAD DI OGGI (${leadsToday.length}) ━━━
${leadsTodayText}

━━━ 📋 PIPELINE ━━━
${pipelineText}

━━━ 👥 ULTIMI 15 LEAD ━━━
${leadsText}`,
    }
}

