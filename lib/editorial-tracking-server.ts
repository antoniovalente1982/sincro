import { cache } from 'react'
import { createHash } from 'node:crypto'
import { getSupabaseAdmin } from './supabase/admin'
import { getPublicOrgId } from './blog-server'
import { blogEntry, isPublishedBlog } from './blog'
import { ATTRIBUTION_TTL, CAMPAIGN_KEYS, META_EVENTS, UUID, normalizePageUrl, resolvePixelId, supportedPage, type EditorialInput, type TrackingConsent } from './editorial-tracking'

export type EditorialContext = { orgId: string; articleId: string | null; funnelId: string | null; entry: string | null; pixelId: string | null; pagePath: string }
export const getEditorialPixel = cache(async (orgId: string, funnelPixel?: string | null) => {
    try {
    const db = getSupabaseAdmin()
    const { data: connection, error } = await db.from('connections').select('config, credentials').eq('organization_id', orgId).eq('provider','meta_capi').eq('status','active').maybeSingle()
    if (error) throw new Error('Configurazione Meta non disponibile.')
    let fallback = funnelPixel
    if (!fallback) {
        const { data } = await db.from('funnels').select('meta_pixel_id').eq('organization_id',orgId).eq('slug','salto-di-qualita').eq('status','active').maybeSingle()
        fallback = data?.meta_pixel_id
    }
    return resolvePixelId(fallback, connection?.config?.pixel_id || connection?.credentials?.pixel_id)
    } catch {
        console.error('[Editorial] Configurazione pixel assente o incoerente; pagina disponibile senza pixel.')
        return null
    }
})
export async function resolveEditorialEntry(orgId: string, entry: unknown, activeOnly = true): Promise<{ entry: string; articleId: string | null } | null> {
    const key = blogEntry(entry)
    if (!key) return null
    const db = getSupabaseAdmin()
    if (key === 'advertorial-pochi-minuti') {
        let q = db.from('funnels').select('id, status').eq('organization_id',orgId).eq('slug','pochi-minuti')
        if (activeOnly) q = q.eq('status','active')
        const { data } = await q.maybeSingle()
        return data ? { entry: key, articleId: null } : null
    }
    const { data } = await db.from('blog_posts').select('id,status,settings').eq('organization_id',orgId).eq('slug',key.slice(5)).maybeSingle()
    return data && (!activeOnly || isPublishedBlog(data)) ? { entry: key, articleId: data.id } : null
}
export const resolveEditorialPage = cache(async (path: string): Promise<EditorialContext | null> => {
    const kind = supportedPage(path)
    if (!kind) return null
    const db = getSupabaseAdmin()
    if (path.startsWith('/blog/')) {
        const orgId = await getPublicOrgId()
        if (!orgId) return null
        const article = await resolveEditorialEntry(orgId, `blog-${path.slice(6)}`)
        if (!article) return null
        return { orgId, articleId: article.articleId, funnelId: null, entry: article.entry, pixelId: await getEditorialPixel(orgId), pagePath: path }
    }
    const { data } = await db.from('funnels').select('id,organization_id,meta_pixel_id,settings').eq('slug',path.slice(3)).eq('status','active').maybeSingle()
    if (!data || (kind === 'landing' && data.settings?.template !== 'metodo_sincro')) return null
    return { orgId: data.organization_id, articleId: null, funnelId: data.id, entry: kind === 'advertorial' ? 'advertorial-pochi-minuti' : null,
        pixelId: await getEditorialPixel(data.organization_id, data.meta_pixel_id), pagePath: path }
})
export function editorialBot(agent: string): boolean { return agent.length < 10 || /bot|crawler|spider|facebookexternalhit|preview|headless|lighthouse|puppeteer|selenium/i.test(agent) }
const hash = (value: string) => createHash('sha256').update(value).digest('hex')

export async function sendEditorialMeta(context: EditorialContext, input: EditorialInput, headers: Headers): Promise<{ sent: boolean; reason?: string }> {
    if (!context.pixelId) return { sent: false, reason: 'no_pixel' }
    if (process.env.EDITORIAL_DISABLE_META === '1' || process.env.NODE_ENV !== 'production') return { sent: false, reason: 'local_test' }
    const db = getSupabaseAdmin()
    const { data: conn } = await db.from('connections').select('credentials,config').eq('organization_id',context.orgId).eq('provider','meta_capi').eq('status','active').maybeSingle()
    if (!conn?.credentials?.access_token) return { sent: false, reason: 'no_capi_connection' }
    if (resolvePixelId(context.pixelId, conn.config?.pixel_id || conn.credentials.pixel_id) !== context.pixelId) return { sent: false, reason: 'pixel_mismatch' }
    const event = META_EVENTS[input.event_name]
    const payload = { data: [{ event_name: event.name, event_time: Math.floor(Date.parse(input.occurred_at)/1000), event_id: input.event_id,
        action_source: 'website', event_source_url: `https://landing.metodosincro.com${input.page_path}`,
        user_data: { external_id: [hash(input.visitor_id)], fbc: input.fbc, fbp: input.fbp,
            client_ip_address: headers.get('x-forwarded-for')?.split(',')[0].trim(), client_user_agent: headers.get('user-agent') || undefined },
        custom_data: { page_type: input.event_name.startsWith('advertorial_') ? 'advertorial' : 'landing', content_name: input.page_path, editorial_entry: context.entry || undefined },
    }], ...(process.env.EDITORIAL_META_TEST_CODE ? { test_event_code: process.env.EDITORIAL_META_TEST_CODE } : {}) }
    const response = await fetch(`https://graph.facebook.com/v21.0/${context.pixelId}/events`, { method: 'POST', headers: { 'Content-Type':'application/json', Authorization: `Bearer ${conn.credentials.access_token}` }, body: JSON.stringify(payload), signal: AbortSignal.timeout(8000) })
    const result = await response.json()
    await db.from('tracked_events').insert({ organization_id: context.orgId, event_name: event.name, event_id: input.event_id,
        source: 'server', sent_to_provider: response.ok, provider_response: result,
        user_data_hash: { fbc: !!input.fbc, fbp: !!input.fbp }, event_params: { pixel_id: context.pixelId, page_type: payload.data[0].custom_data.page_type, editorial_entry: context.entry } })
    return { sent: response.ok, ...(!response.ok ? { reason: String(result.error?.code || response.status) } : {}) }
}

