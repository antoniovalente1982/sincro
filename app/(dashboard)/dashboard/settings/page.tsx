import { createClient } from '@/lib/supabase/server'
import SettingsPanel from './SettingsPanel'

export default async function SettingsPage() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    const { data: member } = await supabase
        .from('organization_members')
        .select('organization_id, role, google_access_token')
        .eq('user_id', user?.id || '')
        .single()

    const { createClient: createAdminClient } = await import('@supabase/supabase-js')
    const supabaseAdmin = createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
    const { data: freshUser } = await supabaseAdmin.auth.admin.getUserById(user?.id || '')
    const freshUserMetadata = freshUser?.user?.user_metadata || {}

    const orgId = member?.organization_id || ''

    const [orgRes, stagesRes, profileRes, pipelinesRes, sourcesRes, tagsRes] = await Promise.all([
        supabase.from('organizations').select('*').eq('id', orgId).single(),
        supabase.from('pipeline_stages').select('*').eq('organization_id', orgId).order('sort_order'),
        supabase.from('profiles').select('*').eq('id', user?.id || '').single(),
        supabase.from('pipelines').select('*').eq('organization_id', orgId).order('sort_order'),
        supabase.from('traffic_sources').select('*').eq('organization_id', orgId).order('name'),
        supabase.from('crm_tags').select('*').eq('organization_id', orgId).order('name'),
    ])

    return (
        <SettingsPanel
            organization={orgRes.data}
            stages={stagesRes.data || []}
            pipelines={pipelinesRes.data || []}
            trafficSources={sourcesRes.data || []}
            crmTags={tagsRes.data || []}
            profile={{ ...(profileRes.data || {}), phone: freshUserMetadata?.phone || profileRes.data?.phone || '' }}
            userRole={member?.role || 'viewer'}
            userEmail={user?.email || ''}
            isGoogleConnected={!!member?.google_access_token}
        />
    )
}
