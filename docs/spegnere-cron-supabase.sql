-- ============================================================
-- SPEGNIMENTO CRON SUPABASE CHE LAVORANO A VUOTO
-- Da eseguire in: Supabase Dashboard -> SQL Editor
-- ============================================================
--
-- PERCHE':
-- Tutte e 25 le campagne Meta dell'account 511099830249139 sono in stato
-- PAUSED. Questi job continuano comunque a girare e a chiamare le API
-- Meta e i modelli LLM per analizzare campagne ferme.
--
-- Esempio reale del 14/08/2026, ripetuto ogni 30 minuti:
--   action_type: pause_campaign
--   target: "MS - Lead Generation - Marzo 2026"
--   reasoning: "CPL EUR 61.81 is 211% above average. Recommending pause."
-- La campagna era gia' in pausa da mesi.
--
-- Volume accumulato a vuoto:
--   ai_ad_recommendations     11.423 righe
--   ai_agent_logs              6.817 righe
--   ai_performance_snapshots   6.817 righe
--   ai_episodes                5.522 righe
--
-- ============================================================

-- Motore AI sulle ads (Edge Functions Supabase)
SELECT cron.alter_job(1,  active := false);   -- ai-autopilot          ogni 30 min
SELECT cron.alter_job(4,  active := false);   -- meta-ads-sync         ogni 3 ore
SELECT cron.alter_job(5,  active := false);   -- ai-consolidate        ogni notte
SELECT cron.alter_job(6,  active := false);   -- ai-reflect            settimanale
SELECT cron.alter_job(7,  active := false);   -- ai-predict-revenue    ogni giorno
SELECT cron.alter_job(8,  active := false);   -- ai-cross-intel        settimanale
SELECT cron.alter_job(9,  active := false);   -- ai-leak-detector      ogni giorno
SELECT cron.alter_job(10, active := false);   -- ai-budget-realloc     ogni 6 ore
SELECT cron.alter_job(11, active := false);   -- ai-audience-dna       ogni giorno

-- Doppioni e report ridondanti (chiamano route su Vercel)
SELECT cron.alter_job(12, active := false);   -- /api/cron/ads-monitor      ogni ora
SELECT cron.alter_job(14, active := false);   -- /api/cron/scheduled-report ogni 30 min

-- ============================================================
-- RESTANO ACCESI DI PROPOSITO:
--   job  2  reset giornaliero quota setter (SQL puro, serve alla
--           distribuzione lead che e' tuttora attiva)
--   job 13  /api/cron/daily-report — il riepilogo Telegram delle 19:00
-- ============================================================

-- Verifica dopo l'esecuzione
SELECT jobid, schedule, active FROM cron.job ORDER BY jobid;

-- ============================================================
-- PER RIACCENDERE TUTTO QUANDO RIPARTONO LE ADS:
--   SELECT cron.alter_job(jobid, active := true) FROM cron.job;
-- oppure singolarmente:
--   SELECT cron.alter_job(1, active := true);
-- ============================================================
