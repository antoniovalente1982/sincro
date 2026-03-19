import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { findOrgByChatId, getOrgDataContextLite, sendTelegramDirect } from '@/lib/telegram'
import { askAI, askAIFast } from '@/lib/openrouter'
import { textToSpeech, speechToText } from '@/lib/elevenlabs'

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
)

// Allow up to 60s for AI responses (default 10s causes timeouts)
export const maxDuration = 60

// Telegram Webhook — receives messages from the bot
// This endpoint must be public (no auth) since Telegram calls it
export async function POST(req: NextRequest) {
    try {
        const body = await req.json()

        // Telegram sends updates in this format
        const message = body.message || body.edited_message
        if (!message?.chat?.id) {
            return NextResponse.json({ ok: true })
        }

        const chatId = String(message.chat.id)
        const firstName = message.from?.first_name || 'Utente'

        // Check if it's a voice message or text
        const isVoice = !!(message.voice || message.audio)
        const hasText = !!message.text

        if (!isVoice && !hasText) {
            return NextResponse.json({ ok: true }) // Ignore non-text/non-voice
        }

        // Find which organization this chat belongs to
        const orgId = await findOrgByChatId(chatId)
        if (!orgId) {
            console.log(`Telegram webhook: no org found for chat_id ${chatId}`)
            return NextResponse.json({ ok: true })
        }

        // Get the bot token for this org to reply
        const { data: conn } = await supabaseAdmin
            .from('connections')
            .select('credentials')
            .eq('organization_id', orgId)
            .eq('provider', 'telegram')
            .eq('status', 'active')
            .single()

        if (!conn?.credentials?.bot_token) {
            return NextResponse.json({ ok: true })
        }

        const botToken = conn.credentials.bot_token

        // Handle voice message
        if (isVoice) {
            await handleVoiceMessage(message, orgId, botToken, chatId, firstName)
            return NextResponse.json({ ok: true })
        }

        // Handle text commands
        const text = message.text.trim()
        if (text.startsWith('/')) {
            await handleCommand(text, orgId, botToken, chatId, firstName)
            return NextResponse.json({ ok: true })
        }

        // Check if it's a scheduling request (e.g., "riepilogo alle 10", "chiamami alle 15:30")
        const scheduleResult = await tryScheduleReport(text, orgId, botToken, chatId)
        if (scheduleResult) {
            return NextResponse.json({ ok: true })
        }

        // Check if text requests voice response
        const wantsVoice = detectVoiceRequest(text)

        // Free-form text question → use fast mode (text only, no voice for speed)
        await handleAIQuestionFast(text, orgId, botToken, chatId, firstName)

        return NextResponse.json({ ok: true })
    } catch (err) {
        console.error('Telegram webhook error:', err)
        return NextResponse.json({ ok: true }) // Always return 200 to Telegram
    }
}

// Also handle GET for webhook verification
export async function GET() {
    return NextResponse.json({ status: 'Telegram webhook active' })
}

// --- Response Mode Detection ---

// Keywords that force text response (even from voice)
const TEXT_KEYWORDS = ['scrivi', 'scritta', 'scritto', 'scrivimi', 'testo', 'testuale', 'rispondi per scritto', 'risposta scritta']
// Keywords that force voice response (even from text)
const VOICE_KEYWORDS = ['vocale', 'voce', 'parlami', 'dimmi a voce', 'rispondi a voce', 'rispondi vocale', 'audio', 'parla']

type ResponseMode = 'text' | 'voice'

function detectTextRequest(text: string): boolean {
    const lower = text.toLowerCase()
    return TEXT_KEYWORDS.some(kw => lower.includes(kw))
}

function detectVoiceRequest(text: string): boolean {
    const lower = text.toLowerCase()
    return VOICE_KEYWORDS.some(kw => lower.includes(kw))
}

// --- Voice Message Handler ---

