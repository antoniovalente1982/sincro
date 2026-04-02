import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { sendTelegramMessage } from '@/lib/telegram'
import { appendLeadToSheet } from '@/lib/google-sheets'

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

// Rate limiting
const rateLimits = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT = 10
const RATE_WINDOW = 60_000

// Public submission endpoint — no auth required
export async function POST(req: NextRequest) {
    // Rate limit by IP
    const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown'
    const now = Date.now()
    const entry = rateLimits.get(ip)
    if (entry && now < entry.resetAt && entry.count >= RATE_LIMIT) {
        return NextResponse.json({ error: 'Too many requests. Try again later.' }, { status: 429 })
    }
    if (!entry || now > (entry?.resetAt || 0)) {
        rateLimits.set(ip, { count: 1, resetAt: now + RATE_WINDOW })
    } else {
        entry.count++
    }

    try {
        const body = await req.json()
        const { funnel_id, name, email, phone, utm_source, utm_medium, utm_campaign, utm_content, utm_term, extra_data, page_variant, event_id } = body

        if (!funnel_id || !name) {
            return NextResponse.json({ error: 'Name and funnel_id are required' }, { status: 400 })
        }

        // Get funnel and its organization
        const { data: funnel, error: funnelError } = await getSupabaseAdmin()
            .from('funnels')
            .select('id, organization_id, name, status, meta_pixel_id, objective, pipeline_id, ai_settings, settings')
            .eq('id', funnel_id)
            .single()

        if (funnelError || !funnel) {
            return NextResponse.json({ error: 'Funnel not found' }, { status: 404 })
        }

        if (funnel.status !== 'active') {
            return NextResponse.json({ error: 'Funnel is not active' }, { status: 400 })
        }

        // Create submission
        const { data: submission, error: subError } = await getSupabaseAdmin()
            .from('funnel_submissions')
            .insert({
                organization_id: funnel.organization_id,
                funnel_id,
                name,
                email: email || null,
                phone: phone || null,
                utm_source: utm_source || null,
                utm_medium: utm_medium || null,
                utm_campaign: utm_campaign || null,
                utm_content: utm_content || null,
                utm_term: utm_term || null,
                extra_data: extra_data || {},
                page_variant: page_variant || 'A',
                ip_address: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || null,
                user_agent: req.headers.get('user-agent') || null,
            })
            .select()
            .single()

        if (subError) {
            return NextResponse.json({ error: subError.message }, { status: 500 })
        }

        // ── Pipeline routing: use funnel's dedicated pipeline, fallback to org default ──
        let targetPipelineId: string | null = funnel.pipeline_id || null

        if (!targetPipelineId) {
            // No dedicated pipeline on funnel → use org default
            const { data: defaultPipeline } = await getSupabaseAdmin()
                .from('pipelines')
                .select('id')
                .eq('organization_id', funnel.organization_id)
                .eq('is_default', true)
                .single()
            targetPipelineId = defaultPipeline?.id || null
        }

        let firstStageId: string | null = null
        if (targetPipelineId) {
            const { data: firstStage } = await getSupabaseAdmin()
                .from('pipeline_stages')
                .select('id')
                .eq('organization_id', funnel.organization_id)
                .eq('pipeline_id', targetPipelineId)
                .order('sort_order', { ascending: true })
                .limit(1)
                .single()
            firstStageId = firstStage?.id || null
        }

        if (!firstStageId) {
            // Final fallback: any first stage in org
            const { data: fallbackStage } = await getSupabaseAdmin()
                .from('pipeline_stages')
                .select('id')
                .eq('organization_id', funnel.organization_id)
                .order('sort_order', { ascending: true })
                .limit(1)
                .single()
            firstStageId = fallbackStage?.id || null
        }

        // ── Lead Deduplication: if email exists, update existing lead instead of creating duplicate ──
        let lead: any = null
        let isExisting = false

        if (email) {
            const { data: existingLead } = await getSupabaseAdmin()
                .from('leads')
                .select('*')
                .eq('organization_id', funnel.organization_id)
                .eq('email', email.toLowerCase().trim())
                .order('created_at', { ascending: false })
                .limit(1)
                .single()

            if (existingLead) {
                isExisting = true
                // Update existing lead with fresh data (phone, utm if missing, submission link)
                // IMPORTANT: Reset stage to first stage so they reappear in pipeline
                // (lead might have gone cold months ago, now they're back with fresh interest)
                const updateData: any = {
                    submission_id: submission.id,
                    stage_id: firstStageId, // ← Reset to "Lead" stage so team sees them again!
                    updated_at: new Date().toISOString(),
                }
                // Only update fields that are currently empty on the existing lead
                if (!existingLead.phone && phone) updateData.phone = phone
                if (!existingLead.utm_source && utm_source) updateData.utm_source = utm_source
                if (!existingLead.utm_campaign && utm_campaign) updateData.utm_campaign = utm_campaign
                if (!existingLead.funnel_id && funnel_id) updateData.funnel_id = funnel_id

                // Merge meta_data without overwriting existing tracking
                const existingMeta = existingLead.meta_data || {}
                updateData.meta_data = {
                    ...existingMeta,
                    ...((!existingMeta.utm_content && body.utm_content) ? { utm_content: body.utm_content } : {}),
                    ...((!existingMeta.utm_term && body.utm_term) ? { utm_term: body.utm_term } : {}),
                    ...((!existingMeta.fbc && body.fbc) ? { fbc: body.fbc } : {}),
                    ...((!existingMeta.fbp && body.fbp) ? { fbp: body.fbp } : {}),
                    last_submission_at: new Date().toISOString(),
                    resubmit_count: (existingMeta.resubmit_count || 0) + 1,
                }

                const { data: updated } = await getSupabaseAdmin()
                    .from('leads')
                    .update(updateData)
                    .eq('id', existingLead.id)
                    .select()
                    .single()
                lead = updated || existingLead

                // Log re-entry activity so team knows this is a returning lead
                await getSupabaseAdmin().from('lead_activities').insert({
                    organization_id: funnel.organization_id,
                    lead_id: existingLead.id,
                    activity_type: 'stage_changed',
                    from_stage_id: existingLead.stage_id,
                    to_stage_id: firstStageId,
                    notes: `🔄 Lead ha compilato di nuovo il form (resubmit #${(existingMeta.resubmit_count || 0) + 1}) — rimesso in pipeline`,
                })

                console.log(`[DEDUP] Lead ${email} resubmitted (id: ${existingLead.id}), reset to first stage`)
            }
        }

        // Create NEW lead only if no existing one was found
        if (!isExisting) {
            const { data: newLead, error: leadError } = await getSupabaseAdmin()
                .from('leads')
                .insert({
                    organization_id: funnel.organization_id,
                    funnel_id,
                    submission_id: submission.id,
                    stage_id: firstStageId,
                    name,
                    email: email || null,
                    phone: phone || null,
                    utm_source: utm_source || null,
                    utm_campaign: utm_campaign || null,
                    product: (() => {
                        // First priority: incoming UTM Source URL parameter
                        if (utm_source) {
                            const lower = String(utm_source).toLowerCase();
                            if (lower.includes('valenteantonio')) return 'Fonte: valenteantonio.it';
                            if (lower.includes('metodosincro')) return 'Fonte: metodosincro.it';
                            if (lower.includes('protocollo27')) return 'Fonte: protocollo27.it';
                        }
                        // Second priority: Funnel name
                        const funnelLower = String(funnel.name).toLowerCase();
                        if (funnelLower.includes('valenteantonio')) return 'Fonte: valenteantonio.it';
                        if (funnelLower.includes('metodosincro')) return 'Fonte: metodosincro.it';
                        if (funnelLower.includes('protocollo27')) return 'Fonte: protocollo27.it';
                        
                        // Default fallback
                        return 'Fonte: Ads - Meta';
                    })(),
                    meta_data: {
                        source: 'funnel', funnel_name: funnel.name,
                        utm_medium: body.utm_medium || null, utm_content: body.utm_content || null, utm_term: body.utm_term || null,
                        // Form extra fields (age, adset angle)
                        child_age: body.extra_data?.child_age || null,
                        adset_angle: body.extra_data?.adset_angle || null,
                        // Tracking data for CRM CAPI events (QualifiedLead, Schedule, etc.)
                        fbc: body.fbc || null,
                        fbp: body.fbp || null,
                        visitor_id: body.visitor_id || null,
                        client_ip: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || null,
                        client_user_agent: req.headers.get('user-agent') || null,
                        event_source_url: body.landing_url ? `https://${body.landing_url}` : null,
                    },
                })
                .select()
                .single()

            if (leadError) {
                console.error('Lead creation error:', leadError)
            }
            lead = newLead
        }

        // Log activity (only for NEW leads, not dedup updates)
        if (lead && firstStageId && !isExisting) {
            await getSupabaseAdmin().from('lead_activities').insert({
                organization_id: funnel.organization_id,
                lead_id: lead.id,
                activity_type: 'stage_changed',
                to_stage_id: firstStageId,
                notes: `Lead catturato dal funnel "${funnel.name}"`,
            })
        }

        if (funnel.meta_pixel_id && lead) {
            await fireCapiEvent(funnel.organization_id, 'Lead', {
                name: name || undefined,
                email: email || undefined,
                phone: phone || undefined,
                fbc: body.fbc || undefined,
                fbp: body.fbp || undefined,
                content_category: funnel.objective || 'cliente',
                client_ip: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || undefined,
                client_user_agent: req.headers.get('user-agent') || undefined,
                event_source_url: body.landing_url ? `https://${body.landing_url}` : undefined,
                event_id: event_id || undefined,
                external_id: body.visitor_id || undefined,
            }, funnel.meta_pixel_id, lead.id)
        }

        // Send Telegram notification and append to Google Sheets
        // IMPORTANT: Must await these before returning, otherwise Vercel kills
        // the serverless function before these async operations complete
        if (lead) {
            const childAge = body.extra_data?.child_age
            const tgMsg = `📥 <b>Nuovo Lead!</b>\n\n` +
                `👤 <b>Nome:</b> ${name}\n` +
                (email ? `📧 <b>Email:</b> ${email}\n` : '') +
                (phone ? `📱 <b>Tel:</b> ${phone}\n` : '') +
                (childAge ? `🎂 <b>Età figlio:</b> ${childAge} anni\n` : '') +
                `🔗 <b>Funnel:</b> ${funnel.name}\n` +
                (utm_source ? `📡 <b>Fonte:</b> ${utm_source}\n` : '') +
                (utm_campaign ? `📢 <b>Campagna:</b> ${utm_campaign}` : '')

            // Run Telegram + Google Sheets in parallel, but AWAIT both
            await Promise.allSettled([
                sendTelegramMessage(funnel.organization_id, tgMsg).catch(err => {
                    console.error('Telegram: exception for lead:', name, err)
                }),
                appendLeadToSheet(funnel.organization_id, {
                    name,
                    email: email || '',
                    phone: phone || '',
                    funnel: funnel.name,
                    utm_source: utm_source || '',
                    utm_campaign: utm_campaign || '',
                    utm_content: utm_content || '',
                    utm_term: utm_term || '',
                    created_at: new Date().toISOString(),
                    landing_url: body.landing_url || `landing.metodosincro.com/f/${body.slug || ''}`,
                }).catch(err => {
                    console.error('Google Sheets: appendLeadToSheet exception for lead:', name, err)
                }),
            ])
        }

        return NextResponse.json({ success: true, lead_id: lead?.id })
    } catch (err: any) {
        console.error('Submission error:', err)
        return NextResponse.json({ error: 'Internal error' }, { status: 500 })
    }
}

