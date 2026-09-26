import fs from 'node:fs';
import dotenv from 'dotenv';
import {createClient} from '@supabase/supabase-js';
// Remote operations are GET/select only. Save campaign data, never tokens or contact details.
const cfg=dotenv.parse(fs.readFileSync('.env.local'));
const sb=createClient(cfg.NEXT_PUBLIC_SUPABASE_URL,cfg.SUPABASE_SERVICE_ROLE_KEY);
const org='a5dd4842-f0ea-4909-b4a3-be2cb1c6ffa5';
const unwrap=({data,error})=>{if(error)throw Error(error.message);return data};
const conn=unwrap(await sb.from('connections').select('credentials').eq('organization_id',org).eq('provider','meta_ads').eq('status','active').limit(1).single());
async function meta(path,p={}){const u=new URL('https://graph.facebook.com/v21.0/'+path);for(const[k,v]of Object.entries(p))u.searchParams.set(k,typeof v==='string'?v:JSON.stringify(v));let all=[];for(let i=0;i<6;i++){const j=await(await fetch(u,{headers:{Authorization:'Bearer '+conn.credentials.access_token}})).json();if(j.error)return {error:{code:j.error.code,message:j.error.message}};if(!j.data)return j;all.push(...j.data);if(!j.paging?.next)return all;u.searchParams.set('after',j.paging.cursors.after);}return {data:all,truncated:true};}
const ids=['120251721514160047','120251644311030047'];
const range={since:'2026-08-01',until:'2026-09-17'};
const common={time_range:range,limit:'500',use_account_attribution_setting:'true'};
const metrics='campaign_id,campaign_name,spend,impressions,reach,frequency,inline_link_clicks,actions,cpm,cpc,inline_link_click_ctr';
const jobs={
 account:()=>meta('act_511099830249139',{fields:'id,name,account_status,disable_reason,currency,timezone_name,spend_cap,amount_spent,balance,business{id,name}'}),
 history:()=>meta('act_511099830249139/insights',{...common,level:'campaign',time_increment:'1',fields:metrics}),
 ad_history:()=>meta('act_511099830249139/insights',{...common,time_range:{since:'2026-09-12',until:'2026-09-17'},filtering:[{field:'campaign.id',operator:'IN',value:ids}],level:'ad',time_increment:'1',fields:metrics+',ad_id,ad_name,quality_ranking,engagement_rate_ranking,conversion_rate_ranking,video_play_actions,video_p25_watched_actions,video_p50_watched_actions,video_p75_watched_actions,video_p100_watched_actions,video_thruplay_watched_actions'}),
 adsets:()=>meta('act_511099830249139/adsets',{fields:'id,name,campaign_id,status,effective_status,daily_budget,lifetime_budget,bid_strategy,bid_amount,optimization_goal,promoted_object,targeting,issues_info,learning_stage_info,start_time,end_time',filtering:[{field:'campaign.id',operator:'IN',value:ids}],limit:'100'}),
 demographic:()=>meta('act_511099830249139/insights',{...common,time_range:{since:'2026-09-12',until:'2026-09-17'},filtering:[{field:'campaign.id',operator:'IN',value:ids}],level:'campaign',breakdowns:'age,gender',fields:metrics}),
 placement:()=>meta('act_511099830249139/insights',{...common,time_range:{since:'2026-09-16',until:'2026-09-17'},filtering:[{field:'campaign.id',operator:'IN',value:ids}],level:'campaign',breakdowns:'publisher_platform,platform_position',fields:metrics}),
 activities:()=>meta('act_511099830249139/activities',{since:String(Date.parse('2026-09-16T00:00:00+02:00')/1000),until:String(Math.floor(Date.now()/1000)),fields:'event_time,event_type,object_id,object_name,translated_event_type,extra_data',limit:'100'}),
 page:()=>meta('108451268302248',{fields:'id,name,link,is_published,verification_status,followers_count,instagram_business_account{id,username}'}),
 pixel:()=>meta('311586900940615',{fields:'id,name,last_fired_time,is_unavailable'}),
 ads_new:()=>meta(ids[0]+'/ads',{fields:'id,name,status,effective_status,adset_id,issues_info,ad_review_feedback,creative{id,name,body,title,object_story_spec,effective_object_story_id,object_story_id,link_url,object_url,url_tags}',limit:'100'}),
 ads_old:()=>meta(ids[1]+'/ads',{fields:'id,name,status,effective_status,adset_id,issues_info,ad_review_feedback,creative{id,name,body,title,object_story_spec,effective_object_story_id,object_story_id,link_url,object_url,url_tags}',limit:'100'}),
 funnel:async()=>unwrap(await sb.from('funnels').select('id,slug,name,status,meta_pixel_id,settings').eq('organization_id',org).eq('id','bb4f12d9-4709-4ecf-9d1a-1a96c0960e46').single()),
};
const out={started_at:new Date().toISOString()};
// Limit concurrency to four independent reads.
const queue=Object.entries(jobs);await Promise.all(Array.from({length:4},async()=>{while(queue.length){const[k,fn]=queue.shift();try{out[k]=await fn()}catch(e){out[k]={error:e.message}}}}));
const stories=[...new Set([...out.ads_new||[],...out.ads_old||[]].map(a=>a.creative?.effective_object_story_id).filter(Boolean))];out.stories={};for(const id of stories)out.stories[id]=await meta(id,{fields:'id,message,permalink_url,created_time,attachments{title,description,url,media_type,target}'});
out.fetched_at=new Date().toISOString();const file='outputs/meta-ads-2026-09-17/deep-audit-data.json';fs.writeFileSync(file,JSON.stringify(out,null,2));
console.log(JSON.stringify({file,time:out.fetched_at,account:out.account,page:out.page,pixel:out.pixel,counts:Object.fromEntries(Object.entries(out).map(([k,v])=>[k,Array.isArray(v)?v.length:v?.error||'object'])),stories:out.stories},null,2));
