import { NextRequest, NextResponse } from 'next/server'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { getOrgDataContext, sendTelegramDirect } from '@/lib/telegram'

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

// ADS Monitor — called every 60 minutes by pg_cron
// Checks campaigns for anomalies and only alerts if values are extreme
export const maxDuration = 60
export async function GET(req: NextRequest) {
    // Verify cron secret
    const authHeader = req.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
        // Get all orgs with active Telegram connections
        const { data: connections } = await getSupabaseAdmin()
            .from('connections')
            .select('organization_id, credentials')
            .eq('provider', 'telegram')
            .eq('status', 'active')

        if (!connections?.length) {
            return NextResponse.json({ ok: true, message: 'No active connections' })
        }

        let alertsSent = 0

        for (const conn of connections) {
            const orgId = conn.organization_id
            const botToken = conn.credentials?.bot_token
            const chatId = conn.credentials?.chat_id

            if (!botToken || !chatId) continue

            const ctx = await getOrgDataContext(orgId)
            const alerts: string[] = []

            // Check each campaign for anomalies
            const avgCpl = Number(ctx.summary.avg_cpl) || 0

            for (const campaign of ctx.campaigns) {
                if (campaign.status !== 'ACTIVE') continue

                const cpl = Number(campaign.cpl) || 0
                const ctr = Number(campaign.ctr) || 0
                const roas = Number(campaign.roas) || 0
                const spend = Number(campaign.spend) || 0
                const name = campaign.name || 'Campagna senza nome'

                // 🔴 ALERT: CPL troppo alto (> 2x media)
                if (avgCpl > 0 && cpl > avgCpl * 2 && cpl > 5) {
                    alerts.push(`🔴 <b>${name}</b>: CPL molto alto (€${cpl.toFixed(2)} vs media €${avgCpl.toFixed(2)})`)
                }

                // 🔴 ALERT: CTR troppo basso
                if (ctr > 0 && ctr < 0.5) {
                    alerts.push(`🔴 <b>${name}</b>: CTR molto basso (${ctr.toFixed(2)}%) — controlla il creative`)
                }

                // 🟢 OTTIMO: ROAS eccellente
                if (roas > 3) {
                    alerts.push(`🟢 <b>${name}</b>: ROAS eccellente (${roas.toFixed(1)}x) — continua così!`)
                }

                // 🟢 OTTIMO: CPL molto basso (< 50% media)
                if (avgCpl > 0 && cpl > 0 && cpl < avgCpl * 0.5) {
                    alerts.push(`🟢 <b>${name}</b>: CPL ottimo (€${cpl.toFixed(2)} — metà della media!)`)
                }
            }

            // Only send if there are notable alerts
            if (alerts.length > 0) {
                const msg = `🔍 <b>Monitoraggio ADS — Dante</b>\n\n` +
                    alerts.join('\n\n') +
                    `\n\n<i>Controllo automatico ogni 60 minuti</i>`

                await sendTelegramDirect(botToken, chatId, msg)
                alertsSent++
            }
        }

        return NextResponse.json({ ok: true, alertsSent })
    } catch (err) {
        console.error('ADS monitor error:', err)
        return NextResponse.json({ error: 'Internal error' }, { status: 500 })
    }
}
