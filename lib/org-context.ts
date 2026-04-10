import { SupabaseClient } from '@supabase/supabase-js'

/**
 * Gets the organization context for the current user.
 * Handles edge cases where auto-provisioning triggers create duplicate memberships.
 * 
 * Priority: invited membership > auto-created owner membership
 * 
 * @returns { organization_id, role, department } or null if no membership found
 */
export async function getOrgContext(supabase: SupabaseClient) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null

    const { data: members } = await supabase
        .from('organization_members')
        .select('organization_id, role, department')
        .eq('user_id', user.id)
        .is('deactivated_at', null)
        .order('joined_at', { ascending: true, nullsFirst: false })

    if (!members || members.length === 0) return null

    // If multiple memberships exist, prefer the invited one (non-owner role)
    // over auto-created owner memberships from the handle_new_user trigger
    if (members.length > 1) {
        const invited = members.find(m => m.role !== 'owner')
        if (invited) return { ...invited, user_id: user.id }
    }

    return { ...members[0], user_id: user.id }
}

/**
 * Gets the organization context with the organization name included.
 */
export async function getOrgContextWithName(supabase: SupabaseClient) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null

    const { data: members } = await supabase
        .from('organization_members')
        .select('organization_id, role, department, organizations(name)')
        .eq('user_id', user.id)
        .is('deactivated_at', null)
        .order('joined_at', { ascending: true, nullsFirst: false })

    if (!members || members.length === 0) return null

    if (members.length > 1) {
        const invited = members.find(m => m.role !== 'owner')
        if (invited) return { ...invited, user_id: user.id }
    }

    return { ...members[0], user_id: user.id }
}
