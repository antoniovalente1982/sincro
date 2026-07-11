import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { romeDateString } from '@/lib/timezone'

// ═══════════════════════════════════════════════════════════════
// 🤖 AI SETTER DISPATCH — cron negli orari lavorativi (con jitter)
//
// Per ogni agente AI attivo: preleva dal pool i lead che restano
// nel target giornaliero (claim atomico, stessa coda degli umani)
// e avvia le chiamate via ElevenLabs Batch Calling.
//
// Guardato dalla configurazione: se manca la key ConvAI o l'agente/
// numero ElevenLabs, NON preleva lead (niente hoarding) e riporta lo
// stato "non configurato".
// ═══════════════════════════════════════════════════════════════

export const maxDuration = 60

const CONVAI_KEY = process.env.ELEVENLABS_CONVAI_API_KEY

export async function GET(req: NextRequest) {
    if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const admin = getSupabaseAdmin()

    const { data: agents } = await admin.from('lead_ai_agents').select('*').eq('active', true)
    const results: any[] = []

    for (const agent of agents || []) {
        const configured = !!CONVAI_KEY && !!agent.provider_agent_id && !!agent.phone_number_id && !!agent.member_user_id
        if (!configured) {
            results.push({ agent: agent.id, status: 'not_configured' })
            continue
        }

        // Quante chiamate già fatte oggi da questo agente
        const todayStart = `${romeDateString()}T00:00:00.000Z`
        const { count: callsToday } = await admin
            .from('lead_calls').select('*', { count: 'exact', head: true })
            .eq('ai_agent_id', agent.id).gte('started_at', todayStart)

        const remaining = Math.max(0, (agent.daily_call_target || 50) - (callsToday || 0))
        if (remaining === 0) { results.push({ agent: agent.id, status: 'target_reached' }); continue }

        // Preleva i lead (max 20 per run, per non saturare)
        const batch = Math.min(remaining, 20)
        const { data: claimed } = await admin.rpc('claim_pool_leads', {
            p_org: agent.organization_id, p_user: agent.member_user_id, p_batch: batch,
            p_list_ids: agent.settings?.active_list_ids || null, p_session: null, p_dedup_hours: 72,
        })
        if (!claimed || claimed.length === 0) { results.push({ agent: agent.id, status: 'no_leads' }); continue }

        // Costruisci i destinatari per la Batch Calling di ElevenLabs
        const recipients = claimed
            .filter((l: any) => l.phone)
            .map((l: any) => ({
                phone_number: l.phone,
                conversation_initiation_client_data: {
                    dynamic_variables: {
                        lead_pool_id: l.id,
                        ai_agent_id: agent.id,
                        lead_name: l.full_name || l.first_name || '',
                        phone: l.phone,
                    },
                },
            }))

        try {
            // NB: verifica l'esatto endpoint/shape nella tua dashboard ElevenLabs.
            const resp = await fetch('https://api.elevenlabs.io/v1/convai/batch-calling/submit', {
                method: 'POST',
                headers: { 'xi-api-key': CONVAI_KEY!, 'content-type': 'application/json' },
                body: JSON.stringify({
                    call_name: `sincro-${agent.id.slice(0, 6)}-${Date.now()}`,
                    agent_id: agent.provider_agent_id,
                    agent_phone_number_id: agent.phone_number_id,
                    recipients,
                }),
            })
            const ok = resp.ok
            results.push({ agent: agent.id, status: ok ? 'dispatched' : 'provider_error', dispatched: recipients.length, http: resp.status })
        } catch (e: any) {
            results.push({ agent: agent.id, status: 'error', detail: e.message })
        }
    }

    return NextResponse.json({ ok: true, results })
}
