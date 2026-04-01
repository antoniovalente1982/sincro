import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const ORG = 'a5dd4842-f0ea-4909-b4a3-be2cb1c6ffa5';

// Date reali dal foglio "Leads (social)"
const fixes = [
  { email: 'bettioloroberta@gmail.com',      created_at: '2026-03-22T12:00:00.000Z', name: 'Roberta Bettiolo'    },
  { email: 'lucia.hubar@libero.it',           created_at: '2026-03-28T12:00:00.000Z', name: 'Lucia Hubar'         },
  { email: 'didiodavide72@yahoo.it',          created_at: '2026-03-29T12:00:00.000Z', name: 'Di Dio Davide'       },
  { email: 'lopsmassimiliano681@gmail.com',   created_at: '2026-03-29T12:00:00.000Z', name: 'Max Lago Segrino'    },
  { email: 'paolacirillo77@gmail.com',        created_at: '2026-03-30T12:00:00.000Z', name: 'Paola Cirillo'       },
  { email: 'rikydanton@gmail.com',            created_at: '2026-03-31T12:00:00.000Z', name: "Riccarda D'Antonio"  },
  { email: 'documenti.maio@gmail.com',        created_at: '2026-03-31T12:00:00.000Z', name: 'Gianluca Maio'       },
  // Annalisa Brandini arrivata il 01/04 — created_at corretto, niente da cambiare
];

console.log('\n=== FIX CREATED_AT ===\n');
for (const f of fixes) {
  // Trova tutti i record con quella email (possibili duplicati)
  const { data: leads } = await sb.from('leads')
    .select('id, name, created_at')
    .eq('organization_id', ORG)
    .ilike('email', f.email);

  if (!leads?.length) {
    console.log('  ⚠️  Non trovato: ' + f.email);
    continue;
  }

  for (const l of leads) {
    const { error } = await sb.from('leads')
      .update({ created_at: f.created_at })
      .eq('id', l.id);
    
    if (error) {
      console.log('  ❌ Errore ' + l.name + ': ' + error.message);
    } else {
      console.log('  ✅ ' + l.name + ' → created_at: ' + f.created_at.split('T')[0] + ' (era oggi)');
    }
  }
}

// Verifica: mostra i lead per data
console.log('\n=== LEAD ORDINATI PER DATA (ultimi 15) ===\n');
const { data: recent } = await sb.from('leads')
  .select('name, email, created_at, stage_id')
  .eq('organization_id', ORG)
  .order('created_at', { ascending: false })
  .limit(15);

const stageName = {
  'ad9d0014-0bea-4a59-9205-a62e66ff671c':'Lead',
  'c47850eb-42f0-407f-9760-30474d793487':'Appuntamento',
  '4d7faf7a-e25e-486a-8b5a-93dce223612b':'Show-up',
  'e91bedb8-6c18-4ec5-a1c3-f6533095b497':'Vendita',
  '72b659f6-adac-4823-af50-dfc2cda500f3':'Perso',
};

recent?.forEach(l => {
  const d = new Date(l.created_at).toLocaleDateString('it-IT');
  console.log('  ' + d + ' | ' + l.name + ' | ' + stageName[l.stage_id]);
});
