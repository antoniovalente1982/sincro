import { bookAppointmentFromPool } from './appointments'

// ============================================================
// Runtime setter AI: applica l'esito di una chiamata dell'agente
// al pool + funnel. Condiviso da webhook post-call e "simula".
// ============================================================

type Admin = ReturnType<typeof import('@/lib/supabase/admin').getSupabaseAdmin>

const VALID_OUTCOMES = ['appointment', 'interested', 'callback', 'no_answer', 'not_interested', 'wrong_number']

export interface AiCallResult {
    leadPoolId: string
    outcome: string
    appointmentAt?: string | null
    callbackAt?: string | null
    transcript?: string | null
    summary?: string | null
    durationSeconds?: number | null
    connected?: boolean
    providerCallId?: string | null
    phone?: string | null
}

export async function applyAiCallOutcome(admin: Admin, agent: any, r: AiCallResult) {
    const now = new Date().toISOString()
    const setterUserId = agent.member_user_id
    if (!setterUserId) return { ok: false, error: 'Agente senza member_user_id (setup incompleto)' }

    const outcome = VALID_OUTCOMES.includes(r.outcome) ? r.outcome : 'no_answer'

    // 1. Log della chiamata AI (transcript, durata, esito)
    await admin.from('lead_calls').insert({
        organization_id: agent.organization_id,
        lead_pool_id: r.leadPoolId,
        user_id: setterUserId,
        phone: r.phone || null,
        provider: agent.provider || 'elevenlabs',
        provider_call_id: r.providerCallId || null,
        ai_agent_id: agent.id,
        agent_version_id: agent.current_version_id || null,
        started_at: now,
        connected_at: r.connected ? now : null,
        duration_seconds: r.durationSeconds ?? null,
        ended_at: now,
        outcome,
        transcript: r.transcript || null,
        summary: r.summary || null,
    })

    // 2. Applica l'esito al lead del pool
    if (outcome === 'appointment' && r.appointmentAt) {
        return bookAppointmentFromPool(admin, {
            orgId: agent.organization_id,
            poolLeadId: r.leadPoolId,
            setterUserId,
            appointmentAt: r.appointmentAt,
            notes: r.summary || undefined,
            isAI: true,
        })
    }

    await admin.from('lead_pool').update({
        feedback: outcome,
        status: 'called',
        callback_at: outcome === 'callback' ? (r.callbackAt || null) : null,
        feedback_at: now,
        last_called_at: now,
        updated_at: now,
    }).eq('id', r.leadPoolId)

    return { ok: true, outcome }
}
