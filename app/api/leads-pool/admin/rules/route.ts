import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET /api/leads-pool/admin/rules — list all rules
// POST /api/leads-pool/admin/rules — upsert a rule
// DELETE /api/leads-pool/admin/rules?id=xxx — delete a rule

async function requireAdmin(supabase: any) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Non autorizzato', status: 401 }

    const { data: member } = await supabase
        .from('organization_members')
        .select('organization_id, role')
        .eq('user_id', user.id)
        .is('deactivated_at', null)
        .single()

    if (!member || !['owner', 'admin', 'manager'].includes(member.role)) {
        return { error: 'Accesso negato', status: 403 }
    }

    return { user, member, orgId: member.organization_id }
}

export async function GET() {
    const supabase = await createClient()
    const auth = await requireAdmin(supabase)
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

    const { data: rules } = await supabase
        .from('lead_distribution_rules')
        .select('*')
        .eq('organization_id', auth.orgId)
        .order('user_id', { ascending: true })

    // Enrich with user profiles
    const userIds = (rules || []).filter(r => r.user_id).map(r => r.user_id)
    let profilesMap: Record<string, any> = {}
    if (userIds.length > 0) {
        const { data: profiles } = await supabase
            .from('profiles')
            .select('id, full_name, avatar_url')
            .in('id', userIds)
        profilesMap = Object.fromEntries((profiles || []).map(p => [p.id, p]))
    }

    const enriched = (rules || []).map(r => ({
        ...r,
        profile: r.user_id ? profilesMap[r.user_id] : null,
    }))

    return NextResponse.json({ rules: enriched })
}

export async function POST(request: Request) {
    const supabase = await createClient()
    const auth = await requireAdmin(supabase)
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

    const body = await request.json()
    const { action } = body

    if (action === 'toggle_list') {
        const { list_id, is_active } = body
        if (!list_id) {
            return NextResponse.json({ error: 'list_id richiesto' }, { status: 400 })
        }
        const { data, error } = await supabase
            .from('lead_lists')
            .update({ is_active, updated_at: new Date().toISOString() })
            .eq('id', list_id)
            .eq('organization_id', auth.orgId)
            .select()
            .single()

        if (error) {
            return NextResponse.json({ error: 'Errore aggiornamento lista', detail: error.message }, { status: 500 })
        }
        return NextResponse.json({ success: true, list: data })
    }

    const {
        user_id,            // null = default org rule
        max_leads_per_day,
        batch_size,
        cooldown_minutes,
        require_feedback_before_next,
        min_feedback_pct,
        active_list_ids,
        allowed_hours_start,
        allowed_hours_end,
        allowed_days,
        recycle_after_hours,
    } = body

    const payload = {
        organization_id: auth.orgId,
        user_id: user_id || null,
        max_leads_per_day: max_leads_per_day ?? 50,
        batch_size: batch_size ?? 5,
        cooldown_minutes: cooldown_minutes ?? 0,
        require_feedback_before_next: require_feedback_before_next ?? true,
        min_feedback_pct: min_feedback_pct ?? 100,
        active_list_ids: active_list_ids || null,
        allowed_hours_start: allowed_hours_start || '08:00',
        allowed_hours_end: allowed_hours_end || '21:00',
        allowed_days: allowed_days || [1, 2, 3, 4, 5, 6],
        recycle_after_hours: recycle_after_hours ?? 48,
        updated_at: new Date().toISOString(),
    }

    const { data, error } = await supabase
        .from('lead_distribution_rules')
        .upsert(payload, { onConflict: 'organization_id,user_id' })
        .select()
        .single()

    if (error) {
        return NextResponse.json({ error: 'Errore salvataggio regola', detail: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, rule: data })
}

export async function DELETE(request: Request) {
    const supabase = await createClient()
    const auth = await requireAdmin(supabase)
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id richiesto' }, { status: 400 })

    const { error } = await supabase
        .from('lead_distribution_rules')
        .delete()
        .eq('id', id)
        .eq('organization_id', auth.orgId)

    if (error) return NextResponse.json({ error: 'Errore eliminazione regola' }, { status: 500 })

    return NextResponse.json({ success: true })
}
