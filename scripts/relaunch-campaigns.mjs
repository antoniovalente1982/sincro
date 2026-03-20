// Relaunch Meta Ads Campaigns with corrected parameters
// Step 1: Fetch Meta token from Supabase
// Step 2: List & delete existing campaigns
// Step 3: Relaunch with corrected targeting, UTM, optimization

import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'
import { createClient } from '@supabase/supabase-js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')

const SUPABASE_URL = 'https://bktiuhxenxwhkgvdaxnp.supabase.co'
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const SKIP_CLEANUP = process.argv.includes('--skip-cleanup')
const RESUME_FROM_ADSETS = process.argv.includes('--resume-from-adsets')
if (!SUPABASE_KEY) {
    console.error('❌ Set SUPABASE_SERVICE_ROLE_KEY env var')
    process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

const META_API = 'https://graph.facebook.com/v21.0'
const PAGE_ID = '108451268302248'
const INSTAGRAM_USER_ID = '17841449195220971'
const PIXEL_ID = '311586900940615'
const LANDING_URL = 'https://landing.metodosincro.com/f/metodo-sincro'
const URL_TAGS = 'utm_source=facebook&utm_medium=paid&utm_campaign={{campaign.name}}&utm_term={{adset.name}}&utm_content={{ad.name}}&fbadid={{ad.id}}'

// ─── HELPERS ───
async function metaPost(endpoint, token, body) {
    const res = await fetch(`${META_API}/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...body, access_token: token }),
    })
    const data = await res.json()
    if (data.error) {
        console.error(`❌ Meta API error at ${endpoint}:`, JSON.stringify(data.error, null, 2))
        throw new Error(data.error.message)
    }
    return data
}

async function metaGet(endpoint, token, params = {}) {
    const qs = new URLSearchParams({ ...params, access_token: token }).toString()
    const res = await fetch(`${META_API}/${endpoint}?${qs}`)
    return res.json()
}

async function metaDelete(endpoint, token) {
    const res = await fetch(`${META_API}/${endpoint}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ access_token: token }),
    })
    return res.json()
}

