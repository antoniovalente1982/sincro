'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { Loader2, CheckCircle2, ArrowRight, ShieldCheck } from 'lucide-react'
import Image from 'next/image'

function FormContent() {
  const searchParams = useSearchParams()
  const sourceParam = searchParams.get('source') || 'Link Diretto (Consulenza Native)'
  const orgId = searchParams.get('org') || '01d90fc9-d5ab-406c-8ab5-f127cb46c6ad' // His default org

  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
  })

  // Basic validation
  const isValid = formData.firstName.trim() !== '' && formData.email.includes('@') && formData.phone.length > 5

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isValid) return

    setLoading(true)
    setError('')

    try {
      // We leverage the ultra-stable Gravity webhook we just built!
      // This automatically deduplicates, backups to Google Sheets and fires Meta CAPI
      const res = await fetch(`/api/webhooks/gravity?org=${orgId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: formData.firstName,
          cognome: formData.lastName,
          email: formData.email,
          phone: formData.phone,
          utm_source: sourceParam
        })
      })

      if (!res.ok) {
        throw new Error('Qualcosa è andato storto, riprova tra poco.')
      }

      setSuccess(true)
    } catch (err: any) {
      setError(err.message || 'Errore di sistema')
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="text-center py-12 px-6"
      >
        <motion.div 
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', delay: 0.1 }}
          className="w-24 h-24 mx-auto bg-green-500/20 text-green-500 rounded-full flex items-center justify-center mb-6"
        >
          <CheckCircle2 className="w-12 h-12" />
        </motion.div>
        <h2 className="text-3xl font-bold text-white mb-4">Candidatura Inviata!</h2>
        <p className="text-zinc-400 text-lg mb-8 max-w-md mx-auto">
          Abbiamo ricevuto i tuoi dati. Il nostro team ti contatterà a breve sul numero fornito per fissare la tua consulenza gratuita.
        </p>
      </motion.div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <label className="text-sm font-medium text-zinc-300">Nome</label>
          <input
            type="text"
            required
            value={formData.firstName}
            onChange={e => setFormData({ ...formData, firstName: e.target.value })}
            className="w-full bg-zinc-900/50 border border-zinc-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-colors"
            placeholder="Il tuo nome"
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium text-zinc-300">Cognome</label>
          <input
            type="text"
            required
            value={formData.lastName}
            onChange={e => setFormData({ ...formData, lastName: e.target.value })}
            className="w-full bg-zinc-900/50 border border-zinc-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-colors"
            placeholder="Il tuo cognome"
          />
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-zinc-300">Email</label>
        <input
          type="email"
          required
          value={formData.email}
          onChange={e => setFormData({ ...formData, email: e.target.value })}
          className="w-full bg-zinc-900/50 border border-zinc-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-colors"
          placeholder="es. mario.rossi@email.com"
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-zinc-300">Numero di Telefono (con Whatsapp)</label>
        <input
          type="tel"
          required
          value={formData.phone}
          onChange={e => setFormData({ ...formData, phone: e.target.value })}
          className="w-full bg-zinc-900/50 border border-zinc-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-colors"
          placeholder="+39 333 123 4567"
        />
      </div>

      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-500 rounded-lg text-sm">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={loading || !isValid}
        className="w-full group relative overflow-hidden rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 p-[1px] shadow-lg shadow-orange-500/20 transition-all disabled:opacity-50"
      >
        <div className="absolute inset-0 bg-white/20 hover:bg-transparent transition-colors z-10"></div>
        <div className="relative bg-gradient-to-r from-orange-600 to-amber-600 py-4 px-6 rounded-[11px] flex items-center justify-center gap-2">
          {loading ? (
            <Loader2 className="w-5 h-5 text-white animate-spin" />
          ) : (
            <>
              <span className="text-white font-semibold text-lg tracking-wide">Invia Candidatura Ora</span>
              <ArrowRight className="w-5 h-5 text-white group-hover:translate-x-1 transition-transform" />
            </>
          )}
        </div>
      </button>

      <div className="flex items-center justify-center gap-2 text-zinc-500 text-xs mt-6">
        <ShieldCheck className="w-4 h-4" />
        <span>I tuoi dati sono protetti e trattati secondo la privacy policy.</span>
      </div>
    </form>
  )
}

export default function ConsulenzaPage() {
  return (
    <div className="min-h-screen bg-[#09090b] selection:bg-orange-500/30 font-sans relative overflow-hidden flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      {/* Background Glows */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-orange-600/20 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-amber-600/10 blur-[120px] rounded-full pointer-events-none" />

      <motion.div 
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="sm:mx-auto sm:w-full sm:max-w-md relative z-10"
      >
        {/* Placeholder for actual logo, fallback to clean text */}
        <div className="flex justify-center mb-8">
           <h1 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white to-zinc-400 tracking-tighter">
             METODO <span className="text-orange-500">SINCRO</span>
           </h1>
        </div>

        <h2 className="text-center text-4xl font-black tracking-tight text-white mb-2">
          Inizia il tuo percorso.
        </h2>
        <p className="text-center text-zinc-400 text-lg mx-4">
          Compila il modulo per prenotare la tua prima consulenza gratuita di valutazione.
        </p>
      </motion.div>

      <motion.div 
        initial={{ y: 30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        className="mt-10 sm:mx-auto sm:w-full sm:max-w-xl relative z-10"
      >
        <div className="bg-zinc-900/40 backdrop-blur-xl py-8 px-6 shadow-2xl shadow-black/50 sm:rounded-2xl border border-zinc-800/80 mx-4 sm:px-10">
          
          {/* We import the form wrapped in suspense to allow reading useSearchParams cleanly */}
          <Suspense fallback={
            <div className="h-64 flex items-center justify-center"><Loader2 className="w-8 h-8 text-orange-500 animate-spin" /></div>
          }>
            <FormContent />
          </Suspense>

        </div>
      </motion.div>
    </div>
  )
}
