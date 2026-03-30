import { createClient } from "@supabase/supabase-js";
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
async function run() {
  const { data } = await supabase.from('leads').select('utm_campaign').eq('organization_id', 'ec4b12fe-c6f4-419b-ab1e-18be52ca858a').gte('created_at', '2026-03-29T00:00:00+02:00').lte('created_at', '2026-03-29T23:59:59+02:00');
  console.log('29/03 leads:', data?.length);
  
  const { data: d2 } = await supabase.from('leads').select('utm_campaign').eq('organization_id', 'ec4b12fe-c6f4-419b-ab1e-18be52ca858a').gte('created_at', '2026-03-30T00:00:00+02:00').lte('created_at', '2026-03-30T23:59:59+02:00');
  console.log('30/03 leads:', d2?.length);
}
run();
