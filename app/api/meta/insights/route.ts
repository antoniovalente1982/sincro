import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
)

const META_API_VERSION = 'v21.0'

/**
 * GET /api/meta/insights?since=2026-03-23&until=2026-03-23
 * Live fetch from Meta API — returns campaign data for a specific date range.
 * Does NOT cache in DB. Used for "Oggi", "Ieri", "7 Giorni", etc.
 */
export async function GET(req: NextRequest) {
    try {
        const authHeader = req.headers.get('authorization')
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

        const orgId = member.organization_id

        // Get date range from query params
        const { searchParams } = new URL(req.url)
        const since = searchParams.get('since')
        const until = searchParams.get('until')

        if (!since || !until) {
            return NextResponse.json({ error: 'Missing since/until params' }, { status: 400 })
        }

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

        const { access_token, ad_account_id } = conn.credentials
        const adAccount = `act_${ad_account_id}`

        // 1. Get all campaigns (for name, status, objective)
        const campaignsUrl = `https://graph.facebook.com/${META_API_VERSION}/${adAccount}/campaigns?fields=id,name,status,objective,daily_budget&limit=500&access_token=${access_token}`
        const campaignsRes = await fetch(campaignsUrl)

        if (!campaignsRes.ok) {
            const errText = await campaignsRes.text()
            console.error('Meta campaigns API error:', errText)
            return NextResponse.json({ error: `Meta API error: ${campaignsRes.status}` }, { status: 500 })
        }

        const campaignsData = await campaignsRes.json()
        const allCampaigns = campaignsData.data || []

        // Build campaign info map
        const campaignMap: Record<string, any> = {}
        for (const c of allCampaigns) {
            campaignMap[c.id] = {
                campaign_name: c.name,
                status: c.status,
                objective: c.objective,
                daily_budget: c.daily_budget ? parseFloat(c.daily_budget) / 100 : null,
            }
        }

        // 2. Get insights for the specific date range
        const timeRange = JSON.stringify({ since, until })
        const insightsUrl = `https://graph.facebook.com/${META_API_VERSION}/${adAccount}/insights?fields=campaign_id,campaign_name,spend,impressions,clicks,ctr,cpc,actions,cost_per_action_type,outbound_clicks,inline_link_click_ctr&level=campaign&time_range=${encodeURIComponent(timeRange)}&limit=500&access_token=${access_token}`
        const insightsRes = await fetch(insightsUrl)

        let insightsMap: Record<string, any> = {}
        if (insightsRes.ok) {
            const insightsData = await insightsRes.json()
            for (const insight of (insightsData.data || [])) {
                insightsMap[insight.campaign_id] = insight
            }
        }

        // 3. Aggrega Revenue dal CRM (per i lead entrati in questo periodo)
        const { data: wonLeads } = await supabaseAdmin
            .from('leads')
            .select(`value, utm_campaign, pipeline_stages!inner(is_won)`)
            .eq('organization_id', orgId)
            .eq('pipeline_stages.is_won', true)
            .gte('created_at', since)
            .lte('created_at', until + 'T23:59:59.999Z')
            .not('value', 'is', null)

        const crmRevenueMap: Record<string, number> = {}
        for (const lead of (wonLeads || [])) {
            if (!lead.utm_campaign) continue
            // Normalize for matching
            const campKey = lead.utm_campaign.toLowerCase().trim()
            crmRevenueMap[campKey] = (crmRevenueMap[campKey] || 0) + (Number(lead.value) || 0)
        }

        // 4. Build combined data — show ALL campaigns with their real-time status,
        //    but with spend/metrics only from the selected period
        const campaigns = allCampaigns.map((c: any) => {
            const insight = insightsMap[c.id] || {}
            const leadsCount = insight.actions?.find((a: any) => a.action_type === 'lead')?.value || 0
            const cplValue = insight.cost_per_action_type?.find((a: any) => a.action_type === 'lead')?.value || 0
            const purchaseValue = parseFloat(insight.actions?.find((a: any) => a.action_type === 'omni_purchase')?.value || '0')
            const spendNum = parseFloat(insight.spend || '0')

            const campKey = (c.name || '').toLowerCase().trim()
            const crmRevenue = crmRevenueMap[campKey] || 0
            
            // To prevent double counting if CAPI successfully sent the offline conversion, we take the max
            const totalRevenue = Math.max(purchaseValue, crmRevenue)
            const roas = spendNum > 0 && totalRevenue > 0 ? totalRevenue / spendNum : 0

            // Link clicks: outbound_clicks contains clicks to external URLs
            const linkClicks = insight.outbound_clicks?.find((a: any) => a.action_type === 'outbound_click')?.value || 0
            const linkClickCtr = parseFloat(insight.inline_link_click_ctr || '0')

            return {
                id: c.id,
                campaign_name: c.name,
                status: c.status,
                objective: c.objective,
                daily_budget: c.daily_budget ? parseFloat(c.daily_budget) / 100 : null,
                spend: spendNum,
                impressions: parseInt(insight.impressions || '0'),
                clicks: parseInt(insight.clicks || '0'),
                ctr: parseFloat(insight.ctr || '0'),
                link_clicks: parseInt(linkClicks),
                link_click_ctr: linkClickCtr,
                leads_count: parseInt(leadsCount),
                cpl: parseFloat(cplValue),
                cpc: parseFloat(insight.cpc || '0'),
                roas,
                date_range_start: since,
                date_range_end: until,
            }
        })

        return NextResponse.json({
            success: true,
            campaigns,
            period: { since, until },
            fetched_at: new Date().toISOString(),
        })
    } catch (err: any) {
        console.error('Meta insights error:', err)
        return NextResponse.json({ error: err.message || 'Failed' }, { status: 500 })
    }
}
