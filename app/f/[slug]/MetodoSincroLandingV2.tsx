'use client'

import './landing-v2.css'
import { useState, useEffect, useRef, useCallback } from 'react'
import Image from 'next/image'
import { CheckCircle, ArrowRight, Star, Shield, Clock, Trophy, Phone, Mail, User, Sparkles, ChevronDown, Zap, Target, Brain, Award, Users, TrendingUp, Lock, MessageCircle, Gift } from 'lucide-react'
import { useMetaTracking, fireAdvancedMatching, firePixelEvent, fireInitiateCheckout } from '@/lib/useMetaTracking'

interface Props {
    funnel: {
        id: string; name: string; description?: string; meta_pixel_id?: string
        settings?: any; organizations?: any; objective?: string
    };
    routingAngles?: any[];
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

export default function MetodoSincroLandingV2({ funnel, routingAngles }: Props) {
    const [fullName, setFullName] = useState('')
    const [fullNameError, setFullNameError] = useState('')
    const [phone, setPhone] = useState('')
    const [email, setEmail] = useState('')
    const [childAge, setChildAge] = useState('')
    const [phoneError, setPhoneError] = useState('')
    const [emailError, setEmailError] = useState('')
    const [submitAttempted, setSubmitAttempted] = useState(false)
    const [loading, setLoading] = useState(false)
    const [submitted, setSubmitted] = useState(false)
    const [error, setError] = useState('')
    const [openFaq, setOpenFaq] = useState<number | null>(null)
    const [viewerCount, setViewerCount] = useState(18)
    const [activeAngle, setActiveAngle] = useState<any>(null)
    const [customHeadline, setCustomHeadline] = useState<string | null>(null)
    const checkoutFiredRef = useRef(false)

    const handleFirstFieldFocus = useCallback(() => {
        if (checkoutFiredRef.current) return
        checkoutFiredRef.current = true
        fireInitiateCheckout(funnel.name)
    }, [funnel.name])

    // Easter egg / Dev tool per visualizzare la TKP
    useEffect(() => {
        if (typeof window !== 'undefined') {
            const urlParams = new URLSearchParams(window.location.search)
            if (urlParams.get('tkp') === 'true') setSubmitted(true)
        }
    }, [])
    const [showExitPopup, setShowExitPopup] = useState(false)
    const [showStickyBar, setShowStickyBar] = useState(false)
    const formRef = useRef<HTMLDivElement>(null)
    const exitShownRef = useRef(false)
    const scrollLockRef = useRef(false) // prevents fisarmonica during smooth scroll
    const reachedBottomRef = useRef(false) // tracks if user scrolled to bottom

    // Validation helpers
    const handleNameChange = (val: string) => {
        setFullName(val)
        if (!val.trim()) setFullNameError('Inserisci nome e cognome')
        else if (!val.trim().includes(' ')) setFullNameError('Inserisci anche il cognome')
        else setFullNameError('')
    }
    const handlePhoneChange = (val: string) => {
        setPhone(val)
        if (!val) setPhoneError('Telefono obbligatorio')
        else if (!/^[+\d\s\-()]+$/.test(val) || val.length < 5) setPhoneError('Inserisci solo numeri')
        else setPhoneError('')
    }
    const handleEmailChange = (val: string) => {
        setEmail(val)
        if (!val.trim()) setEmailError('Email obbligatoria')
        else if (!val.includes('@')) setEmailError('Inserisci un\'email valida (con @)')
        else setEmailError('')
    }
    
    // Evaluate if fields are actually completely valid for styling (green borders)
    const isNameValid = fullName.trim().length > 0 && fullName.trim().includes(' ') && !fullNameError
    const isPhoneValid = phone.trim().length > 4 && !phoneError
    const isEmailValid = email.trim().length > 0 && email.includes('@') && !emailError
    const isFormValid = isNameValid && isPhoneValid && isEmailValid

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

    // Detect ad angle / adset angle from global UTM string matching against the database
    useEffect(() => {
        const params = new URLSearchParams(window.location.search)
        
        // Estrai il titolo dell'ad se passato per avere congruenza 100% (Parametro Volontario)
        let paramTitle = params.get('ad_title') || params.get('headline') || params.get('titolo')
        
        // NUOVO SUPER POTERE: Se non c'è nei parametri, leggi utm_content (Nome dell'Ad di Facebook)
        // e cerca se Antonio ha inserito "T: " o "Titolo: " nel nome dell'inserzione.
        if (!paramTitle) {
            const adName = params.get('utm_content') || '';
            const titleMatch = adName.match(/(?:T:|Titolo:|Headline:)\s*(.+)/i);
            if (titleMatch && titleMatch[1]) {
                paramTitle = titleMatch[1].trim();
            }
        }

        if (paramTitle) {
            setCustomHeadline(paramTitle)
        }

        // SALVATAGGIO ADSET UNIFICATI & DATABASE ROUTING
        // Cerca l'angolo storico sia nell'Adset (utm_term) sia nel Nome Inserzione (utm_content)
        const term = (params.get('utm_term') || '').toLowerCase()
        const content = (params.get('utm_content') || '').toLowerCase()
        const t = `${term} ${content}`
        
        if (!t.trim() || !routingAngles || routingAngles.length === 0) return
        
        // Cerca la prima trigger_keyword del DB che fa match con la stringa globale passata
        const match = routingAngles.find((r: any) => t.includes(r.trigger_keyword.toLowerCase()))
        if (match) {
            setActiveAngle(match)
        }
    }, [routingAngles])

    // Exit intent — ONLY after user has scrolled to bottom of page
    useEffect(() => {
        const triggerExit = () => {
            if (exitShownRef.current || submitted || !reachedBottomRef.current) return
            exitShownRef.current = true
            setShowExitPopup(true)
        }

        // Track if user reached the bottom of the page
        const handleScroll = () => {
            const scrollTop = window.scrollY
            const docHeight = document.documentElement.scrollHeight
            const winHeight = window.innerHeight
            // User reached bottom when within 150px of the end
            if (scrollTop + winHeight >= docHeight - 150) {
                reachedBottomRef.current = true
            }
        }

        // Desktop: mouse leaves viewport (only after bottom reached)
        const handleMouseLeave = (e: MouseEvent) => {
            if (e.clientY <= 0 && reachedBottomRef.current) triggerExit()
        }

        // Mobile: user scrolls back up significantly after reaching bottom
        let lastScrollY = 0
        const handleScrollUp = () => {
            const currentY = window.scrollY
            if (reachedBottomRef.current && currentY < lastScrollY - 300 && currentY < document.documentElement.scrollHeight * 0.5) {
                triggerExit()
            }
            lastScrollY = currentY
        }

        // Start listening after 5s to avoid false triggers
        const timeout = setTimeout(() => {
            window.addEventListener('scroll', handleScroll, { passive: true })
            window.addEventListener('scroll', handleScrollUp, { passive: true })
            document.addEventListener('mouseleave', handleMouseLeave)
        }, 5000)

        return () => {
            clearTimeout(timeout)
            window.removeEventListener('scroll', handleScroll)
            window.removeEventListener('scroll', handleScrollUp)
            document.removeEventListener('mouseleave', handleMouseLeave)
        }
    }, [submitted])

    // Sticky bottom bar: show when form is scrolled past
    useEffect(() => {
        const handleScroll = () => {
            if (scrollLockRef.current) return
            const formBottom = formRef.current?.getBoundingClientRect().bottom || 0
            setShowStickyBar(formBottom < 0)
        }
        window.addEventListener('scroll', handleScroll, { passive: true })
        handleScroll()
        return () => window.removeEventListener('scroll', handleScroll)
    }, [])

    const scrollToForm = () => {
        // Lock the sticky bar to prevent fisarmonica during smooth scroll
        scrollLockRef.current = true
        setShowStickyBar(false)
        formRef.current?.scrollIntoView({ behavior: 'smooth' })
        // Unlock after scroll animation completes
        setTimeout(() => { scrollLockRef.current = false }, 1200)
    }

    const handleSubmit = async () => {
        setSubmitAttempted(true)

        let isValid = true
        if (!isNameValid) { setFullNameError(fullNameError || 'Inserisci nome e cognome'); isValid = false }
        if (!isPhoneValid) { setPhoneError(phoneError || 'Telefono obbligatorio'); isValid = false }
        if (!isEmailValid) { setEmailError(emailError || 'Email obbligatoria'); isValid = false }

        if (!isValid) return

        setLoading(true)
        setError('')

        // Generate Lead event_id for dedup
        const leadEventId = `lead_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`

        try {
            const nameToPass = fullName.trim()
            // Advanced Matching via shared helper: we split the name for fn and ln locally, same as backend
            const fn = nameToPass.split(' ')[0] || ''
            const ln = nameToPass.split(' ').slice(1).join(' ') || ''
            if (funnel.meta_pixel_id) fireAdvancedMatching(funnel.meta_pixel_id, { email, phone, fn, ln })

            const res = await fetch('/api/submit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    funnel_id: funnel.id,
                    name: nameToPass, email, phone,
                    page_variant: funnel.settings?.ab_variant || 'A',
                    extra_data: {
                        sport: 'calcio',
                        child_age: childAge,
                        adset_angle: activeAngle ? activeAngle.trigger_keyword : undefined
                    },
                    landing_url: window.location.href,
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
            <div className="lp">
                <main className="lp-ty-modern">
                    <div className="lp-ty-header">
                        <div className="lp-ty-success-pulse">
                            <CheckCircle size={56} color="#22c55e" />
                        </div>
                        <h1>Perfetto{fullName ? `, ${fullName.split(' ')[0]}` : ''}! ⚽</h1>
                        <p>La tua richiesta è stata inviata con successo. Segui questi 3 passaggi ora:</p>
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
        <div className="lp">
            {/* Sticky Header */}
            <header className="lp-header">
                <div className="lp-header-in">
                    <div className="lp-logo">METODO SINCRO<sup>®</sup> <span className="lp-logo-author">di Antonio Valente</span></div>
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
                        {customHeadline ? (
                            <>
                                <h1>
                                    {customHeadline.split(' ').map((word, i, arr) => 
                                        i >= Math.ceil(arr.length / 2) 
                                            ? <span key={i} className="lp-gold">{word} </span> 
                                            : <span key={i}>{word} </span>
                                    )}
                                </h1>
                                <p className="lp-hero-sub">Sai che ha il talento. Ma qualcosa lo blocca ogni volta. <strong>Non è un problema tecnico — è un problema di mentalità.</strong> E con il percorso giusto, si risolve in 90 giorni. Il <strong>Metodo Sincro®</strong> è il percorso di Mental Coaching ONE-TO-ONE <strong>garantito per contratto</strong>.</p>
                            </>
                        ) : activeAngle ? (
                            <>
                                <h1>{activeAngle.headline_white} <br /><span className="lp-gold">{activeAngle.headline_gold}</span></h1>
                                <p className="lp-hero-sub">{activeAngle.subtitle}</p>
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
                            <div className="lp-hf-trust" style={{ alignItems: 'center' }}>
                                <div><Lock size={12} /> Dati protetti</div>
                                <div><Clock size={12} /> 30 secondi</div>
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '1px' }}>
                                    <span style={{ color: '#00b67a', fontWeight: 800, fontSize: '13px', letterSpacing: '-0.3px', fontFamily: '-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica, Arial, sans-serif', lineHeight: 1, paddingLeft: '1px' }}>Trustpilot</span>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                                        {[1,2,3,4,5].map(i => <Star key={i} size={10} fill="#facc15" color="#facc15" />)} 
                                        <span style={{ marginLeft: '2px', fontWeight: 700, color: '#3f3f46', lineHeight: 1 }}>4.9</span>
                                    </div>
                                </div>
                            </div>
                            <div className="lp-hf-fields">
                                <div className="lp-field">
                                    <div className={`lp-input-wrap ${isNameValid ? 'filled' : ''} ${(submitAttempted && !isNameValid) || fullNameError ? 'has-error' : ''}`}>
                                        <User size={18} style={{ flexShrink: 0 }} />
                                        <input type="text" placeholder="Nome e Cognome *" value={fullName} onChange={e => handleNameChange(e.target.value)} onFocus={handleFirstFieldFocus} style={{ minWidth: 0, width: '100%' }} />
                                    </div>
                                    {((submitAttempted && !isNameValid) || fullNameError) && <span className="lp-field-error">{fullNameError}</span>}
                                </div>
                                <div className="lp-field">
                                    <div className={`lp-input-wrap ${isPhoneValid ? 'filled' : ''} ${(submitAttempted && !isPhoneValid) || phoneError ? 'has-error' : ''}`}><Phone size={18} /><input type="tel" placeholder="Telefono * (+39...)" value={phone} onChange={e => handlePhoneChange(e.target.value)} /></div>
                                    {((submitAttempted && !isPhoneValid) || phoneError) && <span className="lp-field-error">{phoneError}</span>}
                                </div>
                                <div className="lp-field">
                                    <div className={`lp-input-wrap ${isEmailValid ? 'filled' : ''} ${(submitAttempted && !isEmailValid) || emailError ? 'has-error' : ''}`}><Mail size={18} /><input type="email" placeholder="Email *" value={email} onChange={e => handleEmailChange(e.target.value)} /></div>
                                    {((submitAttempted && !isEmailValid) || emailError) && <span className="lp-field-error">{emailError}</span>}
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

            {/* ══════════ STICKY BOTTOM BAR ══════════ */}
            {showStickyBar && !submitted && (
                <div className="lp-sticky-bar" onClick={scrollToForm}>
                    <div className="lp-sticky-bar-in">
                        <div className="lp-sticky-bar-brand">
                            <span className="lp-sticky-bar-text">Affidati al team di Mental Coach <strong>n.1 in Italia</strong> nel Calcio</span>
                        </div>
                        <button className="lp-sticky-bar-cta" onClick={(e) => { e.stopPropagation(); scrollToForm() }}>
                            Prenota la Consulenza <ArrowRight size={16} />
                        </button>
                    </div>
                </div>
            )}

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
    .lp-name-row { grid-template-columns: 1fr !important; gap: 12px !important; }
}
`
