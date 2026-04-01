import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const ORG = 'a5dd4842-f0ea-4909-b4a3-be2cb1c6ffa5';

console.log('=== AI Engine V2 — DB Upgrade ===\n');

// 1. Update ai_agent_config with new V2 parameters
// budget_weekly is already 2100 (€300/day × 7) — use it as reference
// We add new fields via objectives JSON (no migration needed)
const { error: e1 } = await sb.from('ai_agent_config').update({
  objectives: {
    target_cpl: 20,           // Target CPL in €
    target_ctr: 0,
    target_roas: 0,
    // V2 Kill Guardian parameters
    kill_multiplier: 3.0,          // spend > budget_daily × 3 → kill trigger
    champion_multiplier: 5.0,      // spend > budget_daily × 5 → kill even champion
    champion_min_spend_days: 14,   // ad needs 14 days of budget to be "champion"
    scale_cpl_ratio_3d: 0.85,      // cpl_3d < target × 0.85 → scale
    scale_cpl_ratio_7d: 1.0,       // cpl_7d < target × 1.0 → scale (must BOTH be true)
    kill_guardian_interval_hours: 4, // how often kill-guardian runs
  },
  updated_at: new Date().toISOString()
}).eq('organization_id', ORG);
console.log(e1 ? `❌ Config update: ${e1.message}` : '✅ ai_agent_config: parametri V2 aggiornati (kill_multiplier=3, champion=5, scale_3d=85%)');

// 2. DISABLE all old fixed-€ kill rules (keep them for reference but disable)
const OLD_KILL_RULES = [
  'Kill: Spesa senza lead',
  'Kill: CPL 3x target',
  'Kill: Emergenza Giornaliera (>€30 e 0 lead)',
  'Link CTR Basso — Kill Creative',
  'Kill: CTR morto',
];
for (const name of OLD_KILL_RULES) {
  const { error } = await sb.from('ad_automation_rules').update({ is_enabled: false, updated_at: new Date().toISOString() }).eq('organization_id', ORG).eq('name', name);
  console.log(error ? `❌ Disable ${name}: ${error.message}` : `✅ DISABILITATA: ${name}`);
}

// 3. DISABLE old scale/winner rules with fixed thresholds
const OLD_SCALE_RULES = [
  'Scale Down: Frequency alta',
  'Scale Down: CPL crescente',
  'Scale Up: CPL Excellence (< 80% target)',
  'Scale Up: Winner confermato',
  'Scale Up: Volume lead alto',
  'Winner: CTR forte',
  'Winner: CPL Excellence (< 80% target)',
  'Winner: CPL sotto target',
  'Fatigue: Creative vecchia',
  'Fatigue: CTR in calo',
];
for (const name of OLD_SCALE_RULES) {
  const { error } = await sb.from('ad_automation_rules').update({ is_enabled: false, updated_at: new Date().toISOString() }).eq('organization_id', ORG).eq('name', name);
  console.log(error ? `❌ Disable ${name}: ${error.message}` : `✅ DISABILITATA: ${name}`);
}

// 4. ADD: Master Kill Rule V2 — budget-relative (no fixed €)
// Conditions stored as metadata for AI, actual logic is in code
const { error: e2 } = await sb.from('ad_automation_rules').insert({
  organization_id: ORG,
  name: 'V2: Kill — 3× Budget senza ROI (budget-relativo)',
  category: 'creative_kill',
  is_enabled: true,
  conditions: [
    { metric: 'spend_vs_budget_ratio', operator: '>', value: 3, description: 'spend_7d > daily_budget × 3' },
    { metric: 'leads', operator: '=', value: 0, window: '7d' }
  ],
  actions: [{ type: 'pause_ad', notify: true, message: 'Kill V2: 3× budget bruciato senza lead in 7gg' }],
  min_spend_before_eval: 0,  // handled by budget ratio
  min_days_before_eval: 2,   // min 2 days before evaluating
  cooldown_hours: 0,         // no cooldown — once killed, killed
  target_metrics: { version: 'v2', logic: 'budget_relative', window: '7d', protection: ['leads_3d>=1', 'cpl_7d<=target*1.2', 'champion_lifetime'] }
});
console.log(e2 ? `❌ Kill V2: ${e2.message}` : '✅ NUOVA: Kill V2 — 3× Budget senza ROI (budget-relativo)');

// 5. ADD: Master Scale Rule V2 — triple confirmed winner
const { error: e3 } = await sb.from('ad_automation_rules').insert({
  organization_id: ORG,
  name: 'V2: Scale — Vincitore Triplo Confermato',
  category: 'budget_scale_up',
  is_enabled: true,
  conditions: [
    { metric: 'cpl_3d', operator: '<', reference: 'target_cpl', value_multiplier: 0.85, description: 'CPL ultimi 3gg < 85% target' },
    { metric: 'cpl_7d', operator: '<=', reference: 'target_cpl', value_multiplier: 1.0, description: 'CPL 7gg <= target' },
    { metric: 'leads', operator: '>=', value: 3, window: '7d' }
  ],
  actions: [{ type: 'increase_budget', value: 25, notify: true, message: 'Scale V2: vincitore triplo confermato +25%' }],
  min_spend_before_eval: 0,
  min_days_before_eval: 4,
  cooldown_hours: 48,
  target_metrics: { version: 'v2', logic: 'triple_confirmed', windows: ['3d', '7d'] }
});
console.log(e3 ? `❌ Scale V2: ${e3.message}` : '✅ NUOVA: Scale V2 — Vincitore Triplo Confermato (+25%)');

// 6. ADD: Champion Shield V2 — earned through lifetime performance
const { error: e4 } = await sb.from('ad_automation_rules').insert({
  organization_id: ORG,
  name: 'V2: Champion Shield — Campione Lifetime',
  category: 'cpl_shield',
  is_enabled: true,
  conditions: [
    { metric: 'cpl_lifetime', operator: '<=', reference: 'target_cpl', value_multiplier: 0.85 },
    { metric: 'spend_lifetime_vs_budget', operator: '>=', value: 14, description: 'lifetime spend >= 14 days budget' },
    { metric: 'leads_lifetime', operator: '>=', value: 10 }
  ],
  actions: [{ type: 'shield_active', notify: false }],
  min_spend_before_eval: 0,
  min_days_before_eval: 14,
  cooldown_hours: 0,
  target_metrics: { version: 'v2', logic: 'lifetime_champion', kill_threshold: 5 }
});
console.log(e4 ? `❌ Champion Shield V2: ${e4.message}` : '✅ NUOVA: Champion Shield V2 — Campione Lifetime (soglia kill alzata a 5×)');

// 7. Keep learning_protection enabled (it's fine as-is)
console.log('\n✅ Protezione Learning Phase: mantenuta attiva');
// Keep Fatigue Predittiva enabled (alert-only is correct)
console.log('✅ Alert: Fatigue Predittiva: mantenuta attiva (solo alert)');

console.log('\n=== DB V2 Upgrade Complete ===');
