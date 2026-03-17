import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { syncAllLeadsToSheet } from '@/lib/google-sheets'

// POST — Sync leads to Google Sheets
export async function POST(req: NextRequest) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: member } = await supabase
        .from('organization_members')
        .select('organization_id, role')
        .eq('user_id', user.id)
        .single()

    if (!member || (member.role !== 'owner' && member.role !== 'admin')) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const result = await syncAllLeadsToSheet(member.organization_id)

    if (result.success) {
        return NextResponse.json({
            success: true,
            message: `Sincronizzati ${result.count} lead su Google Sheets`,
            count: result.count,
        })
    } else {
        return NextResponse.json({
            error: 'Sincronizzazione fallita. Controlla le credenziali Google Sheets.',
        }, { status: 400 })
    }
}
