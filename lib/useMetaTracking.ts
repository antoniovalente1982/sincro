'use client'

import { useEffect, useRef, useCallback } from 'react'

/**
 * Shared hook for Meta Pixel + CAPI tracking on all landing pages.
 * 
 * Handles:
 * - fbc/fbp cookie management (always prefers Meta Pixel's authoritative cookies)
 * - PageView event (client Pixel + server CAPI with dedup)
 * - UTM parameter extraction
 * - Visitor ID generation/retrieval
 * - fb_login_id extraction (c_user cookie, when available)
 * 
 * Usage in any landing page:
 *   const { getFbIds, utmParams, visitorId } = useMetaTracking({ orgId, funnelId, pixelId, abVariant })
 *   // then on form submit: ...getFbIds(), ...utmParams, visitor_id: visitorId
 */

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

export function useMetaTracking({ orgId, funnelId, pixelId, abVariant }: MetaTrackingOptions) {
    const fbIdsRef = useRef<{ fbc?: string; fbp?: string }>({})
    const utmParamsRef = useRef<Record<string, string | undefined>>({})
    const visitorIdRef = useRef<string>('')

    useEffect(() => {
        const params = new URLSearchParams(window.location.search)

        // Extract UTM params
        const utms = {
            utm_source: params.get('utm_source') || undefined,
            utm_medium: params.get('utm_medium') || undefined,
            utm_campaign: params.get('utm_campaign') || undefined,
            utm_content: params.get('utm_content') || undefined,
            utm_term: params.get('utm_term') || undefined,
        }
        utmParamsRef.current = utms

        // Generate or retrieve visitor_id
        let vid = localStorage.getItem('_sincro_vid')
        if (!vid) {
            vid = crypto.randomUUID()
            localStorage.setItem('_sincro_vid', vid)
        }
        visitorIdRef.current = vid

        // Generate event_id for PageView deduplication (pixel ↔ CAPI)
        const pageViewEventId = `pv_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`

        // Read initial cookies
        const cookies = parseCookies()

        // Compute fbc as initial fallback — Meta Pixel will set the authoritative _fbc cookie
        // Our manual fbc is ONLY used if Meta Pixel hasn't written _fbc yet
        let initialFbc = cookies._fbc || undefined
        if (!initialFbc) {
            const fbclid = params.get('fbclid')
            if (fbclid) initialFbc = `fb.1.${Date.now()}.${fbclid}`
        }
        const initialFbp = cookies._fbp || undefined
        fbIdsRef.current = { fbc: initialFbc, fbp: initialFbp }

        // Fire pixel PageView immediately (client-side)
        if (typeof window !== 'undefined' && (window as any).fbq) {
            (window as any).fbq('track', 'PageView', {}, { eventID: pageViewEventId })
        }

        // Delay CAPI PageView by 2s to let Meta Pixel set _fbp and _fbc cookies first
        // IMPORTANT: Always prefer Meta Pixel's _fbc cookie over our manual construction
        // to avoid the "fbclid modificato" diagnostic error
        setTimeout(() => {
            // Re-read cookies — Meta Pixel's _fbc/fbp are now the authoritative source
            const freshCookies = parseCookies()
            // Pixel's cookie takes absolute priority; manual fbc is last resort only
            const freshFbc = freshCookies._fbc || initialFbc
            const freshFbp = freshCookies._fbp || initialFbp

            // Update ref so form submission also uses the Pixel's authoritative values
            fbIdsRef.current = { fbc: freshFbc, fbp: freshFbp }

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
                    fbc: freshFbc,
                    fbp: freshFbp,
                    fb_login_id: freshCookies.c_user || undefined,
                    page_url: window.location.href,
                }),
            }).catch(() => {})
        }, 2000)
    }, [orgId, funnelId, abVariant])

    // Stable getter — always returns the latest fbc/fbp (Pixel's authoritative values)
    const getFbIds = useCallback(() => fbIdsRef.current, [])
    const getUtmParams = useCallback(() => utmParamsRef.current, [])
    const getVisitorId = useCallback(() => visitorIdRef.current, [])

    return { getFbIds, getUtmParams, getVisitorId }
}

/**
 * Fire Advanced Matching on form submit (re-init pixel with user PII).
 * Call this right before submitting the form.
 */
export function fireAdvancedMatching(pixelId: string, data: { email?: string; phone?: string }) {
    if (typeof window === 'undefined' || !(window as any).fbq || !pixelId) return
    const matchData: any = {}
    if (data.email) matchData.em = data.email.toLowerCase().trim()
    if (data.phone) matchData.ph = data.phone.replace(/\D/g, '')
    ;(window as any).fbq('init', pixelId, matchData)
}

/**
 * Fire a Pixel event with eventID for CAPI dedup.
 */
export function firePixelEvent(eventName: string, eventId: string) {
    if (typeof window === 'undefined' || !(window as any).fbq) return
    ;(window as any).fbq('track', eventName, {}, { eventID: eventId })
}
