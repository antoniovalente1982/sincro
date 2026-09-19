-- Editorial analytics are private; public ingestion resolves tenant/page server-side.
CREATE TABLE IF NOT EXISTS public.editorial_events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    event_id text NOT NULL CHECK (length(event_id) BETWEEN 1 AND 100),
    event_name text NOT NULL CHECK (event_name IN ('advertorial_view','advertorial_engaged','advertorial_cta','landing_view','landing_engaged','form_start','lead_submitted')),
    visitor_id uuid,
    session_id uuid,
    entry_key text CHECK (entry_key IS NULL OR (length(entry_key) <= 110 AND entry_key ~ '^(blog-[a-z0-9]+(-[a-z0-9]+)*|advertorial-pochi-minuti)$')),
    article_id uuid REFERENCES public.blog_posts(id) ON DELETE SET NULL,
    funnel_id uuid REFERENCES public.funnels(id) ON DELETE SET NULL,
    page_path text NOT NULL,
    occurred_at timestamptz NOT NULL DEFAULT now(),
    utm_source text, utm_medium text, utm_campaign text, utm_content text, utm_term text,
    submission_id uuid REFERENCES public.funnel_submissions(id) ON DELETE SET NULL,
    lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
    UNIQUE (organization_id, event_id)
);
ALTER TABLE public.editorial_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.editorial_events FROM anon, authenticated;
GRANT ALL ON public.editorial_events TO service_role;
CREATE INDEX IF NOT EXISTS editorial_events_period ON public.editorial_events (organization_id, occurred_at, id);
CREATE INDEX IF NOT EXISTS editorial_events_visitor ON public.editorial_events (organization_id, visitor_id, occurred_at);
CREATE INDEX IF NOT EXISTS editorial_events_entry ON public.editorial_events (organization_id, entry_key, occurred_at);
CREATE INDEX IF NOT EXISTS editorial_events_lead ON public.editorial_events (organization_id, lead_id, occurred_at) WHERE lead_id IS NOT NULL;
COMMENT ON TABLE public.editorial_events IS 'Consent-aware editorial journey; no contact fields. Authenticated reporting through role-scoped server endpoints.';

-- Retried submissions share the client event ID; only the first creates CRM work.
CREATE UNIQUE INDEX IF NOT EXISTS funnel_submissions_editorial_event
ON public.funnel_submissions (organization_id, (extra_data->>'editorial_event_id'))
WHERE extra_data->>'editorial_event_id' IS NOT NULL;

NOTIFY pgrst, 'reload schema';
