import { appendLeadToSheet } from '../lib/google-sheets'
import { createClient } from '@supabase/supabase-js'

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
        const { createSign } = await import('crypto')
        const header = toBase64Url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
        const now = Math.floor(Date.now() / 1000)
        const claim = toBase64Url(JSON.stringify({
            iss: key.client_email,
            scope: 'https://www.googleapis.com/auth/spreadsheets.readonly', // Readonly
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
        return null
    }
}

async function main() {
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

    const { data: orgs } = await supabase.from('organizations').select('id, name').ilike('name', '%sincro%').limit(1).single()
    if (!orgs) throw new Error("Org non trovata")

    const { data: conn } = await supabase.from('connections')
        .select('credentials')
        .eq('organization_id', orgs.id)
        .eq('provider', 'google_sheets')
        .eq('status', 'active')
        .single()

    const token = await getServiceAccountToken(conn.credentials.service_account_key)
    
    // Solo i tab di Marzo 2026 come richiesto
    const sheetTitles = ["App Marzo26", "Lead Marzo26"]

    for (const title of sheetTitles) {
        const titleEncoded = encodeURIComponent(title)
        const rowRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${conn.credentials.spreadsheet_id}/values/${titleEncoded}!A1:Z500`, {
            headers: { 'Authorization': `Bearer ${token}` }
        })
        const rowData = await rowRes.json()
        
        console.log(`\n========================================`)
        console.log(`TAB: "${title}"`)
        console.log(`========================================`)
        if (rowData.values && rowData.values.length > 0) {
            // Cerca la prima riga sensata (più di 3 celle non vuote)
            const headerRow = rowData.values.find((r: any[]) => r.filter(c => c).length > 3)
            if (headerRow) {
                console.log(`HEADERS FOUND: \n${JSON.stringify(headerRow, null, 2)}`)
            } else {
                console.log(`NO HEADERS FOUND in 500 rows, returning all rows for inspection:\n`, rowData.values.slice(0, 10))
            }
        } else {
            console.log(`⚠️ Tab actually empty or no data found in A1:Z500`)
        }
    }
}

main().catch(console.error)
