-- ============================================================
-- Migration: Calendar Enhancements — Round-Robin & Bidirectional Sync
-- ============================================================

-- 1. Create organization_config table (for round-robin state)
CREATE TABLE IF NOT EXISTS public.organization_config (
    organization_id UUID PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
    round_robin_calendar_index INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.organization_config ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  BEGIN
    CREATE POLICY "org_config_select" ON public.organization_config
        FOR SELECT USING (
            organization_id IN (
                SELECT organization_id FROM public.organization_members
                WHERE user_id = auth.uid() AND deactivated_at IS NULL
            )
        );
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;

  BEGIN
    CREATE POLICY "org_config_manage" ON public.organization_config
        FOR ALL USING (
            organization_id IN (
                SELECT organization_id FROM public.organization_members
                WHERE user_id = auth.uid() AND role IN ('owner', 'admin') AND deactivated_at IS NULL
            )
        );
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;

-- 2. Add round_robin_index for cycling through members
ALTER TABLE public.crm_calendars
  ADD COLUMN IF NOT EXISTS round_robin_index INT DEFAULT 0;

-- 3. Add assignment_mode per calendar (round_robin, performance, availability)
ALTER TABLE public.crm_calendars
  ADD COLUMN IF NOT EXISTS assignment_mode TEXT DEFAULT 'round_robin';

-- 4. Add source to calendar_events to distinguish internal vs google vs public
ALTER TABLE public.calendar_events
  ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'internal';

-- 5. Add google_event_sync_token to organization_members for incremental sync
ALTER TABLE public.organization_members
  ADD COLUMN IF NOT EXISTS google_calendar_sync_token TEXT;
