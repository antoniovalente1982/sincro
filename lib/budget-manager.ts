// budget-manager.ts — stub compatibile (modulo Ads rimosso)
// Mantiene la firma originale per non rompere i cron job esistenti

export interface EcomMetrics {
  spend: number
  revenue: number
  roas: number
  cpc: number
  ctr: number
  conversions: number
}

export const DEFAULT_ECOM_METRICS: EcomMetrics = {
  spend: 0,
  revenue: 0,
  roas: 0,
  cpc: 0,
  ctr: 0,
  conversions: 0,
}

export function calculateRoas(spend: number, revenue: number): number {
  if (spend <= 0) return 0
  return Math.round((revenue / spend) * 100) / 100
}

export interface RoasScalingVerdict {
  action: 'SCALE' | 'REDUCE' | 'KILL' | 'HOLD'
  allowed: boolean
  reason: string
  recommendedMultiplier: number
  recommended_budget_change_pct: number
}

export function evaluateRoasScaling(roasHistory: number[], currentBudget: number): RoasScalingVerdict {
  const avgRoas = roasHistory.length > 0 ? roasHistory.reduce((s, r) => s + r, 0) / roasHistory.length : 0

  if (avgRoas >= 3) {
    return { action: 'SCALE', allowed: true, reason: 'ROAS alto', recommendedMultiplier: 1.2, recommended_budget_change_pct: 20 }
  }
  if (avgRoas <= 0.8) {
    return { action: 'KILL', allowed: true, reason: 'ROAS sotto soglia minima', recommendedMultiplier: 0, recommended_budget_change_pct: -100 }
  }
  if (avgRoas < 1.5) {
    return { action: 'REDUCE', allowed: true, reason: 'ROAS sotto target', recommendedMultiplier: 0.85, recommended_budget_change_pct: -15 }
  }
  return { action: 'HOLD', allowed: false, reason: 'ROAS nella norma', recommendedMultiplier: 1.0, recommended_budget_change_pct: 0 }
}
