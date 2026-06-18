import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const AD_ACCOUNT_ID = process.env.META_AD_ACCOUNT_ID || '511099830249139';
const META_API_VERSION = 'v21.0';

const { data: conn } = await sb
  .from('connections')
  .select('credentials')
  .eq('provider', 'meta_ads')
  .eq('status', 'active')
  .single();

const TOKEN = conn.credentials.access_token;
const AD_ACCOUNT = `act_${AD_ACCOUNT_ID}`;

const res = await fetch(`https://graph.facebook.com/${META_API_VERSION}/${AD_ACCOUNT}/customaudiences?fields=name,id,subtype&limit=100&access_token=${TOKEN}`);
const data = await res.json();

console.log('--- ALL CUSTOM AUDIENCES IN ACCOUNT ---');
if (data.data) {
  data.data.forEach(a => {
    console.log(`- Name: "${a.name}" | ID: ${a.id} | Subtype: ${a.subtype}`);
  });
} else {
  console.log('Error or no data:', data);
}
