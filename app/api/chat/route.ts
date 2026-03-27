import { NextRequest, NextResponse } from 'next/server'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { readKPIData, readAppointments } from '@/lib/google-sheets'

function getSupabaseAdmin() {
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!serviceKey) {
        console.error('SUPABASE_SERVICE_ROLE_KEY is missing. Falling back to ANON_KEY, which may cause RLS errors.')
    }
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        serviceKey || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    )
}

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
- NON salutare MAI dopo il primo messaggio. Se nella history ci sono messaggi precedenti, vai DRITTO al punto. ZERO saluti, ZERO "Ciao Anto", ZERO "Ehi". Anche al primo messaggio, sii breve col saluto.

FORMATO DATE:
- Scrivi SEMPRE le date in formato italiano: GG/MM/AAAA (esempio: 23/03/2026, NON 2026-03-23).
- Per gli orari: HH:MM (esempio: 14:30, 09:15).
- VIETATO usare il formato ISO (YYYY-MM-DD). Anto legge in italiano.

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

REGOLE SUI LEAD:
- I lead nel contesto sono ORDINATI dal più recente (posizione #1 / ⭐ ULTIMO ARRIVATO) al più vecchio.
- Il campo "arrivo" indica data e ORA ITALIANA di arrivo del lead (fuso Europe/Rome).
- Se Anto chiede "chi è l'ultimo lead?" → rispondi con il lead in posizione ⭐ ULTIMO ARRIVATO.
- Se chiede "a che ora è arrivato?" → usa il campo "arrivo" che è già in orario italiano.
- Se chiede info su un lead specifico → cerca per nome, telefono, email, o qualsiasi dato disponibile.
- Ogni lead ha: nome, email, telefono, valore, stage, assegnato_a, arrivo, source, campagna, funnel, età figlio, angolo adset, note.
- Questi sono tutti i dati che appaiono anche nella pipeline CRM.

Formattazione: usa **grassetto** per evidenziare. Usa emoji. Sii conciso ma completo.

CONTESTO BUSINESS:
Metodo Sincro = Mental Coaching per giovani calciatori, fondato da Antonio Valente.
Prodotti: Platinum (€2.250 + IVA, 3 mesi) e Impact (€3.000 + IVA, 2+2 mesi).
Funnel: Meta Ads → Landing Page → Lead → Setter (qualifica) → Closer (vendita).
Target: Genitori di giovani calciatori 10-20 anni (core 14-15 anni).

AI ENGINE / PILOTA AUTOMATICO:
- Quando Anto chiede "il pilota automatico è attivo?", "l'AI Engine è attivo?", "è in live?" → guarda la sezione AI ENGINE nei dati.
- autopilot_active = il sistema è acceso/spento. execution_mode = 'live' (esegue azioni reali) o 'dry_run' (simula senza eseguire).
- Auto-Pause, Auto-Scale, Creative Refresh sono le funzionalità singole.

PRECISIONE DEI DATI:
- ⚠️ Se un dato NON è presente nel contesto che ricevi, dì ONESTAMENTE che non hai quel dato. NON INVENTARE MAI numeri, spese, CPL o stati. Meglio dire "non ho questo dato" che inventarlo.
- I dati sui lead vengono dal database e sono affidabili.
- I dati sulle campagne vengono LIVE da Meta API e sono aggiornati al momento della domanda.
- Quando Anto chiede "spesa di oggi" → usa il dato "SPESA OGGI", NON la spesa totale del periodo.
- Quando Anto chiede lo stato delle campagne → distingui sempre tra ATTIVE e IN PAUSA.`

export async function POST(req: NextRequest) {
    try {
        // Auth check
        const authHeader = req.headers.get('authorization')
        if (!authHeader) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const token = authHeader.replace('Bearer ', '')
        const { data: { user } } = await getSupabaseAdmin().auth.getUser(token)
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // Get org
        const { data: member } = await getSupabaseAdmin()
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

        // Build rich context with current time info
        const now = new Date()
        const italianNow = now.toLocaleString('it-IT', {
            timeZone: 'Europe/Rome',
            weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric',
            hour: '2-digit', minute: '2-digit'
        })
        const context = await buildContext(orgId)
        const isFirstMessage = !history || history.length === 0

        // Build messages array
        const messages: any[] = [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'system', content: `ORA ATTUALE ITALIANA: ${italianNow}\n${isFirstMessage ? 'Questo è il PRIMO messaggio: puoi salutare brevemente.' : 'Conversazione IN CORSO: NON salutare, vai dritto al punto.'}\n\n${context}` },
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
                temperature: 0.3,
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
    const now = new Date()
    const todayISO = now.toLocaleDateString('en-CA', { timeZone: 'Europe/Rome' })
    const sevenDaysAgoStr = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toLocaleDateString('en-CA', { timeZone: 'Europe/Rome' })

    // Check DST for accurate date boundaries
    const marchLastSunday = new Date(now.getFullYear(), 2, 31)
    marchLastSunday.setDate(marchLastSunday.getDate() - marchLastSunday.getDay())
    const octLastSunday = new Date(now.getFullYear(), 9, 31)
    octLastSunday.setDate(octLastSunday.getDate() - octLastSunday.getDay())
    const isDST = now >= marchLastSunday && now < octLastSunday
    const todayStart = new Date(`${todayISO}T00:00:00${isDST ? '+02:00' : '+01:00'}`)

    // Format Italian time helper
    const fmtIT = (iso: string) => {
        try {
            return new Date(iso).toLocaleString('it-IT', {
                timeZone: 'Europe/Rome',
                day: '2-digit', month: '2-digit', year: 'numeric',
                hour: '2-digit', minute: '2-digit'
            })
        } catch { return iso }
    }

    // 1. Campaigns from Meta (LIVE data — today + 7 day)
    try {
        const { data: conn } = await getSupabaseAdmin()
            .from('connections')
            .select('credentials')
            .eq('organization_id', orgId)
            .eq('provider', 'meta_ads')
            .eq('status', 'active')
            .single()

        if (conn?.credentials?.access_token) {
            const token = conn.credentials.access_token
            const adAccount = `act_${conn.credentials.ad_account_id || '511099830249139'}`

            const [campaignsRes, todayInsightsRes, weekInsightsRes] = await Promise.all([
                fetch(`https://graph.facebook.com/v21.0/${adAccount}/campaigns?fields=name,status,daily_budget,objective&limit=30&access_token=${token}`),
                fetch(`https://graph.facebook.com/v21.0/${adAccount}/insights?fields=campaign_name,spend,impressions,clicks,actions,cost_per_action_type,purchase_roas&level=campaign&time_range=${encodeURIComponent(JSON.stringify({ since: todayISO, until: todayISO }))}&limit=30&access_token=${token}`),
                fetch(`https://graph.facebook.com/v21.0/${adAccount}/insights?fields=campaign_name,spend,impressions,clicks,ctr,actions,cost_per_action_type,purchase_roas&level=campaign&time_range=${encodeURIComponent(JSON.stringify({ since: sevenDaysAgoStr, until: todayISO }))}&limit=30&access_token=${token}`),
            ])

            const campaignsJson = campaignsRes.ok ? await campaignsRes.json() : { data: [] }
            const campaignsList = campaignsJson.data || []
            const todayJson = todayInsightsRes.ok ? await todayInsightsRes.json() : { data: [] }
            const todayData = todayJson.data || []
            const weekJson = weekInsightsRes.ok ? await weekInsightsRes.json() : { data: [] }
            const weekData = weekJson.data || []

            const todayInsightsMap: Record<string, any> = {}
            todayData.forEach((i: any) => { todayInsightsMap[i.campaign_name] = i })
            const weekInsightsMap: Record<string, any> = {}
            weekData.forEach((i: any) => { weekInsightsMap[i.campaign_name] = i })

            const todaySpendTotal = todayData.reduce((s: number, c: any) => s + (parseFloat(c.spend) || 0), 0)
            const weekSpendTotal = weekData.reduce((s: number, c: any) => s + (parseFloat(c.spend) || 0), 0)

            const active = campaignsList.filter((c: any) => c.status === 'ACTIVE')
            const paused = campaignsList.filter((c: any) => c.status === 'PAUSED')

            let campLines: string[] = []
            campLines.push(`SPESA OGGI: €${todaySpendTotal.toFixed(2)}`)
            campLines.push(`SPESA ULTIMI 7 GIORNI: €${weekSpendTotal.toFixed(2)}`)
            campLines.push(`\n🟢 CAMPAGNE ATTIVE (${active.length}):`)
            if (active.length === 0) {
                campLines.push('  Nessuna campagna attiva al momento.')
            }
            for (const c of active) {
                const ti = todayInsightsMap[c.name]
                const wi = weekInsightsMap[c.name]
                const budget = c.daily_budget ? `€${(parseInt(c.daily_budget) / 100).toFixed(0)}/giorno` : 'N/A'
                const todaySpend = ti ? `€${parseFloat(ti.spend).toFixed(2)}` : '€0'
                const todayLeads = ti?.actions?.find((a: any) => a.action_type === 'lead')?.value || 0
                const todayCpl = ti?.cost_per_action_type?.find((a: any) => a.action_type === 'lead')?.value
                const weekSpend = wi ? `€${parseFloat(wi.spend).toFixed(2)}` : '€0'
                const weekLeads = wi?.actions?.find((a: any) => a.action_type === 'lead')?.value || 0
                const weekCpl = wi?.cost_per_action_type?.find((a: any) => a.action_type === 'lead')?.value
                const weekCtr = wi?.ctr ? `${parseFloat(wi.ctr).toFixed(2)}%` : 'N/A'
                const weekRoas = wi?.purchase_roas?.[0]?.value ? `${parseFloat(wi.purchase_roas[0].value).toFixed(2)}x` : null
                campLines.push(`  • ${c.name}`)
                campLines.push(`    Budget: ${budget} | OGGI: spesa ${todaySpend}, ${todayLeads} lead${todayCpl ? `, CPL €${parseFloat(todayCpl).toFixed(2)}` : ''}`)
                campLines.push(`    7 GIORNI: spesa ${weekSpend}, ${weekLeads} lead${weekCpl ? `, CPL €${parseFloat(weekCpl).toFixed(2)}` : ''}, CTR ${weekCtr}${weekRoas ? `, ROAS ${weekRoas}` : ''}`)
            }
            if (paused.length > 0) {
                campLines.push(`\n🟡 CAMPAGNE IN PAUSA (${paused.length}):`)
                for (const c of paused) {
                    campLines.push(`  • ${c.name}`)
                }
            }
            parts.push(`CAMPAGNE META ADS (dati LIVE):\n${campLines.join('\n')}`)
        }
    } catch (e) {
        parts.push('CAMPAGNE: errore nel caricamento dati Meta Ads')
    }

    // 2. Leads summary
    try {
        const { data: leads } = await getSupabaseAdmin()
            .from('leads')
            .select('id, name, email, phone, value, stage_id, assigned_to, created_at, updated_at, utm_source, utm_campaign, meta_data, notes, funnel_id, funnels!leads_funnel_id_fkey(name)')
            .eq('organization_id', orgId)
            .order('created_at', { ascending: false })
            .limit(30)

        if (leads && leads.length > 0) {
            const { data: stagesData } = await getSupabaseAdmin()
                .from('pipeline_stages')
                .select('id, name')
                .eq('organization_id', orgId)
            const stageMap: Record<string, string> = {}
            stagesData?.forEach(s => { stageMap[s.id] = s.name })

            const { data: membersData } = await getSupabaseAdmin()
                .from('organization_members')
                .select('user_id, profiles:user_id (full_name)')
                .eq('organization_id', orgId)
            const memberMap: Record<string, string> = {}
            membersData?.forEach((m: any) => {
                const name = Array.isArray(m.profiles) ? m.profiles[0]?.full_name : m.profiles?.full_name
                if (name) memberMap[m.user_id] = name
            })

            const stageCount: Record<string, number> = {}
            const leadsForContext = leads.map((l: any, i: number) => {
                const stageName = l.stage_id ? (stageMap[l.stage_id] || 'sconosciuto') : 'non assegnato'
                stageCount[stageName] = (stageCount[stageName] || 0) + 1
                const parts = [
                    `${i === 0 ? '⭐ ULTIMO ARRIVATO' : `#${i + 1}`} ${l.name}`,
                    `   Arrivo: ${fmtIT(l.created_at)} | Stage: ${stageName}`,
                    `   Tel: ${l.phone || 'N/A'} | Email: ${l.email || 'N/A'}`,
                    l.assigned_to ? `   Assegnato a: ${memberMap[l.assigned_to] || 'membro'}` : '',
                    l.utm_source ? `   Fonte: ${l.utm_source}${l.utm_campaign ? ` / ${l.utm_campaign}` : ''}` : '',
                    l.funnels?.name ? `   Funnel: ${l.funnels.name}` : '',
                    l.value ? `   Valore: €${l.value}` : '',
                    l.meta_data?.child_age ? `   Età figlio: ${l.meta_data.child_age}` : '',
                    l.meta_data?.adset_angle ? `   Angolo adset: ${l.meta_data.adset_angle}` : '',
                    l.notes ? `   Note: ${l.notes}` : '',
                ].filter(Boolean)
                return parts.join('\n')
            })
            parts.push(`ULTIMI 30 LEAD (ordinati dal più recente — orari ITALIANI):\n${leadsForContext.join('\n\n')}`)
            parts.push(`DISTRIBUZIONE STAGE:\n${Object.entries(stageCount).map(([k, v]) => `  • ${k}: ${v}`).join('\n')}`)

            // Today's leads
            const leadsToday = leads!.filter((l: any) => new Date(l.created_at) >= todayStart)
            const todayLabel = todayISO.split('-').reverse().join('/')
            const leadsTodayFormatted = leadsToday.map((l: any) => {
                const stage = l.stage_id ? (stageMap[l.stage_id] || 'sconosciuto') : 'non assegnato'
                return `  • ${l.name} (${fmtIT(l.created_at)}) — stage: ${stage}`
            })
            parts.push(`LEAD DI OGGI (${todayLabel}): ${leadsToday.length} lead\n${leadsTodayFormatted.join('\n') || '  Nessun lead oggi.'}`)
        }
    } catch (e) { /* skip */ }

    // 3. KPI from Google Sheets
    try {
        const kpiData = await readKPIData(orgId)
        if (kpiData && kpiData.length > 0) {
            const kpiSummary = kpiData.slice(0, 15).map(row => row.join(' | ')).join('\n')
            parts.push(`KPI AZIENDALI (mese corrente dal Google Sheet):\n${kpiSummary}`)
        }
    } catch (e) { /* skip */ }

    // 4. Appointments from Google Sheets
    try {
        const appointments = await readAppointments(orgId)
        if (appointments && appointments.length > 0) {
            const headers = appointments[0]
            const recent = appointments.slice(-10)
            const appSummary = [headers, ...recent].map(row => row.join(' | ')).join('\n')
            parts.push(`APPUNTAMENTI RECENTI (dal Google Sheet):\n${appSummary}`)
        }
    } catch (e) { /* skip */ }

    // 5. AI Engine Status (from DB)
    try {
        const { data: aiConfig } = await getSupabaseAdmin()
            .from('ai_agent_config')
            .select('autopilot_active, execution_mode, auto_pause_enabled, auto_scale_enabled, auto_creative_refresh, analysis_interval_minutes, risk_tolerance, budget_daily')
            .eq('organization_id', orgId)
            .single()

        if (aiConfig) {
            const mode = aiConfig.execution_mode === 'live' ? '🟢 LIVE (esegue azioni reali)' :
                aiConfig.execution_mode === 'dry_run' ? '🟡 DRY RUN (simula, non esegue)' : aiConfig.execution_mode
            const autopilot = aiConfig.autopilot_active ? '✅ ATTIVO' : '❌ DISATTIVO'
            const features = []
            if (aiConfig.auto_pause_enabled) features.push('Auto-Pause')
            if (aiConfig.auto_scale_enabled) features.push('Auto-Scale')
            if (aiConfig.auto_creative_refresh) features.push('Creative Refresh')
            parts.push(`AI ENGINE (PILOTA AUTOMATICO):\n` +
                `Pilota Automatico: ${autopilot}\n` +
                `Modalità esecuzione: ${mode}\n` +
                `Funzionalità attive: ${features.length > 0 ? features.join(', ') : 'Nessuna'}\n` +
                `Intervallo analisi: ogni ${aiConfig.analysis_interval_minutes || 60} minuti\n` +
                `Rischio: ${aiConfig.risk_tolerance || 'medium'}` +
                (aiConfig.budget_daily ? `\nBudget giornaliero impostato: €${aiConfig.budget_daily}` : ''))
        }
    } catch (e) { /* skip */ }

    return parts.join('\n\n---\n\n')
}

function getItalianDate(date: Date): string {
    // Return YYYY-MM-DD in Italian timezone
    return date.toLocaleDateString('en-CA', { timeZone: 'Europe/Rome' }) // en-CA gives YYYY-MM-DD format
}

function getDateDaysAgo(days: number): string {
    const d = new Date()
    d.setDate(d.getDate() - days)
    return getItalianDate(d)
}

function getToday(): string {
    return getItalianDate(new Date())
}
