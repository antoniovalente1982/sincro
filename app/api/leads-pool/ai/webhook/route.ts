import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { applyAiCallOutcome } from '@/lib/leads-station/ai-runtime'

// POST /api/leads-pool/ai/webhook
// Webhook post-call di ElevenLabs (o normalizzato). Correla la chiamata
// al lead del pool (via dynamic variable lead_pool_id), scrive transcript
// ed esito, e applica l'outcome (appuntamento → closer umano in round-robin).
//
// Sicurezza: header x-ai-webhook-secret == env AI_WEBHOOK_SECRET.
export async function POST(req: NextRequest) {
    const secret = req.headers.get('x-ai-webhook-secret')
    if (!process.env.AI_WEBHOOK_SECRET || secret !== process.env.AI_WEBHOOK_SECRET) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json().catch(() => ({}))
    const admin = getSupabaseAdmin()

    // Estrai i campi sia da payload normalizzato sia dallo shape ElevenLabs
    const data = body.data || body
    const dyn = data?.conversation_initiation_client_data?.dynamic_variables
        || data?.metadata?.dynamic_variables
        || body?.dynamic_variables
        || {}
    const analysis = data?.analysis || {}
    const collected = analysis?.data_collection_results || analysis?.data_collection || {}

    const leadPoolId = body.lead_pool_id || dyn.lead_pool_id || collected?.lead_pool_id?.value || collected?.lead_pool_id
    const providerAgentId = body.provider_agent_id || data?.agent_id
    const agentId = body.ai_agent_id || dyn.ai_agent_id

    if (!leadPoolId) return NextResponse.json({ error: 'lead_pool_id mancante nel payload' }, { status: 400 })

    // Trova l'agente
    let agent: any = null
    if (agentId) {
        agent = (await admin.from('ai_agents').select('*').eq('id', agentId).maybeSingle()).data
    } else if (providerAgentId) {
        agent = (await admin.from('ai_agents').select('*').eq('provider_agent_id', providerAgentId).maybeSingle()).data
    }
    if (!agent) return NextResponse.json({ error: 'Agente non trovato' }, { status: 404 })

    // Normalizza l'esito
    const outcome = body.outcome
        || collected?.outcome?.value || collected?.outcome
        || (collected?.appointment_booked?.value || collected?.appointment_booked ? 'appointment' : null)
        || 'no_answer'
    const appointmentAt = body.appointment_at || collected?.appointment_datetime?.value || collected?.appointment_datetime || null
    const durationSeconds = body.duration_seconds ?? data?.metadata?.call_duration_secs ?? null
    const transcript = body.transcript
        || (Array.isArray(data?.transcript) ? data.transcript.map((t: any) => `${t.role}: ${t.message}`).join('\n') : data?.transcript)
        || null
    const summary = body.summary || analysis?.transcript_summary || null
    const connected = body.connected ?? (durationSeconds ? durationSeconds > 5 : false)
    const providerCallId = body.provider_call_id || data?.conversation_id || null
    const phone = body.phone || dyn.phone || data?.metadata?.phone_number || null

    const result = await applyAiCallOutcome(admin, agent, {
        leadPoolId, outcome, appointmentAt, transcript, summary,
        durationSeconds, connected, providerCallId, phone,
    })

    return NextResponse.json({ ok: true, result })
}
