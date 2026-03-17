import { createClient } from '@/lib/supabase/server'
import ContextWindow from '../ai-engine/ContextWindow'

export default async function OperationsPage() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    const { data: member } = await supabase
        .from('organization_members')
        .select('organization_id')
        .eq('user_id', user?.id || '')
        .single()

    const orgId = member?.organization_id || ''

    return <ContextWindow organizationId={orgId} />
}