async function handleVoiceMessage(message: any, orgId: string, botToken: string, chatId: string, firstName: string) {
    // Send "recording voice" action
    await fetch(`https://api.telegram.org/bot${botToken}/sendChatAction`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, action: 'record_voice' }),
    })

    const voiceData = message.voice || message.audio
    const fileId = voiceData.file_id

    try {
        // Step 1: Get file path from Telegram
        const fileRes = await fetch(`https://api.telegram.org/bot${botToken}/getFile?file_id=${fileId}`)
        const fileInfo = await fileRes.json()

        if (!fileInfo.ok || !fileInfo.result?.file_path) {
            await sendTelegramDirect(botToken, chatId, '⚠️ Non riesco a scaricare il vocale. Riprova.')
            return
        }

        // Step 2: Download the voice file
        const fileUrl = `https://api.telegram.org/file/bot${botToken}/${fileInfo.result.file_path}`
        const audioRes = await fetch(fileUrl)
        const audioBuffer = new Uint8Array(await audioRes.arrayBuffer())

        // Step 3: Transcribe voice to text using ElevenLabs STT
        const transcribedText = await speechToText(audioBuffer, 'audio/ogg')

        if (!transcribedText) {
            await sendTelegramDirect(botToken, chatId, '⚠️ Non ho capito il vocale. Puoi ripetere o scrivere la domanda?')
            return
        }

        // Step 4: Detect response mode
        // Default for voice = voice response, unless user explicitly asks for text
        const wantsText = detectTextRequest(transcribedText)
        const mode: ResponseMode = wantsText ? 'text' : 'voice'

        // Step 5: Process as AI question with the right mode
        await handleAIQuestion(transcribedText, orgId, botToken, chatId, firstName, mode)

    } catch (err) {
        console.error('Voice message handling error:', err)
        await sendTelegramDirect(botToken, chatId, '⚠️ Errore nell\'elaborazione del vocale. Prova a scrivere la domanda.')
    }
}

// --- Send voice note to Telegram ---

async function sendVoiceNote(botToken: string, chatId: string, audioBuffer: Uint8Array): Promise<boolean> {
    try {
        const formData = new FormData()
        formData.append('chat_id', chatId)
        const blob = new Blob([audioBuffer as any], { type: 'audio/mpeg' })
        formData.append('voice', blob, 'response.mp3')

        const res = await fetch(`https://api.telegram.org/bot${botToken}/sendVoice`, {
            method: 'POST',
            body: formData,
        })

        const result = await res.json()
        if (!result.ok) {
            console.error('Telegram sendVoice error:', result.description)
        }
        return result.ok === true
    } catch (err) {
        console.error('Send voice note error:', err)
        return false
    }
}

// --- Command Handlers ---

async function handleCommand(text: string, orgId: string, botToken: string, chatId: string, firstName: string) {
    const cmd = text.split(' ')[0].toLowerCase().replace('@', '').split('@')[0]

    switch (cmd) {
        case '/start':
        case '/help':
            await sendTelegramDirect(botToken, chatId, getHelpMessage(firstName))
            break

        case '/stats':
            await handleStatsCommand(orgId, botToken, chatId)
            break

        case '/leads':
            await handleLeadsCommand(orgId, botToken, chatId)
            break

        case '/campagne':
        case '/campaigns':
            await handleCampaignsCommand(orgId, botToken, chatId)
            break

        case '/pipeline':
            await handlePipelineCommand(orgId, botToken, chatId)
            break

        default:
            await sendTelegramDirect(botToken, chatId,
                '❓ Comando non riconosciuto. Usa /help per la lista comandi, oppure scrivi direttamente la tua domanda!')
            break
    }
}

function getHelpMessage(name: string): string {
    return `👋 <b>Ciao ${name}!</b>\n\nSono <b>Dante</b>, l'assistente AI di <b>Metodo Sincro</b>. Ecco cosa posso fare:\n\n` +
        `📊 <b>Comandi rapidi:</b>\n` +
        `  /stats — Riepilogo generale\n` +
        `  /leads — Ultimi lead ricevuti\n` +
        `  /campagne — Performance campagne\n` +
        `  /pipeline — Distribuzione pipeline\n` +
        `  /help — Questo messaggio\n\n` +
        `🤖 <b>Domande libere:</b>\n` +
        `Puoi chiedermi qualsiasi cosa sui tuoi dati!\n` +
        `Esempi:\n` +
        `  • <i>"Quanti lead ho ricevuto oggi?"</i>\n` +
        `  • <i>"Come vanno le campagne?"</i>\n` +
        `  • <i>"Qual è il CPL medio?"</i>\n` +
        `  • <i>"Consigliami come ottimizzare il budget"</i>\n\n` +
        `🎙️ <b>Voce:</b>\n` +
        `Invia un vocale e ti rispondo con un vocale!\n\n` +
        `💡 Scrivi o parla e Dante ti risponde in tempo reale!`
}

