import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
    let supabaseResponse = NextResponse.next({ request })

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return request.cookies.getAll()
                },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value }) =>
                        request.cookies.set(name, value)
                    )
                    supabaseResponse = NextResponse.next({ request })
                    cookiesToSet.forEach(({ name, value, options }) =>
                        supabaseResponse.cookies.set(name, value, options)
                    )
                },
            },
        }
    )

    const { data: { user } } = await supabase.auth.getUser()

    // ── Protect dashboard routes ──
    if (request.nextUrl.pathname.startsWith('/dashboard')) {
        if (!user) {
            const url = request.nextUrl.clone()
            url.pathname = '/login'
            return NextResponse.redirect(url)
        }

        // Check membership: must be active (not deactivated) and onboarding complete (joined_at set)
        const { data: member } = await supabase
            .from('organization_members')
            .select('deactivated_at, joined_at')
            .eq('user_id', user.id)
            .is('deactivated_at', null)
            .limit(1)
            .maybeSingle()

        // No active membership → user was deactivated or never invited
        if (!member) {
            // Sign them out so stale session doesn't persist
            await supabase.auth.signOut()
            const url = request.nextUrl.clone()
            url.pathname = '/login'
            url.searchParams.set('error', 'deactivated')
            return NextResponse.redirect(url)
        }

        // Invited but hasn't completed onboarding (password not set)
        if (!member.joined_at) {
            const url = request.nextUrl.clone()
            url.pathname = '/set-password'
            return NextResponse.redirect(url)
        }
    }

    // ── Set-password page: require active session ──
    if (request.nextUrl.pathname === '/set-password') {
        if (!user) {
            const url = request.nextUrl.clone()
            url.pathname = '/login'
            url.searchParams.set('error', 'session_expired')
            return NextResponse.redirect(url)
        }
    }

    // ── Registration is disabled — redirect to login ──
    if (request.nextUrl.pathname === '/register') {
        const url = request.nextUrl.clone()
        url.pathname = '/login'
        return NextResponse.redirect(url)
    }

    // ── Redirect logged-in users away from login page ──
    if (request.nextUrl.pathname === '/login' && user) {
        // But only if they have a valid, active, completed membership
        const { data: member } = await supabase
            .from('organization_members')
            .select('deactivated_at, joined_at')
            .eq('user_id', user.id)
            .is('deactivated_at', null)
            .limit(1)
            .maybeSingle()

        if (member && member.joined_at) {
            const url = request.nextUrl.clone()
            url.pathname = '/dashboard'
            return NextResponse.redirect(url)
        }

        // If they have a pending invite, send to set-password
        if (member && !member.joined_at) {
            const url = request.nextUrl.clone()
            url.pathname = '/set-password'
            return NextResponse.redirect(url)
        }

        // If deactivated or no membership, stay on login (sign them out)
        if (!member) {
            await supabase.auth.signOut()
        }
    }

    return supabaseResponse
}

export const config = {
    matcher: ['/dashboard/:path*', '/login', '/register', '/set-password'],
}
