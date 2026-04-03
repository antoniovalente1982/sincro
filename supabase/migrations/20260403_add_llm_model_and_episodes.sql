-- Add llm_model column to ai_agent_config if it doesn't exist
-- This allows per-org model selection from the Mission Console

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'ai_agent_config' AND column_name = 'llm_model'
  ) THEN
    ALTER TABLE ai_agent_config ADD COLUMN llm_model text DEFAULT 'google/gemini-2.5-flash';
  END IF;
END $$;

-- Add ai_episodes table if it doesn't exist (used by agent-loop v2)
CREATE TABLE IF NOT EXISTS ai_episodes (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL,
  episode_type text DEFAULT 'automation',
  action_type text,
  target_type text,
  target_id text,
  context jsonb DEFAULT '{}',
  reasoning text,
  outcome text DEFAULT 'neutral',
  created_at timestamptz DEFAULT now()
);

-- Add ai_strategy_log table if it doesn't exist
CREATE TABLE IF NOT EXISTS ai_strategy_log (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL,
  cycle_id text,
  cycle_type text DEFAULT 'agent_loop',
  hypothesis jsonb DEFAULT '{}',
  baseline_metrics jsonb DEFAULT '{}',
  outcome text,
  delta_cpl numeric,
  delta_cac numeric,
  created_at timestamptz DEFAULT now()
);
