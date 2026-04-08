'use client'

import { useState, Suspense, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { motion } from 'framer-motion'
import { Loader2, CheckCircle2, ArrowRight, Lock, Clock, Star, User, Phone, Mail, Users } from 'lucide-react'

// Metodo Sincro organization id e funnel id master
const MS_ORG_ID = 'a5dd4842-f0ea-4909-b4a3-be2cb1c6ffa5'
const MASTER_FUNNEL_ID = '577206fe-5466-4d09-ab6b-1721aca44f09' // Specific Funnel ID per Email Marketing

function PageContent() {
  const searchParams = useSearchParams()

  const config = {
    logoTitle: 'METODO',
    logoAccent: 'SINCRO®',
    headline: 'Il tuo percorso privilegiato inizia qui.',
    subheadline: 'Hai ricevuto questo link perché sei iscritto alla nostra lista. Compila il modulo veloce per accedere alla tua prima sessione.',
    buttonText: 'Prenota la consulenza gratuita',
    themeFrom: 'from-blue-600',
    themeTo: 'to-indigo-600',
    glowFrom: 'bg-blue-600/20',
    glowTo: 'bg-indigo-600/10'
  }

  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')
  const [referrer, setReferrer] = useState('')
  
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
      else if (!val.includes('@')) setEmailError('Inserisci un\'email valida (con @)')
      else setEmailError('')
  }

  const isNameValid = fullName.trim().length > 0 && fullName.trim().includes(' ') && !fullNameError
  const isPhoneValid = phone.trim().length > 4 && !phoneError
  const isEmailValid = email.trim().length > 0 && email.includes('@') && !emailError
  const isFormValid = isNameValid && isPhoneValid && isEmailValid
  
  useEffect(() => {
    if (typeof window !== 'undefined' && document.referrer) {
      setReferrer(document.referrer)
    }
  }, [])

  // PageView tracking
  useEffect(() => {
    const visitorId = sessionStorage.getItem('visitor_id') || `v_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
    sessionStorage.setItem('visitor_id', visitorId)

    fetch('/api/track/pageview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        organization_id: MS_ORG_ID,
        funnel_id: MASTER_FUNNEL_ID,
        page_path: `/invito-esclusivo`,
        page_variant: 'A',
        visitor_id: visitorId,
        utm_source: 'Email Marketing',
        utm_medium: 'email',
        utm_campaign: searchParams.get('utm_campaign') || searchParams.get('campaign') || 'Newsletter',
        utm_content: searchParams.get('utm_content') || '',
        utm_term: searchParams.get('utm_term') || '',
        referrer: typeof window !== 'undefined' ? document.referrer : '',
        page_url: typeof window !== 'undefined' ? window.location.href : '',
      }),
    }).catch(() => {})
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Hardcoded VIP UTM Tracking to maintain CRM purity
  const utmSource   = 'Email Marketing' // Hardcoded as requested
  const utmMedium   = 'email'
  const utmCampaign = searchParams.get('utm_campaign') || searchParams.get('campaign') || 'Lista Ristretta'
  const utmContent  = searchParams.get('utm_content')  || ''
  const utmTerm     = searchParams.get('utm_term')     || ''

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
      const res = await fetch('/api/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          funnel_id:    MASTER_FUNNEL_ID,
          name:         fullName.trim(),
          email:        email,
          phone:        phone,
          utm_source:   utmSource,
          utm_medium:   utmMedium,
          utm_campaign: utmCampaign,
          utm_content:  utmContent,
          utm_term:     utmTerm,
          extra_data:   { child_age: childAge },
          landing_url:  typeof window !== 'undefined' ? window.location.hostname : 'landing.metodosincro.com',
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
            className="w-24 h-24 mx-auto bg-green-500/20 text-green-500 rounded-full flex items-center justify-center mb-6"
          >
            <CheckCircle2 className="w-12 h-12" />
          </motion.div>
          <h2 className="text-3xl font-bold text-white mb-4">Ricevuto!</h2>
          <p className="text-zinc-400 text-lg mb-8 max-w-md mx-auto">
            Abbiamo registrato i tuoi dati correttamente. Verrai contattato a breve sul numero fornito.
          </p>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#09090b] font-sans relative overflow-hidden flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      {/* Dynamic Background Glows */}
      <div className={`absolute top-[-10%] left-[-10%] w-[40%] h-[40%] blur-[120px] rounded-full pointer-events-none transition-colors duration-1000 ${config.glowFrom}`} />
      <div className={`absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] blur-[120px] rounded-full pointer-events-none transition-colors duration-1000 ${config.glowTo}`} />

      <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.5 }} className="sm:mx-auto sm:w-full sm:max-w-2xl relative z-10">
        <div className="flex justify-center mb-8">
           <h1 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white to-zinc-400 tracking-tighter uppercase">
             {config.logoTitle} <span className={`bg-clip-text text-transparent bg-gradient-to-r ${config.themeFrom} ${config.themeTo}`}>{config.logoAccent}</span>
           </h1>
        </div>
        <h2 className="text-center text-3xl sm:text-4xl px-2 font-black tracking-tight text-white mb-4">
          {config.headline}
        </h2>
        <p className="text-center text-zinc-400 text-lg mx-6 sm:mx-10">
          {config.subheadline}
        </p>
      </motion.div>

      <motion.div initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.5, delay: 0.1 }} className="mt-10 sm:mx-auto sm:w-full sm:max-w-xl relative z-10">
        <div className="bg-white border-[1.5px] border-zinc-200 rounded-[24px] p-7 shadow-[0_8px_40px_rgba(0,0,0,0.15),0_0_60px_rgba(250,204,21,0.06)] flex flex-col relative w-full sm:mx-auto sm:max-w-xl z-20">
          <div className="flex items-center gap-2 mb-3.5">
            <span className="text-[12px] font-extrabold text-indigo-500 tracking-[1.5px] uppercase animate-pulse">⚡ ACCESSO PRIORITARIO</span>
          </div>
          <h3 className="text-[22px] font-black mb-1.5 text-zinc-900 leading-tight">
            Iscriviti per la Chiamata
          </h3>
          <p className="text-[13px] text-zinc-500 mb-4">Compila il form ultraveloce e mettiti in priorità</p>

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
             <div className="mb-0 text-left">
                <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-all ${isNameValid ? 'border-green-500 bg-green-500/5' : ((submitAttempted && !isNameValid) || fullNameError) ? 'border-red-500 bg-red-500/5' : 'bg-[#f4f4f5] border-[#d4d4d8] focus-within:border-indigo-500 focus-within:bg-white focus-within:ring-[3px] focus-within:ring-indigo-500/20'}`}>
                    <User className="w-5 h-5 text-zinc-500 shrink-0" />
                    <input type="text" placeholder="Nome e Cognome *" value={fullName} onChange={e => handleNameChange(e.target.value)}
                           className="w-full bg-transparent border-none outline-none text-zinc-900 placeholder:text-zinc-400 text-[15px]" 
                    />
                </div>
                {((submitAttempted && !isNameValid) || fullNameError) && <span className="block mt-1.5 text-[12px] font-medium text-red-500 px-1 text-left">{fullNameError}</span>}
             </div>

             <div className="mb-0 text-left">
                <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-all ${isPhoneValid ? 'border-green-500 bg-green-500/5' : ((submitAttempted && !isPhoneValid) || phoneError) ? 'border-red-500 bg-red-500/5' : 'bg-[#f4f4f5] border-[#d4d4d8] focus-within:border-indigo-500 focus-within:bg-white focus-within:ring-[3px] focus-within:ring-indigo-500/20'}`}>
                    <Phone className="w-5 h-5 text-zinc-500 shrink-0" />
                    <input type="tel" placeholder="Telefono * (+39...)" value={phone} onChange={e => handlePhoneChange(e.target.value)}
                           className="w-full bg-transparent border-none outline-none text-zinc-900 placeholder:text-zinc-400 text-[15px]" 
                    />
                </div>
                {((submitAttempted && !isPhoneValid) || phoneError) && <span className="block mt-1.5 text-[12px] font-medium text-red-500 px-1 text-left">{phoneError}</span>}
             </div>

             <div className="mb-0 text-left">
                <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-all ${isEmailValid ? 'border-green-500 bg-green-500/5' : ((submitAttempted && !isEmailValid) || emailError) ? 'border-red-500 bg-red-500/5' : 'bg-[#f4f4f5] border-[#d4d4d8] focus-within:border-indigo-500 focus-within:bg-white focus-within:ring-[3px] focus-within:ring-indigo-500/20'}`}>
                    <Mail className="w-5 h-5 text-zinc-500 shrink-0" />
                    <input type="email" placeholder="Email *" value={email} onChange={e => handleEmailChange(e.target.value)}
                           className="w-full bg-transparent border-none outline-none text-zinc-900 placeholder:text-zinc-400 text-[15px]" 
                    />
                </div>
                {((submitAttempted && !isEmailValid) || emailError) && <span className="block mt-1.5 text-[12px] font-medium text-red-500 px-1 text-left">{emailError}</span>}
             </div>

             <div className="mb-0 text-left">
                <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-all ${childAge ? 'border-green-500 bg-green-500/5' : 'bg-[#f4f4f5] border-[#d4d4d8] focus-within:border-indigo-500 focus-within:bg-white focus-within:ring-[3px] focus-within:ring-indigo-500/20'}`}>
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
                className="w-full mt-2 py-4 rounded-xl text-[17px] font-bold text-white tracking-wide flex justify-center items-center gap-2 transition-all"
                style={{
                   background: 'linear-gradient(135deg, #4f46e5 0%, #4338ca 50%, #3730a3 100%)',
                   boxShadow: isFormValid ? '0 0 50px rgba(67,56,202,0.5), 0 4px 16px rgba(67,56,202,0.4), inset 0 1px 0 rgba(255,255,255,0.25)' : 'none',
                   textShadow: '0 1px 2px rgba(0,0,0,0.2)',
                   opacity: loading ? 0.7 : 1
                }}
             >
                {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : <>{config.buttonText} <ArrowRight className="w-5 h-5" /></>}
             </button>
             <p className="text-center text-[11px] text-zinc-400 mt-2">
                 🔒 I tuoi dati sono al sicuro. Zero spam.
             </p>
          </form>
        </div>
      </motion.div>
    </div>
  )
}

export default function InvitoEsclusivoPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#09090b] flex items-center justify-center"><Loader2 className="w-8 h-8 text-white animate-spin" /></div>}>
      <PageContent />
    </Suspense>
  )
}
