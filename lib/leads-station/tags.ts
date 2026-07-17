// ============================================================
// Tag CRM per i lead provenienti dalla Stazione Leads.
// Usato sia dal percorso umano (/api/leads-pool/feedback)
// sia dal percorso AI setter (bookAppointmentFromPool).
// ============================================================

type Admin = ReturnType<typeof import('@/lib/supabase/admin').getSupabaseAdmin>

// Nome del tag applicato ai lead CRM creati dalla Stazione Leads
export const STAZIONE_LEADS_TAG = 'Stazione Leads'

/**
 * Trova-o-crea il tag "Stazione Leads" nell'org e lo associa al lead CRM.
 * Best-effort: gli errori vengono loggati ma non propagati.
 */
export async function ensureStazioneLeadsTag(admin: Admin, orgId: string, leadId: string): Promise<void> {
    try {
        let { data: tag } = await admin
            .from('crm_tags')
            .select('id')
            .eq('organization_id', orgId)
            .eq('name', STAZIONE_LEADS_TAG)
            .maybeSingle()

        if (!tag) {
            const { data: newTag, error: tagError } = await admin
                .from('crm_tags')
                .insert({ organization_id: orgId, name: STAZIONE_LEADS_TAG, color: '#6366f1' })
                .select('id')
                .single()
            if (tagError) {
                // Race: un altro insert può averlo creato nel frattempo → rileggilo
                const { data: existing } = await admin
                    .from('crm_tags')
                    .select('id')
                    .eq('organization_id', orgId)
                    .eq('name', STAZIONE_LEADS_TAG)
                    .maybeSingle()
                tag = existing
            } else {
                tag = newTag
            }
        }

        if (tag?.id) {
            const { error: joinError } = await admin
                .from('lead_tags')
                .insert({ lead_id: leadId, tag_id: tag.id })
            // 23505 = già associato, lo ignoriamo
            if (joinError && joinError.code !== '23505') {
                console.error('[STAZIONE-LEADS-TAG] Errore associazione tag:', joinError)
            }
        }
    } catch (err) {
        console.error('[STAZIONE-LEADS-TAG] Eccezione:', err)
    }
}
