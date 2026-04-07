import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// ═══════════════════════════════════════════════════════════════
// 🎯 MISSION CONTROL API
// The "program.md" interface — where humans set objectives
// and the AI reads them.
//
// GET /api/mission-control?orgId=...
//   → returns objectives + progress + angle scores + strategy log
//
// POST /api/mission-control
//   body: { action, orgId, ...payload }
//   actions: set_mission_params | force_cron | get_weekly_brief | override_angle_action | force_learning
// ═══════════════════════════════════════════════════════════════

function getSupabaseAdmin() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    )
}

// ── GET ───────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url)
    const orgId = searchParams.get('orgId')
    if (!orgId) return NextResponse.json({ error: 'orgId required' }, { status: 400 })

    const supabase = getSupabaseAdmin()

    try {
        const [objectivesRes, scoresRes, logRes, snapshotRes, configRes, knowledgeCount] = await Promise.all([
            supabase.from('ai_mission_objectives').select('*').eq('organization_id', orgId).single(),
            supabase.from('ai_angle_scores').select('*').eq('organization_id', orgId).order('score', { ascending: false }),
            supabase.from('ai_strategy_log').select('*').eq('organization_id', orgId).order('created_at', { ascending: false }).limit(20),
            supabase.from('ai_funnel_snapshots').select('*').eq('organization_id', orgId).order('snapshot_date', { ascending: false }).limit(30),
            supabase.from('ai_agent_config').select('execution_mode, autopilot_active, objectives, llm_model').eq('organization_id', orgId).single(),

            supabase.from('agent_knowledge').select('id', { count: 'exact', head: true }).eq('organization_id', orgId).eq('still_valid', true),
        ])

        // Compute weekly progress from latest snapshot
        const latestSnap = snapshotRes.data?.[0]

        // The latest snapshot ALREADY contains the rolling 7-day totals 
        // (weekSpend, weekLeads, etc. as computed in daily-snapshot).
        // Summing them again over the last 7 snapshots multiplies everything by 7.
        const weeklyTotals = {
            spend: latestSnap?.total_spend || 0,
            leads: latestSnap?.total_leads || 0,
            appointments: latestSnap?.total_appointments || 0,
            showups: latestSnap?.total_showups || 0,
            sales: latestSnap?.total_sales || 0,
            revenue: latestSnap?.total_revenue || 0,
        }

        const objectives = objectivesRes.data || getDefaultObjectives(orgId)
        const agentConfig = (configRes.data || {}) as { execution_mode?: string; autopilot_active?: boolean; llm_model?: string; objectives?: Record<string, any> }

        // Merge base_* fields from ai_agent_config.objectives JSONB into the response
        // These are the North Star manual inputs that the user sets in the UI
        const configObjectives = agentConfig.objectives || {}
        const baseFields = ['base_fatturato', 'base_prezzo', 'base_lead_to_appt', 'base_appt_to_showup', 'base_showup_to_sale', 'base_cac_target', 'base_cpl']
        for (const key of baseFields) {
            if (configObjectives[key] !== undefined) {
                (objectives as any)[key] = configObjectives[key]
            }
        }

        // ── Real-time CRM stats (multi-window) ────────────────────
        const now = new Date()
        const todayStart = now.toISOString().slice(0, 10) + 'T00:00:00.000Z'
        const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString()
        const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString()

        // Query CRM for each window — by acquisition date
        const [crmToday, crm7d, crm30d, crmLifetime] = await Promise.all([
            supabase.from('leads').select('id, value, pipeline_stages!leads_stage_id_fkey(slug, is_won, is_lost)').eq('organization_id', orgId).gte('created_at', todayStart),
            supabase.from('leads').select('id, value, pipeline_stages!leads_stage_id_fkey(slug, is_won, is_lost)').eq('organization_id', orgId).gte('created_at', sevenDaysAgo),
            supabase.from('leads').select('id, value, pipeline_stages!leads_stage_id_fkey(slug, is_won, is_lost)').eq('organization_id', orgId).gte('created_at', thirtyDaysAgo),
            supabase.from('leads').select('id, value, pipeline_stages!leads_stage_id_fkey(slug, is_won, is_lost)').eq('organization_id', orgId),
        ])

        const summarizeCrm = (leads: any[]) => {
            const total = leads?.length || 0
            let appointments = 0, showups = 0, sales = 0, lost = 0, revenue = 0
            for (const l of (leads || [])) {
                const slug = (l.pipeline_stages as any)?.slug || ''
                const isWon = (l.pipeline_stages as any)?.is_won || false
                const isLost = (l.pipeline_stages as any)?.is_lost || false
                if (['appuntamento', 'show-up'].includes(slug) || isWon) appointments++
                if (slug === 'show-up' || isWon) showups++
                if (isWon) { sales++; revenue += Number(l.value) || 0 }
                if (isLost) lost++
            }
            return { leads: total, appointments, showups, sales, lost, revenue }
        }

        const crm_stats = {
            today: summarizeCrm(crmToday.data || []),
            d7: summarizeCrm(crm7d.data || []),
            d30: summarizeCrm(crm30d.data || []),
            lifetime: summarizeCrm(crmLifetime.data || []),
            date_field: 'created_at',
        }

        // Progress percentages
        const progress = {
            leads_pct: objectives.weekly_leads_target > 0 ? Math.round((weeklyTotals.leads || 0) / objectives.weekly_leads_target * 100) : null,
            appointments_pct: objectives.weekly_appointments_target > 0 ? Math.round((weeklyTotals.appointments || 0) / objectives.weekly_appointments_target * 100) : null,
            showups_pct: objectives.weekly_showup_target > 0 ? Math.round((weeklyTotals.showups || 0) / objectives.weekly_showup_target * 100) : null,
            sales_pct: objectives.weekly_sales_target > 0 ? Math.round((weeklyTotals.sales || 0) / objectives.weekly_sales_target * 100) : null,
            spend_pct: objectives.weekly_spend_budget > 0 ? Math.round((weeklyTotals.spend || 0) / objectives.weekly_spend_budget * 100) : null,
        }

        // KPI actuals
        const kpi = {
            cpl: weeklyTotals.leads > 0 ? weeklyTotals.spend / weeklyTotals.leads : null,
            cac: weeklyTotals.sales > 0 ? weeklyTotals.spend / weeklyTotals.sales : null,
            roas: weeklyTotals.spend > 0 && weeklyTotals.revenue > 0 ? weeklyTotals.revenue / weeklyTotals.spend : null,
            lead_to_appt_rate: weeklyTotals.leads > 0 ? weeklyTotals.appointments / weeklyTotals.leads : null,
            close_rate: weeklyTotals.appointments > 0 ? weeklyTotals.sales / weeklyTotals.appointments : null,
        }

        // Sparkline data (last 30 days)
        const sparklines = {
            cpl: (snapshotRes.data || []).reverse().map((s: any) => ({ date: s.snapshot_date, value: s.cpl })),
            cac: (snapshotRes.data || []).reverse().map((s: any) => ({ date: s.snapshot_date, value: s.cac })),
            leads: (snapshotRes.data || []).reverse().map((s: any) => ({ date: s.snapshot_date, value: s.total_leads })),
        }

        return NextResponse.json({
            objectives,
            execution_mode: agentConfig.execution_mode ?? 'dry_run',
            autopilot_active: agentConfig.autopilot_active ?? false,
            llm_model: agentConfig.llm_model ?? 'xiaomi/mimo-v2-pro',
            weekly_totals: weeklyTotals,
            crm_stats,
            progress,
            kpi,
            sparklines,
            angle_scores: scoresRes.data || [],
            strategy_log: logRes.data || [],
            knowledge_count: knowledgeCount.count || 0,
            week_label: getCurrentWeekLabel(),
        })
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 })
    }
}

