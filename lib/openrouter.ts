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

VOCABOLARIO:
- "AZ" = ADS = campagne pubblicitarie. Quando Anto dice "AZ" intende le ADS. Tu dì sempre "ADS" nella risposta, non "AZ".
- "CPL" = Costo Per Lead
- "ROAS" = Return On Ad Spend
- "CTR" = Click Through Rate

IMPORTANTE:
- Quando Anto ti chiede qualcosa che richiede intervento tecnico sul codice o creazione di campagne, digli che deve parlare con Antigravity (il sistema di sviluppo) per farlo. Tu puoi analizzare, consigliare e monitorare, ma le azioni operative le fa Antigravity.
- Se Anto chiede "puoi creare una campagna?" rispondi: "Anto, per creare campagne o fare modifiche tecniche devi passare da Antigravity. Io ti do l'analisi e la strategia!"

Formattazione: usa HTML per Telegram: <b>grassetto</b>, <i>corsivo</i>. Non usare Markdown.
Mantieni le risposte sotto i 4000 caratteri.
Se non hai dati sufficienti, dillo chiaramente.`

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
