import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getSupabaseAdmin() {
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        serviceKey || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    )
}

export async function GET() {
    try {
        const supabase = getSupabaseAdmin()

        // 1. Visite (Landing)
        const { count: visits } = await supabase
            .from('page_views')
            .select('*', { count: 'exact', head: true })
            .eq('funnel_id', 'radar_quiz')

        // 2. Iniziati
        const { count: started } = await supabase
            .from('tracked_events')
            .select('*', { count: 'exact', head: true })
            .eq('event_name', 'StartQuiz')

        // 3. Finiti (Report Visti)
        const { count: finished } = await supabase
            .from('tracked_events')
            .select('*', { count: 'exact', head: true })
            .eq('event_name', 'ViewReport')

        // 4. Leads
        const { count: leads } = await supabase
            .from('radar_submissions')
            .select('*', { count: 'exact', head: true })

        return NextResponse.json({
            visits: visits || 0,
            started: started || 0,
            finished: finished || 0,
            leads: leads || 0,
        })
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 })
    }
}

export async function DELETE() {
    try {
        const supabase = getSupabaseAdmin()

        // 1. Delete page views for the funnel
        await supabase.from('page_views').delete().eq('funnel_id', 'radar_quiz')

        // 2. Delete tracked events for the funnel
        await supabase.from('tracked_events').delete().in('event_name', ['StartQuiz', 'ViewReport'])

        // 3. Get all radar submissions to find the lead IDs before deleting
        const { data: submissions } = await supabase.from('radar_submissions').select('id, lead_id')
        
        if (submissions && submissions.length > 0) {
            // Delete the radar submissions (safer query)
            await supabase.from('radar_submissions').delete().not('id', 'is', null)
        }

        // 4. Delete the leads generated from the radar (this also cascades to lead_activities)
        const { error: leadsErr } = await supabase.from('leads').delete().contains('meta_data', { source: 'radar_consulenza' })
        if (leadsErr) console.error('Failed to delete leads:', leadsErr)

        return NextResponse.json({ success: true })
    } catch (err: any) {
        console.error('Radar stats DELETE error:', err)
        return NextResponse.json({ error: err.message }, { status: 500 })
    }
}
