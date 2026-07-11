import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'

const WIN = ['appointment', 'converted']
const COST_PER_MIN = Number(process.env.AI_COST_PER_MINUTE || '0.12') // €/min stimati

// GET /api/leads-pool/ai/compare?days=30
// Confronto Team Human vs Team AI sullo stesso pool.
export async function GET(request: Request) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })

    const { data: member } = await supabase
        .from('organization_members').select('organization_id, role')
        .eq('user_id', user.id).is('deactivated_at', null).single()
    if (!member || !['owner', 'admin', 'manager'].includes(member.role)) {
        return NextResponse.json({ error: 'Accesso negato' }, { status: 403 })
    }
    const orgId = member.organization_id
    const admin = getSupabaseAdmin()

    const { searchParams } = new URL(request.url)
    const days = Math.min(365, Number(searchParams.get('days') || '30'))
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

    const [{ data: members }, { data: pool }, { data: calls }] = await Promise.all([
        admin.from('organization_members').select('user_id, is_ai_agent, team').eq('organization_id', orgId),
        admin.from('lead_pool').select('assigned_to, feedback, status, call_count, assigned_at, created_at')
            .eq('organization_id', orgId).not('assigned_to', 'is', null).gte('assigned_at', since),
        admin.from('lead_calls').select('user_id, duration_seconds, connected_at, ai_agent_id, started_at')
            .eq('organization_id', orgId).gte('started_at', since),
    ])

    const aiUserIds = new Set((members || []).filter((m: any) => m.is_ai_agent || m.team === 'ai').map((m: any) => m.user_id))

    const blank = () => ({ worked: 0, appointments: 0, wrong: 0, freshness_hours_sum: 0, freshness_n: 0, dials: 0, connected: 0, talk_seconds: 0 })
    const teams: Record<'human' | 'ai', ReturnType<typeof blank>> = { human: blank(), ai: blank() }

    for (const l of pool || []) {
        const t = aiUserIds.has(l.assigned_to) ? 'ai' : 'human'
        const s = teams[t]
        const worked = (l.call_count || 0) > 0 || ['called', 'converted'].includes(l.status) || !!l.feedback
        if (worked) s.worked += 1
        if (WIN.includes(l.feedback)) s.appointments += 1
        if (l.feedback === 'wrong_number') s.wrong += 1
        if (l.assigned_at && l.created_at) {
            s.freshness_hours_sum += (new Date(l.assigned_at).getTime() - new Date(l.created_at).getTime()) / 3600000
            s.freshness_n += 1
        }
    }
    for (const c of calls || []) {
        const t = aiUserIds.has(c.user_id) ? 'ai' : 'human'
        const s = teams[t]
        s.dials += 1
        if (c.connected_at || (c.duration_seconds && c.duration_seconds > 0)) s.connected += 1
        if (c.duration_seconds) s.talk_seconds += c.duration_seconds
    }

    const shape = (t: 'human' | 'ai') => {
        const s = teams[t]
        const talkMin = Math.round(s.talk_seconds / 60)
        return {
            team: t,
            worked: s.worked,
            appointments: s.appointments,
            book_rate: s.worked > 0 ? Math.round((s.appointments / s.worked) * 100) : 0,
            wrong_rate: s.worked > 0 ? Math.round((s.wrong / s.worked) * 100) : 0,
            avg_lead_freshness_hours: s.freshness_n > 0 ? Math.round(s.freshness_hours_sum / s.freshness_n) : null,
            dials: s.dials,
            connect_rate: s.dials > 0 ? Math.round((s.connected / s.dials) * 100) : 0,
            talk_minutes: talkMin,
            est_cost_eur: t === 'ai' ? Math.round(talkMin * COST_PER_MIN * 100) / 100 : 0,
            cost_per_appointment_eur: t === 'ai' && s.appointments > 0 ? Math.round((talkMin * COST_PER_MIN / s.appointments) * 100) / 100 : null,
        }
    }

    return NextResponse.json({ success: true, days, human: shape('human'), ai: shape('ai') })
}
