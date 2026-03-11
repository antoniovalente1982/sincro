import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: member } = await supabase
        .from('organization_members')
        .select('organization_id')
        .eq('user_id', user.id)
        .single()
    if (!member) return NextResponse.json({ error: 'No org' }, { status: 403 })

    const orgId = member.organization_id

    const [leaksRes, reallocsRes, clustersRes] = await Promise.all([
        supabase
            .from('revenue_leaks')
            .select('*')
            .eq('organization_id', orgId)
            .eq('is_resolved', false)
            .order('estimated_lost_revenue', { ascending: false })
            .limit(20),
        supabase
            .from('budget_reallocations')
            .select('*')
            .eq('organization_id', orgId)
            .order('created_at', { ascending: false })
            .limit(20),
        supabase
            .from('audience_dna_clusters')
            .select('*')
            .eq('organization_id', orgId)
            .order('cluster_rank')
            .limit(5),
    ])

    const leaks = leaksRes.data || []
    const totalLostRevenue = leaks.reduce((s: number, l: any) => s + (Number(l.estimated_lost_revenue) || 0), 0)
    const criticalLeaks = leaks.filter((l: any) => l.severity === 'critical').length

    return NextResponse.json({
        leaks,
        reallocations: reallocsRes.data || [],
        clusters: clustersRes.data || [],
        summary: {
            total_leaks: leaks.length,
            total_lost_revenue: totalLostRevenue,
            critical_leaks: criticalLeaks,
            total_reallocations: (reallocsRes.data || []).length,
            clusters_count: (clustersRes.data || []).length,
        },
    })
}
