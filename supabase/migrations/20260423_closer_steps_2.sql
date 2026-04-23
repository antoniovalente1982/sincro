-- Add closer tracking fields mirroring the spreadsheet
ALTER TABLE leads ADD COLUMN IF NOT EXISTS closer_appt_status TEXT DEFAULT NULL;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS closer_trial_status TEXT DEFAULT NULL;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS closer_outcome TEXT DEFAULT NULL;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS closer_downsell TEXT DEFAULT NULL;

-- Automatically grant permissions to update these fields
-- Assuming existing RLS allows update of leads for authorized users.
