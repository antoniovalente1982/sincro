'use client'

import { useEffect, useRef, useState } from 'react'

// Pagina di candidatura alla chiamata gratuita di 20 minuti (lancio 24 agosto 2026).
// Destinazione delle email P1, P3, P4, P5 del funnel post-webinar.
//
// Stile identico alle email del lancio: crema #f6f4ef, navy #0d1b2a, oro #c9a84c,
// Helvetica/Arial. Nessuna dipendenza esterna — il traffico arriva da email e
// WhatsApp, quasi tutto da telefono, e la pagina deve aprirsi subito.
//
// Vincolo non negoziabile: nessun prezzo, da nessuna parte. Si parla solo di
// candidatura alla chiamata gratuita.

const NAVY = '#0d1b2a'
const ORO = '#c9a84c'
const CREMA = '#f6f4ef'
const TESTO = '#1a1a1a'
const TESTO_TENUE = '#6b6b6b'
const BORDO = '#ddd7ca'

const FONT = 'Helvetica, Arial, sans-serif'

const LIVELLI = [
    'Scuola calcio',
    'Agonistica dilettanti',
    'Settore giovanile professionistico',
    'Professionista',
]

const ETA = Array.from({ length: 11 }, (_, i) => String(10 + i))

const MAX_DIFFICOLTA = 500

type Utm = Record<string, string>

export default function CandidaturaClient({ aperte }: { aperte: boolean }) {
    // Gli UTM in ingresso viaggiano fino alla submission: servono a capire da
    // quale email del funnel è arrivata la candidatura.
    const utm = useRef<Utm>({})

    useEffect(() => {
        const params = new URLSearchParams(window.location.search)
        const raccolti: Utm = {}
        for (const k of ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term']) {
            const v = params.get(k)
            if (v) raccolti[k] = v
        }
        utm.current = raccolti
    }, [])

    const [inviata, setInviata] = useState<null | 'candidatura' | 'lista-attesa'>(null)

    if (inviata) return <Conferma tipo={inviata} />

    return (
        <Pagina>
            <Hero aperte={aperte} />
            <ComeFunziona />
            <PerChi />
            <ProvaSociale />
            {aperte ? (
                <FormCandidatura utm={utm} onSuccess={() => setInviata('candidatura')} />
            ) : (
                <FormListaAttesa utm={utm} onSuccess={() => setInviata('lista-attesa')} />
            )}
            <Footer />
        </Pagina>
    )
}

/* ── Struttura ──────────────────────────────────────────────── */

function Pagina({ children }: { children: React.ReactNode }) {
    return (
        <div style={{ background: CREMA, minHeight: '100vh', fontFamily: FONT }}>
            <header style={{ background: NAVY }} className="px-5 py-4">
                <div className="mx-auto" style={{ maxWidth: 600 }}>
                    <span
                        className="text-[13px] font-bold"
                        style={{ color: ORO, letterSpacing: '3.5px' }}
                    >
                        METODO SINCRO&reg;
                    </span>
                </div>
            </header>

            <main className="mx-auto px-4 pb-14 pt-5" style={{ maxWidth: 600 }}>
                {children}
            </main>
        </div>
    )
}

function Card({
    children,
    className = '',
    style,
    id,
}: {
    children: React.ReactNode
    className?: string
    style?: React.CSSProperties
    id?: string
}) {
    return (
        <section
            id={id}
            className={`mb-4 rounded-lg px-6 py-7 sm:px-8 ${className}`}
            style={{ background: '#ffffff', ...style }}
        >
            {children}
        </section>
    )
}

function Occhiello({ children, chiaro = false }: { children: React.ReactNode; chiaro?: boolean }) {
    return (
        <p
            className="mb-4 text-[12px] font-bold"
            style={{ color: chiaro ? ORO : TESTO_TENUE, letterSpacing: '2px' }}
        >
            {children}
        </p>
    )
}

/* ── Sezioni ────────────────────────────────────────────────── */

function Hero({ aperte }: { aperte: boolean }) {
    return (
        <Card style={{ background: NAVY }}>
            <h1
                className="mb-5 text-[27px] font-bold leading-[1.2] sm:text-[30px]"
                style={{ color: '#ffffff' }}
            >
                20 minuti sulla situazione di tuo figlio. Non sulla teoria.
            </h1>

            <p className="mb-7 text-[16px] leading-relaxed" style={{ color: '#cfcabf' }}>
                Una chiamata gratuita con uno dei coach del Metodo Sincro. Guardiamo il suo momento,
                capiamo se c&apos;è un blocco e quale, e ti diciamo cosa faremmo noi. Se non è la
                cosa giusta per lui, te lo diciamo — è successo, succederà ancora.
            </p>

            <BottoneOro as="a" href="#candidatura">
                {aperte ? 'Candidati alla chiamata' : 'Entra in lista d’attesa'}
            </BottoneOro>
        </Card>
    )
}

