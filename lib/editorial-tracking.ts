import { blogEntry } from './blog'

export const TRACKING_COOKIE = 'ms_tracking_consent_v1'
export const CONSENT_TTL = 180 * 86400000
export const ATTRIBUTION_TTL = 30 * 86400000
export const CAMPAIGN_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'] as const
export type TrackingConsent = { analytics: boolean; marketing: boolean; at: number }
export type EditorialStage = 'advertorial_view' | 'advertorial_engaged' | 'advertorial_cta' | 'landing_view' | 'landing_engaged' | 'form_start'
export type Attribution = 'direct' | 'previous_visit' | 'none'
export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
export const META_EVENTS: Record<EditorialStage, { name: string; custom: boolean }> = {
    advertorial_view: { name: 'PageView', custom: false },
    advertorial_engaged: { name: 'AdvertorialEngaged', custom: true },
    advertorial_cta: { name: 'AdvertorialCTAClick', custom: true },
    landing_view: { name: 'PageView', custom: false },
    landing_engaged: { name: 'ViewContent', custom: false },
    form_start: { name: 'StartForm', custom: true },
}
export function readTrackingConsent(raw: string | null | undefined, now = Date.now()): TrackingConsent | null {
    try {
        const c = JSON.parse(raw || 'null')
        return c && typeof c.analytics === 'boolean' && typeof c.marketing === 'boolean' && typeof c.at === 'number'
            && c.at <= now && now - c.at < CONSENT_TTL ? { analytics: c.analytics, marketing: c.marketing, at: c.at } : null
    } catch { return null }
}
export function resolveEntry(explicit: string | null, saved: { entry: string; at: number } | null, now = Date.now()): { entry: string | null; attribution: Attribution } {
    if (explicit !== null) {
        const entry = blogEntry(explicit)
        return { entry, attribution: entry ? 'direct' : 'none' }
    }
    if (saved && saved.at <= now && now - saved.at < ATTRIBUTION_TTL && blogEntry(saved.entry)) return { entry: saved.entry, attribution: 'previous_visit' }
    return { entry: null, attribution: 'none' }
}
export function sessionIsCurrent(value: { id?: string; at?: number } | null, now = Date.now()): boolean {
    return !!value && UUID.test(value.id || '') && typeof value.at === 'number' && value.at <= now && now - value.at < 30 * 60000
}
export function resolvePixelId(funnel: unknown, connection: unknown): string | null {
    const valid = (x: unknown): string | null => typeof x === 'string' && /^\d{5,25}$/.test(x) ? x : null
    const a = valid(funnel), b = valid(connection)
    if (a && b && a !== b) throw new Error('Pixel della landing e connessione Meta non corrispondono.')
    return b || a
}
export function supportedPage(path: unknown): 'advertorial' | 'landing' | null {
    if (typeof path !== 'string') return null
    if (path === '/f/pochi-minuti' || /^\/blog\/[a-z0-9]+(?:-[a-z0-9]+)*$/.test(path) && path.length <= 96) return 'advertorial'
    return /^\/f\/[a-z0-9]+(?:-[a-z0-9]+)*$/.test(path) && path.length <= 100 ? 'landing' : null
}
export function normalizePageUrl(input: unknown, origin = 'https://landing.metodosincro.com'): string | null {
    if (typeof input !== 'string' || input.length > 4096) return null
    try {
        const url = new URL(input.startsWith('landing.metodosincro.com/') ? `https://${input}` : input, origin)
        if (url.origin !== origin || !supportedPage(url.pathname)) return null
        const clean = new URL(url.pathname, origin)
        for (const key of [...CAMPAIGN_KEYS, 'entry']) {
            const value = url.searchParams.get(key)
            if (value && (key !== 'entry' || blogEntry(value))) clean.searchParams.set(key, value.slice(0, 200))
        }
        return clean.href
    } catch { return null }
}
export type EditorialInput = {
    event_id: string; event_name: EditorialStage; visitor_id: string; session_id: string; page_path: string
    entry: string | null; attribution: Attribution; campaign: Record<string, string>; fbc?: string; fbp?: string
    occurred_at: string; page_variant: 'A' | 'B'
}
export function validateEditorialEvent(value: unknown): EditorialInput | null {
    if (!value || typeof value !== 'object') return null
    const v = value as Record<string, unknown>
    const kind = supportedPage(v.page_path)
    if (!kind || typeof v.event_name !== 'string' || !Object.hasOwn(META_EVENTS, v.event_name)) return null
    if ((kind === 'advertorial') !== v.event_name.startsWith('advertorial_')) return null
    if (![v.event_id, v.visitor_id, v.session_id].every(id => typeof id === 'string' && UUID.test(id))) return null
    const campaign: Record<string, string> = {}
    for (const key of CAMPAIGN_KEYS) {
        const val = (v.campaign as Record<string, unknown> | undefined)?.[key]
        if (typeof val === 'string') campaign[key] = val.slice(0, 200)
    }
    const cookie = (x: unknown) => typeof x === 'string' && /^fb\.\d+\.\d+\.[a-zA-Z0-9._-]{1,500}$/.test(x) ? x : undefined
    return { event_id: v.event_id as string, event_name: v.event_name as EditorialStage, visitor_id: v.visitor_id as string,
        session_id: v.session_id as string, page_path: v.page_path as string, entry: blogEntry(v.entry),
        occurred_at: actionTime(v.occurred_at), page_variant: v.page_variant === 'B' ? 'B' : 'A',
        attribution: v.attribution === 'previous_visit' ? 'previous_visit' : blogEntry(v.entry) ? 'direct' : 'none', campaign,
        fbc: cookie(v.fbc), fbp: cookie(v.fbp) }
}

export function leadAttempt(previous: { fingerprint: string; id: string } | null, fingerprint: string, create = () => crypto.randomUUID()): { fingerprint: string; id: string } {
    return previous?.fingerprint === fingerprint ? previous : { fingerprint, id: create() }
}
export function actionTime(value: unknown, now = Date.now()): string {
    const at = typeof value === 'string' ? Date.parse(value) : NaN
    return new Date(Number.isFinite(at) && at <= now && at >= now - 10 * 60000 ? at : now).toISOString()
}
