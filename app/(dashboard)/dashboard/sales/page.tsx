import { createClient } from '@/lib/supabase/server'
import SalesDashboard from './SalesDashboard'

export default async function SalesPage() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    const { data: member } = await supabase
        .from('organization_members')
        .select('organization_id')
        .eq('user_id', user?.id || '')
        .single()

    const orgId = member?.organization_id || ''

    const { data: leads } = await supabase
        .from('leads')
        .select('id, created_at, setter_id, closer_id, closer_appt_status, esito, closer_outcome, value, pipeline_stages(is_won, is_lost)')
        .eq('organization_id', orgId)
        .order('created_at', { ascending: false })

    return (
        <SalesDashboard leads={leads || []} />
    )
}