const STEP = [
    {
        titolo: 'Compili la candidatura',
        testo: 'Due minuti. Le domande servono al coach per arrivare preparato.',
    },
    {
        titolo: 'Ti ricontattiamo su WhatsApp entro 24–48 ore',
        testo: 'Per fissare giorno e ora.',
    },
    {
        titolo: 'Fai la chiamata',
        testo: '20 minuti, si parla solo di tuo figlio.',
    },
]

function ComeFunziona() {
    return (
        <Card>
            <Occhiello>COME FUNZIONA</Occhiello>
            <ol className="space-y-5">
                {STEP.map((s, i) => (
                    <li key={s.titolo} className="flex gap-4">
                        <span
                            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[14px] font-bold"
                            style={{ background: ORO, color: NAVY }}
                            aria-hidden="true"
                        >
                            {i + 1}
                        </span>
                        <span>
                            <span className="block text-[17px] font-bold leading-snug" style={{ color: NAVY }}>
                                {s.titolo}
                            </span>
                            <span className="mt-1 block text-[15px] leading-relaxed" style={{ color: TESTO_TENUE }}>
                                {s.testo}
                            </span>
                        </span>
                    </li>
                ))}
            </ol>
        </Card>
    )
}

const PER_TE = [
    'Genitori di calciatori dai 10 ai 20 anni',
    'Dal settore giovanile ai professionisti',
    '«In allenamento è un altro, in partita sparisce»',
    'Ansia da prestazione, blocchi, pressione, provini',
]

const NON_PER_TE = [
    'Chi cerca un procuratore',
    'Chi cerca allenamento tecnico in campo',
    'Chi vuole «la frase magica da dire in macchina»',
]

