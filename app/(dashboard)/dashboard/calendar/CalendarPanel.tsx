'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { CalendarDays, Clock, Users, Plus, ChevronLeft, ChevronRight, Phone, Mail, User, X, Check, Settings, AlertCircle } from 'lucide-react'

const DAYS = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab']
const DAYS_FULL = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato']
const HOURS = Array.from({ length: 14 }, (_, i) => i + 7) // 7:00 - 20:00

interface CalendarEvent {
    id: string
    title: string
    start_time: string
    end_time: string
    closer_id: string
    closer_name: string
    closer_color: string
    setter_name?: string
    setter_id?: string
    lead_id?: string
    lead_phone?: string
    lead_email?: string
    status: string
    outcome?: string
    outcome_value?: number
    leads?: { name: string; phone?: string; email?: string } | null
}

interface Closer {
    user_id: string
    name: string
    color: string
    available_days: number[]
    has_availability: boolean
}

interface Slot {
    date: string
    start: string
    end: string
    available: boolean
}

interface AvailabilitySchedule {
    day_of_week: number
    start_time: string
    end_time: string
    slot_duration_minutes: number
    break_between_slots: number
    is_active: boolean
}

interface Props {
    userRole: string
    userId: string
    prefillLead?: { id: string; name: string; email?: string; phone?: string } | null
}

