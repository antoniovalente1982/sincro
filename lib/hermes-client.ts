/**
 * Hermes Client (Sincro <-> VPS Agent Ecosystem)
 * 
 * Questo modulo funge da ponte tra l'interfaccia/backend Next.js di Sincro
 * e l'installazione autonoma di Hermes Agent residente sulla VPS Hostinger.
 */

export interface HermesPayload {
  task: string;
  context?: Record<string, any>;
  session_id?: string;
  agent_role?: 'orchestrator' | 'media-buyer' | 'crm-triage' | 'copywriter';
  model?: string; // LLM model ID from OpenRouter (e.g. 'xiaomi/mimo-v2-pro')
}

export class HermesClient {
  private apiUrl: string;
  private apiKey: string;

  constructor() {
    this.apiUrl = process.env.HERMES_API_URL || 'http://76.13.136.176:8643';
    this.apiKey = process.env.HERMES_API_KEY || '';

    if (!this.apiKey) {
      console.warn("⚠️ HERMES_API_KEY is not defined in environment variables. Hermes will reject calls.");
    }
  }

  /**
   * Dispatches a complex task to the Orchestrator (or a specific agent) on the VPS.
   */
  async dispatchTask(payload: HermesPayload) {
    try {
      // In a real Hermes Gateway, the endpoint is standard OpenAI compatible
      const response = await fetch(`${this.apiUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model: payload.model || "hermes-agent",
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

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Hermes API Error (${response.status}): ${errorText}`);
      }

      return await response.json();
    } catch (error) {
      console.error("Failed to dispatch task to Hermes:", error);
      throw error;
    }
  }

  /**
   * Pings the VPS to check if the Autonomous Agent server is online.
   */
  async checkHealth(): Promise<boolean> {
    try {
      // Typically OpenAI compatible servers have a /v1/models endpoint that is fast.
      const response = await fetch(`${this.apiUrl}/v1/models`, {
        headers: { 'Authorization': `Bearer ${this.apiKey}` },
        // @ts-ignore
        signal: AbortSignal.timeout ? AbortSignal.timeout(3000) : undefined
      });
      return response.ok;
    } catch {
      return false;
    }
  }
  /**
   * Retrieves the most recent execution logs from Hermes Autonomous Agent.
   */
  async getLogs(lines: number = 50): Promise<string[]> {
    try {
      // Endpoint /v1/logs needs to be supported by our Hermes VPS
      const response = await fetch(`${this.apiUrl}/v1/logs?lines=${lines}`, {
        headers: { 'Authorization': `Bearer ${this.apiKey}` },
        // @ts-ignore
        signal: AbortSignal.timeout ? AbortSignal.timeout(3000) : undefined
      });
      if (response.ok) {
        const data = await response.json();
        return data.logs || [];
      }
      return [];
    } catch {
      return [];
    }
  }
}

// Export singleton instance
export const hermesClient = new HermesClient();
