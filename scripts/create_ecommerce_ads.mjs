/**
 * create_ecommerce_ads.mjs
 * 
 * Scarica le copertine delle guide in-memory dallo shop,
 * le carica nella libreria di Meta Ads, crea gli Ad Creatives
 * e genera le inserzioni (Ads) in tutti i gruppi delle 3 nuove campagne.
 * 
 * Inserzioni create (stato PAUSED):
 * 1. Guida Leader Genitori
 * 2. Guida Autostima Campione
 * 3. Habit Tracker Giovani Calciatori
 * 4. Strategie Mentali Vol. 1
 * 
 * Esegui con: node scripts/create_ecommerce_ads.mjs
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
const PAGE_ID = '108451268302248';
const INSTAGRAM_USER_ID = '17841449195220971';
const LANDING_URL = 'https://shop.metodosincro.it/';
const URL_TAGS = 'utm_source=facebook&utm_medium=paid&utm_campaign={{campaign.name}}&utm_term={{adset.name}}&utm_content={{ad.name}}&fbadid={{ad.id}}';

// IDs dei gruppi di inserzioni creati
const AD_SET_IDS = [
  // Prospecting
  '120249018084950047', // LAL 1% Clienti Reali
  '120249018089350047', // LAL 1% CSV Storico
  '120249018091320047', // Broad IT 38-65
  '120249018093110047', // Interessi Genitori+Calcio
  // Retargeting
  '120249018096700047', // AddToCart (14d)
  '120249018098980047', // ViewContent (30d)
  '120249018102070047', // Instagram Engagers (90d)
  // Testing
  '120249018104170047'  // Broad IT 38-65 - Testing
];

// Definizione delle creative delle guide
const AD_DESIGNS = [
  {
    name: 'Guida Genitori Leader',
    imageUrl: 'https://shop.metodosincro.it/wp-content/uploads/2024/12/La-guida-per-genitori-che-vogliono-crescere-futuri-leader.webp',
    message: `⚽ Tuo figlio gioca a calcio e vuoi aiutarlo a sviluppare la mentalità di un vero leader?\n\nIl talento da solo non basta. Le partite si vincono e si perdono prima di tutto nella testa. Con la nostra guida pratica, scoprirai come insegnare a tuo figlio a gestire le sconfitte, superare le difficoltà e sviluppare una leadership forte, in campo e nella vita.\n\n🧠 Metodo Sincro® ha distillato i principi del mental coaching in una guida condensata e immediata, pensata appositamente per i genitori.\n\nCosa troverai all'interno:\n✅ Esercizi pratici capitolo per capitolo da fare insieme.\n✅ Come gestire la frustrazione dopo un errore o una partita andata male.\n✅ I segreti per sviluppare una resilienza d'acciaio.\n\n👉 Clicca su "Scopri di più" per andare sulla nostra homepage, esplorare la guida e scegliere il percorso migliore per tuo figlio!`,
    headline: 'Cresci un Futuro Leader nel Calcio 🏆',
    description: 'Guida PDF per Genitori di Giovani Calciatori'
  },
  {
    name: 'Guida Autostima Campione',
    imageUrl: 'https://shop.metodosincro.it/wp-content/uploads/2024/12/Proteggi-tuo-figlio-da-insicurezza-e-aiutalo-a-raggiungere-il-suo-massimo-potenziale.webp',
    message: `❤️ Quante volte hai visto tuo figlio dubitare di se stesso prima di entrare in campo?\n\nL'insicurezza è il freno a mano invisibile che blocca i giovani calciatori di talento. Come genitore, hai il potere di fare la differenza e diventare la guida che merita per sbloccare la sua autostima e resilienza.\n\n🧠 La Guida "Proteggi tuo figlio da insicurezza" ti fornisce strumenti pratici per:\n✅ Comunicare in modo efficace senza esercitare pressione.\n✅ Trasformare le paure del ragazzo in opportunità di crescita.\n✅ Creare un ambiente familiare stimolante e sereno.\n\n👉 Clicca su "Scopri di più" per accedere allo shop, trovare la guida e supportare la crescita di tuo figlio oggi stesso!`,
    headline: 'Sblocca l\'Autostima di tuo Figlio 🧠',
    description: 'La guida pratica contro paure e blocchi mentali'
  },
  {
    name: 'Habit Tracker Campione',
    imageUrl: 'https://shop.metodosincro.it/wp-content/uploads/2024/12/Abitudini-per-vincere.webp',
    message: `📈 Il talento è solo il punto di partenza. Sono le abitudini quotidiane a fare la differenza tra un buon giocatore e un campione.\n\nVuoi che tuo figlio sviluppi una disciplina di ferro? L'Habit Tracker di Metodo Sincro® è lo strumento digitale progettato per i giovani atleti che vogliono tracciare ed ottimizzare la loro crescita ogni singolo giorno.\n\nCosa permette di monitorare:\n✅ Allenamenti extra, tiri in porta e preparazione atletica.\n✅ Alimentazione equilibrata ed energia a tavola.\n✅ Sonno, stretching e routine di recupero.\n✅ Esercizi di visualizzazione e mindset vincente.\n\n👉 Clicca su "Scopri di più" per vedere l'Habit Tracker sulla nostra homepage e iniziare a costruire la routine dei campioni!`,
    headline: 'Costruisci Abitudini da Campione 🚀',
    description: 'Habit Tracker digitale per giovani calciatori'
  },
  {
    name: 'Strategie Mentali Vol1',
    imageUrl: 'https://shop.metodosincro.it/wp-content/uploads/2025/01/Vol1_Strategie-mentali-per-dominare-il-campo-come-un-campione.webp',
    message: `⚽ Domina la mente per dominare il campo in soli 30 giorni!\n\nUn percorso step-by-step con 30 esercizi mentali pratici, progettato specificamente per i giovani calciatori che vogliono rafforzare la fiducia in se stessi, gestire l'ansia da prestazione e superare ogni blocco mentale prima del fischio d'inizio.\n\nCosa allenerà tuo figlio:\n✅ Tecniche di visualizzazione del successo.\n✅ Come reagire positivamente agli errori durante il match.\n✅ Come gestire le critiche e perseverare.\n\n🧠 Lo stesso metodo di mental coaching usato dai professionisti, ora disponibile in una guida pratica da leggere ed applicare giorno dopo giorno.\n\n👉 Clicca su "Scopri di più" per esplorare lo shop e scaricare subito la guida!`,
    headline: 'Strategie Mentali per Vincere in 30 Giorni ⚽',
    description: 'Guida pratica con 30 esercizi quotidiani'
  }
];

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

async function uploadImageFromUrl(imageUrl, name) {
  console.log(`📡 Scaricamento immagine: ${imageUrl}...`);
  const response = await fetch(imageUrl);
  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const base64 = buffer.toString('base64');

  console.log(`📸 Caricamento immagine su Meta Ad Library...`);
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

async function main() {
  console.log('🏁 Avvio caricamento creative e creazione ads...');
  
  // 1. Carica le immagini
  const imageHashes = {};
  for (const design of AD_DESIGNS) {
    try {
      const hash = await uploadImageFromUrl(design.imageUrl, `${design.name.replace(/\s+/g, '_')}.webp`);
      imageHashes[design.name] = hash;
    } catch (err) {
      console.error(`❌ Errore nel caricamento dell'immagine per ${design.name}:`, err.message);
    }
  }

  // 2. Crea gli Ad Creatives
  console.log('\n🎨 Creazione degli Ad Creatives su Meta...');
  const creativeIds = {};
  for (const design of AD_DESIGNS) {
    const hash = imageHashes[design.name];
    if (!hash) {
      console.log(`⚠️ Salto la creazione del creative per ${design.name} dovuto alla mancanza dell'immagine.`);
      continue;
    }

    const payload = {
      name: `Creative - ECOM - ${design.name}`,
      object_story_spec: {
        page_id: PAGE_ID,
        instagram_user_id: INSTAGRAM_USER_ID,
        link_data: {
          image_hash: hash,
          link: LANDING_URL,
          message: design.message,
          name: design.headline,
          description: design.description,
          call_to_action: { type: 'LEARN_MORE' }
        }
      },
      url_tags: URL_TAGS
    };

    const creativeRes = await metaPost(`${AD_ACCOUNT}/adcreatives`, payload);
    creativeIds[design.name] = creativeRes.id;
    console.log(`   ✅ Creato: "Creative - ECOM - ${design.name}" (ID: ${creativeRes.id})`);
  }

  // 3. Crea gli Ads all'interno di ciascun Ad Set
  console.log('\n➕ Generazione degli Ads all\'interno degli Ad Sets...');
  let adCount = 0;
  for (const adSetId of AD_SET_IDS) {
    console.log(`   🎯 Ad Set: ${adSetId}`);
    for (const design of AD_DESIGNS) {
      const creativeId = creativeIds[design.name];
      if (!creativeId) continue;

      const adName = `ECOM - ${design.name}`;
      try {
        const adRes = await metaPost(`${AD_ACCOUNT}/ads`, {
          name: adName,
          adset_id: adSetId,
          creative: { creative_id: creativeId },
          status: 'PAUSED'
        });
        adCount++;
        console.log(`      ✅ Ad creata: "${adName}" (ID: ${adRes.id})`);
      } catch (err) {
        console.error(`      ❌ Errore nella creazione dell'Ad per ${design.name} in Ad Set ${adSetId}:`, err.message);
      }
    }
  }

  console.log('\n' + '═'.repeat(60));
  console.log(`🎉 OPERA COMPLETATA CON SUCCESSO!`);
  console.log(`   Caricate ${Object.keys(imageHashes).length} copertine.`);
  console.log(`   Creati ${Object.keys(creativeIds).length} Ad Creatives.`);
  console.log(`   Generate ${adCount} inserzioni in stato PAUSED negli 8 Ad Sets.`);
  console.log('═'.repeat(60));
}

main().catch(err => {
  console.error('❌ Fatal error:', err);
});
