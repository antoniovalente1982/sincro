import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { romeDateString } from '@/lib/timezone'

// POST /api/leads-pool/feedback
// Aggiorna il feedback su un singolo lead del pool.
// Esiti che contano come "vittoria" (obiettivo = fissare appuntamenti):
const WIN_FEEDBACKS = ['appointment', 'converted']
const VALID_FEEDBACK = ['interested', 'not_interested', 'callback', 'no_answer', 'converted', 'wrong_number', 'appointment']

export async function POST(request: Request) {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
        return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })
    }

    const body = await request.json()
    const { lead_pool_id, feedback, feedback_notes, session_id, callback_at, appointment_at } = body

    if (!lead_pool_id || !feedback) {
        return NextResponse.json({ error: 'lead_pool_id e feedback sono obbligatori' }, { status: 400 })
    }

    if (!VALID_FEEDBACK.includes(feedback)) {
        return NextResponse.json({ error: `Feedback non valido. Valori accettati: ${VALID_FEEDBACK.join(', ')}` }, { status: 400 })
    }

    // Un appuntamento richiede sempre una data/ora
    if (feedback === 'appointment' && !appointment_at) {
        return NextResponse.json({ error: 'Per fissare un appuntamento serve data e ora' }, { status: 400 })
    }
    // Un richiamo richiede una data/ora futura
    if (feedback === 'callback' && !callback_at) {
        return NextResponse.json({ error: 'Per un richiamo serve la data/ora del richiamo' }, { status: 400 })
    }

    const { data: member } = await supabase
        .from('organization_members')
        .select('organization_id, role')
        .eq('user_id', user.id)
        .is('deactivated_at', null)
        .single()

    if (!member) return NextResponse.json({ error: 'Organizzazione non trovata' }, { status: 403 })

    const now = new Date().toISOString()
    const today = romeDateString()

    // Fetch current lead to check ownership
    const { data: lead, error: leadError } = await supabase
        .from('lead_pool')
        .select('*')
        .eq('id', lead_pool_id)
        .eq('organization_id', member.organization_id)
        .single()

    if (leadError || !lead) {
        return NextResponse.json({ error: 'Lead non trovato' }, { status: 404 })
    }

    // Check ownership (closer can only update their assigned leads, admin can update all)
    const isAdmin = ['owner', 'admin', 'manager'].includes(member.role)
    if (!isAdmin && lead.assigned_to !== user.id) {
        return NextResponse.json({ error: 'Non puoi aggiornare questo lead' }, { status: 403 })
    }

    // ── Idempotenza: i contatori si incrementano SOLO al primo esito ──
    // (cambiare esito a un lead già lavorato non deve gonfiare i KPI)
    const wasFirstFeedback = !lead.feedback
    const isFirstCall = !lead.first_called_at
    const wasWin = WIN_FEEDBACKS.includes(lead.feedback)
    const isWin = WIN_FEEDBACKS.includes(feedback)
    const becameWin = isWin && !wasWin

    // Stato risultante
    const newStatus = isWin ? 'converted' : 'called'

    // Update lead_pool
    const updatePayload: Record<string, any> = {
        feedback,
        feedback_notes: feedback_notes || null,
        feedback_at: now,
        status: newStatus,
        last_called_at: now,
        updated_at: now,
        callback_at: feedback === 'callback' ? callback_at : lead.callback_at,
        appointment_at: feedback === 'appointment' ? appointment_at : lead.appointment_at,
    }
    if (isFirstCall) {
        updatePayload.first_called_at = now
        updatePayload.call_count = (lead.call_count || 0) + 1
    }

    const { error: updateError } = await supabase
        .from('lead_pool')
        .update(updatePayload)
        .eq('id', lead_pool_id)

    if (updateError) {
        return NextResponse.json({ error: 'Errore aggiornamento lead' }, { status: 500 })
    }

    // ── Update daily quota (idempotente) ──
    const { data: quota } = await supabase
        .from('lead_daily_quota')
        .select('*')
        .eq('organization_id', member.organization_id)
        .eq('user_id', user.id)
        .eq('quota_date', today)
        .maybeSingle()

    if (quota) {
        const updateData: Record<string, any> = { updated_at: now }
        if (wasFirstFeedback) updateData.leads_with_feedback = (quota.leads_with_feedback || 0) + 1
        if (isFirstCall) updateData.leads_called = (quota.leads_called || 0) + 1
        if (becameWin) updateData.leads_converted = (quota.leads_converted || 0) + 1
        await supabase.from('lead_daily_quota').update(updateData).eq('id', quota.id)
    }

    // ── Update session feedback counts (idempotente) ──
    if (session_id && wasFirstFeedback) {
        const { data: session } = await supabase
            .from('lead_distribution_sessions')
            .select('leads_called, leads_with_feedback')
            .eq('id', session_id)
            .single()

        if (session) {
            const updateSession: Record<string, any> = {
                leads_with_feedback: (session.leads_with_feedback || 0) + 1,
            }
            if (isFirstCall) updateSession.leads_called = (session.leads_called || 0) + 1
            await supabase.from('lead_distribution_sessions').update(updateSession).eq('id', session_id)
        }
    }

    // ── Collega la chiamata più recente (Fase 3) all'esito ──
    const { data: openCall } = await supabase
        .from('lead_calls')
        .select('id')
        .eq('lead_pool_id', lead_pool_id)
        .eq('user_id', user.id)
        .is('outcome', null)
        .order('started_at', { ascending: false })
        .limit(1)
        .maybeSingle()
    if (openCall) {
        await supabase.from('lead_calls').update({ outcome: feedback, ended_at: now }).eq('id', openCall.id)
    }

    // ── Vittoria (appuntamento/convertito): crea lead CRM + evento calendario ──
    let crmLeadId: string | null = lead.crm_lead_id || null
    let calendarEventId: string | null = null

    if (isWin && becameWin) {
        // Trova lo stage di default della pipeline
        let defaultStageId: string | null = null
        const { data: pipeline } = await supabase
            .from('pipelines')
            .select('id')
            .eq('organization_id', member.organization_id)
            .eq('is_default', true)
            .limit(1)
            .maybeSingle()

        const pipelineId = pipeline?.id || (await supabase
            .from('pipelines').select('id').eq('organization_id', member.organization_id).limit(1).maybeSingle()).data?.id

        if (pipelineId) {
            const { data: stage } = await supabase
                .from('pipeline_stages')
                .select('id')
                .eq('pipeline_id', pipelineId)
                .order('sort_order', { ascending: true })
                .limit(1)
                .maybeSingle()
            defaultStageId = stage?.id || null
        }

        const leadName = lead.full_name || `${lead.first_name || ''} ${lead.last_name || ''}`.trim() || 'Lead'

        if (!crmLeadId) {
            const { data: crmLead } = await supabase
                .from('leads')
                .insert({
                    organization_id: member.organization_id,
                    name: leadName,
                    phone: lead.phone,
                    email: lead.email,
                    city: lead.city,
                    closer_id: user.id,
                    setter_id: user.id,
                    stage_id: defaultStageId,
                    source: lead.source || 'lead_pool',
                    utm_campaign: lead.utm_campaign,
                    notes: `Da Stazione Leads. Lista: ${lead.list_id}. ${feedback_notes || ''}`.trim(),
                    created_at: now,
                    updated_at: now,
                })
                .select('id')
                .single()

            if (crmLead) {
                crmLeadId = crmLead.id
                await supabase.from('lead_pool').update({ crm_lead_id: crmLeadId }).eq('id', lead_pool_id)
            }
        }

        // Evento a calendario per l'appuntamento
        if (feedback === 'appointment' && appointment_at) {
            const start = new Date(appointment_at)
            const end = new Date(start.getTime() + 30 * 60 * 1000) // durata default 30 min
            const { data: evt } = await getSupabaseAdmin()
                .from('calendar_events')
                .insert({
                    organization_id: member.organization_id,
                    lead_id: crmLeadId,
                    closer_id: user.id,
                    setter_id: user.id,
                    title: `📅 Appuntamento — ${leadName}`,
                    description: feedback_notes || `Appuntamento fissato dalla Stazione Leads`,
                    lead_phone: lead.phone,
                    lead_email: lead.email,
                    start_time: start.toISOString(),
                    end_time: end.toISOString(),
                    status: 'confirmed',
                })
                .select('id')
                .single()
            calendarEventId = evt?.id || null
        }

        // Notifica di team ("vittoria") — visibile a tutta l'org nella campanella
        const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', user.id).maybeSingle()
        const who = profile?.full_name || 'Un venditore'
        try {
            await getSupabaseAdmin().from('notifications').insert({
                organization_id: member.organization_id,
                type: 'info',
                title: feedback === 'appointment' ? '📅 Nuovo appuntamento fissato!' : '💎 Nuova conversione!',
                message: `${who} ha ${feedback === 'appointment' ? 'fissato un appuntamento con' : 'convertito'} ${leadName}.`,
                link: '/dashboard/leads-station',
                is_read: false,
            })
        } catch { /* notifica best-effort */ }
    }

    return NextResponse.json({
        success: true,
        feedback,
        new_status: newStatus,
        crm_lead_id: crmLeadId,
        calendar_event_id: calendarEventId,
    })
}