function PerChi() {
    return (
        <Card>
            <div className="grid gap-7 sm:grid-cols-2 sm:gap-6">
                <div>
                    <Occhiello>È PER TE SE</Occhiello>
                    <ul className="space-y-3">
                        {PER_TE.map((t) => (
                            <li key={t} className="flex gap-3 text-[15px] leading-snug" style={{ color: TESTO }}>
                                <Icona tipo="si" />
                                <span>{t}</span>
                            </li>
                        ))}
                    </ul>
                </div>

                <div className="border-t pt-7 sm:border-l sm:border-t-0 sm:pl-6 sm:pt-0" style={{ borderColor: BORDO }}>
                    <Occhiello>NON È PER TE SE</Occhiello>
                    <ul className="space-y-3">
                        {NON_PER_TE.map((t) => (
                            <li key={t} className="flex gap-3 text-[15px] leading-snug" style={{ color: TESTO_TENUE }}>
                                <Icona tipo="no" />
                                <span>{t}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            </div>
        </Card>
    )
}

function Icona({ tipo }: { tipo: 'si' | 'no' }) {
    return (
        <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke={tipo === 'si' ? ORO : '#b3ada0'}
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="mt-[3px] shrink-0"
            aria-hidden="true"
        >
            {tipo === 'si' ? <polyline points="20 6 9 17 4 12" /> : <><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></>}
        </svg>
    )
}

const NUMERI = [
    '+1.100 atleti seguiti',
    '+8.880 ore di lavoro',
    '4,9★ 356 recensioni Trustpilot',
    '+20 coach',
]

function ProvaSociale() {
    return (
        <div
            className="mb-4 flex flex-wrap justify-center gap-x-3 gap-y-2 rounded-lg px-5 py-4 text-center"
            style={{ background: NAVY }}
        >
            {NUMERI.map((n, i) => (
                <span
                    key={n}
                    className="text-[11px] font-bold uppercase"
                    style={{ color: ORO, letterSpacing: '1.4px' }}
                >
                    {n}
                    {i < NUMERI.length - 1 && <span style={{ color: '#3d4a58' }} className="ml-3">·</span>}
                </span>
            ))}
        </div>
    )
}

/* ── Form candidatura ───────────────────────────────────────── */

type Errori = Record<string, string>

function FormCandidatura({
    utm,
    onSuccess,
}: {
    utm: React.RefObject<Utm>
    onSuccess: () => void
}) {
    const [nome, setNome] = useState('')
    const [email, setEmail] = useState('')
    const [telefono, setTelefono] = useState('')
    const [etaFiglio, setEtaFiglio] = useState('')
    const [livello, setLivello] = useState('')
    const [difficolta, setDifficolta] = useState('')
    const [privacy, setPrivacy] = useState(false)

    const [errori, setErrori] = useState<Errori>({})
    const [erroreInvio, setErroreInvio] = useState('')
    const [invio, setInvio] = useState(false)

    const valida = (): Errori => {
        const e: Errori = {}
        if (nome.trim().length < 2) e.nome = 'Inserisci nome e cognome'
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) e.email = "Inserisci un'email valida"
        if (telefono.replace(/\D/g, '').length < 8) e.telefono = 'Inserisci il tuo numero di cellulare'
        if (!etaFiglio) e.etaFiglio = 'Seleziona l’età di tuo figlio'
        if (!livello) e.livello = 'Seleziona il livello'
        if (difficolta.trim().length < 3) e.difficolta = 'Scrivi due righe: al coach servono davvero'
        if (!privacy) e.privacy = 'Serve il tuo consenso per ricontattarti'
        return e
    }

    const onSubmit = async (ev: React.FormEvent) => {
        ev.preventDefault()
        const e = valida()
        setErrori(e)
        setErroreInvio('')
        if (Object.keys(e).length > 0) return

        setInvio(true)
        try {
            const res = await fetch('/api/candidatura', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    tipo: 'candidatura',
                    nome: nome.trim(),
                    email: email.trim(),
                    telefono: telefono.trim(),
                    etaFiglio,
                    livello,
                    difficolta: difficolta.trim(),
                    privacy: true,
                    utm: utm.current,
                    landing_url:
                        typeof window !== 'undefined'
                            ? window.location.hostname + window.location.pathname
                            : 'landing.metodosincro.com/candidatura',
                }),
            })
            const dati = await res.json().catch(() => ({}))
            if (!res.ok) throw new Error(dati?.error || 'Riprova fra un minuto.')
            onSuccess()
        } catch (err) {
            setErroreInvio(
                err instanceof Error ? err.message : "Non è partita. Riprova fra un minuto."
            )
        } finally {
            setInvio(false)
        }
    }

    return (
        <Card id="candidatura">
            <Occhiello>LA TUA CANDIDATURA</Occhiello>
            <h2 className="mb-6 text-[22px] font-bold leading-snug" style={{ color: NAVY }}>
                Due minuti, e poi ci pensiamo noi.
            </h2>

            <form onSubmit={onSubmit} noValidate>
                <Campo label="Nome e cognome (tuo, del genitore)" errore={errori.nome} htmlFor="nome">
                    <input
                        id="nome"
                        type="text"
                        autoComplete="name"
                        value={nome}
                        onChange={(e) => setNome(e.target.value)}
                        className={inputClass}
                        style={inputStyle}
                    />
                </Campo>

                <Campo label="Email" errore={errori.email} htmlFor="email">
                    <input
                        id="email"
                        type="email"
                        inputMode="email"
                        autoComplete="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className={inputClass}
                        style={inputStyle}
                    />
                </Campo>

                <Campo
                    label="Cellulare (WhatsApp)"
                    nota="Ti scriviamo lì per fissare la chiamata."
                    errore={errori.telefono}
                    htmlFor="telefono"
                >
                    <input
                        id="telefono"
                        type="tel"
                        inputMode="tel"
                        autoComplete="tel"
                        value={telefono}
                        onChange={(e) => setTelefono(e.target.value)}
                        className={inputClass}
                        style={inputStyle}
                    />
                </Campo>

                <Campo label="Età di tuo figlio" errore={errori.etaFiglio} htmlFor="eta">
                    <select
                        id="eta"
                        value={etaFiglio}
                        onChange={(e) => setEtaFiglio(e.target.value)}
                        className={inputClass}
                        style={inputStyle}
                    >
                        <option value="">Seleziona…</option>
                        {ETA.map((a) => (
                            <option key={a} value={a}>
                                {a} anni
                            </option>
                        ))}
                    </select>
                </Campo>

                <Campo label="Dove gioca" errore={errori.livello} htmlFor="livello">
                    <select
                        id="livello"
                        value={livello}
                        onChange={(e) => setLivello(e.target.value)}
                        className={inputClass}
                        style={inputStyle}
                    >
                        <option value="">Seleziona…</option>
                        {LIVELLI.map((l) => (
                            <option key={l} value={l}>
                                {l}
                            </option>
                        ))}
                    </select>
                </Campo>

                <Campo
                    label="Qual è la difficoltà principale in questo momento?"
                    errore={errori.difficolta}
                    htmlFor="difficolta"
                >
                    <textarea
                        id="difficolta"
                        rows={4}
                        maxLength={MAX_DIFFICOLTA}
                        value={difficolta}
                        onChange={(e) => setDifficolta(e.target.value)}
                        placeholder="Es.: in partita si blocca, dopo un errore sparisce dal gioco…"
                        className={`${inputClass} resize-y`}
                        style={inputStyle}
                    />
                    <span className="mt-1 block text-right text-[12px]" style={{ color: TESTO_TENUE }}>
                        {difficolta.length}/{MAX_DIFFICOLTA}
                    </span>
                </Campo>

                <label className="mb-6 flex cursor-pointer gap-3 text-[14px] leading-snug" style={{ color: TESTO_TENUE }}>
                    <input
                        type="checkbox"
                        checked={privacy}
                        onChange={(e) => setPrivacy(e.target.checked)}
                        className="mt-[3px] h-4 w-4 shrink-0"
                        style={{ accentColor: ORO }}
                    />
                    <span>
                        Acconsento al trattamento dei miei dati per essere ricontattato riguardo alla
                        chiamata.
                        {errori.privacy && (
                            <span className="mt-1 block font-bold" style={{ color: '#a33' }}>
                                {errori.privacy}
                            </span>
                        )}
                    </span>
                </label>

                {erroreInvio && (
                    <p
                        className="mb-4 rounded px-4 py-3 text-[14px]"
                        style={{ background: '#fbeaea', color: '#a33' }}
                        role="alert"
                    >
                        {erroreInvio}
                    </p>
                )}

                <BottoneOro as="button" disabled={invio}>
                    {invio ? 'Invio in corso…' : 'Invia la candidatura'}
                </BottoneOro>

                <p className="mt-4 text-[13px] leading-relaxed" style={{ color: TESTO_TENUE }}>
                    Gratuita e senza impegno. I posti per settembre sono limitati: siamo circa 20
                    coach, le agende sono chiuse a numero.
                </p>
            </form>
        </Card>
    )
}

