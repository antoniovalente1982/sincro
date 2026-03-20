'use client'

import './landing-v2.css'
import { useState, useEffect, useRef } from 'react'
import Image from 'next/image'
import { CheckCircle, ArrowRight, Star, Shield, Clock, Trophy, Phone, Mail, User, Sparkles, ChevronDown, Zap, Target, Brain, Award, Users, TrendingUp, Lock, MessageCircle, Gift } from 'lucide-react'

interface Props {
    funnel: {
        id: string; name: string; description?: string; meta_pixel_id?: string
        settings?: any; organizations?: any; objective?: string
    }
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
    { q: 'A che età funziona?', a: 'Lavoriamo con ragazzi dai 10 ai 20 anni. Ogni coach è specializzato per fascia di età e adatta il metodo al livello di maturità del ragazzo.' },
    { q: 'Quanto costa?', a: 'Le tariffe dipendono dal percorso personalizzato. La prima consulenza è COMPLETAMENTE GRATUITA e senza impegno — lì ti spieghiamo tutto.' },
    { q: 'Mio figlio non vuole parlare con uno psicologo...', a: 'Non siamo psicologi. Il mental coaching serve per raggiungere i SUOI obiettivi e migliorare da subito. Noi siamo quelli che lavorano con i calciatori professionisti che tuo figlio vede in televisione. Quando glielo dirai, sarà LUI a voler iniziare il programma.' },
]

