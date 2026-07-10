import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import LeadsStation from './LeadsStation'

export const metadata = {
    title: 'Stazione Leads | ADPILOTIK',
    description: 'Il tuo hub personale per richiedere e gestire i leads da chiamare',
}

export default async function LeadsStationPage() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) redirect('/login')

    const { data: member } = await supabase
        .from('organization_members')
        .select('organization_id, role, department')
        .eq('user_id', user.id)
        .is('deactivated_at', null)
        .single()

    if (!member) redirect('/dashboard')

    const allowedRoles = ['closer', 'manager', 'owner', 'admin']
    if (!allowedRoles.includes(member.role)) redirect('/dashboard')

    const isAdmin = ['owner', 'admin', 'manager'].includes(member.role)

    // Fetch initial stats server-side
    const res = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/leads-pool/my-stats`, {
        headers: { Cookie: (await import('next/headers')).cookies().toString() },
        cache: 'no-store',
    }).catch(() => null)

    const initialStats = res?.ok ? await res.json() : null

    return (
        <LeadsStation
            userId={user.id}
            orgId={member.organization_id}
            userRole={member.role}
            isAdmin={isAdmin}
            initialStats={initialStats}
        />
    )
}
