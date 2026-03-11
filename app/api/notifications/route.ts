import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

async function getOrgId(supabase: any) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null
    const { data: member } = await supabase
        .from('organization_members')
        .select('organization_id')
        .eq('user_id', user.id)
        .single()
    return member?.organization_id || null
}

export async function GET() {
    const supabase = await createClient()
    const orgId = await getOrgId(supabase)
    if (!orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('organization_id', orgId)
        .order('created_at', { ascending: false })
        .limit(30)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const unreadCount = (data || []).filter((n: any) => !n.is_read).length

    return NextResponse.json({ notifications: data || [], unreadCount })
}

export async function POST(req: NextRequest) {
    const supabase = await createClient()
    const orgId = await getOrgId(supabase)
    if (!orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()

    if (body.action === 'mark_read') {
        const { id } = body
        if (id === 'all') {
            await supabase
                .from('notifications')
                .update({ is_read: true })
                .eq('organization_id', orgId)
                .eq('is_read', false)
        } else {
            await supabase
                .from('notifications')
                .update({ is_read: true })
                .eq('id', id)
                .eq('organization_id', orgId)
        }
        return NextResponse.json({ success: true })
    }

    if (body.action === 'dismiss') {
        await supabase
            .from('notifications')
            .delete()
            .eq('id', body.id)
            .eq('organization_id', orgId)
        return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
}
