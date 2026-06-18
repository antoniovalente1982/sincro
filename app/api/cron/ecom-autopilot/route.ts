import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { evaluateRoasScaling, DEFAULT_ECOM_METRICS, calculateRoas } from '@/lib/budget-manager'
import { sendTelegramDirect } from '@/lib/telegram'

function getSupabaseAdmin() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )
}

const META_API_VERSION = 'v21.0'
const ECOM_CAMPAIGN_NAMES = ['MS - [ECOM] Prospecting CBO', 'MS - [ECOM] Retargeting ABO', 'MS - [ECOM] Testing Creative ABO']

export const maxDuration = 120 // 2 minutes max execution time for safety

export async function GET(req: NextRequest) {
    const authHeader = req.headers.get('authorization')
    if (process.env.NODE_ENV === 'production' && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
        const supabase = getSupabaseAdmin()

        // 1. Get all active Meta connections
        const { data: connections } = await supabase
            .from('connections')
            .select('organization_id, credentials')
            .eq('provider', 'meta_ads')
            .eq('status', 'active')

        if (!connections?.length) {
            return NextResponse.json({ ok: true, message: 'No active Meta connections found' })
        }

        const runReport: any[] = []

        for (const conn of connections) {
            const orgId = conn.organization_id
            const { access_token, ad_account_id } = conn.credentials
            if (!access_token || !ad_account_id) continue

            console.log(`[ECOM AUTOPILOT] Starting evaluation for org: ${orgId}...`)
            const orgReport = await runEcomAutopilotForOrg(orgId, ad_account_id, access_token)
            runReport.push({ orgId, ...orgReport })
        }

        return NextResponse.json({ success: true, report: runReport })
    } catch (err: any) {
        console.error('[ECOM AUTOPILOT] Fatal Error:', err)
        return NextResponse.json({ error: err.message }, { status: 500 })
    }
}

