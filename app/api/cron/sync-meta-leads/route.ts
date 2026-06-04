/**
 * app/api/cron/sync-meta-leads/route.ts
 * 
 * Cron di fallback che sincronizza i lead dai Meta Lead Ads ogni ora.
 * 
 * Complementa il webhook in tempo reale: se un lead non è arrivato via webhook
 * (es. Meta ha avuto problemi di consegna), questo cron lo recupera.
 * 
 * Schedulato: ogni 30 minuti (vercel.json schedule: ogni-trenta-minuti)
 * 
 * Flusso:
 *  1. Recupera le credenziali Meta da `connections`
 *  2. Valida il token — se scaduto tenta auto-refresh, altrimenti crea notifica
 *  3. Lista tutti i leadgen_forms dell'account
 *  4. Per ogni form, scarica i lead delle ultime 2 ore
 *  5. Importa nel CRM solo quelli non già presenti (dedup per email + leadgen_id)
 */

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import {
    fetchAdAccountForms,
    fetchFormLeads,
    processMetaLead,
    MetaLeadProcessResult,
} from '@/lib/meta-lead-forms'

export const runtime = 'nodejs'
export const maxDuration = 300 // 5 minuti max (molti form potrebbe richiedere tempo)

function getSupabaseAdmin() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    )
}

// ─── Valida il token Meta via debug_token ─────────────────────────────────────
async function validateMetaToken(accessToken: string): Promise<{ valid: boolean; expiresAt?: Date; error?: string }> {
    try {
        const res = await fetch(
            `https://graph.facebook.com/v21.0/debug_token?input_token=${accessToken}&access_token=${accessToken}`
        )
        const data = await res.json()
        if (data.error || !data.data?.is_valid) {
            return { valid: false, error: data.error?.message || 'Token non valido' }
        }
        const expiresAt = data.data?.expires_at
            ? new Date(data.data.expires_at * 1000)
            : undefined
        return { valid: true, expiresAt }
    } catch (err: any) {
        return { valid: false, error: err.message }
    }
}

// ─── Tenta auto-refresh del token ─────────────────────────────────────────────
async function tryRefreshToken(connId: string, accessToken: string, supabase: ReturnType<typeof getSupabaseAdmin>): Promise<string | null> {
    const appSecret = process.env.META_APP_SECRET
    if (!appSecret) return null

    try {
        // Debug per ottenere app_id
        const debugRes = await fetch(
            `https://graph.facebook.com/v21.0/debug_token?input_token=${accessToken}&access_token=${accessToken}`
        )
        const debugData = await debugRes.json()
        const appId = debugData.data?.app_id
        if (!appId) return null

        // Scambia per un nuovo Long-Lived Token
        const exchangeRes = await fetch(
            `https://graph.facebook.com/v21.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${appId}&client_secret=${appSecret}&fb_exchange_token=${accessToken}`
        )
        const exchangeData = await exchangeRes.json()
        if (exchangeData.error || !exchangeData.access_token) return null

        const newToken = exchangeData.access_token
        const newExpiresAt = new Date(Date.now() + (exchangeData.expires_in || 5183944) * 1000).toISOString()

        // Salva il nuovo token in DB
        await supabase
            .from('connections')
            .update({
                credentials: supabase
                    .from('connections')
                    .select('credentials')
                    .eq('id', connId),
                status: 'active',
                updated_at: new Date().toISOString(),
            })
            .eq('id', connId)

        // Update diretta con merge credentials
        const { data: existing } = await supabase
            .from('connections')
            .select('credentials')
            .eq('id', connId)
            .single()

        await supabase
            .from('connections')
            .update({
                credentials: { ...(existing?.credentials || {}), access_token: newToken, token_expires_at: newExpiresAt, token_updated_at: new Date().toISOString() },
                status: 'active',
                updated_at: new Date().toISOString(),
            })
            .eq('id', connId)

        console.log(`[SyncMetaLeads] Token auto-refreshed for conn ${connId}. Expires: ${newExpiresAt}`)
        return newToken
    } catch (err) {
        console.error(`[SyncMetaLeads] Auto-refresh failed for conn ${connId}:`, err)
        return null
    }
}

// ─── Crea notifica in dashboard + segna connessione come scaduta ──────────────
async function notifyTokenExpired(connId: string, orgId: string, errorMsg: string, supabase: ReturnType<typeof getSupabaseAdmin>) {
    // Segna la connessione come token_expired per bloccare ulteriori tentativi
    await supabase
        .from('connections')
        .update({ status: 'token_expired', updated_at: new Date().toISOString() })
        .eq('id', connId)

    // Evita di creare duplicate notifiche se già esiste una non letta nelle ultime 24h
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const { data: existing } = await supabase
        .from('notifications')
        .select('id')
        .eq('organization_id', orgId)
        .eq('type', 'critical')
        .ilike('title', '%Token Meta%')
        .eq('is_read', false)
        .gte('created_at', oneDayAgo)
        .limit(1)
        .single()

    if (existing) return // Notifica già presente, non duplicare

    await supabase.from('notifications').insert({
        organization_id: orgId,
        type: 'critical',
        title: '⚠️ Token Meta Ads scaduto',
        message: `Il token di connessione Meta Ads è scaduto o non valido (${errorMsg}). I lead dai Meta Lead Ads NON vengono più importati automaticamente. Vai su Connessioni → Meta Ads e rinnova il token.`,
        link: '/dashboard/connections',
        is_read: false,
    })

    console.error(`[SyncMetaLeads] Token expired for org ${orgId}, conn ${connId}. Dashboard notification created.`)
}

