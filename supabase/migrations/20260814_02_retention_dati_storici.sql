-- ============================================================
-- FASE 3 — RETENTION SUI DATI STORICI
-- ============================================================
--
-- Queste tabelle servono e restano, ma non sono mai state sfoltite:
-- accumulano dal 17 marzo 2026 senza limite.
--
--   page_views      39.243 righe / 25 MB  ->  solo 9.452 negli ultimi 90 gg
--   tracked_events  38.371 righe / 18 MB  ->  solo 4.065 negli ultimi 90 gg
--   ai_episodes      5.525 righe / 7.8 MB ->  1.594 negli ultimi 30 gg
--
-- ATTENZIONE: questa fase CANCELLA righe. Fai prima un export:
--   Dashboard Supabase -> Database -> Backups, oppure
--   pg_dump "$DATABASE_URL" -t page_views -t tracked_events > backup.sql
--
-- Se ti servono le statistiche storiche, esportale in CSV prima di
-- eseguire: le analytics aggregate del passato non tornano indietro.
-- ============================================================

BEGIN;

-- Traffico sito: 90 giorni sono piu' che sufficienti per l'attribuzione
DELETE FROM public.page_views     WHERE created_at < now() - interval '90 days';
DELETE FROM public.tracked_events WHERE created_at < now() - interval '90 days';

-- Episodi del motore AI: erano decisioni su campagne in pausa
DELETE FROM public.ai_episodes    WHERE created_at < now() - interval '30 days';

COMMIT;

-- ============================================================
-- RETENTION AUTOMATICA: evita che il problema si riformi
-- ============================================================
CREATE OR REPLACE FUNCTION public.pulizia_dati_storici()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.page_views     WHERE created_at < now() - interval '90 days';
  DELETE FROM public.tracked_events WHERE created_at < now() - interval '90 days';
  DELETE FROM public.ai_episodes    WHERE created_at < now() - interval '90 days';
  DELETE FROM public.notifications  WHERE created_at < now() - interval '90 days';
$$;

-- Gira ogni domenica alle 3:30. E' SQL puro: non costa invocazioni ne' API.
SELECT cron.schedule('pulizia-dati-storici', '30 3 * * 0', 'SELECT public.pulizia_dati_storici()');
