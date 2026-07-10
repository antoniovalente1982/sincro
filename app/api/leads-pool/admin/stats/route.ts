import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET /api/leads-pool/admin/stats
// KPI globali team per owner/admin/manager
export async function GET() {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })

    const { data: member } = await supabase
        .from('organization_members')
        .select('organization_id, role')
        .eq('user_id', user.id)
        .is('deactivated_at', null)
        .single()

    if (!member || !['owner', 'admin', 'manager'].includes(member.role)) {
        return NextResponse.json({ error: 'Accesso negato' }, { status: 403 })
    }

    const orgId = member.organization_id
    const today = new Date().toISOString().split('T')[0]

    const [listsRes, quotaRes, profilesRes] = await Promise.all([
        // All active lists with counts
        supabase
            .from('lead_lists')
            .select('*')
            .eq('organization_id', orgId)
            .order('created_at', { ascending: false }),

        // Today's quota for all venditori
        supabase
            .from('lead_daily_quota')
            .select('*')
            .eq('organization_id', orgId)
            .eq('quota_date', today),

        // All closer profiles
        supabase
            .from('organization_members')
            .select('user_id, role')
            .eq('organization_id', orgId)
            .in('role', ['closer', 'manager'])
            .is('deactivated_at', null),
    ])

    const lists = listsRes.data || []
    const quotas = quotaRes.data || []
    const closerMembers = profilesRes.data || []

    // Enrich quotas with profile names
    let profilesMap: Record<string, any> = {}
    if (closerMembers.length > 0) {
        const { data: profiles } = await supabase
            .from('profiles')
            .select('id, full_name, avatar_url')
            .in('id', closerMembers.map(m => m.user_id))
        profilesMap = Object.fromEntries((profiles || []).map(p => [p.id, p]))
    }

    const teamKpis = quotas.map(q => ({
        user_id: q.user_id,
        profile: profilesMap[q.user_id] || null,
        leads_requested: q.leads_requested,
        leads_called: q.leads_called,
        leads_converted: q.leads_converted,
        spins_count: q.spins_count,
        max_allowed: q.max_allowed,
    }))

    // Pool summary by status
    const { data: poolSummary } = await supabase
        .from('lead_pool')
        .select('status, list_id')
        .eq('organization_id', orgId)

    const statusCounts: Record<string, number> = {}
    for (const lead of poolSummary || []) {
        statusCounts[lead.status] = (statusCounts[lead.status] || 0) + 1
    }

    return NextResponse.json({
        lists,
        team_kpis: teamKpis,
        pool_summary: {
            available: statusCounts['available'] || 0,
            assigned: statusCounts['assigned'] || 0,
            called: statusCounts['called'] || 0,
            converted: statusCounts['converted'] || 0,
            recycled: statusCounts['recycled'] || 0,
            blacklisted: statusCounts['blacklisted'] || 0,
            total: (poolSummary || []).length,
        },
        totals_today: {
            leads_requested: teamKpis.reduce((s, q) => s + q.leads_requested, 0),
            leads_called: teamKpis.reduce((s, q) => s + q.leads_called, 0),
            leads_converted: teamKpis.reduce((s, q) => s + q.leads_converted, 0),
        }
    })
}
