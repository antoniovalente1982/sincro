import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { romeDateString, romeDateStringDaysAgo } from '@/lib/timezone'

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
    const today = romeDateString()

    // Fetch in parallel
    const [quotaRes, sessionRes, rulesRes, historyRes, callbackRes, interestedRes] = await Promise.all([
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
            .gte('quota_date', romeDateStringDaysAgo(30))
            .order('quota_date', { ascending: true }),

        // Callback / unresolved leads assigned to this user — ordinati per scadenza richiamo
        supabase
            .from('lead_pool')
            .select('id, full_name, first_name, last_name, phone, email, city, province, feedback, status, call_count, assigned_at, callback_at, notes')
            .eq('organization_id', orgId)
            .eq('assigned_to', user.id)
            .in('status', ['assigned', 'called'])
            .in('feedback', ['callback', 'no_answer'])
            .order('callback_at', { ascending: true, nullsFirst: false }),

        // Interested leads (coda follow-up) assigned to this user
        supabase
            .from('lead_pool')
            .select('id, full_name, first_name, last_name, phone, email, city, province, feedback, status, call_count, assigned_at, notes')
            .eq('organization_id', orgId)
            .eq('assigned_to', user.id)
            .eq('status', 'called')
            .eq('feedback', 'interested')
            .order('updated_at', { ascending: false }),
    ])

    const quota = quotaRes.data
    const activeSession = sessionRes.data
    const rules = rulesRes.data || []
    const rule = rules.find(r => r.user_id === user.id) || rules.find(r => r.user_id === null)
    const history = historyRes.data || []
    const callbackLeads = callbackRes.data || []
    const interestedLeads = interestedRes.data || []

    const maxAllowed = quota?.max_allowed || rule?.max_leads_per_day || 50

    const LEAD_FIELDS = 'id, full_name, first_name, last_name, phone, email, city, province, feedback, status, call_count, assigned_at, callback_at, appointment_at'

    const fetchAssignedUnworked = async () => {
        // Leads assegnati ma non ancora lavorati (assegnati manualmente
        // dall'admin o sessione chiusa prima che venissero chiamati)
        const { data: leads } = await supabase
            .from('lead_pool')
            .select(LEAD_FIELDS)
            .eq('organization_id', orgId)
            .eq('assigned_to', user.id)
            .eq('status', 'assigned')
            .is('feedback', null)
            .order('assigned_at', { ascending: false })
        return leads || []
    }

    // Fetch current session leads if active
    let sessionLeads: any[] = []
    let liveSession = activeSession
    if (activeSession?.lead_pool_ids?.length) {
        // Sessione attiva: mostra i leads della sessione
        const { data: leads } = await supabase
            .from('lead_pool')
            .select(LEAD_FIELDS)
            .in('id', activeSession.lead_pool_ids)
        sessionLeads = leads || []

        // I leads della sessione possono essere spariti dalla vista del
        // venditore (riciclati dal cron, riassegnati o cancellati). In quel
        // caso la sessione resta "active" con contatori vecchi e il gate
        // feedback la blocca per sempre: non vede i leads, quindi non può
        // dare il feedback che le viene richiesto. Chiudiamo la sessione
        // orfana e ripieghiamo sui leads ancora assegnati.
        if (sessionLeads.length === 0) {
            await supabase
                .from('lead_distribution_sessions')
                .update({ status: 'completed', completed_at: new Date().toISOString() })
                .eq('id', activeSession.id)
            liveSession = null
            sessionLeads = await fetchAssignedUnworked()
        }
    } else {
        sessionLeads = await fetchAssignedUnworked()
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
        // I contatori del gate feedback si ricalcolano sui leads davvero
        // visibili al venditore, non sui contatori denormalizzati della
        // sessione: se un lead è stato riciclato o riassegnato non può più
        // essere lavorato e non deve bloccare lo spin successivo.
        active_session: liveSession ? {
            id: liveSession.id,
            requested_at: liveSession.requested_at,
            leads_called: sessionLeads.filter(l => l.call_count > 0).length,
            leads_with_feedback: sessionLeads.filter(l => l.feedback !== null).length,
            total_leads: sessionLeads.length,
        } : null,
        session_leads: sessionLeads,
        callback_leads: callbackLeads,
        interested_leads: interestedLeads,
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
