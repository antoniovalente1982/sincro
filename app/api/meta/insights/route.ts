import { NextRequest, NextResponse } from 'next/server'
import { createClient, SupabaseClient } from '@supabase/supabase-js'

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

        const orgId = member.organization_id

        // Get date range from query params
        const { searchParams } = new URL(req.url)
        const since = searchParams.get('since')
        const until = searchParams.get('until')

        if (!since || !until) {
            return NextResponse.json({ error: 'Missing since/until params' }, { status: 400 })
        }

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
        // IMPORTANT: Include ALL campaign delivery statuses to capture spend from
        // campaigns that were paused mid-day or had residual delivery
        const timeRange = JSON.stringify({ since, until })
        const filtering = JSON.stringify([{
            field: 'campaign.delivery_info',
            operator: 'IN',
            value: ['active', 'inactive', 'completed', 'limited', 'not_delivering', 'not_published', 'pending_review', 'recently_completed', 'recently_rejected', 'rejected', 'scheduled']
        }])
        const insightsUrl = `https://graph.facebook.com/${META_API_VERSION}/${adAccount}/insights?fields=campaign_id,campaign_name,spend,impressions,clicks,ctr,cpc,actions,cost_per_action_type,outbound_clicks,inline_link_click_ctr&level=campaign&time_range=${encodeURIComponent(timeRange)}&use_account_attribution_setting=true&limit=500&access_token=${access_token}`
        const insightsRes = await fetch(insightsUrl)

        let insightsMap: Record<string, any> = {}
        if (insightsRes.ok) {
            const insightsData = await insightsRes.json()
            const allInsights = insightsData.data || []
            
            // Handle pagination — Meta may split results across pages
            let nextPageUrl = insightsData.paging?.next
            while (nextPageUrl) {
                const pageRes = await fetch(nextPageUrl)
                if (pageRes.ok) {
                    const pageData = await pageRes.json()
                    allInsights.push(...(pageData.data || []))
                    nextPageUrl = pageData.paging?.next
                } else {
                    break
                }
            }

            for (const insight of allInsights) {
                insightsMap[insight.campaign_id] = insight
            }
            
            // Debug: log total spend from Meta for this period
            const metaTotalSpend = allInsights.reduce((s: number, i: any) => s + parseFloat(i.spend || '0'), 0)
            console.log(`[META INSIGHTS] Period ${since} → ${until}: ${allInsights.length} campaigns with data, total spend: €${metaTotalSpend.toFixed(2)}`)
        }

        // 3. Count REAL leads from CRM (ground truth) for each campaign
        // Meta API underreports leads due to attribution gaps (iOS ATT, cookie blocking)
        // even though CAPI events are all received successfully.
        // CRM leads matched by utm_campaign are the accurate count.
        const { data: crmLeads } = await getSupabaseAdmin()
            .from('leads')
            .select('id, utm_campaign, value, stage_id')
            .eq('organization_id', orgId)
            .gte('created_at', since + 'T00:00:00+02:00')
            .lte('created_at', until + 'T23:59:59+02:00')

        // Build CRM leads count per campaign name (case-insensitive match)
        const crmLeadsMap: Record<string, number> = {}
        let unattributedLeads = 0
        for (const lead of (crmLeads || [])) {
            if (lead.utm_campaign) {
                const campKey = lead.utm_campaign.toLowerCase().trim()
                crmLeadsMap[campKey] = (crmLeadsMap[campKey] || 0) + 1
            } else {
                unattributedLeads++
            }
        }

        // 4. Aggrega Revenue dal CRM (per i lead VENDUTI in questo periodo)
        const { data: wonLeads } = await getSupabaseAdmin()
            .from('leads')
            .select(`value, utm_campaign, pipeline_stages!inner(is_won)`)
            .eq('organization_id', orgId)
            .eq('pipeline_stages.is_won', true)
            .gte('updated_at', since)
            .lte('updated_at', until + 'T23:59:59.999Z')
            .not('value', 'is', null)

        const crmRevenueMap: Record<string, number> = {}
        let unattributedRevenue = 0
        for (const lead of (wonLeads || [])) {
            if (lead.utm_campaign) {
                const campKey = lead.utm_campaign.toLowerCase().trim()
                crmRevenueMap[campKey] = (crmRevenueMap[campKey] || 0) + (Number(lead.value) || 0)
            } else {
                unattributedRevenue += (Number(lead.value) || 0)
            }
        }

        // Attribute unmatched revenue & leads to highest-spend campaign
        let highestSpendCampKey = ''
        let highestSpend = 0
        for (const c of allCampaigns) {
            const spend = parseFloat(insightsMap[c.id]?.spend || '0')
            if (spend > highestSpend) {
                highestSpend = spend
                highestSpendCampKey = (c.name || '').toLowerCase().trim()
            }
        }
        if (highestSpendCampKey) {
            if (unattributedRevenue > 0) {
                crmRevenueMap[highestSpendCampKey] = (crmRevenueMap[highestSpendCampKey] || 0) + unattributedRevenue
            }
            if (unattributedLeads > 0) {
                crmLeadsMap[highestSpendCampKey] = (crmLeadsMap[highestSpendCampKey] || 0) + unattributedLeads
            }
        }

        // 5. Build combined data — show ALL campaigns with their real-time status,
        //    CRM lead counts (ground truth), and Meta spend/traffic metrics
        const campaigns = allCampaigns.map((c: any) => {
            const insight = insightsMap[c.id] || {}
            const metaLeadsCount = parseInt(insight.actions?.find((a: any) => a.action_type === 'lead')?.value || '0')
            const purchaseValue = parseFloat(insight.actions?.find((a: any) => a.action_type === 'omni_purchase')?.value || '0')
            const spendNum = parseFloat(insight.spend || '0')

            const campKey = (c.name || '').toLowerCase().trim()
            const crmLeadCount = crmLeadsMap[campKey] || 0
            const crmRevenue = crmRevenueMap[campKey] || 0
            
            // Use CRM leads as ground truth (always >= Meta reported)
            // Fall back to Meta count only if CRM has 0 (edge case: leads without utm_campaign)
            const realLeads = crmLeadCount > 0 ? crmLeadCount : metaLeadsCount
            const realCPL = realLeads > 0 && spendNum > 0 ? spendNum / realLeads : 0

            const totalRevenue = Math.max(purchaseValue, crmRevenue)
            const roas = spendNum > 0 && totalRevenue > 0 ? totalRevenue / spendNum : 0

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
                leads_count: realLeads,
                meta_leads_count: metaLeadsCount,  // Keep Meta's count for reference
                cpl: realCPL,
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
