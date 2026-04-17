import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

/**
 * POST /api/track/event
 *
 * Generic CAPI endpoint for firing ANY Meta Conversion API event.
 * Used by the client-side tracking hook for:
 *   - ViewContent  (3s engagement / 30% scroll)
 *   - InitiateCheckout (form field focus)
 *   - Any future custom events
 *
 * DEDUPLICATION: The client-side Pixel fires the same event with the same
 * eventID. Meta will deduplicate Pixel + CAPI events that share the same
 * event_name + event_id within a 48h window.
 *
 * NOTE: PageView and Lead have their own dedicated endpoints with additional
 * logic (PageView = /api/track/pageview, Lead = /api/submit).
 */

function getSupabaseAdmin() {
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!serviceKey) {
        console.error('SUPABASE_SERVICE_ROLE_KEY is missing.')
    }
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        serviceKey || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    )
}

// Bot detection — these User-Agents should NEVER fire CAPI events
const BOT_PATTERNS = [
    /bot/i, /crawler/i, /spider/i, /crawling/i,
    /facebookexternalhit/i,     // Meta's link preview crawler
    /WhatsApp/i,                // WhatsApp link preview
    /Googlebot/i, /Bingbot/i, /YandexBot/i, /Baiduspider/i,
    /Slurp/i, /DuckDuckBot/i, /Sogou/i,
    /ia_archiver/i,             // Alexa crawler
    /Mediapartners-Google/i,    // Google AdSense
    /AdsBot-Google/i,           // Google Ads crawler
    /Lighthouse/i,              // Google Lighthouse
    /headless/i,                // Headless Chrome
    /PhantomJS/i, /Selenium/i, /puppeteer/i,
    /prerender/i, /Prerender/i,
    /Twitterbot/i, /LinkedInBot/i, /Slackbot/i, /TelegramBot/i,
]

function isBot(userAgent: string): boolean {
    if (!userAgent || userAgent.length < 10) return true  // suspiciously short UA
    return BOT_PATTERNS.some(pattern => pattern.test(userAgent))
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json()
        const {
            organization_id,
            event_name,
            event_id,
            visitor_id,
            fbc,
            fbp,
            page_url,
            extra_data,
        } = body

        // Validate required fields
        if (!organization_id || !event_name || !event_id) {
            return NextResponse.json({ error: 'Missing required fields: organization_id, event_name, event_id' }, { status: 400 })
        }

        const userAgent = req.headers.get('user-agent') || ''
        const forwarded = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || ''
        const clientIp = forwarded ? forwarded.split(',')[0].trim() : ''

        // Block bots from sending CAPI events (they inflate numbers)
        if (isBot(userAgent)) {
            return NextResponse.json({ success: true, filtered: 'bot' })
        }

        // Get Meta CAPI connection
        const supabase = getSupabaseAdmin()
        const { data: conn } = await supabase
            .from('connections')
            .select('credentials, config')
            .eq('organization_id', organization_id)
            .eq('provider', 'meta_capi')
            .eq('status', 'active')
            .single()

        if (!conn?.credentials?.access_token) {
            return NextResponse.json({ success: true, skipped: 'no_capi_connection' })
        }

        const pixelId = conn.config?.pixel_id || conn.credentials?.pixel_id
        if (!pixelId) {
            return NextResponse.json({ success: true, skipped: 'no_pixel_id' })
        }

        // For returning visitors, enrich with PII from previous submissions
        let enrichedEmail: string | undefined
        let enrichedPhone: string | undefined
        let enrichedName: string | undefined

        if (visitor_id) {
            const { data: existingLead } = await supabase
                .from('leads')
                .select('email, phone, name')
                .eq('organization_id', organization_id)
                .contains('meta_data', { visitor_id })
                .order('created_at', { ascending: false })
                .limit(1)
                .single()

            if (existingLead) {
                enrichedEmail = existingLead.email || undefined
                enrichedPhone = existingLead.phone || undefined
                enrichedName = existingLead.name || undefined
            }
        }

        // Build CAPI payload
        const payload = {
            data: [{
                event_name,
                event_time: Math.floor(Date.now() / 1000),
                event_id,
                action_source: 'website' as const,
                event_source_url: page_url || undefined,
                user_data: {
                    fbc: fbc || undefined,
                    fbp: fbp || undefined,
                    client_ip_address: clientIp || undefined,
                    client_user_agent: userAgent || undefined,
                    external_id: visitor_id ? [await hashSHA256(visitor_id)] : undefined,
                    // Returning visitor enrichment (real PII, hashed)
                    em: enrichedEmail ? [await hashSHA256(enrichedEmail.toLowerCase().trim())] : undefined,
                    ph: enrichedPhone ? [await hashSHA256(enrichedPhone.replace(/\D/g, ''))] : undefined,
                    fn: enrichedName ? [await hashSHA256(enrichedName.split(' ')[0].toLowerCase().trim())] : undefined,
                    ln: enrichedName?.includes(' ') ? [await hashSHA256(enrichedName.split(' ').slice(1).join(' ').toLowerCase().trim())] : undefined,
                    country: (enrichedEmail || enrichedPhone) ? [await hashSHA256('it')] : undefined,
                },
                // Strip value: 0 from custom_data — Meta flags it as "missing price parameters"
                custom_data: extra_data ? (() => {
                    const cd = { ...extra_data }
                    if (cd.value !== undefined && (!cd.value || Number(cd.value) <= 0)) {
                        delete cd.value
                        delete cd.currency  // currency without value is meaningless
                    }
                    return Object.keys(cd).length > 0 ? cd : undefined
                })() : undefined,
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

        // Log to tracked_events for audit trail
        await supabase.from('tracked_events').insert({
            organization_id,
            event_name,
            event_id,
            user_data_hash: {
                fbc: !!fbc, fbp: !!fbp,
                em: !!enrichedEmail, ph: !!enrichedPhone,
            },
            event_params: {
                pixel_id: pixelId,
                returning_visitor: !!(enrichedEmail || enrichedPhone),
            },
            source: 'server',
            sent_to_provider: res.ok,
            provider_response: result,
        })

        if (!res.ok) {
            console.error(`[CAPI] ${event_name} failed:`, result)
        }

        return NextResponse.json({ success: true })
    } catch (err: any) {
        console.error('[CAPI Event] error:', err)
        return NextResponse.json({ error: 'Internal error' }, { status: 500 })
    }
}

async function hashSHA256(data: string): Promise<string> {
    const encoder = new TextEncoder()
    const buffer = await crypto.subtle.digest('SHA-256', encoder.encode(data))
    return Array.from(new Uint8Array(buffer)).map(b => b.toString(16).padStart(2, '0')).join('')
}
