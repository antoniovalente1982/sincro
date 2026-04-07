import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { getCurrentNorthStar, calcNorthStarDelta } from '@/lib/north-star'

// This endpoint is triggered by Vercel Cron on an hourly schedule
export const maxDuration = 300 // allow up to 5 minutes

export async function GET(req: NextRequest) {
    // 1. Authenticate the Cron request
    const authHeader = req.headers.get('authorization')
    // In production we check for process.env.CRON_SECRET
    if (process.env.NODE_ENV === 'production' && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        // Return 401 Unauthorized if wrong cron secret
        return new NextResponse('Unauthorized', { status: 401 })
    }

    const supabase = await createClient()

    try {
        // 2. We need an organization ID. For automation, usually we'd loop through all active organizations.
        // For Sincro v1, we grab the first configured active organization.
        const { data: orgs } = await supabase.from('organizations').select('id').limit(1)
        if (!orgs || orgs.length === 0) {
            return NextResponse.json({ error: 'No active organizations' }, { status: 400 })
        }
        
        const orgId = orgs[0].id

        // 3. Fetch Sensory Context: CRM & North Star Goals
        const northStar = await getCurrentNorthStar(orgId)
        if (!northStar) {
            return NextResponse.json({ message: 'No North Star goals defined. Pulse aborted.' })
        }

        const { data: activeCampaigns } = await supabase
            .from('campaigns_cache')
            .select('*')
            .eq('organization_id', orgId)
            .eq('status', 'ACTIVE')

        const weeklyTotals = {
            spend: activeCampaigns?.reduce((acc: number, c: any) => acc + (Number(c.spend) || 0), 0) || 0,
            leads: activeCampaigns?.reduce((acc: number, c: any) => acc + (Number(c.leads) || 0), 0) || 0,
            appointments: activeCampaigns?.reduce((acc: number, c: any) => acc + (Number(c.appointments) || 0), 0) || 0,
            sales: activeCampaigns?.reduce((acc: number, c: any) => acc + (Number(c.sales) || 0), 0) || 0,
        }

        const delta = calcNorthStarDelta(northStar, weeklyTotals)
        const sensoryPayload = {
            timestamp: new Date().toISOString(),
            north_star_goals: {
                target_cac: northStar.cac_target,
                weekly_budget: northStar.budget_weekly,
                monthly_cap: northStar.budget_cap_monthly
            },
            current_status: {
                active_campaigns_count: activeCampaigns?.length || 0,
                pace: delta.pace, // ON_TRACK | BEHIND | AHEAD
                cac_status: delta.cac_status, // OK | OVER
                current_estimated_cac: delta.cac_current,
                budget_spent_pct: delta.spend_pct,
                system_recommendation: delta.recommended_action // SCALE | HOLD | REDUCE
            }
        }

        // 5. Wake up Hermes via OpenRouter DIRECT (no VPS middleware)
        const openRouterKey = process.env.OPENROUTER_API_KEY || ''

        // Read base_* objectives AND llm_model from ai_agent_config (the source of truth)
        const { data: agentCfg } = await supabase.from('ai_agent_config').select('objectives, llm_model').eq('organization_id', orgId).single()
        const mission = agentCfg?.objectives || {}
        const llmModel = agentCfg?.llm_model || 'google/gemini-2.0-flash-001'

        const bF = mission?.base_fatturato || 50000;
        const bP = mission?.base_prezzo || 2250;
        const bL2A = mission?.base_lead_to_appt || 40;
        const bA2S = mission?.base_appt_to_showup || 60;
        const bS2S = mission?.base_showup_to_sale || 20;
        const bCacTarget = mission?.base_cac_target || 300;
        const bCpl = mission?.base_cpl || 15;

        const clientiMensili = bP > 0 ? Math.ceil(bF / bP) : 0;
        const showupsMensili = bS2S > 0 ? Math.ceil(clientiMensili / (bS2S / 100)) : 0;
        const apptMensili = bA2S > 0 ? Math.ceil(showupsMensili / (bA2S / 100)) : 0;
        const leadMensili = bL2A > 0 ? Math.ceil(apptMensili / (bL2A / 100)) : 0;
        const budgetMensile = bCacTarget * clientiMensili;

        const now = new Date();
        const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
        const monthName = now.toLocaleString('it-IT', { month: 'long', year: 'numeric' });

        const formatPacing = (days: number, isFinal = false) => {
            const r = days / daysInMonth;
            const label = isFinal ? `[${days} Giorni] (Obiettivo Intero ${monthName.toUpperCase()})` : `[${days} ${days===1?'Giorno':'Giorni'}]`;
            return `${label} Budget MAX: €${Math.round(budgetMensile * r)} | Lead attesi: ${Math.round(leadMensili * r)} | Appt: ${Math.round(apptMensili * r)} | Vendite: ${Math.round(clientiMensili * r)}`;
        };

        const pacingBlock = `\n🎯 TRACCIAMENTO OBIETTIVI (PACING DI BREVE, MEDIO E LUNGO TERMINE):
${formatPacing(1)}
${formatPacing(3)}
${formatPacing(7)}
${formatPacing(14)}
${formatPacing(21)}
${formatPacing(daysInMonth, true)}`;

        const systemMessage = `Sei Hermes, il CEO. Ti ho appena svegliato con il Pulse Orario. 
Analizza i seguenti dati attuali (Sensory Input): ${JSON.stringify(sensoryPayload)}
Se il CAC è OVER o il pace è BEHIND, delega immediatamente ad Andromeda una manovra correttiva.
Se siamo ON_TRACK, rispondi con un check rassicurante. Fai una sintesi tattica molto breve della situazione.
Nota vitale: I target forniti (es. CAC target) sono la BASELINE (minimo vitale). Il tuo obiettivo assoluto e quello dei tuoi agenti è usare il continuous learning per battere questi record e scalare a costi inferiori.
${pacingBlock}`

        // Try primary model, then fallbacks on rate-limit
        const modelsToTry = [llmModel, 'google/gemini-2.0-flash-001', 'meta-llama/llama-4-maverick'].filter((m, i, arr) => arr.indexOf(m) === i)
        let response: Response | null = null
        let usedModel = llmModel

        for (const model of modelsToTry) {
            const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${openRouterKey}`,
                    'HTTP-Referer': 'https://adpilotik.com',
                    'X-Title': 'Sincro Hermes Pulse'
                },
                body: JSON.stringify({
                    model,
                    messages: [
                        { role: "system", content: systemMessage },
                        { role: "user", content: "Elabora subito il piano." }
                    ]
                })
            })

            if (r.status === 429) {
                console.warn(`[Pulse] Rate limited on ${model}, trying next...`)
                continue
            }

            response = r
            usedModel = model
            break
        }

        if (!response || !response.ok) {
            const errorText = response ? await response.text() : 'All models exhausted'
            console.error("Pulse failed:", errorText)
            await supabase.from('ai_realtime_logs').insert({
                organization_id: orgId,
                action: 'Pulse Failure',
                details: { error: errorText.slice(0, 500), models_tried: modelsToTry },
                tokens_used: 0
            })
            throw new Error("Hermes Pulse: all models failed")
        }

        const completion = await response.json()
        const hermesDecision = completion.choices[0].message.content

        // 6. Log the Heartbeat result into the dashboard 
        const { data: hermesAgent } = await supabase.from('ai_agents').select('id').eq('name', 'Hermes').single()

        await supabase.from('ai_realtime_logs').insert({
            organization_id: orgId,
            agent_id: hermesAgent?.id,
            action: 'Hourly Swarm Pulse',
            thought_process: `Heartbeat triggerato. Sensory Data analizzati. ${hermesDecision}`,
            target_entity: 'System Check',
            tokens_used: completion.usage?.total_tokens || 0
        })

        return NextResponse.json({ success: true, processed_pulse: sensoryPayload, hermes_response: hermesDecision })
        
    } catch (error: any) {
        console.error("Pulse error:", error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
