'use client'

import './landing-v2.css'
import { useState, useEffect, useRef, useCallback, type CSSProperties } from 'react'
import Image from 'next/image'
import Script from 'next/script'
import { parseVturbEmbed, vturbFrameSrc, VTURB_SDK_SRC } from '@/lib/vturb'
import { Check, CheckCircle, ArrowRight, Star, Shield, Clock, Trophy, Phone, Mail, User, Sparkles, ChevronDown, Zap, Target, Brain, Award, Users, TrendingUp, Lock, MessageCircle } from 'lucide-react'
import { useMetaTracking, fireAdvancedMatching, firePixelEvent, fireStartForm } from '@/lib/useMetaTracking'

interface Props {
    funnel: {
        id: string; name: string; description?: string; meta_pixel_id?: string
        settings?: any; organizations?: any; objective?: string
    };
    routingAngles?: any[];
}

const FAMOUS_PLAYERS = [
    { name: 'Patrick Cutrone', role: 'Attaccante', team: 'Monza', img: '/images/calciatori/cutrone.jpg' },
    { name: 'Matteo Brunori', role: 'Attaccante, Capitano', team: 'Palermo', img: '/images/calciatori/brunori.jpg' },
    { name: 'Barbara Bonansea', role: 'Attaccante', team: 'Juventus · Nazionale', img: '/images/calciatori/bonansea.jpg' },
    { name: 'Martina Piemonte', role: 'Attaccante', team: 'Roma · Nazionale', img: '/images/calciatori/piemonte.jpg' },
    { name: 'Simone Cinquegrano', role: 'Difensore', team: 'Sassuolo', img: '/images/calciatori/cinquegrano.jpg' },
    { name: 'Francesca Durante', role: 'Portiere', team: 'Como · Nazionale', img: '/images/calciatori/durante.jpg' },
    { name: 'Chiara Robustellini', role: 'Difensore, Capitana U23', team: 'Inter', img: '/images/calciatori/robustellini.jpg' },
    { name: 'Gianmarco Cangiano', role: 'Attaccante', team: 'Pescara', img: '/images/calciatori/cangiano.jpg' },
    { name: 'Riccardo Zoia', role: 'Difensore', team: 'Salernitana', img: '/images/calciatori/zoia.jpg' },
    { name: 'Annahita Zamanian', role: 'Centrocampista', team: 'Parma', img: '/images/calciatori/zamanian.jpg' },
    { name: 'Iris Rabot', role: 'Centrocampista', team: 'Parma', img: '/images/calciatori/rabot.jpg' },
    { name: 'Filippo Frison', role: 'Difensore', team: 'Trento', img: '/images/calciatori/frison.jpg' },
]

// Volti ritagliati dalle foto dei professionisti seguiti, per lo stack di credibilita'
// accanto a TrustPilot. Sono gli stessi atleti della sezione "La prova": nessun volto inventato.
const AVATAR_FACES = [
    { slug: 'bonansea', name: 'Barbara Bonansea' },
    { slug: 'piemonte', name: 'Martina Piemonte' },
    { slug: 'durante', name: 'Francesca Durante' },
    { slug: 'brunori', name: 'Matteo Brunori' },
    { slug: 'cutrone', name: 'Patrick Cutrone' },
]


const REVIEWS = [
    { name: 'Francesco G.', text: "All'inizio ero scettico, ma mi sono ricreduto vedendo i miglioramenti di mio figlio. Reagisce benissimo alle delusioni e questo ha rilassato tutta la famiglia.", role: 'Papà di Matteo, 14 anni' },
    { name: 'Antonietta G.', text: "Ero scettica, ma dovevo fare qualcosa per mio figlio. Ora è un ragazzo pronto ad affrontare la vita a testa alta. Grazie Metodo Sincro!", role: 'Mamma di Luca, 16 anni' },
    { name: 'Simona R.', text: "Ha acquisito maggiore consapevolezza delle sue potenzialità. Oggi si sente più sicuro, mentre prima taceva per paura di sbagliare.", role: 'Mamma di Andrea, 15 anni' },
    { name: 'Marco D.', text: "In 3 mesi mio figlio è passato dalla panchina a titolare fisso. Non è solo il calcio, è cambiato come persona. Il mental coaching funziona.", role: 'Papà di Giacomo, 13 anni' },
]

const FAQ_ITEMS = [
    { q: 'Quanto dura il percorso?', a: 'Dipende dalle esigenze di tuo figlio. Si parte da 3 mesi con sessioni settimanali ONE-TO-ONE e si può arrivare a coprire tutta la stagione, se serve accompagnarlo fino in fondo. I primi risultati li vedi già dopo 10 giorni.' },
    { q: 'Come si svolge? Devo portarlo da qualche parte?', a: 'No, il percorso è 100% online. Le sessioni si svolgono comodamente da casa via videochiamata, in totale flessibilità.' },
    { q: 'Funziona davvero? E se non vedo risultati?', a: 'Siamo gli unici in Italia con garanzia sul miglioramento SCRITTA nel contratto. Se non vedi miglioramenti misurabili, o non paghi, o continuiamo gratis fino al risultato. 2.100+ famiglie possono confermarlo.' },
    { q: 'A che età funziona?', a: 'Lavoriamo con ragazzi dai 10 ai 20 anni. Ogni coach è specializzato per fascia di età e adatta il metodo al livello di maturità del ragazzo. Poi per calciatori sopra i 20 anni professionisti abbiamo un reparto dedicato: lì seguiamo calciatori e calciatrici di Serie A, B e Lega Pro.' },
    { q: 'Quanto costa?', a: 'Le tariffe dipendono dal percorso personalizzato. La prima consulenza è COMPLETAMENTE GRATUITA e senza impegno — lì ti spieghiamo tutto.' },
    { q: 'Mio figlio non vuole parlare con uno psicologo...', a: 'Normale. Nessun ragazzo vuole "parlare con qualcuno dei suoi problemi." E infatti qui non lo facciamo. Il Mental Coaching funziona come un allenamento — solo che invece dei muscoli, alleni la testa. Concentrazione, gestione della pressione, fiducia. Roba concreta, con obiettivi chiari ogni settimana. La maggior parte dei ragazzi, quando capisce di cosa si tratta davvero, vuole iniziare subito. È così sia per giovani calciatori e anche con tutti i calciatori professionisti con cui lavoriamo.' },
]

