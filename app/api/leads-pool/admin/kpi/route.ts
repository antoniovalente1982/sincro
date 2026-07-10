import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'

export async function GET(request: Request) {
    const supabase = await createClient()
    const supabaseAdmin = getSupabaseAdmin()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
        return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })
    }

    // Verifica il ruolo di admin/owner/manager
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
        // Query base su lead_pool per i lead assegnati
        let poolQuery = supabaseAdmin
            .from('lead_pool')
            .select('id, full_name, phone, email, assigned_to, assigned_at, feedback, feedback_notes, feedback_at, status, call_count, first_called_at, last_called_at, crm_lead_id, session_id')
            .eq('organization_id', orgId)
            .not('assigned_to', 'is', null)

        if (startDate) {
            poolQuery = poolQuery.gte('assigned_at', startDate)
        }
        if (endDate) {
            poolQuery = poolQuery.lte('assigned_at', endDate)
        }

        const { data: leads, error: poolError } = await poolQuery
        if (poolError) {
            console.error('[KPI_API] Pool error:', poolError)
            return NextResponse.json({ error: 'Errore nel caricamento dei dati del pool' }, { status: 500 })
        }

        const rawLeads = leads || []

        // Ottieni i profili dei venditori per associare i nomi
        const { data: profiles } = await supabaseAdmin
            .from('profiles')
            .select('id, full_name')

        const profilesMap = Object.fromEntries((profiles || []).map(p => [p.id, p.full_name]))

        // Ottieni i lead CRM per verificare le conversioni orfane
        const crmLeadIds = rawLeads.filter(l => l.feedback === 'converted' && l.crm_lead_id).map(l => l.crm_lead_id)
        let realLeadIds = new Set<string>()
        if (crmLeadIds.length > 0) {
            const { data: crmLeads } = await supabaseAdmin
                .from('leads')
                .select('id')
                .in('id', crmLeadIds)
            realLeadIds = new Set((crmLeads || []).map(l => l.id))
        }

        // Ottieni gli eventi a calendario per verificare gli appuntamenti fantasma
        const { data: events } = await supabaseAdmin
            .from('calendar_events')
            .select('lead_id, lead_phone, lead_email, closer_id')
            .eq('organization_id', orgId)

        // Raggruppa i dati per venditore
        const kpiMap: Record<string, {
            user_id: string
            name: string
            leads_requested: number
            leads_called: number
            leads_converted: number
            leads_wrong_number: number
            spins_count: number
            session_ids: Set<string>
        }> = {}

        const anomalies: any[] = []

        // Inizializza mappa per tutti i profili che hanno lead assegnati in questo periodo
        rawLeads.forEach(l => {
            const userId = l.assigned_to
            if (!userId) return

            if (!kpiMap[userId]) {
                kpiMap[userId] = {
                    user_id: userId,
                    name: profilesMap[userId] || 'Venditore',
                    leads_requested: 0,
                    leads_called: 0,
                    leads_converted: 0,
                    leads_wrong_number: 0,
                    spins_count: 0,
                    session_ids: new Set<string>()
                }
            }

            const stats = kpiMap[userId]
            stats.leads_requested += 1
            
            const isCalled = l.call_count > 0 || ['called', 'converted'].includes(l.status) || !!l.feedback
            if (isCalled) {
                stats.leads_called += 1
            }
            if (l.feedback === 'converted') {
                stats.leads_converted += 1
            }
            if (l.feedback === 'wrong_number') {
                stats.leads_wrong_number += 1
            }
            if (l.session_id) {
                stats.session_ids.add(l.session_id)
            }

            // --- CONTROLLO ANOMALIE (Anti-Cheat) ---
            
            // 1. Conversione Orfana
            if (l.feedback === 'converted' && (!l.crm_lead_id || !realLeadIds.has(l.crm_lead_id))) {
                anomalies.push({
                    id: `${l.id}-orphan`,
                    type: 'orphan_conversion',
                    severity: 'high',
                    closer_name: stats.name,
                    lead_name: l.full_name,
                    timestamp: l.feedback_at || l.assigned_at,
                    detail: `Contrassegnato come 'Convertito' ma nessun lead reale creato nel CRM.`
                })
            }

            // 2. Appuntamento Fantasma
            if (l.feedback === 'converted') {
                const hasEvent = (events || []).some(e => 
                    (l.crm_lead_id && e.lead_id === l.crm_lead_id) ||
                    (l.phone && e.lead_phone === l.phone) ||
                    (l.email && e.lead_email === l.email)
                )
                if (!hasEvent) {
                    anomalies.push({
                        id: `${l.id}-ghost`,
                        type: 'missing_appointment',
                        severity: 'medium',
                        closer_name: stats.name,
                        lead_name: l.full_name,
                        timestamp: l.feedback_at || l.assigned_at,
                        detail: `Marcato come 'Convertito' ma non risulta alcun appuntamento fissato sul Calendario.`
                    })
                }
            }

            // 3. Chiamata Ultra-Rapida (Speed Calling)
            if (l.feedback_at && l.assigned_at) {
                const diffMs = new Date(l.feedback_at).getTime() - new Date(l.assigned_at).getTime()
                const diffSeconds = diffMs / 1000
                if (diffSeconds > 0 && diffSeconds < 20) {
                    anomalies.push({
                        id: `${l.id}-speed`,
                        type: 'speed_calling',
                        severity: 'high',
                        closer_name: stats.name,
                        lead_name: l.full_name,
                        timestamp: l.feedback_at,
                        detail: `Feedback '${l.feedback}' registrato in soli ${Math.round(diffSeconds)} secondi dallo spin (chiamata sospetta).`
                    })
                }
            }
        })

        // Converte Set in count per spins_count e calcola medie del team per anomalie di numeri errati
        const kpiList = Object.values(kpiMap).map(stats => {
            stats.spins_count = stats.session_ids.size
            return {
                user_id: stats.user_id,
                name: stats.name,
                leads_requested: stats.leads_requested,
                leads_called: stats.leads_called,
                leads_converted: stats.leads_converted,
                leads_wrong_number: stats.leads_wrong_number,
                spins_count: stats.spins_count,
                conversion_rate: stats.leads_called > 0 ? Math.round((stats.leads_converted / stats.leads_called) * 100) : 0,
                efficiency_rate: stats.leads_requested > 0 ? Math.round((stats.leads_converted / stats.leads_requested) * 100) : 0,
            }
        })

        // Calcola tasso medio del team per numeri errati
        const teamTotalCalled = kpiList.reduce((s, u) => s + u.leads_called, 0)
        const teamTotalWrongNumbers = kpiList.reduce((s, u) => s + u.leads_wrong_number, 0)
        const teamWrongNumberAvg = teamTotalCalled > 0 ? (teamTotalWrongNumbers / teamTotalCalled) * 100 : 0

        // 4. Controlla anomalie sui numeri errati dei singoli closers
        kpiList.forEach(u => {
            if (u.leads_called > 5) {
                const userWrongNumberRate = (u.leads_wrong_number / u.leads_called) * 100
                // Se supera il 25% ed è almeno 2 volte superiore alla media del team
                if (userWrongNumberRate > 25 && userWrongNumberRate > (teamWrongNumberAvg * 2)) {
                    anomalies.push({
                        id: `${u.user_id}-wrong-rate`,
                        type: 'high_wrong_number_rate',
                        severity: 'medium',
                        closer_name: u.name,
                        timestamp: new Date().toISOString(),
                        detail: `Tasso di 'Numero errato' anomalo: ${Math.round(userWrongNumberRate)}% dei lead lavorati (Media team: ${Math.round(teamWrongNumberAvg)}%).`
                    })
                }
            }
        })

        return NextResponse.json({
            success: true,
            kpi: kpiList,
            anomalies: anomalies.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        })
    } catch (err: any) {
        console.error('[KPI_API] Global error:', err)
        return NextResponse.json({ error: 'Errore generico calcolo KPI' }, { status: 500 })
    }
}
