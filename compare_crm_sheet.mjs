import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const ORG = 'a5dd4842-f0ea-4909-b4a3-be2cb1c6ffa5';
const STAGE = {
  lead: 'ad9d0014-0bea-4a59-9205-a62e66ff671c',
  appuntamento: 'c47850eb-42f0-407f-9760-30474d793487',
  showup: '4d7faf7a-e25e-486a-8b5a-93dce223612b',
  vendita: 'e91bedb8-6c18-4ec5-a1c3-f6533095b497',
  perso: '72b659f6-adac-4823-af50-dfc2cda500f3',
};
const FUNNEL_ID = 'ff79dda2-4e89-498a-9798-a9d7ac86bacc';
const stageNames = { [STAGE.lead]:'Lead', [STAGE.appuntamento]:'Appuntamento', [STAGE.showup]:'Show-up', [STAGE.vendita]:'Vendita', [STAGE.perso]:'Perso' };

const { data: crm } = await sb.from('leads').select('id, name, email, stage_id').eq('organization_id', ORG);
const crmByEmail = Object.fromEntries((crm||[]).map(l => [l.email?.toLowerCase().trim(), l]));

// Dati foglio Google (da entrambi gli screenshot)
const sheet = [
  { name:'Valeria Zanni',        email:'valeria.zanni@exprivia.com',       stato:'FATTO',   esito:'',      app:'2026-03-30' },
  { name:'Alessia Ciampricotti', email:'alessiaciampricotti@yahoo.it',     stato:'FATTO',   esito:'',      app:'2026-03-30' },
  { name:'Massimo Ranieli',      email:'massimoranieli@libero.it',         stato:'FATTO',   esito:'',      app:'2026-03-30' },
  { name:'Mario Pedatella',      email:'mariopedatella@gmail.com',         stato:'FATTO',   esito:'',      app:'2026-03-30' },
  { name:'Bruno Sgromo',         email:'brunosgromo@gmail.com',            stato:'FATTO',   esito:'',      app:'2026-03-30' },
  { name:'Lucia Hubar',          email:'lucia.hubar@libero.it',            stato:'FATTO',   esito:'',      app:'2026-03-30' },
  { name:'Annalisa Mirabello',   email:'annalisamirabello@gmail.com',      stato:'FATTO',   esito:'PERSA', app:'2026-03-30' },
  { name:'Eliana',               email:'elianadico82@gmail.com',           stato:'NO SHOW', esito:'',      app:'2026-03-31' },
  { name:"Riccarda D'Antonio",   email:'rikydanton@gmail.com',             stato:'FATTO',   esito:'',      app:'2026-03-31' },
  { name:'Paola Cirillo',        email:'paolacirillo77@gmail.com',         stato:'',        esito:'PERSA', app:'2026-03-31' },
  { name:'Domenico de sario',    email:'domidiego1985@gmail.com',          stato:'FATTO',   esito:'',      app:'2026-04-02' },
  { name:'Annalisa Brandini',    email:'annalisa89b@libero.it',            stato:'',        esito:'',      app:'2026-04-02' },
  { name:'Valentina Perego',     email:'tina.perego@outlook.it',           stato:'',        esito:'',      app:'2026-04-03' },
  { name:'Max Lago Segrino',     email:'lopsmassimiliano681@gmail.com',    stato:'',        esito:'',      app:'2026-04-04' },
  { name:'Lorenzo Papini',       email:'lorenzopapini0@gmail.com',         stato:'',        esito:'',      app:'2026-04-07' },
  { name:'Gianluca Maio',        email:'documenti.maio@gmail.com',         stato:'',        esito:'',      app:'2026-04-07' },
  { name:'Marco Orlandini',      email:'martinacampinoti@libero.it',       stato:'',        esito:'',      app:'2026-04-07' },
  { name:'Claudio Casarelli',    email:'c.casarelli@libero.it',            stato:'',        esito:'',      app:'2026-04-07' },
  { name:'Luca Perini',          email:'lucaperinibar@gmail.com',          stato:'',        esito:'',      app:'' },
  { name:'Pietro Benzi',         email:'pietroben.pb@gmail.com',           stato:'',        esito:'',      app:'' },
  { name:'Davide Dragotta',      email:'dragottadavide3@gmail.com',        stato:'',        esito:'',      app:'' },
  { name:'Petrelli Francesco',   email:'francescopetrelli78@icloud.com',   stato:'',        esito:'',      app:'' },
  { name:'Alessio Sardellini',   email:'ilaria83id@libero.it',             stato:'',        esito:'',      app:'' },
  { name:'Roberta Bettiolo',     email:'bettioloroberta@gmail.com',        stato:'',        esito:'',      app:'' },
  { name:'Di Dio Davide',        email:'didiodavide72@yahoo.it',           stato:'',        esito:'',      app:'' },
];

function expectedStage(s) {
  if (s.esito === 'VINTA') return 'Vendita';
  if (s.esito === 'PERSA') return 'Perso';
  if (s.stato === 'FATTO') return 'Show-up';
  if (s.stato === 'NO SHOW') return 'Perso';
  if (s.app) return 'Appuntamento';
  return 'Lead';
}

console.log('\n=== MANCANTI DAL CRM (presenti solo nel foglio) ===\n');
let missing = 0;
for (const s of sheet) {
  const lead = crmByEmail[s.email.toLowerCase()];
  if (!lead) {
    const exp = expectedStage(s);
    console.log('  MANCANTE: ' + s.name + ' | ' + s.email + ' | => ' + exp);
    missing++;
  }
}
if (!missing) console.log('  Nessuno - tutti presenti ✅');

console.log('\n=== DISCREPANZE STAGE (CRM ≠ Foglio) ===\n');
let diffs = 0;
for (const s of sheet) {
  const lead = crmByEmail[s.email.toLowerCase()];
  if (!lead) continue;
  const cur = stageNames[lead.stage_id] || '?';
  const exp = expectedStage(s);
  if (cur !== exp) {
    console.log('  DIFF: ' + lead.name + ' | CRM: "' + cur + '" | Foglio: "' + exp + '"');
    diffs++;
  }
}
if (!diffs) console.log('  Nessuna discrepanza - tutto allineato ✅');

console.log('\n=== STATO ATTUALE COMPLETO CRM ===\n');
const byStage = {};
for (const l of crm||[]) {
  const s = stageNames[l.stage_id] || 'Lead';
  if (!byStage[s]) byStage[s] = [];
  byStage[s].push(l.name);
}
const order = ['Vendita','Show-up','Appuntamento','Lead','Perso'];
for (const s of order) {
  if (byStage[s]?.length) console.log(s + ' (' + byStage[s].length + '):\n  ' + byStage[s].join(', '));
}
