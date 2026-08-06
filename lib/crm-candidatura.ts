/**
 * lib/crm-candidatura.ts
 *
 * Porta le candidature della pagina /candidatura dentro il gestionale.
 *
 * Prima esistevano solo su Telegram e in ActiveCampaign: arrivava la notifica,
 * ma nel CRM non c'era niente da lavorare e nessun venditore assegnato. Qui il
 * lead entra nella pipeline "Consulenza Post Webinar", nel primo stage.
 *
 * Il collegamento pagina → pipeline passa dal funnel con slug `candidatura`
 * (creato una volta sul database), non da una costante nel codice: così la
 * pipeline si può cambiare dal gestionale senza toccare il deploy.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { assignLeadRoundRobin } from './lead-routing'
import { notifyAssignedSeller } from './telegram'

const WEBINAR_TAG = 'Webinar Agosto 2026'

const FUNNEL_SLUG = 'candidatura'

export type CandidaturaCrm = {
  tipo: 'candidatura' | 'lista-attesa'
  nome: string
  email: string
  telefono: string
  etaFiglio: string
  livello: string
  difficolta: string
  utm: Record<string, string>
  landingUrl: string
  ip: string
  userAgent?: string
}

export type EsitoCrm =
  | { ok: true; leadId: string; nuovo: boolean; assegnato: boolean }
  | { ok: false; motivo: string }

function getSupabaseAdmin(): SupabaseClient {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceKey) {
    console.error('[CRM] SUPABASE_SERVICE_ROLE_KEY mancante: con la sola ANON_KEY le RLS bloccano la scrittura')
  }
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceKey || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}

type Funnel = { id: string; organization_id: string; pipeline_id: string | null; name: string }

// Il funnel non cambia in corsa: una lettura per processo basta.
let funnelCache: Funnel | null = null

async function getFunnel(db: SupabaseClient): Promise<Funnel | null> {
  if (funnelCache) return funnelCache

  const { data, error } = await db
    .from('funnels')
    .select('id, organization_id, pipeline_id, name')
    .eq('slug', FUNNEL_SLUG)
    .eq('status', 'active')
    .maybeSingle()

  if (error || !data) {
    console.error(`[CRM] Funnel "${FUNNEL_SLUG}" non trovato o non attivo:`, error)
    return null
  }

  funnelCache = data
  return data
}

/** Primo stage della pipeline del funnel; in mancanza, il primo dell'organizzazione. */
async function primoStage(db: SupabaseClient, f: Funnel): Promise<string | null> {
  if (f.pipeline_id) {
    const { data } = await db
      .from('pipeline_stages')
      .select('id')
      .eq('organization_id', f.organization_id)
      .eq('pipeline_id', f.pipeline_id)
      .order('sort_order', { ascending: true })
      .limit(1)
      .maybeSingle()
    if (data?.id) return data.id
  }

  const { data: fallback } = await db
    .from('pipeline_stages')
    .select('id')
    .eq('organization_id', f.organization_id)
    .order('sort_order', { ascending: true })
    .limit(1)
    .maybeSingle()
  return fallback?.id || null
}

/**
 * Le attività si inseriscono sempre da qui perché l'esito venga guardato.
 * `activity_type` è un enum in database: un valore fuori lista fa fallire
 * l'insert con un 22P02, e senza questo controllo l'errore sparisce e la
 * cronologia del lead resta muta senza che nessuno lo sappia. È già successo.
 */
async function registraAttivita(
  db: SupabaseClient,
  riga: Record<string, unknown>,
): Promise<void> {
  const { error } = await db.from('lead_activities').insert(riga)
  if (error) console.error(`[CRM] Attività "${riga.activity_type}" non registrata:`, error.message)
}

async function ensureLeadTag(db: SupabaseClient, orgId: string, leadId: string, tagName: string): Promise<void> {
  try {
    let { data: tag } = await db
      .from('crm_tags')
      .select('id')
      .eq('organization_id', orgId)
      .eq('name', tagName)
      .maybeSingle()

    if (!tag) {
      const defaultColors = ['#ec4899', '#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#6366f1', '#a855f7']
      const color = defaultColors[Math.floor(Math.random() * defaultColors.length)]
      const { data: newTag, error: tagError } = await db
        .from('crm_tags')
        .insert({ organization_id: orgId, name: tagName, color })
        .select('id')
        .single()
      if (tagError) {
        console.error(`[TAG] Errore creazione tag ${tagName}:`, tagError)
        return
      }
      tag = newTag
    }

    if (tag?.id) {
      const { error: joinError } = await db
        .from('lead_tags')
        .insert({ lead_id: leadId, tag_id: tag.id })
      if (joinError && joinError.code !== '23505') {
        console.error(`[TAG] Errore link tag ${tagName} → lead ${leadId}:`, joinError)
      }
    }
  } catch (err) {
    console.error(`[TAG] Eccezione tag ${tagName}:`, err)
  }
}

