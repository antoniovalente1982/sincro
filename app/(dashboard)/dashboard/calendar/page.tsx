import { createClient } from '@/lib/supabase/server'
import CalendarPanel from './CalendarPanel'

export default async function CalendarPage({
    searchParams
}: {
    searchParams: { book_lead_id?: string }
}) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    const { data: member } = await supabase
        .from('organization_members')
        .select('organization_id, role, department, google_access_token')
        .eq('user_id', user?.id || '')
        .is('deactivated_at', null)
        .single()

    let prefillLead = null
    if (searchParams?.book_lead_id) {
        const { data } = await supabase
            .from('leads')
            .select('id, name, email, phone')
            .eq('id', searchParams.book_lead_id)
            .single()
        prefillLead = data
    }

    const isGoogleConnected = !!member?.google_access_token

    return (
        <CalendarPanel
            userRole={member?.role || 'viewer'}
            userId={user?.id || ''}
            prefillLead={prefillLead}
            isGoogleConnected={isGoogleConnected}
        />
    )
}
