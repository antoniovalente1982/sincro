import { NextRequest, NextResponse } from 'next/server'
import { createClient, SupabaseClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

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
        const dateMode = searchParams.get('date_mode') || 'created'

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

        // 1. Get all campaigns (for name, status) and ads (for creative thumbnails)
        const campaignsUrl = `https://graph.facebook.com/${META_API_VERSION}/${adAccount}/campaigns?fields=id,name,status,objective,daily_budget,ads{effective_status}&limit=500&access_token=${access_token}`
        const adsUrl = `https://graph.facebook.com/${META_API_VERSION}/${adAccount}/ads?fields=name,creative{thumbnail_url,image_url}&limit=1000&access_token=${access_token}`
        
        const [campaignsRes, adsRes] = await Promise.all([
            fetch(campaignsUrl, { cache: 'no-store' }),
            fetch(adsUrl, { cache: 'no-store' })
        ])

        if (!campaignsRes.ok) {
            const errText = await campaignsRes.text()
            console.error('Meta campaigns API error:', errText)
            return NextResponse.json({ error: `Meta API error: ${campaignsRes.status}` }, { status: 500 })
        }

        const campaignsData = await campaignsRes.json()
        const allCampaigns = campaignsData.data || []
        
        let adThumbnails: Record<string, string> = {}
        if (adsRes.ok) {
            const adsData = await adsRes.json()
            for (const ad of (adsData.data || [])) {
                if (ad.name && ad.creative?.thumbnail_url) {
                    adThumbnails[ad.name.trim()] = ad.creative.thumbnail_url
                } else if (ad.name && ad.creative?.image_url) {
                    adThumbnails[ad.name.trim()] = ad.creative.image_url
                }
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
        const insightsRes = await fetch(insightsUrl, { cache: 'no-store' })

        let insightsMap: Record<string, any> = {}
        if (insightsRes.ok) {
            const insightsData = await insightsRes.json()
            const allInsights = insightsData.data || []
            
            // Handle pagination — Meta may split results across pages
            let nextPageUrl = insightsData.paging?.next
            while (nextPageUrl) {
                const pageRes = await fetch(nextPageUrl, { cache: 'no-store' })
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

        // 3. Extract CRM Pipeline Data (Appts, Showups, Sales, Revenue, Leads)
        // We use either 'created_at' or 'updated_at' depending on dateMode
        const dateColumn = dateMode === 'created' ? 'created_at' : 'updated_at'
        
        const { data: crmData } = await getSupabaseAdmin()
            .from('leads')
            .select(`
                id, 
                created_at,
                utm_campaign, 
                value, 
                meta_data,
                pipeline_stages (slug, is_won, is_lost)
            `)
            .eq('organization_id', orgId)
            .gte(dateColumn, since + 'T00:00:00+02:00')
            .lte(dateColumn, until + 'T23:59:59+02:00')

        const campMetrics: Record<string, {
            leads: number,
            appts: number,
            showups: number,
            sales: number,
            revenue: number
        }> = {}

        let unattributed = { leads: 0, appts: 0, showups: 0, sales: 0, revenue: 0 }
        const sinceMs = new Date(since + 'T00:00:00+02:00').getTime()
        const untilMs = new Date(until + 'T23:59:59+02:00').getTime()
        const topPairsMap: Record<string, { creative: string, headline: string, leads: number, thumbnail_url?: string }> = {}

        for (const lead of (crmData || [])) {
            const campKey = (lead.utm_campaign || '').toLowerCase().trim()
            const metrics = campKey ? (campMetrics[campKey] = campMetrics[campKey] || { leads: 0, appts: 0, showups: 0, sales: 0, revenue: 0 }) : unattributed
            
            // Only count as "Lead generato" if it was actually newly created in this period
            const createdTs = new Date(lead.created_at).getTime()
            if (dateMode === 'created' || (createdTs >= sinceMs && createdTs <= untilMs)) {
                metrics.leads++

                // Extract creative and dynamic headline from utm_content (format: "Ad Name - T: Dynamic Headline")
                const mData = lead.meta_data || {}
                const fullCreativeName = (mData.utm_content || '').trim()
                let utmContent = fullCreativeName || 'Sconosciuta'
                let dynamicHeadline = 'Predefinita'
                let thumbnailUrl = fullCreativeName ? adThumbnails[fullCreativeName] : undefined

                if (utmContent.includes(' - T: ')) {
                    const parts = utmContent.split(' - T: ')
                    utmContent = parts[0].trim()
                    dynamicHeadline = parts[1].trim()
                } else if (utmContent.includes('- T: ')) {
                    const parts = utmContent.split('- T: ')
                    utmContent = parts[0].trim()
                    dynamicHeadline = parts[1].trim()
                }

                if (utmContent !== 'Sconosciuta') {
                    const pairKey = `${utmContent}:::${dynamicHeadline}`
                    if (!topPairsMap[pairKey]) {
                        topPairsMap[pairKey] = { creative: utmContent, headline: dynamicHeadline, leads: 0, thumbnail_url: thumbnailUrl }
                    } else if (thumbnailUrl && !topPairsMap[pairKey].thumbnail_url) {
                        topPairsMap[pairKey].thumbnail_url = thumbnailUrl
                    }
                    topPairsMap[pairKey].leads++
                }
            }

            const stage = Array.isArray(lead.pipeline_stages) ? lead.pipeline_stages[0] : lead.pipeline_stages
            if (!stage) continue

            const slug = stage.slug
            const isWon = stage.is_won

            if (slug === 'appuntamento' || slug === 'show-up' || isWon) metrics.appts++
            if (slug === 'show-up' || isWon) metrics.showups++
            if (isWon) {
                metrics.sales++
                metrics.revenue += (Number(lead.value) || 0)
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
        
        if (highestSpendCampKey && (unattributed.leads > 0 || unattributed.revenue > 0 || unattributed.appts > 0)) {
            const highestTarget = campMetrics[highestSpendCampKey] = campMetrics[highestSpendCampKey] || { leads: 0, appts: 0, showups: 0, sales: 0, revenue: 0 }
            highestTarget.leads += unattributed.leads
            highestTarget.appts += unattributed.appts
            highestTarget.showups += unattributed.showups
            highestTarget.sales += unattributed.sales
            highestTarget.revenue += unattributed.revenue
        }

        // Fetch funnel mappings from cache
        const { data: cachedFunnels } = await getSupabaseAdmin()
            .from('campaigns_cache')
            .select('external_campaign_id, funnel_id')
            .eq('organization_id', orgId)

        const funnelMap: Record<string, string> = {}
        for (const cf of (cachedFunnels || [])) {
            if (cf.funnel_id) funnelMap[cf.external_campaign_id] = cf.funnel_id
        }

        // 5. Build combined data — show ALL campaigns with their real-time status,
        //    CRM lead counts (ground truth), and Meta spend/traffic metrics
        const campaigns = allCampaigns.map((c: any) => {
            const insight = insightsMap[c.id] || {}
            const metaLeadsCount = parseInt(insight.actions?.find((a: any) => a.action_type === 'lead')?.value || '0')
            const purchaseValue = parseFloat(insight.actions?.find((a: any) => a.action_type === 'omni_purchase')?.value || '0')
            const spendNum = parseFloat(insight.spend || '0')

            const campKey = (c.name || '').toLowerCase().trim()
            const cm = campMetrics[campKey] || { leads: 0, appts: 0, showups: 0, sales: 0, revenue: 0 }
            
            // Use CRM leads as ground truth (always >= Meta reported)
            const realLeads = cm.leads > 0 ? cm.leads : metaLeadsCount
            const realCPL = realLeads > 0 && spendNum > 0 ? spendNum / realLeads : 0
            
            const totalRevenue = Math.max(purchaseValue, cm.revenue)
            const roas = spendNum > 0 && totalRevenue > 0 ? totalRevenue / spendNum : 0
            
            const linkClicks = insight.outbound_clicks?.find((a: any) => a.action_type === 'outbound_click')?.value || 0
            const linkClickCtr = parseFloat(insight.inline_link_click_ctr || '0')

            let effectiveStatus = c.status
            if (effectiveStatus === 'ACTIVE' && c.ads && c.ads.data) {
                const hasActiveAds = c.ads.data.some((ad: any) => ad.effective_status === 'ACTIVE')
                if (!hasActiveAds) {
                    effectiveStatus = 'PAUSED'
                }
            }

            return {
                id: c.id,
                campaign_name: c.name,
                status: effectiveStatus,
                objective: c.objective,
                daily_budget: c.daily_budget ? parseFloat(c.daily_budget) / 100 : null,
                spend: spendNum,
                impressions: parseInt(insight.impressions || '0'),
                clicks: parseInt(insight.clicks || '0'),
                ctr: parseFloat(insight.ctr || '0'),
                link_clicks: parseInt(linkClicks),
                link_click_ctr: linkClickCtr,
                leads_count: realLeads,
                meta_leads_count: metaLeadsCount,
                crm_appts: cm.appts,
                crm_showups: cm.showups,
                crm_sales: cm.sales,
                crm_revenue: totalRevenue, // Use highest of CRM vs Meta purchases
                cpl: realCPL,
                cpc: parseFloat(insight.cpc || '0'),
                cp_appt: cm.appts > 0 && spendNum > 0 ? spendNum / cm.appts : null,
                cp_showup: cm.showups > 0 && spendNum > 0 ? spendNum / cm.showups : null,
                cac: cm.sales > 0 && spendNum > 0 ? spendNum / cm.sales : null,
                roas,
                date_range_start: since,
                date_range_end: until,
                funnel_id: funnelMap[c.id] || null,
            }
        })

        const topPairs = Object.values(topPairsMap).sort((a, b) => b.leads - a.leads).slice(0, 15)

        return NextResponse.json({
            success: true,
            campaigns,
            topPairs,
            period: { since, until },
            fetched_at: new Date().toISOString(),
        }, {
            headers: {
                'Cache-Control': 'no-store, must-revalidate, max-age=0',
                'Pragma': 'no-cache',
                'Expires': '0',
            }
        })
    } catch (err: any) {
        console.error('Meta insights error:', err)
        return NextResponse.json({ error: err.message || 'Failed' }, { status: 500, headers: { 'Cache-Control': 'no-store' } })
    }
}
