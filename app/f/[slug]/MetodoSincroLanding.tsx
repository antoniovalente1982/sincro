'use client'

import { useState, useEffect } from 'react'
import { CheckCircle, ArrowRight, ChevronRight, Star, Shield, Clock, Users, Trophy, Phone, Mail, User, ChevronDown, Gift, MessageCircle, Sparkles } from 'lucide-react'

interface Props {
    funnel: {
        id: string; name: string; description?: string; meta_pixel_id?: string
        settings?: any; organizations?: any; objective?: string
    }
}

const PROBLEMS = [
    { value: 'ansia', label: 'Ansia da prestazione', icon: '😰' },
    { value: 'paura_giudizio', label: 'Paura del giudizio', icon: '👀' },
    { value: 'mancanza_fiducia', label: 'Mancanza di fiducia', icon: '💔' },
    { value: 'panchina', label: 'Troppa panchina', icon: '🪑' },
    { value: 'pressione', label: 'Non regge la pressione', icon: '😤' },
    { value: 'post_infortunio', label: 'Paura post-infortunio', icon: '🏥' },
    { value: 'concentrazione', label: 'Poca concentrazione', icon: '🎯' },
    { value: 'altro', label: 'Altro', icon: '📝' },
]

const AGE_RANGES = [
    { value: '10-12', label: '10-12 anni' },
    { value: '13-14', label: '13-14 anni' },
    { value: '15-16', label: '15-16 anni' },
    { value: '17-18', label: '17-18 anni' },
    { value: '19+', label: '19+ anni' },
]

const FAMOUS_PLAYERS = [
    { name: 'Patrick Cutrone', team: 'Ex Milan, Valencia, Como, Monza', img: '/images/calciatori/Patrick Cutrone (Monza).png' },
    { name: 'Matteo Brunori', team: 'Sampdoria', img: '/images/calciatori/Matteo Brunori (Sampdoria).png' },
    { name: 'Barbara Bonansea', team: 'Juventus Women', img: '/images/calciatori/Barbara Bonansea (Juventus).png' },
    { name: 'Martina Piemonte', team: 'Lazio Women', img: '/images/calciatori/Martina Piemonte (Lazio).png' },
    { name: 'Simone Cinquegrano', team: 'Inter', img: '/images/calciatori/Simone Cinquegrano (Inter).png' },
    { name: 'Gianmarco Cangiano', team: 'Lega Pro', img: '/images/calciatori/Gianmarco Cangiano (Lega Pro).png' },
    { name: 'Chiara Robustellini', team: 'Inter Women', img: '/images/calciatori/Chiara Robustellini (inter).png' },
    { name: 'Filippo Frison', team: 'Lega Pro', img: '/images/calciatori/Filippo Frison (Lega Pro).png' },
    { name: 'Francesca Durante', team: 'Lazio Women', img: '/images/calciatori/Francesca Durante (Lazio).png' },
    { name: 'Iris Rabot', team: 'Parma Women', img: '/images/calciatori/Iris Rabot (Parma).png' },
    { name: 'Annahita Zamanian', team: 'Parma Women', img: '/images/calciatori/Annahita Zamanian (Parma).png' },
    { name: 'Riccardo Zoia', team: 'Lega Pro', img: '/images/calciatori/Riccardo Zoia (Lega Pro).png' },
]

const REVIEWS = [
    { name: 'Francesco G.', text: '"All\'inizio ero un po\' scettico, ma mi sono ricreduto vedendo i miglioramenti di mio figlio. Reagisce benissimo alle delusioni e questo ha rilassato tutta la famiglia."' },
    { name: 'Antonietta G.', text: '"Ero scettica, ma dovevo fare qualcosa per mio figlio. Ora è un ragazzo pronto ad affrontare la vita a testa alta. Grazie Metodo Sincro!"' },
    { name: 'Simona R.', text: '"Ha acquisito maggiore consapevolezza delle sue potenzialità. Oggi si sente più sicuro, mentre prima taceva per paura di sbagliare."' },
]