export default function MetodoSincroLandingV2({ funnel }: Props) {
    const [name, setName] = useState('')
    const [phone, setPhone] = useState('')
    const [email, setEmail] = useState('')
    const [phoneError, setPhoneError] = useState('')
    const [emailError, setEmailError] = useState('')
    const [loading, setLoading] = useState(false)
    const [submitted, setSubmitted] = useState(false)
    const [error, setError] = useState('')
    const [openFaq, setOpenFaq] = useState<number | null>(null)
    const [viewerCount, setViewerCount] = useState(18)
    const formRef = useRef<HTMLDivElement>(null)

    // Validation helpers
    const handlePhoneChange = (val: string) => {
        setPhone(val)
        if (val && !/^[+\d\s\-()]+$/.test(val)) setPhoneError('Inserisci solo numeri')
        else setPhoneError('')
    }
    const handleEmailChange = (val: string) => {
        setEmail(val)
        if (val && !val.includes('@')) setEmailError('Inserisci un\'email valida (con @)')
        else setEmailError('')
    }
    const isFormValid = name.trim().length > 0 && phone.trim().length > 3 && !phoneError && !emailError

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

    const [utmParams, setUtmParams] = useState<any>({})
    useEffect(() => {
        const params = new URLSearchParams(window.location.search)
        const utms = {
            utm_source: params.get('utm_source') || undefined,
            utm_medium: params.get('utm_medium') || undefined,
            utm_campaign: params.get('utm_campaign') || undefined,
            utm_content: params.get('utm_content') || undefined,
            utm_term: params.get('utm_term') || undefined,
        }
        setUtmParams(utms)

        let visitorId = localStorage.getItem('_sincro_vid')
        if (!visitorId) {
            visitorId = crypto.randomUUID()
            localStorage.setItem('_sincro_vid', visitorId)
        }

        const pageViewEventId = `pv_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
        const cookies = document.cookie.split(';').reduce((acc: any, c) => {
            const [k, v] = c.trim().split('=')
            acc[k] = v
            return acc
        }, {})

        const orgId = funnel.settings?.organization_id || (funnel as any).organizations?.id
        fetch('/api/track/pageview', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                organization_id: orgId || 'a5dd4842-f0ea-4909-b4a3-be2cb1c6ffa5',
                funnel_id: funnel.id,
                page_path: window.location.pathname,
                page_variant: funnel.settings?.ab_variant || 'A',
                visitor_id: visitorId,
                utm_source: utms.utm_source, utm_medium: utms.utm_medium,
                utm_campaign: utms.utm_campaign, utm_content: utms.utm_content,
                utm_term: utms.utm_term,
                fbadid: params.get('fbadid') || undefined,
                referrer: document.referrer || undefined,
                event_id: pageViewEventId,
                fbc: cookies._fbc || undefined,
                fbp: cookies._fbp || undefined,
                page_url: window.location.href,
            }),
        }).catch(() => {})

        if (typeof window !== 'undefined' && (window as any).fbq) {
            (window as any).fbq('track', 'PageView', {}, { eventID: pageViewEventId })
        }
    }, [])

    const getFbIds = () => {
        const cookies = document.cookie.split(';').reduce((acc: any, c) => {
            const [k, v] = c.trim().split('=')
            acc[k] = v
            return acc
        }, {})
        return { fbc: cookies._fbc || undefined, fbp: cookies._fbp || undefined }
    }

    const scrollToForm = () => formRef.current?.scrollIntoView({ behavior: 'smooth' })

    const handleSubmit = async () => {
        if (!name || !phone || phoneError || emailError) return
        if (phone && !/^[+\d\s\-()]+$/.test(phone)) { setPhoneError('Inserisci solo numeri'); return }
        if (email && !email.includes('@')) { setEmailError('Inserisci un\'email valida'); return }
        setLoading(true)
        setError('')

        // Generate Lead event_id for dedup
        const leadEventId = `lead_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`

        try {
            // Advanced Matching
            if (funnel.meta_pixel_id && typeof window !== 'undefined' && (window as any).fbq) {
                const matchData: any = {}
                if (email) matchData.em = email.toLowerCase().trim()
                if (phone) matchData.ph = phone.replace(/\D/g, '')
                ;(window as any).fbq('init', funnel.meta_pixel_id, matchData)
            }

            const res = await fetch('/api/submit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    funnel_id: funnel.id,
                    name, email, phone,
                    page_variant: funnel.settings?.ab_variant || 'A',
                    extra_data: { sport: 'calcio' },
                    landing_url: window.location.host + window.location.pathname,
                    event_id: leadEventId,
                    ...utmParams,
                    ...getFbIds(),
                }),
            })

            if (!res.ok) {
                const data = await res.json()
                throw new Error(data.error || 'Errore')
            }

            // Fire pixel Lead event with same event_id for CAPI dedup
            if (typeof window !== 'undefined' && (window as any).fbq) {
                (window as any).fbq('track', 'Lead', {}, { eventID: leadEventId })
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
            <div className="lp">
                <div className="lp-ty">
                    <div className="lp-ty-icon"><CheckCircle size={48} color="#22c55e" /></div>
                    <h1>Perfetto, {name.split(' ')[0]}! ⚽</h1>
                    <p>La tua richiesta è stata inviata con successo.</p>
                    <div className="lp-ty-box">
                        <Phone size={20} color="#facc15" />
                        <div>
                            <strong>Un nostro esperto ti contatterà</strong>
                            <span>entro 2 ore al numero {phone}</span>
                        </div>
                    </div>
                    <p className="lp-ty-sub">Preparati a scoprire come sbloccare il vero potenziale di tuo figlio. 🏆</p>
                </div>
                {funnel.meta_pixel_id && (
                    <script dangerouslySetInnerHTML={{ __html: `!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${funnel.meta_pixel_id}');` }} />
                )}
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
                        <div className="lp-badge"><Trophy size={14} /> Il Mental Coaching #1 in Italia per Giovani Calciatori</div>
                        <h1>In Soli 90 Giorni,<br />Sarà Di Un'Altra Categoria.<br /><span className="lp-gold">Gli Osservatori Non Potranno Ignorarlo...</span></h1>
                        <p className="lp-hero-sub">Il percorso di <strong>Mental Coaching sportivo ONE-TO-ONE</strong> con coach <strong>CONI certificati</strong>, specializzati <strong>in calcio e per fascia d'età</strong>. Elimina ansia da prestazione, paura del giudizio e blocchi mentali — con <strong>garanzia risultati scritta nel contratto</strong>.</p>
                        <div className="lp-hero-proof">
                            <div className="lp-proof-item"><CheckCircle size={16} color="#22c55e" /><span>Usato in <strong>Serie A, B e Lega Pro</strong></span></div>
                            <div className="lp-proof-item"><CheckCircle size={16} color="#22c55e" /><span><strong>4.9★</strong> TrustPilot (356 recensioni)</span></div>
                            <div className="lp-proof-item"><CheckCircle size={16} color="#22c55e" /><span>Se non funziona, <strong>o non paghi, o continuiamo gratis</strong></span></div>
                        </div>
                        <div className="lp-gift-badge">
                            <Gift size={18} color="#facc15" />
                            <span>Dopo la chiamata riceverai: <strong>"Il programma di Coaching che aumenta di 10 volte la probabilità di diventare un calciatore professionista"</strong></span>
                        </div>
                    </div>
                    <div className="lp-hero-form" ref={formRef} id="ms-form">
                        <div className="lp-hf-card">
                            <div className="lp-hf-header">
                                <span className="lp-hf-live">⚡ POSTI LIMITATI</span>
                            </div>
                            <h3 className="lp-hf-title">Prenota la Consulenza <span className="lp-gold">Gratuita</span></h3>
                            <p className="lp-hf-sub">Compila il form — ti richiamiamo entro 2 ore</p>
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
                                    <div className={`lp-input-wrap ${email && !emailError ? 'filled' : ''} ${emailError ? 'has-error' : ''}`}><Mail size={18} /><input type="email" placeholder="Email (opzionale)" value={email} onChange={e => handleEmailChange(e.target.value)} /></div>
                                    {emailError && <span className="lp-field-error">{emailError}</span>}
                                </div>
                                {error && <div className="lp-error">{error}</div>}
                                <button className={`lp-btn-submit lp-hf-btn ${isFormValid ? 'lp-btn-valid' : ''}`} disabled={!isFormValid || loading} onClick={handleSubmit}>
                                    {loading ? <div className="lp-spinner" /> : <>PRENOTA ORA — È Gratuita <ArrowRight size={20} /></>}
                                </button>
                            </div>
                            <p className="lp-hf-privacy">🔒 I tuoi dati sono al sicuro. Zero spam.</p>
                            <div className="lp-hf-viewers"><span className="lp-urgency-dot" /><strong>{viewerCount}</strong> genitori stanno guardando ora</div>
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
                        <span>Se hai riconosciuto tuo figlio, <strong>il problema NON è tecnico. È mentale.</strong> E con il Mental Coaching giusto, si risolve in 90 giorni.</span>
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
                            { icon: <Target size={24} />, title: 'Coach Dedicato', desc: 'Un professionista CONI assegnato solo a tuo figlio. Non gruppi, non videocorsi.' },
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

            {/* Pixel */}
            {funnel.meta_pixel_id && (
                <script dangerouslySetInnerHTML={{ __html: `!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${funnel.meta_pixel_id}');` }} />
            )}

            <style>{STYLES}</style>
        </div>
    )
}

const STYLES = ``
