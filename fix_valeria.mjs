import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const ORG = 'a5dd4842-f0ea-4909-b4a3-be2cb1c6ffa5';
const SHOWUP = '4d7faf7a-e25e-486a-8b5a-93dce223612b';

// Cerca per nome (email aveva case problem)
const { data: valeria } = await sb.from('leads').select('id, name, email').eq('organization_id', ORG).ilike('name', '%valeria%zanni%').maybeSingle();
if (valeria) {
  await sb.from('leads').update({ stage_id: SHOWUP }).eq('id', valeria.id);
  console.log(`✅ Valeria Zanni (${valeria.email}) → SHOWUP`);
} else {
  // Prova con email lowercase
  const { data: v2 } = await sb.from('leads').select('id, name, email').eq('organization_id', ORG).ilike('name', '%valeria%').limit(5);
  console.log('Trovate:', v2?.map(x => `${x.name} <${x.email}>`));
}
