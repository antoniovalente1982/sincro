import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getSupabaseAdmin() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    )
}

async function hashSHA256(text: string) {
    const encoder = new TextEncoder()
    const data = encoder.encode(text)
    const hashBuffer = await crypto.subtle.digest('SHA-256', data)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

async function fireCapiEvent(orgId: string, eventName: string, userData: any, pixelId: string) {
    try {
        const { data: conn } = await getSupabaseAdmin()
            .from('connections')
            .select('credentials')
            .eq('organization_id', orgId)
            .eq('provider', 'meta_capi')
            .eq('status', 'active')
            .single()

        if (!conn?.credentials?.access_token) return

        const eventId = userData.event_id || `evt_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`

        const payload = {
            data: [{
                event_name: eventName,
                event_time: Math.floor(Date.now() / 1000),
                event_id: eventId,
                action_source: 'website',
                event_source_url: userData.event_source_url || undefined,
                user_data: {
                    em: userData.email ? [await hashSHA256(userData.email.toLowerCase().trim())] : undefined,
                    ph: userData.phone ? [await hashSHA256(userData.phone.replace(/\D/g, ''))] : undefined,
                    fn: userData.name ? [await hashSHA256(userData.name.split(' ')[0].toLowerCase().trim())] : undefined,
                    ln: userData.name?.includes(' ') ? [await hashSHA256(userData.name.split(' ').slice(1).join(' ').toLowerCase().trim())] : undefined,
                    country: [await hashSHA256('it')],
                    fbc: userData.fbc || undefined,
                    fbp: userData.fbp || undefined,
                    client_ip_address: userData.client_ip || undefined,
                    client_user_agent: userData.client_user_agent || undefined,
                },
                custom_data: {
                    value: 0.00,
                    currency: 'EUR',
                },
            }],
        }

        await fetch(
            `https://graph.facebook.com/v21.0/${pixelId}/events?access_token=${conn.credentials.access_token}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            }
        )
    } catch (err) {
        console.error('CAPI Error:', err)
    }
}

export async function POST(req: NextRequest) {
    try {
        const urlObj = new URL(req.url)
        const orgId = urlObj.searchParams.get('org')

        if (!orgId) {
            return NextResponse.json({ error: 'Missing req org params in webhook URL' }, { status: 400 })
        }

        const body = await req.json()
        
        // Map common fields dynamically
        const email = (body.email || body.email_address || body.Email || '')?.toString().toLowerCase().trim()
        let rawName = body.name || body.Name || body.nome || body.Nome || ''
        let rawLastName = body.cognome || body.Cognome || body.last_name || body.lastName || ''
        
        // Combine them if both exist
        if (rawName && rawLastName) {
            rawName = `${rawName} ${rawLastName}`
        }
        const name = rawName.toString().trim()
        const phone = (body.phone || body.phone_number || body.Telefono || '')?.toString().trim()
        
        if (!email) {
            return NextResponse.json({ error: 'Missing email field in Gravity body payload' }, { status: 400 })
        }

        const utm_source = body.utm_source || null
        const utm_medium = body.utm_medium || null
        const utm_campaign = body.utm_campaign || null
        const utm_content = body.utm_content || body.utm_term || null
        const fbp = body.fbp || null
        const fbc = body.fbc || null

        const supabase = getSupabaseAdmin()

        // Get default Pipeline & first Stage
        const { data: pipeline } = await supabase.from('pipelines')
            .select('id')
            .eq('organization_id', orgId)
            .eq('is_default', true)
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

        if (!firstStageId) {
            return NextResponse.json({ error: 'No pipeline stage configured' }, { status: 500 })
        }

        // Deduplication
        const { data: existingLead } = await supabase.from('leads')
            .select('*')
            .eq('organization_id', orgId)
            .eq('email', email)
            .order('created_at', { ascending: false })
            .limit(1).single()

        // Pre-fetch dummy source funnels
        const { data: sourceFunnels } = await supabase.from('funnels')
            .select('id, slug')
            .in('slug', ['form-valenteantonio-it', 'form-metodosincro-it', 'form-protocollo27-it'])
            .eq('organization_id', orgId);

        let funnelIdToAssign: string | null = null;
        let productLabel = utm_source || 'Fonte: Ads - Meta';
        
        if (utm_source) {
            const lowerSource = String(utm_source).toLowerCase();
            if (lowerSource.includes('valenteantonio')) {
                productLabel = 'Fonte: valenteantonio.it';
                funnelIdToAssign = sourceFunnels?.find(f => f.slug === 'form-valenteantonio-it')?.id || null;
            }
            else if (lowerSource.includes('metodosincro')) {
                productLabel = 'Fonte: metodosincro.it';
                funnelIdToAssign = sourceFunnels?.find(f => f.slug === 'form-metodosincro-it')?.id || null;
            }
            else if (lowerSource.includes('protocollo27')) {
                productLabel = 'Fonte: protocollo27.it';
                funnelIdToAssign = sourceFunnels?.find(f => f.slug === 'form-protocollo27-it')?.id || null;
            }
            else {
                productLabel = 'Fonte: Ads - Meta';
            }
        }

        let leadId = null

        if (existingLead) {
            leadId = existingLead.id
            const updateData: any = {
                stage_id: firstStageId,
                updated_at: new Date().toISOString(),
                product: productLabel
            }
            if (!existingLead.phone && phone) updateData.phone = phone
            if (!existingLead.name && name) updateData.name = name
            if (!existingLead.funnel_id && funnelIdToAssign) updateData.funnel_id = funnelIdToAssign

            await supabase.from('leads').update(updateData).eq('id', existingLead.id)

            await supabase.from('lead_activities').insert({
                organization_id: orgId, lead_id: leadId,
                activity_type: 'stage_changed', to_stage_id: firstStageId,
                notes: `🔁 Rientrato da Form (Gravity Forms)`
            })
        } else {
            const { data: createdLead, error } = await supabase.from('leads').insert({
                organization_id: orgId,
                email, name, phone, stage_id: firstStageId, value: 0,
                product: productLabel,
                funnel_id: funnelIdToAssign,
                meta_data: { 
                    source: 'gravity_forms', 
                    utm_source, utm_medium, utm_campaign, utm_content, fbp, fbc 
                }
            }).select('id').single()

            if (error || !createdLead) {
                return NextResponse.json({ error: 'Failed to create lead', details: error }, { status: 500 })
            }
            leadId = createdLead.id

            await supabase.from('lead_activities').insert({
                organization_id: orgId, lead_id: leadId,
                activity_type: 'status_changed',
                notes: `📥 Nuovo lead entrato via Gravity Forms Webhook`
            })
        }

// NOTE: appendLeadToSheet removed — Gravity Forms no longer active.
// The lead is already written to Google Sheets via /api/submit when it arrives natively.

        // ── Trigger Server-Side META CAPI
        const { data: orgConfig } = await supabase.from('organizations')
            .select('settings').eq('id', orgId).single()
            
        let pixelId = null
        if (orgConfig?.settings && typeof orgConfig.settings === 'object' && 'pixel_id' in orgConfig.settings) {
            pixelId = orgConfig.settings.pixel_id as string
        }
        
        if (pixelId) {
            await fireCapiEvent(orgId, 'Lead', {
                email, name, phone,
                fbc, fbp,
                client_ip: req.headers.get('x-forwarded-for') || undefined,
                client_user_agent: req.headers.get('user-agent') || undefined,
            }, pixelId)
        }

        return NextResponse.json({ success: true, lead_id: leadId })

    } catch (err: any) {
        console.error('Gravity Webhook Error:', err)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}
