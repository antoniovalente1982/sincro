const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data: leads } = await supabase.from('leads').select('*').limit(1);
  const { data: org_members } = await supabase.from('organization_members').select('*').limit(1);
  
  console.log("Leads Keys:", leads ? Object.keys(leads[0]) : "err");
  console.log("Org Members:", org_members);
}
run();
