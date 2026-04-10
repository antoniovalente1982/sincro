const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
async function run() {
  const { error } = await supabase.from('profiles').update({ phone: null }).eq('id', '00000000-0000-0000-0000-000000000000');
  console.log(error ? error.message : "Success");
}
run();
