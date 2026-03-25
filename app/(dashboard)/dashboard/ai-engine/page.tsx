import { createClient } from '@/lib/supabase/server'
import AICommandCenter from './AICommandCenter'

export default async function AIEnginePage() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    const { data: member } = await supabase
        .from('organization_members')
        .select('organization_id')
        .eq('user_id', user?.id || '')
        .single()

    const orgId = member?.organization_id || ''

    const [campaignsRes, recommendationsRes, briefsRes, snapshotsRes, connectionsRes, agentConfigRes, budgetRes, episodesRes, knowledgeRes, workingMemRes, targetsRes] = await Promise.all([
        supabase
            .from('campaigns_cache')
            .select('*')
            .eq('organization_id', orgId)
            .order('synced_at', { ascending: false }),
        supabase
            .from('ai_ad_recommendations')
            .select('*')
            .eq('organization_id', orgId)
            .order('created_at', { ascending: false })
            .limit(20),
        supabase
            .from('ai_creative_briefs')
            .select('*')
            .eq('organization_id', orgId)
            .order('created_at', { ascending: false })
            .limit(10),
        supabase
            .from('ai_performance_snapshots')
            .select('*')
            .eq('organization_id', orgId)
            .order('snapshot_date', { ascending: false })
            .limit(30),
        supabase
            .from('connections')
            .select('id, provider, status')
            .eq('organization_id', orgId),
        supabase
            .from('ai_agent_config')
            .select('*')
            .eq('organization_id', orgId)
            .single(),
        supabase
            .from('ai_budget_tracking')
            .select('*')
            .eq('organization_id', orgId)
            .order('updated_at', { ascending: false })
            .limit(6),
        // Memory data
        supabase
            .from('ai_episodes')
            .select('*')
            .eq('organization_id', orgId)
            .order('created_at', { ascending: false })
            .limit(30),
        supabase
            .from('ai_knowledge_base')
            .select('*')
            .eq('organization_id', orgId)
            .eq('is_active', true)
            .order('confidence', { ascending: false })
            .limit(20),
        supabase
            .from('ai_working_memory')
            .select('*')
            .eq('organization_id', orgId)
            .single(),
        supabase
            .from('ad_optimization_targets')
            .select('*')
            .eq('organization_id', orgId)
            .single(),
    ])

    return (
        <AICommandCenter
            campaigns={campaignsRes.data || []}
            recommendations={recommendationsRes.data || []}
            briefs={briefsRes.data || []}
            snapshots={snapshotsRes.data || []}
            connections={connectionsRes.data || []}
            orgId={orgId}
            agentConfig={agentConfigRes.data || null}
            budgetTracking={budgetRes.data || []}
            episodes={episodesRes.data || []}
            knowledge={knowledgeRes.data || []}
            workingMemory={workingMemRes.data || null}
            targets={targetsRes.data || null}
        />
    )
}

