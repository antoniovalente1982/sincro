import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: member } = await supabase
        .from('organization_members')
        .select('organization_id, role')
        .eq('user_id', user.id)
        .single()
    if (!member) return NextResponse.json({ error: 'No org' }, { status: 403 })

    const orgId = member.organization_id
    const type = req.nextUrl.searchParams.get('type') || 'all'

    if (type === 'campaign_roi') {
        // Get campaign-level ROI
        const { data } = await supabase.rpc('get_campaign_roi', { p_org_id: orgId })
        return NextResponse.json({ data })
    }

    if (type === 'predictions') {
        const { data } = await supabase
            .from('revenue_predictions')
            .select('*')
            .eq('organization_id', orgId)
            .order('prediction_date', { ascending: false })
            .limit(30)
        return NextResponse.json({ data })
    }

    if (type === 'global_intel') {
        const { data } = await supabase
            .from('global_intelligence')
            .select('*')
            .eq('is_active', true)
            .order('confidence', { ascending: false })
            .limit(20)
        return NextResponse.json({ data })
    }

    // Default: all attribution data
    const [attributionsRes, predictionsRes, globalIntelRes, campaignRoiRes] = await Promise.all([
        supabase
            .from('revenue_attribution')
            .select('*')
            .eq('organization_id', orgId)
            .order('deal_closed_at', { ascending: false })
            .limit(50),
        supabase
            .from('revenue_predictions')
            .select('*')
            .eq('organization_id', orgId)
            .order('prediction_date', { ascending: false })
            .limit(7),
        supabase
            .from('global_intelligence')
            .select('*')
            .eq('is_active', true)
            .order('confidence', { ascending: false })
            .limit(10),
        supabase.rpc('get_campaign_roi', { p_org_id: orgId }),
    ])

    // Aggregate metrics
    const attributions = attributionsRes.data || []
    const totalRevenue = attributions.reduce((s: number, a: any) => s + (Number(a.deal_value) || 0), 0)
    const totalSpend = attributions.reduce((s: number, a: any) => s + (Number(a.attributed_spend) || 0), 0)
    const avgDaysToClose = attributions.length > 0
        ? attributions.reduce((s: number, a: any) => s + (Number(a.days_to_close) || 0), 0) / attributions.length
        : 0

    return NextResponse.json({
        attributions,
        predictions: predictionsRes.data || [],
        global_intelligence: globalIntelRes.data || [],
        campaign_roi: campaignRoiRes.data || [],
        summary: {
            total_revenue: totalRevenue,
            total_spend: totalSpend,
            overall_roi: totalSpend > 0 ? ((totalRevenue - totalSpend) / totalSpend * 100) : 0,
            overall_roas: totalSpend > 0 ? totalRevenue / totalSpend : 0,
            deals_closed: attributions.length,
            avg_days_to_close: avgDaysToClose,
        },
    })
}
