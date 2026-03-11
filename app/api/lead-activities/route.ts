import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
    const supabase = await createClient()
    const { searchParams } = new URL(req.url)
    const leadId = searchParams.get('lead_id')

    if (!leadId) return NextResponse.json({ error: 'lead_id required' }, { status: 400 })

    const { data, error } = await supabase
        .from('lead_activities')
        .select(`
            *,
            from_stage:from_stage_id (name, color),
            to_stage:to_stage_id (name, color),
            user:user_id (email, full_name)
        `)
        .eq('lead_id', leadId)
        .order('created_at', { ascending: false })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: member } = await supabase
        .from('organization_members')
        .select('organization_id')
        .eq('user_id', user.id)
        .single()

    if (!member) return NextResponse.json({ error: 'No org' }, { status: 401 })

    const body = await req.json()
    const { data, error } = await supabase
        .from('lead_activities')
        .insert({
            ...body,
            organization_id: member.organization_id,
            user_id: user.id,
        })
        .select()
        .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
}
