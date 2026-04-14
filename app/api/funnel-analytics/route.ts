import { createClient } from '@/lib/supabase/server'
import { createClient as createAdmin } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

async function getOrgId(supabase: any) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null
    const { data: member } = await supabase
        .from('organization_members')
        .select('organization_id')
        .eq('user_id', user.id)
        .single()
    return member?.organization_id || null
}

export async function GET(req: NextRequest) {
    const supabase = await createClient()
    const orgId = await getOrgId(supabase)
    if (!orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const since = searchParams.get('since') || new Date(0).toISOString()
    const until = searchParams.get('until') || new Date().toISOString()

    const admin = createAdmin(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    )

    // Fetch ALL page views for the date range (no limit!) — only the fields needed
    const { data: pageViews, error: pvError } = await admin
        .from('page_views')
        .select('id, funnel_id, page_path, page_variant, visitor_id, ip_hash, utm_source, utm_campaign, utm_content, device_type, created_at')
        .eq('organization_id', orgId)
        .gte('created_at', since)
        .lte('created_at', until)
        .order('created_at', { ascending: false })

    if (pvError) return NextResponse.json({ error: pvError.message }, { status: 500 })

    // Fetch ALL submissions for the date range (no limit!)
    const { data: submissions, error: subError } = await admin
        .from('funnel_submissions')
        .select('id, funnel_id, page_variant, created_at, utm_source, utm_campaign')
        .eq('organization_id', orgId)
        .gte('created_at', since)
        .lte('created_at', until)
        .order('created_at', { ascending: false })

    if (subError) return NextResponse.json({ error: subError.message }, { status: 500 })

    return NextResponse.json({
        pageViews: pageViews || [],
        submissions: submissions || [],
    })
}
