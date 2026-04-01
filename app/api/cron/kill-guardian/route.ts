import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendTelegramDirect } from '@/lib/telegram'
import { pauseAd } from '@/lib/meta-actions'

// ═══════════════════════════════════════════════════════════════════════════
// KILL GUARDIAN — Runs every 4 hours
//
// Single responsibility: find and kill ads that are burning budget with no ROI.
//
// LOGIC (budget-relative, not fixed €):
//   KILL IF: spend_7d > daily_budget × 3  AND  leads_7d = 0
//   PROTECTED IF (in order, first match wins):
//     1. leads_3d >= 1          → recent signal, skip
//     2. cpl_7d ≤ target × 1.2 → in range this week, skip
//     3. Champion lifetime       → spend_lt ≥ budget × 14 AND cpl_lt ≤ target × 0.9
//        (champions get threshold raised to 5×, not immune)
//
//  No fixed € amounts. No CTR rules. No frequency kills.
//  Telegram notification for every kill and every protection activated.
// ═══════════════════════════════════════════════════════════════════════════

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

    const results: any[] = []

    try {
        // Get all orgs with autopilot active
        const { data: configs } = await getSupabaseAdmin()
            .from('ai_agent_config')
            .select('organization_id, execution_mode, objectives')
            .eq('autopilot_active', true)

        if (!configs?.length) {
            return NextResponse.json({ ok: true, message: 'No active autopilots' })
        }

        for (const config of configs) {
            const orgId = config.organization_id
            const isLive = config.execution_mode === 'live'
            const objectives = config.objectives || {}

            // Config parameters (V2 budget-relative)
            const targetCPL: number = objectives.target_cpl || 20
            const killMultiplier: number = objectives.kill_multiplier || 3.0
            const championMultiplier: number = objectives.champion_multiplier || 5.0
            const championMinDays: number = objectives.champion_min_spend_days || 14

            // Get Meta credentials
            const { data: conn } = await getSupabaseAdmin()
                .from('connections')
                .select('credentials')
                .eq('organization_id', orgId)
                .eq('provider', 'meta_ads')
                .eq('status', 'active')
                .single()

            if (!conn?.credentials?.access_token) continue

            const { access_token, ad_account_id } = conn.credentials
            const adAccount = `act_${ad_account_id}`

            // ── Fetch 3 data windows in parallel ──────────────────────────
            const today = new Date().toISOString().slice(0, 10)
            const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
            const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

            const insightsFields = 'ad_id,ad_name,campaign_id,campaign_name,spend,impressions,actions,cost_per_action_type'

            const buildUrl = (since: string, until: string, datePreset?: string) => {
                const base = `https://graph.facebook.com/${META_API_VERSION}/${adAccount}/insights?fields=${insightsFields}&level=ad&limit=500&access_token=${access_token}`
                if (datePreset) return `${base}&date_preset=${datePreset}`
                return `${base}&time_range=${encodeURIComponent(JSON.stringify({ since, until }))}`
            }

            const [res7d, res3d, resLifetime, adsRes] = await Promise.all([
                fetch(buildUrl(sevenDaysAgo, today)),
                fetch(buildUrl(threeDaysAgo, today)),
                fetch(buildUrl('', '', 'maximum')),
                fetch(`https://graph.facebook.com/${META_API_VERSION}/${adAccount}/ads?fields=id,effective_status,campaign_id&limit=500&access_token=${access_token}`),
            ])

            if (!res7d.ok) continue

            const [data7d, data3d, dataLifetime, adsData] = await Promise.all([
                res7d.json(),
                res3d.ok ? res3d.json() : { data: [] },
                resLifetime.ok ? resLifetime.json() : { data: [] },
                adsRes.ok ? adsRes.json() : { data: [] },
            ])

            // Build active ad status map
            const activeAdIds = new Set<string>(
                (adsData.data || []).filter((a: any) => a.effective_status === 'ACTIVE').map((a: any) => a.id)
            )

            // Parse insights into maps keyed by ad_id
            const parseInsights = (raw: any[]) => {
                const map: Record<string, { spend: number; leads: number; cpl: number; ad_name: string; campaign_id: string; campaign_name: string }> = {}
                for (const i of raw) {
                    if (!activeAdIds.has(i.ad_id)) continue
                    const leads = Number(i.actions?.find((a: any) => a.action_type === 'lead')?.value || 0)
                    const spend = parseFloat(i.spend || '0')
                    const cpl = leads > 0 ? spend / leads : 0
                    map[i.ad_id] = { spend, leads, cpl, ad_name: i.ad_name, campaign_id: i.campaign_id, campaign_name: i.campaign_name }
                }
                return map
            }

            const map7d = parseInsights(data7d.data || [])
            const map3d = parseInsights(data3d.data || [])
            const mapLt = parseInsights(dataLifetime.data || [])

            if (Object.keys(map7d).length === 0) continue

            // Get campaign daily budgets
            const campaignIds = [...new Set(Object.values(map7d).map((a) => a.campaign_id))]
            const dailyBudgets: Record<string, number> = {}
            await Promise.all(campaignIds.map(async (cId) => {
                try {
                    const r = await fetch(`https://graph.facebook.com/${META_API_VERSION}/${cId}?fields=daily_budget&access_token=${access_token}`)
                    if (r.ok) {
                        const d = await r.json()
                        dailyBudgets[cId] = parseFloat(d.daily_budget || '0') / 100
                    }
                } catch {}
            }))

            // Get Telegram connection
            const { data: tgConn } = await getSupabaseAdmin()
                .from('connections')
                .select('credentials')
                .eq('organization_id', orgId)
                .eq('provider', 'telegram')
                .eq('status', 'active')
                .single()

            const botToken = tgConn?.credentials?.bot_token
            const chatId = tgConn?.credentials?.chat_id

            // ── Kill Guardian Evaluation ───────────────────────────────────
            const killResults: any[] = []
            const protectedResults: any[] = []

            // Track kills per campaign for safety (never kill last ad)
            const killCountByCampaign: Record<string, number> = {}
            const activeByCampaign: Record<string, number> = {}
            for (const ad of Object.values(map7d)) {
                activeByCampaign[ad.campaign_id] = (activeByCampaign[ad.campaign_id] || 0) + 1
            }

            for (const [adId, ad7d] of Object.entries(map7d)) {
                const dailyBudget = dailyBudgets[ad7d.campaign_id] || 0
                if (dailyBudget === 0) continue // Cannot evaluate without budget reference

                const ad3d = map3d[adId]
                const adLt = mapLt[adId]

                // ── Kill trigger: 3× budget with 0 leads ─────────────────
                const killThreshold = dailyBudget * killMultiplier
                const championThreshold = dailyBudget * championMultiplier

                // Not triggered yet
                if (ad7d.spend <= killThreshold || ad7d.leads > 0) continue

                // ── Protection hierarchy ───────────────────────────────────
                let protected_ = false
                let protectionReason = ''

                // 1. Recent signal (last 3 days)
                if ((ad3d?.leads || 0) >= 1) {
                    protected_ = true
                    protectionReason = `Segnale recente: ${ad3d!.leads} lead negli ultimi 3gg`
                }

                // 2. CPL in range this week (has some leads this week)
                else if (ad7d.cpl > 0 && ad7d.cpl <= targetCPL * 1.2) {
                    protected_ = true
                    protectionReason = `CPL 7gg €${ad7d.cpl.toFixed(2)} ≤ €${(targetCPL * 1.2).toFixed(2)} (120% target)`
                }

                // 3. Champion lifetime — elevated threshold
                else if (adLt && adLt.cpl > 0 && adLt.cpl <= targetCPL * 0.9 && adLt.leads >= 10 && adLt.spend >= dailyBudget * championMinDays) {
                    if (ad7d.spend <= championThreshold) {
                        protected_ = true
                        protectionReason = `Campione Lifetime: CPL storico €${adLt.cpl.toFixed(2)} — soglia estesa a €${championThreshold.toFixed(0)} (${championMultiplier}× budget)`
                    }
                    // else: even champion gets killed above champion threshold
                }

                if (protected_) {
                    protectedResults.push({ adId, ad: ad7d, reason: protectionReason, spend: ad7d.spend, threshold: killThreshold })
                    continue
                }

                // ── KILL ──────────────────────────────────────────────────
                // Safety: never kill the last active ad in a campaign
                const killsInCampaign = killCountByCampaign[ad7d.campaign_id] || 0
                const activeInCampaign = activeByCampaign[ad7d.campaign_id] || 0
                if (activeInCampaign - killsInCampaign <= 1) {
                    protectedResults.push({ adId, ad: ad7d, reason: 'Sicurezza: unica ad rimasta in campagna', spend: ad7d.spend, threshold: killThreshold })
                    continue
                }

                killCountByCampaign[ad7d.campaign_id] = killsInCampaign + 1
                killResults.push({ adId, ad: ad7d, spend: ad7d.spend, threshold: killThreshold, dailyBudget })
            }

            // ── Execute kills ──────────────────────────────────────────────
            for (const kill of killResults) {
                const { adId, ad, spend, threshold, dailyBudget } = kill

                let executed = false
                if (isLive) {
                    try {
                        await pauseAd(adId, access_token)
                        executed = true
                    } catch (e: any) {
                        console.error(`[KillGuardian] pauseAd failed for ${adId}:`, e.message)
                    }
                }

                // Log to ai_episodes
                await getSupabaseAdmin().from('ai_episodes').insert({
                    organization_id: orgId,
                    episode_type: 'automation',
                    action_type: 'kill_guardian_v2',
                    target_type: 'ad',
                    target_id: adId,
                    target_name: ad.ad_name,
                    context: {
                        campaign: ad.campaign_name,
                        daily_budget: dailyBudget,
                        kill_threshold: threshold,
                        kill_multiplier: killMultiplier,
                        dry_run: !isLive,
                        source: 'kill_guardian_4h',
                    },
                    reasoning: `Kill V2: €${spend.toFixed(2)} spesi in 7gg (${(spend / dailyBudget).toFixed(1)}× budget giornaliero €${dailyBudget.toFixed(0)}), 0 lead. Nessuna protezione attiva.`,
                    metrics_before: { spend_7d: spend, leads_7d: 0, daily_budget: dailyBudget },
                    outcome: executed ? 'executed' : 'dry_run',
                    outcome_score: 0,
                })

                results.push({ action: 'kill', adId, adName: ad.ad_name, spend, threshold, executed, campaign: ad.campaign_name })
            }

            // ── Telegram Report ────────────────────────────────────────────
            if (botToken && chatId && (killResults.length > 0 || protectedResults.length > 0)) {
                const mode = isLive ? '🔴 LIVE' : '🟡 DRY RUN'
                let msg = `🛡 <b>KILL GUARDIAN V2</b> [${mode}]\n`
                msg += `─────────────────\n`

                if (killResults.length > 0) {
                    msg += `\n🔴 <b>ADS KILLATE (${killResults.length})</b>\n`
                    for (const k of killResults) {
                        const ratio = (k.spend / k.dailyBudget).toFixed(1)
                        msg += `• ${k.ad.ad_name}\n`
                        msg += `  💸 €${k.spend.toFixed(0)} spesi (${ratio}× budget) | 0 lead in 7gg\n`
                        msg += `  ${k.executed ? '⛔ Pausata su Meta' : '🧪 Dry run — non eseguita'}\n`
                    }
                }

                if (protectedResults.length > 0) {
                    msg += `\n🛡 <b>PROTETTE (${protectedResults.length})</b>\n`
                    for (const p of protectedResults) {
                        msg += `• ${p.ad.ad_name}: ${p.reason}\n`
                    }
                }

                await sendTelegramDirect(botToken, chatId, msg)
            }
        }

        return NextResponse.json({
            ok: true,
            kills: results.filter((r) => r.action === 'kill').length,
            results,
        })
    } catch (err: any) {
        console.error('[KillGuardian] Fatal error:', err)
        return NextResponse.json({ error: err.message }, { status: 500 })
    }
}
