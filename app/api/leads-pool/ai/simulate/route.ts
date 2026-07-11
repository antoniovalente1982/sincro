import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { applyAiCallOutcome } from '@/lib/leads-station/ai-runtime'

// POST /api/leads-pool/ai/simulate
// Simula una chiamata dell'agente AI su un lead reale del pool, SENZA
// telefonare davvero. Serve a testare tutto il flusso (esito → appuntamento
// → assegnazione a closer umano → misura) prima di collegare ElevenLabs.
export async function POST(request: Request) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })

    const { data: member } = await supabase
        .from('organization_members').select('organization_id, role')
        .eq('user_id', user.id).is('deactivated_at', null).single()
    if (!member || !['owner', 'admin', 'manager'].includes(member.role)) {
        return NextResponse.json({ error: 'Accesso negato' }, { status: 403 })
    }
    const orgId = member.organization_id
    const admin = getSupabaseAdmin()

    const body = await request.json().catch(() => ({}))
    const outcome = body.outcome || 'appointment'
    let leadPoolId = body.lead_pool_id || null

    const { data: agent } = await admin.from('ai_agents').select('*').eq('organization_id', orgId).limit(1).maybeSingle()
    if (!agent?.member_user_id) return NextResponse.json({ error: 'Agente AI non configurato (fai prima il setup)' }, { status: 400 })

    // Se non passato, prende (claim atomico) un lead disponibile per l'agente
    if (!leadPoolId) {
        const { data: claimed } = await admin.rpc('claim_pool_leads', {
            p_org: orgId, p_user: agent.member_user_id, p_batch: 1,
            p_list_ids: null, p_session: null, p_dedup_hours: 0,
        })
        if (!claimed || claimed.length === 0) {
            return NextResponse.json({ error: 'Nessun lead disponibile nel pool da simulare' }, { status: 404 })
        }
        leadPoolId = claimed[0].id
    }

    // Appuntamento di default domani alle 10:00 se outcome = appointment
    let appointmentAt: string | null = body.appointment_at || null
    if (outcome === 'appointment' && !appointmentAt) {
        const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(10, 0, 0, 0)
        appointmentAt = d.toISOString()
    }

    const result = await applyAiCallOutcome(admin, agent, {
        leadPoolId,
        outcome,
        appointmentAt,
        transcript: '[SIMULAZIONE] Conversazione di test generata dall\'admin.',
        summary: `Simulazione esito "${outcome}".`,
        durationSeconds: outcome === 'no_answer' ? 8 : 95,
        connected: outcome !== 'no_answer',
        providerCallId: null,
        phone: null,
    })

    return NextResponse.json({ ok: true, lead_pool_id: leadPoolId, outcome, result })
}
