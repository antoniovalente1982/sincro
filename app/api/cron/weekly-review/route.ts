import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendTelegramDirect } from '@/lib/telegram'
import { getCurrentNorthStar, calcNorthStarDelta } from '@/lib/north-star'

// ═══════════════════════════════════════════════════════════════
// WEEKLY REVIEW — Runs every Sunday at 21:00
// Aggregate review, NorthStar gap, and strategic recommendations.
// ═══════════════════════════════════════════════════════════════

export const maxDuration = 60
const META_API_VERSION = 'v21.0'
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY

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
            .select('organization_id, llm_model')
            .eq('autopilot_active', true)

        if (!configs?.length) {
            return NextResponse.json({ ok: true, message: 'No active autopilots' })
        }

        for (const config of configs) {
            const orgId = config.organization_id
            const llmModel = config.llm_model || 'google/gemini-2.5-flash'

            // ── NorthStar ─────────────────────────────────────────────
            const northStar = await getCurrentNorthStar(orgId)
            if (!northStar) continue

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

            // ── Fetch 7-day Meta data ─────────────────────────────────
            const today = new Date().toISOString().slice(0, 10)
            const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

            const res7d = await fetch(
                `https://graph.facebook.com/${META_API_VERSION}/${adAccount}/insights?fields=spend,impressions,clicks,actions,cost_per_action_type&time_range=${encodeURIComponent(JSON.stringify({ since: sevenDaysAgo, until: today }))}&access_token=${access_token}`
            )
            const weekData = res7d.ok ? (await res7d.json()).data?.[0] : null
            const weekSpend = weekData ? parseFloat(weekData.spend || '0') : 0
            const weekLeads = Number(weekData?.actions?.find((a: any) => a.action_type === 'lead')?.value || 0)

            // ── CRM 7-day funnel ──────────────────────────────────────
            const weekStart = `${sevenDaysAgo}T00:00:00+00:00`
            const { data: weekLeadsCRM } = await supabase
                .from('leads')
                .select(`id, value, pipeline_stages!leads_stage_id_fkey (slug, is_won)`)
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

            // ── North Star Delta ──────────────────────────────────────
            const delta = calcNorthStarDelta(northStar, {
                spend: weekSpend,
                leads: weekLeads,
                appointments,
                sales,
            })

            // ── LLM Weekly Strategy ───────────────────────────────────
            let strategy = ''
            if (OPENROUTER_API_KEY) {
                try {
                    const prompt = `Sei il consigliere strategico settimanale di Metodo Sincro (coaching mentale calcio).
Ecco i risultati della settimana:
- Spesa: €${weekSpend.toFixed(2)} (${delta.spend_pct.toFixed(0)}% del budget €${northStar.budget_weekly})
- Lead: ${weekLeads} (Meta) / ${weekLeadsCRM?.length || 0} (CRM)
- Appuntamenti: ${appointments}, Show-up: ${showups}, Vendite: ${sales}
- CAC attuale: ${delta.cac_current > 0 ? `€${delta.cac_current.toFixed(0)}` : 'n/d'} (target: €${northStar.cac_target})
- Revenue: €${revenue.toFixed(0)}
- Pace mensile: ${delta.pace} (${delta.sales_pct.toFixed(0)}% del target di ${northStar.sales_target_monthly} vendite)

Scrivi un report strategico BREVE (max 200 parole) con:
1. Valutazione della settimana (voto da 1 a 10)
2. Il problema più urgente da risolvere
3. UN'unica raccomandazione per la prossima settimana
Scrivi in italiano, tono diretto e pratico.`

                    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${OPENROUTER_API_KEY}` },
                        body: JSON.stringify({
                            model: llmModel,
                            messages: [{ role: 'user', content: prompt }],
                            temperature: 0.4,
                            max_tokens: 600,
                        }),
                    })
                    if (res.ok) {
                        const data = await res.json()
                        strategy = data.choices?.[0]?.message?.content || ''
                    }
                } catch (e) {
                    console.error('[WeeklyReview] LLM error:', e)
                }
            }

            // ── Save to strategy log ──────────────────────────────────
            await supabase.from('ai_strategy_log').insert({
                organization_id: orgId,
                cycle_id: `${getCurrentWeekLabel()}-weekly-review`,
                cycle_type: 'weekly_review',
                hypothesis: { strategy, delta },
                baseline_metrics: {
                    spend_7d: weekSpend, leads_7d: weekLeads,
                    appointments, showups, sales, revenue,
                    cac: delta.cac_current, pace: delta.pace,
                },
            })

            // ── Telegram weekly report ────────────────────────────────
            const { data: tgConn } = await supabase
                .from('connections')
                .select('credentials')
                .eq('organization_id', orgId)
                .eq('provider', 'telegram')
                .eq('status', 'active')
                .single()

            if (tgConn?.credentials?.bot_token && tgConn?.credentials?.chat_id) {
                const paceIcon = delta.pace === 'ON_TRACK' ? '🟢' : delta.pace === 'AHEAD' ? '🚀' : '🔴'
                const actionIcon = delta.recommended_action === 'SCALE' ? '📈' : delta.recommended_action === 'REDUCE' ? '📉' : '⏸'

                let msg = `📋 <b>REVIEW SETTIMANALE</b>\n`
                msg += `─────────────────\n\n`
                msg += `💰 Spesa: €${weekSpend.toFixed(2)} / €${northStar.budget_weekly} (${delta.spend_pct.toFixed(0)}%)\n`
                msg += `👥 Lead: ${weekLeads} | Appuntamenti: ${appointments}\n`
                msg += `🎯 Show-up: ${showups} | Vendite: ${sales}\n`
                msg += `💵 Revenue: €${revenue.toFixed(0)} | CAC: ${delta.cac_current > 0 ? `€${delta.cac_current.toFixed(0)}` : 'n/d'}\n\n`
                msg += `${paceIcon} Pace: <b>${delta.pace}</b> (${delta.sales_pct.toFixed(0)}% target mensile)\n`
                msg += `${actionIcon} Azione suggerita: <b>${delta.recommended_action}</b>\n\n`

                if (strategy) {
                    msg += `🧠 <b>Analisi Strategica:</b>\n${strategy.slice(0, 800)}\n`
                }

                await sendTelegramDirect(tgConn.credentials.bot_token, tgConn.credentials.chat_id, msg)
            }

            results.push({ orgId, weekSpend, weekLeads, sales, delta })
        }

        return NextResponse.json({ ok: true, results })
    } catch (err: any) {
        console.error('[WeeklyReview] Fatal error:', err)
        return NextResponse.json({ error: err.message }, { status: 500 })
    }
}

function getCurrentWeekLabel(): string {
    const now = new Date()
    const startOfYear = new Date(now.getFullYear(), 0, 1)
    const weekNum = Math.ceil(((now.getTime() - startOfYear.getTime()) / 86400000 + startOfYear.getDay() + 1) / 7)
    return `${now.getFullYear()}-W${String(weekNum).padStart(2, '0')}`
}
