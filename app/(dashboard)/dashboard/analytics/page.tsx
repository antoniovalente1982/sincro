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

    const [stagesRes, leadsRes, activitiesRes] = await Promise.all([
        supabase
            .from('pipeline_stages')
            .select('*')
            .eq('organization_id', orgId)
            .order('sort_order'),
        supabase
            .from('leads')
            .select('*, pipeline_stages(name, slug, color, is_won, is_lost)')
            .eq('organization_id', orgId),
        supabase
            .from('lead_activities')
            .select('*')
            .eq('organization_id', orgId)
            .order('created_at', { ascending: false })
            .limit(200),
    ])

    return (
        <AnalyticsDashboard
            stages={stagesRes.data || []}
            leads={leadsRes.data || []}
            activities={activitiesRes.data || []}
        />
    )
}
