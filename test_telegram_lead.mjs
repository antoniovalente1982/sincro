/**
 * Test: notifica Telegram "nuovo lead" ai venditori collegati
 * Run: node test_telegram_lead.mjs
 */
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { resolve } from 'path'

config({ path: resolve(process.cwd(), '.env.local') })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Variabili SUPABASE mancanti nel .env.local')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

async function sendTelegramMessage(botToken, chatId, text) {
  const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
  })
  const data = await res.json()
  if (!data.ok) {
    console.error('  ❌ Telegram API error:', data.description)
    return false
  }
  return true
}

async function main() {
  console.log('🔍 Recupero organizzazioni...')
  
  // 1. Recupera tutte le org con connessione Telegram
  const { data: connections, error: connErr } = await supabase
    .from('connections')
    .select('organization_id, credentials')
    .eq('provider', 'telegram')
    .eq('status', 'active')

  if (connErr || !connections?.length) {
    console.error('❌ Nessuna connessione Telegram trovata:', connErr?.message)
    return
  }

  console.log(`✅ Trovate ${connections.length} organizzazione/i con Telegram configurato\n`)

  for (const conn of connections) {
    const orgId = conn.organization_id
    const botToken = conn.credentials?.bot_token
    const groupChatId = conn.credentials?.chat_id

    if (!botToken) {
      console.log(`⚠️  Org ${orgId}: bot_token mancante, skip`)
      continue
    }

    console.log(`\n📦 Org: ${orgId}`)
    console.log(`🤖 Bot token: ${botToken.substring(0, 20)}...`)

    // 2. Recupera tutti i venditori di questa org con telegram_chat_id
    const { data: members } = await supabase
      .from('organization_members')
      .select('user_id, role')
      .eq('organization_id', orgId)
      .is('deactivated_at', null)

    if (!members?.length) {
      console.log('  ⚠️  Nessun membro trovato')
      continue
    }

    const userIds = members.map(m => m.user_id)
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, email, telegram_chat_id')
      .in('id', userIds)

    const withTelegram = (profiles || []).filter(p => p.telegram_chat_id)
    console.log(`👥 Venditori con Telegram configurato: ${withTelegram.length}/${members.length}`)

    if (withTelegram.length === 0) {
      console.log('  ℹ️  Nessun venditore ha configurato il telegram_chat_id nel profilo')
      console.log('  → Vai su Sincro > Impostazioni > Profilo e inserisci il tuo Chat ID')
      console.log('  → Per trovarlo: scrivi /start a @userinfobot su Telegram')
      continue
    }

    // 3. Lead di test
    const testLead = {
      name: '🧪 Mario Rossi (TEST)',
      phone: '+39 333 1234567',
      email: 'mariorossi@test.com',
      funnel: 'Metodo Sincro - Test',
      source: 'Meta Lead Ads',
    }

    // 4. Invia a ciascun venditore
    for (const profile of withTelegram) {
      const memberInfo = members.find(m => m.user_id === profile.id)
      const msg =
        `🎯 <b>Lead assegnato a te, ${profile.full_name || 'Venditore'}!</b>\n\n` +
        `👤 <b>Nome:</b> ${testLead.name}\n` +
        `📱 <b>Tel:</b> ${testLead.phone}\n` +
        `📧 <b>Email:</b> ${testLead.email}\n` +
        `🔗 <b>Funnel:</b> ${testLead.funnel}\n` +
        `📡 <b>Fonte:</b> ${testLead.source}\n\n` +
        `💬 Contattalo ora dal CRM!`

      const ok = await sendTelegramMessage(botToken, profile.telegram_chat_id, msg)
      console.log(`  ${ok ? '✅' : '❌'} Inviato a ${profile.full_name || profile.email} (chat_id: ${profile.telegram_chat_id})`)
    }

    // 5. Invia anche al gruppo (notifica generale) se c'è
    if (groupChatId) {
      console.log(`\n📣 Invio notifica al gruppo (chat_id: ${groupChatId})...`)
      const groupMsg =
        `🆕 <b>Nuovo Lead in arrivo!</b>\n\n` +
        `👤 ${testLead.name}\n` +
        `📱 ${testLead.phone}\n` +
        `📧 ${testLead.email}\n` +
        `📡 ${testLead.source}\n\n` +
        `<i>(Messaggio di test)</i>`
      const ok = await sendTelegramMessage(botToken, groupChatId, groupMsg)
      console.log(`  ${ok ? '✅' : '❌'} Inviato al gruppo`)
    }
  }

  console.log('\n✅ Test completato!')
}

main().catch(console.error)
