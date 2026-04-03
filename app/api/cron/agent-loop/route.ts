import { NextResponse } from "next/server";
import { getCurrentNorthStar } from "@/lib/north-star";
import { getActiveKnowledge, startExperiment } from "@/lib/agent-memory";
import { buildGodPrompt, getPromptSystemTools } from "@/lib/agent-prompt";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY!;
const SINCRO_ORG_ID = "a5dd4842-f0ea-4909-b4a3-be2cb1c6ffa5"; // Hardcoded for this cron

export const maxDuration = 60;

export async function GET(req: Request) {
    try {
        // --- PHASE 0: MEASURE & LEARN (Knowledge Auto-Invalidation) ---
        // Controlliamo se ci sono esperimenti 'active' (eseguiti nel passato) per giudicarli.
        const { data: activeExps } = await getSupabaseAdmin()
            .from('ai_experiments')
            .select('*')
            .eq('organization_id', SINCRO_ORG_ID)
            .eq('outcome', 'active');
        
        if (activeExps && activeExps.length > 0) {
            for (const exp of activeExps) {
                // [Logica Mock] Idealmente andremo a leggere dalla Meta API e compareremo coi target
                // Assumiamo che se sono passati più di 3 giorni e non ci sono risultati o action_details ha metriche scarse, 
                // lo marchiamo fallito. Ora qui mettiamo un random simulator a scopo di dimostrazione 
                // (sostituire col checker reale su ROAS/CPL).
                const isFail = Math.random() > 0.8; // 20% possibilità di fallimento puro
                
                if (isFail) {
                    // Esperimento Fallito: Invalida la conoscenza associata se presente
                    await getSupabaseAdmin()
                        .from('ai_experiments')
                        .update({ outcome: 'failed', meta_results: { note: 'Auto-Invalidated via Cron' } })
                        .eq('id', exp.id);
                        
                    if (exp.related_knowledge_ids && exp.related_knowledge_ids.length > 0) {
                        await getSupabaseAdmin()
                            .from('agent_knowledge')
                            .update({ still_valid: false, invalidated_at: new Date().toISOString() })
                            .in('id', exp.related_knowledge_ids);
                    }
                } else {
                    // Ancora in valutazione o riuscito
                    // await getSupabaseAdmin().update({outcome: 'succeeded'}) ... se ha raggiunto un CPL pazzesco
                }
            }
        }

        // --- PHASE 1: OBSERVE ---
        // 1. Fetch North Star limits
        const metrics = await getCurrentNorthStar(SINCRO_ORG_ID);
        if (!metrics) {
            return NextResponse.json({ error: "NorthStar non configurata." });
        }

        // 2. Fetch Active Knowledge (Lessons Learned + Hard Rules)
        const activeKnowledge = await getActiveKnowledge(SINCRO_ORG_ID);

        // 3. (Mock for now) Fetch Live Metrics from Meta + CRM
        // Sostituisci questo con vere chiamate alle Graph API / Supabase CRM come fatto nella V1
        const liveMetrics = {
            spendToday: 156.40,
            leadsToday: 4,
            activeAdsSummary: "Campagna 'Mancanza Autostima' - CPL: 39€ (Sopra la soglia).\nCampagna 'Metodo' - CPL 12€ (Sotto la soglia, potenziale scaling).",
            weeklySpend: 840,
        };

        // --- PHASE 2: REASON ---
        // 4. Build the God Prompt
        const messages = buildGodPrompt(metrics, activeKnowledge, liveMetrics);
        const tools = getPromptSystemTools();

        // 5. Ask Gemini 2.5 Flash via OpenRouter with Tool Calling
        const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
                'HTTP-Referer': 'https://adpilotik.com',
                'X-Title': 'AdPilotik AI Engine',
            },
            body: JSON.stringify({
                model: "google/gemini-2.5-flash",
                messages,
                tools,
                tool_choice: "auto", // Lasciamo decidere al modello di chiamare la tool
                max_tokens: 1500,
                temperature: 0.1, // Freddo, matematico
            }),
        });

        if (!res.ok) {
            const err = await res.text();
            console.error("OpenRouter error:", err);
            return NextResponse.json({ error: "AI Error" }, { status: 500 });
        }

        const data = await res.json();
        const message = data.choices[0]?.message;

        // --- PHASE 3: EXECUTE ---
        const toolCalls = message?.tool_calls;
        if (toolCalls && toolCalls.length > 0) {
            for (const call of toolCalls) {
                if (call.function.name === 'execute_action') {
                    const args = JSON.parse(call.function.arguments);
                    
                    // The LLM has made a structured decision.
                    // We save this into the database as a "Pending" Experiment
                    const experiment = await startExperiment(SINCRO_ORG_ID, {
                        cycle_id: new Date().getTime().toString(),
                        hypothesis: args.hypothesis,
                        action_type: args.action_type,
                        action_details: args.action_details,
                        related_knowledge_ids: args.related_knowledge_ids,
                        outcome: 'pending'
                    });

                    // (TODO - E2E META PHASE 2)
                    // if (args.action_type === 'scale_budget') { callMetaAPI(...) }
                    
                    return NextResponse.json({ 
                        success: true, 
                        phase: "EXECUTE", 
                        decision: args,
                        experiment_inserted: experiment?.id 
                    });
                }
            }
        }

        // Se non ha chiamato la tool, ha scelto hold senza formalism
        return NextResponse.json({ success: true, action: "hold", message: message.content });

    } catch (err: any) {
        console.error("Agent Loop Error:", err);
        return NextResponse.json({ error: "Internal Error" }, { status: 500 });
    }
}
