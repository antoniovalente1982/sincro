import fs from 'fs'
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import { processMetaLead } from './lib/meta-lead-forms.js'

dotenv.config({ path: '.env.local' })

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

function parseDate(dateStr: string): string {
  try {
    const d = new Date(dateStr.replace('am', ' AM').replace('pm', ' PM'))
    if (!isNaN(d.getTime())) return d.toISOString()
  } catch (e) {}
  return new Date().toISOString()
}

async function run() {
  const { data: conn } = await supabase.from('connections').select('*').eq('provider', 'meta_ads').single()
  const orgId = conn?.organization_id
  
  if (!orgId) {
    console.error("No org ID found")
    return
  }

  const csvContent = fs.readFileSync('leads da reinserire csv.csv', 'utf-8')
  const lines = csvContent.split('\n').map(l => l.trim()).filter(l => l)
  
  // Skip header
  const dataLines = lines.slice(1)
  
  console.log(`Trovati ${dataLines.length} lead nel CSV. Inizio importazione...`)

  let imported = 0
  
  for (let i = 0; i < dataLines.length; i++) {
    const row = dataLines[i].split(',')
    const dateStr = row[0]
    const name = row[1]
    const email = row[2]
    const phone = row[9]

    if (name.includes('test lead') || email.includes('test@meta.com')) {
      console.log(`Salto lead di test: ${name}`)
      continue
    }

    const rawLead = {
      id: `csv_import_${Date.now()}_${i}`,
      created_time: parseDate(dateStr),
      field_data: [
        { name: 'full_name', values: [name] },
        { name: 'email', values: [email] },
        { name: 'phone_number', values: [phone] }
      ],
      form_id: '999910002404075',
    }

    const result = await processMetaLead(rawLead as any, orgId, supabase)
    console.log(`- Lead ${name} (${email}): ${result.status}`)
    if (result.status === 'created' || result.status === 'updated') imported++
  }

  console.log(`\nImportazione CSV completata. Inseriti/Aggiornati: ${imported}`)
  
  // Sincronizza verso Google Sheets
  const sheetsMod = await import('./lib/google-sheets.js').catch(() => null)
  if (sheetsMod && sheetsMod.syncAllLeadsToSheet) {
      console.log("Forzo sincronizzazione completa verso Google Sheets...")
      const sheetRes = await sheetsMod.syncAllLeadsToSheet(orgId)
      console.log(`Google Sheets: ${sheetRes.success} (${sheetRes.count} leads totali)`)
  }
}

run()
