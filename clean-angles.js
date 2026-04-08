require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

async function clean() {
  console.log("Cleaning bogus angles...")
  // The angles to remove
  const badAngles = ['IL', 'LA', 'DI', 'DA', 'NON', 'DECINE', 'PERCH', 'LO', 'UNISCITI', 'STESSO', 'MENTALIT', 'E', 'TI', 'OTTENIAMO', 'PERCHÈ', 'PERCHE', 'PERCHÉ']
  
  const { data, error } = await supabase
    .from('ai_angle_scores')
    .delete()
    .in('angle', badAngles)
    
  console.log("Deleted ai_angle_scores:", error || "Success")
}

clean()
