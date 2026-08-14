-- ============================================================
-- SPOSTAMENTO DEI 5 CRON DA VERCEL A SUPABASE
-- ============================================================
-- Seleziona tutto (Cmd+A) ed esegui. Nessun VACUUM qui dentro,
-- quindi va in un colpo solo.
--
-- COSA FA
-- Ricrea su pg_cron i 5 cron che oggi stanno in vercel.json, con gli
-- stessi orari, usando lo stesso meccanismo del job daily-report che
-- gia' funziona: net.http_get verso landing.metodosincro.com con
-- l'header Authorization.
--
-- Il CRON_SECRET non e' scritto qui: viene letto a runtime dal job
-- daily-report, cosi' non finisce dentro un file del repository.
--
-- DOPO AVERLO ESEGUITO devi fare il deploy del nuovo vercel.json
-- (senza cron), altrimenti per un po' partono da tutti e due.
-- ============================================================

DO $$
DECLARE
  segreto text;
  base    text := 'https://landing.metodosincro.com/api/cron/';
BEGIN
  SELECT substring(command from 'Bearer ([^'']+)')
    INTO segreto
    FROM cron.job
   WHERE jobname = 'daily-report'
   LIMIT 1;

  IF segreto IS NULL THEN
    RAISE EXCEPTION 'CRON_SECRET non trovato nel job daily-report. Fermati e chiedi.';
  END IF;

  -- via i vecchi, se per caso esistono gia'
  PERFORM cron.unschedule(jobname)
    FROM cron.job
   WHERE jobname IN ('recycle-pool-leads','ai-setter-dispatch',
                     'reconcile-leads','daily-snapshot','refresh-meta-token');

  PERFORM cron.schedule('recycle-pool-leads', '15 * * * *', format(
    'SELECT net.http_get(url := %L, headers := jsonb_build_object(''Authorization'', %L))',
    base || 'recycle-pool-leads', 'Bearer ' || segreto));

  PERFORM cron.schedule('ai-setter-dispatch', '0 9-19 * * 1-6', format(
    'SELECT net.http_get(url := %L, headers := jsonb_build_object(''Authorization'', %L))',
    base || 'ai-setter-dispatch', 'Bearer ' || segreto));

  PERFORM cron.schedule('reconcile-leads', '10 22 * * *', format(
    'SELECT net.http_get(url := %L, headers := jsonb_build_object(''Authorization'', %L))',
    base || 'reconcile-leads', 'Bearer ' || segreto));

  PERFORM cron.schedule('daily-snapshot', '55 21 * * *', format(
    'SELECT net.http_get(url := %L, headers := jsonb_build_object(''Authorization'', %L))',
    base || 'daily-snapshot', 'Bearer ' || segreto));

  PERFORM cron.schedule('refresh-meta-token', '0 8 1 */2 *', format(
    'SELECT net.http_get(url := %L, headers := jsonb_build_object(''Authorization'', %L))',
    base || 'refresh-meta-token', 'Bearer ' || segreto));
END $$;


-- ─────────── CONTROLLO ───────────
-- Devi vedere 9 job attivi: i 4 di prima + questi 5.

SELECT jobid, jobname, schedule, active
FROM cron.job
WHERE active
ORDER BY jobid;
