import { NextRequest, NextResponse } from 'next/server'
import { createClient as createAdmin } from '@supabase/supabase-js'

export async function GET(req: NextRequest) {
    const { searchParams, origin } = new URL(req.url)
    const code = searchParams.get('code')
    const state = searchParams.get('state') // Manda l'user_id come state
    const error = searchParams.get('error')

    if (error) {
        return NextResponse.redirect(`${origin}/dashboard/settings?error=calendar_sync_failed`)
    }

    if (!code || !state) {
        return NextResponse.redirect(`${origin}/dashboard/settings?error=missing_oauth_params`)
    }

    const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID
    const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET

    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
        return NextResponse.redirect(`${origin}/dashboard/settings?error=missing_google_credentials`)
    }

    const redirectUri = `${origin}/api/auth/google/callback`

    try {
        // Exchange code for tokens
        const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
                code,
                client_id: GOOGLE_CLIENT_ID,
                client_secret: GOOGLE_CLIENT_SECRET,
                redirect_uri: redirectUri,
                grant_type: 'authorization_code',
            }),
        })

        if (!tokenRes.ok) {
            console.error('[Google OAuth] Token exchange failed', await tokenRes.text())
            throw new Error('Token exchange failed')
        }

        const data = await tokenRes.json()
        const { access_token, refresh_token, expires_in } = data

        const expiryDate = new Date()
        expiryDate.setSeconds(expiryDate.getSeconds() + expires_in)

        // Usiamo il service role per aggiornare il record bypassando la RLS (se necessario)
        // oppure semplicemente admin client.
        const adminClient = createAdmin(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        )

        // Aggiorna l'organization_member con i token
        const updatePayload: any = {
            google_access_token: access_token,
            google_token_expiry: expiryDate.toISOString()
        }

        if (refresh_token) {
            updatePayload.google_refresh_token = refresh_token
        }

        const { error: dbError } = await adminClient
            .from('organization_members')
            .update(updatePayload)
            .eq('user_id', state)

        if (dbError) {
            console.error('[Google OAuth] DB Update error', dbError)
            return NextResponse.redirect(`${origin}/dashboard/settings?error=db_update_failed`)
        }

        return NextResponse.redirect(`${origin}/dashboard/settings?success=calendar_synced`)
        
    } catch (err) {
        console.error('[Google OAuth] Callback exception', err)
        return NextResponse.redirect(`${origin}/dashboard/settings?error=internal_server_error`)
    }
}
