import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const ORG = 'a5dd4842-f0ea-4909-b4a3-be2cb1c6ffa5';
const FUNNEL_ID = 'ff79dda2-4e89-498a-9798-a9d7ac86bacc';
const APPUNTAMENTO = 'c47850eb-42f0-407f-9760-30474d793487';
const PERSO = '72b659f6-adac-4823-af50-dfc2cda500f3';

// 1. Aggiungi Annalisa Brandini (mancante)
const { error: e1 } = await sb.from('leads').insert({
  organization_id: ORG, funnel_id: FUNNEL_ID,
  name: 'Annalisa Brandini', email: 'annalisa89b@libero.it',
  stage_id: APPUNTAMENTO, utm_source: 'calendly', utm_campaign: 'Calendly Direct',
});
console.log(e1 ? 'ERRORE Annalisa Brandini: ' + e1.message : '✅ AGGIUNTA: Annalisa Brandini → Appuntamento');

// 2. DAVIDE MACCIONE — dalla descrizione sheet: "NON VUOLE + PARLO E NON DA SPIEGAZIONI HA CAMBIATO IDEA" → Perso
const { data: davide } = await sb.from('leads').select('id, name').eq('organization_id', ORG).ilike('name', '%maccione%').maybeSingle();
if (davide) {
  await sb.from('leads').update({ stage_id: PERSO }).eq('id', davide.id);
  console.log('✅ SPOSTATO: DAVIDE MACCIONE → Perso (ha cambiato idea)');
} else {
  console.log('⚠️  DAVIDE MACCIONE non trovato in DB');
}

// RIEPILOGO FINALE
const { data: all } = await sb.from('leads').select('stage_id').eq('organization_id', ORG);
const stageNames = {
  'ad9d0014-0bea-4a59-9205-a62e66ff671c':'Lead',
  'c47850eb-42f0-407f-9760-30474d793487':'Appuntamento',
  '4d7faf7a-e25e-486a-8b5a-93dce223612b':'Show-up',
  'e91bedb8-6c18-4ec5-a1c3-f6533095b497':'Vendita',
  '72b659f6-adac-4823-af50-dfc2cda500f3':'Perso',
};
const counts = {};
all?.forEach(l => { const s = stageNames[l.stage_id]||'Lead'; counts[s]=(counts[s]||0)+1; });
console.log('\n=== PIPELINE FINALE ===');
['Vendita','Show-up','Appuntamento','Lead','Perso'].forEach(s => {
  if (counts[s]) console.log('  ' + s + ': ' + counts[s]);
});
