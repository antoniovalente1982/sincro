import { createClient, SupabaseClient } from '@supabase/supabase-js'

let _supabaseAdmin: SupabaseClient | null = null
function getSupabaseAdmin() {
    if (!_supabaseAdmin) {
        _supabaseAdmin = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        )
    }
    return _supabaseAdmin
}

// --- Types ---

export interface DanteAction {
    type: 'move_lead' | 'assign_lead' | 'toggle_autopilot' | 'search_lead' | 'approve_creative' | 'reject_creative' | 'run_creative_pipeline'
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
        case 'approve_creative':
            return approveCreative(orgId, action.params, 'approved')
        case 'reject_creative':
            return approveCreative(orgId, action.params, 'rejected')
        case 'run_creative_pipeline':
            return forceRunPipeline(orgId)
        default:
            return { success: false, message: `Azione sconosciuta: ${action.type}` }
    }
}

// --- CRM: Move Lead ---

async function moveLead(orgId: string, params: Record<string, any>): Promise<ActionResult> {
    const { lead_name, target_stage, product, value } = params

    // Find the lead by name (fuzzy)
    const { data: leads } = await getSupabaseAdmin()
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
    const { data: stages } = await getSupabaseAdmin()
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
    const { error: updateErr } = await getSupabaseAdmin()
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
        await getSupabaseAdmin().from('lead_activities').insert({
            organization_id: orgId,
            lead_id: lead.id,
            activity_type: 'stage_changed',
            from_stage_id: lead.stage_id,
            to_stage_id: stage.id,
            notes: 'Azione eseguita da Dante via Telegram',
        })
    } catch {}

    // Fire CAPI event DIRECTLY via Meta Graph API (bypass API route which requires session auth)
    if (stage.fire_capi_event) {
        try {
            const { data: leadData } = await getSupabaseAdmin()
                .from('leads')
                .select('name, email, phone, value, meta_data, funnel_id, funnels!leads_funnel_id_fkey(objective)')
                .eq('id', lead.id)
                .single()

            if (leadData) {
                const meta = (leadData.meta_data || {}) as any
                const funnelObjective = (leadData as any)?.funnels?.objective || 'cliente'
                const finalValue = updateData.value ?? leadData.value
                const finalName = leadData.name
                const finalEmail = leadData.email
                const finalPhone = leadData.phone

                // Block Purchase without value
                const isPurchase = stage.fire_capi_event === 'Purchase'
                const hasValue = finalValue && Number(finalValue) > 0

                if (isPurchase && !hasValue) {
                    console.warn(`[CAPI/Dante] Blocked Purchase for ${lead.id}: no value`)
                } else {
                    // Dedup check (same event within 1hr)
                    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
                    const { data: recentEvent } = await getSupabaseAdmin()
                        .from('tracked_events')
                        .select('id')
                        .eq('lead_id', lead.id)
                        .eq('event_name', stage.fire_capi_event)
                        .eq('sent_to_provider', true)
                        .gte('created_at', oneHourAgo)
                        .limit(1)
                        .single()

                    if (!recentEvent) {
                        // Get Meta CAPI connection
                        const { data: conn } = await getSupabaseAdmin()
                            .from('connections')
                            .select('credentials, config')
                            .eq('organization_id', orgId)
                            .eq('provider', 'meta_capi')
                            .eq('status', 'active')
                            .single()

                        if (conn?.credentials?.access_token) {
                            const pixelId = conn.config?.pixel_id || conn.credentials?.pixel_id
                            if (pixelId) {
                                const eventId = `evt_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
                                const hashSHA256 = async (data: string): Promise<string> => {
                                    const buffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(data))
                                    return Array.from(new Uint8Array(buffer)).map(b => b.toString(16).padStart(2, '0')).join('')
                                }

                                const payload = {
                                    data: [{
                                        event_name: stage.fire_capi_event,
                                        event_time: Math.floor(Date.now() / 1000),
                                        event_id: eventId,
                                        action_source: 'website',
                                        event_source_url: meta.event_source_url || undefined,
                                        user_data: {
                                            em: finalEmail ? [await hashSHA256(finalEmail.toLowerCase().trim())] : undefined,
                                            ph: finalPhone ? [await hashSHA256(finalPhone.replace(/\D/g, ''))] : undefined,
                                            fn: finalName ? [await hashSHA256(finalName.split(' ')[0].toLowerCase().trim())] : undefined,
                                            ln: finalName?.includes(' ') ? [await hashSHA256(finalName.split(' ').slice(1).join(' ').toLowerCase().trim())] : undefined,
                                            country: [await hashSHA256('it')],
                                            fbc: meta.fbc || undefined,
                                            fbp: meta.fbp || undefined,
                                            external_id: meta.visitor_id ? [await hashSHA256(meta.visitor_id)] : undefined,
                                            client_ip_address: meta.client_ip || undefined,
                                            client_user_agent: meta.client_user_agent || undefined,
                                        },
                                        custom_data: {
                                            content_category: funnelObjective,
                                            currency: (finalValue || isPurchase) ? 'EUR' : undefined,
                                            value: finalValue ?? (isPurchase ? 0 : undefined),
                                        },
                                    }],
                                }

                                const res = await fetch(
                                    `https://graph.facebook.com/v21.0/${pixelId}/events?access_token=${conn.credentials.access_token}`,
                                    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }
                                )
                                const result = await res.json()
                                console.log(`[CAPI/Dante] ${stage.fire_capi_event} for ${finalName}: ${res.ok ? 'OK' : 'FAIL'}`, result)

                                // Track the event
                                await getSupabaseAdmin().from('tracked_events').insert({
                                    organization_id: orgId,
                                    event_name: stage.fire_capi_event,
                                    event_id: eventId,
                                    lead_id: lead.id,
                                    user_data_hash: { em: !!finalEmail, ph: !!finalPhone },
                                    event_params: { pixel_id: pixelId, value: finalValue, source: 'dante' },
                                    source: 'server',
                                    sent_to_provider: res.ok,
                                    provider_response: result,
                                })
                            }
                        }
                    } else {
                        console.log(`[CAPI/Dante] Skipped duplicate ${stage.fire_capi_event} for ${lead.id}`)
                    }
                }
            }
        } catch (e) {
            console.error('[CAPI/Dante] Error firing event:', e)
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
    const { data: leads } = await getSupabaseAdmin()
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
    const { data: members } = await getSupabaseAdmin()
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

    const { error } = await getSupabaseAdmin()
        .from('leads')
        .update({ assigned_to: member.user_id, updated_at: new Date().toISOString() })
        .eq('id', lead.id)

    if (error) {
        return { success: false, message: `❌ Errore: ${error.message}` }
    }

    // Log activity (fire and forget)
    try {
        await getSupabaseAdmin().from('lead_activities').insert({
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

    const { error } = await getSupabaseAdmin()
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
    const { data: leads } = await getSupabaseAdmin()
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
    const { data: stages } = await getSupabaseAdmin()
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

    // Compact format: name, stage, date. Full details only if 1 result.
    if (leads.length === 1) {
        const l = leads[0]
        const stageName = stageMap.get(l.stage_id) || 'Non assegnato'
        const childAge = l.meta_data?.child_age || ''
        const parts = [
            `✅ <b>${l.name}</b>`,
            `📍 Stage: <b>${stageName}</b>`,
            `🕐 Arrivo: ${fmtDate(l.created_at)}`,
            `📞 ${l.phone || 'N/A'} | 📧 ${l.email || 'N/A'}`,
            l.value ? `💰 Valore: €${l.value}` : '',
            l.product ? `📦 ${l.product}` : '',
            childAge ? `👦 Età figlio: ${childAge}` : '',
        ].filter(Boolean)
        return { success: true, message: parts.join('\n'), is_info: true }
    }

    const results = leads.map((l, i) => {
        const stageName = stageMap.get(l.stage_id) || 'N/A'
        return `${i + 1}. <b>${l.name}</b> — ${stageName} — ${fmtDate(l.created_at)}`
    }).join('\n')

    return {
        success: true,
        message: `🔍 ${leads.length} risultati per "${query}":\n${results}`,
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
    await getSupabaseAdmin()
        .from('dante_pending_actions')
        .update({ status: 'expired' })
        .eq('chat_id', chatId)
        .eq('status', 'pending')

    // Insert new pending action
    await getSupabaseAdmin()
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
    const { data } = await getSupabaseAdmin()
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
        await getSupabaseAdmin()
            .from('dante_pending_actions')
            .update({ status: 'expired' })
            .eq('id', data.id)
        return null
    }

    return data
}

export async function confirmPendingAction(actionId: string): Promise<void> {
    await getSupabaseAdmin()
        .from('dante_pending_actions')
        .update({ status: 'confirmed' })
        .eq('id', actionId)
}

export async function cancelPendingAction(actionId: string): Promise<void> {
    await getSupabaseAdmin()
        .from('dante_pending_actions')
        .update({ status: 'cancelled' })
        .eq('id', actionId)
}

// --- Creative Pipeline: Force Run from Telegram ---

async function forceRunPipeline(orgId: string): Promise<ActionResult> {
    try {
        // Get Meta credentials
        const { data: conn } = await getSupabaseAdmin()
            .from('connections')
            .select('credentials')
            .eq('organization_id', orgId)
            .eq('provider', 'meta_ads')
            .eq('status', 'active')
            .single()

        if (!conn?.credentials?.access_token) {
            return { success: false, message: '❌ Meta Ads non connesso.' }
        }

        const { access_token, ad_account_id } = conn.credentials
        const adAccount = `act_${ad_account_id}`
        const META_API_VERSION = 'v21.0'

        // Fetch ad-level data from Meta
        const today = new Date().toISOString().slice(0, 10)
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

        const insightsUrl = `https://graph.facebook.com/${META_API_VERSION}/${adAccount}/insights?` +
            `fields=ad_id,ad_name,adset_id,adset_name,campaign_id,campaign_name,spend,impressions,clicks,ctr,actions,cost_per_action_type` +
            `&level=ad&time_range=${encodeURIComponent(JSON.stringify({ since: sevenDaysAgo, until: today }))}&limit=500&access_token=${access_token}`

        const insightsRes = await fetch(insightsUrl)
        if (!insightsRes.ok) return { success: false, message: '❌ Errore nel recupero dati Meta.' }
        const insightsData = await insightsRes.json()

        const ads = (insightsData.data || []).map((insight: any) => {
            const leadsCount = insight.actions?.find((a: any) => a.action_type === 'lead')?.value || 0
            const cplValue = insight.cost_per_action_type?.find((a: any) => a.action_type === 'lead')?.value || 0
            return {
                ad_id: insight.ad_id, ad_name: insight.ad_name,
                adset_id: insight.adset_id, adset_name: insight.adset_name,
                campaign_id: insight.campaign_id, campaign_name: insight.campaign_name,
                spend: parseFloat(insight.spend || '0'),
                impressions: parseInt(insight.impressions || '0'),
                clicks: parseInt(insight.clicks || '0'),
                ctr: parseFloat(insight.ctr || '0'),
                leads_count: parseInt(leadsCount), cpl: parseFloat(cplValue),
            }
        })

        if (ads.length === 0) return { success: true, message: '📊 Nessuna ad attiva trovata su Meta. Pipeline non necessario.' }

        // Get campaign budgets
        const campaignIds = [...new Set(ads.map((a: any) => a.campaign_id))]
        const campaignBudgets: Record<string, number> = {}
        for (const cId of campaignIds) {
            try {
                const cRes = await fetch(`https://graph.facebook.com/${META_API_VERSION}/${cId}?fields=daily_budget&access_token=${access_token}`)
                if (cRes.ok) {
                    const cData = await cRes.json()
                    campaignBudgets[cId as string] = parseFloat(cData.daily_budget || '0') / 100
                }
            } catch {}
        }

        // Build adset maps
        const adsetAngles: Record<string, string> = {}
        const adsetNames: Record<string, string> = {}
        const adsetUtmTerms: Record<string, string> = {}
        ads.forEach((ad: any) => {
            if (!adsetAngles[ad.adset_id]) {
                const name = (ad.adset_name || '').toLowerCase()
                let angle = 'generic'
                if (name.includes('efficien') || name.includes('eff')) angle = 'efficiency'
                else if (name.includes('system') || name.includes('metodo') || name.includes('sys')) angle = 'system'
                else if (name.includes('emozion') || name.includes('dolor') || name.includes('emo')) angle = 'emotional'
                else if (name.includes('status') || name.includes('corona')) angle = 'status'
                else if (name.includes('edu')) angle = 'education'
                adsetAngles[ad.adset_id] = angle
                adsetNames[ad.adset_id] = ad.adset_name
                adsetUtmTerms[ad.adset_id] = angle.replace(/[^a-z_]/g, '_')
            }
        })

        // Import and run pipeline
        const { runCreativePipeline } = await import('@/lib/creative-pipeline')
        const result = await runCreativePipeline(orgId, ads, campaignBudgets, adsetAngles, adsetNames, adsetUtmTerms)

        // Format response
        let msg = '🧠 <b>CREATIVE PIPELINE — Force Run</b>\n\n'
        msg += `📊 Deficit totale: ${result.total_deficit} ads mancanti\n`
        msg += `🎯 Angoli analizzati: ${result.angles_analyzed.join(', ') || 'nessuno'}\n`
        msg += `✨ Briefs generati: ${result.briefs_generated.length}\n`
        msg += `🖼 Immagini generate: ${result.images_generated}/${result.briefs_generated.length}\n\n`

        if (result.briefs_generated.length > 0) {
            for (const brief of result.briefs_generated) {
                msg += `━━━━━━━━━━━━━━━━━━\n`
                msg += `🎯 <b>${brief.name}</b>\n`
                msg += `📐 ${brief.aspect_ratio} | ${brief.angle.toUpperCase()}\n`
                msg += `🧠 Pocket #${brief.pocket.pocket_id}: ${brief.pocket.pocket_name}\n`
                msg += `📝 ${brief.copy.headline}\n\n`
                msg += `✅ "Approva ${brief.name}"\n`
                msg += `❌ "Rifiuta ${brief.name}"\n\n`
            }
        } else {
            msg += '✅ Nessun deficit — tutte le ads sono coperte!\n'
        }

        if (result.image_errors.length > 0) {
            msg += `\n🖼 Errori immagini:\n`
            result.image_errors.forEach(e => { msg += `⚠️ ${e}\n` })
        }

        if (result.skipped_reasons.length > 0) {
            msg += `\n⏭ ${result.skipped_reasons.join('\n⏭ ')}`
        }

        return { success: true, message: msg }
    } catch (err: any) {
        return { success: false, message: `❌ Errore pipeline: ${err.message}` }
    }
}

// --- Creative Pipeline: Approve/Reject Ad Creatives ---

const META_API = 'https://graph.facebook.com/v21.0'

async function approveCreative(orgId: string, params: Record<string, any>, newStatus: 'approved' | 'rejected'): Promise<ActionResult> {
    const { creative_name, creative_id } = params

    // Find creative by name (fuzzy) or by id
    let creative: any = null
    if (creative_id) {
        const { data } = await getSupabaseAdmin()
            .from('ad_creatives')
            .select('*')
            .eq('organization_id', orgId)
            .eq('id', creative_id)
            .single()
        creative = data
    } else if (creative_name) {
        const { data } = await getSupabaseAdmin()
            .from('ad_creatives')
            .select('*')
            .eq('organization_id', orgId)
            .ilike('name', `%${creative_name}%`)
            .in('status', ['ready', 'draft'])
            .order('created_at', { ascending: false })
            .limit(1)
            .single()
        creative = data
    }

    if (!creative) {
        return { success: false, message: `❌ Ad creativa "${creative_name || creative_id}" non trovata o già processata.` }
    }

    // Update status
    const { error } = await getSupabaseAdmin()
        .from('ad_creatives')
        .update({ status: newStatus })
        .eq('id', creative.id)

    if (error) {
        return { success: false, message: `❌ Errore: ${error.message}` }
    }

    // If REJECTED → done
    if (newStatus === 'rejected') {
        return {
            success: true,
            message: `❌ Ad <b>${creative.name}</b> RIFIUTATA\n\n🎯 Angolo: ${creative.angle}\n🧠 Pocket: #${creative.pocket_id} ${creative.pocket_name}`,
        }
    }

    // If APPROVED → auto-launch immediately on Meta
    try {
        // Get Meta credentials
        const { data: conn } = await getSupabaseAdmin()
            .from('connections')
            .select('credentials')
            .eq('organization_id', orgId)
            .eq('provider', 'meta_ads')
            .eq('status', 'active')
            .single()

        if (!conn?.credentials?.access_token) {
            return {
                success: true,
                message: `✅ Ad <b>${creative.name}</b> APPROVATA ma Meta non connesso.\n\nLancia manualmente dalla Creative Studio.`,
            }
        }

        const { access_token, ad_account_id, page_id } = conn.credentials
        const adAccount = `act_${ad_account_id}`
        const LANDING_URL = 'https://landing.metodosincro.com/f/metodo-sincro'

        // Step 1: Upload image
        let imageHash: string | null = null
        if (creative.image_url) {
            const formData = new FormData()
            formData.append('url', creative.image_url)
            formData.append('name', creative.name)
            formData.append('access_token', access_token)

            const imgRes = await fetch(`${META_API}/${adAccount}/adimages`, { method: 'POST', body: formData })
            const imgData = await imgRes.json()
            if (!imgData.error) {
                const images = imgData.images || {}
                const firstKey = Object.keys(images)[0]
                imageHash = images[firstKey]?.hash || null
            }
        }

        if (!imageHash) {
            return {
                success: true,
                message: `✅ Ad <b>${creative.name}</b> APPROVATA ma nessuna immagine disponibile.\n\n⚠️ Genera l'immagine prima di lanciare.`,
            }
        }

        // Step 2: Create Meta Ad Creative
        const utmTags = `utm_source=facebook&utm_medium=paid&utm_campaign={{campaign.name}}&utm_term=${creative.landing_utm_term || creative.angle}&utm_content={{ad.name}}&fbadid={{ad.id}}`

        const creativeRes = await fetch(`${META_API}/${adAccount}/adcreatives`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                access_token,
                name: creative.name,
                object_story_spec: {
                    page_id,
                    instagram_user_id: '17841449195220971',
                    link_data: {
                        image_hash: imageHash,
                        link: LANDING_URL,
                        message: creative.copy_primary || '',
                        name: creative.copy_headline || '',
                        description: creative.copy_description || '',
                        call_to_action: { type: creative.cta_type || 'LEARN_MORE' },
                    },
                },
                url_tags: utmTags,
            }),
        })
        const metaCreative = await creativeRes.json()
        if (metaCreative.error) throw new Error(metaCreative.error.message)

        // Step 3: Create the Ad in the target AdSet
        const targetAdsetId = creative.target_adset_id || creative.meta_adset_id
        if (!targetAdsetId) {
            return {
                success: true,
                message: `✅ Ad <b>${creative.name}</b> APPROVATA ma nessun AdSet target.\n\n⚠️ Imposta target_adset_id nella Creative Studio.`,
            }
        }

        const adRes = await fetch(`${META_API}/${adAccount}/ads`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                access_token,
                name: creative.name,
                adset_id: targetAdsetId,
                creative: { creative_id: metaCreative.id },
                status: 'ACTIVE',
            }),
        })
        const metaAd = await adRes.json()
        if (metaAd.error) throw new Error(metaAd.error.message)

        // Step 4: Update record to 'launched'
        await getSupabaseAdmin()
            .from('ad_creatives')
            .update({
                status: 'launched',
                meta_ad_id: metaAd.id,
                meta_adset_id: targetAdsetId,
                launched_at: new Date().toISOString(),
            })
            .eq('id', creative.id)

        // Log
        await getSupabaseAdmin().from('ai_episodes').insert({
            organization_id: orgId,
            episode_type: 'action',
            action_type: 'ad_auto_launched',
            target_type: 'ad_creative',
            target_id: creative.id,
            target_name: creative.name,
            context: { meta_ad_id: metaAd.id, angle: creative.angle, pocket_id: creative.pocket_id },
            reasoning: `Auto-launch: "${creative.name}" approvata e lanciata immediatamente`,
            outcome: 'positive',
            outcome_score: 0.9,
        })

        return {
            success: true,
            message: `🚀 Ad <b>${creative.name}</b> APPROVATA e LANCIATA!\n\n🎯 Angolo: ${creative.angle}\n🧠 Pocket: #${creative.pocket_id} ${creative.pocket_name}\n📝 ${creative.copy_headline}\n\n🆔 Meta Ad ID: ${metaAd.id}\n📊 AdSet: ${creative.target_adset_name || targetAdsetId}\n\n✅ L'ad è ATTIVA e sta girando.`,
        }
    } catch (launchErr: any) {
        // Approval succeeded but launch failed — log it
        return {
            success: true,
            message: `✅ Ad <b>${creative.name}</b> APPROVATA\n\n⚠️ Auto-launch fallito: ${launchErr.message}\n\nPuoi lanciare manualmente dalla Creative Studio.`,
        }
    }
}
