-- ============================================================
-- PULIZIA — FILE 2 DI 2 — VACUUM
-- ============================================================
-- Da eseguire SOLO DOPO che il FILE 1 e' andato a buon fine.
--
-- ATTENZIONE AL MODO: una riga alla volta.
-- Seleziona la prima riga, Run. Poi la seconda, Run. E cosi' via.
-- NON selezionare tutto il file: VACUUM non puo' girare dentro una
-- transazione, e il SQL Editor ne apre una quando gli dai piu' comandi
-- insieme. E' l'errore "VACUUM cannot run inside a transaction block".
--
-- Fino a qui hai cancellato righe, ma Postgres non ha ancora restituito
-- il disco. E' questo file che libera davvero lo spazio.
-- Ogni riga blocca la sua tabella per qualche secondo: falle a
-- traffico basso.
--
-- La piu' importante e' la prima: net._http_response occupa 17 MB per
-- 36 righe vive.
-- ============================================================

VACUUM FULL net._http_response;

VACUUM FULL cron.job_run_details;

VACUUM FULL public.page_views;

VACUUM FULL public.tracked_events;

VACUUM FULL public.ai_episodes;

VACUUM FULL public.leads;

ANALYZE;


-- ============================================================
-- VERIFICA FINALE — questa si puo' selezionare tutta insieme
-- ============================================================
--
-- SELECT pg_size_pretty(pg_database_size(current_database())) AS peso_database;
--
-- SELECT jobid, jobname, schedule, active FROM cron.job ORDER BY jobid;
--
-- SELECT to_char(created_at,'YYYY-MM') AS mese, count(*) AS lead
-- FROM public.leads GROUP BY 1 ORDER BY 1;
