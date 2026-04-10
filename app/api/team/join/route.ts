import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * POST /api/team/join
 * 
 * Called when an invited user completes onboarding (sets password).
 * Updates `joined_at` in organization_members so the user is recognized
 * as an active member of the organization they were invited to.
 * 
 * Also cleans up any auto-created duplicate organizations from the
 * handle_new_user trigger.
 */
export async function POST() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 1. Find any pending invite (joined_at IS NULL)
    const { data: pendingInvite } = await supabase
        .from('organization_members')
        .select('id, organization_id, role')
        .eq('user_id', user.id)
        .is('joined_at', null)
        .is('deactivated_at', null)
        .single()

    if (!pendingInvite) {
        // No pending invite — check if user already has an active membership
        const { data: activeMember } = await supabase
            .from('organization_members')
            .select('id, organization_id, role')
            .eq('user_id', user.id)
            .not('joined_at', 'is', null)
            .is('deactivated_at', null)
            .single()

        if (activeMember) {
            return NextResponse.json({ 
                success: true, 
                message: 'Already joined',
                organization_id: activeMember.organization_id 
            })
        }

        return NextResponse.json({ error: 'No pending invite found' }, { status: 404 })
    }

    // 2. Update joined_at to mark the invite as accepted
    const { error: updateError } = await supabase
        .from('organization_members')
        .update({ joined_at: new Date().toISOString() })
        .eq('id', pendingInvite.id)

    if (updateError) {
        console.error('[TEAM JOIN] Update error:', updateError.message)
        return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    // 3. Clean up: Delete any auto-created org_members where the user is "owner"
    //    of a different organization (created by handle_new_user trigger)
    const { data: autoCreated } = await supabase
        .from('organization_members')
        .select('id, organization_id')
        .eq('user_id', user.id)
        .eq('role', 'owner')
        .neq('organization_id', pendingInvite.organization_id)

    if (autoCreated && autoCreated.length > 0) {
        for (const ac of autoCreated) {
            // Delete the auto-created membership
            await supabase
                .from('organization_members')
                .delete()
                .eq('id', ac.id)

            // Delete the auto-created organization (only if empty)
            const { count } = await supabase
                .from('organization_members')
                .select('id', { count: 'exact', head: true })
                .eq('organization_id', ac.organization_id)

            if (count === 0) {
                await supabase
                    .from('organizations')
                    .delete()
                    .eq('id', ac.organization_id)
            }
        }
    }

    console.log(`[TEAM JOIN] User ${user.email} joined org ${pendingInvite.organization_id} as ${pendingInvite.role}`)

    return NextResponse.json({
        success: true,
        organization_id: pendingInvite.organization_id,
        role: pendingInvite.role,
    })
}
