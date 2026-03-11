import { createClient } from '@/lib/supabase/server'
import TeamPanel from './TeamPanel'

export default async function TeamPage() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    const { data: member } = await supabase
        .from('organization_members')
        .select('organization_id, role')
        .eq('user_id', user?.id || '')
        .single()

    return <TeamPanel orgId={member?.organization_id || ''} userRole={member?.role || 'viewer'} />
}
