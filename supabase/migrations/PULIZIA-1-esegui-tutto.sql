-- ============================================================
-- PULIZIA — FILE 1 DI 2
-- ============================================================
-- Seleziona TUTTO questo file (Cmd+A), incolla nel SQL Editor di
-- Supabase, premi Run. Una volta sola.
--
-- Qui dentro non c'e' nessun VACUUM, quindi gira tutto in una sola
-- transazione: o passa per intero, o non resta niente a meta'.
--
-- Quando ha finito, passa al FILE 2.
-- ============================================================


-- ─────────── A. LEAD PRIMA DEL 1 LUGLIO 2026 ───────────
-- 739 righe. Le collegate si sistemano da sole: lead_activities,
-- revenue_attribution, lead_tags e ai_crm_actions in CASCADE;
-- tracked_events e calendar_events in SET NULL.

DELETE FROM public.leads WHERE created_at < '2026-07-01';


-- ─────────── B. LE 18 TABELLE MORTE ───────────
-- Lista validata con una prova a secco: 18 DROP su 18.
-- Restano fuori ad_automation_rules, ai_llm_models e dante_messages,
-- perche' qualcosa di vivo ci punta. Sono 200 kB, irrilevanti.

DROP TABLE IF EXISTS public.ai_agent_logs;
DROP TABLE IF EXISTS public.ai_ad_recommendations;
DROP TABLE IF EXISTS public.ai_performance_snapshots;
DROP TABLE IF EXISTS public.ai_angle_scores;
DROP TABLE IF EXISTS public.ai_working_memory;
DROP TABLE IF EXISTS public.ai_mission_objectives;
DROP TABLE IF EXISTS public.ad_optimization_targets;
DROP TABLE IF EXISTS public.brand_brief;
DROP TABLE IF EXISTS public.ai_ad_sessions;
DROP TABLE IF EXISTS public.ai_agent_skills;
DROP TABLE IF EXISTS public.ai_budget_tracking;
DROP TABLE IF EXISTS public.ai_creative_briefs;
DROP TABLE IF EXISTS public.api_cost_log;
DROP TABLE IF EXISTS public.automated_rules;
DROP TABLE IF EXISTS public.department_features;
DROP TABLE IF EXISTS public.pipeline_config;
DROP TABLE IF EXISTS public.crm_leaderboard;
DROP TABLE IF EXISTS public.video_render_jobs;


-- ─────────── C. RETENTION DATI STORICI ───────────

DELETE FROM public.page_views     WHERE created_at < now() - interval '90 days';
DELETE FROM public.tracked_events WHERE created_at < now() - interval '90 days';
DELETE FROM public.ai_episodes    WHERE created_at < now() - interval '30 days';
DELETE FROM public.notifications  WHERE created_at < now() - interval '90 days';


-- ─────────── D. PULIZIA AUTOMATICA FUTURA ───────────
-- Perche' il problema non si riformi da solo fra sei mesi.

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


-- ─────────── E. SPEGNIMENTO DEGLI 11 CRON A VUOTO ───────────
-- Restano accesi solo il job 2 (reset quota setter, serve al CRM) e il
-- job 13 (report Telegram delle 19:00).
-- Per riaccendere tutto quando ripartono le ads:
--   SELECT cron.alter_job(jobid, active := true) FROM cron.job;

SELECT cron.alter_job(1,  active := false);   -- ai-autopilot-cycle      ogni 30 min
SELECT cron.alter_job(4,  active := false);   -- meta-ads-sync-cycle     ogni 3 ore
SELECT cron.alter_job(5,  active := false);   -- ai-consolidate-daily
SELECT cron.alter_job(6,  active := false);   -- ai-reflect-weekly
SELECT cron.alter_job(7,  active := false);   -- ai-predict-revenue-daily
SELECT cron.alter_job(8,  active := false);   -- ai-cross-intel-weekly
SELECT cron.alter_job(9,  active := false);   -- ai-leak-detector-daily
SELECT cron.alter_job(10, active := false);   -- ai-budget-realloc-6h
SELECT cron.alter_job(11, active := false);   -- ai-audience-dna-daily
SELECT cron.alter_job(12, active := false);   -- ads-monitor (doppione Vercel)
SELECT cron.alter_job(14, active := false);   -- scheduled-reports ogni 30 min


-- ─────────── F. LOG INTERNI DI POSTGRES ───────────

DELETE FROM net._http_response   WHERE created  < now() - interval '2 days';
DELETE FROM cron.job_run_details WHERE end_time < now() - interval '7 days';


-- ─────────── CONTROLLO ───────────
-- Il peso sara' ancora alto: lo spazio lo libera il FILE 2.

SELECT count(*) AS tabelle_rimaste
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind = 'r';

SELECT count(*) AS lead_rimasti FROM public.leads;

SELECT count(*) FILTER (WHERE active) AS cron_attivi, count(*) AS cron_totali
FROM cron.job;
