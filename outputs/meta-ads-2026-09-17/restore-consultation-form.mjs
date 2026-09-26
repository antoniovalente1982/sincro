import fs from 'node:fs';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// Requested by Antonio: restore the direct free-consultation form on this funnel only.
const cfg = dotenv.parse(fs.readFileSync('.env.local'));
const sb = createClient(cfg.NEXT_PUBLIC_SUPABASE_URL, cfg.SUPABASE_SERVICE_ROLE_KEY);
const id = 'bb4f12d9-4709-4ecf-9d1a-1a96c0960e46';
const organizationId = 'a5dd4842-f0ea-4909-b4a3-be2cb1c6ffa5';
const query = () => sb.from('funnels').select('id,slug,status,settings,updated_at').eq('id', id).eq('organization_id', organizationId).eq('slug', 'salto-di-qualita').single();
const { data: before, error } = await query();
if (error) throw new Error(error.message);
if (before.status !== 'active') throw new Error('Funnel is no longer active; aborting.');
const backup = 'outputs/meta-ads-2026-09-17/settings-before-direct-consultation.json';
if (!fs.existsSync(backup)) fs.writeFileSync(backup, JSON.stringify(before, null, 2));
if (before.settings.direct_consultation_form !== true || before.settings.ab_test_active !== false || before.settings.ab_variant !== 'A') {
  const changedAt = new Date().toISOString();
  const settings = {
    ...before.settings,
    direct_consultation_form: true,
    ab_test_active: false,
    ab_variant: 'A',
    cta_text: 'Prenota una consulenza gratuita',
    conversion_revision: 'direct-consultation-20260917',
    conversion_revision_started_at: changedAt,
  };
  const { data, error: updateError } = await sb.from('funnels')
    .update({ settings, updated_at: changedAt })
    .eq('id', id).eq('organization_id', organizationId).eq('slug', before.slug)
    .eq('updated_at', before.updated_at).eq('settings', JSON.stringify(before.settings))
    .select('id');
  if (updateError) throw new Error(updateError.message);
  if (data.length !== 1) throw new Error('Concurrent edit detected; nothing overwritten.');
}
const { data: after, error: verifyError } = await query();
if (verifyError) throw new Error(verifyError.message);
if (!after.settings.direct_consultation_form || after.settings.ab_test_active !== false || after.settings.ab_variant !== 'A') throw new Error('Verification failed.');
fs.writeFileSync('outputs/meta-ads-2026-09-17/settings-after-direct-consultation.json', JSON.stringify(after, null, 2));
console.log(JSON.stringify({ slug: after.slug, direct_form: after.settings.direct_consultation_form, ab_test_active: after.settings.ab_test_active, variant: after.settings.ab_variant, cta: after.settings.cta_text, changed_at: after.settings.conversion_revision_started_at }));
