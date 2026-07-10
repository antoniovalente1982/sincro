import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'

export async function POST(request: Request) {
    const supabase = await createClient()
    const supabaseAdmin = getSupabaseAdmin()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
        return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })
    }

    // Fetch membership + org
    const { data: member } = await supabase
        .from('organization_members')
        .select('organization_id, role, department')
        .eq('user_id', user.id)
        .is('deactivated_at', null)
        .single()

    if (!member) {
        return NextResponse.json({ error: 'Utente non appartiene a nessuna organizzazione' }, { status: 403 })
    }

    const orgId = member.organization_id
    const userId = user.id

    // Only closers, managers, owners, admins can spin
    const allowedRoles = ['closer', 'manager', 'owner', 'admin']
    if (!allowedRoles.includes(member.role)) {
        return NextResponse.json({ error: 'Ruolo non autorizzato a richiedere leads' }, { status: 403 })
    }

    // Parse optional request body (motivational message)
    let requestMessage: string | null = null
    try {
        const body = await request.json()
        requestMessage = body?.message || null
    } catch {}

    // ── Fetch rules: user-specific first, then org default ──
    const { data: rules } = await supabase
        .from('lead_distribution_rules')
        .select('*')
        .eq('organization_id', orgId)
        .or(`user_id.eq.${userId},user_id.is.null`)
        .order('user_id', { ascending: false }) // user-specific first
        .limit(2)

    const rule = rules?.find(r => r.user_id === userId) || rules?.find(r => r.user_id === null) || {
        max_leads_per_day: 50,
        batch_size: 5,
        cooldown_minutes: 0,
        require_feedback_before_next: true,
        min_feedback_pct: 60,
        active_list_ids: null,
        allowed_hours_start: '08:00',
        allowed_hours_end: '21:00',
        allowed_days: [1, 2, 3, 4, 5, 6],
    }

    // ── Check orario permesso ──
    const now = new Date()
    const todayDayOfWeek = now.getDay() === 0 ? 7 : now.getDay() // 1=Mon, 7=Sun
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`

    if (rule.allowed_days && !rule.allowed_days.includes(todayDayOfWeek)) {
        return NextResponse.json({
            error: 'Fuori dagli orari permessi per oggi',
            code: 'OUT_OF_HOURS',
            detail: `Puoi richiedere leads solo nei giorni: ${rule.allowed_days.join(', ')}`
        }, { status: 403 })
    }

    if (rule.allowed_hours_start && rule.allowed_hours_end) {
        if (currentTime < rule.allowed_hours_start || currentTime > rule.allowed_hours_end) {
            return NextResponse.json({
                error: 'Fuori dagli orari permessi',
                code: 'OUT_OF_HOURS',
                detail: `Puoi richiedere leads dalle ${rule.allowed_hours_start} alle ${rule.allowed_hours_end}`
            }, { status: 403 })
        }
    }

    // ── Check quota giornaliera ──
    const today = now.toISOString().split('T')[0]
    const { data: quota } = await supabase
        .from('lead_daily_quota')
        .select('*')
        .eq('organization_id', orgId)
        .eq('user_id', userId)
        .eq('quota_date', today)
        .maybeSingle()

    const currentRequested = quota?.leads_requested || 0
    const maxAllowed = quota?.max_allowed || rule.max_leads_per_day
    const batchSize = rule.batch_size || 5

    if (currentRequested + batchSize > maxAllowed) {
        const remaining = Math.max(0, maxAllowed - currentRequested)
        return NextResponse.json({
            error: `Quota giornaliera raggiunta`,
            code: 'QUOTA_EXCEEDED',
            detail: `Hai richiesto ${currentRequested}/${maxAllowed} leads oggi. ${remaining > 0 ? `Puoi richiedere ancora ${remaining}.` : 'Quota esaurita per oggi.'}`,
            quota: { requested: currentRequested, max: maxAllowed, remaining }
        }, { status: 429 })
    }

    // ── Check sessione attiva + feedback obbligatorio ──
    const { data: activeSession } = await supabase
        .from('lead_distribution_sessions')
        .select('*')
        .eq('organization_id', orgId)
        .eq('user_id', userId)
        .eq('status', 'active')
        .order('requested_at', { ascending: false })
        .limit(1)
        .maybeSingle()

    if (activeSession && rule.require_feedback_before_next) {
        // Check feedback completion
        const { data: sessionLeads } = await supabase
            .from('lead_pool')
            .select('id, feedback')
            .in('id', activeSession.lead_pool_ids || [])

        const total = sessionLeads?.length || 0
        const withFeedback = sessionLeads?.filter(l => l.feedback !== null).length || 0
        const pct = total > 0 ? Math.round((withFeedback / total) * 100) : 100

        const minPct = rule.min_feedback_pct || 100

        if (pct < minPct) {
            return NextResponse.json({
                error: 'Devi aggiornare il feedback sui leads correnti',
                code: 'FEEDBACK_REQUIRED',
                detail: `Hai completato ${pct}% dei feedback (minimo ${minPct}%). Aggiorna ${total - withFeedback} leads prima di richiederne altri.`,
                session: {
                    id: activeSession.id,
                    total,
                    withFeedback,
                    pct,
                    minRequired: minPct
                }
            }, { status: 403 })
        }

        // Close the active session
        await supabase
            .from('lead_distribution_sessions')
            .update({ status: 'completed', completed_at: new Date().toISOString() })
            .eq('id', activeSession.id)
    }

    // ── Cooldown check ──
    if (rule.cooldown_minutes > 0 && activeSession) {
        const lastSpin = new Date(activeSession.requested_at)
        const cooldownMs = rule.cooldown_minutes * 60 * 1000
        const elapsed = Date.now() - lastSpin.getTime()
        if (elapsed < cooldownMs) {
            const waitSeconds = Math.ceil((cooldownMs - elapsed) / 1000)
            return NextResponse.json({
                error: 'Cooldown attivo',
                code: 'COOLDOWN',
                detail: `Attendi ancora ${Math.ceil(waitSeconds / 60)} minuti prima del prossimo spin.`,
                waitSeconds
            }, { status: 429 })
        }
    }

    // ── Estrai leads dal pool (algoritmo smart) ──
    // Priorità: 
    // 1. status = 'available' e mai assegnato
    // 2. status = 'recycled'
    // 3. priority_score DESC
    // 4. Non assegnato a questo venditore nelle ultime 72h
    // Rispetta active_list_ids se configurato
    // Esclude phone già presenti nella tabella leads CRM

    // Prima ottieni i telefoni già assegnati a questo venditore di recente
    const { data: recentlyAssigned } = await supabaseAdmin
        .from('lead_pool')
        .select('phone')
        .eq('organization_id', orgId)
        .eq('assigned_to', userId)
        .gte('assigned_at', new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString())
        .not('phone', 'is', null)

    const excludedPhones = recentlyAssigned?.map(l => l.phone).filter(Boolean) || []

    // Build query for available leads
    let query = supabaseAdmin
        .from('lead_pool')
        .select('*')
        .eq('organization_id', orgId)
        .in('status', ['available', 'recycled'])
        .order('status', { ascending: true })      // 'available' < 'recycled'
        .order('priority_score', { ascending: false })
        .order('created_at', { ascending: true })  // FIFO per stesso score
        .limit(batchSize * 3)                      // over-fetch per filtering

    // Filter by active lists if configured
    if (rule.active_list_ids && rule.active_list_ids.length > 0) {
        query = query.in('list_id', rule.active_list_ids)
    }

    const { data: candidateLeads, error: poolError } = await query

    if (poolError) {
        console.error('[SPIN] Pool query error:', poolError)
        return NextResponse.json({ error: 'Errore nel recupero dei leads' }, { status: 500 })
    }

    // Filter out excluded phones
    const filteredLeads = (candidateLeads || []).filter(l =>
        !l.phone || !excludedPhones.includes(l.phone)
    ).slice(0, batchSize)

    if (filteredLeads.length === 0) {
        return NextResponse.json({
            error: 'Nessun lead disponibile al momento',
            code: 'NO_LEADS_AVAILABLE',
            detail: 'Il pool di leads è esaurito o tutti i leads sono già stati assegnati di recente.'
        }, { status: 404 })
    }

    const extractedIds = filteredLeads.map(l => l.id)
    const assignedAt = new Date().toISOString()

    // ── Crea sessione ──
    const { data: newSession, error: sessionError } = await supabaseAdmin
        .from('lead_distribution_sessions')
        .insert({
            organization_id: orgId,
            user_id: userId,
            lead_pool_ids: extractedIds,
            batch_size: filteredLeads.length,
            request_message: requestMessage,
            status: 'active',
        })
        .select()
        .single()

    if (sessionError || !newSession) {
        return NextResponse.json({ error: 'Errore nella creazione della sessione' }, { status: 500 })
    }

    // ── Aggiorna lead_pool: assegnati ──
    await supabaseAdmin
        .from('lead_pool')
        .update({
            status: 'assigned',
            assigned_to: userId,
            assigned_at: assignedAt,
            session_id: newSession.id,
            updated_at: assignedAt,
        })
        .in('id', extractedIds)

    // ── Upsert quota giornaliera ──
    await supabaseAdmin
        .from('lead_daily_quota')
        .upsert({
            organization_id: orgId,
            user_id: userId,
            quota_date: today,
            leads_requested: currentRequested + filteredLeads.length,
            spins_count: (quota?.spins_count || 0) + 1,
            max_allowed: maxAllowed,
            updated_at: assignedAt,
        }, {
            onConflict: 'organization_id,user_id,quota_date',
            ignoreDuplicates: false,
        })

    // ── Aggiorna available_count nelle liste ──
    const listIds = [...new Set(filteredLeads.map(l => l.list_id).filter(Boolean))]
    for (const listId of listIds) {
        const { count: countAvail } = await supabaseAdmin
            .from('lead_pool')
            .select('*', { count: 'exact', head: true })
            .eq('list_id', listId)
            .eq('status', 'available')

        await supabaseAdmin
            .from('lead_lists')
            .update({ available_count: countAvail || 0, updated_at: assignedAt })
            .eq('id', listId)
    }

    return NextResponse.json({
        success: true,
        session: newSession,
        leads: filteredLeads,
        quota: {
            requested: currentRequested + filteredLeads.length,
            max: maxAllowed,
            remaining: maxAllowed - currentRequested - filteredLeads.length,
            spins: (quota?.spins_count || 0) + 1,
        }
    })
}