async function runEcomAutopilotForOrg(orgId: string, adAccountId: string, token: string) {
    const supabase = getSupabaseAdmin()
    const adAccount = `act_${adAccountId}`
    
    // Fetch active e-commerce campaigns
    const campaignUrl = `https://graph.facebook.com/${META_API_VERSION}/${adAccount}/campaigns?fields=id,name,status,daily_budget,lifetime_budget,budget_remaining&limit=100&access_token=${token}`
    const campaignRes = await fetch(campaignUrl)
    if (!campaignRes.ok) {
        throw new Error(`Failed to fetch campaigns: ${await campaignRes.text()}`)
    }
    const campaignData = await campaignRes.json()
    const allCampaigns = campaignData.data || []
    
    // Filter to only ours
    const ecomCampaigns = allCampaigns.filter((c: any) => 
        c.status === 'ACTIVE' && 
        ECOM_CAMPAIGN_NAMES.includes(c.name)
    )

    if (ecomCampaigns.length === 0) {
        return { message: 'No active e-commerce campaigns found' }
    }

    // Prepare date range: last 4 days (today is partial, so we evaluate yesterday and the 2 days before that)
    const today = new Date().toISOString().split('T')[0]
    const fourDaysAgo = new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    const timeRange = JSON.stringify({ since: fourDaysAgo, until: today })

    const actionsTaken: any[] = []

    for (const campaign of ecomCampaigns) {
        const isCbo = !!campaign.daily_budget
        console.log(`[ECOM AUTOPILOT] Evaluating Campaign: ${campaign.name} (CBO: ${isCbo})`)

        if (isCbo) {
            // --- CBO EVALUATION (Campaign-level budget) ---
            // Fetch daily insights for the campaign
            const insightsUrl = `https://graph.facebook.com/${META_API_VERSION}/${campaign.id}/insights?fields=spend,actions,action_values&time_increment=1&time_range=${encodeURIComponent(timeRange)}&access_token=${token}`
            const insightsRes = await fetch(insightsUrl)
            if (!insightsRes.ok) {
                console.error(`[ECOM AUTOPILOT] Failed to get CBO insights: ${await insightsRes.text()}`)
                continue
            }
            const insightsData = await insightsRes.json()
            const dailyData = insightsData.data || []

            // Order chronologically by date
            dailyData.sort((a: any, b: any) => a.date_start.localeCompare(b.date_start))
            
            // Exclude today from historical average (if it's before 22:00 / 10 PM to avoid partial-day penalty)
            const hour = new Date().getHours()
            const evalData = hour < 22 
                ? dailyData.filter((d: any) => d.date_start !== today)
                : dailyData

            // Calculate ROAS list
            const roasHistory = evalData.map((d: any) => {
                const spend = parseFloat(d.spend || '0')
                const purchaseValObj = d.action_values?.find((a: any) => a.action_type === 'purchase')
                const revenue = purchaseValObj ? parseFloat(purchaseValObj.value) : 0
                return calculateRoas(spend, revenue)
            })

            const currentBudget = parseFloat(campaign.daily_budget) / 100
            const verdict = evaluateRoasScaling(roasHistory, currentBudget)

            console.log(`[ECOM AUTOPILOT] CBO Campaign ${campaign.name}: ROAS history: ${roasHistory.map((r: number) => r.toFixed(2)).join(', ')}. Action: ${verdict.action}`)

            if (verdict.allowed && (verdict.action === 'SCALE' || verdict.action === 'REDUCE' || verdict.action === 'KILL')) {
                const multiplier = verdict.recommendedMultiplier || 1.0
                const newBudget = Math.round(currentBudget * multiplier)
                
                // Meta API update daily_budget (must be in cents)
                const updateUrl = `https://graph.facebook.com/${META_API_VERSION}/${campaign.id}`
                const updateRes = await fetch(updateUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        daily_budget: newBudget * 100,
                        access_token: token
                    })
                })

                if (updateRes.ok) {
                    const detailMsg = `Budget modificato: €${currentBudget.toFixed(0)} ➔ €${newBudget.toFixed(0)} (${verdict.action === 'SCALE' ? '+' : ''}${Math.round((multiplier - 1) * 100)}%)`
                    actionsTaken.push({
                        entity: campaign.name,
                        action: verdict.action,
                        details: detailMsg,
                        reason: verdict.reason
                    })

                    // Log to DB
                    await logActionToDb(supabase, orgId, 'campaign', campaign.id, campaign.name, verdict.action, verdict.reason, {
                        old_budget: currentBudget,
                        new_budget: newBudget,
                        roas_history: roasHistory
                    })
                } else {
                    console.error(`[ECOM AUTOPILOT] CBO Budget update failed: ${await updateRes.text()}`)
                }
            } else {
                actionsTaken.push({
                    entity: campaign.name,
                    action: 'HOLD',
                    reason: verdict.reason
                })
            }
        } else {
            // --- ABO EVALUATION (Adset-level budgets) ---
            // Get all active adsets for the campaign
            const adsetUrl = `https://graph.facebook.com/${META_API_VERSION}/${campaign.id}/adsets?fields=id,name,status,daily_budget&limit=50&access_token=${token}`
            const adsetRes = await fetch(adsetUrl)
            if (!adsetRes.ok) {
                console.error(`[ECOM AUTOPILOT] Failed to get ABO adsets: ${await adsetRes.text()}`)
                continue
            }
            const adsetData = await adsetRes.json()
            const activeAdsets = (adsetData.data || []).filter((as: any) => as.status === 'ACTIVE')

            for (const adset of activeAdsets) {
                // Fetch daily insights for each adset
                const adsetInsightsUrl = `https://graph.facebook.com/${META_API_VERSION}/${adset.id}/insights?fields=spend,actions,action_values&time_increment=1&time_range=${encodeURIComponent(timeRange)}&access_token=${token}`
                const insightsRes = await fetch(adsetInsightsUrl)
                if (!insightsRes.ok) continue
                const insightsData = await insightsRes.json()
                const dailyData = insightsData.data || []

                dailyData.sort((a: any, b: any) => a.date_start.localeCompare(b.date_start))
                const hour = new Date().getHours()
                const evalData = hour < 22 
                    ? dailyData.filter((d: any) => d.date_start !== today)
                    : dailyData

                const roasHistory = evalData.map((d: any) => {
                    const spend = parseFloat(d.spend || '0')
                    const purchaseValObj = d.action_values?.find((a: any) => a.action_type === 'purchase')
                    const revenue = purchaseValObj ? parseFloat(purchaseValObj.value) : 0
                    return calculateRoas(spend, revenue)
                })

                const currentBudget = adset.daily_budget ? parseFloat(adset.daily_budget) / 100 : 20 // Default min fallback
                const verdict = evaluateRoasScaling(roasHistory, currentBudget)

                console.log(`[ECOM AUTOPILOT] ABO Adset ${adset.name}: ROAS history: ${roasHistory.map((r: number) => r.toFixed(2)).join(', ')}. Action: ${verdict.action}`)

                if (verdict.allowed && (verdict.action === 'SCALE' || verdict.action === 'REDUCE' || verdict.action === 'KILL')) {
                    const multiplier = verdict.recommendedMultiplier || 1.0
                    const newBudget = Math.round(currentBudget * multiplier)

                    const updateUrl = `https://graph.facebook.com/${META_API_VERSION}/${adset.id}`
                    const updateRes = await fetch(updateUrl, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            daily_budget: newBudget * 100,
                            access_token: token
                        })
                    })

                    if (updateRes.ok) {
                        const detailMsg = `Budget modificato: €${currentBudget.toFixed(0)} ➔ €${newBudget.toFixed(0)} (${verdict.action === 'SCALE' ? '+' : ''}${Math.round((multiplier - 1) * 100)}%)`
                        actionsTaken.push({
                            entity: adset.name,
                            action: verdict.action,
                            details: detailMsg,
                            reason: verdict.reason
                        })

                        await logActionToDb(supabase, orgId, 'adset', adset.id, adset.name, verdict.action, verdict.reason, {
                            old_budget: currentBudget,
                            new_budget: newBudget,
                            roas_history: roasHistory
                        })
                    } else {
                        console.error(`[ECOM AUTOPILOT] ABO Adset update failed: ${await updateRes.text()}`)
                    }
                } else {
                    actionsTaken.push({
                        entity: adset.name,
                        action: 'HOLD',
                        reason: verdict.reason
                    })
                }
            }
        }
    }

    // 4. Send Telegram Summary Report if actions were taken
    const realActions = actionsTaken.filter((a: any) => a.action !== 'HOLD')
    if (realActions.length > 0) {
        try {
            // Get Telegram credentials for the organization
            const { data: tgConn } = await supabase
                .from('connections')
                .select('credentials')
                .eq('organization_id', orgId)
                .eq('provider', 'telegram')
                .eq('status', 'active')
                .single()

            if (tgConn?.credentials?.bot_token && tgConn?.credentials?.chat_id) {
                let tgMsg = `🤖 <b>Autopilot E-commerce — Modifica Budget</b>\n\n`
                realActions.forEach((a: any) => {
                    const emoji = a.action === 'SCALE' ? '🟢📈' : a.action === 'REDUCE' ? '🟠📉' : '🔴⏸️'
                    tgMsg += `${emoji} <b>${a.entity}</b>\n`
                    tgMsg += `Azione: <code>${a.action}</code>\n`
                    tgMsg += `Dettaglio: <i>${a.details}</i>\n`
                    tgMsg += `Motivo: <i>${a.reason}</i>\n\n`
                })
                await sendTelegramDirect(tgConn.credentials.bot_token, tgConn.credentials.chat_id, tgMsg)
            }
        } catch (tgErr) {
            console.error('[ECOM AUTOPILOT] Telegram notification failed:', tgErr)
        }
    }

    return { actions: actionsTaken }
}

