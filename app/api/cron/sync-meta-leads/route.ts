/**
 * app/api/cron/sync-meta-leads/route.ts
 * 
 * Cron di fallback che sincronizza i lead dai Meta Lead Ads ogni ora.
 * 
 * Complementa il webhook in tempo reale: se un lead non è arrivato via webhook
 * (es. Meta ha avuto problemi di consegna), questo cron lo recupera.
 * 
 * Schedulato: ogni ora (vercel.json: "0 * * * *")
 * 
 * Flusso:
 *  1. Recupera le credenziali Meta da `connections`
 *  2. Lista tutti i leadgen_forms dell'account
 *  3. Per ogni form, scarica i lead delle ultime 2 ore
 *  4. Importa nel CRM solo quelli non già presenti (dedup per email + leadgen_id)
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
        .select('organization_id, credentials')
        .eq('provider', 'meta_ads')
        .eq('status', 'active')

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
        results: MetaLeadProcessResult[]
    }[] = []

    // ── Processa ogni org ─────────────────────────────────────────────────────
    for (const conn of connections) {
        const { organization_id: orgId, credentials } = conn
        const accessToken = credentials?.access_token
        const adAccountId = credentials?.ad_account_id

        if (!accessToken || !adAccountId) {
            console.warn(`[SyncMetaLeads] Missing credentials for org ${orgId}`)
            continue
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
        })),
    })
}
