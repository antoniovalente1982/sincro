import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getSupabaseAdmin() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    )
}

function toBase64Url(input: string | Buffer): string {
    const b64 = typeof input === 'string' 
        ? Buffer.from(input).toString('base64')
        : input.toString('base64')
    return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

async function getServiceAccountToken(serviceAccountKey: string): Promise<string | null> {
    try {
        const key = typeof serviceAccountKey === 'string' ? JSON.parse(serviceAccountKey) : serviceAccountKey
        if (!key.client_email || !key.private_key) return null
        key.private_key = key.private_key.replace(/\\n/g, '\n')
        
        // dynamic import of crypto for Edge/Node compatibility if possible
        const { createSign } = await import('crypto')
        const header = toBase64Url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
        const now = Math.floor(Date.now() / 1000)
        const claim = toBase64Url(JSON.stringify({
            iss: key.client_email,
            scope: 'https://www.googleapis.com/auth/spreadsheets.readonly',
            aud: 'https://oauth2.googleapis.com/token',
            exp: now + 3600,
            iat: now,
        }))
        const sign = createSign('RSA-SHA256')
        sign.update(`${header}.${claim}`)
        const sig = toBase64Url(sign.sign(key.private_key))
        const jwt = `${header}.${claim}.${sig}`

        const res = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
        })
        const data = await res.json()
        return data.access_token || null
    } catch (err) {
        console.error('Service account token error:', err)
        return null
    }
}

// Map months securely to Italian naming matching user's tabs (e.g. Marzo26)
const monthNamesIT = [
    'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 
    'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'
]

function getCurrentTabNames(allSheetNames: string[]) {
    const d = new Date()
    const month = monthNamesIT[d.getMonth()].toLowerCase() // "marzo"
    const yearShort = d.getFullYear().toString().substring(2) // "26"
    const yearFull = d.getFullYear().toString() // "2026"

    let leadTab = allSheetNames.find(s => s.toLowerCase().includes('lead') && s.toLowerCase().includes(month) && (s.includes(yearShort) || s.includes(yearFull)))
    let appTab = allSheetNames.find(s => (s.toLowerCase().includes('app') || s.toLowerCase().includes('vendit')) && s.toLowerCase().includes(month) && (s.includes(yearShort) || s.includes(yearFull)))

    return {
        leadTab: leadTab || `Lead ${monthNamesIT[d.getMonth()]}${yearShort}`,
        appTab: appTab || `App ${monthNamesIT[d.getMonth()]}${yearShort}`
    }
}