export default function CalendarPanel({ userRole, userId, prefillLead }: Props) {
    const [currentDate, setCurrentDate] = useState(new Date())
    const [events, setEvents] = useState<CalendarEvent[]>([])
    const [closers, setClosers] = useState<Closer[]>([])
    const [selectedCloser, setSelectedCloser] = useState<string>('all')
    const [loading, setLoading] = useState(true)
    const [showBooking, setShowBooking] = useState(false)
    const [showSettings, setShowSettings] = useState(false)
    const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null)
    const [availableSlots, setAvailableSlots] = useState<Slot[]>([])
    const [slotsLoading, setSlotsLoading] = useState(false)
    const [view, setView] = useState<'week' | 'day'>('week')

    // Booking form state
    const [bookCloserId, setBookCloserId] = useState('')
    const [bookSlot, setBookSlot] = useState<Slot | null>(null)
    const [bookTitle, setBookTitle] = useState('Appuntamento')
    const [bookPhone, setBookPhone] = useState('')
    const [bookEmail, setBookEmail] = useState('')
    const [bookLeadName, setBookLeadName] = useState('')
    const [bookNotes, setBookNotes] = useState('')
    const [bookingSaving, setBookingSaving] = useState(false)

    // Availability settings state
    const [availability, setAvailability] = useState<AvailabilitySchedule[]>([])
    const [availSaving, setAvailSaving] = useState(false)
    const [settingsCloserId, setSettingsCloserId] = useState('')

    const canBook = ['setter', 'admin', 'owner', 'manager'].includes(userRole)
    const canManageAvailability = ['closer', 'admin', 'owner', 'manager'].includes(userRole)

    // Week boundaries
    const weekStart = useMemo(() => {
        const d = new Date(currentDate)
        d.setDate(d.getDate() - d.getDay() + 1) // Monday
        d.setHours(0, 0, 0, 0)
        return d
    }, [currentDate])

    const weekEnd = useMemo(() => {
        const d = new Date(weekStart)
        d.setDate(d.getDate() + (view === 'week' ? 7 : 1))
        return d
    }, [weekStart, view])

    const weekDays = useMemo(() => {
        if (view === 'day') {
            return [new Date(currentDate)]
        }
        return Array.from({ length: 7 }, (_, i) => {
            const d = new Date(weekStart)
            d.setDate(d.getDate() + i)
            return d
        })
    }, [weekStart, view, currentDate])

    // Fetch events
    const fetchEvents = useCallback(async () => {
        setLoading(true)
        try {
            const from = weekStart.toISOString()
            const to = weekEnd.toISOString()
            const closerParam = selectedCloser !== 'all' ? `&closer_id=${selectedCloser}` : ''
            const res = await fetch(`/api/calendar?action=events&from=${from}&to=${to}${closerParam}`)
            const data = await res.json()
            setEvents(data.events || [])
        } catch { /* silent */ }
        setLoading(false)
    }, [weekStart, weekEnd, selectedCloser])

    // Fetch closers
    const fetchClosers = useCallback(async () => {
        try {
            const res = await fetch('/api/calendar?action=closers')
            const data = await res.json()
            setClosers(data.closers || [])
        } catch { /* silent */ }
    }, [])

    useEffect(() => { fetchClosers() }, [fetchClosers])
    useEffect(() => { fetchEvents() }, [fetchEvents])

    // CRM Fast Booking auto-open
    useEffect(() => {
        if (prefillLead && !showBooking && canBook) {
            setBookLeadName(prefillLead.name || '')
            setBookPhone(prefillLead.phone || '')
            setBookEmail(prefillLead.email || '')
            setShowBooking(true)
            
            // Clean up the URL visually without refreshing the page
            if (typeof window !== 'undefined') {
                const url = new URL(window.location.href)
                url.searchParams.delete('book_lead_id')
                window.history.replaceState({}, '', url.toString())
            }
        }
    }, [prefillLead, canBook])

    // Fetch available slots for booking
    const fetchSlots = async (closerId: string) => {
        setSlotsLoading(true)
        try {
            const from = new Date().toISOString()
            const to = new Date(Date.now() + 14 * 86400000).toISOString()
            const res = await fetch(`/api/calendar?action=slots&closer_id=${closerId}&from=${from}&to=${to}`)
            const data = await res.json()
            setAvailableSlots(data.slots || [])
        } catch { /* silent */ }
        setSlotsLoading(false)
    }

    // Fetch availability settings
    const fetchAvailability = async (uid: string) => {
        try {
            const res = await fetch(`/api/calendar?action=availability&user_id=${uid}`)
            const data = await res.json()
            setAvailability(data.availability || [])
        } catch { /* silent */ }
    }

    // Book appointment
    const handleBook = async () => {
        if (!bookSlot || !bookCloserId) return
        setBookingSaving(true)
        try {
            const res = await fetch('/api/calendar', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'book',
                    closer_id: bookCloserId,
                    start_time: bookSlot.start,
                    end_time: bookSlot.end,
                    title: bookTitle || 'Appuntamento',
                    lead_phone: bookPhone,
                    lead_email: bookEmail,
                    description: bookNotes ? `Lead: ${bookLeadName}\n${bookNotes}` : `Lead: ${bookLeadName}`,
                    lead_id: prefillLead?.id, // Associa il lead esistente
                }),
            })
            const data = await res.json()
            if (!res.ok) { alert(data.error || 'Errore'); return }
            setShowBooking(false)
            resetBookingForm()
            fetchEvents()
        } catch { alert('Errore di rete') }
        setBookingSaving(false)
    }

    // Save availability
    const handleSaveAvailability = async () => {
        setAvailSaving(true)
        try {
            const targetUser = settingsCloserId || userId
            const res = await fetch('/api/calendar', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'set_availability',
                    user_id: targetUser,
                    schedules: availability.filter(a => a.is_active),
                }),
            })
            const data = await res.json()
            if (!res.ok) { alert(data.error || 'Errore'); return }
            setShowSettings(false)
            fetchClosers()
        } catch { alert('Errore di rete') }
        setAvailSaving(false)
    }

    // Update event status
    const handleUpdateEvent = async (eventId: string, status: string) => {
        try {
            await fetch('/api/calendar', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ event_id: eventId, status }),
            })
            setSelectedEvent(null)
            fetchEvents()
        } catch { /* silent */ }
    }

    const resetBookingForm = () => {
        setBookCloserId('')
        setBookSlot(null)
        setBookTitle('Appuntamento')
        setBookPhone('')
        setBookEmail('')
        setBookLeadName('')
        setBookNotes('')
        setAvailableSlots([])
    }

    // Navigate
    const navigate = (dir: number) => {
        const d = new Date(currentDate)
        d.setDate(d.getDate() + (view === 'week' ? dir * 7 : dir))
        setCurrentDate(d)
    }

    const goToday = () => setCurrentDate(new Date())

    // Get events for a specific day/hour cell
    const getEventsForCell = (day: Date, hour: number) => {
        return events.filter(e => {
            const start = new Date(e.start_time)
            return start.toDateString() === day.toDateString() && start.getHours() === hour
        })
    }

    // Format time
    const fmt = (iso: string) => {
        const d = new Date(iso)
        return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
    }

    const isToday = (d: Date) => d.toDateString() === new Date().toDateString()

    // Group available slots by date
    const slotsByDate = useMemo(() => {
        const map: Record<string, Slot[]> = {}
        availableSlots.forEach(s => {
            if (!map[s.date]) map[s.date] = []
            map[s.date].push(s)
        })
        return map
    }, [availableSlots])

    const openAvailabilitySettings = (uid: string) => {
        setSettingsCloserId(uid)
        fetchAvailability(uid)
        // Pre-populate with defaults if empty
        setShowSettings(true)
    }

    const toggleDay = (dayOfWeek: number) => {
        const existing = availability.find(a => a.day_of_week === dayOfWeek)
        if (existing) {
            setAvailability(prev => prev.filter(a => a.day_of_week !== dayOfWeek))
        } else {
            setAvailability(prev => [...prev, {
                day_of_week: dayOfWeek,
                start_time: '09:00',
                end_time: '18:00',
                slot_duration_minutes: 45,
                break_between_slots: 0,
                is_active: true,
            }])
        }
    }

    const updateDaySchedule = (dayOfWeek: number, field: string, value: any) => {
        setAvailability(prev => prev.map(a =>
            a.day_of_week === dayOfWeek ? { ...a, [field]: value } : a
        ))
    }

    return (
        <div className="space-y-4 animate-fade-in">
            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                    <h1 className="text-2xl font-bold text-white flex items-center gap-3">
                        <CalendarDays className="w-6 h-6" style={{ color: '#6366f1' }} />
                        Calendario Appuntamenti
                    </h1>
                </div>
                <div className="flex items-center gap-2">
                    {canManageAvailability && (
                        <button
                            onClick={() => openAvailabilitySettings(userId)}
                            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all"
                            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#a5b4fc' }}
                        >
                            <Settings className="w-4 h-4" /> Disponibilità
                        </button>
                    )}
                    {canBook && (
                        <button
                            onClick={() => { resetBookingForm(); setShowBooking(true) }}
                            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold text-white transition-all"
                            style={{ background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)' }}
                        >
                            <Plus className="w-4 h-4" /> Prenota Appuntamento
                        </button>
                    )}
                </div>
            </div>

            {/* Navigation + Filters */}
            <div className="glass-card p-3 flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-2">
                    <button onClick={() => navigate(-1)} className="p-2 rounded-lg hover:bg-white/5 transition">
                        <ChevronLeft className="w-4 h-4 text-white" />
                    </button>
                    <button onClick={goToday} className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white hover:bg-white/5 transition">
                        Oggi
                    </button>
                    <button onClick={() => navigate(1)} className="p-2 rounded-lg hover:bg-white/5 transition">
                        <ChevronRight className="w-4 h-4 text-white" />
                    </button>
                    <span className="text-sm font-bold text-white ml-2">
                        {view === 'week'
                            ? `${weekDays[0].toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })} — ${weekDays[weekDays.length - 1].toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' })}`
                            : currentDate.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
                        }
                    </span>
                </div>

                <div className="flex items-center gap-2">
                    {/* View toggle */}
                    <div className="flex rounded-lg overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.1)' }}>
                        {(['week', 'day'] as const).map(v => (
                            <button key={v} onClick={() => setView(v)}
                                className="px-3 py-1.5 text-xs font-semibold transition"
                                style={{
                                    background: view === v ? 'rgba(99,102,241,0.2)' : 'transparent',
                                    color: view === v ? '#a5b4fc' : 'var(--color-surface-500)',
                                }}
                            >
                                {v === 'week' ? 'Settimana' : 'Giorno'}
                            </button>
                        ))}
                    </div>

                    {/* Closer filter */}
                    <select
                        value={selectedCloser}
                        onChange={e => setSelectedCloser(e.target.value)}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold"
                        style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'white' }}
                    >
                        <option value="all">Tutti i venditori</option>
                        {closers.map(c => (
                            <option key={c.user_id} value={c.user_id}>{c.name}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Calendar Grid */}
            <div className="glass-card overflow-hidden">
                <div className="overflow-x-auto">
                    <div style={{ minWidth: view === 'week' ? '900px' : '400px' }}>
                        {/* Day Headers */}
                        <div className="grid gap-0" style={{
                            gridTemplateColumns: `60px repeat(${weekDays.length}, 1fr)`,
                            borderBottom: '1px solid rgba(255,255,255,0.06)',
                        }}>
                            <div className="p-2" />
                            {weekDays.map((day, i) => (
                                <div key={i}
                                    className="p-3 text-center"
                                    style={{
                                        borderLeft: '1px solid rgba(255,255,255,0.04)',
                                        background: isToday(day) ? 'rgba(99,102,241,0.05)' : 'transparent',
                                    }}
                                >
                                    <div className="text-[10px] font-semibold uppercase" style={{ color: isToday(day) ? '#a5b4fc' : 'var(--color-surface-500)' }}>
                                        {DAYS[day.getDay()]}
                                    </div>
                                    <div className={`text-lg font-bold mt-0.5 ${isToday(day) ? 'text-white' : ''}`}
                                        style={{ color: isToday(day) ? 'white' : 'var(--color-surface-400)' }}
                                    >
                                        {day.getDate()}
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Time Grid */}
                        <div style={{ maxHeight: '600px', overflowY: 'auto' }}>
                            {HOURS.map(hour => (
                                <div key={hour} className="grid gap-0" style={{
                                    gridTemplateColumns: `60px repeat(${weekDays.length}, 1fr)`,
                                    minHeight: '60px',
                                    borderBottom: '1px solid rgba(255,255,255,0.03)',
                                }}>
                                    <div className="p-2 text-right pr-3 pt-0" style={{ marginTop: '-6px' }}>
                                        <span className="text-[10px] font-medium" style={{ color: 'var(--color-surface-500)' }}>
                                            {hour.toString().padStart(2, '0')}:00
                                        </span>
                                    </div>
                                    {weekDays.map((day, di) => {
                                        const cellEvents = getEventsForCell(day, hour)
                                        return (
                                            <div key={di}
                                                className="relative min-h-[60px] transition-colors hover:bg-white/[0.02]"
                                                style={{
                                                    borderLeft: '1px solid rgba(255,255,255,0.04)',
                                                    background: isToday(day) ? 'rgba(99,102,241,0.02)' : 'transparent',
                                                }}
                                            >
                                                {cellEvents.map(evt => {
                                                    const startMin = new Date(evt.start_time).getMinutes()
                                                    const duration = (new Date(evt.end_time).getTime() - new Date(evt.start_time).getTime()) / 60000
                                                    const statusColors: Record<string, string> = {
                                                        confirmed: evt.closer_color,
                                                        completed: '#22c55e',
                                                        cancelled: '#ef4444',
                                                        no_show: '#f59e0b',
                                                    }
                                                    const bgColor = statusColors[evt.status] || evt.closer_color

                                                    return (
                                                        <div
                                                            key={evt.id}
                                                            onClick={() => setSelectedEvent(evt)}
                                                            className="absolute left-1 right-1 rounded-lg px-2 py-1 cursor-pointer transition-all hover:scale-[1.02] hover:z-10"
                                                            style={{
                                                                top: `${(startMin / 60) * 100}%`,
                                                                height: `${Math.max((duration / 60) * 60, 30)}px`,
                                                                background: `${bgColor}20`,
                                                                borderLeft: `3px solid ${bgColor}`,
                                                                zIndex: 5,
                                                            }}
                                                        >
                                                            <div className="text-[11px] font-bold text-white truncate">
                                                                {evt.leads?.name || evt.title}
                                                            </div>
                                                            <div className="text-[9px] font-medium" style={{ color: bgColor }}>
                                                                {fmt(evt.start_time)} — {fmt(evt.end_time)} · {evt.closer_name}
                                                            </div>
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                        )
                                    })}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Closer Legend */}
            {closers.length > 0 && (
                <div className="flex items-center gap-3 flex-wrap">
                    {closers.map(c => (
                        <div key={c.user_id} className="flex items-center gap-2 px-3 py-1.5 rounded-lg" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                            <div className="w-3 h-3 rounded-full" style={{ background: c.color }} />
                            <span className="text-xs font-semibold text-white">{c.name}</span>
                            {!c.has_availability && (
                                <span title="Nessuna disponibilità configurata"><AlertCircle className="w-3 h-3" style={{ color: '#f59e0b' }} /></span>
                            )}
                            {canManageAvailability && (userRole === 'owner' || userRole === 'admin') && (
                                <button onClick={() => openAvailabilitySettings(c.user_id)} className="hover:text-white" style={{ color: 'var(--color-surface-500)' }}>
                                    <Settings className="w-3 h-3" />
                                </button>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* ═══ BOOKING MODAL ═══ */}
            {showBooking && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowBooking(false)}>
                    <div className="w-full max-w-lg rounded-2xl p-6 space-y-5" onClick={e => e.stopPropagation()}
                        style={{ background: 'var(--color-surface-50)', border: '1px solid rgba(255,255,255,0.08)' }}>
                        <div className="flex items-center justify-between">
                            <h2 className="text-lg font-bold text-white flex items-center gap-2">
                                <CalendarDays className="w-5 h-5" style={{ color: '#6366f1' }} /> Prenota Appuntamento
                            </h2>
                            <button onClick={() => setShowBooking(false)}><X className="w-5 h-5 text-white/50 hover:text-white" /></button>
                        </div>

                        {/* Step 1: Select closer */}
                        <div>
                            <label className="text-xs font-semibold text-white/70 block mb-1">Venditore</label>
                            <select value={bookCloserId}
                                onChange={e => { setBookCloserId(e.target.value); setBookSlot(null); if (e.target.value) fetchSlots(e.target.value) }}
                                className="w-full px-3 py-2 rounded-lg text-sm"
                                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'white' }}>
                                <option value="">Seleziona venditore...</option>
                                {closers.filter(c => c.has_availability).map(c => (
                                    <option key={c.user_id} value={c.user_id}>{c.name}</option>
                                ))}
                            </select>
                            {closers.some(c => !c.has_availability) && (
                                <p className="text-[10px] mt-1" style={{ color: '#f59e0b' }}>
                                    ⚠️ Alcuni venditori non hanno configurato la disponibilità
                                </p>
                            )}
                        </div>

                        {/* Step 2: Select slot */}
                        {bookCloserId && (
                            <div>
                                <label className="text-xs font-semibold text-white/70 block mb-2">Slot disponibili (prossimi 14 giorni)</label>
                                {slotsLoading ? (
                                    <div className="text-center py-4 text-sm" style={{ color: 'var(--color-surface-500)' }}>Caricamento slot...</div>
                                ) : Object.keys(slotsByDate).length === 0 ? (
                                    <div className="text-center py-4 text-sm" style={{ color: '#f59e0b' }}>Nessuno slot disponibile</div>
                                ) : (
                                    <div className="max-h-48 overflow-y-auto space-y-3">
                                        {Object.entries(slotsByDate).map(([date, slots]) => (
                                            <div key={date}>
                                                <div className="text-[11px] font-bold text-white/60 mb-1">
                                                    {new Date(date + 'T00:00:00').toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'short' })}
                                                </div>
                                                <div className="flex flex-wrap gap-1.5">
                                                    {slots.map((slot, si) => (
                                                        <button key={si}
                                                            disabled={!slot.available}
                                                            onClick={() => setBookSlot(slot)}
                                                            className="px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all"
                                                            style={{
                                                                background: bookSlot?.start === slot.start
                                                                    ? 'rgba(99,102,241,0.3)'
                                                                    : slot.available
                                                                        ? 'rgba(255,255,255,0.05)'
                                                                        : 'rgba(255,255,255,0.02)',
                                                                border: bookSlot?.start === slot.start
                                                                    ? '1px solid #6366f1'
                                                                    : '1px solid rgba(255,255,255,0.06)',
                                                                color: slot.available ? 'white' : 'rgba(255,255,255,0.2)',
                                                                cursor: slot.available ? 'pointer' : 'not-allowed',
                                                                textDecoration: slot.available ? 'none' : 'line-through',
                                                            }}
                                                        >
                                                            {fmt(slot.start)}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Step 3: Lead info */}
                        {bookSlot && (
                            <>
                                <div className="p-3 rounded-lg" style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)' }}>
                                    <div className="text-xs font-bold" style={{ color: '#a5b4fc' }}>
                                        📅 {new Date(bookSlot.start).toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })}
                                        {' · '}{fmt(bookSlot.start)} — {fmt(bookSlot.end)}
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-xs font-semibold text-white/70 block mb-1">Nome Lead *</label>
                                        <input value={bookLeadName} onChange={e => setBookLeadName(e.target.value)}
                                            placeholder="Mario Rossi" className="w-full px-3 py-2 rounded-lg text-sm"
                                            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'white' }} />
                                    </div>
                                    <div>
                                        <label className="text-xs font-semibold text-white/70 block mb-1">Telefono</label>
                                        <input value={bookPhone} onChange={e => setBookPhone(e.target.value)}
                                            placeholder="+39..." className="w-full px-3 py-2 rounded-lg text-sm"
                                            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'white' }} />
                                    </div>
                                </div>
                                <div>
                                    <label className="text-xs font-semibold text-white/70 block mb-1">Email</label>
                                    <input value={bookEmail} onChange={e => setBookEmail(e.target.value)}
                                        placeholder="email@example.com" className="w-full px-3 py-2 rounded-lg text-sm"
                                        style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'white' }} />
                                </div>
                                <div>
                                    <label className="text-xs font-semibold text-white/70 block mb-1">Note</label>
                                    <textarea value={bookNotes} onChange={e => setBookNotes(e.target.value)}
                                        rows={2} placeholder="Note aggiuntive..." className="w-full px-3 py-2 rounded-lg text-sm resize-none"
                                        style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'white' }} />
                                </div>
                                <button onClick={handleBook} disabled={bookingSaving || !bookLeadName}
                                    className="w-full py-2.5 rounded-xl font-bold text-sm text-white transition-all disabled:opacity-50"
                                    style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
                                    {bookingSaving ? 'Prenotazione...' : '✓ Conferma Appuntamento'}
                                </button>
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* ═══ EVENT DETAIL MODAL ═══ */}
            {selectedEvent && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setSelectedEvent(null)}>
                    <div className="w-full max-w-md rounded-2xl p-6 space-y-4" onClick={e => e.stopPropagation()}
                        style={{ background: 'var(--color-surface-50)', border: '1px solid rgba(255,255,255,0.08)' }}>
                        <div className="flex items-center justify-between">
                            <h2 className="text-lg font-bold text-white">{selectedEvent.leads?.name || selectedEvent.title}</h2>
                            <button onClick={() => setSelectedEvent(null)}><X className="w-5 h-5 text-white/50 hover:text-white" /></button>
                        </div>

                        <div className="space-y-2">
                            <div className="flex items-center gap-2 text-sm">
                                <CalendarDays className="w-4 h-4" style={{ color: '#6366f1' }} />
                                <span className="text-white">{new Date(selectedEvent.start_time).toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
                            </div>
                            <div className="flex items-center gap-2 text-sm">
                                <Clock className="w-4 h-4" style={{ color: '#22c55e' }} />
                                <span className="text-white">{fmt(selectedEvent.start_time)} — {fmt(selectedEvent.end_time)}</span>
                            </div>
                            <div className="flex items-center gap-2 text-sm">
                                <User className="w-4 h-4" style={{ color: selectedEvent.closer_color }} />
                                <span className="text-white">Venditore: {selectedEvent.closer_name}</span>
                            </div>
                            {selectedEvent.setter_name && (
                                <div className="flex items-center gap-2 text-sm">
                                    <Users className="w-4 h-4" style={{ color: '#f59e0b' }} />
                                    <span className="text-white">Setter: {selectedEvent.setter_name}</span>
                                </div>
                            )}
                            {(selectedEvent.lead_phone || selectedEvent.leads?.phone) && (
                                <div className="flex items-center gap-2 text-sm">
                                    <Phone className="w-4 h-4" style={{ color: '#3b82f6' }} />
                                    <span className="text-white">{selectedEvent.lead_phone || selectedEvent.leads?.phone}</span>
                                </div>
                            )}
                            {(selectedEvent.lead_email || selectedEvent.leads?.email) && (
                                <div className="flex items-center gap-2 text-sm">
                                    <Mail className="w-4 h-4" style={{ color: '#ec4899' }} />
                                    <span className="text-white">{selectedEvent.lead_email || selectedEvent.leads?.email}</span>
                                </div>
                            )}
                        </div>

                        {/* Status */}
                        <div className="flex items-center gap-1.5 pt-2">
                            <span className="text-[10px] font-bold uppercase" style={{
                                color: selectedEvent.status === 'confirmed' ? '#3b82f6'
                                    : selectedEvent.status === 'completed' ? '#22c55e'
                                        : selectedEvent.status === 'cancelled' ? '#ef4444' : '#f59e0b'
                            }}>
                                {selectedEvent.status === 'confirmed' ? '●  Confermato' : selectedEvent.status === 'completed' ? '●  Completato' : selectedEvent.status === 'cancelled' ? '●  Annullato' : '●  No Show'}
                            </span>
                        </div>

                        {/* Actions */}
                        {selectedEvent.status === 'confirmed' && (userRole === 'closer' || userRole === 'owner' || userRole === 'admin') && (
                            <div className="flex gap-2 pt-2">
                                <button onClick={() => handleUpdateEvent(selectedEvent.id, 'completed')}
                                    className="flex-1 py-2 rounded-lg text-xs font-bold text-white"
                                    style={{ background: 'rgba(34,197,94,0.2)', border: '1px solid rgba(34,197,94,0.3)' }}>
                                    ✓ Completato
                                </button>
                                <button onClick={() => handleUpdateEvent(selectedEvent.id, 'no_show')}
                                    className="flex-1 py-2 rounded-lg text-xs font-bold"
                                    style={{ background: 'rgba(245,158,11,0.2)', border: '1px solid rgba(245,158,11,0.3)', color: '#f59e0b' }}>
                                    ⚠ No Show
                                </button>
                                <button onClick={() => handleUpdateEvent(selectedEvent.id, 'cancelled')}
                                    className="flex-1 py-2 rounded-lg text-xs font-bold"
                                    style={{ background: 'rgba(239,68,68,0.2)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444' }}>
                                    ✗ Annulla
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ═══ AVAILABILITY SETTINGS MODAL ═══ */}
            {showSettings && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowSettings(false)}>
                    <div className="w-full max-w-lg rounded-2xl p-6 space-y-5" onClick={e => e.stopPropagation()}
                        style={{ background: 'var(--color-surface-50)', border: '1px solid rgba(255,255,255,0.08)' }}>
                        <div className="flex items-center justify-between">
                            <h2 className="text-lg font-bold text-white flex items-center gap-2">
                                <Clock className="w-5 h-5" style={{ color: '#22c55e' }} /> Configura Disponibilità
                            </h2>
                            <button onClick={() => setShowSettings(false)}><X className="w-5 h-5 text-white/50 hover:text-white" /></button>
                        </div>

                        <p className="text-xs" style={{ color: 'var(--color-surface-500)' }}>
                            Seleziona i giorni lavorativi e imposta orari e durata degli slot.
                        </p>

                        {/* Day toggles */}
                        <div className="space-y-2">
                            {[1, 2, 3, 4, 5, 6, 0].map(day => {
                                const isActive = availability.some(a => a.day_of_week === day)
                                const schedule = availability.find(a => a.day_of_week === day)

                                return (
                                    <div key={day} className="rounded-xl p-3 transition-all"
                                        style={{
                                            background: isActive ? 'rgba(99,102,241,0.08)' : 'rgba(255,255,255,0.02)',
                                            border: `1px solid ${isActive ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.05)'}`,
                                        }}>
                                        <div className="flex items-center justify-between">
                                            <button onClick={() => toggleDay(day)} className="flex items-center gap-2">
                                                <div className="w-5 h-5 rounded-md flex items-center justify-center text-[10px]"
                                                    style={{
                                                        background: isActive ? '#6366f1' : 'rgba(255,255,255,0.1)',
                                                        color: 'white',
                                                    }}>
                                                    {isActive && <Check className="w-3 h-3" />}
                                                </div>
                                                <span className="text-sm font-semibold text-white">{DAYS_FULL[day]}</span>
                                            </button>
                                        </div>

                                        {isActive && schedule && (
                                            <div className="grid grid-cols-4 gap-2 mt-3">
                                                <div>
                                                    <label className="text-[9px] font-semibold text-white/50">Inizio</label>
                                                    <input type="time" value={schedule.start_time}
                                                        onChange={e => updateDaySchedule(day, 'start_time', e.target.value)}
                                                        className="w-full px-2 py-1 rounded text-xs mt-0.5"
                                                        style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'white' }} />
                                                </div>
                                                <div>
                                                    <label className="text-[9px] font-semibold text-white/50">Fine</label>
                                                    <input type="time" value={schedule.end_time}
                                                        onChange={e => updateDaySchedule(day, 'end_time', e.target.value)}
                                                        className="w-full px-2 py-1 rounded text-xs mt-0.5"
                                                        style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'white' }} />
                                                </div>
                                                <div>
                                                    <label className="text-[9px] font-semibold text-white/50">Durata (min)</label>
                                                    <select value={schedule.slot_duration_minutes}
                                                        onChange={e => updateDaySchedule(day, 'slot_duration_minutes', Number(e.target.value))}
                                                        className="w-full px-2 py-1 rounded text-xs mt-0.5"
                                                        style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'white' }}>
                                                        <option value={30}>30</option>
                                                        <option value={45}>45</option>
                                                        <option value={60}>60</option>
                                                        <option value={90}>90</option>
                                                    </select>
                                                </div>
                                                <div>
                                                    <label className="text-[9px] font-semibold text-white/50">Pausa (min)</label>
                                                    <select value={schedule.break_between_slots}
                                                        onChange={e => updateDaySchedule(day, 'break_between_slots', Number(e.target.value))}
                                                        className="w-full px-2 py-1 rounded text-xs mt-0.5"
                                                        style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'white' }}>
                                                        <option value={0}>0</option>
                                                        <option value={5}>5</option>
                                                        <option value={10}>10</option>
                                                        <option value={15}>15</option>
                                                    </select>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )
                            })}
                        </div>

                        <button onClick={handleSaveAvailability} disabled={availSaving}
                            className="w-full py-2.5 rounded-xl font-bold text-sm text-white transition-all disabled:opacity-50"
                            style={{ background: 'linear-gradient(135deg, #22c55e, #16a34a)' }}>
                            {availSaving ? 'Salvataggio...' : '✓ Salva Disponibilità'}
                        </button>
                    </div>
                </div>
            )}
        </div>
    )
}
