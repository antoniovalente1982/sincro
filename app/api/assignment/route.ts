import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

async function getOrgAndRole(supabase: any) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null
    const { data: member } = await supabase
        .from('organization_members')
        .select('organization_id, role')
        .eq('user_id', user.id)
        .single()
    return member ? { ...member, user_id: user.id } : null
}

export async function GET() {
    const supabase = await createClient()
    const ctx = await getOrgAndRole(supabase)
    if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Get assignment config
    const { data: config } = await supabase
        .from('lead_assignment_config')
        .select('*')
        .eq('organization_id', ctx.organization_id)
        .single()

    // Get setter availability with profiles
    const { data: setters } = await supabase
        .from('setter_availability')
        .select('*, profiles:user_id (full_name, email)')
        .eq('organization_id', ctx.organization_id)

    // Get all members who could be setters (setter/closer roles)
    const { data: members } = await supabase
        .from('organization_members')
        .select('user_id, role, profiles:user_id (full_name, email)')
        .eq('organization_id', ctx.organization_id)
        .in('role', ['setter', 'closer'])

    // Lead stats per setter
    const { data: leadStats } = await supabase
        .from('leads')
        .select('assigned_to, stage_id')
        .eq('organization_id', ctx.organization_id)
        .not('assigned_to', 'is', null)

    const { data: wonStages } = await supabase
        .from('pipeline_stages')
        .select('id')
        .eq('organization_id', ctx.organization_id)
        .eq('is_won', true)

    const wonIds = new Set((wonStages || []).map((s: any) => s.id))
    const stats: Record<string, { total: number; won: number }> = {}

    ;(leadStats || []).forEach((l: any) => {
        if (!stats[l.assigned_to]) stats[l.assigned_to] = { total: 0, won: 0 }
        stats[l.assigned_to].total++
        if (wonIds.has(l.stage_id)) stats[l.assigned_to].won++
    })

    return NextResponse.json({
        config: config || { assignment_mode: 'manual', auto_assign_enabled: false },
        setters: setters || [],
        members: members || [],
        stats,
    })
}

export async function POST(req: NextRequest) {
    const supabase = await createClient()
    const ctx = await getOrgAndRole(supabase)
    if (!ctx || (ctx.role !== 'owner' && ctx.role !== 'admin' && ctx.role !== 'manager'))
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const body = await req.json()

    if (body.action === 'update_config') {
        const { assignment_mode, auto_assign_enabled, fallback_mode } = body
        const { data, error } = await supabase
            .from('lead_assignment_config')
            .upsert({
                organization_id: ctx.organization_id,
                assignment_mode,
                auto_assign_enabled,
                fallback_mode,
                updated_at: new Date().toISOString(),
            }, { onConflict: 'organization_id' })
            .select()
            .single()
        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
        return NextResponse.json(data)
    }

    if (body.action === 'update_setter') {
        const { user_id, is_available, max_daily_leads, weight } = body
        const { data, error } = await supabase
            .from('setter_availability')
            .upsert({
                organization_id: ctx.organization_id,
                user_id,
                is_available,
                max_daily_leads,
                weight,
                updated_at: new Date().toISOString(),
            }, { onConflict: 'organization_id,user_id' })
            .select()
            .single()
        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
        return NextResponse.json(data)
    }

    if (body.action === 'reassign_lead') {
        const { lead_id, setter_id } = body
        const { data, error } = await supabase
            .from('leads')
            .update({ assigned_to: setter_id, updated_at: new Date().toISOString() })
            .eq('id', lead_id)
            .eq('organization_id', ctx.organization_id)
            .select()
            .single()
        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
        return NextResponse.json(data)
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
}
