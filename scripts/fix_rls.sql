-- ═══════════════════════════════════════════════════════════════
-- HERMES Security Fix: Enable RLS on ALL public tables
-- Date: 2026-04-08
-- ═══════════════════════════════════════════════════════════════

-- IMPORTANT: service_role key bypasses RLS automatically in Supabase.
-- We only need to create policies for authenticated users (frontend).

-- ═══════════════════════════════════════════════════════════════
-- STEP 1: Enable RLS on ALL tables
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.funnel_routing_engine ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.funnels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pipeline_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_agent_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_agent_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hermes_north_star ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_cost_log ENABLE ROW LEVEL SECURITY;

-- ═══════════════════════════════════════════════════════════════
-- STEP 2: Policies for AUTHENTICATED users
-- Users can only see data from their own organization
-- ═══════════════════════════════════════════════════════════════

-- Organizations: users can see orgs they belong to
CREATE POLICY "Users can view own organizations" ON public.organizations
    FOR SELECT USING (
        id IN (
            SELECT organization_id FROM public.organization_members 
            WHERE user_id = auth.uid()
        )
    );

-- Organization Members: users can see members of their own orgs
CREATE POLICY "Users can view own org members" ON public.organization_members
    FOR SELECT USING (
        organization_id IN (
            SELECT organization_id FROM public.organization_members 
            WHERE user_id = auth.uid()
        )
    );

-- Profiles: users can see their own profile
CREATE POLICY "Users can view own profile" ON public.profiles
    FOR SELECT USING (id = auth.uid());
CREATE POLICY "Users can update own profile" ON public.profiles
    FOR UPDATE USING (id = auth.uid());

-- Leads: users can see leads from their organization
CREATE POLICY "Users can view org leads" ON public.leads
    FOR SELECT USING (
        organization_id IN (
            SELECT organization_id FROM public.organization_members 
            WHERE user_id = auth.uid()
        )
    );

-- Funnels: users can see funnels from their organization
CREATE POLICY "Users can view org funnels" ON public.funnels
    FOR SELECT USING (
        organization_id IN (
            SELECT organization_id FROM public.organization_members 
            WHERE user_id = auth.uid()
        )
    );

-- Funnel Routing Engine: readable by authenticated users (needed for landing pages)
CREATE POLICY "Authenticated can view routing" ON public.funnel_routing_engine
    FOR SELECT USING (auth.role() = 'authenticated');

-- Pipeline Stages: readable by org members
CREATE POLICY "Users can view org pipeline stages" ON public.pipeline_stages
    FOR SELECT USING (
        organization_id IN (
            SELECT organization_id FROM public.organization_members 
            WHERE user_id = auth.uid()
        )
    );

-- Connections: only org members can see connections
CREATE POLICY "Users can view org connections" ON public.connections
    FOR SELECT USING (
        organization_id IN (
            SELECT organization_id FROM public.organization_members 
            WHERE user_id = auth.uid()
        )
    );

-- AI Agent Config: readable by org members
CREATE POLICY "Users can view org ai config" ON public.ai_agent_config
    FOR SELECT USING (
        organization_id IN (
            SELECT organization_id FROM public.organization_members 
            WHERE user_id = auth.uid()
        )
    );

-- AI Agent Logs: readable by org members
CREATE POLICY "Users can view org ai logs" ON public.ai_agent_logs
    FOR SELECT USING (
        organization_id IN (
            SELECT organization_id FROM public.organization_members 
            WHERE user_id = auth.uid()
        )
    );

-- Hermes North Star: readable by org members
CREATE POLICY "Users can view org north star" ON public.hermes_north_star
    FOR SELECT USING (
        organization_id IN (
            SELECT organization_id FROM public.organization_members 
            WHERE user_id = auth.uid()
        )
    );

-- Notifications: users can see their own notifications
CREATE POLICY "Users can view own notifications" ON public.notifications
    FOR SELECT USING (user_id = auth.uid());

-- Submissions: public INSERT (landing page form submissions from anonymous users)
CREATE POLICY "Anyone can submit forms" ON public.submissions
    FOR INSERT WITH CHECK (true);
-- Submissions: org members can view
CREATE POLICY "Users can view org submissions" ON public.submissions
    FOR SELECT USING (
        organization_id IN (
            SELECT organization_id FROM public.organization_members 
            WHERE user_id = auth.uid()
        )
    );

-- Team Members: readable by org members
CREATE POLICY "Users can view org team" ON public.team_members
    FOR SELECT USING (
        organization_id IN (
            SELECT organization_id FROM public.organization_members 
            WHERE user_id = auth.uid()
        )
    );

-- API Cost Log: readable by org members
CREATE POLICY "Users can view org api costs" ON public.api_cost_log
    FOR SELECT USING (
        organization_id IN (
            SELECT organization_id FROM public.organization_members 
            WHERE user_id = auth.uid()
        )
    );

-- ═══════════════════════════════════════════════════════════════
-- STEP 3: Special policy for landing page (anon users)
-- The landing page needs to READ funnel_routing_engine 
-- to load headlines dynamically
-- ═══════════════════════════════════════════════════════════════
CREATE POLICY "Anon can read routing for landing pages" ON public.funnel_routing_engine
    FOR SELECT USING (auth.role() = 'anon');

-- Funnels: anon can read (needed for landing page slug resolution)
CREATE POLICY "Anon can read funnels" ON public.funnels
    FOR SELECT USING (auth.role() = 'anon');

-- Pipeline stages: anon can read (needed for form submission)
CREATE POLICY "Anon can read pipeline stages" ON public.pipeline_stages
    FOR SELECT USING (auth.role() = 'anon');
