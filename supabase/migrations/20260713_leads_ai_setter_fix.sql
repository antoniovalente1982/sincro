-- ============================================================
-- FIX: collisione nome tabella 'ai_agents'
-- 'ai_agents' esisteva già (AI Engine swarm, 20260407). La
-- migration 20260712 ha quindi (1) NON creato la tabella agenti
-- setter (CREATE IF NOT EXISTS no-op), (2) creato ai_agent_versions
-- e la FK lead_calls.ai_agent_id puntati alla tabella sbagliata.
-- Qui riconciliamo verso lead_ai_agents / lead_ai_agent_versions.
-- ============================================================

-- 1. Rimuovi la FK errata di lead_calls.ai_agent_id (→ ai_agents swarm)
ALTER TABLE public.lead_calls DROP CONSTRAINT IF EXISTS lead_calls_ai_agent_id_fkey;

-- 2. Elimina la tabella versioni creata per sbaglio (nessun dato, nessun altro uso)
DROP TABLE IF EXISTS public.ai_agent_versions CASCADE;

-- 3. Tabelle corrette
CREATE TABLE IF NOT EXISTS public.lead_ai_agents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL DEFAULT 'Agente Setter AI',
    member_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    provider TEXT DEFAULT 'elevenlabs',
    provider_agent_id TEXT,
    phone_number_id TEXT,
    daily_call_target INT DEFAULT 50,
    active BOOLEAN DEFAULT false,
    current_version_id UUID,
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.lead_ai_agent_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL REFERENCES public.lead_ai_agents(id) ON DELETE CASCADE,
    version_no INT NOT NULL DEFAULT 1,
    system_prompt TEXT,
    playbook TEXT,
    metrics JSONB DEFAULT '{}',
    status TEXT DEFAULT 'candidate' CHECK (status IN ('candidate', 'active', 'retired')),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Ripunta la FK di lead_calls.ai_agent_id alla tabella corretta
ALTER TABLE public.lead_calls
    ADD CONSTRAINT lead_calls_ai_agent_id_fkey
    FOREIGN KEY (ai_agent_id) REFERENCES public.lead_ai_agents(id) ON DELETE SET NULL;

-- 5. RLS
ALTER TABLE public.lead_ai_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_ai_agent_versions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage lead_ai_agents" ON public.lead_ai_agents;
CREATE POLICY "Admins manage lead_ai_agents" ON public.lead_ai_agents
    FOR ALL USING (
        organization_id IN (
            SELECT organization_id FROM public.organization_members
            WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'manager') AND deactivated_at IS NULL
        )
    );

DROP POLICY IF EXISTS "Admins manage lead_ai_agent_versions" ON public.lead_ai_agent_versions;
CREATE POLICY "Admins manage lead_ai_agent_versions" ON public.lead_ai_agent_versions
    FOR ALL USING (
        agent_id IN (
            SELECT a.id FROM public.lead_ai_agents a
            JOIN public.organization_members m ON m.organization_id = a.organization_id
            WHERE m.user_id = auth.uid() AND m.role IN ('owner', 'admin', 'manager') AND m.deactivated_at IS NULL
        )
    );

-- 6. Indici
CREATE INDEX IF NOT EXISTS idx_lead_ai_agents_org     ON public.lead_ai_agents(organization_id);
CREATE INDEX IF NOT EXISTS idx_lead_ai_versions_agent ON public.lead_ai_agent_versions(agent_id, version_no DESC);
