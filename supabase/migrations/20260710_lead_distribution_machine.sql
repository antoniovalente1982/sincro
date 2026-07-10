-- ============================================================
-- Migration: Lead Distribution Machine
-- Sistema di auto-distribuzione leads per i venditori (closer)
-- ============================================================

-- 1. Lead Lists — contenitore delle liste caricate dall'admin
CREATE TABLE IF NOT EXISTS public.lead_lists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    source_format TEXT NOT NULL DEFAULT 'csv' CHECK (source_format IN ('csv', 'xlsx', 'json', 'manual', 'api')),
    total_count INT DEFAULT 0,
    available_count INT DEFAULT 0,
    assigned_count INT DEFAULT 0,
    called_count INT DEFAULT 0,
    uploaded_by UUID NOT NULL,
    tags TEXT[] DEFAULT '{}',
    metadata JSONB DEFAULT '{}',   -- column mappings, import config, etc.
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Lead Pool — lead grezzi caricati, non ancora nel CRM pipeline
CREATE TABLE IF NOT EXISTS public.lead_pool (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    list_id UUID REFERENCES public.lead_lists(id) ON DELETE CASCADE,

    -- Dati anagrafici lead
    first_name TEXT,
    last_name TEXT,
    full_name TEXT,
    phone TEXT,
    email TEXT,
    city TEXT,
    province TEXT,
    age INT,
    gender TEXT,
    notes TEXT,
    raw_data JSONB DEFAULT '{}',   -- tutti i campi originali del file importato

    -- Stato distribuzione
    status TEXT DEFAULT 'available'
        CHECK (status IN ('available', 'assigned', 'called', 'recycled', 'blacklisted', 'converted')),
    assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    assigned_at TIMESTAMPTZ,
    first_called_at TIMESTAMPTZ,
    last_called_at TIMESTAMPTZ,
    call_count INT DEFAULT 0,

    -- Feedback venditore
    feedback TEXT CHECK (feedback IN ('interested', 'not_interested', 'callback', 'no_answer', 'converted', 'wrong_number', null)),
    feedback_notes TEXT,
    feedback_at TIMESTAMPTZ,

    -- Provenienza/UTM
    source TEXT,
    utm_campaign TEXT,
    utm_source TEXT,
    utm_medium TEXT,

    -- Score priorità (0.0 → 1.0). Usato dall'algoritmo di estrazione smart.
    priority_score NUMERIC DEFAULT 0.5 CHECK (priority_score BETWEEN 0 AND 1),

    -- Link al lead CRM creato dopo conversione
    crm_lead_id UUID,   -- FK non enforced (lead può essere in altra tabella)

    -- Sessione di distribuzione che ha assegnato questo lead
    session_id UUID,

    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Lead Distribution Rules — quote e regole per venditore/org
CREATE TABLE IF NOT EXISTS public.lead_distribution_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,

    -- Se user_id è NULL → regola default per tutta l'org
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,

    -- Quote giornaliere
    max_leads_per_day INT DEFAULT 50,
    batch_size INT DEFAULT 5,
    cooldown_minutes INT DEFAULT 0,       -- minuti di cooldown tra uno spin e l'altro

    -- Requisiti prima del prossimo spin
    require_feedback_before_next BOOLEAN DEFAULT true,
    min_feedback_pct INT DEFAULT 60,      -- % minima leads con feedback per sbloccare spin

    -- Filtri lista attiva (NULL = usa tutte le liste attive)
    active_list_ids UUID[] DEFAULT NULL,

    -- Orari permessi
    allowed_hours_start TIME DEFAULT '08:00',
    allowed_hours_end TIME DEFAULT '21:00',
    allowed_days INT[] DEFAULT ARRAY[1,2,3,4,5,6],  -- 1=Lun, 7=Dom

    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),

    UNIQUE(organization_id, user_id)
);

