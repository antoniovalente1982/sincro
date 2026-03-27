'use client'

import './landing-v2.css'
import { useState, useEffect, useRef } from 'react'
import Image from 'next/image'
import { CheckCircle, ArrowRight, Star, Shield, Clock, Trophy, Phone, Mail, User, Sparkles, ChevronDown, Zap, Target, Brain, Award, Users, TrendingUp, Lock, MessageCircle, Gift } from 'lucide-react'
import { useMetaTracking, fireAdvancedMatching, firePixelEvent } from '@/lib/useMetaTracking'

interface Props {
    funnel: {
        id: string; name: string; description?: string; meta_pixel_id?: string
        settings?: any; organizations?: any; objective?: string
    }
    initialAdsetAngle?: 'emotional'|'system'|'efficiency'|'status'|'default'
}

const FAMOUS_PLAYERS = [
    { name: 'Patrick Cutrone', team: 'Ex Milan, Valencia, Como', img: '/images/calciatori/Patrick Cutrone (Monza).png' },
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
    { name: 'Francesco G.', text: "All'inizio ero scettico, ma mi sono ricreduto vedendo i miglioramenti di mio figlio. Reagisce benissimo alle delusioni e questo ha rilassato tutta la famiglia.", role: 'Papà di Matteo, 14 anni' },
    { name: 'Antonietta G.', text: "Ero scettica, ma dovevo fare qualcosa per mio figlio. Ora è un ragazzo pronto ad affrontare la vita a testa alta. Grazie Metodo Sincro!", role: 'Mamma di Luca, 16 anni' },
    { name: 'Simona R.', text: "Ha acquisito maggiore consapevolezza delle sue potenzialità. Oggi si sente più sicuro, mentre prima taceva per paura di sbagliare.", role: 'Mamma di Andrea, 15 anni' },
    { name: 'Marco D.', text: "In 3 mesi mio figlio è passato dalla panchina a titolare fisso. Non è solo il calcio, è cambiato come persona. Il mental coaching funziona.", role: 'Papà di Giacomo, 13 anni' },
]

const FAQ_ITEMS = [
    { q: 'Quanto dura il percorso?', a: 'Il percorso standard dura 3 mesi con sessioni settimanali ONE-TO-ONE. I primi risultati sono visibili già dopo 30 giorni.' },
    { q: 'Come si svolge? Devo portarlo da qualche parte?', a: 'No, il percorso è 100% online. Le sessioni si svolgono comodamente da casa via videochiamata, in totale flessibilità.' },
    { q: 'Funziona davvero? E se non vedo risultati?', a: 'Siamo gli unici in Italia con garanzia risultati SCRITTA nel contratto. Se non vedi miglioramenti misurabili, o non paghi, o continuiamo gratis fino al risultato. 2.100+ famiglie possono confermarlo.' },
    { q: 'A che età funziona?', a: 'Lavoriamo con ragazzi dai 10 ai 20 anni. Ogni coach è specializzato per fascia di età e adatta il metodo al livello di maturità del ragazzo. Poi per calciatori sopra i 20 anni professionisti abbiamo un reparto dedicato: lì seguiamo calciatori e calciatrici di Serie A, B e Lega Pro.' },
    { q: 'Quanto costa?', a: 'Le tariffe dipendono dal percorso personalizzato. La prima consulenza è COMPLETAMENTE GRATUITA e senza impegno — lì ti spieghiamo tutto.' },
    { q: 'Mio figlio non vuole parlare con uno psicologo...', a: 'Normale. Nessun ragazzo vuole "parlare con qualcuno dei suoi problemi." E infatti qui non lo facciamo. Il Mental Coaching funziona come un allenamento — solo che invece dei muscoli, alleni la testa. Concentrazione, gestione della pressione, fiducia. Roba concreta, con obiettivi chiari ogni settimana. La maggior parte dei ragazzi, quando capisce di cosa si tratta davvero, vuole iniziare subito. È così sia per giovani calciatori e anche con tutti i calciatori professionisti con cui lavoriamo.' },
]

