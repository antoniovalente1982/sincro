-- ============================================================
-- CLEANUP: Rimozione tabelle moduli dismessi
-- Rimuove: Radar Sincro, Partner
-- Data: 2026-07-11
-- ============================================================

-- Drop tabelle con CASCADE per rimuovere anche foreign keys dipendenti
DROP TABLE IF EXISTS public.radar_submissions CASCADE;
DROP TABLE IF EXISTS public.partners CASCADE;

-- Log della migration
DO $$
BEGIN
  RAISE NOTICE 'Cleanup migration completata: radar_submissions e partners droppate';
END $$;
