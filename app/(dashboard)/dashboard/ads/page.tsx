import { createClient } from '@/lib/supabase/server'
import AdsPanel from './AdsPanel'

export default async function AdsPage() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    const { data: member } = await supabase
        .from('organization_members')
        .select('organization_id')
        .eq('user_id', user?.id || '')
        .single()

    const orgId = member?.organization_id || ''

    const [campaignsRes, rulesRes, connectionRes] = await Promise.all([
        supabase
            .from('campaigns_cache')
            .select('*')
            .eq('organization_id', orgId)
            .order('synced_at', { ascending: false }),
        supabase
            .from('automated_rules')
            .select('*')
            .eq('organization_id', orgId)
            .order('created_at', { ascending: false }),
        supabase
            .from('connections')
            .select('id, provider, status')
            .eq('organization_id', orgId)
            .in('provider', ['meta_ads', 'meta_capi']),
    ])

    return (
        <AdsPanel
            campaigns={campaignsRes.data || []}
            rules={rulesRes.data || []}
            connections={connectionRes.data || []}
        />
    )
}
