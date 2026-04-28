import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { sendBookingConfirmation, sendBookingNotificationToCloser } from '@/lib/email'
import { getGoogleCalendarFreeBusy, getGoogleCalendarEvents, createGoogleCalendarEvent, deleteGoogleCalendarEvent } from '@/lib/google-calendar'

async function getContext(supabase: any) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null
    const { data: member } = await supabase
        .from('organization_members')
        .select('organization_id, role, department, user_id')
        .eq('user_id', user.id)
        .is('deactivated_at', null)
        .single()
    return member ? { ...member, auth_user_id: user.id } : null
}

// GET: List events or available slots
export async function GET(req: NextRequest) {
    const supabase = await createClient()
    const ctx = await getContext(supabase)
    if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const action = searchParams.get('action') || 'events'
    const from = searchParams.get('from') // ISO date
    const to = searchParams.get('to') // ISO date
    const closerId = searchParams.get('closer_id')

    if (action === 'service_types') {
        const includeInactive = searchParams.get('include_inactive') === 'true'
        let query = supabase
            .from('calendar_service_types')
            .select('*')
            .eq('organization_id', ctx.organization_id)
            .order('position', { ascending: true })
        if (!includeInactive) query = query.eq('is_active', true)
        const { data, error } = await query
        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
        return NextResponse.json({ service_types: data || [] })
    }

    if (action === 'events') {
        let query = supabase
            .from('calendar_events')
            .select('*, leads:lead_id(name, phone, email), service_type:service_type_id(id, name, duration_minutes, color)')
            .eq('organization_id', ctx.organization_id)
            .neq('status', 'cancelled')
            .order('start_time', { ascending: true })

        if (from) query = query.gte('start_time', from)
        if (to) query = query.lte('start_time', to)
        if (closerId) query = query.eq('closer_id', closerId)

        // Setter sees only their own booking events
        if (ctx.role === 'setter') {
            query = query.eq('setter_id', ctx.auth_user_id)
        }
        // Closer sees only their own calendar
        if (ctx.role === 'closer') {
            query = query.eq('closer_id', ctx.auth_user_id)
        }

        const { data, error } = await query
        if (error) return NextResponse.json({ error: error.message }, { status: 500 })

        // Enrich with closer/setter names — fetch members + profiles separately (FK embed is unreliable)
        const { data: members } = await supabase
            .from('organization_members')
            .select('user_id, role, department, display_color')
            .eq('organization_id', ctx.organization_id)
            .is('deactivated_at', null)

        const memberUserIds = (members || []).map((m: any) => m.user_id).filter(Boolean)
        const { data: memberProfiles } = memberUserIds.length > 0 ? await supabase
            .from('profiles')
            .select('id, full_name, email')
            .in('id', memberUserIds) : { data: [] }

        const profileMap: Record<string, any> = {}
        memberProfiles?.forEach((p: any) => { profileMap[p.id] = p })

        const memberMap: Record<string, any> = {}
        members?.forEach((m: any) => {
            const profile = profileMap[m.user_id]
            memberMap[m.user_id] = {
                name: profile?.full_name || profile?.email || 'N/A',
                color: m.display_color || '#3b82f6',
                role: m.role,
            }
        })

        const enriched = (data || []).map((e: any) => ({
            ...e,
            closer_name: memberMap[e.closer_id]?.name || 'N/A',
            closer_color: memberMap[e.closer_id]?.color || '#3b82f6',
            setter_name: e.setter_id ? memberMap[e.setter_id]?.name : null,
        }))

        return NextResponse.json({ events: enriched, members: memberMap })
    }

    if (action === 'slots') {
        // Get available time slots for a specific closer on a date range
        if (!closerId) return NextResponse.json({ error: 'closer_id required' }, { status: 400 })
        if (!from) return NextResponse.json({ error: 'from date required' }, { status: 400 })

        const serviceTypeId = searchParams.get('service_type_id')
        let serviceTypeDuration: number | null = null
        if (serviceTypeId) {
            const { data: st } = await supabase
                .from('calendar_service_types')
                .select('duration_minutes')
                .eq('id', serviceTypeId)
                .single()
            if (st) serviceTypeDuration = st.duration_minutes
        }

        const startDate = new Date(from)
        const endDate = to ? new Date(to) : new Date(startDate.getTime() + 7 * 86400000)

        // 1. Get closer's availability schedule
        let { data: availability } = await supabase
            .from('calendar_availability')
            .select('*')
            .eq('user_id', closerId)
            .eq('organization_id', ctx.organization_id)
            .eq('is_active', true)
            
        // Fallback to Owner's availability if closer has none
        if (!availability || availability.length === 0) {
            const { data: orgOwner } = await supabase
                .from('organization_members')
                .select('user_id')
                .eq('organization_id', ctx.organization_id)
                .eq('role', 'owner')
                .limit(1)

            if (orgOwner && orgOwner.length > 0) {
                const { data: ownerAvailability } = await supabase
                    .from('calendar_availability')
                    .select('*')
                    .eq('user_id', orgOwner[0].user_id)
                    .eq('organization_id', ctx.organization_id)
                    .eq('is_active', true)
                
                if (ownerAvailability && ownerAvailability.length > 0) {
                    availability = ownerAvailability
                }
            }
        }


        // 2. Get existing events for this closer in the date range
        const { data: existingEvents } = await supabase
            .from('calendar_events')
            .select('start_time, end_time')
            .eq('closer_id', closerId)
            .eq('organization_id', ctx.organization_id)
            .neq('status', 'cancelled')
            .gte('start_time', startDate.toISOString())
            .lte('start_time', endDate.toISOString())

        const busySlots = (existingEvents || []).map((e: any) => ({
            start: new Date(e.start_time).getTime(),
            end: new Date(e.end_time).getTime(),
        }))

        // 2.5 Get Google Calendar Free/Busy if connected
        const { data: memberData } = await supabase
            .from('organization_members')
            .select('google_access_token, google_refresh_token, google_token_expiry')
            .eq('user_id', closerId)
            .single()

        let googleBusySlots: { start: number, end: number }[] = []
        if (memberData?.google_access_token) {
            try {
                const gEvents = await getGoogleCalendarFreeBusy(
                    closerId,
                    memberData.google_access_token,
                    memberData.google_refresh_token,
                    memberData.google_token_expiry,
                    startDate.toISOString(),
                    endDate.toISOString()
                )
                googleBusySlots = gEvents.map((e: any) => ({
                    start: new Date(e.start).getTime(),
                    end: new Date(e.end).getTime()
                }))
            } catch (err) {
                console.error('[Calendar API] Error fetching google free/busy:', err)
            }
        }

        const allBusySlots = [...busySlots, ...googleBusySlots]

        // Se non hanno impostato orari su Sincro, creiamo un array 24/7 fittizio.
        // Google Calendar rimuoverà poi le ore "Occupate".
        const effectiveAvailability = (availability && availability.length > 0) ? (availability || []) : [0, 1, 2, 3, 4, 5, 6].map(day => ({
            day_of_week: day,
            start_time: '00:00',
            end_time: '23:59',
            slot_duration_minutes: 45,
            break_between_slots: 0
        }))

        const slots: { date: string; start: string; end: string; available: boolean }[] = []
        const cursor = new Date(startDate)
        cursor.setHours(0, 0, 0, 0)

        while (cursor < endDate) {
            const dayOfWeek = cursor.getDay()
            const dayAvail = effectiveAvailability.find((a: any) => a.day_of_week === dayOfWeek)

            if (dayAvail) {
                const [startH, startM] = dayAvail.start_time.split(':').map(Number)
                const [endH, endM] = dayAvail.end_time.split(':').map(Number)
                const slotDuration = serviceTypeDuration || dayAvail.slot_duration_minutes || 45
                const breakTime = dayAvail.break_between_slots || 0

                // Calculate Italy's offset (+01:00 or +02:00) for the target date to ensure slots are exact
                const italyFormatter = new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Rome', timeZoneName: 'shortOffset' })
                const tzPart = italyFormatter.formatToParts(cursor).find(p => p.type === 'timeZoneName')?.value
                const offsetStr = tzPart === 'GMT+2' ? '+02:00' : '+01:00'

                const cursorDateStr = cursor.toISOString().split('T')[0]

                const isoStart = `${cursorDateStr}T${String(startH).padStart(2, '0')}:${String(startM).padStart(2, '0')}:00${offsetStr}`
                let slotStart = new Date(isoStart)

                const isoEnd = `${cursorDateStr}T${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}:00${offsetStr}`
                const dayEnd = new Date(isoEnd)

                while (slotStart.getTime() + slotDuration * 60000 <= dayEnd.getTime()) {
                    const slotEnd = new Date(slotStart.getTime() + slotDuration * 60000)

                    // Check if slot conflicts with existing events
                    const isOccupied = allBusySlots.some(busy =>
                        slotStart.getTime() < busy.end && slotEnd.getTime() > busy.start
                    )

                    // Don't show past slots
                    const isPast = slotStart.getTime() < Date.now()

                    slots.push({
                        date: cursor.toISOString().split('T')[0],
                        start: slotStart.toISOString(),
                        end: slotEnd.toISOString(),
                        available: !isOccupied && !isPast,
                    })

                    slotStart = new Date(slotEnd.getTime() + breakTime * 60000)
                }
            }

            cursor.setDate(cursor.getDate() + 1)
        }

        return NextResponse.json({ slots })
    }

    if (action === 'auto_slots') {
        if (!from) return NextResponse.json({ error: 'from date required' }, { status: 400 })

        const serviceTypeId = searchParams.get('service_type_id')
        let serviceTypeDuration: number | null = null
        if (serviceTypeId) {
            const { data: st } = await supabase
                .from('calendar_service_types')
                .select('duration_minutes')
                .eq('id', serviceTypeId)
                .single()
            if (st) serviceTypeDuration = st.duration_minutes
        }

        const startDate = new Date(from)
        const endDate = to ? new Date(to) : new Date(startDate.getTime() + 7 * 86400000)

        // Find all active closers in round robin
        const { data: closers } = await supabase
            .from('organization_members')
            .select('user_id, has_availability, in_round_robin')
            .eq('organization_id', ctx.organization_id)
            .is('deactivated_at', null)
            .or('role.eq.closer,and(role.eq.manager,department.eq.sales)')
            
        const activeClosers = (closers || []).filter(c => c.in_round_robin && c.has_availability)
        if (activeClosers.length === 0) return NextResponse.json({ slots: [] })
        
        // Parallel fetch for each closer
        const allSlotsPromises = activeClosers.map(async (closer) => {
            const closerId = closer.user_id
            
            // 1. Get closer's availability schedule
            let { data: availability } = await supabase
                .from('calendar_availability')
                .select('*')
                .eq('user_id', closerId)
                .eq('organization_id', ctx.organization_id)
                .eq('is_active', true)
                
            // Fallback to Owner's availability if closer has none
            if (!availability || availability.length === 0) {
                const { data: orgOwner } = await supabase
                    .from('organization_members')
                    .select('user_id')
                    .eq('organization_id', ctx.organization_id)
                    .eq('role', 'owner')
                    .limit(1)

                if (orgOwner && orgOwner.length > 0) {
                    const { data: ownerAvailability } = await supabase
                        .from('calendar_availability')
                        .select('*')
                        .eq('user_id', orgOwner[0].user_id)
                        .eq('organization_id', ctx.organization_id)
                        .eq('is_active', true)
                    
                    if (ownerAvailability && ownerAvailability.length > 0) {
                        availability = ownerAvailability
                    }
                }
            }

            // 2. Get existing events for this closer in the date range
            const { data: existingEvents } = await supabase
                .from('calendar_events')
                .select('start_time, end_time')
                .eq('closer_id', closerId)
                .eq('organization_id', ctx.organization_id)
                .neq('status', 'cancelled')
                .gte('start_time', startDate.toISOString())
                .lte('start_time', endDate.toISOString())

            const busySlots = (existingEvents || []).map((e: any) => ({
                start: new Date(e.start_time).getTime(),
                end: new Date(e.end_time).getTime(),
            }))

            // 2.5 Get Google Calendar Free/Busy if connected
            const { data: memberData } = await supabase
                .from('organization_members')
                .select('google_access_token, google_refresh_token, google_token_expiry')
                .eq('user_id', closerId)
                .single()

            let googleBusySlots: { start: number, end: number }[] = []
            if (memberData?.google_access_token) {
                try {
                    const gEvents = await getGoogleCalendarFreeBusy(
                        closerId,
                        memberData.google_access_token,
                        memberData.google_refresh_token,
                        memberData.google_token_expiry,
                        startDate.toISOString(),
                        endDate.toISOString()
                    )
                    googleBusySlots = gEvents.map((e: any) => ({
                        start: new Date(e.start).getTime(),
                        end: new Date(e.end).getTime()
                    }))
                } catch (err) {
                    console.error('[Calendar API] Error fetching google free/busy:', err)
                }
            }

            const allBusySlots = [...busySlots, ...googleBusySlots]

            const effectiveAvailability = (availability && availability.length > 0) ? (availability || []) : [0, 1, 2, 3, 4, 5, 6].map(day => ({
                day_of_week: day,
                start_time: '00:00',
                end_time: '23:59',
                slot_duration_minutes: 45,
                break_between_slots: 0
            }))

            const slots: { date: string; start: string; end: string; available: boolean; closer_id: string }[] = []
            const cursor = new Date(startDate)
            cursor.setHours(0, 0, 0, 0)

            while (cursor < endDate) {
                const dayOfWeek = cursor.getDay()
                const dayAvail = effectiveAvailability.find((a: any) => a.day_of_week === dayOfWeek)

                if (dayAvail) {
                    const [startH, startM] = dayAvail.start_time.split(':').map(Number)
                    const [endH, endM] = dayAvail.end_time.split(':').map(Number)
                    const slotDuration = serviceTypeDuration || dayAvail.slot_duration_minutes || 45
                    const breakTime = dayAvail.break_between_slots || 0

                    const italyFormatter = new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Rome', timeZoneName: 'shortOffset' })
                    const tzPart = italyFormatter.formatToParts(cursor).find(p => p.type === 'timeZoneName')?.value
                    const offsetStr = tzPart === 'GMT+2' ? '+02:00' : '+01:00'

                    const cursorDateStr = cursor.toISOString().split('T')[0]

                    const isoStart = `${cursorDateStr}T${String(startH).padStart(2, '0')}:${String(startM).padStart(2, '0')}:00${offsetStr}`
                    let slotStart = new Date(isoStart)

                    const isoEnd = `${cursorDateStr}T${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}:00${offsetStr}`
                    const dayEnd = new Date(isoEnd)

                    while (slotStart.getTime() + slotDuration * 60000 <= dayEnd.getTime()) {
                        const slotEnd = new Date(slotStart.getTime() + slotDuration * 60000)

                        const isOccupied = allBusySlots.some(busy =>
                            slotStart.getTime() < busy.end && slotEnd.getTime() > busy.start
                        )

                        const isPast = slotStart.getTime() < Date.now()
                        
                        if (!isOccupied && !isPast) {
                            slots.push({
                                date: cursor.toISOString().split('T')[0],
                                start: slotStart.toISOString(),
                                end: slotEnd.toISOString(),
                                available: true,
                                closer_id: closerId
                            })
                        }

                        slotStart = new Date(slotEnd.getTime() + breakTime * 60000)
                    }
                }
                cursor.setDate(cursor.getDate() + 1)
            }
            
            return slots
        })
        
        const closersSlots = await Promise.all(allSlotsPromises)
        
        // Merge and dedup by start time
        const allSlots: any[] = []
        for (const slots of closersSlots) {
            for (const s of slots) {
                if (!allSlots.some(existing => existing.start === s.start)) {
                    allSlots.push(s)
                }
            }
        }
        
        allSlots.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
        
        return NextResponse.json({ slots: allSlots })
    }

    if (action === 'closers') {
        // Get all closers with their availability status
        const { data: closers } = await supabase
            .from('organization_members')
            .select('user_id, role, display_color, in_round_robin')
            .eq('organization_id', ctx.organization_id)
            .is('deactivated_at', null)
            .or('role.eq.closer,and(role.eq.manager,department.eq.sales)')

        // Fetch profiles separately (no direct FK config mapping to profiles usually available)
        const userIds = (closers || []).map((c: any) => c.user_id).filter(Boolean)
        const { data: profiles } = userIds.length > 0 ? await supabase
            .from('profiles')
            .select('id, full_name, email')
            .in('id', userIds) : { data: [] }
            
        const profileMap: Record<string, any> = {}
        profiles?.forEach((p: any) => { profileMap[p.id] = p })

        const { data: availabilities } = await supabase
            .from('calendar_availability')
            .select('user_id, day_of_week')
            .eq('organization_id', ctx.organization_id)
            .eq('is_active', true)

        const availMap: Record<string, number[]> = {}
        availabilities?.forEach((a: any) => {
            if (!availMap[a.user_id]) availMap[a.user_id] = []
            availMap[a.user_id].push(a.day_of_week)
        })

        // Get Google Calendar connection status
        const { data: googleTokens } = await supabase
            .from('organization_members')
            .select('user_id, google_access_token')
            .eq('organization_id', ctx.organization_id)
            .in('role', ['closer', 'owner', 'admin', 'manager', 'coach'])
            .is('deactivated_at', null)

        const googleConnectedSet = new Set(
            (googleTokens || []).filter((t: any) => t.google_access_token).map((t: any) => t.user_id)
        )

        const result = (closers || [])
            .map((c: any) => {
                const profile = profileMap[c.user_id]
                return {
                    user_id: c.user_id,
                    name: profile?.full_name || profile?.email || 'N/A',
                    color: c.display_color || '#3b82f6',
                    available_days: availMap[c.user_id] || [],
                    has_availability: true, // Forzato true: usiamo fallback 24/7 se vuoto, la dipendenza netta è GCal
                    google_connected: googleConnectedSet.has(c.user_id),
                    in_round_robin: c.in_round_robin !== false, // Defaults to true
                }
            })

        return NextResponse.json({ closers: result })
    }



    if (action === 'availability') {
        // Get availability config for a user
        const targetUserId = searchParams.get('user_id') || ctx.auth_user_id
        const { data, error } = await supabase
            .from('calendar_availability')
            .select('*')
            .eq('user_id', targetUserId)
            .eq('organization_id', ctx.organization_id)
            .order('day_of_week')

        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
        return NextResponse.json({ availability: data })
    }

    if (action === 'google_events') {
        // Get actual Google Calendar events for display (bidirectional sync)
        const userIds = searchParams.get('user_ids')?.split(',') || []
        if (userIds.length === 0 || !from || !to) {
            return NextResponse.json({ google_events: {} })
        }

        const { data: tokens } = await supabase
            .from('organization_members')
            .select('user_id, google_access_token, google_refresh_token, google_token_expiry')
            .eq('organization_id', ctx.organization_id)
            .in('user_id', userIds)

        const result: Record<string, any[]> = {}

        for (const uid of userIds) {
            result[uid] = []
            const token = tokens?.find((t: any) => t.user_id === uid)
            if (!token?.google_access_token) continue

            try {
                const events = await getGoogleCalendarEvents(
                    uid,
                    token.google_access_token,
                    token.google_refresh_token,
                    token.google_token_expiry,
                    from,
                    to
                )
                result[uid] = events

                // --- CALENDAR RECONCILIATION (JIT SYNC) ---
                // Sync deletions or reschedules made directly in Google Calendar back to Sincro
                const { data: dbEvents } = await supabase
                    .from('calendar_events')
                    .select('id, start_time, end_time')
                    .eq('closer_id', uid)
                    .neq('status', 'cancelled')
                    .gte('start_time', from)
                    .lte('start_time', to)

                if (dbEvents && dbEvents.length > 0) {
                    for (const dbEvent of dbEvents) {
                        const googleMatch = events.find((g: any) => g.extendedProperties?.private?.sincro_event_id === dbEvent.id)
                        if (!googleMatch) {
                            // Event was deleted in Google Calendar. Let's cancel it in Sincro so the slot opens up.
                            await supabase.from('calendar_events').update({ status: 'cancelled' }).eq('id', dbEvent.id)
                        } else {
                            // Verify if it was rescheduled on Google Calendar
                            const gStart = new Date(googleMatch.start).toISOString()
                            const gEnd = new Date(googleMatch.end).getTime() > new Date(googleMatch.start).getTime() 
                                            ? new Date(googleMatch.end).toISOString() 
                                            : new Date(new Date(googleMatch.start).getTime() + 45*60000).toISOString()
                            
                            if (new Date(dbEvent.start_time).getTime() !== new Date(gStart).getTime() || 
                                new Date(dbEvent.end_time).getTime() !== new Date(gEnd).getTime()) {
                                await supabase.from('calendar_events').update({ 
                                    start_time: gStart, 
                                    end_time: gEnd 
                                }).eq('id', dbEvent.id)
                            }
                        }
                    }
                }
                // --- END RECONCILIATION ---

            } catch (err) {
                console.error(`[Calendar API] Failed to get google events for ${uid}`, err)
            }
        }

        return NextResponse.json({ google_events: result })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
}

// POST: Create event (booking) or set availability
export async function POST(req: NextRequest) {
    const supabase = await createClient()
    const ctx = await getContext(supabase)
    if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const { action } = body

    if (action === 'book') {
        const { closer_id, lead_id, start_time, end_time, title, description, lead_phone, lead_email, lead_name, service_type_id } = body

        if (!closer_id || !start_time || !end_time) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
        }

        // Verify slot is still available
        const { data: conflicts } = await supabase
            .from('calendar_events')
            .select('id')
            .eq('closer_id', closer_id)
            .eq('organization_id', ctx.organization_id)
            .neq('status', 'cancelled')
            .lt('start_time', end_time)
            .gt('end_time', start_time)

        if (conflicts && conflicts.length > 0) {
            return NextResponse.json({ error: 'Slot non più disponibile. Seleziona un altro orario.' }, { status: 409 })
        }

        // Cancel previous event if this is a reschedule for the same lead
        let isReschedule = false
        if (lead_id) {
            const { data: previousEvents } = await supabase
                .from('calendar_events')
                .select('id, closer_id, start_time, google_event_id')
                .eq('lead_id', lead_id)
                .eq('status', 'confirmed')

            if (previousEvents && previousEvents.length > 0) {
                isReschedule = true
                for (const oldEv of previousEvents) {
                    await supabase.from('calendar_events').update({ status: 'cancelled' }).eq('id', oldEv.id)
                    
                    const { data: closerTokenData } = await supabase
                        .from('organization_members')
                        .select('google_access_token, google_refresh_token, google_token_expiry')
                        .eq('user_id', oldEv.closer_id)
                        .single()

                    if (closerTokenData?.google_access_token) {
                        try {
                            if (oldEv.google_event_id) {
                                // Primary: use stored Google event ID (reliable)
                                await deleteGoogleCalendarEvent(
                                    oldEv.closer_id, closerTokenData.google_access_token, closerTokenData.google_refresh_token, closerTokenData.google_token_expiry,
                                    oldEv.google_event_id
                                )
                            } else {
                                // Fallback: search by extendedProperties or time match (pre-fix events)
                                const dStart = new Date(oldEv.start_time)
                                dStart.setHours(0,0,0,0)
                                const dEnd = new Date(oldEv.start_time)
                                dEnd.setHours(23,59,59,999)
                                
                                const gEvents = await getGoogleCalendarEvents(
                                    oldEv.closer_id, closerTokenData.google_access_token, closerTokenData.google_refresh_token, closerTokenData.google_token_expiry,
                                    dStart.toISOString(), dEnd.toISOString()
                                )
                                const match = gEvents.find((g:any) => 
                                    g.extendedProperties?.private?.sincro_event_id === oldEv.id || 
                                    (new Date(g.start).getTime() === new Date(oldEv.start_time).getTime() && g.summary.includes('Appuntamento'))
                                )
                                if (match) {
                                    await deleteGoogleCalendarEvent(
                                        oldEv.closer_id, closerTokenData.google_access_token, closerTokenData.google_refresh_token, closerTokenData.google_token_expiry,
                                        match.id
                                    )
                                }
                            }
                        } catch (e) {
                            console.error('[Calendar API] Failed to delete old google event', e)
                        }
                    }
                }
            }
        }

        const baseTitle = title || 'Appuntamento'
        const finalTitle = isReschedule && !baseTitle.includes('[RIPROGRAMMATO]') ? `[RIPROGRAMMATO] ${baseTitle}` : baseTitle

        const { data: event, error } = await supabase
            .from('calendar_events')
            .insert({
                organization_id: ctx.organization_id,
                closer_id,
                setter_id: ctx.auth_user_id,
                lead_id: lead_id || null,
                title: finalTitle,
                description,
                lead_phone,
                lead_email,
                start_time,
                end_time,
                status: 'confirmed',
                service_type_id: service_type_id || null,
            })
            .select()
            .single()

        if (error) return NextResponse.json({ error: error.message }, { status: 500 })

        const google_description = `${description || body.notes || 'Appuntamento Sincro'}

— Dettagli Cliente —
Nome: ${lead_name || 'Non specificato'}
Email: ${lead_email || 'Non specificato'}
Telefono: ${lead_phone || 'Non specificato'}
`.trim()

        // Create Google Calendar event if the closer is connected
        const { data: closerTokenData } = await supabase
            .from('organization_members')
            .select('google_access_token, google_refresh_token, google_token_expiry')
            .eq('user_id', closer_id)
            .single()

        if (closerTokenData?.google_access_token) {
            try {
                const attendees = lead_email ? [{ email: lead_email }] : []
                const gCalResult = await createGoogleCalendarEvent(
                    closer_id,
                    closerTokenData.google_access_token,
                    closerTokenData.google_refresh_token,
                    closerTokenData.google_token_expiry,
                    {
                        summary: finalTitle,
                        description: google_description,
                        start: start_time,
                        end: end_time,
                        attendees,
                        extendedProperties: { private: { sincro_event_id: event.id } }
                    }
                )
                // Save the Google event ID for reliable deletion later
                if (gCalResult?.id) {
                    await supabase.from('calendar_events').update({ google_event_id: gCalResult.id }).eq('id', event.id)
                }
            } catch (err) {
                console.error('[Calendar API] Failed to push to Google Calendar', err)
            }
        }

        // Update lead stage and assignments
        if (lead_id) {
            const updatePayload: any = {
                closer_id: closer_id,
                setter_id: ctx.auth_user_id,
                updated_at: new Date().toISOString()
            }

            const { data: stages } = await supabase
                .from('pipeline_stages')
                .select('id, slug, fire_capi_event')
                .eq('organization_id', ctx.organization_id)
                .ilike('slug', '%appuntamento%')
                .limit(1)

            let leadObj: any = null;
            if (stages && stages.length > 0) {
                const { data: lead } = await supabase.from('leads').select('stage_id').eq('id', lead_id).single()
                leadObj = lead;
                updatePayload.stage_id = stages[0].id;
            }

            await supabase.from('leads').update(updatePayload).eq('id', lead_id)

            // Log activity for stage change
            if (stages && stages.length > 0 && leadObj && leadObj.stage_id !== stages[0].id) {
                try {
                    await supabase.from('lead_activities').insert({
                        organization_id: ctx.organization_id,
                        lead_id: lead_id,
                        activity_type: 'stage_changed',
                        from_stage_id: leadObj.stage_id,
                        to_stage_id: stages[0].id,
                        notes: `📅 Appuntamento prenotato — spostato automaticamente`,
                    })
                } catch { /* best effort */ }
            }

            // Fire CAPI event directly (don't delegate to PUT /api/leads which requires session auth)
            if (stages && stages.length > 0 && stages[0].fire_capi_event && leadObj && leadObj.stage_id !== stages[0].id) {
                try {
                    await fetch(new URL('/api/leads', req.url).toString(), {
                        method: 'PUT',
                        headers: { 
                            'Content-Type': 'application/json',
                            'Cookie': req.headers.get('cookie') || ''
                        },
                        body: JSON.stringify({
                            id: lead_id,
                            stage_id: stages[0].id,
                            _old_stage_id: leadObj.stage_id,
                        }),
                    })
                } catch (err) {
                    console.error('[Calendar book] CAPI delegation failed:', err)
                }
            }
        }

        // Send email notifications (best effort, non-blocking)
        const startDt = new Date(start_time)
        const endDt = new Date(end_time)
        const dateFormatted = startDt.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
        const timeFormatted = `${startDt.getHours().toString().padStart(2,'0')}:${startDt.getMinutes().toString().padStart(2,'0')} — ${endDt.getHours().toString().padStart(2,'0')}:${endDt.getMinutes().toString().padStart(2,'0')}`

        // Get closer info for email
        const { data: closerMember } = await supabase
            .from('organization_members')
            .select('profiles:user_id(full_name, email)')
            .eq('user_id', closer_id)
            .single()
        const closerName = (closerMember?.profiles as any)?.full_name || 'Il tuo consulente'
        const closerEmail = (closerMember?.profiles as any)?.email

        // Get setter name
        const { data: setterMember } = await supabase
            .from('organization_members')
            .select('profiles:user_id(full_name)')
            .eq('user_id', ctx.auth_user_id)
            .single()
        const setterName = (setterMember?.profiles as any)?.full_name || null

        const leadDisplayName = description?.replace('Lead: ', '').split('\n')[0] || title || 'Cliente'

        // Email to lead (if email provided)
        // Disabilitata su richiesta per la fase test: demandata a GoHighLevel per non creare duplicati
        /*
        if (lead_email) {
            sendBookingConfirmation({
                to: lead_email,
                leadName: leadDisplayName,
                closerName,
                date: dateFormatted,
                time: timeFormatted,
                phone: lead_phone,
            }).catch(() => {})
        }
        */

        // Email to closer
        if (closerEmail) {
            sendBookingNotificationToCloser({
                to: closerEmail,
                closerName,
                leadName: leadDisplayName,
                leadPhone: lead_phone,
                leadEmail: lead_email,
                date: dateFormatted,
                time: timeFormatted,
                setterName,
            }).catch(() => {})
        }

        return NextResponse.json({ event, message: 'Appuntamento creato con successo' })
    }

    if (action === 'auto_book') {
        // Auto-assign closer based on round-robin, performance, or availability
        const { start_time, end_time, title, description, lead_phone, lead_email, lead_id, lead_name, assignment_mode, service_type_id } = body

        if (!start_time || !end_time) {
            return NextResponse.json({ error: 'start_time e end_time richiesti' }, { status: 400 })
        }

        // Only setters, admin, owner, manager can auto-book
        if (!['setter', 'admin', 'owner', 'manager'].includes(ctx.role)) {
            return NextResponse.json({ error: 'Permesso negato' }, { status: 403 })
        }

        const bookDay = new Date(start_time).getDay()
        const { data: memberClosers } = await supabase
            .from('organization_members')
            .select('user_id')
            .eq('organization_id', ctx.organization_id)
            .is('deactivated_at', null)
            .eq('in_round_robin', true)
            .or('role.eq.closer,and(role.eq.manager,department.eq.sales)')

        if (!memberClosers || memberClosers.length === 0) {
            return NextResponse.json({ error: 'Nessun venditore round-robin disponibile' }, { status: 400 })
        }

        const closerUserIds = [...new Set(memberClosers.map((c: any) => c.user_id))]

        // Check DB conflicts
        const { data: dbConflicts } = await supabase
            .from('calendar_events')
            .select('closer_id')
            .in('closer_id', closerUserIds)
            .eq('organization_id', ctx.organization_id)
            .neq('status', 'cancelled')
            .lt('start_time', end_time)
            .gt('end_time', start_time)

        const busyDbUsers = new Set((dbConflicts || []).map((e: any) => e.closer_id))
        let candidates = closerUserIds.filter(uid => !busyDbUsers.has(uid))

        // Check Google Calendar conflicts
        const { data: tokens } = await supabase
            .from('organization_members')
            .select('user_id, google_access_token, google_refresh_token, google_token_expiry')
            .in('user_id', candidates)

        const fullyAvailable: string[] = []
        for (const uid of candidates) {
            const token = tokens?.find((t: any) => t.user_id === uid)
            if (token?.google_access_token) {
                try {
                    const gBusy = await getGoogleCalendarFreeBusy(
                        uid, token.google_access_token, token.google_refresh_token,
                        token.google_token_expiry, start_time, end_time
                    )
                    const isBusy = gBusy.some((b: any) => {
                        const bs = new Date(b.start).getTime()
                        const be = new Date(b.end).getTime()
                        return bs < new Date(end_time).getTime() && be > new Date(start_time).getTime()
                    })
                    if (!isBusy) fullyAvailable.push(uid)
                } catch {
                    fullyAvailable.push(uid) // If Google check fails, assume available
                }
            } else {
                fullyAvailable.push(uid) // No Google connected = trust DB only
            }
        }

        if (fullyAvailable.length === 0) {
            return NextResponse.json({ error: 'Nessun venditore disponibile per questo slot' }, { status: 409 })
        }

        // Get current system setting for calendar assignment
        const { data: orgConfig } = await supabase
            .from('organization_config')
            .select('round_robin_calendar_index, calendar_assignment_mode')
            .eq('organization_id', ctx.organization_id)
            .single()

        // Select based on assignment mode
        let selectedCloserId: string
        const mode = orgConfig?.calendar_assignment_mode || assignment_mode || 'round_robin'

        if (mode === 'round_robin') {
            const currentIndex = orgConfig?.round_robin_calendar_index || 0
            const selectedIndex = currentIndex % fullyAvailable.length
            selectedCloserId = fullyAvailable[selectedIndex]

            // Update round-robin index
            await supabase
                .from('organization_config')
                .upsert({
                    organization_id: ctx.organization_id,
                    round_robin_calendar_index: currentIndex + 1,
                }, { onConflict: 'organization_id' })

        } else if (mode === 'performance') {
            // Best performer = most completions
            let perfQuery = supabase
                .from('calendar_events')
                .select('closer_id')
                .eq('organization_id', ctx.organization_id)
                .eq('status', 'completed')
            
            const { data: stats } = await perfQuery

            const countMap: Record<string, number> = {}
            ;(stats || []).forEach((s: any) => {
                if (fullyAvailable.includes(s.closer_id)) {
                    countMap[s.closer_id] = (countMap[s.closer_id] || 0) + 1
                }
            })

            // Sort by completed events (highest first)
            fullyAvailable.sort((a, b) => (countMap[b] || 0) - (countMap[a] || 0))
            selectedCloserId = fullyAvailable[0]

        } else {
            // 'availability' mode (load balancing) — least loaded this week
            const weekStart = new Date(start_time)
            weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1)
            weekStart.setHours(0, 0, 0, 0)
            const weekEnd = new Date(weekStart)
            weekEnd.setDate(weekEnd.getDate() + 7)

            const { data: weekEvents } = await supabase
                .from('calendar_events')
                .select('closer_id')
                .eq('organization_id', ctx.organization_id)
                .neq('status', 'cancelled')
                .gte('start_time', weekStart.toISOString())
                .lte('start_time', weekEnd.toISOString())

            const loadMap: Record<string, number> = {}
            ;(weekEvents || []).forEach((e: any) => {
                if (fullyAvailable.includes(e.closer_id)) {
                    loadMap[e.closer_id] = (loadMap[e.closer_id] || 0) + 1
                }
            })

            // Sort by least loaded
            fullyAvailable.sort((a, b) => (loadMap[a] || 0) - (loadMap[b] || 0))
            selectedCloserId = fullyAvailable[0]
        }

        // Cancel previous event if this is a reschedule for the same lead
        let isReschedule = false
        if (lead_id) {
            const { data: previousEvents } = await supabase
                .from('calendar_events')
                .select('id, closer_id, start_time, google_event_id')
                .eq('lead_id', lead_id)
                .eq('status', 'confirmed')

            if (previousEvents && previousEvents.length > 0) {
                isReschedule = true
                for (const oldEv of previousEvents) {
                    await supabase.from('calendar_events').update({ status: 'cancelled' }).eq('id', oldEv.id)

                    const { data: closerTokenData } = await supabase
                        .from('organization_members')
                        .select('google_access_token, google_refresh_token, google_token_expiry')
                        .eq('user_id', oldEv.closer_id)
                        .single()

                    if (closerTokenData?.google_access_token) {
                        try {
                            if (oldEv.google_event_id) {
                                // Primary: use stored Google event ID (reliable)
                                await deleteGoogleCalendarEvent(
                                    oldEv.closer_id, closerTokenData.google_access_token, closerTokenData.google_refresh_token, closerTokenData.google_token_expiry,
                                    oldEv.google_event_id
                                )
                            } else {
                                // Fallback: search by extendedProperties or time match (pre-fix events)
                                const dStart = new Date(oldEv.start_time)
                                dStart.setHours(0,0,0,0)
                                const dEnd = new Date(oldEv.start_time)
                                dEnd.setHours(23,59,59,999)
                                
                                const gEvents = await getGoogleCalendarEvents(
                                    oldEv.closer_id, closerTokenData.google_access_token, closerTokenData.google_refresh_token, closerTokenData.google_token_expiry,
                                    dStart.toISOString(), dEnd.toISOString()
                                )
                                const match = gEvents.find((g:any) => 
                                    g.extendedProperties?.private?.sincro_event_id === oldEv.id || 
                                    (new Date(g.start).getTime() === new Date(oldEv.start_time).getTime() && g.summary.includes('Appuntamento'))
                                )
                                if (match) {
                                    await deleteGoogleCalendarEvent(
                                        oldEv.closer_id, closerTokenData.google_access_token, closerTokenData.google_refresh_token, closerTokenData.google_token_expiry,
                                        match.id
                                    )
                                }
                            }
                        } catch (e) {
                            console.error('[Calendar API] Failed to delete old google event', e)
                        }
                    }
                }
            }
        }

        const baseTitle = title || 'Appuntamento'
        const finalTitle = isReschedule && !baseTitle.includes('[RIPROGRAMMATO]') ? `[RIPROGRAMMATO] ${baseTitle}` : baseTitle

        // Create the event
        const { data: event, error: eventError } = await supabase
            .from('calendar_events')
            .insert({
                organization_id: ctx.organization_id,
                closer_id: selectedCloserId,
                setter_id: ctx.auth_user_id,
                lead_id: lead_id || null,
                title: finalTitle,
                description: description || (lead_name ? `Lead: ${lead_name}` : ''),
                lead_phone,
                lead_email,
                start_time,
                end_time,
                status: 'confirmed',
                source: 'internal',
                service_type_id: service_type_id || null,
            })
            .select()
            .single()

        if (eventError) return NextResponse.json({ error: eventError.message }, { status: 500 })

        const google_description = `${description || body.notes || 'Appuntamento Sincro'}

— Dettagli Cliente —
Nome: ${lead_name || 'Non specificato'}
Email: ${lead_email || 'Non specificato'}
Telefono: ${lead_phone || 'Non specificato'}
`.trim()

        // Push to Google Calendar
        const closerToken = tokens?.find((t: any) => t.user_id === selectedCloserId)
        if (closerToken?.google_access_token) {
            try {
                const attendees = lead_email ? [{ email: lead_email }] : []
                const gCalResult = await createGoogleCalendarEvent(
                    selectedCloserId,
                    closerToken.google_access_token,
                    closerToken.google_refresh_token,
                    closerToken.google_token_expiry,
                    {
                        summary: finalTitle,
                        description: google_description,
                        start: start_time,
                        end: end_time,
                        attendees,
                        extendedProperties: { private: { sincro_event_id: event.id } }
                    }
                )
                // Save the Google event ID for reliable deletion later
                if (gCalResult?.id) {
                    await supabase.from('calendar_events').update({ google_event_id: gCalResult.id }).eq('id', event.id)
                }
            } catch (err) {
                console.error('[Calendar API] Failed to push auto_book to Google Calendar', err)
            }
        }

        // Update lead stage and assignments
        if (lead_id) {
            const updatePayload: any = {
                closer_id: selectedCloserId,
                setter_id: ctx.auth_user_id,
                updated_at: new Date().toISOString()
            }

            const { data: stages } = await supabase
                .from('pipeline_stages')
                .select('id, slug, fire_capi_event')
                .eq('organization_id', ctx.organization_id)
                .or('slug.ilike.%appunt%,name.ilike.%appunt%')
                .limit(1)

            let leadObj: any = null;
            if (stages && stages.length > 0) {
                const { data: lead } = await supabase.from('leads').select('stage_id').eq('id', lead_id).single()
                leadObj = lead;
                updatePayload.stage_id = stages[0].id;
            }

            await supabase.from('leads').update(updatePayload).eq('id', lead_id)

            // Log activity for stage change
            if (stages && stages.length > 0 && leadObj && leadObj.stage_id !== stages[0].id) {
                try {
                    await supabase.from('lead_activities').insert({
                        organization_id: ctx.organization_id,
                        lead_id: lead_id,
                        activity_type: 'stage_changed',
                        from_stage_id: leadObj.stage_id,
                        to_stage_id: stages[0].id,
                        notes: `📅 Appuntamento auto-assegnato — spostato automaticamente`,
                    })
                } catch { /* best effort */ }
            }

            // Fire CAPI event via leads route (keeps CAPI logic centralized)
            if (stages && stages.length > 0 && stages[0].fire_capi_event && leadObj && leadObj.stage_id !== stages[0].id) {
                try {
                    await fetch(new URL('/api/leads', req.url).toString(), {
                        method: 'PUT',
                        headers: { 
                            'Content-Type': 'application/json',
                            'Cookie': req.headers.get('cookie') || ''
                        },
                        body: JSON.stringify({
                            id: lead_id,
                            stage_id: stages[0].id,
                            _old_stage_id: leadObj.stage_id,
                        }),
                    })
                } catch (err) {
                    console.error('[Calendar auto_book] CAPI delegation failed:', err)
                }
            }
        }

        // Get closer name for response
        const { data: closerInfo } = await supabase
            .from('organization_members')
            .select('profiles:user_id(full_name, email)')
            .eq('user_id', selectedCloserId)
            .single()

        const closerName = (closerInfo?.profiles as any)?.full_name || 'N/A'
        const closerEmail = (closerInfo?.profiles as any)?.email

        // Email notification to closer
        if (closerEmail) {
            const startDt = new Date(start_time)
            const endDt = new Date(end_time)
            const dateFormatted = startDt.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
            const timeFormatted = `${startDt.getHours().toString().padStart(2,'0')}:${startDt.getMinutes().toString().padStart(2,'0')} — ${endDt.getHours().toString().padStart(2,'0')}:${endDt.getMinutes().toString().padStart(2,'0')}`

            const { data: setterInfo } = await supabase
                .from('organization_members')
                .select('profiles:user_id(full_name)')
                .eq('user_id', ctx.auth_user_id)
                .single()

            sendBookingNotificationToCloser({
                to: closerEmail,
                closerName,
                leadName: lead_name || title || 'Cliente',
                leadPhone: lead_phone,
                leadEmail: lead_email,
                date: dateFormatted,
                time: timeFormatted,
                setterName: (setterInfo?.profiles as any)?.full_name || null,
            }).catch(() => {})
        }

        return NextResponse.json({
            event,
            assigned_to: closerName,
            assignment_mode: mode,
            message: `Appuntamento assegnato a ${closerName} (${mode})`
        })
    }

    if (action === 'set_availability') {
        const { schedules } = body // Array of { day_of_week, start_time, end_time, slot_duration_minutes }
        const targetUserId = body.user_id || ctx.auth_user_id

        // Only allow setting own availability (or admin/owner can set for anyone)
        if (targetUserId !== ctx.auth_user_id && ctx.role !== 'owner' && ctx.role !== 'admin') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

        // Delete existing and re-insert
        await supabase
            .from('calendar_availability')
            .delete()
            .eq('user_id', targetUserId)
            .eq('organization_id', ctx.organization_id)

        if (schedules && schedules.length > 0) {
            const rows = schedules.map((s: any) => ({
                organization_id: ctx.organization_id,
                user_id: targetUserId,
                day_of_week: s.day_of_week,
                start_time: s.start_time,
                end_time: s.end_time,
                slot_duration_minutes: s.slot_duration_minutes || 45,
                break_between_slots: s.break_between_slots || 0,
                is_active: true,
            }))

            const { error } = await supabase
                .from('calendar_availability')
                .insert(rows)

            if (error) return NextResponse.json({ error: error.message }, { status: 500 })
        }

        return NextResponse.json({ success: true, message: 'Disponibilità aggiornata' })
    }
    if (action === 'toggle_rr') {
        const { target_user_id, in_round_robin } = body
        if (!target_user_id) return NextResponse.json({ error: 'Missing target_user_id' }, { status: 400 })

        // Only allow admins/owners/managers to change this
        const { data: caller } = await supabase
            .from('organization_members')
            .select('role')
            .eq('user_id', ctx.auth_user_id)
            .eq('organization_id', ctx.organization_id)
            .single()

        if (!['admin', 'owner', 'manager'].includes(caller?.role)) {
            return NextResponse.json({ error: 'Unauthorized to change RR rules' }, { status: 403 })
        }

        const { error: updErr } = await supabase
            .from('organization_members')
            .update({ in_round_robin })
            .eq('user_id', target_user_id)
            .eq('organization_id', ctx.organization_id)

        if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 })
        return NextResponse.json({ success: true, in_round_robin })
    }

    // ═══ SERVICE TYPES CRUD ═══
    if (action === 'create_service_type') {
        if (!['owner', 'admin'].includes(ctx.role)) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }
        const { name, duration_minutes, color, description: desc } = body
        if (!name || !duration_minutes) {
            return NextResponse.json({ error: 'name e duration_minutes richiesti' }, { status: 400 })
        }
        const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
        
        // Check if slug already exists (possibly inactive) and reactivate it
        const { data: existing } = await supabase
            .from('calendar_service_types')
            .select('id')
            .eq('organization_id', ctx.organization_id)
            .eq('slug', slug)
            .single()
        
        if (existing) {
            // Reactivate and update existing
            const { data, error } = await supabase
                .from('calendar_service_types')
                .update({ name, duration_minutes, color: color || '#6366f1', description: desc || null, is_active: true })
                .eq('id', existing.id)
                .select()
                .single()
            if (error) return NextResponse.json({ error: error.message }, { status: 500 })
            return NextResponse.json({ service_type: data })
        }
        
        const { data, error } = await supabase
            .from('calendar_service_types')
            .insert({
                organization_id: ctx.organization_id,
                name,
                slug,
                duration_minutes,
                color: color || '#6366f1',
                description: desc || null,
                is_active: true,
            })
            .select()
            .single()
        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
        return NextResponse.json({ service_type: data })
    }

    if (action === 'update_service_type') {
        if (!['owner', 'admin'].includes(ctx.role)) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }
        const { id, name, duration_minutes, color, description: desc, is_active } = body
        if (!id) return NextResponse.json({ error: 'id richiesto' }, { status: 400 })
        const updateData: any = {}
        if (name !== undefined) {
            updateData.name = name
            updateData.slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
        }
        if (duration_minutes !== undefined) updateData.duration_minutes = duration_minutes
        if (color !== undefined) updateData.color = color
        if (desc !== undefined) updateData.description = desc
        if (is_active !== undefined) updateData.is_active = is_active
        const { data, error } = await supabase
            .from('calendar_service_types')
            .update(updateData)
            .eq('id', id)
            .eq('organization_id', ctx.organization_id)
            .select()
            .single()
        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
        return NextResponse.json({ service_type: data })
    }

    if (action === 'delete_service_type') {
        if (!['owner', 'admin'].includes(ctx.role)) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }
        const { id } = body
        if (!id) return NextResponse.json({ error: 'id richiesto' }, { status: 400 })
        const { error } = await supabase
            .from('calendar_service_types')
            .delete()
            .eq('id', id)
            .eq('organization_id', ctx.organization_id)
        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
        return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
}

