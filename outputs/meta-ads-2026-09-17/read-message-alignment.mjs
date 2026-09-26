import fs from 'node:fs';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

const cfg = dotenv.parse(fs.readFileSync('.env.local'));
const sb = createClient(cfg.NEXT_PUBLIC_SUPABASE_URL, cfg.SUPABASE_SERVICE_ROLE_KEY);
const unwrap = ({ data, error }) => { if (error) throw new Error(error.message); return data; };
const org = 'a5dd4842-f0ea-4909-b4a3-be2cb1c6ffa5';
const conn = unwrap(await sb.from('connections').select('credentials').eq('organization_id', org).eq('provider', 'meta_ads').eq('status', 'active').limit(1).single());
const url = new URL('https://graph.facebook.com/v21.0/120251721514160047/ads');
url.searchParams.set('fields', 'id,name,status,effective_status,adset_id,campaign_id,creative{id,name,object_story_spec,asset_feed_spec,url_tags,degrees_of_freedom_spec,object_type,effective_object_story_id},tracking_specs');
url.searchParams.set('limit', '50');
const ads = await (await fetch(url, { headers: { Authorization: 'Bearer ' + conn.credentials.access_token } })).json();
if (ads.error) throw new Error(JSON.stringify(ads.error));
const funnel = unwrap(await sb.from('funnels').select('id,slug,status,settings,updated_at').eq('id', 'bb4f12d9-4709-4ecf-9d1a-1a96c0960e46').eq('organization_id', org).single());
const result = { read_at: new Date().toISOString(), ads: ads.data, funnel };
const file = 'outputs/meta-ads-2026-09-17/message-alignment-before.json';
if (!fs.existsSync(file)) fs.writeFileSync(file, JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
