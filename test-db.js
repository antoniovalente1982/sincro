const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  'https://bktiuhxenxwhkgvdaxnp.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJrdGl1aHhlbnh3aGtndmRheG5wIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjgzNDI5NCwiZXhwIjoyMDg4NDEwMjk0fQ._X7v2vX9a_oVoqVWv9W6WJ96NRiVWDh3XvkJHuFu47c'
);
async function run() {
  const { data, error } = await supabase.from('profiles').select('*').limit(1);
  console.log(error || data);
}
run();