// PATCH: Update event status
export async function PATCH(req: NextRequest) {
    const supabase = await createClient()
    const ctx = await getContext(supabase)
    if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const { event_id, status, outcome, outcome_value } = body

    const updateData: any = { updated_at: new Date().toISOString() }
    if (status) updateData.status = status
    if (outcome !== undefined) updateData.outcome = outcome
    if (outcome_value !== undefined) updateData.outcome_value = outcome_value

    // When cancelling, also delete the corresponding Google Calendar event
    if (status === 'cancelled') {
        try {
            // Fetch the event to get google_event_id and closer_id
            const { data: existingEvent } = await supabase
                .from('calendar_events')
                .select('id, closer_id, google_event_id, start_time')
                .eq('id', event_id)
                .eq('organization_id', ctx.organization_id)
                .single()

            if (existingEvent?.closer_id) {
                const { data: closerTokenData } = await supabase
                    .from('organization_members')
                    .select('google_access_token, google_refresh_token, google_token_expiry')
                    .eq('user_id', existingEvent.closer_id)
                    .single()

                if (closerTokenData?.google_access_token) {
                    if (existingEvent.google_event_id) {
                        // Direct delete using stored Google event ID (reliable)
                        await deleteGoogleCalendarEvent(
                            existingEvent.closer_id,
                            closerTokenData.google_access_token,
                            closerTokenData.google_refresh_token,
                            closerTokenData.google_token_expiry,
                            existingEvent.google_event_id
                        )
                    } else {
                        // Fallback: search by extendedProperties or time match (for pre-fix events)
                        const dStart = new Date(existingEvent.start_time)
                        dStart.setHours(0, 0, 0, 0)
                        const dEnd = new Date(existingEvent.start_time)
                        dEnd.setHours(23, 59, 59, 999)

                        const gEvents = await getGoogleCalendarEvents(
                            existingEvent.closer_id,
                            closerTokenData.google_access_token,
                            closerTokenData.google_refresh_token,
                            closerTokenData.google_token_expiry,
                            dStart.toISOString(),
                            dEnd.toISOString()
                        )
                        const match = gEvents.find((g: any) =>
                            g.extendedProperties?.private?.sincro_event_id === existingEvent.id ||
                            (new Date(g.start).getTime() === new Date(existingEvent.start_time).getTime() && g.summary?.includes('Appuntamento'))
                        )
                        if (match) {
                            await deleteGoogleCalendarEvent(
                                existingEvent.closer_id,
                                closerTokenData.google_access_token,
                                closerTokenData.google_refresh_token,
                                closerTokenData.google_token_expiry,
                                match.id
                            )
                        }
                    }
                }
            }
        } catch (err) {
            console.error('[Calendar PATCH] Failed to delete Google Calendar event on cancel:', err)
            // Continue with DB update even if Google delete fails
        }
    }

    const { data, error } = await supabase
        .from('calendar_events')
        .update(updateData)
        .eq('id', event_id)
        .eq('organization_id', ctx.organization_id)
        .select()
        .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ event: data })
}

