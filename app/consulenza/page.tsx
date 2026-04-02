'use client'

import { useState, Suspense, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { motion } from 'framer-motion'
import { Loader2, CheckCircle2, ArrowRight, ShieldCheck } from 'lucide-react'

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
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
  })
  
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

  const isValid = formData.firstName.trim() !== '' && formData.email.includes('@') && formData.phone.length > 5

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isValid) return

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
          name:         `${formData.firstName} ${formData.lastName}`.trim(),
          email:        formData.email,
          phone:        formData.phone,
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
        <div className="bg-zinc-900/50 backdrop-blur-xl pt-10 pb-8 px-6 shadow-2xl shadow-black/50 sm:rounded-2xl border border-zinc-800/80 mx-4 sm:px-10">
          
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-medium text-zinc-300">Nome</label>
                <input
                  type="text" required value={formData.firstName} onChange={e => setFormData({ ...formData, firstName: e.target.value })}
                  className="w-full bg-black/50 border border-zinc-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500 transition-colors"
                  placeholder="Il tuo nome"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-zinc-300">Cognome</label>
                <input
                  type="text" required value={formData.lastName} onChange={e => setFormData({ ...formData, lastName: e.target.value })}
                  className="w-full bg-black/50 border border-zinc-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500 transition-colors"
                  placeholder="Il tuo cognome"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-zinc-300">Email</label>
              <input
                type="email" required value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })}
                className="w-full bg-black/50 border border-zinc-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500 transition-colors"
                placeholder="es. mario.rossi@email.com"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-zinc-300">Numero di Telefono (con Whatsapp)</label>
              <input
                type="tel" required value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })}
                className="w-full bg-black/50 border border-zinc-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500 transition-colors"
                placeholder="+39 333 123 4567"
              />
            </div>

            {error && <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-500 rounded-lg text-sm">{error}</div>}

            <button
              type="submit" disabled={loading || !isValid}
              className="w-full group relative overflow-hidden rounded-xl bg-gradient-to-r from-zinc-700 to-zinc-600 p-[1px] shadow-lg transition-all disabled:opacity-50 mt-4"
            >
              <div className="absolute inset-0 bg-white/20 hover:bg-transparent transition-colors z-10"></div>
              <div className={`relative bg-gradient-to-r ${config.themeFrom} ${config.themeTo} py-4 px-6 rounded-[11px] flex items-center justify-center gap-2`}>
                {loading ? <Loader2 className="w-5 h-5 text-white animate-spin" /> : (
                  <>
                    <span className="text-white font-bold text-lg tracking-wide shadow-black/20 text-shadow">{config.buttonText}</span>
                    <ArrowRight className="w-5 h-5 text-white group-hover:translate-x-1 transition-transform drop-shadow" />
                  </>
                )}
              </div>
            </button>
            <div className="flex items-center justify-center gap-2 text-zinc-500 text-xs mt-6">
              <ShieldCheck className="w-4 h-4" />
              <span>I tuoi dati sono protetti e trattati secondo la privacy policy.</span>
            </div>
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
