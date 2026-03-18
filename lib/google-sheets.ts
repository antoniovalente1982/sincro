import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
)

interface GoogleSheetsCredentials {
    spreadsheet_id: string
    kpi_spreadsheet_id?: string   // Separate KPI spreadsheet
    service_account_key?: string  // JSON string of service account credentials
    api_key?: string              // Simple API key (read-only)
}

/**
 * Get Google Sheets credentials from the connections table
 */
async function getSheetsCredentials(orgId: string): Promise<GoogleSheetsCredentials | null> {
    const { data } = await supabaseAdmin
        .from('connections')
        .select('credentials')
        .eq('organization_id', orgId)
        .eq('provider', 'google_sheets')
        .eq('status', 'active')
        .single()

    if (!data?.credentials?.spreadsheet_id) return null
    return {
        spreadsheet_id: data.credentials.spreadsheet_id,
        kpi_spreadsheet_id: data.credentials.kpi_spreadsheet_id,
        service_account_key: data.credentials.service_account_key,
        api_key: data.credentials.api_key,
    }
}

/** Convert a buffer or string to base64url (URL-safe, no padding) */
function toBase64Url(input: string | Buffer): string {
    const b64 = typeof input === 'string' 
        ? Buffer.from(input).toString('base64')
        : input.toString('base64')
    return b64
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '')
}

/**
 * Get an access token from a service account key
 * Uses Node.js native crypto module for reliable JWT signing in serverless environments
 */
async function getServiceAccountToken(serviceAccountKey: string): Promise<string | null> {
    try {
        const key = typeof serviceAccountKey === 'string' ? JSON.parse(serviceAccountKey) : serviceAccountKey

        if (!key.client_email || !key.private_key) {
            console.error('Google Sheets: service account key missing client_email or private_key')
            return null
        }

        // Use Node.js native crypto for reliable JWT signing
        const { createSign } = await import('crypto')

        // Create JWT with base64url encoding (required by Google OAuth2)
        const header = toBase64Url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
        const now = Math.floor(Date.now() / 1000)
        const claim = toBase64Url(JSON.stringify({
            iss: key.client_email,
            scope: 'https://www.googleapis.com/auth/spreadsheets',
            aud: 'https://oauth2.googleapis.com/token',
            exp: now + 3600,
            iat: now,
        }))

        // Sign with RSA-SHA256 using Node.js native crypto
        const sign = createSign('RSA-SHA256')
        sign.update(`${header}.${claim}`)
        const sig = toBase64Url(sign.sign(key.private_key, 'base64'))

        const jwt = `${header}.${claim}.${sig}`

        // Exchange JWT for access token
        const res = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
        })

        const data = await res.json()
        if (!data.access_token) {
            console.error('Google Sheets: OAuth2 token exchange failed:', JSON.stringify(data))
            return null
        }
        console.log('Google Sheets: OAuth2 token obtained successfully')
        return data.access_token
    } catch (err) {
        console.error('Service account token error:', err)
        return null
    }
}

/**
 * Append a lead row to Google Sheets
 */
export async function appendLeadToSheet(orgId: string, leadData: {
    name: string
    email: string
    phone: string
    funnel: string
    utm_source: string
    utm_campaign: string
    created_at: string
    landing_url?: string
}): Promise<boolean> {
    const creds = await getSheetsCredentials(orgId)
    if (!creds) return false

    // Need service account key to write
    if (!creds.service_account_key) {
        console.log('Google Sheets: no service account key, skipping write')
        return false
    }

    const token = await getServiceAccountToken(creds.service_account_key)
    if (!token) return false

    try {
        // Build origin string like: landing.metodosincro.com (utm_source=facebook | utm_campaign=...)
        const originParts: string[] = []
        if (leadData.landing_url) originParts.push(leadData.landing_url)
        else originParts.push('AdPilotik')
        
        const utmParts: string[] = []
        if (leadData.utm_source) utmParts.push(`utm_source=${leadData.utm_source}`)
        if (leadData.utm_campaign) utmParts.push(`utm_campaign=${leadData.utm_campaign}`)
        
        const origin = utmParts.length > 0 
            ? `${originParts[0]} (${utmParts.join(' | ')})`
            : originParts[0]

        // Format date as DD/MM/YYYY
        const date = new Date(leadData.created_at)
        const formattedDate = `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`

        // Columns: data | NOME | NUMERO DI TELEFONO | MAIL | ORIGINE
        const values = [[
            formattedDate,
            leadData.name,
            leadData.phone,
            leadData.email,
            origin,
        ]]

        const sheetTab = encodeURIComponent('Leads (social)')
        const res = await fetch(
            `https://sheets.googleapis.com/v4/spreadsheets/${creds.spreadsheet_id}/values/${sheetTab}!A:E:append?valueInputOption=USER_ENTERED`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify({ values }),
            }
        )

        if (!res.ok) {
            const err = await res.text()
            console.error('Google Sheets append error:', err)
            return false
        }

        // Update last_synced_at in connections
        await supabaseAdmin
            .from('connections')
            .update({ last_synced_at: new Date().toISOString() })
            .eq('organization_id', orgId)
            .eq('provider', 'google_sheets')

        return true
    } catch (err) {
        console.error('Google Sheets error:', err)
        return false
    }
}