async function handleStatsCommand(orgId: string, botToken: string, chatId: string) {
    const ctx = await getOrgDataContextLite(orgId)
    const s = ctx.summary

    const msg = `📊 <b>Riepilogo Metodo Sincro</b>\n\n` +
        `👥 <b>Lead totali:</b> ${s.total_leads}\n` +
        `📥 <b>Lead oggi:</b> ${s.leads_today}\n` +
        `📅 <b>Lead ultimi 7 giorni:</b> ${s.leads_this_week}\n\n` +
        `📢 <b>Campagne attive:</b> ${s.active_campaigns}\n` +
        `💰 <b>Spesa totale:</b> €${s.total_spend}\n` +
        `📉 <b>CPL medio:</b> €${s.avg_cpl}\n\n` +
        (ctx.stage_distribution.length > 0
            ? `📋 <b>Pipeline:</b>\n` + ctx.stage_distribution.map(st => `  • ${st.name}: <b>${st.count}</b>`).join('\n')
            : `📋 <i>Nessun lead in pipeline</i>`)

    await sendTelegramDirect(botToken, chatId, msg)
}

async function handleLeadsCommand(orgId: string, botToken: string, chatId: string) {
    const ctx = await getOrgDataContextLite(orgId)

    if (ctx.recent_leads.length === 0) {
        await sendTelegramDirect(botToken, chatId, '📭 Nessun lead trovato. I lead appariranno qui quando arriveranno dai tuoi funnel.')
        return
    }

    const msg = `📥 <b>Ultimi ${Math.min(ctx.recent_leads.length, 10)} Lead</b>\n\n` +
        ctx.recent_leads.slice(0, 10).map((l, i) => {
            const date = new Date(l.created).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
            return `${i + 1}. <b>${l.name}</b>\n   📍 ${l.stage} • 📡 ${l.source}\n   🕐 ${date}`
        }).join('\n\n')

    await sendTelegramDirect(botToken, chatId, msg)
}

async function handleCampaignsCommand(orgId: string, botToken: string, chatId: string) {
    const ctx = await getOrgDataContextLite(orgId)

    if (ctx.campaigns.length === 0) {
        await sendTelegramDirect(botToken, chatId, '📢 Nessuna campagna trovata. Collega Meta Ads dalla dashboard per sincronizzare le campagne.')
        return
    }

    const msg = `📢 <b>Campagne (${ctx.campaigns.length})</b>\n\n` +
        ctx.campaigns.map(c => {
            const status = c.status === 'ACTIVE' ? '🟢' : c.status === 'PAUSED' ? '🟡' : '🔴'
            return `${status} <b>${c.name || 'Senza nome'}</b>\n` +
                `   💰 Spesa: €${Number(c.spend || 0).toFixed(2)} • CPL: €${Number(c.cpl || 0).toFixed(2)}\n` +
                `   👥 Lead: ${c.leads || 0} • CTR: ${Number(c.ctr || 0).toFixed(2)}%`
        }).join('\n\n')

    await sendTelegramDirect(botToken, chatId, msg)
}

async function handlePipelineCommand(orgId: string, botToken: string, chatId: string) {
    const ctx = await getOrgDataContextLite(orgId)

    if (ctx.stage_distribution.length === 0) {
        await sendTelegramDirect(botToken, chatId, '📋 Pipeline vuota. I lead verranno distribuiti negli stage automaticamente.')
        return
    }

    const total = ctx.stage_distribution.reduce((s, st) => s + st.count, 0)
    const msg = `📋 <b>Pipeline — ${total} lead totali</b>\n\n` +
        ctx.stage_distribution.map(st => {
            const pct = total > 0 ? ((st.count / total) * 100).toFixed(0) : '0'
            const bar = '█'.repeat(Math.max(1, Math.round(st.count / total * 10)))
            return `${bar} <b>${st.name}</b>: ${st.count} (${pct}%)`
        }).join('\n')

    await sendTelegramDirect(botToken, chatId, msg)
}

// --- AI Handler (fast, text-only for Hobby timeout) ---

