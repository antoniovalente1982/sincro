import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const META_API_VERSION = 'v21.0';

// Get token from DB
const { data: conn } = await sb
  .from('connections')
  .select('credentials')
  .eq('provider', 'meta_ads')
  .eq('status', 'active')
  .single();

if (!conn?.credentials?.access_token) {
  console.error('❌ Token Meta non trovato');
  process.exit(1);
}

const TOKEN = conn.credentials.access_token;

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
    return { success: false, error: data.error };
  }
  return { success: true, data };
}

async function runOptimization() {
  console.log('🚀 AVVIO OTTIMIZZAZIONE E-COMMERCE META ADS...\n');

  // --- 1. Pausa Ad Sets in Prospecting ---
  const adSetsToPause = [
    { id: '120249018091320047', name: 'Broad IT 38-65' },
    { id: '120249018089350047', name: 'LAL 1% CSV Storico' }
  ];

  console.log('⏸️  Messa in pausa degli Ad Sets inefficienti...');
  for (const as of adSetsToPause) {
    const res = await metaPost(as.id, { status: 'PAUSED' });
    if (res.success) {
      console.log(`   ✅ Ad Set "${as.name}" (${as.id}) messo in PAUSA.`);
    } else {
      console.log(`   ❌ Errore messa in pausa Ad Set "${as.name}" (${as.id}): ${res.error?.message}`);
    }
  }

  // --- 2. Pausa Inserzioni Inefficienti ---
  const adsToPause = [
    // In LAL 1% Clienti Reali
    { id: '120249018751920047', name: 'ECOM - Strategie Mentali Vol1 (LAL Clienti Reali)' },
    { id: '120249018746030047', name: 'ECOM - Guida Genitori Leader (LAL Clienti Reali)' },
    { id: '120249018749970047', name: 'ECOM - Habit Tracker Campione (LAL Clienti Reali)' },
    // In Interessi Genitori + Calcio
    { id: '120249018782670047', name: 'ECOM - Guida Genitori Leader (Interessi)' },
    { id: '120249018785760047', name: 'ECOM - Guida Autostima Campione (Interessi)' },
    { id: '120249018788440047', name: 'ECOM - Habit Tracker Campione (Interessi)' }
  ];

  console.log('\n⏸️  Messa in pausa delle Inserzioni inefficienti...');
  for (const ad of adsToPause) {
    const res = await metaPost(ad.id, { status: 'PAUSED' });
    if (res.success) {
      console.log(`   ✅ Ad "${ad.name}" (${ad.id}) messa in PAUSA.`);
    } else {
      console.log(`   ❌ Errore messa in pausa Ad "${ad.name}" (${ad.id}): ${res.error?.message}`);
    }
  }

  // --- 3. Riduzione Budget Retargeting ---
  const retargetingAdSets = [
    { id: '120249018096700047', name: 'AddToCart (14d)' },
    { id: '120249018098980047', name: 'ViewContent (30d)' },
    { id: '120249018102070047', name: 'Instagram Engagers (90d)' }
  ];

  console.log('\n📉 Riduzione del budget per gli Ad Sets di Retargeting (€20/day -> €10/day)...');
  for (const as of retargetingAdSets) {
    const res = await metaPost(as.id, { daily_budget: 1000 }); // €10.00 in centesimi
    if (res.success) {
      console.log(`   ✅ Ad Set di Retargeting "${as.name}" (${as.id}) aggiornato a €10/giorno.`);
    } else {
      console.log(`   ❌ Errore aggiornamento budget Ad Set "${as.name}" (${as.id}): ${res.error?.message}`);
    }
  }

  console.log('\n🎉 OTTIMIZZAZIONE COMPLETATA!');
}

runOptimization().catch(err => console.error(err));
