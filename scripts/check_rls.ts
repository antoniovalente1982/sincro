import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const anonClient = createClient(url, anonKey)
const adminClient = createClient(url, serviceKey)

async function run() {
    console.log('--- TESTING RLS ON TABLES ---')
    const tables = ['funnels', 'leads', 'tracked_events', 'organizations']
    
    for (const table of tables) {
        process.stdout.write(`Testing ${table}... `)
        const { data: anonData, error: anonErr } = await anonClient.from(table).select('id').limit(5)
        const { data: adminData, error: adminErr } = await adminClient.from(table).select('id').limit(5)
        
        console.log(`\n  ANON sees: ${anonData?.length || 0} rows. Error: ${anonErr?.message || 'none'}`)
        console.log(`  ADMIN sees: ${adminData?.length || 0} rows. Error: ${adminErr?.message || 'none'}`)
    }
}

run()
