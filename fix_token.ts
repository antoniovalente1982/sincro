import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

const USER_TOKEN = "EAAUNncECDaUBRm81HXZCJsWEuHvSrfimoa4TcIK0PFmYwIZAqNVQdSX5aplFVd2niyPXUzKWhHgp2jmOeMZAic96qvxRPDNFisk1xCBBlHkp6XoJ6eM71Dw4nZBqvoYNOffQQDdS97mIoAlOvD3G906bemiOy7hTk5TQFHPZCMaoFzdNFMrcVaQQdV28NyHGXK4gLLOg80kj2qFCNbPoVn6Mo9SnVpUADfhABbGbROIBJjDowZC57OOt46465EcMaMhOg5ddHNlCQCr4wskjXVzQZDZD"
const PAGE_ID = "108451268302248"

async function run() {
  // 1. Fetch Page Token
  const res = await fetch(`https://graph.facebook.com/v21.0/me/accounts?access_token=${USER_TOKEN}`)
  const data = await res.json()
  
  if (!data.data || data.data.length === 0) {
    console.error("No pages found for this token. Did you add business_management?", JSON.stringify(data))
    return
  }
  
  const page = data.data.find((p: any) => p.id === PAGE_ID)
  if (!page) {
    console.error("Page not found in list")
    return
  }
  
  const pageToken = page.access_token
  console.log("Got Page Token:", pageToken.substring(0, 20) + "...")
  
  // 2. Update DB
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  
  const { data: conn } = await supabase.from('connections').select('*').eq('provider', 'meta_ads').single()
  
  if (conn) {
    const creds = conn.credentials
    creds.access_token = pageToken
    
    const { error } = await supabase.from('connections').update({ credentials: creds }).eq('id', conn.id)
    if (error) console.error("Error updating DB:", error)
    else console.log("DB Updated Successfully!")
  }
}
run()
