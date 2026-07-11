import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import AiStation from './AiStation'

export const metadata = {
    title: 'Stazione Leads AI | ADPILOTIK',
    description: 'Setter agentici — area riservata',
}

export default async function LeadsStationAiPage() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) redirect('/login')

    const { data: member } = await supabase
        .from('organization_members')
        .select('organization_id, role')
        .eq('user_id', user.id)
        .is('deactivated_at', null)
        .single()

    // Area riservata: solo admin/owner/manager
    if (!member || !['owner', 'admin', 'manager'].includes(member.role)) {
        redirect('/dashboard')
    }

    return <AiStation orgId={member.organization_id} />
}
