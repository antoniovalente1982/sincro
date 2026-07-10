import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// POST /api/leads-pool/log-call
// Registra un tentativo di chiamata (click-to-call sul link tel:).
// Provider-agnostico: 'manual' quando parte dal browser. Un provider
// VoIP (Twilio/Aircall) può poi arricchire la riga via webhook con
// connected_at / duration_seconds / recording_url.
export async function POST(request: Request) {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
        return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })
    }

    const { lead_pool_id, phone } = await request.json().catch(() => ({}))
    if (!lead_pool_id) {
        return NextResponse.json({ error: 'lead_pool_id richiesto' }, { status: 400 })
    }

    const { data: member } = await supabase
        .from('organization_members')
        .select('organization_id')
        .eq('user_id', user.id)
        .is('deactivated_at', null)
        .single()

    if (!member) return NextResponse.json({ error: 'Organizzazione non trovata' }, { status: 403 })

    const { data: call, error } = await supabase
        .from('lead_calls')
        .insert({
            organization_id: member.organization_id,
            lead_pool_id,
            user_id: user.id,
            phone: phone || null,
            provider: 'manual',
            started_at: new Date().toISOString(),
        })
        .select('id')
        .single()

    if (error) {
        return NextResponse.json({ error: 'Errore log chiamata', detail: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, call_id: call.id })
}
