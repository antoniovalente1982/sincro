-- ============================================================
-- PULIZIA COMPLETA — SQL EDITOR DI SUPABASE
-- ============================================================
--
-- ISTRUZIONI
--   1. Prima di tutto: Dashboard -> Database -> Backups -> scarica un
--      backup. Fallo ORA che sei ancora su Pro: con il downgrade a Free
--      i backup automatici spariscono.
--   2. Poi esegui i blocchi A-F QUI SOTTO, UNO ALLA VOLTA.
--      Seleziona il blocco, premi Run, controlla il risultato, passa al
--      successivo. Non lanciarli tutti insieme.
--   3. Il blocco G (VACUUM FULL) va lanciato per ultimo e a parte.
--
-- RETE DI SICUREZZA GIA' IN PIEDI
--   ~/Desktop/sincro-backup-2026-08-14/   79 tabelle, 145.087 righe
--   ~/Desktop/sincro-archivi/             marzo -> agosto, 6 file
--   I 739 lead pre-luglio e i EUR 43.738,40 di storico vendite sono in
--   entrambi, verificati al centesimo.
-- ============================================================


-- ═══════════════ BLOCCO A — LEAD PRIMA DEL 1 LUGLIO ═══════════════
-- Attesi: 739 righe cancellate.
-- Le collegate si sistemano da sole: lead_activities, revenue_attribution,
-- lead_tags e ai_crm_actions vanno in CASCADE; tracked_events e
-- calendar_events vanno in SET NULL.

DELETE FROM public.leads WHERE created_at < '2026-07-01';


-- ═══════════════ BLOCCO B — LE 21 TABELLE MORTE ═══════════════
-- Verificate una per una: zero righe oppure dati del motore AI ormai
-- spento, zero riferimenti nel codice, nessuna foreign key in ingresso,
-- nessuna funzione SQL che le usa.

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


-- ═══════════════ BLOCCO C — RETENTION STORICI ═══════════════
-- Attese circa 30.000 righe da page_views e 34.000 da tracked_events.

DELETE FROM public.page_views     WHERE created_at < now() - interval '90 days';
DELETE FROM public.tracked_events WHERE created_at < now() - interval '90 days';
DELETE FROM public.ai_episodes    WHERE created_at < now() - interval '30 days';
DELETE FROM public.notifications  WHERE created_at < now() - interval '90 days';


-- ═══════════════ BLOCCO D — PULIZIA AUTOMATICA ═══════════════
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


-- ═══════════════ BLOCCO E — SPEGNIMENTO CRON ═══════════════
-- Undici job su tredici. Restano accesi solo il job 2 (reset quota
-- setter, SQL puro, serve al CRM) e il job 13 (report Telegram 19:00).
-- Per riaccendere tutto quando ripartono le ads:
--   SELECT cron.alter_job(jobid, active := true) FROM cron.job;

SELECT cron.alter_job(1,  active := false);   -- ai-autopilot       ogni 30 min
SELECT cron.alter_job(4,  active := false);   -- meta-ads-sync      ogni 3 ore
SELECT cron.alter_job(5,  active := false);   -- ai-consolidate
SELECT cron.alter_job(6,  active := false);   -- ai-reflect
SELECT cron.alter_job(7,  active := false);   -- ai-predict-revenue
SELECT cron.alter_job(8,  active := false);   -- ai-cross-intel
SELECT cron.alter_job(9,  active := false);   -- ai-leak-detector
SELECT cron.alter_job(10, active := false);   -- ai-budget-realloc
SELECT cron.alter_job(11, active := false);   -- ai-audience-dna
SELECT cron.alter_job(12, active := false);   -- ads-monitor (doppione Vercel)
SELECT cron.alter_job(14, active := false);   -- scheduled-report ogni 30 min


-- ═══════════════ BLOCCO F — LOG INTERNI ═══════════════

DELETE FROM net._http_response   WHERE created  < now() - interval '2 days';
DELETE FROM cron.job_run_details WHERE end_time < now() - interval '7 days';


-- ═══════════════ BLOCCO G — VACUUM FULL, DA SOLO ═══════════════
-- Fino a qui hai cancellato righe, ma Postgres non ha ancora restituito
-- il disco. E' questo blocco che libera davvero lo spazio, ed e' anche
-- quello che porta net._http_response da 17 MB a quasi zero.
--
-- Blocca ogni tabella per qualche secondo: fallo a traffico basso.
-- Esegui una riga alla volta.

VACUUM FULL net._http_response;
VACUUM FULL cron.job_run_details;
VACUUM FULL public.page_views;
VACUUM FULL public.tracked_events;
VACUUM FULL public.ai_episodes;
VACUUM FULL public.leads;
ANALYZE;


-- ═══════════════ VERIFICA FINALE ═══════════════

SELECT pg_size_pretty(pg_database_size(current_database())) AS peso_database;

SELECT count(*) AS tabelle_rimaste
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind = 'r';

SELECT jobid, jobname, schedule, active FROM cron.job ORDER BY jobid;

SELECT to_char(created_at, 'YYYY-MM') AS mese, count(*) AS lead
FROM public.leads GROUP BY 1 ORDER BY 1;
