-- Setter workflow fields: replicating Google Sheet "Leads (social)" columns
-- Col G: CHIAMATO → setter_step
-- Col I: TRY ANTHON → try_anthon  
-- Col L: ESITO → esito

ALTER TABLE leads ADD COLUMN IF NOT EXISTS setter_step TEXT DEFAULT NULL;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS try_anthon TEXT DEFAULT NULL;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS esito TEXT DEFAULT NULL;
