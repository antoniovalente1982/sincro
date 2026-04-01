import { createClient } from '@/lib/supabase/server'
import SettingsPanel from './SettingsPanel'

export default async function SettingsPage() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    const { data: member } = await supabase
        .from('organization_members')
        .select('organization_id, role')
        .eq('user_id', user?.id || '')
        .single()

    const orgId = member?.organization_id || ''

    const [orgRes, stagesRes, profileRes, pipelinesRes, sourcesRes] = await Promise.all([
        supabase.from('organizations').select('*').eq('id', orgId).single(),
        supabase.from('pipeline_stages').select('*').eq('organization_id', orgId).order('sort_order'),
        supabase.from('profiles').select('*').eq('id', user?.id || '').single(),
        supabase.from('pipelines').select('*').eq('organization_id', orgId).order('sort_order'),
        supabase.from('traffic_sources').select('*').eq('organization_id', orgId).order('name'),
    ])

    return (
        <SettingsPanel
            organization={orgRes.data}
            stages={stagesRes.data || []}
            pipelines={pipelinesRes.data || []}
            trafficSources={sourcesRes.data || []}
            profile={profileRes.data}
            userRole={member?.role || 'viewer'}
            userEmail={user?.email || ''}
        />
    )
}
