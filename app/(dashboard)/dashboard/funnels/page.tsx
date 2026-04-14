import { createClient } from '@/lib/supabase/server'
import FunnelsPanel from './FunnelsPanel'

export default async function FunnelsPage() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    const { data: member } = await supabase
        .from('organization_members')
        .select('organization_id')
        .eq('user_id', user?.id || '')
        .single()

    const orgId = member?.organization_id || ''

    const [funnelsRes, pipelinesRes] = await Promise.all([
        supabase
            .from('funnels')
            .select('*')
            .eq('organization_id', orgId)
            .order('created_at', { ascending: false }),
        supabase
            .from('pipelines')
            .select('id, name, is_default')
            .eq('organization_id', orgId)
            .order('is_default', { ascending: false }),
    ])

    return (
        <FunnelsPanel
            initialFunnels={funnelsRes.data || []}
            pipelines={pipelinesRes.data || []}
        />
    )
}

