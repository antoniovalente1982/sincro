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
    const [leadsRes, campaignsRes, stagesRes, submissionsRes] = await Promise.all([
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
            .select('id, name, slug, sort_order, is_won, is_lost')
            .eq('organization_id', orgId)
            .order('sort_order', { ascending: true }),
        supabaseAdmin
            .from('funnel_submissions')
            .select('id, created_at')
            .eq('organization_id', orgId)
            .order('created_at', { ascending: false })
            .limit(100),
    ])

    const leads = leadsRes.data || []
    const campaigns = campaignsRes.data || []
    const stages = stagesRes.data || []
    const submissions = submissionsRes.data || []

    // Build stage map for lead enrichment
    const stageMap = new Map(stages.map(s => [s.id, s.name]))

    // Calculate quick stats
    const today = new Date().toISOString().split('T')[0]
    const leadsToday = leads.filter(l => l.created_at?.startsWith(today)).length
    const leadsThisWeek = leads.filter(l => {
        const d = new Date(l.created_at)
        const now = new Date()
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        return d >= weekAgo
    }).length

    const totalSpend = campaigns.reduce((s, c) => s + (Number(c.spend) || 0), 0)
    const totalLeads = campaigns.reduce((s, c) => s + (Number(c.leads_count) || 0), 0)
    const avgCPL = totalLeads > 0 ? totalSpend / totalLeads : 0
    const activeCampaigns = campaigns.filter(c => c.status === 'ACTIVE')

    // Stage distribution
    const stageDist = stages.map(s => ({
        name: s.name,
        count: leads.filter(l => l.stage_id === s.id).length,
    })).filter(s => s.count > 0)

    return {
        summary: {
            total_leads: leads.length,
            leads_today: leadsToday,
            leads_this_week: leadsThisWeek,
            total_submissions: submissions.length,
            total_campaigns: campaigns.length,
            active_campaigns: activeCampaigns.length,
            total_spend: totalSpend.toFixed(2),
            avg_cpl: avgCPL.toFixed(2),
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
        recent_leads: leads.slice(0, 10).map(l => ({
            name: l.name,
            stage: stageMap.get(l.stage_id) || 'Unknown',
            source: l.utm_source || l.source_channel || 'Direct',
            value: l.value,
            created: l.created_at,
        })),
    }
}