// Club in cui giocano gli atleti seguiti: alimenta il nastro sotto l'hero.
const CLUBS = ['Monza', 'Palermo', 'Juventus', 'Roma', 'Inter', 'Sassuolo', 'Como', 'Parma', 'Salernitana', 'Pescara', 'Trento', 'Nazionale Italiana']

// I sei blocchi dell'autodiagnosi. rgb = colore proprio della card.
const PAINS = [
    { icon: '😰', rgb: '239, 68, 68',  title: 'Ansia da prestazione', desc: 'Si blocca prima delle partite importanti. In allenamento è un altro.' },
    { icon: '👀', rgb: '249, 115, 22', title: 'Paura di sbagliare', desc: 'Non tira, non rischia, si nasconde. Ha paura del giudizio.' },
    { icon: '💔', rgb: '244, 63, 94',  title: 'Zero fiducia in sé', desc: "Non si sente mai all'altezza, anche quando la tecnica c'è." },
    { icon: '🪑', rgb: '245, 158, 11', title: 'Panchina costante', desc: 'Ha il talento ma non lo dimostra quando il mister guarda.' },
    { icon: '😤', rgb: '225, 29, 72',  title: 'Pressione insostenibile', desc: 'Sente il peso delle aspettative e crolla nei momenti decisivi.' },
    { icon: '🏥', rgb: '251, 146, 60', title: 'Blocco post-infortunio', desc: 'È guarito fisicamente ma ha paura di tornare a dare il massimo.' },
]

/* Contatore che parte quando la cifra entra in viewport. Con
   prefers-reduced-motion mostra subito il valore finale. */
function CountUp({ to, suffix = '', duration = 1500 }: { to: number; suffix?: string; duration?: number }) {
    const ref = useRef<HTMLElement>(null)
    const [n, setN] = useState(0)
    const started = useRef(false)
    useEffect(() => {
        const el = ref.current
        if (!el) return
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setN(to); return }
        const io = new IntersectionObserver(entries => {
            if (!entries[0].isIntersecting || started.current) return
            started.current = true
            io.disconnect()
            const t0 = performance.now()
            const tick = (t: number) => {
                const k = Math.min(1, (t - t0) / duration)
                setN(Math.round(to * (1 - Math.pow(1 - k, 3))))
                if (k < 1) requestAnimationFrame(tick)
            }
            requestAnimationFrame(tick)
        }, { threshold: 0.35 })
        io.observe(el)
        return () => io.disconnect()
    }, [to, duration])
    // toLocaleString('it-IT') non raggruppa i numeri di 4 cifre (2100 -> "2100"),
    // quindi il punto delle migliaia lo mettiamo noi.
    const fmt = n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')
    return <strong ref={ref}>{fmt}{suffix}</strong>
}

