import { createClient } from '@/lib/supabase/server'
import AIAutopilotSettings from './AIAutopilotSettings'

export default async function AISettingsPage() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    const { data: member } = await supabase
        .from('organization_members')
        .select('organization_id')
        .eq('user_id', user?.id || '')
        .single()

    const orgId = member?.organization_id || ''

    const [configRes, logsRes, budgetRes] = await Promise.all([
        supabase
            .from('ai_agent_config')
            .select('*')
            .eq('organization_id', orgId)
            .single(),
        supabase
            .from('ai_agent_logs')
            .select('*')
            .eq('organization_id', orgId)
            .order('created_at', { ascending: false })
            .limit(30),
        supabase
            .from('ai_budget_tracking')
            .select('*')
            .eq('organization_id', orgId)
            .order('updated_at', { ascending: false })
            .limit(10),
    ])

    return (
        <AIAutopilotSettings
            config={configRes.data || null}
            logs={logsRes.data || []}
            budget={budgetRes.data || []}
        />
    )
}
