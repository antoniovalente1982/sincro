import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config({ path: '.env.local' });

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const AD_ACCOUNT_ID = process.env.META_AD_ACCOUNT_ID || '511099830249139';
const PIXEL_ID = '311586900940615';
const META_API_VERSION = 'v21.0';
const PAGE_ID = '108451268302248';
const INSTAGRAM_USER_ID = '17841449195220971';
const BUNDLE_URL = 'https://shop.metodosincro.it/prodotto/master-pack-campione-completo/';
const URL_TAGS = 'utm_source=facebook&utm_medium=paid&utm_campaign={{campaign.name}}&utm_term={{adset.name}}&utm_content={{ad.name}}&fbadid={{ad.id}}';

// Audience IDs
const LAL_CLIENTI_REALI_ID = '120243944245830047';
const ECOM_BUYERS_SHOP_ID = '120249017987090047'; // Exclusion

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

// Upload local image to Ad Library
async function uploadLocalImage(filePath, name) {
  console.log(`📡 Lettura immagine da disco: ${filePath}...`);
  if (!fs.existsSync(filePath)) {
    throw new Error(`File non trovato: ${filePath}`);
  }
  const buffer = fs.readFileSync(filePath);
  const base64 = buffer.toString('base64');

  console.log(`📸 Caricamento immagine mockup su Meta Ad Library...`);
  const data = await metaPost(`${AD_ACCOUNT}/adimages`, {
    bytes: base64,
    name: name
  });

  const images = data.images || {};
  const firstKey = Object.keys(images)[0];
  const hash = images[firstKey]?.hash;
  console.log(`   ✅ Caricata con successo! Hash: ${hash}`);
  return hash;
}

