import { NextResponse } from 'next/server'
import { sendTelegramMessage } from '@/lib/telegram'

export async function POST(req: Request) {
    try {
        const body = await req.json()
        
        // Ensure this is an INSERT or UPDATE from the ai_episodes table
        if (body.table !== 'ai_episodes' || !body.record) {
            return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
        }

        const episode = body.record
        
        // We only care about pending episodes or actions that just occurred
        // We can optionally filter here, but we'll notify for all insertions for transparency.
        
        const orgId = episode.organization_id
        if (!orgId) {
            return NextResponse.json({ error: 'No organization_id in record' }, { status: 400 })
        }

        // Format a clear emoji-based telegram message
        let actionEmoji = '🤖'
        if (episode.action_type === 'pause_campaign') actionEmoji = '🛑'
        else if (episode.action_type === 'budget_scale_up') actionEmoji = '📈'
        else if (episode.action_type === 'budget_scale_down') actionEmoji = '📉'

        let outcomeStr = 'Inizio azione...'
        if (episode.outcome === 'pending') outcomeStr = '⏳ <i>In attesa (Pending)</i>'
        else if (episode.outcome === 'success') outcomeStr = '✅ <i>Completato</i>'
        else if (episode.outcome === 'failed') outcomeStr = '❌ <i>Fallito</i>'

        const tgMsg = `
${actionEmoji} <b>Hermes AI Alert</b> ${actionEmoji}

<b>Azione:</b> <code>${episode.action_type}</code>
<b>Target:</b> <b>${episode.target_name || episode.target_id || 'Sconosciuto'}</b>
<b>Stato:</b> ${outcomeStr}

<b>Analisi di Hermes:</b>
<i>"${episode.reasoning || 'Nessun commento aggiunto.'}"</i>
`

        // Send the message using the existing lib function
        const sent = await sendTelegramMessage(orgId, tgMsg.trim())

        if (!sent) {
            console.error('Failed to send Telegram message for episode:', episode.id)
            return NextResponse.json({ error: 'Failed to send telegram message' }, { status: 500 })
        }

        return NextResponse.json({ success: true })

    } catch (err: any) {
        console.error('API Error in notify-episode:', err)
        return NextResponse.json({ error: err.message }, { status: 500 })
    }
}
