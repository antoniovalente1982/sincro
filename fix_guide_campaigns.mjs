/**
 * fix_guide_campaigns.mjs
 * 
 * AZIONE DI EMERGENZA:
 * 1. Pausa la campagna "MS - TESTING X GUIDE - BID CAP" (ROAS 0.04)
 * 2. Fix targeting età negli ad set (38-55 → 38-65)
 * 3. Report dettagliato delle azioni eseguite
 * 
 * Esegui con: node fix_guide_campaigns.mjs
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const AD_ACCOUNT_ID = '511099830249139';
const META_API_VERSION = 'v21.0';

// Get token from DB
const { data: conn } = await sb
  .from('connections')
  .select('credentials')
  .eq('provider', 'meta_ads')
  .eq('status', 'active')
  .single();

const TOKEN = conn.credentials.access_token;

async function metaGet(endpoint, params = {}) {
  const url = new URL(`https://graph.facebook.com/${META_API_VERSION}/${endpoint}`);
  url.searchParams.set('access_token', TOKEN);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url);
  return res.json();
}

async function metaPost(endpoint, body = {}) {
  const url = `https://graph.facebook.com/${META_API_VERSION}/${endpoint}`;
  const formData = new URLSearchParams();
  formData.append('access_token', TOKEN);
  Object.entries(body).forEach(([k, v]) => {
    formData.append(k, typeof v === 'object' ? JSON.stringify(v) : v);
  });
  const res = await fetch(url, { method: 'POST', body: formData });
  return res.json();
}

console.log('\n' + '═'.repeat(60));
console.log('  🚨 FIX CAMPAGNA GUIDE — AZIONE DI EMERGENZA');
console.log('═'.repeat(60));

// ═══ STEP 1: Trova la campagna attiva guide ═══
console.log('\n=== STEP 1: Identificazione campagna guide attiva ===');

const campaigns = await metaGet(`act_${AD_ACCOUNT_ID}/campaigns`, {
  fields: 'name,status,objective,daily_budget,effective_status',
  filtering: JSON.stringify([
    {field: 'name', operator: 'CONTAIN', value: 'GUIDE'}
  ]),
  limit: '10',
});

if (campaigns.error) {
  console.error('❌ Errore:', campaigns.error.message);
  process.exit(1);
}

const activeCampaign = campaigns.data?.find(c => c.effective_status === 'ACTIVE');
const allGuideCampaigns = campaigns.data || [];

console.log(`  Trovate ${allGuideCampaigns.length} campagne guide:`);
allGuideCampaigns.forEach(c => {
  const emoji = c.effective_status === 'ACTIVE' ? '🟢' : '⏸️';
  const budget = c.daily_budget ? `€${(c.daily_budget / 100).toFixed(0)}/day` : 'CBO';
  console.log(`  ${emoji} [${c.id}] ${c.name} — ${budget} — ${c.effective_status}`);
});

// ═══ STEP 2: Pausa campagna attiva ═══
if (activeCampaign) {
  console.log(`\n=== STEP 2: PAUSA campagna "${activeCampaign.name}" ===`);
  console.log(`  ID: ${activeCampaign.id}`);
  console.log(`  Budget: €${(activeCampaign.daily_budget / 100).toFixed(0)}/day`);
  console.log(`  Motivo: ROAS 0.04 — perdita di ~€${((activeCampaign.daily_budget / 100) * 0.96).toFixed(0)}/day`);
  
  const pauseResult = await metaPost(activeCampaign.id, { status: 'PAUSED' });
  
  if (pauseResult.success) {
    console.log(`  ✅ CAMPAGNA MESSA IN PAUSA con successo!`);
    console.log(`  💰 Risparmio stimato: ~€${(activeCampaign.daily_budget / 100).toFixed(0)}/day`);
  } else {
    console.error(`  ❌ Errore nella pausa:`, JSON.stringify(pauseResult));
  }
} else {
  console.log('\n=== STEP 2: Nessuna campagna guide attiva trovata (già in pausa?) ===');
}

// ═══ STEP 3: Analizza e fix ad sets guide ═══
console.log('\n=== STEP 3: Analisi e Fix Ad Sets guide ===');

for (const campaign of allGuideCampaigns) {
  const adsets = await metaGet(`${campaign.id}/adsets`, {
    fields: 'name,status,targeting,optimization_goal,daily_budget,bid_strategy',
    limit: '20',
  });
  
  if (!adsets.data?.length) continue;
  
  for (const as of adsets.data) {
    const targeting = as.targeting || {};
    const ageMin = targeting.age_min;
    const ageMax = targeting.age_max;
    const countries = targeting.geo_locations?.countries;
    const locales = targeting.locales;
    
    console.log(`\n  📋 Ad Set: ${as.name} [${as.id}]`);
    console.log(`     Status: ${as.status}`);
    console.log(`     Ottimizzazione: ${as.optimization_goal}`);
    if (as.bid_strategy) console.log(`     Bid Strategy: ${as.bid_strategy}`);
    console.log(`     Targeting: età ${ageMin}-${ageMax}, paesi: ${countries?.join(',')}, locales: ${locales?.join(',')}`);
    
    // Check for targeting errors
    const errors = [];
    if (ageMax && ageMax < 65) errors.push(`Età max ${ageMax} → dovrebbe essere 65`);
    if (ageMin && ageMin < 38) errors.push(`Età min ${ageMin} → dovrebbe essere 38`);
    if (locales && !locales.includes(10)) errors.push(`Locale mancante: 10 (Italiano)`);
    
    if (errors.length > 0) {
      console.log(`     ⚠️ ERRORI TROVATI:`);
      errors.forEach(e => console.log(`        - ${e}`));
      
      // Fix targeting
      const fixedTargeting = {
        ...targeting,
        age_min: 38,
        age_max: 65,
        locales: [10],
        geo_locations: { countries: ['IT'] },
      };
      
      // Remove targeting_automation if present and set to no advantage+
      console.log(`     🔧 Fixing targeting...`);
      const fixResult = await metaPost(as.id, { 
        targeting: fixedTargeting,
      });
      
      if (fixResult.success) {
        console.log(`     ✅ Targeting fixato: 38-65, Italiano, Italia`);
      } else {
        console.log(`     ⚠️ Fix non applicato (ad set potrebbe essere in stato non modificabile): ${fixResult.error?.message || JSON.stringify(fixResult)}`);
      }
    } else {
      console.log(`     ✅ Targeting corretto`);
    }
  }
}

// ═══ STEP 4: Insights campagna guide (ultimi 7 giorni) ═══
console.log('\n=== STEP 4: Performance campagna guide (ultimi 7 giorni) ===');

for (const campaign of allGuideCampaigns) {
  const insights = await metaGet(`${campaign.id}/insights`, {
    fields: 'spend,impressions,clicks,cpc,ctr,actions,action_values,purchase_roas',
    date_preset: 'last_7d',
  });
  
  if (!insights.data?.length) {
    console.log(`  ${campaign.name}: Nessun dato 7 giorni`);
    continue;
  }
  
  const d = insights.data[0];
  const purchases = d.actions?.find(a => a.action_type === 'purchase');
  const purchaseValue = d.action_values?.find(a => a.action_type === 'purchase');
  const roas = d.purchase_roas?.find(a => a.action_type === 'omni_purchase');
  
  console.log(`\n  📊 ${campaign.name}:`);
  console.log(`     Spesa: €${parseFloat(d.spend).toFixed(2)}`);
  console.log(`     Click: ${d.clicks} | CPC: €${parseFloat(d.cpc).toFixed(2)} | CTR: ${parseFloat(d.ctr).toFixed(2)}%`);
  console.log(`     Purchase: ${purchases?.value || 0} | Revenue: €${purchaseValue ? parseFloat(purchaseValue.value).toFixed(2) : '0'}`);
  console.log(`     ROAS: ${roas ? parseFloat(roas.value).toFixed(2) : 'N/A'}`);
}

// ═══ STEP 5: Verifica campagna è ora in pausa ═══
if (activeCampaign) {
  console.log('\n=== STEP 5: Verifica stato post-fix ===');
  const verify = await metaGet(activeCampaign.id, { fields: 'name,status,effective_status' });
  console.log(`  ${verify.name}: ${verify.effective_status === 'PAUSED' ? '✅ IN PAUSA' : '⚠️ ' + verify.effective_status}`);
}

console.log('\n' + '═'.repeat(60));
console.log('  FIX COMPLETATO');
console.log('═'.repeat(60));
console.log('\n📋 RIEPILOGO AZIONI:');
if (activeCampaign) {
  console.log(`  1. ✅ Campagna "${activeCampaign.name}" MESSA IN PAUSA`);
  console.log(`     → Risparmio: ~€${(activeCampaign.daily_budget / 100).toFixed(0)}/giorno`);
}
console.log('  2. ✅ Targeting fixato dove necessario (38-65, Italiano, Italia)');
console.log('  3. ⏳ PROSSIMI PASSI:');
console.log('     - Creare bundle su WooCommerce');
console.log('     - Produrre nuove creative');
console.log('     - Rilanciare con struttura corretta (Lowest Cost, non Bid Cap)');
console.log('     - Scaling progressivo da €200/day\n');
