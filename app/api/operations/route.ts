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

// Tag definitions for categorizing operations
const TAG_COLORS: Record<string, string> = {
    'ads': '#6366f1',
    'budget': '#22c55e',
    'campaign': '#f59e0b',
    'crm': '#3b82f6',
    'strategy': '#a855f7',
    'system': '#71717a',
    'pipeline': '#ec4899',
    'creative': '#14b8a6',
    'optimization': '#ef4444',
    'analysis': '#8b5cf6',
}

// GET — retrieve operations history
export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url)
    const orgId = searchParams.get('org_id')
    const tag = searchParams.get('tag')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    if (!orgId) return NextResponse.json({ error: 'org_id required' }, { status: 400 })

    let query = getSupabaseAdmin()
        .from('ai_episodes')
        .select('*')
        .eq('organization_id', orgId)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1)

    if (tag) {
        query = query.eq('action_type', tag)
    }

    const { data, error } = await query

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Get tag counts
    const { data: allEpisodes } = await getSupabaseAdmin()
        .from('ai_episodes')
        .select('action_type')
        .eq('organization_id', orgId)

    const tagCounts: Record<string, number> = {}
    ;(allEpisodes || []).forEach((e: any) => {
        const t = e.action_type || 'system'
        tagCounts[t] = (tagCounts[t] || 0) + 1
    })

    return NextResponse.json({
        episodes: data || [],
        tagCounts,
        tagColors: TAG_COLORS,
        total: allEpisodes?.length || 0,
    })
}

// POST — log a new operation
export async function POST(req: NextRequest) {
    try {
        const body = await req.json()
        const {
            organization_id,
            action_type,    // tag: ads, budget, campaign, crm, strategy, etc.
            target_type,    // what: campaign, lead, pipeline, budget, rule, etc.
            target_id,      // optional: ID of the target
            target_name,    // name/description of the target
            reasoning,      // why this action was taken
            context,        // additional context (JSON)
            metrics_before, // metrics before the action (JSON)
            metrics_after,  // metrics after the action (JSON)
            outcome,        // pending, positive, negative, neutral
            outcome_notes,  // notes about the outcome
            episode_type,   // action, observation, decision, alert, learning
        } = body

        if (!organization_id) {
            return NextResponse.json({ error: 'organization_id required' }, { status: 400 })
        }

        const { data, error } = await getSupabaseAdmin()
            .from('ai_episodes')
            .insert({
                organization_id,
                episode_type: episode_type || 'action',
                action_type: action_type || 'system',
                target_type: target_type || null,
                target_id: target_id || null,
                target_name: target_name || null,
                reasoning: reasoning || null,
                context: context || {},
                metrics_before: metrics_before || {},
                metrics_after: metrics_after || {},
                outcome: outcome || 'pending',
                outcome_notes: outcome_notes || null,
            })
            .select()
            .single()

        if (error) return NextResponse.json({ error: error.message }, { status: 500 })

        return NextResponse.json(data)
    } catch (err) {
        return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
    }
}
