import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { readKPIData, readAppointments } from '@/lib/google-sheets'

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
)

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY
const MODEL = 'google/gemini-2.5-flash'

// Allow up to 60s for AI responses (Meta API + Google Sheets + OpenRouter)
export const maxDuration = 60

const SYSTEM_PROMPT = `Sei Dante, l'AI Engine di AdPilotik — la piattaforma marketing intelligente di Metodo Sincro.
Rispondi SEMPRE in italiano. Sei un esperto mondiale di performance marketing, business intelligence e growth hacking.

PERSONALITÀ:
- Chiama SEMPRE l'utente "Anto" (è Antonio Valente, il fondatore)
- Tono diretto, amichevole, come un collaboratore fidato
- Sii pratico: numeri, azioni concrete, zero convenevoli inutili
- Quando dai buone notizie, entusiasta. Quando dai brutte, onesto e propositivo.

VOCABOLARIO:
- "AZ" = ADS = campagne pubblicitarie. Quando Anto dice "AZ" intende le ADS. Tu dì sempre "ADS" nella risposta, non "AZ".
- "CPL" = Costo Per Lead, "ROAS" = Return On Ad Spend, "CTR" = Click Through Rate

OBIETTIVO: MASSIMIZZARE fatturato e utile riducendo i costi pubblicitari.

Quando analizzi:
- Identifica campagne peggiori per CPL e suggerisci di pausarle
- Identifica pattern vincenti (angoli, creatività, audience)
- Suggerisci azioni concrete con numeri
- Confronta con i KPI aziendali reali

IMPORTANTE:
- Quando Anto chiede azioni operative (creare campagne, modificare codice, deployare), digli che quelle le fa Antigravity. Tu analizzi, consigli e monitori.
- Se Anto chiede "crea una campagna" → "Anto, per quello devi passare da Antigravity. Io ti do analisi e strategia!"

Formattazione: usa **grassetto** per evidenziare. Usa emoji. Sii conciso ma completo.

CONTESTO BUSINESS:
Metodo Sincro = Mental Coaching per giovani calciatori, fondato da Antonio Valente.
Prodotti: Platinum (€2.250 + IVA, 3 mesi) e Impact (€3.000 + IVA, 2+2 mesi).
Funnel: Meta Ads → Landing Page → Lead → Setter (qualifica) → Closer (vendita).
Target: Genitori di giovani calciatori 10-20 anni (core 14-15 anni).`

export async function POST(req: NextRequest) {
    try {
        // Auth check
        const authHeader = req.headers.get('authorization')
        if (!authHeader) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const token = authHeader.replace('Bearer ', '')
        const { data: { user } } = await supabaseAdmin.auth.getUser(token)
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // Get org
        const { data: member } = await supabaseAdmin
            .from('organization_members')
            .select('organization_id')
            .eq('user_id', user.id)
            .single()

        if (!member) {
            return NextResponse.json({ error: 'No organization' }, { status: 403 })
        }

        const orgId = member.organization_id
        const body = await req.json()
        const { message, history = [] } = body

        if (!message?.trim()) {
            return NextResponse.json({ error: 'Empty message' }, { status: 400 })
        }

        // Build rich context
        const context = await buildContext(orgId)

        // Build messages array
        const messages: any[] = [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: `CONTESTO DATI AGGIORNATI:\n${context}` },
        ]

        // Add conversation history (last 10 messages)
        for (const msg of history.slice(-10)) {
            messages.push({ role: msg.role, content: msg.content })
        }

        // Add current message
        messages.push({ role: 'user', content: message })

        // Call OpenRouter
        const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
                'HTTP-Referer': 'https://adpilotik.com',
                'X-Title': 'AdPilotik AI Engine',
            },
            body: JSON.stringify({
                model: MODEL,
                messages,
                max_tokens: 2000,
                temperature: 0.7,
            }),
        })

        if (!res.ok) {
            const err = await res.text()
            console.error('OpenRouter error:', res.status, err)
            return NextResponse.json({ error: 'AI error' }, { status: 500 })
        }

        const data = await res.json()
        const reply = data.choices?.[0]?.message?.content || 'Nessuna risposta generata.'

        return NextResponse.json({ reply, success: true })
    } catch (err: any) {
        console.error('Chat error:', err)
        return NextResponse.json({ error: 'Internal error' }, { status: 500 })
    }
}

