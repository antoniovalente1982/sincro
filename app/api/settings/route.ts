import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

async function getOrgAndRole(supabase: any) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null
    const { data: member } = await supabase
        .from('organization_members')
        .select('organization_id, role')
        .eq('user_id', user.id)
        .single()
    return member ? { ...member, user_id: user.id } : null
}

// Update org or manage pipeline stages
export async function PUT(req: NextRequest) {
    const supabase = await createClient()
    const ctx = await getOrgAndRole(supabase)
    if (!ctx || (ctx.role !== 'owner' && ctx.role !== 'admin')) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json()

    if (body.action === 'update_org') {
        const { name } = body
        const { data, error } = await supabase
            .from('organizations')
            .update({ name, updated_at: new Date().toISOString() })
            .eq('id', ctx.organization_id)
            .select()
            .single()
        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
        return NextResponse.json(data)
    }

    if (body.action === 'update_profile') {
        const { full_name } = body
        const { data, error } = await supabase
            .from('profiles')
            .update({ full_name, updated_at: new Date().toISOString() })
            .eq('id', ctx.user_id)
            .select()
            .single()
        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
        return NextResponse.json(data)
    }

    if (body.action === 'create_stage') {
        const { name, slug, color, fire_capi_event, sort_order } = body
        const { data, error } = await supabase
            .from('pipeline_stages')
            .insert({
                organization_id: ctx.organization_id,
                name,
                slug: slug || name.toLowerCase().replace(/[^a-z0-9]/g, '_'),
                color: color || '#6366f1',
                fire_capi_event: fire_capi_event || null,
                sort_order: sort_order || 0,
            })
            .select()
            .single()
        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
        return NextResponse.json(data)
    }

    if (body.action === 'update_stage') {
        const { id, ...updates } = body
        delete updates.action
        const { data, error } = await supabase
            .from('pipeline_stages')
            .update(updates)
            .eq('id', id)
            .eq('organization_id', ctx.organization_id)
            .select()
            .single()
        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
        return NextResponse.json(data)
    }

    if (body.action === 'delete_stage') {
        const stageId = body.id
        const orgId = ctx.organization_id

        // Usiamo il service_role per bypassare le RLS strict su lead_activities (che normalmente è append-only)
        const supabaseAdmin = createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

        // Sgancia il target e le associazioni per non violare i Foreign Key (RESTRICT) usando admin client
        await supabaseAdmin.from('leads').update({ stage_id: null }).eq('stage_id', stageId).eq('organization_id', orgId)
        await supabaseAdmin.from('lead_activities').update({ from_stage_id: null }).eq('from_stage_id', stageId).eq('organization_id', orgId)
        await supabaseAdmin.from('lead_activities').update({ to_stage_id: null }).eq('to_stage_id', stageId).eq('organization_id', orgId)

        const { error } = await supabaseAdmin
            .from('pipeline_stages')
            .delete()
            .eq('id', stageId)
            .eq('organization_id', orgId)
            
        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
        return NextResponse.json({ success: true })
    }
    
    if (body.action === 'create_traffic_source') {
        const { name, color } = body
        const { data, error } = await supabase
            .from('traffic_sources')
            .insert({
                organization_id: ctx.organization_id,
                name,
                color: color || '#6366f1',
            })
            .select()
            .single()
        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
        return NextResponse.json(data)
    }

    if (body.action === 'update_traffic_source') {
        const { id, name, color } = body
        const { data, error } = await supabase
            .from('traffic_sources')
            .update({ name, color })
            .eq('id', id)
            .eq('organization_id', ctx.organization_id)
            .select()
            .single()
        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
        return NextResponse.json(data)
    }

    if (body.action === 'delete_traffic_source') {
        const { id } = body
        const { error } = await supabase
            .from('traffic_sources')
            .delete()
            .eq('id', id)
            .eq('organization_id', ctx.organization_id)
        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
        return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
}
