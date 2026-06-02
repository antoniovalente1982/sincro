/**
 * lib/meta-lead-forms.ts
 * 
 * Logica condivisa per importare lead dai Meta Lead Ads (moduli nativi)
 * nel CRM. Usato sia dal webhook in tempo reale che dal cron di fallback.
 * 
 * Flusso:
 *  1. Meta fornisce un leadgen_id
 *  2. Recuperiamo i dati con GET /{leadgen_id}?fields=field_data,ad_id,campaign_id,form_id,created_time
 *  3. Mappiamo i campi al formato del CRM
 *  4. Upsert nella tabella `leads` con deduplication per email
 *  5. Lanciamo evento CAPI Lead (server-side tracking)
 */

import { SupabaseClient } from '@supabase/supabase-js'
import { assignLeadRoundRobin } from './lead-routing'

const META_API_VERSION = 'v21.0'

// ─── Tipi ───────────────────────────────────────────────────────────────────

export interface MetaLeadFieldData {
    name: string   // es. 'email', 'full_name', 'phone_number', 'first_name', 'last_name'
    values: string[]
}

export interface MetaLeadRawData {
    id: string              // leadgen_id
    created_time: string
    ad_id?: string
    adset_id?: string
    campaign_id?: string
    form_id?: string
    field_data: MetaLeadFieldData[]
}

export interface ProcessedMetaLead {
    email: string
    name: string
    phone: string
    leadgen_id: string
    ad_id?: string
    campaign_id?: string
    form_id?: string
    created_time: string
}

export interface MetaLeadProcessResult {
    leadgen_id: string
    status: 'created' | 'updated' | 'skipped' | 'error'
    lead_id?: string
    error?: string
}

// ─── Mapping campi ───────────────────────────────────────────────────────────

/**
 * Converte i field_data array di Meta in un oggetto strutturato.
 * Meta usa nomi standard come 'email', 'full_name', 'phone_number',
 * ma può anche usare 'first_name' + 'last_name' separati.
 */
export function mapMetaFieldsToLead(fieldData: MetaLeadFieldData[]): Omit<ProcessedMetaLead, 'leadgen_id' | 'ad_id' | 'campaign_id' | 'form_id' | 'created_time'> {
    const fields: Record<string, string> = {}
    
    for (const field of fieldData) {
        fields[field.name.toLowerCase()] = field.values?.[0] || ''
    }

    const email = (
        fields['email'] || 
        fields['email_address'] || 
        ''
    ).toLowerCase().trim()

    // Supporta sia full_name che first_name + last_name separati
    let name = ''
    if (fields['full_name']) {
        name = fields['full_name'].trim()
    } else {
        const first = fields['first_name'] || ''
        const last = fields['last_name'] || ''
        name = `${first} ${last}`.trim()
    }

    const phone = (
        fields['phone_number'] || 
        fields['phone'] || 
        fields['telefono'] || 
        ''
    ).trim()

    return { email, name, phone }
}

// ─── Fetch da Meta API ────────────────────────────────────────────────────────

/**
 * Recupera i dati completi di un lead da Meta usando il leadgen_id.
 * Richiede il permesso pages_read_engagement sul token.
 */
export async function fetchLeadgenData(
    leadgenId: string, 
    accessToken: string
): Promise<MetaLeadRawData | null> {
    const url = `https://graph.facebook.com/${META_API_VERSION}/${leadgenId}?fields=field_data,ad_id,adset_id,campaign_id,form_id,created_time&access_token=${accessToken}`
    
    try {
        const res = await fetch(url)
        if (!res.ok) {
            const errBody = await res.json().catch(() => ({}))
            console.error(`[MetaLeadForms] Failed to fetch leadgen ${leadgenId}:`, errBody)
            return null
        }
        return await res.json() as MetaLeadRawData
    } catch (err) {
        console.error(`[MetaLeadForms] Network error fetching leadgen ${leadgenId}:`, err)
        return null
    }
}

/**
 * Recupera tutti i lead di un singolo form Meta dall'ultima ora (o da un timestamp specificato).
 * Usato dal cron di fallback.
 */
export async function fetchFormLeads(
    formId: string, 
    accessToken: string,
    sinceTimestamp?: number
): Promise<MetaLeadRawData[]> {
    const since = sinceTimestamp || Math.floor((Date.now() - 2 * 60 * 60 * 1000) / 1000) // default: 2 ore fa
    
    const url = `https://graph.facebook.com/${META_API_VERSION}/${formId}/leads?fields=field_data,ad_id,adset_id,campaign_id,form_id,created_time&filtering=[{"field":"time_created","operator":"GREATER_THAN","value":${since}}]&limit=100&access_token=${accessToken}`
    
    try {
        const res = await fetch(url)
        if (!res.ok) {
            const errBody = await res.json().catch(() => ({}))
            console.error(`[MetaLeadForms] Failed to fetch leads for form ${formId}:`, errBody)
            return []
        }
        const data = await res.json()
        return data.data || []
    } catch (err) {
        console.error(`[MetaLeadForms] Network error fetching form leads ${formId}:`, err)
        return []
    }
}

