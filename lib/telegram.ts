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
 * Lightweight version for Telegram webhook (3 queries instead of 7)
 * Designed to fit within Vercel Hobby 10s timeout
 */
export async function getOrgDataContextLite(orgId: string) {
    const now = new Date()
    const todayStr = now.toISOString().split('T')[0]
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000)
    const yesterdayStr = yesterday.toISOString().split('T')[0]
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

    const [leadsRes, campaignsRes, stagesRes] = await Promise.all([
        supabaseAdmin
            .from('leads')
            .select('id, name, stage_id, value, utm_source, created_at')
            .eq('organization_id', orgId)
            .order('created_at', { ascending: false })
            .limit(20),
        supabaseAdmin
            .from('campaigns_cache')
            .select('campaign_name, status, spend, leads_count, cpl, ctr, roas')
            .eq('organization_id', orgId),
        supabaseAdmin
            .from('pipeline_stages')
            .select('id, name, is_won, is_lost')
            .eq('organization_id', orgId)
            .order('sort_order', { ascending: true }),
    ])

    const leads = leadsRes.data || []
    const campaigns = campaignsRes.data || []
    const stages = stagesRes.data || []
    const stageMap = new Map(stages.map(s => [s.id, s]))

    const leadsToday = leads.filter(l => l.created_at?.startsWith(todayStr)).length
    const leadsYesterday = leads.filter(l => l.created_at?.startsWith(yesterdayStr)).length
    const leadsThisWeek = leads.filter(l => new Date(l.created_at) >= weekAgo).length

    const totalSpend = campaigns.reduce((s, c) => s + (Number(c.spend) || 0), 0)
    const totalCampaignLeads = campaigns.reduce((s, c) => s + (Number(c.leads_count) || 0), 0)
    const avgCPL = totalCampaignLeads > 0 ? totalSpend / totalCampaignLeads : 0

    const stageDist = stages.map(s => ({
        name: s.name,
        count: leads.filter(l => l.stage_id === s.id).length,
    })).filter(s => s.count > 0)

    return {
        current_datetime: { date: todayStr, yesterday: yesterdayStr },
        summary: {
            total_leads: leads.length,
            leads_today: leadsToday,
            leads_yesterday: leadsYesterday,
            leads_this_week: leadsThisWeek,
            active_campaigns: campaigns.filter(c => c.status === 'ACTIVE').length,
            total_spend: totalSpend.toFixed(2),
            avg_cpl: avgCPL.toFixed(2),
        },
        stage_distribution: stageDist,
        campaigns: campaigns.map(c => ({
            name: c.campaign_name, status: c.status,
            spend: c.spend, leads: c.leads_count, cpl: c.cpl, ctr: c.ctr,
        })),
        recent_leads: leads.slice(0, 5).map(l => ({
            name: l.name,
            stage: stageMap.get(l.stage_id)?.name || 'N/A',
            source: l.utm_source || 'Diretto',
            created: l.created_at,
        })),
    }
}
