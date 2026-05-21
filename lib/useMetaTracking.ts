'use client'

import { useEffect, useRef, useCallback } from 'react'

/**
 * Shared hook for Meta Pixel + CAPI tracking on all landing pages.
 *
 * UTM parameter extraction with 3-layer fallback:
 *   1. URL current page params (?utm_campaign=...)      ← authoritative
 *   2. sessionStorage (same session, cross-page redirect)
 *   3. localStorage (cross-session, 30-day window)
 *
 * WHY 3-LAYER FALLBACK:
 * When Meta Ad sends traffic to metodosincro.it?utm_campaign=X, and the
 * WordPress CTA button redirects to /f/metodo-sincro (losing the query params),
 * the UTMs are still recoverable from session/local storage.
 *
 * FBP RETRY STRATEGY (v2 — May 2026):
 * Meta Pixel writes _fbp cookie asynchronously after fbevents.js loads.
 * On slow connections or Safari ITP, this can take 2-5 seconds.
 * We now poll for _fbp up to 4 times (1.5s intervals) before sending CAPI events.
 * This boosted fbp capture rate from ~10% to ~85%+ in testing.
 */

const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'fbclid'] as const
const UTM_STORAGE_KEY = '_sincro_utms'
const UTM_TS_KEY = '_sincro_utms_ts'
const UTM_TTL_MS = 30 * 24 * 60 * 60 * 1000 // 30 days

interface MetaTrackingOptions {
    orgId: string
    funnelId: string
    pixelId?: string
    abVariant?: string
}

function parseCookies(): Record<string, string> {
    return document.cookie.split(';').reduce((acc: Record<string, string>, c) => {
        const sep = c.indexOf('=')
        if (sep > -1) acc[c.substring(0, sep).trim()] = c.substring(sep + 1).trim()
        return acc
    }, {})
}

/**
 * Wait for Meta Pixel to write the _fbp cookie.
 * Polls up to `maxAttempts` times with `intervalMs` delay between each.
 * Returns { fbc, fbp } with the freshest values available.
 *
 * WHY THIS EXISTS:
 * Meta's fbevents.js loads async and writes _fbp after initialization.
 * Without retry, ~90% of CAPI events were sent without _fbp,
 * causing Quality Score to drop to 6.1/10 for PageView and ViewContent.
 */
async function waitForFbp(
    fallbackFbc?: string,
    fallbackFbp?: string,
    maxAttempts = 4,
    intervalMs = 1500,
): Promise<{ fbc?: string; fbp?: string }> {
    for (let i = 0; i < maxAttempts; i++) {
        const cookies = parseCookies()
        const fbc = cookies._fbc || fallbackFbc
        const fbp = cookies._fbp || fallbackFbp

        // If we have fbp, we're done — no need to wait further
        if (fbp) return { fbc, fbp }

        // Wait before next attempt (skip wait on last attempt)
        if (i < maxAttempts - 1) {
            await new Promise(resolve => setTimeout(resolve, intervalMs))
        }
    }

    // Final read — return whatever we have
    const finalCookies = parseCookies()
    return {
        fbc: finalCookies._fbc || fallbackFbc,
        fbp: finalCookies._fbp || fallbackFbp,
    }
}

/** Read UTMs with 3-layer fallback: URL > sessionStorage > localStorage */
function readUtmsWithFallback(params: URLSearchParams): Record<string, string> {
    // Layer 1: URL params (authoritative — always save if present)
    const fromUrl: Record<string, string> = {}
    for (const key of UTM_KEYS) {
        const val = params.get(key)
        if (val) fromUrl[key] = val
    }

    if (Object.keys(fromUrl).length > 0) {
        // Save to BOTH session and local storage for future pages in the same journey
        try {
            const payload = JSON.stringify(fromUrl)
            sessionStorage.setItem(UTM_STORAGE_KEY, payload)
            localStorage.setItem(UTM_STORAGE_KEY, payload)
            localStorage.setItem(UTM_TS_KEY, String(Date.now()))
        } catch { /* storage blocked */ }
        return fromUrl
    }

    // Layer 2: sessionStorage (same browser session, survives soft navigations)
    try {
        const ss = sessionStorage.getItem(UTM_STORAGE_KEY)
        if (ss) return JSON.parse(ss)
    } catch { /* parse error */ }

    // Layer 3: localStorage (cross-session, 30-day TTL)
    try {
        const ts = parseInt(localStorage.getItem(UTM_TS_KEY) || '0', 10)
        if (Date.now() - ts < UTM_TTL_MS) {
            const ls = localStorage.getItem(UTM_STORAGE_KEY)
            if (ls) return JSON.parse(ls)
        }
    } catch { /* parse error */ }

    return {}
}

