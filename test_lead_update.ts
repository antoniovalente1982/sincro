import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function test() {
    const orgId = "a5dd4842-f0ea-4909-b4a3-be2cb1c6ffa5" 
    const leadId = "2117a3da-fe86-4035-9064-534c7af9068f" // Federico
    const toStage = "e91bedb8-6c18-4ec5-a1c3-f6533095b497" // Vendita
    const fromStage = "4d7faf7a-e25e-486a-8b5a-93dce223612b" // Show-up

    const updates: any = { stage_id: toStage, _old_stage_id: fromStage }

    // Log activity (simulating anon role via RLS bypass for test)
    const { error: actErr } = await supabase.from('lead_activities').insert({
        organization_id: orgId,
        lead_id: leadId,
        user_id: null,
        activity_type: 'stage_changed',
        from_stage_id: updates._old_stage_id,
        to_stage_id: updates.stage_id,
    })
    console.log("Activity insert error:", actErr?.message)

    console.log("WAIT: Trying to fetch lead value")
    const leadForCapi = await supabase
        .from('leads')
        .select('name, email, phone, value, funnel_id, meta_data, funnels!leads_funnel_id_fkey(objective)')
        .eq('id', leadId)
        .single()
    console.log("Lead value fetched: ", leadForCapi.data?.value)

    const newStage = { name: 'Vendita', fire_capi_event: 'Purchase' }
    if (newStage?.fire_capi_event) {
        // Log CAPI activity
        const { error: capiErr } = await supabase.from('lead_activities').insert({
            organization_id: orgId,
            lead_id: leadId,
            user_id: null,
            activity_type: 'capi_event_sent',
            notes: `Evento "${newStage.fire_capi_event}" inviato a Meta CAPI`,
            meta_data: { event_name: newStage.fire_capi_event, stage: newStage.name },
        })
        console.log("CAPI Activity insert error:", capiErr?.message)
    }

    delete updates._old_stage_id

    const { data, error } = await supabase
        .from('leads')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', leadId)
        .eq('organization_id', orgId)
        .select()
        .single()
    
    console.log("Lead Update error:", error?.message || error)
    console.log("Lead Update data stage:", data?.stage_id)
}
test()
