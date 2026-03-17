const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY
const MODEL = 'google/gemini-2.5-flash-preview'

const SYSTEM_PROMPT = `Sei l'assistente AI di Metodo Sincro, una piattaforma di gestione campagne pubblicitarie e CRM.
Rispondi SEMPRE in italiano. Sei un analista marketing esperto.

Il tuo compito è analizzare i dati dell'organizzazione e rispondere alle domande dell'utente in modo:
- Chiaro e conciso
- Con numeri precisi quando disponibili
- Con consigli pratici e azionabili
- Usando emoji per rendere il messaggio leggibile su Telegram

Formatta le risposte per Telegram (usa HTML): <b>grassetto</b>, <i>corsivo</i>, <code>codice</code>.
Non usare Markdown, solo HTML.
Mantieni le risposte sotto i 4000 caratteri.

Se non hai dati sufficienti per rispondere, dillo chiaramente e suggerisci cosa fare.`

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
        const contextMessage = `Ecco i dati aggiornati dell'organizzazione:

RIEPILOGO:
${JSON.stringify(orgContext.summary, null, 2)}

DISTRIBUZIONE PIPELINE:
${JSON.stringify(orgContext.stage_distribution, null, 2)}

CAMPAGNE:
${JSON.stringify(orgContext.campaigns, null, 2)}

ULTIMI LEAD:
${JSON.stringify(orgContext.recent_leads, null, 2)}`

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
                max_tokens: 1500,
                temperature: 0.7,
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
