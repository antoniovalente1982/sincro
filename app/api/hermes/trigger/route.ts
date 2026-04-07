import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

/**
 * Manual trigger for Hermes operations.
 * Called from the dashboard — authenticated via user session (no CRON_SECRET needed).
 * 
 * POST /api/hermes/trigger
 * Body: { action: 'pulse' | 'agent-loop' }
 */
export async function POST(req: NextRequest) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { action } = await req.json()

    if (!['pulse', 'agent-loop'].includes(action)) {
        return NextResponse.json({ error: 'Invalid action. Use "pulse" or "agent-loop".' }, { status: 400 })
    }

    const cronSecret = process.env.CRON_SECRET
    if (!cronSecret) {
        return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 })
    }

    // Determine which endpoint to call
    const endpoint = action === 'pulse' 
        ? '/api/ai-engine/pulse'
        : '/api/cron/agent-loop'

    try {
        // Call the internal endpoint with proper auth
        const baseUrl = process.env.VERCEL_URL 
            ? `https://${process.env.VERCEL_URL}` 
            : process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'

        const response = await fetch(`${baseUrl}${endpoint}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${cronSecret}`
            }
        })

        const data = await response.json()

        // Log the manual trigger
        const { data: member } = await supabase
            .from('organization_members')
            .select('organization_id')
            .eq('user_id', user.id)
            .single()

        if (member) {
            await supabase.from('ai_realtime_logs').insert({
                organization_id: member.organization_id,
                action: `Manual ${action}`,
                message: `Hermes ${action} triggerato manualmente da ${user.email}`,
                details: { status: response.status, user_id: user.id },
                tokens_used: 0
            })
        }

        if (!response.ok) {
            return NextResponse.json({ 
                error: `${action} failed`, 
                details: data 
            }, { status: response.status })
        }

        return NextResponse.json({ 
            success: true, 
            action,
            result: data 
        })
    } catch (error: any) {
        console.error(`Manual ${action} trigger error:`, error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
