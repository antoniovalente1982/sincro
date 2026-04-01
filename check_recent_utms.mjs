import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const ORG = 'a5dd4842-f0ea-4909-b4a3-be2cb1c6ffa5';

const { data } = await sb.from('funnel_submissions')
  .select('name, utm_campaign, utm_content, utm_source, funnel_id, created_at')
  .eq('organization_id', ORG)
  .order('created_at', { ascending: false })
  .limit(8);

const funnelNames = {
  'ff79dda2-4e89-498a-9798-a9d7ac86bacc': 'metodo-sincro (Meta Ads)',
  '503ee812-5a60-4c9a-8d68-bd5d02a43453': 'form-valenteantonio',
  '1539adea-4b2e-40ff-8f35-0eb1b89d13eb': 'form-metodosincro',
  '95a2f73a-a8e9-46c5-998b-5d12d5bc5fd0': 'form-protocollo27',
};

console.log('\n=== ULTIME 8 SUBMISSIONS ===\n');
data?.forEach(s => {
  const ok = s.utm_campaign ? '✅' : '❌';
  const fname = funnelNames[s.funnel_id] || s.funnel_id;
  console.log(`${ok} ${s.name} | ${fname}`);
  console.log(`   campaign=${s.utm_campaign||'null'} | content=${s.utm_content||'null'}`);
  console.log(`   ${new Date(s.created_at).toLocaleString('it-IT')}\n`);
});
