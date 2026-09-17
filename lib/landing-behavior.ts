// Only fixed event names: contact details, answers and error messages must never
// enter session-recording metadata. Meta/CAPI is intentionally a separate path.
export const LANDING_EVENTS = [
    'consultation_cta_clicked', 'video_visible', 'form_visible', 'form_started',
    'form_name_focused', 'form_phone_focused', 'form_email_focused',
    'form_submit_attempt', 'form_invalid_name', 'form_invalid_phone', 'form_invalid_email',
    'form_submit_started', 'form_submit_success', 'form_submit_error',
    'scroll_25', 'scroll_50', 'scroll_75', 'scroll_90',
] as const
export type LandingEvent = typeof LANDING_EVENTS[number]
export type AnalyticsConsent = 'granted' | 'denied'
export const CONSENT_MAX_AGE = 180 * 24 * 60 * 60 * 1000

export function clarityProjectId(value: unknown): string | null {
    return typeof value === 'string' && /^[a-z0-9]{6,20}$/.test(value.trim()) ? value.trim() : null
}

export function readAnalyticsConsent(raw: string | null, now = Date.now()): AnalyticsConsent | null {
    try {
        const value = JSON.parse(raw || 'null')
        return value && (value.choice === 'granted' || value.choice === 'denied')
            && typeof value.at === 'number' && value.at <= now && now - value.at < CONSENT_MAX_AGE
            ? value.choice : null
    } catch { return null }
}

type Clarity = ((...args: unknown[]) => void) & { q?: unknown[][] }
declare global { interface Window { clarity?: Clarity } }

let activeProject: string | null = null
let scriptProject: string | null = null

export function startLandingAnalytics(project: string, consent: AnalyticsConsent | null, preview = false): boolean {
    const id = clarityProjectId(project)
    if (typeof window === 'undefined' || !id || consent !== 'granted' || preview) return false
    if (activeProject === id) return true
    // Never attach a second project to an existing recorder on a client navigation.
    if (scriptProject && scriptProject !== id) return false
    try {
        if (!window.clarity) {
            const queue: Clarity = (...args) => { (queue.q ||= []).push(args) }
            window.clarity = queue
        }
        if (scriptProject) window.clarity('start')
        window.clarity('consentv2', { ad_Storage: 'denied', analytics_Storage: 'granted' })
        if (!scriptProject) {
            scriptProject = id
            const script = document.createElement('script')
            script.async = true
            script.src = `https://www.clarity.ms/tag/${id}`
            script.dataset.landingClarity = id
            script.onload = () => {
                if (!activeProject) window.clarity?.('stop')
            }
            script.onerror = () => { activeProject = null }
            document.head.appendChild(script)
        }
        activeProject = id
        return true
    } catch { activeProject = null; return false }
}

export function stopLandingAnalytics(revoke = false): void {
    activeProject = null
    if (typeof window === 'undefined' || !window.clarity) return
    try {
        if (revoke) window.clarity('consentv2', { ad_Storage: 'denied', analytics_Storage: 'denied' })
        window.clarity('stop')
    } catch { /* Recording must never prevent use of the landing or consent controls. */ }
}

export function trackLandingEvent(name: LandingEvent): void {
    if (typeof window === 'undefined' || !activeProject || !(LANDING_EVENTS as readonly string[]).includes(name)) return
    try { window.clarity?.('event', name) } catch { /* Never block a lead submission. */ }
}
