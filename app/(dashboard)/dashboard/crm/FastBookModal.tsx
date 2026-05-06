"use client";

import { useState, useEffect, useMemo } from 'react'
import { CalendarDays, X, User, Users, Clock, Loader2, Sparkles, AlertCircle, Tag } from 'lucide-react'

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
    
    // Service types
    const [serviceTypes, setServiceTypes] = useState<any[]>([])
    const [selectedServiceTypeId, setSelectedServiceTypeId] = useState('')

    // Fetch closers and service types on mount
    useEffect(() => {
        fetch('/api/calendar?action=closers')
            .then(res => res.json())
            .then(data => {
                const arr = data.closers || []
                setClosers(arr)
            })
            .catch(console.error)
        fetch('/api/calendar?action=service_types')
            .then(res => res.json())
            .then(data => setServiceTypes(data.service_types || []))
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
            nextWeek.setDate(nextWeek.getDate() + 14)
            
            const stParam = selectedServiceTypeId ? `&service_type_id=${selectedServiceTypeId}` : ''
            const res = await fetch(`/api/calendar?action=auto_slots&from=${today.toISOString()}&to=${nextWeek.toISOString()}${stParam}`)
            const data = await res.json()
            setAutoSlots(data.slots || [])
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
            nextWeek.setDate(nextWeek.getDate() + 14)
            
            const stParam = selectedServiceTypeId ? `&service_type_id=${selectedServiceTypeId}` : ''
            const res = await fetch(`/api/calendar?action=slots&closer_id=${closerId}&from=${today.toISOString()}&to=${nextWeek.toISOString()}${stParam}`)
            const data = await res.json()
            const filtered = (data.slots || []).filter((s: any) => s.available === true)
            setAvailableSlots(filtered.map((s:any) => ({ ...s, closer_id: closerId })))
        } catch (e) {
            console.error(e)
        }
        setFetchingSlots(false)
    }

    const [selectedDate, setSelectedDate] = useState<string | null>(null)

    useEffect(() => {
        if (bookingMode === 'auto' && closers.length > 0) {
            fetchAutoSlots()
        } else if (bookingMode === 'manual' && selectedCloserId) {
            fetchManualSlots(selectedCloserId)
        } else {
            // Selezionando manuale ma nessun closer, svuota 
            setAvailableSlots([])
        }
    }, [bookingMode, selectedCloserId, closers, selectedServiceTypeId])

    const handleBook = async () => {
        if (!selectedSlot) return
        setBookingState('loading')
        try {
            let apiUrl = '/api/calendar'
            let bodyData: any = {
                action: bookingMode === 'auto' ? 'auto_book' : 'book',
                lead_id: lead.id,
                title: `Appuntamento - ${lead.name}`,
                description: `Lead: ${lead.name}`,
                lead_phone: lead.phone,
                lead_email: lead.email,
                lead_name: lead.name,
                service_type_id: selectedServiceTypeId || undefined,
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

    const slotsToRender = bookingMode === 'auto' ? autoSlots : availableSlots

    // Group slots by local date (YYYY-MM-DD)
    const groupedSlots = useMemo(() => {
        const groups: Record<string, any[]> = {}
        slotsToRender.forEach(slot => {
            // Otteniamo la data locale nel formato YYYY-MM-DD per raggruppamento coerente
            const d = new Date(slot.start)
            const year = d.getFullYear()
            const month = String(d.getMonth() + 1).padStart(2, '0')
            const day = String(d.getDate()).padStart(2, '0')
            const dateStr = `${year}-${month}-${day}`
            
            if (!groups[dateStr]) groups[dateStr] = []
            groups[dateStr].push(slot)
        })
        
        // Ordina le chiavi
        return Object.keys(groups).sort().map(dateStr => ({
            date: dateStr,
            slots: groups[dateStr].sort((a,b) => new Date(a.start).getTime() - new Date(b.start).getTime())
        }))
    }, [slotsToRender])

    // Pre-seleziona la prima data disponibile
    useEffect(() => {
        if (groupedSlots.length > 0 && !selectedDate) {
            setSelectedDate(groupedSlots[0].date)
        } else if (groupedSlots.length === 0) {
            setSelectedDate(null)
            setSelectedSlot(null)
        }
    }, [groupedSlots])

    // Filtra gli slot da far vedere a destra
    const activeDateGroup = groupedSlots.find(g => g.date === selectedDate)

    return (
        <div className="fixed inset-0 bg-[var(--overlay-bg)] backdrop-blur-sm z-50 flex items-center justify-center p-4 shadow-2xl" onClick={onClose}>
            <div className="w-full max-w-[700px] rounded-2xl p-6 space-y-5 flex flex-col max-h-[90vh] overflow-y-auto custom-scrollbar" onClick={e => e.stopPropagation()}
                style={{ background: 'var(--color-surface-0)', border: '1px solid var(--color-surface-200)', boxShadow: 'var(--card-shadow-hover)' }}>
                
                <div className="flex items-center justify-between shrink-0">
                    <h2 className="text-lg font-bold th-heading flex items-center gap-2">
                        <CalendarDays className="w-5 h-5" style={{ color: '#6366f1' }} /> Fast Booking
                    </h2>
                    <button onClick={onClose} className="p-1 rounded-lg th-bg-hover transition-colors">
                        <X className="w-5 h-5" style={{ color: 'var(--color-surface-400)' }} />
                    </button>
                </div>

                <div className="p-4 rounded-xl bg-indigo-500/10 border border-indigo-500/20 shrink-0 flex items-center justify-between">
                    <div>
                        <div className="text-sm font-medium" style={{ color: 'var(--color-surface-600)' }}>Cliente: <span className="font-bold th-heading">{lead.name}</span></div>
                        <div className="text-xs flex items-center gap-3 mt-1" style={{ color: 'var(--color-surface-500)' }}>
                            {lead.phone && <span>{lead.phone}</span>}
                            {lead.email && <span>{lead.email}</span>}
                        </div>
                    </div>
                </div>

                {/* Booking mode toggle */}
                    <div className="flex flex-col gap-3 shrink-0">
                    <div className="flex rounded-xl overflow-hidden" style={{ border: '1px solid var(--color-surface-200)' }}>
                        <button
                            onClick={() => { setBookingMode('auto'); setSelectedSlot(null); setSelectedDate(null); }}
                            className={`flex-1 py-2.5 text-sm font-bold transition-all flex justify-center items-center gap-2 ${bookingMode === 'auto' ? 'bg-indigo-500 text-white' : 'th-sub'}`}
                            style={bookingMode !== 'auto' ? { background: 'var(--color-surface-100)' } : undefined}
                        >
                            <Sparkles className="w-4 h-4" /> Auto-Assegna
                        </button>
                        <button
                            onClick={() => { setBookingMode('manual'); setSelectedSlot(null); setSelectedDate(null); }}
                            className={`flex-1 py-2.5 text-sm font-bold transition-all flex justify-center items-center gap-2 ${bookingMode === 'manual' ? 'bg-indigo-500 text-white' : 'th-sub'}`}
                            style={bookingMode !== 'manual' ? { background: 'var(--color-surface-100)' } : undefined}
                        >
                            <User className="w-4 h-4" /> Scegli Venditore
                        </button>
                    </div>

                    {bookingMode === 'auto' && (
                        <div className="p-3 mb-1 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-xs font-medium" style={{ color: '#4f46e5' }}>
                            <Sparkles className="w-3.5 h-3.5 inline mr-1 text-indigo-500" />
                            Il venditore verrà assegnato automaticamente al momento della conferma, bilanciando il carico e la performance.
                        </div>
                    )}

                    {bookingMode === 'manual' && (
                        <div className="flex flex-col gap-1.5 border-b border-[var(--color-surface-200)] pb-4">
                            <label className="text-xs font-semibold th-sub ml-1">Vedi disponibilità per:</label>
                            <select
                                value={selectedCloserId}
                                onChange={(e) => setSelectedCloserId(e.target.value)}
                                className="input"
                            >
                                <option value="">Seleziona venditore...</option>
                                {closers.map(c => (
                                    <option key={c.user_id} value={c.user_id}>
                                        {c.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}
                </div>

                {/* Service Type Selector */}
                {serviceTypes.length > 0 && (
                    <div className="shrink-0">
                        <label className="text-xs font-semibold th-sub block mb-2 ml-1">Tipo di appuntamento</label>
                        <div className="flex flex-wrap gap-2">
                            <button
                                onClick={() => { setSelectedServiceTypeId(''); setSelectedSlot(null); setSelectedDate(null) }}
                                className="px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all flex items-center gap-1.5"
                                style={{
                                    background: !selectedServiceTypeId ? 'rgba(99,102,241,0.15)' : 'var(--color-surface-100)',
                                    border: `1px solid ${!selectedServiceTypeId ? '#6366f1' : 'var(--color-surface-200)'}`,
                                    color: !selectedServiceTypeId ? '#4f46e5' : 'var(--color-surface-500)',
                                }}
                            >
                                Tutti
                            </button>
                            {serviceTypes.map(st => (
                                <button
                                    key={st.id}
                                    onClick={() => { setSelectedServiceTypeId(st.id); setSelectedSlot(null); setSelectedDate(null) }}
                                    className="px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all flex items-center gap-1.5"
                                    style={{
                                        background: selectedServiceTypeId === st.id ? `${st.color}20` : 'var(--color-surface-100)',
                                        border: `1px solid ${selectedServiceTypeId === st.id ? st.color : 'var(--color-surface-200)'}`,
                                        color: selectedServiceTypeId === st.id ? st.color : 'var(--color-surface-500)',
                                    }}
                                >
                                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: st.color }} />
                                    {st.name}
                                    <span className="opacity-60">{st.duration_minutes}min</span>
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Calendly Style 2-Pane UI */}
                <div className="flex-1 min-h-[300px] overflow-hidden flex flex-col md:flex-row gap-4">
                    {fetchingSlots ? (
                        <div className="w-full h-full flex flex-col items-center justify-center gap-3">
                            <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
                            <span className="text-sm font-medium th-muted">Caricamento disponibilità...</span>
                        </div>
                    ) : groupedSlots.length === 0 ? (
                        <div className="w-full h-full flex items-center justify-center">
                            <div className="py-8 px-6 rounded-2xl text-center max-w-sm" style={{ background: 'var(--color-surface-100)', border: '1px solid var(--color-surface-200)' }}>
                                <AlertCircle className="w-8 h-8 text-yellow-500 mx-auto mb-3" />
                                <p className="text-sm font-medium th-heading">
                                    {bookingMode === 'auto' 
                                        ? 'Nessun venditore ha slot disponibili nei prossimi 14 giorni.' 
                                        : (!selectedCloserId ? 'Seleziona un venditore per visualizzare il calendario.' : 'Questo venditore non ha slot liberi nei prossimi 14 giorni.')}
                                </p>
                            </div>
                        </div>
                    ) : (
                        <>
                            {/* Left Pane: Dates */}
                            <div className="w-full md:w-[45%] flex flex-col border rounded-xl overflow-hidden" style={{ borderColor: 'var(--color-surface-200)', background: 'var(--color-surface-100)' }}>
                                <div className="p-3 border-b shrink-0" style={{ borderColor: 'var(--color-surface-200)', background: 'var(--color-surface-50)' }}>
                                    <span className="text-xs font-bold th-heading uppercase tracking-wider pl-1">Seleziona Data</span>
                                </div>
                                <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
                                    {groupedSlots.map((group) => {
                                        const d = new Date(group.date)
                                        const isSelected = selectedDate === group.date
                                        return (
                                            <button
                                                key={group.date}
                                                onClick={() => { setSelectedDate(group.date); setSelectedSlot(null); }}
                                                className={`w-full flex items-center justify-between px-4 py-3 rounded-lg transition-all text-left ${
                                                    isSelected 
                                                    ? 'bg-indigo-500 text-white font-bold shadow-lg shadow-indigo-500/20' 
                                                    : 'th-heading th-bg-hover font-medium'
                                                }`}
                                            >
                                                <span className="capitalize">
                                                    {d.toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short' })}
                                                </span>
                                                <span className={`text-[10px] px-2 py-0.5 rounded-full ${isSelected ? 'bg-white/20 text-white' : 'th-muted'}`} style={!isSelected ? { background: 'var(--color-surface-200)' } : undefined}>
                                                    {group.slots.length}
                                                </span>
                                            </button>
                                        )
                                    })}
                                </div>
                            </div>

                            {/* Right Pane: Time Slots */}
                            <div className="w-full md:w-[55%] flex flex-col border rounded-xl overflow-hidden" style={{ borderColor: 'var(--color-surface-200)', background: 'var(--color-surface-100)' }}>
                                <div className="p-3 border-b shrink-0 flex items-center justify-between" style={{ borderColor: 'var(--color-surface-200)', background: 'var(--color-surface-50)' }}>
                                    <span className="text-xs font-bold th-heading uppercase tracking-wider pl-1">Seleziona Orario</span>
                                    {selectedDate && (
                                        <span className="text-xs font-medium th-muted">
                                            {new Date(selectedDate).toLocaleDateString('it-IT', { day: 'numeric', month: 'long' })}
                                        </span>
                                    )}
                                </div>
                                <div className="flex-1 overflow-y-auto p-3 custom-scrollbar">
                                    <div className="grid grid-cols-2 gap-2">
                                        {activeDateGroup?.slots.map((slot, idx) => {
                                            const isSelected = selectedSlot === slot
                                            return (
                                                <button
                                                    key={idx}
                                                    onClick={() => setSelectedSlot(slot)}
                                                    className={`relative flex items-center justify-center py-3.5 rounded-xl text-sm transition-all border ${
                                                        isSelected
                                                        ? 'bg-indigo-500/15 border-indigo-500 font-bold'
                                                        : 'font-medium'
                                                    }`}
                                                    style={isSelected 
                                                        ? { color: '#4f46e5' } 
                                                        : { background: 'var(--color-surface-50)', borderColor: 'var(--color-surface-200)', color: 'var(--color-surface-800)' }
                                                    }
                                                >
                                                    {new Date(slot.start).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
                                                    
                                                    {/* Badge minuscolo per info in manuale (opzionale) */}
                                                    {isSelected && (
                                                        <div className="absolute inset-0 rounded-xl border-2 border-indigo-500 pointer-events-none" />
                                                    )}
                                                </button>
                                            )
                                        })}
                                    </div>
                                </div>
                            </div>
                        </>
                    )}
                </div>

                {errorMsg && (
                    <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-xs font-medium text-red-500 flex items-center gap-2 shrink-0">
                        <AlertCircle className="w-4 h-4" /> {errorMsg}
                    </div>
                )}

                <div className="pt-4 mt-2 border-t flex justify-end gap-3 shrink-0 sticky bottom-0 pb-1" style={{ borderColor: 'var(--color-surface-200)', background: 'var(--color-surface-0)' }}>
                    <button
                        onClick={onClose}
                        className="btn-secondary !py-2.5 !px-4 !text-sm"
                        disabled={bookingState === 'loading'}
                    >
                        Annulla
                    </button>
                    <button
                        onClick={handleBook}
                        disabled={!selectedSlot || bookingState === 'loading' || bookingState === 'success'}
                        className={`px-6 py-2.5 rounded-xl text-sm font-bold text-white transition-all shadow-lg flex items-center gap-2 ${
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
