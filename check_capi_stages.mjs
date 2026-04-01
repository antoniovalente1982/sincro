import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const { data, error } = await sb
  .from('pipeline_stages')
  .select('name, fire_capi_event, slug, is_won, pipeline_id')
  .eq('organization_id', 'a5dd4842-f0ea-4909-b4a3-be2cb1c6ffa5');

if (error) { console.error(error); process.exit(1); }

console.log('\n PIPELINE STAGES + EVENTI CAPI:\n');
data.forEach(s => {
  const event = s.fire_capi_event ? `OK ${s.fire_capi_event}` : 'NO evento';
  const won = s.is_won ? ' WON' : '';
  console.log(`  ${s.name}${won} --> ${event}`);
});

const { data: events } = await sb
  .from('tracked_events')
  .select('event_name, sent_to_provider')
  .eq('organization_id', 'a5dd4842-f0ea-4909-b4a3-be2cb1c6ffa5');

console.log('\n EVENTI CAPI AGGREGATI:\n');
const summary = {};
events?.forEach(e => {
  if (!summary[e.event_name]) summary[e.event_name] = { total: 0, sent: 0 };
  summary[e.event_name].total++;
  if (e.sent_to_provider) summary[e.event_name].sent++;
});
Object.entries(summary).forEach(([name, s]) => {
  console.log(`  ${name}: ${s.sent}/${s.total} inviati a Meta`);
});
if (Object.keys(summary).length === 0) console.log('  Nessun evento trovato');