/* ── Form lista d'attesa (candidature chiuse) ───────────────── */

function FormListaAttesa({
    utm,
    onSuccess,
}: {
    utm: React.RefObject<Utm>
    onSuccess: () => void
}) {
    const [email, setEmail] = useState('')
    const [errore, setErrore] = useState('')
    const [invio, setInvio] = useState(false)

    const onSubmit = async (ev: React.FormEvent) => {
        ev.preventDefault()
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
            setErrore("Inserisci un'email valida")
            return
        }
        setErrore('')
        setInvio(true)
        try {
            const res = await fetch('/api/candidatura', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    tipo: 'lista-attesa',
                    email: email.trim(),
                    utm: utm.current,
                    landing_url:
                        typeof window !== 'undefined'
                            ? window.location.hostname + window.location.pathname
                            : 'landing.metodosincro.com/candidatura',
                }),
            })
            if (!res.ok) {
                const dati = await res.json().catch(() => ({}))
                throw new Error(dati?.error || 'Riprova fra un minuto.')
            }
            onSuccess()
        } catch (err) {
            setErrore(err instanceof Error ? err.message : 'Riprova fra un minuto.')
        } finally {
            setInvio(false)
        }
    }

    return (
        <Card id="candidatura">
            <Occhiello>CANDIDATURE CHIUSE</Occhiello>
            <h2 className="mb-4 text-[22px] font-bold leading-snug" style={{ color: NAVY }}>
                Le candidature per settembre sono chiuse.
            </h2>
            <p className="mb-6 text-[16px] leading-relaxed" style={{ color: TESTO }}>
                Lascia l&apos;email: ti avvisiamo quando riapriamo per ottobre.
            </p>

            <form onSubmit={onSubmit} noValidate>
                <Campo label="Email" errore={errore} htmlFor="email-attesa">
                    <input
                        id="email-attesa"
                        type="email"
                        inputMode="email"
                        autoComplete="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className={inputClass}
                        style={inputStyle}
                    />
                </Campo>

                <BottoneOro as="button" disabled={invio}>
                    {invio ? 'Invio in corso…' : 'Avvisami quando riapre'}
                </BottoneOro>
            </form>
        </Card>
    )
}

/* ── Conferma (thank-you, stesso stile di /resto) ───────────── */

