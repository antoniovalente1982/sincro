import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import * as fs from 'fs'

async function getOrgAndRole(supabase: any) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null
    const { data: member } = await supabase
        .from('organization_members')
        .select('organization_id, role')
        .eq('user_id', user.id)
        .is('deactivated_at', null)
        .single()
    return member ? { ...member, user_id: user.id } : null
}

export async function GET() {
    const supabase = await createClient()
    const ctx = await getOrgAndRole(supabase)
    if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data, error } = await supabase
        .from('organization_members')
        .select('*, profiles:user_id (full_name, email, avatar_url)')
        .eq('organization_id', ctx.organization_id)
        .order('joined_at', { ascending: true })

    if (error) {
        fs.appendFileSync('debug_team.log', `[${new Date().toISOString()}] SELECT ERROR: ${error.message}\n`)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    try {
        const { data: leads, error: leadErr } = await supabase
            .from('leads')
            .select('assigned_to')
            .eq('organization_id', ctx.organization_id)
            
        if (leadErr) fs.appendFileSync('debug_team.log', `[${new Date().toISOString()}] LEADS ERROR: ${leadErr.message}\n`)

        const { data: wonLeads, error: wonErr } = await supabase
            .from('leads')
            .select('assigned_to, value, pipeline_stages!inner(is_won)')
            .eq('organization_id', ctx.organization_id)
            .eq('pipeline_stages.is_won', true)

        if (wonErr) fs.appendFileSync('debug_team.log', `[${new Date().toISOString()}] WON LEADS ERROR: ${wonErr.message}\n`)

        const assignedCounts: Record<string, number> = {}
        const wonCounts: Record<string, { count: number; revenue: number }> = {}

        leads?.forEach((l: any) => {
            if (l.assigned_to) assignedCounts[l.assigned_to] = (assignedCounts[l.assigned_to] || 0) + 1
        })
        wonLeads?.forEach((l: any) => {
            if (l.assigned_to) {
                if (!wonCounts[l.assigned_to]) wonCounts[l.assigned_to] = { count: 0, revenue: 0 }
                wonCounts[l.assigned_to].count++
                wonCounts[l.assigned_to].revenue += Number(l.value) || 0
            }
        })

        const enriched = data?.map((m: any) => ({
            ...m,
            leads_assigned: assignedCounts[m.user_id] || 0,
            won_count: wonCounts[m.user_id]?.count || 0,
            won_revenue: wonCounts[m.user_id]?.revenue || 0,
        }))

        fs.appendFileSync('debug_team.log', `[${new Date().toISOString()}] SUCCESS. Extracted ${enriched?.length} members.\n`)
        return NextResponse.json(enriched)
    } catch (err: any) {
        fs.appendFileSync('debug_team.log', `[${new Date().toISOString()}] CATCH ERROR: ${err.message}\n`)
        return NextResponse.json({ error: err.message }, { status: 500 })
    }
}

export async function POST(req: NextRequest) {
    const supabase = await createClient()
    const ctx = await getOrgAndRole(supabase)
    if (!ctx || (ctx.role !== 'owner' && ctx.role !== 'admin')) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json()
    const { email, role, department } = body

    // Check if user exists
    const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', email)
        .single()

    let newUserId = profile?.id

    if (!newUserId) {
        // 1. User doesn't exist, we must use admin to send a real invite
        const supabaseAdmin = getSupabaseAdmin()
        
        // 2. This creates the user in auth.users and sends them an invitation email
        // Passiamo esplicitamente il dominio in "redirectTo" (deve anche essere abilitato nei Redirect URL di Supabase)
        const { data: inviteData, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
            redirectTo: 'https://landing.metodosincro.com/dashboard/team'
        })
        
        if (inviteError) {
            // Se l'utente magari esiste già in auth ma non in profiles... 
            // supabase ritorna error di unicità, in tal caso lo peschiamo? 
            // Mettiamo un catch e un error
            return NextResponse.json({ error: "Impossibile invitare tramite email: " + inviteError.message }, { status: 500 })
        }
        
        if (!inviteData?.user?.id) {
            return NextResponse.json({ error: "Nessun ID utente restituito dall'invito" }, { status: 500 })
        }
        
        newUserId = inviteData.user.id
        
        // Try creating profile just in case there is no automatic trigger
        // Most projects have a trigger, so we'll do this softly (ignore error if it fails e.g. due to constraint)
        await supabaseAdmin.from('profiles').insert({
            id: newUserId,
            email: email,
            full_name: email.split('@')[0]
        }).select().single()
    }

    // Now insert directly into organization_members with the REAL user ID
    // either from profile (if existing) or from the freshly invited user
    const { data, error } = await supabase
        .from('organization_members')
        .insert({
            organization_id: ctx.organization_id,
            user_id: newUserId,
            role,
            department: department || null,
            invited_email: email,
            invited_at: !profile ? new Date().toISOString() : null,
            joined_at: profile ? new Date().toISOString() : null,
        })
        .select()
        .single()

    if (error) {
        return NextResponse.json({ error: "Errore DB: " + error.message }, { status: 500 })
    }

    return NextResponse.json(data)
}

