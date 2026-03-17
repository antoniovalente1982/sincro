import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { findOrgByChatId, getOrgDataContext, sendTelegramDirect } from '@/lib/telegram'
import { askAI } from '@/lib/openrouter'

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
)

// Telegram Webhook — receives messages from the bot
// This endpoint must be public (no auth) since Telegram calls it
export async function POST(req: NextRequest) {
    try {
        const body = await req.json()

        // Telegram sends updates in this format
        const message = body.message || body.edited_message
        if (!message?.text || !message?.chat?.id) {
            return NextResponse.json({ ok: true }) // Acknowledge but ignore non-text
        }

        const chatId = String(message.chat.id)
        const text = message.text.trim()
        const firstName = message.from?.first_name || 'Utente'

        // Find which organization this chat belongs to
        const orgId = await findOrgByChatId(chatId)
        if (!orgId) {
            console.log(`Telegram webhook: no org found for chat_id ${chatId}`)
            return NextResponse.json({ ok: true }) // Silently ignore unknown chats
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

        // Handle commands
        if (text.startsWith('/')) {
            await handleCommand(text, orgId, botToken, chatId, firstName)
            return NextResponse.json({ ok: true })
        }

        // Free-form question → AI response
        await handleAIQuestion(text, orgId, botToken, chatId, firstName)

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
    return `👋 <b>Ciao ${name}!</b>\n\nSono l'assistente AI di <b>Metodo Sincro</b>. Ecco cosa posso fare:\n\n` +
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
        `💡 Scrivi la tua domanda e ti rispondo in tempo reale con dati aggiornati!`
}

async function handleStatsCommand(orgId: string, botToken: string, chatId: string) {
    const ctx = await getOrgDataContext(orgId)
    const s = ctx.summary

    const msg = `📊 <b>Riepilogo Metodo Sincro</b>\n\n` +
        `👥 <b>Lead totali:</b> ${s.total_leads}\n` +
        `📥 <b>Lead oggi:</b> ${s.leads_today}\n` +
        `📅 <b>Lead ultimi 7 giorni:</b> ${s.leads_this_week}\n\n` +
        `📢 <b>Campagne:</b> ${s.active_campaigns} attive / ${s.total_campaigns} totali\n` +
        `💰 <b>Spesa totale:</b> €${s.total_spend}\n` +
        `📉 <b>CPL medio:</b> €${s.avg_cpl}\n\n` +
        (ctx.stage_distribution.length > 0
            ? `📋 <b>Pipeline:</b>\n` + ctx.stage_distribution.map(st => `  • ${st.name}: <b>${st.count}</b>`).join('\n')
            : `📋 <i>Nessun lead in pipeline</i>`)

    await sendTelegramDirect(botToken, chatId, msg)
}

async function handleLeadsCommand(orgId: string, botToken: string, chatId: string) {
    const ctx = await getOrgDataContext(orgId)

    if (ctx.recent_leads.length === 0) {
        await sendTelegramDirect(botToken, chatId, '📭 Nessun lead trovato. I lead appariranno qui quando arriveranno dai tuoi funnel.')
        return
    }

    const msg = `📥 <b>Ultimi ${Math.min(ctx.recent_leads.length, 10)} Lead</b>\n\n` +
        ctx.recent_leads.slice(0, 10).map((l, i) => {
            const date = new Date(l.created).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
            return `${i + 1}. <b>${l.name}</b>\n   📍 ${l.stage} • 📡 ${l.source}\n   🕐 ${date}${l.value ? ` • 💰 €${l.value}` : ''}`
        }).join('\n\n')

    await sendTelegramDirect(botToken, chatId, msg)
}

async function handleCampaignsCommand(orgId: string, botToken: string, chatId: string) {
    const ctx = await getOrgDataContext(orgId)

    if (ctx.campaigns.length === 0) {
        await sendTelegramDirect(botToken, chatId, '📢 Nessuna campagna trovata. Collega Meta Ads dalla dashbaord per sincronizzare le campagne.')
        return
    }

    const msg = `📢 <b>Campagne (${ctx.campaigns.length})</b>\n\n` +
        ctx.campaigns.map(c => {
            const status = c.status === 'ACTIVE' ? '🟢' : c.status === 'PAUSED' ? '🟡' : '🔴'
            return `${status} <b>${c.name || 'Senza nome'}</b>\n` +
                `   💰 Spesa: €${Number(c.spend || 0).toFixed(2)} • CPL: €${Number(c.cpl || 0).toFixed(2)}\n` +
                `   👥 Lead: ${c.leads || 0} • CTR: ${Number(c.ctr || 0).toFixed(2)}%` +
                (c.roas ? ` • ROAS: ${Number(c.roas).toFixed(1)}x` : '')
        }).join('\n\n')

    await sendTelegramDirect(botToken, chatId, msg)
}

async function handlePipelineCommand(orgId: string, botToken: string, chatId: string) {
    const ctx = await getOrgDataContext(orgId)

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

// --- AI Handler ---

async function handleAIQuestion(question: string, orgId: string, botToken: string, chatId: string, firstName: string) {
    // Send "typing" indicator
    await fetch(`https://api.telegram.org/bot${botToken}/sendChatAction`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, action: 'typing' }),
    })

    // Get org data context
    const ctx = await getOrgDataContext(orgId)

    // Ask AI
    const response = await askAI(question, ctx)

    // Send response, with a header
    const header = response.success ? '🤖' : '⚠️'
    await sendTelegramDirect(botToken, chatId, `${header} ${response.text}`)
}
