const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
async function test() {
  const { data, error } = await supabase.from('organization_members').select('*').limit(1);
  console.log('organization_members columns:', data ? Object.keys(data[0] || {}) : error);
}
test()
