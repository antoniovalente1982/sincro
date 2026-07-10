import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'

// Esiti che contano come "vittoria" / appuntamento
const WIN_FEEDBACKS = ['appointment', 'converted']

export async function GET(request: Request) {
    const supabase = await createClient()
    const supabaseAdmin = getSupabaseAdmin()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })
    }

    const { data: member } = await supabase
        .from('organization_members')
        .select('organization_id, role')
        .eq('user_id', user.id)
        .is('deactivated_at', null)
        .single()

    if (!member || !['owner', 'admin', 'manager'].includes(member.role)) {
        return NextResponse.json({ error: 'Accesso negato' }, { status: 403 })
    }

    const orgId = member.organization_id
    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('startDate') || null
    const endDate = searchParams.get('endDate') || null

    try {
        // ── Lead assegnati nel periodo ──
        let poolQuery = supabaseAdmin
            .from('lead_pool')
            .select('id, full_name, phone, email, assigned_to, assigned_at, feedback, feedback_notes, feedback_at, status, call_count, first_called_at, last_called_at, crm_lead_id, session_id')
            .eq('organization_id', orgId)
            .not('assigned_to', 'is', null)
        if (startDate) poolQuery = poolQuery.gte('assigned_at', startDate)
        if (endDate) poolQuery = poolQuery.lte('assigned_at', endDate)

        // ── Chiamate reali (Fase 3) ──
        let callsQuery = supabaseAdmin
            .from('lead_calls')
            .select('user_id, started_at, connected_at, duration_seconds, outcome, lead_pool_id')
            .eq('organization_id', orgId)
        if (startDate) callsQuery = callsQuery.gte('started_at', startDate)
        if (endDate) callsQuery = callsQuery.lte('started_at', endDate)

        // ── Eventi calendario (funnel appuntamento → presentato → venduto) ──
        const eventsQuery = supabaseAdmin
            .from('calendar_events')
            .select('lead_id, lead_phone, lead_email, closer_id, start_time, status, outcome, outcome_value')
            .eq('organization_id', orgId)

        const [{ data: leads, error: poolError }, { data: calls }, { data: events }, { data: profiles }] = await Promise.all([
            poolQuery,
            callsQuery,
            eventsQuery,
            supabaseAdmin.from('profiles').select('id, full_name'),
        ])

        if (poolError) {
            console.error('[KPI_API] Pool error:', poolError)
            return NextResponse.json({ error: 'Errore nel caricamento dei dati del pool' }, { status: 500 })
        }

        const rawLeads = leads || []
        const rawCalls = calls || []
        const rawEvents = events || []
        const profilesMap = Object.fromEntries((profiles || []).map(p => [p.id, p.full_name]))

        // Conversioni orfane: lead 'win' senza lead CRM reale
        const crmLeadIds = rawLeads.filter(l => WIN_FEEDBACKS.includes(l.feedback) && l.crm_lead_id).map(l => l.crm_lead_id)
        let realLeadIds = new Set<string>()
        if (crmLeadIds.length > 0) {
            const { data: crmLeads } = await supabaseAdmin.from('leads').select('id').in('id', crmLeadIds)
            realLeadIds = new Set((crmLeads || []).map(l => l.id))
        }

        type Stat = {
            user_id: string; name: string
            leads_requested: number; leads_called: number; leads_converted: number
            leads_wrong_number: number; session_ids: Set<string>
            dials: number; connected: number; talk_seconds: number
            shown: number; sold: number; sales_value: number
            active_days: Set<string>
        }
        const kpiMap: Record<string, Stat> = {}
        const anomalies: any[] = []

        const ensure = (userId: string): Stat => {
            if (!kpiMap[userId]) {
                kpiMap[userId] = {
                    user_id: userId, name: profilesMap[userId] || 'Venditore',
                    leads_requested: 0, leads_called: 0, leads_converted: 0,
                    leads_wrong_number: 0, session_ids: new Set(),
                    dials: 0, connected: 0, talk_seconds: 0,
                    shown: 0, sold: 0, sales_value: 0, active_days: new Set(),
                }
            }
            return kpiMap[userId]
        }

        // ── Aggrega i lead ──
        rawLeads.forEach(l => {
            const userId = l.assigned_to
            if (!userId) return
            const stats = ensure(userId)
            stats.leads_requested += 1

            const isCalled = l.call_count > 0 || ['called', 'converted'].includes(l.status) || !!l.feedback
            if (isCalled) stats.leads_called += 1
            if (WIN_FEEDBACKS.includes(l.feedback)) stats.leads_converted += 1
            if (l.feedback === 'wrong_number') stats.leads_wrong_number += 1
            if (l.session_id) stats.session_ids.add(l.session_id)
            if (l.assigned_at) stats.active_days.add(String(l.assigned_at).slice(0, 10))

            // Anti-cheat 1: conversione orfana
            if (WIN_FEEDBACKS.includes(l.feedback) && (!l.crm_lead_id || !realLeadIds.has(l.crm_lead_id))) {
                anomalies.push({
                    id: `${l.id}-orphan`, type: 'orphan_conversion', severity: 'high',
                    closer_name: stats.name, lead_name: l.full_name, timestamp: l.feedback_at || l.assigned_at,
                    detail: `Contrassegnato come vittoria ma nessun lead reale creato nel CRM.`,
                })
            }
            // Anti-cheat 2: esito senza nessuna chiamata registrata
            const hasCall = rawCalls.some(c => c.lead_pool_id === l.id)
            if (l.feedback && !hasCall) {
                anomalies.push({
                    id: `${l.id}-nocall`, type: 'feedback_without_call', severity: 'medium',
                    closer_name: stats.name, lead_name: l.full_name, timestamp: l.feedback_at || l.assigned_at,
                    detail: `Esito '${l.feedback}' registrato senza alcuna chiamata tracciata (numero non toccato).`,
                })
            }
            // Anti-cheat 3: esito ultra-rapido
            if (l.feedback_at && l.assigned_at) {
                const diffSec = (new Date(l.feedback_at).getTime() - new Date(l.assigned_at).getTime()) / 1000
                if (diffSec > 0 && diffSec < 20) {
                    anomalies.push({
                        id: `${l.id}-speed`, type: 'speed_calling', severity: 'high',
                        closer_name: stats.name, lead_name: l.full_name, timestamp: l.feedback_at,
                        detail: `Esito '${l.feedback}' in soli ${Math.round(diffSec)} secondi dallo spin.`,
                    })
                }
            }
        })

        // ── Aggrega le chiamate reali ──
        rawCalls.forEach(c => {
            if (!c.user_id) return
            const stats = ensure(c.user_id)
            stats.dials += 1
            if (c.connected_at || (c.duration_seconds && c.duration_seconds > 0)) stats.connected += 1
            if (c.duration_seconds) stats.talk_seconds += c.duration_seconds
            if (c.started_at) stats.active_days.add(String(c.started_at).slice(0, 10))
        })

        // ── Aggrega il funnel calendario per closer ──
        rawEvents.forEach(e => {
            if (!e.closer_id) return
            const stats = ensure(e.closer_id)
            if (e.status === 'completed') stats.shown += 1
            if (e.outcome === 'won' || e.outcome === 'sold' || (e.outcome_value && e.outcome_value > 0)) {
                stats.sold += 1
                stats.sales_value += Number(e.outcome_value || 0)
            }
        })

        // ── Calcola KPI + Resilienza Score ──
        const pct = (n: number, d: number) => d > 0 ? Math.round((n / d) * 100) : 0
        // Target di riferimento per normalizzare il volume di dials nel periodo
        const maxDials = Math.max(50, ...Object.values(kpiMap).map(s => s.dials))

        const kpiList = Object.values(kpiMap).map(s => {
            const connectRate = s.dials > 0 ? s.connected / s.dials : 0
            const apptRate = s.leads_called > 0 ? s.leads_converted / s.leads_called : 0
            const showRate = s.leads_converted > 0 ? s.shown / s.leads_converted : 0
            const closeRate = s.shown > 0 ? s.sold / s.shown : 0
            const volumeScore = Math.min(1, s.dials / maxDials)

            // Resilienza Score (0-100): premia volume, capacità di far rispondere,
            // di fissare appuntamenti, di farli presentare e di chiudere.
            const resilience = Math.round(100 * (
                0.20 * volumeScore +
                0.20 * connectRate +
                0.25 * apptRate +
                0.20 * showRate +
                0.15 * closeRate
            ))

            return {
                user_id: s.user_id,
                name: s.name,
                leads_requested: s.leads_requested,
                leads_called: s.leads_called,
                leads_converted: s.leads_converted,
                leads_wrong_number: s.leads_wrong_number,
                spins_count: s.session_ids.size,
                conversion_rate: pct(s.leads_converted, s.leads_called),
                efficiency_rate: pct(s.leads_converted, s.leads_requested),
                dials: s.dials,
                connect_rate: Math.round(connectRate * 100),
                talk_minutes: Math.round(s.talk_seconds / 60),
                appointments: s.leads_converted,
                shown: s.shown,
                sold: s.sold,
                sales_value: s.sales_value,
                show_rate: Math.round(showRate * 100),
                close_rate: Math.round(closeRate * 100),
                active_days: s.active_days.size,
                resilience_score: resilience,
            }
        })

        // Anti-cheat 4: tasso 'numero errato' anomalo
        const teamCalled = kpiList.reduce((a, u) => a + u.leads_called, 0)
        const teamWrong = kpiList.reduce((a, u) => a + u.leads_wrong_number, 0)
        const teamWrongAvg = teamCalled > 0 ? (teamWrong / teamCalled) * 100 : 0
        kpiList.forEach(u => {
            if (u.leads_called > 5) {
                const rate = (u.leads_wrong_number / u.leads_called) * 100
                if (rate > 25 && rate > teamWrongAvg * 2) {
                    anomalies.push({
                        id: `${u.user_id}-wrong-rate`, type: 'high_wrong_number_rate', severity: 'medium',
                        closer_name: u.name, timestamp: new Date().toISOString(),
                        detail: `Tasso 'Numero errato' anomalo: ${Math.round(rate)}% (media team: ${Math.round(teamWrongAvg)}%).`,
                    })
                }
            }
        })

        return NextResponse.json({
            success: true,
            kpi: kpiList,
            anomalies: anomalies.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()),
        })
    } catch (err: any) {
        console.error('[KPI_API] Global error:', err)
        return NextResponse.json({ error: 'Errore generico calcolo KPI' }, { status: 500 })
    }
}
