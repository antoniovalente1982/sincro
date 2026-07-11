import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getOrgContext } from "@/lib/org-context"

// GET /api/crm/leaderboard?days=30 — statistiche comparative AI vs Human
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const ctx = await getOrgContext(supabase); const orgId = ctx?.organization_id
  if (!orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const days = parseInt(req.nextUrl.searchParams.get('days') || '30')
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

  // Azioni AI vs Human
  const { data: actions } = await supabase
    .from('ai_crm_actions')
    .select('actor, action_type, outcome, score_delta, created_at')
    .eq('org_id', orgId)
    .gte('created_at', since)

  if (!actions) return NextResponse.json({ ai: {}, human: {} })

  const computeStats = (actor: 'ai' | 'human') => {
    const filtered = actions.filter(a => a.actor === actor)
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

  // Leads attivi per track
  const { data: leadsByTrack } = await supabase
    .from('leads')
    .select('track, ai_score, human_score, assigned_to_ai')
    .eq('organization_id', orgId)

  const trackCounts = { human: 0, ai: 0, duel: 0, copilot: 0 }
  for (const l of (leadsByTrack || [])) {
    if (l.track && trackCounts[l.track as keyof typeof trackCounts] !== undefined) {
      trackCounts[l.track as keyof typeof trackCounts]++
    }
  }

  // Determina winner per il periodo
  let winner = 'tie'
  if (aiStats.total_score > humanStats.total_score) winner = 'ai'
  else if (humanStats.total_score > aiStats.total_score) winner = 'human'

  return NextResponse.json({
    period_days: days,
    ai: aiStats,
    human: humanStats,
    winner,
    track_distribution: trackCounts,
    total_leads: leadsByTrack?.length || 0,
    ai_assigned: leadsByTrack?.filter(l => l.assigned_to_ai).length || 0
  })
}
