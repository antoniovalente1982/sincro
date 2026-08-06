import { SupabaseClient } from '@supabase/supabase-js'

/**
 * Assigns a lead to the next available team member using Round Robin or Weighted logic.
 *
 * If `pipelineId` is provided and the pipeline has a `settings.seller_pool` configured,
 * the routing will use only those members (per-pipeline pool).
 * If no pipeline-specific pool is set, falls back to the global round robin
 * (members with `in_round_robin = true` in organization_members).
 *
 * @param orgId       The organization ID
 * @param supabase    An initialized Supabase client (service role or authenticated)
 * @param pipelineId  Optional pipeline ID — enables per-pipeline seller pool
 * @returns The user_id of the assigned member, or null if no one is available
 */
export async function assignLeadRoundRobin(
    orgId: string,
    supabase: SupabaseClient,
    pipelineId?: string | null,
): Promise<string | null> {
    try {
        // 1. Get organization settings (global routing config)
        const { data: org, error: orgError } = await supabase
            .from('organizations')
            .select('settings')
            .eq('id', orgId)
            .single()

        if (orgError) {
            console.error('[Lead Routing] Error fetching organization:', orgError)
            return null
        }

        const orgSettings = org?.settings || {}

        // If auto-routing is explicitly disabled at org level, skip
        if (orgSettings.lead_routing_enabled === false) {
            return null
        }

        // 2. Check for per-pipeline pool
        let pipelineSettings: Record<string, any> | null = null
        if (pipelineId) {
            const { data: pipeline } = await supabase
                .from('pipelines')
                .select('settings')
                .eq('id', pipelineId)
                .single()
            pipelineSettings = pipeline?.settings || null
        }

        const pipelinePool: string[] | null =
            (pipelineSettings?.seller_pool?.length ?? 0) > 0 ? pipelineSettings!.seller_pool! : null

        // 3. Build the eligible members list
        let eligibleUserIds: string[] | null = null

        if (pipelinePool) {
            // Per-pipeline mode: use the explicitly configured pool
            eligibleUserIds = pipelinePool
            console.log(`[Lead Routing] Using per-pipeline pool (${pipelinePool.length} members) for pipeline ${pipelineId}`)
        } else {
            // Global mode: all members with in_round_robin = true
            const { data: members, error: membersError } = await supabase
                .from('organization_members')
                .select('user_id')
                .eq('organization_id', orgId)
                .is('deactivated_at', null)
                .eq('in_round_robin', true)
                .order('joined_at', { ascending: true })

            if (membersError || !members || members.length === 0) {
                console.log('[Lead Routing] No eligible members found for routing')
                return null
            }
            eligibleUserIds = members.map(m => m.user_id)
            console.log(`[Lead Routing] Using global pool (${eligibleUserIds.length} members)`)
        }

        if (!eligibleUserIds || eligibleUserIds.length === 0) return null

        // 4. Determine routing method and last assigned
        // Per-pipeline settings override org-level settings
        const routingMethod =
            pipelineSettings?.routing_method ||
            orgSettings.lead_routing_method ||
            'round_robin'

        const lastAssignedUserId =
            pipelinePool
                ? pipelineSettings?.last_assigned_user_id || null
                : orgSettings.last_assigned_user_id || null

        const routingWeights =
            pipelinePool
                ? pipelineSettings?.routing_weights || {}
                : orgSettings.lead_routing_weights || {}

        // 5. Assign
        let nextUserId: string | null = null

        // --- METHOD 1: WEIGHTED ---
        if (routingMethod === 'weighted') {
            let totalWeight = 0
            const memberWeights = eligibleUserIds.map(uid => {
                const w = parseInt(routingWeights[uid] ?? '100') || 0
                totalWeight += w
                return { user_id: uid, weight: w }
            }).filter(m => m.weight > 0)

            if (memberWeights.length > 0) {
                let random = Math.random() * totalWeight
                for (const mw of memberWeights) {
                    random -= mw.weight
                    if (random <= 0) {
                        nextUserId = mw.user_id
                        break
                    }
                }
                console.log(`[Lead Routing] Assigned to ${nextUserId} via Weighted`)
            }
        }

        // --- METHOD 2: ROUND ROBIN (or fallback) ---
        if (routingMethod === 'round_robin' || nextUserId === null) {
            if (lastAssignedUserId) {
                const lastIndex = eligibleUserIds.indexOf(lastAssignedUserId)
                if (lastIndex !== -1 && lastIndex < eligibleUserIds.length - 1) {
                    nextUserId = eligibleUserIds[lastIndex + 1]
                } else {
                    nextUserId = eligibleUserIds[0]
                }
            } else {
                nextUserId = eligibleUserIds[0]
            }
            console.log(`[Lead Routing] Assigned to ${nextUserId} via Round Robin`)
        }

        if (!nextUserId) return null

        // 6. Persist last_assigned_user_id — in pipeline settings if per-pipeline, else in org settings
        if (pipelinePool && pipelineId) {
            const newPipelineSettings = {
                ...pipelineSettings,
                last_assigned_user_id: nextUserId,
            }
            await supabase
                .from('pipelines')
                .update({ settings: newPipelineSettings })
                .eq('id', pipelineId)
        } else {
            const newOrgSettings = {
                ...orgSettings,
                last_assigned_user_id: nextUserId,
            }
            await supabase
                .from('organizations')
                .update({ settings: newOrgSettings })
                .eq('id', orgId)
        }

        return nextUserId

    } catch (err) {
        console.error('[Lead Routing] Unexpected error:', err)
        return null
    }
}