export async function GET(req: NextRequest) {
    const authHeader = req.headers.get('authorization')
    // A simple basic auth or cron secret check could be added here
    // if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    
    // We process all active google sheets connections
    const supabase = getSupabaseAdmin()
    const { data: connections, error: connErr } = await supabase
        .from('connections')
        .select('organization_id, credentials')
        .eq('provider', 'google_sheets')
        .eq('status', 'active')

    if (connErr || !connections) {
        return NextResponse.json({ error: 'No connections found' }, { status: 404 })
    }

    let totalCreated = 0
    let totalUpdated = 0
    const debugLog: any = { logs: [], errors: [], parsedSetter: 0, parsedSeller: 0 }

    // Fetch pipeline info generically per organization to map stages
    for (const conn of connections) {
        const orgId = conn.organization_id
        if (!conn.credentials?.spreadsheet_id || !conn.credentials?.service_account_key) continue

        const token = await getServiceAccountToken(conn.credentials.service_account_key)
        if (!token) continue

        // Fetch actual sheet names first
        let allSheetNames: string[] = []
        try {
            const metaRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${conn.credentials.spreadsheet_id}`, { headers: { 'Authorization': `Bearer ${token}` }})
            const metaData = await metaRes.json()
            allSheetNames = metaData.sheets?.map((s: any) => s.properties.title) || []
        } catch(e) {}

        const { leadTab, appTab } = getCurrentTabNames(allSheetNames)
        debugLog.allSheets = allSheetNames

        // 1. Get Pipeline Stages  
        const { data: pipelines } = await supabase.from('pipelines')
            .select('id, name')
            .eq('organization_id', orgId)
            .eq('is_default', true)
            .limit(1)
            .single()

        let firstStageId: string | null = null
        let appointmentStageId: string | null = null
        let closedWonStageId: string | null = null
        let closedLostStageId: string | null = null

        if (pipelines) {
            const { data: stages } = await supabase.from('pipeline_stages')
                .select('id, name, sort_order')
                .eq('pipeline_id', pipelines.id)
                .order('sort_order', { ascending: true })
            
            if (stages && stages.length > 0) {
                firstStageId = stages[0].id
                // fuzzy match standard names
                appointmentStageId = stages.find(s => s.name.toLowerCase().includes('appuntament'))?.id || null
                closedWonStageId = stages.find(s => s.name.toLowerCase().includes('vint') || s.name.toLowerCase().includes('vendut'))?.id || null
                closedLostStageId = stages.find(s => s.name.toLowerCase().includes('pers') || s.name.toLowerCase().includes('cancellat'))?.id || null
            }
        }

        // Helper to fetch sheet data
        const getSheetData = async (tabName: string) => {
            try {
                const res = await fetch(
                    `https://sheets.googleapis.com/v4/spreadsheets/${conn.credentials.spreadsheet_id}/values/${encodeURIComponent(`'${tabName}'`)}!A1:Z500`,
                    { headers: { 'Authorization': `Bearer ${token}` } }
                )
                if (!res.ok) return []
                const data = await res.json()
                return data.values || []
            } catch (e) {
                return []
            }
        }

        const leadsRows = await getSheetData(leadTab)
        const appsRows = await getSheetData(appTab)

        debugLog.logs.push(`Reading Tabs: ${leadTab} (Rows: ${leadsRows.length}), ${appTab} (Rows: ${appsRows.length})`)

        // Maps to hold incoming data by email
        type IncomingLead = { email: string; name: string; phone: string; esito: string; source: string }
        type IncomingApp = { email: string; stato: string; esito: string; descrizione: string }
        
        const setterLeads = new Map<string, IncomingLead>()
        const sellerApps = new Map<string, IncomingApp>()

        // Parse Setter Leads (Lead Marzo26)
        if (leadsRows.length > 1) {
            // Find header indexes
            const headerRow = leadsRows.find((r: any[]) => r.length > 3) || leadsRows[0]
            const getIdx = (keywords: string[]) => headerRow.findIndex((h: any) => keywords.some(k => typeof h === 'string' && h.toLowerCase().includes(k)))
            
            const emailIdx = getIdx(['mail', 'email'])
            const nameIdx = getIdx(['nome', 'name'])
            const phoneIdx = getIdx(['telef', 'phone', 'cellulare'])
            const esitoIdx = getIdx(['esito'])
            const sourceIdx = getIdx(['origin'])

            if (emailIdx !== -1) {
                for (const row of leadsRows) {
                    if (row === headerRow) continue
                    const email = row[emailIdx]?.trim()?.toLowerCase()
                    if (!email || !email.includes('@')) continue
                    
                    setterLeads.set(email, {
                        email,
                        name: nameIdx !== -1 ? row[nameIdx] || '' : 'Lead Esterno',
                        phone: phoneIdx !== -1 ? row[phoneIdx] || null : null,
                        esito: esitoIdx !== -1 ? row[esitoIdx] || '' : '',
                        source: sourceIdx !== -1 ? row[sourceIdx] || 'Google Sheet' : 'Google Sheet',
                    })
                }
            } else {
                debugLog.errors.push(`No Email column found in Setter Tab. Headers: ${headerRow.join(',')}`)
            }
        }

        // Parse Seller Apps (App Marzo26)
        if (appsRows.length > 1) {
            const headerRow = appsRows.find((r: any[]) => r.length > 3) || appsRows[0]
            const getIdx = (keywords: string[]) => headerRow.findIndex((h: any) => keywords.some(k => typeof h === 'string' && h.toLowerCase().includes(k)))
            
            const emailIdx = getIdx(['email', 'mail'])
            const statoIdx = getIdx(['stato', 'no show', 'fatto']) // "Stato Appuntamento"
            const esitoIdx = getIdx(['esito', 'vinta']) // "Esito" OR "Vinta" / "Persa"
            const descIdx = getIdx(['descriz', 'prodotto', 'pacchetto']) // "Descrizione"

            if (emailIdx !== -1) {
                for (const row of appsRows) {
                    if (row === headerRow) continue
                    const email = row[emailIdx]?.trim()?.toLowerCase()
                    if (!email || !email.includes('@')) continue
                    
                    sellerApps.set(email, {
                        email,
                        stato: statoIdx !== -1 ? (typeof row[statoIdx] === 'string' ? row[statoIdx].toUpperCase() : '') : '',
                        esito: esitoIdx !== -1 ? (typeof row[esitoIdx] === 'string' ? row[esitoIdx].toUpperCase() : '') : '',
                        descrizione: descIdx !== -1 ? (typeof row[descIdx] === 'string' ? row[descIdx].toLowerCase() : '') : '',
                    })
                }
            } else {
                debugLog.errors.push(`No Email column found in Apps Tab. Headers: ${headerRow.join(',')}`)
            }
        }

        debugLog.parsedSetter = setterLeads.size
        debugLog.parsedSeller = sellerApps.size

        // Retrieve existing leads to compare
        const validEmails = Array.from(new Set([...Array.from(setterLeads.keys()), ...Array.from(sellerApps.keys())]))
        if (validEmails.length === 0) continue

        // Fetch in batches if there are too many, but Supabase allows 1000 in an 'in' query
        const { data: existingLeads } = await supabase
            .from('leads')
            .select('id, email, stage_id, value, meta_data')
            .eq('organization_id', orgId)
            .in('email', validEmails)

        const existingLeadsMap = new Map(existingLeads?.map(l => [l.email, l]) || [])

        // 1. Process Setter Leads (Create new ones if missing)
        for (const [email, sLead] of Array.from(setterLeads.entries())) {
            let leadRecord = existingLeadsMap.get(email)
            if (!leadRecord) {
                // Feature: "in piu se trovi lead che arrivano da altre fonti e non vedi li, inserisci nel crm"
                const { data: newLead, error: newErr } = await supabase.from('leads').insert({
                    organization_id: orgId,
                    email,
                    name: sLead.name,
                    phone: sLead.phone,
                    stage_id: firstStageId,
                    meta_data: { source: 'google_sheets_sync', original_source: sLead.source }
                }).select('id, email, stage_id, value, meta_data').single()
                
                if (newLead) {
                    leadRecord = newLead
                    existingLeadsMap.set(email, newLead)
                    totalCreated++

                    await supabase.from('lead_activities').insert({
                        organization_id: orgId, lead_id: newLead.id,
                        activity_type: 'stage_changed', to_stage_id: firstStageId,
                        notes: `🔄 Importato automaticamente da Fogli Google (Tab Setter: ${leadTab})`
                    })
                } else {
                    debugLog.errors.push(`Failed to insert lead ${email}: ${newErr?.message}`)
                }
            }
        }

        // 2. Process Seller Apps (Promote structure based on esito/descrizione)
        for (const [email, sellerApp] of Array.from(sellerApps.entries())) {
            const leadRecord = existingLeadsMap.get(email)
            if (!leadRecord) continue // Might be an appointment for someone not even in Setter tab, ideally they should be in DB by now

            let targetStageId = leadRecord.stage_id
            let newValue = leadRecord.value
            let actionNote = ''

            const isCanceled = sellerApp.stato.includes('CANCELLAT') || sellerApp.stato.includes('NO SHOW')
            const isFatto = sellerApp.stato.includes('FATTO') || sellerApp.stato === '51' || sellerApp.stato === '46'
            const isVinta = sellerApp.esito.includes('VINTA') || sellerApp.esito.includes('SI')
            const isPersa = sellerApp.esito.includes('PERSA') || sellerApp.esito.includes('NO')

            if (isCanceled || isPersa) {
                if (closedLostStageId && leadRecord.stage_id !== closedLostStageId) {
                    targetStageId = closedLostStageId
                    actionNote = `📉 Segnato come Perso/Cancellato su Foglio Google (Tab Venditori)`
                }
            } else if (isVinta) {
                if (closedWonStageId && leadRecord.stage_id !== closedWonStageId) {
                    targetStageId = closedWonStageId
                    
                    // "da descrizione capire Platinum 2250 o Impact 3000"
                    if (sellerApp.descrizione.includes('platinum')) {
                        newValue = 2250
                        actionNote = `🏆 Chiuso Vinto su Foglio Google! Assegnato valore PLATINUM (2250€)`
                    } else if (sellerApp.descrizione.includes('impact')) {
                        newValue = 3000
                        actionNote = `🏆 Chiuso Vinto su Foglio Google! Assegnato valore IMPACT (3000€)`
                    } else {
                        actionNote = `🏆 Chiuso Vinto su Foglio Google (Nessun pacchetto specifico in descrizione)`
                    }
                }
            } else if (isFatto || sellerApp.stato.includes('')) { // Even if it's just listed in appuntamenti tab, it should be in Appointments stage
                if (appointmentStageId && leadRecord.stage_id !== appointmentStageId && leadRecord.stage_id !== closedWonStageId && leadRecord.stage_id !== closedLostStageId) {
                    targetStageId = appointmentStageId
                    actionNote = `📅 Fissato appuntamento su Foglio Google (spostato in Appuntamento)`
                }
            }

            // Perform Update if needed
            if (targetStageId !== leadRecord.stage_id || newValue !== leadRecord.value) {
                try {
                    await supabase.from('leads').update({
                        stage_id: targetStageId,
                        value: newValue,
                        updated_at: new Date().toISOString()
                    }).eq('id', leadRecord.id)

                    if (actionNote) {
                        await supabase.from('lead_activities').insert({
                            organization_id: orgId, lead_id: leadRecord.id,
                            activity_type: 'stage_changed',
                            from_stage_id: leadRecord.stage_id, to_stage_id: targetStageId,
                            notes: actionNote
                        })
                    }
                    totalUpdated++
                    
                    // update local memory to prevent double-updates
                    leadRecord.stage_id = targetStageId
                    leadRecord.value = newValue
                } catch (e) {
                    console.error('Update err', e)
                }
            }
        }
    }

    return NextResponse.json({ 
        success: true, 
        message: 'Sync completed',
        stats: { totalCreated, totalUpdated },
        debugLog
    })
}
