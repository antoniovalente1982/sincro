import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
)

export async function POST(req: NextRequest) {
    try {
        const body = await req.json()
        const { organization_id, funnel_id, page_path, page_variant, visitor_id, utm_source, utm_medium, utm_campaign, utm_content, utm_term, fbadid, referrer } = body

        if (!organization_id || !page_path) {
            return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
        }

        const userAgent = req.headers.get('user-agent') || ''
        const forwarded = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || ''
        const ipHash = forwarded ? Buffer.from(forwarded.split(',')[0].trim()).toString('base64').substring(0, 12) : ''

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

        return NextResponse.json({ success: true })
    } catch (err: any) {
        console.error('PageView error:', err)
        return NextResponse.json({ error: err.message }, { status: 500 })
    }
}