const baseTargeting = {
  geo_locations: { countries: ['IT'] },
  age_min: 38,
  age_max: 65,
  locales: [10], // Italiano
  publisher_platforms: ['facebook', 'instagram'],
  targeting_automation: { advantage_audience: 0 }
};

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
  console.log('🏁 SETUP CAMPAGNA SCALING BUNDLE E-COMMERCE...');
  
  // 1. Carica l'immagine mockup 3D generata
  const mockupPath = '/Users/antoniovalente/.gemini/antigravity-ide/brain/9514802d-288d-4573-bd6e-0fe8cfd70517/master_pack_mockup_1781855077429.png';
  const imgHash = await uploadLocalImage(mockupPath, 'master_pack_mockup.png');

  // 2. Definizione delle copy e dei creatives
  const creatives = [
    {
      name: 'Creative - ECOM - Bundle Master Pack Value',
      headline: '6 Guide del Mental Coach a prezzo Speciale 🏆',
      description: 'Tutte le guide Metodo Sincro® con il 60% di sconto',
      message: `⚽ Vuoi dare a tuo figlio gli strumenti mentali dei campioni, ma non sai da dove iniziare?\n\nPer la prima volta, abbiamo unito tutte le 6 guide pratiche di Metodo Sincro® in un unico pacchetto completo a un prezzo irripetibile.\n\nCosa riceverai immediatamente:\n1️⃣ Guida Autostima Campione (sblocca l'autostima in campo)\n2️⃣ Strategie Mentali Vol. 1 (30 esercizi pratici di mental coaching)\n3️⃣ Gestire la Pressione Vol. 2 (controllo emotivo sotto stress)\n4️⃣ Crescere Futuri Leader (la guida definitiva per i genitori)\n5️⃣ 5 Errori dei Genitori (e come evitarli per non bloccare il ragazzo)\n6️⃣ Sempre al tuo fianco (sostegno psicologico pre/post partita)\n\n📈 Aumenta il suo focus, proteggilo dall'ansia da prestazione e accelera la sua crescita sportiva.\n\n👉 Clicca su "Scopri di più" per accedere allo shop e scaricare il pacchetto completo con oltre il 60% di sconto!`
    },
    {
      name: 'Creative - ECOM - Bundle Master Pack Emotional',
      headline: 'Sblocca l\'Autostima di tuo Figlio 🧠',
      description: 'Ottieni il Master Pack completo con 6 Guide PDF',
      message: `❤️ Quante volte hai visto tuo figlio dubitare di se stesso prima di entrare in campo?\n\nL'insicurezza è il freno a mano invisibile che blocca i giovani calciatori di talento. Come genitore, hai il potere di fare la differenza e diventare la guida che merita per sbloccare la sua autostima e resilienza.\n\nE oggi puoi farlo con l'intera libreria di Metodo Sincro® a una frazione del costo singolo.\n\nCon il nostro nuovo Master Pack completo, avrai accesso a tutte le 6 guide digitali (Autostima, Gestione della Pressione, Crescita dei Leader, Routine e 30 esercizi mentali) a soli €49 anziché €129!\n\n👉 Clicca su "Scopri di più" per dare a tuo figlio la mentalità d'acciaio che merita!`
    }
  ];

  // 3. Crea Ad Creatives su Meta
  console.log('\n🎨 Creazione degli Ad Creatives...');
  const creativeIds = [];
  for (const c of creatives) {
    const payload = {
      name: c.name,
      object_story_spec: {
        page_id: PAGE_ID,
        instagram_user_id: INSTAGRAM_USER_ID,
        link_data: {
          image_hash: imgHash,
          link: BUNDLE_URL,
          message: c.message,
          name: c.headline,
          description: c.description,
          call_to_action: { type: 'LEARN_MORE' }
        }
      },
      url_tags: URL_TAGS
    };
    const creativeRes = await metaPost(`${AD_ACCOUNT}/adcreatives`, payload);
    creativeIds.push({ name: c.name, id: creativeRes.id });
    console.log(`   ✅ Creato: "${c.name}" (ID: ${creativeRes.id})`);
  }

  // 4. Crea la nuova Campagna CBO
  console.log('\n📦 Creazione Campagna CBO per il Bundle (in stato PAUSED)...');
  const campaign = await metaPost(`${AD_ACCOUNT}/campaigns`, {
    name: 'MS - [ECOM] Scaling Bundle CBO',
    objective: 'OUTCOME_SALES',
    status: 'PAUSED',
    special_ad_categories: ['NONE'],
    daily_budget: 15000, // €150/day
    bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
    is_adset_budget_sharing_enabled: false
  });
  console.log(`   ✅ Campagna creata con successo! ID: ${campaign.id}`);

  // 5. Crea i 3 Ad Sets
  console.log('\n🎯 Creazione Ad Sets...');
  
  // Ad Set 1: LAL 1% Clienti Reali
  console.log('   🎯 Ad Set 1: LAL 1% Clienti Reali...');
  const adsetLal = await metaPost(`${AD_ACCOUNT}/adsets`, {
    name: 'LAL 1% Clienti Reali',
    campaign_id: campaign.id,
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
  console.log(`      ✅ ID: ${adsetLal.id}`);

  // Ad Set 2: Interessi Genitori + Calcio
  console.log('   🎯 Ad Set 2: Interessi Genitori + Calcio...');
  const adsetInteressi = await metaPost(`${AD_ACCOUNT}/adsets`, {
    name: 'Interessi Genitori + Calcio',
    campaign_id: campaign.id,
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

  // Ad Set 3: Broad IT 38-65 (con target spesa minima garantito)
  console.log('   🎯 Ad Set 3: Broad IT 38-65 (Test)...');
  const adsetBroad = await metaPost(`${AD_ACCOUNT}/adsets`, {
    name: 'Broad IT 38-65 (Test)',
    campaign_id: campaign.id,
    billing_event: 'IMPRESSIONS',
    optimization_goal: 'OFFSITE_CONVERSIONS',
    bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
    promoted_object: { pixel_id: PIXEL_ID, custom_event_type: 'PURCHASE' },
    targeting: {
      ...baseTargeting,
      excluded_custom_audiences: [{ id: ECOM_BUYERS_SHOP_ID }]
    },
    // Limite di spesa giornaliero minimo di €10.00 su questo gruppo per fare test in CBO
    daily_min_spend_target: 1000, 
    status: 'PAUSED'
  });
  console.log(`      ✅ ID: ${adsetBroad.id}`);

  // 6. Crea le inserzioni in ciascun Ad Set
  console.log('\n➕ Generazione degli Ads all\'interno degli Ad Sets...');
  const adsetIds = [adsetLal.id, adsetInteressi.id, adsetBroad.id];
  let adCount = 0;
  for (const asId of adsetIds) {
    console.log(`   🎯 Ad Set: ${asId}`);
    for (const c of creativeIds) {
      const adName = `ECOM - ${c.name.replace('Creative - ECOM - ', '')}`;
      try {
        const adRes = await metaPost(`${AD_ACCOUNT}/ads`, {
          name: adName,
          adset_id: asId,
          creative: { creative_id: c.id },
          status: 'PAUSED'
        });
        adCount++;
        console.log(`      ✅ Ad creata: "${adName}" (ID: ${adRes.id})`);
      } catch (err) {
        console.error(`      ❌ Errore creazione Ad "${adName}" in Ad Set ${asId}:`, err.message);
      }
    }
  }

  console.log('\n' + '═'.repeat(60));
  console.log(`🎉 STRUTTURA CAMPAGNA BUNDLE CREATA CON SUCCESSO!`);
  console.log(`   Caricato Mockup 3D.`);
  console.log(`   Creati ${creativeIds.length} Ad Creatives.`);
  console.log(`   Creata campagna: "MS - [ECOM] Scaling Bundle CBO" (ID: ${campaign.id})`);
  console.log(`   Generate ${adCount} inserzioni in pausa nei 3 Ad Sets.`);
  console.log('═'.repeat(60) + '\n');
}

main().catch(err => console.error('❌ Errore fatale:', err));
