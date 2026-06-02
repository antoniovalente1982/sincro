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

        // 2. Get all active members eligible for round robin
        // We order by joined_at to have a deterministic sequence
        const { data: members, error: membersError } = await supabase
            .from('organization_members')
            .select('user_id')
            .eq('organization_id', orgId)
            .is('deactivated_at', null)
            .eq('in_round_robin', true)
            .order('joined_at', { ascending: true })

        if (membersError || !members || members.length === 0) {
            console.log('[Lead Routing] No eligible members found for round robin')
            return null
        }

        // 3. Determine the next user
        let nextMember = members[0]
        
        if (lastAssignedUserId) {
            const lastIndex = members.findIndex(m => m.user_id === lastAssignedUserId)
            if (lastIndex !== -1 && lastIndex < members.length - 1) {
                nextMember = members[lastIndex + 1]
            }
        }

        // 4. Update the organization settings with the new last_assigned_user_id
        const newSettings = {
            ...settings,
            last_assigned_user_id: nextMember.user_id
        }

        const { error: updateError } = await supabase
            .from('organizations')
            .update({ settings: newSettings })
            .eq('id', orgId)

        if (updateError) {
            console.error('[Lead Routing] Error updating organization settings:', updateError)
            // Even if update fails, we can still return the next member to ensure assignment happens
        }

        console.log(`[Lead Routing] Assigned lead to user ${nextMember.user_id}`)
        return nextMember.user_id

    } catch (err) {
        console.error('[Lead Routing] Unexpected error:', err)
        return null
    }
}
