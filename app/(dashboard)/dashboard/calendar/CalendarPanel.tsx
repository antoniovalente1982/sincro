'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { CalendarDays, Clock, Users, Plus, ChevronLeft, ChevronRight, Phone, Mail, User, X, Check, Settings, AlertCircle, Eye, EyeOff, Shuffle, TrendingUp, Shield, Zap, Trash2, ArrowRightLeft, Tag, Palette, Edit3, ToggleLeft, ToggleRight, GripVertical, Sparkles } from 'lucide-react'
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
    service_type?: { id: string; name: string; duration_minutes: number; color: string } | null
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
    in_round_robin?: boolean
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

interface ServiceType {
    id: string
    name: string
    slug: string
    duration_minutes: number
    break_minutes: number
    color: string
    description?: string
    is_default: boolean
    is_active: boolean
    position: number
}

import type { Department } from '@/lib/permissions'

interface Props {
    userRole: string
    userDepartment?: Department
    userId: string
    prefillLead?: { id: string; name: string; email?: string; phone?: string } | null
    isGoogleConnected?: boolean
}

const ASSIGNMENT_MODES = [
    { value: 'round_robin', label: 'Round Robin', icon: Shuffle, desc: 'A→B→C→A', color: '#3b82f6' },
    { value: 'performance', label: 'Performance', icon: TrendingUp, desc: 'Chi chiude di più', color: '#f59e0b' },
    { value: 'availability', label: 'Disponibilità', icon: Shield, desc: 'Meno carico', color: '#22c55e' },
]

