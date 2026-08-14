-- ============================================================
-- PULIZIA COMPLETA — DA INCOLLARE NEL SQL EDITOR DI SUPABASE
-- ============================================================
--
-- Esegui i blocchi NELL'ORDINE. Puoi lanciarli tutti insieme tranne
-- l'ultimo (VACUUM FULL), che va lanciato a parte.
--
-- PRIMA DI PARTIRE, verifica di avere:
--   ~/Desktop/sincro-backup-2026-08-14/   backup completo, 79 tabelle
--   ~/Desktop/sincro-archivi/             6 archivi mensili, marzo->agosto
--
-- I 739 lead pre-luglio e i EUR 43.738,40 di storico vendite sono
-- dentro entrambi. Da qui in poi spariscono dal database: per
-- rivederli si passa dagli archivi.
-- ============================================================


-- ============================================================
-- A. LEAD PRECEDENTI AL 1 LUGLIO 2026
-- ============================================================
-- 739 lead. Le tabelle collegate si sistemano da sole:
--   lead_activities, revenue_attribution, lead_tags, ai_crm_actions -> CASCADE
--   tracked_events, calendar_events                                 -> SET NULL
BEGIN;
DELETE FROM public.leads WHERE created_at < '2026-07-01';
COMMIT;


-- ============================================================
-- B. LE 21 TABELLE MORTE
-- ============================================================
-- Verificate una per una: zero righe oppure dati del motore AI ora
-- spento, zero riferimenti nel codice, nessuna FK in ingresso,
-- nessuna funzione SQL che le usa.
BEGIN;
DROP TABLE IF EXISTS public.ai_agent_logs;
DROP TABLE IF EXISTS public.ai_ad_recommendations;
DROP TABLE IF EXISTS public.ai_performance_snapshots;
DROP TABLE IF EXISTS public.ai_angle_scores;
DROP TABLE IF EXISTS public.ai_working_memory;
DROP TABLE IF EXISTS public.ai_mission_objectives;
DROP TABLE IF EXISTS public.ad_automation_rules;
DROP TABLE IF EXISTS public.ad_optimization_targets;
DROP TABLE IF EXISTS public.brand_brief;
DROP TABLE IF EXISTS public.dante_messages;
DROP TABLE IF EXISTS public.ai_ad_sessions;
DROP TABLE IF EXISTS public.ai_agent_skills;
DROP TABLE IF EXISTS public.ai_budget_tracking;
DROP TABLE IF EXISTS public.ai_creative_briefs;
DROP TABLE IF EXISTS public.api_cost_log;
DROP TABLE IF EXISTS public.automated_rules;
DROP TABLE IF EXISTS public.department_features;
DROP TABLE IF EXISTS public.pipeline_config;
DROP TABLE IF EXISTS public.crm_leaderboard;
DROP TABLE IF EXISTS public.ai_llm_models;
DROP TABLE IF EXISTS public.video_render_jobs;
COMMIT;


-- ============================================================
-- C. RETENTION SUI DATI STORICI
-- ============================================================
BEGIN;
DELETE FROM public.page_views     WHERE created_at < now() - interval '90 days';
DELETE FROM public.tracked_events WHERE created_at < now() - interval '90 days';
DELETE FROM public.ai_episodes    WHERE created_at < now() - interval '30 days';
DELETE FROM public.notifications  WHERE created_at < now() - interval '90 days';
COMMIT;


-- ============================================================
-- D. PULIZIA AUTOMATICA, PERCHE' NON SI RIFORMI
-- ============================================================
CREATE OR REPLACE FUNCTION public.pulizia_dati_storici()
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $fn$
  DELETE FROM public.page_views     WHERE created_at < now() - interval '90 days';
  DELETE FROM public.tracked_events WHERE created_at < now() - interval '90 days';
  DELETE FROM public.ai_episodes    WHERE created_at < now() - interval '90 days';
  DELETE FROM public.notifications  WHERE created_at < now() - interval '90 days';
$fn$;

SELECT cron.unschedule('pulizia-dati-storici')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'pulizia-dati-storici');

SELECT cron.schedule('pulizia-dati-storici', '30 3 * * 0',
                     'SELECT public.pulizia_dati_storici()');

SELECT cron.unschedule('pulizia-log-interni')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'pulizia-log-interni');

SELECT cron.schedule('pulizia-log-interni', '0 4 * * *',
  $$DELETE FROM net._http_response WHERE created < now() - interval '2 days';
    DELETE FROM cron.job_run_details WHERE end_time < now() - interval '7 days';$$);


-- ============================================================
-- E. SPEGNIMENTO DEGLI 11 CRON CHE LAVORANO A VUOTO
-- ============================================================
-- Restano accesi solo:
--   job  2  reset giornaliero quota setter (SQL puro, serve al CRM)
--   job 13  report Telegram delle 19:00
SELECT cron.alter_job(1,  active := false);   -- ai-autopilot          ogni 30 min
SELECT cron.alter_job(4,  active := false);   -- meta-ads-sync         ogni 3 ore
SELECT cron.alter_job(5,  active := false);   -- ai-consolidate
SELECT cron.alter_job(6,  active := false);   -- ai-reflect
SELECT cron.alter_job(7,  active := false);   -- ai-predict-revenue
SELECT cron.alter_job(8,  active := false);   -- ai-cross-intel
SELECT cron.alter_job(9,  active := false);   -- ai-leak-detector
SELECT cron.alter_job(10, active := false);   -- ai-budget-realloc
SELECT cron.alter_job(11, active := false);   -- ai-audience-dna
SELECT cron.alter_job(12, active := false);   -- ads-monitor (doppione di Vercel)
SELECT cron.alter_job(14, active := false);   -- scheduled-report ogni 30 min


-- ============================================================
-- F. LOG INTERNI DI POSTGRES
-- ============================================================
DELETE FROM net._http_response   WHERE created  < now() - interval '2 days';
DELETE FROM cron.job_run_details WHERE end_time < now() - interval '7 days';


-- ============================================================
-- G. RECUPERO DEL DISCO — LANCIA QUESTO BLOCCO A PARTE
-- ============================================================
-- VACUUM FULL non gira dentro una transazione e blocca la tabella
-- per qualche secondo. Fallo a traffico basso, una riga alla volta.
--
--   VACUUM FULL net._http_response;
--   VACUUM FULL cron.job_run_details;
--   VACUUM FULL public.page_views;
--   VACUUM FULL public.tracked_events;
--   VACUUM FULL public.ai_episodes;
--   VACUUM FULL public.leads;
--   ANALYZE;


-- ============================================================
-- VERIFICA FINALE
-- ============================================================
SELECT pg_size_pretty(pg_database_size(current_database())) AS peso_database;

SELECT count(*) AS tabelle_rimaste
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind = 'r';

SELECT jobid, jobname, schedule, active FROM cron.job ORDER BY jobid;

SELECT to_char(created_at, 'YYYY-MM') AS mese, count(*) AS lead
FROM public.leads GROUP BY 1 ORDER BY 1;
