import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// POST /api/leads-pool/feedback
// Aggiorna il feedback su un singolo lead del pool
export async function POST(request: Request) {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
        return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })
    }

    const body = await request.json()
    const { lead_pool_id, feedback, feedback_notes, session_id } = body

    if (!lead_pool_id || !feedback) {
        return NextResponse.json({ error: 'lead_pool_id e feedback sono obbligatori' }, { status: 400 })
    }

    const validFeedback = ['interested', 'not_interested', 'callback', 'no_answer', 'converted', 'wrong_number']
    if (!validFeedback.includes(feedback)) {
        return NextResponse.json({ error: `Feedback non valido. Valori accettati: ${validFeedback.join(', ')}` }, { status: 400 })
    }

    const { data: member } = await supabase
        .from('organization_members')
        .select('organization_id, role')
        .eq('user_id', user.id)
        .is('deactivated_at', null)
        .single()

    if (!member) return NextResponse.json({ error: 'Organizzazione non trovata' }, { status: 403 })

    const now = new Date().toISOString()
    const today = now.split('T')[0]

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

    // Determine new status
    const newStatus = feedback === 'converted' ? 'converted' : 'called'
    const isFirstCall = !lead.first_called_at

    // Update lead_pool
    const updatePayload: Record<string, any> = {
        feedback,
        feedback_notes: feedback_notes || null,
        feedback_at: now,
        status: newStatus,
        call_count: (lead.call_count || 0) + 1,
        last_called_at: now,
        updated_at: now,
    }
    if (isFirstCall) updatePayload.first_called_at = now

    const { error: updateError } = await supabase
        .from('lead_pool')
        .update(updatePayload)
        .eq('id', lead_pool_id)

    if (updateError) {
        return NextResponse.json({ error: 'Errore aggiornamento lead' }, { status: 500 })
    }

    // Update daily quota
    const { data: quota } = await supabase
        .from('lead_daily_quota')
        .select('*')
        .eq('organization_id', member.organization_id)
        .eq('user_id', user.id)
        .eq('quota_date', today)
        .maybeSingle()

    if (quota) {
        const updateData: Record<string, any> = {
            leads_with_feedback: (quota.leads_with_feedback || 0) + 1,
            updated_at: now,
        }
        if (isFirstCall) {
            updateData.leads_called = (quota.leads_called || 0) + 1
        }
        if (feedback === 'converted') {
            updateData.leads_converted = (quota.leads_converted || 0) + 1
        }
        await supabase
            .from('lead_daily_quota')
            .update(updateData)
            .eq('id', quota.id)
    }

    // Update session feedback counts
    if (session_id) {
        const { data: session } = await supabase
            .from('lead_distribution_sessions')
            .select('lead_pool_ids, leads_called, leads_with_feedback')
            .eq('id', session_id)
            .single()

        if (session) {
            const updateSession: Record<string, any> = {
                leads_with_feedback: (session.leads_with_feedback || 0) + 1,
            }
            if (isFirstCall) {
                updateSession.leads_called = (session.leads_called || 0) + 1
            }
            await supabase
                .from('lead_distribution_sessions')
                .update(updateSession)
                .eq('id', session_id)
        }
    }

    // If converted: create CRM lead (basic)
    let crmLeadId: string | null = null
    if (feedback === 'converted') {
        const { data: crmLead } = await supabase
            .from('leads')
            .insert({
                organization_id: member.organization_id,
                full_name: lead.full_name || `${lead.first_name || ''} ${lead.last_name || ''}`.trim(),
                phone: lead.phone,
                email: lead.email,
                city: lead.city,
                closer_id: user.id,
                source: lead.source || 'lead_pool',
                utm_campaign: lead.utm_campaign,
                notes: `Importato dal pool leads. Lista: ${lead.list_id}. ${feedback_notes || ''}`,
                created_at: now,
                updated_at: now,
            })
            .select('id')
            .single()

        if (crmLead) {
            crmLeadId = crmLead.id
            // Link the crm lead back to the pool lead
            await supabase
                .from('lead_pool')
                .update({ crm_lead_id: crmLeadId })
                .eq('id', lead_pool_id)
        }
    }

    return NextResponse.json({
        success: true,
        feedback,
        new_status: newStatus,
        crm_lead_id: crmLeadId,
    })
}
