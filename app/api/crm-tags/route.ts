import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
    try {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { data: member } = await supabase
            .from('organization_members')
            .select('organization_id')
            .eq('user_id', user.id)
            .single()

        if (!member) {
            return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
        }

        // Get optional search param
        const url = new URL(req.url)
        const nameQuery = url.searchParams.get('name')

        let query = supabase
            .from('crm_tags')
            .select('*')
            .eq('organization_id', member.organization_id)
            .order('name', { ascending: true })

        if (nameQuery) {
            query = query.ilike('name', `%${nameQuery}%`)
        }

        const { data: tags, error } = await query

        if (error) throw error

        return NextResponse.json(tags || [])
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 })
    }
}

export async function POST(req: NextRequest) {
    try {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { data: member } = await supabase
            .from('organization_members')
            .select('organization_id')
            .eq('user_id', user.id)
            .single()

        if (!member) {
            return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
        }

        const body = await req.json()
        const { name, color } = body

        if (!name) {
            return NextResponse.json({ error: 'Tag name is required' }, { status: 400 })
        }

        // Palette dei colori se non specificato
        const defaultColors = ['#6366f1', '#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#ec4899', '#a855f7', '#14b8a6']
        const randomColor = defaultColors[Math.floor(Math.random() * defaultColors.length)]

        const { data: newTag, error } = await supabase
            .from('crm_tags')
            .insert({
                organization_id: member.organization_id,
                name: name.trim(),
                color: color || randomColor
            })
            .select()
            .single()

        if (error) {
            // Check if unique constraint violation (tag already exists)
            if (error.code === '23505') {
                return NextResponse.json({ error: 'Questo tag esiste già' }, { status: 400 })
            }
            throw error
        }

        return NextResponse.json(newTag)
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 })
    }
}

export async function DELETE(req: NextRequest) {
    try {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const url = new URL(req.url)
        const id = url.searchParams.get('id')

        if (!id) {
            return NextResponse.json({ error: 'ID is required' }, { status: 400 })
        }

        const { error } = await supabase
            .from('crm_tags')
            .delete()
            .eq('id', id)
        // RLS protects across organizations

        if (error) throw error

        return NextResponse.json({ success: true })
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 })
    }
}
