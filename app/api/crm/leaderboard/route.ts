import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getOrgContext } from "@/lib/org-context"

// GET /api/crm/leaderboard — statistiche comparative AI vs Human
// Supporta un intervallo temporale: ?start=ISO&end=ISO (preferito)
// oppure ?days=30 (retro-compatibile).
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const ctx = await getOrgContext(supabase); const orgId = ctx?.organization_id
  if (!orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

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

  // Azioni AI vs Human nel periodo
  let actionsQuery = supabase
    .from('ai_crm_actions')
    .select('actor, action_type, outcome, score_delta, created_at')
    .eq('org_id', orgId)
    .gte('created_at', since)
  if (until) actionsQuery = actionsQuery.lte('created_at', until)
  const { data: actions } = await actionsQuery

  const acts = actions || []
  const computeStats = (actor: 'ai' | 'human') => {
    const filtered = acts.filter(a => a.actor === actor)
    const deals_won = filtered.filter(a => a.action_type === 'deal_won').length
    const total = filtered.length
    const positive = filtered.filter(a => a.outcome === 'positive').length
    const total_score = filtered.reduce((s, a) => s + (a.score_delta || 0), 0)
    const messages = filtered.filter(a => a.action_type === 'message_sent').length
    const calls = filtered.filter(a => a.action_type === 'call_made').length
    return {
      total_actions: total,
      deals_won,
      conversion_rate: total > 0 ? Math.round((deals_won / total) * 100 * 100) / 100 : 0,
      positive_rate: total > 0 ? Math.round((positive / total) * 100 * 100) / 100 : 0,
      total_score,
      messages_sent: messages,
      calls_made: calls,
    }
  }

  const aiStats = computeStats('ai')
  const humanStats = computeStats('human')

  // Leads del CRM creati nel periodo, per track
  let leadsQuery = supabase
    .from('leads')
    .select('track, assigned_to_ai, created_at')
    .eq('organization_id', orgId)
    .gte('created_at', since)
  if (until) leadsQuery = leadsQuery.lte('created_at', until)
  const { data: leadsByTrack } = await leadsQuery

  const trackCounts = { human: 0, ai: 0, duel: 0, copilot: 0 }
  for (const l of (leadsByTrack || [])) {
    const key = (l.track || 'human') as keyof typeof trackCounts
    if (trackCounts[key] !== undefined) trackCounts[key]++
  }

  let winner = 'tie'
  if (aiStats.total_score > humanStats.total_score) winner = 'ai'
  else if (humanStats.total_score > aiStats.total_score) winner = 'human'

  return NextResponse.json({
    period_start: since,
    period_end: until,
    ai: aiStats,
    human: humanStats,
    winner,
    track_distribution: trackCounts,
    total_leads: leadsByTrack?.length || 0,
    ai_assigned: leadsByTrack?.filter(l => l.assigned_to_ai).length || 0,
  })
}
