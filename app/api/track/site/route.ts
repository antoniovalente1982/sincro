import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getSupabaseAdmin() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    )
}

// ── CORS headers — must be open for external domains (WordPress, ecommerce, etc.)
const CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
}

// Handle preflight (browser CORS check)
export async function OPTIONS() {
    return new NextResponse(null, { status: 204, headers: CORS_HEADERS })
}

/**
 * POST /api/track/site
 *
 * Universal tracker endpoint for external sites.
 * Install on any WordPress / ecommerce / static site via this snippet:
 *
 * <script>
 * (function(){
 *   var d = {
 *     site_id: 'ms-metodosincro-it',
 *     page_path: location.pathname,
 *     page_title: document.title,
 *     referrer: document.referrer,
 *     utm_source:   new URLSearchParams(location.search).get('utm_source'),
 *     utm_medium:   new URLSearchParams(location.search).get('utm_medium'),
 *     utm_campaign: new URLSearchParams(location.search).get('utm_campaign'),
 *     utm_content:  new URLSearchParams(location.search).get('utm_content'),
 *   };
 *   navigator.sendBeacon('https://landing.metodosincro.com/api/track/site', JSON.stringify(d));
 * })();
 * </script>
 */
export async function POST(req: NextRequest) {
    try {
        const body = await req.json()
        const {
            site_id,
            page_path,
            page_title,
            referrer,
            utm_source,
            utm_medium,
            utm_campaign,
            utm_content,
            utm_term,
            visitor_id,
        } = body

        if (!site_id || !page_path) {
            return NextResponse.json(
                { error: 'Missing site_id or page_path' },
                { status: 400, headers: CORS_HEADERS }
            )
        }

        const supabase = getSupabaseAdmin()

        // Resolve site_id → organization_id
        const { data: tracker } = await supabase
            .from('site_trackers')
            .select('organization_id, site_name')
            .eq('site_id', site_id)
            .single()

        if (!tracker) {
            return NextResponse.json(
                { error: 'Unknown site_id' },
                { status: 404, headers: CORS_HEADERS }
            )
        }

        // Device detection
        const userAgent = req.headers.get('user-agent') || ''
        const isMobile = /mobile|android|iphone|ipad/i.test(userAgent)
        const isTablet = /tablet|ipad/i.test(userAgent)
        const deviceType = isTablet ? 'tablet' : isMobile ? 'mobile' : 'desktop'

        // IP hash (privacy-safe)
        const forwarded = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || ''
        const clientIp = forwarded ? forwarded.split(',')[0].trim() : ''
        const ipHash = clientIp ? Buffer.from(clientIp).toString('base64').substring(0, 12) : ''

        // Save to page_views (same table used by internal funnels)
        // source field marks this as coming from an external site
        const { error } = await supabase.from('page_views').insert({
            organization_id: tracker.organization_id,
            funnel_id: null,                              // no funnel — it's a site page
            page_path: `[${tracker.site_name}]${page_path}`, // e.g. [metodosincro.it]/video-gratuito
            page_variant: 'A',
            visitor_id: visitor_id || null,
            utm_source: utm_source || null,
            utm_medium: utm_medium || null,
            utm_campaign: utm_campaign || null,
            utm_content: utm_content || null,
            utm_term: utm_term || null,
            referrer: referrer || null,
            user_agent: userAgent.substring(0, 300),
            ip_hash: ipHash,
            device_type: deviceType,
        })

        if (error) {
            console.error('[SiteTracker] page_views insert error:', error)
            return NextResponse.json({ error: error.message }, { status: 500, headers: CORS_HEADERS })
        }

        return NextResponse.json({ success: true }, { headers: CORS_HEADERS })
    } catch (err: any) {
        console.error('[SiteTracker] error:', err)
        return NextResponse.json({ error: 'Internal error' }, { status: 500, headers: CORS_HEADERS })
    }
}
