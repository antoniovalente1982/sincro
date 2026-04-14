"use client";

import { useState, useEffect } from 'react'
import { CalendarDays, X, User, Users, Clock, Loader2, Sparkles, AlertCircle } from 'lucide-react'

interface FastBookModalProps {
    lead: any
    onClose: () => void
    onSuccess: () => void
}

export default function FastBookModal({ lead, onClose, onSuccess }: FastBookModalProps) {
    const [bookingMode, setBookingMode] = useState<'auto' | 'manual'>('auto')
    const [closers, setClosers] = useState<any[]>([])
    const [selectedCloserId, setSelectedCloserId] = useState('')
    
    // Auto slots
    const [autoSlots, setAutoSlots] = useState<any[]>([])
    // Manual slots
    const [availableSlots, setAvailableSlots] = useState<any[]>([])
    const [fetchingSlots, setFetchingSlots] = useState(false)
    const [selectedSlot, setSelectedSlot] = useState<any | null>(null)
    
    const [bookingState, setBookingState] = useState<'idle'|'loading'|'success'|'error'>('idle')
    const [errorMsg, setErrorMsg] = useState('')

    // Fetch closers on mount
    useEffect(() => {
        fetch('/api/calendar?action=closers')
            .then(res => res.json())
            .then(data => {
                const arr = (data.closers || []).filter((c: any) => c.has_availability === true)
                setClosers(arr)
            })
            .catch(console.error)
    }, [])

    // Fetch Auto Slots
    const fetchAutoSlots = async () => {
        setFetchingSlots(true)
        setSelectedSlot(null)
        try {
            const today = new Date()
            today.setHours(0,0,0,0)
            const nextWeek = new Date(today)
            nextWeek.setDate(nextWeek.getDate() + 7)
            
            const allSlots: any[] = []
            
            // Fetch for all available closers
            for (const closer of closers) {
                if (!closer.has_availability) continue;
                
                const res = await fetch(`/api/calendar?action=slots&closer_id=${closer.user_id}&from=${today.toISOString()}&to=${nextWeek.toISOString()}`)
                const data = await res.json()
                const slots = (data.slots || []).filter((s: any) => s.available === true)
                
                slots.forEach((s: any) => {
                    // Evita duplicati di orario
                    if (!allSlots.some(existing => existing.start === s.start)) {
                        allSlots.push({ ...s, closer_id: closer.user_id })
                    }
                })
            }
            
            allSlots.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
            setAutoSlots(allSlots)
        } catch (e) {
            console.error(e)
        }
        setFetchingSlots(false)
    }

    // Fetch Manual Slots for Closer
    const fetchManualSlots = async (closerId: string) => {
        setFetchingSlots(true)
        setSelectedSlot(null)
        try {
            const today = new Date()
            today.setHours(0,0,0,0)
            const nextWeek = new Date(today)
            nextWeek.setDate(nextWeek.getDate() + 7)
            
            const res = await fetch(`/api/calendar?action=slots&closer_id=${closerId}&from=${today.toISOString()}&to=${nextWeek.toISOString()}`)
            const data = await res.json()
            const filtered = (data.slots || []).filter((s: any) => s.available === true)
            setAvailableSlots(filtered.map((s:any) => ({ ...s, closer_id: closerId })))
        } catch (e) {
            console.error(e)
        }
        setFetchingSlots(false)
    }

    useEffect(() => {
        if (bookingMode === 'auto' && closers.length > 0) {
            fetchAutoSlots()
        } else if (bookingMode === 'manual' && selectedCloserId) {
            fetchManualSlots(selectedCloserId)
        }
    }, [bookingMode, selectedCloserId, closers])

    const handleBook = async () => {
        if (!selectedSlot) return
        setBookingState('loading')
        try {
            let apiUrl = '/api/calendar'
            let bodyData: any = {
                action: bookingMode === 'auto' ? 'auto_book' : 'book',
                lead_id: lead.id,
                title: `Appuntamento - ${lead.name}`,
                notes: `App. creato dal Fast Booking nel CRM.`,
                lead_phone: lead.phone,
                lead_email: lead.email,
                lead_name: lead.name
            }
            
            if (bookingMode === 'auto') {
                bodyData.start_time = selectedSlot.start
                bodyData.end_time = selectedSlot.end || new Date(new Date(selectedSlot.start).getTime() + 45*60000).toISOString()
            } else {
                bodyData.closer_id = selectedSlot.closer_id
                bodyData.start_time = selectedSlot.start
                bodyData.end_time = selectedSlot.end || new Date(new Date(selectedSlot.start).getTime() + 45*60000).toISOString()
            }

            const res = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(bodyData)
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || 'Errore prenotazione')
            setBookingState('success')
            setTimeout(() => {
                onSuccess()
                onClose()
            }, 1500)
        } catch (e: any) {
            setBookingState('error')
            setErrorMsg(e.message)
        }
    }

    const formatSlotTime = (iso: string) => {
        const d = new Date(iso)
        return d.toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short' }) + ' - ' + 
               d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })
    }

    const slotsToRender = bookingMode === 'auto' ? autoSlots : availableSlots

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 shadow-2xl" onClick={onClose}>
            <div className="w-full max-w-[500px] rounded-2xl p-6 space-y-5 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}
                style={{ background: 'var(--color-surface-50)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <div className="flex items-center justify-between">
                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                        <CalendarDays className="w-5 h-5" style={{ color: '#6366f1' }} /> Fast Booking
                    </h2>
                    <button onClick={onClose} className="p-1 rounded-lg hover:bg-white/5 transition-colors">
                        <X className="w-5 h-5 text-white/50 hover:text-white" />
                    </button>
                </div>

                <div className="p-4 rounded-xl bg-indigo-500/10 border border-indigo-500/20">
                    <div className="text-sm font-medium text-white/90">Cliente: <span className="font-bold text-white">{lead.name}</span></div>
                    {lead.phone && <div className="text-xs text-white/60">{lead.phone}</div>}
                    {lead.email && <div className="text-xs text-white/60">{lead.email}</div>}
                </div>

                {/* Booking mode toggle */}
                <div className="flex flex-col gap-3">
                    <div className="flex rounded-xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.1)' }}>
                        <button
                            onClick={() => { setBookingMode('auto'); setSelectedSlot(null) }}
                            className={`flex-1 py-2 text-xs font-bold transition-all flex justify-center items-center gap-2 ${bookingMode === 'auto' ? 'bg-white/10 text-white' : 'text-white/50 hover:text-white/80 hover:bg-white/5'}`}
                        >
                            <Sparkles className="w-3.5 h-3.5" /> Auto-Assegna
                        </button>
                        <button
                            onClick={() => { setBookingMode('manual'); setSelectedSlot(null) }}
                            className={`flex-1 py-2 text-xs font-bold transition-all flex justify-center items-center gap-2 ${bookingMode === 'manual' ? 'bg-white/10 text-white' : 'text-white/50 hover:text-white/80 hover:bg-white/5'}`}
                        >
                            <User className="w-3.5 h-3.5" /> Scegli Venditore
                        </button>
                    </div>

                    {bookingMode === 'manual' && (
                        <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-semibold text-white/60 ml-1">Venditore</label>
                            <select
                                value={selectedCloserId}
                                onChange={(e) => setSelectedCloserId(e.target.value)}
                                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm font-medium text-white outline-none focus:border-indigo-500"
                            >
                                <option value="" className="text-black">Seleziona venditore...</option>
                                {closers.map(c => (
                                    <option key={c.user_id} value={c.user_id} className="text-black">
                                        {c.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}
                </div>

                <div className="space-y-2">
                    <label className="text-xs font-semibold text-white/60 ml-1 flex items-center justify-between">
                        <span>Slot Disponibili (Prossimi 7 gg)</span>
                    </label>

                    {fetchingSlots ? (
                        <div className="py-8 flex flex-col items-center justify-center gap-3">
                            <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
                            <span className="text-xs font-medium text-white/50">Caricamento slot...</span>
                        </div>
                    ) : slotsToRender.length === 0 ? (
                        <div className="py-6 px-4 rounded-xl text-center" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
                            <AlertCircle className="w-6 h-6 text-yellow-500/80 mx-auto mb-2" />
                            <p className="text-xs font-medium text-white/60">
                                {bookingMode === 'auto' ? 'Nessuno slot disponibile nei prossimi 7 giorni.' : (!selectedCloserId ? 'Seleziona un venditore per vedere gli slot.' : 'Questo venditore non ha slot liberi nei prossimi 7 giorni.')}
                            </p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 gap-2 max-h-[220px] overflow-y-auto pr-1">
                            {slotsToRender.map((slot, idx) => (
                                <button
                                    key={idx}
                                    onClick={() => setSelectedSlot(slot)}
                                    className={`flex flex-col items-start gap-1 p-3 rounded-xl transition-all border text-left ${selectedSlot === slot
                                            ? 'bg-indigo-500/20 border-indigo-500'
                                            : 'bg-white/5 border-white/5 hover:bg-white/10 hover:border-white/20'
                                        }`}
                                >
                                    <div className="text-xs font-bold text-white flex items-center gap-1.5">
                                        <Clock className="w-3.5 h-3.5" style={{ color: selectedSlot === slot ? '#a5b4fc' : '#9ca3af' }} />
                                        {new Date(slot.start).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
                                    </div>
                                    <div className="text-[10px] uppercase font-semibold tracking-wider text-white/60">
                                        {new Date(slot.start).toLocaleDateString('it-IT', { weekday: 'short', day: '2-digit', month: 'short' })}
                                    </div>
                                    {bookingMode === 'auto' && (
                                        <div className="text-[9px] font-medium text-indigo-400 truncate w-full mt-0.5">
                                            {closers.find(c => c.user_id === slot.closer_id)?.name || 'Venditore'}
                                        </div>
                                    )}
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {errorMsg && (
                    <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-xs font-medium text-red-500 flex items-center gap-2">
                        <AlertCircle className="w-4 h-4" /> {errorMsg}
                    </div>
                )}

                <div className="pt-4 mt-4 border-t border-white/10 flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 rounded-lg text-sm font-semibold transition-colors bg-white/5 text-white/70 hover:bg-white/10 hover:text-white"
                        disabled={bookingState === 'loading'}
                    >
                        Annulla
                    </button>
                    <button
                        onClick={handleBook}
                        disabled={!selectedSlot || bookingState === 'loading' || bookingState === 'success'}
                        className={`px-5 py-2 rounded-lg text-sm font-bold text-white transition-all shadow-lg flex items-center gap-2 ${
                            !selectedSlot || bookingState === 'loading' || bookingState === 'success' ? 'opacity-50 cursor-not-allowed' : 'hover:scale-105'
                        }`}
                        style={{ background: bookingState === 'success' ? '#22c55e' : 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}
                    >
                        {bookingState === 'loading' ? (
                            <><Loader2 className="w-4 h-4 animate-spin" /> Conferma...</>
                        ) : bookingState === 'success' ? (
                            'Prenotato! ✅'
                        ) : (
                            'Conferma Appuntamento'
                        )}
                    </button>
                </div>
            </div>
        </div>
    )
}
