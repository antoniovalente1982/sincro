-- Partners table for the Metodo Sincro Partner Program
-- Two tiers: Strategic Partner (10%) and Ambassador (15%)

CREATE TABLE IF NOT EXISTS public.partners (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now(),
    
    -- Identity
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    slug TEXT UNIQUE NOT NULL,  -- URL slug for tracking (e.g., "mario-rossi")
    
    -- Program
    type TEXT NOT NULL DEFAULT 'strategic_partner' CHECK (type IN ('strategic_partner', 'ambassador')),
    commission INTEGER NOT NULL DEFAULT 10,  -- 10% or 15%
    commission_amount INTEGER NOT NULL DEFAULT 225,  -- €225 or €337 per deal
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    
    -- Extra
    notes TEXT,
    meta_data JSONB DEFAULT '{}'::jsonb
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_partners_slug ON public.partners(slug);
CREATE INDEX IF NOT EXISTS idx_partners_status ON public.partners(status) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_partners_type ON public.partners(type);

-- RLS
ALTER TABLE public.partners ENABLE ROW LEVEL SECURITY;

-- Only authenticated users can CRUD partners
CREATE POLICY "Allow authenticated partner reads" ON public.partners
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated partner inserts" ON public.partners
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated partner updates" ON public.partners
    FOR UPDATE USING (auth.role() = 'authenticated');
