import fs from 'node:fs';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
const cfg=dotenv.parse(fs.readFileSync('.env.local'));
const sb=createClient(cfg.NEXT_PUBLIC_SUPABASE_URL,cfg.SUPABASE_SERVICE_ROLE_KEY);
const org='a5dd4842-f0ea-4909-b4a3-be2cb1c6ffa5';
const fid='bb4f12d9-4709-4ecf-9d1a-1a96c0960e46';
const unwrap=({data,error})=>{if(error)throw new Error(error.message);return data;};
const conn=unwrap(await sb.from('connections').select('credentials').eq('organization_id',org).eq('provider','meta_ads').eq('status','active').limit(1).single());
async function meta(path,params){const url=new URL('https://graph.facebook.com/v21.0/'+path);Object.entries(params).forEach(([k,v])=>url.searchParams.set(k,v));const data=await(await fetch(url,{headers:{Authorization:'Bearer '+conn.credentials.access_token}})).json();return data.error?{error:{code:data.error.code,message:data.error.message}}:data.data||data;}
const submissions=unwrap(await sb.from('funnel_submissions').select('id,created_at,name,email,phone,utm_source,utm_campaign,utm_content,user_agent').eq('organization_id',org).eq('funnel_id',fid).gte('created_at','2026-09-15T22:00:00Z').order('created_at'));
const verified=[];
for(const row of submissions){
 const leads=unwrap(await sb.from('leads').select('id,created_at,product,submission_id,utm_source,utm_campaign,assigned_to,meta_data').eq('organization_id',org).eq('submission_id',row.id));
 verified.push({submission_id:row.id,created_at:row.created_at,name:row.name,explicit_test_marker:/\btest\b|collaudo|prova|codex|chatgpt/i.test(row.name||'')||/\btest\b|example\.(com|org|net|test)/i.test(row.email||''),matches_owner_email:['valenteantonio1982@gmail.com','valente.antonio@me.com','info@valenteantonio.it'].includes((row.email||'').toLowerCase()),utm_source:row.utm_source,utm_campaign:row.utm_campaign,utm_content:row.utm_content,has_email:!!row.email,has_phone:!!row.phone,browser_in_app:/FBAN|FBAV|Instagram/i.test(row.user_agent||''),crm:leads.map(l=>({lead_id:l.id,created_at:l.created_at,source_label:l.product,utm_campaign:l.utm_campaign,assigned:!!l.assigned_to,has_fb_click_id:!!l.meta_data?.fbc,has_fb_browser_id:!!l.meta_data?.fbp,meta_test_flag:!!l.meta_data?.test_mode||!!l.meta_data?.is_test}))});
}
const [oldAds,history,delivery] = await Promise.all([
 meta('120251644311030047/ads',{fields:'id,name,status,effective_status,adset_id,creative{id,object_story_spec,url_tags},issues_info',limit:'50'}),
 meta('120251644311030047/insights',{time_range:JSON.stringify({since:'2026-09-12',until:'2026-09-17'}),time_increment:'1',fields:'spend,impressions,inline_link_clicks,actions',use_account_attribution_setting:'true',limit:'100'}),
 meta('120251721514170047',{fields:'id,name,status,effective_status,issues_info,learning_stage_info'})
]);
const action=(r,t)=>(r.actions||[]).find(a=>a.action_type===t)?.value||'0';
const report={fetched_at:new Date().toISOString(),submissions:verified,old_ads:Array.isArray(oldAds)?oldAds.map(a=>({id:a.id,name:a.name,status:a.status,effective_status:a.effective_status,adset_id:a.adset_id,issues_info:a.issues_info,creative:a.creative})):oldAds,history:Array.isArray(history)?history.map(r=>({date:r.date_start,spend:r.spend,impressions:r.impressions,clicks:r.inline_link_clicks,lpv:action(r,'landing_page_view'),actual_lead_actions:(r.actions||[]).filter(a=>['lead','offsite_conversion.fb_pixel_lead','onsite_conversion.lead_grouped','onsite_web_lead','onsite_web_app_lead','omni_lead'].includes(a.action_type))})):history,new_adset_delivery:delivery};
fs.writeFileSync('outputs/meta-ads-2026-09-17/performance-followup.json',JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