export default function MetodoSincroLanding({ funnel }: Props) {
    const [step, setStep] = useState(1)
    const [name, setName] = useState('')
    const [phone, setPhone] = useState('')
    const [email, setEmail] = useState('')
    const [childAge, setChildAge] = useState('')
    const [problem, setProblem] = useState('')
    const [loading, setLoading] = useState(false)
    const [submitted, setSubmitted] = useState(false)
    const [error, setError] = useState('')
    const [viewerCount, setViewerCount] = useState(14)

    // Dynamic viewer count between 14 and 35
    useEffect(() => {
        const updateCount = () => {
            setViewerCount(prev => {
                const delta = Math.random() > 0.5 ? Math.floor(Math.random() * 4) + 1 : -(Math.floor(Math.random() * 3) + 1)
                const next = prev + delta
                return Math.max(14, Math.min(35, next))
            })
        }
        const interval = setInterval(updateCount, (Math.random() * 7000) + 8000)
        return () => clearInterval(interval)
    }, [])

    const [utmParams, setUtmParams] = useState<any>({})
    useEffect(() => {
        const params = new URLSearchParams(window.location.search)
        setUtmParams({
            utm_source: params.get('utm_source') || undefined,
            utm_medium: params.get('utm_medium') || undefined,
            utm_campaign: params.get('utm_campaign') || undefined,
            utm_content: params.get('utm_content') || undefined,
            utm_term: params.get('utm_term') || undefined,
        })
    }, [])

    const getFbIds = () => {
        const cookies = document.cookie.split(';').reduce((acc: any, c) => {
            const [k, v] = c.trim().split('=')
            acc[k] = v
            return acc
        }, {})
        return { fbc: cookies._fbc || undefined, fbp: cookies._fbp || undefined }
    }

    const handleSubmit = async () => {
        if (!name || !phone) return
        setLoading(true)
        setError('')

        try {
            const res = await fetch('/api/submit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    funnel_id: funnel.id,
                    name, email, phone,
                    extra_data: {
                        child_age: childAge,
                        main_problem: problem,
                        sport: 'calcio',
                    },
                    ...utmParams,
                    ...getFbIds(),
                }),
            })

            if (!res.ok) {
                const data = await res.json()
                throw new Error(data.error || 'Errore')
            }

            setSubmitted(true)
            window.scrollTo({ top: 0, behavior: 'smooth' })
        } catch (err: any) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    /* ======================== THANK YOU ======================== */
    if (submitted) {
        return (
            <div className="ms-page">
                <div className="ms-thankyou">
                    <div className="ms-thankyou-icon">
                        <CheckCircle size={48} color="#22c55e" />
                    </div>
                    <h1>Perfetto! ⚽</h1>
                    <p>La tua richiesta è stata inviata con successo.</p>
                    <div className="ms-thankyou-box">
                        <Phone size={20} color="#facc15" />
                        <div>
                            <strong>Un nostro esperto ti contatterà</strong>
                            <span>entro 24 ore al numero {phone}</span>
                        </div>
                    </div>
                    <div className="ms-thankyou-bonus">
                        <Gift size={20} color="#facc15" />
                        <div>
                            <strong>In più, avrai accesso esclusivo ad Anthon Chat®</strong>
                            <span>Il nostro assistente AI per il mental coaching — incluso per 3 giorni</span>
                        </div>
                    </div>
                    <p className="ms-thankyou-sub">
                        Preparati a scoprire come sbloccare il vero potenziale di tuo figlio.
                    </p>
                </div>

                <style>{STYLES}</style>
            </div>
        )
    }

    /* ======================== MAIN PAGE ======================== */
    return (
        <div className="ms-page">
            {/* Header */}
            <header className="ms-header">
                <div className="ms-header-inner">
                    <div className="ms-logo"><img src="/images/team/Progetto senza titolo-2.png" alt="Metodo Sincro" className="ms-logo-img" /></div>
                    <div className="ms-header-right">
                        <div className="ms-trustpilot">
                            <div className="ms-stars">
                                {[1,2,3,4,5].map(i => <Star key={i} size={14} fill="#facc15" color="#facc15" />)}
                            </div>
                            <span>4.9 su TrustPilot (356)</span>
                        </div>
                    </div>
                </div>
            </header>

            {/* Hero */}
            <section className="ms-hero">
                <div className="ms-hero-bg" />
                <div className="ms-hero-content">
                    <div className="ms-badge">
                        <Trophy size={14} />
                        Leader nel Mental Coaching Calcistico in Italia
                    </div>
                    <h1>
                        Tuo figlio ha <span className="ms-yellow">talento.</span><br />
                        Ma il talento da solo<br />
                        <span className="ms-yellow">non basta.</span>
                    </h1>
                    <p className="ms-hero-subtitle">Dagli accesso al segreto nascosto dei campioni professionisti</p>
                    <p>
                        L'87% degli atleti talentuosi non emerge per mancanza di preparazione mentale.
                        Il <strong>MENTAL COACHING</strong> è ciò che fa la differenza tra chi resta in panchina e chi diventa protagonista.
                    </p>
                    <button className="ms-cta-hero" onClick={() => {
                        document.getElementById('ms-form')?.scrollIntoView({ behavior: 'smooth' })
                    }}>
                        Richiedi una Consulenza Gratuita
                        <ArrowRight size={20} />
                    </button>
                    <div className="ms-cta-bonus">
                        <Sparkles size={16} />
                        <span>Include anche accesso esclusivo ad <strong>Anthon Chat®</strong>, il nostro assistente AI</span>
                    </div>
                </div>
            </section>

            {/* Social Proof - Players */}
            <section className="ms-social">
                <div className="ms-social-inner">
                    <h2>Hanno scelto il <span className="ms-yellow">Metodo Sincro</span></h2>
                    <p className="ms-social-sub">Calciatori professionisti e migliaia di giovani atleti in tutta Italia</p>
                    <div className="ms-players">
                        {FAMOUS_PLAYERS.map(p => (
                            <div key={p.name} className="ms-player-card">
                                <div className="ms-player-avatar">
                                    <img
                                        src={p.img}
                                        alt={p.name}
                                        onError={(e) => {
                                            // Fallback to initials if image fails
                                            const el = e.target as HTMLImageElement
                                            el.style.display = 'none'
                                            const parent = el.parentElement
                                            if (parent) {
                                                parent.innerHTML = `<span class="ms-player-initials">${p.name.split(' ').map(n => n[0]).join('')}</span>`
                                            }
                                        }}
                                    />
                                </div>
                                <strong>{p.name}</strong>
                                <span>{p.team}</span>
                            </div>
                        ))}
                    </div>
                    <p className="ms-molti-altri">...e molti altri</p>
                    <div className="ms-stats-row">
                        <div className="ms-stat">
                            <strong>2.100+</strong>
                            <span>Atleti seguiti</span>
                        </div>
                        <div className="ms-stat">
                            <strong>11.500+</strong>
                            <span>Ore di coaching</span>
                        </div>
                        <div className="ms-stat">
                            <strong>356</strong>
                            <span>Recensioni TrustPilot</span>
                        </div>
                        <div className="ms-stat">
                            <strong>30+</strong>
                            <span>Professionisti</span>
                        </div>
                    </div>
                </div>
            </section>

            {/* Chi Siamo */}
            <section className="ms-chi-siamo">
                <div className="ms-chi-inner">
                    <div className="ms-chi-photo">
                        <img
                            src="/images/team/Antonio Valente.png"
                            alt="Antonio Valente - Fondatore Metodo Sincro"
                            onError={(e) => {
                                const el = e.target as HTMLImageElement
                                el.style.display = 'none'
                            }}
                        />
                    </div>
                    <div className="ms-chi-text">
                        <h2>Chi è <span className="ms-yellow">Antonio Valente</span></h2>
                        <p>
                            Fondatore del Metodo Sincro® e Presidente del Sincro Group SRL.
                            Mental Coach specializzato nel calcio giovanile, ha aiutato calciatori
                            di Serie A a sbloccare il proprio potenziale mentale.
                        </p>
                        <div className="ms-chi-badges">
                            <div className="ms-chi-badge">
                                <strong>2.100+</strong>
                                <span>Atleti seguiti</span>
                            </div>
                            <div className="ms-chi-badge">
                                <strong>11.500+</strong>
                                <span>Ore di coaching</span>
                            </div>
                            <div className="ms-chi-badge">
                                <strong>30+</strong>
                                <span>Professionisti nel team</span>
                            </div>
                        </div>
                        <div className="ms-chi-media">
                            <span>Citato su:</span>
                            <div className="ms-media-logos">
                                <span>La Repubblica</span>
                                <span>•</span>
                                <span>Gazzetta dello Sport</span>
                                <span>•</span>
                                <span>Sport Mediaset</span>
                                <span>•</span>
                                <span>Millionaire</span>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Problems */}
            <section className="ms-problems">
                <div className="ms-problems-inner">
                    <h2>Tuo figlio vive una di <span className="ms-yellow">queste situazioni?</span></h2>
                    <div className="ms-problems-grid">
                        {[
                            { icon: '😰', title: 'Ansia da prestazione', desc: 'Si blocca prima delle partite importanti o non rende come in allenamento' },
                            { icon: '👀', title: 'Paura del giudizio', desc: 'Ha paura di sbagliare davanti al mister, ai compagni o ai genitori' },
                            { icon: '💔', title: 'Poca fiducia in sé', desc: 'Non si sente all\'altezza, anche quando ha le capacità tecniche' },
                            { icon: '🪑', title: 'Troppa panchina', desc: 'Ha il talento ma non riesce a dimostrarlo quando conta' },
                            { icon: '😤', title: 'Pressione eccessiva', desc: 'Sente il peso delle aspettative e non riesce a gestirlo' },
                            { icon: '🏥', title: 'Paura post-infortunio', desc: 'È guarito fisicamente ma ha ancora paura di tornare in campo' },
                        ].map(p => (
                            <div key={p.title} className="ms-problem-card">
                                <span className="ms-problem-icon">{p.icon}</span>
                                <h3>{p.title}</h3>
                                <p>{p.desc}</p>
                            </div>
                        ))}
                    </div>
                    <p className="ms-problems-cta">
                        Se hai riconosciuto tuo figlio in almeno una di queste situazioni, <strong>il Mental Coaching può aiutarlo.</strong>
                    </p>
                </div>
            </section>

            {/* Come funziona */}
            <section className="ms-come-funziona">
                <div className="ms-come-inner">
                    <h2>Come funziona il <span className="ms-yellow">Metodo Sincro?</span></h2>
                    <div className="ms-come-steps">
                        <div className="ms-come-step">
                            <div className="ms-come-num">1</div>
                            <h3>Consulenza Gratuita</h3>
                            <p>Parli con un nostro esperto per capire la situazione di tuo figlio</p>
                        </div>
                        <div className="ms-come-arrow">→</div>
                        <div className="ms-come-step">
                            <div className="ms-come-num">2</div>
                            <h3>Percorso Personalizzato</h3>
                            <p>Creiamo un piano <strong>UNO a UNO</strong> su misura per le sue esigenze</p>
                        </div>
                        <div className="ms-come-arrow">→</div>
                        <div className="ms-come-step">
                            <div className="ms-come-num">3</div>
                            <h3>Sessioni Online</h3>
                            <p>Coaching individuale con un professionista dedicato, da casa</p>
                        </div>
                    </div>
                    <div className="ms-come-highlight">
                        <Shield size={18} />
                        <span><strong>Non è un videocorso.</strong> Ogni sessione è individuale, live, con un coach dedicato esclusivamente a tuo figlio.</span>
                    </div>
                </div>
            </section>

            {/* Reviews */}
            <section className="ms-reviews">
                <div className="ms-reviews-inner">
                    <h2>Cosa dicono i <span className="ms-yellow">genitori</span></h2>
                    <p className="ms-reviews-sub">356 recensioni certificate su TrustPilot — 98% a 5 stelle</p>
                    <div className="ms-reviews-grid">
                        {REVIEWS.map((r, i) => (
                            <div key={i} className="ms-review-card">
                                <div className="ms-review-stars">
                                    {[1,2,3,4,5].map(s => <Star key={s} size={14} fill="#facc15" color="#facc15" />)}
                                </div>
                                <p>{r.text}</p>
                                <strong>— {r.name}</strong>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Form Section */}
            <section className="ms-form-section" id="ms-form">
                <div className="ms-form-inner">
                    <h2>Richiedi una <span className="ms-yellow">Consulenza Gratuita</span></h2>
                    <p>Un nostro esperto ti contatterà per capire come possiamo aiutare tuo figlio.</p>
                    <div className="ms-form-trust-row">
                        <div className="ms-form-trust">
                            <div className="ms-stars">{[1,2,3,4,5].map(i => <Star key={i} size={12} fill="#facc15" color="#facc15" />)}</div>
                            <span>4.9 su TrustPilot</span>
                        </div>
                        <div className="ms-form-trust">
                            <Clock size={14} />
                            <span>Compila in 30 secondi</span>
                        </div>
                    </div>

                    <div className="ms-form-card">
                        {/* Step indicator */}
                        <div className="ms-steps">
                            <div className={`ms-step ${step >= 1 ? 'active' : ''}`}>
                                <div className="ms-step-num">1</div>
                                <span>I tuoi dati</span>
                            </div>
                            <div className="ms-step-line" />
                            <div className={`ms-step ${step >= 2 ? 'active' : ''}`}>
                                <div className="ms-step-num">2</div>
                                <span>Info su tuo figlio</span>
                            </div>
                        </div>

                        {step === 1 && (
                            <div className="ms-form-step" style={{ animation: 'msSlideIn 0.3s ease-out' }}>
                                <div className="ms-field">
                                    <label>Nome e Cognome *</label>
                                    <div className="ms-input-wrap">
                                        <User size={18} />
                                        <input
                                            type="text"
                                            placeholder="Es. Marco Rossi"
                                            value={name}
                                            onChange={e => setName(e.target.value)}
                                            required
                                        />
                                    </div>
                                </div>
                                <div className="ms-field">
                                    <label>Telefono *</label>
                                    <div className="ms-input-wrap">
                                        <Phone size={18} />
                                        <input
                                            type="tel"
                                            placeholder="+39 xxx xxx xxxx"
                                            value={phone}
                                            onChange={e => setPhone(e.target.value)}
                                            required
                                        />
                                    </div>
                                </div>
                                <div className="ms-field">
                                    <label>Email</label>
                                    <div className="ms-input-wrap">
                                        <Mail size={18} />
                                        <input
                                            type="email"
                                            placeholder="la-tua@email.com"
                                            value={email}
                                            onChange={e => setEmail(e.target.value)}
                                        />
                                    </div>
                                </div>
                                <button
                                    className="ms-btn-next"
                                    disabled={!name || !phone}
                                    onClick={() => setStep(2)}
                                >
                                    Continua
                                    <ChevronRight size={20} />
                                </button>
                            </div>
                        )}

                        {step === 2 && (
                            <div className="ms-form-step" style={{ animation: 'msSlideIn 0.3s ease-out' }}>
                                <div className="ms-field">
                                    <label>Età di tuo figlio</label>
                                    <div className="ms-select-wrap">
                                        <select value={childAge} onChange={e => setChildAge(e.target.value)}>
                                            <option value="">Seleziona...</option>
                                            {AGE_RANGES.map(a => (
                                                <option key={a.value} value={a.value}>{a.label}</option>
                                            ))}
                                        </select>
                                        <ChevronDown size={18} />
                                    </div>
                                </div>
                                <div className="ms-field">
                                    <label>Qual è il problema principale?</label>
                                    <div className="ms-problems-select">
                                        {PROBLEMS.map(p => (
                                            <button
                                                key={p.value}
                                                className={`ms-problem-btn ${problem === p.value ? 'selected' : ''}`}
                                                onClick={() => setProblem(p.value)}
                                                type="button"
                                            >
                                                <span>{p.icon}</span>
                                                {p.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {error && (
                                    <div className="ms-error">{error}</div>
                                )}

                                <div className="ms-form-actions">
                                    <button className="ms-btn-back" onClick={() => setStep(1)}>
                                        ← Indietro
                                    </button>
                                    <button
                                        className="ms-btn-submit"
                                        disabled={loading}
                                        onClick={handleSubmit}
                                    >
                                        {loading ? (
                                            <div className="ms-spinner" />
                                        ) : (
                                            <>
                                                Invia Richiesta
                                                <ArrowRight size={20} />
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Incentive under CTA */}
                        <div className="ms-form-incentive">
                            <div className="ms-incentive-pulse" />
                            <Sparkles size={16} color="#facc15" />
                            <span>Chi completa la consulenza riceve anche accesso ad <strong>Anthon Chat®</strong>, il nostro assistente AI per il mental coaching</span>
                        </div>

                        <p className="ms-privacy">
                            🔒 I tuoi dati sono al sicuro. Li utilizzeremo solo per contattarti.
                        </p>

                        <div className="ms-form-urgency-bottom">
                            <span className="ms-urgency-dot" />
                            <span>Posti limitati — <strong>{viewerCount}</strong> genitori stanno guardando ora</span>
                        </div>
                    </div>
                </div>
            </section>

            {/* Garanzia */}
            <div className="ms-garanzia-banner">
                <Shield size={18} />
                <span>Gli unici nel settore con <strong>Garanzia scritta sul Contratto</strong></span>
            </div>

            {/* Footer banner */}
            <div className="ms-footer-banner">
                <p>⚽ Metodo Sincro® — Percorsi di Mental Coaching <strong>UNO a UNO</strong>, interamente <strong>ONLINE</strong>, con coach specializzati e dedicati per fascia d'età.</p>
            </div>

            {/* Meta Pixel */}
            {funnel.meta_pixel_id && (
                <script
                    dangerouslySetInnerHTML={{
                        __html: `!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${funnel.meta_pixel_id}');fbq('track','PageView');`,
                    }}
                />
            )}

            <style>{STYLES}</style>
        </div>
    )
}

const STYLES = `
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');

    * { box-sizing: border-box; margin: 0; padding: 0; }

    .ms-page {
        min-height: 100vh;
        background: #0a0a0a;
        color: #fff;
        font-family: 'Inter', -apple-system, sans-serif;
        -webkit-font-smoothing: antialiased;
        overflow-x: hidden;
    }

    .ms-yellow { color: #facc15; }

    /* Header */
    .ms-header {
        position: sticky;
        top: 0;
        z-index: 50;
        background: rgba(10, 10, 10, 0.92);
        backdrop-filter: blur(20px);
        border-bottom: 1px solid rgba(250, 204, 21, 0.15);
    }
    .ms-header-inner {
        max-width: 1100px;
        margin: 0 auto;
        padding: 14px 20px;
        display: flex;
        justify-content: space-between;
        align-items: center;
    }
    .ms-logo {
        font-size: 16px;
        font-weight: 900;
        letter-spacing: 2px;
        color: #fff;
    }
    .ms-logo-img {
        height: 32px;
        width: auto;
        object-fit: contain;
    }
    .ms-logo sup { color: #facc15; font-size: 10px; }
    .ms-trustpilot {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 12px;
        color: #a1a1aa;
    }
    .ms-stars { display: flex; gap: 1px; }

    /* Hero */
    .ms-hero {
        position: relative;
        overflow: hidden;
        padding: 60px 20px 50px;
        text-align: center;
    }
    .ms-hero-bg {
        position: absolute;
        inset: 0;
        background:
            radial-gradient(ellipse at center top, rgba(250, 204, 21, 0.08) 0%, transparent 60%),
            radial-gradient(ellipse at center bottom, rgba(34, 197, 94, 0.04) 0%, transparent 50%);
    }
    .ms-hero-content {
        position: relative;
        max-width: 700px;
        margin: 0 auto;
    }
    .ms-badge {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 6px 14px;
        border-radius: 100px;
        font-size: 11px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        color: #facc15;
        background: rgba(250, 204, 21, 0.1);
        border: 1px solid rgba(250, 204, 21, 0.2);
        margin-bottom: 12px;
    }
    .ms-garanzia-badge {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 6px 14px;
        border-radius: 100px;
        font-size: 11px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        color: #22c55e;
        background: rgba(34, 197, 94, 0.1);
        border: 1px solid rgba(34, 197, 94, 0.2);
        margin-bottom: 28px;
    }
    .ms-hero h1 {
        font-size: clamp(28px, 6vw, 50px);
        font-weight: 900;
        line-height: 1.15;
        margin-bottom: 20px;
        letter-spacing: -1px;
    }
    .ms-hero-subtitle {
        font-size: 16px;
        font-weight: 500;
        color: #facc15;
        letter-spacing: 1px;
        text-transform: uppercase;
        opacity: 0.8;
        margin-bottom: 20px;
    }
    .ms-hero p {
        font-size: 16px;
        line-height: 1.7;
        color: #a1a1aa;
        max-width: 560px;
        margin: 0 auto 28px;
    }
    .ms-hero p strong { color: #facc15; }
    .ms-cta-hero {
        display: inline-flex;
        align-items: center;
        gap: 10px;
        padding: 16px 32px;
        border: none;
        border-radius: 14px;
        font-size: 16px;
        font-weight: 800;
        color: #0a0a0a;
        background: linear-gradient(135deg, #facc15, #eab308);
        cursor: pointer;
        transition: all 0.3s;
        box-shadow: 0 0 40px rgba(250, 204, 21, 0.25);
        font-family: inherit;
    }
    .ms-cta-hero:hover {
        transform: translateY(-2px);
        box-shadow: 0 0 60px rgba(250, 204, 21, 0.35);
    }
    .ms-cta-bonus {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        margin-top: 16px;
        padding: 8px 18px;
        border-radius: 100px;
        font-size: 13px;
        color: #a1a1aa;
        background: rgba(250, 204, 21, 0.05);
        border: 1px solid rgba(250, 204, 21, 0.1);
        animation: msPulseGlow 3s ease-in-out infinite;
    }
    .ms-cta-bonus strong { color: #facc15; }

    /* Social Proof */
    .ms-social {
        padding: 50px 20px;
        background: rgba(250, 204, 21, 0.02);
        border-top: 1px solid rgba(250, 204, 21, 0.08);
        border-bottom: 1px solid rgba(250, 204, 21, 0.08);
    }
    .ms-social-inner {
        max-width: 1000px;
        margin: 0 auto;
        text-align: center;
    }
    .ms-social h2 {
        font-size: 26px;
        font-weight: 800;
        margin-bottom: 6px;
    }
    .ms-social-sub {
        color: #71717a;
        font-size: 14px;
        margin-bottom: 32px;
    }
    .ms-players {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
        gap: 12px;
        margin-bottom: 32px;
    }
    .ms-player-card {
        background: rgba(255, 255, 255, 0.03);
        border: 1px solid rgba(255, 255, 255, 0.06);
        border-radius: 14px;
        padding: 16px 10px;
        text-align: center;
        transition: all 0.3s;
    }
    .ms-player-card:hover {
        border-color: rgba(250, 204, 21, 0.2);
        background: rgba(250, 204, 21, 0.03);
        transform: translateY(-2px);
    }
    .ms-player-avatar {
        width: 64px;
        height: 64px;
        border-radius: 50%;
        background: rgba(250, 204, 21, 0.08);
        border: 2px solid rgba(250, 204, 21, 0.15);
        display: flex;
        align-items: center;
        justify-content: center;
        margin: 0 auto 10px;
        overflow: hidden;
    }
    .ms-player-avatar img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        border-radius: 50%;
    }
    .ms-player-initials {
        font-size: 20px;
        font-weight: 800;
        color: #facc15;
    }
    .ms-player-card strong {
        display: block;
        font-size: 14px;
        margin-bottom: 3px;
        color: #fff;
    }
    .ms-player-card span {
        font-size: 12px;
        color: #a1a1aa;
    }
    .ms-molti-altri {
        text-align: center;
        font-size: 17px;
        font-weight: 600;
        color: #a1a1aa;
        margin: 20px 0 12px;
        letter-spacing: 1px;
    }
    .ms-stats-row {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 12px;
    }
    .ms-stat {
        padding: 16px;
        border-radius: 12px;
        background: rgba(255, 255, 255, 0.02);
        border: 1px solid rgba(255, 255, 255, 0.05);
    }
    .ms-stat strong {
        display: block;
        font-size: 24px;
        font-weight: 900;
        color: #facc15;
        margin-bottom: 2px;
    }
    .ms-stat span { font-size: 11px; color: #71717a; }
    .ms-trustpilot span { font-size: 12px; color: #a1a1aa; }
    .ms-header-right {
        display: flex;
        align-items: center;
        gap: 16px;
    }
    .ms-garanzia-header {
        display: flex;
        align-items: center;
        gap: 5px;
        font-size: 11px;
        font-weight: 700;
        color: #22c55e;
        text-transform: uppercase;
        letter-spacing: 0.3px;
        padding: 4px 10px;
        border-radius: 6px;
        background: rgba(34, 197, 94, 0.08);
        border: 1px solid rgba(34, 197, 94, 0.15);
    }

    /* Chi Siamo */
    .ms-chi-siamo {
        padding: 60px 20px;
    }
    .ms-chi-inner {
        max-width: 900px;
        margin: 0 auto;
        display: grid;
        grid-template-columns: 280px 1fr;
        gap: 40px;
        align-items: center;
    }
    .ms-chi-photo {
        width: 280px;
        height: 340px;
        border-radius: 20px;
        overflow: hidden;
        border: 2px solid rgba(250, 204, 21, 0.15);
        box-shadow: 0 0 60px rgba(250, 204, 21, 0.08);
    }
    .ms-chi-photo img {
        width: 100%;
        height: 100%;
        object-fit: cover;
    }
    .ms-chi-text h2 {
        font-size: 28px;
        font-weight: 800;
        margin-bottom: 16px;
    }
    .ms-chi-text > p {
        font-size: 15px;
        line-height: 1.7;
        color: #a1a1aa;
        margin-bottom: 24px;
    }
    .ms-chi-badges {
        display: flex;
        gap: 16px;
        margin-bottom: 20px;
    }
    .ms-chi-badge {
        padding: 12px 16px;
        border-radius: 12px;
        background: rgba(250, 204, 21, 0.05);
        border: 1px solid rgba(250, 204, 21, 0.1);
        text-align: center;
        flex: 1;
    }
    .ms-chi-badge strong {
        display: block;
        font-size: 20px;
        font-weight: 900;
        color: #facc15;
    }
    .ms-chi-badge span { font-size: 11px; color: #71717a; }
    .ms-chi-media {
        font-size: 12px;
        color: #52525b;
    }
    .ms-chi-media > span { font-weight: 600; margin-right: 8px; }
    .ms-media-logos {
        display: inline-flex;
        gap: 8px;
        color: #71717a;
        font-weight: 500;
        flex-wrap: wrap;
    }

    /* Problems */
    .ms-problems {
        padding: 60px 20px;
        background: rgba(239, 68, 68, 0.02);
        border-top: 1px solid rgba(255, 255, 255, 0.04);
    }
    .ms-problems-inner {
        max-width: 900px;
        margin: 0 auto;
        text-align: center;
    }
    .ms-problems h2 {
        font-size: 26px;
        font-weight: 800;
        margin-bottom: 36px;
    }
    .ms-problems-grid {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 14px;
        margin-bottom: 28px;
        text-align: left;
    }
    .ms-problem-card {
        padding: 20px;
        border-radius: 14px;
        background: rgba(255, 255, 255, 0.02);
        border: 1px solid rgba(255, 255, 255, 0.06);
        transition: all 0.3s;
    }
    .ms-problem-card:hover {
        border-color: rgba(239, 68, 68, 0.3);
        background: rgba(239, 68, 68, 0.03);
    }
    .ms-problem-icon { font-size: 26px; display: block; margin-bottom: 10px; }
    .ms-problem-card h3 { font-size: 15px; font-weight: 700; margin-bottom: 5px; }
    .ms-problem-card p { font-size: 13px; color: #71717a; line-height: 1.5; }
    .ms-problems-cta {
        font-size: 16px;
        color: #a1a1aa;
        max-width: 550px;
        margin: 0 auto;
    }
    .ms-problems-cta strong { color: #facc15; }

    /* Come funziona */
    .ms-come-funziona {
        padding: 60px 20px;
    }
    .ms-come-inner {
        max-width: 900px;
        margin: 0 auto;
        text-align: center;
    }
    .ms-come-inner h2 {
        font-size: 26px;
        font-weight: 800;
        margin-bottom: 36px;
    }
    .ms-come-steps {
        display: flex;
        align-items: flex-start;
        justify-content: center;
        gap: 0;
        margin-bottom: 28px;
    }
    .ms-come-step {
        flex: 1;
        max-width: 240px;
        padding: 0 16px;
    }
    .ms-come-num {
        width: 44px;
        height: 44px;
        border-radius: 50%;
        background: linear-gradient(135deg, #facc15, #eab308);
        color: #0a0a0a;
        font-size: 18px;
        font-weight: 900;
        display: flex;
        align-items: center;
        justify-content: center;
        margin: 0 auto 14px;
    }
    .ms-come-step h3 { font-size: 16px; font-weight: 700; margin-bottom: 6px; }
    .ms-come-step p { font-size: 13px; color: #71717a; line-height: 1.5; }
    .ms-come-step p strong { color: #facc15; }
    .ms-come-arrow {
        font-size: 24px;
        color: #3f3f46;
        margin-top: 8px;
        flex-shrink: 0;
    }
    .ms-come-highlight {
        display: inline-flex;
        align-items: center;
        gap: 10px;
        padding: 14px 24px;
        border-radius: 12px;
        background: rgba(250, 204, 21, 0.06);
        border: 1px solid rgba(250, 204, 21, 0.12);
        font-size: 14px;
        color: #a1a1aa;
    }
    .ms-come-highlight strong { color: #fff; }

    /* Reviews */
    .ms-reviews {
        padding: 60px 20px;
        background: rgba(250, 204, 21, 0.02);
        border-top: 1px solid rgba(250, 204, 21, 0.06);
    }
    .ms-reviews-inner {
        max-width: 1000px;
        margin: 0 auto;
        text-align: center;
    }
    .ms-reviews-inner h2 { font-size: 26px; font-weight: 800; margin-bottom: 6px; }
    .ms-reviews-sub { color: #71717a; font-size: 14px; margin-bottom: 28px; }
    .ms-reviews-grid {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 16px;
        text-align: left;
    }
    .ms-review-card {
        padding: 24px;
        border-radius: 16px;
        background: rgba(255, 255, 255, 0.03);
        border: 1px solid rgba(255, 255, 255, 0.06);
        transition: all 0.3s;
    }
    .ms-review-card:hover { border-color: rgba(250, 204, 21, 0.15); }
    .ms-review-stars { display: flex; gap: 2px; margin-bottom: 12px; }
    .ms-review-card p {
        font-size: 14px;
        color: #a1a1aa;
        line-height: 1.6;
        font-style: italic;
        margin-bottom: 12px;
    }
    .ms-review-card strong {
        font-size: 13px;
        color: #facc15;
    }

    /* Form */
    .ms-form-section {
        padding: 70px 20px;
        background:
            radial-gradient(ellipse at center, rgba(250, 204, 21, 0.08) 0%, transparent 50%),
            radial-gradient(ellipse at center bottom, rgba(250, 204, 21, 0.04) 0%, transparent 40%);
    }
    .ms-form-inner {
        max-width: 540px;
        margin: 0 auto;
        text-align: center;
    }
    .ms-form-urgency {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 6px 16px;
        border-radius: 100px;
        background: rgba(239, 68, 68, 0.1);
        border: 1px solid rgba(239, 68, 68, 0.2);
        font-size: 13px;
        font-weight: 600;
        color: #ef4444;
        margin-bottom: 16px;
    }
    .ms-form-urgency strong {
        font-size: 16px;
        color: #fff;
        background: #ef4444;
        padding: 1px 8px;
        border-radius: 6px;
        margin: 0 2px;
    }
    .ms-urgency-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: #ef4444;
        animation: msPulseDot 1.5s ease-in-out infinite;
    }
    .ms-form-inner h2 {
        font-size: 28px;
        font-weight: 800;
        margin-bottom: 8px;
    }
    .ms-form-inner > p {
        color: #a1a1aa;
        font-size: 15px;
        margin-bottom: 12px;
    }
    .ms-form-trust-row {
        display: flex;
        justify-content: center;
        gap: 20px;
        margin-bottom: 24px;
    }
    .ms-form-trust {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 12px;
        color: #71717a;
    }
    .ms-form-card {
        background: linear-gradient(180deg, rgba(25, 25, 30, 0.95) 0%, rgba(18, 18, 22, 0.98) 100%);
        backdrop-filter: blur(20px);
        border: 1.5px solid rgba(250, 204, 21, 0.25);
        border-radius: 20px;
        padding: 32px;
        box-shadow:
            0 0 60px rgba(250, 204, 21, 0.1),
            0 0 120px rgba(250, 204, 21, 0.05),
            inset 0 1px 0 rgba(255, 255, 255, 0.05);
        position: relative;
    }
    .ms-form-card::before {
        content: '';
        position: absolute;
        inset: -1px;
        border-radius: 21px;
        background: linear-gradient(180deg, rgba(250, 204, 21, 0.15), transparent 50%);
        z-index: -1;
        mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
        mask-composite: exclude;
        -webkit-mask-composite: xor;
        padding: 1.5px;
    }

    /* Steps */
    .ms-steps {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 0;
        margin-bottom: 24px;
    }
    .ms-step {
        display: flex;
        align-items: center;
        gap: 6px;
        opacity: 0.4;
        transition: all 0.3s;
    }
    .ms-step.active { opacity: 1; }
    .ms-step-num {
        width: 28px;
        height: 28px;
        border-radius: 50%;
        background: rgba(250, 204, 21, 0.1);
        color: #facc15;
        font-size: 13px;
        font-weight: 700;
        display: flex;
        align-items: center;
        justify-content: center;
    }
    .ms-step.active .ms-step-num {
        background: #facc15;
        color: #0a0a0a;
    }
    .ms-step span { font-size: 12px; font-weight: 600; }
    .ms-step-line {
        width: 36px;
        height: 2px;
        background: rgba(250, 204, 21, 0.15);
        margin: 0 10px;
    }

    /* Fields */
    .ms-form-step { text-align: left; }
    .ms-field { margin-bottom: 16px; }
    .ms-field label {
        display: block;
        font-size: 12px;
        font-weight: 600;
        color: #a1a1aa;
        margin-bottom: 5px;
    }
    .ms-input-wrap {
        display: flex;
        align-items: center;
        gap: 10px;
        background: #18181b;
        border: 1px solid #27272a;
        border-radius: 12px;
        padding: 0 14px;
        transition: all 0.2s;
        color: #52525b;
    }
    .ms-input-wrap:focus-within {
        border-color: #facc15;
        box-shadow: 0 0 0 3px rgba(250, 204, 21, 0.1);
    }
    .ms-input-wrap input {
        flex: 1;
        background: none;
        border: none;
        outline: none;
        color: #fff;
        font-size: 15px;
        padding: 13px 0;
        font-family: inherit;
    }
    .ms-input-wrap input::placeholder { color: #52525b; }
    .ms-input-wrap input:-webkit-autofill,
    .ms-input-wrap input:-webkit-autofill:hover,
    .ms-input-wrap input:-webkit-autofill:focus {
        -webkit-box-shadow: 0 0 0 1000px #18181b inset !important;
        -webkit-text-fill-color: #fff !important;
        transition: background-color 5000s ease-in-out 0s;
        caret-color: #fff;
    }
    .ms-select-wrap { position: relative; }
    .ms-select-wrap select {
        width: 100%;
        background: #18181b;
        border: 1px solid #27272a;
        border-radius: 12px;
        padding: 13px 14px;
        color: #fff;
        font-size: 15px;
        font-family: inherit;
        outline: none;
        appearance: none;
        cursor: pointer;
        transition: all 0.2s;
    }
    .ms-select-wrap select:focus {
        border-color: #facc15;
        box-shadow: 0 0 0 3px rgba(250, 204, 21, 0.1);
    }
    .ms-select-wrap svg {
        position: absolute;
        right: 14px;
        top: 50%;
        transform: translateY(-50%);
        color: #52525b;
        pointer-events: none;
    }

    /* Problem buttons */
    .ms-problems-select {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 8px;
    }
    .ms-problem-btn {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 11px 12px;
        border: 1px solid #27272a;
        border-radius: 10px;
        background: #18181b;
        color: #a1a1aa;
        font-size: 12px;
        font-family: inherit;
        cursor: pointer;
        text-align: left;
        transition: all 0.2s;
    }
    .ms-problem-btn:hover {
        border-color: rgba(250, 204, 21, 0.3);
        color: #fff;
    }
    .ms-problem-btn.selected {
        border-color: #facc15;
        background: rgba(250, 204, 21, 0.08);
        color: #facc15;
    }

    /* Buttons */
    .ms-btn-next, .ms-btn-submit {
        width: 100%;
        padding: 18px;
        border: none;
        border-radius: 14px;
        font-size: 17px;
        font-weight: 800;
        font-family: inherit;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        transition: all 0.3s;
        color: #0a0a0a;
        background: linear-gradient(135deg, #facc15, #eab308);
        box-shadow: 0 0 40px rgba(250, 204, 21, 0.25);
        margin-top: 12px;
        animation: msCtaPulse 2.5s ease-in-out infinite;
    }
    .ms-btn-next:hover:not(:disabled), .ms-btn-submit:hover:not(:disabled) {
        transform: translateY(-2px) scale(1.02);
        box-shadow: 0 0 60px rgba(250, 204, 21, 0.4);
        animation: none;
    }
    .ms-btn-next:disabled, .ms-btn-submit:disabled {
        opacity: 0.5;
        cursor: not-allowed;
        animation: none;
    }
    .ms-btn-back {
        background: none;
        border: 1px solid #27272a;
        border-radius: 12px;
        color: #71717a;
        font-size: 14px;
        font-family: inherit;
        padding: 12px 18px;
        cursor: pointer;
        transition: all 0.2s;
    }
    .ms-btn-back:hover { border-color: #52525b; color: #a1a1aa; }
    .ms-form-actions {
        display: flex;
        gap: 10px;
        margin-top: 8px;
    }
    .ms-form-actions .ms-btn-submit { flex: 1; }

    .ms-form-incentive {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-top: 16px;
        padding: 12px 16px;
        border-radius: 12px;
        background: rgba(250, 204, 21, 0.04);
        border: 1px solid rgba(250, 204, 21, 0.1);
        font-size: 12px;
        color: #a1a1aa;
        text-align: left;
        position: relative;
        overflow: hidden;
    }
    .ms-form-incentive strong { color: #facc15; }
    .ms-incentive-pulse {
        position: absolute;
        left: 0;
        top: 0;
        bottom: 0;
        width: 3px;
        background: #facc15;
        animation: msPulseBar 2s ease-in-out infinite;
    }

    .ms-error {
        padding: 12px;
        border-radius: 12px;
        background: rgba(239, 68, 68, 0.1);
        border: 1px solid rgba(239, 68, 68, 0.2);
        color: #ef4444;
        font-size: 14px;
        margin-bottom: 8px;
    }
    .ms-privacy {
        text-align: center;
        font-size: 11px;
        color: #3f3f46;
        margin-top: 14px;
    }
    .ms-spinner {
        width: 22px;
        height: 22px;
        border: 3px solid rgba(10, 10, 10, 0.2);
        border-top-color: #0a0a0a;
        border-radius: 50%;
        animation: msSpin 0.7s linear infinite;
    }

    /* Footer Banner */
    .ms-garanzia-banner {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 10px;
        padding: 16px 20px;
        background: rgba(34, 197, 94, 0.06);
        border-top: 1px solid rgba(34, 197, 94, 0.15);
        border-bottom: 1px solid rgba(34, 197, 94, 0.15);
        color: #22c55e;
        font-size: 15px;
        font-weight: 500;
    }
    .ms-garanzia-banner strong { color: #fff; }

    .ms-footer-banner {
        background: rgba(250, 204, 21, 0.04);
        border-top: 1px solid rgba(250, 204, 21, 0.1);
        padding: 18px 20px;
        text-align: center;
    }
    .ms-footer-banner p {
        font-size: 13px;
        font-weight: 500;
        color: #71717a;
        max-width: 700px;
        margin: 0 auto;
        line-height: 1.5;
    }
    .ms-footer-banner strong {
        color: #a1a1aa;
        text-decoration: underline;
        text-underline-offset: 2px;
    }
    .ms-form-urgency-bottom {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        padding: 10px 16px;
        margin-top: 12px;
        border-radius: 10px;
        font-size: 13px;
        color: #a1a1aa;
        background: rgba(255, 255, 255, 0.02);
        border: 1px solid rgba(255, 255, 255, 0.06);
    }
    .ms-form-urgency-bottom strong {
        color: #facc15;
    }

    /* Thank you */
    .ms-thankyou {
        min-height: 90vh;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 40px 20px;
        text-align: center;
    }
    .ms-thankyou-icon {
        width: 80px;
        height: 80px;
        border-radius: 50%;
        background: rgba(34, 197, 94, 0.1);
        border: 2px solid rgba(34, 197, 94, 0.3);
        display: flex;
        align-items: center;
        justify-content: center;
        margin-bottom: 24px;
        animation: msBounce 0.6s ease-out;
    }
    .ms-thankyou h1 {
        font-size: 32px;
        font-weight: 900;
        margin-bottom: 10px;
    }
    .ms-thankyou > p { color: #a1a1aa; font-size: 16px; margin-bottom: 28px; }
    .ms-thankyou-box, .ms-thankyou-bonus {
        display: flex;
        align-items: center;
        gap: 14px;
        padding: 18px 24px;
        border-radius: 14px;
        margin-bottom: 14px;
        text-align: left;
        max-width: 500px;
        width: 100%;
    }
    .ms-thankyou-box {
        background: rgba(250, 204, 21, 0.05);
        border: 1px solid rgba(250, 204, 21, 0.15);
    }
    .ms-thankyou-bonus {
        background: rgba(250, 204, 21, 0.03);
        border: 1px solid rgba(250, 204, 21, 0.1);
    }
    .ms-thankyou-box strong, .ms-thankyou-bonus strong { display: block; font-size: 15px; color: #fff; }
    .ms-thankyou-box span, .ms-thankyou-bonus span { font-size: 13px; color: #a1a1aa; }
    .ms-thankyou-sub { color: #52525b; font-size: 14px; margin-top: 12px; }

    /* Animations */
    @keyframes msSlideIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
    @keyframes msSpin { to { transform: rotate(360deg); } }
    @keyframes msPulseGlow { 0%, 100% { box-shadow: 0 0 0 0 rgba(250, 204, 21, 0); } 50% { box-shadow: 0 0 20px rgba(250, 204, 21, 0.1); } }
    @keyframes msPulseBar { 0%, 100% { opacity: 0.3; } 50% { opacity: 1; } }
    @keyframes msPulseDot { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.4; transform: scale(0.8); } }
    @keyframes msCtaPulse { 0%, 100% { box-shadow: 0 0 40px rgba(250, 204, 21, 0.25); } 50% { box-shadow: 0 0 60px rgba(250, 204, 21, 0.4); } }
    @keyframes msBounce { 0% { transform: scale(0.5); opacity: 0; } 60% { transform: scale(1.1); } 100% { transform: scale(1); opacity: 1; } }

    /* ============ MOBILE RESPONSIVE ============ */
    @media (max-width: 768px) {
        .ms-hero { padding: 40px 16px 36px; }
        .ms-hero h1 { font-size: 28px; }
        .ms-hero p { font-size: 14px; margin-bottom: 20px; }
        .ms-cta-hero { padding: 14px 24px; font-size: 15px; width: 100%; justify-content: center; }
        .ms-cta-bonus { font-size: 11px; padding: 6px 14px; }

        .ms-players { grid-template-columns: repeat(3, 1fr); gap: 8px; }
        .ms-player-card { padding: 12px 8px; }
        .ms-player-avatar { width: 48px; height: 48px; }
        .ms-player-card strong { font-size: 11px; }
        .ms-player-card span { font-size: 10px; }
        .ms-stats-row { grid-template-columns: repeat(2, 1fr); gap: 8px; }
        .ms-stat { padding: 14px 10px; }
        .ms-stat strong { font-size: 20px; }

        .ms-chi-inner { grid-template-columns: 1fr; gap: 24px; text-align: center; }
        .ms-chi-photo { width: 200px; height: 250px; margin: 0 auto; }
        .ms-chi-text h2 { font-size: 24px; }
        .ms-chi-badges { flex-direction: column; gap: 8px; }
        .ms-chi-media { text-align: center; }
        .ms-media-logos { justify-content: center; }

        .ms-problems-grid { grid-template-columns: 1fr 1fr; gap: 10px; }
        .ms-problem-card { padding: 16px; }
        .ms-problem-icon { font-size: 22px; margin-bottom: 6px; }
        .ms-problem-card h3 { font-size: 13px; }
        .ms-problem-card p { font-size: 11px; }

        .ms-come-steps { flex-direction: column; gap: 20px; }
        .ms-come-arrow { transform: rotate(90deg); }
        .ms-come-step { max-width: 100%; padding: 0; }
        .ms-reviews-grid { grid-template-columns: 1fr; }
        .ms-come-highlight { font-size: 12px; padding: 12px 16px; flex-direction: column; text-align: center; }

        .ms-form-section { padding: 40px 16px; }
        .ms-form-card { padding: 20px 16px; }
        .ms-step span { display: none; }
        .ms-problems-select { grid-template-columns: 1fr; }
        .ms-form-actions { flex-direction: column-reverse; }
        .ms-btn-back { width: 100%; text-align: center; justify-content: center; display: flex; }
        .ms-form-incentive { font-size: 11px; }

        .ms-social h2, .ms-problems h2, .ms-come-inner h2, .ms-form-inner h2 { font-size: 22px; }
    }

    @media (max-width: 400px) {
        .ms-players { grid-template-columns: repeat(2, 1fr); }
        .ms-problems-grid { grid-template-columns: 1fr; }
        .ms-header-inner { padding: 10px 14px; }
        .ms-garanzia-header { display: none; }
        .ms-logo { font-size: 14px; }
    }
`
