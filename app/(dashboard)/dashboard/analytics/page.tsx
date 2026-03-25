import { createClient } from '@/lib/supabase/server'
import AnalyticsDashboard from './AnalyticsDashboard'

export default async function AnalyticsPage() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    const { data: member } = await supabase
        .from('organization_members')
        .select('organization_id')
        .eq('user_id', user?.id || '')
        .single()

    const orgId = member?.organization_id || ''

    const [pipelinesRes, stagesRes, leadsRes, activitiesRes, attributionsRes, predictionsRes, globalIntelRes, leaksRes, reallocsRes, clustersRes, funnelsRes] = await Promise.all([
        supabase.from('pipelines').select('id, name, is_default').eq('organization_id', orgId).order('is_default', { ascending: false }),
        supabase.from('pipeline_stages').select('*, pipelines!inner(id, name)').eq('organization_id', orgId).order('sort_order'),
        supabase.from('leads').select('*, pipeline_stages(name, slug, color, is_won, is_lost, pipeline_id), funnels!leads_funnel_id_fkey(id, name, objective)').eq('organization_id', orgId),
        supabase.from('lead_activities').select('*').eq('organization_id', orgId).order('created_at', { ascending: false }).limit(200),
        supabase.from('campaigns_cache').select('*').eq('organization_id', orgId).order('spend', { ascending: false }).limit(50),
        supabase.from('revenue_predictions').select('*').eq('organization_id', orgId).order('prediction_date', { ascending: false }).limit(7),
        supabase.from('global_intelligence').select('*').eq('is_active', true).order('confidence', { ascending: false }).limit(10),
        supabase.from('revenue_leaks').select('*').eq('organization_id', orgId).eq('is_resolved', false).order('estimated_lost_revenue', { ascending: false }).limit(15),
        supabase.from('budget_reallocations').select('*').eq('organization_id', orgId).order('created_at', { ascending: false }).limit(10),
        supabase.from('audience_dna_clusters').select('*').eq('organization_id', orgId).order('cluster_rank').limit(5),
        supabase.from('funnels').select('id, name, objective').eq('organization_id', orgId).order('name'),
    ])

    const objectives = [...new Set((funnelsRes.data || []).map((f: any) => f.objective).filter(Boolean))]

    return (
        <AnalyticsDashboard
            pipelines={pipelinesRes.data || []}
            stages={stagesRes.data || []}
            leads={leadsRes.data || []}
            activities={activitiesRes.data || []}
            attributions={attributionsRes.data || []}
            predictions={predictionsRes.data || []}
            globalIntel={globalIntelRes.data || []}
            leaks={leaksRes.data || []}
            reallocations={reallocsRes.data || []}
            dnaClusters={clustersRes.data || []}
            objectives={objectives}
        />
    )
}

