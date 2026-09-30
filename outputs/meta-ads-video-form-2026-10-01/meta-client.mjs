import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
dotenv.config({ path: '.env.local', quiet: true });
export const out = path.dirname(new URL(import.meta.url).pathname);
export const org = 'a5dd4842-f0ea-4909-b4a3-be2cb1c6ffa5';
export const account = 'act_511099830249139';
export const pixel = '311586900940615';
export const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const { data: connections, error } = await db.from('connections').select('provider,credentials').eq('organization_id',org).eq('status','active').in('provider',['meta_ads','meta_capi']);
if(error) throw new Error(error.message);
const ads = connections.find(x=>x.provider==='meta_ads')?.credentials;
const capi = connections.find(x=>x.provider==='meta_capi')?.credentials;
if (ads?.ad_account_id !== account.slice(4) || ads?.pixel_id !== pixel || capi?.pixel_id !== pixel) throw new Error('Connection identity mismatch');
export function save(name,value){fs.writeFileSync(path.join(out,name),JSON.stringify(value,null,2)+'\n');}
export async function graph(endpoint,params={},method='GET',provider='meta_ads'){
  const url=new URL('https://graph.facebook.com/v21.0/'+endpoint);
  const options={method,headers:{Authorization:'Bearer '+(provider==='meta_capi'?capi.access_token:ads.access_token)}};
  if(method==='GET') for(const[k,v]of Object.entries(params))url.searchParams.set(k,typeof v==='object'?JSON.stringify(v):String(v));
  else {options.headers['Content-Type']='application/json';options.body=JSON.stringify(params);}
  const res=await fetch(url,options);const data=await res.json();
  if(data.error)throw new Error(JSON.stringify({endpoint,http:res.status,message:data.error.message,code:data.error.code,subcode:data.error.error_subcode,user_message:data.error.error_user_msg}));
  return data;
}