-- 4. Lead Distribution Sessions — ogni "spin" è una sessione tracciata
CREATE TABLE IF NOT EXISTS public.lead_distribution_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id),

    lead_pool_ids UUID[] DEFAULT '{}',   -- IDs dei lead estratti
    batch_size INT DEFAULT 5,

    -- Testo motivazionale scritto dal venditore per richiedere nuovi leads
    request_message TEXT,
    requested_at TIMESTAMPTZ DEFAULT now(),

    -- Stato sessione
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'expired')),
    completed_at TIMESTAMPTZ,

    -- Aggregati feedback
    leads_called INT DEFAULT 0,
    leads_with_feedback INT DEFAULT 0,

    created_at TIMESTAMPTZ DEFAULT now()
);

-- 5. Lead Daily Quota — tracciamento quota giornaliera per venditore
CREATE TABLE IF NOT EXISTS public.lead_daily_quota (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id),
    quota_date DATE NOT NULL DEFAULT CURRENT_DATE,

    leads_requested INT DEFAULT 0,
    leads_called INT DEFAULT 0,
    leads_with_feedback INT DEFAULT 0,
    leads_converted INT DEFAULT 0,
    spins_count INT DEFAULT 0,
    max_allowed INT DEFAULT 50,

    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),

    UNIQUE(organization_id, user_id, quota_date)
);

-- ============================================================
-- RLS
-- ============================================================
ALTER TABLE public.lead_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_pool ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_distribution_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_distribution_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_daily_quota ENABLE ROW LEVEL SECURITY;

-- lead_lists: tutti i membri dell'org possono leggere, solo admin/manager modificano
CREATE POLICY "Members can view lead_lists" ON public.lead_lists
    FOR SELECT USING (
        organization_id IN (
            SELECT organization_id FROM public.organization_members
            WHERE user_id = auth.uid() AND deactivated_at IS NULL
        )
    );

CREATE POLICY "Admins can manage lead_lists" ON public.lead_lists
    FOR ALL USING (
        organization_id IN (
            SELECT organization_id FROM public.organization_members
            WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'manager') AND deactivated_at IS NULL
        )
    );

-- lead_pool: i venditori vedono solo i lead assegnati a loro; admin/manager vedono tutto
CREATE POLICY "Closer can view own assigned pool leads" ON public.lead_pool
    FOR SELECT USING (
        organization_id IN (
            SELECT organization_id FROM public.organization_members
            WHERE user_id = auth.uid() AND deactivated_at IS NULL
        )
        AND (
            assigned_to = auth.uid()
            OR
            auth.uid() IN (
                SELECT user_id FROM public.organization_members
                WHERE organization_id = lead_pool.organization_id
                AND role IN ('owner', 'admin', 'manager')
                AND deactivated_at IS NULL
            )
        )
    );

CREATE POLICY "Closer can update own assigned pool leads" ON public.lead_pool
    FOR UPDATE USING (
        assigned_to = auth.uid()
        OR auth.uid() IN (
            SELECT user_id FROM public.organization_members
            WHERE organization_id = lead_pool.organization_id
            AND role IN ('owner', 'admin', 'manager')
            AND deactivated_at IS NULL
        )
    );

CREATE POLICY "System can insert lead_pool" ON public.lead_pool
    FOR INSERT WITH CHECK (
        organization_id IN (
            SELECT organization_id FROM public.organization_members
            WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'manager') AND deactivated_at IS NULL
        )
    );

CREATE POLICY "Admins can delete lead_pool" ON public.lead_pool
    FOR DELETE USING (
        organization_id IN (
            SELECT organization_id FROM public.organization_members
            WHERE user_id = auth.uid() AND role IN ('owner', 'admin') AND deactivated_at IS NULL
        )
    );

-- lead_distribution_rules
CREATE POLICY "Members can view rules" ON public.lead_distribution_rules
    FOR SELECT USING (
        organization_id IN (
            SELECT organization_id FROM public.organization_members
            WHERE user_id = auth.uid() AND deactivated_at IS NULL
        )
    );

CREATE POLICY "Admins can manage rules" ON public.lead_distribution_rules
    FOR ALL USING (
        organization_id IN (
            SELECT organization_id FROM public.organization_members
            WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'manager') AND deactivated_at IS NULL
        )
    );

