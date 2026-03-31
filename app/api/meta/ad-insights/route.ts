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

/**
 * GET /api/meta/ad-insights?since=2026-03-18&until=2026-03-24&campaign_id=xxx
 * Fetches ad-level insights from Meta for CBO rule evaluation.
 * Returns individual ads with their performance metrics.
 */
export async function GET(req: NextRequest) {
    try {
        const authHeader = req.headers.get('authorization')
        if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        const token = authHeader.replace('Bearer ', '')
        const { data: { user } } = await getSupabaseAdmin().auth.getUser(token)
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        const { data: member } = await getSupabaseAdmin()
            .from('organization_members')
            .select('organization_id')
            .eq('user_id', user.id)
            .single()
        if (!member) return NextResponse.json({ error: 'No organization' }, { status: 403 })

        const { searchParams } = new URL(req.url)
        const since = searchParams.get('since')
        const until = searchParams.get('until')
        const campaignId = searchParams.get('campaign_id') // optional: filter to one campaign

        if (!since || !until) {
            return NextResponse.json({ error: 'Missing since/until params' }, { status: 400 })
        }

        // Get Meta credentials
        const { data: conn } = await getSupabaseAdmin()
            .from('connections')
            .select('credentials')
            .eq('organization_id', member.organization_id)
            .eq('provider', 'meta_ads')
            .eq('status', 'active')
            .single()

        if (!conn?.credentials?.access_token) {
            return NextResponse.json({ error: 'Meta Ads not connected' }, { status: 400 })
        }

        const { access_token, ad_account_id } = conn.credentials
        const adAccount = `act_${ad_account_id}`
        const timeRange = JSON.stringify({ since, until })

        // 1. Get ad-level insights
        let insightsUrl = `https://graph.facebook.com/${META_API_VERSION}/${adAccount}/insights?` +
            `fields=ad_id,ad_name,campaign_id,campaign_name,adset_id,adset_name,spend,impressions,clicks,ctr,cpc,frequency,actions,cost_per_action_type,outbound_clicks,inline_link_clicks,inline_link_click_ctr,cost_per_inline_link_click` +
            `&level=ad&time_range=${encodeURIComponent(timeRange)}&limit=500&access_token=${access_token}`

        if (campaignId) {
            // Filter to specific campaign using filtering
            insightsUrl += `&filtering=[{"field":"campaign.id","operator":"EQUAL","value":"${campaignId}"}]`
        }

        const insightsRes = await fetch(insightsUrl)

        if (!insightsRes.ok) {
            const errText = await insightsRes.text()
            console.error('Meta ad insights API error:', errText)
            return NextResponse.json({ error: `Meta API error: ${insightsRes.status}` }, { status: 500 })
        }

        const insightsData = await insightsRes.json()

        // 2. Get ad status (active/paused) - need separate call
        const adsUrl = `https://graph.facebook.com/${META_API_VERSION}/${adAccount}/ads?` +
            `fields=id,name,status,effective_status,creative{id,name,thumbnail_url},campaign_id,adset_id` +
            `&limit=500&access_token=${access_token}` +
            (campaignId ? `&filtering=[{"field":"campaign.id","operator":"EQUAL","value":"${campaignId}"}]` : '')

        const adsRes = await fetch(adsUrl)
        const adsData = adsRes.ok ? await adsRes.json() : { data: [] }

        // Build ad status map
        const adStatusMap: Record<string, any> = {}
        for (const ad of (adsData.data || [])) {
            adStatusMap[ad.id] = {
                status: ad.status,
                effective_status: ad.effective_status,
                thumbnail_url: ad.creative?.thumbnail_url || null,
            }
        }

        // 3. Build combined ad data
        const ads = (insightsData.data || []).map((insight: any) => {
            const leadsCount = insight.actions?.find((a: any) => a.action_type === 'lead')?.value || 0
            const cplValue = insight.cost_per_action_type?.find((a: any) => a.action_type === 'lead')?.value || 0
            const spendNum = parseFloat(insight.spend || '0')
            const linkClicks = insight.outbound_clicks?.find((a: any) => a.action_type === 'outbound_click')?.value || 0
            const adInfo = adStatusMap[insight.ad_id] || {}

            return {
                ad_id: insight.ad_id,
                ad_name: insight.ad_name,
                campaign_id: insight.campaign_id,
                campaign_name: insight.campaign_name,
                adset_id: insight.adset_id,
                adset_name: insight.adset_name,
                status: adInfo.effective_status || 'UNKNOWN',
                thumbnail_url: adInfo.thumbnail_url,
                spend: spendNum,
                impressions: parseInt(insight.impressions || '0'),
                clicks: parseInt(insight.clicks || '0'),
                link_clicks: parseInt(insight.inline_link_clicks || linkClicks || '0'),
                link_ctr: parseFloat(insight.inline_link_click_ctr || '0'),
                cpc_link: parseFloat(insight.cost_per_inline_link_click || '0'),
                ctr: parseFloat(insight.ctr || '0'),
                cpc: parseFloat(insight.cpc || '0'),
                frequency: parseFloat(insight.frequency || '0'),
                leads_count: parseInt(leadsCount),
                cpl: parseFloat(cplValue),
            }
        })

        // Sort: ACTIVE first, then by spend desc
        ads.sort((a: any, b: any) => {
            if (a.status === 'ACTIVE' && b.status !== 'ACTIVE') return -1
            if (a.status !== 'ACTIVE' && b.status === 'ACTIVE') return 1
            return b.spend - a.spend
        })

        // 4. Get campaign daily budgets for scaling context
        const campaignIds = [...new Set(ads.map((a: any) => a.campaign_id))]
        const campaignBudgets: Record<string, number> = {}
        for (const cId of campaignIds) {
            try {
                const cRes = await fetch(`https://graph.facebook.com/${META_API_VERSION}/${cId}?fields=daily_budget,lifetime_budget,status&access_token=${access_token}`)
                if (cRes.ok) {
                    const cData = await cRes.json()
                    campaignBudgets[cId as string] = parseFloat(cData.daily_budget || '0') / 100
                }
            } catch { }
        }

        return NextResponse.json({
            success: true,
            ads,
            campaign_budgets: campaignBudgets,
            total_ads: ads.length,
            active_ads: ads.filter((a: any) => a.status === 'ACTIVE').length,
            period: { since, until },
            fetched_at: new Date().toISOString(),
        })
    } catch (err: any) {
        console.error('Meta ad insights error:', err)
        return NextResponse.json({ error: err.message || 'Failed' }, { status: 500 })
    }
}
