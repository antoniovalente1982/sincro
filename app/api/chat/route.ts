import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { readKPIData, readAppointments } from '@/lib/google-sheets'

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
)

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY
const MODEL = 'google/gemini-2.5-flash'

const SYSTEM_PROMPT = `Sei Dante, l'AI Engine di AdPilotik — la piattaforma marketing intelligente di Metodo Sincro.
Rispondi SEMPRE in italiano. Sei un esperto mondiale di:
- Performance Marketing (Meta Ads, Google Ads, TikTok Ads)
- Business Intelligence e KPI aziendali
- Growth Hacking e ottimizzazione ROAS
- Analisi dati e raccomandazioni strategiche

Il tuo obiettivo principale: MASSIMIZZARE il fatturato e l'utile riducendo i costi pubblicitari.

Quando analizzi le campagne:
- Identifica le campagne peggiori per CPL e suggerisci di pausarle
- Identifica pattern vincenti (angoli, creatività, audience)
- Suggerisci azioni concrete con numeri
- Confronta sempre con i KPI aziendali reali

Formattazione:
- Usa **grassetto** per evidenziare numeri importanti
- Usa emoji per rendere leggibile
- Sii diretto e pratico, non servono convenevoli
- Rispondi in modo conciso ma completo

Se il contesto contiene dati KPI aziendali (fatturato, incassato, EBITDA), usali per dare un quadro completo.
Se non hai dati sufficienti, dillo chiaramente.

Il tuo nome è Dante. Sei l'AI che gestisce il marketing di Metodo Sincro.
Metodo Sincro è un programma di Mental Coaching per giovani calciatori, fondato da Antonio Valente.
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

    // 1. Campaigns from Meta
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
            const adAccount = 'act_511099830249139'

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
                        spesa: `€${parseFloat(c.spend).toFixed(2)}`,
                        impressioni: c.impressions,
                        click: c.clicks,
                        ctr: `${parseFloat(c.ctr).toFixed(2)}%`,
                        leads,
                        cpl: cpl ? `€${parseFloat(cpl).toFixed(2)}` : 'N/A',
                    }
                })
                parts.push(`CAMPAGNE META ADS (ultimi 14 giorni):\n${JSON.stringify(campaigns, null, 2)}`)
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
- Budget giornaliero massimo: €250
- Obiettivo CPL: €15-20
- Obiettivo CTR: >2.5%
- Prodotto medio: €2.250-3.000 + IVA`)

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
