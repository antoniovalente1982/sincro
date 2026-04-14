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

// Paginated fetch to bypass Supabase's default 1000 row limit
async function fetchAll(admin: any, table: string, select: string, orgId: string, since: string, until: string) {
    const PAGE_SIZE = 1000
    let allData: any[] = []
    let offset = 0
    let hasMore = true

    while (hasMore) {
        const { data, error } = await admin
            .from(table)
            .select(select)
            .eq('organization_id', orgId)
            .gte('created_at', since)
            .lte('created_at', until)
            .order('created_at', { ascending: false })
            .range(offset, offset + PAGE_SIZE - 1)

        if (error) throw error
        if (!data || data.length === 0) {
            hasMore = false
        } else {
            allData = allData.concat(data)
            offset += PAGE_SIZE
            hasMore = data.length === PAGE_SIZE
        }
    }

    return allData
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

    try {
        const [pageViews, submissions] = await Promise.all([
            fetchAll(
                admin,
                'page_views',
                'id, funnel_id, page_path, page_variant, visitor_id, ip_hash, utm_source, utm_campaign, utm_content, device_type, created_at',
                orgId,
                since,
                until
            ),
            fetchAll(
                admin,
                'funnel_submissions',
                'id, funnel_id, page_variant, created_at, utm_source, utm_campaign, email, ip_address',
                orgId,
                since,
                until
            ),
        ])

        return NextResponse.json({
            pageViews,
            submissions,
        })
    } catch (err: any) {
        return NextResponse.json({ error: err.message || 'Fetch failed' }, { status: 500 })
    }
}
