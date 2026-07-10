import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET /api/leads-pool/admin/list-leads?list_id=xxx&page=1&limit=50
// Ritorna i leads di una lista specifica con paginazione

export async function GET(request: Request) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })

    const { data: member } = await supabase
        .from('organization_members')
        .select('organization_id, role')
        .eq('user_id', user.id)
        .is('deactivated_at', null)
        .single()

    if (!member || !['owner', 'admin', 'manager'].includes(member.role)) {
        return NextResponse.json({ error: 'Accesso negato' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const listId = searchParams.get('list_id')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const statusFilter = searchParams.get('status') || null
    const offset = (page - 1) * limit

    if (!listId) return NextResponse.json({ error: 'list_id richiesto' }, { status: 400 })

    // Verifica che la lista appartenga all'org
    const { data: list } = await supabase
        .from('lead_lists')
        .select('*')
        .eq('id', listId)
        .eq('organization_id', member.organization_id)
        .single()

    if (!list) return NextResponse.json({ error: 'Lista non trovata' }, { status: 404 })

    // Conteggio per status e feedback (escludendo i blacklisted)
    const { data: countsData } = await supabase
        .from('lead_pool')
        .select('status, feedback')
        .eq('list_id', listId)
        .neq('status', 'blacklisted')

    const statusCounts: Record<string, number> = {}
    const feedbackCounts: Record<string, number> = {}
    for (const row of countsData || []) {
        statusCounts[row.status] = (statusCounts[row.status] || 0) + 1
        if (row.feedback) {
            feedbackCounts[row.feedback] = (feedbackCounts[row.feedback] || 0) + 1
        }
    }

    // Query leads con paginazione
    let query = supabase
        .from('lead_pool')
        .select('id, full_name, phone, email, city, province, status, feedback, priority_score, call_count, assigned_at, assigned_to, created_at, notes, source, raw_data')
        .eq('list_id', listId)
        .order('priority_score', { ascending: false })
        .order('created_at', { ascending: true })
        .range(offset, offset + limit - 1)

    if (statusFilter) {
        query = query.eq('status', statusFilter)
    } else {
        query = query.neq('status', 'blacklisted')
    }

    const { data: leads, error } = await query

    // Fetch assigned-to profiles
    const assignedIds = [...new Set((leads || []).map(l => l.assigned_to).filter(Boolean))]
    let profilesMap: Record<string, any> = {}
    if (assignedIds.length > 0) {
        const { data: profiles } = await supabase
            .from('profiles')
            .select('id, full_name')
            .in('id', assignedIds)
        profilesMap = Object.fromEntries((profiles || []).map(p => [p.id, p]))
    }

    return NextResponse.json({
        list,
        leads: (leads || []).map(l => ({
            ...l,
            assigned_to_name: l.assigned_to ? profilesMap[l.assigned_to]?.full_name : null,
        })),
        pagination: {
            page,
            limit,
            offset,
            total: Object.values(statusCounts).reduce((s, v) => s + v, 0),
        },
        status_counts: statusCounts,
        feedback_counts: feedbackCounts,
    })
}

export async function DELETE(request: Request) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })

    const { data: member } = await supabase
        .from('organization_members')
        .select('organization_id, role')
        .eq('user_id', user.id)
        .is('deactivated_at', null)
        .single()

    if (!member || !['owner', 'admin', 'manager'].includes(member.role)) {
        return NextResponse.json({ error: 'Accesso negato' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const listId = searchParams.get('list_id')
    const action = searchParams.get('action')

    if (!listId) return NextResponse.json({ error: 'list_id richiesto' }, { status: 400 })

    // Verifica la lista
    const { data: list } = await supabase
        .from('lead_lists')
        .select('*')
        .eq('id', listId)
        .eq('organization_id', member.organization_id)
        .single()

    if (!list) return NextResponse.json({ error: 'Lista non trovata' }, { status: 404 })

    if (action === 'clean_wrong_numbers') {
        // Invece di cancellare fisicamente i record, li impostiamo in stato 'blacklisted'.
        // Questo li nasconde dalle visualizzazioni ma preserva i KPI storici del venditore.
        const { data: updatedLeads, error: updateError } = await supabase
            .from('lead_pool')
            .update({ 
                status: 'blacklisted', 
                updated_at: new Date().toISOString() 
            })
            .eq('list_id', listId)
            .eq('feedback', 'wrong_number')
            .select('id')

        if (updateError) {
            console.error('[CLEAN_WRONG_NUMBERS] Error:', updateError)
            return NextResponse.json({ error: 'Errore durante l\'archiviazione dei numeri errati' }, { status: 500 })
        }

        const updatedCount = updatedLeads?.length || 0

        // Ricalcola conteggi total (escludendo i blacklisted) e available
        const { count: countTotal } = await supabase
            .from('lead_pool')
            .select('*', { count: 'exact', head: true })
            .eq('list_id', listId)
            .neq('status', 'blacklisted')

        const { count: countAvail } = await supabase
            .from('lead_pool')
            .select('*', { count: 'exact', head: true })
            .eq('list_id', listId)
            .eq('status', 'available')

        await supabase
            .from('lead_lists')
            .update({
                total_count: countTotal || 0,
                available_count: countAvail || 0,
                updated_at: new Date().toISOString()
            })
            .eq('id', listId)

        return NextResponse.json({
            success: true,
            deleted_count: updatedCount,
            new_total_count: countTotal || 0,
            new_available_count: countAvail || 0,
        })
    }

    return NextResponse.json({ error: 'Azione non valida' }, { status: 400 })
}
