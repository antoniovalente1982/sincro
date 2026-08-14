-- ============================================================
-- FASE 4 — RECUPERO SPAZIO FISICO
-- Da eseguire per ULTIMA, una istruzione alla volta.
-- VACUUM FULL non puo' girare dentro una transazione: niente BEGIN/COMMIT.
-- ============================================================
--
-- Dopo un DELETE, Postgres non restituisce lo spazio al disco: le righe
-- restano come "tuple morte". Serve VACUUM FULL per compattare davvero.
--
-- Il caso piu' evidente e' net._http_response: pesa 17 MB per 36 righe.
-- E' la coda delle risposte HTTP di pg_net, mai compattata.
-- ============================================================

-- --- Log interni di pg_net e pg_cron: 31 MB di sola cronologia ---
DELETE FROM net._http_response WHERE created < now() - interval '2 days';
DELETE FROM cron.job_run_details WHERE end_time < now() - interval '7 days';

-- --- Compattazione (blocca la tabella per pochi secondi: falla a traffico basso) ---
VACUUM FULL net._http_response;
VACUUM FULL cron.job_run_details;
VACUUM FULL public.page_views;
VACUUM FULL public.tracked_events;
VACUUM FULL public.ai_episodes;

-- --- Ricalcolo statistiche per il query planner ---
ANALYZE;

-- ============================================================
-- MANUTENZIONE RICORRENTE dei log interni
-- ============================================================
SELECT cron.schedule(
  'pulizia-log-interni',
  '0 4 * * *',
  $$DELETE FROM net._http_response WHERE created < now() - interval '2 days';
    DELETE FROM cron.job_run_details WHERE end_time < now() - interval '7 days';$$
);

-- ============================================================
-- VERIFICA FINALE
-- ============================================================
SELECT pg_size_pretty(pg_database_size(current_database())) AS peso_database;

SELECT n.nspname AS schema, pg_size_pretty(sum(pg_total_relation_size(c.oid))) AS peso
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE c.relkind IN ('r','i','t')
GROUP BY 1 ORDER BY sum(pg_total_relation_size(c.oid)) DESC LIMIT 6;
