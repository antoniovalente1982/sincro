/**
 * activate_ads_batch.mjs
 * 
 * Attiva tutte le inserzioni (Ads) delle 3 nuove campagne e-commerce
 * in un'unica richiesta Batch per evitare i limiti di frequenza (rate limits) di Meta.
 * 
 * Esegui con: node scripts/activate_ads_batch.mjs
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
const AD_ACCOUNT = `act_${AD_ACCOUNT_ID}`;

async function main() {
  console.log('🏁 Recupero di tutte le inserzioni dell\'account...');
  
  // 1. Recupera tutte le ads dell'account in una sola chiamata
  const url = new URL(`https://graph.facebook.com/${META_API_VERSION}/${AD_ACCOUNT}/ads`);
  url.searchParams.set('access_token', TOKEN);
  url.searchParams.set('fields', 'id,name,status,campaign{id}');
  url.searchParams.set('limit', '500');

  const res = await fetch(url);
  const adsData = await res.json();

  if (adsData.error) {
    console.error('❌ Errore nel recupero delle inserzioni:', adsData.error);
    process.exit(1);
  }

  const allAds = adsData.data || [];
  console.log(`   Trovate ${allAds.length} inserzioni totali nell'account.`);

  // Filtra per le inserzioni che appartengono alle nostre 3 campagne e che sono in PAUSED
  const adsToActivate = allAds.filter(ad => 
    ad.campaign && 
    CAMPAIGN_IDS.includes(ad.campaign.id) && 
    ad.status !== 'ACTIVE'
  );

  console.log(`   Trovate ${adsToActivate.length} inserzioni da attivare.`);

  if (adsToActivate.length === 0) {
    console.log('🎉 Tutte le inserzioni sono già attive o non ci sono inserzioni da attivare!');
    process.exit(0);
  }

  // 2. Crea il payload Batch (limite di 50 richieste per chiamata batch su Graph API)
  console.log('\n🔄 Preparazione ed invio delle richieste batch a Meta...');
  
  // Dividi in blocchi da 40 per sicurezza
  const chunkSize = 40;
  for (let i = 0; i < adsToActivate.length; i += chunkSize) {
    const chunk = adsToActivate.slice(i, i + chunkSize);
    
    // Costruisci l'array batch
    const batchRequests = chunk.map(ad => ({
      method: 'POST',
      relative_url: `${ad.id}`,
      body: 'status=ACTIVE'
    }));

    console.log(`   Invio blocco ${Math.floor(i/chunkSize) + 1} (${chunk.length} inserzioni)...`);

    const batchUrl = `https://graph.facebook.com/${META_API_VERSION}/`;
    const formData = new URLSearchParams();
    formData.append('access_token', TOKEN);
    formData.append('batch', JSON.stringify(batchRequests));

    const batchRes = await fetch(batchUrl, {
      method: 'POST',
      body: formData
    });

    const batchResult = await batchRes.json();
    
    if (batchResult.error) {
      console.error('❌ Errore nella chiamata batch:', batchResult.error);
      continue;
    }

    // Controlla i singoli risultati
    let successCount = 0;
    batchResult.forEach((res, index) => {
      if (res.code === 200) {
        successCount++;
        // console.log(`      ✅ Attivata ad: ${chunk[index].name} (${chunk[index].id})`);
      } else {
        console.error(`      ❌ Errore attivazione ad: ${chunk[index].name} (${chunk[index].id}):`, res.body);
      }
    });

    console.log(`   ✅ Blocco completato: ${successCount}/${chunk.length} inserzioni attivate con successo!`);
  }

  console.log('\n' + '═'.repeat(60));
  console.log(`🎉 PROCESSO DI ATTIVAZIONE COMPLETATO!`);
  console.log('═'.repeat(60) + '\n');
}

main().catch(err => {
  console.error('❌ Fatal error:', err);
});
