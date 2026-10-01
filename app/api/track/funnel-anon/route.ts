import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'node:crypto'
import { getSupabaseAdmin } from '@/lib/supabase/admin'

/**
 * POST /api/track/funnel-anon
 *
 * Conteggio anonimo per il Form di contatto quando il visitatore non ha ancora
 * dato il consenso: solo "visita" e "form iniziato", aggregabili per annuncio.
 * Niente cookie, niente identificativo del visitatore, niente IP, niente Meta.
 * Con il consenso se ne occupa EditorialTracking, quindi il client chiama
 * questo endpoint solo in assenza di consenso (nessun doppio conteggio).
 */

const BOT = /bot|crawler|spider|facebookexternalhit|whatsapp|preview|headless|lighthouse|puppeteer|selenium|prerender/i
const clip = (v: unknown, max = 200) => typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null

export async function POST(req: NextRequest) {
    try {
        const agent = req.headers.get('user-agent') || ''
        if (agent.length < 10 || BOT.test(agent)) return NextResponse.json({ ok: true, filtered: 'bot' })

        const body = await req.json().catch(() => ({}))
        const event = body.event === 'form_start' ? 'form_start' : body.event === 'view' ? 'view' : null
        const slug = clip(body.slug, 100)
        if (!event || !slug) return NextResponse.json({ error: 'Parametri non validi' }, { status: 400 })

        const db = getSupabaseAdmin()
        const { data: funnel } = await db.from('funnels').select('id, organization_id, settings').eq('slug', slug).eq('status', 'active').maybeSingle()
        // Solo per la pagina del Form di contatto: le altre landing hanno il loro tracciamento
        if (!funnel || funnel.settings?.layout !== 'form_contatto') return NextResponse.json({ error: 'Pagina non supportata' }, { status: 404 })

        const campaign = {
            utm_source: clip(body.utm_source), utm_medium: clip(body.utm_medium), utm_campaign: clip(body.utm_campaign),
            utm_content: clip(body.utm_content), utm_term: clip(body.utm_term),
        }
        const pagePath = `/f/${slug}`
        const variant = body.page_variant === 'B' ? 'B' : 'A'

        if (event === 'view') {
            const device = /tablet|ipad/i.test(agent) ? 'tablet' : /mobile|android|iphone/i.test(agent) ? 'mobile' : 'desktop'
            const { error } = await db.from('page_views').insert({
                organization_id: funnel.organization_id, funnel_id: funnel.id, page_path: pagePath, page_variant: variant,
                ...campaign, fbadid: clip(body.fbadid, 40), device_type: device,
            })
            if (error) throw error
        } else {
            const { error } = await db.from('editorial_events').insert({
                organization_id: funnel.organization_id, event_id: `anon_${randomUUID()}`, event_name: 'form_start',
                funnel_id: funnel.id, page_path: pagePath, ...campaign,
                metadata: { anonymous: true, page_variant: variant, fbadid: clip(body.fbadid, 40) },
            })
            if (error) throw error
        }
        return NextResponse.json({ ok: true })
    } catch (err) {
        console.error('[funnel-anon] error:', err)
        return NextResponse.json({ error: 'Errore interno' }, { status: 500 })
    }
}
