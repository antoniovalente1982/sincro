import { romeDateString } from '@/lib/timezone'

// ============================================================
// Prenotazione appuntamento dal pool — usata dagli agenti AI setter.
// L'AI fa da SETTER: fissa l'appuntamento ma il CLOSER è un
// venditore umano scelto in round-robin (meno carico oggi).
// La notifica è neutra (non rivela l'AI) per tenerlo invisibile.
// ============================================================

type Admin = ReturnType<typeof import('@/lib/supabase/admin').getSupabaseAdmin>

/** Sceglie il prossimo closer umano in round-robin (meno appuntamenti oggi). */
export async function pickRoundRobinCloser(admin: Admin, orgId: string): Promise<string | null> {
    // Closer umani attivi (esclude gli agenti AI)
    const { data: members } = await admin
        .from('organization_members')
        .select('user_id, role, is_ai_agent, team')
        .eq('organization_id', orgId)
        .is('deactivated_at', null)
        .in('role', ['closer', 'manager', 'owner'])

    const humanClosers = (members || [])
        .filter((m: any) => !m.is_ai_agent && m.team !== 'ai')
        .map((m: any) => m.user_id)

    if (humanClosers.length === 0) return null
    if (humanClosers.length === 1) return humanClosers[0]

    // Conta gli appuntamenti di oggi per ciascun closer → prendi il meno carico
    const todayStart = `${romeDateString()}T00:00:00.000Z`
    const { data: todaysEvents } = await admin
        .from('calendar_events')
        .select('closer_id')
        .eq('organization_id', orgId)
        .gte('start_time', todayStart)

    const load: Record<string, number> = {}
    humanClosers.forEach((id: string) => { load[id] = 0 })
    for (const e of todaysEvents || []) {
        if (e.closer_id && load[e.closer_id] !== undefined) load[e.closer_id] += 1
    }

    return humanClosers.sort((a: string, b: string) => load[a] - load[b])[0]
}

/**
 * Fissa un appuntamento a partire da un lead del pool.
 * Crea (o collega) il lead CRM, crea l'evento a calendario, aggiorna il pool.
 * setterUserId = chi ha fatto il setting (l'agente AI). closer = round-robin umano.
 */
export async function bookAppointmentFromPool(admin: Admin, opts: {
    orgId: string
    poolLeadId: string
    setterUserId: string
    appointmentAt: string
    durationMin?: number
    notes?: string
    isAI?: boolean
}): Promise<{ ok: boolean; calendarEventId?: string; closerId?: string; crmLeadId?: string; error?: string }> {
    const { orgId, poolLeadId, setterUserId, appointmentAt, durationMin = 30, notes, isAI = false } = opts
    const now = new Date().toISOString()

    const { data: lead } = await admin
        .from('lead_pool')
        .select('*')
        .eq('id', poolLeadId)
        .eq('organization_id', orgId)
        .single()

    if (!lead) return { ok: false, error: 'Lead non trovato' }

    const closerId = await pickRoundRobinCloser(admin, orgId)
    if (!closerId) return { ok: false, error: 'Nessun closer umano disponibile' }

    const leadName = lead.full_name || `${lead.first_name || ''} ${lead.last_name || ''}`.trim() || 'Lead'

    // Stage di default pipeline
    let defaultStageId: string | null = null
    const { data: pipeline } = await admin
        .from('pipelines').select('id').eq('organization_id', orgId).eq('is_default', true).limit(1).maybeSingle()
    const pipelineId = pipeline?.id || (await admin
        .from('pipelines').select('id').eq('organization_id', orgId).limit(1).maybeSingle()).data?.id
    if (pipelineId) {
        const { data: stage } = await admin
            .from('pipeline_stages').select('id').eq('pipeline_id', pipelineId)
            .order('sort_order', { ascending: true }).limit(1).maybeSingle()
        defaultStageId = stage?.id || null
    }

    // Lead CRM (setter = AI, closer = umano)
    let crmLeadId: string | null = lead.crm_lead_id || null
    if (!crmLeadId) {
        const { data: crmLead, error: crmErr } = await admin
            .from('leads')
            .insert({
                organization_id: orgId,
                name: leadName,
                phone: lead.phone,
                email: lead.email,
                setter_id: setterUserId,
                closer_id: closerId,
                assigned_to: closerId,
                stage_id: defaultStageId,
                source_channel: 'lead_pool',
                track: 'ai',
                utm_source: lead.utm_source,
                utm_campaign: lead.utm_campaign,
                notes: `Appuntamento fissato da setter AI.${lead.city ? ` Città: ${lead.city}.` : ''} Lista: ${lead.list_id}. ${notes || ''}`.trim(),
                meta_data: { source: 'stazione_leads_ai', pool_lead_id: poolLeadId, city: lead.city || null },
                created_at: now,
                updated_at: now,
            })
            .select('id')
            .single()
        if (crmErr) console.error('[AI-BOOK] Errore creazione lead CRM:', crmErr)
        crmLeadId = crmLead?.id || null
    }

    // Evento a calendario
    const start = new Date(appointmentAt)
    const end = new Date(start.getTime() + durationMin * 60 * 1000)
    const { data: evt } = await admin
        .from('calendar_events')
        .insert({
            organization_id: orgId,
            lead_id: crmLeadId,
            setter_id: setterUserId,
            closer_id: closerId,
            title: `📅 Appuntamento — ${leadName}`,
            description: notes || 'Appuntamento fissato dalla Stazione Leads',
            lead_phone: lead.phone,
            lead_email: lead.email,
            start_time: start.toISOString(),
            end_time: end.toISOString(),
            status: 'confirmed',
        })
        .select('id')
        .single()

    // Aggiorna il pool lead (accredita il setter)
    await admin
        .from('lead_pool')
        .update({
            feedback: 'appointment',
            status: 'converted',
            appointment_at: appointmentAt,
            crm_lead_id: crmLeadId,
            feedback_at: now,
            last_called_at: now,
            updated_at: now,
        })
        .eq('id', poolLeadId)

    // Notifica NEUTRA (non rivela l'AI): al closer arriva come normale appuntamento inbound
    try {
        await admin.from('notifications').insert({
            organization_id: orgId,
            type: 'info',
            title: '📅 Nuovo appuntamento assegnato',
            message: `Appuntamento con ${leadName} il ${start.toLocaleString('it-IT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}.`,
            link: '/dashboard/calendar',
            is_read: false,
        })
    } catch { /* best-effort */ }

    return { ok: true, calendarEventId: evt?.id, closerId, crmLeadId: crmLeadId || undefined }
}
