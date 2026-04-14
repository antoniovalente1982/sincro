const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });
async function test() {
  const { createClient } = require('@supabase/supabase-js');
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  
  const { data, error } = await supabase
        .from('leads')
        .select(`
            id,
            calendar_events (id, start_time, end_time, status)
        `)
        .limit(2);
        
  if (error) console.error(error);
  else console.log(JSON.stringify(data, null, 2));
}
test();
