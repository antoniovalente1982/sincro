import { AgentKnowledge } from "./agent-memory";
import { NorthStarMetrics } from "./north-star";
import { getAgentActionSchema, getAgentCapabilitiesDescription } from "./agent-skills";

export function buildGodPrompt(
    metrics: NorthStarMetrics,
    knowledgeItems: AgentKnowledge[],
    currentStatus: {
        spendToday: number;
        leadsToday: number;
        activeAdsSummary: string;
        weeklySpend: number;
    }
): any[] {
    const rulesList = knowledgeItems.map((k, i) => `[ID: ${k.id}] - ${k.knowledge}`).join("\n");

    const systemPrompt = `Sei l'Agente Operativo Autonomo di AdPilotik per Metodo Sincro.
Sei un performance marketer freddo, matematico e spietato.
Il tuo compito è prendere decisioni sui budget delle campagne Meta Ads. 

=== NORTH STAR (I TUOI LIMITI INVALICABILI) ===
L'azienda può processare massimo ${metrics.max_appointments_per_seller} appuntamenti per venditore.
Abbiamo attivi ${metrics.sellers_count} venditori.
Il CAC target da mantenere è: €${metrics.cac_target}.
Budget settimanale massimo: €${metrics.budget_weekly}.

=== MEMORIA ATTIVA (REGOLE E LEZIONI) ===
Se violi queste regole, causerai un danno enorme all'azienda. Le regole con gli ID sotto riportati sono la tua Legge.
${rulesList}

=== COMPETENZE (SKILLS) E AZIONI ===
${getAgentCapabilitiesDescription()}

Rispondi SOLO con un oggetto JSON strutturato secondo lo schema richiesto.
Se ritieni che le condizioni del mercato oggi non siano ideali o se hai dubbi, scegli l'azione "hold".`;

    const userPrompt = `
SITUAZIONE ATTUALE (LIVE DATA):
- Spesa totale oggi: €${currentStatus.spendToday}
- Appuntamenti oggi: ${currentStatus.leadsToday}
- Spesa totale ultimi 7 gg: €${currentStatus.weeklySpend} / Limite: €${metrics.budget_weekly}

RIEPILOGO CAMPAGNE ATTIVE:
${currentStatus.activeAdsSummary}

INSTRUZIONE:
Usa la tua logica. Osserva il target CAC, osserva le regole passate. Dimmi quale 'AgentAction' vuoi eseguire (azione singola) usando il JSON.`

    return [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
    ];
}

export function getPromptSystemTools() {
   return [
      {
         type: "function",
         function: {
            name: "execute_action",
            description: "Esegue l'azione su Meta Ads e registra l'esperimento nel sistema.",
            parameters: getAgentActionSchema()
         }
      }
   ];
}
