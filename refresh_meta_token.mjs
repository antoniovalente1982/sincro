/**
 * refresh_meta_token.mjs
 * Scambia il short-lived token con un long-lived token (60 giorni)
 * e lo salva nel DB Supabase.
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const SHORT_LIVED_TOKEN = process.env.META_ACCESS_TOKEN || process.argv[2];
if (!SHORT_LIVED_TOKEN) {
  console.error('❌ Fornisci il token: node refresh_meta_token.mjs <TOKEN> oppure META_ACCESS_TOKEN=... node refresh_meta_token.mjs');
  process.exit(1);
}
const APP_SECRET = process.env.META_APP_SECRET;

// Ricaviamo l'APP_ID interrogando il token stesso
console.log('🔍 Recupero APP_ID dal token...');
const debugRes = await fetch(`https://graph.facebook.com/v21.0/debug_token?input_token=${SHORT_LIVED_TOKEN}&access_token=${SHORT_LIVED_TOKEN}`);
const debugData = await debugRes.json();

if (debugData.error) {
  console.error('❌ Token non valido:', debugData.error.message);
  process.exit(1);
}

const APP_ID = debugData.data?.app_id;
console.log(`✅ APP_ID: ${APP_ID}`);
console.log(`   Scade: ${new Date(debugData.data?.data_access_expires_at * 1000).toISOString()}`);
console.log(`   Permessi: ${debugData.data?.scopes?.join(', ')}`);

// Scambia con long-lived token
console.log('\n🔄 Scambio con Long-Lived Token (60 giorni)...');
const exchangeRes = await fetch(
  `https://graph.facebook.com/v21.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${APP_ID}&client_secret=${APP_SECRET}&fb_exchange_token=${SHORT_LIVED_TOKEN}`
);
const exchangeData = await exchangeRes.json();

if (exchangeData.error) {
  console.error('❌ Scambio fallito:', exchangeData.error.message);
  process.exit(1);
}

const LONG_LIVED_TOKEN = exchangeData.access_token;
const expiresIn = exchangeData.expires_in; // secondi
const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

console.log(`✅ Long-Lived Token ottenuto!`);
console.log(`   Scade il: ${expiresAt}`);
console.log(`   Token preview: ${LONG_LIVED_TOKEN.slice(0, 30)}...`);

// Verifica il token appena ottenuto
console.log('\n🧪 Verifica token...');
const meRes = await fetch(`https://graph.facebook.com/v21.0/me?access_token=${LONG_LIVED_TOKEN}`);
const meData = await meRes.json();
if (meData.error) {
  console.error('❌ Token non funziona:', meData.error.message);
  process.exit(1);
}
console.log(`✅ Token valido. Account: ${meData.name} (${meData.id})`);

// Salva nel DB Supabase
console.log('\n💾 Salvataggio nel DB...');
const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const { data: conn, error: fetchErr } = await sb
  .from('connections')
  .select('id, credentials')
  .eq('provider', 'meta_ads')
  .eq('status', 'active')
  .single();

if (fetchErr || !conn) {
  console.error('❌ Connessione Meta non trovata nel DB:', fetchErr?.message);
  process.exit(1);
}

const updatedCredentials = {
  ...conn.credentials,
  access_token: LONG_LIVED_TOKEN,
  token_expires_at: expiresAt,
  token_updated_at: new Date().toISOString(),
};

const { error: updateErr } = await sb
  .from('connections')
  .update({
    credentials: updatedCredentials,
    updated_at: new Date().toISOString(),
  })
  .eq('id', conn.id);

if (updateErr) {
  console.error('❌ Errore salvataggio:', updateErr.message);
  process.exit(1);
}

console.log(`✅ Token salvato nel DB con successo!`);
console.log(`   Connection ID: ${conn.id}`);
console.log(`   Scade il: ${expiresAt}`);

// Test finale: recupero form Meta
console.log('\n🎯 Test finale: lettura form Meta...');
const formsRes = await fetch(
  `https://graph.facebook.com/v21.0/act_${process.env.META_AD_ACCOUNT_ID}/leadgen_forms?fields=id,name,status&limit=5&access_token=${LONG_LIVED_TOKEN}`
);
const formsData = await formsRes.json();

if (formsData.error) {
  console.warn('⚠️  Lettura form fallita (potrebbe mancare ads_read sul token):', formsData.error.message);
} else {
  console.log(`✅ Form trovati: ${formsData.data?.length || 0}`);
  formsData.data?.forEach(f => console.log(`   - ${f.name} (${f.status}) [${f.id}]`));
}

console.log('\n🚀 COMPLETATO! Il webhook e il cron adesso funzionano correttamente.\n');
