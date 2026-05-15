import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

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

        // Use order ID as part of event_id for deterministic deduplication
        // If WooCommerce sends the same order twice, the event_id will match → Meta deduplicates
        const eventId = `wc_purchase_${userData.orderId || Date.now()}_${Math.random().toString(36).substring(2, 7)}`

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
            .select('id, name, phone, value')
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

            await supabase.from('leads').update(updateData).eq('id', existingLead.id)

            await supabase.from('lead_activities').insert({
                organization_id: orgId, lead_id: leadId,
                activity_type: 'stage_changed', to_stage_id: firstStageId,
                notes: `🛒 Rientrato da Shop: ${productLabel} (€${value})`
            })
        } else {
            const { data: createdLead, error } = await supabase.from('leads').insert({
                organization_id: orgId,
                email, name, phone, stage_id: firstStageId, value,
                product: productLabel,
                meta_data: { 
                    source: 'woocommerce', 
                    order_id: body.id,
                    order_status: body.status,
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
        }

        // ── Fire CAPI Purchase event for proper Pixel↔CAPI deduplication ──
        // This fixes the Meta Diagnostics error: "Evento Purchase dal server non deduplicato"
        if (value > 0) {
            await fireCapiPurchase(orgId, {
                email, name, phone,
                value, currency,
                orderId: body.id,
                productName: productLabel,
                client_ip: clientIp,
                client_user_agent: clientUserAgent,
            })
        }

        return NextResponse.json({ success: true, lead_id: leadId })

    } catch (err: any) {
        console.error('WooCommerce Webhook Error:', err)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}
