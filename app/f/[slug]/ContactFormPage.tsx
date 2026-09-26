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

const AGE_OPTIONS = [
    { value: '8-10', label: '8-10 anni' },
    { value: '11-13', label: '11-13 anni' },
    { value: '14-16', label: '14-16 anni' },
    { value: '17-20', label: '17-20 anni' },
    { value: '20+', label: 'Oltre 20 anni' },
]

const CALL_OPTIONS = [
    { value: 'mattina', label: 'Mattina', hint: '9-13' },
    { value: 'pomeriggio', label: 'Pomeriggio', hint: '14-18' },
    { value: 'sera', label: 'Sera', hint: '18-20' },
    { value: 'indifferente', label: 'Indifferente', hint: '' },
]

const MESSAGE_MAX = 600

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

    const [fullName, setFullName] = useState('')
    const [phone, setPhone] = useState('')
    const [email, setEmail] = useState('')
    const [childAge, setChildAge] = useState('')
    const [callTime, setCallTime] = useState('')
    const [message, setMessage] = useState('')
    // Consenso marketing (Pixel e CAPI): casella facoltativa nel modulo al posto del banner cookie
    const [adConsent, setAdConsent] = useState(false)
    const [attempted, setAttempted] = useState(false)
    const [loading, setLoading] = useState(false)
    const [submitted, setSubmitted] = useState(false)
    const [error, setError] = useState('')
    const leadAttemptRef = useRef<{ fingerprint: string; id: string } | null>(null)
    const sendingRef = useRef(false)

    // Chi ha già accettato su un'altra pagina Sincro ritrova la casella spuntata
    useEffect(() => { if (journeyConsent()?.marketing) setAdConsent(true) }, [])

    const errors = {
        name: !fullName.trim() ? 'Inserisci nome e cognome' : !fullName.trim().includes(' ') ? 'Inserisci anche il cognome' : '',
        phone: !phone.trim() ? 'Il telefono serve per chiamarti' : !/^[+\d\s\-()]+$/.test(phone) || phone.replace(/\D/g, '').length < 6 ? 'Inserisci un numero valido' : '',
        email: !email.trim() ? 'Inserisci la tua email' : !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ? 'Controlla l’email' : '',
        childAge: !childAge ? 'Indica l’età' : '',
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

        leadAttemptRef.current = leadAttempt(leadAttemptRef.current, JSON.stringify([funnel.id, fullName.trim(), email.trim(), phone.trim(), childAge, callTime, message.trim()]))
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
                    name: fullName.trim(), email: email.trim(), phone: phone.trim(),
                    page_variant: abVariant,
                    ...journey,
                    extra_data: {
                        ...journey.extra_data,
                        form: 'form_contatto',
                        sport: plain(settings.sport_name) || 'calcio',
                        child_age: childAge,
                        call_preference: callTime || undefined,
                        message: message.trim() || undefined,
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
                    <h1>Richiesta ricevuta{fullName ? `, ${fullName.trim().split(' ')[0]}` : ''}.</h1>
                    <p className={styles.thanksLead}>{thankYou}</p>

                    <div className={styles.thanksCard}>
                        <Phone size={20} />
                        <div>
                            <strong>Ti chiamiamo al {phone}</strong>
                            <span>{slot && slot.value !== 'indifferente' ? `Preferibilmente di ${slot.label.toLowerCase()} (${slot.hint})` : 'Nel primo momento utile'}</span>
                        </div>
                    </div>

                    <div className={styles.thanksPrep}>
                        <h2>Per arrivare preparato alla chiamata</h2>
                        <ul>
                            <li>Qual è la situazione che ti preoccupa di più?</li>
                            <li>Da quanto tempo la noti?</li>
                            <li>Cosa vorreste ottenere, tu e tuo figlio?</li>
                        </ul>
                    </div>

                    <a href="https://it.trustpilot.com/review/valenteantonio.it" target="_blank" rel="noopener noreferrer" className={styles.thanksLink}>
                        <Star size={16} /> Leggi le recensioni dei genitori su Trustpilot
                    </a>
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
                        <li><span>1</span><div><strong>Compili il modulo</strong><p>Un minuto, bastano i tuoi recapiti e l’età di tuo figlio.</p></div></li>
                        <li><span>2</span><div><strong>Ti chiamiamo noi</strong><p>Entro 24-48 ore, nella fascia oraria che preferisci.</p></div></li>
                        <li><span>3</span><div><strong>Valutiamo insieme</strong><p>Se il percorso è adatto te lo diciamo. Se non lo è, te lo diciamo lo stesso.</p></div></li>
                    </ol>

                    <div className={styles.trust}>
                        <span><ShieldCheck size={16} /> Nessun impegno</span>
                        <span><Clock size={16} /> Circa 15 minuti</span>
                        <span><Phone size={16} /> Telefonata gratuita</span>
                    </div>
                </section>

                <form id="ms-form" className={styles.card} onSubmit={handleSubmit} noValidate data-clarity-mask="true">
                    <h2 className={styles.cardTitle}>Prenota la telefonata</h2>

                    <div className={styles.field}>
                        <label htmlFor="cf-name">Il tuo nome e cognome</label>
                        <input id="cf-name" type="text" autoComplete="name" value={fullName} onChange={e => setFullName(e.target.value)} aria-invalid={!!show('name')} placeholder="Es. Laura Bianchi" />
                        {show('name') && <p className={styles.error}>{show('name')}</p>}
                    </div>

                    <div className={styles.row}>
                        <div className={styles.field}>
                            <label htmlFor="cf-phone">Telefono</label>
                            <input id="cf-phone" type="tel" autoComplete="tel" inputMode="tel" value={phone} onChange={e => setPhone(e.target.value)} aria-invalid={!!show('phone')} placeholder="+39 ..." />
                            {show('phone') && <p className={styles.error}>{show('phone')}</p>}
                        </div>
                        <div className={styles.field}>
                            <label htmlFor="cf-email">Email</label>
                            <input id="cf-email" type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} aria-invalid={!!show('email')} placeholder="nome@email.it" />
                            {show('email') && <p className={styles.error}>{show('email')}</p>}
                        </div>
                    </div>

                    <div className={styles.field}>
                        <label htmlFor="cf-childAge">Quanti anni ha tuo figlio?</label>
                        <select id="cf-childAge" value={childAge} onChange={e => setChildAge(e.target.value)} aria-invalid={!!show('childAge')}>
                            <option value="">Seleziona</option>
                            {AGE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                        {show('childAge') && <p className={styles.error}>{show('childAge')}</p>}
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

                    <div className={styles.field}>
                        <label htmlFor="cf-message">Raccontaci in breve la situazione <span className={styles.optional}>(facoltativo)</span></label>
                        <textarea id="cf-message" rows={3} maxLength={MESSAGE_MAX} value={message} onChange={e => setMessage(e.target.value)} placeholder="Es. gioca negli Allievi, in partita si blocca e ha perso fiducia..." />
                    </div>

                    <label className={styles.consent}>
                        <input type="checkbox" checked={adConsent} onChange={e => setAdConsent(e.target.checked)} />
                        <span>Acconsento all’uso di cookie e dati di contatto per misurare l’efficacia delle nostre inserzioni su Facebook e Instagram (Meta). <em>Facoltativo: la richiesta arriva anche senza.</em></span>
                    </label>

                    {error && <p className={styles.submitError} role="alert">{error}</p>}

                    <button type="submit" className={styles.submit} disabled={loading}>
                        {loading ? <span className={styles.spinner} aria-label="Invio in corso" /> : <>{ctaText} <ArrowRight size={18} /></>}
                    </button>
                    <p className={styles.privacy}><Lock size={12} /> Usiamo i tuoi dati solo per ricontattarti. Niente spam.</p>
                </form>
            </main>
            {tracking}
        </div>
    )
}
