'use client'

import { useState, Suspense, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { motion } from 'framer-motion'
import { Loader2, CheckCircle2, ArrowRight, ShieldCheck, Star, Lock, Clock, User, Phone, Mail, Users } from 'lucide-react'

type PageConfig = {
  logoTitle: string;
  logoAccent: string;
  headline: string;
  subheadline: string;
  buttonText: string;
  themeFrom: string; 
  themeTo: string;
  glowFrom: string;
  glowTo: string;
}

const CONFIG_MAP: Record<string, PageConfig> = {
  'Protocollo27': {
    logoTitle: 'PROTOCOLLO',
    logoAccent: '27',
    headline: 'Trasforma la vita delle persone: diventa Mental Coach!',
    subheadline: 'Scopri l\'unico corso pratico basato su 27 pilastri strategici che ti insegna come essere un Mental Coach e guadagnare aiutando gli altri.',
    buttonText: 'Candidati per Protocollo 27',
    themeFrom: 'from-orange-600',
    themeTo: 'to-amber-600',
    glowFrom: 'bg-orange-600/20',
    glowTo: 'bg-amber-600/10'
  },
  'metodosincro.it': {
    logoTitle: 'METODO',
    logoAccent: 'SINCRO',
    headline: 'Sconfiggi i blocchi mentali e domina in campo.',
    subheadline: 'Compila il modulo qui sotto per prenotare subito la tua prima consulenza gratuita di valutazione sportiva.',
    buttonText: 'Prenota Consulenza Gratuita',
    themeFrom: 'from-blue-600',
    themeTo: 'to-indigo-600',
    glowFrom: 'bg-blue-600/20',
    glowTo: 'bg-indigo-600/10'
  },
  'valenteantonio.it': {
    logoTitle: 'ANTONIO',
    logoAccent: 'VALENTE',
    headline: 'Inizia il tuo percorso di trasformazione.',
    subheadline: 'Lascia i tuoi dati qui sotto per essere ricontattato e fissare la tua sessione strategica gratuita.',
    buttonText: 'Invia Candidatura Ora',
    themeFrom: 'from-emerald-600',
    themeTo: 'to-teal-600',
    glowFrom: 'bg-emerald-600/20',
    glowTo: 'bg-teal-600/10'
  },
  'default': {
    logoTitle: 'METODO',
    logoAccent: 'SINCRO',
    headline: 'Inizia il tuo percorso.',
    subheadline: 'Compila il modulo per prenotare la tua prima consulenza gratuita di valutazione.',
    buttonText: 'Registrati Ora',
    themeFrom: 'from-orange-600',
    themeTo: 'to-amber-600',
    glowFrom: 'bg-orange-600/20',
    glowTo: 'bg-amber-600/10'
  }
}

// Metodo Sincro organization ID
const MS_ORG_ID = 'a5dd4842-f0ea-4909-b4a3-be2cb1c6ffa5'

// Map del parametro ?source= al funnel_id corretto nel DB
const FUNNEL_ID_MAP: Record<string, string> = {
  'MetodoSincro':      '1539adea-4b2e-40ff-8f35-0eb1b89d13eb',
  'metodosincro.it':   '1539adea-4b2e-40ff-8f35-0eb1b89d13eb',
  'valenteantonio.it': '503ee812-5a60-4c9a-8d68-bd5d02a43453',
  'Protocollo27':      '95a2f73a-a8e9-46c5-998b-5d12d5bc5fd0',
}

function PageContent() {
  const searchParams = useSearchParams()
  const sourceParam = searchParams.get('source') || 'default'

  // Trova la configurazione o usa la default
  const config = CONFIG_MAP[sourceParam as keyof typeof CONFIG_MAP] || CONFIG_MAP['default']

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
  
  // Cattura sito di provenienza
  useEffect(() => {
    if (typeof window !== 'undefined' && document.referrer) {
      setReferrer(document.referrer)
    }
  }, [])

  // ── PageView tracking: registra la visita nella piattaforma
  useEffect(() => {
    const funnelId = FUNNEL_ID_MAP[sourceParam] || FUNNEL_ID_MAP['MetodoSincro']
    const visitorId = sessionStorage.getItem('visitor_id') || `v_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
    sessionStorage.setItem('visitor_id', visitorId)

    fetch('/api/track/pageview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        organization_id: MS_ORG_ID,
        funnel_id: funnelId,
        page_path: `/consulenza?source=${sourceParam}`,
        page_variant: 'A',
        visitor_id: visitorId,
        utm_source:   searchParams.get('utm_source')   || sourceParam,
        utm_medium:   searchParams.get('utm_medium')   || 'direct',
        utm_campaign: searchParams.get('utm_campaign') || '',
        utm_content:  searchParams.get('utm_content')  || '',
        utm_term:     searchParams.get('utm_term')     || '',
        referrer: typeof window !== 'undefined' ? document.referrer : '',
        page_url: typeof window !== 'undefined' ? window.location.href : '',
      }),
    }).catch(() => {/* silent fail */})
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Leggi UTM params correttamente (utm_campaign, non 'campaign')
  const utmSource   = searchParams.get('utm_source')   || searchParams.get('source') || 'Consulenza Page'
  const utmMedium   = searchParams.get('utm_medium')   || searchParams.get('medium') || 'direct'
  const utmCampaign = searchParams.get('utm_campaign') || searchParams.get('campaign') || ''
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
      // Mappa source → funnel_id (con fallback a MetodoSincro)
      const funnelId = FUNNEL_ID_MAP[sourceParam] || FUNNEL_ID_MAP['MetodoSincro']

      const res = await fetch('/api/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          funnel_id:    funnelId,
          name:         fullName.trim(),
          email:        email,
          phone:        phone,
          utm_source:   utmSource,
          utm_medium:   utmMedium,
          utm_campaign: utmCampaign || referrer || sourceParam,
          utm_content:  utmContent,
          utm_term:     utmTerm,
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
            <span className="text-[12px] font-extrabold text-red-500 tracking-[1.5px] uppercase animate-pulse">⚡ POSTI LIMITATI</span>
          </div>
          <h3 className="text-[22px] font-black mb-1.5 text-zinc-900 leading-tight">
            Prenota la Consulenza <span className="text-[#facc15]">Gratuita</span>
          </h3>
          <p className="text-[13px] text-zinc-500 mb-4">Compila il form — ti richiamiamo noi</p>

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
                <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-all ${isNameValid ? 'border-green-500 bg-green-500/5' : ((submitAttempted && !isNameValid) || fullNameError) ? 'border-red-500 bg-red-500/5' : 'bg-[#f4f4f5] border-[#d4d4d8] focus-within:border-yellow-400 focus-within:bg-white focus-within:ring-[3px] focus-within:ring-yellow-400/20'}`}>
                    <User className="w-5 h-5 text-zinc-500 shrink-0" />
                    <input type="text" placeholder="Nome e Cognome *" value={fullName} onChange={e => handleNameChange(e.target.value)}
                           className="w-full bg-transparent border-none outline-none text-zinc-900 placeholder:text-zinc-400 text-[15px]" 
                    />
                </div>
                {((submitAttempted && !isNameValid) || fullNameError) && <span className="block mt-1.5 text-[12px] font-medium text-red-500 px-1 text-left">{fullNameError}</span>}
             </div>

             <div className="mb-0 text-left">
                <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-all ${isPhoneValid ? 'border-green-500 bg-green-500/5' : ((submitAttempted && !isPhoneValid) || phoneError) ? 'border-red-500 bg-red-500/5' : 'bg-[#f4f4f5] border-[#d4d4d8] focus-within:border-yellow-400 focus-within:bg-white focus-within:ring-[3px] focus-within:ring-yellow-400/20'}`}>
                    <Phone className="w-5 h-5 text-zinc-500 shrink-0" />
                    <input type="tel" placeholder="Telefono * (+39...)" value={phone} onChange={e => handlePhoneChange(e.target.value)}
                           className="w-full bg-transparent border-none outline-none text-zinc-900 placeholder:text-zinc-400 text-[15px]" 
                    />
                </div>
                {((submitAttempted && !isPhoneValid) || phoneError) && <span className="block mt-1.5 text-[12px] font-medium text-red-500 px-1 text-left">{phoneError}</span>}
             </div>

             <div className="mb-0 text-left">
                <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-all ${isEmailValid ? 'border-green-500 bg-green-500/5' : ((submitAttempted && !isEmailValid) || emailError) ? 'border-red-500 bg-red-500/5' : 'bg-[#f4f4f5] border-[#d4d4d8] focus-within:border-yellow-400 focus-within:bg-white focus-within:ring-[3px] focus-within:ring-yellow-400/20'}`}>
                    <Mail className="w-5 h-5 text-zinc-500 shrink-0" />
                    <input type="email" placeholder="Email *" value={email} onChange={e => handleEmailChange(e.target.value)}
                           className="w-full bg-transparent border-none outline-none text-zinc-900 placeholder:text-zinc-400 text-[15px]" 
                    />
                </div>
                {((submitAttempted && !isEmailValid) || emailError) && <span className="block mt-1.5 text-[12px] font-medium text-red-500 px-1 text-left">{emailError}</span>}
             </div>

             {error && <div className="p-3 bg-red-50 text-red-600 rounded-lg text-sm border border-red-200 mt-2">{error}</div>}

             <button
                type="button" disabled={loading}
                onClick={handleSubmit}
                className="w-full mt-2 py-4 rounded-xl text-[17px] font-bold text-white tracking-wide flex justify-center items-center gap-2 transition-all"
                style={{
                   background: 'linear-gradient(135deg, #34d058 0%, #22c55e 50%, #16a34a 100%)',
                   boxShadow: isFormValid ? '0 0 50px rgba(34,197,94,0.5), 0 4px 16px rgba(34,197,94,0.4), inset 0 1px 0 rgba(255,255,255,0.25)' : 'none',
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

export default function ConsulenzaPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#09090b] flex items-center justify-center"><Loader2 className="w-8 h-8 text-white animate-spin" /></div>}>
      <PageContent />
    </Suspense>
  )
}
