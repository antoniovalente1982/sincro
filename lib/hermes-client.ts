/**
 * Hermes Client v2 (Direct OpenRouter — no VPS middleware)
 * 
 * La VPS Hostinger non è più necessaria: questo modulo chiama
 * OpenRouter direttamente da Vercel, eliminando il single point of failure.
 * 
 * Architettura: Sincro Backend → OpenRouter API → LLM Response
 */

export interface HermesPayload {
  task: string;
  context?: Record<string, any>;
  session_id?: string;
  agent_role?: 'orchestrator' | 'media-buyer' | 'crm-triage' | 'copywriter';
  model?: string; // LLM model ID from OpenRouter (e.g. 'google/gemini-2.0-flash-001')
}

const FALLBACK_MODELS = [
  'google/gemini-2.0-flash-001',
  'meta-llama/llama-4-maverick',
  'mistralai/mistral-small-3.1-24b-instruct',
];

export class HermesClient {
  private openRouterKey: string;

  constructor() {
    this.openRouterKey = process.env.OPENROUTER_API_KEY || '';

    if (!this.openRouterKey) {
      console.warn("⚠️ OPENROUTER_API_KEY is not defined. Hermes will not be able to process tasks.");
    }
  }

  /**
   * Dispatches a complex task to OpenRouter with automatic retry + fallback model.
   */
  async dispatchTask(payload: HermesPayload) {
    const models = [
      payload.model,
      ...FALLBACK_MODELS
    ].filter(Boolean) as string[];

    // Deduplicate: if the primary model is already in fallbacks, don't repeat
    const uniqueModels = [...new Set(models)];

    let lastError: Error | null = null;

    for (const model of uniqueModels) {
      try {
        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.openRouterKey}`,
            'HTTP-Referer': 'https://adpilotik.com',
            'X-Title': 'Sincro Hermes Engine'
          },
          body: JSON.stringify({
            model,
            messages: [
              { 
                role: "system", 
                content: `You are AdPilotik's Hermes Agent. Role: ${payload.agent_role?.toUpperCase() || 'ORCHESTRATOR'}. Process the user's task autonomously.` 
              },
              { 
                role: "user", 
                content: `TASK:\n${payload.task}\n\nCONTEXT:\n${JSON.stringify(payload.context || null, null, 2)}` 
              }
            ],
            user: payload.session_id || "sincro_system"
          }),
        });

        if (response.status === 429) {
          console.warn(`[Hermes] Rate limited on ${model}, trying fallback...`);
          lastError = new Error(`Rate limited (429) on model ${model}`);
          continue;
        }

        if (!response.ok) {
          const errorText = await response.text();
          console.warn(`[Hermes] ${model} failed (${response.status}): ${errorText.slice(0, 200)}`);
          lastError = new Error(`OpenRouter Error (${response.status}): ${errorText.slice(0, 200)}`);
          continue;
        }

        const data = await response.json();
        console.log(`[Hermes] Task completed via ${model}`);
        return data;
      } catch (error) {
        console.warn(`[Hermes] Exception with ${model}: ${(error as Error).message}`);
        lastError = error as Error;
        continue;
      }
    }

    throw lastError || new Error('All models exhausted');
  }

  /**
   * Health check — verifies OpenRouter is reachable.
   * Since we no longer depend on a VPS, we just check OpenRouter connectivity.
   */
  async checkHealth(): Promise<boolean> {
    try {
      const response = await fetch('https://openrouter.ai/api/v1/models', {
        headers: { 'Authorization': `Bearer ${this.openRouterKey}` },
        // @ts-ignore
        signal: AbortSignal.timeout ? AbortSignal.timeout(3000) : undefined
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Logs are no longer on VPS — returns from Supabase ai_realtime_logs instead.
   * This is now a stub; the dashboard reads logs directly from Supabase.
   */
  async getLogs(lines: number = 50): Promise<string[]> {
    return [`[Hermes v2] Direct OpenRouter mode — logs available in ai_realtime_logs table`];
  }
}

// Export singleton instance
export const hermesClient = new HermesClient();
