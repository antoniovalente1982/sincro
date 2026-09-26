import fs from 'node:fs';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

const copy = JSON.parse(fs.readFileSync('lib/salto-categoria-copy.json'));
const cfg = dotenv.parse(fs.readFileSync('.env.local'));
const sb = createClient(cfg.NEXT_PUBLIC_SUPABASE_URL, cfg.SUPABASE_SERVICE_ROLE_KEY);
const id = 'bb4f12d9-4709-4ecf-9d1a-1a96c0960e46';
const org = 'a5dd4842-f0ea-4909-b4a3-be2cb1c6ffa5';
const unwrap = ({ data, error }) => { if (error) throw new Error(error.message); return data; };
const query = () => sb.from('funnels').select('id,slug,status,settings,updated_at').eq('id', id).eq('organization_id', org).eq('slug', 'salto-di-qualita').single();
const before = unwrap(await query());
const baseline = JSON.parse(fs.readFileSync('outputs/meta-ads-2026-09-17/message-alignment-before.json')).funnel;
if (before.status !== 'active' || !before.settings.direct_consultation_form || before.settings.ab_test_active !== false) throw new Error('Unexpected funnel configuration.');
if (before.settings.messaging_theme !== copy.theme) {
  if (JSON.stringify(before.settings) !== JSON.stringify(baseline.settings)) throw new Error('Funnel changed since review; aborting.');
  const changedAt = new Date().toISOString();
  const settings = { ...before.settings,
    messaging_theme: copy.theme, headline: copy.headline_html, subheadline: copy.subheadline_html,
    cta_text: copy.cta, conversion_revision: 'salto-categoria-20260917', conversion_revision_started_at: changedAt,
  };
  const updated = unwrap(await sb.from('funnels').update({ settings, updated_at: changedAt }).eq('id', id).eq('organization_id', org).eq('updated_at', before.updated_at).eq('settings', JSON.stringify(before.settings)).select('id'));
  if (updated.length !== 1) throw new Error('Concurrent change detected; nothing overwritten.');
}
const after = unwrap(await query());
if (after.settings.messaging_theme !== copy.theme || after.settings.headline !== copy.headline_html || after.settings.subheadline !== copy.subheadline_html || after.settings.cta_text !== copy.cta) throw new Error('Verification failed.');
fs.writeFileSync('outputs/meta-ads-2026-09-17/message-alignment-landing-after.json', JSON.stringify(after, null, 2));
console.log(JSON.stringify({ slug: after.slug, headline: copy.headline, theme: after.settings.messaging_theme, cta: after.settings.cta_text, changed_at: after.settings.conversion_revision_started_at }));
