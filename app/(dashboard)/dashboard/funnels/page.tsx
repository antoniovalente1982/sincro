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

    const [funnelsRes, pageViewsRes, submissionsRes, pipelinesRes] = await Promise.all([
        supabase
            .from('funnels')
            .select('*')
            .eq('organization_id', orgId)
            .order('created_at', { ascending: false }),
        supabase
            .from('page_views')
            .select('id, funnel_id, page_path, page_variant, visitor_id, ip_hash, utm_source, utm_campaign, utm_content, device_type, created_at')
            .eq('organization_id', orgId)
            .order('created_at', { ascending: false })
            .limit(10000),
        supabase
            .from('funnel_submissions')
            .select('id, funnel_id, page_variant, created_at, utm_source, utm_campaign')
            .eq('organization_id', orgId)
            .order('created_at', { ascending: false })
            .limit(5000),
        supabase
            .from('pipelines')
            .select('id, name, is_default')
            .eq('organization_id', orgId)
            .order('is_default', { ascending: false }),
    ])

    return (
        <FunnelsPanel
            initialFunnels={funnelsRes.data || []}
            pageViews={pageViewsRes.data || []}
            submissions={submissionsRes.data || []}
            pipelines={pipelinesRes.data || []}
        />
    )
}
