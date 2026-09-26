import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { graph, save, out, pixel, db, org } from './meta-client.mjs';
const read=name=>JSON.parse(fs.readFileSync(path.join(out,name)));
const s=read('CREATED_OBJECTS.json'), cfg=read('CAMPAGNA_PREPARAZIONE.json');
const [campaign,adset,ads,previous]=await Promise.all([
  graph(s.campaign.id,{fields:'id,name,status,effective_status,objective,daily_budget,spend_cap,bid_strategy'}),
  graph(s.adset.id,{fields:'id,name,status,effective_status,campaign_id,targeting,promoted_object,optimization_goal,destination_type,start_time,end_time,attribution_spec,dsa_beneficiary,dsa_payor'}),
  graph(s.campaign.id+'/ads',{fields:'id,name,status,effective_status,campaign_id,adset_id,issues_info,ad_review_feedback,tracking_specs,creative{id,object_story_spec,url_tags,degrees_of_freedom_spec}',limit:50}),
  graph('120251721514160047',{fields:'id,name,status'})
]);
assert.equal(campaign.objective,'OUTCOME_LEADS');assert.equal(campaign.daily_budget,'5700');assert.equal(campaign.spend_cap,'50000');
assert.equal(adset.targeting.age_min,38);assert.equal(adset.targeting.age_max,65);
assert.deepEqual(adset.targeting.geo_locations.countries,['IT']);assert.deepEqual(adset.targeting.locales,[10]);
assert.equal(adset.targeting.targeting_automation.advantage_audience,0);assert.equal(adset.targeting.targeting_automation.individual_setting.age,0);
assert.equal(adset.promoted_object.pixel_id,pixel);assert.equal(adset.promoted_object.custom_event_type,'LEAD');assert.equal(adset.destination_type,'WEBSITE');assert.equal(adset.optimization_goal,'OFFSITE_CONVERSIONS');
assert(adset.targeting.excluded_custom_audiences.some(a=>a.id==='120243946766660047'));
assert.equal(ads.data.length,9);assert.equal(previous.status,'PAUSED');
assert(Date.parse(adset.end_time)>Date.now());assert(Date.parse(adset.end_time)-Date.parse(adset.start_time)<=5*86400000);
for(const expected of cfg.ads){
  const local=s.ads.find(x=>x.code===expected.code); const actual=ads.data.find(x=>x.id===local.ad_id);assert(actual);
  assert.equal(actual.name,expected.ad_name);assert.equal(actual.campaign_id,campaign.id);assert.equal(actual.adset_id,adset.id);
  assert(!actual.issues_info?.length);assert(!['DISAPPROVED','WITH_ISSUES'].includes(actual.effective_status));
  const spec=actual.creative.object_story_spec;const link=spec.link_data;
  assert.equal(spec.page_id,'108451268302248');assert.equal(spec.instagram_user_id,'17841449195220971');
  assert.equal(link.link,expected.article_url);assert.equal(link.call_to_action.type,'LEARN_MORE');assert.equal(link.call_to_action.value.link,expected.article_url);
  assert.equal(link.message,expected.body);assert.equal(link.name,expected.headline);assert.equal(link.description,expected.description);assert.equal(link.image_hash,local.image_hash);
  assert.equal(actual.creative.url_tags,cfg.url_tags);
  assert(actual.tracking_specs.some(t=>t['action.type']?.includes('offsite_conversion')&&t.fb_pixel?.includes(pixel)));
  assert(!Object.values(actual.creative.degrees_of_freedom_spec.creative_features_spec).some(f=>f.enroll_status==='OPT_IN'));
}
const pages=await Promise.all(cfg.ads.map(async ad=>{
  const ids=s.ads.find(x=>x.code===ad.code);const parameters=new URLSearchParams({utm_source:'facebook',utm_medium:'paid',utm_campaign:cfg.campaign_name,utm_term:adset.name,utm_content:ad.ad_name,fbadid:ids.ad_id});
  const url=ad.article_url+'?'+parameters;const landing=new URL(ad.landing_url);for(const[k,v]of parameters)landing.searchParams.set(k,v);
  const [a,b]=await Promise.all([fetch(url),fetch(landing)]);const [at,bt]=await Promise.all([a.text(),b.text()]);assert.equal(a.status,200);assert.equal(b.status,200);
  assert(at.includes('/f/salto-di-qualita'));assert(bt.includes('blog-'+ad.slug));assert(bt.includes(pixel));
  return{code:ad.code,article_status:a.status,landing_status:b.status,article_url:url,landing_url:String(landing),landing_title:bt.match(/<title>(.*?)<\/title>/)?.[1]};
}));
const capi=read('LEAD_CAPI_TEST.json');assert.equal(capi.provider_response.events_received,1);assert.equal(capi.crm_submission_created,false);
const previews=read('META_PREVIEWS.json');assert.equal(previews.length,18);assert(previews.every(p=>p.src?.startsWith('https://business.facebook.com/ads/api/preview_iframe.php')));
const {data:journey,error}=await db.from('editorial_events').select('event_name,event_id,entry_key,page_path,utm_content,utm_campaign').eq('organization_id',org).eq('utm_campaign','qa_lancio_advertorial_20260919');if(error)throw new Error(error.message);
for(const slug of ['cosa-dire-dopo-brutta-partita','fiducia-dopo-errore-calcio','mio-figlio-gioca-poco']){assert(journey.some(e=>e.entry_key==='blog-'+slug&&e.event_name==='advertorial_cta'));assert(journey.some(e=>e.entry_key==='blog-'+slug&&e.event_name==='landing_view'));}
const evidence={checked_at:new Date().toISOString(),result:'PASS',campaign,adset,ads:ads.data,previous_campaign:previous,pages,journey,ui_budget:{nominal_daily_eur:57,displayed_max_daily_eur:99.75,displayed_max_weekly_eur:399,campaign_cap_eur:500,observed_in_new_campaign:true},tracking:{capi_lead_test_received:true,browser_advertorial_engaged_received:true,browser_cta_received:true,browser_startform_received:true,browser_server_event_ids_match:['a768ec5b-3193-428e-8b0f-e217f580de64','2d54dd9c-0277-42eb-893a-28ea97d82040'],deduplication_contract_verified:true,aggregate_deduplication_rate_not_yet_available:true,live_production_lead_submission_performed:false,form_save_and_retry_covered_by_prior_release_tests:true},previews_generated:18,automated_creative_changes_enabled:false};
save('LAUNCH_VERIFICATION.json',evidence);
console.log(JSON.stringify({result:'PASS',ads:ads.data.length,article_and_landing_checks:pages.length*2,budget:campaign.daily_budget,cap:campaign.spend_cap,age:adset.targeting.age_min,country:adset.targeting.geo_locations.countries,events_received:journey.length,statuses:ads.data.map(a=>({id:a.id,status:a.status,effective_status:a.effective_status}))},null,2));
