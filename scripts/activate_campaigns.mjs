/**
 * activate_campaigns.mjs
 * 
 * Attiva le 3 nuove campagne e-commerce (MS - [ECOM]...), i loro 8 adset
 * e tutte le 32 inserzioni collegate.
 * 
 * Rate-limit aware: inserisce delay appropriati tra le chiamate API.
 * 
 * Esegui con: node scripts/activate_campaigns.mjs
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const AD_ACCOUNT_ID = process.env.META_AD_ACCOUNT_ID || '511099830249139';
const META_API_VERSION = 'v21.0';

const CAMPAIGN_IDS = [
  '120249018083390047', // MS - [ECOM] Prospecting CBO
  '120249018095780047', // MS - [ECOM] Retargeting ABO
  '120249018103230047'  // MS - [ECOM] Testing Creative ABO
];

const AD_SET_IDS = [
  '120249018084950047', // LAL 1% Clienti Reali
  '120249018089350047', // LAL 1% CSV Storico
  '120249018091320047', // Broad IT 38-65
  '120249018093110047', // Interessi Genitori+Calcio
  '120249018096700047', // AddToCart (14d)
  '120249018098980047', // ViewContent (30d)
  '120249018102070047', // Instagram Engagers (90d)
  '120249018104170047'  // Broad IT 38-65 - Testing
];

// Token da DB
const { data: conn } = await sb
  .from('connections')
  .select('credentials')
  .eq('provider', 'meta_ads')
  .eq('status', 'active')
  .single();

if (!conn?.credentials?.access_token) {
  console.error('❌ Nessun token Meta trovato nel DB!');
  process.exit(1);
}

const TOKEN = conn.credentials.access_token;

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function metaGet(endpoint, params = {}) {
  const url = new URL(`https://graph.facebook.com/${META_API_VERSION}/${endpoint}`);
  url.searchParams.set('access_token', TOKEN);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  
  await sleep(1500); // Prevent rate limits
  const res = await fetch(url);
  return res.json();
}

async function metaPost(endpoint, body) {
  const url = `https://graph.facebook.com/${META_API_VERSION}/${endpoint}`;
  
  await sleep(2500); // Prevent rate limits on writes
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...body, access_token: TOKEN })
  });
  const data = await res.json();
  if (data.error) {
    console.error(`❌ Errore Meta API su ${endpoint}:`, JSON.stringify(data.error, null, 2));
    throw new Error(data.error.message);
  }
  return data;
}

async function main() {
  console.log('🏁 Avvio attivazione campagne, gruppi e inserzioni e-commerce...');

  // 1. Attiva le Campagne
  console.log('\n🟢 1. Attivazione Campagne...');
  for (const campaignId of CAMPAIGN_IDS) {
    try {
      console.log(`   🔄 Attivazione Campagna: ${campaignId}...`);
      await metaPost(campaignId, { status: 'ACTIVE' });
      console.log(`      ✅ Campagna ${campaignId} attivata!`);
    } catch (err) {
      console.error(`      ❌ Errore attivazione campagna ${campaignId}:`, err.message);
    }
  }

  // 2. Attiva gli Ad Sets
  console.log('\n🟢 2. Attivazione Gruppi d\'Inserzione (Ad Sets)...');
  for (const adSetId of AD_SET_IDS) {
    try {
      console.log(`   🔄 Attivazione Ad Set: ${adSetId}...`);
      await metaPost(adSetId, { status: 'ACTIVE' });
      console.log(`      ✅ Ad Set ${adSetId} attivato!`);
    } catch (err) {
      console.error(`      ❌ Errore attivazione adset ${adSetId}:`, err.message);
    }
  }

  // 3. Attiva gli Ads
  console.log('\n🟢 3. Attivazione Inserzioni (Ads)...');
  for (const adSetId of AD_SET_IDS) {
    console.log(`   📂 Lettura inserzioni per Ad Set: ${adSetId}...`);
    let adsRes;
    try {
      adsRes = await metaGet(`${adSetId}/ads`, { fields: 'id,name,status' });
      if (adsRes.error) {
        throw new Error(adsRes.error.message);
      }
    } catch (err) {
      console.error(`      ❌ Errore lettura ads per adset ${adSetId}:`, err.message);
      continue;
    }

    const ads = adsRes.data || [];
    console.log(`      Trovate ${ads.length} inserzioni.`);

    for (const ad of ads) {
      if (ad.status === 'ACTIVE') {
        console.log(`      ✅ Inserzione "${ad.name}" (${ad.id}) è già attiva. Salto.`);
        continue;
      }
      
      try {
        console.log(`      🔄 Attivazione Inserzione "${ad.name}" (${ad.id})...`);
        await metaPost(ad.id, { status: 'ACTIVE' });
        console.log(`         🎉 Attivata!`);
      } catch (err) {
        console.error(`         ❌ Errore attivazione inserzione ${ad.id}:`, err.message);
        console.log('         Attesa di 10 secondi prima di continuare...');
        await sleep(10000);
      }
    }
  }

  console.log('\n' + '═'.repeat(60));
  console.log(`🎉 ATTIVAZIONE COMPLETATA!`);
  console.log(`   Le campagne, i gruppi e le inserzioni e-commerce sono ora attivi.`);
  console.log('═'.repeat(60) + '\n');
}

main().catch(err => {
  console.error('❌ Fatal error:', err);
});
