import { createClient as createAdmin } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { createGoogleCalendarEvent, getGoogleCalendarFreeBusy } from '@/lib/google-calendar'
import { sendBookingConfirmation, sendBookingNotificationToCloser } from '@/lib/email'

export async function POST(req: NextRequest, props: { params: Promise<{ slug: string }> }) {
    const params = await props.params
    const slug = params.slug
    const body = await req.json()
    const { start_time, name, email, phone, notes } = body

    if (!slug || !start_time || !name || !email) {
        return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

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
            return NextResponse.json({ error: 'Calendar not found' }, { status: 404 })
        }

        const slotDur = calendar.slot_duration_minutes || 30
        const startDate = new Date(start_time)
        const endDate = new Date(startDate.getTime() + slotDur * 60000)
        
        // 2. We need to find an available member for this slot
        const { data: members } = await supabaseAdmin
            .from('crm_calendar_members')
            .select('user_id, priority')
            .eq('calendar_id', calendar.id)
            .eq('is_active', true)
            .order('priority', { ascending: false })

        if (!members || members.length === 0) {
            return NextResponse.json({ error: 'No agents available' }, { status: 400 })
        }

        const userIds = members.map(m => m.user_id)

        // Find who is truly available for `start_time`
        // 2a. Check DB Events
        const { data: existingEvents } = await supabaseAdmin
            .from('calendar_events')
            .select('closer_id')
            .in('closer_id', userIds)
            .neq('status', 'cancelled')
            .lt('start_time', endDate.toISOString())
            .gt('end_time', startDate.toISOString())
            
        const busyDbUsers = new Set((existingEvents || []).map(e => e.closer_id))

        // 2b. Check Google Calendar Free/Busy for those who are not busy in DB
        const candidates = userIds.filter(uid => !busyDbUsers.has(uid))
        let assignedUserId: string | null = null

        const { data: tokens } = await supabaseAdmin
            .from('organization_members')
            .select('user_id, google_access_token, google_refresh_token, google_token_expiry, profiles:user_id(full_name, email)')
            .in('user_id', candidates)

        for (const uid of candidates) {
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
                    // If no events conflcit exactly with this slot
                    const isBusyGcal = gEvents.some((ge: any) => {
                        const gStart = new Date(ge.start).getTime()
                        const gEnd = new Date(ge.end).getTime()
                        return gStart < endDate.getTime() && gEnd > startDate.getTime()
                    })

                    if (!isBusyGcal) {
                        assignedUserId = uid
                        break
                    }
                } catch (err) {
                    // Treat as available if api fails? No, maybe skip.
                    console.error('GCAL Check failed for user', uid, err)
                }
            } else {
                // If they don't have GCal hooked up, they are available (DB check passed)
                assignedUserId = uid
                break
            }
        }

        if (!assignedUserId) {
            return NextResponse.json({ error: 'Slot is no longer available' }, { status: 409 })
        }

        // 3. Create Lead in the system
        // Try to find if lead exists
        const { data: existingLead } = await supabaseAdmin
            .from('leads')
            .select('id')
            .eq('organization_id', calendar.organization_id)
            .eq('email', email)
            .limit(1)
        
        let leadId = existingLead?.[0]?.id

        if (!leadId) {
            // Find "Appuntamento" stage or just first stage
            const { data: stages } = await supabaseAdmin
                .from('pipeline_stages')
                .select('id, pipeline_id')
                .eq('organization_id', calendar.organization_id)
                .order('position', { ascending: true })
                
            const appuntamentoStage = stages?.find(s => s.id.toLowerCase().includes('appuntamento')) || stages?.[0]

            const { data: newLead } = await supabaseAdmin
                .from('leads')
                .insert({
                    organization_id: calendar.organization_id,
                    name,
                    email,
                    phone,
                    stage_id: appuntamentoStage ? appuntamentoStage.id : null,
                    pipeline_id: appuntamentoStage ? appuntamentoStage.pipeline_id : null,
                    created_at: new Date().toISOString()
                })
                .select('id')
                .single()
            
            leadId = newLead?.id
        }

        // 4. Create DB Event
        const { error: eventError } = await supabaseAdmin
            .from('calendar_events')
            .insert({
                organization_id: calendar.organization_id,
                calendar_id: calendar.id,
                closer_id: assignedUserId,
                lead_id: leadId,
                title: `${name} - ${calendar.name}`,
                description: notes,
                lead_phone: phone,
                lead_email: email,
                start_time: startDate.toISOString(),
                end_time: endDate.toISOString(),
                status: 'confirmed',
            })

        if (eventError) {
            console.error('Error creating DB event', eventError)
        }

        // 5. Create Google Calendar Event
        const assignedMember = tokens?.find(t => t.user_id === assignedUserId)
        if (assignedMember?.google_access_token) {
            try {
                await createGoogleCalendarEvent(
                    assignedUserId,
                    assignedMember.google_access_token,
                    assignedMember.google_refresh_token,
                    assignedMember.google_token_expiry,
                    {
                        summary: `${name} - ${calendar.name}`,
                        description: `Telefono: ${phone}\nEmail: ${email}\nNote: ${notes || 'Nessuna'}`,
                        start: startDate.toISOString(),
                        end: endDate.toISOString(),
                        attendees: [{ email }]
                    }
                )
            } catch (err) {
                console.error('Failed to create GCal event from public booking', err)
            }
        }

        // 6. Send Emails
        const closerName = (assignedMember?.profiles as any)?.full_name || 'Il tuo consulente'
        const closerEmail = (assignedMember?.profiles as any)?.email

        const startDt = startDate
        const endDt = endDate
        const dateFormatted = startDt.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
        const timeFormatted = `${startDt.getHours().toString().padStart(2,'0')}:${startDt.getMinutes().toString().padStart(2,'0')} — ${endDt.getHours().toString().padStart(2,'0')}:${endDt.getMinutes().toString().padStart(2,'0')}`

        sendBookingConfirmation({
            to: email,
            leadName: name,
            closerName,
            date: dateFormatted,
            time: timeFormatted,
            phone,
        }).catch(() => {})

        if (closerEmail) {
            sendBookingNotificationToCloser({
                to: closerEmail,
                closerName,
                leadName: name,
                leadPhone: phone,
                leadEmail: email,
                date: dateFormatted,
                time: timeFormatted,
                setterName: 'Sito Web (Public Booking)',
            }).catch(() => {})
        }

        return NextResponse.json({ 
            success: true, 
            redirect_url: calendar.redirect_url || '/grazie' 
        })

    } catch (err) {
        console.error('Public booking endpoint error', err)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
