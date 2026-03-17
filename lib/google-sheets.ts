import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
)

interface GoogleSheetsCredentials {
    spreadsheet_id: string
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
        service_account_key: data.credentials.service_account_key,
        api_key: data.credentials.api_key,
    }
}

/**
 * Get an access token from a service account key
 */
async function getServiceAccountToken(serviceAccountKey: string): Promise<string | null> {
    try {
        const key = typeof serviceAccountKey === 'string' ? JSON.parse(serviceAccountKey) : serviceAccountKey

        // Create JWT
        const header = btoa(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
        const now = Math.floor(Date.now() / 1000)
        const claim = btoa(JSON.stringify({
            iss: key.client_email,
            scope: 'https://www.googleapis.com/auth/spreadsheets',
            aud: 'https://oauth2.googleapis.com/token',
            exp: now + 3600,
            iat: now,
        }))

        // Import private key and sign
        const pemContents = key.private_key
            .replace(/-----BEGIN PRIVATE KEY-----/g, '')
            .replace(/-----END PRIVATE KEY-----/g, '')
            .replace(/\n/g, '')

        const binaryKey = Uint8Array.from(atob(pemContents), c => c.charCodeAt(0))

        const cryptoKey = await crypto.subtle.importKey(
            'pkcs8',
            binaryKey,
            { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
            false,
            ['sign']
        )

        const signatureInput = new TextEncoder().encode(`${header}.${claim}`)
        const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', cryptoKey, signatureInput)
        const sig = btoa(String.fromCharCode(...new Uint8Array(signature)))
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=/g, '')

        const jwt = `${header}.${claim}.${sig}`

        // Exchange JWT for access token
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
        const values = [[
            leadData.created_at,
            leadData.name,
            leadData.email,
            leadData.phone,
            leadData.funnel,
            leadData.utm_source,
            leadData.utm_campaign,
        ]]

        const res = await fetch(
            `https://sheets.googleapis.com/v4/spreadsheets/${creds.spreadsheet_id}/values/Sheet1!A:G:append?valueInputOption=USER_ENTERED`,
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
