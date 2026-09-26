import fs from 'node:fs';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// Read-only production queries. Only non-contact aggregates are saved locally.
const cfg = dotenv.parse(fs.readFileSync('.env.local'));
const sb = createClient(cfg.NEXT_PUBLIC_SUPABASE_URL, cfg.SUPABASE_SERVICE_ROLE_KEY);
const org = 'a5dd4842-f0ea-4909-b4a3-be2cb1c6ffa5';
const fid = 'bb4f12d9-4709-4ecf-9d1a-1a96c0960e46';
const unwrap = ({data,error}) => {if(error) throw new Error(error.message); return data;};
const funnel=unwrap(await sb.from('funnels').select('slug,settings').eq('organization_id',org).eq('id',fid).single());
const since=funnel.settings.clarity_started_at;
if (!since) throw new Error('Missing activation timestamp');
const until=new Date().toISOString();
let views=[];
for(let offset=0;;offset+=1000){
    const data=unwrap(await sb.from('page_views').select('created_at,page_variant,visitor_id,utm_source,utm_campaign,device_type,user_agent').eq('organization_id',org).eq('funnel_id',fid).gte('created_at',since).lte('created_at',until).order('created_at').range(offset,offset+999));
    views.push(...data);
    if(data.length<1000)break;
}
const submissions=unwrap(await sb.from('funnel_submissions').select('created_at').eq('organization_id',org).eq('funnel_id',fid).gte('created_at',since).lte('created_at',until));
const bots=/bot|crawler|spider|facebookexternalhit|WhatsApp|Lighthouse|headless|PhantomJS|Selenium|puppeteer|prerender/i;
const summarize=rows=>({pageviews:rows.length,distinct_browser_ids:new Set(rows.map(r=>r.visitor_id).filter(Boolean)).size,missing_ids:rows.filter(r=>!r.visitor_id).length,recognized_bot_views:rows.filter(r=>bots.test(r.user_agent||'')).length,in_app_browser_views:rows.filter(r=>/FBAN|FBAV|Instagram/i.test(r.user_agent||'')).length,first:rows[0]?.created_at,last:rows.at(-1)?.created_at});
const grouped=(rows,key)=>Object.fromEntries(Object.entries(Object.groupBy(rows,key)).map(([k,v])=>[k,summarize(v)]));
const report={fetched_at:until,since,slug:funnel.slug,clarity_project_id:funnel.settings.clarity_project_id,total:summarize(views),by_campaign:grouped(views,r=>r.utm_campaign||'(none)'),by_device:grouped(views,r=>r.device_type||'(none)'),quarter_hour_utc:grouped(views,r=>{const d=new Date(r.created_at);d.setUTCMinutes(Math.floor(d.getUTCMinutes()/15)*15,0,0);return d.toISOString();}),submissions:submissions.length};
fs.writeFileSync('outputs/meta-ads-2026-09-17/clarity-traffic-check.json',JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
