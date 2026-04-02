import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendTelegramDirect } from '@/lib/telegram'

// ═══════════════════════════════════════════════════════════════
// 🔄 RATCHET EVALUATOR — Runs every day at 23:00
//
// Evaluates pending hypotheses in ai_strategy_log.
// Compares current metrics vs baseline to determine outcome.
// If improved → keeps as new baseline (ratchet commits).
// If worsened → marks as discarded, logs learning.
// ═══════════════════════════════════════════════════════════════

export const maxDuration = 60
const META_API_VERSION = 'v21.0'
const IMPROVE_THRESHOLD = 0.05  // 5% improvement = confirmed
const WORSEN_THRESHOLD = 0.15   // 15% worsening = definitely bad
const MIN_DAYS_TO_EVALUATE = 3  // need at least 3 days of data

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

    try {
        const { data: configs } = await supabase
            .from('ai_agent_config')
            .select('organization_id, objectives')
            .eq('autopilot_active', true)

        if (!configs?.length) return NextResponse.json({ ok: true, message: 'No active autopilots' })

        const allEvaluations: any[] = []

        for (const config of configs) {
            const orgId = config.organization_id

            // Get Meta credentials
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

            // Get pending hypotheses (at least MIN_DAYS old)
            const minAge = new Date(Date.now() - MIN_DAYS_TO_EVALUATE * 24 * 60 * 60 * 1000).toISOString()
            const { data: pending } = await supabase
                .from('ai_strategy_log')
                .select('*')
                .eq('organization_id', orgId)
                .eq('outcome', 'pending')
                .lte('created_at', minAge)
                .order('created_at', { ascending: true })
                .limit(10)

            if (!pending?.length) continue

            // Fetch current 7d Meta metrics for evaluation
            const today = new Date().toISOString().slice(0, 10)
            const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

            const insightsRes = await fetch(
                `https://graph.facebook.com/${META_API_VERSION}/${adAccount}/insights?` +
                `fields=ad_id,ad_name,adset_name,campaign_id,spend,impressions,ctr,actions,cost_per_action_type` +
                `&level=ad&time_range=${encodeURIComponent(JSON.stringify({ since: sevenDaysAgo, until: today }))}` +
                `&limit=500&access_token=${access_token}`
            )

            if (!insightsRes.ok) continue
            const insightsData = await insightsRes.json()

            // Aggregate current metrics by angle
            const currentByAngle: Record<string, { spend: number; leads: number; cpl: number }> = {}
            for (const insight of (insightsData.data || [])) {
                const leads = Number(insight.actions?.find((a: any) => a.action_type === 'lead')?.value || 0)
                const cpl = Number(insight.cost_per_action_type?.find((a: any) => a.action_type === 'lead')?.value || 0)
                const spend = parseFloat(insight.spend || '0')
                const angle = detectAngle(insight.ad_name || '', insight.adset_name || '')

                if (!currentByAngle[angle]) currentByAngle[angle] = { spend: 0, leads: 0, cpl: 0 }
                currentByAngle[angle].spend += spend
                currentByAngle[angle].leads += leads
            }
            for (const angle of Object.keys(currentByAngle)) {
                const a = currentByAngle[angle]
                a.cpl = a.leads > 0 ? a.spend / a.leads : 0
            }

            // Evaluate each pending hypothesis
            const evaluated: any[] = []
            for (const log of pending) {
                const hyp = log.hypothesis || {}
                const baseline = log.baseline_metrics || {}
                const targetAngle = hyp.angle
                if (!targetAngle || !currentByAngle[targetAngle]) continue

                const current = currentByAngle[targetAngle]
                const baselineCPL = baseline.by_angle?.[targetAngle]?.cpl || 0

                // Determine outcome
                let outcome = 'neutral'
                let kept = false
                let discardReason: string | null = null
                let deltaCpl = 0

                if (baselineCPL > 0 && current.cpl > 0) {
                    deltaCpl = (current.cpl - baselineCPL) / baselineCPL
                    if (deltaCpl < -IMPROVE_THRESHOLD) {
                        outcome = 'improved'
                        kept = true
                    } else if (deltaCpl > WORSEN_THRESHOLD) {
                        outcome = 'worsened'
                        kept = false
                        discardReason = `CPL peggiorato del ${(deltaCpl * 100).toFixed(1)}% (baseline €${baselineCPL.toFixed(2)} → attuale €${current.cpl.toFixed(2)})`
                    }
                }

                // Update strategy log
                await supabase.from('ai_strategy_log')
                    .update({
                        result_metrics: {
                            by_angle: { [targetAngle]: current },
                        },
                        delta_cpl: current.cpl - baselineCPL,
                        delta_leads: current.leads - (baseline.by_angle?.[targetAngle]?.leads || 0),
                        outcome,
                        kept,
                        discard_reason: discardReason,
                        evaluated_at: new Date().toISOString(),
                    })
                    .eq('id', log.id)

                // If improved → update angle baseline
                if (kept && current.cpl > 0) {
                    await supabase.from('ai_angle_scores')
                        .update({
                            baseline_cpl: current.cpl,
                            baseline_week: getCurrentWeekLabel(),
                            updated_at: new Date().toISOString(),
                        })
                        .eq('organization_id', orgId)
                        .eq('angle', targetAngle)
                }

                evaluated.push({ log_id: log.id, angle: targetAngle, outcome, deltaCpl, kept })
                allEvaluations.push({ orgId, angle: targetAngle, outcome, deltaCpl })
            }

            // Update ai_episodes
            if (evaluated.length > 0) {
                await supabase.from('ai_episodes').insert({
                    organization_id: orgId,
                    episode_type: 'ratchet',
                    action_type: 'ratchet_evaluator_daily',
                    target_type: 'system',
                    context: {
                        evaluated_count: evaluated.length,
                        improved: evaluated.filter(e => e.outcome === 'improved').length,
                        worsened: evaluated.filter(e => e.outcome === 'worsened').length,
                        neutral: evaluated.filter(e => e.outcome === 'neutral').length,
                    },
                    reasoning: `Ratchet: ${evaluated.length} ipotesi valutate`,
                    outcome: 'positive',
                    outcome_score: 0.5,
                })
            }

            // Telegram report
            if (evaluated.length > 0) {
                await sendRatchetReport(supabase, orgId, evaluated)
            }
        }

        return NextResponse.json({ ok: true, evaluations: allEvaluations.length, details: allEvaluations })
    } catch (err: any) {
        console.error('[Ratchet Evaluator] Fatal:', err)
        return NextResponse.json({ error: err.message }, { status: 500 })
    }
}

