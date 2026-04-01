import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const ORG = 'a5dd4842-f0ea-4909-b4a3-be2cb1c6ffa5';

const { data: stages } = await sb.from('pipeline_stages').select('id, name, sort_order').eq('organization_id', ORG).order('sort_order');
console.log('\n=== PIPELINE STAGES ===');
stages?.forEach(s => console.log(`  [${s.sort_order}] "${s.name}" → id=${s.id}`));

const { data: leads } = await sb.from('leads')
  .select('id, name, email, phone, stage_id')
  .eq('organization_id', ORG)
  .order('created_at', { ascending: false })
  .limit(40);

const stageMap = Object.fromEntries(stages?.map(s => [s.id, s.name]) || []);
console.log('\n=== LEADS NEL CRM ===');
leads?.forEach(l => {
  const stage = stageMap[l.stage_id] || 'N/A';
  console.log(`  ${l.name} | stage: "${stage}" | email: ${l.email}`);
});
