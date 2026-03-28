import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

async function check() {
    const { data: events, error } = await supabase.from('tracked_events')
        .select('*')
        .eq('lead_id', '5f45f835-9ca6-465d-9d4d-5b0a6abc7200')
    
    console.log("Tracked events for Eleonora (ID: 5f45f835-9ca6-465d-9d4d-5b0a6abc7200):", JSON.stringify(events, null, 2))
    if (error) console.error(error)
}

check()
