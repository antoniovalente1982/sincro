import { createClient } from '@/lib/supabase/server'
import CRMBoard from './CRMBoard'

export default async function CRMPage() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    const { data: member } = await supabase
        .from('organization_members')
        .select('organization_id, role, department')
        .eq('user_id', user?.id || '')
        .is('deactivated_at', null)
        .single()

    const orgId = member?.organization_id || ''
    const userId = user?.id || ''

    const [pipelinesRes, stagesRes, leadsRes, membersRes, funnelsRes, sourcesRes, tagsRes] = await Promise.all([
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
            .select('*, funnels!leads_funnel_id_fkey(id, name, objective), lead_tags(crm_tags(id, name, color))')
            .eq('organization_id', orgId)
            .order('created_at', { ascending: false }),
        supabase
            .from('organization_members')
            .select('user_id, role, department, deactivated_at')
            .eq('organization_id', orgId)
            .is('deactivated_at', null),
        supabase
            .from('funnels')
            .select('id, name, objective')
            .eq('organization_id', orgId)
            .order('name'),
        supabase
            .from('traffic_sources')
            .select('*')
            .eq('organization_id', orgId),
        supabase
            .from('crm_tags')
            .select('*')
            .eq('organization_id', orgId)
            .order('name'),
    ])

    const membersData = membersRes.data || []
    
    // Fetch profiles manually to bypass missing FK
    let profilesData: any[] = []
    if (membersData.length > 0) {
        const { data } = await supabase.from('profiles').select('id, full_name, email').in('id', membersData.map((m: any) => m.user_id).filter(Boolean))
        profilesData = data || []
    }
    const profilesMap = new Map(profilesData.map(p => [p.id, p]))

    const members = membersData.map((m: any) => ({
        ...m,
        profiles: profilesMap.get(m.user_id) || null,
    }))

    // Extract unique objectives from funnels
    const objectives = [...new Set((funnelsRes.data || []).map((f: any) => f.objective).filter(Boolean))]

    // Extract unique campaigns for Auto-Complete Datalist
    const activeCampaigns = [...new Set((leadsRes.data || []).map((l: any) => l.utm_campaign).filter(Boolean))]

    return (
        <CRMBoard
            pipelines={pipelinesRes.data || []}
            stages={stagesRes.data || []}
            initialLeads={leadsRes.data || []}
            members={members}
            userRole={member?.role || 'viewer'}
            userDepartment={member?.department || null}
            userId={userId}
            objectives={objectives}
            activeCampaigns={activeCampaigns as string[]}
            trafficSources={sourcesRes?.data || []}
            globalTags={tagsRes?.data || []}
        />
    )
}
