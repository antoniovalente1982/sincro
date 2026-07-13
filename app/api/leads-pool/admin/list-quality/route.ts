import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'

const WIN_FEEDBACKS = ['appointment', 'converted']

// GET /api/leads-pool/admin/list-quality
// Qualità per lista/sorgente (quale lista converte meglio → cosa comprare)
// + "best time to call" dai log chiamata reali.
// FIX: usa paginazione .range() per bypassare il limite default di 1000 righe di Supabase
export async function GET() {
    const supabase = await createClient()
    const admin = getSupabaseAdmin()
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
    const orgId = member.organization_id

    // Fetch lists (pochi record, nessun problema di limite)
    const { data: lists } = await admin
        .from('lead_lists')
        .select('id, name, source_format, total_count')
        .eq('organization_id', orgId)

    // Fetch lead_pool con paginazione per superare il limite di 1000 righe
    const PAGE_SIZE = 5000
    let allPool: Array<{ list_id: string | null; status: string; feedback: string | null; call_count: number | null }> = []
    let from = 0
    while (true) {
        const { data, error } = await admin
            .from('lead_pool')
            .select('list_id, status, feedback, call_count')
            .eq('organization_id', orgId)
            .range(from, from + PAGE_SIZE - 1)
        if (error || !data || data.length === 0) break
        allPool = allPool.concat(data)
        if (data.length < PAGE_SIZE) break
        from += PAGE_SIZE
    }

    // Fetch lead_calls con paginazione
    let allCalls: Array<{ started_at: string | null; connected_at: string | null; duration_seconds: number | null }> = []
    from = 0
    while (true) {
        const { data, error } = await admin
            .from('lead_calls')
            .select('started_at, connected_at, duration_seconds')
            .eq('organization_id', orgId)
            .range(from, from + PAGE_SIZE - 1)
        if (error || !data || data.length === 0) break
        allCalls = allCalls.concat(data)
        if (data.length < PAGE_SIZE) break
        from += PAGE_SIZE
    }

    const listName: Record<string, string> = Object.fromEntries((lists || []).map(l => [l.id, l.name]))

    type Agg = { list_id: string; name: string; total: number; worked: number; wins: number; wrong: number; available: number }
    const byList: Record<string, Agg> = {}
    const ensure = (id: string | null) => {
        const key = id || 'no_list'
        if (!byList[key]) byList[key] = { list_id: key, name: listName[key] || 'Senza lista', total: 0, worked: 0, wins: 0, wrong: 0, available: 0 }
        return byList[key]
    }

    for (const l of allPool) {
        const a = ensure(l.list_id)
        a.total += 1
        if (l.status === 'available' || l.status === 'recycled') a.available += 1
        const worked = (l.call_count || 0) > 0 || ['called', 'converted'].includes(l.status) || !!l.feedback
        if (worked) a.worked += 1
        if (WIN_FEEDBACKS.includes(l.feedback ?? '')) a.wins += 1
        if (l.feedback === 'wrong_number') a.wrong += 1
    }

    const listQuality = Object.values(byList).map(a => ({
        ...a,
        win_rate_worked: a.worked > 0 ? Math.round((a.wins / a.worked) * 100) : 0,   // tasso appuntamento sui lavorati
        win_rate_total: a.total > 0 ? Math.round((a.wins / a.total) * 100) : 0,       // resa complessiva della lista
        wrong_rate: a.worked > 0 ? Math.round((a.wrong / a.worked) * 100) : 0,
    })).sort((x, y) => y.win_rate_worked - x.win_rate_worked)

    // ── Best time to call: connessioni per fascia oraria ──
    const hourStats: Record<number, { dials: number; connected: number }> = {}
    for (let h = 0; h < 24; h++) hourStats[h] = { dials: 0, connected: 0 }
    for (const c of allCalls) {
        if (!c.started_at) continue
        const h = new Date(c.started_at).getHours()
        hourStats[h].dials += 1
        if (c.connected_at || (c.duration_seconds && c.duration_seconds > 0)) hourStats[h].connected += 1
    }
    const bestHours = Object.entries(hourStats)
        .map(([h, s]) => ({ hour: Number(h), dials: s.dials, connect_rate: s.dials > 0 ? Math.round((s.connected / s.dials) * 100) : 0 }))
        .filter(x => x.dials >= 3)
        .sort((a, b) => b.connect_rate - a.connect_rate)
        .slice(0, 5)

    return NextResponse.json({ success: true, lists: listQuality, best_hours: bestHours, total_calls: allCalls.length })
}