// PATCH: Deactivate, Reactivate, Update Role
export async function PATCH(req: NextRequest) {
    const supabase = await createClient()
    const ctx = await getOrgAndRole(supabase)
    if (!ctx || (ctx.role !== 'owner' && ctx.role !== 'admin')) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json()
    const { action, member_id } = body

    if (action === 'deactivate') {
        // Soft-delete: set deactivated_at
        const { error } = await supabase
            .from('organization_members')
            .update({
                deactivated_at: new Date().toISOString(),
                deactivated_by: ctx.user_id,
            })
            .eq('id', member_id)
            .eq('organization_id', ctx.organization_id)
            .neq('role', 'owner') // Never deactivate owner

        if (error) return NextResponse.json({ error: error.message }, { status: 500 })

        // Reassign leads if requested
        if (body.reassign_to) {
            // Get the user_id of the member being deactivated
            const { data: deactivated } = await supabase
                .from('organization_members')
                .select('user_id')
                .eq('id', member_id)
                .single()

            if (deactivated) {
                await supabase
                    .from('leads')
                    .update({ assigned_to: body.reassign_to, updated_at: new Date().toISOString() })
                    .eq('organization_id', ctx.organization_id)
                    .eq('assigned_to', deactivated.user_id)
            }
        }

        return NextResponse.json({ success: true, action: 'deactivated' })
    }

    if (action === 'reactivate') {
        const { error } = await supabase
            .from('organization_members')
            .update({
                deactivated_at: null,
                deactivated_by: null,
            })
            .eq('id', member_id)
            .eq('organization_id', ctx.organization_id)

        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
        return NextResponse.json({ success: true, action: 'reactivated' })
    }

    if (action === 'update_role') {
        const updateData: any = { role: body.role }
        if (body.department !== undefined) updateData.department = body.department

        const { error } = await supabase
            .from('organization_members')
            .update(updateData)
            .eq('id', member_id)
            .eq('organization_id', ctx.organization_id)
            .neq('role', 'owner') // Never change owner role

        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
        return NextResponse.json({ success: true, action: 'role_updated' })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
}

export async function DELETE(req: NextRequest) {
    const supabase = await createClient()
    const ctx = await getOrgAndRole(supabase)
    if (!ctx || (ctx.role !== 'owner' && ctx.role !== 'admin')) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const memberId = searchParams.get('id')

    // Hard delete only for pending invites (never joined)
    const { data: member } = await supabase
        .from('organization_members')
        .select('joined_at, role')
        .eq('id', memberId)
        .eq('organization_id', ctx.organization_id)
        .single()

    if (member?.role === 'owner') {
        return NextResponse.json({ error: 'Cannot remove owner' }, { status: 403 })
    }

    // If never joined, allow hard delete
    if (!member?.joined_at) {
        const { error } = await supabase
            .from('organization_members')
            .delete()
            .eq('id', memberId)
            .eq('organization_id', ctx.organization_id)

        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
        return NextResponse.json({ success: true })
    }

    // Otherwise, soft-delete (redirect to PATCH deactivate)
    const { error } = await supabase
        .from('organization_members')
        .update({
            deactivated_at: new Date().toISOString(),
            deactivated_by: ctx.user_id,
        })
        .eq('id', memberId)
        .eq('organization_id', ctx.organization_id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true, soft_deleted: true })
}
