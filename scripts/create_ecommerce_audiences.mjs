/**
 * create_ecommerce_audiences.mjs
 * 
 * Crea le Custom Audiences necessarie per la strategia e-commerce delle guide
 * su shop.metodosincro.it:
 * 1. ECOM - AddToCart (14d) - Esclude Purchase (14d)
 * 2. ECOM - ViewContent Shop (30d) - Esclude Purchase (30d)
 * 3. ECOM - Buyers Shop (180d) - Da escludere dalle prospecting
 * 
 * Esegui con: node scripts/create_ecommerce_audiences.mjs
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

async function metaGet(endpoint, params = {}) {
  const url = new URL(`https://graph.facebook.com/${META_API_VERSION}/${endpoint}`);
  url.searchParams.set('access_token', TOKEN);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url);
  return res.json();
}

async function metaPost(endpoint, body) {
  const url = `https://graph.facebook.com/${META_API_VERSION}/${endpoint}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...body, access_token: TOKEN })
  });
  return res.json();
}

async function main() {
  console.log('📡 Verifica audiences esistenti...');
  const existingRes = await metaGet(`${AD_ACCOUNT}/customaudiences`, { fields: 'name,id' });
  
  if (existingRes.error) {
    console.error('❌ Errore nel recuperare le audiences esistenti:', existingRes.error.message);
    process.exit(1);
  }

  const existingNames = new Set((existingRes.data || []).map(a => a.name));
  const existingMap = {};
  (existingRes.data || []).forEach(a => {
    existingMap[a.name] = a.id;
  });

  console.log(`   Trovate ${existingRes.data?.length || 0} audiences.`);

  const audienceDefs = [
    {
      name: 'ECOM - AddToCart (14d)',
      description: 'Utenti che hanno aggiunto al carrello ma non acquistato negli ultimi 14 giorni (E-commerce)',
      retention_days: 14,
      rule: {
        inclusions: {
          operator: 'or',
          rules: [{
            event_sources: [{ type: 'pixel', id: PIXEL_ID }],
            retention_seconds: 14 * 86400,
            filter: {
              operator: 'and',
              filters: [{ field: 'event', operator: 'eq', value: 'AddToCart' }]
            }
          }]
        },
        exclusions: {
          operator: 'or',
          rules: [{
            event_sources: [{ type: 'pixel', id: PIXEL_ID }],
            retention_seconds: 14 * 86400,
            filter: {
              operator: 'and',
              filters: [{ field: 'event', operator: 'eq', value: 'Purchase' }]
            }
          }]
        }
      }
    },
    {
      name: 'ECOM - ViewContent Shop (30d)',
      description: 'Utenti che hanno visitato pagine prodotto ma non acquistato negli ultimi 30 giorni (E-commerce)',
      retention_days: 30,
      rule: {
        inclusions: {
          operator: 'or',
          rules: [{
            event_sources: [{ type: 'pixel', id: PIXEL_ID }],
            retention_seconds: 30 * 86400,
            filter: {
              operator: 'and',
              filters: [{ field: 'event', operator: 'eq', value: 'ViewContent' }]
            }
          }]
        },
        exclusions: {
          operator: 'or',
          rules: [{
            event_sources: [{ type: 'pixel', id: PIXEL_ID }],
            retention_seconds: 30 * 86400,
            filter: {
              operator: 'and',
              filters: [{ field: 'event', operator: 'eq', value: 'Purchase' }]
            }
          }]
        }
      }
    },
    {
      name: 'ECOM - Buyers Shop (180d)',
      description: 'Acquirenti e-commerce degli ultimi 180 giorni. Da escludere dalle campagne prospecting.',
      retention_days: 180,
      rule: {
        inclusions: {
          operator: 'or',
          rules: [{
            event_sources: [{ type: 'pixel', id: PIXEL_ID }],
            retention_seconds: 180 * 86400,
            filter: {
              operator: 'and',
              filters: [{ field: 'event', operator: 'eq', value: 'Purchase' }]
            }
          }]
        }
      }
    }
  ];

  console.log('\n🚀 Creazione/Verifica delle audiences e-commerce:');
  for (const aud of audienceDefs) {
    if (existingNames.has(aud.name)) {
      console.log(`✅ Audience già esistente: "${aud.name}" (ID: ${existingMap[aud.name]})`);
      continue;
    }

    console.log(`➕ Creazione in corso: "${aud.name}"...`);
    const payload = {
      name: aud.name,
      description: aud.description,
      retention_days: aud.retention_days,
      prefill: true,
      rule: JSON.stringify(aud.rule)
    };

    const createRes = await metaPost(`${AD_ACCOUNT}/customaudiences`, payload);

    if (createRes.error) {
      console.error(`   ❌ Errore nella creazione di "${aud.name}":`, createRes.error.message);
    } else {
      console.log(`   ✅ Creata con successo! ID: ${createRes.id}`);
    }
  }
}

main().catch(err => {
  console.error('❌ Fatal error:', err);
});
