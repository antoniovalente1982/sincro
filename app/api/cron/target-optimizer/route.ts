import { NextRequest, NextResponse } from 'next/server'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { sendTelegramDirect } from '@/lib/telegram'

let _supabaseAdmin: SupabaseClient | null = null
function getSupabaseAdmin() {
    if (!_supabaseAdmin) {
        _supabaseAdmin = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        )
    }
    return _supabaseAdmin
}

const META_API_VERSION = 'v21.0'

// Target Optimizer — called weekly (Sunday evening)
// Analyzes winner performance and tightens targets when ads consistently beat them
export const maxDuration = 60

export async function GET(req: NextRequest) {
    const authHeader = req.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
        // Get all orgs with targets
        const { data: allTargets } = await getSupabaseAdmin()
            .from('ad_optimization_targets')
            .select('*')

        if (!allTargets?.length) {
            return NextResponse.json({ ok: true, message: 'No targets configured' })
        }

        let adjustments = 0

        for (const targets of allTargets) {
            const orgId = targets.organization_id

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

            // Fetch last 14 days ad-level data for analysis
            const until = new Date().toISOString().slice(0, 10)
            const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
            const timeRange = JSON.stringify({ since, until })

            const insightsUrl = `https://graph.facebook.com/${META_API_VERSION}/${adAccount}/insights?` +
                `fields=ad_id,ad_name,campaign_id,campaign_name,spend,impressions,clicks,ctr,actions,cost_per_action_type` +
                `&level=ad&time_range=${encodeURIComponent(timeRange)}&limit=500&access_token=${access_token}`

            const insightsRes = await fetch(insightsUrl)
            if (!insightsRes.ok) continue

            const insightsData = await insightsRes.json()

            // Build performance data
            const ads = (insightsData.data || []).map((insight: any) => {
                const leadsCount = parseInt(insight.actions?.find((a: any) => a.action_type === 'lead')?.value || '0')
                const cplValue = parseFloat(insight.cost_per_action_type?.find((a: any) => a.action_type === 'lead')?.value || '0')
                const spend = parseFloat(insight.spend || '0')
                return {
                    ad_id: insight.ad_id,
                    ad_name: insight.ad_name,
                    campaign_name: insight.campaign_name,
                    spend,
                    leads_count: leadsCount,
                    cpl: cplValue || (spend > 0 && leadsCount > 0 ? spend / leadsCount : 0),
                    ctr: parseFloat(insight.ctr || '0'),
                }
            })

            // Find "winner" ads: those with good volume AND good CPL
            const currentTargetCPL = Number(targets.target_cpl) || 20
            const winnersAds = ads.filter((a: any) =>
                a.leads_count >= 2 &&
                a.spend >= 15 &&
                a.cpl > 0 &&
                a.cpl < currentTargetCPL
            )

            if (winnersAds.length < 2) continue // Need at least 2 winners to make decisions

            // Calculate weighted average CPL of winners (weighted by leads)
            const totalWinnerLeads = winnersAds.reduce((s: number, a: any) => s + a.leads_count, 0)
            const weightedCPL = winnersAds.reduce((s: number, a: any) => s + (a.cpl * a.leads_count), 0) / totalWinnerLeads

            // Decision logic:
            // If winner avg CPL is 20%+ below target → tighten target by 10%
            // Floor: never below €8
            const improvement = (currentTargetCPL - weightedCPL) / currentTargetCPL
            const changes: { field: string; from: number; to: number }[] = []

            if (improvement >= 0.20) {
                // Tighten CPL by 10%
                const newCPL = Math.max(8, Math.round(currentTargetCPL * 0.9 * 100) / 100)
                if (newCPL < currentTargetCPL) {
                    changes.push({ field: 'target_cpl', from: currentTargetCPL, to: newCPL })
                }

                // Also tighten CPA appointment proportionally
                const currentCPAApp = Number(targets.target_cpa_appointment) || 60
                const newCPAApp = Math.max(20, Math.round(currentCPAApp * 0.9 * 100) / 100)
                if (newCPAApp < currentCPAApp) {
                    changes.push({ field: 'target_cpa_appointment', from: currentCPAApp, to: newCPAApp })
                }
            }

            if (changes.length === 0) continue

            // Build update object
            const updateObj: Record<string, any> = {
                updated_at: new Date().toISOString(),
                last_auto_adjusted_at: new Date().toISOString(),
            }
            changes.forEach(c => { updateObj[c.field] = c.to })

            // Add to history
            const history = Array.isArray(targets.target_history) ? targets.target_history : []
            history.push({
                date: new Date().toISOString().slice(0, 10),
                changes,
                winner_count: winnersAds.length,
                winner_avg_cpl: Math.round(weightedCPL * 100) / 100,
                total_winner_leads: totalWinnerLeads,
            })
            updateObj.target_history = history

            // Apply update
            await getSupabaseAdmin()
                .from('ad_optimization_targets')
                .update(updateObj)
                .eq('organization_id', orgId)

            // Log to AI Episodes
            await getSupabaseAdmin().from('ai_episodes').insert({
                organization_id: orgId,
                episode_type: 'optimization',
                action_type: 'auto_target_adjustment',
                target_type: 'targets',
                target_id: targets.id,
                target_name: 'Ad Optimization Targets',
                context: { changes, winner_count: winnersAds.length, winner_avg_cpl: weightedCPL },
                reasoning: `${winnersAds.length} winner ads averaging €${weightedCPL.toFixed(2)} CPL (${(improvement * 100).toFixed(0)}% below target €${currentTargetCPL}). Tightening targets by 10%.`,
                metrics_before: { target_cpl: currentTargetCPL, target_cpa_appointment: Number(targets.target_cpa_appointment) },
                outcome: 'positive',
                outcome_score: 0.9,
            })

            adjustments++

            // Telegram notification
            await sendTargetUpdateTelegram(orgId, changes, winnersAds.length, weightedCPL)
        }

        return NextResponse.json({ ok: true, adjustments })
    } catch (err) {
        console.error('Target optimizer error:', err)
        return NextResponse.json({ error: 'Internal error' }, { status: 500 })
    }
}

async function sendTargetUpdateTelegram(orgId: string, changes: any[], winnerCount: number, avgCPL: number) {
    try {
        const { data: conn } = await getSupabaseAdmin()
            .from('connections')
            .select('credentials')
            .eq('organization_id', orgId)
            .eq('provider', 'telegram')
            .eq('status', 'active')
            .single()

        if (!conn?.credentials?.bot_token || !conn?.credentials?.chat_id) return

        let msg = `🧠 <b>AI Target Optimizer — Auto-Miglioramento</b>\n\n`
        msg += `📊 ${winnerCount} winner ads con CPL medio €${avgCPL.toFixed(2)}\n\n`
        msg += `<b>Target aggiornati:</b>\n`
        changes.forEach(c => {
            const arrow = c.to < c.from ? '📉' : '📈'
            msg += `  ${arrow} ${c.field}: €${c.from} → <b>€${c.to}</b>\n`
        })
        msg += `\n💡 I target vengono stretti automaticamente quando i winner performano costantemente meglio. L'obiettivo è migliorare sempre.`

        await sendTelegramDirect(conn.credentials.bot_token, conn.credentials.chat_id, msg)
    } catch (err) {
        console.error('Target optimizer Telegram error:', err)
    }
}
