import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getSupabaseAdmin() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    )
}

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url)
    const orgId = searchParams.get('orgId')
    if (!orgId) return NextResponse.json({ error: 'orgId required' }, { status: 400 })

    const supabase = getSupabaseAdmin()

    try {
        const [knowledgeRes, experimentsRes] = await Promise.all([
            supabase
                .from('agent_knowledge')
                .select('*')
                .eq('organization_id', orgId)
                .order('created_at', { ascending: false })
                .limit(100),
            supabase
                .from('ai_experiments')
                .select('*')
                .eq('organization_id', orgId)
                .order('created_at', { ascending: false })
                .limit(50),
        ])

        return NextResponse.json({
            knowledge: knowledgeRes.data || [],
            experiments: experimentsRes.data || [],
        })
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 })
    }
}
