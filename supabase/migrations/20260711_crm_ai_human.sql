-- ============================================================
-- CRM AI vs HUMAN: Nuovo sistema di tracking doppio binario
-- Data: 2026-07-11
-- ============================================================

-- 1. Aggiungi colonne track AI/Human alla tabella leads
ALTER TABLE public.leads 
  ADD COLUMN IF NOT EXISTS track TEXT DEFAULT 'human' 
    CHECK (track IN ('human', 'ai', 'duel', 'copilot')),
  ADD COLUMN IF NOT EXISTS ai_score INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS human_score INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ai_last_action_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS human_last_action_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ai_outreach_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS human_outreach_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS assigned_to_ai BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS ai_notes TEXT;

-- 2. Pipeline config per modalità AI vs Human
CREATE TABLE IF NOT EXISTS public.pipeline_config (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  pipeline_name TEXT NOT NULL DEFAULT 'Default',
  
  -- Modalità operative
  mode TEXT DEFAULT 'human' CHECK (mode IN ('human', 'ai_first', 'copilot', 'duel')),
  
  -- Regole di auto-assegnazione AI
  ai_auto_assign BOOLEAN DEFAULT false,
  ai_auto_assign_after_hours INTEGER DEFAULT 24, -- se nessun umano contatta entro X ore, AI subentra
  ai_model TEXT DEFAULT 'openai/gpt-4o',
  
  -- Soglie per escalation
  ai_escalate_to_human_score INTEGER DEFAULT 70, -- se AI score >= 70, passa a umano
  
  -- Config extra
  meta_data JSONB DEFAULT '{}'::jsonb
);

-- 3. Log azioni AI per confronto con umano
CREATE TABLE IF NOT EXISTS public.ai_crm_actions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  
  lead_id UUID REFERENCES public.leads(id) ON DELETE CASCADE,
  org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  
  -- Chi ha fatto l'azione
  actor TEXT NOT NULL CHECK (actor IN ('ai', 'human')),
  actor_user_id UUID REFERENCES public.profiles(id), -- null se actor = 'ai'
  actor_ai_model TEXT, -- null se actor = 'human'
  
  -- Cosa ha fatto
  action_type TEXT NOT NULL CHECK (action_type IN (
    'message_sent', 'call_made', 'email_sent', 
    'stage_changed', 'note_added', 'score_updated',
    'follow_up_scheduled', 'deal_won', 'deal_lost'
  )),
  action_detail JSONB DEFAULT '{}'::jsonb,
  
  -- Risultato
  outcome TEXT CHECK (outcome IN ('positive', 'negative', 'neutral', 'pending')),
  outcome_detail TEXT,
  
  -- Score delta
  score_delta INTEGER DEFAULT 0
);

-- 4. Leaderboard snapshot (aggiornata periodicamente)
CREATE TABLE IF NOT EXISTS public.crm_leaderboard (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  
  org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  
  -- AI stats
  ai_leads_worked INTEGER DEFAULT 0,
  ai_deals_won INTEGER DEFAULT 0,
  ai_conversion_rate NUMERIC(5,2) DEFAULT 0,
  ai_avg_response_time_minutes INTEGER DEFAULT 0,
  ai_revenue_generated NUMERIC(12,2) DEFAULT 0,
  
  -- Human stats (aggregati per org, non per singolo utente)
  human_leads_worked INTEGER DEFAULT 0,
  human_deals_won INTEGER DEFAULT 0,
  human_conversion_rate NUMERIC(5,2) DEFAULT 0,
  human_avg_response_time_minutes INTEGER DEFAULT 0,
  human_revenue_generated NUMERIC(12,2) DEFAULT 0,
  
  -- Winner
  winner TEXT CHECK (winner IN ('ai', 'human', 'tie'))
);

-- 5. Indici performance
CREATE INDEX IF NOT EXISTS idx_leads_track ON public.leads(track);
CREATE INDEX IF NOT EXISTS idx_leads_ai_assigned ON public.leads(assigned_to_ai) WHERE assigned_to_ai = true;
CREATE INDEX IF NOT EXISTS idx_ai_actions_lead ON public.ai_crm_actions(lead_id);
CREATE INDEX IF NOT EXISTS idx_ai_actions_org ON public.ai_crm_actions(org_id);
CREATE INDEX IF NOT EXISTS idx_ai_actions_actor ON public.ai_crm_actions(actor);
CREATE INDEX IF NOT EXISTS idx_pipeline_config_org ON public.pipeline_config(org_id);

-- 6. RLS policies
ALTER TABLE public.pipeline_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_crm_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_leaderboard ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pipeline_config_authenticated" ON public.pipeline_config
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "ai_crm_actions_authenticated" ON public.ai_crm_actions
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "crm_leaderboard_authenticated" ON public.crm_leaderboard
  FOR ALL USING (auth.role() = 'authenticated');

-- 7. Funzione helper: calcola score AI vs Human per org
CREATE OR REPLACE FUNCTION public.get_crm_vs_score(p_org_id UUID, p_days INTEGER DEFAULT 30)
RETURNS TABLE (
  actor TEXT,
  total_actions BIGINT,
  deals_won BIGINT,
  avg_score NUMERIC
) 
LANGUAGE SQL
SECURITY DEFINER
AS $$
  SELECT 
    actor,
    COUNT(*) as total_actions,
    COUNT(*) FILTER (WHERE action_type = 'deal_won') as deals_won,
    AVG(score_delta) as avg_score
  FROM public.ai_crm_actions
  WHERE org_id = p_org_id
    AND created_at >= NOW() - (p_days || ' days')::INTERVAL
  GROUP BY actor;
$$;

-- Log
DO $$
BEGIN
  RAISE NOTICE 'CRM AI vs Human migration completata con successo';
END $$;
