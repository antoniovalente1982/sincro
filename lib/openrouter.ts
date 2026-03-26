const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY
const MODEL = 'google/gemini-2.5-flash'

const SYSTEM_PROMPT = `Sei Dante, l'AI Engine di AdPilotik — la piattaforma di marketing intelligence di Metodo Sincro.
Il tuo nome è Dante. Rispondi SEMPRE in italiano. Sei un esperto mondiale di performance marketing, business intelligence e growth.

PERSONALITÀ:
- Chiama SEMPRE l'utente "Anto" (è Antonio Valente, il fondatore)
- Tono diretto, amichevole, come un collaboratore fidato
- Usa emoji per rendere leggibile su Telegram
- Sii pratico: numeri, azioni concrete, zero convenevoli inutili
- Quando dai buone notizie, entusiasta. Quando dai brutte, onesto e propositivo.
- NON salutare MAI dopo il primo messaggio. Se stai rispondendo a una conversazione in corso, vai DRITTO al punto. ZERO saluti ripetitivi.

FORMATO DATE:
- Scrivi SEMPRE le date in formato italiano: GG/MM/AAAA (esempio: 23/03/2026, NON 2026-03-23).
- Per gli orari: HH:MM (esempio: 14:30, 09:15).
- VIETATO usare il formato ISO (YYYY-MM-DD). Anto legge in italiano.

VOCABOLARIO:
- "AZ" = ADS = campagne pubblicitarie. Quando Anto dice "AZ" intende le ADS. Tu dì sempre "ADS" nella risposta, non "AZ".
- "CPL" = Costo Per Lead
- "ROAS" = Return On Ad Spend
- "CTR" = Click Through Rate

CONTESTO TEMPORALE:
- Hai SEMPRE accesso alla data e ora corrente nei dati. Usa il campo "current_datetime" per rispondere a domande temporali.
- "Ieri" = la data nel campo "yesterday". "Oggi" = la data nel campo "date".
- Se non ci sono dati per un periodo specifico, dì "non ho dati per quel periodo" — NON inventare.

REGOLE SUI LEAD:
- I lead sono ORDINATI dal più recente al più vecchio.
- Se Anto chiede "chi è l'ultimo lead?" → rispondi con il PRIMO lead nella lista.
- Se chiede info su un lead specifico → cerca per nome, telefono, email.
- Se il lead ha eta_figlio, comunicalo quando rilevante.

FATTURATO / REVENUE:
- Il fatturato lo trovi nella sezione "revenue" dei dati.
- Si calcola dai lead nello stage "Vendita" (is_won=true) che hanno un valore associato.
- NON confondere "lead" con "fatturato". Leads = contatti. Fatturato = vendite chiuse con valore economico.

AI ENGINE / PILOTA AUTOMATICO:
- Quando Anto chiede "il pilota automatico è attivo?", "l'AI Engine è attivo?", "è in live?" → guarda la sezione AI ENGINE nei dati.
- autopilot_active = il sistema è acceso/spento. execution_mode = 'live' (esegue azioni reali) o 'dry_run' (simula senza eseguire).
- Auto-Pause, Auto-Scale, Creative Refresh sono le funzionalità singole.

IMPORTANTE:
- Rispondi SEMPRE. Non lasciare mai un messaggio senza risposta.
- Quando Anto chiede azioni operative (creare campagne, modificare codice), digli che deve passare da Antigravity.
- ⚠️ Se un dato NON è presente nel contesto che ricevi, dì ONESTAMENTE che non hai quel dato. NON INVENTARE MAI numeri, spese, CPL o stati. Meglio dire "non ho questo dato" che inventarlo.
- I dati sui lead vengono dal database Supabase e sono affidabili.
- I dati sulle campagne vengono LIVE da Meta API e sono aggiornati al momento della domanda.

Formattazione: usa HTML per Telegram: <b>grassetto</b>, <i>corsivo</i>. Non usare Markdown.
Mantieni le risposte sotto i 4000 caratteri.
Se non hai dati sufficienti, dillo chiaramente e onestamente.`

interface AIResponse {
    text: string
    success: boolean
}

/**
 * Ask a question to OpenRouter AI with organization data context
 */
