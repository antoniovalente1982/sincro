import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { after } from 'next/server'
import { sendTelegramMessage } from '@/lib/telegram'

function getSupabaseAdmin() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    )
}

// Rate limiting
const rateLimits = new Map<string, { count: number; resetAt: number }>()

export async function POST(req: NextRequest) {
    const ip = req.headers.get('x-forwarded-for') || 'unknown'
    const now = Date.now()
    const entry = rateLimits.get(ip)
    if (entry && now < entry.resetAt && entry.count >= 5) {
        return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
    }
    if (!entry || now > (entry?.resetAt || 0)) {
        rateLimits.set(ip, { count: 1, resetAt: now + 60_000 })
    } else { entry.count++ }

    try {
        const body = await req.json()
        const { parent_name, parent_email, parent_phone, child_name, child_sport, partner_id, scores, radar_submission_id } = body

        if (!parent_name || !parent_email) {
            return NextResponse.json({ error: 'Name and email are required' }, { status: 400 })
        }

        // ── Find the organization (Sincro has one org) ──
        const { data: org } = await getSupabaseAdmin()
            .from('organizations')
            .select('id')
            .limit(1)
            .single()

        if (!org) {
            return NextResponse.json({ error: 'Organization not found' }, { status: 500 })
        }

        // ── Find the first pipeline stage ──
        const { data: defaultPipeline } = await getSupabaseAdmin()
            .from('pipelines').select('id')
            .eq('organization_id', org.id)
            .eq('is_default', true).single()

        let firstStageId: string | null = null
        if (defaultPipeline) {
            const { data: firstStage } = await getSupabaseAdmin()
                .from('pipeline_stages').select('id')
                .eq('organization_id', org.id)
                .eq('pipeline_id', defaultPipeline.id)
                .order('sort_order', { ascending: true }).limit(1).single()
            firstStageId = firstStage?.id || null
        }
        if (!firstStageId) {
            const { data: fallbackStage } = await getSupabaseAdmin()
                .from('pipeline_stages').select('id')
                .eq('organization_id', org.id)
                .order('sort_order', { ascending: true }).limit(1).single()
            firstStageId = fallbackStage?.id || null
        }

        // ── Deduplication: check if lead already exists ──
        let lead: any = null
        let isExisting = false
        const emailNorm = parent_email.toLowerCase().trim()

        const { data: existing } = await getSupabaseAdmin()
            .from('leads').select('*')
            .eq('organization_id', org.id)
            .eq('email', emailNorm)
            .order('created_at', { ascending: false }).limit(1).single()

        if (existing) {
            isExisting = true
            const existingMeta = existing.meta_data || {}
            await getSupabaseAdmin().from('leads').update({
                stage_id: firstStageId,
                updated_at: new Date().toISOString(),
                meta_data: {
                    ...existingMeta,
                    source: 'radar_consulenza',
                    child_name: child_name || existingMeta.child_name,
                    child_sport: child_sport || existingMeta.child_sport,
                    partner_id: partner_id || existingMeta.partner_id,
                    radar_scores: scores || existingMeta.radar_scores,
                    consulenza_requested_at: new Date().toISOString(),
                },
            }).eq('id', existing.id)
            lead = existing

            await getSupabaseAdmin().from('lead_activities').insert({
                organization_id: org.id,
                lead_id: existing.id,
                activity_type: 'stage_changed',
                from_stage_id: existing.stage_id,
                to_stage_id: firstStageId,
                notes: `🧠 Consulenza gratuita richiesta da Radar Sincro${partner_id ? ` (Partner: ${partner_id})` : ''}`,
            })
        } else {
            // ── Create new lead ──
            const { data: newLead, error: leadError } = await getSupabaseAdmin()
                .from('leads')
                .insert({
                    organization_id: org.id,
                    stage_id: firstStageId,
                    name: parent_name,
                    email: emailNorm,
                    phone: parent_phone || null,
                    utm_source: partner_id ? `partner_${partner_id}` : 'radar_sincro',
                    utm_campaign: 'radar_quiz',
                    product: partner_id ? `Fonte: Partner — ${partner_id}` : 'Fonte: Radar Sincro',
                    meta_data: {
                        source: 'radar_consulenza',
                        child_name: child_name || null,
                        child_sport: child_sport || null,
                        partner_id: partner_id || null,
                        radar_scores: scores || null,
                        consulenza_requested_at: new Date().toISOString(),
                    },
                })
                .select().single()

            if (leadError) {
                console.error('Lead creation error:', leadError)
                return NextResponse.json({ error: 'Failed to create lead' }, { status: 500 })
            }
            lead = newLead

            if (lead && firstStageId) {
                await getSupabaseAdmin().from('lead_activities').insert({
                    organization_id: org.id,
                    lead_id: lead.id,
                    activity_type: 'stage_changed',
                    to_stage_id: firstStageId,
                    notes: `🧠 Lead catturato da Radar Sincro — Consulenza gratuita richiesta${partner_id ? ` (Partner: ${partner_id})` : ''}`,
                })
            }
        }

        // ── Mark radar_submission as converted ──
        if (radar_submission_id) {
            try {
                await getSupabaseAdmin()
                    .from('radar_submissions')
                    .update({
                        converted: true,
                        converted_at: new Date().toISOString(),
                        lead_id: lead?.id || null,
                    })
                    .eq('id', radar_submission_id)
            } catch (e) { console.error('Failed to mark radar submission as converted:', e) }
        }

        // ── Background: Telegram notification ──
        after(async () => {
            try {
                const scoreStr = scores
                    ? `\n📊 Punteggio: ${scores.overall}% (F:${scores.fiducia}% P:${scores.pressione}% M:${scores.motivazione}% B:${scores.blocchi}%)`
                    : ''

                const tgMsg = `🧠 <b>NUOVA CONSULENZA GRATUITA</b> — Radar Sincro\n\n` +
                    `👤 <b>Genitore:</b> ${parent_name}\n` +
                    `📧 <b>Email:</b> ${emailNorm}\n` +
                    (parent_phone ? `📱 <b>Tel:</b> ${parent_phone}\n` : '') +
                    (child_name ? `👦 <b>Ragazzo:</b> ${child_name}\n` : '') +
                    (child_sport ? `⚽ <b>Sport:</b> ${child_sport}\n` : '') +
                    (partner_id ? `🤝 <b>Partner:</b> ${partner_id}\n` : '') +
                    scoreStr +
                    `\n\n✅ Lead ${isExisting ? 'aggiornato' : 'creato'} nel CRM`

                await sendTelegramMessage(org.id, tgMsg).catch(console.error)
            } catch (err) {
                console.error('[CONSULENZA] Telegram error:', err)
            }
        })

        return NextResponse.json({ success: true, lead_id: lead?.id })
    } catch (err: any) {
        console.error('Consulenza error:', err)
        return NextResponse.json({ error: 'Internal error' }, { status: 500 })
    }
}
