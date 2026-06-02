import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import { fetchFormLeads, processMetaLead } from './lib/meta-lead-forms.js'

dotenv.config({ path: '.env.local' })

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

// Token utente
const USER_TOKEN = "EAAUNncECDaUBRm81HXZCJsWEuHvSrfimoa4TcIK0PFmYwIZAqNVQdSX5aplFVd2niyPXUzKWhHgp2jmOeMZAic96qvxRPDNFisk1xCBBlHkp6XoJ6eM71Dw4nZBqvoYNOffQQDdS97mIoAlOvD3G906bemiOy7hTk5TQFHPZCMaoFzdNFMrcVaQQdV28NyHGXK4gLLOg80kj2qFCNbPoVn6Mo9SnVpUADfhABbGbROIBJjDowZC57OOt46465EcMaMhOg5ddHNlCQCr4wskjXVzQZDZD"
const FORM_ID = "999910002404075"

async function run() {
  console.log(`Recupero lead storici in corso per il form: ${FORM_ID}...`)
  
  const { data: conn } = await supabase.from('connections').select('*').eq('provider', 'meta_ads').single()
  const orgId = conn?.organization_id
  
  // Timestamp di 30 giorni fa
  const sinceTimestamp = Math.floor((Date.now() - 30 * 24 * 60 * 60 * 1000) / 1000)

  let totalProcessed = 0
  let totalCreated = 0

  const leads = await fetchFormLeads(FORM_ID, USER_TOKEN, sinceTimestamp)
  console.log(`Trovati ${leads.length} lead per questo form.`)
  
  for (const rawLead of leads) {
    const result = await processMetaLead(rawLead, orgId, supabase)
    totalProcessed++
    if (result.status === 'created') totalCreated++
    console.log(` - Lead ${rawLead.id}: ${result.status}`)
  }

  console.log(`\nRecupero completato! Processati: ${totalProcessed}, Nuovi importati: ${totalCreated}`)
  
  const sheetsMod = await import('./lib/google-sheets.js').catch(() => null)
  if (sheetsMod && sheetsMod.syncAllLeadsToSheet) {
      console.log("Sincronizzo verso Google Sheets...")
      const sheetRes = await sheetsMod.syncAllLeadsToSheet(orgId)
      console.log(`Sincronizzazione completata: ${sheetRes.success} (${sheetRes.count} leads sincronizzati)`)
  }
}

run()
