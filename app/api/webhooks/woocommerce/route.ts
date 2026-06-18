import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { assignLeadRoundRobin } from '@/lib/lead-routing'
import { notifyAssignedSeller } from '@/lib/telegram'

function getSupabaseAdmin() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    )
}

async function hashSHA256(data: string): Promise<string> {
    const encoder = new TextEncoder()
    const buffer = await crypto.subtle.digest('SHA-256', encoder.encode(data))
    return Array.from(new Uint8Array(buffer)).map(b => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Fire CAPI Purchase event for WooCommerce orders.
 * 
 * FIX: This resolves the Meta Diagnostics error:
 * "Evento Purchase dal server non deduplicato — event_id mancante"
 * 
 * The WooCommerce Pixel plugin fires Purchase client-side, but without event_id.
 * By sending the server-side event with a unique event_id tied to the order,
 * Meta can properly deduplicate if the Pixel plugin is also updated to send the same event_id.
 * 
 * Even if the Pixel plugin doesn't send event_id, having it here improves tracking quality
 * and prevents future server-side duplicates.
 */
async function fireCapiPurchase(orgId: string, userData: {
    email?: string; name?: string; phone?: string;
    value: number; currency: string; orderId?: string | number;
    productName?: string;
    client_ip?: string; client_user_agent?: string;
}) {
    try {
        const supabase = getSupabaseAdmin()
        
        // Get Meta CAPI connection
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

        // Use order ID for DETERMINISTIC event_id — no random component
        // This ensures:
        // 1. If WooCommerce sends the same order webhook twice → same event_id → Meta deduplicates
        // 2. For Pixel↔CAPI dedup: configure the WooCommerce Pixel plugin (e.g. PixelYourSite)
        //    to use the same format: wc_purchase_{order_id}  (Settings → Event Tracking → Purchase → Event ID)
        const eventId = `wc_purchase_${userData.orderId || Date.now()}`

        const payload = {
            data: [{
                event_name: 'Purchase',
                event_time: Math.floor(Date.now() / 1000),
                event_id: eventId,
                action_source: 'website' as const,
                event_source_url: 'https://shop.metodosincro.com',
                user_data: {
                    em: userData.email ? [await hashSHA256(userData.email.toLowerCase().trim())] : undefined,
                    ph: userData.phone ? [await hashSHA256(userData.phone.replace(/\D/g, ''))] : undefined,
                    fn: userData.name ? [await hashSHA256(userData.name.split(' ')[0].toLowerCase().trim())] : undefined,
                    ln: userData.name?.includes(' ') ? [await hashSHA256(userData.name.split(' ').slice(1).join(' ').toLowerCase().trim())] : undefined,
                    country: [await hashSHA256('it')],
                    client_ip_address: userData.client_ip || undefined,
                    client_user_agent: userData.client_user_agent || undefined,
                },
                custom_data: {
                    value: userData.value > 0 ? userData.value : undefined,
                    currency: userData.currency || 'EUR',
                    content_name: userData.productName || undefined,
                    content_category: 'digital_product',
                    content_type: 'product',
                    order_id: String(userData.orderId || ''),
                },
            }],
        }

        const res = await fetch(
            `https://graph.facebook.com/v21.0/${pixelId}/events?access_token=${conn.credentials.access_token}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            }
        )

        const result = await res.json()

        // Log to tracked_events for audit trail
        await supabase.from('tracked_events').insert({
            organization_id: orgId,
            event_name: 'Purchase',
            event_id: eventId,
            user_data_hash: { em: !!userData.email, ph: !!userData.phone },
            event_params: { 
                pixel_id: pixelId, 
                value: userData.value, 
                source: 'woocommerce',
                order_id: userData.orderId,
            },
            source: 'server',
            sent_to_provider: res.ok,
            provider_response: result,
        })

        if (!res.ok) {
            console.error('[CAPI/WooCommerce] Purchase event failed:', result)
        }
    } catch (err) {
        console.error('[CAPI/WooCommerce] Error:', err)
    }
}

function extractUtms(metaDataArray: any[]) {
    const utms: Record<string, string> = {
        utm_source: '',
        utm_medium: '',
        utm_campaign: '',
        utm_content: '',
        utm_term: '',
        fbclid: '',
        fbadid: '',
    }
    if (!Array.isArray(metaDataArray)) return utms

    const getMetaValue = (prefixes: string[]) => {
        for (const meta of metaDataArray) {
            const key = String(meta.key || '').toLowerCase().trim()
            const val = String(meta.value || '').trim()
            if (!val) continue
            // Check if key matches exactly or starts/ends with one of the prefixes
            if (prefixes.some(p => key === p || key === `_${p}` || key.endsWith(`_${p}`))) {
                return val
            }
        }
        return ''
    }

    utms.utm_source = getMetaValue(['utm_source', 'utm-source', 'source'])
    utms.utm_medium = getMetaValue(['utm_medium', 'utm-medium', 'medium'])
    utms.utm_campaign = getMetaValue(['utm_campaign', 'utm-campaign', 'campaign'])
    utms.utm_content = getMetaValue(['utm_content', 'utm-content', 'content'])
    utms.utm_term = getMetaValue(['utm_term', 'utm-term', 'term'])
    utms.fbclid = getMetaValue(['fbclid', 'fb-clid'])
    utms.fbadid = getMetaValue(['fbadid', 'fb-adid', 'ad_id', 'adid'])

    return utms
}

export async function POST(req: NextRequest) {
    try {
        const urlObj = new URL(req.url)
        const orgId = urlObj.searchParams.get('org')

        if (!orgId) {
            return NextResponse.json({ error: 'Missing org param in webhook URL' }, { status: 400 })
        }

        const body = await req.json()
        
        // WooCommerce Order Payload parsing
        const email = body.billing?.email?.toLowerCase().trim() || ''
        const name = `${body.billing?.first_name || ''} ${body.billing?.last_name || ''}`.trim()
        const phone = body.billing?.phone?.toString().trim() || ''
        const value = body.total ? Number(body.total) : 0
        const currency = body.currency || 'EUR'
        
        // Gather product names from line_items
        const lineItems = body.line_items || []
        const productNames = lineItems.map((item: any) => item.name).join(', ')
        const productLabel = productNames ? `Shop: ${productNames}` : 'Acquisto Shop Sincro'

        // Extract UTM parameters from WooCommerce metadata array
        const metaDataArray = body.meta_data || []
        const utms = extractUtms(metaDataArray)

        if (!email) {
            return NextResponse.json({ error: 'Missing billing email in WooCommerce payload' }, { status: 400 })
        }

        // Capture request headers for CAPI (must be done before async work)
        const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || undefined
        const clientUserAgent = req.headers.get('user-agent') || undefined

        const supabase = getSupabaseAdmin()

        // Get the Shop Pipeline
        const { data: pipeline } = await supabase.from('pipelines')
            .select('id')
            .eq('organization_id', orgId)
            .eq('slug', 'acquirenti-shop')
            .limit(1).single()

        let firstStageId: string | null = null
        if (pipeline) {
            const { data: stage } = await supabase.from('pipeline_stages')
                .select('id')
                .eq('pipeline_id', pipeline.id)
                .order('sort_order', { ascending: true })
                .limit(1).single()
            firstStageId = stage?.id || null
        }

        // Fallback to default pipeline if Shop pipeline is missing
        if (!firstStageId) {
            const { data: defPipeline } = await supabase.from('pipelines')
                .select('id')
                .eq('organization_id', orgId)
                .eq('is_default', true)
                .limit(1).single()
            if (defPipeline) {
                const { data: defStage } = await supabase.from('pipeline_stages')
                    .select('id')
                    .eq('pipeline_id', defPipeline.id)
                    .order('sort_order', { ascending: true })
                    .limit(1).single()
                firstStageId = defStage?.id || null
            }
        }

        if (!firstStageId) {
            return NextResponse.json({ error: 'No pipeline stage configured' }, { status: 500 })
        }

        // Deduplication
        const { data: existingLead } = await supabase.from('leads')
            .select('id, name, phone, value, utm_campaign, utm_source, meta_data, assigned_to')
            .eq('organization_id', orgId)
            .eq('email', email)
            .order('created_at', { ascending: false })
            .limit(1).single()

        let leadId = null

        if (existingLead) {
            leadId = existingLead.id
            const updateData: any = {
                stage_id: firstStageId,
                updated_at: new Date().toISOString(),
                product: productLabel,
            }
            
            // Add order value to existing value to calculate LTV, or just set it
            updateData.value = (Number(existingLead.value || 0) + value)
            
            if (!existingLead.phone && phone) updateData.phone = phone
            if (!existingLead.name && name) updateData.name = name

            // Backfill UTMs on the lead if they are missing
            if (!existingLead.utm_campaign && utms.utm_campaign) {
                updateData.utm_campaign = utms.utm_campaign
            }
            if (!existingLead.utm_source && utms.utm_source) {
                updateData.utm_source = utms.utm_source
            }

            // Merge metadata
            const existingMeta = existingLead.meta_data || {}
            updateData.meta_data = {
                ...existingMeta,
                source: 'woocommerce',
                order_id: body.id,
                order_status: body.status,
                utm_medium: utms.utm_medium || existingMeta.utm_medium || null,
                utm_content: utms.utm_content || existingMeta.utm_content || null,
                utm_term: utms.utm_term || existingMeta.utm_term || null,
                fbclid: utms.fbclid || existingMeta.fbclid || null,
                fbadid: utms.fbadid || existingMeta.fbadid || null,
            }

            // Se non c'è già un assegnatario, applichiamo il Round Robin
            let assignedTo = existingLead.assigned_to
            let newlyAssigned = false
            if (!assignedTo) {
                assignedTo = await assignLeadRoundRobin(orgId, supabase)
                if (assignedTo) {
                    updateData.assigned_to = assignedTo
                    updateData.setter_id = assignedTo
                    updateData.closer_id = assignedTo
                    newlyAssigned = true
                }
            }

            await supabase.from('leads').update(updateData).eq('id', existingLead.id)

            await supabase.from('lead_activities').insert({
                organization_id: orgId, lead_id: leadId,
                activity_type: 'stage_changed', to_stage_id: firstStageId,
                notes: `🛒 Rientrato da Shop: ${productLabel} (€${value})`
            })

            if (newlyAssigned && assignedTo) {
                await supabase.from('lead_activities').insert({
                    organization_id: orgId,
                    lead_id: leadId,
                    activity_type: 'assignment_changed',
                    notes: `🎯 Assegnato automaticamente (Qualificatore e Venditore)`,
                })
                // Notifica personale al venditore assegnato
                notifyAssignedSeller(orgId, assignedTo, {
                    name: name || existingLead.name || '',
                    email: email,
                    phone: phone || existingLead.phone || '',
                    source: utms.utm_source || 'WooCommerce Shop',
                }).catch(err => console.error('[WooCommerce Webhook] Seller notify error (existing):', err))
            }
        } else {
            const { data: createdLead, error } = await supabase.from('leads').insert({
                organization_id: orgId,
                email, name, phone, stage_id: firstStageId, value,
                product: productLabel,
                utm_campaign: utms.utm_campaign || null,
                utm_source: utms.utm_source || null,
                meta_data: { 
                    source: 'woocommerce', 
                    order_id: body.id,
                    order_status: body.status,
                    utm_medium: utms.utm_medium || null,
                    utm_content: utms.utm_content || null,
                    utm_term: utms.utm_term || null,
                    fbclid: utms.fbclid || null,
                    fbadid: utms.fbadid || null,
                }
            }).select('id').single()

            if (error || !createdLead) {
                return NextResponse.json({ error: 'Failed to create lead', details: error }, { status: 500 })
            }
            leadId = createdLead.id

            await supabase.from('lead_activities').insert({
                organization_id: orgId, lead_id: leadId,
                activity_type: 'status_changed',
                notes: `🛍️ Nuovo Cliente da WooCommerce: ${productLabel} (€${value})`
            })

            // LEAD ROUTING per il nuovo lead
            const assignedTo = await assignLeadRoundRobin(orgId, supabase)
            if (assignedTo) {
                await supabase.from('leads').update({
                    assigned_to: assignedTo,
                    setter_id: assignedTo,
                    closer_id: assignedTo
                }).eq('id', leadId)

                await supabase.from('lead_activities').insert({
                    organization_id: orgId,
                    lead_id: leadId,
                    activity_type: 'assignment_changed',
                    notes: `🎯 Assegnato automaticamente (Qualificatore e Venditore)`,
                })

                // Notifica personale al venditore assegnato
                notifyAssignedSeller(orgId, assignedTo, {
                    name: name || '',
                    email: email,
                    phone: phone,
                    source: utms.utm_source || 'WooCommerce Shop',
                }).catch(err => console.error('[WooCommerce Webhook] Seller notify error (new):', err))
            }
        }

        // ── CAPI Purchase: DISABILITATA — ora gestita da Pixel Manager Pro ──
        // Pixel Manager Pro (WooCommerce) invia sia Pixel che CAPI Purchase
        // con event_id e deduplicazione automatica.
        // Tenere questo attivo causerebbe un doppio Purchase in Meta.
        // Il CRM tracking (pipeline, LTV, activities) sopra resta attivo.
        //
        // Se in futuro disabiliti Pixel Manager Pro, riattiva questo blocco:
        // if (value > 0) {
        //     await fireCapiPurchase(orgId, {
        //         email, name, phone,
        //         value, currency,
        //         orderId: body.id,
        //         productName: productLabel,
        //         client_ip: clientIp,
        //         client_user_agent: clientUserAgent,
        //     })
        // }

        return NextResponse.json({ success: true, lead_id: leadId })

    } catch (err: any) {
        console.error('WooCommerce Webhook Error:', err)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}