export async function inserisciCandidaturaNelCrm(c: CandidaturaCrm): Promise<EsitoCrm> {
  try {
    const db = getSupabaseAdmin()

    const funnel = await getFunnel(db)
    if (!funnel) return { ok: false, motivo: `funnel "${FUNNEL_SLUG}" non trovato` }

    const nome = c.nome.trim() || c.email
    const email = c.email.trim().toLowerCase()
    const telefono = c.telefono.trim()

    // 1. La submission grezza: resta anche se più avanti qualcosa va storto
    const { data: submission, error: errSub } = await db
      .from('funnel_submissions')
      .insert({
        organization_id: funnel.organization_id,
        funnel_id: funnel.id,
        name: nome,
        email: email || null,
        phone: telefono || null,
        utm_source: c.utm.utm_source || null,
        utm_medium: c.utm.utm_medium || null,
        utm_campaign: c.utm.utm_campaign || null,
        utm_content: c.utm.utm_content || null,
        utm_term: c.utm.utm_term || null,
        extra_data: {
          tipo: c.tipo,
          child_age: c.etaFiglio || null,
          livello: c.livello || null,
          difficolta: c.difficolta || null,
        },
        ip_address: c.ip !== 'unknown' ? c.ip : null,
        user_agent: c.userAgent || null,
      })
      .select('id')
      .single()

    if (errSub) return { ok: false, motivo: `submission non salvata: ${errSub.message}` }

    const stageId = await primoStage(db, funnel)

    // 2. Dedup: chi si era già registrato al webinar è già un lead. Non se ne
    //    crea un secondo — lo si sposta in questa pipeline, che è l'unico modo
    //    perché il coach lo veda fra le candidature da chiamare.
    let esistente: { id: string; stage_id: string | null; meta_data: Record<string, unknown> | null } | null = null

    if (email || telefono) {
      let q = db
        .from('leads')
        .select('id, stage_id, meta_data')
        .eq('organization_id', funnel.organization_id)
      if (email && telefono) q = q.or(`email.eq.${email},phone.eq.${telefono}`)
      else if (email) q = q.eq('email', email)
      else q = q.eq('phone', telefono)

      const { data } = await q.order('created_at', { ascending: false }).limit(1).maybeSingle()
      esistente = data
    }

    const noteCandidatura = c.tipo === 'candidatura'
      ? `Candidatura chiamata 20 min · figlio ${c.etaFiglio} anni · ${c.livello}\n\n${c.difficolta}`
      : "Iscritto alla lista d'attesa (candidature chiuse)"

    if (esistente) {
      const meta = esistente.meta_data || {}
      await db
        .from('leads')
        .update({
          submission_id: submission.id,
          stage_id: stageId,
          funnel_id: funnel.id,
          phone: telefono || undefined,
          notes: noteCandidatura,
          updated_at: new Date().toISOString(),
          meta_data: {
            ...meta,
            candidatura_tipo: c.tipo,
            child_age: c.etaFiglio || null,
            livello: c.livello || null,
            difficolta: c.difficolta || null,
            candidatura_at: new Date().toISOString(),
          },
        })
        .eq('id', esistente.id)

      await registraAttivita(db, {
        organization_id: funnel.organization_id,
        lead_id: esistente.id,
        activity_type: 'stage_changed',
        from_stage_id: esistente.stage_id,
        to_stage_id: stageId,
        notes: `🔥 Si è candidato alla chiamata dalla pagina /candidatura — spostato in Consulenza Post Webinar`,
      })

      // Tag webinar al lead esistente che si candida
      await ensureLeadTag(db, funnel.organization_id, esistente.id, WEBINAR_TAG)

      return { ok: true, leadId: esistente.id, nuovo: false, assegnato: false }
    }

    // 3. Lead nuovo
    const { data: lead, error: errLead } = await db
      .from('leads')
      .insert({
        organization_id: funnel.organization_id,
        funnel_id: funnel.id,
        submission_id: submission.id,
        stage_id: stageId,
        name: nome,
        email: email || null,
        phone: telefono || null,
        notes: noteCandidatura,
        // Il traffico di questa pagina arriva dalle email del lancio, non dalle ads
        product: 'Fonte: Email Marketing',
        utm_source: c.utm.utm_source || null,
        utm_campaign: c.utm.utm_campaign || null,
        meta_data: {
          source: 'candidatura',
          funnel_name: funnel.name,
          candidatura_tipo: c.tipo,
          child_age: c.etaFiglio || null,
          livello: c.livello || null,
          difficolta: c.difficolta || null,
          utm_medium: c.utm.utm_medium || null,
          utm_content: c.utm.utm_content || null,
          utm_term: c.utm.utm_term || null,
          event_source_url: `https://${c.landingUrl}`,
          client_ip: c.ip !== 'unknown' ? c.ip : null,
        },
      })
      .select('id')
      .single()

    if (errLead || !lead) return { ok: false, motivo: `lead non creato: ${errLead?.message}` }

    await registraAttivita(db, {
      organization_id: funnel.organization_id,
      lead_id: lead.id,
      activity_type: 'stage_changed',
      to_stage_id: stageId,
      notes: `Candidatura ricevuta dalla pagina /candidatura`,
    })

    // Tag webinar al lead nuovo
    await ensureLeadTag(db, funnel.organization_id, lead.id, WEBINAR_TAG)

    // 4. Assegnazione: senza un venditore il lead resta fermo nel primo stage
    let assegnato = false
    const assignedTo = await assignLeadRoundRobin(funnel.organization_id, db, funnel.pipeline_id)
    if (assignedTo) {
      await db
        .from('leads')
        .update({ assigned_to: assignedTo, setter_id: assignedTo, closer_id: assignedTo })
        .eq('id', lead.id)

      await registraAttivita(db, {
        organization_id: funnel.organization_id,
        lead_id: lead.id,
        activity_type: 'assigned',
        notes: '🎯 Assegnato automaticamente (Qualificatore e Venditore)',
      })

      notifyAssignedSeller(funnel.organization_id, assignedTo, {
        name: nome,
        email: email || null,
        phone: telefono || null,
        funnel: funnel.name,
        source: c.utm.utm_source || null,
      }).catch((err) => console.error('[CRM] Notifica al venditore fallita:', err))

      assegnato = true
    }

    return { ok: true, leadId: lead.id, nuovo: true, assegnato }
  } catch (err) {
    console.error('[CRM] Inserimento candidatura fallito:', err)
    return { ok: false, motivo: err instanceof Error ? err.message : String(err) }
  }
}
