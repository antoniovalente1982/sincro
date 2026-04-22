import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

function getSupabaseAdmin() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    )
}

function generateSlug(name: string): string {
    return name.toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // Remove accents
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .substring(0, 30)
}

// CREATE or UPDATE partner
export async function POST(req: NextRequest) {
    try {
        const body = await req.json()
        const { id, name, email, phone, type, notes } = body

        if (!name) {
            return NextResponse.json({ error: 'Name is required' }, { status: 400 })
        }

        const commission = type === 'ambassador' ? 15 : 10
        const commissionAmount = type === 'ambassador' ? 337 : 225 // €2250 * %

        if (id) {
            // UPDATE existing
            const { data, error } = await getSupabaseAdmin()
                .from('partners')
                .update({
                    name, email: email || null, phone: phone || null,
                    type, commission, commission_amount: commissionAmount,
                    notes: notes || null, updated_at: new Date().toISOString(),
                })
                .eq('id', id)
                .select()
                .single()

            if (error) return NextResponse.json({ error: error.message }, { status: 500 })
            return NextResponse.json({ partner: data })
        } else {
            // CREATE new
            const slug = generateSlug(name)
            
            // Check slug uniqueness
            const { data: existing } = await getSupabaseAdmin()
                .from('partners')
                .select('id')
                .eq('slug', slug)
                .single()

            const finalSlug = existing ? `${slug}-${Date.now().toString(36).slice(-4)}` : slug

            const { data, error } = await getSupabaseAdmin()
                .from('partners')
                .insert({
                    name, email: email || null, phone: phone || null,
                    type, commission, commission_amount: commissionAmount,
                    slug: finalSlug, status: 'active',
                    notes: notes || null,
                })
                .select()
                .single()

            if (error) return NextResponse.json({ error: error.message }, { status: 500 })
            return NextResponse.json({ partner: data })
        }
    } catch (err: any) {
        console.error('Partner save error:', err)
        return NextResponse.json({ error: 'Internal error' }, { status: 500 })
    }
}

// DELETE partner
export async function DELETE(req: NextRequest) {
    try {
        const { id } = await req.json()
        if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 })

        const { error } = await getSupabaseAdmin()
            .from('partners')
            .update({ status: 'inactive', updated_at: new Date().toISOString() })
            .eq('id', id)

        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
        return NextResponse.json({ success: true })
    } catch (err: any) {
        console.error('Partner delete error:', err)
        return NextResponse.json({ error: 'Internal error' }, { status: 500 })
    }
}
