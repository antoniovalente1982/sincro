import { SupabaseClient } from '@supabase/supabase-js'

/**
 * Assigns a lead to the next available team member using Round Robin logic.
 * 
 * @param orgId The organization ID
 * @param supabase An initialized Supabase client (service role or authenticated)
 * @returns The user_id of the assigned member, or null if no one is available or routing is disabled
 */
export async function assignLeadRoundRobin(orgId: string, supabase: SupabaseClient): Promise<string | null> {
    try {
        // 1. Get organization settings to check if routing is enabled and find the last assigned user
        const { data: org, error: orgError } = await supabase
            .from('organizations')
            .select('settings')
            .eq('id', orgId)
            .single()

        if (orgError) {
            console.error('[Lead Routing] Error fetching organization:', orgError)
            return null
        }

        const settings = org?.settings || {}
        
        // If auto-routing is explicitly disabled, skip
        if (settings.lead_routing_enabled === false) {
            return null
        }

        const lastAssignedUserId = settings.last_assigned_user_id
        const routingMethod = settings.lead_routing_method || 'round_robin'

        // 2. Get all active members eligible for routing
        // We order by joined_at to have a deterministic sequence for round robin
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

        let nextUserId: string | null = null

        // --- METHOD 1: WEIGHTED (PERCENTAGE) ---
        if (routingMethod === 'weighted') {
            const weights = settings.lead_routing_weights || {}
            let totalWeight = 0
            
            // Map weights and calculate total
            const memberWeights = members.map(m => {
                const w = parseInt(weights[m.user_id] ?? '100') || 0
                totalWeight += w
                return { ...m, weight: w }
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
                console.log(`[Lead Routing] Assigned lead to user ${nextUserId} via Weighted method`)
            } else {
                // Fallback to round robin if all weights are 0
                console.log(`[Lead Routing] All weights 0, falling back to Round Robin`)
            }
        }

        // --- METHOD 2: ROUND ROBIN (or fallback if weighted failed) ---
        if (routingMethod === 'round_robin' || nextUserId === null) {
            if (lastAssignedUserId) {
                const lastIndex = members.findIndex(m => m.user_id === lastAssignedUserId)
                if (lastIndex !== -1 && lastIndex < members.length - 1) {
                    nextUserId = members[lastIndex + 1].user_id
                } else {
                    nextUserId = members[0].user_id
                }
            } else {
                nextUserId = members[0].user_id
            }
            console.log(`[Lead Routing] Assigned lead to user ${nextUserId} via Round Robin`)
        }

        // 4. Update the organization settings with the new last_assigned_user_id (useful for both methods)
        const newSettings = {
            ...settings,
            last_assigned_user_id: nextUserId
        }

        const { error: updateError } = await supabase
            .from('organizations')
            .update({ settings: newSettings })
            .eq('id', orgId)

        if (updateError) {
            console.error('[Lead Routing] Error updating organization settings:', updateError)
        }

        return nextUserId

    } catch (err) {
        console.error('[Lead Routing] Unexpected error:', err)
        return null
    }
}
