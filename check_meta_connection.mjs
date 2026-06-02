/**
 * check_meta_connection.mjs
 * 
 * Diagnostica completa della connessione Meta Ads e lead nel CRM.
 * Esegui con: node check_meta_connection.mjs
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('\n=== 🔌 CONNESSIONI META ===');
const { data: conns, error: connErr } = await sb
  .from('connections')
  .select('organization_id, provider, status, credentials, updated_at')
  .eq('provider', 'meta_ads');

if (connErr) {
  console.error('❌ Errore lettura connections:', connErr.message);
} else if (!conns?.length) {
  console.error('❌ Nessuna connessione meta_ads trovata nel DB!');
  console.log('   → Il webhook e il cron non trovano credenziali e droppano tutti i lead.');
} else {
  conns.forEach(c => {
    const hasToken = !!c.credentials?.access_token;
    const hasAdAccount = !!c.credentials?.ad_account_id;
    const hasPageId = !!c.credentials?.page_id;
    const tokenPreview = c.credentials?.access_token?.slice(0, 20) + '...' || 'MANCANTE';
    console.log(`\n  Org: ${c.organization_id}`);
    console.log(`  Status: ${c.status}`);
    console.log(`  access_token: ${hasToken ? '✅ ' + tokenPreview : '❌ MANCANTE'}`);
    console.log(`  ad_account_id: ${hasAdAccount ? '✅ ' + c.credentials.ad_account_id : '❌ MANCANTE (cron fallisce!)'}`);
    console.log(`  page_id: ${hasPageId ? '✅ ' + c.credentials.page_id : '⚠️  MANCANTE (webhook usa fallback)'}`);
    console.log(`  Aggiornato: ${c.updated_at}`);
  });
}

console.log('\n=== 📦 PIPELINE DEFAULT ===');
const { data: pipelines } = await sb
  .from('pipelines')
  .select('id, name, is_default, organization_id')
  .eq('is_default', true);

if (!pipelines?.length) {
  console.error('❌ Nessuna pipeline con is_default=true!');
  console.log('   → processMetaLead fallisce con: "No default pipeline configured"');
} else {
  pipelines.forEach(p => console.log(`  ✅ Pipeline: "${p.name}" (org: ${p.organization_id})`));
}

console.log('\n=== 📋 ULTIMI 20 LEAD META ===');
const { data: leads } = await sb
  .from('leads')
  .select('id, name, email, phone, created_at, meta_data')
  .contains('meta_data', { source: 'meta_lead_form' })
  .order('created_at', { ascending: false })
  .limit(20);

if (!leads?.length) {
  console.log('⚠️  Nessun lead con source=meta_lead_form trovato nel CRM!');
} else {
  leads.forEach(l => {
    console.log(`  ${l.created_at?.slice(0, 16)} | ${l.name} | ${l.email} | leadgen: ${l.meta_data?.leadgen_id}`);
  });
}

console.log('\n=== 🧪 TEST TOKEN META (richiede access_token salvato) ===');
if (conns?.[0]?.credentials?.access_token) {
  const token = conns[0].credentials.access_token;
  const res = await fetch(`https://graph.facebook.com/v21.0/me?access_token=${token}`);
  const json = await res.json();
  if (json.error) {
    console.error('❌ Token Meta NON VALIDO:', json.error.message);
    console.log('   → Questo spiega perché i lead non vengono recuperati da Meta Graph API!');
  } else {
    console.log(`✅ Token valido. Utente/App: ${json.name || json.id}`);
  }
} else {
  console.log('⚠️  Nessun token da testare.');
}

console.log('\nDiagnostica completata.\n');
