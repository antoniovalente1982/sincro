import { createClient } from '@supabase/supabase-js'

// Need to load dot env locally for this script since it runs outside next
import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

async function check() {
    const { data: events, error: err1 } = await supabase.from('tracked_events').select('created_at, event_name, lead_id, sent_to_provider, provider_response').order('created_at', { ascending: false }).limit(5)
    console.log("Recent tracked events:", events, err1?.message)
    
    const { data: leads, error: err2 } = await supabase.from('leads').select('id, name, created_at, email, phone').order('created_at', { ascending: false }).limit(2)
    console.log("Recent leads (Eleonora?):", leads, err2?.message)
}

check()
