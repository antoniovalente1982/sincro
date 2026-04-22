import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

function getSupabaseAdmin() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    )
}

export async function GET(req: NextRequest) {
    try {
        const { data: submissions, error } = await getSupabaseAdmin()
            .from('radar_submissions')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(200)

        if (error) {
            // Table might not exist yet
            return NextResponse.json({ submissions: [] })
        }

        return NextResponse.json({ submissions: submissions || [] })
    } catch (err) {
        console.error('Radar list error:', err)
        return NextResponse.json({ submissions: [] })
    }
}
