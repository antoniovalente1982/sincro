import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { sendTelegramMessage } from '@/lib/telegram'
import { appendLeadToSheet } from '@/lib/google-sheets'

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
)

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
        const { funnel_id, name, email, phone, utm_source, utm_medium, utm_campaign, utm_content, utm_term, extra_data, page_variant } = body

        if (!funnel_id || !name) {
            return NextResponse.json({ error: 'Name and funnel_id are required' }, { status: 400 })
        }

        // Get funnel and its organization
        const { data: funnel, error: funnelError } = await supabaseAdmin
            .from('funnels')
            .select('id, organization_id, name, status, meta_pixel_id, objective')
            .eq('id', funnel_id)
            .single()

        if (funnelError || !funnel) {
            return NextResponse.json({ error: 'Funnel not found' }, { status: 404 })
        }

        if (funnel.status !== 'active') {
            return NextResponse.json({ error: 'Funnel is not active' }, { status: 400 })
        }

        // Create submission
        const { data: submission, error: subError } = await supabaseAdmin
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

        // Get first stage of the DEFAULT pipeline to assign to the lead
        const { data: defaultPipeline } = await supabaseAdmin
            .from('pipelines')
            .select('id')
            .eq('organization_id', funnel.organization_id)
            .eq('is_default', true)
            .single()

        let firstStageId: string | null = null
        if (defaultPipeline) {
            const { data: firstStage } = await supabaseAdmin
                .from('pipeline_stages')
                .select('id')
                .eq('organization_id', funnel.organization_id)
                .eq('pipeline_id', defaultPipeline.id)
                .order('sort_order', { ascending: true })
                .limit(1)
                .single()
            firstStageId = firstStage?.id || null
        }

        if (!firstStageId) {
            // Fallback: get any first stage
            const { data: fallbackStage } = await supabaseAdmin
                .from('pipeline_stages')
                .select('id')
                .eq('organization_id', funnel.organization_id)
                .order('sort_order', { ascending: true })
                .limit(1)
                .single()
            firstStageId = fallbackStage?.id || null
        }

        // Create lead automatically
        const { data: lead, error: leadError } = await supabaseAdmin
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
                product: funnel.name,
                meta_data: { source: 'funnel', funnel_name: funnel.name },
            })
            .select()
            .single()

        if (leadError) {
            console.error('Lead creation error:', leadError)
        }

        // Log activity
        if (lead && firstStageId) {
            await supabaseAdmin.from('lead_activities').insert({
                organization_id: funnel.organization_id,
                lead_id: lead.id,
                activity_type: 'stage_changed',
                to_stage_id: firstStageId,
                notes: `Lead catturato dal funnel "${funnel.name}"`,
            })
        }

        if (funnel.meta_pixel_id && lead) {
            await fireCapiEvent(funnel.organization_id, 'Lead', {
                email: email || undefined,
                phone: phone || undefined,
                fbc: body.fbc || undefined,
                fbp: body.fbp || undefined,
                content_category: funnel.objective || 'cliente',
                client_ip: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || undefined,
                client_user_agent: req.headers.get('user-agent') || undefined,
                event_source_url: body.landing_url ? `https://${body.landing_url}` : undefined,
            }, funnel.meta_pixel_id, lead.id)
        }

        // Send Telegram notification (non-blocking)
        if (lead) {
            const tgMsg = `📥 <b>Nuovo Lead!</b>\n\n` +
                `👤 <b>Nome:</b> ${name}\n` +
                (email ? `📧 <b>Email:</b> ${email}\n` : '') +
                (phone ? `📱 <b>Tel:</b> ${phone}\n` : '') +
                `🔗 <b>Funnel:</b> ${funnel.name}\n` +
                (utm_source ? `📡 <b>Fonte:</b> ${utm_source}\n` : '') +
                (utm_campaign ? `📢 <b>Campagna:</b> ${utm_campaign}` : '')

            sendTelegramMessage(funnel.organization_id, tgMsg).then(ok => {
                if (!ok) console.error('Telegram: notification failed for lead:', name)
            }).catch(err => {
                console.error('Telegram: exception for lead:', name, err)
            })

            // Append to Google Sheets (non-blocking)
            appendLeadToSheet(funnel.organization_id, {
                name,
                email: email || '',
                phone: phone || '',
                funnel: funnel.name,
                utm_source: utm_source || '',
                utm_campaign: utm_campaign || '',
                created_at: new Date().toISOString(),
                landing_url: body.landing_url || `landing.metodosincro.com/f/${body.slug || ''}`,
            }).then(ok => {
                if (!ok) console.error('Google Sheets: appendLeadToSheet returned false for lead:', name)
            }).catch(err => {
                console.error('Google Sheets: appendLeadToSheet exception for lead:', name, err)
            })
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
        const { data: conn } = await supabaseAdmin
            .from('connections')
            .select('credentials')
            .eq('organization_id', orgId)
            .eq('provider', 'meta_capi')
            .eq('status', 'active')
            .single()

        if (!conn?.credentials?.access_token) return

        const eventId = `evt_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`

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
                    fbc: userData.fbc || undefined,
                    fbp: userData.fbp || undefined,
                    client_ip_address: userData.client_ip || undefined,
                    client_user_agent: userData.client_user_agent || undefined,
                },
                custom_data: {
                    content_category: userData.content_category || undefined,
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
        await supabaseAdmin.from('tracked_events').insert({
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
