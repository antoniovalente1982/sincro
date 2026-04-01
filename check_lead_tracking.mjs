import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const ORG = 'a5dd4842-f0ea-4909-b4a3-be2cb1c6ffa5';

// Find Domenico Argiro and recent leads - check UTM data
const { data: leads } = await sb
  .from('leads')
  .select('name, email, utm_source, utm_medium, utm_campaign, utm_content, utm_term, meta_data, created_at, funnel_id')
  .eq('organization_id', ORG)
  .order('created_at', { ascending: false })
  .limit(10);

console.log('\n=== ULTIMI 10 LEAD + UTM DATA ===\n');
leads?.forEach(l => {
  const hasUtm = l.utm_source || l.utm_campaign || l.utm_content;
  const hasMeta = l.meta_data?.fbc || l.meta_data?.fbp || l.meta_data?.fbclid;
  console.log(`${l.name} (${new Date(l.created_at).toLocaleDateString('it-IT')})`);
  console.log(`  UTM: source=${l.utm_source||'❌'} | campaign=${l.utm_campaign||'❌'} | content=${l.utm_content||'❌'} | term=${l.utm_term||'❌'}`);
  console.log(`  Meta: fbc=${l.meta_data?.fbc ? '✅' : '❌'} | fbp=${l.meta_data?.fbp ? '✅' : '❌'} | fbclid=${l.meta_data?.fbclid ? '✅' : '❌'}`);
  console.log(`  funnel_id: ${l.funnel_id}`);
  console.log('');
});

// Check funnel submissions too
const { data: subs } = await sb
  .from('funnel_submissions')
  .select('name, utm_source, utm_medium, utm_campaign, utm_content, utm_term, extra_data, created_at')
  .eq('organization_id', ORG)
  .order('created_at', { ascending: false })
  .limit(5);

console.log('\n=== ULTIME 5 FUNNEL SUBMISSIONS ===\n');
subs?.forEach(s => {
  console.log(`${s.name} (${new Date(s.created_at).toLocaleDateString('it-IT')})`);
  console.log(`  utm_campaign=${s.utm_campaign||'❌'} | utm_content=${s.utm_content||'❌'}`);
  console.log(`  extra_data keys: ${Object.keys(s.extra_data||{}).join(', ')||'vuoto'}`);
  console.log('');
});
