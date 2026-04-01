import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const ORG = 'a5dd4842-f0ea-4909-b4a3-be2cb1c6ffa5';

// Check allowed categories
const { data: enumData } = await sb.rpc('exec_sql', { sql: "SELECT unnest(enum_range(NULL::text)) as val" }).catch(() => ({ data: null }));

// Try creative_winner as category (valid in system)
const { error } = await sb.from('ad_automation_rules').insert({
  organization_id: ORG,
  name: 'V2: Champion Shield — Campione Lifetime',
  category: 'creative_winner',  // valid category
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
console.log(error ? `❌ ${error.message}\nCode: ${error.code}\nDetails: ${error.details}` : '✅ Champion Shield V2 inserito!');
