import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'

// POST /api/leads-pool/telephony/webhook
// Endpoint provider-agnostico per arricchire i log chiamata con dati
// reali (connessione, durata, registrazione) da un provider VoIP
// (Twilio / Aircall / ...). Richiede header:  x-telephony-secret.
//
// NB: il dialing live richiede la configurazione del provider e delle
// credenziali (env TELEPHONY_WEBHOOK_SECRET). Finché non è connesso,
// i log restano di tipo 'manual' (click-to-call dal browser).
export async function POST(req: NextRequest) {
    const secret = req.headers.get('x-telephony-secret')
    if (!process.env.TELEPHONY_WEBHOOK_SECRET || secret !== process.env.TELEPHONY_WEBHOOK_SECRET) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json().catch(() => ({}))
    const {
        provider_call_id,   // id chiamata lato provider
        call_id,            // opz. id lead_calls già esistente (click-to-call)
        provider,           // 'twilio' | 'aircall' | ...
        connected,          // bool: risposta avvenuta
        duration_seconds,
        recording_url,
        ended,              // bool: chiamata terminata
    } = body

    const supabase = getSupabaseAdmin()
    const patch: Record<string, any> = {}
    if (provider) patch.provider = provider
    if (provider_call_id) patch.provider_call_id = provider_call_id
    if (connected) patch.connected_at = new Date().toISOString()
    if (typeof duration_seconds === 'number') patch.duration_seconds = duration_seconds
    if (recording_url) patch.recording_url = recording_url
    if (ended) patch.ended_at = new Date().toISOString()

    if (Object.keys(patch).length === 0) {
        return NextResponse.json({ error: 'Nessun dato da aggiornare' }, { status: 400 })
    }

    // Match per call_id diretto o per provider_call_id
    let q = supabase.from('lead_calls').update(patch)
    if (call_id) q = q.eq('id', call_id)
    else if (provider_call_id) q = q.eq('provider_call_id', provider_call_id)
    else return NextResponse.json({ error: 'call_id o provider_call_id richiesto' }, { status: 400 })

    const { error } = await q
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ ok: true })
}
