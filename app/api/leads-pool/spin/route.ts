import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { romeDateString, romeTimeString, romeDayOfWeek } from '@/lib/timezone'

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

    // ── Check orario permesso (in ora italiana Europe/Rome, non UTC del server) ──
    const now = new Date()
    const todayDayOfWeek = romeDayOfWeek(now) // 1=Mon, 7=Sun
    const currentTime = romeTimeString(now)   // 'HH:MM' ora italiana

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

    // ── Check quota giornaliera (data in ora italiana) ──
    const today = romeDateString(now)
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

    // ── Estrazione ATOMICA dal pool (anti-race, FOR UPDATE SKIP LOCKED) ──
    // La RPC claim_pool_leads seleziona, blocca e assegna in un'unica
    // transazione: due venditori non possono mai ottenere lo stesso lead.
    // Rispetta active_list_ids, dedup 72h per venditore ed esclusione
    // dei numeri già presenti nel CRM leads.

    const assignedAt = new Date().toISOString()

    // Crea prima la sessione (vuota), poi la RPC vi collega i lead estratti
    const { data: newSession, error: sessionError } = await supabaseAdmin
        .from('lead_distribution_sessions')
        .insert({
            organization_id: orgId,
            user_id: userId,
            lead_pool_ids: [],
            batch_size: batchSize,
            request_message: requestMessage,
            status: 'active',
        })
        .select()
        .single()

    if (sessionError || !newSession) {
        return NextResponse.json({ error: 'Errore nella creazione della sessione' }, { status: 500 })
    }

    const { data: filteredLeads, error: claimError } = await supabaseAdmin
        .rpc('claim_pool_leads', {
            p_org: orgId,
            p_user: userId,
            p_batch: batchSize,
            p_list_ids: (rule.active_list_ids && rule.active_list_ids.length > 0) ? rule.active_list_ids : null,
            p_session: newSession.id,
            p_dedup_hours: 72,
        })

    if (claimError) {
        console.error('[SPIN] claim_pool_leads error:', claimError)
        // Rollback della sessione vuota
        await supabaseAdmin.from('lead_distribution_sessions').delete().eq('id', newSession.id)
        return NextResponse.json({ error: 'Errore nel recupero dei leads' }, { status: 500 })
    }

    if (!filteredLeads || filteredLeads.length === 0) {
        // Nessun lead: elimina la sessione vuota appena creata
        await supabaseAdmin.from('lead_distribution_sessions').delete().eq('id', newSession.id)
        return NextResponse.json({
            error: 'Nessun lead disponibile al momento',
            code: 'NO_LEADS_AVAILABLE',
            detail: 'Il pool di leads è esaurito o tutti i leads sono già stati assegnati di recente.'
        }, { status: 404 })
    }

    const extractedIds = filteredLeads.map((l: any) => l.id)

    // ── Aggiorna la sessione con i lead effettivamente estratti ──
    await supabaseAdmin
        .from('lead_distribution_sessions')
        .update({ lead_pool_ids: extractedIds, batch_size: filteredLeads.length })
        .eq('id', newSession.id)

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
    const listIds = [...new Set(filteredLeads.map((l: any) => l.list_id).filter(Boolean))]
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