// DELETE: Permanently delete an event
export async function DELETE(req: NextRequest) {
    const supabase = await createClient()
    const ctx = await getContext(supabase)
    if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const { event_id } = body

    if (!event_id) return NextResponse.json({ error: 'event_id required' }, { status: 400 })

    // Fetch the event before deleting to get Google Calendar info
    const { data: existingEvent } = await supabase
        .from('calendar_events')
        .select('id, closer_id, google_event_id, start_time')
        .eq('id', event_id)
        .eq('organization_id', ctx.organization_id)
        .single()

    if (!existingEvent) {
        return NextResponse.json({ error: 'Evento non trovato' }, { status: 404 })
    }

    // Permission: owner/admin can delete any, closer can delete their own
    const isOwnerAdmin = ['owner', 'admin'].includes(ctx.role)
    const isOwnEvent = existingEvent.closer_id === ctx.auth_user_id
    if (!isOwnerAdmin && !isOwnEvent) {
        return NextResponse.json({ error: 'Non hai i permessi per eliminare questo appuntamento' }, { status: 403 })
    }

    // Delete from Google Calendar first
    if (existingEvent.closer_id) {
        try {
            const { data: closerTokenData } = await supabase
                .from('organization_members')
                .select('google_access_token, google_refresh_token, google_token_expiry')
                .eq('user_id', existingEvent.closer_id)
                .single()

            if (closerTokenData?.google_access_token) {
                if (existingEvent.google_event_id) {
                    await deleteGoogleCalendarEvent(
                        existingEvent.closer_id,
                        closerTokenData.google_access_token,
                        closerTokenData.google_refresh_token,
                        closerTokenData.google_token_expiry,
                        existingEvent.google_event_id
                    )
                } else {
                    // Fallback search for pre-fix events
                    const dStart = new Date(existingEvent.start_time)
                    dStart.setHours(0, 0, 0, 0)
                    const dEnd = new Date(existingEvent.start_time)
                    dEnd.setHours(23, 59, 59, 999)

                    const gEvents = await getGoogleCalendarEvents(
                        existingEvent.closer_id,
                        closerTokenData.google_access_token,
                        closerTokenData.google_refresh_token,
                        closerTokenData.google_token_expiry,
                        dStart.toISOString(),
                        dEnd.toISOString()
                    )
                    const match = gEvents.find((g: any) =>
                        g.extendedProperties?.private?.sincro_event_id === existingEvent.id ||
                        (new Date(g.start).getTime() === new Date(existingEvent.start_time).getTime() && g.summary?.includes('Appuntamento'))
                    )
                    if (match) {
                        await deleteGoogleCalendarEvent(
                            existingEvent.closer_id,
                            closerTokenData.google_access_token,
                            closerTokenData.google_refresh_token,
                            closerTokenData.google_token_expiry,
                            match.id
                        )
                    }
                }
            }
        } catch (err) {
            console.error('[Calendar DELETE] Failed to delete Google Calendar event:', err)
        }
    }

    // Delete from DB
    const { error } = await supabase
        .from('calendar_events')
        .delete()
        .eq('id', event_id)
        .eq('organization_id', ctx.organization_id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true, message: 'Appuntamento cancellato definitivamente' })
}
