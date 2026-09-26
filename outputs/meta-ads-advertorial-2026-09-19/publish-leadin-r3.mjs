import fs from 'node:fs';
import assert from 'node:assert/strict';
import {graph,save,out,account,pixel} from './meta-client.mjs';
const rev=JSON.parse(fs.readFileSync(out+'/COPY_REVISION_R3.json'));
const before=JSON.parse(fs.readFileSync(out+'/LEADIN_R3_BEFORE.json'));
const currentAdsetBaseline=JSON.parse(fs.readFileSync(out+'/LEADIN_R3_ADSET_CURRENT_BASELINE.json')).adset;
before.adset=currentAdsetBaseline;
const ledgerPath=out+'/LEADIN_R3_LEDGER.json';
const ledger=fs.existsSync(ledgerPath)?JSON.parse(fs.readFileSync(ledgerPath)):{revision:'R3',started_at:new Date().toISOString(),ads:[]};
const persist=()=>save('LEADIN_R3_LEDGER.json',ledger);
const mode=process.argv[2];
const authorization=JSON.parse(fs.readFileSync(out+'/LEADIN_R3_AUTHORIZATION.json'));
assert.equal(authorization.testimonial_usage_confirmation.status,'CONFIRMED_BY_USER');
assert.equal(authorization.testimonial_usage_confirmation.answer,'Sì, per tutte e tre');
assert.equal(rev.revision,'R3');
assert(rev.ads.every(a=>before.routing.some(t=>t.trigger_keyword===a.trigger)));
for(const group of Object.keys(rev.groups)){
 const rows=rev.ads.filter(a=>a.code.startsWith(group+'-'));
 assert.equal(rows.length,3);assert.equal(new Set(rows.map(a=>a.hook)).size,3);
 for(const key of ['shared_body','headline','description','meta_image_hash','article_url','landing_url','cta'])assert.equal(new Set(rows.map(a=>a[key])).size,1);
 for(const a of rows)assert.equal(a.body,a.hook+'\n\n'+a.shared_body);
} 
const features=Object.fromEntries(['advantage_plus_creative','adapt_to_placement','add_text_overlay','audio','description_automation','dynamic_cta_text','enhance_cta','image_animation','image_auto_crop','image_background_gen','image_brightness_and_contrast','image_enhancement','image_templates','image_text_translation','image_touchups','image_uncrop','inline_comment','media_type_automation','product_browsing','product_extensions','site_extensions','text_generation','text_optimizations','text_translation'].map(k=>[k,{enroll_status:'OPT_OUT'}]));
function verifyCreative(a,c){
 const l=c.object_story_spec.link_data;
 assert.equal(l.message,a.body);assert.equal(l.name,a.headline);assert.equal(l.description,a.description);assert.equal(l.link,a.article_url);assert.equal(l.image_hash,a.meta_image_hash);assert.equal(l.call_to_action.type,'LEARN_MORE');assert.equal(l.call_to_action.value.link,a.article_url);assert.equal(c.url_tags,rev.url_tags);assert.equal(c.object_story_spec.page_id,'108451268302248');assert.equal(c.object_story_spec.instagram_user_id,'17841449195220971');
 const actual=c.degrees_of_freedom_spec?.creative_features_spec||{};
 for(const k of ['text_generation','text_optimizations','text_translation','image_animation','image_templates'])assert.equal(actual[k]?.enroll_status,'OPT_OUT');
 assert(!Object.values(actual).some(f=>f.enroll_status==='OPT_IN'));
}
function verifyTracking(current,previous){
 const normalize=rows=>rows.map(row=>JSON.stringify(Object.fromEntries(Object.entries(row).filter(([k])=>k!=='post').sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>[k,Array.isArray(v)?[...v].sort():v])))).sort();
 assert.deepEqual(normalize(current.tracking_specs),normalize(previous.tracking_specs));
 const story=current.creative.effective_object_story_id;
 assert(story?.startsWith('108451268302248_'),'Expected published story on the correct Facebook Page');
 const post=story.split('_').at(-1);
 for(const spec of current.tracking_specs)if(spec.post)assert(spec.post.every(id=>id===post),'Post tracking must point to the newly assigned creative story');
 const conversions=current.tracking_specs.filter(x=>x['action.type']?.includes('offsite_conversion'));
 assert(conversions.length>0&&conversions.every(x=>x.fb_pixel?.includes(pixel)));
}
assert.equal(rev.ads.length,9);
if(mode==='prepare'){
 for(const a of rev.ads){
  let item=ledger.ads.find(i=>i.ad_id===a.meta_ad_id);
  if(!item){item={code:a.code,ad_id:a.meta_ad_id,previous_creative_id:a.previous_creative_id};ledger.ads.push(item);persist();}
  if(!item.new_creative_id){
   const payload={name:'MS R3 '+a.code+' confronto incipit',object_story_spec:{page_id:'108451268302248',instagram_user_id:'17841449195220971',link_data:{link:a.article_url,message:a.body,name:a.headline,description:a.description,image_hash:a.meta_image_hash,caption:'landing.metodosincro.com',call_to_action:{type:'LEARN_MORE',value:{link:a.article_url}}}},url_tags:rev.url_tags,degrees_of_freedom_spec:{creative_features_spec:features}};
   const created=await graph(account+'/adcreatives',payload,'POST');item.new_creative_id=created.id;item.requested=payload;persist();console.log('Prepared',a.code,created.id);
  }
  item.readback=await graph(item.new_creative_id,{fields:'id,name,object_story_spec,url_tags,degrees_of_freedom_spec'});verifyCreative(a,item.readback);item.verified=true;persist();
  if(!item.previews){item.previews={};for(const format of ['DESKTOP_FEED_STANDARD','INSTAGRAM_STANDARD']){const p=await graph(item.new_creative_id+'/previews',{ad_format:format});assert(p.data?.[0]?.body);item.previews[format]=p.data[0].body;}persist();}
 }
 ledger.status='PREPARED_VERIFIED_NOT_APPLIED';persist();console.log(ledger.status);
}else if(mode==='apply'){
 assert.equal(ledger.ads.length,9);assert(ledger.ads.every(x=>x.verified&&x.previews));
 const [campaign,adset]=await Promise.all([graph(rev.campaign_id,{fields:'id,status,daily_budget,spend_cap,stop_time'}),graph(rev.adset_id,{fields:'id,status,end_time,targeting,promoted_object'})]);
 assert.equal(campaign.daily_budget,'10000');assert(!campaign.spend_cap);assert(!campaign.stop_time);assert.equal(campaign.status,'ACTIVE');assert.equal(adset.status,'ACTIVE');assert(!adset.end_time);assert.deepEqual(adset.targeting,before.adset.targeting);assert.deepEqual(adset.promoted_object,before.adset.promoted_object);
 for(const a of rev.ads){const item=ledger.ads.find(i=>i.ad_id===a.meta_ad_id);const actual=await graph(item.new_creative_id,{fields:'id,name,object_story_spec,url_tags,degrees_of_freedom_spec'});verifyCreative(a,actual);} 
 for(const a of rev.ads){
  const item=ledger.ads.find(i=>i.ad_id===a.meta_ad_id);
  const current=await graph(a.meta_ad_id,{fields:'id,name,status,adset_id,creative{id}'});
  assert.equal(current.adset_id,rev.adset_id);
  assert([item.previous_creative_id,item.new_creative_id].includes(current.creative.id),'Creative changed externally; inspect before updating');
  assert.equal(current.status,'ACTIVE');
  if(current.creative.id!==item.new_creative_id||current.name!==a.ad_name){const update=await graph(a.meta_ad_id,{name:a.ad_name,creative:{creative_id:item.new_creative_id}},'POST');assert(update.success);item.applied_at=new Date().toISOString();persist();console.log('Published',a.code,a.meta_ad_id);}
 }
 ledger.status='APPLIED_AWAITING_FINAL_READBACK';persist();
}else if(mode!=='verify')throw new Error('Expected prepare, apply or verify');
if(mode==='apply'||mode==='verify'){
 const [campaign,adset,ads]=await Promise.all([graph(rev.campaign_id,{fields:'id,name,status,effective_status,daily_budget,spend_cap,stop_time'}),graph(rev.adset_id,{fields:'id,status,effective_status,end_time,promoted_object,targeting'}),graph(rev.campaign_id+'/ads',{fields:'id,name,status,effective_status,updated_time,adset_id,tracking_specs,creative{id,object_story_spec,effective_object_story_id,url_tags,degrees_of_freedom_spec}',limit:20})]);
 assert.equal(campaign.daily_budget,'10000');assert(!campaign.spend_cap);assert(!campaign.stop_time);assert(!adset.end_time);assert.equal(campaign.status,'ACTIVE');assert.equal(adset.status,'ACTIVE');assert.deepEqual(adset.targeting,before.adset.targeting);assert.deepEqual(adset.promoted_object,before.adset.promoted_object);assert.equal(ads.data.length,9);
 for(const a of rev.ads){const x=ads.data.find(x=>x.id===a.meta_ad_id);const item=ledger.ads.find(x=>x.ad_id===a.meta_ad_id);assert(x);assert.equal(x.status,'ACTIVE');assert.equal(x.name,a.ad_name);assert.equal(x.creative.id,item.new_creative_id);verifyCreative(a,x.creative);verifyTracking(x,before.ads.find(y=>y.id===x.id));}
 save('LEADIN_R3_RECEIPT.json',{checked_at:new Date().toISOString(),status:'PUBLISHED_VERIFIED',revision:'R3',campaign,adset,ads:ads.data,all_nine_copy_fields_match:true,within_article_only_hook_varies:true,old_creatives_retained:true,first_mutation_at:ledger.ads.map(x=>x.applied_at).filter(Boolean).sort()[0],last_mutation_at:ledger.ads.map(x=>x.applied_at).filter(Boolean).sort().at(-1)});
 ledger.status='PUBLISHED_VERIFIED';persist();console.log(JSON.stringify({status:ledger.status,campaign,ads:ads.data.map(x=>({id:x.id,status:x.status,effective_status:x.effective_status,new_creative:x.creative.id}))},null,2));
}
