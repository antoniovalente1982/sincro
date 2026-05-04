import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getSupabaseAdmin() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    )
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

        return NextResponse.json({ success: true, lead_id: leadId })

    } catch (err: any) {
        console.error('WooCommerce Webhook Error:', err)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}
