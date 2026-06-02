/**
 * assign_unassigned_leads.mjs
 * 
 * Assegna in round-robin tutti i lead non assegnati importati oggi.
 * Usa la stessa logica di assignLeadRoundRobin in lib/lead-routing.ts
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const ORG_ID = 'a5dd4842-f0ea-4909-b4a3-be2cb1c6ffa5';

// --- 1. Leggi configurazione routing ---
const { data: org } = await sb.from('organizations').select('settings').eq('id', ORG_ID).single();
const settings = org?.settings || {};
const routingEnabled = settings.lead_routing_enabled !== false;
const routingMethod = settings.lead_routing_method || 'round_robin';

console.log(`\n⚙️  Routing: ${routingEnabled ? 'ATTIVO' : 'DISATTIVATO'}, Metodo: ${routingMethod}`);

if (!routingEnabled) {
  console.log('❌ Routing disattivato nelle impostazioni. Abilitalo dal pannello Settings.');
  process.exit(0);
}

// --- 2. Leggi membri in rotazione ---
const { data: members } = await sb
  .from('organization_members')
  .select('user_id, joined_at')
  .eq('organization_id', ORG_ID)
  .is('deactivated_at', null)
  .eq('in_round_robin', true)
  .order('joined_at', { ascending: true });

// Recupera nomi separatamente
const memberIds = members?.map(m => m.user_id) || [];
const { data: profiles } = memberIds.length
  ? await sb.from('profiles').select('id, full_name, email').in('id', memberIds)
  : { data: [] };
const profileMap = Object.fromEntries((profiles || []).map(p => [p.id, p]));

if (!members?.length) {
  console.error('❌ Nessun membro in rotazione. Vai su Settings → Assegnazione e aggiungi venditori.');
  
  process.exit(1);
}

console.log(`\n👥 Membri in rotazione (${members.length}):`);
members.forEach(m => {
  const p = profileMap[m.user_id];
  console.log(`   - ${p?.full_name || m.user_id} (${p?.email || ''})`);
});

// --- 3. Trova lead non assegnati importati oggi/ieri ---
const since = new Date();
since.setDate(since.getDate() - 2); // ultimi 2 giorni
since.setHours(0, 0, 0, 0);

const { data: unassignedLeads } = await sb
  .from('leads')
  .select('id, name, email, assigned_to, created_at, meta_data')
  .eq('organization_id', ORG_ID)
  .is('assigned_to', null)
  .gte('created_at', since.toISOString())
  .order('created_at', { ascending: true });

console.log(`\n📋 Lead non assegnati (ultimi 2 giorni): ${unassignedLeads?.length || 0}`);

if (!unassignedLeads?.length) {
  console.log('✅ Nessun lead da assegnare — tutti già hanno un venditore.');
  process.exit(0);
}

// --- 4. Round robin su lead non assegnati ---
let lastAssignedUserId = settings.last_assigned_user_id;
let assignedCount = 0;

for (const lead of unassignedLeads) {
  // Calcola prossimo in rotazione
  let nextUserId;
  if (lastAssignedUserId) {
    const lastIndex = members.findIndex(m => m.user_id === lastAssignedUserId);
    if (lastIndex !== -1 && lastIndex < members.length - 1) {
      nextUserId = members[lastIndex + 1].user_id;
    } else {
      nextUserId = members[0].user_id;
    }
  } else {
    nextUserId = members[0].user_id;
  }

  const memberName = profileMap[nextUserId]?.full_name || nextUserId;

  // Aggiorna il lead
  const { error } = await sb.from('leads').update({
    assigned_to: nextUserId,
    setter_id: nextUserId,
    closer_id: nextUserId,
    updated_at: new Date().toISOString(),
  }).eq('id', lead.id);

  if (error) {
    console.log(`❌ Errore assegnazione lead ${lead.name}: ${error.message}`);
    continue;
  }

  // Log attività
  await sb.from('lead_activities').insert({
    organization_id: ORG_ID,
    lead_id: lead.id,
    activity_type: 'assignment_changed',
    notes: `🎯 Assegnato automaticamente a ${memberName} (recovery round-robin)`,
  });

  console.log(`✅ ${lead.name || lead.email} → ${memberName}`);
  lastAssignedUserId = nextUserId;
  assignedCount++;
}

// --- 5. Aggiorna last_assigned_user_id nell'org ---
await sb.from('organizations').update({
  settings: { ...settings, last_assigned_user_id: lastAssignedUserId }
}).eq('id', ORG_ID);

console.log(`\n${'='.repeat(50)}`);
console.log(`✅ Assegnati: ${assignedCount} lead`);
  console.log(`   Ultimo assegnato a: ${profileMap[lastAssignedUserId]?.full_name || lastAssignedUserId}`);
console.log(`${'='.repeat(50)}\n`);
