import { getSupabaseAdmin } from "@/lib/supabase/admin";

const HIGGSFIELD_API_KEY = process.env.HIGGSFIELD_API_KEY!;
const HIGGSFIELD_API_URL = "https://api.higgsfield.ai/v1/generations";

export type HiggsfieldTaskPayload = {
    prompt: string;
    image_url?: string;
    duration: number; // usually 5 or 10 seconds
    aspect_ratio: '9:16' | '16:9' | '1:1';
};

/**
 * PHASE 3.1: Video Generation via Higgsfield.ai
 * Wraps the API call to generate video assets based on winning hooks.
 */
export async function generateVideoCreative(organizationId: string, payload: HiggsfieldTaskPayload) {
    if (!HIGGSFIELD_API_KEY) {
        throw new Error("Higgsfield API KEY mancante.");
    }

    try {
        const response = await fetch(HIGGSFIELD_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${HIGGSFIELD_API_KEY}`
            },
            body: JSON.stringify({
                model: 'v2', // Assuming v2 is standard for Higgsfield
                prompt: payload.prompt,
                image_url: payload.image_url,
                duration: payload.duration,
                aspect_ratio: payload.aspect_ratio
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Higgsfield API Error: ${errorText}`);
        }

        const data = await response.json();
        
        // Log the API Cost (Phase 3.2)
        // Assume $0.15 per Higgsfield generation
        await logApiCost(organizationId, 'higgsfield', 'video_generation', 0.15);

        return data; // Returns task_id usually, to be polled later

    } catch (e) {
        console.error("Errore generazione video creativa", e);
        throw e;
    }
}

/**
 * PHASE 3.2: API Cost Logging 
 * Registra il costo di un'operazione AI nel database api_cost_log
 */
export async function logApiCost(organizationId: string, provider: 'openai' | 'openrouter' | 'higgsfield' | 'nano_banana', operation: string, costUsd: number) {
    try {
        await getSupabaseAdmin().from('api_cost_log').insert({
            organization_id: organizationId,
            provider: provider,
            operation: operation,
            cost_usd: costUsd
        });
    } catch (e) {
        console.error("Impossibile salvare il log dei costi API:", e);
    }
}
