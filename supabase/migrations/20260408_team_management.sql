-- ============================================================
-- Migration: Team Management - Roles, Departments & Soft-Delete
-- ============================================================

-- 1. Add new columns to organization_members
ALTER TABLE public.organization_members
  ADD COLUMN IF NOT EXISTS department TEXT,
  ADD COLUMN IF NOT EXISTS deactivated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deactivated_by UUID,
  ADD COLUMN IF NOT EXISTS display_color TEXT DEFAULT '#3b82f6',
  ADD COLUMN IF NOT EXISTS google_calendar_id TEXT,
  ADD COLUMN IF NOT EXISTS google_refresh_token TEXT,
  ADD COLUMN IF NOT EXISTS google_access_token TEXT,
  ADD COLUMN IF NOT EXISTS google_token_expiry TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS clickup_user_id TEXT;

-- 2. Create department_features table (predisposizione future)
CREATE TABLE IF NOT EXISTS public.department_features (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    department TEXT NOT NULL,
    feature_slug TEXT NOT NULL,
    is_enabled BOOLEAN DEFAULT false,
    config JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(organization_id, department, feature_slug)
);

-- 3. Create calendar_events table
CREATE TABLE IF NOT EXISTS public.calendar_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
    setter_id UUID,
    closer_id UUID NOT NULL,
    
    title TEXT NOT NULL,
    description TEXT,
    lead_phone TEXT,
    lead_email TEXT,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    
    google_event_id TEXT,
    google_calendar_id TEXT,
    
    status TEXT DEFAULT 'confirmed'
      CHECK (status IN ('confirmed', 'cancelled', 'completed', 'no_show', 'rescheduled')),
    outcome TEXT,
    outcome_value NUMERIC,
    
    clickup_task_id TEXT,
    coach_id UUID,
    
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Create calendar_availability table
CREATE TABLE IF NOT EXISTS public.calendar_availability (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    
    day_of_week INT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    slot_duration_minutes INT DEFAULT 30,
    break_between_slots INT DEFAULT 0,
    
    is_active BOOLEAN DEFAULT true,
    
    UNIQUE(organization_id, user_id, day_of_week)
);

-- 5. Enable RLS on new tables
ALTER TABLE public.department_features ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calendar_availability ENABLE ROW LEVEL SECURITY;

-- 6. RLS Policies for new tables (org-scoped access)
CREATE POLICY "Users can view own org department_features" ON public.department_features
    FOR SELECT USING (
        organization_id IN (
            SELECT organization_id FROM public.organization_members 
            WHERE user_id = auth.uid() AND deactivated_at IS NULL
        )
    );

CREATE POLICY "Users can view own org calendar_events" ON public.calendar_events
    FOR SELECT USING (
        organization_id IN (
            SELECT organization_id FROM public.organization_members 
            WHERE user_id = auth.uid() AND deactivated_at IS NULL
        )
    );

CREATE POLICY "Users can insert own org calendar_events" ON public.calendar_events
    FOR INSERT WITH CHECK (
        organization_id IN (
            SELECT organization_id FROM public.organization_members 
            WHERE user_id = auth.uid() AND deactivated_at IS NULL
        )
    );

CREATE POLICY "Users can update own org calendar_events" ON public.calendar_events
    FOR UPDATE USING (
        organization_id IN (
            SELECT organization_id FROM public.organization_members 
            WHERE user_id = auth.uid() AND deactivated_at IS NULL
        )
    );

CREATE POLICY "Users can view own org calendar_availability" ON public.calendar_availability
    FOR SELECT USING (
        organization_id IN (
            SELECT organization_id FROM public.organization_members 
            WHERE user_id = auth.uid() AND deactivated_at IS NULL
        )
    );

CREATE POLICY "Users can manage own calendar_availability" ON public.calendar_availability
    FOR ALL USING (
        user_id = auth.uid()
    );

-- 7. Indexes for performance
CREATE INDEX IF NOT EXISTS idx_calendar_events_org ON public.calendar_events(organization_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_closer ON public.calendar_events(closer_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_lead ON public.calendar_events(lead_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_time ON public.calendar_events(start_time, end_time);
CREATE INDEX IF NOT EXISTS idx_org_members_deactivated ON public.organization_members(deactivated_at);
CREATE INDEX IF NOT EXISTS idx_org_members_department ON public.organization_members(department);
