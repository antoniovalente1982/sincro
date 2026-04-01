import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const ORG = 'a5dd4842-f0ea-4909-b4a3-be2cb1c6ffa5';
const FUNNEL_ID = 'ff79dda2-4e89-498a-9798-a9d7ac86bacc'; // metodo-sincro

// Stage IDs dal DB
const STAGE = {
  lead:          'ad9d0014-0bea-4a59-9205-a62e66ff671c',
  appuntamento:  'c47850eb-42f0-407f-9760-30474d793487',
  showup:        '4d7faf7a-e25e-486a-8b5a-93dce223612b',
  vendita:       'e91bedb8-6c18-4ec5-a1c3-f6533095b497',
  perso:         '72b659f6-adac-4823-af50-dfc2cda500f3',
};

// ─── Dati dal foglio Google "Appuntamenti Totali Calendly" ─────────────────
const updates = [
  // FATTO → Show-up
  { email: 'valeria.zanni@exprivia.com',     stage: STAGE.showup,     note: 'FATTO 30/03' },
  { email: 'valeria.zanni@Exprivia.com',     stage: STAGE.showup,     note: 'FATTO 30/03' }, // case alt
  { email: 'alessiaciampricotti@yahoo.it',   stage: STAGE.showup,     note: 'FATTO 30/03' },
  { email: 'massimoranieli@libero.it',       stage: STAGE.showup,     note: 'FATTO 30/03' },
  { email: 'mariopedatella@gmail.com',       stage: STAGE.showup,     note: 'FATTO 30/03' },
  { email: 'brunosgromo@gmail.com',          stage: STAGE.showup,     note: 'FATTO 30/03' },
  { email: 'domidiego1985@gmail.com',        stage: STAGE.showup,     note: 'FATTO 31/03' },
  // FATTO + PERSA → Perso
  { email: 'annalisamirabello@gmail.com',    stage: STAGE.perso,      note: 'FATTO 30/03 - PERSA' },
  { email: 'paolacirillo77@gmail.com',       stage: STAGE.perso,      note: 'FATTO 31/03 - PERSA' },
  // NO SHOW → Perso
  { email: 'elianadico82@gmail.com',         stage: STAGE.perso,      note: 'NO SHOW 31/03' },
  // Lead con appuntamento pending → Appuntamento
  { email: 'martinacampinoti@libero.it',     stage: STAGE.appuntamento, note: 'App pendente' },
  { email: 'c.casarelli@libero.it',          stage: STAGE.appuntamento, note: 'App pendente' },
];

// ─── Nuovi lead da aggiungere (in sheet ma non in CRM) ─────────────────────
const newLeads = [
  { name: 'Lucia Hubar',         email: 'lucia.hubar@libero.it',          stage: STAGE.showup,        note: 'FATTO 30/03 - via Calendly' },
  { name: "Riccarda D'Antonio",  email: 'rikydanton@gmail.com',            stage: STAGE.showup,        note: 'FATTO 31/03 - via Calendly' },
  { name: 'Max Lago Segrino',    email: 'lopsmassimiliano681@gmail.com',   stage: STAGE.appuntamento,  note: 'App pendente - via Calendly' },
  { name: 'Roberta Bettiolo',    email: 'bettioloroberta@gmail.com',       stage: STAGE.appuntamento,  note: 'App pendente - via Calendly' },
  { name: 'Di Dio Davide',       email: 'didiodavide72@yahoo.it',           stage: STAGE.appuntamento,  note: 'App pendente - via Calendly' },
  { name: 'Gianluca Maio',       email: 'documenti.maio@gmail.com',        stage: STAGE.appuntamento,  note: 'App pendente - via Calendly' },
];

let moved = 0, skipped = 0, added = 0;

// ─── 1. Aggiorna stage dei lead esistenti ──────────────────────────────────
console.log('\n=== AGGIORNAMENTO STAGE LEAD ESISTENTI ===\n');
for (const u of updates) {
  const { data: lead } = await sb.from('leads')
    .select('id, name, stage_id')
    .eq('organization_id', ORG)
    .ilike('email', u.email)
    .maybeSingle();

  if (!lead) {
    console.log(`  ⚠️  Non trovato: ${u.email}`);
    skipped++;
    continue;
  }
  if (lead.stage_id === u.stage) {
    console.log(`  ✅ Già aggiornato: ${lead.name}`);
    skipped++;
    continue;
  }

  const { error } = await sb.from('leads')
    .update({ stage_id: u.stage, updated_at: new Date().toISOString() })
    .eq('id', lead.id);

  if (error) {
    console.log(`  ❌ Errore: ${lead.name} — ${error.message}`);
  } else {
    const stageName = Object.entries(STAGE).find(([,v])=>v===u.stage)?.[0] || '?';
    console.log(`  ✅ SPOSTATO: ${lead.name} → ${stageName.toUpperCase()} (${u.note})`);
    moved++;
  }
}

// ─── 2. Aggiungi nuovi lead non presenti nel CRM ───────────────────────────
console.log('\n=== AGGIUNTA NUOVI LEAD DA CALENDLY ===\n');
for (const nl of newLeads) {
  const { data: existing } = await sb.from('leads')
    .select('id')
    .eq('organization_id', ORG)
    .ilike('email', nl.email)
    .maybeSingle();

  if (existing) {
    // Esiste già, aggiorna solo lo stage
    const stageName = Object.entries(STAGE).find(([,v])=>v===nl.stage)?.[0] || '?';
    await sb.from('leads').update({ stage_id: nl.stage }).eq('id', existing.id);
    console.log(`  🔄 Già presente, stage aggiornato: ${nl.name} → ${stageName.toUpperCase()}`);
    moved++;
    continue;
  }

  const { error } = await sb.from('leads').insert({
    organization_id: ORG,
    funnel_id: FUNNEL_ID,
    name: nl.name,
    email: nl.email,
    stage_id: nl.stage,
    status: 'active',
    utm_source: 'calendly',
    utm_medium: 'direct',
    utm_campaign: 'Calendly Direct',
    created_at: new Date().toISOString(),
  });

  if (error) {
    console.log(`  ❌ Errore aggiunta: ${nl.name} — ${error.message}`);
  } else {
    const stageName = Object.entries(STAGE).find(([,v])=>v===nl.stage)?.[0] || '?';
    console.log(`  ➕ AGGIUNTO: ${nl.name} (${nl.email}) → ${stageName.toUpperCase()}`);
    added++;
  }
}

console.log(`\n=== RIEPILOGO ===`);
console.log(`  Spostati: ${moved} | Non trovati/già ok: ${skipped} | Aggiunti: ${added}`);