async function logActionToDb(
    supabase: any,
    orgId: string,
    entityType: 'campaign' | 'adset',
    entityId: string,
    entityName: string,
    action: string,
    reason: string,
    details: any
) {
    // Write to ai_realtime_logs
    await supabase.from('ai_realtime_logs').insert({
        organization_id: orgId,
        action: `Ecom Autopilot: ${action}`,
        message: `${entityType === 'campaign' ? 'Campagna' : 'Adset'} "${entityName}" ${action.toLowerCase()}ed. ${details.old_budget}➔${details.new_budget}`,
        thought_process: reason,
        details: {
            entity_id: entityId,
            entity_type: entityType,
            ...details
        },
        tokens_used: 0
    })

    // Write to ad_rule_executions (for dashboard chart tracking)
    await supabase.from('ad_rule_executions').insert({
        organization_id: orgId,
        rule_name: `Ecom Autopilot: ${action}`,
        campaign_id: entityType === 'campaign' ? entityId : undefined,
        entity_name: entityName,
        action_taken: action === 'SCALE' ? 'increase_budget' : action === 'REDUCE' ? 'decrease_budget' : 'pause_ad',
        metrics_snapshot: {
            roas_history: details.roas_history,
            old_budget: details.old_budget,
            new_budget: details.new_budget
        },
        result: 'executed',
        notes: reason
    })
}
