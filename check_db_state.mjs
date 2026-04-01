import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const ORG = 'a5dd4842-f0ea-4909-b4a3-be2cb1c6ffa5';

// Config
const { data: cfg } = await sb.from('ai_agent_config').select('*').eq('organization_id', ORG).single();
console.log('\n=== ai_agent_config columns ===');
if (cfg) console.log(Object.keys(cfg).join(', '));
console.log('\nValues:', JSON.stringify(cfg, null, 2));

// Rules
const { data: rules } = await sb.from('ad_automation_rules').select('name, category, is_enabled, conditions, actions, min_spend_before_eval').eq('organization_id', ORG).order('category');
console.log('\n=== ad_automation_rules ===');
rules?.forEach(r => console.log(`  [${r.is_enabled?'ON':'OFF'}] ${r.category} | ${r.name} | min_spend:${r.min_spend_before_eval}`));
