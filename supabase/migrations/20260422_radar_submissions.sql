-- Radar Sincro Quiz Submissions
-- Stores quiz answers, scores, parent info, and partner attribution

CREATE TABLE IF NOT EXISTS public.radar_submissions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    
    -- Child info
    child_name TEXT NOT NULL,
    child_sport TEXT,
    
    -- Parent info
    parent_name TEXT NOT NULL,
    parent_email TEXT NOT NULL,
    parent_phone TEXT,
    
    -- Partner attribution
    partner_id TEXT,  -- tracks which partner sent this lead
    
    -- Quiz data
    answers JSONB DEFAULT '{}'::jsonb,  -- { "1": 0, "2": 1, "3": 2, ... }
    scores JSONB DEFAULT '{}'::jsonb,   -- { "fiducia": 75, "pressione": 40, "motivazione": 60, "blocchi": 30, "overall": 51 }
    
    -- Metadata
    ip_address TEXT,
    converted BOOLEAN DEFAULT false,  -- true if parent booked a valutazione
    converted_at TIMESTAMPTZ,
    lead_id UUID,  -- reference to leads table if converted
    
    -- Notes
    notes TEXT
);

-- Indexes for reporting
CREATE INDEX IF NOT EXISTS idx_radar_partner ON public.radar_submissions(partner_id) WHERE partner_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_radar_email ON public.radar_submissions(parent_email);
CREATE INDEX IF NOT EXISTS idx_radar_created ON public.radar_submissions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_radar_converted ON public.radar_submissions(converted) WHERE converted = false;

-- RLS: Allow public inserts (quiz is public), restrict reads to authenticated users
ALTER TABLE public.radar_submissions ENABLE ROW LEVEL SECURITY;

-- Allow anonymous inserts (public quiz)
CREATE POLICY "Allow public radar submissions" ON public.radar_submissions
    FOR INSERT WITH CHECK (true);

-- Allow authenticated reads (for dashboard)
CREATE POLICY "Allow authenticated radar reads" ON public.radar_submissions
    FOR SELECT USING (auth.role() = 'authenticated');

-- Allow authenticated updates (for marking as converted)
CREATE POLICY "Allow authenticated radar updates" ON public.radar_submissions
    FOR UPDATE USING (auth.role() = 'authenticated');
