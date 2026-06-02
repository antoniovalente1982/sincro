import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

async function run() {
  const { data } = await supabase.from('leads').select('meta_data').eq('provider', 'meta_lead_form').order('created_at', { ascending: false }).limit(5)
  console.log(JSON.stringify(data, null, 2))
  
  // Actually just get all leads with meta_data->form_id
  const { data: all } = await supabase.from('leads').select('meta_data').not('meta_data', 'is', null).order('created_at', { ascending: false }).limit(5)
  console.log("Recent leads with meta:", JSON.stringify(all, null, 2))
}
run()
