import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

// GET — list ad creatives with optional filters
export async function GET(req: NextRequest) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: member } = await supabase
        .from('organization_members')
        .select('organization_id')
        .eq('user_id', user.id)
        .single()

    if (!member) return NextResponse.json({ error: 'No organization' }, { status: 404 })

    const orgId = member.organization_id
    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status')
    const angle = searchParams.get('angle')
    const adsetId = searchParams.get('adset_id')

    let query = supabase
        .from('ad_creatives')
        .select('*')
        .eq('organization_id', orgId)
        .order('created_at', { ascending: false })

    if (status) query = query.eq('status', status)
    if (angle) query = query.eq('angle', angle)
    if (adsetId) query = query.eq('target_adset_id', adsetId)

    const { data, error } = await query.limit(100)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ creatives: data })
}

// POST — create a new ad creative (from AI Engine or manual)
export async function POST(req: NextRequest) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: member } = await supabase
        .from('organization_members')
        .select('organization_id')
        .eq('user_id', user.id)
        .single()

    if (!member) return NextResponse.json({ error: 'No organization' }, { status: 404 })

    const body = await req.json()

    const { data, error } = await supabase
        .from('ad_creatives')
        .insert({
            organization_id: member.organization_id,
            name: body.name,
            angle: body.angle,
            pocket_id: body.pocket_id,
            pocket_name: body.pocket_name,
            buyer_state: body.buyer_state,
            core_question: body.core_question,
            target_adset_id: body.target_adset_id,
            target_adset_name: body.target_adset_name,
            landing_utm_term: body.landing_utm_term,
            image_url: body.image_url,
            copy_primary: body.copy_primary,
            copy_headline: body.copy_headline,
            copy_description: body.copy_description,
            cta_type: body.cta_type || 'LEARN_MORE',
            aspect_ratio: body.aspect_ratio || '4:5',
            brief_data: body.brief_data || {},
            winning_patterns: body.winning_patterns || {},
            status: body.status || 'draft',
            meta_campaign_id: body.meta_campaign_id,
            created_by: body.created_by || 'manual',
        })
        .select()
        .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ creative: data }, { status: 201 })
}

// PUT — update an ad creative (status change, performance sync, Meta ID linking)
export async function PUT(req: NextRequest) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: member } = await supabase
        .from('organization_members')
        .select('organization_id')
        .eq('user_id', user.id)
        .single()

    if (!member) return NextResponse.json({ error: 'No organization' }, { status: 404 })

    const body = await req.json()
    if (!body.id) return NextResponse.json({ error: 'Missing creative ID' }, { status: 400 })

    // Build update object dynamically (only include provided fields)
    const updates: Record<string, any> = {}
    const allowedFields = [
        'name', 'status', 'image_url', 'copy_primary', 'copy_headline', 'copy_description',
        'cta_type', 'meta_ad_id', 'meta_adset_id', 'meta_campaign_id', 'launched_at',
        'spend', 'impressions', 'clicks', 'leads_count', 'cpl', 'ctr', 'roas',
        'kill_reason', 'target_adset_id', 'target_adset_name',
    ]
    for (const field of allowedFields) {
        if (body[field] !== undefined) updates[field] = body[field]
    }

    // Track who approved
    if (body.status === 'approved') {
        updates.approved_by = user.id
    }
    if (body.status === 'launched' && !updates.launched_at) {
        updates.launched_at = new Date().toISOString()
    }

    const { data, error } = await supabase
        .from('ad_creatives')
        .update(updates)
        .eq('id', body.id)
        .eq('organization_id', member.organization_id)
        .select()
        .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ creative: data })
}
