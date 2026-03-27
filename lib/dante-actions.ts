import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
)

// --- Types ---

export interface DanteAction {
    type: 'move_lead' | 'assign_lead' | 'toggle_autopilot' | 'search_lead'
    params: Record<string, any>
}

interface ActionResult {
    success: boolean
    message: string
    is_info?: boolean // If true, the result is informational (no confirmation needed)
}

// --- Main Executor ---

export async function executeDanteAction(orgId: string, action: DanteAction): Promise<ActionResult> {
    switch (action.type) {
        case 'move_lead':
            return moveLead(orgId, action.params)
        case 'assign_lead':
            return assignLead(orgId, action.params)
        case 'toggle_autopilot':
            return toggleAutopilot(orgId, action.params)
        case 'search_lead':
            return searchLead(orgId, action.params)
        default:
            return { success: false, message: `Azione sconosciuta: ${action.type}` }
    }
}

// --- CRM: Move Lead ---

async function moveLead(orgId: string, params: Record<string, any>): Promise<ActionResult> {
    const { lead_name, target_stage, product, value } = params

    // Find the lead by name (fuzzy)
    const { data: leads } = await supabaseAdmin
        .from('leads')
        .select('id, name, stage_id, value, product')
        .eq('organization_id', orgId)
        .ilike('name', `%${lead_name}%`)
        .order('created_at', { ascending: false })
        .limit(5)

    if (!leads || leads.length === 0) {
        return { success: false, message: `❌ Lead "${lead_name}" non trovato nel CRM.` }
    }

    // Use closest match (first result)
    const lead = leads[0]

    // Find the target stage — scoped to the lead's pipeline
    const { data: stages } = await supabaseAdmin
        .from('pipeline_stages')
        .select('id, name, slug, is_won, fire_capi_event, pipeline_id')
        .eq('organization_id', orgId)

    if (!stages || stages.length === 0) {
        return { success: false, message: '❌ Nessuno stage trovato nella pipeline.' }
    }

    // Find lead's current pipeline
    const currentStage = stages.find(s => s.id === lead.stage_id)
    const leadPipelineId = currentStage?.pipeline_id

    // Match stage by name (normalized: strip hyphens, underscores, extra spaces)
    const normalize = (s: string) => s.toLowerCase().replace(/[-_]/g, ' ').replace(/\s+/g, ' ').trim()
    const targetNorm = normalize(target_stage)

    const matchStage = (s: any) =>
        normalize(s.name) === targetNorm ||
        normalize(s.name).includes(targetNorm) ||
        targetNorm.includes(normalize(s.name)) ||
        normalize(s.slug || '') === targetNorm

    // First: try matching within the lead's pipeline
    let stage = leadPipelineId
        ? stages.find(s => s.pipeline_id === leadPipelineId && matchStage(s))
        : null

    // Fallback: match any pipeline
    if (!stage) {
        stage = stages.find(matchStage)
    }

    if (!stage) {
        const pipelineStages = leadPipelineId
            ? stages.filter(s => s.pipeline_id === leadPipelineId)
            : stages
        const uniqueNames = [...new Set(pipelineStages.map(s => s.name))]
        return { success: false, message: `❌ Stage "${target_stage}" non trovato. Stage disponibili: ${uniqueNames.join(', ')}` }
    }

    // Prepare update
    const updateData: any = {
        stage_id: stage.id,
        _old_stage_id: lead.stage_id, // Needed for CAPI event trigger in leads/route.ts
    }

    // If moving to a "won" stage (Vendita), require BOTH product AND value
    if (stage.is_won) {
        const finalValue = value || lead.value
        const finalProduct = product || lead.product
        if (!finalValue || Number(finalValue) <= 0) {
            return { success: false, message: `❌ Per spostare in "${stage.name}" serve il <b>valore (€)</b>. Chiedi ad Anto prodotto e prezzo.` }
        }
        if (!finalProduct) {
            return { success: false, message: `❌ Per spostare in "${stage.name}" serve il <b>prodotto</b> (Platinum o Impact). Chiedi ad Anto.` }
        }
        updateData.value = Number(finalValue)
        updateData.product = finalProduct
    } else {
        // For non-won stages, still set value/product if provided
        if (value) updateData.value = Number(value)
        if (product) updateData.product = product
    }

    // Execute update directly (we handle CAPI + activity here since we bypass the API route)
    const { error: updateErr } = await supabaseAdmin
        .from('leads')
        .update({
            stage_id: stage.id,
            ...(updateData.value !== undefined ? { value: updateData.value } : {}),
            ...(updateData.product !== undefined ? { product: updateData.product } : {}),
            updated_at: new Date().toISOString(),
        })
        .eq('id', lead.id)

    if (updateErr) {
        return { success: false, message: `❌ Errore aggiornamento: ${updateErr.message}` }
    }

    // Log activity (fire and forget)
    try {
        await supabaseAdmin.from('lead_activities').insert({
            organization_id: orgId,
            lead_id: lead.id,
            activity_type: 'stage_changed',
            from_stage_id: lead.stage_id,
            to_stage_id: stage.id,
            notes: 'Azione eseguita da Dante via Telegram',
        })
    } catch {}

    // Fire CAPI event if configured on this stage
    if (stage.fire_capi_event) {
        try {
            const { data: leadData } = await supabaseAdmin
                .from('leads')
                .select('name, email, phone, value, meta_data, funnel_id')
                .eq('id', lead.id)
                .single()

            if (leadData) {
                const meta = leadData.meta_data || {} as any
                const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://landing.metodosincro.com'

                await fetch(`${baseUrl}/api/leads`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${process.env.CRON_SECRET}`,
                    },
                    body: JSON.stringify({
                        id: lead.id,
                        stage_id: stage.id,
                        _old_stage_id: lead.stage_id,
                        ...(updateData.value !== undefined ? { value: updateData.value } : {}),
                        ...(updateData.product !== undefined ? { product: updateData.product } : {}),
                    }),
                }).catch(() => {})
            }
        } catch (e) {
            console.error('Dante CAPI fire error:', e)
        }
    }

    let msg = `✅ <b>${lead.name}</b> spostato in <b>${stage.name}</b>`
    if (product) msg += ` (${product})`
    if (value) msg += ` — €${Number(value).toLocaleString('it-IT')}`
    return { success: true, message: msg }
}

// --- CRM: Assign Lead ---

async function assignLead(orgId: string, params: Record<string, any>): Promise<ActionResult> {
    const { lead_name, assignee_name } = params

    // Find lead
    const { data: leads } = await supabaseAdmin
        .from('leads')
        .select('id, name')
        .eq('organization_id', orgId)
        .ilike('name', `%${lead_name}%`)
        .order('created_at', { ascending: false })
        .limit(5)

    if (!leads || leads.length === 0) {
        return { success: false, message: `❌ Lead "${lead_name}" non trovato.` }
    }

    const lead = leads[0]

    // Find member by name
    const { data: members } = await supabaseAdmin
        .from('organization_members')
        .select('user_id, profiles:user_id (full_name)')
        .eq('organization_id', orgId)

    if (!members || members.length === 0) {
        return { success: false, message: '❌ Nessun membro nel team.' }
    }

    const assigneeNorm = assignee_name.toLowerCase().trim()
    const member = members.find((m: any) => {
        const name = Array.isArray(m.profiles) ? m.profiles[0]?.full_name : m.profiles?.full_name
        return name?.toLowerCase().includes(assigneeNorm)
    })

    if (!member) {
        const available = members.map((m: any) => {
            const name = Array.isArray(m.profiles) ? m.profiles[0]?.full_name : m.profiles?.full_name
            return name || 'Sconosciuto'
        }).join(', ')
        return { success: false, message: `❌ Membro "${assignee_name}" non trovato. Disponibili: ${available}` }
    }

    const memberName = Array.isArray((member as any).profiles)
        ? (member as any).profiles[0]?.full_name
        : (member as any).profiles?.full_name

    const { error } = await supabaseAdmin
        .from('leads')
        .update({ assigned_to: member.user_id, updated_at: new Date().toISOString() })
        .eq('id', lead.id)

    if (error) {
        return { success: false, message: `❌ Errore: ${error.message}` }
    }

    // Log activity (fire and forget)
    try {
        await supabaseAdmin.from('lead_activities').insert({
            organization_id: orgId,
            lead_id: lead.id,
            activity_type: 'assigned',
            notes: `Assegnato a ${memberName} da Dante via Telegram`,
        })
    } catch {}

    return { success: true, message: `✅ <b>${lead.name}</b> assegnato a <b>${memberName}</b>` }
}

// --- Autopilot Toggle ---

async function toggleAutopilot(orgId: string, params: Record<string, any>): Promise<ActionResult> {
    const { active } = params
    const newState = active === true || active === 'true'

    const { error } = await supabaseAdmin
        .from('ai_agent_config')
        .update({
            autopilot_active: newState,
            updated_at: new Date().toISOString(),
        })
        .eq('organization_id', orgId)

    if (error) {
        return { success: false, message: `❌ Errore: ${error.message}` }
    }

    const stateText = newState ? '✅ ATTIVATO' : '❌ DISATTIVATO'
    return { success: true, message: `${stateText} — Il Pilota Automatico è ora <b>${newState ? 'acceso' : 'spento'}</b>.` }
}

// --- CRM: Search Lead (read-only, no confirmation needed) ---

async function searchLead(orgId: string, params: Record<string, any>): Promise<ActionResult> {
    const { query } = params

    if (!query || query.length < 2) {
        return { success: false, message: '❌ Specifica almeno 2 caratteri per la ricerca.' }
    }

    // Search across ALL leads (no limit) by name, email, or phone
    const { data: leads } = await supabaseAdmin
        .from('leads')
        .select('id, name, email, phone, stage_id, value, product, utm_source, utm_campaign, created_at, notes, meta_data')
        .eq('organization_id', orgId)
        .or(`name.ilike.%${query}%,email.ilike.%${query}%,phone.ilike.%${query}%`)
        .order('created_at', { ascending: false })
        .limit(10)

    if (!leads || leads.length === 0) {
        return { success: false, message: `❌ Nessun lead trovato per "<b>${query}</b>".`, is_info: true }
    }

    // Get stages for display
    const { data: stages } = await supabaseAdmin
        .from('pipeline_stages')
        .select('id, name')
        .eq('organization_id', orgId)

    const stageMap = new Map((stages || []).map(s => [s.id, s.name]))

    const fmtDate = (iso: string) => {
        try {
            return new Date(iso).toLocaleString('it-IT', {
                timeZone: 'Europe/Rome',
                day: '2-digit', month: '2-digit', year: 'numeric',
                hour: '2-digit', minute: '2-digit'
            })
        } catch { return iso }
    }

    const results = leads.map((l, i) => {
        const stageName = stageMap.get(l.stage_id) || 'Non assegnato'
        const childAge = l.meta_data?.child_age || ''
        const parts = [
            `${i + 1}. <b>${l.name}</b>`,
            `   📍 Stage: ${stageName}`,
            `   📞 ${l.phone || 'N/A'} | 📧 ${l.email || 'N/A'}`,
            l.utm_source ? `   📡 Fonte: ${l.utm_source}${l.utm_campaign ? ` / ${l.utm_campaign}` : ''}` : '',
            l.value ? `   💰 Valore: €${l.value}` : '',
            l.product ? `   📦 Prodotto: ${l.product}` : '',
            childAge ? `   👦 Età figlio: ${childAge}` : '',
            l.notes ? `   📝 Note: ${l.notes}` : '',
            `   🕐 Arrivo: ${fmtDate(l.created_at)}`,
        ].filter(Boolean)
        return parts.join('\n')
    }).join('\n\n')

    return {
        success: true,
        message: `🔍 <b>Risultati per "${query}"</b> (${leads.length} trovati):\n\n${results}`,
        is_info: true,
    }
}

// --- Pending Actions Management ---

export async function savePendingAction(
    orgId: string,
    chatId: string,
    action: DanteAction,
    confirmationMessage: string,
    responseMode: 'text' | 'voice' = 'text'
): Promise<void> {
    // Expire any previous pending actions for this chat
    await supabaseAdmin
        .from('dante_pending_actions')
        .update({ status: 'expired' })
        .eq('chat_id', chatId)
        .eq('status', 'pending')

    // Insert new pending action
    await supabaseAdmin
        .from('dante_pending_actions')
        .insert({
            organization_id: orgId,
            chat_id: chatId,
            action_type: action.type,
            action_params: action.params,
            confirmation_message: confirmationMessage,
            status: 'pending',
            response_mode: responseMode,
        })
}

export async function getPendingAction(chatId: string): Promise<{
    id: string
    organization_id: string
    action_type: string
    action_params: any
    confirmation_message: string
    response_mode: string
} | null> {
    const { data } = await supabaseAdmin
        .from('dante_pending_actions')
        .select('id, organization_id, action_type, action_params, confirmation_message, expires_at, response_mode')
        .eq('chat_id', chatId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

    if (!data) return null

    // Check expiry
    if (new Date(data.expires_at) < new Date()) {
        await supabaseAdmin
            .from('dante_pending_actions')
            .update({ status: 'expired' })
            .eq('id', data.id)
        return null
    }

    return data
}

export async function confirmPendingAction(actionId: string): Promise<void> {
    await supabaseAdmin
        .from('dante_pending_actions')
        .update({ status: 'confirmed' })
        .eq('id', actionId)
}

export async function cancelPendingAction(actionId: string): Promise<void> {
    await supabaseAdmin
        .from('dante_pending_actions')
        .update({ status: 'cancelled' })
        .eq('id', actionId)
}
