import { account, graph, save } from './meta-client.mjs';
const acc = await graph(account, { fields: 'name,currency,timezone_name,account_status,amount_spent' });
const camps = await graph(account + '/campaigns', { fields: 'id,name,status,effective_status,objective,daily_budget,lifetime_budget,bid_strategy,special_ad_categories,buying_type,created_time', limit: 200 });
const match = camps.data.filter(c => /settembre 2026/i.test(c.name));
const out = { read_at: new Date().toISOString(), account: acc, matching_campaigns: match, all_campaign_names: camps.data.map(c => `${c.id} | ${c.effective_status} | ${c.name}`) };
for (const c of match) {
  c.adsets = (await graph(c.id + '/adsets', { fields: 'id,name,status,effective_status,optimization_goal,billing_event,bid_strategy,daily_budget,promoted_object,destination_type,attribution_spec,targeting,start_time,end_time,dsa_beneficiary,dsa_payor', limit: 50 })).data;
  c.ads = (await graph(c.id + '/ads', { fields: 'id,name,effective_status,creative{id,object_story_spec,url_tags,asset_feed_spec,degrees_of_freedom_spec}', limit: 50 })).data;
}
save('SOURCE_CAMPAIGN_READ.json', out);
console.log(JSON.stringify({ account: acc, campaigns: out.all_campaign_names.slice(0, 40), matched: match.map(c => ({ id: c.id, name: c.name, status: c.effective_status, objective: c.objective, daily_budget: c.daily_budget, adsets: c.adsets.map(a => ({ id: a.id, name: a.name, status: a.effective_status, opt: a.optimization_goal, promoted: a.promoted_object, budget: a.daily_budget })) })) }, null, 1));
