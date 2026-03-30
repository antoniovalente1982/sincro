import { NextRequest, NextResponse } from 'next/server'
import { createClient, SupabaseClient } from "@supabase/supabase-js"

function getSupabaseAdmin() {
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!serviceKey) {
        console.error('SUPABASE_SERVICE_ROLE_KEY is missing. Falling back to ANON_KEY, which may cause RLS errors.')
    }
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        serviceKey || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    )
}

const META_API_VERSION = 'v21.0'

export async function POST(req: NextRequest) {
    try {
        // Auth: either cron secret or authenticated user
        const authHeader = req.headers.get('authorization')
        const cronSecret = process.env.CRON_SECRET
        const isCron = cronSecret && authHeader === `Bearer ${cronSecret}`

        let orgId: string | null = null

        if (isCron) {
            // Sync all orgs that have meta_ads connected
            const { data: connections } = await getSupabaseAdmin()
                .from('connections')
                .select('organization_id, credentials')
                .eq('provider', 'meta_ads')
                .eq('status', 'active')

            if (!connections?.length) {
                return NextResponse.json({ message: 'No active Meta Ads connections' })
            }

            const results = []
            for (const conn of connections) {
                const result = await syncCampaigns(conn.organization_id, conn.credentials)
                results.push({ org: conn.organization_id, ...result })
            }

            return NextResponse.json({ success: true, results })
        }

        // Manual trigger — check auth
        if (!authHeader) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const token = authHeader.replace('Bearer ', '')
        const { data: { user } } = await getSupabaseAdmin().auth.getUser(token)
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { data: member } = await getSupabaseAdmin()
            .from('organization_members')
            .select('organization_id')
            .eq('user_id', user.id)
            .single()

        if (!member) {
            return NextResponse.json({ error: 'No organization' }, { status: 403 })
        }

        orgId = member.organization_id

        // Parse optional time range from request body
        let timeRangeOverride: { since: string; until: string } | null = null
        try {
            const body = await req.json()
            if (body?.time_range?.since && body?.time_range?.until) {
                timeRangeOverride = body.time_range
            }
        } catch {} // body may be empty for cron calls

        // Get Meta credentials
        const { data: conn } = await getSupabaseAdmin()
            .from('connections')
            .select('credentials')
            .eq('organization_id', orgId)
            .eq('provider', 'meta_ads')
            .eq('status', 'active')
            .single()

        if (!conn?.credentials?.access_token) {
            return NextResponse.json({ error: 'Meta Ads not connected' }, { status: 400 })
        }

        const result = await syncCampaigns(orgId!, conn.credentials, timeRangeOverride)
        return NextResponse.json({ success: true, ...result })
    } catch (err: any) {
        console.error('Meta sync error:', err)
        return NextResponse.json({ error: err.message || 'Sync failed' }, { status: 500 })
    }
}