function Conferma({ tipo }: { tipo: 'candidatura' | 'lista-attesa' }) {
    return (
        <div
            style={{ background: CREMA, minHeight: '100vh', fontFamily: FONT }}
            className="flex items-center justify-center px-4 py-10"
        >
            <main className="w-full overflow-hidden rounded-lg bg-white shadow-sm" style={{ maxWidth: 600 }}>
                <div style={{ background: NAVY }} className="px-8 py-5">
                    <span className="text-[13px] font-bold" style={{ color: ORO, letterSpacing: '3.5px' }}>
                        METODO SINCRO&reg;
                    </span>
                </div>

                <div className="px-8 py-10">
                    <div
                        className="mb-6 flex h-14 w-14 items-center justify-center rounded-full"
                        style={{ background: CREMA, border: `2px solid ${ORO}` }}
                        aria-hidden="true"
                    >
                        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={NAVY} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12" />
                        </svg>
                    </div>

                    {tipo === 'candidatura' ? (
                        <>
                            <h1 className="mb-4 text-[26px] font-bold leading-tight" style={{ color: NAVY }}>
                                Candidatura ricevuta.
                            </h1>
                            <p className="mb-4 text-[17px] leading-relaxed" style={{ color: TESTO }}>
                                Ti scriviamo su WhatsApp entro 24–48 ore per fissare la chiamata. Se
                                non ti arriva nulla, controlla anche l&apos;email.
                            </p>
                            <p className="mb-8 text-[17px] leading-relaxed" style={{ color: TESTO }}>
                                Nel frattempo non devi preparare niente: alla chiamata bastano venti
                                minuti e le cose come stanno.
                            </p>
                        </>
                    ) : (
                        <>
                            <h1 className="mb-4 text-[26px] font-bold leading-tight" style={{ color: NAVY }}>
                                Ci sei.
                            </h1>
                            <p className="mb-8 text-[17px] leading-relaxed" style={{ color: TESTO }}>
                                Ti avvisiamo per email appena riapriamo le candidature per ottobre.
                                Sei fra i primi a saperlo.
                            </p>
                        </>
                    )}

                    <div className="rounded-md px-6 py-5" style={{ background: CREMA }}>
                        <p className="text-[15px] leading-relaxed" style={{ color: TESTO_TENUE }}>
                            In bocca al lupo a tuo figlio per la stagione che comincia.
                        </p>
                        <p className="mt-2 text-[16px]" style={{ color: TESTO }}>
                            Antonio Valente
                            <span className="block text-[13px]" style={{ color: TESTO_TENUE }}>
                                Fondatore, Metodo Sincro&reg;
                            </span>
                        </p>
                    </div>
                </div>
            </main>
        </div>
    )
}

function Footer() {
    return (
        <p className="mt-6 text-center text-[12px] leading-relaxed" style={{ color: TESTO_TENUE }}>
            Metodo Sincro&reg; — la chiamata è gratuita e senza impegno.
        </p>
    )
}

/* ── Pezzi riusabili ────────────────────────────────────────── */

const inputClass =
    'w-full rounded border px-3.5 py-3 text-[16px] outline-none transition-colors focus:border-[#c9a84c]'

const inputStyle: React.CSSProperties = {
    borderColor: BORDO,
    background: '#ffffff',
    color: TESTO,
    fontFamily: FONT,
}

function Campo({
    label,
    nota,
    errore,
    htmlFor,
    children,
}: {
    label: string
    nota?: string
    errore?: string
    htmlFor: string
    children: React.ReactNode
}) {
    return (
        <div className="mb-5">
            <label htmlFor={htmlFor} className="mb-2 block text-[14px] font-bold" style={{ color: NAVY }}>
                {label}
            </label>
            {nota && (
                <p className="mb-2 text-[13px]" style={{ color: TESTO_TENUE }}>
                    {nota}
                </p>
            )}
            {children}
            {errore && (
                <p className="mt-2 text-[13px] font-bold" style={{ color: '#a33' }} role="alert">
                    {errore}
                </p>
            )}
        </div>
    )
}

function BottoneOro({
    as,
    href,
    disabled,
    children,
}: {
    as: 'a' | 'button'
    href?: string
    disabled?: boolean
    children: React.ReactNode
}) {
    const stile: React.CSSProperties = {
        background: ORO,
        color: NAVY,
        letterSpacing: '1px',
        fontFamily: FONT,
        opacity: disabled ? 0.6 : 1,
    }
    const classi =
        'block w-full rounded-[4px] px-6 py-4 text-center text-[15px] font-bold uppercase leading-none'

    if (as === 'a') {
        return (
            <a href={href} className={classi} style={stile}>
                {children}
            </a>
        )
    }
    return (
        <button type="submit" disabled={disabled} className={`${classi} cursor-pointer`} style={stile}>
            {children}
        </button>
    )
}
