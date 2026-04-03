import { NorthStarMetrics } from "./north-star";

export type BudgetActionVerdict = {
  allowed: boolean;
  reason: string;
  recommendedMultiplier?: number;
};

/**
 * PHASE 2.4 & 2.1: Deterministic check for scaling up budget.
 * Assicura che scaling non avvenga MAI se i venditori sono pieni o se si sforano i limiti di CAC.
 */
export function evaluateScalingPermission(
  metrics: NorthStarMetrics,
  currentWeekSpend: number,
  currentWeekAppointments: number,
  adSetCac: number // Cost per lead for the specific adset they want to scale
): BudgetActionVerdict {
  // 1. Check Seller Capacity
  const maxCapacity = metrics.sellers_count * metrics.max_appointments_per_seller * metrics.working_days_per_week;
  if (currentWeekAppointments >= maxCapacity) {
    return {
      allowed: false,
      reason: `Capacità venditori SATURA. Abbiamo generato ${currentWeekAppointments} appuntamenti. Il massimo gestibile dai ${metrics.sellers_count} venditori è ${maxCapacity}. Scaling bloccato.`
    };
  }

  // 2. Check Weekly Budget Cap
  if (currentWeekSpend >= metrics.budget_weekly) {
    return {
      allowed: false,
      reason: `Budget settimanale ESAURITO. Spesi €${currentWeekSpend} su €${metrics.budget_weekly}. Scaling bloccato.`
    };
  }

  // 3. Check CAC limits
  if (adSetCac > metrics.cac_target) {
    return {
      allowed: false,
      reason: `L'AdSet ha un CAC (€${adSetCac}) superiore al target consentito (€${metrics.cac_target}). Scaling negato per protezione efficienza.`
    };
  }

  // Se passa i controlli, calcoliamo quanto si può scalare.
  // Es: scale_multiplier di default potrebbe essere 1.2 (+20%)
  const margin = metrics.budget_weekly - currentWeekSpend;
  const proposedMultiplier = metrics.scale_multiplier || 1.15; // 15% increase per cycle 

  return {
    allowed: true,
    reason: `Capacità OK (${currentWeekAppointments}/${maxCapacity}), Budget settimanale OK (€${currentWeekSpend}/€${metrics.budget_weekly}), CAC AdSet eccellente. Permesso accordato.`,
    recommendedMultiplier: proposedMultiplier
  };
}

/**
 * PHASE 2.2: Deterministic auto-reduction logic.
 * Formula matematica per decidere se un adset deve essere ridotto e di quanto.
 */
export function evaluateReduction(
  metrics: NorthStarMetrics,
  adSetCac: number, 
  adSetSpendWithoutLeads: number
): BudgetActionVerdict {
  // Se ha speso X volte senza generare leads, va ucciso o ridotto drasticamente.
  if (adSetSpendWithoutLeads >= (metrics.cac_target * 1.5)) {
     return {
        allowed: true,
        reason: `Emergenza: AdSet ha speso €${adSetSpendWithoutLeads} senza alcun appuntamento (superando del 50% il CAC target). Riduzione Drastica / Kill consigliata.`,
        recommendedMultiplier: 0.5 // Riduci del 50%
     };
  }

  // Se il CAC è sopra la soglia di emergenza
  if (adSetCac > (metrics.cac_target * 1.2)) {
     return {
        allowed: true,
        reason: `Cost overrun: CAC attuale di €${adSetCac} supera il massimale tollerato di €${metrics.cac_target * 1.2}.`,
        recommendedMultiplier: 0.85 // Riduci del 15%
     };
  }

  return {
    allowed: false,
    reason: `L'AdSet è all'interno dei parametri tollerati. CAC: €${adSetCac}. Nessuna riduzione necessaria.`
  };
}
