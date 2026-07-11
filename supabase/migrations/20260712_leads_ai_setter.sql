-- ============================================================
-- Migration: Stazione Leads AI — setter agentici
-- Team Human vs Team AI, agenti vocali con auto-miglioramento.
-- Area separata, admin-only, invisibile ai venditori.
-- ============================================================

-- ── 1. Team + flag agente AI sui membri ──────────────────────
ALTER TABLE public.organization_members
    ADD COLUMN IF NOT EXISTS team TEXT DEFAULT 'human',          -- 'human' | 'ai'
    ADD COLUMN IF NOT EXISTS is_ai_agent BOOLEAN DEFAULT false;  -- true = setter virtuale AI

-- ── 2. ai_agents: configurazione di ciascun agente ───────────
CREATE TABLE IF NOT EXISTS public.ai_agents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,

    name TEXT NOT NULL DEFAULT 'Agente Setter AI',
    -- Utente/membro virtuale a cui vengono "assegnati" i lead del pool
    member_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,

    provider TEXT DEFAULT 'elevenlabs',       -- 'elevenlabs' | ...
    provider_agent_id TEXT,                    -- id agente lato ElevenLabs
    phone_number_id TEXT,                       -- id numero telefonico (ElevenLabs/Twilio)

    daily_call_target INT DEFAULT 50,          -- quante chiamate al giorno
    active BOOLEAN DEFAULT false,              -- deve chiamare?
    current_version_id UUID,                    -- versione prompt attiva

    -- Impostazioni chiamata (orari, durata slot appuntamento, ecc.)
    settings JSONB DEFAULT '{}',

    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- ── 3. ai_agent_versions: prompt + playbook versionati ───────
CREATE TABLE IF NOT EXISTS public.ai_agent_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL REFERENCES public.ai_agents(id) ON DELETE CASCADE,
    version_no INT NOT NULL DEFAULT 1,

    system_prompt TEXT,        -- parte fissa dello script del setter
    playbook TEXT,             -- lezioni accumulate (system-prompt learning)

    -- Metriche misurate su questa versione
    metrics JSONB DEFAULT '{}',   -- {calls, connects, appointments, book_rate}
    status TEXT DEFAULT 'candidate' CHECK (status IN ('candidate', 'active', 'retired')),
    notes TEXT,                    -- razionale delle modifiche proposte dal loop

    created_at TIMESTAMPTZ DEFAULT now()
);

-- ── 4. lead_calls: campi per le chiamate AI ──────────────────
ALTER TABLE public.lead_calls
    ADD COLUMN IF NOT EXISTS ai_agent_id      UUID REFERENCES public.ai_agents(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS agent_version_id UUID,
    ADD COLUMN IF NOT EXISTS transcript       TEXT,
    ADD COLUMN IF NOT EXISTS summary          TEXT;

-- ── 5. RLS (admin/manager only) ──────────────────────────────
ALTER TABLE public.ai_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_agent_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage ai_agents" ON public.ai_agents
    FOR ALL USING (
        organization_id IN (
            SELECT organization_id FROM public.organization_members
            WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'manager') AND deactivated_at IS NULL
        )
    );

CREATE POLICY "Admins manage ai_agent_versions" ON public.ai_agent_versions
    FOR ALL USING (
        agent_id IN (
            SELECT a.id FROM public.ai_agents a
            JOIN public.organization_members m ON m.organization_id = a.organization_id
            WHERE m.user_id = auth.uid() AND m.role IN ('owner', 'admin', 'manager') AND m.deactivated_at IS NULL
        )
    );

-- ── 6. Indici ────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_ai_agents_org        ON public.ai_agents(organization_id);
CREATE INDEX IF NOT EXISTS idx_ai_versions_agent    ON public.ai_agent_versions(agent_id, version_no DESC);
CREATE INDEX IF NOT EXISTS idx_lead_calls_agent     ON public.lead_calls(ai_agent_id);
CREATE INDEX IF NOT EXISTS idx_members_team         ON public.organization_members(organization_id, team);
