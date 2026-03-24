import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
)

export async function POST(req: NextRequest) {
    try {
        const body = await req.json()
        const { organization_id, funnel_id, page_path, page_variant, visitor_id, utm_source, utm_medium, utm_campaign, utm_content, utm_term, fbadid, referrer, event_id, fbc, fbp, fb_login_id, page_url } = body

        if (!organization_id || !page_path) {
            return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
        }

        const userAgent = req.headers.get('user-agent') || ''
        const forwarded = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || ''
        const clientIp = forwarded ? forwarded.split(',')[0].trim() : ''
        const ipHash = clientIp ? Buffer.from(clientIp).toString('base64').substring(0, 12) : ''

        // Detect device type
        const isMobile = /mobile|android|iphone|ipad/i.test(userAgent)
        const isTablet = /tablet|ipad/i.test(userAgent)
        const deviceType = isTablet ? 'tablet' : isMobile ? 'mobile' : 'desktop'

        const { error } = await supabaseAdmin.from('page_views').insert({
            organization_id,
            funnel_id: funnel_id || null,
            page_path,
            page_variant: page_variant || 'A',
            visitor_id: visitor_id || null,
            utm_source: utm_source || null,
            utm_medium: utm_medium || null,
            utm_campaign: utm_campaign || null,
            utm_content: utm_content || null,
            utm_term: utm_term || null,
            fbadid: fbadid || null,
            referrer: referrer || null,
            user_agent: userAgent.substring(0, 300),
            ip_hash: ipHash,
            device_type: deviceType,
        })

        if (error) {
            console.error('PageView insert error:', error)
            return NextResponse.json({ error: error.message }, { status: 500 })
        }

        // Fire CAPI PageView event — MUST be awaited before response
        // (Vercel kills pending promises after response is sent)
        if (funnel_id && event_id) {
            // Fix #2: For returning visitors, look up their email/phone from previous submissions
            let returningEmail: string | undefined
            let returningPhone: string | undefined
            let returningName: string | undefined
            if (visitor_id) {
                const { data: existingLead } = await supabaseAdmin
                    .from('leads')
                    .select('email, phone, name')
                    .eq('organization_id', organization_id)
                    .contains('meta_data', { visitor_id })
                    .order('created_at', { ascending: false })
                    .limit(1)
                    .single()
                if (existingLead) {
                    returningEmail = existingLead.email || undefined
                    returningPhone = existingLead.phone || undefined
                    returningName = existingLead.name || undefined
                }
            }

            try {
                await fireCapiPageView(organization_id, {
                    event_id,
                    fbc: fbc || undefined,
                    fbp: fbp || undefined,
                    client_ip: clientIp || undefined,
                    client_user_agent: userAgent || undefined,
                    event_source_url: page_url || undefined,
                    external_id: visitor_id || undefined,
                    fb_login_id: fb_login_id || undefined,
                    // Returning visitor enrichment (real data, not simulated)
                    email: returningEmail,
                    phone: returningPhone,
                    name: returningName,
                })
            } catch (err) {
                console.error('CAPI PageView error:', err)
            }
        }

        return NextResponse.json({ success: true })
    } catch (err: any) {
        console.error('PageView error:', err)
        return NextResponse.json({ error: err.message }, { status: 500 })
    }
}

async function fireCapiPageView(orgId: string, params: {
    event_id: string
    fbc?: string
    fbp?: string
    client_ip?: string
    client_user_agent?: string
    event_source_url?: string
    external_id?: string
    fb_login_id?: string
    email?: string
    phone?: string
    name?: string
}) {
    // Get Meta CAPI connection
    const { data: conn } = await supabaseAdmin
        .from('connections')
        .select('credentials, config')
        .eq('organization_id', orgId)
        .eq('provider', 'meta_capi')
        .eq('status', 'active')
        .single()

    if (!conn?.credentials?.access_token) return
    const pixelId = conn.config?.pixel_id || conn.credentials?.pixel_id
    if (!pixelId) return

    const payload = {
        data: [{
            event_name: 'PageView',
            event_time: Math.floor(Date.now() / 1000),
            event_id: params.event_id,
            action_source: 'website',
            event_source_url: params.event_source_url || undefined,
            user_data: {
                fbc: params.fbc || undefined,
                fbp: params.fbp || undefined,
                client_ip_address: params.client_ip || undefined,
                client_user_agent: params.client_user_agent || undefined,
                external_id: params.external_id ? [await hashSHA256(params.external_id)] : undefined,
                fb_login_id: params.fb_login_id ? [params.fb_login_id] : undefined,
                // Returning visitor enrichment (real PII data, hashed)
                em: params.email ? [await hashSHA256(params.email.toLowerCase().trim())] : undefined,
                ph: params.phone ? [await hashSHA256(params.phone.replace(/\D/g, ''))] : undefined,
                fn: params.name ? [await hashSHA256(params.name.split(' ')[0].toLowerCase().trim())] : undefined,
                ln: params.name?.includes(' ') ? [await hashSHA256(params.name.split(' ').slice(1).join(' ').toLowerCase().trim())] : undefined,
                country: params.email || params.phone ? [await hashSHA256('it')] : undefined,
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

    // Track the event
    await supabaseAdmin.from('tracked_events').insert({
        organization_id: orgId,
        event_name: 'PageView',
        event_id: params.event_id,
        user_data_hash: { fbc: !!params.fbc, fbp: !!params.fbp, em: !!params.email, ph: !!params.phone },
        event_params: { pixel_id: pixelId, returning_visitor: !!(params.email || params.phone) },
        source: 'server',
        sent_to_provider: res.ok,
        provider_response: result,
    })
}

async function hashSHA256(data: string): Promise<string> {
    const encoder = new TextEncoder()
    const buffer = await crypto.subtle.digest('SHA-256', encoder.encode(data))
    return Array.from(new Uint8Array(buffer)).map(b => b.toString(16).padStart(2, '0')).join('')
}
