import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import LeadPoolAdmin from './LeadPoolAdmin'

export const metadata = {
    title: 'Gestione Pool Leads | ADPILOTIK',
}

export default async function LeadsStationAdminPage() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) redirect('/login')

    const { data: member } = await supabase
        .from('organization_members')
        .select('organization_id, role')
        .eq('user_id', user.id)
        .is('deactivated_at', null)
        .single()

    if (!member || !['owner', 'admin', 'manager'].includes(member.role)) {
        redirect('/dashboard/leads-station')
    }

    const orgId = member.organization_id

    // Fetch lists, rules, stats in parallel
    const [listsRes, rulesRes] = await Promise.all([
        supabase
            .from('lead_lists')
            .select('*')
            .eq('organization_id', orgId)
            .order('created_at', { ascending: false }),
        supabase
            .from('lead_distribution_rules')
            .select('*')
            .eq('organization_id', orgId),
    ])

    // Fetch closer profiles for rules display
    const { data: closers } = await supabase
        .from('organization_members')
        .select('user_id, role')
        .eq('organization_id', orgId)
        .in('role', ['closer', 'manager', 'owner', 'admin'])
        .is('deactivated_at', null)

    let profiles: any[] = []
    if (closers && closers.length > 0) {
        const { data } = await supabase
            .from('profiles')
            .select('id, full_name, avatar_url, email')
            .in('id', closers.map(c => c.user_id))
        profiles = data || []
    }

    const today = new Date().toISOString().split('T')[0]
    const { data: quotas } = await supabase
        .from('lead_daily_quota')
        .select('*')
        .eq('organization_id', orgId)
        .eq('quota_date', today)

    return (
        <LeadPoolAdmin
            orgId={orgId}
            initialLists={listsRes.data || []}
            initialRules={rulesRes.data || []}
            closers={(closers || []).map(c => ({
                ...c,
                profile: profiles.find(p => p.id === c.user_id) || null,
            }))}
            todayQuotas={quotas || []}
        />
    )
}
