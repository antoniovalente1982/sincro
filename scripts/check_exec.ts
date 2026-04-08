import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const adminClient = createClient(url, serviceKey)

async function run() {
    const { data, error } = await adminClient.rpc('exec_sql', { query: `SELECT * FROM pg_policies WHERE schemaname = 'public';` })
    console.log(data, error)
}

run()
