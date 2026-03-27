import { NextRequest, NextResponse } from 'next/server'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { sendTelegramDirect, sendTelegramPhoto } from '@/lib/telegram'
import { runCreativePipeline } from '@/lib/creative-pipeline'

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

const META_API_VERSION = 'v21.0'

// Creative Pipeline Cron — runs at midnight (00:00)
// Analyzes deficit, generates creative briefs, notifies via Telegram
export const maxDuration = 60

export async function GET(req: NextRequest) {
    const authHeader = req.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
        // Get all orgs with autopilot active
        const { data: configs } = await getSupabaseAdmin()
            .from('ai_agent_config')
            .select('organization_id, autopilot_active')
            .eq('autopilot_active', true)

        if (!configs?.length) {
            return NextResponse.json({ ok: true, message: 'No active autopilots' })
        }

        const results: any[] = []

        for (const config of configs) {
            const orgId = config.organization_id

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

            // Fetch ad-level data from Meta (same as ai-engine cron)
            const today = new Date().toISOString().slice(0, 10)
            const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

            const insightsUrl = `https://graph.facebook.com/${META_API_VERSION}/${adAccount}/insights?` +
                `fields=ad_id,ad_name,adset_id,adset_name,campaign_id,campaign_name,spend,impressions,clicks,ctr,actions,cost_per_action_type` +
                `&level=ad&time_range=${encodeURIComponent(JSON.stringify({ since: sevenDaysAgo, until: today }))}&limit=500&access_token=${access_token}`

            const insightsRes = await fetch(insightsUrl)
            if (!insightsRes.ok) continue
            const insightsData = await insightsRes.json()

            const ads = (insightsData.data || []).map((insight: any) => {
                const leadsCount = insight.actions?.find((a: any) => a.action_type === 'lead')?.value || 0
                const cplValue = insight.cost_per_action_type?.find((a: any) => a.action_type === 'lead')?.value || 0
                return {
                    ad_id: insight.ad_id,
                    ad_name: insight.ad_name,
                    adset_id: insight.adset_id,
                    adset_name: insight.adset_name,
                    campaign_id: insight.campaign_id,
                    campaign_name: insight.campaign_name,
                    spend: parseFloat(insight.spend || '0'),
                    impressions: parseInt(insight.impressions || '0'),
                    clicks: parseInt(insight.clicks || '0'),
                    ctr: parseFloat(insight.ctr || '0'),
                    leads_count: parseInt(leadsCount),
                    cpl: parseFloat(cplValue),
                }
            })

            if (ads.length === 0) continue

            // Get campaign budgets
            const campaignIds = [...new Set(ads.map((a: any) => a.campaign_id))]
            const campaignBudgets: Record<string, number> = {}
            for (const cId of campaignIds) {
                try {
                    const cRes = await fetch(`https://graph.facebook.com/${META_API_VERSION}/${cId}?fields=daily_budget&access_token=${access_token}`)
                    if (cRes.ok) {
                        const cData = await cRes.json()
                        campaignBudgets[cId as string] = parseFloat(cData.daily_budget || '0') / 100
                    }
                } catch {}
            }

            // Build adset→angle and adset→name maps from ad names/data
            const adsetAngles: Record<string, string> = {}
            const adsetNames: Record<string, string> = {}
            const adsetUtmTerms: Record<string, string> = {}
            ads.forEach((ad: any) => {
                if (!adsetAngles[ad.adset_id]) {
                    // Infer angle from adset name
                    const name = (ad.adset_name || '').toLowerCase()
                    let angle = 'generic'
                    if (name.includes('efficien') || name.includes('eff')) angle = 'efficiency'
                    else if (name.includes('system') || name.includes('metodo') || name.includes('sys')) angle = 'system'
                    else if (name.includes('emozion') || name.includes('dolor') || name.includes('emo')) angle = 'emotional'
                    else if (name.includes('status') || name.includes('corona')) angle = 'status'
                    else if (name.includes('edu') || name.includes('educaz')) angle = 'education'
                    else if (name.includes('trasf') || name.includes('transform')) angle = 'transformation'
                    else if (name.includes('calcio')) angle = 'sport_performance'
                    else if (name.includes('mental')) angle = 'mental_coaching'

                    adsetAngles[ad.adset_id] = angle
                    adsetNames[ad.adset_id] = ad.adset_name
                    adsetUtmTerms[ad.adset_id] = angle.replace(/[^a-z_]/g, '_')
                }
            })

            // Run the pipeline
            try {
                const pipelineResult = await runCreativePipeline(
                    orgId, ads, campaignBudgets, adsetAngles, adsetNames, adsetUtmTerms,
                )

                // Send Telegram with all generated briefs
                if (pipelineResult.briefs_generated.length > 0) {
                    // Get Telegram credentials
                    const { data: tgConn } = await getSupabaseAdmin()
                        .from('connections')
                        .select('credentials')
                        .eq('organization_id', orgId)
                        .eq('provider', 'telegram')
                        .eq('status', 'active')
                        .single()

                    if (tgConn?.credentials?.bot_token && tgConn?.credentials?.chat_id) {
                        let msg = '🎨 <b>CREATIVE PIPELINE — Mezzanotte</b>\n\n'
                        msg += `📊 Deficit totale: ${pipelineResult.total_deficit} ads mancanti\n`
                        msg += `✨ Generate: ${pipelineResult.briefs_generated.length} nuove creative\n\n`
                        await sendTelegramDirect(tgConn.credentials.bot_token, tgConn.credentials.chat_id, msg)

                        for (const brief of pipelineResult.briefs_generated) {
                            let text = `🎯 <b>${brief.name}</b>\n`
                            text += `📐 ${brief.aspect_ratio} | Angolo: ${brief.angle.toUpperCase()}\n`
                            text += `🧠 Pocket #${brief.pocket.pocket_id}: ${brief.pocket.pocket_name}\n`
                            text += `📊 ${brief.pocket.buyer_state}\n`
                            text += `❓ "${brief.pocket.core_question}"\n\n`
                            text += `📝 <b>Headline:</b> ${brief.copy.headline}\n`
                            text += `✏️ ${brief.copy.primary.substring(0, 150)}...\n\n`
                            text += `🎯 AdSet: ${brief.adset.name}\n`
                            text += `💡 ${brief.winning_context.top_ads_summary}\n\n`
                            text += `✅ "Approva ${brief.name}" → Lancio automatico\n`
                            text += `❌ "Rifiuta ${brief.name}" → Archivia\n`

                            if (brief.image_url) {
                                await sendTelegramPhoto(tgConn.credentials.bot_token, tgConn.credentials.chat_id, brief.image_url, text)
                            } else {
                                await sendTelegramDirect(tgConn.credentials.bot_token, tgConn.credentials.chat_id, text)
                            }
                        }

                        if (pipelineResult.skipped_reasons.length > 0) {
                            await sendTelegramDirect(tgConn.credentials.bot_token, tgConn.credentials.chat_id, `⏭ Skipped: ${pipelineResult.skipped_reasons.join(', ')}\n`)
                        }
                    }

                    // Log
                    await getSupabaseAdmin().from('ai_episodes').insert({
                        organization_id: orgId,
                        episode_type: 'automation',
                        action_type: 'creative_pipeline_cron',
                        target_type: 'ad_creatives',
                        context: {
                            briefs_count: pipelineResult.briefs_generated.length,
                            total_deficit: pipelineResult.total_deficit,
                            angles: pipelineResult.angles_analyzed,
                            cron: true,
                        },
                        reasoning: `Pipeline mezzanotte: ${pipelineResult.briefs_generated.length} briefs generati, deficit ${pipelineResult.total_deficit}`,
                        outcome: 'positive',
                        outcome_score: 0.7,
                    })
                }

                results.push({
                    org: orgId,
                    briefs: pipelineResult.briefs_generated.length,
                    deficit: pipelineResult.total_deficit,
                    angles: pipelineResult.angles_analyzed,
                })
            } catch (err: any) {
                console.error(`[Creative Pipeline Cron] Org ${orgId} error:`, err.message)
                results.push({ org: orgId, error: err.message })
            }
        }

        return NextResponse.json({ ok: true, results })
    } catch (err: any) {
        console.error('Creative Pipeline cron error:', err)
        return NextResponse.json({ error: 'Internal error' }, { status: 500 })
    }
}
