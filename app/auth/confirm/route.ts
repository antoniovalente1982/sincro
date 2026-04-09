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
            // Per inviti: redirect a "imposta password" (l'utente non ne ha ancora una)
            if (type === 'invite') {
                return NextResponse.redirect(new URL('/set-password', req.url))
            }
            return NextResponse.redirect(new URL(next, req.url))
        }
        
        console.error('[AUTH CONFIRM] OTP verify error:', error.message)
    }

    return NextResponse.redirect(new URL('/login?error=invite_expired', req.url))
}
