import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getOrgDataContext, sendTelegramDirect } from '@/lib/telegram'
import { textToSpeech } from '@/lib/elevenlabs'

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
)

// Daily Report — called every day at 20:00 by pg_cron
// Sends a voice summary of the day's performance
export const maxDuration = 60
export async function GET(req: NextRequest) {
    // Verify cron secret
    const authHeader = req.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
        // Get all orgs with active Telegram connections
        const { data: connections } = await supabaseAdmin
            .from('connections')
            .select('organization_id, credentials')
            .eq('provider', 'telegram')
            .eq('status', 'active')

        if (!connections?.length) {
            return NextResponse.json({ ok: true, message: 'No active connections' })
        }

        for (const conn of connections) {
            const orgId = conn.organization_id
            const botToken = conn.credentials?.bot_token
            const chatId = conn.credentials?.chat_id

            if (!botToken || !chatId) continue

            const ctx = await getOrgDataContext(orgId)
            const s = ctx.summary

            // Build the daily report
            const report = buildDailyReport(s, ctx)

            // Send text version
            await sendTelegramDirect(botToken, chatId, report)

            // Send voice version
            try {
                const audioBuffer = await textToSpeech(report)
                if (audioBuffer) {
                    await sendVoiceNote(botToken, chatId, audioBuffer)
                }
            } catch (e) {
                console.error('Daily report TTS error:', e)
            }
        }

        return NextResponse.json({ ok: true })
    } catch (err) {
        console.error('Daily report error:', err)
        return NextResponse.json({ error: 'Internal error' }, { status: 500 })
    }
}

function buildDailyReport(s: any, ctx: any): string {
    const now = new Date()
    const dateStr = now.toLocaleDateString('it-IT', {
        weekday: 'long', day: 'numeric', month: 'long'
    })

    let report = `📊 <b>Report Giornaliero — ${dateStr}</b>\n\n`
    report += `Ciao! Sono Dante, ecco il riepilogo della giornata:\n\n`
    report += `👥 <b>Lead oggi:</b> ${s.leads_today}\n`
    report += `📅 <b>Lead questa settimana:</b> ${s.leads_this_week}\n`
    report += `👥 <b>Lead totali:</b> ${s.total_leads}\n\n`
    report += `📢 <b>Campagne attive:</b> ${s.active_campaigns} su ${s.total_campaigns}\n`
    report += `💰 <b>Spesa totale:</b> €${s.total_spend}\n`
    report += `📉 <b>CPL medio:</b> €${s.avg_cpl}\n\n`

    if (ctx.stage_distribution.length > 0) {
        report += `📋 <b>Pipeline:</b>\n`
        report += ctx.stage_distribution.map((st: any) => `  • ${st.name}: <b>${st.count}</b>`).join('\n')
        report += '\n\n'
    }

    // Active campaigns summary
    const activeCampaigns = ctx.campaigns.filter((c: any) => c.status === 'ACTIVE')
    if (activeCampaigns.length > 0) {
        report += `🏆 <b>Top campagne attive:</b>\n`
        report += activeCampaigns.slice(0, 3).map((c: any) => {
            return `  • ${c.name || 'N/A'}: €${Number(c.spend || 0).toFixed(0)} spesi, ${c.leads || 0} lead, CPL €${Number(c.cpl || 0).toFixed(2)}`
        }).join('\n')
        report += '\n\n'
    }

    report += `<i>🤖 Report automatico di Dante — ore 20:00</i>`

    return report
}

async function sendVoiceNote(botToken: string, chatId: string, audioBuffer: Uint8Array): Promise<boolean> {
    try {
        const formData = new FormData()
        formData.append('chat_id', chatId)
        const blob = new Blob([audioBuffer as any], { type: 'audio/mpeg' })
        formData.append('voice', blob, 'report.mp3')

        const res = await fetch(`https://api.telegram.org/bot${botToken}/sendVoice`, {
            method: 'POST',
            body: formData,
        })
        const result = await res.json()
        return result.ok === true
    } catch (err) {
        console.error('Send voice note error:', err)
        return false
    }
}