/**
 * Read KPI data from the KPI spreadsheet (monthly tabs)
 */
export async function readKPIData(orgId: string, month?: string): Promise<any[] | null> {
    const creds = await getSheetsCredentials(orgId)
    if (!creds || !creds.kpi_spreadsheet_id || !creds.service_account_key) return null

    const token = await getServiceAccountToken(creds.service_account_key)
    if (!token) return null

    try {
        // Default to current month in Italian
        const months = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
            'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre']
        const now = new Date()
        const sheetName = month || `${months[now.getMonth()]} ${now.getFullYear()}`
        const sheetTab = encodeURIComponent(sheetName)

        const res = await fetch(
            `https://sheets.googleapis.com/v4/spreadsheets/${creds.kpi_spreadsheet_id}/values/${sheetTab}?majorDimension=ROWS`,
            {
                headers: { 'Authorization': `Bearer ${token}` },
            }
        )

        if (!res.ok) {
            console.error('KPI read error:', await res.text())
            return null
        }

        const data = await res.json()
        return data.values || []
    } catch (err) {
        console.error('KPI read error:', err)
        return null
    }
}

/**
 * Read appointments data from the leads spreadsheet
 */
export async function readAppointments(orgId: string): Promise<any[] | null> {
    const creds = await getSheetsCredentials(orgId)
    if (!creds || !creds.service_account_key) return null

    const token = await getServiceAccountToken(creds.service_account_key)
    if (!token) return null

    try {
        const sheetTab = encodeURIComponent('Appuntamenti Totali Calendly')
        const res = await fetch(
            `https://sheets.googleapis.com/v4/spreadsheets/${creds.spreadsheet_id}/values/${sheetTab}?majorDimension=ROWS`,
            {
                headers: { 'Authorization': `Bearer ${token}` },
            }
        )

        if (!res.ok) {
            console.error('Appointments read error:', await res.text())
            return null
        }

        const data = await res.json()
        return data.values || []
    } catch (err) {
        console.error('Appointments read error:', err)
        return null
    }
}

/**
 * Full sync: export all leads to Google Sheets
 */
export async function syncAllLeadsToSheet(orgId: string): Promise<{ success: boolean; count: number }> {
    const creds = await getSheetsCredentials(orgId)
    if (!creds || !creds.service_account_key) {
        return { success: false, count: 0 }
    }

    const token = await getServiceAccountToken(creds.service_account_key)
    if (!token) return { success: false, count: 0 }

    // Get all leads
    const { data: leads } = await supabaseAdmin
        .from('leads')
        .select('name, email, phone, product, utm_source, utm_campaign, created_at')
        .eq('organization_id', orgId)
        .order('created_at', { ascending: true })

    if (!leads || leads.length === 0) return { success: true, count: 0 }

    // Build values array with header
    const values = [
        ['Data', 'Nome', 'Email', 'Telefono', 'Funnel/Prodotto', 'UTM Source', 'UTM Campaign'],
        ...leads.map(l => [
            l.created_at || '',
            l.name || '',
            l.email || '',
            l.phone || '',
            l.product || '',
            l.utm_source || '',
            l.utm_campaign || '',
        ])
    ]

    try {
        // Clear existing data
        await fetch(
            `https://sheets.googleapis.com/v4/spreadsheets/${creds.spreadsheet_id}/values/Sheet1!A:G:clear`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
            }
        )

        // Write all data
        const res = await fetch(
            `https://sheets.googleapis.com/v4/spreadsheets/${creds.spreadsheet_id}/values/Sheet1!A1?valueInputOption=USER_ENTERED`,
            {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify({ values }),
            }
        )

        if (!res.ok) {
            const err = await res.text()
            console.error('Google Sheets sync error:', err)
            return { success: false, count: 0 }
        }

        // Update last_synced_at
        await supabaseAdmin
            .from('connections')
            .update({ last_synced_at: new Date().toISOString() })
            .eq('organization_id', orgId)
            .eq('provider', 'google_sheets')

        return { success: true, count: leads.length }
    } catch (err) {
        console.error('Google Sheets full sync error:', err)
        return { success: false, count: 0 }
    }
}
