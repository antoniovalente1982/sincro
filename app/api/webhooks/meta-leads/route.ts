/**
 * app/api/webhooks/meta-leads/route.ts
 * 
 * Webhook per ricevere lead dai Meta Lead Ads (moduli nativi di Facebook/Instagram).
 * 
 * GET  → Verifica (challenge) richiesta da Meta per registrare il webhook
 * POST → Riceve i payload di lead in tempo reale e li importa nel CRM
 * 
 * ─── Setup richiesto (una-tantum) ───────────────────────────────────────────
 * 1. Vai su developers.facebook.com → tua App → Webhooks
 * 2. Aggiungi sottoscrizione "leadgen"
 * 3. URL callback: https://adpilotik.vercel.app/api/webhooks/meta-leads
 * 4. Verify Token: stesso valore di CRON_SECRET nel .env
 * 5. Iscrive la Pagina 108451268302248 al webhook
 * ────────────────────────────────────────────────────────────────────────────
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import {
    fetchLeadgenData,
    processMetaLead,
} from '@/lib/meta-lead-forms'

function getSupabaseAdmin() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    )
}

// ─── GET: Challenge Verification ─────────────────────────────────────────────

/**
 * Meta invia una GET con hub.challenge quando si registra il webhook.
 * Dobbiamo rispondere con il valore hub.challenge se il verify_token corrisponde.
 */
export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url)

    const mode = searchParams.get('hub.mode')
    const token = searchParams.get('hub.verify_token')
    const challenge = searchParams.get('hub.challenge')

    const verifyToken = process.env.META_WEBHOOK_VERIFY_TOKEN || process.env.CRON_SECRET

    if (mode === 'subscribe' && token === verifyToken) {
        console.log('[MetaLeads Webhook] Verification successful')
        // Meta si aspetta una risposta 200 con SOLO il challenge come testo plain
        return new Response(challenge, { status: 200 })
    }

    console.warn('[MetaLeads Webhook] Verification failed. Token mismatch.')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
}

// ─── POST: Lead Event Handler ─────────────────────────────────────────────────

/**
 * Payload di esempio da Meta:
 * {
 *   "object": "page",
 *   "entry": [{
 *     "id": "PAGE_ID",
 *     "time": 1234567890,
 *     "changes": [{
 *       "field": "leadgen",
 *       "value": {
 *         "leadgen_id": "1234567890",
 *         "page_id": "108451268302248",
 *         "form_id": "...",
 *         "adgroup_id": "...",
 *         "ad_id": "...",
 *         "created_time": 1234567890
 *       }
 *     }]
 *   }]
 * }
 */
export async function POST(req: NextRequest) {
    try {
        // 1. Verifica firma HMAC (sicurezza) se META_APP_SECRET è configurato
        const appSecret = process.env.META_APP_SECRET
        if (appSecret) {
            const signature = req.headers.get('x-hub-signature-256')
            if (!signature) {
                console.warn('[MetaLeads Webhook] Missing signature header')
                return NextResponse.json({ error: 'Missing signature' }, { status: 401 })
            }

            const rawBody = await req.text()
            const expectedSig = await computeHmacSHA256(appSecret, rawBody)
            
            if (`sha256=${expectedSig}` !== signature) {
                console.warn('[MetaLeads Webhook] Invalid signature')
                return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
            }

            // Ri-parsea il body dopo averlo letto come testo
            const body = JSON.parse(rawBody)
            return await handleLeadPayload(body)
        }

        // Se META_APP_SECRET non è configurato, processa comunque (meno sicuro)
        // TODO: configura META_APP_SECRET per abilitare la verifica firma
        console.warn('[MetaLeads Webhook] META_APP_SECRET not set — skipping signature verification')
        const body = await req.json()
        return await handleLeadPayload(body)

    } catch (err: any) {
        console.error('[MetaLeads Webhook] Unexpected error:', err)
        // IMPORTANTE: Meta ritenta il webhook se non riceve 200. 
        // Rispondiamo sempre 200 per evitare retry storm, logghiamo l'errore.
        return NextResponse.json({ received: true, error: err.message }, { status: 200 })
    }
}

async function handleLeadPayload(body: any) {
    // Meta può inviare eventi non-leadgen (es. page events) — ignoriamoli
    if (body.object !== 'page') {
        return NextResponse.json({ received: true, skipped: 'not_page_object' })
    }

    const supabase = getSupabaseAdmin()

    // Recupera l'org con connessione Meta Ads attiva
    // Il webhook è globale (non per-org), quindi troviamo l'org dalla pagina Meta
    const { data: conn } = await supabase
        .from('connections')
        .select('organization_id, credentials')
        .eq('provider', 'meta_ads')
        .eq('status', 'active')
        .limit(1)
        .single()

    if (!conn?.credentials?.access_token) {
        console.error('[MetaLeads Webhook] No active Meta Ads connection found')
        return NextResponse.json({ received: true, error: 'No Meta connection' }, { status: 200 })
    }

    const { organization_id: orgId, credentials } = conn
    const accessToken = credentials.access_token

    const results = []

    // Processa ogni entry nel payload
    for (const entry of (body.entry || [])) {
        for (const change of (entry.changes || [])) {
            // Filtra solo eventi "leadgen"
            if (change.field !== 'leadgen') continue

            const { leadgen_id } = change.value

            if (!leadgen_id) {
                console.warn('[MetaLeads Webhook] Change without leadgen_id:', change.value)
                continue
            }

            console.log(`[MetaLeads Webhook] Processing leadgen_id: ${leadgen_id}`)

            // Recupera i dati completi del lead da Meta
            const rawLead = await fetchLeadgenData(leadgen_id, accessToken)

            if (!rawLead) {
                results.push({ leadgen_id, status: 'error', error: 'Failed to fetch from Meta' })
                continue
            }

            // Processa e inserisce nel CRM
            const result = await processMetaLead(rawLead, orgId, supabase)
            results.push(result)

            console.log(`[MetaLeads Webhook] Result for ${leadgen_id}:`, result.status)
        }
    }

    return NextResponse.json({
        received: true,
        processed: results.length,
        results,
    })
}

// ─── HMAC Verification ───────────────────────────────────────────────────────

async function computeHmacSHA256(secret: string, message: string): Promise<string> {
    const encoder = new TextEncoder()
    const key = await crypto.subtle.importKey(
        'raw',
        encoder.encode(secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
    )
    const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(message))
    return Array.from(new Uint8Array(sig))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('')
}
