import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const ORG_ID = 'a5dd4842-f0ea-4909-b4a3-be2cb1c6ffa5';

async function run() {
  console.log('🔄 Starting AI Engine rules update...');

  // 1. Convert CTR kill → alert
  const { error: e1 } = await sb.from('ad_automation_rules')
    .update({ 
      category: 'fatigue',
      actions: [{ type: 'alert', notify: true, message: 'CTR basso: verifica creatività. Link CTR < 0.5% dopo €15 spesi — valuta refresh visivo' }],
      updated_at: new Date().toISOString()
    })
    .eq('organization_id', ORG_ID)
    .eq('name', 'Link CTR Basso — Kill Creative');
  console.log(e1 ? `❌ CTR kill→alert: ${e1.message}` : '✅ Link CTR Basso → Alert');

  const { error: e2 } = await sb.from('ad_automation_rules')
    .update({ 
      category: 'fatigue',
      actions: [{ type: 'alert', notify: true, message: "CTR morto: l'ad ha esaurito il pubblico. Frequenza alta + CTR < 1% — prepara creatività fresh" }],
      updated_at: new Date().toISOString()
    })
    .eq('organization_id', ORG_ID)
    .eq('name', 'Kill: CTR morto');
  console.log(e2 ? `❌ CTR morto→alert: ${e2.message}` : '✅ Kill CTR morto → Alert');

  // 2. Frequency Scale Down: soglia 3 → 6
  const { error: e3 } = await sb.from('ad_automation_rules')
    .update({ 
      conditions: [{ value: 6, metric: 'frequency', operator: '>' }],
      updated_at: new Date().toISOString()
    })
    .eq('organization_id', ORG_ID)
    .eq('name', 'Scale Down: Frequency alta');
  console.log(e3 ? `❌ Frequency soglia: ${e3.message}` : '✅ Frequency Scale Down: soglia 3→6');

  // 3. Fatigue CTR in calo: frequency soglia 2.5 → 5
  const { error: e4 } = await sb.from('ad_automation_rules')
    .update({ 
      conditions: [{ value: 5, metric: 'frequency', operator: '>' }, { value: 1.5, metric: 'ctr', operator: '<' }],
      updated_at: new Date().toISOString()
    })
    .eq('organization_id', ORG_ID)
    .eq('name', 'Fatigue: CTR in calo');
  console.log(e4 ? `❌ Fatigue CTR: ${e4.message}` : '✅ Fatigue CTR in calo: frequency soglia 2.5→5');

  // 4. Spesa senza lead: 40 → 55
  const { error: e5 } = await sb.from('ad_automation_rules')
    .update({ 
      conditions: [{ value: 55, metric: 'spend', operator: '>' }, { value: 0, metric: 'leads', operator: '=' }],
      min_spend_before_eval: 55,
      updated_at: new Date().toISOString()
    })
    .eq('organization_id', ORG_ID)
    .eq('name', 'Kill: Spesa senza lead');
  console.log(e5 ? `❌ Spesa senza lead: ${e5.message}` : '✅ Kill Spesa senza lead: 40→55€');

  // 5. Scale Up Winner min_spend: 20 → 35
  const { error: e6 } = await sb.from('ad_automation_rules')
    .update({ min_spend_before_eval: 35, updated_at: new Date().toISOString() })
    .eq('organization_id', ORG_ID)
    .eq('name', 'Scale Up: Winner confermato');
  console.log(e6 ? `❌ Scale Up min spend: ${e6.message}` : '✅ Scale Up Winner: min_spend 20→35€');

  // 6. Add: Scale Up CPL Excellence
  const { error: e7 } = await sb.from('ad_automation_rules').insert({
    organization_id: ORG_ID,
    name: 'Scale Up: CPL Excellence (< 80% target)',
    category: 'budget_scale_up',
    is_enabled: true,
    conditions: [
      { metric: 'cpl', operator: '<', reference: 'target_cpl', value_multiplier: 0.8 },
      { value: 4, metric: 'leads', operator: '>=' }
    ],
    actions: [{ type: 'increase_budget', value: 25, notify: true }],
    min_spend_before_eval: 30,
    min_days_before_eval: 4,
    cooldown_hours: 48,
    target_metrics: {}
  });
  console.log(e7 ? `❌ Scale Up Excellence: ${e7.message}` : '✅ NUOVA: Scale Up CPL Excellence (+25% budget)');

  // 7. Add: Emergenza Giornaliera
  const { error: e8 } = await sb.from('ad_automation_rules').insert({
    organization_id: ORG_ID,
    name: 'Kill: Emergenza Giornaliera (>€30 e 0 lead)',
    category: 'creative_kill',
    is_enabled: true,
    conditions: [
      { value: 30, metric: 'spend', operator: '>' },
      { value: 0, metric: 'leads', operator: '=' }
    ],
    actions: [{ type: 'pause_ad', notify: true }],
    min_spend_before_eval: 30,
    min_days_before_eval: 3,
    cooldown_hours: 24,
    target_metrics: {}
  });
  console.log(e8 ? `❌ Emergenza Giornaliera: ${e8.message}` : '✅ NUOVA: Emergenza Giornaliera (kill daily)');

  // 8. Add: Fatigue Predittiva
  const { error: e9 } = await sb.from('ad_automation_rules').insert({
    organization_id: ORG_ID,
    name: 'Alert: Fatigue Predittiva (Frequency > 5)',
    category: 'fatigue',
    is_enabled: true,
    conditions: [{ value: 5, metric: 'frequency', operator: '>' }],
    actions: [{ type: 'alert', notify: true, message: 'Ad in fatigue avanzata (freq>5): prepara creative fresh nei prossimi 3-5 giorni' }],
    min_spend_before_eval: 20,
    min_days_before_eval: 5,
    cooldown_hours: 48,
    target_metrics: {}
  });
  console.log(e9 ? `❌ Fatigue Predittiva: ${e9.message}` : '✅ NUOVA: Fatigue Predittiva (solo alert)');

  // 9. Add: Winner CPL Excellence
  const { error: e10 } = await sb.from('ad_automation_rules').insert({
    organization_id: ORG_ID,
    name: 'Winner: CPL Excellence (< 80% target)',
    category: 'creative_winner',
    is_enabled: true,
    conditions: [
      { metric: 'cpl', operator: '<', reference: 'target_cpl', value_multiplier: 0.8 },
      { value: 3, metric: 'leads', operator: '>=' }
    ],
    actions: [{ type: 'flag_winner', notify: true }],
    min_spend_before_eval: 25,
    min_days_before_eval: 4,
    cooldown_hours: 24,
    target_metrics: {}
  });
  console.log(e10 ? `❌ Winner CPL Excellence: ${e10.message}` : '✅ NUOVA: Winner CPL Excellence (< 80% target)');

  console.log('\nDB update complete.');
}
run().catch(console.error);