export default function CalendarPanel({ userRole, userDepartment, userId, prefillLead, isGoogleConnected }: Props) {
    const supabase = createClient()
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

    // Service types state
    const [serviceTypes, setServiceTypes] = useState<ServiceType[]>([])
    const [bookServiceTypeId, setBookServiceTypeId] = useState<string>('')
    const [showServiceTypesManager, setShowServiceTypesManager] = useState(false)
    const [editingServiceType, setEditingServiceType] = useState<Partial<ServiceType> | null>(null)
    const [stSaving, setStSaving] = useState(false)

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

    const [rescheduleLeadId, setRescheduleLeadId] = useState<string | null>(null)
    const [rescheduleEventId, setRescheduleEventId] = useState<string | null>(null)

    // Availability settings state
    const [availability, setAvailability] = useState<AvailabilitySchedule[]>([])
    const [availSaving, setAvailSaving] = useState(false)
    const [settingsCloserId, setSettingsCloserId] = useState('')
    const [now, setNow] = useState(new Date())

    useEffect(() => {
        const interval = setInterval(() => setNow(new Date()), 60000)
        return () => clearInterval(interval)
    }, [])

    const canBook = ['closer', 'admin', 'owner', 'manager'].includes(userRole)
    const canManageAvailability = ['closer', 'admin', 'owner', 'manager'].includes(userRole)

    const toggleRoundRobin = async (userId: string, targetValue: boolean) => {
        try {
            setClosers(prev => prev.map(c => c.user_id === userId ? { ...c, in_round_robin: targetValue } : c))
            const res = await fetch('/api/calendar', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'toggle_rr', target_user_id: userId, in_round_robin: targetValue })
            })
            if (!res.ok) throw new Error('Failed to toggle round robin')
        } catch (e) {
            console.error(e)
            // Revert on error
            setClosers(prev => prev.map(c => c.user_id === userId ? { ...c, in_round_robin: !targetValue } : c))
        }
    }

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

    // Fetch service types (all for manager, active-only for booking)
    const [allServiceTypes, setAllServiceTypes] = useState<ServiceType[]>([])
    const fetchServiceTypes = useCallback(async () => {
        try {
            const res = await fetch('/api/calendar?action=service_types&include_inactive=true')
            const data = await res.json()
            const all = data.service_types || []
            setAllServiceTypes(all)
            setServiceTypes(all.filter((st: ServiceType) => st.is_active))
        } catch { /* silent */ }
    }, [])

    useEffect(() => { fetchClosers() }, [fetchClosers])
    useEffect(() => { fetchEvents() }, [fetchEvents])
    useEffect(() => { fetchGoogleEvents() }, [fetchGoogleEvents])
    useEffect(() => { fetchServiceTypes() }, [fetchServiceTypes])

    // Real-time listener for calendar_events table
    useEffect(() => {
        const channel = supabase.channel('calendar_realtime')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'calendar_events' }, () => {
                // Fetch events again without triggering a loading overlay
                const from = weekStart.toISOString()
                const to = weekEnd.toISOString()
                fetch(`/api/calendar?action=events&from=${from}&to=${to}`)
                    .then(res => res.json())
                    .then(data => {
                        if (data.events) setEvents(data.events)
                    })
                    .catch(() => {})
            })
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [supabase, weekStart, weekEnd])

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
            const stParam = bookServiceTypeId ? `&service_type_id=${bookServiceTypeId}` : ''
            const res = await fetch(`/api/calendar?action=slots&closer_id=${closerId}&from=${from}&to=${to}${stParam}`)
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
            const stParam = bookServiceTypeId ? `&service_type_id=${bookServiceTypeId}` : ''
            
            const res = await fetch(`/api/calendar?action=auto_slots&from=${from}&to=${to}${stParam}`)
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
                        lead_id: rescheduleLeadId || prefillLead?.id,
                        reschedule_event_id: rescheduleEventId || undefined,
                        assignment_mode: assignmentMode,
                        service_type_id: bookServiceTypeId || undefined,
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
                        lead_id: rescheduleLeadId || prefillLead?.id,
                        reschedule_event_id: rescheduleEventId || undefined,
                        service_type_id: bookServiceTypeId || undefined,
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
            // Optimistic update
            setSelectedEvent(prev => prev ? { ...prev, status } : prev)
            
            await fetch('/api/calendar', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ event_id: eventId, status }),
            })
            fetchEvents()
        } catch { /* silent */ }
    }

    // Delete event permanently (ONLY the event — the lead stays in the CRM)
    const handleDeleteEvent = async (eventId: string) => {
        if (!confirm('Sei sicuro di voler eliminare questo APPUNTAMENTO?\n\n⚠️ Verrà eliminato SOLO l\'appuntamento dal calendario.\nIl lead resterà nel CRM.')) return
        try {
            const res = await fetch('/api/calendar', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ event_id: eventId }),
            })
            if (!res.ok) {
                const data = await res.json()
                alert(data.error || 'Errore durante l\'eliminazione')
                return
            }
            setSelectedEvent(null)
            await fetchEvents()
            fetchGoogleEvents()
        } catch { alert('Errore di rete') }
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
        setRescheduleLeadId(null)
        setRescheduleEventId(null)
        setBookServiceTypeId('')
    }

    // ═══ SERVICE TYPES CRUD ═══
    const handleCreateServiceType = async (st: Partial<ServiceType>) => {
        setStSaving(true)
        try {
            const res = await fetch('/api/calendar', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'create_service_type', name: st.name, duration_minutes: st.duration_minutes, color: st.color, description: st.description })
            })
            if (!res.ok) { const d = await res.json(); alert(d.error || 'Errore'); return }
            setEditingServiceType(null)
            fetchServiceTypes()
        } catch { alert('Errore di rete') }
        setStSaving(false)
    }

    const handleUpdateServiceType = async (st: Partial<ServiceType>) => {
        setStSaving(true)
        try {
            const res = await fetch('/api/calendar', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'update_service_type', id: st.id, name: st.name, duration_minutes: st.duration_minutes, color: st.color, description: st.description, is_active: st.is_active })
            })
            if (!res.ok) { const d = await res.json(); alert(d.error || 'Errore'); return }
            setEditingServiceType(null)
            fetchServiceTypes()
        } catch { alert('Errore di rete') }
        setStSaving(false)
    }

    const handleDeleteServiceType = async (id: string) => {
        if (!confirm('Eliminare questo tipo di appuntamento?')) return
        try {
            const res = await fetch('/api/calendar', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'delete_service_type', id })
            })
            if (!res.ok) { const d = await res.json(); alert(d.error || 'Errore'); return }
            fetchServiceTypes()
        } catch { alert('Errore di rete') }
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

    // Get Sincro events for a specific day/hour/closer cell
    const getEventsForCell = (day: Date, hour: number, closerId?: string) => {
        if (visibleCalendars.size === 0) return []
        return events.filter(e => {
            const start = new Date(e.start_time)
            return start.toDateString() === day.toDateString()
                && start.getHours() === hour
                && visibleCalendars.has(e.closer_id)
                && (closerId ? e.closer_id === closerId : true)
        })
    }

    // Get ALL-DAY Google events for a specific day+closer (for the header all-day row)
    const getAllDayGoogleEventsForCell = (day: Date, closerId?: string) => {
        if (!showGoogleEvents) return []
        const results: { event: GoogleEvent; userId: string; color: string }[] = []
        const dayStr = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`

        for (const [uid, gEvents] of Object.entries(googleEvents)) {
            if (!visibleCalendars.has(uid)) continue
            if (closerId && uid !== closerId) continue
            const closer = closers.find(c => c.user_id === uid)
            for (const ge of gEvents) {
                const isAllDay = ge.start && ge.start.length === 10
                if (isAllDay && dayStr >= ge.start && dayStr < ge.end) {
                    results.push({ event: ge, userId: uid, color: closer?.color || '#64748b' })
                }
            }
        }
        return results
    }

    // Get TIMED Google events for a specific day/hour/closer cell (excludes all-day)
    const getGoogleEventsForCell = (day: Date, hour: number, closerId?: string) => {
        if (!showGoogleEvents) return []
        const results: { event: GoogleEvent; userId: string; color: string }[] = []

        for (const [uid, gEvents] of Object.entries(googleEvents)) {
            if (!visibleCalendars.has(uid)) continue
            if (closerId && uid !== closerId) continue
            const closer = closers.find(c => c.user_id === uid)
            for (const ge of gEvents) {
                const isAllDay = ge.start && ge.start.length === 10
                if (isAllDay) continue // all-day events go in the header row, not in time grid
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
                    <h3 className="text-xs font-bold th-heading uppercase tracking-wider">Calendari</h3>
                    <button
                        onClick={toggleAllCalendars}
                        className="text-[10px] font-medium px-2 py-0.5 rounded transition-colors th-bg-hover"
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
                            className="w-full flex items-center gap-2.5 p-2 rounded-lg transition-all th-bg-hover text-left group"
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
                            <div className="flex flex-col flex-1 min-w-0 pr-2">
                                <span className="text-xs font-medium th-heading truncate w-full">{c.name}</span>
                                {(userRole === 'owner' || userRole === 'admin') && (
                                    <label className="flex items-center gap-1.5 mt-1 cursor-pointer w-fit group/rr" onClick={e => e.stopPropagation()}>
                                        <input 
                                            type="checkbox" 
                                            checked={c.in_round_robin !== false} 
                                            onChange={(e) => { 
                                                e.stopPropagation(); 
                                                toggleRoundRobin(c.user_id, !c.in_round_robin);
                                            }}
                                            className="w-2.5 h-2.5 rounded bg-[var(--hover-bg)] border-white/20 text-indigo-500 focus:ring-0 cursor-pointer"
                                        />
                                        <span className={`text-[9px] uppercase tracking-wider font-bold transition-colors ${c.in_round_robin !== false ? 'text-indigo-400' : 'th-muted'}`}>
                                            Auto-Ass.
                                        </span>
                                    </label>
                                )}
                            </div>
                            <div className="flex items-center gap-1.5">
                                {canManageAvailability && (userRole === 'owner' || userRole === 'admin' || c.user_id === userId) && (
                                    <button onClick={(e) => { e.stopPropagation(); openAvailabilitySettings(c.user_id) }} className="hover:th-heading" style={{ color: 'var(--color-surface-500)' }}>
                                        <Settings className="w-3 h-3" />
                                    </button>
                                )}
                                {c.google_connected ? (
                                    <div className="w-3 h-3 rounded-full" style={{ background: 'rgba(34,197,94,0.3)' }} title="Google Calendar connesso">
                                        <div className="w-1.5 h-1.5 rounded-full mx-auto mt-[3px]" style={{ background: '#22c55e' }} />
                                    </div>
                                ) : (
                                    <div className="w-3 h-3 rounded-full" style={{ background: 'rgba(239,68,68,0.2)' }} title="Google Calendar NON connesso">
                                        <div className="w-1.5 h-1.5 rounded-full mx-auto mt-[3px]" style={{ background: '#ef4444' }} />
                                    </div>
                                )}
                                {!c.has_availability && (
                                    <span title="Nessuna disponibilità"><AlertCircle className="w-3 h-3" style={{ color: '#f59e0b' }} /></span>
                                )}
                            </div>
                        </button>
                    ))}
                </div>

                {/* Google Calendar toggle */}
                {connectedClosersCount > 0 && (
                    <div className="pt-3 border-t" style={{ borderColor: 'var(--color-surface-200)' }}>
                        <button
                            onClick={() => setShowGoogleEvents(!showGoogleEvents)}
                            className="w-full flex items-center gap-2.5 p-2 rounded-lg transition-all th-bg-hover"
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
                                <span className="text-xs font-medium th-heading">Google Calendar</span>
                            </div>
                        </button>
                        {googleEventsLoading && (
                            <div className="text-[10px] text-center mt-1" style={{ color: 'var(--color-surface-500)' }}>Caricamento eventi Google...</div>
                        )}
                    </div>
                )}

                {/* Quick stats */}
                <div className="pt-3 border-t" style={{ borderColor: 'var(--color-surface-200)' }}>
                    <div className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--color-surface-500)' }}>
                        Questa settimana
                    </div>
                    <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-[11px]">
                            <span style={{ color: 'var(--color-surface-400)' }}>Appuntamenti</span>
                            <span className="font-bold th-heading">{events.filter(e => e.status === 'confirmed').length}</span>
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
                        <h1 className="text-2xl font-bold th-heading flex items-center gap-3">
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
                        ]} footer="I venditori possono prenotare e gestire gli esiti. Admin/Owner configurano le disponibilità di tutti." />
                        {['owner', 'admin'].includes(userRole) && (
                            <button
                                onClick={() => setShowServiceTypesManager(true)}
                                className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-bold transition-all hover:scale-[1.02]"
                                style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)', color: '#f59e0b' }}
                            >
                                <Tag className="w-4 h-4" /> Tipi
                            </button>
                        )}
                    </div>
                </div>

                {/* Google re-auth banner */}
                {isGoogleConnected === false && (userRole === 'closer' || (userRole === 'manager' && userDepartment === 'sales')) && (
                    <div className="flex items-center gap-3 p-3 rounded-xl" style={{ background: 'rgba(66,133,244,0.08)', border: '1px solid rgba(66,133,244,0.2)' }}>
                        <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24">
                            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                        </svg>
                        <div className="flex-1">
                            <span className="text-xs font-semibold th-heading">Connetti Google Calendar</span>
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
                        <button onClick={() => navigate(-1)} className="p-2 rounded-lg th-bg-hover transition">
                            <ChevronLeft className="w-4 h-4 th-heading" />
                        </button>
                        <button onClick={goToday} className="px-3 py-1.5 rounded-lg text-xs font-semibold th-heading th-bg-hover transition">
                            Oggi
                        </button>
                        <button onClick={() => navigate(1)} className="p-2 rounded-lg th-bg-hover transition">
                            <ChevronRight className="w-4 h-4 th-heading" />
                        </button>
                        <span className="text-sm font-bold th-heading ml-2">
                            {view === 'week'
                                ? `${weekDays[0].toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })} — ${weekDays[weekDays.length - 1].toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' })}`
                                : currentDate.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
                            }
                        </span>
                    </div>

                    <div className="flex items-center gap-2">
                        {/* View toggle */}
                        <div className="flex rounded-lg overflow-hidden" style={{ border: '1px solid var(--color-surface-200)' }}>
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
                            style={{ background: 'var(--color-surface-100)', border: '1px solid var(--color-surface-200)', color: 'var(--color-surface-700)' }}
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

                {/* Calendar Grid — Per-Vendor Column Layout */}
                <div className="glass-card overflow-hidden flex-1">
                    <div className="overflow-x-auto h-full">
                        {(() => {
                            // Build visible closers list
                            const visibleClosers = closers.filter(c => visibleCalendars.has(c.user_id))
                            if (visibleClosers.length === 0) {
                                return (
                                    <div className="flex flex-col items-center justify-center h-full py-20" style={{ color: 'var(--color-surface-500)' }}>
                                        <CalendarDays className="w-10 h-10 mb-3 opacity-30" />
                                        <p className="text-sm font-medium">Nessun calendario selezionato</p>
                                        <p className="text-xs mt-1 opacity-60">Usa la barra laterale per mostrare i calendari dei venditori</p>
                                    </div>
                                )
                            }

                            // In week view: columns = visibleClosers × weekDays
                            // In day view: columns = visibleClosers × 1 day
                            const cols = view === 'week'
                                ? weekDays.flatMap(day => visibleClosers.map(c => ({ day, closer: c })))
                                : visibleClosers.map(c => ({ day: weekDays[0], closer: c }))

                            // group by day for header labels
                            const totalCols = cols.length
                            const colWidth = view === 'week' ? Math.max(120, Math.floor(900 / totalCols)) : Math.max(160, Math.floor(600 / totalCols))
                            const gridTotalWidth = 60 + totalCols * colWidth

                            return (
                                <div style={{ minWidth: `${gridTotalWidth}px` }}>
                                    {/* Day Header Row */}
                                    {view === 'week' && (
                                        <div className="flex" style={{ borderBottom: '2px solid var(--color-surface-200)' }}>
                                            <div style={{ width: '60px', flexShrink: 0 }} />
                                            {weekDays.map((day, di) => (
                                                <div
                                                    key={di}
                                                    className="text-center py-2"
                                                    style={{
                                                        width: `${visibleClosers.length * colWidth}px`,
                                                        flexShrink: 0,
                                                        borderLeft: '1px solid var(--color-surface-200)',
                                                        background: isToday(day) ? 'rgba(99,102,241,0.05)' : 'transparent',
                                                    }}
                                                >
                                                    <div className="text-[10px] font-bold uppercase" style={{ color: isToday(day) ? '#a5b4fc' : 'var(--color-surface-500)' }}>
                                                        {DAYS[day.getDay()]}
                                                    </div>
                                                    <div className="text-base font-bold" style={{ color: isToday(day) ? 'white' : 'var(--color-surface-700)' }}>
                                                        {day.getDate()}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {/* Vendor sub-header */}
                                    <div className="flex" style={{ borderBottom: '1px solid var(--color-surface-200)' }}>
                                        <div style={{ width: '60px', flexShrink: 0 }} />
                                        {cols.map(({ day, closer }, ci) => (
                                            <div
                                                key={ci}
                                                className="flex items-center justify-center gap-1.5 py-1.5 px-1"
                                                style={{
                                                    width: `${colWidth}px`,
                                                    flexShrink: 0,
                                                    borderLeft: '1px solid var(--color-surface-200)',
                                                    background: isToday(day) ? 'rgba(99,102,241,0.03)' : 'transparent',
                                                }}
                                            >
                                                <div
                                                    className="w-4 h-4 rounded-full flex-shrink-0 flex items-center justify-center text-[8px] font-bold text-white"
                                                    style={{ background: closer.color }}
                                                >
                                                    {closer.name.charAt(0).toUpperCase()}
                                                </div>
                                                <span className="text-[9px] font-semibold truncate" style={{ color: closer.color, maxWidth: `${colWidth - 28}px` }}>
                                                    {closer.name.split(' ')[0]}
                                                </span>
                                            </div>
                                        ))}
                                    </div>

                                    {/* ── All-Day Events Row (NON DISPONIBILE, ferie, ecc.) ── */}
                                    {showGoogleEvents && (() => {
                                        const hasAnyAllDay = cols.some(({ day, closer }) =>
                                            getAllDayGoogleEventsForCell(day, closer.user_id).length > 0
                                        )
                                        if (!hasAnyAllDay) return null
                                        return (
                                            <div className="flex" style={{ borderBottom: '2px solid var(--color-surface-200)', background: 'rgba(239,68,68,0.03)' }}>
                                                <div className="flex items-center justify-end pr-2" style={{ width: '60px', flexShrink: 0 }}>
                                                    <span className="text-[8px] font-bold uppercase tracking-wider" style={{ color: 'var(--color-surface-400)' }}>Tutto il giorno</span>
                                                </div>
                                                {cols.map(({ day, closer }, ci) => {
                                                    const allDayEvts = getAllDayGoogleEventsForCell(day, closer.user_id)
                                                    return (
                                                        <div
                                                            key={ci}
                                                            className="py-1 px-0.5 flex flex-col gap-0.5"
                                                            style={{
                                                                width: `${colWidth}px`,
                                                                flexShrink: 0,
                                                                minHeight: '28px',
                                                                borderLeft: '1px solid var(--color-surface-200)',
                                                                background: allDayEvts.length > 0
                                                                    ? 'rgba(239,68,68,0.06)'
                                                                    : isToday(day) ? 'rgba(99,102,241,0.02)' : 'transparent',
                                                            }}
                                                        >
                                                            {allDayEvts.map(({ event: ge, color }) => (
                                                                <div
                                                                    key={`allday-${ge.id}`}
                                                                    className="rounded px-1.5 py-0.5 flex items-center gap-1 overflow-hidden"
                                                                    style={{
                                                                        background: `${color}22`,
                                                                        borderLeft: `3px solid ${color}99`,
                                                                    }}
                                                                    title={`Google: ${ge.summary || 'Tutto il giorno'}`}
                                                                >
                                                                    <span className="text-[8px] font-bold truncate" style={{ color: `${color}dd` }}>
                                                                        🔒 {ge.summary || 'Non disponibile'}
                                                                    </span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                        )
                                    })()}

                                    {/* Time Grid */}
                                    <div style={{ maxHeight: 'calc(100vh - 340px)', overflowY: 'auto' }}>
                                        {HOURS.map(hour => (
                                            <div key={hour} className="flex" style={{
                                                minHeight: '60px',
                                                borderBottom: '1px solid var(--color-surface-100)',
                                            }}>
                                                {/* Hour label */}
                                                <div className="p-2 text-right pr-3 pt-0 flex-shrink-0" style={{ width: '60px', marginTop: '-6px' }}>
                                                    <span className="text-[10px] font-medium" style={{ color: 'var(--color-surface-500)' }}>
                                                        {hour.toString().padStart(2, '0')}:00
                                                    </span>
                                                </div>

                                                {/* One cell per closer×day */}
                                                {cols.map(({ day, closer }, ci) => {
                                                    const cellEvents = getEventsForCell(day, hour, closer.user_id)
                                                    const cellGoogleEvents = getGoogleEventsForCell(day, hour, closer.user_id)

                                                    return (
                                                        <div
                                                            key={ci}
                                                            className="relative transition-colors th-bg-hover"
                                                            style={{
                                                                width: `${colWidth}px`,
                                                                flexShrink: 0,
                                                                minHeight: '60px',
                                                                borderLeft: '1px solid var(--color-surface-200)',
                                                                background: isToday(day) ? 'rgba(99,102,241,0.02)' : 'transparent',
                                                            }}
                                                        >
                                                            {/* Half-hour dashed line */}
                                                            <div className="absolute top-[30px] left-0 right-0 border-t border-dashed pointer-events-none" style={{ borderColor: 'var(--color-surface-200)' }} />

                                                            {/* Current time red line */}
                                                            {isToday(day) && hour === now.getHours() && (
                                                                <div
                                                                    className="absolute left-0 right-0 flex items-center z-20 pointer-events-none"
                                                                    style={{ top: `${(now.getMinutes() / 60) * 100}%` }}
                                                                >
                                                                    <div className="w-2 h-2 rounded-full bg-red-500 absolute -left-1 shadow-[0_0_6px_rgba(239,68,68,0.8)]"></div>
                                                                    <div className="w-full border-t-2 border-dashed border-red-500"></div>
                                                                </div>
                                                            )}

                                                            {/* Google Calendar background blocks (read-only, subtle) */}
                                                            {cellGoogleEvents.map(({ event: ge, color }) => {
                                                                const isSincroMirror = cellEvents.some(ev =>
                                                                    new Date(ev.start_time).getTime() === new Date(ge.start).getTime() &&
                                                                    (ge.summary?.includes('Appuntamento') || (ge as any).extendedProperties?.private?.sincro_event_id)
                                                                )
                                                                if (isSincroMirror) return null

                                                                // getGoogleEventsForCell now only returns timed events (all-day shown in header row)
                                                                const startMin = new Date(ge.start).getMinutes()
                                                                const durationMs = new Date(ge.end).getTime() - new Date(ge.start).getTime()
                                                                const durationMin = durationMs / 60000
                                                                const height = Math.max((durationMin / 60) * 60, 18)

                                                                return (
                                                                    <div
                                                                        key={`g-${ge.id}`}
                                                                        className="absolute left-0 right-0 mx-0.5 rounded overflow-hidden pointer-events-none"
                                                                        style={{
                                                                            top: `${(startMin / 60) * 100}%`,
                                                                            height: `${height}px`,
                                                                            background: `${color}22`,
                                                                            borderLeft: `3px solid ${color}88`,
                                                                            zIndex: 2,
                                                                        }}
                                                                        title={`Google: ${ge.summary || 'Impegno'}`}
                                                                    >
                                                                        <span className="text-[8px] font-semibold pl-1 leading-tight block truncate mt-0.5" style={{ color: `${color}cc` }}>
                                                                            🔒 {ge.summary || 'Impegno'}
                                                                        </span>
                                                                    </div>
                                                                )
                                                            })}

                                                            {/* Sincro events (clickable, solid) */}
                                                            {(() => {
                                                                if (cellEvents.length === 0) return null
                                                                // Simple collision for events within same closer cell
                                                                const sorted = [...cellEvents].sort((a, b) =>
                                                                    new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
                                                                )
                                                                const cols2: any[][] = []
                                                                sorted.forEach(evt => {
                                                                    const startMin = new Date(evt.start_time).getMinutes()
                                                                    const duration = (new Date(evt.end_time).getTime() - new Date(evt.start_time).getTime()) / 60000
                                                                    let placed = false
                                                                    for (let i = 0; i < cols2.length; i++) {
                                                                        const last = cols2[i][cols2[i].length - 1]
                                                                        if (startMin >= last._startMin + Math.max(last._duration, 15)) {
                                                                            cols2[i].push({ ...evt, _startMin: startMin, _duration: duration, _col: i })
                                                                            placed = true; break
                                                                        }
                                                                    }
                                                                    if (!placed) cols2.push([{ ...evt, _startMin: new Date(evt.start_time).getMinutes(), _duration: (new Date(evt.end_time).getTime() - new Date(evt.start_time).getTime()) / 60000, _col: cols2.length }])
                                                                })
                                                                const maxSubCols = cols2.length || 1
                                                                return cols2.flat().map(evt => {
                                                                    const startMin = new Date(evt.start_time).getMinutes()
                                                                    const duration = (new Date(evt.end_time).getTime() - new Date(evt.start_time).getTime()) / 60000
                                                                    const height = Math.max((duration / 60) * 60, 24)
                                                                    const colW = 100 / maxSubCols
                                                                    const leftPct = evt._col * colW
                                                                    const bgColor = evt.closer_color || '#6366f1'
                                                                    const statusIcon = evt.status === 'completed' ? '✅ ' : evt.status === 'no_show' ? '❌ ' : ''
                                                                    return (
                                                                        <div
                                                                            key={evt.id}
                                                                            onClick={() => setSelectedEvent(evt)}
                                                                            className="absolute rounded-md px-1.5 py-1 cursor-pointer hover:scale-[1.02] hover:z-10 hover:shadow-lg transition-all shadow-sm"
                                                                            style={{
                                                                                top: `${(startMin / 60) * 100}%`,
                                                                                height: `${height}px`,
                                                                                left: `calc(${leftPct}% + 1px)`,
                                                                                width: `calc(${colW}% - 3px)`,
                                                                                background: bgColor,
                                                                                zIndex: 5,
                                                                            }}
                                                                        >
                                                                            {evt.service_type && (
                                                                                <div className="w-1.5 h-1.5 rounded-full mb-0.5" style={{ background: evt.service_type.color || '#fff', boxShadow: `0 0 4px ${evt.service_type.color || '#fff'}` }} />
                                                                            )}
                                                                            <div className="text-[10px] font-bold truncate leading-tight text-white drop-shadow-md">
                                                                                {statusIcon}{evt.leads?.name || evt.title}
                                                                            </div>
                                                                            {height >= 35 && (
                                                                                <div className="text-[9px] font-medium leading-tight truncate mt-[2px] text-white/90">
                                                                                    {`${fmt(evt.start_time)} — ${fmt(evt.end_time)}`}
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    )
                                                                })
                                                            })()}
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )
                        })()}
                    </div>
                </div>
            </div>

            {/* ═══ BOOKING MODAL ═══ */}
            {showBooking && (
                <div className="fixed inset-0 bg-[var(--overlay-bg)] backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowBooking(false)}>
                    <div className="w-full max-w-lg rounded-2xl p-6 space-y-5 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}
                        style={{ background: 'var(--color-surface-50)', border: '1px solid var(--color-surface-200)' }}>
                        <div className="flex items-center justify-between">
                            <h2 className="text-lg font-bold th-heading flex items-center gap-2">
                                <CalendarDays className="w-5 h-5" style={{ color: '#6366f1' }} /> Prenota Appuntamento
                            </h2>
                            <button onClick={() => setShowBooking(false)}><X className="w-5 h-5 th-muted hover:th-heading" /></button>
                        </div>

                        {/* Booking mode toggle */}
                        <div className="flex rounded-xl overflow-hidden" style={{ border: '1px solid var(--color-surface-200)' }}>
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

                        {/* Service type selector */}
                        {serviceTypes.length > 0 && (
                            <div>
                                <label className="text-xs font-semibold th-sub block mb-2">Tipo di appuntamento</label>
                                <div className="flex flex-wrap gap-2">
                                    <button
                                        onClick={() => { setBookServiceTypeId(''); setBookSlot(null); setAvailableSlots([]) }}
                                        className="px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all flex items-center gap-1.5"
                                        style={{
                                            background: !bookServiceTypeId ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.03)',
                                            border: `1px solid ${!bookServiceTypeId ? '#6366f1' : 'var(--color-surface-200)'}`,
                                            color: !bookServiceTypeId ? '#a5b4fc' : 'var(--color-surface-500)',
                                        }}
                                    >
                                        Tutti
                                    </button>
                                    {serviceTypes.map(st => (
                                        <button
                                            key={st.id}
                                            onClick={() => { setBookServiceTypeId(st.id); setBookSlot(null); setAvailableSlots([]) }}
                                            className="px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all flex items-center gap-1.5"
                                            style={{
                                                background: bookServiceTypeId === st.id ? `${st.color}20` : 'rgba(255,255,255,0.03)',
                                                border: `1px solid ${bookServiceTypeId === st.id ? st.color : 'var(--color-surface-200)'}`,
                                                color: bookServiceTypeId === st.id ? st.color : 'var(--color-surface-500)',
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

                        {/* Auto mode: assignment strategy */}
                        {bookingMode === 'auto' && (
                            <div className="p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-xs font-medium th-sub">
                                <Sparkles className="w-3.5 h-3.5 inline mr-1 text-indigo-400" />
                                Il venditore verrà assegnato automaticamente al momento della conferma, bilanciando il carico e la performance.
                            </div>
                        )}

                        {/* Manual mode: Select closer */}
                        {bookingMode === 'manual' && (
                            <div>
                                <label className="text-xs font-semibold th-sub block mb-1">Venditore</label>
                                <select value={bookCloserId}
                                    onChange={e => { setBookCloserId(e.target.value); setBookSlot(null); if (e.target.value) fetchSlots(e.target.value) }}
                                    className="w-full px-3 py-2 rounded-lg text-sm"
                                    style={{ background: 'var(--color-surface-100)', border: '1px solid var(--color-surface-200)', color: 'var(--color-surface-800)' }}>
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
                                <label className="text-xs font-semibold th-sub block mb-2">
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
                                                <div className="text-[11px] font-bold th-sub mb-1">
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
                                                                        ? 'var(--color-surface-200)'
                                                                        : 'rgba(255,255,255,0.02)',
                                                                border: bookSlot?.start === slot.start
                                                                    ? '1px solid #6366f1'
                                                                    : '1px solid var(--color-surface-200)',
                                                                color: slot.available ? 'var(--color-surface-800)' : 'var(--color-surface-300)',
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
                                        <label className="text-xs font-semibold th-sub block mb-1">Nome Lead *</label>
                                        <input value={bookLeadName} onChange={e => setBookLeadName(e.target.value)}
                                            placeholder="Mario Rossi" className="w-full px-3 py-2 rounded-lg text-sm"
                                            style={{ background: 'var(--color-surface-100)', border: '1px solid var(--color-surface-200)', color: 'var(--color-surface-800)' }} />
                                    </div>
                                    <div>
                                        <label className="text-xs font-semibold th-sub block mb-1">Telefono</label>
                                        <input value={bookPhone} onChange={e => setBookPhone(e.target.value)}
                                            placeholder="+39..." className="w-full px-3 py-2 rounded-lg text-sm"
                                            style={{ background: 'var(--color-surface-100)', border: '1px solid var(--color-surface-200)', color: 'var(--color-surface-800)' }} />
                                    </div>
                                </div>
                                <div>
                                    <label className="text-xs font-semibold th-sub block mb-1">Email</label>
                                    <input value={bookEmail} onChange={e => setBookEmail(e.target.value)}
                                        placeholder="email@example.com" className="w-full px-3 py-2 rounded-lg text-sm"
                                        style={{ background: 'var(--color-surface-100)', border: '1px solid var(--color-surface-200)', color: 'var(--color-surface-800)' }} />
                                </div>
                                <div>
                                    <label className="text-xs font-semibold th-sub block mb-1">Note</label>
                                    <textarea value={bookNotes} onChange={e => setBookNotes(e.target.value)}
                                        rows={2} placeholder="Note aggiuntive..." className="w-full px-3 py-2 rounded-lg text-sm resize-none"
                                        style={{ background: 'var(--color-surface-100)', border: '1px solid var(--color-surface-200)', color: 'var(--color-surface-800)' }} />
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
                <div className="fixed inset-0 bg-[var(--overlay-bg)] backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setSelectedEvent(null)}>
                    <div className="w-full max-w-md rounded-2xl p-6 space-y-4" onClick={e => e.stopPropagation()}
                        style={{ background: 'var(--color-surface-50)', border: '1px solid var(--color-surface-200)' }}>
                        <div className="flex items-center justify-between">
                            <h2 className="text-lg font-bold th-heading">{selectedEvent.leads?.name || selectedEvent.title}</h2>
                            <button onClick={() => setSelectedEvent(null)}><X className="w-5 h-5 th-muted hover:th-heading" /></button>
                        </div>

                        <div className="space-y-2">
                            <div className="flex items-center gap-2 text-sm">
                                <CalendarDays className="w-4 h-4" style={{ color: '#6366f1' }} />
                                <span className="th-heading">{new Date(selectedEvent.start_time).toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
                            </div>
                            <div className="flex items-center gap-2 text-sm">
                                <Clock className="w-4 h-4" style={{ color: '#22c55e' }} />
                                <span className="th-heading">{fmt(selectedEvent.start_time)} — {fmt(selectedEvent.end_time)}</span>
                            </div>
                            <div className="flex items-center gap-2 text-sm">
                                <User className="w-4 h-4" style={{ color: selectedEvent.closer_color }} />
                                <span className="th-heading">Venditore: {selectedEvent.closer_name}</span>
                            </div>
                            {selectedEvent.service_type && (
                                <div className="flex items-center gap-2 text-sm">
                                    <Tag className="w-4 h-4" style={{ color: selectedEvent.service_type.color }} />
                                    <span className="th-heading">{selectedEvent.service_type.name}</span>
                                    <span className="text-[10px] px-1.5 py-0.5 rounded-md font-semibold" style={{ background: `${selectedEvent.service_type.color}20`, color: selectedEvent.service_type.color }}>{selectedEvent.service_type.duration_minutes}min</span>
                                </div>
                            )}
                            {selectedEvent.setter_name && (
                                <div className="flex items-center gap-2 text-sm">
                                    <Users className="w-4 h-4" style={{ color: '#f59e0b' }} />
                                    <span className="th-heading">Prenotato da: {selectedEvent.setter_name}</span>
                                </div>
                            )}
                            {(selectedEvent.lead_phone || selectedEvent.leads?.phone) && (
                                <div className="flex items-center gap-2 text-sm">
                                    <Phone className="w-4 h-4" style={{ color: '#3b82f6' }} />
                                    <span className="th-heading">{selectedEvent.lead_phone || selectedEvent.leads?.phone}</span>
                                </div>
                            )}
                            {(selectedEvent.lead_email || selectedEvent.leads?.email) && (
                                <div className="flex items-center gap-2 text-sm">
                                    <Mail className="w-4 h-4" style={{ color: '#ec4899' }} />
                                    <span className="th-heading">{selectedEvent.lead_email || selectedEvent.leads?.email}</span>
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
                        {(userRole === 'closer' || userRole === 'owner' || userRole === 'admin' || userRole === 'manager') && (
                            <>
                                {/* Esito Appuntamento */}
                                <div className="pt-3">
                                    <label className="text-[10px] font-bold th-muted uppercase mb-2 block">Esito Appuntamento</label>
                                    <div className="grid grid-cols-2 gap-2">
                                        <button onClick={() => handleUpdateEvent(selectedEvent.id, 'completed')}
                                            className="flex flex-col items-center justify-center py-2 rounded-lg text-xs font-bold transition-all hover:scale-[1.02]"
                                            style={{ 
                                                background: selectedEvent.status === 'completed' ? '#22c55e' : 'rgba(34,197,94,0.1)', 
                                                border: `1px solid ${selectedEvent.status === 'completed' ? '#22c55e' : 'rgba(34,197,94,0.3)'}`,
                                                color: selectedEvent.status === 'completed' ? 'white' : '#22c55e' 
                                            }}>
                                            <span className="text-base mb-1">{selectedEvent.status === 'completed' ? '✅' : '✔️'}</span>
                                            Fatto
                                        </button>
                                        <button onClick={() => handleUpdateEvent(selectedEvent.id, 'no_show')}
                                            className="flex flex-col items-center justify-center py-2 rounded-lg text-xs font-bold transition-all hover:scale-[1.02]"
                                            style={{ 
                                                background: selectedEvent.status === 'no_show' ? '#f59e0b' : 'rgba(245,158,11,0.1)', 
                                                border: `1px solid ${selectedEvent.status === 'no_show' ? '#f59e0b' : 'rgba(245,158,11,0.3)'}`, 
                                                color: selectedEvent.status === 'no_show' ? 'white' : '#f59e0b' 
                                            }}>
                                            <span className="text-base mb-1">{selectedEvent.status === 'no_show' ? '⚠️' : '❌'}</span>
                                            No Show
                                        </button>
                                    </div>
                                </div>
                                
                                {/* Gestione: Sposta + Elimina Definitivamente */}
                                <div className="flex gap-2 pt-3 mt-1 border-t border-[var(--color-surface-200)]">
                                    <button
                                        onClick={() => {
                                            resetBookingForm()
                                            setBookLeadName(selectedEvent.leads?.name || selectedEvent.title || '')
                                            setBookPhone(selectedEvent.lead_phone || selectedEvent.leads?.phone || '')
                                            setBookEmail(selectedEvent.lead_email || selectedEvent.leads?.email || '')
                                            setBookTitle(`[RIPROGRAMMATO] ${selectedEvent.leads?.name || selectedEvent.title}`)
                                            setRescheduleLeadId(selectedEvent.lead_id || null)
                                            setRescheduleEventId(selectedEvent.id)
                                            setShowBooking(true)
                                            setSelectedEvent(null)
                                        }}
                                        className="flex-1 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all hover:scale-[1.01]"
                                        style={{ background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)', color: '#a5b4fc' }}
                                    >
                                        <ArrowRightLeft className="w-3.5 h-3.5" /> Sposta
                                    </button>
                                    <button onClick={() => handleDeleteEvent(selectedEvent.id)}
                                        className="flex-1 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1"
                                        title="Elimina solo l'appuntamento — il lead resta nel CRM"
                                        style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: 'rgba(239,68,68,0.7)' }}>
                                        <Trash2 className="w-3.5 h-3.5" /> Elimina Appuntamento
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* ═══ AVAILABILITY SETTINGS MODAL ═══ */}
            {showSettings && (
                <div className="fixed inset-0 bg-[var(--overlay-bg)] backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowSettings(false)}>
                    <div className="w-full max-w-lg rounded-2xl p-6 space-y-5 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}
                        style={{ background: 'var(--color-surface-50)', border: '1px solid var(--color-surface-200)' }}>
                        <div className="flex items-center justify-between">
                            <h2 className="text-lg font-bold th-heading flex items-center gap-2">
                                <Clock className="w-5 h-5" style={{ color: '#22c55e' }} /> Configura Disponibilità
                            </h2>
                            <button onClick={() => setShowSettings(false)}><X className="w-5 h-5 th-muted hover:th-heading" /></button>
                        </div>

                        <p className="text-xs" style={{ color: 'var(--color-surface-500)' }}>
                            Seleziona i giorni lavorativi e imposta orari e durata degli slot.
                        </p>

                        {availability.length === 0 && (
                            <div className="flex items-start gap-2.5 p-3 rounded-xl transition-all" style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)' }}>
                                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: '#f59e0b' }} />
                                <p className="text-xs font-medium leading-relaxed" style={{ color: 'var(--color-surface-800)' }}>
                                    <strong style={{ color: '#f59e0b' }}>Attenzione:</strong> Disattivando tutti i giorni, le tue disponibilità saranno gestite <strong>esclusivamente da Google Calendar</strong>. Risulterai sempre prenotabile, a meno che non ci siano impegni a bloccare gli slot sul tuo calendario Google.
                                </p>
                            </div>
                        )}

                        {/* Day toggles */}
                        <div className="space-y-2">
                            {[1, 2, 3, 4, 5, 6, 0].map(day => {
                                const isActive = availability.some(a => a.day_of_week === day)
                                const schedule = availability.find(a => a.day_of_week === day)

                                return (
                                    <div key={day} className="rounded-xl p-3 transition-all"
                                        style={{
                                            background: isActive ? 'rgba(99,102,241,0.08)' : 'var(--color-surface-100)',
                                            border: `1px solid ${isActive ? 'rgba(99,102,241,0.3)' : 'var(--color-surface-300)'}`,
                                        }}>
                                        <div className="flex items-center justify-between">
                                            <button onClick={() => toggleDay(day)} className="flex items-center gap-2">
                                                <div className="w-5 h-5 rounded-md flex items-center justify-center text-[10px]"
                                                    style={{
                                                        background: isActive ? '#6366f1' : 'var(--color-surface-200)',
                                                        color: 'white',
                                                    }}>
                                                    {isActive && <Check className="w-3 h-3" />}
                                                </div>
                                                <span className="text-sm font-semibold th-heading">{DAYS_FULL[day]}</span>
                                            </button>
                                        </div>

                                        {isActive && schedule && (
                                            <div className="grid grid-cols-2 gap-2 mt-3">
                                                <div>
                                                    <label className="text-[9px] font-semibold th-muted">Inizio</label>
                                                    <input type="time" value={schedule.start_time}
                                                        onChange={e => updateDaySchedule(day, 'start_time', e.target.value)}
                                                        className="w-full px-2 py-1 rounded text-xs mt-0.5"
                                                        style={{ background: 'var(--color-surface-100)', border: '1px solid var(--color-surface-200)', color: 'var(--color-surface-800)' }} />
                                                </div>
                                                <div>
                                                    <label className="text-[9px] font-semibold th-muted">Fine</label>
                                                    <input type="time" value={schedule.end_time}
                                                        onChange={e => updateDaySchedule(day, 'end_time', e.target.value)}
                                                        className="w-full px-2 py-1 rounded text-xs mt-0.5"
                                                        style={{ background: 'var(--color-surface-100)', border: '1px solid var(--color-surface-200)', color: 'var(--color-surface-800)' }} />
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

            {/* ═══ SERVICE TYPES MANAGER MODAL ═══ */}
            {showServiceTypesManager && (
                <div className="fixed inset-0 bg-[var(--overlay-bg)] backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => { setShowServiceTypesManager(false); setEditingServiceType(null) }}>
                    <div className="w-full max-w-lg rounded-2xl p-6 space-y-5 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}
                        style={{ background: 'var(--color-surface-50)', border: '1px solid var(--color-surface-200)' }}>
                        <div className="flex items-center justify-between">
                            <h2 className="text-lg font-bold th-heading flex items-center gap-2">
                                <Tag className="w-5 h-5" style={{ color: '#f59e0b' }} /> Tipi di Appuntamento
                            </h2>
                            <button onClick={() => { setShowServiceTypesManager(false); setEditingServiceType(null) }}><X className="w-5 h-5 th-muted hover:th-heading" /></button>
                        </div>

                        <p className="text-xs" style={{ color: 'var(--color-surface-500)' }}>
                            Definisci i tipi di appuntamento con durate e colori diversi. Saranno disponibili nella prenotazione.
                        </p>

                        {/* Existing service types */}
                        <div className="space-y-2">
                            {allServiceTypes.length === 0 && (
                                <div className="text-center py-6 text-sm" style={{ color: 'var(--color-surface-500)' }}>
                                    Nessun tipo configurato. Crea il primo!
                                </div>
                            )}
                            {allServiceTypes.map(st => (
                                <div key={st.id} className="rounded-xl p-3 flex items-center gap-3 transition-all group"
                                    style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--color-surface-200)', opacity: st.is_active ? 1 : 0.5 }}>
                                    <div className="w-4 h-4 rounded-full flex-shrink-0" style={{ background: st.color, boxShadow: `0 0 8px ${st.color}40` }} />
                                    <div className="flex-1 min-w-0">
                                        <div className="text-sm font-semibold th-heading truncate">{st.name}</div>
                                        <div className="text-[10px]" style={{ color: 'var(--color-surface-500)' }}>
                                            {st.duration_minutes} min{st.description ? ` · ${st.description}` : ''}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button onClick={() => setEditingServiceType({ ...st })}
                                            className="p-1.5 rounded-lg th-bg-hover transition" title="Modifica">
                                            <Edit3 className="w-3.5 h-3.5" style={{ color: '#a5b4fc' }} />
                                        </button>
                                        <button onClick={() => handleUpdateServiceType({ id: st.id, is_active: !st.is_active })}
                                            className="p-1.5 rounded-lg th-bg-hover transition" title={st.is_active ? 'Disattiva' : 'Attiva'}>
                                            {st.is_active 
                                                ? <ToggleRight className="w-3.5 h-3.5" style={{ color: '#22c55e' }} />
                                                : <ToggleLeft className="w-3.5 h-3.5" style={{ color: 'var(--color-surface-600)' }} />
                                            }
                                        </button>
                                        <button onClick={() => handleDeleteServiceType(st.id)}
                                            className="p-1.5 rounded-lg th-bg-hover transition" title="Elimina">
                                            <Trash2 className="w-3.5 h-3.5" style={{ color: '#ef4444' }} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Add / Edit form */}
                        {editingServiceType ? (
                            <div className="rounded-xl p-4 space-y-3" style={{ background: 'rgba(99,102,241,0.05)', border: '1px solid rgba(99,102,241,0.15)' }}>
                                <div className="text-xs font-bold th-heading">{editingServiceType.id ? 'Modifica Tipo' : 'Nuovo Tipo'}</div>
                                <div className="grid grid-cols-3 gap-3">
                                    <div>
                                        <label className="text-[9px] font-semibold th-muted">Nome *</label>
                                        <input value={editingServiceType.name || ''}
                                            onChange={e => setEditingServiceType(prev => prev ? { ...prev, name: e.target.value } : prev)}
                                            placeholder="Es. Consulenza Iniziale"
                                            className="w-full px-3 py-2 rounded-lg text-sm mt-0.5"
                                            style={{ background: 'var(--color-surface-100)', border: '1px solid var(--color-surface-200)', color: 'var(--color-surface-800)' }} />
                                    </div>
                                    <div>
                                        <label className="text-[9px] font-semibold th-muted">Durata (min) *</label>
                                        <select value={editingServiceType.duration_minutes || 30}
                                            onChange={e => setEditingServiceType(prev => prev ? { ...prev, duration_minutes: Number(e.target.value) } : prev)}
                                            className="w-full px-3 py-2 rounded-lg text-sm mt-0.5"
                                            style={{ background: 'var(--color-surface-100)', border: '1px solid var(--color-surface-200)', color: 'var(--color-surface-800)' }}>
                                            <option value={15}>15 min</option>
                                            <option value={30}>30 min</option>
                                            <option value={45}>45 min</option>
                                            <option value={60}>60 min</option>
                                            <option value={90}>90 min</option>
                                            <option value={120}>120 min</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-[9px] font-semibold th-muted">Pausa (min)</label>
                                        <select value={editingServiceType.break_minutes || 0}
                                            onChange={e => setEditingServiceType(prev => prev ? { ...prev, break_minutes: Number(e.target.value) } : prev)}
                                            className="w-full px-3 py-2 rounded-lg text-sm mt-0.5"
                                            style={{ background: 'var(--color-surface-100)', border: '1px solid var(--color-surface-200)', color: 'var(--color-surface-800)' }}>
                                            <option value={0}>0 min</option>
                                            <option value={5}>5 min</option>
                                            <option value={10}>10 min</option>
                                            <option value={15}>15 min</option>
                                            <option value={30}>30 min</option>
                                        </select>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-[9px] font-semibold th-muted">Colore</label>
                                        <div className="flex gap-1.5 mt-1 flex-wrap">
                                            {['#6366f1', '#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#ec4899', '#8b5cf6', '#14b8a6', '#f97316', '#64748b'].map(c => (
                                                <button key={c} onClick={() => setEditingServiceType(prev => prev ? { ...prev, color: c } : prev)}
                                                    className="w-6 h-6 rounded-full transition-all hover:scale-110"
                                                    style={{
                                                        background: c,
                                                        border: editingServiceType.color === c ? '2px solid white' : '2px solid transparent',
                                                        boxShadow: editingServiceType.color === c ? `0 0 8px ${c}` : 'none',
                                                    }} />
                                            ))}
                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-[9px] font-semibold th-muted">Descrizione</label>
                                        <input value={editingServiceType.description || ''}
                                            onChange={e => setEditingServiceType(prev => prev ? { ...prev, description: e.target.value } : prev)}
                                            placeholder="Opzionale"
                                            className="w-full px-3 py-2 rounded-lg text-sm mt-0.5"
                                            style={{ background: 'var(--color-surface-100)', border: '1px solid var(--color-surface-200)', color: 'var(--color-surface-800)' }} />
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => {
                                            if (!editingServiceType.name || !editingServiceType.duration_minutes) { alert('Nome e durata richiesti'); return }
                                            if (editingServiceType.id) handleUpdateServiceType(editingServiceType)
                                            else handleCreateServiceType(editingServiceType)
                                        }}
                                        disabled={stSaving}
                                        className="flex-1 py-2 rounded-lg text-xs font-bold th-heading transition-all disabled:opacity-50"
                                        style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
                                        {stSaving ? 'Salvataggio...' : editingServiceType.id ? '✓ Salva Modifiche' : '✓ Crea Tipo'}
                                    </button>
                                    <button onClick={() => setEditingServiceType(null)}
                                        className="px-4 py-2 rounded-lg text-xs font-semibold transition-all"
                                        style={{ background: 'var(--color-surface-200)', color: 'var(--color-surface-400)' }}>
                                        Annulla
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <button
                                onClick={() => setEditingServiceType({ name: '', duration_minutes: 30, color: '#6366f1', description: '' })}
                                className="w-full py-2.5 rounded-xl font-bold text-sm transition-all hover:scale-[1.01] flex items-center justify-center gap-2 th-heading"
                                style={{ background: 'var(--color-surface-100)', border: '1px dashed var(--color-surface-300)' }}>
                                <Plus className="w-4 h-4" /> Aggiungi Tipo
                            </button>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}
