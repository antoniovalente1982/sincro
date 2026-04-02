'use client'

import { useState, useEffect, useRef } from 'react'
import Image from 'next/image'
import { CheckCircle, ArrowRight, Star, Shield, Clock, Trophy, Phone, Mail, User, Gift, Sparkles, Brain } from 'lucide-react'
import { useMetaTracking, fireAdvancedMatching, firePixelEvent } from '@/lib/useMetaTracking'

interface Props {
    funnel: {
        id: string; name: string; description?: string; meta_pixel_id?: string
        settings?: any; organizations?: any; objective?: string
    }
}



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
    const [firstName, setFirstName] = useState('')
    const [lastName, setLastName] = useState('')
    const [phone, setPhone] = useState('')
    const [email, setEmail] = useState('')
    const [loading, setLoading] = useState(false)
    const [submitted, setSubmitted] = useState(false)
    const [error, setError] = useState('')
    const [viewerCount, setViewerCount] = useState(14)

    // Easter egg / Dev tool per visualizzare la TKP
    useEffect(() => {
        if (typeof window !== 'undefined') {
            const urlParams = new URLSearchParams(window.location.search)
            if (urlParams.get('tkp') === 'true') setSubmitted(true)
        }
    }, [])

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

    // ── Shared Meta Tracking (fbc/fbp, UTMs, PageView CAPI) ──
    const orgId = funnel.settings?.organization_id || (funnel as any).organizations?.id || 'a5dd4842-f0ea-4909-b4a3-be2cb1c6ffa5'
    const { getFbIds, getUtmParams, getVisitorId } = useMetaTracking({
        orgId,
        funnelId: funnel.id,
        pixelId: funnel.meta_pixel_id,
        abVariant: funnel.settings?.ab_variant,
    })

    const handleSubmit = async () => {
        if (!firstName || !lastName || !phone) return
        setLoading(true)
        setError('')

        // Generate Lead event_id for dedup
        const leadEventId = `lead_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`

        try {
            const fullName = `${firstName.trim()} ${lastName.trim()}`
            // Advanced Matching via shared helper
            if (funnel.meta_pixel_id) fireAdvancedMatching(funnel.meta_pixel_id, { email, phone, fn: firstName.trim(), ln: lastName.trim() })

            const res = await fetch('/api/submit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    funnel_id: funnel.id,
                    name: fullName, email, phone,
                    page_variant: funnel.settings?.ab_variant || 'A',
                    extra_data: { sport: 'calcio' },
                    landing_url: window.location.host + window.location.pathname,
                    event_id: leadEventId,
                    visitor_id: getVisitorId(),
                    ...getUtmParams(),
                    ...getFbIds(),
                }),
            })

            if (!res.ok) {
                const data = await res.json()
                throw new Error(data.error || 'Errore')
            }

            // Fire standard event immediately
            firePixelEvent('Lead', leadEventId, { content_category: funnel.objective || 'cliente' })

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
        const hour = new Date().getHours()
        const callbackMsg = hour >= 9 && hour < 18
            ? 'Ti chiameremo entro le prossime 2 ore'
            : hour >= 18
                ? 'Ti chiameremo domani mattina'
                : 'Ti chiameremo in mattinata'
                
        return (
            <div className="ms-page">
                <main className="lp-ty-modern">
                    <div className="lp-ty-header">
                        <div className="lp-ty-success-pulse">
                            <CheckCircle size={56} color="#22c55e" />
                        </div>
                        <h1>Ben Fatto{firstName ? ` ${firstName.trim()}` : ''}! ⚽</h1>
                        <p>Richiesta confermata. Segui questi 3 passaggi ora:</p>
                    </div>

                    <div className="lp-ty-steps">
                        {/* STEP 1 */}
                        <div className="lp-ty-step lp-step-urgent">
                            <div className="lp-ty-step-icon"><Phone size={24} color="#facc15" /></div>
                            <div className="lp-ty-step-content">
                                <span className="lp-ty-badge-num">Passo 1</span>
                                <h3>Attendi la nostra chiamata</h3>
                                <p><strong>{callbackMsg}</strong> al numero <strong>{phone}</strong>. Tieniti pronto a rispondere, se non lo fai il posto passerà al prossimo genitore.</p>
                            </div>
                        </div>

                        {/* STEP 2 */}
                        <div className="lp-ty-step lp-step-prep">
                            <div className="lp-ty-step-icon"><Brain size={24} color="#38bdf8" /></div>
                            <div className="lp-ty-step-content">
                                <span className="lp-ty-badge-num">Passo 2</span>
                                <h3>Preparati alla call</h3>
                                <ul>
                                    <li>Qual è il suo blocco principale in gara?</li>
                                    <li>Da quanto tempo noti questa situazione?</li>
                                    <li>Qual è l'obiettivo che volete raggiungere?</li>
                                </ul>
                            </div>
                        </div>

                        {/* STEP 3 */}
                        <div className="lp-ty-step lp-step-gift">
                            <div className="lp-ty-step-icon"><Gift size={24} color="#ec4899" /></div>
                            <div className="lp-ty-step-content">
                                <span className="lp-ty-badge-num">Passo 3 (Omaggio Sbloccato)</span>
                                <h3>Anthon Chat</h3>
                                <p>Presentandoti alla chiamata, avrai accesso in omaggio ad <strong>Anthon Chat</strong>, il Coach AI di Antonio Valente disponibile 24/7.</p>
                            </div>
                        </div>
                    </div>

                    <div className="lp-ty-footer">
                        <a href="https://it.trustpilot.com/review/valenteantonio.it" target="_blank" rel="noopener noreferrer" className="lp-trust-btn">
                            <Star size={18} fill="#fff" color="#fff" />
                            Leggi 350+ Storie di Successo
                        </a>
                        <a href="https://metodosincro.it" target="_blank" rel="noopener noreferrer" className="lp-site-link">
                            Visita il sito ufficiale Metodo Sincro®
                        </a>
                    </div>
                </main>

                <style>{STYLES}</style>
                <style dangerouslySetInnerHTML={{__html: `
                    .lp-ty-modern { max-width: 500px; margin: 40px auto; padding: 0 20px; font-family: inherit; display: flex; flex-direction: column; gap: 20px; }
                    .lp-ty-header { text-align: center; }
                    .lp-ty-success-pulse { display: inline-flex; animation: pulseSuccess 2s infinite; margin-bottom: 12px; border-radius: 50%; }
                    .lp-ty-header h1 { font-size: 28px; font-weight: 800; color: #fff; margin: 0 0 6px; letter-spacing: -0.5px; }
                    .lp-ty-header p { font-size: 15px; color: #a1a1aa; line-height: 1.4; margin: 0; }
                    
                    .lp-ty-steps { position: relative; display: flex; flex-direction: column; gap: 10px; }
                    .lp-ty-steps::before { content: ''; position: absolute; top: 40px; bottom: 40px; left: 37px; width: 2px; background: rgba(255,255,255,0.06); z-index: 0; }
                    .lp-ty-step { position: relative; z-index: 1; background: #131317; border: 1px solid rgba(255,255,255,0.08); border-radius: 14px; padding: 16px; display: flex; gap: 16px; align-items: center; transition: all 0.3s; }
                    .lp-ty-step:hover { background: #18181c; transform: translateY(-2px); border-color: rgba(255,255,255,0.15); }
                    .lp-ty-step-icon { position: relative; z-index: 2; width: 44px; height: 44px; border-radius: 12px; background: rgba(255,255,255,0.05); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
                    .lp-step-urgent { border-color: rgba(250, 204, 21, 0.15); }
                    .lp-step-urgent .lp-ty-step-icon { background: rgba(250, 204, 21, 0.1); border: 1px solid rgba(250, 204, 21, 0.2); }
                    .lp-step-prep .lp-ty-step-icon { background: rgba(56, 189, 248, 0.08); border: 1px solid rgba(56, 189, 248, 0.15); }
                    .lp-step-gift {  }
                    .lp-step-gift .lp-ty-step-icon { background: rgba(236, 72, 153, 0.1); border: 1px solid rgba(236, 72, 153, 0.2); }
                    
                    .lp-ty-step-content { flex: 1; }
                    .lp-ty-badge-num { font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; color: #a1a1aa; margin-bottom: 3px; display: block; }
                    .lp-step-urgent .lp-ty-badge-num { color: #facc15; }
                    .lp-step-prep .lp-ty-badge-num { color: #38bdf8; }
                    .lp-step-gift .lp-ty-badge-num { color: #ec4899; }
                    .lp-ty-step-content h3 { font-size: 16px; font-weight: 700; color: #fff; margin: 0 0 4px 0; }
                    .lp-ty-step-content p { font-size: 13.5px; color: #d4d4d8; line-height: 1.4; margin: 0; }
                    .lp-ty-step-content ul { margin: 6px 0 0; padding-left: 16px; color: #d4d4d8; font-size: 13px; line-height: 1.4; list-style-type: disc; }
                    .lp-ty-step-content li { margin-bottom: 2px; }
                    .lp-ty-step-content strong { color: #e4e4e7; }
                    .lp-step-urgent p { color: #d4d4d8; }
                    .lp-step-urgent strong { color: #fff; font-weight: 800; }
                    
                    .lp-ty-footer { text-align: center; margin-top: 8px; }
                    .lp-trust-btn { display: inline-flex; align-items: center; justify-content: center; gap: 8px; width: 100%; padding: 14px; background: linear-gradient(135deg, #00b67a, #009567); color: #fff; font-weight: 700; font-size: 15px; border-radius: 12px; text-decoration: none; transition: all 0.2s; box-shadow: 0 4px 15px rgba(0, 182, 122, 0.3); }
                    .lp-trust-btn:hover { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(0, 182, 122, 0.4); }
                    .lp-site-link { display: inline-block; margin-top: 16px; font-size: 13px; color: #71717a; text-decoration: underline; transition: color 0.2s; }
                    .lp-site-link:hover { color: #d4d4d8; }
                    
                    @keyframes pulseSuccess { 0% { box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.4); } 70% { box-shadow: 0 0 0 12px rgba(34, 197, 94, 0); } 100% { box-shadow: 0 0 0 0 rgba(34, 197, 94, 0); } }
                `}} />
            </div>
        )
    }

    /* ======================== MAIN PAGE ======================== */
    return (
        <div className="ms-page">
            {/* Top Bar */}
            <div className="ms-topbar">
                <div className="ms-topbar-inner">
                    <a href="tel:+390230316517" className="ms-topbar-phone">
                        <Phone size={14} />
                        <span>+39 02 3031 6517</span>
                    </a>
                    <span className="ms-topbar-hours">Lun-Ven 9:00 — 20:00</span>
                </div>
            </div>

            {/* Header */}
            <header className="ms-header">
                <div className="ms-header-inner">
                    <div className="ms-logo"><span className="ms-logo-text">METODO SINCRO<sup>®</sup></span><span className="ms-logo-sub">di Antonio Valente</span></div>
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
                    <div className="ms-hero-text">
                        <div className="ms-badge">
                            <Trophy size={14} />
                            Leader nel Mental Coaching Calcistico in Italia
                        </div>
                        <h1>
                            Tuo Figlio Ha Talento.<br />
                            <span className="ms-yellow">Ma Qualcosa Lo Blocca.</span>
                        </h1>
                        <p className="ms-hero-subtitle">Scopri come <strong>2.100+</strong> giovani calciatori hanno superato ansia, paura e insicurezza con il Mental Coaching <strong>#1 in Italia</strong></p>
                        <p>
                            L'87% dei talenti non emerge per un problema invisibile: la <strong>mente</strong>.
                            Ansia da prestazione, paura di sbagliare, zero fiducia — il Mental Coaching elimina questi blocchi.
                        </p>
                        <button className="ms-cta-hero" onClick={() => {
                            document.getElementById('ms-form')?.scrollIntoView({ behavior: 'smooth' })
                        }}>
                            Prenota ORA la Tua Consulenza ⚽
                            <ArrowRight size={20} />
                        </button>
                        <div className="ms-cta-bonus">
                            <Sparkles size={16} />
                            <span>Include anche accesso esclusivo ad <strong>Anthon Chat®</strong>, il nostro assistente AI</span>
                        </div>
                    </div>
                    <div className="ms-hero-image">
                        <Image
                            src="/images/landing/hero-footballer.png"
                            alt="Giovane calciatore che celebra la vittoria - forza mentale"
                            width={480}
                            height={480}
                            priority
                            style={{ objectFit: 'cover', borderRadius: '20px' }}
                        />
                    </div>
                </div>
            </section>

            {/* ========== FORM SECTION (moved here, right after hero) ========== */}
            <section className="ms-form-section" id="ms-form">
                <div className="ms-form-inner">
                    <h2>Prenota ORA la Tua <span className="ms-yellow">Consulenza Gratuita</span></h2>
                    <p>Lascia i tuoi dati — ti richiamiamo entro 2 ore.</p>
                    <div className="ms-form-visual">
                        <Image
                            src="/images/landing/mental-coaching.png"
                            alt="Mental Coaching: dalla mente alla performance"
                            width={400}
                            height={400}
                            loading="lazy"
                            style={{ objectFit: 'contain', maxHeight: '120px', width: 'auto' }}
                        />
                    </div>
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
                        <div className="ms-form-step">
                            <div className="ms-field lp-name-row" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '12px' }}>
                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                    <label>Nome *</label>
                                    <div className="ms-input-wrap">
                                        <User size={18} style={{ flexShrink: 0 }} />
                                        <input
                                            type="text"
                                            placeholder="Es. Marco"
                                            value={firstName}
                                            onChange={e => setFirstName(e.target.value)}
                                            required
                                            style={{ minWidth: 0, width: '100%' }}
                                        />
                                    </div>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                    <label>Cognome *</label>
                                    <div className="ms-input-wrap">
                                        <input
                                            type="text"
                                            placeholder="Es. Rossi"
                                            value={lastName}
                                            onChange={e => setLastName(e.target.value)}
                                            required
                                            style={{ minWidth: 0, width: '100%' }}
                                        />
                                    </div>
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

                            {error && (
                                <div className="ms-error">{error}</div>
                            )}

                            <button
                                className="ms-btn-submit"
                                disabled={!firstName || !lastName || !phone || loading}
                                onClick={handleSubmit}
                            >
                                {loading ? (
                                    <div className="ms-spinner" />
                                ) : (
                                    <>
                                        Prenota la Consulenza Gratuita
                                        <ArrowRight size={20} />
                                    </>
                                )}
                            </button>
                        </div>

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

            {/* Social Proof - Players */}
            <section className="ms-social">
                <div className="ms-social-inner">
                    <h2>Hanno scelto il <span className="ms-yellow">Metodo Sincro</span></h2>
                    <p className="ms-social-sub">Calciatori professionisti e migliaia di giovani atleti in tutta Italia</p>
                    <div className="ms-players">
                        {FAMOUS_PLAYERS.map(p => (
                            <div key={p.name} className="ms-player-card">
                                <div className="ms-player-avatar">
                                    <Image
                                        src={p.img}
                                        alt={p.name}
                                        width={64}
                                        height={64}
                                        loading="lazy"
                                        style={{ objectFit: 'cover', borderRadius: '50%' }}
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
                        <Image
                            src="/images/team/Antonio Valente.png"
                            alt="Antonio Valente - Fondatore Metodo Sincro"
                            width={300}
                            height={400}
                            loading="lazy"
                            style={{ objectFit: 'cover', borderRadius: '16px' }}
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

            {/* Form section is now above, right after the hero */}

            {/* Garanzia */}
            <div className="ms-garanzia-banner">
                <Shield size={18} />
                <span>Gli unici nel settore con <strong>Garanzia scritta sul Contratto</strong></span>
            </div>

            {/* Footer banner */}
            <div className="ms-footer-banner">
                <p>⚽ Metodo Sincro® — Percorsi di Mental Coaching <strong>UNO a UNO</strong>, interamente <strong>ONLINE</strong>, con coach specializzati e dedicati per fascia d'età.</p>
            </div>

            {/* Company Footer */}
            <div className="ms-company-footer">
                <p className="ms-company-name">Sincro Group S.R.L.</p>
                <p>Via Monte Napoleone n.8 — 20121 Milano (MI)</p>
                <p>C.F: 13508690966 · P.IVA: 13508690966</p>
            </div>

            {/* Meta Pixel — PageView is fired manually with eventID for CAPI deduplication */}
            {funnel.meta_pixel_id && (
                <script
                    dangerouslySetInnerHTML={{
                        __html: `!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${funnel.meta_pixel_id}',{});`,
                    }}
                />
            )}

            <style>{STYLES}</style>
        </div>
    )
}

const STYLES = `
    /* Google Fonts loaded via root layout.tsx <link> — no @import needed */

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

    /* Top bar */
    .ms-topbar {
        background: rgba(250, 204, 21, 0.06);
        border-bottom: 1px solid rgba(250, 204, 21, 0.1);
    }
    .ms-topbar-inner {
        max-width: 1100px;
        margin: 0 auto;
        padding: 8px 20px;
        display: flex;
        justify-content: center;
        align-items: center;
        gap: 20px;
        font-size: 13px;
    }
    .ms-topbar-phone {
        display: flex;
        align-items: center;
        gap: 6px;
        color: #facc15;
        font-weight: 700;
        text-decoration: none;
        transition: opacity 0.2s;
    }
    .ms-topbar-phone:hover { opacity: 0.8; }
    .ms-topbar-hours {
        color: #a1a1aa;
        font-size: 12px;
        font-weight: 500;
    }

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
        display: flex;
        flex-direction: column;
        font-size: 16px;
        font-weight: 900;
        letter-spacing: 2px;
        color: #fff;
    }
    .ms-logo-text {
        font-size: 18px;
        font-weight: 900;
        letter-spacing: 3px;
        color: #fff;
    }
    .ms-logo-text sup { color: #fff; font-size: 10px; }
    .ms-logo-sub {
        font-size: 11px;
        font-weight: 400;
        letter-spacing: 0.5px;
        color: #71717a;
        margin-top: 1px;
    }
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
        max-width: 1000px;
        margin: 0 auto;
        display: grid;
        grid-template-columns: 1fr auto;
        gap: 40px;
        align-items: center;
        text-align: left;
    }
    .ms-hero-text {
        max-width: 560px;
    }
    .ms-hero-image {
        flex-shrink: 0;
        width: 320px;
        height: 320px;
        border-radius: 20px;
        overflow: hidden;
        box-shadow:
            0 8px 40px rgba(0, 0, 0, 0.4),
            0 0 60px rgba(250, 204, 21, 0.08);
    }
    .ms-hero-image img {
        width: 100%;
        height: 100%;
        object-fit: cover;
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
    .ms-form-visual {
        display: flex;
        justify-content: center;
        margin: 8px 0 12px;
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
        background: #ffffff;
        border: 1.5px solid #e4e4e7;
        border-radius: 20px;
        padding: 32px;
        box-shadow:
            0 4px 24px rgba(0, 0, 0, 0.08),
            0 1px 3px rgba(0, 0, 0, 0.04);
        position: relative;
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
        font-size: 13px;
        font-weight: 600;
        color: #3f3f46;
        margin-bottom: 5px;
    }
    .ms-input-wrap {
        display: flex;
        align-items: center;
        gap: 10px;
        background: #f4f4f5;
        border: 1.5px solid #d4d4d8;
        border-radius: 12px;
        padding: 0 14px;
        transition: all 0.2s;
        color: #71717a;
    }
    .ms-input-wrap:focus-within {
        border-color: #facc15;
        box-shadow: 0 0 0 3px rgba(250, 204, 21, 0.15);
        background: #fff;
    }
    .ms-input-wrap input {
        flex: 1;
        background: none;
        border: none;
        outline: none;
        color: #18181b;
        font-size: 15px;
        padding: 13px 0;
        font-family: inherit;
    }
    .ms-input-wrap input::placeholder { color: #a1a1aa; }
    .ms-input-wrap input:-webkit-autofill,
    .ms-input-wrap input:-webkit-autofill:hover,
    .ms-input-wrap input:-webkit-autofill:focus {
        -webkit-box-shadow: 0 0 0 1000px #f4f4f5 inset !important;
        -webkit-text-fill-color: #18181b !important;
        transition: background-color 5000s ease-in-out 0s;
        caret-color: #18181b;
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
        background: rgba(250, 204, 21, 0.08);
        border: 1px solid rgba(250, 204, 21, 0.2);
        font-size: 12px;
        color: #52525b;
        text-align: left;
        position: relative;
        overflow: hidden;
    }
    .ms-form-incentive strong { color: #b45309; }
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
        color: #a1a1aa;
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
        background: linear-gradient(135deg, #dc2626, #b91c1c);
        padding: 18px 20px;
        text-align: center;
    }
    .ms-footer-banner p {
        font-size: 14px;
        font-weight: 600;
        color: #fff;
        max-width: 700px;
        margin: 0 auto;
        line-height: 1.5;
    }
    .ms-footer-banner strong {
        color: #fff;
        text-decoration: underline;
        text-underline-offset: 2px;
    }
    .ms-company-footer {
        padding: 20px 20px;
        text-align: center;
        background: #050505;
        border-top: 1px solid rgba(255, 255, 255, 0.05);
    }
    .ms-company-footer p {
        font-size: 11px;
        color: #52525b;
        line-height: 1.8;
    }
    .ms-company-footer .ms-company-name {
        font-weight: 700;
        font-size: 12px;
        color: #71717a;
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
        color: #71717a;
        background: #fafafa;
        border: 1px solid #e4e4e7;
    }
    .ms-form-urgency-bottom strong {
        color: #b45309;
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
        .ms-hero-content { grid-template-columns: 1fr; text-align: center; gap: 24px; }
        .ms-hero-image { width: 200px; height: 200px; margin: 0 auto; border-radius: 16px; }
        .ms-hero-text { max-width: 100%; }
        .ms-hero h1 { font-size: 28px; }
        .ms-hero p { font-size: 14px; margin-bottom: 20px; }
        .ms-cta-hero { padding: 14px 24px; font-size: 15px; width: 100%; justify-content: center; }
        .ms-cta-bonus { font-size: 11px; padding: 6px 14px; }
        .ms-form-visual img { max-height: 80px !important; }

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

        .ms-problems-grid { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 10px; }
        .ms-problem-card { padding: 16px; }
        .ms-problem-icon { font-size: 22px; margin-bottom: 6px; }
        .ms-problem-card h3 { font-size: 13px; }
        .ms-problem-card p { font-size: 11px; }
        .ms-hf-content { padding: 20px; }
        .ms-hf-title { font-size: 20px; }
        .ms-field { margin-bottom: 15px; }
        .ms-input-wrap { padding: 0 12px; min-width: 0; }
        .ms-input-wrap input { padding: 12px 0; font-size: 14px; min-width: 0; }
        .ms-input-wrap select { padding: 12px 0; font-size: 14px; min-width: 0; }
        .lp-name-row { grid-template-columns: 1fr !important; gap: 12px !important; }

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
