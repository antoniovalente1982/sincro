import { createClient } from '@/lib/supabase/server'
import CreativeStudio from './CreativeStudio'

export default async function CreativeStudioPage() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    const { data: member } = await supabase
        .from('organization_members')
        .select('organization_id')
        .eq('user_id', user?.id || '')
        .single()

    const orgId = member?.organization_id || ''

    const [briefsRes, campaignsRes] = await Promise.all([
        supabase
            .from('ai_creative_briefs')
            .select('*')
            .eq('organization_id', orgId)
            .order('created_at', { ascending: false })
            .limit(20),
        supabase
            .from('campaigns_cache')
            .select('id, campaign_name, status')
            .eq('organization_id', orgId),
    ])

    return (
        <CreativeStudio
            briefs={briefsRes.data || []}
            campaigns={campaignsRes.data || []}
        />
    )
}
