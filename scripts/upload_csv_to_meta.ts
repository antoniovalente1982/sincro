import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
const META_API_VERSION = 'v21.0'

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

async function hashSHA256(data: string): Promise<string> {
    const encoder = new TextEncoder()
    const buffer = await crypto.subtle.digest('SHA-256', encoder.encode(data))
    return Array.from(new Uint8Array(buffer)).map(b => b.toString(16).padStart(2, '0')).join('')
}

function normalizePhone(phone: string): string {
    let digits = phone.replace(/\D/g, '')
    if (!digits) return ''
    if (digits.startsWith('39')) digits = digits
    else if (digits.startsWith('0')) digits = '39' + digits.substring(1)
    else if (digits.length === 10) digits = '39' + digits
    return digits
}

function normalizeEmail(email: string): string {
    return email.toLowerCase().trim()
}

async function run() {
    console.log('🎯 HERMES — CSV Customer List Upload\n')
    
    // 1. Get Meta credentials
    const { data: adsConn } = await supabase
        .from('connections')
        .select('credentials, config')
        .eq('provider', 'meta_ads')
        .eq('status', 'active')
        .limit(1)
        .single()

    if (!adsConn?.credentials?.access_token || !adsConn?.credentials?.ad_account_id) {
        console.error('❌ No active Meta Ads connection found.')
        return
    }

    const { access_token, ad_account_id } = adsConn.credentials
    const adAccount = `act_${ad_account_id}`
    console.log(`   ✅ Ad Account: ${adAccount}`)

    // 2. Parse CSV
    const csvPath = 'Lista Clienti Metodo Sincro/2026-04-08T07_54_57.292Z Metodo Sincro - Space Vendite - CONTATTI.csv'
    const file = fs.readFileSync(csvPath, 'utf-8')
    const lines = file.split('\n')
    
    console.log(`   Parsing CSV (${lines.length} lines)...`)
    
    const hashedEmails: string[][] = []
    const hashedPhones: string[][] = []
    
    for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue
        const str = lines[i]
        const cols = []
        let current = ''
        let inQuotes = false
        for (let c = 0; c < str.length; c++) {
            if (str[c] === '"') inQuotes = !inQuotes
            else if (str[c] === ',' && !inQuotes) {
                cols.push(current)
                current = ''
            } else {
                current += str[c]
            }
        }
        cols.push(current)
        const cleanCols = cols.map(c => c.replace(/^"|"$/g, '').trim())
        
        const email = cleanCols[11]
        const phone1 = cleanCols[12]
        const phone2 = cleanCols[14]
        
        if (email) {
            hashedEmails.push([await hashSHA256(normalizeEmail(email))])
        }
        if (phone1) {
            const p = normalizePhone(phone1)
            if (p) hashedPhones.push([await hashSHA256(p)])
        }
        if (phone2) {
            const p = normalizePhone(phone2)
            if (p) hashedPhones.push([await hashSHA256(p)])
        }
    }
    
    console.log(`   ✅ Hashed: ${hashedEmails.length} emails, ${hashedPhones.length} phones`)

    // 4. Create Custom Audience (Customer List)
    const audienceName = 'HERMES — 🏅 Clienti Reali (CSV Storico 3 Anni)'
    console.log(`📤 Creating audience: "${audienceName}"...`)

    const { data: existingAudiences } = await fetch(
        `https://graph.facebook.com/${META_API_VERSION}/${adAccount}/customaudiences?fields=name,id&limit=100&access_token=${access_token}`
    ).then(r => r.json())

    const existing = (existingAudiences || []).find((a: any) => a.name === audienceName)
    let audienceId: string

    if (existing) {
        console.log(`   ⏭️  Audience already exists (ID: ${existing.id}). Will add/update users.`)
        audienceId = existing.id
    } else {
        const createParams = new URLSearchParams()
        createParams.set('name', audienceName)
        createParams.set('description', 'Lista clienti reali fornita via CSV. Email + telefono hashati SHA256.')
        createParams.set('subtype', 'CUSTOM')
        createParams.set('customer_file_source', 'USER_PROVIDED_ONLY')
        createParams.set('access_token', access_token)

        const createRes = await fetch(
            `https://graph.facebook.com/${META_API_VERSION}/${adAccount}/customaudiences`,
            { method: 'POST', body: createParams }
        )
        const createResult = await createRes.json()
        if (createResult.error) {
            console.error('   ❌ Failed to create audience:', createResult.error.message)
            return
        }
        audienceId = createResult.id
        console.log(`   ✅ Created audience (ID: ${audienceId})`)
    }

    let totalUploaded = 0

    // Upload emails
    if (hashedEmails.length > 0) {
        const payload = {
            payload: { schema: 'EMAIL_SHA256', is_raw: false, data: hashedEmails }
        }
        const uploadRes = await fetch(
            `https://graph.facebook.com/${META_API_VERSION}/${audienceId}/users?access_token=${access_token}`,
            { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }
        )
        const uploadResult = await uploadRes.json()
        if (uploadResult.error) {
            console.error(`   ❌ Email upload failed:`, uploadResult.error.message)
        } else {
            console.log(`   ✅ Emails: ${hashedEmails.length} uploaded`)
            totalUploaded += hashedEmails.length
        }
    }

    // Upload phones
    if (hashedPhones.length > 0) {
        const payload = {
            payload: { schema: 'PHONE_SHA256', is_raw: false, data: hashedPhones }
        }
        const uploadRes = await fetch(
            `https://graph.facebook.com/${META_API_VERSION}/${audienceId}/users?access_token=${access_token}`,
            { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }
        )
        const uploadResult = await uploadRes.json()
        if (uploadResult.error) {
            console.error(`   ❌ Phone upload failed:`, uploadResult.error.message)
        } else {
            console.log(`   ✅ Phones: ${hashedPhones.length} uploaded`)
            totalUploaded += hashedPhones.length
        }
    }

    // 6. Create Lookalike
    console.log('\n👥 Creating Lookalike from CSV list...')
    const lalName = 'HERMES — LAL 1% — CSV Storico 3 Anni (Italia)'
    const lalExisting = (existingAudiences || []).find((a: any) => a.name === lalName)
    
    if (lalExisting) {
        console.log(`   ⏭️  Lookalike "${lalName}" already exists (ID: ${lalExisting.id})`)
    } else {
        const lalParams = new URLSearchParams()
        lalParams.set('name', lalName)
        lalParams.set('description', 'Lookalike 1% basata sui clienti reali storici da CSV.')
        lalParams.set('subtype', 'LOOKALIKE')
        lalParams.set('origin_audience_id', audienceId)
        lalParams.set('lookalike_spec', JSON.stringify({
            type: 'similarity', country: 'IT', ratio: 0.01, starting_ratio: 0
        }))
        lalParams.set('access_token', access_token)

        const lalRes = await fetch(
            `https://graph.facebook.com/${META_API_VERSION}/${adAccount}/customaudiences`,
            { method: 'POST', body: lalParams }
        )
        const lalResult = await lalRes.json()
        if (lalResult.error) {
            console.log(`   ❌ Lookalike failed: ${lalResult.error.message}`)
        } else {
            console.log(`   ✅ Created: "${lalName}" (ID: ${lalResult.id})`)
        }
    }
    console.log('\n✅ Upload completato!')
}

run().catch(console.error)
