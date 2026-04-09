import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { sendBookingConfirmation, sendBookingNotificationToCloser } from '@/lib/email'
import { getGoogleCalendarFreeBusy, createGoogleCalendarEvent } from '@/lib/google-calendar'

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

        if (!availability || availability.length === 0) {
            return NextResponse.json({ slots: [], message: 'Nessuna disponibilità configurata per questo venditore' })
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

        // 3. Generate available slots
        const slots: { date: string; start: string; end: string; available: boolean }[] = []
        const cursor = new Date(startDate)
        cursor.setHours(0, 0, 0, 0)

        while (cursor < endDate) {
            const dayOfWeek = cursor.getDay()
            const dayAvail = availability.find((a: any) => a.day_of_week === dayOfWeek)

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
            .select('user_id, role, display_color, profiles:user_id(full_name, email)')
            .eq('organization_id', ctx.organization_id)
            .in('role', ['closer', 'owner', 'admin', 'manager'])
            .is('deactivated_at', null)

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

        const result = (closers || [])
            .filter((c: any) => c.role === 'closer' || c.role === 'owner')
            .map((c: any) => ({
                user_id: c.user_id,
                name: c.profiles?.full_name || c.profiles?.email || 'N/A',
                color: c.display_color || '#3b82f6',
                available_days: availMap[c.user_id] || [],
                has_availability: (availMap[c.user_id] || []).length > 0,
            }))

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

        // If lead_id provided, update lead stage to "Appuntamento"
        if (lead_id) {
            // Find the appointment stage
            const { data: stages } = await supabase
                .from('pipeline_stages')
                .select('id, slug, fire_capi_event')
                .eq('organization_id', ctx.organization_id)
                .ilike('slug', '%appuntamento%')
                .limit(1)

            if (stages && stages.length > 0) {
                const { data: lead } = await supabase
                    .from('leads')
                    .select('stage_id')
                    .eq('id', lead_id)
                    .single()

                await supabase
                    .from('leads')
                    .update({
                        stage_id: stages[0].id,
                        updated_at: new Date().toISOString(),
                    })
                    .eq('id', lead_id)

                // Fire CAPI event if configured (via existing API)
                if (stages[0].fire_capi_event && lead) {
                    try {
                        await fetch(new URL('/api/leads', req.url).toString(), {
                            method: 'PUT',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                id: lead_id,
                                stage_id: stages[0].id,
                                _old_stage_id: lead.stage_id,
                            }),
                        })
                    } catch { /* best effort */ }
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
