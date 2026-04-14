'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { CalendarDays, Clock, Users, Plus, ChevronLeft, ChevronRight, Phone, Mail, User, X, Check, Settings, AlertCircle, Eye, EyeOff, Shuffle, TrendingUp, Shield, Zap } from 'lucide-react'
import HowItWorks from '@/components/HowItWorks'

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

interface GoogleEvent {
    id: string
    summary: string
    start: string
    end: string
    status: string
    htmlLink?: string
}

interface Closer {
    user_id: string
    name: string
    color: string
    available_days: number[]
    has_availability: boolean
    google_connected: boolean
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
    isGoogleConnected?: boolean
}

const ASSIGNMENT_MODES = [
    { value: 'round_robin', label: 'Round Robin', icon: Shuffle, desc: 'A→B→C→A', color: '#3b82f6' },
    { value: 'performance', label: 'Performance', icon: TrendingUp, desc: 'Chi chiude di più', color: '#f59e0b' },
    { value: 'availability', label: 'Disponibilità', icon: Shield, desc: 'Meno carico', color: '#22c55e' },
]

export default function CalendarPanel({ userRole, userId, prefillLead, isGoogleConnected }: Props) {
    const [currentDate, setCurrentDate] = useState(new Date())
    const [events, setEvents] = useState<CalendarEvent[]>([])
    const [closers, setClosers] = useState<Closer[]>([])
    const [loading, setLoading] = useState(true)
    const [showBooking, setShowBooking] = useState(false)
    const [showSettings, setShowSettings] = useState(false)
    const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null)
    const [availableSlots, setAvailableSlots] = useState<Slot[]>([])
    const [slotsLoading, setSlotsLoading] = useState(false)
    const [view, setView] = useState<'week' | 'day'>('week')

    // Multi-calendar checkbox state
    const [visibleCalendars, setVisibleCalendars] = useState<Set<string>>(new Set())
    const [showGoogleEvents, setShowGoogleEvents] = useState(true)
    const [googleEvents, setGoogleEvents] = useState<Record<string, GoogleEvent[]>>({})
    const [googleEventsLoading, setGoogleEventsLoading] = useState(false)

    // Booking form state
    const [bookingMode, setBookingMode] = useState<'auto' | 'manual'>('auto')
    const [assignmentMode, setAssignmentMode] = useState('round_robin')
    const [bookCloserId, setBookCloserId] = useState('')
    const [bookSlot, setBookSlot] = useState<Slot | null>(null)
    const [bookTitle, setBookTitle] = useState('Appuntamento')
    const [bookPhone, setBookPhone] = useState('')
    const [bookEmail, setBookEmail] = useState('')
    const [bookLeadName, setBookLeadName] = useState('')
    const [bookNotes, setBookNotes] = useState('')
    const [bookingSaving, setBookingSaving] = useState(false)
    const [bookingResult, setBookingResult] = useState<{ success: boolean; message: string; assigned_to?: string } | null>(null)

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
            const res = await fetch(`/api/calendar?action=events&from=${from}&to=${to}`)
            const data = await res.json()
            setEvents(data.events || [])
        } catch { /* silent */ }
        setLoading(false)
    }, [weekStart, weekEnd])

    // Fetch closers
    const fetchClosers = useCallback(async () => {
        try {
            const res = await fetch('/api/calendar?action=closers')
            const data = await res.json()
            const closersList = data.closers || []
            setClosers(closersList)
            // Initialize all calendars as visible
            if (visibleCalendars.size === 0 && closersList.length > 0) {
                setVisibleCalendars(new Set(closersList.map((c: Closer) => c.user_id)))
            }
        } catch { /* silent */ }
    }, [])

    // Fetch Google Calendar events for visible calendars
    const fetchGoogleEvents = useCallback(async () => {
        const connectedVisible = closers.filter(c =>
            visibleCalendars.has(c.user_id) && c.google_connected
        )
        if (connectedVisible.length === 0 || !showGoogleEvents) {
            setGoogleEvents({})
            return
        }

        setGoogleEventsLoading(true)
        try {
            const from = weekStart.toISOString()
            const to = weekEnd.toISOString()
            const userIds = connectedVisible.map(c => c.user_id).join(',')
            const res = await fetch(`/api/calendar?action=google_events&from=${from}&to=${to}&user_ids=${userIds}`)
            const data = await res.json()
            setGoogleEvents(data.google_events || {})
        } catch { /* silent */ }
        setGoogleEventsLoading(false)
    }, [weekStart, weekEnd, closers, visibleCalendars, showGoogleEvents])

    useEffect(() => { fetchClosers() }, [fetchClosers])
    useEffect(() => { fetchEvents() }, [fetchEvents])
    useEffect(() => { fetchGoogleEvents() }, [fetchGoogleEvents])

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

    // Fetch available slots for booking (for ALL closers in auto mode)
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

    // Fetch aggregated slots for auto-book
    const fetchAutoSlots = async () => {
        setSlotsLoading(true)
        try {
            const from = new Date().toISOString()
            const to = new Date(Date.now() + 14 * 86400000).toISOString()

            // Fetch slots from ALL closers and merge available ones
            const allSlots: Slot[] = []
            const closersWithAvail = closers.filter(c => c.has_availability)

            for (const closer of closersWithAvail) {
                const res = await fetch(`/api/calendar?action=slots&closer_id=${closer.user_id}&from=${from}&to=${to}`)
                const data = await res.json()
                const slots = (data.slots || []).filter((s: Slot) => s.available)
                slots.forEach((s: Slot) => {
                    // Only add if not already in allSlots (dedup by start time)
                    if (!allSlots.some(existing => existing.start === s.start)) {
                        allSlots.push(s)
                    }
                })
            }

            // Sort by date/time
            allSlots.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
            setAvailableSlots(allSlots)
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
        if (!bookSlot) return

        if (bookingMode === 'manual' && !bookCloserId) return

        setBookingSaving(true)
        setBookingResult(null)

        try {
            if (bookingMode === 'auto') {
                // Auto-assign via round-robin/performance/availability
                const res = await fetch('/api/calendar', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        action: 'auto_book',
                        start_time: bookSlot.start,
                        end_time: bookSlot.end,
                        title: bookTitle || 'Appuntamento',
                        lead_phone: bookPhone,
                        lead_email: bookEmail,
                        lead_name: bookLeadName,
                        description: bookNotes ? `Lead: ${bookLeadName}\n${bookNotes}` : undefined,
                        lead_id: prefillLead?.id,
                        assignment_mode: assignmentMode,
                    }),
                })
                const data = await res.json()
                if (!res.ok) {
                    setBookingResult({ success: false, message: data.error || 'Errore' })
                    return
                }
                setBookingResult({
                    success: true,
                    message: data.message,
                    assigned_to: data.assigned_to,
                })
                setTimeout(() => {
                    setShowBooking(false)
                    resetBookingForm()
                    fetchEvents()
                }, 2000)
            } else {
                // Manual closer selection (existing flow)
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
                        lead_id: prefillLead?.id,
                    }),
                })
                const data = await res.json()
                if (!res.ok) { alert(data.error || 'Errore'); return }
                setShowBooking(false)
                resetBookingForm()
                fetchEvents()
            }
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
        setBookingResult(null)
        setBookingMode('auto')
    }

    // Navigate
    const navigate = (dir: number) => {
        const d = new Date(currentDate)
        d.setDate(d.getDate() + (view === 'week' ? dir * 7 : dir))
        setCurrentDate(d)
    }

    const goToday = () => setCurrentDate(new Date())

    // Toggle calendar visibility
    const toggleCalendar = (userId: string) => {
        setVisibleCalendars(prev => {
            const next = new Set(prev)
            if (next.has(userId)) next.delete(userId)
            else next.add(userId)
            return next
        })
    }

    const toggleAllCalendars = () => {
        if (visibleCalendars.size === closers.length) {
            setVisibleCalendars(new Set())
        } else {
            setVisibleCalendars(new Set(closers.map(c => c.user_id)))
        }
    }

    // Get events for a specific day/hour cell (filtered by visible calendars)
    const getEventsForCell = (day: Date, hour: number) => {
        return events.filter(e => {
            const start = new Date(e.start_time)
            return start.toDateString() === day.toDateString()
                && start.getHours() === hour
                && visibleCalendars.has(e.closer_id)
        })
    }

    // Get Google events for a specific day/hour cell
    const getGoogleEventsForCell = (day: Date, hour: number) => {
        if (!showGoogleEvents) return []
        const results: { event: GoogleEvent; userId: string; color: string }[] = []
        for (const [uid, gEvents] of Object.entries(googleEvents)) {
            if (!visibleCalendars.has(uid)) continue
            const closer = closers.find(c => c.user_id === uid)
            for (const ge of gEvents) {
                const start = new Date(ge.start)
                if (start.toDateString() === day.toDateString() && start.getHours() === hour) {
                    results.push({ event: ge, userId: uid, color: closer?.color || '#64748b' })
                }
            }
        }
        return results
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

    const connectedClosersCount = closers.filter(c => c.google_connected).length

    return (
        <div className="flex gap-4 animate-fade-in" style={{ height: 'calc(100vh - 120px)' }}>
            {/* ═══ LEFT SIDEBAR — Calendari ═══ */}
            <div className="w-64 flex-shrink-0 glass-card p-4 space-y-4 overflow-y-auto hidden lg:block">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold text-white uppercase tracking-wider">Calendari</h3>
                    <button
                        onClick={toggleAllCalendars}
                        className="text-[10px] font-medium px-2 py-0.5 rounded transition-colors hover:bg-white/5"
                        style={{ color: '#a5b4fc' }}
                    >
                        {visibleCalendars.size === closers.length ? 'Nascondi tutti' : 'Mostra tutti'}
                    </button>
                </div>

                {/* Venditori */}
                <div className="space-y-1">
                    <div className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--color-surface-500)' }}>
                        Venditori & Team
                    </div>
                    {closers.map(c => (
                        <button
                            key={c.user_id}
                            onClick={() => toggleCalendar(c.user_id)}
                            className="w-full flex items-center gap-2.5 p-2 rounded-lg transition-all hover:bg-white/5 text-left group"
                        >
                            <div
                                className="w-4 h-4 rounded flex-shrink-0 flex items-center justify-center transition-all"
                                style={{
                                    background: visibleCalendars.has(c.user_id) ? c.color : 'transparent',
                                    border: `2px solid ${c.color}`,
                                }}
                            >
                                {visibleCalendars.has(c.user_id) && <Check className="w-2.5 h-2.5 text-white" />}
                            </div>
                            <span className="text-xs font-medium text-white truncate flex-1">{c.name}</span>
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                {c.google_connected && (
                                    <div className="w-3 h-3 rounded-full" style={{ background: 'rgba(34,197,94,0.3)' }} title="Google Calendar connesso">
                                        <div className="w-1.5 h-1.5 rounded-full mx-auto mt-[3px]" style={{ background: '#22c55e' }} />
                                    </div>
                                )}
                                {!c.has_availability && (
                                    <span title="Nessuna disponibilità"><AlertCircle className="w-3 h-3" style={{ color: '#f59e0b' }} /></span>
                                )}
                                {canManageAvailability && (userRole === 'owner' || userRole === 'admin') && (
                                    <button onClick={(e) => { e.stopPropagation(); openAvailabilitySettings(c.user_id) }} className="hover:text-white" style={{ color: 'var(--color-surface-500)' }}>
                                        <Settings className="w-3 h-3" />
                                    </button>
                                )}
                            </div>
                        </button>
                    ))}
                </div>

                {/* Google Calendar toggle */}
                {connectedClosersCount > 0 && (
                    <div className="pt-3 border-t" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
                        <button
                            onClick={() => setShowGoogleEvents(!showGoogleEvents)}
                            className="w-full flex items-center gap-2.5 p-2 rounded-lg transition-all hover:bg-white/5"
                        >
                            <div
                                className="w-4 h-4 rounded flex-shrink-0 flex items-center justify-center transition-all"
                                style={{
                                    background: showGoogleEvents ? '#4285F4' : 'transparent',
                                    border: '2px solid #4285F4',
                                }}
                            >
                                {showGoogleEvents && <Check className="w-2.5 h-2.5 text-white" />}
                            </div>
                            <div className="flex items-center gap-1.5">
                                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24">
                                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                                </svg>
                                <span className="text-xs font-medium text-white">Google Calendar</span>
                            </div>
                        </button>
                        {googleEventsLoading && (
                            <div className="text-[10px] text-center mt-1" style={{ color: 'var(--color-surface-500)' }}>Caricamento eventi Google...</div>
                        )}
                    </div>
                )}

                {/* Quick stats */}
                <div className="pt-3 border-t" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
                    <div className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--color-surface-500)' }}>
                        Questa settimana
                    </div>
                    <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-[11px]">
                            <span style={{ color: 'var(--color-surface-400)' }}>Appuntamenti</span>
                            <span className="font-bold text-white">{events.filter(e => e.status === 'confirmed').length}</span>
                        </div>
                        <div className="flex items-center justify-between text-[11px]">
                            <span style={{ color: 'var(--color-surface-400)' }}>Completati</span>
                            <span className="font-bold" style={{ color: '#22c55e' }}>{events.filter(e => e.status === 'completed').length}</span>
                        </div>
                        <div className="flex items-center justify-between text-[11px]">
                            <span style={{ color: 'var(--color-surface-400)' }}>No Show</span>
                            <span className="font-bold" style={{ color: '#f59e0b' }}>{events.filter(e => e.status === 'no_show').length}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* ═══ MAIN AREA ═══ */}
            <div className="flex-1 flex flex-col min-w-0 space-y-3">
                {/* Header */}
                <div className="flex items-center justify-between flex-wrap gap-3">
                    <div>
                        <h1 className="text-2xl font-bold text-white flex items-center gap-3">
                            <CalendarDays className="w-6 h-6" style={{ color: '#6366f1' }} />
                            Calendario
                        </h1>
                    </div>
                    <div className="flex items-center gap-2">
                        <HowItWorks compact steps={[
                            { emoji: '📅', title: 'Calendario Multi-Venditore', description: 'Visualizza i calendari di tutti i venditori sovrapposti. Usa le checkbox a sinistra per filtrare.' },
                            { emoji: '🔄', title: 'Sync Bidirezionale', description: 'Gli eventi Google Calendar appaiono come blocchi tratteggiati. Se un venditore è occupato su Google, lo slot non sarà disponibile.' },
                            { emoji: '🎯', title: 'Auto-Assegnazione', description: 'Prenota con Round Robin (ciclico), Performance (chi chiude di più) o Disponibilità (meno carico).' },
                            { emoji: '✅', title: 'Gestione Esiti', description: 'Dopo l\'appuntamento, il closer segna l\'esito: Completato, No Show o Annullato.' },
                            { emoji: '⚙️', title: 'Configura Disponibilità', description: 'Ogni venditore configura i suoi giorni/orari, durata slot e pausa tra appuntamenti.' },
                        ]} footer="I setter possono solo prenotare. I closer gestiscono gli esiti. Admin/Owner configurano le disponibilità di tutti." />
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
                                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold text-white transition-all hover:scale-[1.02]"
                                style={{ background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)' }}
                            >
                                <Plus className="w-4 h-4" /> Prenota
                            </button>
                        )}
                    </div>
                </div>

                {/* Google re-auth banner */}
                {isGoogleConnected === false && canManageAvailability && (
                    <div className="flex items-center gap-3 p-3 rounded-xl" style={{ background: 'rgba(66,133,244,0.08)', border: '1px solid rgba(66,133,244,0.2)' }}>
                        <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24">
                            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                        </svg>
                        <div className="flex-1">
                            <span className="text-xs font-semibold text-white">Connetti Google Calendar</span>
                            <span className="text-[10px] block" style={{ color: 'var(--color-surface-400)' }}>Per la sync bidirezionale degli appuntamenti</span>
                        </div>
                        <a href="/api/auth/google" className="text-xs font-bold px-3 py-1.5 rounded-lg transition-all hover:scale-[1.02]" style={{ background: 'rgba(66,133,244,0.2)', color: '#4285F4' }}>
                            Connetti
                        </a>
                    </div>
                )}

                {/* Navigation + View Toggle */}
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

                        {/* Mobile calendar filter */}
                        <select
                            className="lg:hidden px-3 py-1.5 rounded-lg text-xs font-semibold"
                            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'white' }}
                            onChange={e => {
                                if (e.target.value === 'all') {
                                    setVisibleCalendars(new Set(closers.map(c => c.user_id)))
                                } else {
                                    setVisibleCalendars(new Set([e.target.value]))
                                }
                            }}
                        >
                            <option value="all">Tutti i venditori</option>
                            {closers.map(c => (
                                <option key={c.user_id} value={c.user_id}>{c.name}</option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Calendar Grid */}
                <div className="glass-card overflow-hidden flex-1">
                    <div className="overflow-x-auto h-full">
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
                                        <div className={`text-lg font-bold mt-0.5`}
                                            style={{ color: isToday(day) ? 'white' : 'var(--color-surface-400)' }}
                                        >
                                            {day.getDate()}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Time Grid */}
                            <div style={{ maxHeight: 'calc(100vh - 320px)', overflowY: 'auto' }}>
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
                                            const cellGoogleEvents = getGoogleEventsForCell(day, hour)
                                            return (
                                                <div key={di}
                                                    className="relative min-h-[60px] transition-colors hover:bg-white/[0.02]"
                                                    style={{
                                                        borderLeft: '1px solid rgba(255,255,255,0.04)',
                                                        background: isToday(day) ? 'rgba(99,102,241,0.02)' : 'transparent',
                                                    }}
                                                >
                                                    {/* Sincro events (solid) */}
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

                                                    {/* Google Calendar events (hatched/semi-transparent) */}
                                                    {cellGoogleEvents.map(({ event: ge, color }) => {
                                                        const startMin = new Date(ge.start).getMinutes()
                                                        const duration = (new Date(ge.end).getTime() - new Date(ge.start).getTime()) / 60000

                                                        return (
                                                            <div
                                                                key={`g-${ge.id}`}
                                                                className="absolute left-1 right-1 rounded-lg px-2 py-1"
                                                                style={{
                                                                    top: `${(startMin / 60) * 100}%`,
                                                                    height: `${Math.max((duration / 60) * 60, 24)}px`,
                                                                    background: `repeating-linear-gradient(45deg, ${color}08, ${color}08 4px, ${color}15 4px, ${color}15 8px)`,
                                                                    borderLeft: `3px dashed ${color}60`,
                                                                    zIndex: 3,
                                                                    opacity: 0.7,
                                                                }}
                                                                title={`Google: ${ge.summary}`}
                                                            >
                                                                <div className="text-[10px] font-medium truncate" style={{ color: `${color}cc` }}>
                                                                    {ge.summary}
                                                                </div>
                                                                <div className="text-[9px]" style={{ color: `${color}88` }}>
                                                                    {fmt(ge.start)} — {fmt(ge.end)}
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
            </div>

            {/* ═══ BOOKING MODAL ═══ */}
            {showBooking && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowBooking(false)}>
                    <div className="w-full max-w-lg rounded-2xl p-6 space-y-5 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}
                        style={{ background: 'var(--color-surface-50)', border: '1px solid rgba(255,255,255,0.08)' }}>
                        <div className="flex items-center justify-between">
                            <h2 className="text-lg font-bold text-white flex items-center gap-2">
                                <CalendarDays className="w-5 h-5" style={{ color: '#6366f1' }} /> Prenota Appuntamento
                            </h2>
                            <button onClick={() => setShowBooking(false)}><X className="w-5 h-5 text-white/50 hover:text-white" /></button>
                        </div>

                        {/* Booking mode toggle */}
                        <div className="flex rounded-xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.1)' }}>
                            <button
                                onClick={() => { setBookingMode('auto'); setBookSlot(null); setAvailableSlots([]); fetchAutoSlots() }}
                                className="flex-1 px-4 py-2.5 text-xs font-bold transition-all flex items-center justify-center gap-2"
                                style={{
                                    background: bookingMode === 'auto' ? 'rgba(99,102,241,0.2)' : 'transparent',
                                    color: bookingMode === 'auto' ? '#a5b4fc' : 'var(--color-surface-500)',
                                }}
                            >
                                <Zap className="w-3.5 h-3.5" /> Auto-Assegna
                            </button>
                            <button
                                onClick={() => { setBookingMode('manual'); setBookSlot(null); setAvailableSlots([]) }}
                                className="flex-1 px-4 py-2.5 text-xs font-bold transition-all flex items-center justify-center gap-2"
                                style={{
                                    background: bookingMode === 'manual' ? 'rgba(99,102,241,0.2)' : 'transparent',
                                    color: bookingMode === 'manual' ? '#a5b4fc' : 'var(--color-surface-500)',
                                }}
                            >
                                <User className="w-3.5 h-3.5" /> Scegli Venditore
                            </button>
                        </div>

                        {/* Auto mode: assignment strategy */}
                        {bookingMode === 'auto' && (
                            <div>
                                <label className="text-xs font-semibold text-white/70 block mb-2">Strategia di assegnazione</label>
                                <div className="grid grid-cols-3 gap-2">
                                    {ASSIGNMENT_MODES.map(mode => (
                                        <button
                                            key={mode.value}
                                            onClick={() => setAssignmentMode(mode.value)}
                                            className="p-2.5 rounded-xl text-center transition-all"
                                            style={{
                                                background: assignmentMode === mode.value ? `${mode.color}15` : 'rgba(255,255,255,0.03)',
                                                border: `1px solid ${assignmentMode === mode.value ? `${mode.color}40` : 'rgba(255,255,255,0.06)'}`,
                                            }}
                                        >
                                            <mode.icon className="w-4 h-4 mx-auto mb-1" style={{ color: assignmentMode === mode.value ? mode.color : 'var(--color-surface-500)' }} />
                                            <div className="text-[10px] font-bold" style={{ color: assignmentMode === mode.value ? mode.color : 'var(--color-surface-400)' }}>{mode.label}</div>
                                            <div className="text-[9px]" style={{ color: 'var(--color-surface-600)' }}>{mode.desc}</div>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Manual mode: Select closer */}
                        {bookingMode === 'manual' && (
                            <div>
                                <label className="text-xs font-semibold text-white/70 block mb-1">Venditore</label>
                                <select value={bookCloserId}
                                    onChange={e => { setBookCloserId(e.target.value); setBookSlot(null); if (e.target.value) fetchSlots(e.target.value) }}
                                    className="w-full px-3 py-2 rounded-lg text-sm"
                                    style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'white' }}>
                                    <option value="">Seleziona venditore...</option>
                                    {closers.filter(c => c.has_availability).map(c => (
                                        <option key={c.user_id} value={c.user_id}>
                                            {c.name} {c.google_connected ? '📅' : ''}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}

                        {/* Slot selection */}
                        {((bookingMode === 'auto') || (bookingMode === 'manual' && bookCloserId)) && (
                            <div>
                                <label className="text-xs font-semibold text-white/70 block mb-2">
                                    Slot disponibili (prossimi 14 giorni)
                                    {bookingMode === 'auto' && <span className="text-[10px] font-normal ml-2" style={{ color: '#22c55e' }}>Aggregati da tutti i venditori</span>}
                                </label>
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

                        {/* Lead info */}
                        {bookSlot && (
                            <>
                                <div className="p-3 rounded-lg" style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)' }}>
                                    <div className="text-xs font-bold" style={{ color: '#a5b4fc' }}>
                                        📅 {new Date(bookSlot.start).toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })}
                                        {' · '}{fmt(bookSlot.start)} — {fmt(bookSlot.end)}
                                        {bookingMode === 'auto' && (
                                            <span className="ml-2 text-[10px] font-normal" style={{ color: 'var(--color-surface-400)' }}>
                                                (assegnazione automatica: {ASSIGNMENT_MODES.find(m => m.value === assignmentMode)?.label})
                                            </span>
                                        )}
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

                                {/* Booking result */}
                                {bookingResult && (
                                    <div className="p-3 rounded-xl text-sm font-semibold" style={{
                                        background: bookingResult.success ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
                                        border: `1px solid ${bookingResult.success ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)'}`,
                                        color: bookingResult.success ? '#22c55e' : '#ef4444',
                                    }}>
                                        {bookingResult.success ? '✓ ' : '✗ '}{bookingResult.message}
                                    </div>
                                )}

                                <button onClick={handleBook} disabled={bookingSaving || !bookLeadName || !!bookingResult?.success}
                                    className="w-full py-2.5 rounded-xl font-bold text-sm text-white transition-all disabled:opacity-50"
                                    style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
                                    {bookingSaving ? 'Prenotazione...'
                                        : bookingMode === 'auto' ? `⚡ Prenota con ${ASSIGNMENT_MODES.find(m => m.value === assignmentMode)?.label}`
                                        : '✓ Conferma Appuntamento'}
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
                    <div className="w-full max-w-lg rounded-2xl p-6 space-y-5 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}
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
