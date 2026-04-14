const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
async function test() {
  const { data: members, error } = await supabase.from('organization_members').select('user_id, role');
  const { data: profiles } = await supabase.from('profiles').select('id, full_name');
  
  if(error) console.error(error);
  else {
      members.forEach(m => {
          const profile = profiles.find(p => p.id === m.user_id);
          console.log(`${profile ? profile.full_name : 'Unknown'} - ${m.role}`);
      });
  }
}
test()