export async function GET(req: Request) {
    // ── Verifica Cron Secret ──────────────────────────────────────────────────
    const authHeader = req.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const startTime = Date.now()
    const supabase = getSupabaseAdmin()

    // ── Recupera tutte le org con Meta Ads collegato ──────────────────────────
    const { data: connections } = await supabase
        .from('connections')
        .select('id, organization_id, credentials')
        .eq('provider', 'meta_ads')
        .in('status', ['active', 'token_expired']) // include token_expired per tentare refresh
        .select()

    if (!connections?.length) {
        return NextResponse.json({ 
            success: true, 
            message: 'No active Meta Ads connections',
            timestamp: new Date().toISOString()
        })
    }

    const allResults: {
        org: string
        forms_checked: number
        leads_found: number
        created: number
        updated: number
        errors: number
        skipped_reason?: string
        results: MetaLeadProcessResult[]
    }[] = []

    // ── Processa ogni org ─────────────────────────────────────────────────────
    for (const conn of connections) {
        const { id: connId, organization_id: orgId, credentials } = conn
        let accessToken = credentials?.access_token
        const adAccountId = credentials?.ad_account_id

        if (!accessToken || !adAccountId) {
            console.warn(`[SyncMetaLeads] Missing credentials for org ${orgId}`)
            allResults.push({ org: orgId, forms_checked: 0, leads_found: 0, created: 0, updated: 0, errors: 0, skipped_reason: 'missing_credentials', results: [] })
            continue
        }

        // ── 1. Valida il token ────────────────────────────────────────────────
        const tokenCheck = await validateMetaToken(accessToken)

        if (!tokenCheck.valid) {
            console.warn(`[SyncMetaLeads] Token invalid for org ${orgId}: ${tokenCheck.error}. Attempting auto-refresh...`)

            // ── 2. Tenta auto-refresh ─────────────────────────────────────────
            const refreshedToken = await tryRefreshToken(connId, accessToken, supabase)

            if (refreshedToken) {
                accessToken = refreshedToken
                console.log(`[SyncMetaLeads] Auto-refresh successful for org ${orgId}, continuing with new token.`)
                // Riattiva la connessione nel DB se era token_expired
                await supabase.from('connections').update({ status: 'active' }).eq('id', connId)
            } else {
                // ── 3. Notifica in dashboard e salta ─────────────────────────
                await notifyTokenExpired(connId, orgId, tokenCheck.error || 'unknown', supabase)
                allResults.push({ org: orgId, forms_checked: 0, leads_found: 0, created: 0, updated: 0, errors: 1, skipped_reason: 'token_expired', results: [] })
                continue
            }
        }

        console.log(`[SyncMetaLeads] Processing org ${orgId}, account act_${adAccountId}`)

        // Recupera tutti i form dell'account (filtra quelli ATTIVI o ARCHIVIATI)
        const forms = await fetchAdAccountForms(adAccountId, accessToken)
        console.log(`[SyncMetaLeads] Found ${forms.length} forms for org ${orgId}`)

        if (!forms.length) {
            allResults.push({
                org: orgId,
                forms_checked: 0,
                leads_found: 0,
                created: 0,
                updated: 0,
                errors: 0,
                results: [],
            })
            continue
        }

        // Scarica lead delle ultime 2 ore per ogni form
        // (2h di overlap per garantire che nessun lead venga perso tra una run e l'altra)
        const sinceTimestamp = Math.floor((Date.now() - 2 * 60 * 60 * 1000) / 1000)

        const orgResults: MetaLeadProcessResult[] = []
        let totalLeadsFound = 0

        for (const form of forms) {
            // Salta i form in draft
            if (form.status === 'DRAFT') continue

            const leads = await fetchFormLeads(form.id, accessToken, sinceTimestamp)
            totalLeadsFound += leads.length

            if (!leads.length) continue

            console.log(`[SyncMetaLeads] Form ${form.id} (${form.name}): ${leads.length} lead(s) found`)

            for (const rawLead of leads) {
                const result = await processMetaLead(rawLead, orgId, supabase)
                orgResults.push(result)
            }
        }

        const created = orgResults.filter(r => r.status === 'created').length
        const updated = orgResults.filter(r => r.status === 'updated').length
        const errors = orgResults.filter(r => r.status === 'error').length

        console.log(`[SyncMetaLeads] Org ${orgId}: ${created} created, ${updated} updated, ${errors} errors`)

        allResults.push({
            org: orgId,
            forms_checked: forms.length,
            leads_found: totalLeadsFound,
            created,
            updated,
            errors,
            results: orgResults,
        })
    }

    const duration = Date.now() - startTime

    return NextResponse.json({
        success: true,
        timestamp: new Date().toISOString(),
        duration_ms: duration,
        orgs_processed: allResults.length,
        summary: allResults.map(r => ({
            org: r.org,
            forms_checked: r.forms_checked,
            leads_found: r.leads_found,
            created: r.created,
            updated: r.updated,
            errors: r.errors,
            skipped_reason: r.skipped_reason,
        })),
    })
}