// ── POST ──────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
    const body = await req.json()
    const { action, org_id } = body

    if (!org_id) return NextResponse.json({ error: 'org_id required' }, { status: 400 })

    const supabase = getSupabaseAdmin()

    try {
        // ── set_mission_params ────────────────────────────────────
        if (action === 'set_mission_params') {
            const { objectives, execution_mode, autopilot_active, llm_model } = body
            
            // Separate base_* fields (stored in ai_agent_config.objectives JSONB)
            // from typed fields (stored in ai_mission_objectives table columns)
            const baseFieldKeys = ['base_fatturato', 'base_prezzo', 'base_lead_to_appt', 'base_appt_to_showup', 'base_showup_to_sale', 'base_cac_target', 'base_cpl']
            const baseFields: Record<string, any> = {}
            const tableFields: Record<string, any> = {}
            
            if (objectives) {
                for (const [key, value] of Object.entries(objectives)) {
                    if (baseFieldKeys.includes(key)) {
                        baseFields[key] = value
                    } else {
                        tableFields[key] = value
                    }
                }
            }
            
            // Upsert typed fields into ai_mission_objectives (only real columns)
            if (Object.keys(tableFields).length > 0) {
                await supabase.from('ai_mission_objectives').upsert({
                    organization_id: org_id,
                    ...tableFields,
                    updated_at: new Date().toISOString(),
                }, { onConflict: 'organization_id' })
            }

            // Update ai_agent_config — always run this to persist base_* fields in JSONB
            {
                const updatePayload: any = { updated_at: new Date().toISOString() }
                if (execution_mode !== undefined) updatePayload.execution_mode = execution_mode
                if (autopilot_active !== undefined) updatePayload.autopilot_active = autopilot_active
                if (llm_model) updatePayload.llm_model = llm_model

                // Check if record exists first
                const { data: existing } = await supabase
                    .from('ai_agent_config')
                    .select('organization_id, objectives')
                    .eq('organization_id', org_id)
                    .single()

                if (existing) {
                    // Merge base_* fields into the existing JSONB objectives
                    if (Object.keys(baseFields).length > 0) {
                        updatePayload.objectives = {
                            ...(existing.objectives || {}),
                            ...baseFields,
                        }
                    }
                    await supabase.from('ai_agent_config')
                        .update(updatePayload)
                        .eq('organization_id', org_id)
                } else {
                    // INSERT new record
                    updatePayload.organization_id = org_id
                    updatePayload.execution_mode = execution_mode || 'dry_run'
                    updatePayload.autopilot_active = autopilot_active ?? false
                    updatePayload.llm_model = llm_model || 'xiaomi/mimo-v2-pro'
                    if (Object.keys(baseFields).length > 0) {
                        updatePayload.objectives = baseFields
                    }
                    await supabase.from('ai_agent_config').insert(updatePayload)
                }
            }

            // Auto-sync ai_north_star (used by pulse + NorthStar delta calculations)
            if (Object.keys(baseFields).length > 0) {
                const bF = baseFields.base_fatturato || 50000
                const bP = baseFields.base_prezzo || 2250
                const bCAC = baseFields.base_cac_target || 300
                const clientiMensili = bP > 0 ? Math.ceil(bF / bP) : 0
                const budgetMensile = bCAC * clientiMensili

                await supabase.from('ai_north_star').upsert({
                    organization_id: org_id,
                    aov: bP,
                    cac_target: bCAC,
                    sales_target_monthly: clientiMensili,
                    budget_weekly: Math.round(budgetMensile / 4),
                    budget_cap_monthly: budgetMensile,
                    updated_at: new Date().toISOString(),
                }, { onConflict: 'organization_id' })
            }

            return NextResponse.json({ ok: true, message: 'Obiettivi e Modalità aggiornati' })
        }

        // ── force_cron ──────────────────────────────────────────
        if (action === 'force_cron') {
            const { cron_name } = body
            const allowedCrons = ['agent-loop', 'daily-snapshot', 'weekly-review', 'ads-monitor', 'sync-campaigns', 'daily-report']
            
            if (!allowedCrons.includes(cron_name)) {
                return NextResponse.json({ error: `Cron ${cron_name} non autorizzato` }, { status: 400 })
            }

            const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.includes('supabase')
                ? process.env.NEXTAUTH_URL || 'http://localhost:3000'
                : 'http://localhost:3000'

            const cronRes = await fetch(`${baseUrl}/api/cron/${cron_name}`, {
                headers: { 'Authorization': `Bearer ${process.env.CRON_SECRET}` },
            })
            
            let cronData = null
            try {
                cronData = await cronRes.json()
            } catch (e) {
                cronData = await cronRes.text()
            }

            if (!cronRes.ok) {
                console.error(`Error forcing cron ${cron_name}:`, cronData)
                return NextResponse.json({ error: `Errore in ${cron_name}`, details: cronData }, { status: cronRes.status })
            }

            return NextResponse.json({ ok: true, message: `Esecuzione completata per ${cron_name}.`, data: cronData })
        }

        // ── get_weekly_brief ──────────────────────────────────
        if (action === 'get_weekly_brief') {
            const apiKey = process.env.OPENROUTER_API_KEY
            if (!apiKey) return NextResponse.json({ error: 'Missing OpenRouter key' }, { status: 500 })

            const { data: scores } = await supabase
                .from('ai_angle_scores')
                .select('angle, score, avg_cpl, avg_cac, total_leads, recommended_action, action_reason')
                .eq('organization_id', org_id)
                .order('score', { ascending: false })

            const { data: recentLog } = await supabase
                .from('ai_strategy_log')
                .select('hypothesis, outcome, kept, delta_cpl')
                .eq('organization_id', org_id)
                .order('created_at', { ascending: false })
                .limit(5)

            const { data: objectives } = await supabase
                .from('ai_mission_objectives')
                .select('*')
                .eq('organization_id', org_id)
                .single()

            const anglesContext = (scores || []).map((s: any) =>
                `${s.angle}: score=${s.score?.toFixed(2)}, CPL €${s.avg_cpl?.toFixed(2)}, ${s.recommended_action}`
            ).join('\n')

            const historyContext = (recentLog || []).map((l: any) =>
                `- [${l.outcome}] ${JSON.stringify(l.hypothesis)}`
            ).join('\n')

            const prompt = `Sei il consulente strategico di Metodo Sincro.

OBIETTIVI SETTIMANA (targets):
CPL: €${objectives?.target_cpl || 20} | CAC: €${objectives?.target_cac || 500} | Lead: ${objectives?.weekly_leads_target || 20} | Vendite: ${objectives?.weekly_sales_target || 2}

SITUAZIONE ANGOLI:
${anglesContext}

STORICO IPOTESI RECENTI:
${historyContext}

Scrivi un brief strategico settimanale in italiano (max 200 parole) che:
1. Valuti la situazione attuale in modo diretto
2. Identifichi le 2 priorità concrete per questa settimana
3. Suggerisca come distribuire il budget tra gli angoli
Usa un tono diretto e pratico, non generico.`

            // Use org's configured LLM model
            const { data: agentConf } = await supabase.from('ai_agent_config').select('llm_model').eq('organization_id', org_id).single()
            const llmModel = agentConf?.llm_model || 'xiaomi/mimo-v2-pro'

            const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
                body: JSON.stringify({
                    model: llmModel,
                    messages: [{ role: 'user', content: prompt }],
                    temperature: 0.4,
                }),
            })

            const data = await res.json()
            const brief = data.choices?.[0]?.message?.content || 'Non è stato possibile generare il brief.'
            return NextResponse.json({ ok: true, brief })
        }

        // ── override_angle_action ─────────────────────────────
        if (action === 'override_angle_action') {
            const { angle, new_action, reason } = body
            await supabase.from('ai_angle_scores')
                .update({
                    recommended_action: new_action,
                    action_reason: `[OVERRIDE MANUALE] ${reason || 'Decisione operatore'}`,
                    updated_at: new Date().toISOString(),
                })
                .eq('organization_id', org_id)
                .eq('angle', angle)

            // Log the override
            await supabase.from('ai_strategy_log').insert({
                organization_id: org_id,
                cycle_id: `manual-override-${Date.now()}`,
                cycle_type: 'intelligence',
                hypothesis: {
                    angle,
                    action: new_action,
                    reasoning: `Override manuale: ${reason}`,
                    source: 'human',
                },
                baseline_metrics: {},
                outcome: 'pending',
            })

            return NextResponse.json({ ok: true, angle, new_action })
        }

        // ── force_learning ─────────────────────────────────────
        if (action === 'force_learning') {
            const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.includes('supabase')
                ? process.env.NEXTAUTH_URL || 'http://localhost:3000'
                : 'http://localhost:3000'

            // 1. Aggiorna prima le metriche (Hybrid Tracking)
            await fetch(`${baseUrl}/api/cron/ai-engine`, {
                headers: { 'Authorization': `Bearer ${process.env.CRON_SECRET}` },
            })

            // 2. Forza valutazione Ratchet
            const ratchetRes = await fetch(`${baseUrl}/api/cron/ratchet-evaluator`, {
                headers: { 'Authorization': `Bearer ${process.env.CRON_SECRET}` },
            })

            const ratchetData = await ratchetRes.json()
            return NextResponse.json({ ok: true, ratchet_result: ratchetData })
        }

        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 })
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 })
    }
}

function getDefaultObjectives(orgId: string) {
    return {
        organization_id: orgId,
        weekly_leads_target: 20,
        weekly_appointments_target: 8,
        weekly_showup_target: 5,
        weekly_sales_target: 2,
        weekly_spend_budget: 500,
        monthly_leads_target: 80,
        monthly_sales_target: 8,
        monthly_revenue_target: 16000,
        target_cpl: 20,
        target_cac: 500,
        target_lead_to_appt_rate: 0.40,
        target_appt_show_rate: 0.70,
        target_close_rate: 0.35,
        target_roas: 3.0,
        min_active_ads: 6,
        max_active_ads: 15,
        execution_mode: 'dry_run',
        optimize_for: 'cac',
        strategic_notes: null,
        angles_to_avoid: [],
    }
}

function getCurrentWeekLabel(): string {
    const now = new Date()
    const startOfYear = new Date(now.getFullYear(), 0, 1)
    const weekNum = Math.ceil(((now.getTime() - startOfYear.getTime()) / 86400000 + startOfYear.getDay() + 1) / 7)
    return `${now.getFullYear()}-W${String(weekNum).padStart(2, '0')}`
}
