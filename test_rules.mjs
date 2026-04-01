import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
    const { data } = await supabase.from('ad_automation_rules').select('*').eq('is_enabled', true);
    console.log(JSON.stringify(data, null, 2));
}
run();
