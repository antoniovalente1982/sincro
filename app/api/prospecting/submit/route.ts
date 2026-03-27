import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'

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

// Rate limiting: simple in-memory store
const rateLimits = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT = 30 // max 30 requests per minute per API key
const RATE_WINDOW = 60_000

function checkRateLimit(key: string): boolean {
    const now = Date.now()
    const entry = rateLimits.get(key)
    if (!entry || now > entry.resetAt) {
        rateLimits.set(key, { count: 1, resetAt: now + RATE_WINDOW })
        return true
    }
    if (entry.count >= RATE_LIMIT) return false
    entry.count++
    return true
}

export async function POST(req: NextRequest) {
    try {
        // Auth via API key
        const headersList = await headers()
        const apiKey = headersList.get('x-api-key') || req.headers.get('x-api-key')

        if (!apiKey) {
            return NextResponse.json({ error: 'Missing X-API-Key header' }, { status: 401 })
        }

        // Rate limit
        if (!checkRateLimit(apiKey)) {
            return NextResponse.json({ error: 'Rate limit exceeded. Max 30/min.' }, { status: 429 })
        }

        // Validate agent
        const { data: agent, error: agentErr } = await getSupabaseAdmin()
            .from('prospecting_agents')
            .select('id, organization_id, status, name')
            .eq('api_key', apiKey)
            .single()

        if (agentErr || !agent) {
            return NextResponse.json({ error: 'Invalid API key' }, { status: 401 })
        }

        if (agent.status !== 'active') {
            return NextResponse.json({ error: 'Agent is paused or revoked' }, { status: 403 })
        }

        const body = await req.json()
        const { name, email, phone, notes, source, value, product, extra_data } = body

        if (!name) {
            return NextResponse.json({ error: 'Name is required' }, { status: 400 })
        }

        // Get first pipeline stage
        const { data: firstStage } = await getSupabaseAdmin()
            .from('pipeline_stages')
            .select('id')
            .eq('organization_id', agent.organization_id)
            .order('sort_order', { ascending: true })
            .limit(1)
            .single()

        // Create lead (trigger will auto-assign + update agent stats)
        const { data: lead, error: leadErr } = await getSupabaseAdmin()
            .from('leads')
            .insert({
                organization_id: agent.organization_id,
                name,
                email: email || null,
                phone: phone || null,
                notes: notes || null,
                value: value || null,
                product: product || null,
                source_channel: 'prospecting',
                prospecting_agent_id: agent.id,
                stage_id: firstStage?.id || null,
                utm_source: source || 'prospecting',
                utm_campaign: `agent_${agent.name.toLowerCase().replace(/\s+/g, '_')}`,
                meta_data: {
                    source: 'prospecting',
                    agent_name: agent.name,
                    extra: extra_data || {},
                },
            })
            .select('id, name, created_at')
            .single()

        if (leadErr) {
            return NextResponse.json({ error: leadErr.message }, { status: 500 })
        }

        // Log activity
        await getSupabaseAdmin().from('lead_activities').insert({
            organization_id: agent.organization_id,
            lead_id: lead.id,
            activity_type: 'stage_changed',
            to_stage_id: firstStage?.id || null,
            notes: `Lead portato da agente prospecting: ${agent.name}`,
        })

        // Create notification
        await getSupabaseAdmin().from('notifications').insert({
            organization_id: agent.organization_id,
            type: 'info',
            title: '🕵️ Nuovo lead da Prospecting',
            message: `${agent.name} ha portato: ${name}${email ? ` (${email})` : ''}`,
            link: '/dashboard/crm',
        })

        return NextResponse.json({
            success: true,
            lead_id: lead.id,
            message: `Lead "${name}" created successfully`,
        })
    } catch (err: any) {
        console.error('Prospecting submit error:', err)
        return NextResponse.json({ error: 'Internal error' }, { status: 500 })
    }
}