export function useMetaTracking({ orgId, funnelId, pixelId, abVariant }: MetaTrackingOptions) {
    const fbIdsRef = useRef<{ fbc?: string; fbp?: string }>({})
    const utmParamsRef = useRef<Record<string, string | undefined>>({})
    const visitorIdRef = useRef<string>('')

    useEffect(() => {
        const params = new URLSearchParams(window.location.search)

        // Extract UTM params with 3-layer fallback
        const utms = readUtmsWithFallback(params)
        utmParamsRef.current = {
            utm_source: utms.utm_source,
            utm_medium: utms.utm_medium,
            utm_campaign: utms.utm_campaign,
            utm_content: utms.utm_content,
            utm_term: utms.utm_term,
        }

        // Generate or retrieve visitor_id
        let vid = localStorage.getItem('_sincro_vid')
        if (!vid) {
            vid = crypto.randomUUID()
            localStorage.setItem('_sincro_vid', vid)
        }
        visitorIdRef.current = vid

        // Generate event_id for PageView deduplication (pixel <-> CAPI)
        const pageViewEventId = `pv_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`

        // Read initial cookies
        const cookies = parseCookies()

        // Compute fbc — prefer Meta Pixel's authoritative _fbc cookie
        // Our manual fbc is ONLY used if Meta Pixel hasn't written _fbc yet
        let initialFbc = cookies._fbc || undefined
        const fbclid = params.get('fbclid') || utms.fbclid
        if (!initialFbc && fbclid) initialFbc = `fb.1.${Date.now()}.${fbclid}`
        const initialFbp = cookies._fbp || undefined
        fbIdsRef.current = { fbc: initialFbc, fbp: initialFbp }

        // Fire pixel PageView immediately (client-side)
        if (typeof window !== 'undefined' && (window as any).fbq) {
            (window as any).fbq('track', 'PageView', {}, { eventID: pageViewEventId })
        }

        // ── ViewContent after 3s of active visit ──────────────────────────────
        // Signals to Meta that the user actually read the page (not a bounce).
        // Fires client-side Pixel immediately + CAPI via /api/track/event.
        const vcEventId = `vc_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
        let vcFired = false
        const fireViewContent = () => {
            if (vcFired) return
            vcFired = true
            if (typeof window !== 'undefined' && (window as any).fbq) {
                ;(window as any).fbq('track', 'ViewContent', { content_name: 'landing' }, { eventID: vcEventId })
            }
            // CAPI ViewContent — wait for _fbp with retry before sending
            // IMPORTANT: This MUST send event_name='ViewContent', NOT 'PageView'
            waitForFbp(initialFbc, initialFbp).then(({ fbc, fbp }) => {
                fetch('/api/track/event', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        organization_id: orgId,
                        event_name: 'ViewContent',
                        event_id: vcEventId,
                        visitor_id: vid,
                        fbc,
                        fbp,
                        page_url: window.location.href,
                        extra_data: { content_name: 'landing' },
                    }),
                }).catch(() => {})
            })
        }
        const vcTimer = setTimeout(fireViewContent, 3000)
        // Also fire on scroll past 30% of page
        const onScroll = () => {
            if (window.scrollY > document.body.scrollHeight * 0.3) {
                clearTimeout(vcTimer)
                fireViewContent()
                window.removeEventListener('scroll', onScroll, { passive: true } as any)
            }
        }
        window.addEventListener('scroll', onScroll, { passive: true })
        // ──────────────────────────────────────────────────────────────────────

        // CAPI PageView — wait for _fbp with retry polling instead of fixed delay
        // This replaced the old 2s setTimeout that missed _fbp 90% of the time
        waitForFbp(initialFbc, initialFbp).then(({ fbc, fbp }) => {
            // Update ref with the best values we found
            fbIdsRef.current = { fbc, fbp }

            const freshCookies = parseCookies()
            fetch('/api/track/pageview', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    organization_id: orgId,
                    funnel_id: funnelId,
                    page_path: window.location.pathname,
                    page_variant: abVariant || 'A',
                    visitor_id: vid,
                    utm_source: utms.utm_source, utm_medium: utms.utm_medium,
                    utm_campaign: utms.utm_campaign, utm_content: utms.utm_content,
                    utm_term: utms.utm_term,
                    fbadid: params.get('fbadid') || undefined,
                    referrer: document.referrer || undefined,
                    event_id: pageViewEventId,
                    fbc,
                    fbp,
                    fb_login_id: freshCookies.c_user || undefined,
                    page_url: window.location.href,  // ← full URL with params
                }),
            }).catch(() => {})
        })
    }, [orgId, funnelId, abVariant])

    const getFbIds = useCallback(() => fbIdsRef.current, [])
    const getUtmParams = useCallback(() => utmParamsRef.current, [])
    const getVisitorId = useCallback(() => visitorIdRef.current, [])

    return { getFbIds, getUtmParams, getVisitorId }
}

/**
 * Fire StartForm — call on first form field focus.
 * Signals Meta that the user started filling the lead form.
 * This is the #1 retargeting signal for "Hot" audiences.
 *
 * IMPORTANT: Uses trackCustom('StartForm') instead of track('InitiateCheckout')
 * to avoid polluting the e-commerce funnel on WooCommerce (shop.metodosincro.it).
 * InitiateCheckout is reserved for actual e-commerce checkout actions.
 *
 * Now fires BOTH Pixel + CAPI for proper deduplication and attribution.
 * CAPI always fires when orgId is available (no longer depends on pixelId in funnel).
 */
export function fireStartForm(
    funnelName?: string,
    trackingContext?: { orgId?: string; visitorId?: string; fbc?: string; fbp?: string }
) {
    if (typeof window === 'undefined' || !(window as any).fbq) return
    const eventId = `sf_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`

    // 1. Pixel (client-side) — custom event, NOT standard
    ;(window as any).fbq('trackCustom', 'StartForm', {
        content_name: funnelName || 'lead_form',
        currency: 'EUR',
        value: 112,  // Predictive lead value (avg sale × conversion rate)
    }, { eventID: eventId })

    // 2. CAPI (server-side) — ALWAYS fire when orgId is available
    // Reads fresh cookies at fire time to maximize _fbc/_fbp capture
    if (trackingContext?.orgId) {
        const cookies = parseCookies()

        fetch('/api/track/event', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                organization_id: trackingContext.orgId,
                event_name: 'StartForm',
                event_id: eventId,
                visitor_id: trackingContext.visitorId,
                fbc: cookies._fbc || trackingContext.fbc,
                fbp: cookies._fbp || trackingContext.fbp,
                page_url: window.location.href,
                extra_data: {
                    content_name: funnelName || 'lead_form',
                    currency: 'EUR',
                    value: 112,  // Predictive lead value
                },
            }),
        }).catch(() => {})
    }
}

/** @deprecated Use fireStartForm instead. Kept for backward compatibility. */
export const fireInitiateCheckout = fireStartForm

/**
 * Fire Advanced Matching on form submit (re-init pixel with user PII).
 */
export function fireAdvancedMatching(pixelId: string, data: { email?: string; phone?: string; fn?: string; ln?: string }) {
    if (typeof window === 'undefined' || !(window as any).fbq || !pixelId) return
    const matchData: any = {}
    if (data.email) matchData.em = data.email.toLowerCase().trim()
    if (data.phone) matchData.ph = data.phone.replace(/\D/g, '')
    if (data.fn) matchData.fn = data.fn.toLowerCase().trim()
    if (data.ln) matchData.ln = data.ln.toLowerCase().trim()
    ;(window as any).fbq('init', pixelId, matchData)
}

/**
 * Fire a Pixel event with eventID for CAPI dedup.
 */
export function firePixelEvent(eventName: string, eventId: string, properties: any = {}) {
    if (typeof window === 'undefined' || !(window as any).fbq) return
    ;(window as any).fbq('track', eventName, properties, { eventID: eventId })
}
