/**
 * diagnose_ecommerce_readiness.mjs
 * 
 * Diagnostica completa per verificare la readiness del sistema
 * per campagne e-commerce su shop.metodosincro.it
 * 
 * Controlla:
 * 1. Token Meta e accesso all'ad account
 * 2. Pixel events (Purchase, AddToCart, ViewContent)
 * 3. Campagne attive e performance
 * 4. Custom Audiences esistenti
 * 5. Catalogo prodotti (se esiste)
 * 
 * Esegui con: node diagnose_ecommerce_readiness.mjs
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

// Get token from DB
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

async function metaGet(endpoint, params = {}) {
  const url = new URL(`https://graph.facebook.com/${META_API_VERSION}/${endpoint}`);
  url.searchParams.set('access_token', TOKEN);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url);
  return res.json();
}

console.log('\n' + '═'.repeat(60));
console.log('  🔍 DIAGNOSTICA E-COMMERCE READINESS');
console.log('  Shop: shop.metodosincro.it');
console.log('═'.repeat(60));

// ═══ 1. VERIFICA TOKEN ═══
console.log('\n=== 1. TOKEN META ===');
const me = await metaGet('me');
if (me.error) {
  console.error('❌ Token NON valido:', me.error.message);
  process.exit(1);
}
console.log(`✅ Token valido — Account: ${me.name} (${me.id})`);

// ═══ 2. AD ACCOUNT INFO ═══
console.log('\n=== 2. AD ACCOUNT ===');
const account = await metaGet(`act_${AD_ACCOUNT_ID}`, {
  fields: 'name,account_status,currency,timezone_name,amount_spent,balance,spend_cap'
});
if (account.error) {
  console.error('❌ Errore accesso ad account:', account.error.message);
} else {
  console.log(`  Nome: ${account.name}`);
  console.log(`  Status: ${account.account_status === 1 ? '✅ ATTIVO' : '⚠️ ' + account.account_status}`);
  console.log(`  Valuta: ${account.currency}`);
  console.log(`  Timezone: ${account.timezone_name}`);
  console.log(`  Speso totale: €${(account.amount_spent / 100).toLocaleString()}`);
  if (account.spend_cap) console.log(`  Spend Cap: €${(account.spend_cap / 100).toLocaleString()}`);
}

// ═══ 3. PIXEL EVENTS (ultimi 7 giorni) ═══
console.log('\n=== 3. PIXEL EVENTS (ultimi 7 giorni) ===');
const pixelStats = await metaGet(`${PIXEL_ID}/stats`, {
  aggregation: 'event',
  start_time: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
  end_time: new Date().toISOString().split('T')[0],
});
if (pixelStats.error) {
  console.error('❌ Errore lettura Pixel stats:', pixelStats.error.message);
  console.log('   (Potrebbe servire il permesso ads_read o read_insights)');
} else if (pixelStats.data) {
  const events = pixelStats.data;
  const eventSummary = {};
  events.forEach(e => {
    if (!eventSummary[e.event]) eventSummary[e.event] = { count: 0, value: 0 };
    eventSummary[e.event].count += parseInt(e.count || 0);
    eventSummary[e.event].value += parseFloat(e.value || 0);
  });
  
  const criticalEvents = ['Purchase', 'AddToCart', 'InitiateCheckout', 'ViewContent', 'PageView', 'Lead'];
  criticalEvents.forEach(evt => {
    const data = eventSummary[evt];
    if (data) {
      console.log(`  ✅ ${evt}: ${data.count} eventi${data.value > 0 ? ` (€${data.value.toFixed(2)})` : ''}`);
    } else {
      const isRequired = ['Purchase', 'AddToCart', 'ViewContent'].includes(evt);
      console.log(`  ${isRequired ? '❌' : '⚠️'} ${evt}: NESSUN EVENTO${isRequired ? ' — CRITICO per e-commerce!' : ''}`);
    }
  });
  
  // Show all other events
  Object.entries(eventSummary).filter(([k]) => !criticalEvents.includes(k)).forEach(([evt, data]) => {
    console.log(`  ℹ️  ${evt}: ${data.count} eventi`);
  });
} else {
  console.log('  ⚠️ Nessun dato Pixel disponibile');
}

// ═══ 4. CAMPAGNE ATTIVE ═══
console.log('\n=== 4. CAMPAGNE ATTIVE ===');
const campaigns = await metaGet(`act_${AD_ACCOUNT_ID}/campaigns`, {
  fields: 'name,status,objective,daily_budget,lifetime_budget,start_time,created_time',
  filtering: JSON.stringify([{field:'effective_status', operator:'IN', value:['ACTIVE','PAUSED']}]),
  limit: '20',
});
if (campaigns.error) {
  console.error('❌ Errore lettura campagne:', campaigns.error.message);
} else if (campaigns.data?.length) {
  console.log(`  Trovate ${campaigns.data.length} campagne:`);
  campaigns.data.forEach(c => {
    const budget = c.daily_budget ? `€${(c.daily_budget / 100).toFixed(0)}/day` : 
                   c.lifetime_budget ? `€${(c.lifetime_budget / 100).toFixed(0)} lifetime` : 'N/A';
    const emoji = c.status === 'ACTIVE' ? '🟢' : '⏸️';
    console.log(`  ${emoji} ${c.name}`);
    console.log(`     Obiettivo: ${c.objective} | Budget: ${budget} | Status: ${c.status}`);
  });
} else {
  console.log('  ℹ️ Nessuna campagna attiva o in pausa trovata');
}

// ═══ 5. INSIGHTS ULTIMI 30 GIORNI ═══
console.log('\n=== 5. PERFORMANCE ULTIMI 30 GIORNI ===');
const insights = await metaGet(`act_${AD_ACCOUNT_ID}/insights`, {
  fields: 'spend,impressions,clicks,cpc,cpm,ctr,actions,action_values,purchase_roas',
  date_preset: 'last_30d',
  level: 'account',
});
if (insights.error) {
  console.error('❌ Errore lettura insights:', insights.error.message);
} else if (insights.data?.length) {
  const d = insights.data[0];
  console.log(`  Spesa: €${parseFloat(d.spend).toFixed(2)}`);
  console.log(`  Impressions: ${parseInt(d.impressions).toLocaleString()}`);
  console.log(`  Click: ${parseInt(d.clicks).toLocaleString()}`);
  console.log(`  CPC: €${parseFloat(d.cpc).toFixed(2)}`);
  console.log(`  CPM: €${parseFloat(d.cpm).toFixed(2)}`);
  console.log(`  CTR: ${parseFloat(d.ctr).toFixed(2)}%`);
  
  if (d.purchase_roas) {
    d.purchase_roas.forEach(r => {
      console.log(`  📊 ROAS (${r.action_type}): ${parseFloat(r.value).toFixed(2)}`);
    });
  }
  
  if (d.actions) {
    console.log('\n  Conversioni:');
    d.actions.forEach(a => {
      console.log(`    ${a.action_type}: ${a.value}`);
    });
  }
  
  if (d.action_values) {
    console.log('\n  Valori conversioni:');
    d.action_values.forEach(a => {
      console.log(`    ${a.action_type}: €${parseFloat(a.value).toFixed(2)}`);
    });
  }
} else {
  console.log('  ℹ️ Nessun dato disponibile');
}

// ═══ 6. CUSTOM AUDIENCES ESISTENTI ═══
console.log('\n=== 6. CUSTOM AUDIENCES ===');
const audiences = await metaGet(`act_${AD_ACCOUNT_ID}/customaudiences`, {
  fields: 'name,subtype,approximate_count_lower_bound,approximate_count_upper_bound,time_created',
  limit: '20',
});
if (audiences.error) {
  console.error('❌ Errore lettura audiences:', audiences.error.message);
} else if (audiences.data?.length) {
  console.log(`  Trovate ${audiences.data.length} Custom Audiences:`);
  audiences.data.forEach(a => {
    const size = a.approximate_count_lower_bound 
      ? `${a.approximate_count_lower_bound.toLocaleString()}-${a.approximate_count_upper_bound.toLocaleString()}`
      : 'N/A';
    console.log(`  📋 ${a.name} (${a.subtype}) — Size: ${size}`);
  });
} else {
  console.log('  ℹ️ Nessuna Custom Audience trovata — da creare!');
}

// ═══ 7. AD SETS CON PERFORMANCE (ultimi 7 giorni) ═══
console.log('\n=== 7. TOP AD SETS (ultimi 7 giorni) ===');
const adsets = await metaGet(`act_${AD_ACCOUNT_ID}/adsets`, {
  fields: 'name,status,daily_budget,optimization_goal,targeting',
  filtering: JSON.stringify([{field:'effective_status', operator:'IN', value:['ACTIVE']}]),
  limit: '10',
});
if (adsets.error) {
  console.error('❌ Errore lettura ad sets:', adsets.error.message);
} else if (adsets.data?.length) {
  for (const as of adsets.data) {
    const budget = as.daily_budget ? `€${(as.daily_budget / 100).toFixed(0)}/day` : 'N/A';
    console.log(`\n  🎯 ${as.name}`);
    console.log(`     Budget: ${budget} | Ottimizzazione: ${as.optimization_goal} | Status: ${as.status}`);
    if (as.targeting) {
      console.log(`     Età: ${as.targeting.age_min}-${as.targeting.age_max} | Paesi: ${as.targeting.geo_locations?.countries?.join(',')}`);
    }
  }
} else {
  console.log('  ℹ️ Nessun ad set attivo');
}

console.log('\n' + '═'.repeat(60));
console.log('  DIAGNOSTICA COMPLETATA');
console.log('═'.repeat(60));
console.log('\n📋 SUMMARY:');
console.log('  - Token: OK');
console.log('  - Pixel events: vedi sopra (Purchase è CRITICO)');
console.log('  - Per procedere con e-commerce serve:');
console.log('    1. Verificare eventi Purchase nel Pixel');
console.log('    2. Creare bundle products su WooCommerce');
console.log('    3. Creare Custom Audiences');
console.log('    4. Lanciare campagne OUTCOME_SALES\n');
