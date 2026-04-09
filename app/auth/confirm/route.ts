import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url)
    const token_hash = searchParams.get('token_hash')
    const type = searchParams.get('type') as any
    const next = searchParams.get('next') || '/dashboard'

    if (token_hash && type) {
        const supabase = await createClient()
        const { error } = await supabase.auth.verifyOtp({ token_hash, type })

        if (!error) {
            // Token verificato con successo — redirect alla pagina richiesta
            return NextResponse.redirect(new URL(next, req.url))
        }
    }

    // Se fallisce, redirect alla login con errore
    return NextResponse.redirect(new URL('/login?error=invite_expired', req.url))
}
