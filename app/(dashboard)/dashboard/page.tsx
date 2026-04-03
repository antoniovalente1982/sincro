import { createClient } from '@/lib/supabase/server'
import DashboardOverview from './DashboardOverview'

export default async function DashboardPage() {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()

    // Get org
    const { data: member } = await supabase
        .from('organization_members')
        .select('organization_id, role, organizations(name)')
        .eq('user_id', user?.id || '')
        .single()

    const orgId = member?.organization_id || ''
    const orgName = (member?.organizations as any)?.name || ''
    const userName = user?.user_metadata?.full_name || user?.email || ''

    // Get default pipeline
    const { data: defaultPipeline } = await supabase
        .from('pipelines')
        .select('id')
        .eq('organization_id', orgId)
        .eq('is_default', true)
        .single()

    // Get data — stages filtered by default pipeline only
    const [leadsRes, funnelsRes, connectionsRes, stagesRes, activitiesRes, funnelStatsRes, pageViewsRes, northStarRes] = await Promise.all([
        supabase.from('leads').select('id, value, stage_id, created_at, updated_at, funnel_id, utm_source').eq('organization_id', orgId),
        supabase.from('funnels').select('id, name, slug, status, meta_pixel_id').eq('organization_id', orgId).eq('status', 'active').order('name'),
        supabase.from('connections').select('id', { count: 'exact', head: true }).eq('organization_id', orgId),
        defaultPipeline
            ? supabase.from('pipeline_stages').select('*').eq('organization_id', orgId).eq('pipeline_id', defaultPipeline.id).order('sort_order')
            : supabase.from('pipeline_stages').select('*').eq('organization_id', orgId).order('sort_order').limit(8),
        supabase.from('lead_activities').select('id, activity_type, notes, created_at, lead_id')
            .eq('organization_id', orgId)
            .order('created_at', { ascending: false })
            .limit(10),
        supabase.from('funnel_submissions').select('funnel_id, created_at')
            .eq('organization_id', orgId)
            .gte('created_at', new Date(Date.now() - 30 * 86400000).toISOString()),
        supabase.from('page_views').select('funnel_id, created_at')
            .eq('organization_id', orgId)
            .gte('created_at', new Date(Date.now() - 30 * 86400000).toISOString()),
        supabase.from('ai_north_star').select('*')
            .eq('organization_id', orgId)
            .order('created_at', { ascending: false })
            .limit(1)
            .single()
    ])

    // Compute per-funnel stats (last 30d)
    const funnelSubmissions = funnelStatsRes.data || []
    const funnelViews = pageViewsRes.data || []
    const funnelsList = (funnelsRes.data || []).map((f: any) => ({
        ...f,
        views30d: funnelViews.filter((v: any) => v.funnel_id === f.id).length,
        leads30d: funnelSubmissions.filter((s: any) => s.funnel_id === f.id).length,
    }))
    const funnelCount = funnelsList.length

    return (
        <DashboardOverview
            userName={userName}
            orgName={orgName}
            leadCount={leadsRes.data?.length || 0}
            funnelCount={funnelCount}
            connectionCount={connectionsRes.count || 0}
            stages={stagesRes.data || []}
            leads={leadsRes.data || []}
            recentActivities={activitiesRes.data || []}
            funnels={funnelsList}
            northStar={northStarRes?.data || null}
        />
    )
}
