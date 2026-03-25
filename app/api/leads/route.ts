import { createClient } from '@/lib/supabase/server'
import { createClient as createAdmin } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

async function getOrgId(supabase: any) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null
    const { data: member } = await supabase
        .from('organization_members')
        .select('organization_id')
        .eq('user_id', user.id)
        .single()
    return member?.organization_id || null
}

export async function GET() {
    const supabase = await createClient()
    const orgId = await getOrgId(supabase)
    if (!orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data, error } = await supabase
        .from('leads')
        .select(`
            *,
            pipeline_stages (id, name, slug, color, sort_order),
            assigned_profile:assigned_to (id, email, full_name)
        `)
        .eq('organization_id', orgId)
        .order('created_at', { ascending: false })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
    const supabase = await createClient()
    const orgId = await getOrgId(supabase)
    if (!orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const { utm_term, utm_content, ...insertData } = body

    if (utm_term !== undefined || utm_content !== undefined) {
        insertData.meta_data = {
            ...(insertData.meta_data || {}),
            utm_term: utm_term || null,
            utm_content: utm_content || null
        }
    }

    const { data, error } = await supabase
        .from('leads')
        .insert({ ...insertData, organization_id: orgId })
        .select()
        .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
}

export async function PUT(req: NextRequest) {
    const supabase = await createClient()
    const orgId = await getOrgId(supabase)
    if (!orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const { id, utm_term, utm_content, ...updates } = body

    if (utm_term !== undefined || utm_content !== undefined) {
        const { data: existing } = await supabase.from('leads').select('meta_data').eq('id', id).single()
        updates.meta_data = {
            ...(existing?.meta_data || {}),
            utm_term: utm_term || null,
            utm_content: utm_content || null
        }
    }

    // If stage changed, create activity + fire CAPI event
    if (updates.stage_id && updates._old_stage_id && updates.stage_id !== updates._old_stage_id) {
        const { data: { user } } = await supabase.auth.getUser()

        // Log activity
        await supabase.from('lead_activities').insert({
            organization_id: orgId,
            lead_id: id,
            user_id: user?.id,
            activity_type: 'stage_changed',
            from_stage_id: updates._old_stage_id,
            to_stage_id: updates.stage_id,
        })

        // Fire Meta CAPI event if the new stage has fire_capi_event configured
        const { data: newStage } = await supabase
            .from('pipeline_stages')
            .select('name, fire_capi_event')
            .eq('id', updates.stage_id)
            .single()

        if (newStage?.fire_capi_event) {
            // Fire CAPI event asynchronously
            // Fetch funnel objective for content_category + meta_data for tracking params
            const leadForCapi = await supabase
                .from('leads')
                .select('name, email, phone, value, funnel_id, meta_data, funnels!leads_funnel_id_fkey(objective)')
                .eq('id', id)
                .single()

            const funnelObjective = (leadForCapi.data as any)?.funnels?.objective || 'cliente'
            const meta = leadForCapi.data?.meta_data || {} as any
            
            // Merge incoming updates to ensure we send the most fresh data (e.g. if user just added 'value')
            const finalName = updates.name !== undefined ? updates.name : leadForCapi.data?.name
            const finalEmail = updates.email !== undefined ? updates.email : leadForCapi.data?.email
            const finalPhone = updates.phone !== undefined ? updates.phone : leadForCapi.data?.phone
            const finalValue = updates.value !== undefined ? updates.value : leadForCapi.data?.value

            fireCapiEvent(orgId, newStage.fire_capi_event, {
                name: finalName,
                email: finalEmail,
                phone: finalPhone,
                value: finalValue,
                content_category: funnelObjective,
                // Replay original tracking data for better Meta matching
                fbc: meta.fbc || undefined,
                fbp: meta.fbp || undefined,
                external_id: meta.visitor_id || undefined,
                client_ip: meta.client_ip || undefined,
                client_user_agent: meta.client_user_agent || undefined,
                event_source_url: meta.event_source_url || undefined,
            }, id).catch(err => console.error('CAPI error:', err))

            // Log CAPI activity
            await supabase.from('lead_activities').insert({
                organization_id: orgId,
                lead_id: id,
                user_id: user?.id,
                activity_type: 'capi_event_sent',
                notes: `Evento "${newStage.fire_capi_event}" inviato a Meta CAPI`,
                meta_data: { event_name: newStage.fire_capi_event, stage: newStage.name },
            })
        }

        delete updates._old_stage_id
    }

    const { data, error } = await supabase
        .from('leads')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .eq('organization_id', orgId)
        .select()
        .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
}

export async function DELETE(req: NextRequest) {
    const supabase = await createClient()
    const orgId = await getOrgId(supabase)
    if (!orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')

    const { error } = await supabase
        .from('leads')
        .delete()
        .eq('id', id)
        .eq('organization_id', orgId)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
}

// --- Meta CAPI Event Firing ---
async function fireCapiEvent(orgId: string, eventName: string, userData: any, leadId: string) {
    const admin = createAdmin(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    )

    // Get Meta CAPI connection
    const { data: conn } = await admin
        .from('connections')
        .select('credentials, config')
        .eq('organization_id', orgId)
        .eq('provider', 'meta_capi')
        .eq('status', 'active')
        .single()

    if (!conn?.credentials?.access_token) return
    const pixelId = conn.config?.pixel_id || conn.credentials?.pixel_id
    if (!pixelId) return

    const eventId = `evt_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`

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
                external_id: userData.external_id ? [await hashSHA256(userData.external_id)] : undefined,
                client_ip_address: userData.client_ip || undefined,
                client_user_agent: userData.client_user_agent || undefined,
            },
            custom_data: {
                content_category: userData.content_category || undefined,
                currency: (userData.value || eventName === 'Purchase') ? 'EUR' : undefined,
                value: userData.value ?? (eventName === 'Purchase' ? 0 : undefined),
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

    // Track the event
    await admin.from('tracked_events').insert({
        organization_id: orgId,
        event_name: eventName,
        event_id: eventId,
        lead_id: leadId,
        user_data_hash: { em: !!userData.email, ph: !!userData.phone },
        event_params: { pixel_id: pixelId, value: userData.value },
        source: 'server',
        sent_to_provider: res.ok,
        provider_response: result,
    })
}

async function hashSHA256(data: string): Promise<string> {
    const encoder = new TextEncoder()
    const buffer = await crypto.subtle.digest('SHA-256', encoder.encode(data))
    return Array.from(new Uint8Array(buffer)).map(b => b.toString(16).padStart(2, '0')).join('')
}
