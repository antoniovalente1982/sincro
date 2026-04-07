import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendTelegramDirect } from '@/lib/telegram'

function getSupabaseAdmin() {
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!serviceKey) {
        console.error('SUPABASE_SERVICE_ROLE_KEY is missing.')
    }
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        serviceKey || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    )
}

// ADS Monitor / Hermes Courier 
// Runs every 30 or 60 minutes. Reads recent AI logs and forwards them to Telegram.
export const maxDuration = 60
export async function GET(req: NextRequest) {
    const authHeader = req.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
        const supabase = getSupabaseAdmin()

        const { data: connections } = await supabase
            .from('connections')
            .select('organization_id, credentials')
            .eq('provider', 'telegram')
            .eq('status', 'active')

        if (!connections?.length) {
            return NextResponse.json({ ok: true, message: 'No active connections' })
        }

        let alertsSent = 0
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()

        for (const conn of connections) {
            const orgId = conn.organization_id
            const botToken = conn.credentials?.bot_token
            const chatId = conn.credentials?.chat_id

            if (!botToken || !chatId) continue

            // Fetch logs generated in the last hour
            const { data: logs } = await supabase
                .from('ai_realtime_logs')
                .select('*, ai_agents!agent_id(name, role)')
                .eq('organization_id', orgId)
                .gte('created_at', oneHourAgo)
                .order('created_at', { ascending: true })

            if (!logs || logs.length === 0) continue

            // Build Telegram Courier Message
            let msg = `🤖 <b>Diario di Bordo Swarm</b>\n<i>Ultime Operazioni AI</i>\n\n`
            
            logs.forEach(log => {
                const time = new Date(log.created_at).toLocaleTimeString('it-IT', { hour: '2-digit', minute:'2-digit', timeZone: 'Europe/Rome'})
                const agentName = log.ai_agents?.name || 'SYSTEM'
                
                msg += `🕒 <b>${time} - ${agentName}</b>\n`
                msg += `Azione: <i>${log.action}</i>\n`
                if (log.thought_process) {
                    msg += `✍️ "${log.thought_process}"\n`
                }
                msg += `\n`
            })

            await sendTelegramDirect(botToken, chatId, msg)
            alertsSent++
        }

        return NextResponse.json({ ok: true, alertsSent })
    } catch (err) {
        console.error('Courier monitor error:', err)
        return NextResponse.json({ error: 'Internal error' }, { status: 500 })
    }
}