async function syncCampaigns(orgId: string, credentials: any, timeRangeOverride?: { since: string; until: string } | null) {
    const { access_token, ad_account_id } = credentials
    if (!access_token || !ad_account_id) {
        return { error: 'Missing credentials', synced: 0 }
    }

    const adAccount = `act_${ad_account_id}`

    // 1. Get all campaigns with their status and config
    const campaignsUrl = `https://graph.facebook.com/${META_API_VERSION}/${adAccount}/campaigns?fields=id,name,status,objective,daily_budget,lifetime_budget&limit=100&access_token=${access_token}`
    const campaignsRes = await fetch(campaignsUrl)

    if (!campaignsRes.ok) {
        const errText = await campaignsRes.text()
        console.error('Meta campaigns API error:', errText)
        return { error: `Meta API error: ${campaignsRes.status}`, synced: 0 }
    }

    const campaignsData = await campaignsRes.json()
    const campaigns = campaignsData.data || []

    if (campaigns.length === 0) {
        return { message: 'No campaigns found', synced: 0 }
    }

    // 2. Get insights — use override range if provided, otherwise last 30 days
    // Always fetch lifetime insights from Meta to avoid overwriting data with zeros
    // The UI date filter only controls display, not what gets fetched
    const timeRange = JSON.stringify({
        since: '2024-01-01',
        until: new Date().toISOString().split('T')[0],
    })

    const insightsUrl = `https://graph.facebook.com/${META_API_VERSION}/${adAccount}/insights?fields=campaign_id,campaign_name,spend,impressions,clicks,ctr,cpc,cpm,reach,frequency,actions,cost_per_action_type&level=campaign&time_range=${encodeURIComponent(timeRange)}&limit=100&access_token=${access_token}`
    const insightsRes = await fetch(insightsUrl)

    let insightsMap: Record<string, any> = {}
    if (insightsRes.ok) {
        const insightsData = await insightsRes.json()
        for (const insight of (insightsData.data || [])) {
            insightsMap[insight.campaign_id] = insight
        }
    }

    // Aggiunta Revenue dal CRM (Lifetime per la cache)
    const { data: wonLeads } = await getSupabaseAdmin()
        .from('leads')
        .select(`value, utm_campaign, pipeline_stages!inner(is_won)`)
        .eq('organization_id', orgId)
        .eq('pipeline_stages.is_won', true)
        .not('value', 'is', null)

    const crmRevenueMap: Record<string, number> = {}
    let unattributedRevenue = 0
    for (const lead of (wonLeads || [])) {
        if (lead.utm_campaign) {
            const campKey = lead.utm_campaign.toLowerCase().trim()
            crmRevenueMap[campKey] = (crmRevenueMap[campKey] || 0) + (Number(lead.value) || 0)
        } else {
            // Lead without utm_campaign — still a sale, attribute to highest-spend campaign later
            unattributedRevenue += (Number(lead.value) || 0)
        }
    }

    // 3. Attribute unmatched revenue to highest-spend campaign
    if (unattributedRevenue > 0) {
        let highestSpendCampKey = ''
        let highestSpend = 0
        for (const campaign of campaigns) {
            const spend = parseFloat(insightsMap[campaign.id]?.spend || '0')
            if (spend > highestSpend) {
                highestSpend = spend
                highestSpendCampKey = (campaign.name || '').toLowerCase().trim()
            }
        }
        if (highestSpendCampKey) {
            crmRevenueMap[highestSpendCampKey] = (crmRevenueMap[highestSpendCampKey] || 0) + unattributedRevenue
        }
    }

    // Count REAL leads from CRM (lifetime) for each campaign
    const { data: allCrmLeads } = await getSupabaseAdmin()
        .from('leads')
        .select('id, utm_campaign')
        .eq('organization_id', orgId)

    const crmLeadsMap: Record<string, number> = {}
    let unattributedLeads = 0
    for (const lead of (allCrmLeads || [])) {
        if (lead.utm_campaign) {
            const campKey = lead.utm_campaign.toLowerCase().trim()
            crmLeadsMap[campKey] = (crmLeadsMap[campKey] || 0) + 1
        } else {
            unattributedLeads++
        }
    }

    // Attribute unmatched leads to highest-spend campaign
    if (unattributedLeads > 0) {
        let topCampKey = ''
        let topSpend = 0
        for (const campaign of campaigns) {
            const spend = parseFloat(insightsMap[campaign.id]?.spend || '0')
            if (spend > topSpend) {
                topSpend = spend
                topCampKey = (campaign.name || '').toLowerCase().trim()
            }
        }
        if (topCampKey) {
            crmLeadsMap[topCampKey] = (crmLeadsMap[topCampKey] || 0) + unattributedLeads
        }
    }

    // 4. Upsert campaigns with insights
    let synced = 0
    for (const campaign of campaigns) {
        const insight = insightsMap[campaign.id] || {}
        const hasInsights = !!insight.spend // Only update metrics if Meta returned data

        const metaLeadsCount = parseInt(insight.actions?.find((a: any) => a.action_type === 'lead')?.value || '0')
        const purchaseCount = insight.actions?.find((a: any) => a.action_type === 'purchase')?.value || 0
        const purchaseValue = parseFloat(insight.actions?.find((a: any) => a.action_type === 'omni_purchase')?.value || '0')
        const spendNum = parseFloat(insight.spend || '0')
        
        const campKey = (campaign.name || '').toLowerCase().trim()
        const crmLeadCount = crmLeadsMap[campKey] || 0
        const crmRevenue = crmRevenueMap[campKey] || 0
        const totalRevenue = Math.max(purchaseValue, crmRevenue)

        // Use CRM leads as ground truth
        const realLeads = crmLeadCount > 0 ? crmLeadCount : metaLeadsCount
        const realCPL = realLeads > 0 && spendNum > 0 ? spendNum / realLeads : 0

        const roas = spendNum > 0 && totalRevenue > 0 ? totalRevenue / spendNum : 0

        // Base data: always update campaign metadata (name, status, budget)
        const upsertData: any = {
            organization_id: orgId,
            external_campaign_id: campaign.id,
            campaign_name: campaign.name || '',
            status: campaign.status || 'UNKNOWN',
            objective: campaign.objective || null,
            daily_budget: campaign.daily_budget ? parseFloat(campaign.daily_budget) / 100 : null,
            synced_at: new Date().toISOString(),
        }

        // Only overwrite metrics if Meta actually returned insights for this campaign
        if (hasInsights) {
            upsertData.spend = spendNum
            upsertData.impressions = parseInt(insight.impressions || '0')
            upsertData.clicks = parseInt(insight.clicks || '0')
            upsertData.leads_count = realLeads
            upsertData.cpl = realCPL
            upsertData.cpc = parseFloat(insight.cpc || '0')
            upsertData.ctr = parseFloat(insight.ctr || '0')
            upsertData.conversions = parseInt(purchaseCount)
            upsertData.roas = roas
            upsertData.date_range_start = insight.date_start || null
            upsertData.date_range_end = insight.date_stop || null
        }

        const { error } = await getSupabaseAdmin()
            .from('campaigns_cache')
            .upsert(upsertData, {
                onConflict: 'external_campaign_id',
            })

        if (error) {
            console.error('Upsert error for campaign', campaign.id, error)
        } else {
            synced++
        }
    }

    return { synced, total: campaigns.length }
}
