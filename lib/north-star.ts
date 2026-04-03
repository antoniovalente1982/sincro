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
