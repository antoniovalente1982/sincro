import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'

// ═══════════════════════════════════════════════════════════════
// 🧠 AI SELF-IMPROVE — cron notturno (system-prompt learning)
//
// Per ogni agente AI: misura il book-rate della versione attiva,
// analizza i transcript per esito e propone un PLAYBOOK migliorato
// (nuova versione 'candidate'). NON auto-attiva: l'admin approva.
// ═══════════════════════════════════════════════════════════════

export const maxDuration = 120
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY
const MODEL = 'google/gemini-2.5-flash'
const MIN_CALLS_TO_LEARN = 15

async function proposePlaybook(current: string, samples: { outcome: string; transcript: string }[]): Promise<{ playbook: string; notes: string } | null> {
    if (!OPENROUTER_API_KEY) return null
    const booked = samples.filter(s => s.outcome === 'appointment').slice(0, 8)
    const failed = samples.filter(s => s.outcome !== 'appointment').slice(0, 8)

    const prompt = `Sei un coach di vendita telefonica. Analizza le chiamate di un setter AI (obiettivo: fissare appuntamenti).

PLAYBOOK ATTUALE (lezioni già apprese):
${current || '(vuoto)'}

CHIAMATE ANDATE A BUON FINE (appuntamento preso):
${booked.map((s, i) => `#${i + 1}\n${s.transcript?.slice(0, 900)}`).join('\n---\n') || '(nessuna)'}

CHIAMATE FALLITE (nessun appuntamento):
${failed.map((s, i) => `#${i + 1} [${s.outcome}]\n${s.transcript?.slice(0, 900)}`).join('\n---\n') || '(nessuna)'}

Proponi al MASSIMO 5 lezioni NUOVE, concrete e testabili, per aumentare il tasso di appuntamento (es. aperture, gestione obiezioni, come proporre gli slot). Non ripetere lezioni già nel playbook.
Rispondi SOLO in JSON: {"playbook": "playbook aggiornato completo con le nuove lezioni", "notes": "riassunto di cosa hai cambiato e perché"}`

    try {
        const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
                'HTTP-Referer': 'https://metodosincro.com',
                'X-Title': 'Metodo Sincro AI Setter Learning',
            },
            body: JSON.stringify({
                model: MODEL,
                messages: [{ role: 'user', content: prompt }],
                max_tokens: 1500,
                temperature: 0.4,
                response_format: { type: 'json_object' },
            }),
        })
        if (!res.ok) return null
        const json = await res.json()
        const content = json.choices?.[0]?.message?.content
        if (!content) return null
        const parsed = JSON.parse(content)
        if (!parsed.playbook) return null
        return { playbook: String(parsed.playbook), notes: String(parsed.notes || '') }
    } catch {
        return null
    }
}

export async function GET(req: NextRequest) {
    if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const admin = getSupabaseAdmin()
    const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()

    const { data: agents } = await admin.from('ai_agents').select('*').eq('active', true)
    const results: any[] = []

    for (const agent of agents || []) {
        // Chiamate recenti dell'agente con transcript ed esito
        const { data: calls } = await admin
            .from('lead_calls')
            .select('outcome, transcript, connected_at, duration_seconds')
            .eq('ai_agent_id', agent.id)
            .gte('started_at', since)
            .not('transcript', 'is', null)
            .limit(60)

        const list = calls || []
        const total = list.length
        const connects = list.filter(c => c.connected_at || (c.duration_seconds && c.duration_seconds > 0)).length
        const appointments = list.filter(c => c.outcome === 'appointment').length
        const bookRate = total > 0 ? Math.round((appointments / total) * 100) : 0

        // Aggiorna le metriche della versione attiva
        if (agent.current_version_id) {
            await admin.from('ai_agent_versions')
                .update({ metrics: { calls: total, connects, appointments, book_rate: bookRate } })
                .eq('id', agent.current_version_id)
        }

        if (total < MIN_CALLS_TO_LEARN) {
            results.push({ agent: agent.id, status: 'not_enough_data', calls: total })
            continue
        }

        // Versione attiva → base per il miglioramento
        const { data: activeVer } = await admin
            .from('ai_agent_versions').select('*').eq('id', agent.current_version_id).maybeSingle()

        const proposal = await proposePlaybook(
            activeVer?.playbook || '',
            list.map(c => ({ outcome: c.outcome || 'no_answer', transcript: c.transcript || '' })),
        )
        if (!proposal) { results.push({ agent: agent.id, status: 'no_proposal', book_rate: bookRate }); continue }

        // Nuova versione CANDIDATE (l'admin la approva prima di attivarla)
        const { data: last } = await admin.from('ai_agent_versions')
            .select('version_no').eq('agent_id', agent.id).order('version_no', { ascending: false }).limit(1).maybeSingle()
        await admin.from('ai_agent_versions').insert({
            agent_id: agent.id,
            version_no: (last?.version_no || 0) + 1,
            system_prompt: activeVer?.system_prompt || '',
            playbook: proposal.playbook,
            status: 'candidate',
            notes: proposal.notes,
            metrics: { baseline_book_rate: bookRate },
        })

        results.push({ agent: agent.id, status: 'candidate_created', book_rate: bookRate })
    }

    return NextResponse.json({ ok: true, results })
}
