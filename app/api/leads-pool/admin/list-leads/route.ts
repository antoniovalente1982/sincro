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

    // Conteggio per status
    const { data: statusCounts } = await supabase
        .from('lead_pool')
        .select('status')
        .eq('list_id', listId)

    const counts: Record<string, number> = {}
    for (const row of statusCounts || []) {
        counts[row.status] = (counts[row.status] || 0) + 1
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
            total: Object.values(counts).reduce((s, v) => s + v, 0),
        },
        status_counts: counts,
    })
}
