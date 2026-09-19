'use client'

import { useEffect, useState } from 'react'
import { synchronizeJourneyConsent, sendJourneyEvent, setJourneyConsent } from '@/lib/editorial-tracking-client'
import type { TrackingConsent } from '@/lib/editorial-tracking'
import styles from './editorial-tracking.module.css'

export default function EditorialTracking({ pixelId, kind, preview = false, pageVariant = 'A' }: { pixelId?: string | null; kind: 'advertorial' | 'landing'; preview?: boolean; pageVariant?: 'A' | 'B' }) {
    const [consent, setConsent] = useState<TrackingConsent | null>(null)
    const [ready, setReady] = useState(false)
    const [editing, setEditing] = useState(false)
    const [identityRevision, setIdentityRevision] = useState(0)
    useEffect(() => {
        const refresh = (event?: Event) => {
            const removed = event instanceof StorageEvent && event.key === '_sincro_vid' && !event.newValue
            setConsent(synchronizeJourneyConsent(removed)); setReady(true)
            if (removed) setIdentityRevision(value => value + 1)
        }
        refresh()
        window.addEventListener('sincro:tracking-consent', refresh)
        window.addEventListener('storage', refresh)
        return () => { window.removeEventListener('sincro:tracking-consent', refresh); window.removeEventListener('storage', refresh) }
    }, [])
    useEffect(() => {
        if (!ready || preview || (!consent?.analytics && !consent?.marketing)) return
        void sendJourneyEvent(kind === 'advertorial' ? 'advertorial_view' : 'landing_view', pixelId, true, pageVariant)
        const landingTimer = kind === 'landing' ? setTimeout(() => { void sendJourneyEvent('landing_engaged', pixelId, true, pageVariant) }, 3000) : null
        let visibleSeconds = 0
        let halfway = false
        const scroll = () => {
            const article = document.querySelector('#articolo')
            if (article) { const rect = article.getBoundingClientRect(); halfway ||= window.innerHeight - rect.top >= rect.height * .5 }
        }
        scroll()
        const timer = kind === 'advertorial' ? setInterval(() => {
            if (document.visibilityState === 'visible') visibleSeconds++
            if (visibleSeconds >= 30 && halfway) { void sendJourneyEvent('advertorial_engaged', pixelId, true); clearInterval(timer!) }
        }, 1000) : null
        const click = (e: MouseEvent) => {
            const link = (e.target as Element).closest?.('a[href]') as HTMLAnchorElement | null
            if (kind === 'advertorial' && link && link.origin === window.location.origin && link.pathname === '/f/salto-di-qualita') void sendJourneyEvent('advertorial_cta', pixelId)
        }
        const focus = (e: FocusEvent) => {
            if (kind === 'landing' && (e.target as Element).closest?.('#ms-form')) void sendJourneyEvent('form_start', pixelId, true, pageVariant)
        }
        window.addEventListener('scroll', scroll, { passive: true }); document.addEventListener('click', click); document.addEventListener('focusin', focus)
        return () => { if (landingTimer) clearTimeout(landingTimer); if (timer) clearInterval(timer); window.removeEventListener('scroll', scroll); document.removeEventListener('click', click); document.removeEventListener('focusin', focus) }
    }, [ready, preview, consent?.analytics, consent?.marketing, consent?.at, identityRevision, kind, pixelId, pageVariant])
    if (!ready || preview) return null
    const choose = (analytics: boolean, marketing: boolean) => { setJourneyConsent(analytics, marketing); setEditing(false) }
    return <>
        <button type="button" data-kind={kind} className={styles.preferences} onClick={() => setEditing(true)}>Preferenze cookie e tracciamento</button>
        {(!consent || editing) && <section className={styles.banner} aria-label="Preferenze cookie e tracciamento">
            <strong>Come usiamo i cookie</strong>
            <p>Con il tuo consenso misuriamo il percorso dagli articoli alla richiesta di consulenza. I cookie marketing condividono le visite e le conversioni con Meta per misurare le inserzioni e personalizzare la pubblicità. Puoi continuare anche rifiutando e cambiare scelta in ogni momento.</p>
            <div className={styles.actions}>
                <button type="button" onClick={() => choose(false, false)}>Rifiuta facoltativi</button>
                <button type="button" onClick={() => choose(true, false)}>Solo analisi</button>
                <button type="button" onClick={() => choose(true, true)}>Accetta tutti</button>
            </div>
        </section>}
    </>
}