async function buildContext(orgId: string): Promise<string> {
    const parts: string[] = []

    // 1. Campaigns from Meta (live data + status)
    try {
        const { data: conn } = await supabaseAdmin
            .from('connections')
            .select('credentials')
            .eq('organization_id', orgId)
            .eq('provider', 'meta_ads')
            .eq('status', 'active')
            .single()

        if (conn?.credentials?.access_token) {
            const token = conn.credentials.access_token
            const adAccount = `act_${conn.credentials.ad_account_id || '511099830249139'}`

            // Get campaigns with status
            const campaignsRes = await fetch(
                `https://graph.facebook.com/v21.0/${adAccount}/campaigns?fields=name,status,daily_budget,objective&limit=20&access_token=${token}`
            )
            let campaignStatuses: Record<string, string> = {}
            if (campaignsRes.ok) {
                const cData = await campaignsRes.json()
                const activeCampaigns = (cData.data || []).map((c: any) => ({
                    nome: c.name,
                    status: c.status,
                    budget_giornaliero: c.daily_budget ? `€${(parseInt(c.daily_budget) / 100).toFixed(0)}` : 'N/A',
                    obiettivo: c.objective,
                }))
                parts.push(`CAMPAGNE META (stato attuale):\n${JSON.stringify(activeCampaigns, null, 2)}`)
                cData.data?.forEach((c: any) => { campaignStatuses[c.name] = c.status })
            }

            // Get campaign insights
            const insightsRes = await fetch(
                `https://graph.facebook.com/v21.0/${adAccount}/insights?fields=campaign_name,spend,impressions,clicks,ctr,actions,cost_per_action_type&level=campaign&time_range=${encodeURIComponent(JSON.stringify({ since: getDateDaysAgo(14), until: getToday() }))}&limit=15&access_token=${token}`
            )

            if (insightsRes.ok) {
                const insightsData = await insightsRes.json()
                const campaigns = (insightsData.data || []).map((c: any) => {
                    const leads = c.actions?.find((a: any) => a.action_type === 'lead')?.value || 0
                    const cpl = c.cost_per_action_type?.find((a: any) => a.action_type === 'lead')?.value || 0
                    return {
                        nome: c.campaign_name,
                        status: campaignStatuses[c.campaign_name] || 'UNKNOWN',
                        spesa: `€${parseFloat(c.spend).toFixed(2)}`,
                        impressioni: c.impressions,
                        click: c.clicks,
                        ctr: `${parseFloat(c.ctr).toFixed(2)}%`,
                        leads,
                        cpl: cpl ? `€${parseFloat(cpl).toFixed(2)}` : 'N/A',
                    }
                })
                parts.push(`PERFORMANCE CAMPAGNE (ultimi 14 giorni):\n${JSON.stringify(campaigns, null, 2)}`)
            }
        }
    } catch (e) {
        parts.push('CAMPAGNE: errore nel caricamento')
    }

    // 2. Leads summary
    try {
        const { data: leads } = await supabaseAdmin
            .from('leads')
            .select('id, name, stage, created_at, utm_source, utm_campaign')
            .eq('organization_id', orgId)
            .order('created_at', { ascending: false })
            .limit(20)

        if (leads) {
            const stageCount: Record<string, number> = {}
            leads.forEach(l => {
                stageCount[l.stage || 'unknown'] = (stageCount[l.stage || 'unknown'] || 0) + 1
            })
            parts.push(`ULTIMI 20 LEAD:\n${JSON.stringify(leads.map(l => ({ nome: l.name, stage: l.stage, data: l.created_at, source: l.utm_source })), null, 2)}`)
            parts.push(`DISTRIBUZIONE STAGE:\n${JSON.stringify(stageCount)}`)
        }
    } catch (e) { /* skip */ }

    // 3. KPI from Google Sheets
    try {
        const kpiData = await readKPIData(orgId)
        if (kpiData && kpiData.length > 0) {
            // Take first 10 rows for context (headers + data)
            const kpiSummary = kpiData.slice(0, 15).map(row => row.join(' | ')).join('\n')
            parts.push(`KPI AZIENDALI (mese corrente dal Google Sheet):\n${kpiSummary}`)
        }
    } catch (e) { /* skip */ }

    // 4. Appointments from Google Sheets
    try {
        const appointments = await readAppointments(orgId)
        if (appointments && appointments.length > 0) {
            // Take headers + last 10 appointments
            const headers = appointments[0]
            const recent = appointments.slice(-10)
            const appSummary = [headers, ...recent].map(row => row.join(' | ')).join('\n')
            parts.push(`APPUNTAMENTI RECENTI (dal Google Sheet):\n${appSummary}`)
        }
    } catch (e) { /* skip */ }

    // 5. Budget info
    parts.push(`INFORMAZIONI BUDGET:
- Budget giornaliero totale: €300
- Obiettivo CPL: €15-20
- Obiettivo CTR: >2.5%
- Prodotto Platinum: €2.250 + IVA (3 mesi)
- Prodotto Impact: €3.000 + IVA (2+2 mesi)
- Campagne attive: MS - Lead Immagini - Dolore, MS - Lead Immagini - Trasformazione
- Data lancio: 17 Marzo 2026
- Targeting: Genitori 30-55, Italia, interessi calcio/coaching, NO Advantage+`)

    return parts.join('\n\n---\n\n')
}

function getDateDaysAgo(days: number): string {
    const d = new Date()
    d.setDate(d.getDate() - days)
    return d.toISOString().split('T')[0]
}

function getToday(): string {
    return new Date().toISOString().split('T')[0]
}