-- lead_distribution_sessions: venditore vede le proprie, admin vede tutto
CREATE POLICY "Users can view own sessions" ON public.lead_distribution_sessions
    FOR SELECT USING (
        user_id = auth.uid()
        OR auth.uid() IN (
            SELECT user_id FROM public.organization_members
            WHERE organization_id = lead_distribution_sessions.organization_id
            AND role IN ('owner', 'admin', 'manager')
            AND deactivated_at IS NULL
        )
    );

CREATE POLICY "Users can create own sessions" ON public.lead_distribution_sessions
    FOR INSERT WITH CHECK (
        user_id = auth.uid()
        AND organization_id IN (
            SELECT organization_id FROM public.organization_members
            WHERE user_id = auth.uid() AND deactivated_at IS NULL
        )
    );

CREATE POLICY "Users can update own sessions" ON public.lead_distribution_sessions
    FOR UPDATE USING (
        user_id = auth.uid()
        OR auth.uid() IN (
            SELECT user_id FROM public.organization_members
            WHERE organization_id = lead_distribution_sessions.organization_id
            AND role IN ('owner', 'admin', 'manager')
            AND deactivated_at IS NULL
        )
    );

-- lead_daily_quota
CREATE POLICY "Users can view own quota" ON public.lead_daily_quota
    FOR SELECT USING (
        user_id = auth.uid()
        OR auth.uid() IN (
            SELECT user_id FROM public.organization_members
            WHERE organization_id = lead_daily_quota.organization_id
            AND role IN ('owner', 'admin', 'manager')
            AND deactivated_at IS NULL
        )
    );

CREATE POLICY "Users can upsert own quota" ON public.lead_daily_quota
    FOR ALL USING (
        user_id = auth.uid()
        OR auth.uid() IN (
            SELECT user_id FROM public.organization_members
            WHERE organization_id = lead_daily_quota.organization_id
            AND role IN ('owner', 'admin', 'manager')
            AND deactivated_at IS NULL
        )
    );

-- ============================================================
-- Indexes for performance
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_lead_pool_org ON public.lead_pool(organization_id);
CREATE INDEX IF NOT EXISTS idx_lead_pool_list ON public.lead_pool(list_id);
CREATE INDEX IF NOT EXISTS idx_lead_pool_status ON public.lead_pool(status);
CREATE INDEX IF NOT EXISTS idx_lead_pool_assigned_to ON public.lead_pool(assigned_to);
CREATE INDEX IF NOT EXISTS idx_lead_pool_phone ON public.lead_pool(phone);
CREATE INDEX IF NOT EXISTS idx_lead_pool_priority ON public.lead_pool(priority_score DESC);
CREATE INDEX IF NOT EXISTS idx_lead_pool_assigned_at ON public.lead_pool(assigned_at);

CREATE INDEX IF NOT EXISTS idx_lead_lists_org ON public.lead_lists(organization_id);
CREATE INDEX IF NOT EXISTS idx_lead_lists_active ON public.lead_lists(is_active);

CREATE INDEX IF NOT EXISTS idx_lead_sessions_user ON public.lead_distribution_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_lead_sessions_org ON public.lead_distribution_sessions(organization_id);
CREATE INDEX IF NOT EXISTS idx_lead_sessions_status ON public.lead_distribution_sessions(status);

CREATE INDEX IF NOT EXISTS idx_lead_daily_quota_user ON public.lead_daily_quota(user_id, quota_date);
CREATE INDEX IF NOT EXISTS idx_lead_daily_quota_date ON public.lead_daily_quota(quota_date);

CREATE INDEX IF NOT EXISTS idx_lead_rules_org ON public.lead_distribution_rules(organization_id);
CREATE INDEX IF NOT EXISTS idx_lead_rules_user ON public.lead_distribution_rules(user_id);

-- ============================================================
-- Realtime: enable for live KPI updates
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.lead_daily_quota;
ALTER PUBLICATION supabase_realtime ADD TABLE public.lead_distribution_sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.lead_pool;
