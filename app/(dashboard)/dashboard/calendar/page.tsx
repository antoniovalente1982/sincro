import { createClient } from '@/lib/supabase/server'
import CalendarPanel from './CalendarPanel'

export default async function CalendarPage() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    const { data: member } = await supabase
        .from('organization_members')
        .select('organization_id, role, department')
        .eq('user_id', user?.id || '')
        .is('deactivated_at', null)
        .single()

    return (
        <CalendarPanel
            userRole={member?.role || 'viewer'}
            userId={user?.id || ''}
        />
    )
}
