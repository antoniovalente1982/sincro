import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'

// ═══════════════════════════════════════════════════════════════
// ♻️  RECYCLE POOL LEADS — cron orario
//
// I lead assegnati a un venditore ma MAI chiamati (nessun
// first_called_at) dopo `recycle_after_hours` tornano nel pool
// (status 'recycled', priorità leggermente ridotta) così non
// restano "sequestrati" da chi fa spin e non lavora.
// ═══════════════════════════════════════════════════════════════

export const maxDuration = 30

export async function GET(req: NextRequest) {
    const authHeader = req.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = getSupabaseAdmin()

    // Soglia per org (default 48h). Prendiamo le regole default per org.
    const { data: rules } = await supabase
        .from('lead_distribution_rules')
        .select('organization_id, recycle_after_hours')
        .is('user_id', null)

    const orgThreshold: Record<string, number> = {}
    for (const r of rules || []) {
        orgThreshold[r.organization_id] = r.recycle_after_hours ?? 48
    }

    // Candidati: assegnati, mai chiamati
    const { data: candidates } = await supabase
        .from('lead_pool')
        .select('id, organization_id, assigned_at, priority_score, recycled_count, list_id')
        .eq('status', 'assigned')
        .is('first_called_at', null)
        .not('assigned_at', 'is', null)

    const now = Date.now()
    const toRecycle: any[] = []
    for (const lead of candidates || []) {
        const hours = orgThreshold[lead.organization_id] ?? 48
        const ageMs = now - new Date(lead.assigned_at).getTime()
        if (ageMs >= hours * 60 * 60 * 1000) toRecycle.push(lead)
    }

    let recycled = 0
    const touchedLists = new Set<string>()
    for (const lead of toRecycle) {
        const { error } = await supabase
            .from('lead_pool')
            .update({
                status: 'recycled',
                assigned_to: null,
                assigned_at: null,
                session_id: null,
                // penalità lieve così i "reduci" non monopolizzano i primi posti
                priority_score: Math.max(0, (lead.priority_score ?? 0.5) - 0.05),
                recycled_count: (lead.recycled_count ?? 0) + 1,
                updated_at: new Date().toISOString(),
            })
            .eq('id', lead.id)
            .eq('status', 'assigned') // guardia anti-race
        if (!error) {
            recycled++
            if (lead.list_id) touchedLists.add(lead.list_id)
        }
    }

    // Aggiorna available_count delle liste toccate
    for (const listId of touchedLists) {
        const { count } = await supabase
            .from('lead_pool')
            .select('*', { count: 'exact', head: true })
            .eq('list_id', listId)
            .in('status', ['available', 'recycled'])
        await supabase.from('lead_lists').update({ available_count: count || 0 }).eq('id', listId)
    }

    return NextResponse.json({ ok: true, checked: candidates?.length || 0, recycled })
}
