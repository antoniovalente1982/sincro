import fs from 'node:fs';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// Read-only remote queries. No ad changes, event submissions or contact exports.
const cfg = dotenv.parse(fs.readFileSync('.env.local'));
const sb = createClient(cfg.NEXT_PUBLIC_SUPABASE_URL, cfg.SUPABASE_SERVICE_ROLE_KEY);
const org = 'a5dd4842-f0ea-4909-b4a3-be2cb1c6ffa5';
const funnel = 'bb4f12d9-4709-4ecf-9d1a-1a96c0960e46';
const campaignIds = ['120251721514160047', '120251644311030047'];
const since = '2026-09-15T22:00:00Z';
const until = new Date().toISOString();
const unwrap = ({data,error}) => { if(error) throw new Error(error.message); return data; };
const conn = unwrap(await sb.from('connections').select('credentials').eq('organization_id',org).eq('provider','meta_ads').eq('status','active').limit(1).single());
async function meta(path, params) {
  const url = new URL('https://graph.facebook.com/v21.0/'+path);
  Object.entries(params).forEach(([k,v])=>url.searchParams.set(k,v));
  const res = await fetch(url,{headers:{Authorization:'Bearer '+conn.credentials.access_token}});
  const data = await res.json();
  if(data.error) return {error:{code:data.error.code,message:data.error.message}};
  return data.data || data;
}
async function rows(table, fields, filterFunnel = true) {
  const all=[];
  for(let offset=0;;offset+=1000) {
    let query=sb.from(table).select(fields).eq('organization_id',org).gte('created_at',since).lte('created_at',until).order('created_at').range(offset,offset+999);
    if(filterFunnel) query=query.eq('funnel_id',funnel);
    const data=unwrap(await query); all.push(...data);
    if(data.length<1000) return all;
  }
}
const common={time_range:JSON.stringify({since:'2026-09-16',until:'2026-09-17'}),filtering:JSON.stringify([{field:'campaign.id',operator:'IN',value:campaignIds}]),limit:'500',use_account_attribution_setting:'true'};
const metrics='campaign_id,campaign_name,spend,impressions,reach,frequency,inline_link_clicks,inline_link_click_ctr,cost_per_inline_link_click,actions,outbound_clicks';
const tasks={
  account:meta('act_511099830249139',{fields:'name,currency,timezone_name'}),
  campaigns:meta('act_511099830249139/campaigns',{fields:'id,name,status,effective_status,objective,daily_budget,lifetime_budget,created_time,updated_time,start_time',limit:'100'}),
  campaign_totals:meta('act_511099830249139/insights',{...common,level:'campaign',fields:metrics}),
  campaign_daily:meta('act_511099830249139/insights',{...common,level:'campaign',time_increment:'1',fields:metrics}),
  ad_daily:meta('act_511099830249139/insights',{...common,level:'ad',time_increment:'1',fields:metrics+',ad_id,ad_name,video_play_actions,video_p25_watched_actions,video_p50_watched_actions,video_p100_watched_actions,video_thruplay_watched_actions'}),
  hourly_today:meta('act_511099830249139/insights',{...common,time_range:JSON.stringify({since:'2026-09-17',until:'2026-09-17'}),level:'campaign',breakdowns:'hourly_stats_aggregated_by_advertiser_time_zone',fields:'campaign_id,campaign_name,spend,impressions,inline_link_clicks,actions'}),
  placements:meta('act_511099830249139/insights',{...common,level:'campaign',breakdowns:'publisher_platform,platform_position',fields:'campaign_id,spend,impressions,inline_link_clicks,actions'}),
  adsets:meta('act_511099830249139/adsets',{fields:'id,name,campaign_id,status,effective_status,daily_budget,optimization_goal,promoted_object,start_time,updated_time,targeting,attribution_spec',filtering:JSON.stringify([{field:'campaign.id',operator:'IN',value:campaignIds}]),limit:'100'}),
  ads_new:meta(campaignIds[0]+'/ads',{fields:'id,name,status,effective_status,updated_time,issues_info,creative{id,object_story_spec,url_tags},tracking_specs',limit:'50'}),
  views:rows('page_views','created_at,page_variant,visitor_id,utm_source,utm_campaign,utm_content,device_type,user_agent'),
  submissions:rows('funnel_submissions','created_at,page_variant,utm_source,utm_campaign,utm_content'),
  events:rows('tracked_events','created_at,event_name,event_params,sent_to_provider',false),
  funnel:sb.from('funnels').select('slug,status,settings').eq('organization_id',org).eq('id',funnel).single().then(unwrap),
};
const fetched={};
await Promise.all(Object.entries(tasks).map(async([key,promise])=>{try{fetched[key]=await promise;}catch(e){fetched[key]={error:e.message};}}));
const bot=/bot|crawler|spider|facebookexternalhit|WhatsApp|Lighthouse|headless|PhantomJS|Selenium|puppeteer|prerender/i;
const isTest=r=>r.utm_source==='collaudo'||r.utm_campaign==='clarity_20260917';
const group=(data,key)=>Object.groupBy(data,key);
const summarize=v=>({pageviews:v.length,distinct_browser_ids:new Set(v.map(r=>r.visitor_id).filter(Boolean)).size,missing_visitor_ids:v.filter(r=>!r.visitor_id).length,recognized_bots:v.filter(r=>bot.test(r.user_agent||'')).length,marked_test_views:v.filter(isTest).length,first:v[0]?.created_at,last:v.at(-1)?.created_at});
const grouped=(data,key)=>Object.fromEntries(Object.entries(group(data,key)).map(([k,v])=>[k,summarize(v)]));
const result={fetched_at:until,database_since:since,...Object.fromEntries(Object.entries(fetched).filter(([k])=>!['views','events','funnel'].includes(k)))};
if(Array.isArray(fetched.campaigns))result.campaigns=fetched.campaigns.filter(c=>campaignIds.includes(c.id)||c.effective_status==='ACTIVE');
if(Array.isArray(fetched.views)){
  const data=fetched.views;
  result.pageviews={total:summarize(data),by_campaign:grouped(data,r=>r.utm_campaign||'(none)'),by_campaign_day:grouped(data,r=>[r.utm_campaign||'(none)',new Date(new Date(r.created_at).getTime()+7200000).toISOString().slice(0,10)].join(' | ')),by_campaign_hour_rome:grouped(data,r=>[r.utm_campaign||'(none)',new Date(new Date(r.created_at).getTime()+7200000).toISOString().slice(0,13)].join(' | ')),since_copy_revision:grouped(data.filter(r=>r.created_at>='2026-09-17T06:01:14Z'),r=>r.utm_campaign||'(none)'),since_new_video:grouped(data.filter(r=>r.created_at>='2026-09-17T06:56:56Z'),r=>r.utm_campaign||'(none)'),since_clarity:grouped(data.filter(r=>r.created_at>='2026-09-17T07:36:45Z'),r=>r.utm_campaign||'(none)')};
} else result.pageviews=fetched.views;
if(Array.isArray(fetched.events)) result.events=Object.fromEntries(Object.entries(group(fetched.events,r=>[r.created_at.slice(0,10),r.event_name,r.event_params?.pixel_id||'(none)',r.sent_to_provider].join(' | '))).map(([key,v])=>[key,{count:v.length,first:v[0].created_at,last:v.at(-1).created_at}]));
else result.events=fetched.events;
if(fetched.funnel?.settings) result.funnel={slug:fetched.funnel.slug,status:fetched.funnel.status,settings:Object.fromEntries(Object.entries(fetched.funnel.settings).filter(([k])=>/template|variant|ab_test|revision|messag|clarity|consultation/.test(k)))};
else result.funnel=fetched.funnel;
const file='outputs/meta-ads-2026-09-17/performance-'+until.replaceAll(':','-')+'.json';
fs.writeFileSync(file,JSON.stringify(result,null,2));
const action=(r,type)=>(r.actions||[]).find(a=>a.action_type===type)?.value||'0';
const leadTypes = new Set(['lead','offsite_conversion.fb_pixel_lead','onsite_conversion.lead_grouped','onsite_web_lead','onsite_web_app_lead','omni_lead']);
const compact=r=>({campaign:r.campaign_name,id:r.campaign_id,day:r.date_start,spend:r.spend,impressions:r.impressions,clicks:r.inline_link_clicks,lpv:action(r,'landing_page_view'),actual_lead_actions:(r.actions||[]).filter(a=>leadTypes.has(a.action_type)),ctr:r.inline_link_click_ctr,cpc:r.cost_per_inline_link_click,ad:r.ad_name,hour:r.hourly_stats_aggregated_by_advertiser_time_zone});
console.log(JSON.stringify({file,fetched_at:until,account:result.account,campaigns:result.campaigns,campaign_totals:Array.isArray(result.campaign_totals)?result.campaign_totals.map(compact):result.campaign_totals,campaign_daily:Array.isArray(result.campaign_daily)?result.campaign_daily.map(compact):result.campaign_daily,ad_daily:Array.isArray(result.ad_daily)?result.ad_daily.map(compact):result.ad_daily,hourly_today:Array.isArray(result.hourly_today)?result.hourly_today.map(compact):result.hourly_today,ads_status:Array.isArray(result.ads_new)?result.ads_new.map(({id,name,status,effective_status,updated_time,issues_info})=>({id,name,status,effective_status,updated_time,issues_info})):result.ads_new,views_by_campaign_day:result.pageviews?.by_campaign_day,views_since_copy_revision:result.pageviews?.since_copy_revision,submissions:result.submissions,events:result.events},null,2));
