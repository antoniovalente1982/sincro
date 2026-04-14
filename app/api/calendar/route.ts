import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { sendBookingConfirmation, sendBookingNotificationToCloser } from '@/lib/email'
import { getGoogleCalendarFreeBusy, getGoogleCalendarEvents, createGoogleCalendarEvent } from '@/lib/google-calendar'

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

    if (action === 'events') {
        let query = supabase
            .from('calendar_events')
            .select('*, leads:lead_id(name, phone, email)')
            .eq('organization_id', ctx.organization_id)
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

        // Enrich with closer/setter names
        const { data: members } = await supabase
            .from('organization_members')
            .select('user_id, role, department, display_color, profiles:user_id(full_name, email)')
            .eq('organization_id', ctx.organization_id)
            .is('deactivated_at', null)

        const memberMap: Record<string, any> = {}
        members?.forEach((m: any) => {
            memberMap[m.user_id] = {
                name: m.profiles?.full_name || m.profiles?.email || 'N/A',
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

        const startDate = new Date(from)
        const endDate = to ? new Date(to) : new Date(startDate.getTime() + 7 * 86400000)

        // 1. Get closer's availability schedule
        const { data: availability } = await supabase
            .from('calendar_availability')
            .select('*')
            .eq('user_id', closerId)
            .eq('organization_id', ctx.organization_id)
            .eq('is_active', true)


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
                const slotDuration = dayAvail.slot_duration_minutes || 45
                const breakTime = dayAvail.break_between_slots || 0

                let slotStart = new Date(cursor)
                slotStart.setHours(startH, startM, 0, 0)

                const dayEnd = new Date(cursor)
                dayEnd.setHours(endH, endM, 0, 0)

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
        const { closer_id, lead_id, start_time, end_time, title, description, lead_phone, lead_email } = body

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
        if (lead_id) {
            await supabase.from('calendar_events').update({ status: 'cancelled' }).eq('lead_id', lead_id).eq('status', 'confirmed')
        }

        const { data: event, error } = await supabase
            .from('calendar_events')
            .insert({
                organization_id: ctx.organization_id,
                closer_id,
                setter_id: ctx.auth_user_id,
                lead_id: lead_id || null,
                title: title || 'Appuntamento',
                description,
                lead_phone,
                lead_email,
                start_time,
                end_time,
                status: 'confirmed',
            })
            .select()
            .single()

        if (error) return NextResponse.json({ error: error.message }, { status: 500 })

        // Create Google Calendar event if the closer is connected
        const { data: closerTokenData } = await supabase
            .from('organization_members')
            .select('google_access_token, google_refresh_token, google_token_expiry')
            .eq('user_id', closer_id)
            .single()

        if (closerTokenData?.google_access_token) {
            try {
                const attendees = lead_email ? [{ email: lead_email }] : []
                await createGoogleCalendarEvent(
                    closer_id,
                    closerTokenData.google_access_token,
                    closerTokenData.google_refresh_token,
                    closerTokenData.google_token_expiry,
                    {
                        summary: title || 'Appuntamento via Sincro',
                        description: description || '',
                        start: start_time,
                        end: end_time,
                        attendees
                    }
                )
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

            if (stages && stages.length > 0 && stages[0].fire_capi_event && leadObj) {
                try {
                    await fetch(new URL('/api/leads', req.url).toString(), {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            id: lead_id,
                            stage_id: stages[0].id,
                            _old_stage_id: leadObj.stage_id,
                        }),
                    })
                } catch { /* best effort */ }
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
        const { start_time, end_time, title, description, lead_phone, lead_email, lead_id, lead_name, assignment_mode } = body

        if (!start_time || !end_time) {
            return NextResponse.json({ error: 'start_time e end_time richiesti' }, { status: 400 })
        }

        // Only setters, admin, owner, manager can auto-book
        if (!['setter', 'admin', 'owner', 'manager'].includes(ctx.role)) {
            return NextResponse.json({ error: 'Permesso negato' }, { status: 403 })
        }

        // Get all active closers with availability for this day
        const bookDay = new Date(start_time).getDay()
        const { data: availClosers } = await supabase
            .from('calendar_availability')
            .select('user_id')
            .eq('organization_id', ctx.organization_id)
            .eq('day_of_week', bookDay)
            .eq('is_active', true)

        if (!availClosers || availClosers.length === 0) {
            return NextResponse.json({ error: 'Nessun venditore disponibile per questo giorno' }, { status: 400 })
        }

        const closerUserIds = [...new Set(availClosers.map((a: any) => a.user_id))]

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

        // Select based on assignment mode
        let selectedCloserId: string
        const mode = assignment_mode || 'round_robin'

        if (mode === 'round_robin') {
            // Get current round-robin index from organization config
            const { data: orgConfig } = await supabase
                .from('organization_config')
                .select('round_robin_calendar_index')
                .eq('organization_id', ctx.organization_id)
                .single()

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
            
            // Filter to only available closers
            for (const uid of fullyAvailable) {
                // We'll fetch all and filter in JS to avoid .in() type issues
            }
            const { data: stats } = await perfQuery

            const countMap: Record<string, number> = {}
            ;(stats || []).forEach((s: any) => {
                if (fullyAvailable.includes(s.closer_id)) {
                    countMap[s.closer_id] = (countMap[s.closer_id] || 0) + 1
                }
            })

            // Sort by completed events (highest first), then select highest performer
            fullyAvailable.sort((a, b) => (countMap[b] || 0) - (countMap[a] || 0))
            selectedCloserId = fullyAvailable[0]

        } else {
            // 'availability' mode — least loaded this week
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
        if (lead_id) {
            await supabase.from('calendar_events').update({ status: 'cancelled' }).eq('lead_id', lead_id).eq('status', 'confirmed')
        }

        // Create the event
        const { data: event, error: eventError } = await supabase
            .from('calendar_events')
            .insert({
                organization_id: ctx.organization_id,
                closer_id: selectedCloserId,
                setter_id: ctx.auth_user_id,
                lead_id: lead_id || null,
                title: title || 'Appuntamento',
                description: description || (lead_name ? `Lead: ${lead_name}` : ''),
                lead_phone,
                lead_email,
                start_time,
                end_time,
                status: 'confirmed',
                source: 'internal',
            })
            .select()
            .single()

        if (eventError) return NextResponse.json({ error: eventError.message }, { status: 500 })

        // Push to Google Calendar
        const closerToken = tokens?.find((t: any) => t.user_id === selectedCloserId)
        if (closerToken?.google_access_token) {
            try {
                const attendees = lead_email ? [{ email: lead_email }] : []
                await createGoogleCalendarEvent(
                    selectedCloserId,
                    closerToken.google_access_token,
                    closerToken.google_refresh_token,
                    closerToken.google_token_expiry,
                    {
                        summary: title || 'Appuntamento via Sincro',
                        description: description || '',
                        start: start_time,
                        end: end_time,
                        attendees
                    }
                )
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
                .ilike('slug', '%appuntamento%')
                .limit(1)

            if (stages && stages.length > 0) {
                updatePayload.stage_id = stages[0].id;
            }

            await supabase.from('leads').update(updatePayload).eq('id', lead_id)
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
