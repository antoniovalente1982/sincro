import { createClient as createAdmin } from '@supabase/supabase-js'

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET

export async function refreshGoogleToken(userId: string, refreshToken: string) {
    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
        throw new Error('Missing Google OAuth credentials')
    }

    const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            client_id: GOOGLE_CLIENT_ID,
            client_secret: GOOGLE_CLIENT_SECRET,
            refresh_token: refreshToken,
            grant_type: 'refresh_token',
        }),
    })

    if (!response.ok) {
        const error = await response.text()
        console.error('[Google API] Failed to refresh token:', error)
        throw new Error('Failed to refresh google token')
    }

    const data = await response.json()
    const { access_token, expires_in } = data

    const expiryDate = new Date()
    expiryDate.setSeconds(expiryDate.getSeconds() + expires_in)

    // Update in DB using service role
    const adminClient = createAdmin(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    await adminClient
        .from('organization_members')
        .update({
            google_access_token: access_token,
            google_token_expiry: expiryDate.toISOString()
        })
        .eq('user_id', userId)

    return access_token
}

async function getUserCalendars(currentToken: string) {
    try {
        const res = await fetch('https://www.googleapis.com/calendar/v3/users/me/calendarList', {
            headers: { 'Authorization': `Bearer ${currentToken}` }
        })
        if (!res.ok) return [{ id: 'primary' }]
        const data = await res.json()
        const cals = (data.items || [])
            .filter((c: any) => c.selected && (c.accessRole === 'owner' || c.accessRole === 'writer'))
            .map((c: any) => ({ id: c.id }))
        return cals.length > 0 ? cals : [{ id: 'primary' }]
    } catch {
        return [{ id: 'primary' }]
    }
}

export async function getGoogleCalendarFreeBusy(
    userId: string, 
    accessToken: string, 
    refreshToken: string | null, 
    expiry: string | null, 
    timeMin: string, 
    timeMax: string
) {
    let currentToken = accessToken

    // Check if token needs refresh: refresh if missing, no expiry info, or expiring within 5 min
    const needsRefresh = !currentToken || !expiry || new Date(expiry).getTime() < Date.now() + 5 * 60 * 1000
    if (needsRefresh) {
        if (refreshToken) {
            currentToken = await refreshGoogleToken(userId, refreshToken)
        } else {
            console.warn(`[Google API] Token expired for user ${userId} and no refresh token available`)
            return [] // Fail gracefully by returning no busy slots? Or throw error
        }
    }

    let cals = await getUserCalendars(currentToken)

    const response = await fetch('https://www.googleapis.com/calendar/v3/freeBusy', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${currentToken}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            timeMin,
            timeMax,
            items: cals
        }),
    })

    if (!response.ok) {
        if (response.status === 401 && refreshToken) {
            // Force refresh and retry once
            currentToken = await refreshGoogleToken(userId, refreshToken)
            const retryResponse = await fetch('https://www.googleapis.com/calendar/v3/freeBusy', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${currentToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    timeMin,
                    timeMax,
                    items: cals
                }),
            })
            if (!retryResponse.ok) {
                const error = await retryResponse.text()
                console.error('[Google API] Failed freeBusy after retry:', error)
                return []
            }
            const retryData = await retryResponse.json()
            const busySlots: any[] = []
            if (retryData.calendars) {
                Object.values(retryData.calendars).forEach((cal: any) => {
                    if (cal.busy) busySlots.push(...cal.busy)
                })
            }
            return busySlots
        }

        const error = await response.text()
        console.error('[Google API] Failed freeBusy:', error)
        return []
    }

    const data = await response.json()
    const busySlots: any[] = []
    if (data.calendars) {
        Object.values(data.calendars).forEach((cal: any) => {
            if (cal.busy) busySlots.push(...cal.busy)
        })
    }
    return busySlots
}

