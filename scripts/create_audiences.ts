/**
 * 🎯 HERMES — Custom Audience Creator
 * 
 * Creates a complete set of Meta Custom Audiences for retargeting & lookalike.
 * Reads credentials from Supabase connections table.
 * 
 * Usage: npx tsx scripts/create_audiences.ts
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
const META_API_VERSION = 'v21.0'

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

// ─── Audience Definitions ────────────────────────────────────────────────────

interface AudienceDef {
    name: string
    description: string
    type: 'website' | 'lookalike'
    // For website audiences
    rule?: any
    retention_days?: number
    // For lookalike audiences
    origin_audience_name?: string
    ratio?: number
    country?: string
}

const WEBSITE_AUDIENCES: AudienceDef[] = [
    // ════════════════ RETARGETING FUNNEL ════════════════
    {
        name: 'HERMES — 🔥 HOT — Form Iniziato (14gg)',
        description: 'Utenti che hanno iniziato a compilare il form ma NON hanno inviato. Retargetizzare con urgenza e social proof.',
        type: 'website',
        retention_days: 14,
        rule: {
            inclusions: {
                operator: 'or',
                rules: [{ event_sources: ['PIXEL_ID'], retention_seconds: 14 * 86400, filter: { operator: 'and', filters: [{ field: 'event', operator: 'eq', value: 'InitiateCheckout' }] } }]
            },
            exclusions: {
                operator: 'or',
                rules: [{ event_sources: ['PIXEL_ID'], retention_seconds: 14 * 86400, filter: { operator: 'and', filters: [{ field: 'event', operator: 'eq', value: 'Lead' }] } }]
            }
        }
    },
    {
        name: 'HERMES — 🟠 WARM — Visitatori Engaged (30gg)',
        description: 'Utenti che hanno scrollato/letto la landing (ViewContent) ma NON hanno compilato il form. Retargetizzare con angoli diversi.',
        type: 'website',
        retention_days: 30,
        rule: {
            inclusions: {
                operator: 'or',
                rules: [{ event_sources: ['PIXEL_ID'], retention_seconds: 30 * 86400, filter: { operator: 'and', filters: [{ field: 'event', operator: 'eq', value: 'ViewContent' }] } }]
            },
            exclusions: {
                operator: 'or',
                rules: [{ event_sources: ['PIXEL_ID'], retention_seconds: 30 * 86400, filter: { operator: 'and', filters: [{ field: 'event', operator: 'eq', value: 'InitiateCheckout' }] } }]
            }
        }
    },
    {
        name: 'HERMES — 🟡 COLD — Visitatori Sito (60gg)',
        description: 'Tutti i visitatori del sito (PageView) ma che NON hanno mostrato engagement (no ViewContent). Retargetizzare con hook forti.',
        type: 'website',
        retention_days: 60,
        rule: {
            inclusions: {
                operator: 'or',
                rules: [{ event_sources: ['PIXEL_ID'], retention_seconds: 60 * 86400, filter: { operator: 'and', filters: [{ field: 'event', operator: 'eq', value: 'PageView' }] } }]
            },
            exclusions: {
                operator: 'or',
                rules: [{ event_sources: ['PIXEL_ID'], retention_seconds: 60 * 86400, filter: { operator: 'and', filters: [{ field: 'event', operator: 'eq', value: 'ViewContent' }] } }]
            }
        }
    },

    // ════════════════ BASE AUDIENCES (per Lookalike + Esclusioni) ════════════════
    {
        name: 'HERMES — ⭐ Lead Tutti (180gg)',
        description: 'Tutti gli utenti che hanno compilato il form negli ultimi 180 giorni. Usare per ESCLUSIONE e per Lookalike.',
        type: 'website',
        retention_days: 180,
        rule: {
            inclusions: {
                operator: 'or',
                rules: [{ event_sources: ['PIXEL_ID'], retention_seconds: 180 * 86400, filter: { operator: 'and', filters: [{ field: 'event', operator: 'eq', value: 'Lead' }] } }]
            }
        }
    },
    {
        name: 'HERMES — 📊 Tutti i Visitatori (180gg)',
        description: 'Tutti i visitatori di qualsiasi pagina (WordPress + Landing) negli ultimi 180 giorni. Base per Lookalike broad.',
        type: 'website',
        retention_days: 180,
        rule: {
            inclusions: {
                operator: 'or',
                rules: [{ event_sources: ['PIXEL_ID'], retention_seconds: 180 * 86400, filter: { operator: 'and', filters: [{ field: 'event', operator: 'eq', value: 'PageView' }] } }]
            }
        }
    },
    {
        name: 'HERMES — 🏆 Top 25% Tempo sul Sito (30gg)',
        description: 'Il 25% degli utenti che passa PIÙ tempo sul sito. Segnale di alto interesse — perfetto per Lookalike.',
        type: 'website',
        retention_days: 30,
        rule: {
            inclusions: {
                operator: 'or',
                rules: [{
                    event_sources: ['PIXEL_ID'],
                    retention_seconds: 30 * 86400,
                    filter: {
                        operator: 'and',
                        filters: [{ field: 'event', operator: 'eq', value: 'PageView' }]
                    }
                }]
            }
        }
    },
    {
        name: 'HERMES — 🔄 Lead Recenti (30gg) — Esclusione',
        description: 'Lead degli ultimi 30 giorni. Usare SEMPRE come esclusione nelle campagne di prospecting per non sprecare budget.',
        type: 'website',
        retention_days: 30,
        rule: {
            inclusions: {
                operator: 'or',
                rules: [{ event_sources: ['PIXEL_ID'], retention_seconds: 30 * 86400, filter: { operator: 'and', filters: [{ field: 'event', operator: 'eq', value: 'Lead' }] } }]
            }
        }
    },
]

const LOOKALIKE_AUDIENCES: AudienceDef[] = [
    {
        name: 'HERMES — LAL 1% — Lead (Italia)',
        description: 'Lookalike 1% basata su tutti i Lead degli ultimi 180 giorni. La tua audience più potente per prospecting.',
        type: 'lookalike',
        origin_audience_name: 'HERMES — ⭐ Lead Tutti (180gg)',
        ratio: 0.01,
        country: 'IT',
    },
    {
        name: 'HERMES — LAL 2% — Lead (Italia)',
        description: 'Lookalike 2% basata su Lead. Più ampia, buona per scaling.',
        type: 'lookalike',
        origin_audience_name: 'HERMES — ⭐ Lead Tutti (180gg)',
        ratio: 0.02,
        country: 'IT',
    },
    {
        name: 'HERMES — LAL 1% — Engaged Visitors (Italia)',
        description: 'Lookalike 1% basata su visitatori che hanno letto la pagina (ViewContent). Buona qualità a costo più basso.',
        type: 'lookalike',
        origin_audience_name: 'HERMES — 🟠 WARM — Visitatori Engaged (30gg)',
        ratio: 0.01,
        country: 'IT',
    },
    {
        name: 'HERMES — LAL 3% — Tutti i Visitatori (Italia)',
        description: 'Lookalike 3% broad basata su tutti i visitatori. Per testing e scaling aggressivo.',
        type: 'lookalike',
        origin_audience_name: 'HERMES — 📊 Tutti i Visitatori (180gg)',
        ratio: 0.03,
        country: 'IT',
    },
]

// ─── Main Execution ──────────────────────────────────────────────────────────

async function run() {
    console.log('🎯 HERMES Custom Audience Creator\n')
    console.log('═══════════════════════════════════════════\n')

    // 1. Get Meta credentials
    console.log('📡 Fetching Meta credentials from Supabase...')
    const { data: adsConn } = await supabase
        .from('connections')
        .select('credentials, config')
        .eq('provider', 'meta_ads')
        .eq('status', 'active')
        .limit(1)
        .single()

    if (!adsConn?.credentials?.access_token || !adsConn?.credentials?.ad_account_id) {
        console.error('❌ No active Meta Ads connection found in Supabase.')
        return
    }

    const { access_token, ad_account_id } = adsConn.credentials
    const adAccount = `act_${ad_account_id}`
    console.log(`   ✅ Ad Account: ${adAccount}`)

    // 2. Get Pixel ID  
    const { data: capiConn } = await supabase
        .from('connections')
        .select('credentials, config')
        .eq('provider', 'meta_capi')
        .eq('status', 'active')
        .limit(1)
        .single()

    const pixelId = capiConn?.config?.pixel_id || capiConn?.credentials?.pixel_id
    if (!pixelId) {
        console.error('❌ No Pixel ID found in CAPI connection.')
        return
    }
    console.log(`   ✅ Pixel ID: ${pixelId}\n`)

    // 3. Check existing audiences
    console.log('📋 Checking existing Custom Audiences...')
    const existingRes = await fetch(
        `https://graph.facebook.com/${META_API_VERSION}/${adAccount}/customaudiences?fields=name,id,subtype&limit=100&access_token=${access_token}`
    )
    const existingData = await existingRes.json()
    
    if (existingData.error) {
        console.error('❌ Error fetching audiences:', existingData.error.message)
        return
    }

    const existingNames = new Set((existingData.data || []).map((a: any) => a.name))
    console.log(`   Found ${existingData.data?.length || 0} existing audiences`)

    // Show existing HERMES audiences
    const hermesExisting = (existingData.data || []).filter((a: any) => a.name.includes('HERMES'))
    if (hermesExisting.length > 0) {
        console.log('   Existing HERMES audiences:')
        for (const a of hermesExisting) {
            console.log(`   - ${a.name} (subtype: ${a.subtype})`)
        }
    }
    console.log('')

    // 4. Create Website Custom Audiences
    console.log('🌐 Creating Website Custom Audiences...\n')
    const createdAudiences: Record<string, string> = {} // name -> id

    for (const aud of WEBSITE_AUDIENCES) {
        if (existingNames.has(aud.name)) {
            console.log(`   ⏭️  SKIP: "${aud.name}" (already exists)`)
            // Find its ID for lookalike creation
            const existing = (existingData.data || []).find((a: any) => a.name === aud.name)
            if (existing) createdAudiences[aud.name] = existing.id
            continue
        }

        // Rule already prepared above, skip old payload construction

        try {
            const params = new URLSearchParams()
            params.set('name', aud.name)
            params.set('description', aud.description)
            // NOTE: Do NOT set 'subtype' — it's deprecated in v21.0+
            // The audience type is inferred from the 'rule' structure
            params.set('retention_days', String(aud.retention_days))
            params.set('prefill', 'true')
            params.set('access_token', access_token)

            // Special handling for Top 25% time on site
            if (aud.name.includes('Top 25%')) {
                const percentileRule = {
                    inclusions: {
                        operator: 'or',
                        rules: [{
                            event_sources: [{ type: 'pixel', id: pixelId }],
                            retention_seconds: 30 * 86400,
                            filter: {
                                operator: 'and',
                                filters: [{ field: 'event', operator: 'eq', value: 'PageView' }]
                            },
                            aggregation: { type: 'time_spent', method: 'PERCENTILE', operator: 'IN_RANGE', from: 75, to: 100 }
                        }]
                    }
                }
                params.set('rule', JSON.stringify(percentileRule))
            } else {
                // Fix: event_sources must be array of objects with type+id, not plain strings
                const fixedRule = JSON.parse(
                    JSON.stringify(aud.rule).replace(/"PIXEL_ID"/g, JSON.stringify({ type: 'pixel', id: pixelId }))
                )
                // Wrap event_sources in arrays properly
                const ruleStr = JSON.stringify(fixedRule)
                params.set('rule', ruleStr)
            }

            const res = await fetch(
                `https://graph.facebook.com/${META_API_VERSION}/${adAccount}/customaudiences`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: params.toString(),
                }
            )
            const result = await res.json()

            if (result.error) {
                console.log(`   ❌ FAIL: "${aud.name}"`)
                console.log(`      Error: ${result.error.message}`)
                if (result.error.error_user_msg) console.log(`      Detail: ${result.error.error_user_msg}`)
                if (result.error.error_subcode) console.log(`      Subcode: ${result.error.error_subcode}`)
            } else {
                console.log(`   ✅ CREATED: "${aud.name}" (ID: ${result.id})`)
                createdAudiences[aud.name] = result.id
            }
        } catch (err: any) {
            console.log(`   ❌ ERROR: "${aud.name}" — ${err.message}`)
        }
    }

    console.log('')

    // 5. Create Lookalike Audiences
    console.log('👥 Creating Lookalike Audiences...\n')

    for (const lal of LOOKALIKE_AUDIENCES) {
        if (existingNames.has(lal.name)) {
            console.log(`   ⏭️  SKIP: "${lal.name}" (already exists)`)
            continue
        }

        // Find the origin audience ID
        const originId = createdAudiences[lal.origin_audience_name!]
        if (!originId) {
            console.log(`   ⚠️  SKIP: "${lal.name}" — origin audience "${lal.origin_audience_name}" not found/created yet`)
            continue
        }

        try {
            const payload = {
                name: lal.name,
                description: lal.description,
                subtype: 'LOOKALIKE',
                origin_audience_id: originId,
                lookalike_spec: JSON.stringify({
                    type: 'similarity',
                    country: lal.country || 'IT',
                    ratio: lal.ratio || 0.01,
                    starting_ratio: 0,
                }),
                access_token,
            }

            const res = await fetch(
                `https://graph.facebook.com/${META_API_VERSION}/${adAccount}/customaudiences`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                }
            )
            const result = await res.json()

            if (result.error) {
                console.log(`   ❌ FAIL: "${lal.name}"`)
                console.log(`      Error: ${result.error.message}`)
                // Common: origin audience too small for lookalike
                if (result.error.message.includes('too small') || result.error.message.includes('not enough')) {
                    console.log(`      💡 L'audience sorgente è troppo piccola. Aspetta che accumuli più dati dal Pixel.`)
                }
            } else {
                console.log(`   ✅ CREATED: "${lal.name}" (ID: ${result.id})`)
                createdAudiences[lal.name] = result.id
            }
        } catch (err: any) {
            console.log(`   ❌ ERROR: "${lal.name}" — ${err.message}`)
        }
    }

    console.log('\n═══════════════════════════════════════════')
    console.log(`\n📊 Riepilogo: ${Object.keys(createdAudiences).length} audience totali\n`)
    
    for (const [name, id] of Object.entries(createdAudiences)) {
        console.log(`  • ${name}`)
        console.log(`    ID: ${id}`)
    }

    console.log('\n═══════════════════════════════════════════')
    console.log('\n💡 PROSSIMI PASSI:')
    console.log('  1. Le audience di retargeting (🔥 HOT, 🟠 WARM, 🟡 COLD) si popoleranno')
    console.log('     automaticamente con i dati del Pixel.')
    console.log('  2. Le Lookalike potrebbero richiedere qualche ora per essere pronte.')
    console.log('  3. Se vuoi caricare la lista email clienti, rilancia con:')
    console.log('     npx tsx scripts/upload_customer_list.ts')
    console.log('')
}

run().catch(console.error)
