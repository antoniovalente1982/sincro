import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function check() {
    const { data: events } = await supabase.from('tracked_events').select('*').order('created_at', {ascending: false}).limit(5)
    console.log("Recent tracked events:", events)
    
    const { data: leads } = await supabase.from('leads').select('id, name, created_at').order('created_at', {ascending: false}).limit(5)
    console.log("Recent leads:", leads)
}
check()