export async function saveEditorialEvent(context: EditorialContext, input: EditorialInput, consent: TrackingConsent): Promise<'saved' | 'duplicate' | 'not_stored'> {
    if (!consent.analytics) return 'not_stored'
    const db = getSupabaseAdmin()
    const source = context.entry ? { entry: context.entry, articleId: context.articleId } : await resolveEditorialEntry(context.orgId, input.entry)
    context.entry = source?.entry || null
    context.articleId = source?.articleId || null
    // A previous-visit attribution must have an actual prior article event on the server.
    if (input.attribution === 'previous_visit' && context.entry && !input.event_name.startsWith('advertorial_')) {
        const { data } = await db.from('editorial_events').select('id').eq('organization_id',context.orgId).eq('visitor_id',input.visitor_id).eq('entry_key',context.entry).eq('event_name','advertorial_view').gte('occurred_at',new Date(Date.now()-ATTRIBUTION_TTL).toISOString()).limit(1)
        if (!data?.length) { context.entry = null; context.articleId = null }
    }
    const { error } = await db.from('editorial_events').insert({ organization_id: context.orgId, event_id: input.event_id, event_name: input.event_name,
        visitor_id: input.visitor_id, session_id: input.session_id, entry_key: context.entry, article_id: context.articleId, funnel_id: context.funnelId,
        page_path: input.page_path, occurred_at: input.occurred_at, ...input.campaign, metadata: { attribution: context.entry ? input.attribution : 'none', marketing_consent: consent.marketing, page_variant: input.page_variant, received_at: new Date().toISOString() } })
    if (error?.code === '23505') return 'duplicate'
    if (error) { console.error('[Editorial] Event insert failed:', error.code, error.message); throw new Error('Salvataggio visita non riuscito.') }
    if (context.funnelId && ['advertorial_view','landing_view'].includes(input.event_name)) {
        await db.from('page_views').insert({ organization_id: context.orgId, funnel_id: context.funnelId, page_path: input.page_path,
            visitor_id: input.visitor_id, page_variant: input.page_variant, ...input.campaign })
    }
    return 'saved'
}

export type SubmissionJourney = { entry: string | null; articleId: string | null; visitorId: string | null; sessionId: string | null; attribution: string; marketing: boolean; analytics: boolean; preview: boolean; url: string | null }
export async function resolveSubmissionJourney(orgId: string, body: Record<string, unknown>, consent: TrackingConsent | null): Promise<SubmissionJourney> {
    const extra = body.extra_data as Record<string, unknown> | undefined
    const preview = extra?.tracking_preview === true
    const analytics = !!consent?.analytics && !preview
    const marketing = !!consent?.marketing && !preview
    const visitorId = analytics && typeof body.visitor_id === 'string' && UUID.test(body.visitor_id) ? body.visitor_id : null
    const sessionId = analytics && typeof extra?.editorial_session_id === 'string' && UUID.test(extra.editorial_session_id) ? extra.editorial_session_id : null
    let source = await resolveEditorialEntry(orgId, extra?.editorial_entry)
    let attribution = source ? 'direct' : 'none'
    if (extra?.editorial_attribution === 'previous_visit') {
        source = null
        if (visitorId && blogEntry(extra.editorial_entry)) {
            const { data } = await getSupabaseAdmin().from('editorial_events').select('entry_key,article_id').eq('organization_id',orgId).eq('visitor_id',visitorId).eq('entry_key',extra.editorial_entry).eq('event_name','advertorial_view').gte('occurred_at',new Date(Date.now()-ATTRIBUTION_TTL).toISOString()).order('occurred_at',{ascending:false}).limit(1).maybeSingle()
            if (data) source = { entry: data.entry_key, articleId: data.article_id }
        }
        attribution = source ? 'previous_visit' : 'none'
    }
    return { entry: source?.entry || null, articleId: source?.articleId || null, visitorId, sessionId, attribution, marketing, analytics, preview, url: normalizePageUrl(body.landing_url) }
}
export async function saveEditorialSubmission(orgId: string, funnelId: string, submissionId: string, journey: SubmissionJourney, body: Record<string, unknown>): Promise<void> {
    if (journey.preview) return
    const campaign: Record<string,string> = {}
    for (const key of CAMPAIGN_KEYS) if (typeof body[key] === 'string') campaign[key] = (body[key] as string).slice(0,200)
    const { error } = await getSupabaseAdmin().from('editorial_events').upsert({ organization_id: orgId, event_id: `submission_${submissionId}`, event_name: 'lead_submitted',
        submission_id: submissionId, funnel_id: funnelId, article_id: journey.articleId, entry_key: journey.entry,
        visitor_id: journey.visitorId, session_id: journey.sessionId, page_path: journey.url ? new URL(journey.url).pathname : '/f/salto-di-qualita',
        ...campaign, metadata: { attribution: journey.attribution, marketing_consent: journey.marketing, analytics_consent: journey.analytics } }, { onConflict: 'organization_id,event_id', ignoreDuplicates: true })
    if (error) console.error('[Editorial] Submission event not saved:', error.code)
}
