import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
)

export async function POST(req: NextRequest) {
    try {
        const body = await req.json()
        const { organization_id, funnel_id, page_path, page_variant, visitor_id, utm_source, utm_medium, utm_campaign, utm_content, utm_term, fbadid, referrer, event_id, fbc, fbp, page_url } = body

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

        // Fire CAPI PageView event (non-blocking)
        if (funnel_id && event_id) {
            fireCapiPageView(organization_id, {
                event_id,
                fbc: fbc || undefined,
                fbp: fbp || undefined,
                client_ip: clientIp || undefined,
                client_user_agent: userAgent || undefined,
                event_source_url: page_url || undefined,
            }).catch(err => console.error('CAPI PageView error:', err))
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
        user_data_hash: { fbc: !!params.fbc, fbp: !!params.fbp },
        event_params: { pixel_id: pixelId },
        source: 'server',
        sent_to_provider: res.ok,
        provider_response: result,
    })
}
