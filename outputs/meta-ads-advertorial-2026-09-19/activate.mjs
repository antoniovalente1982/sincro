import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { graph, save, out } from './meta-client.mjs';
const read=name=>JSON.parse(fs.readFileSync(path.join(out,name)));
const state=read('CREATED_OBJECTS.json'), check=read('LAUNCH_VERIFICATION.json');
assert.equal(check.result,'PASS');assert(Date.now()-Date.parse(check.checked_at)<30*60*1000);assert.equal(state.ads.length,9);
const campaign=await graph(state.campaign.id,{fields:'id,status,daily_budget,spend_cap'});
assert.equal(campaign.status,'PAUSED');assert.equal(campaign.daily_budget,'5700');assert.equal(campaign.spend_cap,'50000');
const adset=await graph(state.adset.id,{fields:'id,status,targeting,promoted_object,end_time'});
assert.equal(adset.status,'PAUSED');assert.equal(adset.targeting.age_min,38);assert.deepEqual(adset.targeting.geo_locations.countries,['IT']);assert.deepEqual(adset.targeting.locales,[10]);assert.equal(adset.targeting.targeting_automation.advantage_audience,0);assert.equal(adset.targeting.targeting_automation.individual_setting.age,0);assert.equal(adset.promoted_object.pixel_id,'311586900940615');assert.equal(adset.promoted_object.custom_event_type,'LEAD');
const currentAds=await graph(state.campaign.id+'/ads',{fields:'id,status,creative{id},issues_info,effective_status',limit:50});
assert.equal(currentAds.data.length,9);
for(const item of state.ads){const actual=currentAds.data.find(a=>a.id===item.ad_id);assert(actual);assert.equal(actual.status,'PAUSED');assert.equal(actual.creative.id,item.creative_id);assert(!actual.issues_info?.length);assert(!['DISAPPROVED','WITH_ISSUES'].includes(actual.effective_status));}
const receipt={started_at:new Date().toISOString(),authorization:'Antonio: ok fai e poi crea le campagne e pubblica',campaign_id:state.campaign.id,adset_id:state.adset.id,actions:[],activation_complete:false};
save('PUBLICATION_RECEIPT.json',receipt);
for(const item of state.ads){
  const result=await graph(item.ad_id,{status:'ACTIVE'},'POST');assert.equal(result.success,true);
  receipt.actions.push({code:item.code,ad_id:item.ad_id,status:'ACTIVE',at:new Date().toISOString()});save('PUBLICATION_RECEIPT.json',receipt);console.log('ad enabled',item.code,item.ad_id);
}
assert.equal((await graph(state.campaign.id,{fields:'status'})).status,'PAUSED');
assert.equal((await graph(state.adset.id,{status:'ACTIVE'},'POST')).success,true);
receipt.actions.push({adset_id:state.adset.id,status:'ACTIVE',at:new Date().toISOString()});save('PUBLICATION_RECEIPT.json',receipt);
assert.equal((await graph(state.campaign.id,{status:'ACTIVE'},'POST')).success,true);
receipt.activation_complete=true;receipt.activated_at=new Date().toISOString();save('PUBLICATION_RECEIPT.json',receipt);
const [afterCampaign,afterAdset,afterAds,previous]=await Promise.all([
  graph(state.campaign.id,{fields:'id,name,status,effective_status,daily_budget,spend_cap'}),
  graph(state.adset.id,{fields:'id,name,status,effective_status,end_time,targeting,promoted_object'}),
  graph(state.campaign.id+'/ads',{fields:'id,name,status,effective_status,issues_info,ad_review_feedback',limit:50}),
  graph('120251721514160047',{fields:'id,status'})
]);
assert.equal(afterCampaign.status,'ACTIVE');assert.equal(afterAdset.status,'ACTIVE');assert(afterAds.data.every(a=>a.status==='ACTIVE'));assert.equal(previous.status,'PAUSED');
receipt.verified_at=new Date().toISOString();receipt.campaign=afterCampaign;receipt.adset=afterAdset;receipt.ads=afterAds.data;receipt.previous_campaign=previous;save('PUBLICATION_RECEIPT.json',receipt);
console.log(JSON.stringify({campaign:afterCampaign,adset_status:afterAdset.status,end_time:afterAdset.end_time,ads:afterAds.data.map(a=>({id:a.id,status:a.status,effective_status:a.effective_status})),previous_campaign:previous},null,2));
