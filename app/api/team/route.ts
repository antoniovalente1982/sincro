import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'

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

    // 1. Fetch members (senza join a profiles — non esiste FK)
    const { data: members, error } = await supabase
        .from('organization_members')
        .select('*')
        .eq('organization_id', ctx.organization_id)
        .order('joined_at', { ascending: true })

    if (error) {
        console.error('[TEAM GET] SELECT ERROR:', error.message)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!members || members.length === 0) {
        return NextResponse.json([])
    }

    try {
        // 2. Fetch profiles separatamente per user_id
        const userIds = members.map((m: any) => m.user_id).filter(Boolean)
        const { data: profiles } = await supabase
            .from('profiles')
            .select('id, full_name, email, avatar_url')
            .in('id', userIds)

        const profileMap: Record<string, any> = {}
        profiles?.forEach((p: any) => { profileMap[p.id] = p })

        // 3. Lead counts
        const { data: leads } = await supabase
            .from('leads')
            .select('assigned_to')
            .eq('organization_id', ctx.organization_id)

        const { data: wonLeads } = await supabase
            .from('leads')
            .select('assigned_to, value, pipeline_stages!inner(is_won)')
            .eq('organization_id', ctx.organization_id)
            .eq('pipeline_stages.is_won', true)

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

        // 4. Merge tutto
        const enriched = members.map((m: any) => ({
            ...m,
            profiles: profileMap[m.user_id] || null,
            leads_assigned: assignedCounts[m.user_id] || 0,
            won_count: wonCounts[m.user_id]?.count || 0,
            won_revenue: wonCounts[m.user_id]?.revenue || 0,
        }))

        return NextResponse.json(enriched)
    } catch (err: any) {
        console.error('[TEAM GET] CATCH ERROR:', err.message)
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
        const supabaseAdmin = getSupabaseAdmin()
        
        // 1. Genera il link di invito SENZA inviare l'email di Supabase
        //    generateLink crea l'utente in auth.users e ci restituisce il token
        const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
            type: 'invite',
            email: email,
        })
        
        if (linkError) {
            return NextResponse.json({ error: "Impossibile generare invito: " + linkError.message }, { status: 500 })
        }
        
        if (!linkData?.user?.id) {
            return NextResponse.json({ error: "Nessun ID utente restituito dall'invito" }, { status: 500 })
        }
        
        newUserId = linkData.user.id
        
        // 2. Costruiamo il link corretto con il VERO dominio di produzione
        //    Il token_hash e type vengono dal link generato da Supabase
        const confirmUrl = `https://landing.metodosincro.com/auth/confirm?token_hash=${linkData.properties.hashed_token}&type=invite&next=/dashboard/team`
        
        // 3. Inviamo l'email tramite Resend (dominio verificato, email brandizzata)
        try {
            const { Resend } = await import('resend')
            const resend = new Resend(process.env.RESEND_API_KEY)
            
            await resend.emails.send({
                from: process.env.RESEND_FROM_EMAIL || 'Metodo Sincro <email@metodosincro.com>',
                to: email,
                subject: 'Sei stato invitato in Metodo Sincro',
                html: `
                    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; background: #0f0f23; color: #e2e8f0; padding: 40px; border-radius: 16px;">
                        <div style="text-align: center; margin-bottom: 32px;">
                            <h1 style="color: #a78bfa; font-size: 28px; margin: 0;">Metodo Sincro</h1>
                            <p style="color: #94a3b8; font-size: 14px; margin-top: 8px;">Il tuo spazio di lavoro ti aspetta</p>
                        </div>
                        <div style="background: #1e1e3a; padding: 32px; border-radius: 12px; border: 1px solid #2d2d5e;">
                            <h2 style="color: #e2e8f0; font-size: 20px; margin-top: 0;">Sei stato invitato nel team!</h2>
                            <p style="color: #94a3b8; line-height: 1.6;">
                                Un amministratore ti ha invitato a far parte dello spazio di lavoro su Metodo Sincro 
                                con il ruolo di <strong style="color: #a78bfa;">${role}</strong>${department ? ` nel reparto <strong style="color: #a78bfa;">${department}</strong>` : ''}.
                            </p>
                            <div style="text-align: center; margin: 32px 0;">
                                <a href="${confirmUrl}" 
                                   style="display: inline-block; background: linear-gradient(135deg, #7c3aed, #a78bfa); color: white; padding: 14px 40px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px;">
                                    Accetta Invito
                                </a>
                            </div>
                            <p style="color: #64748b; font-size: 12px; text-align: center;">
                                Se il bottone non funziona, copia e incolla questo link nel browser:<br>
                                <a href="${confirmUrl}" style="color: #7c3aed; word-break: break-all;">${confirmUrl}</a>
                            </p>
                        </div>
                        <p style="color: #475569; font-size: 11px; text-align: center; margin-top: 24px;">
                            © ${new Date().getFullYear()} Metodo Sincro — Questa email è stata inviata automaticamente.
                        </p>
                    </div>
                `
            })
        } catch (emailErr: any) {
            console.error('[TEAM POST] EMAIL SEND ERROR:', emailErr.message)
        }
        
        // 4. Crea profilo (softly, ignora errore se esiste già trigger automatico)
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