async function sendRatchetReport(supabase: any, orgId: string, evaluated: any[]) {
    try {
        const { data: conn } = await supabase
            .from('connections')
            .select('credentials')
            .eq('organization_id', orgId)
            .eq('provider', 'telegram')
            .eq('status', 'active')
            .single()

        if (!conn?.credentials?.bot_token || !conn?.credentials?.chat_id) return

        let msg = `🔄 <b>RATCHET EVALUATOR</b> — Report Giornaliero\n`
        msg += `─────────────────\n\n`

        for (const e of evaluated) {
            const icon = e.outcome === 'improved' ? '✅' : e.outcome === 'worsened' ? '❌' : '➖'
            const deltaPct = (e.deltaCpl * 100).toFixed(1)
            msg += `${icon} <b>${e.angle.toUpperCase()}</b>\n`
            msg += `   Outcome: ${e.outcome.toUpperCase()}\n`
            if (e.deltaCpl !== 0) msg += `   ΔCPL: ${e.deltaCpl < 0 ? '' : '+'}${deltaPct}%\n`
            if (e.kept) msg += `   🔒 Nuova baseline aggiornata!\n`
            msg += `\n`
        }

        const improved = evaluated.filter(e => e.outcome === 'improved').length
        const worsened = evaluated.filter(e => e.outcome === 'worsened').length
        msg += `📊 ${improved} migliorate | ${worsened} peggiorate | ${evaluated.length - improved - worsened} neutrali\n`
        msg += `🧠 Il sistema ha aggiornato le baseline per le ipotesi confermate.`

        await sendTelegramDirect(conn.credentials.bot_token, conn.credentials.chat_id, msg)
    } catch { }
}

function detectAngle(adName: string, adsetName?: string): string {
    const text = `${adName} ${adsetName || ''}`.toLowerCase()
    if (text.includes('emo') || text.includes('dolore') || text.includes('emotional')) return 'emotional'
    if (text.includes('eff') || text.includes('efficiency') || text.includes('split') || text.includes('gap')) return 'efficiency'
    if (text.includes('sys') || text.includes('system') || text.includes('metodo')) return 'system'
    if (text.includes('status') || text.includes('corona')) return 'status'
    if (text.includes('edu') || text.includes('lente') || text.includes('lavagna') || text.includes('education')) return 'education'
    if (text.includes('growth') || text.includes('crescita')) return 'growth'
    return 'generic'
}

function getCurrentWeekLabel(): string {
    const now = new Date()
    const startOfYear = new Date(now.getFullYear(), 0, 1)
    const weekNum = Math.ceil(((now.getTime() - startOfYear.getTime()) / 86400000 + startOfYear.getDay() + 1) / 7)
    return `${now.getFullYear()}-W${String(weekNum).padStart(2, '0')}`
}
