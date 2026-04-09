-- ============================================================
-- Migration: CRM Calendars and Round Robin Settings
-- ============================================================

-- 1. Create crm_calendars table
CREATE TABLE IF NOT EXISTS public.crm_calendars (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    description TEXT,
    event_type TEXT DEFAULT 'RoundRobin_OptimizeForAvailability',
    slot_duration_minutes INT DEFAULT 30,
    slot_interval_minutes INT DEFAULT 30,
    slot_buffer_minutes INT DEFAULT 15,
    redirect_url TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Create crm_calendar_members table for Round Robin mappings
CREATE TABLE IF NOT EXISTS public.crm_calendar_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    calendar_id UUID NOT NULL REFERENCES public.crm_calendars(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    priority NUMERIC DEFAULT 0.5,
    is_active BOOLEAN DEFAULT true,
    UNIQUE(calendar_id, user_id)
);

-- 3. Update calendar_events to link to specific calendars
ALTER TABLE public.calendar_events
  ADD COLUMN IF NOT EXISTS calendar_id UUID REFERENCES public.crm_calendars(id) ON DELETE SET NULL;

-- 4. Enable RLS
ALTER TABLE public.crm_calendars ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_calendar_members ENABLE ROW LEVEL SECURITY;

-- 5. Policies for crm_calendars
CREATE POLICY "Users can view own org crm_calendars" ON public.crm_calendars
    FOR SELECT USING (
        organization_id IN (
            SELECT organization_id FROM public.organization_members 
            WHERE user_id = auth.uid() AND deactivated_at IS NULL
        )
    );

CREATE POLICY "Users can manage own org crm_calendars" ON public.crm_calendars
    FOR ALL USING (
        organization_id IN (
            SELECT organization_id FROM public.organization_members 
            WHERE user_id = auth.uid() AND role IN ('owner', 'admin') AND deactivated_at IS NULL
        )
    );

-- 6. Policies for crm_calendar_members
CREATE POLICY "Users can view own org crm_calendar_members" ON public.crm_calendar_members
    FOR SELECT USING (
        calendar_id IN (
            SELECT id FROM public.crm_calendars WHERE organization_id IN (
                SELECT organization_id FROM public.organization_members 
                WHERE user_id = auth.uid() AND deactivated_at IS NULL
            )
        )
    );

CREATE POLICY "Users can manage own org crm_calendar_members" ON public.crm_calendar_members
    FOR ALL USING (
        calendar_id IN (
            SELECT id FROM public.crm_calendars WHERE organization_id IN (
                SELECT organization_id FROM public.organization_members 
                WHERE user_id = auth.uid() AND role IN ('owner', 'admin') AND deactivated_at IS NULL
            )
        )
    );

