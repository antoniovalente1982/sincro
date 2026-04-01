import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const ORG = 'a5dd4842-f0ea-4909-b4a3-be2cb1c6ffa5';
const FUNNEL_ID = 'ff79dda2-4e89-498a-9798-a9d7ac86bacc';
const STAGE = {
  appuntamento: 'c47850eb-42f0-407f-9760-30474d793487',
  showup:       '4d7faf7a-e25e-486a-8b5a-93dce223612b',
  perso:        '72b659f6-adac-4823-af50-dfc2cda500f3',
};

// Leggi le colonne reali della tabella leads
const { data: sample } = await sb.from('leads').select('*').eq('organization_id', ORG).limit(1);
const cols = Object.keys(sample?.[0] || {});
console.log('Colonne leads:', cols.join(', '));

// Cerca Valeria Zanni con Exprivia (email case sensitive issue)
const { data: valeria } = await sb.from('leads').select('id, name, email, stage_id').eq('organization_id', ORG).ilike('email', '%exprivia%').maybeSingle();
if (valeria) {
  await sb.from('leads').update({ stage_id: STAGE.showup }).eq('id', valeria.id);
  console.log(`✅ SPOSTATO: ${valeria.name} → SHOWUP`);
} else {
  console.log('⚠️ Valeria Zanni non trovata in DB');
}

// Cerca Paola Cirillo
const { data: paola } = await sb.from('leads').select('id, name, email, stage_id').eq('organization_id', ORG).ilike('email', '%cirillo%').maybeSingle();
if (paola) {
  await sb.from('leads').update({ stage_id: STAGE.perso }).eq('id', paola.id);
  console.log(`✅ SPOSTATO: ${paola.name} → PERSO`);
} else {
  console.log('⚠️ Paola Cirillo non trovata in DB');
}

// Aggiungi nuovi lead senza campo "status"
const newLeads = [
  { name: 'Lucia Hubar',       email: 'lucia.hubar@libero.it',       stage_id: STAGE.showup,       utm_source: 'calendly', utm_campaign: 'Calendly Direct' },
  { name: "Riccarda D'Antonio",email: 'rikydanton@gmail.com',         stage_id: STAGE.showup,       utm_source: 'calendly', utm_campaign: 'Calendly Direct' },
  { name: 'Roberta Bettiolo',  email: 'bettioloroberta@gmail.com',    stage_id: STAGE.appuntamento, utm_source: 'calendly', utm_campaign: 'Calendly Direct' },
  { name: 'Gianluca Maio',     email: 'documenti.maio@gmail.com',     stage_id: STAGE.appuntamento, utm_source: 'calendly', utm_campaign: 'Calendly Direct' },
  { name: 'Paola Cirillo',     email: 'paolacirillo77@gmail.com',     stage_id: STAGE.perso,        utm_source: 'calendly', utm_campaign: 'Calendly Direct' },
  { name: 'Annalisa Mirabello',email: 'annalisamirabello@gmail.com',  stage_id: STAGE.perso,        utm_source: 'calendly', utm_campaign: 'Calendly Direct' },
];

for (const nl of newLeads) {
  // Controlla se esiste già
  const { data: ex } = await sb.from('leads').select('id').eq('organization_id', ORG).ilike('email', nl.email).maybeSingle();
  if (ex) { console.log(`  ⏭️  Già presente: ${nl.name}`); continue; }

  const row = {
    organization_id: ORG,
    funnel_id: FUNNEL_ID,
    name: nl.name,
    email: nl.email,
    stage_id: nl.stage_id,
    utm_source: nl.utm_source,
    utm_campaign: nl.utm_campaign,
  };
  // Rimuovi campi non esistenti in base alle colonne rilevate
  if (!cols.includes('status')) delete row.status;

  const { error } = await sb.from('leads').insert(row);
  if (error) console.log(`  ❌ Errore: ${nl.name} — ${error.message}`);
  else console.log(`  ➕ AGGIUNTO: ${nl.name}`);
}

console.log('\n=== STATO FINALE CRM ===');
const { data: all } = await sb.from('leads').select('name, email, stage_id').eq('organization_id', ORG).order('created_at', { ascending: false }).limit(50);
const stageNames = { [STAGE.appuntamento]: 'Appuntamento', [STAGE.showup]: 'Show-up', [STAGE.perso]: 'Perso' };
const grouped = { 'Show-up': [], 'Appuntamento': [], 'Perso': [], 'Altro': [] };
all?.forEach(l => {
  const s = stageNames[l.stage_id] || 'Altro';
  (grouped[s] || grouped['Altro']).push(l.name);
});
Object.entries(grouped).forEach(([s, names]) => {
  if (names.length) console.log(`\n${s} (${names.length}):\n  ${names.join('\n  ')}`);
});
