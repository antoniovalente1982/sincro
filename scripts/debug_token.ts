import { createClient } from '@supabase/supabase-js'

async function debugToken() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    const supabase = createClient(supabaseUrl, serviceKey)

    const orgId = 'a5dd4842-f0ea-4909-b4a3-be2cb1c6ffa5'
    
    console.log('Fetching credentials...')
    const { data } = await supabase
        .from('connections')
        .select('credentials')
        .eq('organization_id', orgId)
        .eq('provider', 'google_sheets')
        .eq('status', 'active')
        .single()

    if (!data?.credentials?.service_account_key) {
        console.log('No service_account_key found')
        return
    }

    let rawKey = data.credentials.service_account_key
    console.log('Type of rawKey:', typeof rawKey)
    
    let keyObj = typeof rawKey === 'string' ? JSON.parse(rawKey) : rawKey
    console.log('Original private_key snippet:', keyObj.private_key.substring(0, 50))
    console.log('Original private_key contains literal \\n?', keyObj.private_key.includes('\\n'))

    let fixedKey = keyObj.private_key.replace(/\\n/g, '\n')
    console.log('Fixed private_key snippet:', fixedKey.substring(0, 50))
    console.log('Fixed private_key contains literal \\n?', fixedKey.includes('\\n'))

    // Generate token
    const { createSign } = await import('crypto')
    const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url')
    const now = Math.floor(Date.now() / 1000)
    const claim = Buffer.from(JSON.stringify({
        iss: keyObj.client_email,
        scope: 'https://www.googleapis.com/auth/spreadsheets',
        aud: 'https://oauth2.googleapis.com/token',
        exp: now + 3600,
        iat: now,
    })).toString('base64url')

    const sign = createSign('RSA-SHA256')
    sign.update(`${header}.${claim}`)
    
    try {
        const sig = sign.sign(fixedKey, 'base64url')
        console.log('Sign successful')
        const jwt = `${header}.${claim}.${sig}`

        const res = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
        })
        const result = await res.json()
        console.log('Google response:', result)
    } catch (err: any) {
        console.log('Sign failed:', err.message)
    }
}

debugToken()
