/**
 * update_ads_links.mjs
 * 
 * Aggiorna i link delle 32 inserzioni Meta Ads (in stato PAUSED)
 * per farle puntare direttamente alle rispettive pagine prodotto WooCommerce.
 * 
 * Versione ottimizzata:
 * 1. Idempotente (non ricrea i creativi se già esistenti, salta le ads già aggiornate)
 * 2. Rate-limit aware (inserisce ritardi per evitare l'errore "User request limit reached" di Meta)
 * 
 * Esegui con: node scripts/update_ads_links.mjs
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

// Creative IDs già creati con successo nel primo run
const CREATIVE_IDS = {
  'Guida Genitori Leader': '922400667010537',
  'Guida Autostima Campione': '1186379816943862',
  'Habit Tracker Campione': '1377677270924315',
  'Strategie Mentali Vol1': '1923104215075390'
};

const AD_DESIGNS = [
  { name: 'Guida Genitori Leader' },
  { name: 'Guida Autostima Campione' },
  { name: 'Habit Tracker Campione' },
  { name: 'Strategie Mentali Vol1' }
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
  
  // Wait 1.5 seconds before any read to prevent hitting rate limits
  await sleep(1500);
  
  const res = await fetch(url);
  return res.json();
}

async function metaPost(endpoint, body) {
  const url = `https://graph.facebook.com/${META_API_VERSION}/${endpoint}`;
  
  // Wait 2.5 seconds before any write to prevent hitting rate limits
  await sleep(2500);
  
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
  console.log('🏁 Aggiornamento inserzioni con link specifici (Rate-Limit Aware)...');
  console.log('   Creative IDs utilizzati:', JSON.stringify(CREATIVE_IDS, null, 2));
  
  let updatedCount = 0;
  let skippedCount = 0;

  for (const adSetId of AD_SET_IDS) {
    console.log(`\n📂 Analisi Ad Set: ${adSetId}...`);
    
    // Recupera tutte le inserzioni di questo gruppo inclusi i dettagli sul creative corrente
    let adsRes;
    let retries = 3;
    
    while (retries > 0) {
      try {
        adsRes = await metaGet(`${adSetId}/ads`, { fields: 'id,name,creative{id}' });
        if (adsRes.error) {
          throw new Error(adsRes.error.message);
        }
        break;
      } catch (err) {
        retries--;
        console.warn(`   ⚠️ Errore nel recupero delle ads (AdSet: ${adSetId}). Tentativi rimasti: ${retries}. Errore: ${err.message}`);
        if (retries > 0) {
          console.log('      Attesa di 10 secondi prima di riprovare...');
          await sleep(10000);
        } else {
          console.error(`   ❌ Fallito definitivamente il recupero per AdSet: ${adSetId}`);
        }
      }
    }

    if (!adsRes || !adsRes.data) continue;

    const ads = adsRes.data;
    console.log(`   Trovate ${ads.length} inserzioni in questo gruppo.`);

    for (const ad of ads) {
      const matchingDesign = AD_DESIGNS.find(d => ad.name === `ECOM - ${d.name}`);
      if (!matchingDesign) {
        console.log(`      ➖ Salto ad non corrispondente: "${ad.name}"`);
        continue;
      }

      const newCreativeId = CREATIVE_IDS[matchingDesign.name];
      const currentCreativeId = ad.creative?.id;

      if (currentCreativeId === newCreativeId) {
        console.log(`      ✅ Ad "${ad.name}" è già aggiornata (Creative ID: ${currentCreativeId}). Salto.`);
        skippedCount++;
        continue;
      }

      console.log(`      🔄 Aggiornamento Ad "${ad.name}" (${ad.id}): Creative ${currentCreativeId || 'N/A'} ➔ ${newCreativeId}...`);
      
      let updateSuccess = false;
      let updateRetries = 3;
      
      while (updateRetries > 0 && !updateSuccess) {
        try {
          await metaPost(ad.id, {
            creative: { creative_id: newCreativeId }
          });
          updateSuccess = true;
          updatedCount++;
          console.log(`         🎉 Aggiornata con successo!`);
        } catch (err) {
          updateRetries--;
          console.warn(`         ⚠️ Errore aggiornamento ad (Ad ID: ${ad.id}). Tentativi rimasti: ${updateRetries}. Errore: ${err.message}`);
          if (updateRetries > 0) {
            console.log('            Attesa di 15 secondi prima di riprovare...');
            await sleep(15000);
          }
        }
      }

      if (!updateSuccess) {
        console.error(`         ❌ Impossibile aggiornare l'Ad ${ad.name} (ID: ${ad.id}) dopo molteplici tentativi.`);
      }
    }
  }

  console.log('\n' + '═'.repeat(60));
  console.log(`🎉 RUN COMPLETATO!`);
  console.log(`   Aggiornate: ${updatedCount} inserzioni.`);
  console.log(`   Già corrette (saltate): ${skippedCount} inserzioni.`);
  console.log('═'.repeat(60) + '\n');
}

main().catch(err => {
  console.error('❌ Fatal error:', err);
});