export async function askAI(question: string, orgContext: any): Promise<AIResponse> {
    if (!OPENROUTER_API_KEY) {
        return {
            text: '⚠️ OpenRouter API Key non configurata. Aggiungi OPENROUTER_API_KEY nelle variabili d\'ambiente.',
            success: false,
        }
    }

    try {
        // Use structured text if available (new format), fallback to JSON dump
        const contextMessage = orgContext.structured_text || `DATA E ORA CORRENTE:
${JSON.stringify(orgContext.current_datetime, null, 2)}

RIEPILOGO:
${JSON.stringify(orgContext.summary, null, 2)}

FATTURATO / REVENUE:
${JSON.stringify(orgContext.revenue, null, 2)}

DISTRIBUZIONE PIPELINE:
${JSON.stringify(orgContext.stage_distribution, null, 2)}

CAMPAGNE:
${JSON.stringify(orgContext.campaigns, null, 2)}

ULTIMI LEAD:
${JSON.stringify(orgContext.recent_leads, null, 2)}

ULTIME OPERAZIONI:
${JSON.stringify(orgContext.recent_operations, null, 2)}`

        const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
                'HTTP-Referer': 'https://metodosincro.com',
                'X-Title': 'Metodo Sincro AI',
            },
            body: JSON.stringify({
                model: MODEL,
                messages: [
                    { role: 'system', content: SYSTEM_PROMPT },
                    { role: 'user', content: contextMessage },
                    { role: 'user', content: question },
                ],
                max_tokens: 2500,
                temperature: 0.3,
            }),
        })

        if (!res.ok) {
            const errorBody = await res.text()
            console.error('OpenRouter error:', res.status, errorBody)
            return {
                text: `⚠️ Errore OpenRouter (${res.status}). Riprova tra un momento.`,
                success: false,
            }
        }

        const data = await res.json()
        const reply = data.choices?.[0]?.message?.content

        if (!reply) {
            return {
                text: '⚠️ L\'AI non ha generato una risposta. Riprova.',
                success: false,
            }
        }

        return { text: reply, success: true }
    } catch (err) {
        console.error('OpenRouter call error:', err)
        return {
            text: '⚠️ Errore di connessione con OpenRouter. Riprova tra un momento.',
            success: false,
        }
    }
}

/**
 * Fast version for Telegram — less context, fewer tokens, quicker response
 */
export async function askAIFast(question: string, orgContext: any): Promise<AIResponse> {
    if (!OPENROUTER_API_KEY) {
        return { text: '⚠️ OpenRouter API Key non configurata.', success: false }
    }

    try {
        // Use structured text if available (accurate, pre-formatted), fallback to compact summary
        const ctx = orgContext.structured_text || `Oggi: ${orgContext.current_datetime?.date || 'N/A'}
Lead: ${orgContext.summary?.leads_today || 0} oggi, ${orgContext.summary?.leads_this_week || 0} settimana, ${orgContext.summary?.total_leads || 0} totali
Campagne attive: ${orgContext.summary?.active_campaigns || 0} | Spesa: €${orgContext.summary?.total_spend || 0} | CPL: €${orgContext.summary?.avg_cpl || 0}
Pipeline: ${(orgContext.stage_distribution || []).map((s: any) => `${s.name}:${s.count}`).join(', ')}
Ultimi lead: ${(orgContext.recent_leads || []).map((l: any) => `${l.name} (${l.stage}, ${l.created?.slice(0,10)})`).join('; ')}`

        const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
                'HTTP-Referer': 'https://metodosincro.com',
                'X-Title': 'Metodo Sincro AI',
            },
            body: JSON.stringify({
                model: MODEL,
                messages: [
                    { role: 'system', content: SYSTEM_PROMPT },
                    { role: 'user', content: ctx },
                    { role: 'user', content: question },
                ],
                max_tokens: 1500,
                temperature: 0.2,
            }),
        })

        if (!res.ok) {
            return { text: `⚠️ Errore AI (${res.status}). Riprova.`, success: false }
        }

        const data = await res.json()
        const reply = data.choices?.[0]?.message?.content
        return reply ? { text: reply, success: true } : { text: '⚠️ Nessuna risposta. Riprova.', success: false }
    } catch (err) {
        console.error('OpenRouter fast call error:', err)
        return { text: '⚠️ Errore connessione. Riprova.', success: false }
    }
}
