import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID
    
    if (!GOOGLE_CLIENT_ID) {
        return NextResponse.json({ error: 'Google Client ID not configured' }, { status: 500 })
    }

    const { origin } = new URL(req.url)
    const redirectUri = `${origin}/api/auth/google/callback`

    // Richiediamo permessi offline per avere il refresh token
    const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth')
    authUrl.searchParams.set('client_id', GOOGLE_CLIENT_ID)
    authUrl.searchParams.set('redirect_uri', redirectUri)
    authUrl.searchParams.set('response_type', 'code')
    authUrl.searchParams.set('scope', 'https://www.googleapis.com/auth/calendar.events')
    authUrl.searchParams.set('access_type', 'offline')
    authUrl.searchParams.set('prompt', 'consent') // Forza il prompt per ottenere sempre il refresh token

    // Passiamo l'ID utente nello state per saperlo al ritorno
    authUrl.searchParams.set('state', user.id)

    return NextResponse.redirect(authUrl.toString())
}
