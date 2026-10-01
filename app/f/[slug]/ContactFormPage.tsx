'use client'

import { useEffect, useRef, useState } from 'react'
import { ArrowRight, CheckCircle, Clock, Lock, Phone, ShieldCheck, Star } from 'lucide-react'
import { PREDICTIVE_LEAD_VALUE, LEAD_CURRENCY } from '@/lib/meta-events'
import { leadAttempt } from '@/lib/editorial-tracking'
import EditorialTracking from '@/components/EditorialTracking'
import { getJourneySubmission, fireJourneyLead, journeyConsent, setJourneyConsent } from '@/lib/editorial-tracking-client'
import type { AbAssignment } from './MetodoSincroLandingV2'
import styles from './contact-form.module.css'

/*
 * Pagina "Form di contatto": solo il modulo per prenotare la telefonata
 * conoscitiva con il genitore. Si attiva su un funnel metodo_sincro con
 * settings.layout = 'form_contatto', cosi' usa lo stesso invio lead, la
 * stessa pipeline e lo stesso tracciamento della landing principale.
 * Titolo, sottotitolo, testo del pulsante e ringraziamento si cambiano dal
 * gestionale (Funnel > Modifica).
 */

interface Props {
    funnel: {
        id: string; name: string; description?: string; meta_pixel_id?: string
        settings?: Record<string, unknown> | null; objective?: string
    }
    ab?: AbAssignment
}

const CALL_OPTIONS = [
    { value: 'mattina', label: 'Mattina', hint: '9-13' },
    { value: 'pomeriggio', label: 'Pomeriggio', hint: '14-18' },
    { value: 'sera', label: 'Sera', hint: '18-20' },
    { value: 'indifferente', label: 'Indifferente', hint: '' },
]

// I campi di testo del gestionale sono testo semplice: niente HTML.
const plain = (value: unknown) => typeof value === 'string' ? value.replace(/<[^>]*>/g, '').trim() : ''

