export type AgentActionType = 
  | "hold" 
  | "scale_budget" 
  | "reduce_budget" 
  | "kill_ad" 
  | "launch_creative" 
  | "reallocate_budget";

export interface AgentDecision {
  action_type: AgentActionType;
  action_details: Record<string, any>; // Specific details depending on action_type
  hypothesis: string;
  related_knowledge_ids: string[];
}

/**
 * Returns the JSON Schema definition for the allowed actions the LLM can take.
 * This is used to force the LLM to output structured JSON matching our engine's capabilities.
 */
export function getAgentActionSchema() {
  return {
    type: "object",
    properties: {
      action_type: {
        type: "string",
        description: "L'azione operativa da compiere su Meta Ads o sul Sistema.",
        enum: ["hold", "scale_budget", "reduce_budget", "kill_ad", "launch_creative", "reallocate_budget"]
      },
      action_details: {
        type: "object",
        description: "I parametri specifici dell'azione. Esempio: { 'target_adset_id': '12345', 'increase_percentage': 15 } oppure { 'ad_id': '9876' }."
      },
      hypothesis: {
        type: "string",
        description: "Il ragionamento rigoroso che motiva questa decisione, basato sui dati. Esempio: 'Scalando l\\'adset Status il mercoledì, stimo di mantenere il CAC sotto i 450€ dato lo spazio disponibile nei venditori.'"
      },
      related_knowledge_ids: {
        type: "array",
        items: {
          type: "string"
        },
        description: "MANDATORY. L'elenco degli ID estrapolati dalla Knowledge Base (fornita nel prompt) che giustificano questa azione. Quali 'regole' stai sfruttando o testando? Inserisci qui gli UUID esatti. Se questa mossa dovesse peggiorare i risultati, queste rule IDs verranno analizzate e possibilmente invalidate."
      }
    },
    required: ["action_type", "action_details", "hypothesis", "related_knowledge_ids"]
  };
}

/**
 * Explains the capabilities of the agent to the LLM.
 * Insert this into the God Prompt to give the LLM context of what each action does.
 */
export function getAgentCapabilitiesDescription() {
  return `
HAI ACCESSO ALLE SEGUENTI CAPACITÀ OPERATIVE (action_type):

1. "hold": 
   Non apportare modifiche alle ads esistenti. Usa questa azione se il sistema è stabile e non ci sono sufficienti dati (es. l'esperimento precedente richiede ancora 2 giorni di maturazione).

2. "scale_budget": 
   Aumenta il budget di un AdSet vincente o di una campagna. Assicurati di non sforare il "budget_weekly" indicato nella North Star.

3. "reduce_budget": 
   Riduci il budget di un AdSet che sta sfiorando la soglia massima del CAC, ma che ha potenziale o porta traffico qualificato.

4. "kill_ad": 
   Spegni immediatamente (PAUSE) un'inserzione o un AdSet che ha superato abbondantemente il CAC senza portare appuntamenti, o che ha un CTR disastroso.

5. "launch_creative": 
   Proponi la generazione di una nuova creatività. Definisci in \`action_details\` l'angolo strategico (es. "Status", "Emotional", "Fear") e i task per la generazione immagine.

6. "reallocate_budget": 
   Sposta fondi da una campagna perdente a una vincente mantenendo inalterata la spesa complessiva giornaliera.

IMPORTANTE SUI KNOWLEDGE IDs:
Quando scegli un'azione, DEVI indicare \`related_knowledge_ids\`. Ad esempio, se spegni un'ad perché "L'angolo Status performa male nei feriali", e trovi questa regola nell'elenco Knowledge fornito (con ID: 123-abc-456), DEVI inserire "123-abc-456" nell'array \`related_knowledge_ids\`. Questo ci permette di auto-verificare le nostre stesse regole.
  `;
}
