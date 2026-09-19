'use client'

import { ATTRIBUTION_TTL, CAMPAIGN_KEYS, CONSENT_TTL, META_EVENTS, TRACKING_COOKIE, UUID, readTrackingConsent, resolveEntry, sessionIsCurrent, type EditorialStage, type TrackingConsent } from './editorial-tracking'

type Pixel = ((...args: unknown[]) => void) & { callMethod?: (...args: unknown[]) => void; queue?: unknown[][]; push?: Pixel; loaded?: boolean; version?: string }
type PixelWindow = Window & { fbq?: Pixel; _fbq?: Pixel }
const initialized = new Set<string>()
const sent = new Set<string>()
const eventIds = new Map<string, string>()
let memoryVisitor: string | undefined
let memorySession: { id: string; at: number } | null = null
const read = (key: string) => { try { return window.localStorage.getItem(key) } catch { return null } }
const write = (key: string, value: string) => { try { window.localStorage.setItem(key, value) } catch { /* memory fallback */ } }
function json<T>(value: string | null): T | null { try { return JSON.parse(value || 'null') } catch { return null } }
export function journeyConsent(): TrackingConsent | null {
    if (typeof document === 'undefined') return null
    try {
        const cookie = document.cookie.split(';').map(x => x.trim()).find(x => x.startsWith(`${TRACKING_COOKIE}=`))?.slice(TRACKING_COOKIE.length + 1)
        return readTrackingConsent(cookie ? decodeURIComponent(cookie) : null)
    } catch { return null }
}
export function synchronizeJourneyConsent(identityRemoved = false): TrackingConsent | null {
    const c = journeyConsent()
    if (identityRemoved || (!c?.analytics && !c?.marketing)) {
        memoryVisitor = undefined; memorySession = null; sent.clear(); eventIds.clear()
    }
    if (!c?.marketing) (window as PixelWindow).fbq?.('consent', 'revoke')
    return c
}
export function setJourneyConsent(analytics: boolean, marketing: boolean): void {
    const c = { analytics, marketing, at: Date.now() }
    document.cookie = `${TRACKING_COOKIE}=${encodeURIComponent(JSON.stringify(c))}; Path=/; Max-Age=${CONSENT_TTL / 1000}; SameSite=Lax${window.location.protocol === 'https:' ? '; Secure' : ''}`
    write(TRACKING_COOKIE, JSON.stringify(c))
    const pixel = (window as PixelWindow).fbq
    if (!marketing) pixel?.('consent', 'revoke')
    if (!analytics && !marketing) {
        for (const key of ['_sincro_vid', '_sincro_editorial_entry', '_sincro_editorial_campaign', '_sincro_editorial_session']) {
            try { window.localStorage.removeItem(key) } catch { /* unavailable */ }
        }
        memoryVisitor = undefined; memorySession = null; sent.clear(); eventIds.clear()
    }
    window.dispatchEvent(new Event('sincro:tracking-consent'))
}
export function isJourneyPreview(): boolean { return ['A', 'B'].includes(new URLSearchParams(window.location.search).get('ab') || '') }
function identity() {
    const stored = read('_sincro_vid')
    memoryVisitor = stored && UUID.test(stored) ? stored : memoryVisitor || crypto.randomUUID()
    write('_sincro_vid', memoryVisitor)
    const prev = json<{ id: string; at: number }>(read('_sincro_editorial_session')) || memorySession
    memorySession = { id: sessionIsCurrent(prev) ? prev!.id : crypto.randomUUID(), at: Date.now() }
    write('_sincro_editorial_session', JSON.stringify(memorySession))
    return { visitor_id: memoryVisitor, session_id: memorySession.id }
}
function source(remember: boolean) {
    const params = new URLSearchParams(window.location.search)
    const path = window.location.pathname
    const own = path === '/f/pochi-minuti' ? 'advertorial-pochi-minuti' : path.startsWith('/blog/') ? `blog-${path.slice(6)}` : null
    if (own) {
        if (remember) write('_sincro_editorial_entry', JSON.stringify({ entry: own, at: Date.now() }))
        return { entry: own, attribution: 'direct' as const }
    }
    return resolveEntry(params.get('entry'), remember ? json(read('_sincro_editorial_entry')) : null)
}
function campaign(remember: boolean): Record<string,string> {
    const params = new URLSearchParams(window.location.search)
    const current: Record<string,string> = {}
    for (const key of CAMPAIGN_KEYS) { const val = params.get(key); if (val) current[key] = val.slice(0, 200) }
    if (Object.keys(current).length) {
        if (remember) write('_sincro_editorial_campaign', JSON.stringify({ values: current, at: Date.now() }))
        return current
    }
    const saved = remember ? json<{ values: Record<string,string>; at: number }>(read('_sincro_editorial_campaign')) : null
    if (saved && saved.at <= Date.now() && Date.now() - saved.at < ATTRIBUTION_TTL) {
        for (const key of CAMPAIGN_KEYS) if (typeof saved.values?.[key] === 'string') current[key] = saved.values[key].slice(0,200)
    }
    return current
}
export function journeyFbIds(): { fbc?: string; fbp?: string } {
    if (!journeyConsent()?.marketing || isJourneyPreview()) return {}
    const cookies = Object.fromEntries(document.cookie.split(';').map(x => { const i = x.indexOf('='); return [x.slice(0,i).trim(),x.slice(i+1)] }))
    const click = new URLSearchParams(window.location.search).get('fbclid')
    if (click && /^[a-zA-Z0-9._-]{1,500}$/.test(click) && !cookies._fbc) {
        cookies._fbc = `fb.1.${Date.now()}.${click}`
        document.cookie = `_fbc=${cookies._fbc}; Path=/; Max-Age=7776000; SameSite=Lax; Secure`
    }
    return { fbc: cookies._fbc, fbp: cookies._fbp }
}
export function getJourneySubmission() {
    const c = journeyConsent()
    const active = !!(c?.analytics || c?.marketing) && !isJourneyPreview()
    const ids = active ? identity() : { visitor_id: undefined, session_id: undefined }
    const entry = source(active)
    return { ...ids, ...campaign(active), ...journeyFbIds(), tracking_version: 1,
        extra_data: { editorial_entry: entry.entry || undefined, editorial_attribution: entry.attribution,
            editorial_session_id: ids.session_id, tracking_consent: c, tracking_preview: isJourneyPreview() } }
}
export function ensureJourneyPixel(pixelId: string | null | undefined): Pixel | null {
    if (!pixelId || !/^\d{5,25}$/.test(pixelId) || !journeyConsent()?.marketing || isJourneyPreview()) return null
    const w = window as PixelWindow
    if (!w.fbq) {
        const fbq: Pixel = (...args) => fbq.callMethod ? fbq.callMethod(...args) : void fbq.queue!.push(args)
        fbq.queue = []; fbq.push = fbq; fbq.loaded = true; fbq.version = '2.0'
        w.fbq = fbq; w._fbq = fbq
        const script = document.createElement('script')
        script.async = true; script.src = 'https://connect.facebook.net/en_US/fbevents.js'
        document.head.appendChild(script)
    }
    w.fbq('consent', 'grant')
    if (!initialized.has(pixelId)) { w.fbq('init', pixelId); initialized.add(pixelId) }
    return w.fbq
}
export async function sendJourneyEvent(stage: EditorialStage, pixelId: string | null | undefined, once = false, pageVariant: 'A' | 'B' = 'A'): Promise<void> {
    const consent = journeyConsent()
    if ((!consent?.analytics && !consent?.marketing) || isJourneyPreview()) return
    const info = getJourneySubmission()
    const key = `${info.visitor_id}|${window.location.pathname}|${stage}|${consent.analytics}|${consent.marketing}`
    if (once && sent.has(key)) return
    if (once) sent.add(key)
    const actionKey = `${info.visitor_id}|${window.location.pathname}|${stage}`
    const eventId = (once && eventIds.get(actionKey)) || crypto.randomUUID()
    if (once) eventIds.set(actionKey, eventId)
    const spec = META_EVENTS[stage]
    const extra = { page_type: stage.startsWith('advertorial_') ? 'advertorial' : 'landing', content_name: window.location.pathname, editorial_entry: info.extra_data.editorial_entry }
    ensureJourneyPixel(pixelId)?.(spec.custom ? 'trackSingleCustom' : 'trackSingle', pixelId, spec.name, extra, { eventID: eventId })
    try {
        await fetch('/api/track/editorial', { method: 'POST', headers: { 'Content-Type': 'application/json' }, keepalive: true,
            body: JSON.stringify({ event_id: eventId, event_name: stage, occurred_at: new Date().toISOString(), page_variant: pageVariant, visitor_id: info.visitor_id, session_id: info.session_id,
                page_path: window.location.pathname, entry: info.extra_data.editorial_entry, attribution: info.extra_data.editorial_attribution,
                campaign: campaign(true), ...journeyFbIds() }) })
    } catch { /* Navigation and form submission must remain usable. */ }
}
export function fireJourneyLead(pixelId: string | null | undefined, eventId: string, properties: Record<string, unknown>): void {
    ensureJourneyPixel(pixelId)?.('trackSingle', pixelId, 'Lead', properties, { eventID: eventId })
}
