import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendTelegramDirect } from '@/lib/telegram'

// ═══════════════════════════════════════════════════════════════
// DAILY SNAPSHOT — Runs every day at 23:55
// Captures the day's performance as a funnel row for trend analysis.
// ═══════════════════════════════════════════════════════════════

export const maxDuration = 60
const META_API_VERSION = 'v21.0'

function getSupabaseAdmin() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    )
}

export async function GET(req: NextRequest) {
    const authHeader = req.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = getSupabaseAdmin()
    const results: any[] = []

    try {
        const { data: configs } = await supabase
            .from('ai_agent_config')
            .select('organization_id')
            .eq('autopilot_active', true)

        if (!configs?.length) {
            return NextResponse.json({ ok: true, message: 'No active autopilots' })
        }

        for (const config of configs) {
            const orgId = config.organization_id

            // ── Get Meta credentials ──────────────────────────────────
            const { data: conn } = await supabase
                .from('connections')
                .select('credentials')
                .eq('organization_id', orgId)
                .eq('provider', 'meta_ads')
                .eq('status', 'active')
                .single()

            if (!conn?.credentials?.access_token) continue
            const { access_token, ad_account_id } = conn.credentials
            const adAccount = `act_${ad_account_id}`

            // ── Fetch today's Meta data ───────────────────────────────
            const today = new Date().toISOString().slice(0, 10)
            const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

            const [resToday, res7d] = await Promise.all([
                fetch(`https://graph.facebook.com/${META_API_VERSION}/${adAccount}/insights?fields=spend,impressions,clicks,actions,cost_per_action_type&time_range=${encodeURIComponent(JSON.stringify({ since: today, until: today }))}&access_token=${access_token}`),
                fetch(`https://graph.facebook.com/${META_API_VERSION}/${adAccount}/insights?fields=spend,impressions,clicks,actions,cost_per_action_type&time_range=${encodeURIComponent(JSON.stringify({ since: sevenDaysAgo, until: today }))}&access_token=${access_token}`),
            ])

            const todayData = resToday.ok ? (await resToday.json()).data?.[0] : null
            const weekData = res7d.ok ? (await res7d.json()).data?.[0] : null

            const todaySpend = todayData ? parseFloat(todayData.spend || '0') : 0
            const todayLeads = todayData?.actions?.find((a: any) => a.action_type === 'lead')?.value || 0
            const todayCPL = Number(todayLeads) > 0 ? todaySpend / Number(todayLeads) : 0

            const weekSpend = weekData ? parseFloat(weekData.spend || '0') : 0
            const weekLeads = weekData?.actions?.find((a: any) => a.action_type === 'lead')?.value || 0

            // ── CRM data for today ────────────────────────────────────
            const todayStart = `${today}T00:00:00+00:00`
            const { count: leadsToday } = await supabase
                .from('leads')
                .select('id', { count: 'exact', head: true })
                .eq('organization_id', orgId)
                .gte('created_at', todayStart)

            // ── Get CRM funnel totals (last 7 days) ───────────────────
            const weekStart = `${sevenDaysAgo}T00:00:00+00:00`
            const { data: weekLeadsCRM } = await supabase
                .from('leads')
                .select(`id, value, pipeline_stages!leads_stage_id_fkey (slug, is_won, is_lost)`)
                .eq('organization_id', orgId)
                .gte('created_at', weekStart)

            let appointments = 0, showups = 0, sales = 0, revenue = 0
            for (const lead of (weekLeadsCRM || [])) {
                const stage = lead.pipeline_stages as any
                if (!stage) continue
                if (['appuntamento', 'show-up'].includes(stage.slug) || stage.is_won) appointments++
                if (stage.slug === 'show-up' || stage.is_won) showups++
                if (stage.is_won) { sales++; revenue += Number(lead.value) || 0 }
            }

            // ── Upsert snapshot ───────────────────────────────────────
            const snapshot = {
                organization_id: orgId,
                snapshot_date: today,
                total_spend: weekSpend,
                total_leads: Number(weekLeads),
                total_appointments: appointments,
                total_showups: showups,
                total_sales: sales,
                total_revenue: revenue,
                cpl: Number(weekLeads) > 0 ? weekSpend / Number(weekLeads) : null,
                cac: sales > 0 ? weekSpend / sales : null,
                lead_to_appt_rate: Number(weekLeads) > 0 ? appointments / Number(weekLeads) : null,
                close_rate: showups > 0 ? sales / showups : null,
                week_label: getCurrentWeekLabel(),
            }

            await supabase.from('ai_funnel_snapshots')
                .upsert(snapshot, { onConflict: 'organization_id,snapshot_date' })

            // ── Telegram evening report ───────────────────────────────
            const { data: tgConn } = await supabase
                .from('connections')
                .select('credentials')
                .eq('organization_id', orgId)
                .eq('provider', 'telegram')
                .eq('status', 'active')
                .single()

            if (tgConn?.credentials?.bot_token && tgConn?.credentials?.chat_id) {
                const msg = `🌙 <b>Snapshot Giornaliero</b>\n` +
                    `─────────────────\n\n` +
                    `💰 Spesa oggi: €${todaySpend.toFixed(2)}\n` +
                    `👥 Lead oggi (Meta): ${todayLeads} | CRM: ${leadsToday || 0}\n` +
                    `📉 CPL oggi: ${todayCPL > 0 ? `€${todayCPL.toFixed(2)}` : 'n/d'}\n\n` +
                    `📊 <b>Ultimi 7 giorni:</b>\n` +
                    `  Spesa: €${weekSpend.toFixed(2)} | Lead: ${weekLeads}\n` +
                    `  Appuntamenti: ${appointments} | Show-up: ${showups}\n` +
                    `  Vendite: ${sales} | Revenue: €${revenue.toFixed(0)}\n` +
                    `  CAC: ${sales > 0 ? `€${(weekSpend / sales).toFixed(0)}` : 'n/d'}\n\n` +
                    `💾 Snapshot salvato. Buonanotte! 🌙`

                await sendTelegramDirect(tgConn.credentials.bot_token, tgConn.credentials.chat_id, msg)
            }

            results.push({ orgId, todaySpend, todayLeads, weekSpend, sales })
        }

        return NextResponse.json({ ok: true, results })
    } catch (err: any) {
        console.error('[DailySnapshot] Fatal error:', err)
        return NextResponse.json({ error: err.message }, { status: 500 })
    }
}

function getCurrentWeekLabel(): string {
    const now = new Date()
    const startOfYear = new Date(now.getFullYear(), 0, 1)
    const weekNum = Math.ceil(((now.getTime() - startOfYear.getTime()) / 86400000 + startOfYear.getDay() + 1) / 7)
    return `${now.getFullYear()}-W${String(weekNum).padStart(2, '0')}`
}