export default function ContactFormPage({ funnel, ab }: Props) {
    const settings: Record<string, unknown> = funnel.settings || {}
    const abVariant = ab?.variant ?? (settings.ab_variant === 'B' ? 'B' : 'A')

    const headline = plain(settings.headline) || 'Aiutiamo tuo figlio a giocare in partita con la stessa sicurezza con cui si allena'
    const subheadline = plain(settings.subheadline) || 'Un percorso di mental coaching individuale online, con un coach dedicato. Si parte da una telefonata di 15 minuti per capire se e come possiamo aiutarvi.'
    const ctaText = plain(settings.cta_text) && settings.cta_text !== 'Invia Richiesta' ? plain(settings.cta_text) : 'Prenota la telefonata'
    const thankYou = plain(settings.thank_you) && settings.thank_you !== 'Grazie! Ti contatteremo il prima possibile.'
        ? plain(settings.thank_you)
        : 'Ti chiamiamo entro 24-48 ore, nella fascia che ci hai indicato. Tieni il telefono a portata di mano: il primo confronto è con te, il genitore.'

    const [firstName, setFirstName] = useState('')
    const [lastName, setLastName] = useState('')
    const [phone, setPhone] = useState('')
    const [callTime, setCallTime] = useState('')
    // Consenso marketing (Pixel e CAPI): casella facoltativa nel modulo al posto del banner cookie
    // Pre-spuntata su scelta di Antonio (30/09/2026); il genitore può toglierla
    const [adConsent, setAdConsent] = useState(true)
    const [attempted, setAttempted] = useState(false)
    const [loading, setLoading] = useState(false)
    const [submitted, setSubmitted] = useState(false)
    const [error, setError] = useState('')
    const leadAttemptRef = useRef<{ fingerprint: string; id: string } | null>(null)
    const sendingRef = useRef(false)
    const formRef = useRef<HTMLFormElement>(null)
    const submitRef = useRef<HTMLButtonElement>(null)
    // Barra fissa in basso su mobile: visibile finché il pulsante di invio non è sullo
    // schermo e il genitore non ha ancora iniziato a compilare
    const [submitInView, setSubmitInView] = useState(false)
    const [started, setStarted] = useState(false)
    const showBar = !submitInView && !started

    // Chi ha già rifiutato il marketing su un'altra pagina Sincro ritrova la casella vuota
    useEffect(() => { const c = journeyConsent(); if (c && !c.marketing) setAdConsent(false) }, [])

    // Conteggio anonimo (visita, form iniziato) per chi non ha ancora dato il consenso:
    // con il consenso le stesse tappe le registra EditorialTracking.
    const anonFormStartRef = useRef(false)
    const trackAnon = (event: 'view' | 'form_start') => {
        const c = journeyConsent()
        if (ab?.preview || c?.analytics || c?.marketing) return
        const params = new URLSearchParams(window.location.search)
        const body = JSON.stringify({
            event, slug: window.location.pathname.split('/').filter(Boolean).pop(), page_variant: abVariant,
            utm_source: params.get('utm_source'), utm_medium: params.get('utm_medium'), utm_campaign: params.get('utm_campaign'),
            utm_content: params.get('utm_content'), utm_term: params.get('utm_term'), fbadid: params.get('fbadid'),
        })
        fetch('/api/track/funnel-anon', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, keepalive: true }).catch(() => {})
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => { trackAnon('view') }, [])
    const handleFormFocus = () => {
        setStarted(true)
        if (anonFormStartRef.current) return
        anonFormStartRef.current = true
        trackAnon('form_start')
    }

    useEffect(() => {
        const button = submitRef.current
        if (!button || typeof IntersectionObserver === 'undefined') return
        const observer = new IntersectionObserver(([entry]) => setSubmitInView(entry.isIntersecting))
        observer.observe(button)
        return () => observer.disconnect()
    }, [submitted])

    const goToForm = () => {
        formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
        document.getElementById('cf-firstName')?.focus({ preventScroll: true })
    }

    const errors = {
        firstName: !firstName.trim() ? 'Inserisci il nome' : '',
        lastName: !lastName.trim() ? 'Inserisci il cognome' : '',
        phone: !phone.trim() ? 'Il telefono serve per chiamarti' : !/^[+\d\s\-()]+$/.test(phone) || phone.replace(/\D/g, '').length < 6 ? 'Inserisci un numero valido' : '',
    }
    const show = (key: keyof typeof errors) => attempted && errors[key] ? errors[key] : ''

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (sendingRef.current) return
        setAttempted(true)
        if (Object.values(errors).some(Boolean)) {
            const first = (Object.keys(errors) as (keyof typeof errors)[]).find(k => errors[k])
            document.getElementById(`cf-${first}`)?.focus()
            return
        }

        sendingRef.current = true
        setLoading(true)
        setError('')

        leadAttemptRef.current = leadAttempt(leadAttemptRef.current, JSON.stringify([funnel.id, firstName.trim(), lastName.trim(), phone.trim(), callTime]))
        const leadEventId = leadAttemptRef.current.id

        try {
            // Il cookie del consenso va scritto prima dell'invio: il server lo legge per decidere se mandare il Lead a Meta
            const current = journeyConsent()
            if (adConsent !== !!current?.marketing) setJourneyConsent(adConsent || !!current?.analytics, adConsent)
            const journey = getJourneySubmission()
            const res = await fetch('/api/submit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    funnel_id: funnel.id,
                    name: `${firstName.trim()} ${lastName.trim()}`, phone: phone.trim(),
                    page_variant: abVariant,
                    ...journey,
                    extra_data: {
                        ...journey.extra_data,
                        form: 'form_contatto',
                        sport: plain(settings.sport_name) || 'calcio',
                        call_preference: callTime || undefined,
                    },
                    landing_url: window.location.href,
                    event_id: leadEventId,
                }),
            })

            if (!res.ok) {
                const data = await res.json().catch(() => ({}))
                throw new Error(data.error || 'Non siamo riusciti a inviare la richiesta. Riprova tra poco.')
            }

            fireJourneyLead(funnel.meta_pixel_id, leadEventId, {
                content_category: funnel.objective || 'cliente',
                content_name: funnel.name || undefined,
                value: PREDICTIVE_LEAD_VALUE,
                currency: LEAD_CURRENCY,
            })
            setSubmitted(true)
            window.scrollTo({ top: 0, behavior: 'smooth' })
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Non siamo riusciti a inviare la richiesta. Riprova tra poco.')
        } finally {
            sendingRef.current = false
            setLoading(false)
        }
    }

    const tracking = <EditorialTracking pageVariant={abVariant} kind="landing" pixelId={funnel.meta_pixel_id} preview={ab?.preview} consentUi={false} />
    const header = (
        <header className={styles.header}>
            <div className={styles.headerIn}>
                <span className={styles.logo}>METODO SINCRO<sup>®</sup></span>
                <span className={styles.headerNote}><Lock size={13} /> Richiesta riservata</span>
            </div>
        </header>
    )

    if (submitted) {
        const slot = CALL_OPTIONS.find(o => o.value === callTime)
        return (
            <div className={styles.page}>
                {header}
                <main className={styles.thanks} data-clarity-mask="true">
                    <CheckCircle size={56} className={styles.thanksIcon} />
                    <h1>Richiesta ricevuta{firstName.trim() ? `, ${firstName.trim()}` : ''}.</h1>
                    <p className={styles.thanksLead}>{thankYou}</p>

                    <div className={styles.thanksCard}>
                        <Phone size={20} />
                        <div>
                            <strong>Ti chiamiamo al {phone}</strong>
                            <span>{slot && slot.value !== 'indifferente' ? `Preferibilmente di ${slot.label.toLowerCase()} (${slot.hint})` : 'Nel primo momento utile'}</span>
                        </div>
                    </div>

                    <div className={styles.reviews}>
                        <div className={styles.reviewsStars} aria-hidden="true">
                            {[0, 1, 2, 3, 4].map(i => <span key={i}><Star size={18} /></span>)}
                        </div>
                        <p className={styles.reviewsScore}><strong>4,9/5 su Trustpilot</strong> · 359 recensioni</p>
                        <p className={styles.reviewsText}>Mentre aspetti la chiamata, leggi cosa raccontano i genitori che hanno già fatto il percorso.</p>
                        <a href="https://it.trustpilot.com/review/valenteantonio.it" target="_blank" rel="noopener noreferrer" className={styles.reviewsButton}>
                            Leggi le recensioni dei genitori <ArrowRight size={18} />
                        </a>
                    </div>

                    <div className={styles.thanksPrep}>
                        <h2>Per arrivare preparato alla chiamata</h2>
                        <ul>
                            <li>Qual è la situazione che ti preoccupa di più?</li>
                            <li>Da quanto tempo la noti?</li>
                            <li>Cosa vorreste ottenere, tu e tuo figlio?</li>
                        </ul>
                    </div>

                </main>
                {tracking}
            </div>
        )
    }

    return (
        <div className={styles.page}>
            {header}
            <main className={styles.main}>
                <section className={styles.intro}>
                    <p className={styles.eyebrow}>Per genitori di giovani calciatori dai 10 ai 25 anni:</p>
                    <h1 className={styles.title}>{headline}</h1>
                    <p className={styles.lead}>{subheadline}</p>
                    <p className={styles.proof}><Star size={16} /> Oltre 1.100 ragazzi seguiti · 4,9/5 su Trustpilot con 359 recensioni</p>
                </section>

                <section className={styles.details}>
                    <ol className={styles.steps}>
                        <li><span>1</span><div><strong>Compili il modulo</strong><p>Bastano nome, cognome e telefono: meno di un minuto.</p></div></li>
                        <li><span>2</span><div><strong>Ti chiamiamo noi</strong><p>Entro 24-48 ore, nella fascia oraria che preferisci.</p></div></li>
                        <li><span>3</span><div><strong>Valutiamo insieme</strong><p>Se il percorso è adatto te lo diciamo. Se non lo è, te lo diciamo lo stesso.</p></div></li>
                    </ol>

                    <div className={styles.trust}>
                        <span><ShieldCheck size={16} /> Nessun impegno</span>
                        <span><Clock size={16} /> Circa 15 minuti</span>
                        <span><Phone size={16} /> Telefonata gratuita</span>
                    </div>
                </section>

                <form id="ms-form" ref={formRef} onFocus={handleFormFocus} className={styles.card} onSubmit={handleSubmit} noValidate data-clarity-mask="true">
                    <h2 className={styles.cardTitle}>Prenota la telefonata</h2>

                    <div className={styles.pair}>
                        <div className={styles.field}>
                            <label htmlFor="cf-firstName">Nome</label>
                            <input id="cf-firstName" type="text" autoComplete="given-name" value={firstName} onChange={e => setFirstName(e.target.value)} aria-invalid={!!show('firstName')} placeholder="Es. Laura" />
                            {show('firstName') && <p className={styles.error}>{show('firstName')}</p>}
                        </div>
                        <div className={styles.field}>
                            <label htmlFor="cf-lastName">Cognome</label>
                            <input id="cf-lastName" type="text" autoComplete="family-name" value={lastName} onChange={e => setLastName(e.target.value)} aria-invalid={!!show('lastName')} placeholder="Es. Bianchi" />
                            {show('lastName') && <p className={styles.error}>{show('lastName')}</p>}
                        </div>
                    </div>

                    <div className={styles.field}>
                        <label htmlFor="cf-phone">Telefono</label>
                        <input id="cf-phone" type="tel" autoComplete="tel" inputMode="tel" value={phone} onChange={e => setPhone(e.target.value)} aria-invalid={!!show('phone')} placeholder="+39 ..." />
                        {show('phone') && <p className={styles.error}>{show('phone')}</p>}
                    </div>

                    <fieldset className={styles.field}>
                        <legend>Quando preferisci essere chiamato? <span className={styles.optional}>(facoltativo)</span></legend>
                        <div className={styles.choices}>
                            {CALL_OPTIONS.map(o => (
                                <button key={o.value} type="button" className={styles.choice} aria-pressed={callTime === o.value} onClick={() => setCallTime(callTime === o.value ? '' : o.value)}>
                                    {o.label}{o.hint && <small>{o.hint}</small>}
                                </button>
                            ))}
                        </div>
                    </fieldset>

                    <label className={styles.consent}>
                        <input type="checkbox" checked={adConsent} onChange={e => setAdConsent(e.target.checked)} />
                        <span>Acconsento all’uso di cookie e dati di contatto per misurare l’efficacia delle nostre inserzioni su Facebook e Instagram (Meta). <em>Facoltativo: la richiesta arriva anche senza.</em></span>
                    </label>

                    {error && <p className={styles.submitError} role="alert">{error}</p>}

                    <button type="submit" ref={submitRef} className={styles.submit} disabled={loading}>
                        {loading ? <span className={styles.spinner} aria-label="Invio in corso" /> : <>{ctaText} <ArrowRight size={18} /></>}
                    </button>
                    <p className={styles.privacy}><Lock size={12} /> Usiamo i tuoi dati solo per ricontattarti. Niente spam.</p>
                </form>
            </main>
            <div className={styles.stickyBar} data-visible={showBar} aria-hidden={!showBar}>
                <button type="button" className={styles.stickyButton} onClick={goToForm} tabIndex={showBar ? 0 : -1}>
                    {ctaText} <ArrowRight size={18} />
                </button>
                <p><Clock size={12} /> Bastano nome e telefono · Telefonata gratuita</p>
            </div>
            {tracking}
        </div>
    )
}
