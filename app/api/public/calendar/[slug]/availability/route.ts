import { createClient as createAdmin } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { getGoogleCalendarFreeBusy } from '@/lib/google-calendar'

export async function GET(req: NextRequest, props: { params: Promise<{ slug: string }> }) {
    const { searchParams } = new URL(req.url)
    const fromStr = searchParams.get('from')
    const params = await props.params
    const slug = params.slug

    if (!slug || !fromStr) {
        return NextResponse.json({ error: 'Missing slug or from date' }, { status: 400 })
    }

    const startDate = new Date(fromStr)
    startDate.setHours(0,0,0,0)
    const endDate = new Date(startDate.getTime() + 14 * 86400000) // Next 14 days

    try {
        const supabaseAdmin = createAdmin(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        )

        // 1. Get Calendar Config
        const { data: calendar, error: calError } = await supabaseAdmin
            .from('crm_calendars')
            .select('*')
            .eq('slug', slug)
            .eq('is_active', true)
            .single()

        if (calError || !calendar) {
            return NextResponse.json({ error: 'Calendar not found or inactive' }, { status: 404 })
        }

        // 2. Get Team Members for this Calendar
        const { data: members, error: membersError } = await supabaseAdmin
            .from('crm_calendar_members')
            .select('user_id, priority')
            .eq('calendar_id', calendar.id)
            .eq('is_active', true)

        if (membersError || !members || members.length === 0) {
            return NextResponse.json({ slots: [] }) // No members available
        }

        const userIds = members.map((m: any) => m.user_id)

        // 3. Get Availability Rules for all members
        const { data: availabilities } = await supabaseAdmin
            .from('calendar_availability')
            .select('*')
            .in('user_id', userIds)
            .eq('is_active', true)

        if (!availabilities || availabilities.length === 0) {
            return NextResponse.json({ slots: [] })
        }

        // 4. Get Existing DB Events for these members
        const { data: existingEvents } = await supabaseAdmin
            .from('calendar_events')
            .select('closer_id, start_time, end_time')
            .in('closer_id', userIds)
            .neq('status', 'cancelled')
            .gte('start_time', startDate.toISOString())
            .lte('start_time', endDate.toISOString())

        // 5. Get Google Calendar Free/Busy for these members
        const { data: tokens } = await supabaseAdmin
            .from('organization_members')
            .select('user_id, google_access_token, google_refresh_token, google_token_expiry')
            .in('user_id', userIds)

        const allUserBusySlots: Record<string, { start: number, end: number }[]> = {}

        for (const uid of userIds) {
            allUserBusySlots[uid] = []
            
            // Add DB bookings
            const userDbEvents = (existingEvents || []).filter(e => e.closer_id === uid)
            for (const ev of userDbEvents) {
                allUserBusySlots[uid].push({
                    start: new Date(ev.start_time).getTime(),
                    end: new Date(ev.end_time).getTime()
                })
            }

            // Add Google Calendar busys
            const userToken = tokens?.find(t => t.user_id === uid)
            if (userToken?.google_access_token) {
                try {
                    const gEvents = await getGoogleCalendarFreeBusy(
                        uid,
                        userToken.google_access_token,
                        userToken.google_refresh_token,
                        userToken.google_token_expiry,
                        startDate.toISOString(),
                        endDate.toISOString()
                    )
                    gEvents.forEach((ev: any) => {
                        allUserBusySlots[uid].push({
                            start: new Date(ev.start).getTime(),
                            end: new Date(ev.end).getTime()
                        })
                    })
                } catch (err) {
                    console.error(`Failed to get google free/busy for ${uid}`, err)
                }
            }
        }

        // 6. Generate Available Slots per User
        // Then merge them
        const slotDuration = calendar.slot_duration_minutes || 30
        const slotInterval = calendar.slot_interval_minutes || 30
        const slotBuffer = calendar.slot_buffer_minutes || 15

        const availableSlotsMap: Record<string, string[]> = {} // Mapping timestamp (ISO) to array of available user_ids

        const cursor = new Date(startDate)
        while (cursor < endDate) {
            const dayOfWeek = cursor.getDay()

            for (const uid of userIds) {
                const dayAvail = availabilities.find(a => a.user_id === uid && a.day_of_week === dayOfWeek)
                if (!dayAvail) continue

                const [startH, startM] = dayAvail.start_time.split(':').map(Number)
                const [endH, endM] = dayAvail.end_time.split(':').map(Number)

                let slotStart = new Date(cursor)
                slotStart.setHours(startH, startM, 0, 0)
                
                const dayEnd = new Date(cursor)
                dayEnd.setHours(endH, endM, 0, 0)

                // Increment by valid slot intervals
                while (slotStart.getTime() + slotDuration * 60000 <= dayEnd.getTime()) {
                    const slotEnd = new Date(slotStart.getTime() + slotDuration * 60000)

                    // Add buffer around the slot for checking conflicts
                    const bufferMs = slotBuffer * 60000
                    const bufferedStart = slotStart.getTime() - bufferMs
                    const bufferedEnd = slotEnd.getTime() + bufferMs

                    const isOccupied = allUserBusySlots[uid].some(busy => 
                        bufferedStart < busy.end && bufferedEnd > busy.start
                    )
                    
                    const isPast = slotStart.getTime() < Date.now() + 60 * 60000 // Cannot book within 1 hr

                    if (!isOccupied && !isPast) {
                        const isoString = slotStart.toISOString()
                        if (!availableSlotsMap[isoString]) availableSlotsMap[isoString] = []
                        if (!availableSlotsMap[isoString].includes(uid)) {
                            availableSlotsMap[isoString].push(uid)
                        }
                    }

                    // Move by interval
                    slotStart = new Date(slotStart.getTime() + slotInterval * 60000)
                }
            }

            cursor.setDate(cursor.getDate() + 1)
        }

        // 7. Format the resulting map into sorted slots array
        const slotsObj: Record<string, { time: string, availableMembers: string[] }[]> = {}

        Object.keys(availableSlotsMap).sort().forEach(isoKey => {
            const dateStr = isoKey.split('T')[0]
            if (!slotsObj[dateStr]) slotsObj[dateStr] = []
            slotsObj[dateStr].push({
                time: isoKey,
                availableMembers: availableSlotsMap[isoKey]
            })
        })

        return NextResponse.json({ 
            calendar: {
                id: calendar.id,
                name: calendar.name,
                description: calendar.description,
                duration: slotDuration
            },
            slots: slotsObj 
        })

    } catch (err) {
        console.error('Error in public availability', err)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
