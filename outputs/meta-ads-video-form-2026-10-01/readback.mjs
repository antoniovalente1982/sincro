import fs from 'node:fs'; import path from 'node:path';
import { out, graph, save } from './meta-client.mjs';
const st = JSON.parse(fs.readFileSync(path.join(out, 'CREATED_OBJECTS.json')));
const cfg = JSON.parse(fs.readFileSync(path.join(out, 'CAMPAGNA.json')));
const camp = await graph(st.campaign.id, { fields: 'id,name,status,effective_status,objective,daily_budget,lifetime_budget,spend_cap,special_ad_categories' });
const adset = await graph(st.adset.id, { fields: 'id,name,status,effective_status,daily_budget,lifetime_budget,bid_strategy,optimization_goal,promoted_object,destination_type,start_time,end_time,attribution_spec,targeting,dsa_beneficiary' });
const ads = [];
for (const a of st.ads) ads.push(await graph(a.ad_id, { fields: 'id,name,status,effective_status,creative{id,object_story_spec,url_tags,degrees_of_freedom_spec}' }));
const checks = [];
const ok = (name, cond) => checks.push({ name, ok: !!cond });
ok('campagna OUTCOME_LEADS in pausa', camp.objective === 'OUTCOME_LEADS' && camp.status === 'PAUSED');
ok('budget 100€/giorno sull adset, nessun limite o fine', adset.daily_budget === '10000' && !adset.end_time && !camp.spend_cap && !adset.lifetime_budget);
ok('ottimizzazione Lead sul pixel 615', adset.optimization_goal === 'OFFSITE_CONVERSIONS' && adset.promoted_object?.pixel_id === '311586900940615' && adset.promoted_object?.custom_event_type === 'LEAD');
ok('partenza 1/10 00:01 Roma', adset.start_time === '2026-10-01T00:01:00+0200');
const fam = adset.targeting.flexible_spec.find(g => g.family_statuses)?.family_statuses.map(f => f.id).sort().join(',');
ok('gruppo genitori 9-26 presente', fam === ['6023005681983','6023005718983','6023080302983'].sort().join(','));
ok('4 gruppi in AND (imprenditori, lusso, calcio, genitori)', adset.targeting.flexible_spec.length === 4);
ok('età 38-60, italiano, 10 regioni', adset.targeting.age_min === 38 && adset.targeting.age_max === 60 && adset.targeting.locales?.[0] === 10 && adset.targeting.geo_locations.regions.length === 10);
for (const [i, a] of ads.entries()) {
  const c = cfg.ads[i], v = a.creative.object_story_spec?.video_data;
  ok(`${c.code} testo/titolo/link/CTA/pagina/IG`, v?.message === c.body && v?.title === c.headline && v?.call_to_action?.value?.link === cfg.destination_url && v?.call_to_action?.type === cfg.cta && a.creative.object_story_spec.page_id === cfg.page_id && a.creative.object_story_spec.instagram_user_id === cfg.instagram_user_id && a.creative.url_tags === cfg.url_tags && a.status === 'PAUSED' && a.name === c.ad_name);
}
save('READBACK_PAUSED.json', { read_at: new Date().toISOString(), campaign: camp, adset, ads, checks });
console.log(checks.map(c => (c.ok ? 'OK  ' : 'KO  ') + c.name).join('\n'));
console.log('instagram_positions', adset.targeting.instagram_positions.join(','), '| advantage_audience', adset.targeting.targeting_automation?.advantage_audience);
