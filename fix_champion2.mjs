import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const ORG = 'a5dd4842-f0ea-4909-b4a3-be2cb1c6ffa5';

// Try learning_protection category
const { error } = await sb.from('ad_automation_rules').insert({
  organization_id: ORG,
  name: 'V2: Champion Shield — Campione Lifetime',
  category: 'learning_protection',
  is_enabled: true,
  conditions: [
    { metric: 'cpl_lifetime', operator: '<=', reference: 'target_cpl', value_multiplier: 0.85 },
    { metric: 'spend_lifetime_vs_budget', operator: '>=', value: 14 },
    { metric: 'leads_lifetime', operator: '>=', value: 10 }
  ],
  actions: [{ type: 'champion_shield', notify: false, kill_threshold_multiplier: 5 }],
  min_spend_before_eval: 0,
  min_days_before_eval: 14,
  cooldown_hours: 0,
  target_metrics: { version: 'v2', logic: 'lifetime_champion', kill_threshold: 5 }
});
if (error) {
  console.log(`learning_protection failed: ${error.message}`);
  // Try fatigue
  const { error: e2 } = await sb.from('ad_automation_rules').insert({
    organization_id: ORG,
    name: 'V2: Champion Shield — Campione Lifetime',
    category: 'fatigue',
    is_enabled: true,
    conditions: [
      { metric: 'cpl_lifetime', operator: '<=', reference: 'target_cpl', value_multiplier: 0.85 },
      { metric: 'spend_lifetime_vs_budget', operator: '>=', value: 14 },
      { metric: 'leads_lifetime', operator: '>=', value: 10 }
    ],
    actions: [{ type: 'champion_shield', notify: false, kill_threshold_multiplier: 5 }],
    min_spend_before_eval: 0,
    min_days_before_eval: 14,
    cooldown_hours: 0,
    target_metrics: { version: 'v2', logic: 'lifetime_champion', kill_threshold: 5 }
  });
  console.log(e2 ? `fatigue failed: ${e2.message}` : '✅ Champion Shield V2 inserito con category=fatigue');
} else {
  console.log('✅ Champion Shield V2 inserito con category=learning_protection');
}
