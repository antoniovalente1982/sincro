import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { out, account, pixel, org, db, graph, save } from './meta-client.mjs';
const cfg=JSON.parse(fs.readFileSync(path.join(out,'CAMPAGNA_PREPARAZIONE.json')));
const statePath=path.join(out,'CREATED_OBJECTS.json');
const state=fs.existsSync(statePath)?JSON.parse(fs.readFileSync(statePath)):{created_at:new Date().toISOString(),campaign:null,adset:null,ads:[]};
const persist=()=>save('CREATED_OBJECTS.json',state);
const fixedCreativeFeatures=Object.fromEntries(['advantage_plus_creative','adapt_to_placement','add_text_overlay','audio','description_automation','dynamic_cta_text','enhance_cta','image_animation','image_auto_crop','image_background_gen','image_brightness_and_contrast','image_enhancement','image_templates','image_text_translation','image_touchups','image_uncrop','inline_comment','media_type_automation','product_browsing','product_extensions','site_extensions','text_generation','text_optimizations','text_translation'].map(key=>[key,{enroll_status:'OPT_OUT'}]));
assert.equal(cfg.ads.length,9);assert.equal(cfg.user_daily_amount_eur,100);
const {data:tags,error}=await db.from('funnel_routing_engine').select('trigger_keyword').in('trigger_keyword',['emotional','blocchi','mental_coaching']);
if(error)throw new Error(error.message);
for(const ad of cfg.ads){assert(tags.some(t=>t.trigger_keyword===ad.trigger));assert(ad.ad_name.endsWith('T: '+ad.trigger));assert(fs.existsSync(path.join(out,ad.asset_path)));}
if(!state.campaign){
  const existing=await graph(account+'/campaigns',{fields:'id,name,status',limit:100});
  assert(!existing.data.some(c=>c.name===cfg.campaign_name),'Matching campaign exists; inspect before creation');
  const payload={name:cfg.campaign_name,objective:'OUTCOME_LEADS',buying_type:'AUCTION',status:'PAUSED',special_ad_categories:[],daily_budget:5700,bid_strategy:'LOWEST_COST_WITHOUT_CAP',spend_cap:50000};
  state.campaign={...await graph(account+'/campaigns',payload,'POST'),requested:payload};persist();console.log('campaign created paused',state.campaign.id);
}
if(!state.adset){
  const payload={name:'IT | 38+ | Genitori | 3 Advertorial 9 Creativita | Lead 615',campaign_id:state.campaign.id,status:'PAUSED',billing_event:'IMPRESSIONS',optimization_goal:'OFFSITE_CONVERSIONS',destination_type:'WEBSITE',promoted_object:{pixel_id:pixel,custom_event_type:'LEAD'},start_time:new Date().toISOString(),end_time:new Date(Date.now()+5*86400000).toISOString(),dsa_beneficiary:'Antonio Valente',dsa_payor:'Antonio Valente',attribution_spec:[{event_type:'CLICK_THROUGH',window_days:7},{event_type:'VIEW_THROUGH',window_days:1}],targeting:{age_min:38,age_max:65,locales:[10],geo_locations:{countries:['IT']},flexible_spec:[{family_statuses:[{id:'6023005681983'},{id:'6023005718983'}]}],targeting_automation:{advantage_audience:0,individual_setting:{age:0,gender:1,geo:0}},publisher_platforms:['facebook','instagram'],facebook_positions:['feed'],instagram_positions:['stream']}};
  state.adset={...await graph(account+'/adsets',payload,'POST'),requested:payload};persist();console.log('adset created paused',state.adset.id);
}
for(const ad of cfg.ads){
  let item=state.ads.find(x=>x.code===ad.code);if(!item){item={code:ad.code};state.ads.push(item);persist();}
  if(!item.image_hash){const data=await graph(account+'/adimages',{name:ad.code+'-advertorial-2026-09-19.png',bytes:fs.readFileSync(path.join(out,ad.asset_path)).toString('base64')},'POST');item.image_hash=Object.values(data.images)[0].hash;persist();console.log('image uploaded',ad.code);}
  if(!item.creative_id){
    const payload={name:'MS Advertorial '+ad.code+' '+ad.creative_title,object_story_spec:{page_id:'108451268302248',instagram_user_id:'17841449195220971',link_data:{link:ad.article_url,message:ad.body,name:ad.headline,description:ad.description,image_hash:item.image_hash,caption:'landing.metodosincro.com',call_to_action:{type:'LEARN_MORE',value:{link:ad.article_url}}}},url_tags:cfg.url_tags,degrees_of_freedom_spec:{creative_features_spec:fixedCreativeFeatures}};
    const result=await graph(account+'/adcreatives',payload,'POST');item.creative_id=result.id;item.creative_requested=payload;persist();console.log('creative created',ad.code,result.id);
  }
  if(!item.ad_id){const payload={name:ad.ad_name,adset_id:state.adset.id,status:'PAUSED',creative:{creative_id:item.creative_id},tracking_specs:[{'action.type':['offsite_conversion'],fb_pixel:[pixel]}]};const result=await graph(account+'/ads',payload,'POST');item.ad_id=result.id;persist();console.log('ad created paused',ad.code,result.id);}
}
state.completed_at=new Date().toISOString();persist();
console.log('COMPLETE: campaign and adset PAUSED, 9 ads PAUSED');
