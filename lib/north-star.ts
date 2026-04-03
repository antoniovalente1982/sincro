import { createClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

export type NorthStarMetrics = {
  id: string
  organization_id: string
  aov: number
  cac_target: number
  sales_target_monthly: number
  budget_weekly: number
  budget_cap_monthly: number
  sellers_count: number
  max_appointments_per_seller: number
  working_days_per_week: number
  scale_multiplier: number
  reduce_cac_threshold: number
  budget_approval_threshold: number
  current_sales_count: number
  current_period_start: string
  updated_at: string
}

export async function getCurrentNorthStar(organizationId: string): Promise<NorthStarMetrics | null> {
  const { data, error } = await supabase
    .from("ai_north_star")
    .select("*")
    .eq("organization_id", organizationId)
    .single()

  if (error) {
    if (error.code === 'PGRST116') { // No rows found
      return null
    }
    console.error("Error fetching North Star metrics:", error)
    throw new Error(`Failed to fetch North Star metrics: ${error.message}`)
  }

  return data as NorthStarMetrics
}

export async function updateNorthStarMetrics(
  organizationId: string,
  updates: Partial<Omit<NorthStarMetrics, 'id' | 'organization_id' | 'updated_at'>>
): Promise<NorthStarMetrics> {
  const { data, error } = await supabase
    .from("ai_north_star")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("organization_id", organizationId)
    .select()
    .single()

  if (error) {
    console.error("Error updating North Star metrics:", error)
    throw new Error(`Failed to update North Star metrics: ${error.message}`)
  }

  return data as NorthStarMetrics
}

/**
 * Initializes default North Star metrics for an organization if they don't exist.
 */
export async function initializeNorthStar(organizationId: string): Promise<NorthStarMetrics> {
  const existing = await getCurrentNorthStar(organizationId)
  if (existing) return existing

  const { data, error } = await supabase
    .from("ai_north_star")
    .insert([{ organization_id: organizationId }])
    .select()
    .single()

  if (error) {
    console.error("Error initializing North Star metrics:", error)
    throw new Error(`Failed to initialize North Star metrics: ${error.message}`)
  }

  return data as NorthStarMetrics
}

// ═══════════════════════════════════════════════════════════════
// NORTH STAR DELTA — gap tracking between current and target
// ═══════════════════════════════════════════════════════════════
export type NorthStarDelta = {
  spend_pct: number           // % of weekly budget spent so far
  cac_status: 'OK' | 'OVER' | 'NO_DATA'
  cac_current: number
  cac_target: number
  capacity_pct: number        // % of seller capacity used
  sales_pct: number           // % of monthly sales target hit
  pace: 'ON_TRACK' | 'BEHIND' | 'AHEAD'
  recommended_action: 'SCALE' | 'HOLD' | 'REDUCE'
  summary: string
}

export function calcNorthStarDelta(
  northStar: NorthStarMetrics,
  weeklyTotals: { spend: number; leads: number; appointments: number; sales: number },
): NorthStarDelta {
  const spendPct = northStar.budget_weekly > 0
    ? (weeklyTotals.spend / northStar.budget_weekly) * 100 : 0

  const cacCurrent = weeklyTotals.sales > 0
    ? weeklyTotals.spend / weeklyTotals.sales : 0

  const cacStatus: 'OK' | 'OVER' | 'NO_DATA' = weeklyTotals.sales === 0
    ? 'NO_DATA'
    : cacCurrent <= northStar.cac_target ? 'OK' : 'OVER'

  const maxAppts = northStar.sellers_count * northStar.max_appointments_per_seller * (northStar.working_days_per_week || 5)
  const capacityPct = maxAppts > 0
    ? (weeklyTotals.appointments / maxAppts) * 100 : 0

  // Monthly pace: are we on track to hit the monthly sales target?
  const now = new Date()
  const dayOfMonth = now.getDate()
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  const expectedSalesByNow = (northStar.sales_target_monthly || 8) * (dayOfMonth / daysInMonth)
  const currentSales = northStar.current_sales_count || weeklyTotals.sales
  const salesPct = northStar.sales_target_monthly > 0
    ? (currentSales / northStar.sales_target_monthly) * 100 : 0

  let pace: 'ON_TRACK' | 'BEHIND' | 'AHEAD' = 'ON_TRACK'
  if (currentSales < expectedSalesByNow * 0.8) pace = 'BEHIND'
  else if (currentSales > expectedSalesByNow * 1.2) pace = 'AHEAD'

  // Determine recommended action
  let action: 'SCALE' | 'HOLD' | 'REDUCE' = 'HOLD'
  if (cacStatus === 'OK' && capacityPct < 80 && spendPct < 90) {
    action = 'SCALE'
  } else if (cacStatus === 'OVER' || capacityPct > 95) {
    action = 'REDUCE'
  }

  const summary = `Spesa ${spendPct.toFixed(0)}% del budget settimanale. ` +
    `CAC: ${cacCurrent > 0 ? `€${cacCurrent.toFixed(0)}` : 'n/d'} (target €${northStar.cac_target}). ` +
    `Capacità venditori: ${capacityPct.toFixed(0)}%. ` +
    `Vendite: ${salesPct.toFixed(0)}% del target mensile. Pace: ${pace}.`

  return {
    spend_pct: spendPct,
    cac_status: cacStatus,
    cac_current: cacCurrent,
    cac_target: northStar.cac_target,
    capacity_pct: capacityPct,
    sales_pct: salesPct,
    pace,
    recommended_action: action,
    summary,
  }
}
