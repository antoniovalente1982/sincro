-- Dedicated editorial storage. Drafts must never inherit public funnel policies.
CREATE TABLE IF NOT EXISTS public.blog_posts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    name text NOT NULL CHECK (length(name) BETWEEN 1 AND 200),
    slug text NOT NULL CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND length(slug) <= 90),
    description text NOT NULL DEFAULT '',
    status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'archived')),
    settings jsonb NOT NULL CHECK (jsonb_typeof(settings) = 'object' AND settings->>'template' = 'blog_article'),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (organization_id, slug)
);

ALTER TABLE public.blog_posts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.blog_posts FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.blog_posts TO authenticated;
GRANT ALL ON public.blog_posts TO service_role;

DROP POLICY IF EXISTS blog_team_access ON public.blog_posts;
CREATE POLICY blog_team_access ON public.blog_posts
FOR ALL TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.organization_members AS member
        WHERE member.organization_id = blog_posts.organization_id
        AND member.user_id = auth.uid()
        AND member.deactivated_at IS NULL
        AND (member.role IN ('owner', 'admin') OR
            (member.role = 'manager' AND COALESCE(member.department, 'it') IN ('marketing', 'it')))
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.organization_members AS member
        WHERE member.organization_id = blog_posts.organization_id
        AND member.user_id = auth.uid()
        AND member.deactivated_at IS NULL
        AND (member.role IN ('owner', 'admin') OR
            (member.role = 'manager' AND COALESCE(member.department, 'it') IN ('marketing', 'it')))
    )
);

CREATE INDEX IF NOT EXISTS blog_posts_public_idx ON public.blog_posts (organization_id, updated_at DESC) WHERE status = 'active';
COMMENT ON TABLE public.blog_posts IS 'Dentro la partita: private editorial drafts and published posts. Public reads go through the server with explicit publication and organization filters.';
