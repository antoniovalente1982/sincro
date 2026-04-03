import { createClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

export type AgentKnowledge = {
  id: string
  organization_id: string
  knowledge: string
  category: string
  source: string
  priority: string
  still_valid: boolean
  invalidated_by: string | null
  invalidated_at: string | null
  invalidation_reason: string | null
  created_at: string
}

export type AiExperiment = {
  id: string
  organization_id: string
  cycle_id: string
  hypothesis: string
  action_type: string
  action_details: any
  angle: string | null
  pocket_id: number | null
  related_knowledge_ids: string[]
  started_at: string
  evaluated_at: string | null
  evaluation_window_days: number
  result_metrics: any | null
  baseline_metrics: any | null
  outcome: string
  validated: boolean | null
  learned: string | null
  created_at: string
}

/**
 * Retrieves all currently valid rules and insights for the agent.
 */
export async function getActiveKnowledge(organizationId: string): Promise<AgentKnowledge[]> {
  const { data, error } = await supabase
    .from("agent_knowledge")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("still_valid", true)
    .order("priority", { ascending: false }) // high priority first
    .order("created_at", { ascending: false })

  if (error) {
    console.error("Error fetching active knowledge:", error)
    return []
  }

  return data as AgentKnowledge[]
}

/**
 * Inserts a piece of knowledge manually (e.g. from chat).
 */
export async function insertKnowledge(
  organizationId: string,
  knowledge: string,
  category: string,
  source: string = "chat",
  priority: string = "medium"
): Promise<void> {
  const { error } = await supabase.from("agent_knowledge").insert({
    organization_id: organizationId,
    knowledge,
    category,
    source,
    priority,
    still_valid: true
  })

  if (error) {
    console.error("Error inserting knowledge:", error)
  }
}

/**
 * Creates a new experiment, linking it to the knowledge entries it tests.
 */
export async function startExperiment(
    organizationId: string, 
    experimentPartial: Partial<AiExperiment>
): Promise<AiExperiment | null> {
    const { data: experiment, error } = await supabase
      .from('ai_experiments')
      .insert({
         ...experimentPartial,
         organization_id: organizationId
      })
      .select()
      .single()

    if (error) {
       console.error("Failed to insert experiment", error)
       return null
    }

    return experiment as AiExperiment
}

/**
 * Evaluates an experiment. Auto-invalidates past knowledge if the experiment fails.
 */
export async function evaluateExperiment(experiment: AiExperiment, outcome: string, learned: string): Promise<void> {
    // 1. Update the experiment
    await supabase
      .from('ai_experiments')
      .update({ outcome, learned, evaluated_at: new Date().toISOString() })
      .eq('id', experiment.id)

    // 2. If it worsened, automatically invalidate related knowledge
    if (outcome === 'worsened' && experiment.related_knowledge_ids?.length > 0) {
        for (const knowledgeId of experiment.related_knowledge_ids) {
            await supabase
              .from('agent_knowledge')
              .update({
                still_valid: false,
                invalidated_by: experiment.id,
                invalidated_at: new Date().toISOString(),
                invalidation_reason: `Smentito da esperimento ${experiment.cycle_id}: ${learned}`
              })
              .eq('id', knowledgeId)
        }

        // 3. Insert the new truth instead
        await supabase
          .from('agent_knowledge')
          .insert({
            organization_id: experiment.organization_id,
            knowledge: learned,
            category: 'experiment_finding',
            source: 'experiment',
            priority: 'high',
            still_valid: true
          })
    }
}