/**
 * Recupera tutti i leadgen_forms di un ad account.
 * Usato dal cron per trovare tutti i form attivi.
 */
export async function fetchAdAccountForms(
    adAccountId: string,
    accessToken: string
): Promise<{ id: string; name: string; status: string }[]> {
    const url = `https://graph.facebook.com/${META_API_VERSION}/act_${adAccountId}/leadgen_forms?fields=id,name,status&limit=100&access_token=${accessToken}`
    
    try {
        const res = await fetch(url)
        if (!res.ok) {
            const errBody = await res.json().catch(() => ({}))
            console.error(`[MetaLeadForms] Failed to fetch forms for account ${adAccountId}:`, errBody)
            return []
        }
        const data = await res.json()
        return data.data || []
    } catch (err) {
        console.error(`[MetaLeadForms] Network error fetching forms:`, err)
        return []
    }
}

// ─── Hashing per CAPI ────────────────────────────────────────────────────────

async function hashSHA256(text: string): Promise<string> {
    const encoder = new TextEncoder()
    const data = encoder.encode(text)
    const hashBuffer = await crypto.subtle.digest('SHA-256', data)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

// ─── CAPI Event ───────────────────────────────────────────────────────────────

async function fireCapiLeadEvent(orgId: string, leadData: ProcessedMetaLead, supabase: SupabaseClient) {
    try {
        const { data: conn } = await supabase
            .from('connections')
            .select('credentials, config')
            .eq('organization_id', orgId)
            .eq('provider', 'meta_capi')
            .eq('status', 'active')
            .single()

        if (!conn?.credentials?.access_token) return
        const pixelId = conn.config?.pixel_id || conn.credentials?.pixel_id
        if (!pixelId) return

        const eventId = `evt_mlf_${leadData.leadgen_id}`
        const PREDICTIVE_LEAD_VALUE = 112

        const payload = {
            data: [{
                event_name: 'Lead',
                event_time: Math.floor(new Date(leadData.created_time).getTime() / 1000) || Math.floor(Date.now() / 1000),
                event_id: eventId,
                action_source: 'system_generated', // Modulo nativo Meta → non è "website"
                user_data: {
                    em: leadData.email ? [await hashSHA256(leadData.email.toLowerCase().trim())] : undefined,
                    ph: leadData.phone ? [await hashSHA256(leadData.phone.replace(/\D/g, ''))] : undefined,
                    fn: leadData.name ? [await hashSHA256(leadData.name.split(' ')[0].toLowerCase().trim())] : undefined,
                    ln: leadData.name?.includes(' ') ? [await hashSHA256(leadData.name.split(' ').slice(1).join(' ').toLowerCase().trim())] : undefined,
                    country: [await hashSHA256('it')],
                    lead_id: leadData.leadgen_id,
                },
                custom_data: {
                    value: PREDICTIVE_LEAD_VALUE,
                    currency: 'EUR',
                    content_category: 'cliente',
                    lead_id: leadData.leadgen_id,
                    form_id: leadData.form_id,
                },
            }],
        }

        const res = await fetch(
            `https://graph.facebook.com/${META_API_VERSION}/${pixelId}/events?access_token=${conn.credentials.access_token}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            }
        )

        const result = await res.json()

        await supabase.from('tracked_events').insert({
            organization_id: orgId,
            event_name: 'Lead',
            event_id: eventId,
            user_data_hash: { em: !!leadData.email, ph: !!leadData.phone },
            event_params: {
                pixel_id: pixelId,
                source: 'meta_lead_form',
                value: PREDICTIVE_LEAD_VALUE,
                leadgen_id: leadData.leadgen_id,
            },
            source: 'server',
            sent_to_provider: res.ok,
            provider_response: result,
        })

        if (!res.ok) {
            console.warn('[MetaLeadForms/CAPI] Lead event warning:', result)
        }
    } catch (err) {
        console.error('[MetaLeadForms/CAPI] Error:', err)
    }
}

// ─── Core: processa un singolo lead ──────────────────────────────────────────

/**
 * Processa un lead Meta e lo inserisce/aggiorna nel CRM.
 * Gestisce deduplication, pipeline routing e CAPI.
 * 
 * @returns status: 'created' | 'updated' | 'skipped' | 'error'
 */
export async function processMetaLead(
    rawLead: MetaLeadRawData,
    orgId: string,
    supabase: SupabaseClient
): Promise<MetaLeadProcessResult> {
    const leadgenId = rawLead.id

    try {
        const mapped = mapMetaFieldsToLead(rawLead.field_data)
        
        if (!mapped.email) {
            // Alcuni form Meta non raccolgono email (raro, ma possibile)
            // In questo caso usiamo il phone come identificatore se disponibile
            if (!mapped.phone) {
                return { leadgen_id: leadgenId, status: 'skipped', error: 'No email or phone in lead data' }
            }
        }

        const processedLead: ProcessedMetaLead = {
            ...mapped,
            leadgen_id: leadgenId,
            ad_id: rawLead.ad_id,
            campaign_id: rawLead.campaign_id,
            form_id: rawLead.form_id,
            created_time: rawLead.created_time,
        }

        // 1. Recupera pipeline default e primo stage
        const { data: pipeline } = await supabase
            .from('pipelines')
            .select('id')
            .eq('organization_id', orgId)
            .eq('is_default', true)
            .limit(1)
            .single()

        if (!pipeline) {
            return { leadgen_id: leadgenId, status: 'error', error: 'No default pipeline configured' }
        }

        const { data: firstStage } = await supabase
            .from('pipeline_stages')
            .select('id')
            .eq('pipeline_id', pipeline.id)
            .order('sort_order', { ascending: true })
            .limit(1)
            .single()

        if (!firstStage) {
            return { leadgen_id: leadgenId, status: 'error', error: 'No pipeline stage configured' }
        }

        // 2. Deduplication — controlla se il lead esiste già (per email o leadgen_id)
        let existingLead: any = null

        if (mapped.email) {
            const { data } = await supabase
                .from('leads')
                .select('id, phone, name, meta_data')
                .eq('organization_id', orgId)
                .eq('email', mapped.email)
                .order('created_at', { ascending: false })
                .limit(1)
                .single()
            existingLead = data
        }

        // Controllo ulteriore: già importato questo specifico leadgen_id?
        if (!existingLead) {
            const { data } = await supabase
                .from('leads')
                .select('id, phone, name, meta_data')
                .eq('organization_id', orgId)
                .contains('meta_data', { leadgen_id: leadgenId })
                .limit(1)
                .single()
            existingLead = data
        }

        const metaData = {
            source: 'meta_lead_form',
            leadgen_id: leadgenId,
            ad_id: rawLead.ad_id || null,
            campaign_id: rawLead.campaign_id || null,
            form_id: rawLead.form_id || null,
            // Simula UTM per compatibilità con il resto del CRM
            utm_source: 'facebook',
            utm_medium: 'paid',
            utm_campaign: rawLead.campaign_id || null,
            utm_content: rawLead.ad_id || null,
        }

        let leadId: string
        let resultStatus: 'created' | 'updated'

        if (existingLead) {
            // Lead già presente → aggiorna solo i campi mancanti + rimetti in pipeline
            leadId = existingLead.id
            const updateData: any = {
                stage_id: firstStage.id,
                updated_at: new Date().toISOString(),
                product: 'Fonte: Ads - Meta (Lead Form)',
                meta_data: { ...(existingLead.meta_data || {}), ...metaData },
            }
            if (!existingLead.phone && mapped.phone) updateData.phone = mapped.phone
            if (!existingLead.name && mapped.name) updateData.name = mapped.name

            await supabase.from('leads').update(updateData).eq('id', existingLead.id)
            await supabase.from('lead_activities').insert({
                organization_id: orgId,
                lead_id: leadId,
                activity_type: 'stage_changed',
                to_stage_id: firstStage.id,
                notes: `🔁 Rientrato via Meta Lead Form (leadgen_id: ${leadgenId})`,
            })
            resultStatus = 'updated'
        } else {
            // Nuovo lead → inserisci
            const { data: createdLead, error } = await supabase
                .from('leads')
                .insert({
                    organization_id: orgId,
                    email: mapped.email || null,
                    name: mapped.name || null,
                    phone: mapped.phone || null,
                    stage_id: firstStage.id,
                    value: 0,
                    product: 'Fonte: Ads - Meta (Lead Form)',
                    meta_data: metaData,
                })
                .select('id, assigned_to')
                .single()

            if (error || !createdLead) {
                console.error('[MetaLeadForms] Insert error:', error)
                return { leadgen_id: leadgenId, status: 'error', error: error?.message || 'Insert failed' }
            }

            leadId = createdLead.id

            // ─── LEAD ROUTING ───
            const assignedTo = await assignLeadRoundRobin(orgId, supabase)
            if (assignedTo) {
                await supabase.from('leads').update({ assigned_to: assignedTo }).eq('id', leadId)
                await supabase.from('lead_activities').insert({
                    organization_id: orgId,
                    lead_id: leadId,
                    activity_type: 'assignment_changed',
                    notes: `🎯 Assegnato automaticamente via Round Robin`,
                })
            }

            await supabase.from('lead_activities').insert({
                organization_id: orgId,
                lead_id: leadId,
                activity_type: 'status_changed',
                notes: `📥 Nuovo lead via Meta Lead Form (leadgen_id: ${leadgenId})`,
            })
            resultStatus = 'created'
        }

        // 3. Lancia CAPI Lead event (non-blocking)
        fireCapiLeadEvent(orgId, processedLead, supabase).catch(err =>
            console.error('[MetaLeadForms] CAPI error (non-blocking):', err)
        )

        return { leadgen_id: leadgenId, status: resultStatus, lead_id: leadId }

    } catch (err: any) {
        console.error('[MetaLeadForms] Unexpected error processing lead:', leadgenId, err)
        return { leadgen_id: leadgenId, status: 'error', error: err.message }
    }
}
