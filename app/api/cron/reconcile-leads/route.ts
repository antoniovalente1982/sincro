import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { sendTelegramMessage } from '@/lib/telegram'

// ═══════════════════════════════════════════════════════════════
// 🧹 RECONCILE LEADS — Daily "janitor" cron (00:10)
//
// Finds submissions from the last 24h that have NO matching lead
// and creates the missing leads. This is a safety net for the
// rare case where after() fails silently.
// ═══════════════════════════════════════════════════════════════

export const maxDuration = 30

export async function GET(req: NextRequest) {
    const authHeader = req.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = getSupabaseAdmin()
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    let recovered = 0
    const details: string[] = []

    try {
        // 1. Get all submissions from last 24h
        const { data: submissions, error: subError } = await supabase
            .from('funnel_submissions')
            .select('id, organization_id, funnel_id, name, email, phone, utm_source, utm_campaign, utm_content, utm_term, extra_data, created_at')
            .gte('created_at', since)
            .order('created_at', { ascending: true })

        if (subError || !submissions?.length) {
            return NextResponse.json({ ok: true, message: 'No submissions to check', recovered: 0 })
        }

        // 2. Get all leads that reference these submissions
        const subIds = submissions.map(s => s.id)
        const { data: existingLeads } = await supabase
            .from('leads')
            .select('submission_id')
            .in('submission_id', subIds)

        const linkedSubIds = new Set((existingLeads || []).map(l => l.submission_id))

        // 3. Find orphaned submissions (no lead created)
        const orphans = submissions.filter(s => !linkedSubIds.has(s.id))

        if (orphans.length === 0) {
            return NextResponse.json({ ok: true, message: 'All submissions have leads ✅', checked: submissions.length, recovered: 0 })
        }

        console.log(`[RECONCILE] Found ${orphans.length} orphaned submissions out of ${submissions.length}`)

        // 4. For each orphan, create the lead
        for (const sub of orphans) {
            try {
                // Get funnel info
                const { data: funnel } = await supabase
                    .from('funnels')
                    .select('id, organization_id, name, pipeline_id')
                    .eq('id', sub.funnel_id)
                    .single()

                if (!funnel) {
                    console.error(`[RECONCILE] Funnel ${sub.funnel_id} not found for submission ${sub.id}`)
                    continue
                }

                // Find pipeline first stage
                let firstStageId: string | null = null
                const pipelineId = funnel.pipeline_id

                if (pipelineId) {
                    const { data: stage } = await supabase
                        .from('pipeline_stages').select('id')
                        .eq('organization_id', funnel.organization_id)
                        .eq('pipeline_id', pipelineId)
                        .order('sort_order', { ascending: true }).limit(1).single()
                    firstStageId = stage?.id || null
                }

                if (!firstStageId) {
                    const { data: fallback } = await supabase
                        .from('pipeline_stages').select('id')
                        .eq('organization_id', funnel.organization_id)
                        .order('sort_order', { ascending: true }).limit(1).single()
                    firstStageId = fallback?.id || null
                }

                // Dedup check — maybe the lead exists with a different submission_id
                if (sub.email || sub.phone) {
                    let query = supabase.from('leads').select('id')
                        .eq('organization_id', funnel.organization_id)
                    if (sub.email && sub.phone) {
                        query = query.or(`email.eq.${sub.email.toLowerCase().trim()},phone.eq.${sub.phone.trim()}`)
                    } else if (sub.email) {
                        query = query.eq('email', sub.email.toLowerCase().trim())
                    } else {
                        query = query.eq('phone', sub.phone.trim())
                    }
                    const { data: existing } = await query.limit(1).single()
                    if (existing) {
                        // Lead exists by email/phone, just link the submission
                        await supabase.from('leads')
                            .update({ submission_id: sub.id })
                            .eq('id', existing.id)
                        console.log(`[RECONCILE] Linked submission ${sub.id} to existing lead ${existing.id}`)
                        continue
                    }
                }

                // Create the missing lead
                const product = (() => {
                    if (sub.utm_source) {
                        const lower = String(sub.utm_source).toLowerCase()
                        if (lower.includes('valenteantonio')) return 'Fonte: valenteantonio.it'
                        if (lower.includes('metodosincro')) return 'Fonte: metodosincro.it'
                        if (lower.includes('protocollo27')) return 'Fonte: protocollo27.it'
                    }
                    const funnelLower = String(funnel.name).toLowerCase()
                    if (funnelLower.includes('valenteantonio')) return 'Fonte: valenteantonio.it'
                    if (funnelLower.includes('metodosincro')) return 'Fonte: metodosincro.it'
                    if (funnelLower.includes('protocollo27')) return 'Fonte: protocollo27.it'
                    return 'Fonte: Ads - Meta'
                })()

                const { data: newLead, error: leadError } = await supabase
                    .from('leads')
                    .insert({
                        organization_id: funnel.organization_id,
                        funnel_id: sub.funnel_id,
                        submission_id: sub.id,
                        stage_id: firstStageId,
                        name: sub.name,
                        email: sub.email || null,
                        phone: sub.phone || null,
                        utm_source: sub.utm_source || null,
                        utm_campaign: sub.utm_campaign || null,
                        product,
                        meta_data: {
                            source: 'reconcile_cron',
                            funnel_name: funnel.name,
                            child_age: sub.extra_data?.child_age || null,
                            adset_angle: sub.extra_data?.adset_angle || null,
                            recovered_at: new Date().toISOString(),
                        },
                    })
                    .select().single()

                if (leadError) {
                    console.error(`[RECONCILE] Failed to create lead for ${sub.name}:`, leadError)
                    continue
                }

                // Log activity
                if (newLead && firstStageId) {
                    await supabase.from('lead_activities').insert({
                        organization_id: funnel.organization_id,
                        lead_id: newLead.id,
                        activity_type: 'stage_changed',
                        to_stage_id: firstStageId,
                        notes: `🧹 Lead recuperato dal cron reconcile (submission del ${new Date(sub.created_at).toLocaleString('it-IT')})`,
                    })
                }

                recovered++
                details.push(`${sub.name} (${sub.email || sub.phone})`)
                console.log(`[RECONCILE] ✅ Recovered lead: ${sub.name} from submission ${sub.id}`)

            } catch (err) {
                console.error(`[RECONCILE] Error processing submission ${sub.id}:`, err)
            }
        }

        // 5. Notify via Telegram if any recovered
        if (recovered > 0) {
            // Get org IDs from recovered orphans
            const orgIds = [...new Set(orphans.map(o => o.organization_id))]
            for (const orgId of orgIds) {
                const msg = `🧹 <b>Reconcile Leads</b>\n\n` +
                    `Trovati <b>${orphans.length}</b> lead orfani nelle ultime 24h.\n` +
                    `Recuperati: <b>${recovered}</b>\n\n` +
                    details.map(d => `• ${d}`).join('\n') +
                    `\n\n<i>Cron giornaliero 00:10</i>`
                await sendTelegramMessage(orgId, msg).catch(() => {})
            }
        }

        return NextResponse.json({
            ok: true,
            checked: submissions.length,
            orphans: orphans.length,
            recovered,
            details,
        })

    } catch (err: any) {
        console.error('[RECONCILE] Fatal error:', err)
        return NextResponse.json({ error: err.message }, { status: 500 })
    }
}
