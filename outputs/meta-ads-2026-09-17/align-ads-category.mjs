import fs from 'node:fs';
import { isDeepStrictEqual } from 'node:util';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// Scope: copy of the four existing video ads; no campaign/adset/status mutations.
const dir = 'outputs/meta-ads-2026-09-17/';
const read = path => JSON.parse(fs.readFileSync(path));
const baseline = read(dir + 'message-alignment-before.json');
const copy = read('lib/salto-categoria-copy.json');
const messages = read(dir + 'salto-categoria-annunci.json');
const mode = process.argv[2];
if (!['stage', 'apply', 'verify'].includes(mode)) throw new Error('Use stage, apply or verify.');
const cfg = dotenv.parse(fs.readFileSync('.env.local'));
const sb = createClient(cfg.NEXT_PUBLIC_SUPABASE_URL, cfg.SUPABASE_SERVICE_ROLE_KEY);
const unwrap = ({ data, error }) => { if (error) throw new Error(error.message); return data; };
const conn = unwrap(await sb.from('connections').select('credentials').eq('organization_id', 'a5dd4842-f0ea-4909-b4a3-be2cb1c6ffa5').eq('provider', 'meta_ads').eq('status', 'active').limit(1).single());
async function meta(path, params = {}, method = 'GET') {
  const encoded = new URLSearchParams(Object.entries(params).map(([key, value]) => [key, typeof value === 'string' ? value : JSON.stringify(value)]));
  const url = 'https://graph.facebook.com/v21.0/' + path + (method === 'GET' ? '?' + encoded : '');
  const res = await fetch(url, { method, headers: { Authorization: 'Bearer ' + conn.credentials.access_token }, ...(method === 'POST' ? { body: encoded } : {}) });
  const data = await res.json();
  if (data.error) throw new Error(JSON.stringify({ path, error: data.error }));
  return data;
}
const campaignId = '120251721514160047';
const adsetId = '120251721514170047';
const adFields = 'id,name,status,effective_status,campaign_id,adset_id,creative{id,object_story_spec,url_tags,degrees_of_freedom_spec},tracking_specs';
const creativeFields = 'id,object_story_spec,url_tags,degrees_of_freedom_spec';
const stateFile = dir + 'message-alignment-ads-state.json';
const state = fs.existsSync(stateFile) ? read(stateFile) : { started_at: new Date().toISOString(), ads: {} };
const save = () => fs.writeFileSync(stateFile, JSON.stringify(state, null, 2));
const [campaign, adset] = await Promise.all([
  meta(campaignId, { fields: 'id,name,status,daily_budget,objective' }),
  meta(adsetId, { fields: 'id,name,status,optimization_goal,promoted_object,targeting,attribution_spec' }),
]);
if (!state.campaign_before) { state.campaign_before = campaign; state.adset_before = adset; save(); }
if (!isDeepStrictEqual(campaign, state.campaign_before) || !isDeepStrictEqual(adset, state.adset_before)) throw new Error('Campaign or adset changed since review; aborting.');

function payloadFor(ad) {
  const spec = structuredClone(ad.creative.object_story_spec);
  spec.video_data.title = copy.headline;
  spec.video_data.message = messages[ad.id];
  spec.video_data.link_description = copy.cta + '. Percorso individuale online.';
  // Keep the exact existing thumbnail via its image hash.
  if (spec.video_data.image_hash) delete spec.video_data.image_url;
  const freedom = structuredClone(ad.creative.degrees_of_freedom_spec);
  // Meta returns this legacy aggregate on reads but rejects it on writes (3858504).
  delete freedom.creative_features_spec.standard_enhancements;
  for (const key of ['text_optimizations', 'show_destination_blurbs', 'enhance_cta']) {
    freedom.creative_features_spec[key] = { enroll_status: 'OPT_OUT' };
  }
  return { name: `${ad.name} | Salto categoria | 17.09.2026`, object_story_spec: spec, url_tags: ad.creative.url_tags, degrees_of_freedom_spec: freedom };
}
function verifyCreative(creative, ad) {
  const expected = payloadFor(ad);
  const actualSpec = structuredClone(creative.object_story_spec);
  if (actualSpec.video_data.image_hash) delete actualSpec.video_data.image_url;
  if (!isDeepStrictEqual(actualSpec, expected.object_story_spec) || creative.url_tags !== expected.url_tags) throw new Error('Creative verification failed for ' + ad.id);
  for (const key of ['text_optimizations', 'show_destination_blurbs', 'enhance_cta']) {
    if (creative.degrees_of_freedom_spec?.creative_features_spec?.[key]?.enroll_status !== 'OPT_OUT') throw new Error('Automatic copy variation still enabled: ' + key);
  }
}
const ads = baseline.ads.sort((a, b) => a.id.localeCompare(b.id));
if (ads.length !== 4 || !ads.every(ad => messages[ad.id] && ad.campaign_id === campaignId && ad.adset_id === adsetId)) throw new Error('Unexpected ad scope.');
fs.writeFileSync(dir + 'message-alignment-ads-payloads.json', JSON.stringify(ads.map(ad => ({ ad_id: ad.id, ...payloadFor(ad) })), null, 2));

