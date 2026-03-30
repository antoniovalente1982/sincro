import { createClient } from "@supabase/supabase-js";
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function run() {
  const orgId = 'a5dd4842-f0ea-4909-b4a3-be2cb1c6ffa5';
  const since = '2026-03-29';
  const until = '2026-03-29';
  
  const { data: crmLeads, error } = await supabase
    .from('leads')
    .select('id, utm_campaign, created_at')
    .eq('organization_id', orgId)
    .gte('created_at', since + 'T00:00:00+02:00')
    .lte('created_at', until + 'T23:59:59+02:00');
    
  console.log('Error:', error);
  console.log('Count:', crmLeads?.length);
  console.log(crmLeads);
}

run();
