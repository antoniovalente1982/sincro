import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { bookAppointmentFromPool } from '@/lib/leads-station/appointments'

// POST /api/leads-pool/ai/book
// "Server tool" che l'agente ElevenLabs può chiamare DURANTE la telefonata
// per fissare l'appuntamento in tempo reale (assegnato a un closer umano).
// Restituisce un messaggio che l'agente può leggere al lead.
//
// Sicurezza: header x-ai-webhook-secret == env AI_WEBHOOK_SECRET.
export async function POST(req: NextRequest) {
    const secret = req.headers.get('x-ai-webhook-secret')
    if (!process.env.AI_WEBHOOK_SECRET || secret !== process.env.AI_WEBHOOK_SECRET) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json().catch(() => ({}))
    const { lead_pool_id, ai_agent_id, appointment_at, notes } = body
    if (!lead_pool_id || !appointment_at) {
        return NextResponse.json({ error: 'lead_pool_id e appointment_at richiesti' }, { status: 400 })
    }

    const admin = getSupabaseAdmin()
    const agent = (await admin.from('ai_agents').select('*').eq('id', ai_agent_id).maybeSingle()).data
    if (!agent?.member_user_id) return NextResponse.json({ error: 'Agente non valido' }, { status: 404 })

    const res = await bookAppointmentFromPool(admin, {
        orgId: agent.organization_id,
        poolLeadId: lead_pool_id,
        setterUserId: agent.member_user_id,
        appointmentAt: appointment_at,
        notes,
        isAI: true,
    })

    if (!res.ok) return NextResponse.json({ ok: false, error: res.error }, { status: 400 })

    const when = new Date(appointment_at).toLocaleString('it-IT', { weekday: 'long', day: '2-digit', month: 'long', hour: '2-digit', minute: '2-digit' })
    return NextResponse.json({
        ok: true,
        // messaggio che l'agente può leggere al telefono
        message: `Perfetto, ho fissato l'appuntamento per ${when}. Un nostro consulente la chiamerà. A presto!`,
        calendar_event_id: res.calendarEventId,
    })
}
