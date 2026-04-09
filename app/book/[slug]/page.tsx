'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { Calendar as CalendarIcon, Clock, ChevronRight, User, Mail, Phone, MessageSquare, CheckCircle2, Loader2, CalendarHeart } from 'lucide-react'

export default function PublicBookingPage() {
    const params = useParams()
    const slug = params.slug as string

    const [calendar, setCalendar] = useState<any>(null)
    const [slotsObj, setSlotsObj] = useState<Record<string, { time: string, availableMembers: string[] }[]>>({})
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    const [selectedDate, setSelectedDate] = useState<string | null>(null)
    const [selectedSlot, setSelectedSlot] = useState<string | null>(null)
    const [step, setStep] = useState<1 | 2 | 3>(1) // 1: DateTime, 2: Form, 3: Success

    const [formData, setFormData] = useState({
        name: '',
        email: '',
        phone: '',
        notes: ''
    })
    const [submitting, setSubmitting] = useState(false)
    const [redirectUrl, setRedirectUrl] = useState<string | null>(null)

    useEffect(() => {
        const fetchAvailability = async () => {
            try {
                // Fetch next 14 days starting today
                const today = new Date()
                const fromStr = today.toISOString()
                const res = await fetch(`/api/public/calendar/${slug}/availability?from=${fromStr}`)
                if (!res.ok) throw new Error('Calendario non trovato o non disponibile')
                
                const data = await res.json()
                setCalendar(data.calendar)
                setSlotsObj(data.slots)

                // Select first available date by default
                const dates = Object.keys(data.slots).sort()
                if (dates.length > 0) {
                    setSelectedDate(dates[0])
                }
            } catch (err: any) {
                setError(err.message)
            } finally {
                setLoading(false)
            }
        }

        fetchAvailability()
    }, [slug])

    const handleBook = async (e: React.FormEvent) => {
        e.preventDefault()
        setSubmitting(true)
        setError(null)

        try {
            const res = await fetch(`/api/public/calendar/${slug}/book`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    start_time: selectedSlot,
                    name: formData.name,
                    email: formData.email,
                    phone: formData.phone,
                    notes: formData.notes
                })
            })

            const data = await res.json()

            if (!res.ok) {
                throw new Error(data.error || 'Errore durante la prenotazione')
            }

            if (data.redirect_url) {
                setRedirectUrl(data.redirect_url)
            }
            
            setStep(3)

            if (data.redirect_url) {
                setTimeout(() => {
                    window.location.href = data.redirect_url
                }, 2000)
            }

        } catch (err: any) {
            setError(err.message)
        } finally {
            setSubmitting(false)
        }
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-[#050505] flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
            </div>
        )
    }

    if (error && step === 1) {
        return (
            <div className="min-h-screen bg-[#050505] flex flex-col items-center justify-center p-6 text-center">
                <CalendarHeart className="w-16 h-16 text-neutral-800 mb-6" />
                <h1 className="text-2xl font-semibold text-white mb-2">Ops! Qualcosa è andato storto.</h1>
                <p className="text-neutral-400 max-w-md">{error}</p>
            </div>
        )
    }

    const availableDates = Object.keys(slotsObj).sort()
    const slotsForDate = selectedDate ? (slotsObj[selectedDate] || []) : []

    return (
        <div className="min-h-screen bg-black text-white selection:bg-blue-500/30 flex items-center justify-center p-4 md:p-8">
            <div className="w-full max-w-5xl grid grid-cols-1 md:grid-cols-12 bg-[#0A0A0A] border border-white/5 rounded-3xl overflow-hidden shadow-2xl relative z-10">
                
                {/* Left Panel: Info */}
                <div className="md:col-span-4 bg-gradient-to-br from-[#111] to-[#0A0A0A] p-8 md:p-10 border-b md:border-b-0 md:border-r border-white/5 flex flex-col relative overflow-hidden">
                    {/* Subtle glow */}
                    <div className="absolute top-0 left-0 w-full h-full bg-blue-500/5 blur-[100px] pointer-events-none rounded-full" />
                    
                    <div className="relative z-10 mb-auto">
                        <div className="w-12 h-12 bg-blue-500/10 rounded-xl flex items-center justify-center mb-6">
                            <CalendarIcon className="w-6 h-6 text-blue-500" />
                        </div>
                        <h2 className="text-neutral-400 text-sm font-medium tracking-wider uppercase mb-2">Metodo Sincro</h2>
                        <h1 className="text-3xl font-semibold text-white mb-4 tracking-tight leading-tight">{calendar?.name || 'Appuntamento'}</h1>
                        <p className="text-neutral-400 mb-8 leading-relaxed text-sm">
                            {calendar?.description || 'Seleziona un orario per parlare con uno dei nostri esperti. Ti aiuteremo ad analizzare il tuo business e capire come scalare le tue vendite.'}
                        </p>

                        <div className="space-y-4">
                            <div className="flex items-center gap-3 text-neutral-300">
                                <Clock className="w-5 h-5 text-neutral-500" />
                                <span>{calendar?.duration || 30} minuti</span>
                            </div>
                            <div className="flex items-center gap-3 text-neutral-300">
                                <User className="w-5 h-5 text-neutral-500" />
                                <span>Google Meet o Telefono</span>
                            </div>
                        </div>
                    </div>

                    <div className="relative z-10 mt-12 text-sm text-neutral-600">
                        © {new Date().getFullYear()} Metodo Sincro. Tutti i diritti riservati.
                    </div>
                </div>

                {/* Right Panel: Interactive */}
                <div className="md:col-span-8 p-8 md:p-10 bg-[#0A0A0A] relative">
                    
                    {step === 1 && (
                        <div className="animate-in fade-in slide-in-from-right-4 duration-500">
                            <div className="mb-8">
                                <h3 className="text-xl font-medium text-white">Seleziona una data e un orario</h3>
                                <p className="text-neutral-500 mt-1 text-sm">Mostrando gli orari disponibili in base al tuo fuso orario.</p>
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
                                {/* Date Selection */}
                                <div>
                                    <div className="grid grid-cols-2 gap-3 max-h-[400px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                                        {availableDates.map(date => {
                                            const isSelected = selectedDate === date
                                            const d = new Date(date)
                                            return (
                                                <button
                                                    key={date}
                                                    onClick={() => setSelectedDate(date)}
                                                    className={`
                                                        p-4 flex flex-col items-center justify-center rounded-xl transition-all duration-200 border
                                                        ${isSelected 
                                                            ? 'bg-blue-600 border-blue-500 text-white shadow-[0_0_20px_rgba(59,130,246,0.3)]' 
                                                            : 'bg-[#111] border-white/5 text-neutral-300 hover:bg-[#151515] hover:border-white/10'}
                                                    `}
                                                >
                                                    <span className="text-xs uppercase font-medium tracking-wider mb-1 opacity-80">
                                                        {d.toLocaleDateString('it-IT', { weekday: 'short' })}
                                                    </span>
                                                    <span className="text-2xl font-semibold">
                                                        {d.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })}
                                                    </span>
                                                </button>
                                            )
                                        })}
                                    </div>
                                </div>

                                {/* Time Selection */}
                                <div>
                                    {slotsForDate.length === 0 ? (
                                        <div className="h-full flex items-center justify-center flex-col text-neutral-500">
                                            <CalendarIcon className="w-8 h-8 mb-3 opacity-50" />
                                            <p>Nessun orario disponibile per la data selezionata.</p>
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-2 gap-3 max-h-[400px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                                            {slotsForDate.map(slot => {
                                                const startDt = new Date(slot.time)
                                                const timeStr = `${startDt.getHours().toString().padStart(2,'0')}:${startDt.getMinutes().toString().padStart(2,'0')}`
                                                const isSelected = selectedSlot === slot.time

                                                return (
                                                    <button
                                                        key={slot.time}
                                                        onClick={() => setSelectedSlot(slot.time)}
                                                        className={`
                                                            py-3 px-4 rounded-xl border text-center transition-all duration-200
                                                            ${isSelected 
                                                                ? 'bg-blue-600 border-blue-500 text-white shadow-[0_0_20px_rgba(59,130,246,0.3)]' 
                                                                : 'bg-[#111] border-white/5 text-neutral-300 hover:bg-[#151515] hover:border-white/10'}
                                                        `}
                                                    >
                                                        {timeStr}
                                                    </button>
                                                )
                                            })}
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="mt-10 pt-6 border-t border-white/5 flex justify-end">
                                <button
                                    disabled={!selectedSlot}
                                    onClick={() => setStep(2)}
                                    className={`
                                        flex items-center gap-2 px-8 py-3.5 rounded-xl font-medium transition-all duration-300
                                        ${selectedSlot 
                                            ? 'bg-white text-black hover:bg-neutral-200 hover:scale-[1.02] active:scale-95' 
                                            : 'bg-white/5 text-neutral-500 cursor-not-allowed'}
                                    `}
                                >
                                    Avanti <ChevronRight className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    )}

                    {step === 2 && (
                        <div className="animate-in fade-in slide-in-from-right-4 duration-500 max-w-lg mx-auto">
                            <div className="mb-8 flex items-center justify-between">
                                <div>
                                    <h3 className="text-xl font-medium text-white mb-2">Conferma i tuoi dati</h3>
                                    {selectedSlot && (
                                        <p className="text-blue-400 text-sm flex items-center gap-2 bg-blue-500/10 w-fit px-3 py-1 rounded-lg">
                                            <CalendarIcon className="w-4 h-4" />
                                            {new Date(selectedSlot).toLocaleString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute:'2-digit' })}
                                        </p>
                                    )}
                                </div>
                            </div>

                            <form onSubmit={handleBook} className="space-y-5">
                                {error && (
                                    <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
                                        {error}
                                    </div>
                                )}

                                <div>
                                    <label className="text-sm text-neutral-400 mb-1.5 block">Nome completo</label>
                                    <div className="relative">
                                        <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-500" />
                                        <input 
                                            type="text" 
                                            required
                                            value={formData.name}
                                            onChange={e => setFormData({ ...formData, name: e.target.value })}
                                            className="w-full bg-[#111] border border-white/5 rounded-xl py-3 pl-11 pr-4 text-white placeholder-neutral-600 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 transition-all"
                                            placeholder="Mario Rossi"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="text-sm text-neutral-400 mb-1.5 block">Email</label>
                                    <div className="relative">
                                        <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-500" />
                                        <input 
                                            type="email" 
                                            required
                                            value={formData.email}
                                            onChange={e => setFormData({ ...formData, email: e.target.value })}
                                            className="w-full bg-[#111] border border-white/5 rounded-xl py-3 pl-11 pr-4 text-white placeholder-neutral-600 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 transition-all"
                                            placeholder="mario@example.com"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="text-sm text-neutral-400 mb-1.5 block">Telefono</label>
                                    <div className="relative">
                                        <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-500" />
                                        <input 
                                            type="tel" 
                                            required
                                            value={formData.phone}
                                            onChange={e => setFormData({ ...formData, phone: e.target.value })}
                                            className="w-full bg-[#111] border border-white/5 rounded-xl py-3 pl-11 pr-4 text-white placeholder-neutral-600 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 transition-all"
                                            placeholder="+39 333 123 4567"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="text-sm text-neutral-400 mb-1.5 block">Cosa vuoi approfondire? (Opzionale)</label>
                                    <div className="relative">
                                        <MessageSquare className="absolute left-3.5 top-4 w-5 h-5 text-neutral-500" />
                                        <textarea 
                                            rows={3}
                                            value={formData.notes}
                                            onChange={e => setFormData({ ...formData, notes: e.target.value })}
                                            className="w-full bg-[#111] border border-white/5 rounded-xl py-3 pl-11 pr-4 text-white placeholder-neutral-600 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 transition-all resize-none"
                                            placeholder="Scrivi qui eventuali note..."
                                        />
                                    </div>
                                </div>

                                <div className="pt-4 flex items-center justify-between">
                                    <button
                                        type="button"
                                        onClick={() => setStep(1)}
                                        className="text-neutral-400 hover:text-white transition-colors text-sm"
                                    >
                                        Torna indietro
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={submitting}
                                        className={`
                                            flex items-center justify-center gap-2 px-8 py-3.5 rounded-xl font-medium transition-all duration-300 w-full max-w-[200px]
                                            ${submitting 
                                                ? 'bg-blue-600/50 text-white/50 cursor-not-allowed' 
                                                : 'bg-blue-600 text-white hover:bg-blue-500 hover:scale-[1.02] relative shadow-[0_0_20px_rgba(59,130,246,0.3)]'}
                                        `}
                                    >
                                        {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Prenota ora'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    )}

                    {step === 3 && (
                        <div className="h-full flex flex-col items-center justify-center text-center animate-in zoom-in-95 duration-500 py-12">
                            <div className="w-20 h-20 bg-green-500/10 rounded-full flex items-center justify-center mb-6 relative">
                                <div className="absolute inset-0 bg-green-500/20 blur-xl rounded-full" />
                                <CheckCircle2 className="w-10 h-10 text-green-500 relative z-10" />
                            </div>
                            <h2 className="text-3xl font-semibold text-white mb-4 tracking-tight">Prenotazione Confermata!</h2>
                            <p className="text-neutral-400 max-w-md mx-auto mb-8">
                                Riceverai a breve un'email con tutti i dettagli dell'appuntamento.
                                {redirectUrl && ' Reindirizzamento in corso...'}
                            </p>

                            {redirectUrl && (
                                <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
                            )}
                        </div>
                    )}

                </div>
            </div>
        </div>
    )
}
