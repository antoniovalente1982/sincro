import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'

export async function POST(request: Request) {
    const supabase = await createClient()
    const supabaseAdmin = getSupabaseAdmin()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
        return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })
    }

    // Verifica il ruolo di admin/owner/manager
    const { data: member } = await supabase
        .from('organization_members')
        .select('organization_id, role')
        .eq('user_id', user.id)
        .is('deactivated_at', null)
        .single()

    if (!member || !['owner', 'admin', 'manager'].includes(member.role)) {
        return NextResponse.json({ error: 'Accesso negato' }, { status: 403 })
    }

    const orgId = member.organization_id
    const userId = user.id

    try {
        // 1. Elimina le sessioni di distribuzione dell'amministratore
        await supabaseAdmin
            .from('lead_distribution_sessions')
            .delete()
            .eq('user_id', userId)

        // 2. Elimina le quote giornaliere dell'amministratore
        await supabaseAdmin
            .from('lead_daily_quota')
            .delete()
            .eq('user_id', userId)

        // 3. Ripristina i lead del pool assegnati all'amministratore impostandoli come disponibili
        const { count } = await supabaseAdmin
            .from('lead_pool')
            .update({
                status: 'available',
                assigned_to: null,
                assigned_at: null,
                first_called_at: null,
                last_called_at: null,
                call_count: 0,
                feedback: null,
                feedback_notes: null,
                feedback_at: null,
                session_id: null,
                updated_at: new Date().toISOString()
            }, { count: 'exact' })
            .eq('assigned_to', userId)

        // 4. Ricalcola available_count per le liste dell'organizzazione
        const { data: lists } = await supabaseAdmin
            .from('lead_lists')
            .select('id')
            .eq('organization_id', orgId)

        for (const list of lists || []) {
            const { count: availCount } = await supabaseAdmin
                .from('lead_pool')
                .select('*', { count: 'exact', head: true })
                .eq('list_id', list.id)
                .eq('status', 'available')

            await supabaseAdmin
                .from('lead_lists')
                .update({ available_count: availCount || 0, updated_at: new Date().toISOString() })
                .eq('id', list.id)
        }

        return NextResponse.json({
            success: true,
            released_count: count || 0
        })
    } catch (err: any) {
        console.error('[CLEAN_TESTS] Error:', err)
        return NextResponse.json({ error: 'Errore durante la pulizia dei test' }, { status: 500 })
    }
}