if (mode === 'apply') {
  const funnel = unwrap(await sb.from('funnels').select('settings').eq('id', baseline.funnel.id).single());
  if (funnel.settings.messaging_theme !== copy.theme) throw new Error('Landing is not aligned yet.');
  const live = await (await fetch('https://landing.metodosincro.com/f/salto-di-qualita')).text();
  if (!live.includes('Aiutalo a fare il salto di categoria | Metodo Sincro')) throw new Error('New landing deployment is not live yet.');
  if (!ads.every(ad => state.ads[ad.id]?.creative_id)) throw new Error('Stage all four creatives first.');
}

for (const ad of ads) {
  const current = await meta(ad.id, { fields: adFields });
  const entry = state.ads[ad.id] ||= {};
  if (current.name !== ad.name || current.status !== ad.status || current.adset_id !== adsetId || current.campaign_id !== campaignId) throw new Error('Ad changed since review: ' + ad.id);
  if (![ad.creative.id, entry.creative_id].filter(Boolean).includes(current.creative.id)) throw new Error('Creative changed concurrently: ' + ad.id);
  if (mode === 'stage') {
    if (!entry.creative_id) {
      const created = await meta('act_511099830249139/adcreatives', payloadFor(ad), 'POST');
      if (!created.id) throw new Error('No creative ID returned.');
      entry.creative_id = created.id;
      entry.previous_creative_id = ad.creative.id;
      entry.created_at = new Date().toISOString();
      save();
    }
    verifyCreative(await meta(entry.creative_id, { fields: creativeFields }), ad);
    entry.verified_at = new Date().toISOString();
    save();
    console.log(JSON.stringify({ ad_id: ad.id, staged_creative_id: entry.creative_id, headline: copy.headline, video_id: ad.creative.object_story_spec.video_data.video_id }));
  } else {
    if (mode === 'apply' && current.creative.id !== entry.creative_id) {
      verifyCreative(await meta(entry.creative_id, { fields: creativeFields }), ad);
      await meta(ad.id, { creative: { creative_id: entry.creative_id } }, 'POST');
      entry.applied_at = new Date().toISOString();
      save();
    }
    const after = await meta(ad.id, { fields: adFields });
    verifyCreative(after.creative, ad);
    if (after.status !== ad.status || after.creative.id !== entry.creative_id) throw new Error('Ad verification failed: ' + ad.id);
    if (!after.tracking_specs.some(t => t.fb_pixel?.includes('311586900940615'))) throw new Error('Lead pixel missing.');
    entry.after = after;
    save();
    console.log(JSON.stringify({ ad_id: ad.id, status: after.status, effective_status: after.effective_status, headline: after.creative.object_story_spec.video_data.title, creative_id: after.creative.id }));
  }
}
if (mode !== 'stage') {
  const campaignAfter = await meta(campaignId, { fields: 'id,name,status,daily_budget,objective' });
  const adsetAfter = await meta(adsetId, { fields: 'id,name,status,optimization_goal,promoted_object,targeting,attribution_spec' });
  if (!isDeepStrictEqual(campaignAfter, state.campaign_before) || !isDeepStrictEqual(adsetAfter, state.adset_before)) throw new Error('Campaign/adset verification failed.');
  state.verified_at = new Date().toISOString(); save();
  console.log(JSON.stringify({ verified_at: state.verified_at, campaign_budget_unchanged: true, adset_unchanged: true }));
}