export default function MetodoSincroLandingV2({ funnel, routingAngles }: Props) {
    const [fullName, setFullName] = useState('')
    
    // Sport configuration state with default settings from funnel or falling back to calcio
    const [sportConfig, setSportConfig] = useState({
        targetAthletes: funnel.settings?.target_athletes || 'Giovani Calciatori',
        sportName: funnel.settings?.sport_name || 'calcio',
        athleteType: funnel.settings?.athlete_type || 'Calciatore',
        athletesProof: funnel.settings?.athletes_proof || 'calciatori di Serie A',
        hideSoccerProof: funnel.settings?.hide_soccer_proof || false,
    })

    const founderBio = sportConfig.sportName === 'tennis'
        ? "Fondatore del Metodo Sincro® e Presidente del Sincro Group SRL. Mental Coach specializzato nello sport di alto livello, ha aiutato atleti professionisti e giovani talenti a sbloccare il proprio potenziale mentale."
        : (funnel.settings?.founder_bio || "Fondatore del Metodo Sincro® e Presidente del Sincro Group SRL. Mental Coach specializzato nel calcio, ha aiutato calciatori di Serie A, B e Lega Pro a sbloccare il proprio potenziale mentale.")

    // Dynamically localize reviews & FAQs based on the current sport settings
    const localizedReviews = REVIEWS.map(item => {
        let text = item.text
        if (sportConfig.sportName !== 'calcio') {
            text = text.replace(/calcio/g, sportConfig.sportName)
        }
        return { ...item, text }
    })

    const localizedFaqItems = FAQ_ITEMS.map(item => {
        let a = item.a
        if (sportConfig.sportName !== 'calcio') {
            a = a
                .replace(/calciatori/g, sportConfig.targetAthletes.toLowerCase())
                .replace(/calciatrici/g, 'atlete')
                .replace(/calciatore/g, sportConfig.athleteType.toLowerCase())
                .replace(/calcio/g, sportConfig.sportName)
        }
        return { q: item.q, a }
    })
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

    // ── Video: l'embed VTurb si incolla dalla dashboard, in impostazioni funnel ──
    // Da qualsiasi variante del codice ricaviamo gli identificativi e mostriamo
    // sempre l'iframe. L'indirizzo si compone nel browser perche' include la
    // query della pagina e il parametro vl con l'URL corrente; stando in stato,
    // i re-render non lo riscrivono e il video non riparte da capo.
    const vturbIds = parseVturbEmbed(funnel.settings?.video_embed)
    const vturbKey = vturbIds ? `${vturbIds.account}/${vturbIds.player}` : ''
    const [vturbSrc, setVturbSrc] = useState<string | undefined>(undefined)
    useEffect(() => {
        if (!vturbKey) return
        const [account, player] = vturbKey.split('/')
        setVturbSrc(vturbFrameSrc({ account, player }, window.location.href, window.location.search))
    }, [vturbKey])

    // ── Autodiagnosi: i blocchi selezionati viaggiano col lead ──
    const [pains, setPains] = useState<string[]>([])
    const togglePain = (t: string) => setPains(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t])

    /* ── Barra di avanzamento lettura ──
       Prima girava su uno useState aggiornato a ogni evento di scroll: ogni
       frame ri-renderizzava tutta la landing, e si vedeva. Ora:
       1) dove il browser supporta le animazioni legate allo scroll, la barra
          e' pura CSS e non passa nemmeno dal main thread;
       2) altrimenti si scrive direttamente sul nodo dentro requestAnimationFrame,
          senza stato React e senza re-render. */
    const progressRef = useRef<HTMLSpanElement>(null)
    useEffect(() => {
        if (typeof CSS !== 'undefined' && CSS.supports?.('animation-timeline', 'scroll()')) return
        let raf = 0
        const paint = () => {
            raf = 0
            const el = progressRef.current
            if (!el) return
            const h = document.documentElement.scrollHeight - window.innerHeight
            const k = h > 0 ? Math.min(1, Math.max(0, window.scrollY / h)) : 0
            el.style.transform = `scaleX(${k})`
        }
        const onScroll = () => { if (!raf) raf = requestAnimationFrame(paint) }
        paint()
        window.addEventListener('scroll', onScroll, { passive: true })
        window.addEventListener('resize', onScroll)
        return () => {
            window.removeEventListener('scroll', onScroll)
            window.removeEventListener('resize', onScroll)
            if (raf) cancelAnimationFrame(raf)
        }
    }, [])

    // ── Comparsa progressiva delle sezioni ──
    useEffect(() => {
        const els = Array.from(document.querySelectorAll<HTMLElement>('.lp-rv:not([data-rv="in"])'))
        if (!els.length) return
        // Marcatore su data-attribute e non su className: className lo riscrive React
        // a ogni render (es. al click su una card), cancellando la classe aggiunta qui.
        const show = (el: Element) => el.setAttribute('data-rv', 'in')
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { els.forEach(show); return }
        const io = new IntersectionObserver(entries => {
            entries.forEach(e => { if (e.isIntersecting) { show(e.target); io.unobserve(e.target) } })
        }, { threshold: 0.08, rootMargin: '0px 0px -5% 0px' })
        els.forEach(el => io.observe(el))
        // Rete di sicurezza: se l'observer non scattasse, dopo 3s si vede comunque tutto.
        const t = setTimeout(() => els.forEach(show), 3000)
        return () => { io.disconnect(); clearTimeout(t) }
    }, [submitted])



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

    // Fire StartForm on first form field focus (with CAPI context)
    const handleFirstFieldFocus = useCallback(() => {
        if (checkoutFiredRef.current) return
        checkoutFiredRef.current = true
        fireStartForm(funnel.name, {
            orgId,
            visitorId: getVisitorId(),
            fbc: getFbIds().fbc,
            fbp: getFbIds().fbp,
        })
    }, [funnel.name, orgId, getVisitorId, getFbIds])

    // Detect ad angle / adset angle from global UTM string matching against the database
    useEffect(() => {
        const params = new URLSearchParams(window.location.search)
        
        // Dynamic sport detection: if URL parameters or UTMs suggest tennis, adapt page
        const utmCampaign = (params.get('utm_campaign') || '').toLowerCase()
        const utmContent = (params.get('utm_content') || '').toLowerCase()
        const utmTerm = (params.get('utm_term') || '').toLowerCase()
        const sportParam = (params.get('sport') || '').toLowerCase()
        
        const isTennis = sportParam === 'tennis' || 
                         utmCampaign.includes('tennis') || 
                         utmContent.includes('tennis') || 
                         utmTerm.includes('tennis')
                         
        if (isTennis) {
            setSportConfig({
                targetAthletes: 'Giovani Tennisti',
                sportName: 'tennis',
                athleteType: 'Tennista',
                athletesProof: 'tennisti professionisti',
                hideSoccerProof: true
            })
        } else if (funnel.settings?.sport_name) {
            // Keep funnel settings if defined
            setSportConfig({
                targetAthletes: funnel.settings.target_athletes || 'Giovani Calciatori',
                sportName: funnel.settings.sport_name || 'calcio',
                athleteType: funnel.settings.athlete_type || 'Calciatore',
                athletesProof: funnel.settings.athletes_proof || 'calciatori di Serie A',
                hideSoccerProof: funnel.settings.hide_soccer_proof || false
            })
        }

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
    }, [routingAngles, funnel.settings])

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
                        sport: sportConfig.sportName,
                        child_age: childAge,
                        adset_angle: activeAngle ? activeAngle.trigger_keyword : undefined,
                        pains: pains.length ? pains : undefined
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
                        <h1>Perfetto{fullName ? `, ${fullName.split(' ')[0]}` : ''}! {sportConfig.sportName === 'tennis' ? '🎾' : '⚽'}</h1>
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
                    .lp-ty-modern { max-width: 500px; margin: 24px auto; padding: 0 16px; font-family: inherit; display: flex; flex-direction: column; gap: 16px; }
                    .lp-ty-header { text-align: center; }
                    .lp-ty-success-pulse { display: inline-flex; animation: pulseSuccess 2s infinite; margin-bottom: 10px; border-radius: 50%; }
                    .lp-ty-header h1 { font-size: 26px; font-weight: 800; color: #fff; margin: 0 0 6px; letter-spacing: -0.5px; }
                    .lp-ty-header p { font-size: 14px; color: #a1a1aa; line-height: 1.4; margin: 0; }
                    
                    .lp-ty-steps { position: relative; display: flex; flex-direction: column; gap: 8px; }
                    .lp-ty-steps::before { content: ''; position: absolute; top: 36px; bottom: 36px; left: 30px; width: 2px; background: rgba(255,255,255,0.06); z-index: 0; }
                    .lp-ty-step { position: relative; z-index: 1; background: #131317; border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; padding: 12px; display: flex; gap: 12px; align-items: flex-start; transition: all 0.3s; }
                    .lp-ty-step:hover { background: #18181c; transform: translateY(-2px); border-color: rgba(255,255,255,0.15); }
                    .lp-ty-step-icon { position: relative; z-index: 2; width: 38px; height: 38px; border-radius: 10px; background: rgba(255,255,255,0.05); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
                    .lp-step-urgent { border-color: rgba(250, 204, 21, 0.15); }
                    .lp-step-urgent .lp-ty-step-icon { background: rgba(250, 204, 21, 0.1); border: 1px solid rgba(250, 204, 21, 0.2); }
                    .lp-step-prep .lp-ty-step-icon { background: rgba(56, 189, 248, 0.08); border: 1px solid rgba(56, 189, 248, 0.15); }
                    .lp-step-gift .lp-ty-step-icon { background: rgba(236, 72, 153, 0.1); border: 1px solid rgba(236, 72, 153, 0.2); }
                    
                    .lp-ty-step-content { flex: 1; min-width: 0; }
                    .lp-ty-badge-num { font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; color: #a1a1aa; margin-bottom: 2px; display: block; }
                    .lp-step-urgent .lp-ty-badge-num { color: #facc15; }
                    .lp-step-prep .lp-ty-badge-num { color: #38bdf8; }
                    .lp-step-gift .lp-ty-badge-num { color: #ec4899; }
                    .lp-ty-step-content h3 { font-size: 15px; font-weight: 700; color: #fff; margin: 0 0 3px 0; }
                    .lp-ty-step-content p { font-size: 13px; color: #d4d4d8; line-height: 1.4; margin: 0; word-break: break-word; }
                    .lp-ty-step-content ul { margin: 4px 0 0; padding-left: 16px; color: #d4d4d8; font-size: 12.5px; line-height: 1.5; list-style-type: disc; }
                    .lp-ty-step-content li { margin-bottom: 1px; }
                    .lp-ty-step-content strong { color: #e4e4e7; }
                    .lp-step-urgent p { color: #d4d4d8; }
                    .lp-step-urgent strong { color: #fff; font-weight: 800; }
                    
                    .lp-ty-footer { text-align: center; margin-top: 4px; }
                    .lp-trust-btn { display: inline-flex; align-items: center; justify-content: center; gap: 8px; width: 100%; padding: 13px; background: linear-gradient(135deg, #00b67a, #009567); color: #fff; font-weight: 700; font-size: 14px; border-radius: 12px; text-decoration: none; transition: all 0.2s; box-shadow: 0 4px 15px rgba(0, 182, 122, 0.3); }
                    .lp-trust-btn:hover { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(0, 182, 122, 0.4); }
                    .lp-site-link { display: inline-block; margin-top: 12px; font-size: 12px; color: #71717a; text-decoration: underline; transition: color 0.2s; }
                    .lp-site-link:hover { color: #d4d4d8; }
                    
                    @keyframes pulseSuccess { 0% { box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.4); } 70% { box-shadow: 0 0 0 12px rgba(34, 197, 94, 0); } 100% { box-shadow: 0 0 0 0 rgba(34, 197, 94, 0); } }

                    @media (max-width: 480px) {
                        .lp-ty-modern { margin: 12px auto; padding: 0 10px; gap: 10px; }
                        .lp-ty-success-pulse svg { width: 40px !important; height: 40px !important; }
                        .lp-ty-header h1 { font-size: 22px; }
                        .lp-ty-header p { font-size: 13px; }
                        .lp-ty-steps { gap: 6px; }
                        .lp-ty-steps::before { display: none; }
                        .lp-ty-step { flex-direction: column; padding: 12px 14px; gap: 0; border-radius: 10px; }
                        .lp-ty-step-icon { display: none; }
                        .lp-ty-badge-num { font-size: 10px; margin-bottom: 4px; display: flex; align-items: center; gap: 6px; }
                        .lp-ty-step-content h3 { font-size: 15px; margin-bottom: 4px; }
                        .lp-ty-step-content p { font-size: 13px; }
                        .lp-ty-step-content ul { font-size: 13px; padding-left: 16px; }
                        .lp-step-urgent { border-left: 3px solid #facc15; }
                        .lp-step-prep { border-left: 3px solid #38bdf8; }
                        .lp-step-gift { border-left: 3px solid #ec4899; }
                        .lp-trust-btn { padding: 12px; font-size: 14px; }
                        .lp-site-link { font-size: 11px; margin-top: 10px; }
                        .lp-ty-footer { margin-top: 2px; }
                    }

                    @media (max-width: 370px) {
                        .lp-ty-modern { padding: 0 8px; gap: 8px; }
                        .lp-ty-header h1 { font-size: 20px; }
                        .lp-ty-step { padding: 10px 12px; }
                        .lp-ty-step-content h3 { font-size: 14px; }
                        .lp-ty-step-content p { font-size: 12px; }
                        .lp-ty-step-content ul { font-size: 12px; }
                    }
                `}} />
            </div>
        )
    }

    /* ======================== MAIN PAGE ======================== */
    return (
        <div className="lp" data-sport={sportConfig.sportName === 'tennis' ? 'tennis' : 'calcio'}>
            {/* VTurb — precaricamento consigliato dal pannello. React solleva
                questi <link> dentro l'head. Il crossOrigin sul manifest non c'e'
                nello snippet originale ma senza il preload as="fetch" viene
                scartato e il file riscaricato. */}
            {vturbIds && (
                <>
                    <Script id="vturb-sdk" src={VTURB_SDK_SRC} strategy="afterInteractive" />
                    <link rel="dns-prefetch" href="https://cdn.converteai.net" />
                    <link rel="dns-prefetch" href="https://scripts.converteai.net" />
                    <link rel="dns-prefetch" href="https://images.converteai.net" />
                    <link rel="dns-prefetch" href="https://license.vturb.com" />
                </>
            )}

            {/* Senza JS la comparsa progressiva lascerebbe la pagina vuota */}
            <noscript>
                <style>{`.lp-rv{opacity:1!important;transform:none!important}`}</style>
            </noscript>

            {/* Barra di avanzamento lettura */}
            <div className="lp-progress" aria-hidden="true">
                <span ref={progressRef} />
            </div>

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
                        <div className="lp-badge"><Trophy size={14} /><span>Il <span className="lp-badge-highlight">Mental Coaching</span> #1 in Italia per {sportConfig.targetAthletes}</span></div>
                        {customHeadline ? (
                            <>
                                <h1>
                                    {customHeadline.split(' ').map((word, i, arr) => 
                                        i >= Math.ceil(arr.length / 2) 
                                            ? <span key={i} className="lp-gold">{word} </span> 
                                            : <span key={i}>{word} </span>
                                    )}
                                </h1>
                                <p className="lp-hero-sub">Ha il talento — lo vedi ogni giorno. Ma qualcosa <strong>lo blocca ogni volta</strong>. Non è un problema tecnico — è una questione di <strong>approccio mentale</strong>. E con il percorso giusto, si risolve in 90 giorni. Il <strong>Metodo Sincro®</strong> è il percorso di Mental Coaching ONE-TO-ONE <strong>garantito per contratto</strong>.</p>
                            </>
                        ) : activeAngle ? (
                            <>
                                <h1>{activeAngle.headline_white} <br /><span className="lp-gold">{activeAngle.headline_gold}</span></h1>
                                <p className="lp-hero-sub" dangerouslySetInnerHTML={{ __html: activeAngle.subtitle }} />
                            </>
                        ) : (
                            <>
                                {funnel.settings?.headline ? (
                                    <h1>
                                        {funnel.settings.headline.includes('<span') || funnel.settings.headline.includes('<br') ? (
                                            <span dangerouslySetInnerHTML={{ __html: funnel.settings.headline }} />
                                        ) : (
                                            funnel.settings.headline.split(' ').map((word: string, i: number, arr: string[]) => 
                                                i >= Math.ceil(arr.length / 2) 
                                                    ? <span key={i} className="lp-gold">{word} </span> 
                                                    : <span key={i}>{word} </span>
                                            )
                                        )}
                                    </h1>
                                ) : (
                                    <h1>In Soli 90 Giorni Tuo Figlio<br /><span className="lp-gold">Sarà un {sportConfig.athleteType} di Un'Altra Categoria...</span></h1>
                                )}
                                <p className="lp-hero-sub" dangerouslySetInnerHTML={{ __html: funnel.settings?.subheadline || `Il percorso di <strong>Mental Coaching sportivo ONE-TO-ONE</strong> con coach <strong>CONI certificati</strong>, specializzati <strong>in ${sportConfig.sportName} e per fascia d'età</strong>. Elimina ansia da prestazione, paura del giudizio e blocchi mentali — con <strong>garanzia sul miglioramento scritta nel contratto</strong>.` }} />
                            </>
                        )}
                        {vturbIds && (
                            <div className="lp-vsl">
                                <iframe
                                    className="lp-vsl-box"
                                    src={vturbSrc}
                                    title="Metodo Sincro — presentazione"
                                    allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
                                    referrerPolicy="origin"
                                    allowFullScreen
                                    scrolling="no"
                                />
                            </div>
                        )}
                        <div className="lp-hero-author">
                            <span className="lp-hero-author-img">
                                <Image src="/images/team/antonio-avatar.jpg" alt="Antonio Valente" width={52} height={52} priority />
                            </span>
                            <span className="lp-hero-author-txt">
                                <strong>Antonio Valente</strong>
                                <span>Fondatore Metodo Sincro<sup>&reg;</sup> &middot; Mental Coach di {sportConfig.sportName === 'tennis' ? 'Atleti' : 'Calciatori'} Professionisti</span>
                            </span>
                        </div>
                        <div className="lp-hero-proof">
                            {!sportConfig.hideSoccerProof && (
                                <div className="lp-proof-item"><CheckCircle size={16} color="#22c55e" /><span>Dalla <strong>Serie A</strong> al <strong>settore giovanile</strong></span></div>
                            )}
                            <div className="lp-proof-item"><CheckCircle size={16} color="#22c55e" /><span><strong>4.9★</strong> TrustPilot (356 recensioni)</span></div>
                            <div className="lp-proof-item"><CheckCircle size={16} color="#22c55e" /><span>Se non funziona, <strong>o non paghi, o continuiamo gratis</strong></span></div>
                        </div>
                        <div className="lp-promise">
                            <span className="lp-promise-num">10<em>giorni</em></span>
                            <span className="lp-promise-txt">I primi risultati li vedrai in <strong>soli 10 giorni</strong></span>
                        </div>
                    </div>
                    <div className="lp-hero-form" ref={formRef} id="ms-form">
                        <div className="lp-hf-card">
                            <div className="lp-hf-header">
                                <span className="lp-hf-live">⚡ POSTI LIMITATI</span>
                            </div>
                            <h3 className="lp-hf-title">Prenota la Consulenza <span className="lp-gold">Gratuita</span></h3>
                            <p className="lp-hf-sub">Compila il form — ti richiamiamo noi</p>
                            <div className="lp-hf-social">
                                <div className="lp-avatars">
                                    {AVATAR_FACES.map(a => (
                                        <span key={a.slug} className="lp-avatar">
                                            <Image src={`/images/calciatori/av-${a.slug}.jpg`} alt={a.name} width={96} height={96} />
                                        </span>
                                    ))}
                                    <span className="lp-avatar lp-avatar-count">+2.1k</span>
                                </div>
                                <p className="lp-hf-social-txt"><strong>2.100+ atleti seguiti</strong>, tra cui professionisti di Serie A e Nazionale</p>
                            </div>
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
                                    {loading ? <div className="lp-spinner" /> : <>Parlaci di tuo figlio/a <ArrowRight size={20} /></>}
                                </button>
                            </div>
                            <p className="lp-hf-privacy">🔒 I tuoi dati sono al sicuro. Zero spam.</p>
                            <p className="lp-hf-next">Ti richiamiamo noi — <strong>15 minuti, senza impegno</strong></p>
                            <div className="lp-hf-viewers"><span className="lp-urgency-dot" /><strong>{viewerCount}</strong> genitori stanno guardando ora</div>
                        </div>
                    </div>
                </div>
            </section>

            {/* ══════════ NASTRO CLUB ══════════ */}
            {!sportConfig.hideSoccerProof && (
                <div className="lp-ticker" role="region" aria-label={`Club in cui giocano gli atleti seguiti: ${CLUBS.join(', ')}`}>
                    <p className="lp-ticker-label">Dove giocano gli atleti che seguiamo</p>
                    <div className="lp-ticker-vp">
                        <div className="lp-ticker-track" aria-hidden="true">
                            {[0, 1].map(k => (
                                <div className="lp-ticker-set" key={k}>
                                    {CLUBS.map(c => <span key={c}>{c}</span>)}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* ══════════ 2. PAIN POINTS ══════════ */}
            <section className="lp-pain">
                <div className="lp-container">
                    <p className="lp-section-pre">IL PROBLEMA</p>
                    <h2>Riconosci tuo figlio in <span className="lp-gold">almeno una</span> di queste?</h2>
                    <p className="lp-pain-hint">Tocca quelle in cui lo riconosci — te lo diciamo subito</p>
                    <div className="lp-pain-grid">
                        {PAINS.map((p, i) => {
                            const on = pains.includes(p.title)
                            return (
                                <button
                                    type="button" key={p.title} aria-pressed={on}
                                    className={`lp-pain-card lp-rv ${on ? 'is-on' : ''}`}
                                    style={{ '--pc': p.rgb, '--d': `${i * 55}ms` } as CSSProperties}
                                    onClick={() => togglePain(p.title)}
                                >
                                    <span className="lp-pain-icon" aria-hidden="true">{p.icon}</span>
                                    <span className="lp-pain-tick" aria-hidden="true"><Check size={13} strokeWidth={3.5} /></span>
                                    <span className="lp-pain-title">{p.title}</span>
                                    <span className="lp-pain-desc">{p.desc}</span>
                                </button>
                            )
                        })}
                    </div>
                    <div className={`lp-pain-result ${pains.length ? 'is-live' : ''}`} aria-live="polite">
                        <Brain size={20} color="#facc15" />
                        <span>
                            {pains.length === 0 && <>Se hai riconosciuto tuo figlio, <strong>il problema NON è tecnico. È di mentalità.</strong> E con il Mental Coaching giusto, si risolve in 90 giorni.</>}
                            {pains.length === 1 && <>Ne hai selezionata <strong>1</strong>. Ne basta una per tenere fermo un ragazzo di talento: <strong>non è un limite tecnico, è di mentalità</strong>.</>}
                            {pains.length > 1 && pains.length <= 3 && <>Ne hai selezionate <strong>{pains.length}</strong>. È il profilo che vediamo più spesso — <strong>non è un limite tecnico, è di mentalità</strong>. Si lavora in 90 giorni.</>}
                            {pains.length > 3 && <>Ne hai selezionate <strong>{pains.length}</strong> su 6. Sembrano problemi diversi, ma <strong>hanno tutte la stessa radice</strong>: è esattamente lì che interviene il Mental Coaching.</>}
                        </span>
                    </div>
                    <button className="lp-cta-section" onClick={scrollToForm}>Parlaci di tuo figlio/a <ArrowRight size={18} /></button>
                </div>
            </section>

            {/* ══════════ 3. SOCIAL PROOF ══════════ */}
            {!sportConfig.hideSoccerProof && (
                <section className="lp-social">
                    <div className="lp-container">
                        <p className="lp-section-pre">LA PROVA</p>
                        <h2>Lo stesso metodo usato da {sportConfig.athletesProof}</h2>
                        <p className="lp-social-sub">Non è teoria: questi professionisti hanno scelto Metodo Sincro® per la loro preparazione mentale. Lo stesso metodo, con gli stessi coach, lo portiamo nel settore giovanile.</p>
                        <div className="lp-players">
                            {FAMOUS_PLAYERS.map((p, i) => (
                                <figure key={p.name} className="lp-player lp-rv" style={{ '--d': `${i * 45}ms` } as CSSProperties}>
                                    <Image src={p.img} alt={`${p.name} — ${p.role}, ${p.team}`} width={412} height={466} loading="lazy" />
                                    <figcaption>
                                        <strong>{p.name}</strong>
                                        <span className="lp-player-team">{p.team}</span>
                                        <span className="lp-player-role">{p.role}</span>
                                    </figcaption>
                                </figure>
                            ))}
                        </div>
                        <div className="lp-bridge lp-rv">
                            <div className="lp-bridge-col">
                                <span className="lp-bridge-tag">Da anni</span>
                                <strong>Seguiamo {sportConfig.athletesProof}</strong>
                                <span className="lp-bridge-sub">…e molti altri professionisti</span>
                            </div>
                            <div className="lp-bridge-arrow" aria-hidden="true"><ArrowRight size={22} /></div>
                            <div className="lp-bridge-col is-you">
                                <span className="lp-bridge-tag">Da oggi</span>
                                <strong>Possiamo seguire tuo figlio</strong>
                                <span className="lp-bridge-sub">Stesso metodo, stessi coach</span>
                            </div>
                        </div>
                        <div className="lp-stats-row lp-rv">
                            <div className="lp-stat-big"><CountUp to={2100} suffix="+" /><span>Atleti seguiti</span></div>
                            <div className="lp-stat-big"><CountUp to={11500} suffix="+" /><span>Ore di coaching</span></div>
                            <div className="lp-stat-big"><CountUp to={356} suffix="" /><span>Recensioni 5★</span></div>
                            <div className="lp-stat-big"><CountUp to={30} suffix="+" /><span>Coach nel team</span></div>
                        </div>
                    </div>
                </section>
            )}

            {/* ══════════ 4. COME FUNZIONA ══════════ */}
            <section className="lp-how">
                <div className="lp-container">
                    <p className="lp-section-pre">IL SISTEMA</p>
                    <h2>3 Fasi. 90 Giorni. <span className="lp-gold">Risultati Misurabili.</span></h2>
                    <p className="lp-how-sub">Non è motivazione. È un protocollo scientifico con risultati tracciabili settimana dopo settimana.</p>
                    <div className="lp-timeline lp-rv">
                        <div className="lp-step"><div className="lp-step-num">1</div><div className="lp-step-content"><h3>Consulenza Gratuita</h3><p>Parli con un nostro esperto per 15 minuti. Analizziamo la situazione e capiamo se il percorso è adatto.</p></div></div>
                        <div className="lp-step"><div className="lp-step-num">2</div><div className="lp-step-content"><h3>Percorso Personalizzato</h3><p>Creiamo un piano <strong>ONE-TO-ONE</strong> su misura. Coach dedicato, specializzato per la sua fascia d'età.</p></div></div>
                        <div className="lp-step"><div className="lp-step-num">3</div><div className="lp-step-content"><h3>Trasformazione in 90 Giorni</h3><p>Sessioni settimanali online. Report progressi. Miglioramenti misurabili e <strong>garantiti per contratto</strong>.</p></div></div>
                    </div>
                    <div className="lp-how-note">
                        <Shield size={18} color="#22c55e" />
                        <span><strong>Non è un allenamento tecnico, non è un procuratore.</strong> È Mental Coaching puro — ogni sessione è individuale, live, con un coach specializzato in {sportConfig.sportName} e per la sua fascia d'età.</span>
                    </div>
                    <button className="lp-cta-section" onClick={scrollToForm}>Parlaci di tuo figlio/a <ArrowRight size={18} /></button>
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
                            { icon: <Clock size={24} />, title: 'Risultati in 90 Giorni', desc: 'Si parte da 3 mesi e si può estendere a tutta la stagione, con milestones misurabili settimana per settimana.' },
                            { icon: <Shield size={24} />, title: 'Garanzia Contrattuale', desc: 'Gli UNICI in Italia con il miglioramento garantito per iscritto. Se non funziona, o non paghi, o continuiamo gratis.' },
                            { icon: <Zap size={24} />, title: '100% Online', desc: 'Sessioni comode da casa, via videochiamata. Zero spostamenti, massima flessibilità.' },
                            { icon: <TrendingUp size={24} />, title: 'Report Settimanali', desc: 'Ogni settimana ricevi un report dettagliato sui progressi di tuo figlio.' },
                            { icon: <Award size={24} />, title: 'Metodo dei Campioni', desc: `Lo stesso sistema usato da ${sportConfig.athletesProof} per la preparazione mentale.` },
                        ].map((b, i) => (
                            <div key={b.title} className="lp-benefit lp-rv" style={{ '--d': `${i * 55}ms` } as CSSProperties}>
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
                    <div className="lp-guarantee-card lp-rv">
                        {/* Sigillo: senza un bollo riconoscibile la garanzia non si legge come tale */}
                        <div className="lp-seal" aria-hidden="true">
                            <svg viewBox="0 0 120 120">
                                <defs>
                                    <linearGradient id="ms-seal-g" x1="0" y1="0" x2="1" y2="1">
                                        <stop offset="0%" stopColor="#fde047" />
                                        <stop offset="55%" stopColor="#facc15" />
                                        <stop offset="100%" stopColor="#b45309" />
                                    </linearGradient>
                                </defs>
                                <path d="M60.00,5.00 A7.83,7.83 0 0 1 75.50,7.23 A7.83,7.83 0 0 1 89.74,13.73 A7.83,7.83 0 0 1 101.57,23.98 A7.83,7.83 0 0 1 110.03,37.15 A7.83,7.83 0 0 1 114.44,52.17 A7.83,7.83 0 0 1 114.44,67.83 A7.83,7.83 0 0 1 110.03,82.85 A7.83,7.83 0 0 1 101.57,96.02 A7.83,7.83 0 0 1 89.74,106.27 A7.83,7.83 0 0 1 75.50,112.77 A7.83,7.83 0 0 1 60.00,115.00 A7.83,7.83 0 0 1 44.50,112.77 A7.83,7.83 0 0 1 30.26,106.27 A7.83,7.83 0 0 1 18.43,96.02 A7.83,7.83 0 0 1 9.97,82.85 A7.83,7.83 0 0 1 5.56,67.83 A7.83,7.83 0 0 1 5.56,52.17 A7.83,7.83 0 0 1 9.97,37.15 A7.83,7.83 0 0 1 18.43,23.98 A7.83,7.83 0 0 1 30.26,13.73 A7.83,7.83 0 0 1 44.50,7.23 A7.83,7.83 0 0 1 60.00,5.00 Z" fill="url(#ms-seal-g)" />
                                <circle cx="60" cy="60" r="45" fill="#080a09" />
                                <circle cx="60" cy="60" r="41" fill="none" stroke="#facc15" strokeOpacity="0.5" strokeWidth="1" strokeDasharray="2.5 3.5" />
                                <text x="60" y="44" textAnchor="middle" fill="#facc15" fontSize="11" fontWeight="800" letterSpacing="1.1">GARANZIA</text>
                                <path d="M52.5,66 l5.5,5.8 l11-13.2" fill="none" stroke="#22c55e" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
                                <text x="60" y="86" textAnchor="middle" fill="#e4e4e7" fontSize="7" fontWeight="700" letterSpacing="0.4">NEL CONTRATTO</text>
                            </svg>
                        </div>
                        <h2 style={{marginTop: 0}}>Garanzia Sul Miglioramento — <span style={{color:'#22c55e'}}>Scritta Nel Contratto</span></h2>
                        <p>Siamo gli <strong>UNICI</strong> in Italia nel settore del mental coaching sportivo ad offrire una garanzia sul miglioramento scritta nel contratto. Se non vedi miglioramenti misurabili, <strong>o non paghi, o continuiamo gratis</strong>.</p>
                        <div className="lp-guarantee-row">
                            <div><CheckCircle size={16} color="#22c55e" /> Zero rischi per te</div>
                            <div><CheckCircle size={16} color="#22c55e" /> Miglioramenti misurabili</div>
                            <div><CheckCircle size={16} color="#22c55e" /> Contratto trasparente</div>
                        </div>
                        <button className="lp-cta-main" onClick={scrollToForm} style={{margin:'24px auto 0', display:'flex'}}>Parlaci di tuo figlio/a <ArrowRight size={20} /></button>
                    </div>
                </div>
            </section>

            {/* ══════════ 7. RECENSIONI ══════════ */}
            <section className="lp-reviews">
                <div className="lp-container">
                    <h2>Cosa dicono i <span className="lp-gold">genitori</span></h2>
                    <p className="lp-reviews-sub">356 recensioni certificate — 4.9/5 su TrustPilot</p>
                    <div className="lp-reviews-grid">
                        {localizedReviews.map((r, i) => (
                            <div key={i} className="lp-review lp-rv" style={{ '--d': `${i * 60}ms` } as CSSProperties}>
                                <div className="lp-review-top">
                                    <div className="lp-review-stars">{[1,2,3,4,5].map(s => <Star key={s} size={14} fill="#facc15" color="#facc15" />)}</div>
                                    <span className="lp-review-badge"><CheckCircle size={11} /> Verificata</span>
                                </div>
                                <p>"{r.text}"</p>
                                <div className="lp-review-author">
                                    <span className="lp-review-av" aria-hidden="true">{r.name.charAt(0)}</span>
                                    <span className="lp-review-who"><strong>{r.name}</strong><span>{r.role}</span></span>
                                </div>
                            </div>
                        ))}
                    </div>
                    <button className="lp-cta-section" onClick={scrollToForm}>Parlaci di tuo figlio/a <ArrowRight size={18} /></button>
                </div>
            </section>

            {/* ══════════ 8. CHI SIAMO ══════════ */}
            <section className="lp-founder">
                <div className="lp-container">
                    <div className="lp-founder-grid lp-rv">
                        <div className="lp-founder-photo">
                            <Image src="/images/team/antonio-valente.jpg" alt="Antonio Valente, fondatore del Metodo Sincro" width={520} height={693} loading="lazy" />
                            <span className="lp-founder-photo-tag">
                                <span className="lp-founder-photo-dot" />
                                <span>Fondatore Metodo Sincro<sup>&reg;</sup></span>
                            </span>
                        </div>
                        <div className="lp-founder-text">
                            <span className="lp-eyebrow">Chi c’è dietro il metodo</span>
                            <h2>Chi è <span className="lp-gold">Antonio Valente</span></h2>
                            <p>{founderBio}</p>
                            <div className="lp-founder-badges">
                                <div><CountUp to={2100} suffix="+" /><span>Atleti</span></div>
                                <div><CountUp to={11500} suffix="+" /><span>Ore coaching</span></div>
                                <div><CountUp to={30} suffix="+" /><span>Team</span></div>
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
                        {localizedFaqItems.map((item, i) => (
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
                    <ol className="lp-next lp-rv">
                        <li><span>1</span><p>Lasci i contatti qui sopra. <strong>Ti richiamiamo noi</strong>, non devi fare altro.</p></li>
                        <li><span>2</span><p><strong>15 minuti al telefono</strong> per capire la situazione di tuo figlio. Niente presentazioni, solo domande.</p></li>
                        <li><span>3</span><p>Se il percorso è adatto a lui te lo diciamo. <strong>E se non lo è, te lo diciamo lo stesso.</strong></p></li>
                    </ol>
                    <button className="lp-cta-main" onClick={scrollToForm} style={{margin:'0 auto'}}>Parlaci di tuo figlio/a <ArrowRight size={20} /></button>
                </div>
            </section>

            {/* ══════════ STICKY BOTTOM BAR ══════════ */}
            {showStickyBar && !submitted && (
                <div className="lp-sticky-bar" onClick={scrollToForm}>
                    <div className="lp-sticky-bar-in">
                        <div className="lp-sticky-bar-brand">
                            <span className="lp-sticky-bar-text">Affidati al team di Mental Coach <strong>n.1 in Italia</strong> nel {sportConfig.sportName === 'tennis' ? 'Tennis' : 'Calcio'}</span>
                        </div>
                        <button className="lp-sticky-bar-cta" onClick={(e) => { e.stopPropagation(); scrollToForm() }}>
                            Parlaci di tuo figlio/a <ArrowRight size={16} />
                        </button>
                    </div>
                </div>
            )}

            {/* Footer */}
            <footer className="lp-footer">
                <p className="lp-footer-brand">{sportConfig.sportName === 'tennis' ? '🎾' : '⚽'} Metodo Sincro® — Percorsi di Mental Coaching <strong>ONE-TO-ONE</strong>, interamente <strong>ONLINE</strong>, con coach specializzati.</p>
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
                                <span className="lp-exit-obj-a">→ <strong>Garanzia scritta nel contratto:</strong> o migliora, o non paghi.</span>
                            </div>
                            <div className="lp-exit-obj">
                                <span className="lp-exit-obj-q">❌ "È troppo presto/tardi per mio figlio?"</span>
                                <span className="lp-exit-obj-a">→ Coach dedicati <strong>per ogni fascia d'età</strong> (dai 10 ai 20+ anni).</span>
                            </div>
                            <div className="lp-exit-obj">
                                <span className="lp-exit-obj-q">❌ "Non ho tempo per portarlo"</span>
                                <span className="lp-exit-obj-a">→ 100% online, sessioni <strong>ONE-TO-ONE su Zoom</strong>.</span>
                            </div>
                        </div>
                        <button className="lp-exit-cta" onClick={() => { setShowExitPopup(false); scrollToForm() }}>
                            Parlaci di tuo figlio/a <ArrowRight size={18} />
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
