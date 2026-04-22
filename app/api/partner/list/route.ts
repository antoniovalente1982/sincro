import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

function getSupabaseAdmin() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    )
}

export async function GET() {
    try {
        const { data: partners, error } = await getSupabaseAdmin()
            .from('partners')
            .select('*')
            .order('created_at', { ascending: false })

        if (error) {
            return NextResponse.json({ partners: [] })
        }

        // Enrich with stats from radar_submissions
        const enriched = await Promise.all((partners || []).map(async (partner) => {
            const { data: subs } = await getSupabaseAdmin()
                .from('radar_submissions')
                .select('id, converted')
                .eq('partner_id', partner.slug)

            const quizzes = subs?.length || 0
            const converted = subs?.filter(s => s.converted)?.length || 0
            const revenue = converted * partner.commission_amount // commission per deal

            return {
                ...partner,
                stats: { quizzes, converted, revenue },
            }
        }))

        return NextResponse.json({ partners: enriched })
    } catch (err) {
        console.error('Partner list error:', err)
        return NextResponse.json({ partners: [] })
    }
}
