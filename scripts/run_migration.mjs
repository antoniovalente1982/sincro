// Run SQL migration via Supabase Management API
// Usage: SUPABASE_ACCESS_TOKEN=xxx node run_migration.mjs

const PROJECT_REF = 'bktiuhxenxwhkgvdaxnp'

// Try to get token from env or from .env.local
const accessToken = process.env.SUPABASE_ACCESS_TOKEN

if (!accessToken) {
    console.error('❌ SUPABASE_ACCESS_TOKEN not set.')
    console.log('Get your token from: https://supabase.com/dashboard/account/tokens')
    console.log('Then run: SUPABASE_ACCESS_TOKEN=sbp_xxx node run_migration.mjs')
    process.exit(1)
}

const SQL = `
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
    status TEXT DEFAULT 'confirmed',
    outcome TEXT,
    outcome_value NUMERIC,
    clickup_task_id TEXT,
    coach_id UUID,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.calendar_availability (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    day_of_week INT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    slot_duration_minutes INT DEFAULT 45,
    break_between_slots INT DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    UNIQUE(organization_id, user_id, day_of_week)
);

ALTER TABLE public.department_features ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calendar_availability ENABLE ROW LEVEL SECURITY;

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

CREATE INDEX IF NOT EXISTS idx_calendar_events_org ON public.calendar_events(organization_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_closer ON public.calendar_events(closer_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_lead ON public.calendar_events(lead_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_time ON public.calendar_events(start_time, end_time);
CREATE INDEX IF NOT EXISTS idx_org_members_deactivated ON public.organization_members(deactivated_at);
CREATE INDEX IF NOT EXISTS idx_org_members_department ON public.organization_members(department);
`

async function run() {
    console.log('🚀 Running migration on project:', PROJECT_REF)
    
    const res = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: SQL }),
    })

    if (!res.ok) {
        const text = await res.text()
        console.error('❌ Migration failed:', res.status, text)
        process.exit(1)
    }

    const result = await res.json()
    console.log('✅ Migration completed successfully!')
    console.log(JSON.stringify(result, null, 2))
}

run().catch(console.error)
