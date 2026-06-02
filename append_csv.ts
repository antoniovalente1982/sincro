import fs from 'fs'
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import { appendLeadToSheet } from './lib/google-sheets.js'

dotenv.config({ path: '.env.local' })
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

async function run() {
  const { data: conn } = await supabase.from('connections').select('*').eq('provider', 'meta_ads').single()
  const orgId = conn?.organization_id
  if (!orgId) return

  const csvContent = fs.readFileSync('leads da reinserire csv.csv', 'utf-8')
  const lines = csvContent.split('\n').map(l => l.trim()).filter(l => l)
  const dataLines = lines.slice(1) // Skip header

  let appended = 0
  
  for (let i = 0; i < dataLines.length; i++) {
    const row = dataLines[i].split(',')
    const dateStr = row[0]
    const name = row[1]
    const email = row[2]
    const phone = row[9]

    if (name.includes('test lead') || email.includes('test@meta.com')) continue

    const leadData = {
      name,
      email,
      phone,
      funnel: 'Modulo quiz interattivo (1 giugno 2026)',
      utm_source: 'facebook',
      utm_campaign: '',
      created_at: new Date(dateStr.replace('am', ' AM').replace('pm', ' PM')).toISOString()
    }

    const success = await appendLeadToSheet(orgId, leadData)
    if (success) {
      console.log(`✅ Aggiunto al foglio: ${name}`)
      appended++
    } else {
      console.log(`❌ Errore Google Sheets per: ${name}`)
    }
  }

  console.log(`\nCompletato. ${appended} lead aggiunti in fondo al foglio.`)
}

run()
