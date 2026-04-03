/**
 * lib/meta-api.ts
 * Interfaccia sicura e vincolata verso le Meta Graph API.
 * 
 * Implementa le direttive della FASE 2.3 e FASE 2.5:
 * Qualsiasi lancio DEVE passare da check di sicurezza deterministici 
 * pre-impostati per impedire la pubblicazione fuori target.
 */

const META_GRAPH_VERSION = 'v21.0';

export type AdSetCreationPayload = {
  name: string;
  campaign_id: string;
  daily_budget: number;
  // Altri campi decisi dall'AI, MA NON il targeting!
};

/**
 * PHASE 2.5: Pre-Lancio Obbligatorio (Safe Guards)
 * Genera forzatamente il Target Payload secondo la "Andromeda 2026 Strategy"
 * Questo NON può essere sovrascritto dall'LLM.
 */
function getHardcodedSafeTargeting() {
  return {
    age_min: 38,
    age_max: 65,
    geo_locations: {
      countries: ["IT"]
    },
    locales: [10], // 10 = Italiano
    targeting_optimization: "none", // = Advantage+ Audience SPENTO
    advantage_audience: 0 
  };
}

/**
 * Funzione sicura per la creazione di un AdSet che impone le regole. 
 */
export async function safeCreateAdSet(
  accessToken: string, 
  adAccountId: string, 
  payload: AdSetCreationPayload
) {
  // 1. Injeta il targeting blindato
  const targetingStr = JSON.stringify(getHardcodedSafeTargeting());
  
  // 2. Controllo di sicurezza preventivo: il budget non deve essere assurdo (> 200€ giornalieri al lancio)
  if (payload.daily_budget > 20000) { // centesimi
      throw new Error(`[PRE-LAUNCH KILL] Budget iniziale richiesto troppo alto: ${payload.daily_budget/100}€. Sicurezza intervenuta.`);
  }

  // Costruisci request body
  const formData = new URLSearchParams();
  formData.append('name', payload.name);
  formData.append('campaign_id', payload.campaign_id);
  formData.append('daily_budget', payload.daily_budget.toString());
  formData.append('billing_event', 'IMPRESSIONS');
  formData.append('optimization_goal', 'LEAD_GENERATION');
  formData.append('bid_amount', '200'); // Bid base fittizia, a meno che non usiamo lowest cost
  formData.append('status', 'PAUSED'); // Tutto si pubblica in PAUSA prima del controllo finale (FASE 2.6)
  formData.append('targeting', targetingStr);

  // 3. Esegui la richiesta Graph API
  const url = `https://graph.facebook.com/${META_GRAPH_VERSION}/act_${adAccountId}/adsets?access_token=${accessToken}`;
  
  const response = await fetch(url, {
      method: 'POST',
      body: formData
  });

  if (!response.ok) {
     const errorBody = await response.json();
     console.error("[META API ERROR]", errorBody);
     throw new Error(`Meta API error during safeCreateAdSet: ${errorBody.error?.message}`);
  }

  return response.json();
}

/**
 * Aggiorna il budget di una campagna o adset esistente, applicando i vincoli
 */
export async function updateBudget(
  accessToken: string, 
  entityId: string, 
  newDailyBudget: number,
  type: 'campaign' | 'adset'
) {
  if (newDailyBudget <= 0) {
      throw new Error(`Il budget non può essere <= 0`);
  }

  const formData = new URLSearchParams();
  formData.append('daily_budget', newDailyBudget.toString());

  const url = `https://graph.facebook.com/${META_GRAPH_VERSION}/${entityId}?access_token=${accessToken}`;
  const response = await fetch(url, {
      method: 'POST',
      body: formData
  });

  if (!response.ok) {
     const errorBody = await response.json();
     throw new Error(`Meta API error during budget update: ${errorBody.error?.message}`);
  }

  return response.json();
}
