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

// ═══════════════════════════════════════════════════════════════
// ROAS-BASED EVALUATION — E-commerce Guide Campaigns
// ═══════════════════════════════════════════════════════════════

export type EcommerceMetrics = {
  roas_target: number;           // Target ROAS (default: 1.5)
  daily_budget_cap: number;      // Max daily budget in EUR (default: 1500)
  weekly_budget_cap: number;     // Max weekly budget in EUR
  scale_step: number;            // Budget increase per step (default: 0.20 = 20%)
  reduce_step: number;           // Budget decrease per step (default: 0.15 = 15%)
  min_daily_budget: number;      // Minimum daily budget in EUR (default: 20)
};

export const DEFAULT_ECOM_METRICS: EcommerceMetrics = {
  roas_target: 1.5,
  daily_budget_cap: 1500,
  weekly_budget_cap: 7000,
  scale_step: 0.20,
  reduce_step: 0.15,
  min_daily_budget: 20,
};

export type RoasEvaluation = {
  allowed: boolean;
  action: 'SCALE' | 'HOLD' | 'REDUCE' | 'KILL';
  reason: string;
  recommendedMultiplier?: number;
  currentRoas: number;
  targetRoas: number;
};

/**
 * Evaluate whether an e-commerce ad set should scale, hold, or reduce budget
 * based on ROAS performance over a window of days.
 * 
 * @param dailyRoasHistory - Array of ROAS values for recent days (most recent last)
 * @param currentDailyBudget - Current daily budget in EUR
 * @param ecomMetrics - E-commerce metrics config
 * @param consecutiveDays - How many consecutive days to check (default: 3)
 */
export function evaluateRoasScaling(
  dailyRoasHistory: number[],
  currentDailyBudget: number,
  ecomMetrics: EcommerceMetrics = DEFAULT_ECOM_METRICS,
  consecutiveDays: number = 3
): RoasEvaluation {
  const target = ecomMetrics.roas_target;

  // Need enough data
  if (dailyRoasHistory.length < consecutiveDays) {
    return {
      allowed: false,
      action: 'HOLD',
      reason: `Dati insufficienti: ${dailyRoasHistory.length}/${consecutiveDays} giorni disponibili. Mantenere budget attuale e raccogliere più dati.`,
      currentRoas: dailyRoasHistory[dailyRoasHistory.length - 1] || 0,
      targetRoas: target,
    };
  }

  // Get the last N days
  const recentDays = dailyRoasHistory.slice(-consecutiveDays);
  const avgRoas = recentDays.reduce((a, b) => a + b, 0) / recentDays.length;
  const allAboveTarget = recentDays.every(r => r >= target);
  const allAboveDouble = recentDays.every(r => r >= target * 1.33); // ROAS > 2.0 for 1.5 target
  const allBelowBreakeven = recentDays.every(r => r < 1.0);
  const allBelowTarget = recentDays.every(r => r < target);

  // KILL: ROAS < 1.0 for 2+ consecutive days (losing money)
  if (dailyRoasHistory.slice(-2).every(r => r < 1.0)) {
    return {
      allowed: true,
      action: 'KILL',
      reason: `🔴 EMERGENZA: ROAS sotto 1.0 per 2 giorni consecutivi (media ${avgRoas.toFixed(2)}). ` +
              `Stiamo PERDENDO soldi. Stop immediato o riduzione drastica (-50%).`,
      recommendedMultiplier: 0.5,
      currentRoas: avgRoas,
      targetRoas: target,
    };
  }

  // SCALE: ROAS > target*1.33 for N consecutive days + budget cap not hit
  if (allAboveDouble && currentDailyBudget < ecomMetrics.daily_budget_cap) {
    const multiplier = 1 + ecomMetrics.scale_step;
    const newBudget = Math.min(currentDailyBudget * multiplier, ecomMetrics.daily_budget_cap);
    return {
      allowed: true,
      action: 'SCALE',
      reason: `🟢 ROAS eccellente (media ${avgRoas.toFixed(2)}) per ${consecutiveDays} giorni consecutivi. ` +
              `Scaling +${(ecomMetrics.scale_step * 100).toFixed(0)}%: €${currentDailyBudget.toFixed(0)} → €${newBudget.toFixed(0)}.`,
      recommendedMultiplier: multiplier,
      currentRoas: avgRoas,
      targetRoas: target,
    };
  }

  // HOLD: ROAS between target and target*1.33
  if (allAboveTarget) {
    return {
      allowed: false,
      action: 'HOLD',
      reason: `🟡 ROAS nel range target (media ${avgRoas.toFixed(2)}, target ${target}). ` +
              `Mantenere budget attuale a €${currentDailyBudget.toFixed(0)}. Testare nuove creative per migliorare.`,
      currentRoas: avgRoas,
      targetRoas: target,
    };
  }

  // REDUCE: ROAS below target for N consecutive days
  if (allBelowTarget) {
    const multiplier = 1 - ecomMetrics.reduce_step;
    const newBudget = Math.max(currentDailyBudget * multiplier, ecomMetrics.min_daily_budget);
    return {
      allowed: true,
      action: 'REDUCE',
      reason: `🟠 ROAS sotto target (media ${avgRoas.toFixed(2)} vs target ${target}) per ${consecutiveDays} giorni. ` +
              `Riduzione -${(ecomMetrics.reduce_step * 100).toFixed(0)}%: €${currentDailyBudget.toFixed(0)} → €${newBudget.toFixed(0)}. Killare creative peggiori.`,
      recommendedMultiplier: multiplier,
      currentRoas: avgRoas,
      targetRoas: target,
    };
  }

  // DEFAULT HOLD: mixed performance
  return {
    allowed: false,
    action: 'HOLD',
    reason: `🟡 Performance mista (ROAS media ${avgRoas.toFixed(2)}). ` +
            `Nessuna azione automatica — monitorare e attendere trend più chiaro.`,
    currentRoas: avgRoas,
    targetRoas: target,
  };
}

/**
 * Quick helper: calculate ROAS from spend and revenue
 */
export function calculateRoas(spend: number, revenue: number): number {
  if (spend <= 0) return 0;
  return revenue / spend;
}

/**
 * Calculate maximum CPA to maintain target ROAS at a given product price / AOV
 */
export function maxCpaForRoas(aov: number, targetRoas: number = 1.5): number {
  return aov / targetRoas;
}
