/**
 * import_today_leads.mjs
 * 
 * Recupera TUTTI i lead arrivati oggi da Meta (tutti i form)
 * e li inserisce nel CRM se non già presenti.
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// --- 1. Leggi connessione Meta dal DB ---
const { data: conn } = await sb
  .from('connections')
  .select('organization_id, credentials')
  .eq('provider', 'meta_ads')
  .eq('status', 'active')
  .single();

if (!conn?.credentials?.access_token) {
  console.error('❌ Nessuna connessione Meta attiva trovata');
  process.exit(1);
}

const TOKEN = conn.credentials.access_token;
const ORG_ID = conn.organization_id;
const AD_ACCOUNT_ID = conn.credentials.ad_account_id || process.env.META_AD_ACCOUNT_ID;

console.log(`✅ Connessione: org=${ORG_ID}, account=act_${AD_ACCOUNT_ID}`);

// --- 2. Recupera pipeline default e primo stage ---
const { data: pipeline } = await sb
  .from('pipelines')
  .select('id')
  .eq('organization_id', ORG_ID)
  .eq('is_default', true)
  .single();

const { data: firstStage } = await sb
  .from('pipeline_stages')
  .select('id, name')
  .eq('pipeline_id', pipeline.id)
  .order('sort_order', { ascending: true })
  .limit(1)
  .single();

console.log(`✅ Pipeline: ${pipeline.id}, Stage: "${firstStage.name}" (${firstStage.id})`);

// --- 3. Timestamp inizio giornata (mezzanotte ora italiana = -2h UTC) ---
const todayStart = new Date();
todayStart.setHours(0, 0, 0, 0);
// Prendiamo da ieri mezzanotte per sicurezza (per non perdere lead di stanotte)
const sinceTimestamp = Math.floor((todayStart.getTime() - 24 * 60 * 60 * 1000) / 1000);
console.log(`\n📅 Recupero lead da: ${new Date(sinceTimestamp * 1000).toISOString()} ad ora`);

// --- 4. Ottieni Page Access Token (non scade, non richiede pages_manage_ads extra) ---
const PAGE_ID = conn.credentials.page_id || '108451268302248';
console.log(`\n🔑 Ottengo Page Access Token per pagina ${PAGE_ID}...`);

let pageToken = TOKEN; // fallback al user token

const pagesRes = await fetch(
  `https://graph.facebook.com/v21.0/me/accounts?access_token=${TOKEN}`
);
const pagesData = await pagesRes.json();

if (!pagesData.error && pagesData.data?.length) {
  const page = pagesData.data.find(p => p.id === PAGE_ID) || pagesData.data[0];
  if (page?.access_token) {
    pageToken = page.access_token;
    console.log(`✅ Page Token ottenuto per: "${page.name}" (${page.id})`);
  }
} else {
  console.warn(`⚠️  Impossibile ottenere Page Token: ${pagesData.error?.message || 'no pages'}`);
  console.log('   Uso il User Token come fallback...');
}

// --- 5. Lista leadgen forms dalla pagina ---
console.log(`\n📋 Recupero form dalla pagina...`);

const formsRes = await fetch(
  `https://graph.facebook.com/v21.0/${PAGE_ID}/leadgen_forms?fields=id,name,status&limit=100&access_token=${pageToken}`
);
const formsData = await formsRes.json();

if (formsData.error) {
  console.error(`❌ Impossibile listare form: ${formsData.error.message}`);
  console.log('\n💡 Il token non ha accesso sufficiente ai form.');
  console.log('   Soluzione definitiva: approva il System User su Business Manager.');
  console.log('   Soluzione temporanea: aggiungi "pages_manage_ads" nel Graph API Explorer e rigenera.\n');
  process.exit(1);
}

const forms = formsData.data || [];
console.log(`✅ Trovati ${forms.length} form:`);
forms.forEach(f => console.log(`   - ${f.name} (${f.status})`));

// --- 6. Recupera lead di oggi per ogni form ---
let allLeads = [];
const sinceDate = new Date(sinceTimestamp * 1000).toISOString().slice(0, 10);

for (const form of forms) {
  if (form.status === 'DRAFT') continue;

  const fRes = await fetch(
    `https://graph.facebook.com/v21.0/${form.id}/leads?fields=id,field_data,ad_id,campaign_id,form_id,created_time&filtering=[{"field":"time_created","operator":"GREATER_THAN","value":${sinceTimestamp}}]&limit=200&access_token=${pageToken}`
  );
  const fData = await fRes.json();

  if (fData.error) {
    console.warn(`⚠️  Form "${form.name}": ${fData.error.message}`);
    continue;
  }

  const formLeads = fData.data || [];
  if (formLeads.length > 0) {
    console.log(`   📥 "${form.name}": ${formLeads.length} lead(s) negli ultimi 2 giorni`);
  }
  allLeads.push(...formLeads);
}

console.log(`\n📊 Totale lead da processare: ${allLeads.length}`);


// --- 5. Per ogni form, scarica i lead di oggi ---
let totalLeadsFound = 0;
let totalCreated = 0;
let totalSkipped = 0;
let totalErrors = 0;

function mapFields(fieldData) {
  const fields = {};
  for (const f of fieldData) {
    fields[f.name.toLowerCase()] = f.values?.[0] || '';
  }
  const email = (fields['email'] || fields['email_address'] || '').toLowerCase().trim();
  let name = '';
  if (fields['full_name']) {
    name = fields['full_name'].trim();
  } else {
    name = `${fields['first_name'] || ''} ${fields['last_name'] || ''}`.trim();
  }
  const phone = (fields['phone_number'] || fields['phone'] || fields['telefono'] || '').trim();
  return { email, name, phone };
}

async function processLead(rawLead) {
  const leadgenId = rawLead.id;
  const mapped = mapFields(rawLead.field_data || []);

  if (!mapped.email && !mapped.phone) {
    return { status: 'skipped', reason: 'no email/phone' };
  }

  // Check dedup per email
  let existing = null;
  if (mapped.email) {
    const { data } = await sb.from('leads')
      .select('id')
      .eq('organization_id', ORG_ID)
      .eq('email', mapped.email)
      .limit(1)
      .single();
    existing = data;
  }

  // Check dedup per leadgen_id
  if (!existing) {
    const { data } = await sb.from('leads')
      .select('id')
      .eq('organization_id', ORG_ID)
      .contains('meta_data', { leadgen_id: leadgenId })
      .limit(1)
      .single();
    existing = data;
  }

  if (existing) {
    return { status: 'skipped', reason: 'already_exists', id: existing.id };
  }

  const metaData = {
    source: 'meta_lead_form',
    leadgen_id: leadgenId,
    ad_id: rawLead.ad_id || null,
    campaign_id: rawLead.campaign_id || null,
    form_id: rawLead.form_id || null,
    utm_source: 'facebook',
    utm_medium: 'paid',
    utm_campaign: rawLead.campaign_id || null,
    utm_content: rawLead.ad_id || null,
    imported_by: 'manual_recovery_' + new Date().toISOString().slice(0, 10),
  };

  const { data: created, error } = await sb.from('leads')
    .insert({
      organization_id: ORG_ID,
      email: mapped.email || null,
      name: mapped.name || null,
      phone: mapped.phone || null,
      stage_id: firstStage.id,
      value: 0,
      product: 'Fonte: Ads - Meta (Lead Form)',
      meta_data: metaData,
    })
    .select('id')
    .single();

  if (error) {
    return { status: 'error', reason: error.message };
  }

  await sb.from('lead_activities').insert({
    organization_id: ORG_ID,
    lead_id: created.id,
    activity_type: 'status_changed',
    notes: `📥 Importato manualmente (recovery) via Meta Lead Form (leadgen_id: ${leadgenId})`,
  });

  return { status: 'created', id: created.id, name: mapped.name, email: mapped.email };
}

console.log('\n🔄 Processo i lead nel CRM...\n');

for (const rawLead of allLeads) {
  totalLeadsFound++;
  const result = await processLead(rawLead);
  if (result.status === 'created') {
    totalCreated++;
    console.log(`✅ CREATO: ${result.name} (${result.email})`);
  } else if (result.status === 'skipped') {
    totalSkipped++;
    console.log(`⏭️  SALTATO (${result.reason}): leadgen=${rawLead.id}`);
  } else {
    totalErrors++;
    console.log(`❌ ERRORE: ${result.reason}`);
  }
}

console.log(`\n${'='.repeat(50)}`);
console.log(`📊 RIEPILOGO IMPORT`);
console.log(`   Lead trovati su Meta:  ${totalLeadsFound}`);
console.log(`   ✅ Creati nel CRM:     ${totalCreated}`);
console.log(`   ⏭️  Già presenti:       ${totalSkipped}`);
console.log(`   ❌ Errori:             ${totalErrors}`);
console.log(`${'='.repeat(50)}\n`);

