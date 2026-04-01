import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const ORG = 'a5dd4842-f0ea-4909-b4a3-be2cb1c6ffa5';

const { data: funnels } = await sb.from('funnels').select('id, name, slug, status, settings').eq('organization_id', ORG);
console.log('\n=== FUNNELS ===');
funnels?.forEach(f => console.log(`  [${f.status}] ${f.name} → /f/${f.slug} | id=${f.id}`));

// Domenico Argiro — trova da dove è arrivato
const { data: sub } = await sb.from('funnel_submissions')
  .select('name, funnel_id, utm_source, utm_campaign, utm_content, extra_data, created_at')
  .ilike('name', '%argir%').single();
console.log('\n=== DOMENICO ARGIRO SUBMISSION ===');
console.log(JSON.stringify(sub, null, 2));

// Il funnel metodo-sincro - vedi settings
const { data: mainFunnel } = await sb.from('funnels').select('*').eq('slug', 'metodo-sincro').single();
console.log('\n=== FUNNEL METODO-SINCRO settings ===');
console.log(JSON.stringify(mainFunnel?.settings, null, 2));
