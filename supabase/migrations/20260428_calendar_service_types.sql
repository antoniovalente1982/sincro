-- ============================================================
-- Migration: Calendar Service Types (Tipi di Appuntamento)
-- ============================================================

-- 1. Create service types table
CREATE TABLE IF NOT EXISTS public.calendar_service_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    duration_minutes INT NOT NULL DEFAULT 30,
    color TEXT DEFAULT '#6366f1',
    description TEXT,
    is_default BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    position INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(organization_id, slug)
);

-- 2. Enable RLS
ALTER TABLE public.calendar_service_types ENABLE ROW LEVEL SECURITY;

-- 3. RLS Policies
CREATE POLICY "Users can view own org service_types" ON public.calendar_service_types
    FOR SELECT USING (
        organization_id IN (
            SELECT organization_id FROM public.organization_members
            WHERE user_id = auth.uid() AND deactivated_at IS NULL
        )
    );

CREATE POLICY "Admins can manage service_types" ON public.calendar_service_types
    FOR ALL USING (
        organization_id IN (
            SELECT organization_id FROM public.organization_members
            WHERE user_id = auth.uid() AND role IN ('owner', 'admin') AND deactivated_at IS NULL
        )
    );

-- 4. Add service_type_id (nullable) to calendar_events
ALTER TABLE public.calendar_events
    ADD COLUMN IF NOT EXISTS service_type_id UUID REFERENCES public.calendar_service_types(id) ON DELETE SET NULL;

-- 5. Index for performance
CREATE INDEX IF NOT EXISTS idx_service_types_org ON public.calendar_service_types(organization_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_service_type ON public.calendar_events(service_type_id);
