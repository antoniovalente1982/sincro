-- -----------------------------------------------------
-- PHASE 1: Sincro Multi-Agent Swarm (Core Schema)
-- -----------------------------------------------------

-- 1. LLM Models Whitelist & Router
CREATE TABLE IF NOT EXISTS public.ai_llm_models (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    provider TEXT NOT NULL, -- e.g., 'openrouter', 'anthropic', 'openai'
    model_id TEXT NOT NULL UNIQUE, -- e.g., 'anthropic/claude-3-haiku'
    input_cost_per_m NUMERIC DEFAULT 0,
    output_cost_per_m NUMERIC DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    capabilities TEXT[], -- e.g., ['vision', 'coding', 'copywriting', 'reasoning']
    role_restriction TEXT[], -- If null, available to all agents. If array, only specific roles can use.
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Initialize with some cost-effective defaults
INSERT INTO public.ai_llm_models (name, provider, model_id, input_cost_per_m, output_cost_per_m, capabilities, role_restriction)
VALUES 
('Claude 3.5 Haiku', 'openrouter', 'anthropic/claude-3-haiku', 0.25, 1.25, ARRAY['reasoning', 'speed'], NULL),
('Claude 3.5 Sonnet', 'openrouter', 'anthropic/claude-3.5-sonnet', 3.00, 15.00, ARRAY['coding', 'copywriting', 'vision'], ARRAY['copywriter', 'cro_optimizer']),
('Llama 3 70B', 'openrouter', 'meta-llama/llama-3-70b-instruct', 0.50, 0.50, ARRAY['reasoning', 'speed'], NULL),
('GPT-4o Mini', 'openrouter', 'openai/gpt-4o-mini', 0.15, 0.60, ARRAY['vision', 'speed'], NULL)
ON CONFLICT (model_id) DO NOTHING;

-- 2. AI Agents Directory (The Swarm)
CREATE TABLE IF NOT EXISTS public.ai_agents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    role TEXT NOT NULL, -- 'boss', 'copywriter', 'media_buyer', 'cro_optimizer', 'designer'
    status TEXT DEFAULT 'idle', -- 'idle', 'working', 'paused'
    assigned_llm_id UUID REFERENCES public.ai_llm_models(id),
    current_objective TEXT,
    system_prompt_override TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. AI Agent Skills (Tools & Integrations)
CREATE TABLE IF NOT EXISTS public.ai_agent_skills (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL REFERENCES public.ai_agents(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    source_url TEXT, -- GitHub repo URI or internal action identifier
    configuration JSONB DEFAULT '{}'::jsonb,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. AI Realtime Inter-Agent Logs (Websocket Streaming)
CREATE TABLE IF NOT EXISTS public.ai_realtime_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    agent_id UUID REFERENCES public.ai_agents(id) ON DELETE CASCADE,
    target_agent_id UUID REFERENCES public.ai_agents(id) ON DELETE CASCADE, -- if delegating
    action TEXT NOT NULL, -- 'think', 'delegate', 'execute', 'error', 'complete'
    message TEXT NOT NULL,
    tokens_used INTEGER DEFAULT 0,
    cost_incurred NUMERIC DEFAULT 0,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS Policies structure Setup
ALTER TABLE public.ai_llm_models ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_agent_skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_realtime_logs ENABLE ROW LEVEL SECURITY;

-- Org Admins/Members Policies 
CREATE POLICY "Orgs can view all models" ON public.ai_llm_models FOR SELECT USING (true);
-- (Policies per le altre tabelle andrebbero collegate all'organization_id come gli altri standard sincro)
