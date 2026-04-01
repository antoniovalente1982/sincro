import { createClient } from '@supabase/supabase-js'

const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function hashSHA256(data) {
    const encoder = new TextEncoder()
    const buffer = await crypto.subtle.digest('SHA-256', encoder.encode(data))
    return Array.from(new Uint8Array(buffer)).map(b => b.toString(16).padStart(2, '0')).join('')
}

async function fireCapiEvent(orgId, eventName, userData, leadId) {
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

    const eventId = "evt_" + Date.now() + "_" + Math.random().toString(36).substring(2, 9)

    let emHash = userData.email ? await hashSHA256(userData.email.toLowerCase().trim()) : undefined;
    let phHash = userData.phone ? await hashSHA256(userData.phone.replace(/\D/g, '')) : undefined;
    let fnHash = userData.name ? await hashSHA256(userData.name.split(' ')[0].toLowerCase().trim()) : undefined;
    let lnHash = userData.name?.includes(' ') ? await hashSHA256(userData.name.split(' ').slice(1).join(' ').toLowerCase().trim()) : undefined;
    let countryHash = await hashSHA256('it');

    const payload = {
        data: [{
            event_name: eventName,
            event_time: Math.floor(Date.now() / 1000),
            event_id: eventId,
            action_source: 'website',
            event_source_url: userData.event_source_url || undefined,
            user_data: {
                em: emHash ? [emHash] : undefined,
                ph: phHash ? [phHash] : undefined,
                fn: fnHash ? [fnHash] : undefined,
                ln: lnHash ? [lnHash] : undefined,
                country: [countryHash],
                fbc: userData.fbc || undefined,
                fbp: userData.fbp || undefined,
                external_id: undefined,
                client_ip_address: userData.client_ip || undefined,
                client_user_agent: userData.client_user_agent || undefined,
            },
            custom_data: {
                content_category: userData.content_category || undefined,
                currency: 'EUR',
                value: 0,
            },
        }],
    }

    const res = await fetch(
        "https://graph.facebook.com/v21.0/" + pixelId + "/events?access_token=" + conn.credentials.access_token,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        }
    )

    const result = await res.json()
    console.log("CAPI Result:", result)

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

async function moveLeads() {
    const emails = ['tina.perego@outlook.it', 'dragottadavide3@gmail.com', 'lucaperinibar@gmail.com'];
    const { data: leads } = await admin.from('leads').select('*, funnels!leads_funnel_id_fkey(objective)').in('email', emails);
    
    // "Appuntamento" Stage
    const newStageId = "c47850eb-42f0-407f-9760-30474d793487";
    const newStageName = "Appuntamento";
    const fireEvent = "Schedule";
    
    for (const lead of leads) {
        if (lead.stage_id === newStageId) {
            console.log("Lead", lead.email, "is already in Appuntamento stage.");
            continue;
        }
        
        const oldStageId = lead.stage_id;
        console.log("Updating lead:", lead.email);
        
        await admin.from('leads').update({ stage_id: newStageId, updated_at: new Date().toISOString() }).eq('id', lead.id);
        
        await admin.from('lead_activities').insert({
            organization_id: lead.organization_id,
            lead_id: lead.id,
            user_id: null,
            activity_type: 'stage_changed',
            from_stage_id: oldStageId,
            to_stage_id: newStageId,
        });

        const funnelObjective = lead.funnels?.objective || 'cliente';
        const meta = lead.meta_data || {};
        
        await fireCapiEvent(lead.organization_id, fireEvent, {
            name: lead.name,
            email: lead.email,
            phone: lead.phone,
            value: lead.value,
            content_category: funnelObjective,
            fbc: meta.fbc || undefined,
            fbp: meta.fbp || undefined,
            client_ip: meta.client_ip || undefined,
            client_user_agent: meta.client_user_agent || undefined,
            event_source_url: meta.event_source_url || undefined,
        }, lead.id);
        
        await admin.from('lead_activities').insert({
            organization_id: lead.organization_id,
            lead_id: lead.id,
            user_id: null,
            activity_type: 'capi_event_sent',
            notes: "Evento Schedule inviato a Meta CAPI via Agent",
            meta_data: { event_name: fireEvent, stage: newStageName, skipped: false },
        });
        console.log("Done for", lead.email);
    }
}

moveLeads().catch(console.error)
