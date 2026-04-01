import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const ORG = 'a5dd4842-f0ea-4909-b4a3-be2cb1c6ffa5';
const SHOWUP = '4d7faf7a-e25e-486a-8b5a-93dce223612b';

const { data: all } = await sb.from('leads').select('id, name, email, stage_id, created_at').eq('organization_id', ORG).ilike('name', '%valeria%');
console.log('Records Valeria:', all?.map(x => `id=${x.id} | ${x.name} | ${x.email} | stage=${x.stage_id}`));

// Aggiorna tutti → Show-up
for (const r of all || []) {
  await sb.from('leads').update({ stage_id: SHOWUP }).eq('id', r.id);
  console.log(`✅ ${r.name} → SHOWUP`);
}
