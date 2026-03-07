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

    // Get counts
    const [leadsRes, funnelsRes, connectionsRes, stagesRes] = await Promise.all([
        supabase.from('leads').select('id', { count: 'exact', head: true }).eq('organization_id', orgId),
        supabase.from('funnels').select('id', { count: 'exact', head: true }).eq('organization_id', orgId),
        supabase.from('connections').select('id', { count: 'exact', head: true }).eq('organization_id', orgId),
        supabase.from('pipeline_stages').select('*').eq('organization_id', orgId).order('sort_order'),
    ])

    return (
        <DashboardOverview
            userName={userName}
            orgName={orgName}
            leadCount={leadsRes.count || 0}
            funnelCount={funnelsRes.count || 0}
            connectionCount={connectionsRes.count || 0}
            stages={stagesRes.data || []}
        />
    )
}
