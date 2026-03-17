import { createClient } from '@/lib/supabase/server'
import CRMBoard from './CRMBoard'

export default async function CRMPage() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    const { data: member } = await supabase
        .from('organization_members')
        .select('organization_id, role')
        .eq('user_id', user?.id || '')
        .single()

    const orgId = member?.organization_id || ''

    const [pipelinesRes, stagesRes, leadsRes, membersRes, funnelsRes] = await Promise.all([
        supabase
            .from('pipelines')
            .select('*')
            .eq('organization_id', orgId)
            .order('sort_order'),
        supabase
            .from('pipeline_stages')
            .select('*, pipelines!pipeline_stages_pipeline_id_fkey(id, name, source_type)')
            .eq('organization_id', orgId)
            .order('sort_order'),
        supabase
            .from('leads')
            .select('*, funnels!leads_funnel_id_fkey(id, name, objective)')
            .eq('organization_id', orgId)
            .order('created_at', { ascending: false }),
        supabase
            .from('organization_members')
            .select('user_id, role, profiles:user_id (full_name, email)')
            .eq('organization_id', orgId),
        supabase
            .from('funnels')
            .select('id, name, objective')
            .eq('organization_id', orgId)
            .order('name'),
    ])

    // Flatten profiles from array to single object
    const members = (membersRes.data || []).map((m: any) => ({
        ...m,
        profiles: Array.isArray(m.profiles) ? m.profiles[0] || null : m.profiles,
    }))

    // Extract unique objectives from funnels
    const objectives = [...new Set((funnelsRes.data || []).map((f: any) => f.objective).filter(Boolean))]

    return (
        <CRMBoard
            pipelines={pipelinesRes.data || []}
            stages={stagesRes.data || []}
            initialLeads={leadsRes.data || []}
            members={members}
            userRole={member?.role || 'viewer'}
            objectives={objectives}
        />
    )
}