async function uploadImageBase64(adAccount, token, base64, name) {
    const res = await fetch(`${META_API}/${adAccount}/adimages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ access_token: token, bytes: base64, name }),
    })
    const data = await res.json()
    if (data.error) {
        console.error(`❌ Upload ${name}:`, data.error.message)
        return null
    }
    const images = data.images || {}
    const firstKey = Object.keys(images)[0]
    const hash = images[firstKey]?.hash
    console.log(`  ✅ ${name} → hash: ${hash}`)
    return hash
}

// ─── TARGETING (CORRECTED — PREFLIGHT RULES) ───
const targetingCalcio = {
    geo_locations: { countries: ['IT'] },
    age_min: 38,
    age_max: 65,
    locales: [10],
    flexible_spec: [
        {
            interests: [
                { id: '6003107902433', name: 'Calcio (calcio)' },
                { id: '6003332764437', name: 'Genitori' },
                { id: '6004087957374', name: 'Preparazione atletica' },
            ],
        },
    ],
    publisher_platforms: ['facebook', 'instagram'],
    targeting_automation: { advantage_audience: 0 },
}

const targetingMentale = {
    geo_locations: { countries: ['IT'] },
    age_min: 38,
    age_max: 65,
    locales: [10],
    flexible_spec: [
        {
            interests: [
                { id: '6003051822645', name: 'Coaching (istruzione)' },
                { id: '6003748928462', name: 'Sviluppo personale' },
                { id: '6004087957374', name: 'Preparazione atletica' },
            ],
        },
    ],
    publisher_platforms: ['facebook', 'instagram'],
    targeting_automation: { advantage_audience: 0 },
}

// ─── AD COPY ───
const adCopyPain = {
    message: `⚽ L'ansia da prestazione sta frenando tuo figlio?\n\nIl talento non basta. L'87% dei giovani calciatori talentuosi non emerge per mancanza di preparazione mentale.\n\n🧠 Il Mental Coaching di Metodo Sincro è il percorso specializzato per giovani calciatori che vogliono sbloccare il loro vero potenziale.\n\n✅ Online, personalizzato, risultati in 3 mesi\n✅ Usato da calciatori di Serie A, B e Lega Pro\n✅ Consulenza gratuita senza impegno\n\n👇 Richiedi ora la tua consulenza gratuita`,
    headline: 'Mental Coaching per Giovani Calciatori',
    description: 'Consulenza gratuita — Sblocca il potenziale di tuo figlio',
}

const adCopyTransform = {
    message: `⚽ Tuo figlio vale più di quello che dimostra in campo?\n\nIl gap tra talento e risultati è un problema MENTALE. Il Mental Coaching lo colma.\n\n🏆 Metodo Sincro ha aiutato calciatori di Serie A, B e Lega Pro a superare blocchi mentali, ansia da prestazione e paura dopo infortuni.\n\n✅ Percorso 100% online e personalizzato\n✅ Risultati misurabili in 3 mesi\n✅ Prima consulenza gratuita\n\n👇 Prenota la consulenza gratuita per tuo figlio`,
    headline: 'Da Panchina a Protagonista — Il Mental Coaching Funziona',
    description: 'Prenota una consulenza gratuita per tuo figlio',
}

// ─── IMAGE MAPPING ───
const painImages = [
    'hf_20260316_142053_6ea0055c-01d9-4318-8d12-26a96910513e.jpeg',
    'hf_20260316_142237_ee69b022-f9fb-4325-99c4-2b813a8031e1.jpeg',
    'hf_20260316_142141_8218549f-51b5-4ad0-9a66-deb95420efec.jpeg',
    'hf_20260316_142925_a411c61d-ef59-474a-94af-39c0b5761e50.jpeg',
]

const transformImages = [
    'hf_20260316_142546_762e5b3f-832a-4058-9706-226d1698e102.jpeg',
    'hf_20260316_143851_84601b30-7bd6-419e-9261-6ab3b5bc3a7a.jpeg',
    'hf_20260316_144015_248a46b0-443b-49af-8e8e-9712e00c13c4.jpeg',
    'hf_20260316_144704_c466e8b0-4a93-4628-838a-1fefbe15d79d.jpeg',
]

// ─── MAIN ───
async function main() {
    console.log('🔄 METODO SINCRO — Relaunch Campagne Meta Ads (CORRETTE)')
    console.log('━'.repeat(60))

    // ── Get Meta token from Supabase ──
    console.log('\n🔑 Step 0: Getting Meta token from Supabase...')
    const { data: conn, error: connErr } = await supabase
        .from('connections')
        .select('credentials')
        .eq('provider', 'meta_ads')
        .eq('status', 'active')
        .single()

    if (connErr || !conn?.credentials?.access_token) {
        console.error('❌ Cannot get Meta token from Supabase:', connErr?.message || 'No token found')
        process.exit(1)
    }

    const TOKEN = conn.credentials.access_token
    const AD_ACCOUNT = `act_${conn.credentials.ad_account_id}`
    console.log(`  ✅ Token retrieved. Ad Account: ${AD_ACCOUNT}`)

    // ── Step 1: List existing campaigns ──
    if (SKIP_CLEANUP) {
        console.log('\n⏭️ Step 1-3: Skipping cleanup (--skip-cleanup flag)')
    }
    if (!SKIP_CLEANUP) {
    console.log('\n📋 Step 1: Listing existing campaigns...')
    const existingCampaigns = await metaGet(`${AD_ACCOUNT}/campaigns`, TOKEN, {
        fields: 'id,name,status,daily_budget',
        limit: '50',
    })

    const msCount = (existingCampaigns.data || []).filter(c => c.name?.startsWith('MS -')).length
    console.log(`  Found ${(existingCampaigns.data || []).length} campaigns total, ${msCount} with "MS -" prefix`)

    for (const c of (existingCampaigns.data || [])) {
        console.log(`    ${c.status === 'ACTIVE' ? '🟢' : '⏸️'} [${c.id}] ${c.name} (${c.status})`)
    }

    // ── Step 2: Delete MS campaigns ──
    const msCampaigns = (existingCampaigns.data || []).filter(c => c.name?.startsWith('MS -'))
    if (msCampaigns.length > 0) {
        console.log(`\n🗑️ Step 2: Deleting ${msCampaigns.length} MS campaigns...`)
        for (const c of msCampaigns) {
            // First pause, then delete
            try {
                await metaPost(c.id, TOKEN, { status: 'PAUSED' })
                const delResult = await metaDelete(c.id, TOKEN)
                if (delResult.success) {
                    console.log(`  ✅ Deleted: ${c.name} (${c.id})`)
                } else {
                    console.log(`  ⚠️ Could not delete ${c.name}, will archive instead`)
                    await metaPost(c.id, TOKEN, { status: 'ARCHIVED' })
                    console.log(`  ✅ Archived: ${c.name}`)
                }
            } catch (e) {
                console.error(`  ❌ Error with ${c.name}:`, e.message)
            }
        }
    } else {
        console.log('\n✅ Step 2: No MS campaigns to delete')
    }

    } // end if !SKIP_CLEANUP (step 1-2)

    // ── Step 3: Upload images ──
    console.log('\n📸 Step 3: Uploading images to Meta...')
    const imageHashes = {}
    for (const filename of [...painImages, ...transformImages]) {
        try {
            const filePath = path.join(ROOT, 'data', 'ads_immagini', filename)
            const fileBuffer = fs.readFileSync(filePath)
            const base64 = fileBuffer.toString('base64')
            const hash = await uploadImageBase64(AD_ACCOUNT, TOKEN, base64, filename)
            if (hash) imageHashes[filename] = hash
        } catch (e) {
            console.error(`  ❌ Failed ${filename}:`, e.message)
        }
    }
    console.log(`  ✅ ${Object.keys(imageHashes).length}/8 images uploaded`)

    // ── Step 4: Create campaigns ──
    let campaign1Id, campaign2Id
    if (RESUME_FROM_ADSETS) {
        campaign1Id = '120242746794040047'
        campaign2Id = '120242746797720047'
        console.log(`\n⏭️ Step 4: Using existing campaigns: ${campaign1Id}, ${campaign2Id}`)
    } else {
    console.log('\n📋 Step 4: Creating campaigns (PAUSED)...')

    const campaign1 = await metaPost(`${AD_ACCOUNT}/campaigns`, TOKEN, {
        name: 'MS - Lead Immagini - Dolore',
        objective: 'OUTCOME_LEADS',
        status: 'PAUSED',
        special_ad_categories: ['NONE'],
        is_adset_budget_sharing_enabled: false,
    })
    campaign1Id = campaign1.id
    console.log(`  ✅ Campaign 1 (Dolore): ${campaign1Id}`)

    const campaign2 = await metaPost(`${AD_ACCOUNT}/campaigns`, TOKEN, {
        name: 'MS - Lead Immagini - Trasformazione',
        objective: 'OUTCOME_LEADS',
        status: 'PAUSED',
        special_ad_categories: ['NONE'],
        is_adset_budget_sharing_enabled: false,
    })
    campaign2Id = campaign2.id
    console.log(`  ✅ Campaign 2 (Trasformazione): ${campaign2Id}`)
    } // end else RESUME

    // ── Step 5: Create ad sets (CORRECTED PARAMS) ──
    console.log('\n🎯 Step 5: Creating ad sets (età 38-65, IT, OFFSITE_CONVERSIONS)...')

    const adSet1A = await metaPost(`${AD_ACCOUNT}/adsets`, TOKEN, {
        name: 'Genitori Calcio IT - Dolore',
        campaign_id: campaign1Id,
        daily_budget: 7500, // €75
        billing_event: 'IMPRESSIONS',
        optimization_goal: 'OFFSITE_CONVERSIONS',
        bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
        targeting: targetingCalcio,
        promoted_object: { pixel_id: PIXEL_ID, custom_event_type: 'LEAD' },
        status: 'PAUSED',
    })
    console.log(`  ✅ Ad Set 1A (Calcio-Dolore): ${adSet1A.id} — €75/gg`)

    const adSet1B = await metaPost(`${AD_ACCOUNT}/adsets`, TOKEN, {
        name: 'Genitori Sport Mentale - Dolore',
        campaign_id: campaign1Id,
        daily_budget: 7500, // €75
        billing_event: 'IMPRESSIONS',
        optimization_goal: 'OFFSITE_CONVERSIONS',
        bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
        targeting: targetingMentale,
        promoted_object: { pixel_id: PIXEL_ID, custom_event_type: 'LEAD' },
        status: 'PAUSED',
    })
    console.log(`  ✅ Ad Set 1B (Mentale-Dolore): ${adSet1B.id} — €75/gg`)

    const adSet2A = await metaPost(`${AD_ACCOUNT}/adsets`, TOKEN, {
        name: 'Genitori Calcio IT - Trasformazione',
        campaign_id: campaign2Id,
        daily_budget: 7500, // €75
        billing_event: 'IMPRESSIONS',
        optimization_goal: 'OFFSITE_CONVERSIONS',
        bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
        targeting: targetingCalcio,
        promoted_object: { pixel_id: PIXEL_ID, custom_event_type: 'LEAD' },
        status: 'PAUSED',
    })
    console.log(`  ✅ Ad Set 2A (Calcio-Trasf): ${adSet2A.id} — €75/gg`)

    const adSet2B = await metaPost(`${AD_ACCOUNT}/adsets`, TOKEN, {
        name: 'Genitori Sport Mentale - Trasformazione',
        campaign_id: campaign2Id,
        daily_budget: 7500, // €75
        billing_event: 'IMPRESSIONS',
        optimization_goal: 'OFFSITE_CONVERSIONS',
        bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
        targeting: targetingMentale,
        promoted_object: { pixel_id: PIXEL_ID, custom_event_type: 'LEAD' },
        status: 'PAUSED',
    })
    console.log(`  ✅ Ad Set 2B (Mentale-Trasf): ${adSet2B.id} — €75/gg`)

    // ── Step 6: Create ads ──
    console.log('\n🎨 Step 6: Creating ads with creatives...')
    let adCount = 0

    // Pain ads
    for (let i = 0; i < painImages.length; i++) {
        const hash = imageHashes[painImages[i]]
        if (!hash) continue

        const creative = await metaPost(`${AD_ACCOUNT}/adcreatives`, TOKEN, {
            name: `Dolore - Creative ${i + 1}`,
            object_story_spec: {
                page_id: PAGE_ID,
                instagram_user_id: INSTAGRAM_USER_ID,
                link_data: {
                    image_hash: hash,
                    link: LANDING_URL,
                    message: adCopyPain.message,
                    name: adCopyPain.headline,
                    description: adCopyPain.description,
                    call_to_action: { type: 'LEARN_MORE' },
                },
            },
            url_tags: URL_TAGS,
        })

        await metaPost(`${AD_ACCOUNT}/ads`, TOKEN, {
            name: `Dolore ${i + 1} - Calcio IT`,
            adset_id: adSet1A.id,
            creative: { creative_id: creative.id },
            status: 'PAUSED',
        })
        await metaPost(`${AD_ACCOUNT}/ads`, TOKEN, {
            name: `Dolore ${i + 1} - Sport Mentale`,
            adset_id: adSet1B.id,
            creative: { creative_id: creative.id },
            status: 'PAUSED',
        })
        adCount += 2
        console.log(`  ✅ Pain ad ${i + 1}: 2 ads created`)
    }

    // Transform ads
    for (let i = 0; i < transformImages.length; i++) {
        const hash = imageHashes[transformImages[i]]
        if (!hash) continue

        const creative = await metaPost(`${AD_ACCOUNT}/adcreatives`, TOKEN, {
            name: `Trasformazione - Creative ${i + 1}`,
            object_story_spec: {
                page_id: PAGE_ID,
                instagram_user_id: INSTAGRAM_USER_ID,
                link_data: {
                    image_hash: hash,
                    link: LANDING_URL,
                    message: adCopyTransform.message,
                    name: adCopyTransform.headline,
                    description: adCopyTransform.description,
                    call_to_action: { type: 'LEARN_MORE' },
                },
            },
            url_tags: URL_TAGS,
        })

        await metaPost(`${AD_ACCOUNT}/ads`, TOKEN, {
            name: `Trasformazione ${i + 1} - Calcio IT`,
            adset_id: adSet2A.id,
            creative: { creative_id: creative.id },
            status: 'PAUSED',
        })
        await metaPost(`${AD_ACCOUNT}/ads`, TOKEN, {
            name: `Trasformazione ${i + 1} - Sport Mentale`,
            adset_id: adSet2B.id,
            creative: { creative_id: creative.id },
            status: 'PAUSED',
        })
        adCount += 2
        console.log(`  ✅ Transform ad ${i + 1}: 2 ads created`)
    }

    // ── Step 7: Verify targeting before activating ──
    console.log('\n🔍 Step 7: Verifying targeting on ad sets...')
    let allCorrect = true
    for (const [name, id] of [
        ['1A', adSet1A.id], ['1B', adSet1B.id],
        ['2A', adSet2A.id], ['2B', adSet2B.id],
    ]) {
        const details = await metaGet(id, TOKEN, { fields: 'targeting,optimization_goal' })
        const t = details.targeting || {}
        const checks = {
            age_min: t.age_min === 38,
            age_max: t.age_max === 65,
            locales: JSON.stringify(t.locales) === '[10]',
            countries: JSON.stringify(t.geo_locations?.countries) === '["IT"]',
            optimization: details.optimization_goal === 'OFFSITE_CONVERSIONS',
        }
        const passed = Object.values(checks).every(Boolean)
        if (!passed) {
            allCorrect = false
            console.log(`  ❌ Ad Set ${name}: VERIFICATION FAILED`, checks)
        } else {
            console.log(`  ✅ Ad Set ${name}: all checks passed`)
        }
    }

    if (!allCorrect) {
        console.error('\n⚠️ SOME VERIFICATIONS FAILED — campaigns left PAUSED')
        console.log('Fix issues before activating manually')
        return
    }

    // ── Step 8: Activate ──
    console.log('\n🟢 Step 8: All verified. Activating campaigns...')
    for (const id of [campaign1Id, campaign2Id]) {
        await metaPost(id, TOKEN, { status: 'ACTIVE' })
    }
    for (const id of [adSet1A.id, adSet1B.id, adSet2A.id, adSet2B.id]) {
        await metaPost(id, TOKEN, { status: 'ACTIVE' })
    }

    console.log('\n' + '━'.repeat(60))
    console.log('🎉 RELAUNCH COMPLETATO!')
    console.log(`   📋 2 Campagne (Dolore + Trasformazione)`)
    console.log(`   🎯 4 Ad Set (€75/gg × 4 = €300/gg totale)`)
    console.log(`   🎨 ${adCount} Ads`)
    console.log('   ✅ Età: 38-65 | Lingua: IT | OFFSITE_CONVERSIONS')
    console.log('   ✅ UTM tags su tutte le creatives')
    console.log('   ✅ Instagram + Facebook placements')
    console.log('━'.repeat(60))
    console.log('\nIDs:')
    console.log(`Campaign 1 (Dolore):         ${campaign1Id}`)
    console.log(`Campaign 2 (Trasformazione): ${campaign2Id}`)
    console.log(`Ad Set 1A (Calcio-Dolore):   ${adSet1A.id}`)
    console.log(`Ad Set 1B (Mentale-Dolore):  ${adSet1B.id}`)
    console.log(`Ad Set 2A (Calcio-Trasf):    ${adSet2A.id}`)
    console.log(`Ad Set 2B (Mentale-Trasf):   ${adSet2B.id}`)
}

main().catch(err => {
    console.error('❌ Fatal error:', err.message)
    process.exit(1)
})
