-- ============================================================
-- FASE 2 — ELIMINAZIONE TABELLE MORTE
-- Eseguire DOPO aver spento i cron (docs/spegnere-cron-supabase.sql)
-- ============================================================
--
-- Ogni tabella qui sotto e' stata verificata su tre fronti:
--   1. zero righe OPPURE dati prodotti solo dal motore AI ora spento
--   2. zero riferimenti in app/, lib/, components/  (compare al massimo
--      nella migrazione che l'ha creata)
--   3. nessuna foreign key in ingresso da tabelle che restano
--   4. nessuna funzione SQL che la usa
--
-- ESCLUSE DI PROPOSITO, anche se sembravano candidate:
--   ai_agents            10 riferimenti — la usa l'AI setter del lead pool
--   ad_channels          FK da tracked_events e revenue_attribution
--   campaigns_cache      FK da revenue_attribution + funzione SQL
--   ai_experiments       FK da agent_knowledge
--   crm_calendars        FK da calendar_events
--   prospecting_agents   FK da leads + 2 funzioni SQL
--   setter_availability  funzione SQL + cron job 2 tuttora attivo
--   ad_rule_executions   usata da /api/cron/ecom-autopilot
--   dante_pending_actions usata da lib/dante-actions.ts
--   ai_realtime_logs     usata da ads-monitor e ecom-autopilot
--   scheduled_reports    usata da /api/cron/scheduled-report
--   ai_crm_actions       usata da una funzione SQL
--   ai_knowledge_base    usata da search_ai_knowledge()
-- ============================================================

BEGIN;

-- --- Dati del motore AI sulle ads (le campagne sono tutte in PAUSED) ---
DROP TABLE IF EXISTS public.ai_agent_logs;              -- 6.9 MB — 6.820 righe
DROP TABLE IF EXISTS public.ai_ad_recommendations;      -- 4.1 MB — 11.426 righe
DROP TABLE IF EXISTS public.ai_performance_snapshots;   -- 3.4 MB — 6.820 righe
DROP TABLE IF EXISTS public.ai_angle_scores;
DROP TABLE IF EXISTS public.ai_working_memory;
DROP TABLE IF EXISTS public.ai_mission_objectives;
DROP TABLE IF EXISTS public.ad_automation_rules;
DROP TABLE IF EXISTS public.ad_optimization_targets;
DROP TABLE IF EXISTS public.brand_brief;
DROP TABLE IF EXISTS public.dante_messages;

-- --- Tabelle create e mai usate (0 righe, 0 riferimenti) ---
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
DROP TABLE IF EXISTS public.video_render_jobs;         -- residuo di Remotion, rimosso

COMMIT;

-- Verifica: quante tabelle restano
SELECT count(*) AS tabelle_rimaste
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind = 'r';