async function fireCapiEvent(orgId: string, eventName: string, userData: any, pixelId: string, leadId?: string) {
    try {
        // Get Meta access token from connections
        const { data: conn } = await getSupabaseAdmin()
            .from('connections')
            .select('credentials')
            .eq('organization_id', orgId)
            .eq('provider', 'meta_capi')
            .eq('status', 'active')
            .single()

        if (!conn?.credentials?.access_token) return

        const eventId = userData.event_id || `evt_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`

        const payload = {
            data: [{
                event_name: eventName,
                event_time: Math.floor(Date.now() / 1000),
                event_id: eventId,
                action_source: 'website',
                event_source_url: userData.event_source_url || undefined,
                user_data: {
                    em: userData.email ? [await hashSHA256(userData.email.toLowerCase().trim())] : undefined,
                    ph: userData.phone ? [await hashSHA256(userData.phone.replace(/\D/g, ''))] : undefined,
                    fn: userData.name ? [await hashSHA256(userData.name.split(' ')[0].toLowerCase().trim())] : undefined,
                    ln: userData.name?.includes(' ') ? [await hashSHA256(userData.name.split(' ').slice(1).join(' ').toLowerCase().trim())] : undefined,
                    country: [await hashSHA256('it')],
                    fbc: userData.fbc || undefined,
                    fbp: userData.fbp || undefined,
                    client_ip_address: userData.client_ip || undefined,
                    client_user_agent: userData.client_user_agent || undefined,
                    external_id: userData.external_id ? [await hashSHA256(userData.external_id)] : undefined,
                },
                custom_data: {
                    content_category: userData.content_category || undefined,
                    currency: 'EUR',
                    value: userData.value || 0,
                },
            }],
        }

        const res = await fetch(
            `https://graph.facebook.com/v21.0/${pixelId}/events?access_token=${conn.credentials.access_token}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            }
        )

        const result = await res.json()

        // Log the tracked event
        await getSupabaseAdmin().from('tracked_events').insert({
            organization_id: orgId,
            event_name: eventName,
            event_id: eventId,
            lead_id: leadId || null,
            user_data_hash: { em: !!userData.email, ph: !!userData.phone },
            event_params: { pixel_id: pixelId },
            source: 'server',
            sent_to_provider: res.ok,
            provider_response: result,
        })
    } catch (err) {
        console.error('CAPI event error:', err)
    }
}

async function hashSHA256(data: string): Promise<string> {
    const encoder = new TextEncoder()
    const buffer = await crypto.subtle.digest('SHA-256', encoder.encode(data))
    return Array.from(new Uint8Array(buffer)).map(b => b.toString(16).padStart(2, '0')).join('')
}