async function handleAIQuestionFast(question: string, orgId: string, botToken: string, chatId: string, firstName: string) {
    // Send typing indicator
    await fetch(`https://api.telegram.org/bot${botToken}/sendChatAction`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, action: 'typing' }),
    })

    // Use lightweight context (3 queries instead of 7)
    const ctx = await getOrgDataContextLite(orgId)

    // Use fast AI (compact context, fewer tokens)
    const response = await askAIFast(question, ctx)

    const header = response.success ? '🤖' : '⚠️'
    await sendTelegramDirect(botToken, chatId, `${header} ${response.text}`)
}

// --- AI Handler (full, for voice messages — kept for voice responses) ---

async function handleAIQuestion(question: string, orgId: string, botToken: string, chatId: string, firstName: string, mode: ResponseMode) {
    await fetch(`https://api.telegram.org/bot${botToken}/sendChatAction`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, action: mode === 'voice' ? 'record_voice' : 'typing' }),
    })

    const ctx = await getOrgDataContextLite(orgId)
    const response = await askAIFast(question, ctx)

    if (mode === 'voice' && response.success) {
        await fetch(`https://api.telegram.org/bot${botToken}/sendChatAction`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: chatId, action: 'upload_voice' }),
        })

        const audioBuffer = await textToSpeech(response.text)
        if (audioBuffer) {
            await sendVoiceNote(botToken, chatId, audioBuffer)
        } else {
            await sendTelegramDirect(botToken, chatId, `🤖 ${response.text}`)
        }
    } else {
        const header = response.success ? '🤖' : '⚠️'
        await sendTelegramDirect(botToken, chatId, `${header} ${response.text}`)
    }
}

// --- Scheduling Handler ---

const SCHEDULE_PATTERNS = [
    /(?:riepilogo|report|riassunto|chiamami|avvisami|ricordami)\s+(?:alle|alle ore|per le|a le)\s+(\d{1,2})(?::(\d{2}))?/i,
    /(?:alle|ore)\s+(\d{1,2})(?::(\d{2}))?\s+(?:riepilogo|report|riassunto|chiamami)/i,
]

async function tryScheduleReport(text: string, orgId: string, botToken: string, chatId: string): Promise<boolean> {
    const lower = text.toLowerCase()

    // Check if this looks like a scheduling request
    const isScheduleRequest = lower.includes('riepilogo') || lower.includes('report') ||
        lower.includes('chiamami') || lower.includes('avvisami') || lower.includes('ricordami')

    if (!isScheduleRequest) return false

    // Try to extract time
    let hours: number | null = null
    let minutes = 0

    for (const pattern of SCHEDULE_PATTERNS) {
        const match = lower.match(pattern)
        if (match) {
            hours = parseInt(match[1])
            minutes = match[2] ? parseInt(match[2]) : 0
            break
        }
    }

    if (hours === null || hours < 0 || hours > 23) return false

    // Detect recurrence
    const isDaily = lower.includes('ogni giorno') || lower.includes('tutti i giorni') ||
        lower.includes('quotidiano') || lower.includes('giornaliero') ||
        lower.includes('sempre')

    // Detect report type
    let reportType = 'summary'
    if (lower.includes('ads') || lower.includes('az') || lower.includes('campagn')) reportType = 'ads'
    else if (lower.includes('lead')) reportType = 'leads'
    else if (lower.includes('pipeline') || lower.includes('vendita')) reportType = 'pipeline'

    const timeStr = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`

    try {
        // Save to database
        await supabaseAdmin
            .from('scheduled_reports')
            .insert({
                organization_id: orgId,
                scheduled_time: timeStr,
                recurrence: isDaily ? 'daily' : 'once',
                report_type: reportType,
                status: 'pending',
            })

        const timeLabel = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
        const recurrenceLabel = isDaily ? ' ogni giorno' : ''
        const typeLabel = reportType === 'ads' ? ' sulle ADS' :
            reportType === 'leads' ? ' sui lead' :
                reportType === 'pipeline' ? ' sulla pipeline' : ' generale'

        await sendTelegramDirect(botToken, chatId,
            `✅ <b>Report programmato!</b>\n\n` +
            `🕐 Dante ti manderà un vocale${typeLabel} alle <b>${timeLabel}</b>${recurrenceLabel}.\n\n` +
            `<i>Per annullare, scrivi "annulla report"</i>`)

        return true
    } catch (err) {
        console.error('Schedule report error:', err)
        return false
    }
}
