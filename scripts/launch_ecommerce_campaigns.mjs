/**
 * launch_ecommerce_campaigns.mjs
 * 
 * Crea la nuova struttura di campagne e-commerce Meta Ads per la vendita delle guide
 * su shop.metodosincro.it (Direct Homepage Strategy).
 * 
 * Campagne create (in stato PAUSED per sicurezza):
 * 1. MS - [ECOM] Prospecting CBO (€200/day)
 * 2. MS - [ECOM] Retargeting ABO
 * 3. MS - [ECOM] Testing Creative ABO
 * 
 * Esegui con: node scripts/launch_ecommerce_campaigns.mjs
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const AD_ACCOUNT_ID = process.env.META_AD_ACCOUNT_ID || '511099830249139';
const PIXEL_ID = '311586900940615';
const META_API_VERSION = 'v21.0';

// Audience IDs recuperati dalla diagnostica
const LAL_CLIENTI_REALI_ID = '120243944245830047';
const LAL_CSV_STORICO_ID = '120243946479160047';
const ECOM_BUYERS_SHOP_ID = '120249017987090047'; // Esclusione
const ECOM_ADD_TO_CART_ID = '120249017985540047'; // Retargeting
const ECOM_VIEW_CONTENT_ID = '120249017986070047'; // Retargeting
const IG_ENGAGERS_90D_ID = '23858321161390046';   // Retargeting

// Ottieni token da DB
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

async function metaPost(endpoint, body) {
  const url = `https://graph.facebook.com/${META_API_VERSION}/${endpoint}`;
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

// Targeting di default blindato (38-65 IT, Advantage+ Audience SPENTO)
const baseTargeting = {
  geo_locations: { countries: ['IT'] },
  age_min: 38,
  age_max: 65,
  locales: [10], // Italiano
  publisher_platforms: ['facebook', 'instagram'],
  targeting_automation: { advantage_audience: 0 }
};

// Interessi Genitori + Calcio
const interessiGenitoriCalcio = {
  ...baseTargeting,
  flexible_spec: [
    {
      interests: [
        { id: '6003107902433', name: 'Calcio (calcio)' },
        { id: '6003332764437', name: 'Genitori' },
        { id: '6004087957374', name: 'Preparazione atletica' }
      ]
    }
  ]
};

async function main() {
  console.log('🚀 Inizio setup delle campagne e-commerce Meta Ads (Direct Homepage Strategy)...');
  console.log(`   Ad Account: ${AD_ACCOUNT}`);
  console.log(`   Pixel ID: ${PIXEL_ID}\n`);

  console.log('🧹 Pulizia campagne duplicate precedenti...');
  try {
    const deleteRes = await fetch(`https://graph.facebook.com/${META_API_VERSION}/120249018037010047?access_token=${TOKEN}`, {
      method: 'DELETE'
    });
    const deleteData = await deleteRes.json();
    if (deleteData.success) {
      console.log('   ✅ Campagna duplicata precedente eliminata (ID: 120249018037010047)');
    }
  } catch (err) {
    console.log('   ℹ️ Nessuna campagna precedente da eliminare o errore di eliminazione:', err.message);
  }

  // ════════════════ CAMPAGNA 1: PROSPECTING CBO ════════════════
  console.log('\n📦 Creazione Campagna 1: Prospecting CBO (PAUSED)...');
  const prospectingCampaign = await metaPost(`${AD_ACCOUNT}/campaigns`, {
    name: 'MS - [ECOM] Prospecting CBO',
    objective: 'OUTCOME_SALES',
    status: 'PAUSED',
    special_ad_categories: ['NONE'],
    daily_budget: 20000, // €200/day
    bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
    is_adset_budget_sharing_enabled: false
  });
  console.log(`   ✅ Creata con successo! ID: ${prospectingCampaign.id}`);

  // Ad Set 1: LAL 1% Clienti Reali
  console.log('   🎯 Ad Set 1: LAL 1% Clienti Reali...');
  const adsetLalClienti = await metaPost(`${AD_ACCOUNT}/adsets`, {
    name: 'LAL 1% Clienti Reali',
    campaign_id: prospectingCampaign.id,
    billing_event: 'IMPRESSIONS',
    optimization_goal: 'OFFSITE_CONVERSIONS',
    bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
    promoted_object: { pixel_id: PIXEL_ID, custom_event_type: 'PURCHASE' },
    targeting: {
      ...baseTargeting,
      custom_audiences: [{ id: LAL_CLIENTI_REALI_ID }],
      excluded_custom_audiences: [{ id: ECOM_BUYERS_SHOP_ID }]
    },
    status: 'PAUSED'
  });
  console.log(`      ✅ ID: ${adsetLalClienti.id}`);

  // Ad Set 2: LAL 1% CSV Storico
  console.log('   🎯 Ad Set 2: LAL 1% CSV Storico...');
  const adsetLalCsv = await metaPost(`${AD_ACCOUNT}/adsets`, {
    name: 'LAL 1% CSV Storico',
    campaign_id: prospectingCampaign.id,
    billing_event: 'IMPRESSIONS',
    optimization_goal: 'OFFSITE_CONVERSIONS',
    bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
    promoted_object: { pixel_id: PIXEL_ID, custom_event_type: 'PURCHASE' },
    targeting: {
      ...baseTargeting,
      custom_audiences: [{ id: LAL_CSV_STORICO_ID }],
      excluded_custom_audiences: [{ id: ECOM_BUYERS_SHOP_ID }]
    },
    status: 'PAUSED'
  });
  console.log(`      ✅ ID: ${adsetLalCsv.id}`);

  // Ad Set 3: Broad IT 38-65
  console.log('   🎯 Ad Set 3: Broad IT 38-65...');
  const adsetBroad = await metaPost(`${AD_ACCOUNT}/adsets`, {
    name: 'Broad IT 38-65',
    campaign_id: prospectingCampaign.id,
    billing_event: 'IMPRESSIONS',
    optimization_goal: 'OFFSITE_CONVERSIONS',
    bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
    promoted_object: { pixel_id: PIXEL_ID, custom_event_type: 'PURCHASE' },
    targeting: {
      ...baseTargeting,
      excluded_custom_audiences: [{ id: ECOM_BUYERS_SHOP_ID }]
    },
    status: 'PAUSED'
  });
  console.log(`      ✅ ID: ${adsetBroad.id}`);

  // Ad Set 4: Interessi Genitori + Calcio
  console.log('   🎯 Ad Set 4: Interessi Genitori + Calcio...');
  const adsetInteressi = await metaPost(`${AD_ACCOUNT}/adsets`, {
    name: 'Interessi Genitori + Calcio',
    campaign_id: prospectingCampaign.id,
    billing_event: 'IMPRESSIONS',
    optimization_goal: 'OFFSITE_CONVERSIONS',
    bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
    promoted_object: { pixel_id: PIXEL_ID, custom_event_type: 'PURCHASE' },
    targeting: {
      ...interessiGenitoriCalcio,
      excluded_custom_audiences: [{ id: ECOM_BUYERS_SHOP_ID }]
    },
    status: 'PAUSED'
  });
  console.log(`      ✅ ID: ${adsetInteressi.id}`);


  // ════════════════ CAMPAGNA 2: RETARGETING ABO ════════════════
  console.log('\n📦 Creazione Campagna 2: Retargeting ABO (PAUSED)...');
  const retargetingCampaign = await metaPost(`${AD_ACCOUNT}/campaigns`, {
    name: 'MS - [ECOM] Retargeting ABO',
    objective: 'OUTCOME_SALES',
    status: 'PAUSED',
    special_ad_categories: ['NONE'],
    is_adset_budget_sharing_enabled: false
  });
  console.log(`   ✅ Creata con successo! ID: ${retargetingCampaign.id}`);

  // Ad Set 1: ECOM - AddToCart no Purchase (14d)
  console.log('   🎯 Ad Set 1: AddToCart (14d)...');
  const adsetRtAtc = await metaPost(`${AD_ACCOUNT}/adsets`, {
    name: 'AddToCart (14d) no Purchase',
    campaign_id: retargetingCampaign.id,
    daily_budget: 2000, // €20/day
    billing_event: 'IMPRESSIONS',
    optimization_goal: 'OFFSITE_CONVERSIONS',
    bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
    promoted_object: { pixel_id: PIXEL_ID, custom_event_type: 'PURCHASE' },
    targeting: {
      ...baseTargeting,
      custom_audiences: [{ id: ECOM_ADD_TO_CART_ID }],
      excluded_custom_audiences: [{ id: ECOM_BUYERS_SHOP_ID }]
    },
    status: 'PAUSED'
  });
  console.log(`      ✅ ID: ${adsetRtAtc.id}`);

  // Ad Set 2: ECOM - ViewContent no Purchase (30d)
  console.log('   🎯 Ad Set 2: ViewContent (30d)...');
  const adsetRtVc = await metaPost(`${AD_ACCOUNT}/adsets`, {
    name: 'ViewContent (30d) no Purchase',
    campaign_id: retargetingCampaign.id,
    daily_budget: 2000, // €20/day
    billing_event: 'IMPRESSIONS',
    optimization_goal: 'OFFSITE_CONVERSIONS',
    bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
    promoted_object: { pixel_id: PIXEL_ID, custom_event_type: 'PURCHASE' },
    targeting: {
      ...baseTargeting,
      custom_audiences: [{ id: ECOM_VIEW_CONTENT_ID }],
      excluded_custom_audiences: [{ id: ECOM_BUYERS_SHOP_ID }]
    },
    status: 'PAUSED'
  });
  console.log(`      ✅ ID: ${adsetRtVc.id}`);

  // Ad Set 3: Instagram Engagers (90d)
  console.log('   🎯 Ad Set 3: Instagram Engagers (90d)...');
  const adsetRtIg = await metaPost(`${AD_ACCOUNT}/adsets`, {
    name: 'Instagram Engagers (90d)',
    campaign_id: retargetingCampaign.id,
    daily_budget: 2000, // €20/day
    billing_event: 'IMPRESSIONS',
    optimization_goal: 'OFFSITE_CONVERSIONS',
    bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
    promoted_object: { pixel_id: PIXEL_ID, custom_event_type: 'PURCHASE' },
    targeting: {
      ...baseTargeting,
      custom_audiences: [{ id: IG_ENGAGERS_90D_ID }],
      excluded_custom_audiences: [{ id: ECOM_BUYERS_SHOP_ID }]
    },
    status: 'PAUSED'
  });
  console.log(`      ✅ ID: ${adsetRtIg.id}`);


  // ════════════════ CAMPAGNA 3: TESTING CREATIVE ABO ════════════════
  console.log('\n📦 Creazione Campagna 3: Testing Creative ABO (PAUSED)...');
  const testingCampaign = await metaPost(`${AD_ACCOUNT}/campaigns`, {
    name: 'MS - [ECOM] Testing Creative ABO',
    objective: 'OUTCOME_SALES',
    status: 'PAUSED',
    special_ad_categories: ['NONE'],
    is_adset_budget_sharing_enabled: false
  });
  console.log(`   ✅ Creata con successo! ID: ${testingCampaign.id}`);

  // Ad Set 1: Broad IT 38-65 - Testing
  console.log('   🎯 Ad Set 1: Broad IT 38-65 - Testing...');
  const adsetTestBroad = await metaPost(`${AD_ACCOUNT}/adsets`, {
    name: 'Broad IT 38-65 - Testing',
    campaign_id: testingCampaign.id,
    daily_budget: 4000, // €40/day
    billing_event: 'IMPRESSIONS',
    optimization_goal: 'OFFSITE_CONVERSIONS',
    bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
    promoted_object: { pixel_id: PIXEL_ID, custom_event_type: 'PURCHASE' },
    targeting: {
      ...baseTargeting,
      excluded_custom_audiences: [{ id: ECOM_BUYERS_SHOP_ID }]
    },
    status: 'PAUSED'
  });
  console.log(`      ✅ ID: ${adsetTestBroad.id}`);

  console.log('\n' + '═'.repeat(60));
  console.log('🎉 CREAZIONE STRUTTURA COMPLETATA CON SUCCESSO!');
  console.log('   Tutte le campagne sono in stato PAUSED (In Pausa) per tua sicurezza.');
  console.log('═'.repeat(60));
  console.log('\n📋 REPORT DEI CODICI ID:');
  console.log(`1. PROSPECTING CBO:               ${prospectingCampaign.id}`);
  console.log(`   • LAL 1% Clienti Reali:        ${adsetLalClienti.id}`);
  console.log(`   • LAL 1% CSV Storico:          ${adsetLalCsv.id}`);
  console.log(`   • Broad IT 38-65:              ${adsetBroad.id}`);
  console.log(`   • Interessi Genitori+Calcio:   ${adsetInteressi.id}`);
  console.log(`2. RETARGETING ABO:               ${retargetingCampaign.id}`);
  console.log(`   • AddToCart (14d):             ${adsetRtAtc.id}`);
  console.log(`   • ViewContent (30d):           ${adsetRtVc.id}`);
  console.log(`   • Instagram Engagers (90d):    ${adsetRtIg.id}`);
  console.log(`3. TESTING CREATIVE ABO:          ${testingCampaign.id}`);
  console.log(`   • Broad IT 38-65 - Testing:    ${adsetTestBroad.id}\n`);
}

main().catch(err => {
  console.error('❌ Errore fatale durante il lancio:', err);
});
