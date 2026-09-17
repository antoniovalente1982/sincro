'use client'

import { useEffect, useRef, useState } from 'react'
import { clarityProjectId, readAnalyticsConsent, startLandingAnalytics, stopLandingAnalytics, trackLandingEvent, type AnalyticsConsent, type LandingEvent } from '@/lib/landing-behavior'
import './landing-behavior.css'

/** Opt-in recorder, mounted only on the configured parent-facing funnel. */
export default function LandingBehaviorAnalytics({ projectId, preview = false }: { projectId: unknown; preview?: boolean }) {
    const project = clarityProjectId(projectId)
    const storageKey = `ms_clarity_consent_v1_${project}`
    const [consent, setConsent] = useState<AnalyticsConsent | null>(null)
    const [ready, setReady] = useState(false)
    const [open, setOpen] = useState(false)
    const seen = useRef(new Set<LandingEvent>())

    useEffect(() => {
        if (!project || preview) return
        let saved: AnalyticsConsent | null = null
        try { saved = readAnalyticsConsent(localStorage.getItem(storageKey)) } catch { /* Still allow an in-memory choice. */ }
        // One batched hydration update: browser storage cannot be read during SSR.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setConsent(saved)
        setOpen(!saved)
        setReady(true)
        const sync = (event: StorageEvent) => {
            if (event.key !== storageKey && event.key !== null) return
            const choice = readAnalyticsConsent(event.newValue)
            if (choice !== 'granted') stopLandingAnalytics(true)
            setConsent(choice)
            setOpen(!choice)
        }
        window.addEventListener('storage', sync)
        return () => window.removeEventListener('storage', sync)
    }, [project, preview, storageKey])

    useEffect(() => {
        if (!ready || !project || !startLandingAnalytics(project, consent, preview)) return
        const once = (event: LandingEvent) => {
            if (seen.current.has(event)) return
            seen.current.add(event)
            trackLandingEvent(event)
        }
        const observer = new IntersectionObserver(entries => {
            entries.forEach(entry => {
                if (!entry.isIntersecting) return
                once(entry.target.id === 'ms-form' ? 'form_visible' : 'video_visible')
                observer.unobserve(entry.target)
            })
        }, { threshold: 0.15 })
        document.querySelectorAll('#ms-form, .lp-vsl-box').forEach(element => observer.observe(element))
        const scroll = () => {
            const height = document.documentElement.scrollHeight
            const percent = (window.scrollY + window.innerHeight) / height * 100
            for (const threshold of [25, 50, 75, 90] as const) {
                if (percent >= threshold) once(`scroll_${threshold}`)
            }
        }
        const focus = (event: FocusEvent) => {
            const field = event.target instanceof HTMLElement ? event.target.dataset.behaviorField : undefined
            if (field !== 'name' && field !== 'phone' && field !== 'email') return
            once('form_started')
            once(`form_${field}_focused`)
        }
        window.addEventListener('scroll', scroll, { passive: true })
        document.addEventListener('focusin', focus)
        scroll()
        return () => {
            observer.disconnect()
            window.removeEventListener('scroll', scroll)
            document.removeEventListener('focusin', focus)
            stopLandingAnalytics()
        }
    }, [ready, project, consent, preview])

    const choose = (choice: AnalyticsConsent) => {
        if (choice === 'denied') stopLandingAnalytics(true)
        try { localStorage.setItem(storageKey, JSON.stringify({ choice, at: Date.now() })) } catch { /* This visit only. */ }
        setConsent(choice)
        setOpen(false)
    }

    if (!project || preview || !ready) return null
    return <>
        {open && <section className="ms-analytics-choice" aria-label="Preferenze analisi delle visite">
            <strong>Ci aiuti a migliorare questa pagina?</strong>
            <p>Con il tuo consenso usiamo Microsoft Clarity per analizzare clic, scorrimento e registrazioni della navigazione, tramite cookie. I dati che inserisci nel modulo sono oscurati. Puoi rifiutare o cambiare scelta in qualsiasi momento.</p>
            <a href="https://clarity.microsoft.com/privacy" target="_blank" rel="noopener noreferrer">Come Microsoft tratta questi dati</a>
            <div className="ms-analytics-actions">
                <button type="button" onClick={() => choose('denied')}>Rifiuta analisi</button>
                <button type="button" onClick={() => choose('granted')}>Accetta analisi</button>
            </div>
        </section>}
        <div className="ms-analytics-preferences">
            <button type="button" onClick={() => setOpen(true)}>Preferenze analisi delle visite</button>
        </div>
    </>
}
