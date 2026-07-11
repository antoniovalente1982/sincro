import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { getOrgContext } from '@/lib/org-context'

// GET /api/crm/leaderboard — confronto AI vs Human SULLA LISTA (lead_pool).
// La stessa lista dei 28k da cui chiamano sia umani sia agente AI.
// Intervallo: ?start=ISO&end=ISO (preferito) oppure ?days=30.
const WIN = ['appointment', 'converted']

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const ctx = await getOrgContext(supabase); const orgId = ctx?.organization_id
  if (!orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const admin = getSupabaseAdmin()

  const sp = req.nextUrl.searchParams
  const startParam = sp.get('start')
  const endParam = sp.get('end')
  let since: string
  let until: string | null = null
  if (startParam) {
    since = startParam
    until = endParam || new Date().toISOString()
  } else {
    const days = parseInt(sp.get('days') || '30')
    since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
  }

  // Membri → chi è AI
  const { data: members } = await admin
    .from('organization_members').select('user_id, is_ai_agent, team').eq('organization_id', orgId)
  const aiUserIds = new Set((members || []).filter((m: any) => m.is_ai_agent || m.team === 'ai').map((m: any) => m.user_id))

  // Totale lead nella lista (pool) — la dimensione della lista caricata (es. 28k)
  const { count: totalPool } = await admin
    .from('lead_pool').select('*', { count: 'exact', head: true }).eq('organization_id', orgId)
  const { count: availablePool } = await admin
    .from('lead_pool').select('*', { count: 'exact', head: true })
    .eq('organization_id', orgId).in('status', ['available', 'recycled'])

  // Lead del pool LAVORATI nel periodo (per team)
  let poolQuery = admin
    .from('lead_pool')
    .select('assigned_to, feedback, status, call_count, assigned_at')
    .eq('organization_id', orgId)
    .not('assigned_to', 'is', null)
    .gte('assigned_at', since)
  if (until) poolQuery = poolQuery.lte('assigned_at', until)
  const { data: pool } = await poolQuery

  // Chiamate reali (l'AI le logga; gli umani chiamano dal telefono → non loggate)
  let callsQuery = admin
    .from('lead_calls').select('user_id, connected_at, duration_seconds, started_at')
    .eq('organization_id', orgId).gte('started_at', since)
  if (until) callsQuery = callsQuery.lte('started_at', until)
  const { data: calls } = await callsQuery

  const blank = () => ({
    worked: 0, appointments: 0, interested: 0, callbacks: 0, not_interested: 0,
    wrong_number: 0, no_answer: 0, dials: 0, connected: 0,
  })
  const t: Record<'human' | 'ai', ReturnType<typeof blank>> = { human: blank(), ai: blank() }

  for (const l of pool || []) {
    const team = aiUserIds.has(l.assigned_to) ? 'ai' : 'human'
    const s = t[team]
    const worked = (l.call_count || 0) > 0 || ['called', 'converted'].includes(l.status) || !!l.feedback
    if (worked) s.worked += 1
    if (WIN.includes(l.feedback)) s.appointments += 1
    else if (l.feedback === 'interested') s.interested += 1
    else if (l.feedback === 'callback') s.callbacks += 1
    else if (l.feedback === 'not_interested') s.not_interested += 1
    else if (l.feedback === 'wrong_number') s.wrong_number += 1
    else if (l.feedback === 'no_answer') s.no_answer += 1
  }
  for (const c of calls || []) {
    const team = aiUserIds.has(c.user_id) ? 'ai' : 'human'
    t[team].dials += 1
    if (c.connected_at || (c.duration_seconds && c.duration_seconds > 0)) t[team].connected += 1
  }

  const shape = (team: 'human' | 'ai') => {
    const s = t[team]
    const bookRate = s.worked > 0 ? Math.round((s.appointments / s.worked) * 100) : 0
    const interestedRate = s.worked > 0 ? Math.round(((s.appointments + s.interested) / s.worked) * 100) : 0
    // Score: premia appuntamenti (10) e interessati (3)
    const score = s.appointments * 10 + s.interested * 3
    return {
      worked: s.worked,
      appointments: s.appointments,
      interested: s.interested,
      callbacks: s.callbacks,
      not_interested: s.not_interested,
      wrong_number: s.wrong_number,
      dials: s.dials,
      book_rate: bookRate,
      interested_rate: interestedRate,
      score,
    }
  }

  const ai = shape('ai')
  const human = shape('human')
  let winner: 'ai' | 'human' | 'tie' = 'tie'
  if (ai.score > human.score) winner = 'ai'
  else if (human.score > ai.score) winner = 'human'

  return NextResponse.json({
    period_start: since,
    period_end: until,
    total_pool_leads: totalPool || 0,
    available_pool_leads: availablePool || 0,
    worked_total: human.worked + ai.worked,
    ai, human, winner,
    distribution: { human: human.worked, ai: ai.worked },
  })
}
