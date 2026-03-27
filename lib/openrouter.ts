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
- Sii CONCISO. Rispondi con le info essenziali. Dettagli extra solo se chiesti esplicitamente.
- Scrivi SEMPRE \"euro\" in parole DOPO la cifra, MAI il simbolo €. Esempio: \"225,23 euro\" non \"€225,23\" e non \"euro 225\". Lo stesso per dollari e sterline. La valuta va SEMPRE dopo il numero.

CONTESTO CONVERSAZIONE:
- Hai memoria degli ultimi messaggi della chat. Usala per capire il contesto.
- Se Anto dice "spostalo", "spostala", "questo lead", "lei", "lui" → si riferisce al lead menzionato nei messaggi precedenti. NON chiedere di nuovo il nome.
- Se hai appena cercato/trovato un lead e Anto chiede un'azione su di esso → usa il nome del lead dalla conversazione precedente.
- Esempio: se hai appena trovato "Daniela Azzalin" e Anto dice "spostala in appuntamento" → esegui move_lead per "Daniela Azzalin" senza chiedere il nome.

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
- I lead nella tua finestra sono gli ULTIMI 15 — ma nel CRM ci sono MOLTI PIÙ lead.
- Se Anto chiede "chi è l'ultimo lead?" → rispondi con il PRIMO lead nella lista.
- Se chiede info su un lead specifico → cerca PRIMA nei lead visibili per nome, telefono, email.
- Se NON lo trovi nei lead visibili, USA SUBITO l'azione search_lead per cercarlo nel database completo.
- NON dire MAI "non ho trovato il lead" senza prima aver usato search_lead.
- Se il lead ha eta_figlio, comunicalo quando rilevante.

FATTURATO / REVENUE:
- Il fatturato lo trovi nella sezione "revenue" dei dati.
- Si calcola dai lead nello stage "Vendita" (is_won=true) che hanno un valore associato.
- NON confondere "lead" con "fatturato". Leads = contatti. Fatturato = vendite chiuse con valore economico.

AI ENGINE / PILOTA AUTOMATICO:
- Quando Anto chiede "il pilota automatico è attivo?", "l'AI Engine è attivo?", "è in live?" → guarda la sezione AI ENGINE nei dati.
- autopilot_active = il sistema è acceso/spento. execution_mode = 'live' (esegue azioni reali) o 'dry_run' (simula senza eseguire).
- Auto-Pause, Auto-Scale, Creative Refresh sono le funzionalità singole.

AZIONI DISPONIBILI:
Puoi eseguire azioni operative se Anto lo chiede. Le azioni richiedono SEMPRE la doppia conferma.
Quando rilevi che Anto vuole eseguire un'azione, rispondi con un messaggio di conferma E includi un tag JSON in fondo al messaggio nel formato:
[ACTION:{"type":"TIPO","params":{...}}]

Azioni disponibili:
1. move_lead — Sposta un lead in un altro stage (es. "sposta Mario in appuntamento", "sposta X in vendita platinum 2250€")
   [ACTION:{"type":"move_lead","params":{"lead_name":"Mario Rossi","target_stage":"Appuntamento","product":null,"value":null}}]
   Per le vendite con prodotto: [ACTION:{"type":"move_lead","params":{"lead_name":"Mario Rossi","target_stage":"Vendita","product":"Platinum","value":2250}}]

2. assign_lead — Assegna un lead a un membro del team (es. "assegna Mario a Marco")
   [ACTION:{"type":"assign_lead","params":{"lead_name":"Mario Rossi","assignee_name":"Marco"}}]

3. toggle_autopilot — Attiva/disattiva il pilota automatico (es. "attiva l'autopilot", "spegni il pilota automatico")
   [ACTION:{"type":"toggle_autopilot","params":{"active":true}}]

4. search_lead — Cerca un lead nel database COMPLETO per nome, email o telefono. ⚡ NON richiede conferma, viene eseguito subito.
   [ACTION:{"type":"search_lead","params":{"query":"Mario"}}]
   USA QUESTO ogni volta che Anto chiede info su un lead che NON trovi nei 15 visibili.

STAGE DELLA PIPELINE (in ordine):
La pipeline principale è: Lead → Appuntamento → Show-up → Vendita → Perso
- "Lead" = nuovo contatto
- "Appuntamento" = ha fissato una call
- "Show-up" = si è presentato alla call (ATTENZIONE: lo stage si chiama ESATTAMENTE "Show-up" con il trattino!)
- "Vendita" = ha comprato (richiede prodotto e valore €)
- "Perso" = perso/non interessato

MAPPATURA VOCALE — quando Anto dice a voce:
- "show up", "scioup", "show-up", "showup" → target_stage = "Show-up"
- "appuntamento", "call" → target_stage = "Appuntamento"
- "vendita", "venduto", "chiuso" → target_stage = "Vendita"
- "perso", "non interessato" → target_stage = "Perso"
- "lead" → target_stage = "Lead"

REGOLE AZIONI:
- USA SEMPRE il nome ESATTO dello stage nel tag ACTION (es. "Show-up" con il trattino, non "Show Up").
- CERCA SEMPRE il lead nei dati disponibili prima di proporre l'azione. Se non lo trovi, dì che non lo hai trovato.
- Il tag [ACTION:...] DEVE essere l'ultimissima riga del messaggio, dopo il testo di conferma.
- Il messaggio di conferma deve riassumere ESATTAMENTE cosa stai per fare. Sii specifico col nome del lead e lo stage.
- Se Anto chiede un'azione ma mancano dettagli (es. "sposta Mario" ma non dice dove), CHIEDI chiarimenti senza tag ACTION.
- NON eseguire mai azioni senza il tag ACTION — il sistema gestisce automaticamente la conferma.
- Per Vendita: se Anto non specifica prodotto/prezzo, chiedili prima.

IMPORTANTE:
- Rispondi SEMPRE. Non lasciare mai un messaggio senza risposta.
- Quando Anto chiede azioni NON supportate (creare campagne, modificare codice, cambiare budget), digli che deve passare da Antigravity.
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
 * Optional `history` param includes recent conversation messages for context
 */
export async function askAIFast(question: string, orgContext: any, history?: { role: 'user' | 'assistant'; content: string }[]): Promise<AIResponse> {
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

        // Build messages array with conversation history
        const messages: { role: string; content: string }[] = [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: ctx },
        ]

        // Insert recent conversation history for context continuity
        if (history && history.length > 0) {
            for (const msg of history) {
                messages.push({ role: msg.role, content: msg.content })
            }
        }

        // Current question
        messages.push({ role: 'user', content: question })

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
                messages,
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
