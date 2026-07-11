import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getOrgContext } from "@/lib/org-context"

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || ''

async function callAI(systemPrompt: string, userPrompt: string, model = 'openai/gpt-4o-mini'): Promise<string> {
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
      'HTTP-Referer': 'https://metodosincro.com',
      'X-Title': 'Sincro CRM AI',
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      max_tokens: 800,
      temperature: 0.3,
    }),
  })
  if (!res.ok) throw new Error(`OpenRouter error: ${res.status}`)
  const data = await res.json()
  return data.choices?.[0]?.message?.content || ''
}

// GET /api/crm/ai-track?lead_id=xxx
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const ctx = await getOrgContext(supabase); const orgId = ctx?.organization_id
  if (!orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const leadId = req.nextUrl.searchParams.get('lead_id')
  if (!leadId) return NextResponse.json({ error: 'lead_id required' }, { status: 400 })

  const [leadResult, actionsResult] = await Promise.all([
    supabase
      .from('leads')
      .select('id, full_name, track, ai_score, human_score, ai_last_action_at, human_last_action_at, ai_outreach_count, human_outreach_count, assigned_to_ai, ai_notes, stage')
      .eq('id', leadId)
      .eq('organization_id', orgId)
      .single(),
    supabase
      .from('ai_crm_actions')
      .select('*')
      .eq('lead_id', leadId)
      .eq('org_id', orgId)
      .order('created_at', { ascending: false })
      .limit(20),
  ])

  if (leadResult.error) return NextResponse.json({ error: leadResult.error.message }, { status: 404 })
  return NextResponse.json({ lead: leadResult.data, actions: actionsResult.data || [] })
}

// POST /api/crm/ai-track — esegui azione AI su un lead
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const ctx = await getOrgContext(supabase); const orgId = ctx?.organization_id
  if (!orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { lead_id, action, model = 'openai/gpt-4o-mini', context = {} } = body

  if (!lead_id || !action) {
    return NextResponse.json({ error: 'lead_id e action sono richiesti' }, { status: 400 })
  }

  const { data: lead, error: leadErr } = await supabase
    .from('leads')
    .select('*')
    .eq('id', lead_id)
    .eq('organization_id', orgId)
    .single()

  if (leadErr || !lead) return NextResponse.json({ error: 'Lead non trovato' }, { status: 404 })

  const systemPrompt = `Sei un AI commerciale d'elite che lavora lead per Metodo Sincro (coaching sportivo giovanile).
Il tuo obiettivo è convertire i lead in clienti attraverso comunicazione empatica, professionale e orientata al valore.
Rispondi in italiano, in modo naturale e mai robotico. Sii conciso e diretto.`

  const userPrompt = `Lead: ${lead.full_name || 'Sconosciuto'} | Stage CRM: ${lead.stage || 'nuovo'} | Track: ${lead.track || 'human'}
Azione richiesta: ${action}
Contesto aggiuntivo: ${JSON.stringify(context)}

Genera la risposta/azione AI ottimale per questo lead.`

  let aiResponse = ''
  let scoreDelta = 0

  try {
    aiResponse = await callAI(systemPrompt, userPrompt, model)
    const scoreMap: Record<string, number> = {
      message_sent: 5,
      follow_up_scheduled: 3,
      call_made: 8,
      email_sent: 4,
      stage_changed: 6,
      deal_won: 20,
    }
    scoreDelta = scoreMap[action] || 2
  } catch (e: any) {
    aiResponse = `Errore AI: ${e.message}`
    scoreDelta = 0
  }

  // Log azione AI
  const { data: actionLog } = await supabase.from('ai_crm_actions').insert({
    lead_id,
    org_id: orgId,
    actor: 'ai',
    actor_ai_model: model,
    action_type: action,
    action_detail: { response: aiResponse, context },
    outcome: 'pending',
    score_delta: scoreDelta,
  }).select().single()

  // Aggiorna score lead
  await supabase.from('leads').update({
    ai_score: (lead.ai_score || 0) + scoreDelta,
    ai_last_action_at: new Date().toISOString(),
    ai_outreach_count: (lead.ai_outreach_count || 0) + 1,
  }).eq('id', lead_id)

  return NextResponse.json({ success: true, ai_response: aiResponse, score_delta: scoreDelta, action_id: actionLog?.id })
}

// PATCH /api/crm/ai-track — cambia track/modalità di un lead
export async function PATCH(req: NextRequest) {
  const supabase = await createClient()
  const ctx = await getOrgContext(supabase); const orgId = ctx?.organization_id
  if (!orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { lead_id, track, assigned_to_ai } = await req.json()

  if (!lead_id) return NextResponse.json({ error: 'lead_id required' }, { status: 400 })

  const updates: Record<string, any> = {}
  if (track) updates.track = track
  if (typeof assigned_to_ai === 'boolean') updates.assigned_to_ai = assigned_to_ai

  const { error } = await supabase
    .from('leads')
    .update(updates)
    .eq('id', lead_id)
    .eq('organization_id', orgId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
