import { createClient } from '@supabase/supabase-js'

async function toBase64Url(input: any) { const b64 = Buffer.from(input).toString('base64'); return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, ''); }

async function main() {
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
    const { data: orgs } = await supabase.from('organizations').select('id, name').ilike('name', '%sincro%').limit(1).single()
    const { data: conn } = await supabase.from('connections').select('credentials').eq('organization_id', orgs.id).eq('provider', 'google_sheets').eq('status', 'active').single()
    
    let key = typeof conn.credentials.service_account_key === 'string' ? JSON.parse(conn.credentials.service_account_key) : conn.credentials.service_account_key
    key.private_key = key.private_key.replace(/\\n/g, '\n')
    const { createSign } = await import('crypto')
    const header = await toBase64Url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
    const now = Math.floor(Date.now() / 1000)
    const claim = await toBase64Url(JSON.stringify({ iss: key.client_email, scope: 'https://www.googleapis.com/auth/spreadsheets.readonly', aud: 'https://oauth2.googleapis.com/token', exp: now + 3600, iat: now }))
    const sign = createSign('RSA-SHA256'); sign.update(`${header}.${claim}`)
    const jwt = `${header}.${claim}.${await toBase64Url(sign.sign(key.private_key))}`
    const res = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}` })
    const data = await res.json()
    const token = data.access_token
    
    const sheetTitles = ["Appuntamenti Totali Calendly", "Setter (Step3)", "Leads (social)"]
    for (const title of sheetTitles) {
        const rowRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${conn.credentials.spreadsheet_id}/values/${encodeURIComponent(title)}!A1:Z10`, { headers: { 'Authorization': `Bearer ${token}` }})
        const rowData = await rowRes.json()
        console.log(`\nTAB: "${title}" => `, rowData.values ? rowData.values[0] : "EMPTY")
    }
}
main()
