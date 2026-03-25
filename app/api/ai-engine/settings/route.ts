import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

// GET — read agent config + recent logs + budget tracking
export async function GET(req: NextRequest) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: member } = await supabase
        .from('organization_members')
        .select('organization_id')
        .eq('user_id', user.id)
        .single()

    if (!member) return NextResponse.json({ error: 'No organization' }, { status: 404 })

    const orgId = member.organization_id

    const [configRes, logsRes, budgetRes] = await Promise.all([
        supabase
            .from('ai_agent_config')
            .select('*')
            .eq('organization_id', orgId)
            .single(),
        supabase
            .from('ai_agent_logs')
            .select('*')
            .eq('organization_id', orgId)
            .order('created_at', { ascending: false })
            .limit(30),
        supabase
            .from('ai_budget_tracking')
            .select('*')
            .eq('organization_id', orgId)
            .order('updated_at', { ascending: false })
            .limit(10),
    ])

    return NextResponse.json({
        config: configRes.data || null,
        logs: logsRes.data || [],
        budget: budgetRes.data || [],
    })
}

// POST — save/update agent config
export async function POST(req: NextRequest) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: member } = await supabase
        .from('organization_members')
        .select('organization_id')
        .eq('user_id', user.id)
        .single()

    if (!member) return NextResponse.json({ error: 'No organization' }, { status: 404 })

    const body = await req.json()
    const orgId = member.organization_id

    // Upsert config
    const { data, error } = await supabase
        .from('ai_agent_config')
        .upsert({
            organization_id: orgId,
            budget_daily: body.budget_daily ?? 0,
            budget_weekly: body.budget_weekly ?? 0,
            budget_monthly: body.budget_monthly ?? 0,
            auto_pause_enabled: body.auto_pause_enabled ?? false,
            auto_scale_enabled: body.auto_scale_enabled ?? false,
            auto_creative_refresh: body.auto_creative_refresh ?? false,
            autopilot_active: body.autopilot_active ?? false,
            analysis_interval_minutes: body.analysis_interval_minutes ?? 60,
            risk_tolerance: body.risk_tolerance ?? 'medium',
            execution_mode: body.execution_mode ?? 'dry_run',
            objectives: body.objectives ?? { target_cpl: 0, target_roas: 0, target_ctr: 0 },
            updated_at: new Date().toISOString(),
        }, { onConflict: 'organization_id' })
        .select()
        .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ config: data })
}
