import { NextRequest, NextResponse } from 'next/server'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { getOrgDataContext, sendTelegramDirect } from '@/lib/telegram'
import { askAI } from '@/lib/openrouter'
import { textToSpeech } from '@/lib/elevenlabs'

function getSupabaseAdmin() {
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!serviceKey) {
        console.error('SUPABASE_SERVICE_ROLE_KEY is missing. Falling back to ANON_KEY, which may cause RLS errors.')
    }
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        serviceKey || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    )
}

// Scheduled Report — called every 15 min by pg_cron
// Checks for due scheduled reports and sends them
export const maxDuration = 60
export async function GET(req: NextRequest) {
    // Verify cron secret
    const authHeader = req.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
        const now = new Date()
        const currentTime = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Rome' })

        // Find reports due in the current 15-minute window
        // e.g., if current time is 10:07, we check for 10:00-10:14
        const hour = parseInt(currentTime.split(':')[0])
        const mins = parseInt(currentTime.split(':')[1])
        const windowStart = `${String(hour).padStart(2, '0')}:${String(Math.floor(mins / 15) * 15).padStart(2, '0')}:00`
        const windowEnd = `${String(hour).padStart(2, '0')}:${String(Math.floor(mins / 15) * 15 + 14).padStart(2, '0')}:59`

        const { data: dueReports } = await getSupabaseAdmin()
            .from('scheduled_reports')
            .select('*')
            .in('status', ['pending'])
            .gte('scheduled_time', windowStart)
            .lte('scheduled_time', windowEnd)

        if (!dueReports?.length) {
            return NextResponse.json({ ok: true, message: 'No reports due' })
        }

        for (const report of dueReports) {
            // Get Telegram connection for this org
            const { data: conn } = await getSupabaseAdmin()
                .from('connections')
                .select('credentials')
                .eq('organization_id', report.organization_id)
                .eq('provider', 'telegram')
                .eq('status', 'active')
                .single()

            if (!conn?.credentials?.bot_token || !conn?.credentials?.chat_id) continue

            const botToken = conn.credentials.bot_token
            const chatId = conn.credentials.chat_id

            // Generate report based on type
            const ctx = await getOrgDataContext(report.organization_id)
            const question = getReportQuestion(report.report_type)
            const response = await askAI(question, ctx)

            if (response.success) {
                // Send voice report
                const audioBuffer = await textToSpeech(response.text)
                if (audioBuffer) {
                    const formData = new FormData()
                    formData.append('chat_id', chatId)
                    const blob = new Blob([audioBuffer as any], { type: 'audio/mpeg' })
                    formData.append('voice', blob, 'report.mp3')

                    await fetch(`https://api.telegram.org/bot${botToken}/sendVoice`, {
                        method: 'POST',
                        body: formData,
                    })
                } else {
                    // Fallback to text
                    await sendTelegramDirect(botToken, chatId, `📊 ${response.text}`)
                }
            }

            // Update report status
            if (report.recurrence === 'once') {
                await getSupabaseAdmin()
                    .from('scheduled_reports')
                    .update({ status: 'delivered', last_delivered_at: new Date().toISOString() })
                    .eq('id', report.id)
            } else {
                // daily — keep pending, update last_delivered_at
                await getSupabaseAdmin()
                    .from('scheduled_reports')
                    .update({ last_delivered_at: new Date().toISOString() })
                    .eq('id', report.id)
            }
        }

        return NextResponse.json({ ok: true, delivered: dueReports.length })
    } catch (err) {
        console.error('Scheduled report error:', err)
        return NextResponse.json({ error: 'Internal error' }, { status: 500 })
    }
}

function getReportQuestion(type: string): string {
    switch (type) {
        case 'ads':
            return 'Fammi un riepilogo dettagliato delle performance delle campagne pubblicitarie. Includi spesa, CPL, CTR, lead generati e suggerimenti.'
        case 'leads':
            return 'Fammi un riepilogo dei lead: quanti ne ho ricevuti oggi, questa settimana, e come sono distribuiti nella pipeline.'
        case 'pipeline':
            return 'Fammi una analisi della pipeline di vendita: distribuzione lead negli stage, colli di bottiglia, e suggerimenti per migliorare la conversione.'
        case 'summary':
        default:
            return 'Fammi un riepilogo completo della giornata: lead, campagne, pipeline, performance generale. Evidenzia le cose importanti e dammi suggerimenti pratici.'
    }
}
