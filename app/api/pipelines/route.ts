import { NextRequest, NextResponse } from 'next/server'
import { createClient, SupabaseClient } from '@supabase/supabase-js'

function getSupabaseAdmin() {
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!serviceKey) {
        console.error('SUPABASE_SERVICE_ROLE_KEY is missing. Falling back to ANON_KEY, which may cause RLS errors.')
    }
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        serviceKey || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    )
}

// GET — list pipelines with stage counts
export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url)
    const orgId = searchParams.get('org_id')
    if (!orgId) return NextResponse.json({ error: 'org_id required' }, { status: 400 })

    const { data, error } = await getSupabaseAdmin()
        .from('pipelines')
        .select('*, pipeline_stages(count)')
        .eq('organization_id', orgId)
        .order('sort_order')

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data || [])
}

// POST — create new pipeline with default stages
export async function POST(req: NextRequest) {
    try {
        const body = await req.json()
        let { organization_id, name, source_type, color, description } = body

        // Auto-detect org_id from auth if not provided
        if (!organization_id) {
            const { data: members } = await getSupabaseAdmin()
                .from('organization_members')
                .select('organization_id')
                .limit(1)
            organization_id = members?.[0]?.organization_id
        }

        if (!organization_id || !name) {
            return NextResponse.json({ error: 'organization_id and name required' }, { status: 400 })
        }

        const slug = name.toLowerCase()
            .replace(/[^a-z0-9\s-]/g, '')
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-')
            .trim()

        // Get max sort_order
        const { data: existing } = await getSupabaseAdmin()
            .from('pipelines')
            .select('sort_order')
            .eq('organization_id', organization_id)
            .order('sort_order', { ascending: false })
            .limit(1)

        const nextOrder = (existing?.[0]?.sort_order || 0) + 1

        // Create pipeline
        const { data: pipeline, error } = await getSupabaseAdmin()
            .from('pipelines')
            .insert({
                organization_id,
                name,
                slug: `${slug}-${Date.now()}`,
                source_type: source_type || 'custom',
                color: color || '#6366f1',
                description: description || '',
                is_default: false,
                sort_order: nextOrder,
            })
            .select()
            .single()

        if (error) return NextResponse.json({ error: error.message }, { status: 500 })

        // Create default stages for this pipeline
        const defaultStages = [
            { name: 'Lead', slug: `lead-${pipeline.id.slice(0,8)}`, color: '#3b82f6', sort_order: 0, fire_capi_event: 'Lead' },
            { name: 'Qualificato', slug: `qualificato-${pipeline.id.slice(0,8)}`, color: '#6366f1', sort_order: 1, fire_capi_event: 'QualifiedLead' },
            { name: 'Appuntamento', slug: `appuntamento-${pipeline.id.slice(0,8)}`, color: '#f59e0b', sort_order: 2, fire_capi_event: 'Schedule' },
            { name: 'Show-up', slug: `showup-${pipeline.id.slice(0,8)}`, color: '#a855f7', sort_order: 3, fire_capi_event: 'ShowUp' },
            { name: 'Vendita', slug: `vendita-${pipeline.id.slice(0,8)}`, color: '#22c55e', sort_order: 4, is_won: true, fire_capi_event: 'Purchase' },
            { name: 'Perso', slug: `perso-${pipeline.id.slice(0,8)}`, color: '#ef4444', sort_order: 5, is_lost: true },
        ]

        await getSupabaseAdmin()
            .from('pipeline_stages')
            .insert(defaultStages.map(s => ({
                organization_id,
                pipeline_id: pipeline.id,
                ...s,
            })))

        return NextResponse.json(pipeline)
    } catch (err) {
        return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
    }
}

// DELETE — delete a pipeline and its stages (cannot delete default)
export async function DELETE(req: NextRequest) {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

    // Check if default
    const { data: pipeline } = await getSupabaseAdmin()
        .from('pipelines')
        .select('is_default')
        .eq('id', id)
        .single()

    if (pipeline?.is_default) {
        return NextResponse.json({ error: 'Non puoi eliminare la pipeline predefinita' }, { status: 400 })
    }

    // Check if pipeline has leads
    const { data: stageIds } = await getSupabaseAdmin()
        .from('pipeline_stages')
        .select('id')
        .eq('pipeline_id', id)

    if (stageIds && stageIds.length > 0) {
        const { count } = await getSupabaseAdmin()
            .from('leads')
            .select('id', { count: 'exact', head: true })
            .in('stage_id', stageIds.map(s => s.id))

        if (count && count > 0) {
            return NextResponse.json({ error: `Non puoi eliminare: ${count} lead presenti in questa pipeline` }, { status: 400 })
        }
    }

    // Delete stages first, then pipeline
    await getSupabaseAdmin()
        .from('pipeline_stages')
        .delete()
        .eq('pipeline_id', id)

    const { error } = await getSupabaseAdmin()
        .from('pipelines')
        .delete()
        .eq('id', id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
}
