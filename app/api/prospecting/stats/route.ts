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

export async function GET(req: NextRequest) {
    const headersList = await headers()
    const apiKey = headersList.get('x-api-key') || req.headers.get('x-api-key')

    if (!apiKey) {
        return NextResponse.json({ error: 'Missing X-API-Key header' }, { status: 401 })
    }

    const { data: agent, error } = await getSupabaseAdmin()
        .from('prospecting_agents')
        .select('id, name, email, status, commission_type, commission_value, total_submitted, total_qualified, total_converted, total_revenue, created_at')
        .eq('api_key', apiKey)
        .single()

    if (error || !agent) {
        return NextResponse.json({ error: 'Invalid API key' }, { status: 401 })
    }

    // Get recent leads by this agent
    const { data: recentLeads } = await getSupabaseAdmin()
        .from('leads')
        .select('id, name, email, created_at, pipeline_stages(name, color)')
        .eq('prospecting_agent_id', agent.id)
        .order('created_at', { ascending: false })
        .limit(20)

    return NextResponse.json({
        agent: {
            name: agent.name,
            status: agent.status,
            commission: { type: agent.commission_type, value: agent.commission_value },
            stats: {
                total_submitted: agent.total_submitted,
                total_qualified: agent.total_qualified,
                total_converted: agent.total_converted,
                total_revenue: agent.total_revenue,
                conversion_rate: agent.total_submitted > 0
                    ? ((agent.total_converted / agent.total_submitted) * 100).toFixed(1)
                    : '0.0',
            },
        },
        recent_leads: recentLeads || [],
    })
}
