import { appendLeadToSheet } from '../lib/google-sheets'
import { createClient } from '@supabase/supabase-js'

// Need to duplicate logic to read instead of write
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

    // Fetch org id for Metodo Sincro - assuming it's the first active one
    const { data: orgs } = await supabase.from('organizations').select('id, name').ilike('name', '%sincro%').limit(1).single()
    if (!orgs) throw new Error("Org non trovata")

    const { data: conn } = await supabase.from('connections')
        .select('credentials')
        .eq('organization_id', orgs.id)
        .eq('provider', 'google_sheets')
        .eq('status', 'active')
        .single()

    if (!conn?.credentials?.spreadsheet_id) throw new Error("No spreadsheet ID found")

    const token = await getServiceAccountToken(conn.credentials.service_account_key)
    if (!token) throw new Error("Failed to get token")

    // 1. Fetch metadata to get all sheet names
    console.log(`📡 Fetching Spreadsheet Info... ID: ${conn.credentials.spreadsheet_id}`)
    const metaRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${conn.credentials.spreadsheet_id}?fields=sheets.properties.title`, {
        headers: { 'Authorization': `Bearer ${token}` }
    })
    const meta = await metaRes.json()
    
    if (!meta.sheets) throw new Error("No sheets found or API Error: " + JSON.stringify(meta))
    
    const sheetTitles = meta.sheets.map((s: any) => s.properties.title)
    console.log(`\n📋 FOUND TABS: ${sheetTitles.join(', ')}\n`)

    // 2. Fetch A1:Z5 of each tab to inspect headers
    for (const title of sheetTitles) {
        const titleEncoded = encodeURIComponent(title)
        const rowRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${conn.credentials.spreadsheet_id}/values/${titleEncoded}!A1:Z5`, {
            headers: { 'Authorization': `Bearer ${token}` }
        })
        const rowData = await rowRes.json()
        
        console.log(`\n========================================`)
        console.log(`TAB: "${title}"`)
        console.log(`========================================`)
        if (rowData.values && rowData.values.length > 0) {
            console.log(`HEADERS: \n${JSON.stringify(rowData.values[0], null, 2)}`)
            if (rowData.values.length > 1) {
                console.log(`\nSAMPLE ROW 1: \n${JSON.stringify(rowData.values[1], null, 2)}`)
            }
        } else {
            console.log(`⚠️ Tab empty or no data found in A1:Z5`)
        }
    }
}

main().catch(console.error)
