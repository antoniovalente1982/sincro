import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
)

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
            const { data: connections } = await supabaseAdmin
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
        const { data: { user } } = await supabaseAdmin.auth.getUser(token)
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { data: member } = await supabaseAdmin
            .from('organization_members')
            .select('organization_id')
            .eq('user_id', user.id)
            .single()

        if (!member) {
            return NextResponse.json({ error: 'No organization' }, { status: 403 })
        }

        orgId = member.organization_id

        // Get Meta credentials
        const { data: conn } = await supabaseAdmin
            .from('connections')
            .select('credentials')
            .eq('organization_id', orgId)
            .eq('provider', 'meta_ads')
            .eq('status', 'active')
            .single()

        if (!conn?.credentials?.access_token) {
            return NextResponse.json({ error: 'Meta Ads not connected' }, { status: 400 })
        }

        const result = await syncCampaigns(orgId!, conn.credentials)
        return NextResponse.json({ success: true, ...result })
    } catch (err: any) {
        console.error('Meta sync error:', err)
        return NextResponse.json({ error: err.message || 'Sync failed' }, { status: 500 })
    }
}

async function syncCampaigns(orgId: string, credentials: any) {
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

    // 2. Get insights for all campaigns (last 30 days)
    const now = new Date()
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    const timeRange = JSON.stringify({
        since: thirtyDaysAgo.toISOString().split('T')[0],
        until: now.toISOString().split('T')[0],
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

    // 3. Upsert campaigns with insights
    let synced = 0
    for (const campaign of campaigns) {
        const insight = insightsMap[campaign.id] || {}

        const leadsCount = insight.actions?.find((a: any) => a.action_type === 'lead')?.value || 0
        const cplValue = insight.cost_per_action_type?.find((a: any) => a.action_type === 'lead')?.value || 0
        const purchaseCount = insight.actions?.find((a: any) => a.action_type === 'purchase')?.value || 0
        const purchaseValue = insight.actions?.find((a: any) => a.action_type === 'omni_purchase')?.value || 0
        const spendNum = parseFloat(insight.spend || '0')
        const roas = spendNum > 0 && purchaseValue > 0 ? parseFloat(purchaseValue) / spendNum : 0

        const { error } = await supabaseAdmin
            .from('campaigns_cache')
            .upsert({
                organization_id: orgId,
                external_campaign_id: campaign.id,
                campaign_name: campaign.name || '',
                status: campaign.status || 'UNKNOWN',
                objective: campaign.objective || null,
                daily_budget: campaign.daily_budget ? parseFloat(campaign.daily_budget) / 100 : null,
                spend: spendNum,
                impressions: parseInt(insight.impressions || '0'),
                clicks: parseInt(insight.clicks || '0'),
                leads_count: parseInt(leadsCount),
                cpl: parseFloat(cplValue),
                cpc: parseFloat(insight.cpc || '0'),
                ctr: parseFloat(insight.ctr || '0'),
                conversions: parseInt(purchaseCount),
                roas: roas,
                date_range_start: insight.date_start || null,
                date_range_end: insight.date_stop || null,
                synced_at: new Date().toISOString(),
            }, {
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
