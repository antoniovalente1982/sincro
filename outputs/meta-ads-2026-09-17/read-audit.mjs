import fs from 'node:fs';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// Read-only remote audit. Only aggregated, non-contact data is saved locally.
const cfg = dotenv.parse(fs.readFileSync('.env.local'));
const sb = createClient(cfg.NEXT_PUBLIC_SUPABASE_URL, cfg.SUPABASE_SERVICE_ROLE_KEY);
const org = 'a5dd4842-f0ea-4909-b4a3-be2cb1c6ffa5';
const funnel = 'bb4f12d9-4709-4ecf-9d1a-1a96c0960e46';
const campaign = '120251721514160047';
const campaignUtm = 'ms_genitori_nord_lazio_20260916';
const since = '2026-09-15T22:00:00Z';
const until = new Date().toISOString();
const unwrap = ({ data, error }) => { if (error) throw new Error(error.message); return data; };
async function rows(table, fields, filters = {}) {
  let all = [];
  for (let offset = 0; ; offset += 1000) {
    let q = sb.from(table).select(fields).eq('organization_id', org).gte('created_at', since).lte('created_at', until).order('created_at').range(offset, offset + 999);
    for (const [k, v] of Object.entries(filters)) q = q.eq(k, v);
    const data = unwrap(await q);
    all.push(...data);
    if (data.length < 1000) return all;
  }
}
const conn = unwrap(await sb.from('connections').select('credentials').eq('organization_id', org).eq('provider', 'meta_ads').eq('status', 'active').limit(1).single());
async function meta(path, params) {
  const url = 'https://graph.facebook.com/v21.0/' + path + '?' + new URLSearchParams(params);
  const res = await fetch(url, { headers: { Authorization: 'Bearer ' + conn.credentials.access_token } });
  const data = await res.json();
  if (data.error) return { error: { code: data.error.code, message: data.error.message } };
  return data.data || data;
}
const common = { time_range: JSON.stringify({ since: '2026-09-16', until: '2026-09-17' }), filtering: JSON.stringify([{ field: 'campaign.id', operator: 'EQUAL', value: campaign }]), limit: '500', use_account_attribution_setting: 'true' };
const tasks = {
  ads: meta('act_511099830249139/insights', { ...common, level: 'ad', fields: 'ad_id,ad_name,spend,impressions,reach,frequency,inline_link_clicks,inline_link_click_ctr,cost_per_inline_link_click,actions,outbound_clicks,video_p25_watched_actions,video_p50_watched_actions,video_p100_watched_actions,video_thruplay_watched_actions' }),
  placements: meta('act_511099830249139/insights', { ...common, level: 'campaign', breakdowns: 'publisher_platform,platform_position', fields: 'spend,impressions,inline_link_clicks,actions' }),
  campaign: meta(campaign, { fields: 'id,name,status,objective,daily_budget,created_time,start_time' }),
  adset: meta('120251721514170047', { fields: 'id,name,status,effective_status,optimization_goal,billing_event,promoted_object,targeting,start_time,attribution_spec' }),
  views: rows('page_views', 'created_at,page_variant,visitor_id,utm_source,utm_campaign,utm_content,device_type,user_agent', { funnel_id: funnel }),
  submissions: rows('funnel_submissions', 'created_at,page_variant,utm_source,utm_campaign,utm_content', { funnel_id: funnel }),
  events: rows('tracked_events', 'created_at,event_name,event_params,sent_to_provider,provider_response'),
};
const fetched = {};
await Promise.allSettled(Object.entries(tasks).map(async ([key, promise]) => {
  try { fetched[key] = await promise; } catch (e) { fetched[key] = { error: e.message }; }
}));
const bot = /bot|crawler|spider|facebookexternalhit|WhatsApp|Lighthouse|headless|PhantomJS|Selenium|puppeteer|prerender/i;
function group(data, key) {
  const map = {};
  for (const row of data) { const k = key(row); (map[k] ||= []).push(row); }
  return map;
}
function viewSummary(data) {
  return Object.fromEntries(Object.entries(group(data, r => [r.utm_campaign || '(none)', r.utm_content || '(none)', r.page_variant, r.device_type].join(' | '))).map(([key, v]) => [key, { views: v.length, visitor_ids: new Set(v.map(r => r.visitor_id).filter(Boolean)).size, missing_visitor_id: v.filter(r => !r.visitor_id).length, first: v[0].created_at, last: v.at(-1).created_at }]));
}
const result = { fetched_at: until, database_since: since, ads: fetched.ads, placements: fetched.placements, campaign: fetched.campaign, adset: fetched.adset };
if (Array.isArray(fetched.views)) {
  result.pageviews = { total: fetched.views.length, excluding_recognized_bots: fetched.views.filter(r => !bot.test(r.user_agent || '')).length, summary: viewSummary(fetched.views.filter(r => !bot.test(r.user_agent || ''))) };
  const paid = fetched.views.filter(r => r.utm_campaign === campaignUtm);
  result.new_campaign_views = { total: paid.length, recognized_bots: paid.filter(r => bot.test(r.user_agent || '')).length, visitor_ids: new Set(paid.map(r => r.visitor_id).filter(Boolean)).size, summary: viewSummary(paid.filter(r => !bot.test(r.user_agent || ''))), hourly: Object.fromEntries(Object.entries(group(paid,r=>r.created_at.slice(0,13))).map(([k,v])=>[k,v.length])) };
} else result.pageviews = fetched.views;
result.submissions = fetched.submissions;
if (Array.isArray(fetched.events)) {
  result.events = Object.fromEntries(Object.entries(group(fetched.events, r => [r.event_name, r.event_params?.pixel_id, r.sent_to_provider].join(' | '))).map(([key, rows]) => [key, { count: rows.length, last: rows.at(-1).created_at, errors: [...new Set(rows.filter(r => !r.sent_to_provider).map(r => r.provider_response?.error?.message || 'unspecified'))] }]));
} else result.events = fetched.events;
fs.writeFileSync('outputs/meta-ads-2026-09-17/dati-verificati.json', JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
