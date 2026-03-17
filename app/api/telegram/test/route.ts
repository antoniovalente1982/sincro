import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendTelegramDirect } from '@/lib/telegram'

// POST — Test a Telegram connection or set webhook
export async function POST(req: NextRequest) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const { action, bot_token, chat_id } = body

    if (action === 'test') {
        // Test the connection by sending a message
        if (!bot_token || !chat_id) {
            return NextResponse.json({ error: 'bot_token and chat_id required' }, { status: 400 })
        }

        const msg = `✅ <b>Connessione riuscita!</b>\n\n` +
            `Il tuo bot Telegram è collegato a <b>Metodo Sincro</b>.\n\n` +
            `Scrivi /help per vedere i comandi disponibili, oppure fai una domanda direttamente!`

        const success = await sendTelegramDirect(bot_token, chat_id, msg)

        if (success) {
            return NextResponse.json({ success: true, message: 'Messaggio di test inviato!' })
        } else {
            return NextResponse.json({ error: 'Invio fallito. Controlla Bot Token e Chat ID.' }, { status: 400 })
        }
    }

    if (action === 'set_webhook') {
        // Set the Telegram webhook URL  
        if (!bot_token) {
            return NextResponse.json({ error: 'bot_token required' }, { status: 400 })
        }

        // Build the webhook URL from the current host
        const host = req.headers.get('host') || 'localhost:3000'
        const protocol = host.includes('localhost') ? 'http' : 'https'
        const webhookUrl = `${protocol}://${host}/api/telegram/webhook`

        try {
            const res = await fetch(`https://api.telegram.org/bot${bot_token}/setWebhook`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: webhookUrl }),
            })
            const result = await res.json()

            if (result.ok) {
                return NextResponse.json({ success: true, webhook_url: webhookUrl })
            } else {
                return NextResponse.json({ error: result.description || 'Webhook setup failed' }, { status: 400 })
            }
        } catch (err) {
            return NextResponse.json({ error: 'Failed to set webhook' }, { status: 500 })
        }
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