export default function MetodoSincroLandingV2({ funnel, initialAdsetAngle = 'default' }: Props) {
    const [name, setName] = useState('')
    const [phone, setPhone] = useState('')
    const [email, setEmail] = useState('')
    const [childAge, setChildAge] = useState('')
    const [phoneError, setPhoneError] = useState('')
    const [emailError, setEmailError] = useState('')
    const [loading, setLoading] = useState(false)
    const [submitted, setSubmitted] = useState(false)
    const [error, setError] = useState('')
    const [openFaq, setOpenFaq] = useState<number | null>(null)
    const [viewerCount, setViewerCount] = useState(18)
    const [adsetAngle, setAdsetAngle] = useState<'emotional'|'system'|'efficiency'|'status'|'default'>(initialAdsetAngle)
        const [showExitPopup, setShowExitPopup] = useState(false)
    const formRef = useRef<HTMLDivElement>(null)
    const exitShownRef = useRef(false)

    // Validation helpers
    const handlePhoneChange = (val: string) => {
        setPhone(val)
        if (val && !/^[+\d\s\-()]+$/.test(val)) setPhoneError('Inserisci solo numeri')
        else setPhoneError('')
    }
    const handleEmailChange = (val: string) => {
        setEmail(val)
        if (!val.trim()) setEmailError('Email obbligatoria')
        else if (!val.includes('@')) setEmailError('Inserisci un\'email valida (con @)')
        else setEmailError('')
    }
    const isFormValid = name.trim().length > 0 && phone.trim().length > 3 && email.trim().length > 0 && email.includes('@') && !phoneError && !emailError

    // Dynamic viewer count
    useEffect(() => {
        const interval = setInterval(() => {
            setViewerCount(prev => {
                const delta = Math.random() > 0.5 ? Math.floor(Math.random() * 4) + 1 : -(Math.floor(Math.random() * 3) + 1)
                return Math.max(14, Math.min(35, prev + delta))
            })
        }, (Math.random() * 7000) + 8000)
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

    // Detect adset angle from utm_term has been moved to the server (page.tsx) to fix CLS/LCP issues.

    // Exit intent detection
    useEffect(() => {
        const triggerExit = () => {
            if (exitShownRef.current || submitted) return
            exitShownRef.current = true
            setShowExitPopup(true)
        }
        const handleMouseLeave = (e: MouseEvent) => { if (e.clientY <= 0) triggerExit() }
        let scrollY = 0, lastScrollTime = 0
        const handleScroll = () => {
            const now = Date.now(), currentY = window.scrollY
            if (currentY < scrollY - 200 && now - lastScrollTime < 300 && now > 15000) triggerExit()
            scrollY = currentY; lastScrollTime = now
        }
        const timeout = setTimeout(() => {
            document.addEventListener('mouseleave', handleMouseLeave)
            window.addEventListener('scroll', handleScroll, { passive: true })
        }, 8000)
        return () => { clearTimeout(timeout); document.removeEventListener('mouseleave', handleMouseLeave); window.removeEventListener('scroll', handleScroll) }
    }, [submitted])

    const scrollToForm = () => formRef.current?.scrollIntoView({ behavior: 'smooth' })

    const handleSubmit = async () => {
        if (!name || !phone || !email || phoneError || emailError) return
        if (phone && !/^[+\d\s\-()]+$/.test(phone)) { setPhoneError('Inserisci solo numeri'); return }
        if (email && !email.includes('@')) { setEmailError('Inserisci un\'email valida'); return }
        setLoading(true)
        setError('')

        // Generate Lead event_id for dedup
        const leadEventId = `lead_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`

        try {
            // Advanced Matching via shared helper
            if (funnel.meta_pixel_id) fireAdvancedMatching(funnel.meta_pixel_id, { email, phone })

            const res = await fetch('/api/submit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    funnel_id: funnel.id,
                    name, email, phone,
                    page_variant: funnel.settings?.ab_variant || 'A',
                    extra_data: { sport: 'calcio', child_age: childAge, adset_angle: adsetAngle },
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

            // Fire pixel Lead event with same event_id for CAPI dedup
            firePixelEvent('Lead', leadEventId)

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
            <div className="lp">
                <div className="lp-ty">
                    <div className="lp-ty-icon"><CheckCircle size={48} color="#22c55e" /></div>
                    <h1>Perfetto, {name.split(' ')[0]}! ⚽</h1>
                    <p>La tua richiesta è stata inviata con successo.</p>
                    <div className="lp-ty-box">
                        <Phone size={20} color="#facc15" />
                        <div>
                            <strong>{callbackMsg}</strong>
                            <span>al numero {phone}</span>
                        </div>
                    </div>
                    <div className="lp-ty-prep">
                        <h3>💡 Per prepararti alla consulenza gratuita:</h3>
                        <ul>
                            <li>Qual è il problema principale di tuo figlio in campo?</li>
                            <li>Da quanto tempo noti questo blocco?</li>
                            <li>Che ruolo gioca e in che squadra?</li>
                        </ul>
                    </div>
                    <div className="lp-ty-gift">
                        <Gift size={20} color="#facc15" />
                        <span>Chi si presenta alla consulenza riceverà in omaggio: <strong>Anthon Chat — il clone digitale di Antonio Valente, il tuo Mental Coach AI disponibile 24/7</strong></span>
                    </div>
                    <p className="lp-ty-sub">Se non rispondi, ti ricontatteremo il giorno successivo. 📱</p>
                    <div style={{ marginTop: '24px', textAlign: 'center' }}>
                        <p style={{ fontSize: '15px', color: 'rgba(255,255,255,0.7)', marginBottom: '12px' }}>💬 Vuoi sapere com&apos;è andata a chi ha già fatto il percorso?</p>
                        <a
                            href="https://it.trustpilot.com/review/valenteantonio.it"
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                                display: 'inline-flex', alignItems: 'center', gap: '8px',
                                padding: '14px 28px', borderRadius: '14px',
                                background: 'linear-gradient(135deg, #00b67a, #009567)',
                                color: '#fff', fontWeight: 700, fontSize: '15px',
                                textDecoration: 'none', transition: 'transform 0.2s, box-shadow 0.2s',
                                boxShadow: '0 4px 20px rgba(0,182,122,0.3)',
                            }}
                            onMouseOver={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 6px 28px rgba(0,182,122,0.5)' }}
                            onMouseOut={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,182,122,0.3)' }}
                        >
                            ⭐ Leggi le storie su Trustpilot
                        </a>
                    </div>
                </div>
                {/* Pixel init removed — single init in footer prevents duplicate PageView events */}
                <style>{STYLES}</style>
            </div>
        )
    }

    /* ======================== MAIN PAGE ======================== */
    return (
        <div className="lp">
            {/* Sticky Header */}
            <header className="lp-header">
                <div className="lp-header-in">
                    <div className="lp-logo">METODO SINCRO<sup>®</sup></div>
                    <div className="lp-header-r">
                        <div className="lp-header-badges">
                            <span className="lp-header-badge">⭐ 4.9/5 <span className="lp-tp-green">TrustPilot</span></span>
                        </div>
                        <button className="lp-header-cta" onClick={scrollToForm}>Prenota Gratis</button>
                    </div>
                </div>
            </header>

            {/* ══════════ 1. HERO + FORM ══════════ */}
            <section className="lp-hero">
                <div className="lp-hero-bg" />
                <div className="lp-hero-in">
                    <div className="lp-hero-text">
                        <div className="lp-badge"><Trophy size={14} /> Il <span className="lp-badge-highlight">Mental Coaching</span> #1 in Italia per Giovani Calciatori</div>
                        {adsetAngle === 'emotional' ? (
                            <>
                                <h1>Lo Vedi Anche Tu, Vero?<br /><span className="lp-gold">In Allenamento È Un Altro. In Partita Si Spegne.</span></h1>
                                <p className="lp-hero-sub">Sai che ha il talento. Ma qualcosa lo blocca ogni volta. <strong>Non è un problema tecnico — è un problema di mentalità.</strong> E con il percorso giusto, si risolve in 90 giorni. Il <strong>Metodo Sincro®</strong> è il Mental Coaching ONE-TO-ONE con coach <strong>CONI certificati</strong>, specializzati in calcio — con <strong>garanzia risultati scritta nel contratto</strong>.</p>
                            </>
                        ) : adsetAngle === 'system' ? (
                            <>
                                <h1>Il Talento C'è.<br /><span className="lp-gold">La Mentalità Vincente Si Costruisce.</span></h1>
                                <p className="lp-hero-sub">La differenza tra chi ce la fa e chi resta a guardare? <strong>La mentalità.</strong> E la mentalità vincente si allena — esattamente come la tecnica. Il <strong>Metodo Sincro®</strong> è il percorso di Mental Coaching ONE-TO-ONE con coach <strong>CONI certificati</strong>, specializzati in calcio e per fascia d'età — con <strong>garanzia risultati scritta nel contratto</strong>.</p>
                            </>
                        ) : adsetAngle === 'efficiency' ? (
                            <>
                                <h1>Stesso Ragazzo.<br /><span className="lp-gold">Mentalità Diversa. In Soli 90 Giorni.</span></h1>
                                <p className="lp-hero-sub">Ogni giorno che passa, il gap tra il suo talento e i suoi risultati si allarga. <strong>In 90 giorni il Metodo Sincro® trasforma la mentalità di tuo figlio</strong> — con un coach <strong>CONI dedicato</strong>, sessioni individuali e <strong>risultati garantiti per contratto</strong>.</p>
                            </>
                        ) : adsetAngle === 'status' ? (
                            <>
                                <h1>Tuo Figlio Merita<br /><span className="lp-gold">Il Percorso dei Campioni.</span></h1>
                                <p className="lp-hero-sub">I migliori atleti italiani non sono arrivati lì solo col talento — hanno <strong>allenato la mentalità</strong>. Lo stesso percorso usato in <strong>Serie A, B e Lega Pro</strong> è ora disponibile per tuo figlio. <strong>Metodo Sincro®</strong>: Mental Coaching ONE-TO-ONE con coach <strong>CONI certificati</strong>, specializzati in calcio — con <strong>garanzia risultati scritta nel contratto</strong>.</p>
                            </>
                        ) : (
                            <>
                                <h1>In Soli 90 Giorni Tuo Figlio<br /><span className="lp-gold">Sarà un Calciatore di Un'Altra Categoria...</span></h1>
                                <p className="lp-hero-sub">Il percorso di <strong>Mental Coaching sportivo ONE-TO-ONE</strong> con coach <strong>CONI certificati</strong>, specializzati <strong>in calcio e per fascia d'età</strong>. Elimina ansia da prestazione, paura del giudizio e blocchi mentali — con <strong>garanzia risultati scritta nel contratto</strong>.</p>
                            </>
                        )}
                        <div className="lp-hero-proof">
                            <div className="lp-proof-item"><CheckCircle size={16} color="#22c55e" /><span>Usato in <strong>Serie A, B e Lega Pro</strong></span></div>
                            <div className="lp-proof-item"><CheckCircle size={16} color="#22c55e" /><span><strong>4.9★</strong> TrustPilot (356 recensioni)</span></div>
                            <div className="lp-proof-item"><CheckCircle size={16} color="#22c55e" /><span>Se non funziona, <strong>o non paghi, o continuiamo gratis</strong></span></div>
                        </div>
                        <div className="lp-gift-badge lp-gift-desktop">
                            <Gift size={18} color="#facc15" />
                            <span>Chi si presenta alla consulenza riceverà in omaggio: <strong>Anthon Chat — il tuo Mental Coach AI disponibile 24/7</strong></span>
                        </div>
                    </div>
                    <div className="lp-hero-form" ref={formRef} id="ms-form">
                        <div className="lp-hf-card">
                            <div className="lp-hf-header">
                                <span className="lp-hf-live">⚡ POSTI LIMITATI</span>
                            </div>
                            <h3 className="lp-hf-title">Prenota la Consulenza <span className="lp-gold">Gratuita</span></h3>
                            <p className="lp-hf-sub">Compila il form — ti richiamiamo noi</p>
                            <div className="lp-hf-trust">
                                <div><Lock size={12} /> Dati protetti</div>
                                <div><Clock size={12} /> 30 secondi</div>
                                <div>{[1,2,3,4,5].map(i => <Star key={i} size={10} fill="#facc15" color="#facc15" />)} 4.9</div>
                            </div>
                            <div className="lp-hf-fields">
                                <div className="lp-field">
                                    <div className={`lp-input-wrap ${name ? 'filled' : ''}`}><User size={18} /><input type="text" placeholder="Nome e Cognome *" value={name} onChange={e => setName(e.target.value)} required /></div>
                                </div>
                                <div className="lp-field">
                                    <div className={`lp-input-wrap ${phone && !phoneError ? 'filled' : ''} ${phoneError ? 'has-error' : ''}`}><Phone size={18} /><input type="tel" placeholder="Telefono * (+39...)" value={phone} onChange={e => handlePhoneChange(e.target.value)} required /></div>
                                    {phoneError && <span className="lp-field-error">{phoneError}</span>}
                                </div>
                                <div className="lp-field">
                                    <div className={`lp-input-wrap ${email && !emailError ? 'filled' : ''} ${emailError ? 'has-error' : ''}`}><Mail size={18} /><input type="email" placeholder="Email *" value={email} onChange={e => handleEmailChange(e.target.value)} /></div>
                                    {emailError && <span className="lp-field-error">{emailError}</span>}
                                </div>
                                <div className="lp-field">
                                    <div className={`lp-input-wrap lp-select-wrap ${childAge ? 'filled' : ''}`}>
                                        <Users size={18} />
                                        <select value={childAge} onChange={e => setChildAge(e.target.value)}>
                                            <option value="">Età di tuo figlio/a (opzionale)</option>
                                            <option value="8-10">8-10 anni</option>
                                            <option value="11-13">11-13 anni</option>
                                            <option value="14-16">14-16 anni</option>
                                            <option value="17-20">17-20 anni</option>
                                            <option value="20+">Oltre 20 anni</option>
                                        </select>
                                    </div>
                                </div>
                                {error && <div className="lp-error">{error}</div>}
                                <button className={`lp-btn-submit lp-hf-btn ${isFormValid ? 'lp-btn-valid' : ''}`} disabled={loading} onClick={handleSubmit}>
                                    {loading ? <div className="lp-spinner" /> : <>PRENOTA ORA — È Gratuita <ArrowRight size={20} /></>}
                                </button>
                            </div>
                            <p className="lp-hf-privacy">🔒 I tuoi dati sono al sicuro. Zero spam.</p>
                            <div className="lp-hf-viewers"><span className="lp-urgency-dot" /><strong>{viewerCount}</strong> genitori stanno guardando ora</div>
                        </div>
                        <div className="lp-gift-badge lp-gift-mobile">
                            <Gift size={18} color="#facc15" />
                            <span>Chi si presenta alla consulenza riceverà in omaggio: <strong>Anthon Chat — il tuo Mental Coach AI disponibile 24/7</strong></span>
                        </div>
                    </div>
                </div>
            </section>

            {/* ══════════ 2. PAIN POINTS ══════════ */}
            <section className="lp-pain">
                <div className="lp-container">
                    <p className="lp-section-pre">IL PROBLEMA</p>
                    <h2>Riconosci tuo figlio in <span className="lp-gold">almeno una</span> di queste?</h2>
                    <div className="lp-pain-grid">
                        {[
                            { icon: '😰', title: 'Ansia da prestazione', desc: 'Si blocca prima delle partite importanti. In allenamento è un altro.' },
                            { icon: '👀', title: 'Paura di sbagliare', desc: 'Non tira, non rischia, si nasconde. Ha paura del giudizio.' },
                            { icon: '💔', title: 'Zero fiducia in sé', desc: 'Non si sente mai all\'altezza, anche quando la tecnica c\'è.' },
                            { icon: '🪑', title: 'Panchina costante', desc: 'Ha il talento ma non lo dimostra quando il mister guarda.' },
                            { icon: '😤', title: 'Pressione insostenibile', desc: 'Sente il peso delle aspettative e crolla nei momenti decisivi.' },
                            { icon: '🏥', title: 'Blocco post-infortunio', desc: 'È guarito fisicamente ma ha paura di tornare a dare il massimo.' },
                        ].map(p => (
                            <div key={p.title} className="lp-pain-card">
                                <span className="lp-pain-icon">{p.icon}</span>
                                <h3>{p.title}</h3>
                                <p>{p.desc}</p>
                            </div>
                        ))}
                    </div>
                    <div className="lp-pain-result">
                        <Brain size={20} color="#facc15" />
                        <span>Se hai riconosciuto tuo figlio, <strong>il problema NON è tecnico. È di mentalità.</strong> E con il Mental Coaching giusto, si risolve in 90 giorni.</span>
                    </div>
                    <button className="lp-cta-section" onClick={scrollToForm}>Prenota la Consulenza Gratuita <ArrowRight size={18} /></button>
                </div>
            </section>

            {/* ══════════ 3. SOCIAL PROOF ══════════ */}
            <section className="lp-social">
                <div className="lp-container">
                    <p className="lp-section-pre">LA PROVA</p>
                    <h2>Lo stesso metodo usato da calciatori di <span className="lp-gold">Serie A</span></h2>
                    <p className="lp-social-sub">Non è teoria. Questi professionisti hanno scelto Metodo Sincro® per la loro preparazione mentale.</p>
                    <div className="lp-players">
                        {FAMOUS_PLAYERS.map(p => (
                            <div key={p.name} className="lp-player">
                                <div className="lp-player-img">
                                    <Image src={p.img} alt={p.name} width={64} height={64} loading="lazy" style={{ objectFit: 'cover', borderRadius: '50%' }} />
                                </div>
                                <strong>{p.name}</strong>
                                <span>{p.team}</span>
                            </div>
                        ))}
                    </div>
                    <p className="lp-more">...e molti altri professionisti</p>
                    <div className="lp-stats-row">
                        <div className="lp-stat-big"><strong>2.100+</strong><span>Atleti seguiti</span></div>
                        <div className="lp-stat-big"><strong>11.500+</strong><span>Ore di coaching</span></div>
                        <div className="lp-stat-big"><strong>356</strong><span>Recensioni 5★</span></div>
                        <div className="lp-stat-big"><strong>30+</strong><span>Coach nel team</span></div>
                    </div>
                </div>
            </section>

            {/* ══════════ 4. COME FUNZIONA ══════════ */}
            <section className="lp-how">
                <div className="lp-container">
                    <p className="lp-section-pre">IL SISTEMA</p>
                    <h2>3 Fasi. 90 Giorni. <span className="lp-gold">Risultati Misurabili.</span></h2>
                    <p className="lp-how-sub">Non è motivazione. È un protocollo scientifico con risultati tracciabili settimana dopo settimana.</p>
                    <div className="lp-timeline">
                        <div className="lp-step"><div className="lp-step-num">1</div><div className="lp-step-content"><h3>Consulenza Gratuita</h3><p>Parli con un nostro esperto per 15 minuti. Analizziamo la situazione e capiamo se il percorso è adatto.</p></div></div>
                        <div className="lp-step"><div className="lp-step-num">2</div><div className="lp-step-content"><h3>Percorso Personalizzato</h3><p>Creiamo un piano <strong>ONE-TO-ONE</strong> su misura. Coach dedicato, specializzato per la sua fascia d'età.</p></div></div>
                        <div className="lp-step"><div className="lp-step-num">3</div><div className="lp-step-content"><h3>Trasformazione in 90 Giorni</h3><p>Sessioni settimanali online. Report progressi. Risultati misurabili e <strong>garantiti per contratto</strong>.</p></div></div>
                    </div>
                    <div className="lp-how-note">
                        <Shield size={18} color="#22c55e" />
                        <span><strong>Non è un allenamento tecnico, non è un procuratore.</strong> È Mental Coaching puro — ogni sessione è individuale, live, con un coach specializzato in calcio e per la sua fascia d'età.</span>
                    </div>
                    <button className="lp-cta-section" onClick={scrollToForm}>Inizia Il Percorso — Consulenza Gratuita <ArrowRight size={18} /></button>
                </div>
            </section>

            {/* ══════════ 5. BENEFICI ══════════ */}
            <section className="lp-benefits">
                <div className="lp-container">
                    <p className="lp-section-pre">COSA OTTIENI</p>
                    <h2>Tutto incluso. <span className="lp-gold">Zero sorprese.</span></h2>
                    <div className="lp-benefits-grid">
                        {[
                            { icon: <Target size={24} />, title: 'Coach Dedicato', desc: 'Un professionista con tesserino da specialista Mental Coach del CONI, assegnato solo a tuo figlio. Non gruppi, non videocorsi.' },
                            { icon: <Clock size={24} />, title: 'Risultati in 90 Giorni', desc: 'Il percorso ha una durata definita con milestones misurabili settimana per settimana.' },
                            { icon: <Shield size={24} />, title: 'Garanzia Contrattuale', desc: 'Gli UNICI in Italia con risultati garantiti per iscritto. Se non funziona, o non paghi, o continuiamo gratis.' },
                            { icon: <Zap size={24} />, title: '100% Online', desc: 'Sessioni comode da casa, via videochiamata. Zero spostamenti, massima flessibilità.' },
                            { icon: <TrendingUp size={24} />, title: 'Report Settimanali', desc: 'Ogni settimana ricevi un report dettagliato sui progressi di tuo figlio.' },
                            { icon: <Award size={24} />, title: 'Metodo dei Campioni', desc: 'Lo stesso sistema usato da calciatori di Serie A per la preparazione mentale.' },
                        ].map(b => (
                            <div key={b.title} className="lp-benefit">
                                <div className="lp-benefit-icon">{b.icon}</div>
                                <h3>{b.title}</h3>
                                <p>{b.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ══════════ 6. GARANZIA ══════════ */}
            <section className="lp-guarantee">
                <div className="lp-container">
                    <div className="lp-guarantee-card">
                        <h2 style={{marginTop: 0}}>Garanzia Sui Risultati — <span style={{color:'#22c55e'}}>Scritta Nel Contratto</span></h2>
                        <p>Siamo gli <strong>UNICI</strong> in Italia nel settore del mental coaching sportivo ad offrire una garanzia risultati scritta nel contratto. Se non vedi miglioramenti misurabili, <strong>o non paghi, o continuiamo gratis</strong>.</p>
                        <div className="lp-guarantee-row">
                            <div><CheckCircle size={16} color="#22c55e" /> Zero rischi per te</div>
                            <div><CheckCircle size={16} color="#22c55e" /> Risultati misurabili</div>
                            <div><CheckCircle size={16} color="#22c55e" /> Contratto trasparente</div>
                        </div>
                        <button className="lp-cta-main" onClick={scrollToForm} style={{margin:'24px auto 0', display:'flex'}}>Prenota la Consulenza Gratuita <ArrowRight size={20} /></button>
                    </div>
                </div>
            </section>

            {/* ══════════ 7. RECENSIONI ══════════ */}
            <section className="lp-reviews">
                <div className="lp-container">
                    <h2>Cosa dicono i <span className="lp-gold">genitori</span></h2>
                    <p className="lp-reviews-sub">356 recensioni certificate — 4.9/5 su TrustPilot</p>
                    <div className="lp-reviews-grid">
                        {REVIEWS.map((r, i) => (
                            <div key={i} className="lp-review">
                                <div className="lp-review-stars">{[1,2,3,4,5].map(s => <Star key={s} size={14} fill="#facc15" color="#facc15" />)}</div>
                                <p>"{r.text}"</p>
                                <div className="lp-review-author"><strong>{r.name}</strong><span>{r.role}</span></div>
                            </div>
                        ))}
                    </div>
                    <button className="lp-cta-section" onClick={scrollToForm}>Anche Tuo Figlio Può Farcela <ArrowRight size={18} /></button>
                </div>
            </section>

            {/* ══════════ 8. CHI SIAMO ══════════ */}
            <section className="lp-founder">
                <div className="lp-container">
                    <div className="lp-founder-grid">
                        <div className="lp-founder-photo">
                            <Image src="/images/team/Antonio Valente.png" alt="Antonio Valente" width={300} height={400} loading="lazy" style={{ objectFit: 'cover', borderRadius: '16px' }} />
                        </div>
                        <div className="lp-founder-text">
                            <h2>Chi è <span className="lp-gold">Antonio Valente</span></h2>
                            <p>Fondatore del Metodo Sincro® e Presidente del Sincro Group SRL. Mental Coach specializzato nel calcio, ha aiutato calciatori di Serie A, B e Lega Pro a sbloccare il proprio potenziale mentale.</p>
                            <div className="lp-founder-badges">
                                <div><strong>2.100+</strong><span>Atleti</span></div>
                                <div><strong>11.500+</strong><span>Ore coaching</span></div>
                                <div><strong>30+</strong><span>Team</span></div>
                            </div>
                            <div className="lp-founder-media">
                                <span>Citato su:</span> La Repubblica • Gazzetta dello Sport • Sport Mediaset • Millionaire
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Form is now in the hero section above */}

            {/* ══════════ 10. FAQ ══════════ */}
            <section className="lp-faq">
                <div className="lp-container">
                    <h2>Domande <span className="lp-gold">Frequenti</span></h2>
                    <div className="lp-faq-list">
                        {FAQ_ITEMS.map((item, i) => (
                            <div key={i} className={`lp-faq-item ${openFaq === i ? 'open' : ''}`}>
                                <button className="lp-faq-q" onClick={() => setOpenFaq(openFaq === i ? null : i)}>
                                    <span>{item.q}</span>
                                    <ChevronDown size={20} className={`lp-faq-chevron ${openFaq === i ? 'rotated' : ''}`} />
                                </button>
                                {openFaq === i && <div className="lp-faq-a">{item.a}</div>}
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ══════════ 11. FINAL CTA ══════════ */}
            <section className="lp-final-cta">
                <div className="lp-container" style={{textAlign:'center'}}>
                    <h2>Il Primo Passo È <span className="lp-gold">Gratuito</span></h2>
                    <p>Non aspettare — ogni giorno che passa il gap tra il suo talento e i suoi risultati si allarga.</p>
                    <button className="lp-cta-main" onClick={scrollToForm} style={{margin:'0 auto'}}>Prenota la Consulenza Gratuita <ArrowRight size={20} /></button>
                </div>
            </section>

            {/* Footer */}
            <footer className="lp-footer">
                <p className="lp-footer-brand">⚽ Metodo Sincro® — Percorsi di Mental Coaching <strong>ONE-TO-ONE</strong>, interamente <strong>ONLINE</strong>, con coach specializzati.</p>
                <div className="lp-footer-legal">
                    <p><strong>Sincro Group S.R.L.</strong></p>
                    <p>Via Monte Napoleone n.8 — 20121 Milano (MI)</p>
                    <p>C.F: 13508690966 · P.IVA: 13508690966</p>
                </div>
            </footer>

            {/* ══════════ EXIT INTENT POPUP ══════════ */}
            {showExitPopup && (
                <div className="lp-exit-overlay" onClick={() => setShowExitPopup(false)}>
                    <div className="lp-exit-popup" onClick={e => e.stopPropagation()}>
                        <button className="lp-exit-close" onClick={() => setShowExitPopup(false)}>✕</button>
                        <div className="lp-exit-header">
                            <span className="lp-exit-emoji">🤔</span>
                            <h2>Aspetta — Hai Ancora Dei <span className="lp-gold">Dubbi?</span></h2>
                            <p>È normale. Ogni genitore che ha iniziato il Metodo Sincro® aveva gli stessi.</p>
                        </div>
                        <div className="lp-exit-objections">
                            <div className="lp-exit-obj">
                                <span className="lp-exit-obj-q">❌ "E se non funziona?"</span>
                                <span className="lp-exit-obj-a">→ <strong>Garanzia scritta nel contratto:</strong> o funziona, o non paghi.</span>
                            </div>
                            <div className="lp-exit-obj">
                                <span className="lp-exit-obj-q">❌ "È troppo presto/tardi per mio figlio?"</span>
                                <span className="lp-exit-obj-a">→ Coach dedicati <strong>per ogni fascia d'età</strong> (10-20 anni).</span>
                            </div>
                            <div className="lp-exit-obj">
                                <span className="lp-exit-obj-q">❌ "Non ho tempo per portarlo"</span>
                                <span className="lp-exit-obj-a">→ 100% online, sessioni <strong>ONE-TO-ONE su Zoom</strong>.</span>
                            </div>
                        </div>
                        <div className="lp-exit-gift">
                            <Gift size={18} color="#facc15" />
                            <span>Chi prenota riceve in omaggio <strong>Anthon Chat</strong> — il Mental Coach AI di Antonio Valente, disponibile 24/7</span>
                        </div>
                        <button className="lp-exit-cta" onClick={() => { setShowExitPopup(false); scrollToForm() }}>
                            PRENOTA — 15 Minuti Gratuiti <ArrowRight size={18} />
                        </button>
                        <p className="lp-exit-sub">Consulenza gratuita • Senza impegno • 15 minuti</p>
                    </div>
                </div>
            )}

            {/* Pixel */}
            {funnel.meta_pixel_id && (
                <script dangerouslySetInnerHTML={{ __html: `!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${funnel.meta_pixel_id}',{});` }} />
            )}

            <style>{STYLES}</style>
        </div>
    )
}

const STYLES = `
/* Exit Intent Popup */
.lp-exit-overlay {
    position: fixed; inset: 0; z-index: 9999;
    background: rgba(0,0,0,0.75); backdrop-filter: blur(8px);
    display: flex; align-items: center; justify-content: center;
    padding: 20px;
    animation: fadeIn 0.3s ease-out;
}
.lp-exit-popup {
    position: relative; max-width: 480px; width: 100%;
    background: linear-gradient(165deg, #0f0f13 0%, #1a1a22 100%);
    border: 1.5px solid rgba(250,204,21,0.2);
    border-radius: 24px; padding: 36px 28px;
    box-shadow: 0 0 80px rgba(250,204,21,0.08), 0 20px 60px rgba(0,0,0,0.5);
    animation: popupSlideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1);
}
@keyframes popupSlideUp {
    from { opacity: 0; transform: translateY(40px) scale(0.95); }
    to { opacity: 1; transform: translateY(0) scale(1); }
}
.lp-exit-close {
    position: absolute; top: 14px; right: 16px;
    background: none; border: none; color: #52525b; font-size: 20px;
    cursor: pointer; padding: 4px 8px; border-radius: 8px;
    transition: all 0.2s;
}
.lp-exit-close:hover { color: #fff; background: rgba(255,255,255,0.05); }
.lp-exit-header { text-align: center; margin-bottom: 24px; }
.lp-exit-emoji { font-size: 40px; display: block; margin-bottom: 12px; }
.lp-exit-header h2 { font-size: 24px; font-weight: 900; color: #fff; margin-bottom: 8px; line-height: 1.2; }
.lp-exit-header p { font-size: 14px; color: #a1a1aa; }
.lp-exit-objections { display: flex; flex-direction: column; gap: 12px; margin-bottom: 20px; }
.lp-exit-obj {
    padding: 14px 16px; border-radius: 14px;
    background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06);
    display: flex; flex-direction: column; gap: 4px;
}
.lp-exit-obj-q { font-size: 14px; color: #ef4444; font-weight: 600; }
.lp-exit-obj-a { font-size: 13px; color: #a1a1aa; line-height: 1.5; }
.lp-exit-obj-a strong { color: #22c55e; }
.lp-exit-gift {
    display: flex; align-items: flex-start; gap: 10px;
    padding: 14px 16px; border-radius: 14px; margin-bottom: 20px;
    background: rgba(250,204,21,0.04); border: 1px solid rgba(250,204,21,0.12);
    font-size: 13px; color: #a1a1aa; line-height: 1.5;
}
.lp-exit-gift strong { color: #facc15; }
.lp-exit-cta {
    width: 100%; padding: 16px; border: none; border-radius: 14px;
    font-size: 16px; font-weight: 800; font-family: inherit;
    color: #fff; cursor: pointer;
    background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%);
    box-shadow: 0 0 40px rgba(34,197,94,0.3), 0 4px 16px rgba(34,197,94,0.3);
    display: flex; align-items: center; justify-content: center; gap: 8px;
    transition: all 0.3s;
    animation: ctaPulseGreen 2.5s ease-in-out infinite;
}
.lp-exit-cta:hover {
    transform: translateY(-2px) scale(1.02);
    box-shadow: 0 0 60px rgba(34,197,94,0.5);
    animation: none;
}
.lp-exit-sub {
    text-align: center; font-size: 12px; color: #52525b; margin-top: 12px;
}
@media (max-width: 768px) {
    .lp-exit-popup { padding: 28px 20px; }
    .lp-exit-header h2 { font-size: 20px; }
    .lp-exit-emoji { font-size: 32px; }
    .lp-exit-cta { font-size: 14px; padding: 14px; }
}
`
