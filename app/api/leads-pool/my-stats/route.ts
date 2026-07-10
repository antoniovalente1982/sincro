import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET /api/leads-pool/my-stats
// KPI personali del venditore + sessione corrente
export async function GET() {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
        return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })
    }

    const { data: member } = await supabase
        .from('organization_members')
        .select('organization_id, role')
        .eq('user_id', user.id)
        .is('deactivated_at', null)
        .single()

    if (!member) return NextResponse.json({ error: 'Organizzazione non trovata' }, { status: 403 })

    const orgId = member.organization_id
    const today = new Date().toISOString().split('T')[0]

    // Fetch in parallel
    const [quotaRes, sessionRes, rulesRes, historyRes] = await Promise.all([
        // Today's quota
        supabase
            .from('lead_daily_quota')
            .select('*')
            .eq('organization_id', orgId)
            .eq('user_id', user.id)
            .eq('quota_date', today)
            .maybeSingle(),

        // Active session with leads
        supabase
            .from('lead_distribution_sessions')
            .select('*')
            .eq('organization_id', orgId)
            .eq('user_id', user.id)
            .eq('status', 'active')
            .order('requested_at', { ascending: false })
            .limit(1)
            .maybeSingle(),

        // Rules for this user
        supabase
            .from('lead_distribution_rules')
            .select('*')
            .eq('organization_id', orgId)
            .or(`user_id.eq.${user.id},user_id.is.null`)
            .order('user_id', { ascending: false })
            .limit(2),

        // Last 30 days history
        supabase
            .from('lead_daily_quota')
            .select('quota_date, leads_requested, leads_called, leads_converted, spins_count')
            .eq('organization_id', orgId)
            .eq('user_id', user.id)
            .gte('quota_date', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
            .order('quota_date', { ascending: true }),
    ])

    const quota = quotaRes.data
    const activeSession = sessionRes.data
    const rules = rulesRes.data || []
    const rule = rules.find(r => r.user_id === user.id) || rules.find(r => r.user_id === null)
    const history = historyRes.data || []

    const maxAllowed = quota?.max_allowed || rule?.max_leads_per_day || 50

    // Fetch current session leads if active
    let sessionLeads: any[] = []
    if (activeSession?.lead_pool_ids?.length) {
        const { data: leads } = await supabase
            .from('lead_pool')
            .select('id, full_name, first_name, last_name, phone, email, city, province, feedback, status, call_count, assigned_at')
            .in('id', activeSession.lead_pool_ids)
        sessionLeads = leads || []
    }

    // Compute 7-day streak
    let streak = 0
    const sortedHistory = [...history].sort((a, b) => new Date(b.quota_date).getTime() - new Date(a.quota_date).getTime())
    for (const entry of sortedHistory) {
        if (entry.leads_requested > 0) streak++
        else break
    }

    // Compute call rate
    const totalRequested = history.reduce((s, h) => s + (h.leads_requested || 0), 0)
    const totalCalled = history.reduce((s, h) => s + (h.leads_called || 0), 0)
    const totalConverted = history.reduce((s, h) => s + (h.leads_converted || 0), 0)
    const callRate = totalRequested > 0 ? Math.round((totalCalled / totalRequested) * 100) : 0
    const conversionRate = totalCalled > 0 ? Math.round((totalConverted / totalCalled) * 100) : 0

    return NextResponse.json({
        today: {
            leads_requested: quota?.leads_requested || 0,
            leads_called: quota?.leads_called || 0,
            leads_converted: quota?.leads_converted || 0,
            spins_count: quota?.spins_count || 0,
            max_allowed: maxAllowed,
            remaining: Math.max(0, maxAllowed - (quota?.leads_requested || 0)),
        },
        active_session: activeSession ? {
            id: activeSession.id,
            requested_at: activeSession.requested_at,
            leads_called: activeSession.leads_called,
            leads_with_feedback: activeSession.leads_with_feedback,
            total_leads: activeSession.lead_pool_ids?.length || 0,
        } : null,
        session_leads: sessionLeads,
        rules: rule ? {
            max_leads_per_day: rule.max_leads_per_day,
            batch_size: rule.batch_size,
            cooldown_minutes: rule.cooldown_minutes,
            require_feedback_before_next: rule.require_feedback_before_next,
            min_feedback_pct: rule.min_feedback_pct,
            allowed_hours_start: rule.allowed_hours_start,
            allowed_hours_end: rule.allowed_hours_end,
        } : null,
        kpi: {
            streak_days: streak,
            call_rate: callRate,
            conversion_rate: conversionRate,
            total_requested_30d: totalRequested,
            total_called_30d: totalCalled,
            total_converted_30d: totalConverted,
        },
        history: history.map(h => ({
            date: h.quota_date,
            requested: h.leads_requested,
            called: h.leads_called,
            converted: h.leads_converted,
        })),
    })
}
