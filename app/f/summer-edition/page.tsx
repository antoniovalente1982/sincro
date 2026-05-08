'use client'

import { useState, Suspense, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { motion } from 'framer-motion'
import { Loader2, CheckCircle2, ArrowRight, Lock, Clock, Star, User, Phone, Mail, Users, Sun, Calendar, Flame, TrendingDown, Zap, Brain, ShieldCheck, Wifi, XCircle } from 'lucide-react'

// Metodo Sincro organization id e funnel id Summer Edition
const MS_ORG_ID = 'a5dd4842-f0ea-4909-b4a3-be2cb1c6ffa5'
const SUMMER_FUNNEL_ID = '237ca6c3-2280-4ca5-8591-e795299a1442'

// Early Bird pricing phases — dynamic based on current date
function getCurrentPhase(): { phase: number; label: string; urgency: string; color: string } {
  const now = new Date()
  const month = now.getMonth() // 0-indexed: 4=May, 5=June, 6=July, 7=August
  const day = now.getDate()

  if (month < 4 || (month === 4 && day < 15)) {
    // Before May 15 — pre-launch
    return { phase: 0, label: 'Pre-lancio', urgency: 'Le iscrizioni aprono il 15 Maggio!', color: '#a78bfa' }
  }
  if ((month === 4 && day >= 15) || month === 5) {
    // May 15 – June 30 — best price
    return { phase: 1, label: 'Miglior Prezzo', urgency: '🔥 Prenota ora per il prezzo più basso!', color: '#22c55e' }
  }
  if (month === 6) {
    // July — mid price
    return { phase: 2, label: 'Prezzo Intermedio', urgency: '⚡ Il prezzo aumenta ad agosto — prenota ora!', color: '#f59e0b' }
  }
  if (month === 7 && day <= 15) {
    // Aug 1-15 — full price
    return { phase: 3, label: 'Ultimi Giorni', urgency: '🚨 Ultime disponibilità — si chiude il 15 agosto!', color: '#ef4444' }
  }
  // After Aug 15 — closed
  return { phase: 4, label: 'Chiuso', urgency: 'Le iscrizioni sono chiuse. Ci vediamo la prossima estate!', color: '#71717a' }
}

function PageContent() {
  const searchParams = useSearchParams()
  const currentPhase = getCurrentPhase()

  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

  const [fullName, setFullName] = useState('')
  const [fullNameError, setFullNameError] = useState('')
  const [email, setEmail] = useState('')
  const [emailError, setEmailError] = useState('')
  const [phone, setPhone] = useState('')
  const [phoneError, setPhoneError] = useState('')
  const [childAge, setChildAge] = useState('')
  const [submitAttempted, setSubmitAttempted] = useState(false)

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
      else if (!val.includes('@')) setEmailError("Inserisci un'email valida (con @)")
      else setEmailError('')
  }

  const isNameValid = fullName.trim().length > 0 && fullName.trim().includes(' ') && !fullNameError
  const isPhoneValid = phone.trim().length > 4 && !phoneError
  const isEmailValid = email.trim().length > 0 && email.includes('@') && !emailError
  const isFormValid = isNameValid && isPhoneValid && isEmailValid

  // PageView tracking
  useEffect(() => {
    const visitorId = sessionStorage.getItem('visitor_id') || `v_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
    sessionStorage.setItem('visitor_id', visitorId)

    fetch('/api/track/pageview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        organization_id: MS_ORG_ID,
        funnel_id: SUMMER_FUNNEL_ID,
        page_path: '/summer-edition',
        page_variant: 'A',
        visitor_id: visitorId,
        utm_source: searchParams.get('utm_source') || 'Summer Edition 2026',
        utm_medium: searchParams.get('utm_medium') || 'landing',
        utm_campaign: searchParams.get('utm_campaign') || 'Summer Edition 2026',
        utm_content: searchParams.get('utm_content') || '',
        utm_term: searchParams.get('utm_term') || '',
        referrer: typeof window !== 'undefined' ? document.referrer : '',
        page_url: typeof window !== 'undefined' ? window.location.href : '',
      }),
    }).catch(() => {})
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // UTM Tracking — hardcoded source for attribution, override only if explicit UTM params exist
  const utmSource   = searchParams.get('utm_source') || 'Summer Edition 2026'
  const utmMedium   = searchParams.get('utm_medium') || 'landing'
  const utmCampaign = searchParams.get('utm_campaign') || 'Summer Edition 2026'
  const utmContent  = searchParams.get('utm_content') || ''
  const utmTerm     = searchParams.get('utm_term') || ''

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitAttempted(true)

    let isValidLocal = true
    if (!isNameValid) { setFullNameError(fullNameError || 'Inserisci nome e cognome'); isValidLocal = false }
    if (!isPhoneValid) { setPhoneError(phoneError || 'Telefono obbligatorio'); isValidLocal = false }
    if (!isEmailValid) { setEmailError(emailError || 'Email obbligatoria'); isValidLocal = false }

    if (!isValidLocal) return

    setLoading(true)
    setError('')

    try {
      const visitorId = sessionStorage.getItem('visitor_id') || undefined
      const eventId = `evt_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`

      // Get fbc/fbp cookies for Meta matching
      const getCookie = (name: string) => {
        const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'))
        return match ? match[2] : undefined
      }

      const res = await fetch('/api/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          funnel_id:    SUMMER_FUNNEL_ID,
          name:         fullName.trim(),
          email:        email.trim(),
          phone:        phone.trim(),
          utm_source:   utmSource,
          utm_medium:   utmMedium,
          utm_campaign: utmCampaign,
          utm_content:  utmContent,
          utm_term:     utmTerm,
          extra_data:   { child_age: childAge, campaign_type: 'summer_edition_2026' },
          landing_url:  typeof window !== 'undefined' ? window.location.hostname + window.location.pathname : 'landing.metodosincro.com/f/summer-edition',
          visitor_id:   visitorId,
          event_id:     eventId,
          fbc:          getCookie('_fbc'),
          fbp:          getCookie('_fbp'),
        })
      })

      if (!res.ok) throw new Error("C'è stato un problema temporaneo, riprova tra un minuto.")

      setSuccess(true)
    } catch (err: any) {
      setError(err.message || 'Errore di sistema')
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="min-h-screen bg-[#09090b] flex flex-col items-center justify-center py-12 px-6">
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="text-center">
          <motion.div
            initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', delay: 0.1 }}
            className="w-24 h-24 mx-auto rounded-full flex items-center justify-center mb-6"
            style={{ background: 'rgba(34, 197, 94, 0.15)', border: '2px solid rgba(34, 197, 94, 0.3)' }}
          >
            <CheckCircle2 className="w-12 h-12 text-green-500" />
          </motion.div>
          <h2 className="text-3xl font-bold text-white mb-4">Perfetto! ☀️</h2>
          <p className="text-zinc-400 text-lg mb-6 max-w-md mx-auto">
            La tua richiesta per la <strong className="text-amber-400">Summer Edition</strong> è stata registrata. Ti contatteremo a breve per fissare la tua consulenza gratuita.
          </p>
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium"
            style={{ background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b', border: '1px solid rgba(245, 158, 11, 0.2)' }}>
            <Clock className="w-4 h-4" />
            Ti ricontatteremo entro 24 ore
          </div>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#09090b] font-sans relative overflow-hidden flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      {/* Summer Background Glows */}
      <div className="absolute top-[-15%] left-[-10%] w-[50%] h-[50%] blur-[140px] rounded-full pointer-events-none" style={{ background: 'rgba(245, 158, 11, 0.12)' }} />
      <div className="absolute bottom-[-15%] right-[-10%] w-[45%] h-[45%] blur-[140px] rounded-full pointer-events-none" style={{ background: 'rgba(239, 68, 68, 0.08)' }} />
      <div className="absolute top-[20%] right-[10%] w-[25%] h-[25%] blur-[100px] rounded-full pointer-events-none" style={{ background: 'rgba(251, 191, 36, 0.06)' }} />

      {/* Floating summer particles */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="summer-particle" style={{ left: '10%', animationDelay: '0s' }}>☀️</div>
        <div className="summer-particle" style={{ left: '25%', animationDelay: '2s' }}>🧠</div>
        <div className="summer-particle" style={{ left: '50%', animationDelay: '4s' }}>🔥</div>
        <div className="summer-particle" style={{ left: '75%', animationDelay: '1s' }}>⭐</div>
        <div className="summer-particle" style={{ left: '90%', animationDelay: '3s' }}>💪</div>
      </div>

      {/* Header */}
      <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.5 }} className="sm:mx-auto sm:w-full sm:max-w-2xl relative z-10 px-4">
        <div className="flex justify-center mb-4">
          <h1 className="text-3xl font-black tracking-tighter uppercase">
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-white to-zinc-400">METODO </span>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-orange-500">SINCRO®</span>
          </h1>
        </div>

        {/* Summer Edition Badge */}
        <div className="flex justify-center mb-4">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold tracking-wide"
            style={{
              background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.15), rgba(239, 68, 68, 0.1))',
              border: '1px solid rgba(245, 158, 11, 0.3)',
              color: '#fbbf24',
            }}>
            <Sun className="w-4 h-4" />
            SUMMER EDITION 2026
            <Flame className="w-4 h-4 text-orange-400" />
          </div>
        </div>

        {/* Mental Coaching identifier badge */}
        <div className="flex justify-center mb-6">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold tracking-widest uppercase"
            style={{
              background: 'rgba(139, 92, 246, 0.12)',
              border: '1px solid rgba(139, 92, 246, 0.25)',
              color: '#a78bfa',
            }}>
            <Brain className="w-3.5 h-3.5" />
            Programma di Mental Coaching
          </div>
        </div>

        <h2 className="text-center text-3xl sm:text-4xl px-2 font-black tracking-tight text-white mb-4 leading-tight">
          Quest&apos;estate allena la <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-orange-400 to-red-400">mente</span>,<br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-orange-400 to-red-400">
            non solo le gambe.
          </span>
        </h2>
        <p className="text-center text-zinc-400 text-base sm:text-lg mx-4 sm:mx-10 mb-2 leading-relaxed">
          Il percorso estivo di <strong className="text-white">Mental Coaching 1-to-1</strong> per giovani calciatori.<br className="hidden sm:block" />
          <span className="text-zinc-500">100% online — sessioni individuali con un coach certificato.</span><br className="hidden sm:block" />
          Da giugno a metà agosto: costruisci la mentalità vincente prima della nuova stagione.
        </p>

        {/* Badges */}
        <div className="flex flex-wrap justify-center gap-2 mt-4 mb-3">
          <div className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full" style={{ background: 'rgba(139, 92, 246, 0.1)', color: '#a78bfa', border: '1px solid rgba(139, 92, 246, 0.2)' }}>
            <Brain className="w-3.5 h-3.5" />
            Mental Coaching
          </div>
          <div className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full" style={{ background: 'rgba(59, 130, 246, 0.1)', color: '#60a5fa', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
            <Wifi className="w-3.5 h-3.5" />
            100% Online
          </div>
          <div className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full" style={{ background: 'rgba(245, 158, 11, 0.1)', color: '#fbbf24', border: '1px solid rgba(245, 158, 11, 0.2)' }}>
            <Calendar className="w-3.5 h-3.5" />
            Giugno – Agosto 2026
          </div>
          <div className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full" style={{ background: 'rgba(34, 197, 94, 0.1)', color: '#4ade80', border: '1px solid rgba(34, 197, 94, 0.2)' }}>
            <Star className="w-3.5 h-3.5" />
            Consulenza Gratuita
          </div>
        </div>

        {/* ⚠️ Cosa NON è — chiarimento anti-confusione */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
          className="max-w-lg mx-auto rounded-xl p-4 mb-4"
          style={{
            background: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid rgba(255, 255, 255, 0.07)',
          }}>
          <div className="flex items-center gap-2 mb-3">
            <ShieldCheck className="w-4 h-4 text-amber-400" />
            <span className="text-xs font-bold text-white tracking-wide uppercase">Cosa è — e cosa NON è</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <div className="flex items-start gap-2 text-[12px]">
                <span className="text-green-400 mt-0.5 shrink-0">✓</span>
                <span className="text-zinc-300"><strong className="text-white">Mental Coaching</strong> individuale con coach certificato</span>
              </div>
              <div className="flex items-start gap-2 text-[12px]">
                <span className="text-green-400 mt-0.5 shrink-0">✓</span>
                <span className="text-zinc-300">Sessioni <strong className="text-white">online da casa</strong> — nessuno spostamento</span>
              </div>
              <div className="flex items-start gap-2 text-[12px]">
                <span className="text-green-400 mt-0.5 shrink-0">✓</span>
                <span className="text-zinc-300">Lavoro su <strong className="text-white">mentalità, ansia, pressione e autostima</strong></span>
              </div>
              <div className="flex items-start gap-2 text-[12px]">
                <span className="text-green-400 mt-0.5 shrink-0">✓</span>
                <span className="text-zinc-300">Costruisce <strong className="text-white">sicurezza e grinta</strong> per la nuova stagione</span>
              </div>
            </div>
            <div className="space-y-1.5">
              <div className="flex items-start gap-2 text-[12px]">
                <XCircle className="w-3 h-3 text-red-400 mt-0.5 shrink-0" />
                <span className="text-zinc-500">NON è un programma di allenamento fisico</span>
              </div>
              <div className="flex items-start gap-2 text-[12px]">
                <XCircle className="w-3 h-3 text-red-400 mt-0.5 shrink-0" />
                <span className="text-zinc-500">NON è un camp estivo in presenza</span>
              </div>
              <div className="flex items-start gap-2 text-[12px]">
                <XCircle className="w-3 h-3 text-red-400 mt-0.5 shrink-0" />
                <span className="text-zinc-500">NON è tecnica calcistica o calisthenics</span>
              </div>
              <div className="flex items-start gap-2 text-[12px]">
                <XCircle className="w-3 h-3 text-red-400 mt-0.5 shrink-0" />
                <span className="text-zinc-500">NON serve spostarsi — funziona ovunque</span>
              </div>
            </div>
          </div>
        </motion.div>

        {/* PRIMA PRENOTI MENO PAGHI — Pricing Timeline */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
          className="max-w-lg mx-auto rounded-2xl p-5 mb-2"
          style={{
            background: 'rgba(255, 255, 255, 0.04)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            backdropFilter: 'blur(12px)',
          }}>
          <div className="flex items-center justify-center gap-2 mb-4">
            <TrendingDown className="w-5 h-5 text-emerald-400" />
            <span className="text-sm font-black text-white tracking-wide uppercase">Prima prenoti, meno paghi</span>
          </div>

          {/* 3 Phases */}
          <div className="flex gap-2 mb-4">
            {[
              { month: 'Giugno', desc: 'Miglior prezzo', spots: 50, phase: 1, color: '#22c55e', bg: 'rgba(34, 197, 94, 0.12)', border: 'rgba(34, 197, 94, 0.3)' },
              { month: 'Luglio', desc: 'Prezzo intermedio', spots: 30, phase: 2, color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.12)', border: 'rgba(245, 158, 11, 0.3)' },
              { month: '1-15 Ago', desc: 'Prezzo pieno', spots: 15, phase: 3, color: '#ef4444', bg: 'rgba(239, 68, 68, 0.12)', border: 'rgba(239, 68, 68, 0.3)' },
            ].map((tier) => {
              const isActive = currentPhase.phase === tier.phase
              const isPast = currentPhase.phase > tier.phase
              return (
                <div key={tier.month} className="flex-1 rounded-xl p-3 text-center relative transition-all"
                  style={{
                    background: isActive ? tier.bg : isPast ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${isActive ? tier.border : 'rgba(255,255,255,0.06)'}`,
                    opacity: isPast ? 0.45 : 1,
                    boxShadow: isActive ? `0 0 20px ${tier.bg}` : 'none',
                  }}>
                  {isActive && (
                    <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider flex items-center gap-1"
                      style={{ background: tier.color, color: '#fff' }}>
                      <Zap className="w-2.5 h-2.5" /> ORA
                    </div>
                  )}
                  <div className="text-[13px] font-bold text-white mb-0.5">{tier.month}</div>
                  <div className="text-[10px] font-medium" style={{ color: isActive ? tier.color : '#71717a' }}>
                    {isPast ? '✓ Scaduto' : tier.desc}
                  </div>
                  {!isPast && (
                    <div className="mt-1.5 flex items-center justify-center gap-1 text-[10px] font-bold" style={{ color: isActive ? tier.color : '#a1a1aa' }}>
                      <Users className="w-3 h-3" />
                      Solo {tier.spots} posti
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Current Phase Urgency */}
          {currentPhase.phase >= 1 && currentPhase.phase <= 3 && (
            <div className="text-center text-[13px] font-semibold px-3 py-2 rounded-lg"
              style={{ background: `${currentPhase.color}15`, color: currentPhase.color, border: `1px solid ${currentPhase.color}25` }}>
              {currentPhase.urgency}
            </div>
          )}
          {currentPhase.phase === 0 && (
            <div className="text-center text-[13px] font-semibold px-3 py-2 rounded-lg"
              style={{ background: 'rgba(167, 139, 250, 0.1)', color: '#a78bfa', border: '1px solid rgba(167, 139, 250, 0.2)' }}>
              {currentPhase.urgency}
            </div>
          )}
          {currentPhase.phase === 4 && (
            <div className="text-center text-[13px] font-semibold px-3 py-2 rounded-lg"
              style={{ background: 'rgba(113, 113, 122, 0.1)', color: '#71717a', border: '1px solid rgba(113, 113, 122, 0.2)' }}>
              {currentPhase.urgency}
            </div>
          )}
        </motion.div>
      </motion.div>

      {/* Form Card */}
      <motion.div initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.5, delay: 0.15 }} className="mt-10 sm:mx-auto sm:w-full sm:max-w-xl relative z-10 px-4">
        <div className="rounded-[24px] p-7 flex flex-col relative w-full sm:mx-auto sm:max-w-xl z-20"
          style={{
            background: 'rgba(255, 255, 255, 0.97)',
            border: '1.5px solid #e4e4e7',
            boxShadow: '0 8px 40px rgba(0,0,0,0.15), 0 0 80px rgba(245, 158, 11, 0.08)',
          }}>
          <div className="flex items-center gap-2 mb-3.5">
            <span className="text-[12px] font-extrabold tracking-[1.5px] uppercase" style={{ color: '#f59e0b' }}>
              🧠 MENTAL COACHING — SUMMER EDITION
            </span>
          </div>
          <h3 className="text-[22px] font-black mb-1.5 text-zinc-900 leading-tight">
            Prenota la Consulenza Gratuita
          </h3>
          <p className="text-[13px] text-zinc-500 mb-4">Parla con un nostro Mental Coach e scopri come preparare la mente di tuo figlio per la prossima stagione — <strong className="text-zinc-700">100% online, zero spostamenti</strong></p>

          <div className="flex flex-wrap justify-center gap-[14px] mb-[18px] pb-4 border-b border-zinc-200">
            <div className="flex items-center gap-1 text-[11px] text-zinc-500 whitespace-nowrap"><Lock className="w-3" /> Dati protetti</div>
            <div className="flex items-center gap-1 text-[11px] text-zinc-500 whitespace-nowrap"><Clock className="w-3" /> 30 secondi</div>
            <div className="flex flex-col items-start gap-[1px]">
                <span className="text-[#00b67a] font-extrabold text-[13px] tracking-tight leading-none pl-[1px]">Trustpilot</span>
                <div className="flex items-center gap-[2px]">
                {[1,2,3,4,5].map(i => <Star key={i} size={10} fill="#facc15" color="#facc15" />)}
                <span className="ml-[2px] font-bold text-zinc-700 leading-none text-[10px]">4.9</span>
                </div>
            </div>
          </div>

          <form className="flex flex-col gap-3">
             {/* Nome */}
             <div className="mb-0 text-left">
                <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-all ${isNameValid ? 'border-green-500 bg-green-500/5' : ((submitAttempted && !isNameValid) || fullNameError) ? 'border-red-500 bg-red-500/5' : 'bg-[#f4f4f5] border-[#d4d4d8] focus-within:border-amber-500 focus-within:bg-white focus-within:ring-[3px] focus-within:ring-amber-500/20'}`}>
                    <User className="w-5 h-5 text-zinc-500 shrink-0" />
                    <input type="text" placeholder="Nome e Cognome *" value={fullName} onChange={e => handleNameChange(e.target.value)}
                           className="w-full bg-transparent border-none outline-none text-zinc-900 placeholder:text-zinc-400 text-[15px]"
                    />
                </div>
                {((submitAttempted && !isNameValid) || fullNameError) && <span className="block mt-1.5 text-[12px] font-medium text-red-500 px-1 text-left">{fullNameError}</span>}
             </div>

             {/* Telefono */}
             <div className="mb-0 text-left">
                <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-all ${isPhoneValid ? 'border-green-500 bg-green-500/5' : ((submitAttempted && !isPhoneValid) || phoneError) ? 'border-red-500 bg-red-500/5' : 'bg-[#f4f4f5] border-[#d4d4d8] focus-within:border-amber-500 focus-within:bg-white focus-within:ring-[3px] focus-within:ring-amber-500/20'}`}>
                    <Phone className="w-5 h-5 text-zinc-500 shrink-0" />
                    <input type="tel" placeholder="Telefono * (+39...)" value={phone} onChange={e => handlePhoneChange(e.target.value)}
                           className="w-full bg-transparent border-none outline-none text-zinc-900 placeholder:text-zinc-400 text-[15px]"
                    />
                </div>
                {((submitAttempted && !isPhoneValid) || phoneError) && <span className="block mt-1.5 text-[12px] font-medium text-red-500 px-1 text-left">{phoneError}</span>}
             </div>

             {/* Email */}
             <div className="mb-0 text-left">
                <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-all ${isEmailValid ? 'border-green-500 bg-green-500/5' : ((submitAttempted && !isEmailValid) || emailError) ? 'border-red-500 bg-red-500/5' : 'bg-[#f4f4f5] border-[#d4d4d8] focus-within:border-amber-500 focus-within:bg-white focus-within:ring-[3px] focus-within:ring-amber-500/20'}`}>
                    <Mail className="w-5 h-5 text-zinc-500 shrink-0" />
                    <input type="email" placeholder="Email *" value={email} onChange={e => handleEmailChange(e.target.value)}
                           className="w-full bg-transparent border-none outline-none text-zinc-900 placeholder:text-zinc-400 text-[15px]"
                    />
                </div>
                {((submitAttempted && !isEmailValid) || emailError) && <span className="block mt-1.5 text-[12px] font-medium text-red-500 px-1 text-left">{emailError}</span>}
             </div>

             {/* Età figlio */}
             <div className="mb-0 text-left">
                <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-all ${childAge ? 'border-green-500 bg-green-500/5' : 'bg-[#f4f4f5] border-[#d4d4d8] focus-within:border-amber-500 focus-within:bg-white focus-within:ring-[3px] focus-within:ring-amber-500/20'}`}>
                    <Users className="w-5 h-5 text-zinc-500 shrink-0" />
                    <select value={childAge} onChange={e => setChildAge(e.target.value)}
                            className="w-full bg-transparent border-none outline-none text-zinc-900 text-[15px] appearance-none" style={{ backgroundImage: 'none' }}>
                        <option value="" disabled className="text-zinc-400">Età di tuo figlio/a (opzionale)</option>
                        <option value="8-10">8-10 anni</option>
                        <option value="11-13">11-13 anni</option>
                        <option value="14-16">14-16 anni</option>
                        <option value="17-20">17-20 anni</option>
                        <option value="20+">Oltre 20 anni</option>
                    </select>
                </div>
             </div>

             {error && <div className="p-3 bg-red-50 text-red-600 rounded-lg text-sm border border-red-200 mt-2">{error}</div>}

             <button
                type="button" disabled={loading}
                onClick={handleSubmit}
                className="w-full mt-2 py-4 rounded-xl text-[17px] font-bold text-white tracking-wide flex justify-center items-center gap-2 transition-all hover:scale-[1.02] active:scale-[0.98]"
                style={{
                   background: 'linear-gradient(135deg, #f59e0b 0%, #ea580c 50%, #dc2626 100%)',
                   boxShadow: isFormValid ? '0 0 50px rgba(245, 158, 11, 0.4), 0 4px 16px rgba(234, 88, 12, 0.35), inset 0 1px 0 rgba(255,255,255,0.25)' : '0 2px 8px rgba(0,0,0,0.15)',
                   textShadow: '0 1px 2px rgba(0,0,0,0.2)',
                   opacity: loading ? 0.7 : 1
                }}
             >
                {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : <>Prenota la Consulenza Gratuita <ArrowRight className="w-5 h-5" /></>}
             </button>
             <p className="text-center text-[11px] text-zinc-400 mt-2">
                 🔒 I tuoi dati sono al sicuro. Zero spam.
             </p>
              <p className="text-center text-[10px] text-zinc-400 mt-1 italic">
                  🧠 Percorso di Mental Coaching online — non un camp o un allenamento fisico
              </p>
          </form>
        </div>
      </motion.div>

      {/* Footer trust */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }} className="mt-8 text-center relative z-10 px-4">
        <p className="text-zinc-600 text-xs">
          © 2026 Metodo Sincro® — Tutti i diritti riservati
        </p>
      </motion.div>

      {/* Meta Pixel */}
      <script
        dangerouslySetInnerHTML={{
          __html: `!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','311586900940615',{});fbq('track','PageView');`,
        }}
      />

      {/* Summer Particle Animation */}
      <style>{`
        .summer-particle {
          position: absolute;
          font-size: 18px;
          opacity: 0.12;
          animation: floatUp 12s ease-in-out infinite;
          pointer-events: none;
        }
        @keyframes floatUp {
          0% { transform: translateY(100vh) rotate(0deg); opacity: 0; }
          10% { opacity: 0.12; }
          90% { opacity: 0.12; }
          100% { transform: translateY(-10vh) rotate(360deg); opacity: 0; }
        }
      `}</style>
    </div>
  )
}

export default function SummerEditionPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#09090b] flex items-center justify-center"><Loader2 className="w-8 h-8 text-amber-400 animate-spin" /></div>}>
      <PageContent />
    </Suspense>
  )
}
