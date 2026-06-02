const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data: org } = await supabase.from('organizations').select('*').limit(1);
  console.log("Organizations Keys:", org ? Object.keys(org[0]) : "err");
}
run();
