-- ============================================================
-- Migration: Lead Distribution Machine — V2
-- Fasi 1-4: assegnazione atomica, appuntamenti, richiami
-- programmati, recycling, telefonia e funnel completo.
-- ============================================================

-- ── 1. lead_pool: nuovi campi ────────────────────────────────
ALTER TABLE public.lead_pool
    ADD COLUMN IF NOT EXISTS callback_at    TIMESTAMPTZ,   -- quando richiamare (esito 'callback')
    ADD COLUMN IF NOT EXISTS appointment_at TIMESTAMPTZ,   -- data/ora appuntamento fissato
    ADD COLUMN IF NOT EXISTS recycled_count INT DEFAULT 0; -- quante volte è tornato nel pool

-- Estendi i valori di feedback ammessi: aggiunge 'appointment'
ALTER TABLE public.lead_pool DROP CONSTRAINT IF EXISTS lead_pool_feedback_check;
ALTER TABLE public.lead_pool ADD CONSTRAINT lead_pool_feedback_check
    CHECK (feedback IN (
        'interested', 'not_interested', 'callback', 'no_answer',
        'converted', 'wrong_number', 'appointment'
    ));

-- ── 2. lead_distribution_rules: recycling ────────────────────
ALTER TABLE public.lead_distribution_rules
    ADD COLUMN IF NOT EXISTS recycle_after_hours INT DEFAULT 48;  -- ore dopo le quali un lead
                                                                  -- assegnato ma non chiamato torna nel pool

-- ── 3. lead_calls: log telefonate (Fase 3) ───────────────────
CREATE TABLE IF NOT EXISTS public.lead_calls (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    lead_pool_id UUID REFERENCES public.lead_pool(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id),

    phone TEXT,
    -- Provider: 'manual' (click su tel:), 'twilio', 'aircall', ...
    provider TEXT DEFAULT 'manual',
    provider_call_id TEXT,

    started_at TIMESTAMPTZ DEFAULT now(),
    connected_at TIMESTAMPTZ,        -- quando la chiamata è stata risposta
    ended_at TIMESTAMPTZ,
    duration_seconds INT,            -- durata reale (se disponibile dal provider)
    outcome TEXT,                    -- feedback registrato dopo questa chiamata
    recording_url TEXT,

    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.lead_calls ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own calls" ON public.lead_calls
    FOR ALL USING (
        user_id = auth.uid()
        OR auth.uid() IN (
            SELECT user_id FROM public.organization_members
            WHERE organization_id = lead_calls.organization_id
            AND role IN ('owner', 'admin', 'manager')
            AND deactivated_at IS NULL
        )
    );

CREATE INDEX IF NOT EXISTS idx_lead_calls_org      ON public.lead_calls(organization_id);
CREATE INDEX IF NOT EXISTS idx_lead_calls_user     ON public.lead_calls(user_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_lead_calls_pool     ON public.lead_calls(lead_pool_id);

-- ── 4. Nuovi indici lead_pool ────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_lead_pool_callback_at    ON public.lead_pool(assigned_to, callback_at) WHERE callback_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_lead_pool_recycle        ON public.lead_pool(organization_id, status, assigned_at) WHERE status = 'assigned';

-- ── 5. RPC: assegnazione ATOMICA anti-race ───────────────────
-- Seleziona e blocca (FOR UPDATE SKIP LOCKED) i lead disponibili,
-- li marca 'assigned' e li restituisce. Impossibile che due
-- venditori ottengano lo stesso lead nello stesso istante.
CREATE OR REPLACE FUNCTION public.claim_pool_leads(
    p_org uuid,
    p_user uuid,
    p_batch int,
    p_list_ids uuid[],
    p_session uuid,
    p_dedup_hours int DEFAULT 72
)
RETURNS SETOF public.lead_pool
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    WITH claimed AS (
        SELECT lp.id
        FROM public.lead_pool lp
        WHERE lp.organization_id = p_org
          AND lp.status IN ('available', 'recycled')
          AND (p_list_ids IS NULL OR lp.list_id = ANY(p_list_ids))
          -- escludi numeri già dati a QUESTO venditore di recente
          AND NOT EXISTS (
              SELECT 1 FROM public.lead_pool r
              WHERE r.organization_id = p_org
                AND r.assigned_to = p_user
                AND r.phone IS NOT NULL
                AND r.phone = lp.phone
                AND r.assigned_at > now() - make_interval(hours => p_dedup_hours)
          )
          -- escludi numeri già presenti nel CRM leads (già lavorati)
          AND (lp.phone IS NULL OR NOT EXISTS (
              SELECT 1 FROM public.leads cl
              WHERE cl.organization_id = p_org
                AND cl.phone = lp.phone
          ))
        ORDER BY (lp.status = 'available') DESC,   -- prima gli 'available', poi i 'recycled'
                 lp.priority_score DESC,
                 lp.created_at DESC                 -- LIFO: i più freschi prima
        LIMIT p_batch
        FOR UPDATE SKIP LOCKED
    )
    UPDATE public.lead_pool p
    SET status = 'assigned',
        assigned_to = p_user,
        assigned_at = now(),
        session_id = p_session,
        updated_at = now()
    FROM claimed c
    WHERE p.id = c.id
    RETURNING p.*;
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_pool_leads(uuid, uuid, int, uuid[], uuid, int) TO authenticated, service_role;

-- ── 6. Realtime per le vincite di team (Fase 4) ──────────────
-- lead_pool è già in publication; lead_calls opzionale per live KPI.
DO $$ BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.lead_calls;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
