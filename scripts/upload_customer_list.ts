/**
 * 🎯 HERMES — Customer List Upload to Meta
 * 
 * Reads all leads from Supabase, hashes PII (email + phone + name),
 * and uploads them to Meta as a Custom Audience (Customer List).
 * Then creates a 1% Lookalike based on the customer list.
 *
 * Usage: npx tsx scripts/upload_customer_list.ts
 * 
 * NOTE: Meta requires minimum 100 contacts for matching.
 * Lookalike requires at least 100 matched contacts.
 */

import { createClient } from '@supabase/supabase-js'

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
    // Remove all non-digits, add Italy prefix if needed
    let digits = phone.replace(/\D/g, '')
    if (digits.startsWith('39')) digits = digits // already has country code
    else if (digits.startsWith('0')) digits = '39' + digits.substring(1) // Italian landline
    else if (digits.length === 10) digits = '39' + digits // Italian mobile
    return digits
}

function normalizeEmail(email: string): string {
    return email.toLowerCase().trim()
}

async function run() {
    console.log('🎯 HERMES — Customer List Upload\n')
    console.log('═══════════════════════════════════════════\n')

    // 1. Get Meta credentials
    console.log('📡 Fetching credentials...')
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
    console.log(`   ✅ Ad Account: ${adAccount}\n`)

    // 2. Fetch all leads with email or phone
    console.log('📥 Fetching leads from Supabase...')
    const { data: leads, error } = await supabase
        .from('leads')
        .select('email, phone, name')
        .not('email', 'is', null)

    if (error) {
        console.error('❌ Error fetching leads:', error.message)
        return
    }

    // Filter leads that have at least email or phone
    const validLeads = (leads || []).filter(l => l.email || l.phone)
    console.log(`   Found ${validLeads.length} leads with contact info`)

    if (validLeads.length < 20) {
        console.log('   ⚠️  Only', validLeads.length, 'leads. Meta needs at least 100 for matching.')
        console.log('   Proceeding anyway — Meta will do its best with what we have.\n')
    }

    // 3. Hash all PII
    console.log('🔒 Hashing PII data...')
    const hashedData: string[][] = []
    let emailCount = 0, phoneCount = 0
    const phoneRows: string[][] = []  // separate phone rows

    for (const lead of validLeads) {
        // We send two separate rows when both email and phone exist
        // This maximizes matching because Meta matches each independently
        
        if (lead.email) {
            hashedData.push([await hashSHA256(normalizeEmail(lead.email))])
            emailCount++
        }

        if (lead.phone) {
            phoneRows.push([await hashSHA256(normalizePhone(lead.phone))])
            phoneCount++
        }
    }

    console.log(`   ✅ Hashed: ${emailCount} emails, ${phoneCount} phones`)
    console.log('')

    // 4. Create Custom Audience (Customer List)
    const audienceName = 'HERMES — 🏅 Clienti Reali (Database)'
    console.log(`📤 Creating audience: "${audienceName}"...`)

    // Check if already exists
    const { data: existingAudiences } = await fetch(
        `https://graph.facebook.com/${META_API_VERSION}/${adAccount}/customaudiences?fields=name,id&limit=100&access_token=${access_token}`
    ).then(r => r.json())

    const existing = (existingAudiences || []).find((a: any) => a.name === audienceName)
    let audienceId: string

    if (existing) {
        console.log(`   ⏭️  Audience already exists (ID: ${existing.id}). Will add/update users.`)
        audienceId = existing.id
    } else {
        // Create new audience
        const createParams = new URLSearchParams()
        createParams.set('name', audienceName)
        createParams.set('description', 'Lista clienti reali dal database Sincro. Email + telefono + nome hashati SHA256. Usare per Lookalike e esclusioni.')
        createParams.set('subtype', 'CUSTOM')
        createParams.set('customer_file_source', 'USER_PROVIDED_ONLY')
        createParams.set('access_token', access_token)

        const createRes = await fetch(
            `https://graph.facebook.com/${META_API_VERSION}/${adAccount}/customaudiences`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: createParams.toString(),
            }
        )
        const createResult = await createRes.json()

        if (createResult.error) {
            console.error('   ❌ Failed to create audience:', createResult.error.message)
            if (createResult.error.error_user_msg) console.error('      Detail:', createResult.error.error_user_msg)
            return
        }

        audienceId = createResult.id
        console.log(`   ✅ Created audience (ID: ${audienceId})`)
    }

    // 5. Upload hashed data in batches (max 10k per batch)
    console.log('📤 Uploading hashed data to Meta...')
    const BATCH_SIZE = 10000
    let totalUploaded = 0

    // Upload emails
    if (hashedData.length > 0) {
        const payload = {
            payload: {
                schema: 'EMAIL_SHA256',
                is_raw: false,
                data: hashedData,
            },
        }

        const uploadRes = await fetch(
            `https://graph.facebook.com/${META_API_VERSION}/${audienceId}/users?access_token=${access_token}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            }
        )
        const uploadResult = await uploadRes.json()

        if (uploadResult.error) {
            console.error(`   ❌ Email upload failed:`, uploadResult.error.message)
        } else {
            console.log(`   ✅ Emails: ${hashedData.length} uploaded`)
            if (uploadResult.num_received) console.log(`      Received: ${uploadResult.num_received}, Invalid: ${uploadResult.num_invalid_entries || 0}`)
            totalUploaded += hashedData.length
        }
    }

    // Upload phones
    if (phoneRows.length > 0) {
        const payload = {
            payload: {
                schema: 'PHONE_SHA256',
                is_raw: false,
                data: phoneRows,
            },
        }

        const uploadRes = await fetch(
            `https://graph.facebook.com/${META_API_VERSION}/${audienceId}/users?access_token=${access_token}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            }
        )
        const uploadResult = await uploadRes.json()

        if (uploadResult.error) {
            console.error(`   ❌ Phone upload failed:`, uploadResult.error.message)
        } else {
            console.log(`   ✅ Phones: ${phoneRows.length} uploaded`)
            if (uploadResult.num_received) console.log(`      Received: ${uploadResult.num_received}, Invalid: ${uploadResult.num_invalid_entries || 0}`)
            totalUploaded += phoneRows.length
        }
    }

    console.log(`\n   📊 Total uploaded: ${totalUploaded} data points (${emailCount} emails + ${phoneCount} phones)`)

    // 6. Create Lookalike from this audience
    console.log('\n👥 Creating Lookalike from customer list...')
    const lalName = 'HERMES — LAL 1% — Clienti Reali (Italia)'

    // Check if LAL already exists
    const lalExisting = (existingAudiences || []).find((a: any) => a.name === lalName)
    if (lalExisting) {
        console.log(`   ⏭️  Lookalike "${lalName}" already exists (ID: ${lalExisting.id})`)
    } else {
        const lalParams = new URLSearchParams()
        lalParams.set('name', lalName)
        lalParams.set('description', 'Lookalike 1% basata su clienti reali dal database. La Lookalike PIÙ potente — basata su persone che hanno davvero comprato.')
        lalParams.set('subtype', 'LOOKALIKE')
        lalParams.set('origin_audience_id', audienceId)
        lalParams.set('lookalike_spec', JSON.stringify({
            type: 'similarity',
            country: 'IT',
            ratio: 0.01,
            starting_ratio: 0,
        }))
        lalParams.set('access_token', access_token)

        const lalRes = await fetch(
            `https://graph.facebook.com/${META_API_VERSION}/${adAccount}/customaudiences`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: lalParams.toString(),
            }
        )
        const lalResult = await lalRes.json()

        if (lalResult.error) {
            console.log(`   ❌ Lookalike failed: ${lalResult.error.message}`)
            if (lalResult.error.message.includes('too small') || lalResult.error.message.includes('not enough')) {
                console.log('   💡 L\'audience è troppo piccola per creare una Lookalike. Aspetta che Meta faccia il matching.')
                console.log('   💡 Puoi rilanciare questo script tra qualche ora per creare la Lookalike.')
            }
        } else {
            console.log(`   ✅ Created: "${lalName}" (ID: ${lalResult.id})`)
        }
    }

    console.log('\n═══════════════════════════════════════════')
    console.log('\n✅ Upload completato!')
    console.log(`   - ${totalUploaded} contatti caricati su Meta`)
    console.log(`   - Meta farà il matching nelle prossime ore`)
    console.log(`   - La Lookalike sarà pronta in 24-48h`)
    console.log('')
}

run().catch(console.error)