export async function getGoogleCalendarEvents(
    userId: string,
    accessToken: string,
    refreshToken: string | null,
    expiry: string | null,
    timeMin: string,
    timeMax: string
): Promise<{ id: string; summary: string; start: string; end: string; status: string; htmlLink?: string }[]> {
    let currentToken = accessToken

    // Check if token needs refresh: refresh if missing, no expiry info, or expiring within 5 min
    const needsRefresh = !currentToken || !expiry || new Date(expiry).getTime() < Date.now() + 5 * 60 * 1000
    if (needsRefresh) {
        if (refreshToken) {
            currentToken = await refreshGoogleToken(userId, refreshToken)
        } else {
            console.warn(`[Google API] Token expired for user ${userId} and no refresh token available`)
            return []
        }
    }

    const params = new URLSearchParams({
        timeMin,
        timeMax,
        singleEvents: 'true',
        orderBy: 'startTime',
        maxResults: '250',
    })

    let cals = await getUserCalendars(currentToken)
    if (cals.length === 0) cals = [{ id: 'primary' }]

    const allEvents: any[] = []

    // Helper per fetch eventi di un singolo calendario
    const fetchEventsForCalendar = async (calId: string, token: string) => {
        const response = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calId)}/events?${params}`, {
            headers: { 'Authorization': `Bearer ${token}` },
        })
        if (!response.ok) {
            if (response.status === 401 && refreshToken) {
                return 'refresh_needed'
            }
            return []
        }
        const data = await response.json()
        return (data.items || [])
            .filter((e: any) => (e.start?.dateTime || e.start?.date) && e.status !== 'cancelled')
            .map((e: any) => ({
                id: e.id,
                summary: e.summary || '(Senza titolo)',
                start: e.start.dateTime || e.start.date,
                end: e.end.dateTime || e.end.date,
                status: e.status,
                htmlLink: e.htmlLink,
                extendedProperties: e.extendedProperties,
            }))
    }

    let needsRefresh = false
    for (const cal of cals) {
        const items = await fetchEventsForCalendar(cal.id, currentToken)
        if (items === 'refresh_needed') {
            needsRefresh = true
            break
        }
        allEvents.push(...(items as any[]))
    }

    if (needsRefresh && refreshToken) {
        currentToken = await refreshGoogleToken(userId, refreshToken)
        cals = await getUserCalendars(currentToken) // re-fetch with new token
        allEvents.length = 0 // clear
        for (const cal of cals) {
            const items = await fetchEventsForCalendar(cal.id, currentToken)
            if (items !== 'refresh_needed') {
                allEvents.push(...(items as any[]))
            }
        }
    }

    allEvents.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
    return allEvents
}

export async function createGoogleCalendarEvent(
    userId: string,
    accessToken: string,
    refreshToken: string | null,
    expiry: string | null,
    eventDetails: {
        summary: string,
        description?: string,
        start: string,
        end: string,
        attendees?: { email: string }[],
        extendedProperties?: any
    }
) {
    let currentToken = accessToken

    if (!currentToken || (expiry && new Date(expiry).getTime() < Date.now() + 5 * 60 * 1000)) {
        if (refreshToken) {
            currentToken = await refreshGoogleToken(userId, refreshToken)
        } else {
            throw new Error('Token expired and no refresh token available')
        }
    }

    const response = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events?sendUpdates=all', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${currentToken}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            summary: eventDetails.summary,
            description: eventDetails.description,
            start: {
                dateTime: eventDetails.start,
            },
            end: {
                dateTime: eventDetails.end,
            },
            attendees: eventDetails.attendees || [],
            extendedProperties: eventDetails.extendedProperties,
            reminders: {
                useDefault: true
            }
        }),
    })

    if (!response.ok) {
        if (response.status === 401 && refreshToken) {
            currentToken = await refreshGoogleToken(userId, refreshToken)
            const retryResponse = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events?sendUpdates=all', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${currentToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    summary: eventDetails.summary,
                    description: eventDetails.description,
                    start: { dateTime: eventDetails.start },
                    end: { dateTime: eventDetails.end },
                    attendees: eventDetails.attendees || [],
                    extendedProperties: eventDetails.extendedProperties,
                    reminders: { useDefault: true }
                }),
            })
            if (!retryResponse.ok) {
                throw new Error(await retryResponse.text())
            }
            return await retryResponse.json()
        }

        throw new Error(await response.text())
    }

    return await response.json()
}

export async function updateGoogleCalendarEvent(
    userId: string,
    accessToken: string,
    refreshToken: string | null,
    expiry: string | null,
    eventId: string,
    updates: {
        summary?: string,
        description?: string,
        attendees?: { email: string }[],
    }
) {
    let currentToken = accessToken

    if (!currentToken || (expiry && new Date(expiry).getTime() < Date.now() + 5 * 60 * 1000)) {
        if (refreshToken) {
            currentToken = await refreshGoogleToken(userId, refreshToken)
        } else {
            throw new Error('Token expired and no refresh token available')
        }
    }

    const body: any = {}
    if (updates.summary !== undefined) body.summary = updates.summary
    if (updates.description !== undefined) body.description = updates.description
    if (updates.attendees !== undefined) body.attendees = updates.attendees

    const response = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`, {
        method: 'PATCH',
        headers: {
            'Authorization': `Bearer ${currentToken}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
    })

    if (!response.ok) {
        if (response.status === 401 && refreshToken) {
            currentToken = await refreshGoogleToken(userId, refreshToken)
            const retryResponse = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`, {
                method: 'PATCH',
                headers: {
                    'Authorization': `Bearer ${currentToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(body),
            })
            if (!retryResponse.ok) {
                throw new Error(await retryResponse.text())
            }
            return await retryResponse.json()
        }

        throw new Error(await response.text())
    }

    return await response.json()
}

export async function deleteGoogleCalendarEvent(
    userId: string,
    accessToken: string,
    refreshToken: string | null,
    expiry: string | null,
    eventId: string
) {
    let currentToken = accessToken

    if (!currentToken || (expiry && new Date(expiry).getTime() < Date.now() + 5 * 60 * 1000)) {
        if (refreshToken) {
            currentToken = await refreshGoogleToken(userId, refreshToken)
        } else {
            throw new Error('Token expired and no refresh token available')
        }
    }

    const response = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}?sendUpdates=all`, {
        method: 'DELETE',
        headers: {
            'Authorization': `Bearer ${currentToken}`,
        },
    })

    if (!response.ok) {
        if (response.status === 401 && refreshToken) {
            currentToken = await refreshGoogleToken(userId, refreshToken)
            const retryResponse = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}?sendUpdates=all`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${currentToken}`,
                },
            })
            if (!retryResponse.ok) {
                throw new Error(await retryResponse.text())
            }
            return true
        }

        throw new Error(await response.text())
    }

    return true
}
