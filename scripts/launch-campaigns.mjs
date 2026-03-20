// Meta Ads Campaign Launcher Script
// Run: node scripts/launch-campaigns.mjs

import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')

const META_API = 'https://graph.facebook.com/v21.0'

// Credentials from DB - Meta Ads connection
const TOKEN = process.env.META_TOKEN
const AD_ACCOUNT = 'act_511099830249139'
const PAGE_ID = '108451268302248'
const INSTAGRAM_USER_ID = '17841449195220971'
const PIXEL_ID = '311586900940615'
const LANDING_URL = 'https://landing.metodosincro.com/f/metodo-sincro'
const URL_TAGS = 'utm_source=facebook&utm_medium=paid&utm_campaign={{campaign.name}}&utm_term={{adset.name}}&utm_content={{ad.name}}&fbadid={{ad.id}}'

if (!TOKEN) {
    console.error('❌ Set META_TOKEN env var: META_TOKEN=<your_token> node scripts/launch-campaigns.mjs')
    process.exit(1)
}

// ─── HELPERS ───
async function metaPost(endpoint, body) {
    const res = await fetch(`${META_API}/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...body, access_token: TOKEN }),
    })
    const data = await res.json()
    if (data.error) {
        console.error(`❌ Meta API error at ${endpoint}:`, data.error.message)
        throw new Error(data.error.message)
    }
    return data
}

async function uploadImage(filename) {
    const filePath = path.join(ROOT, 'data', 'ads_immagini', filename)
    const fileBuffer = fs.readFileSync(filePath)
    const base64 = fileBuffer.toString('base64')

    const res = await fetch(`${META_API}/${AD_ACCOUNT}/adimages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            access_token: TOKEN,
            bytes: base64,
            name: filename,
        }),
    })
    const data = await res.json()
    if (data.error) {
        console.error(`❌ Upload ${filename}:`, data.error.message)
        return null
    }
    const images = data.images || {}
    const firstKey = Object.keys(images)[0]
    const hash = images[firstKey]?.hash
    console.log(`  ✅ ${filename} → hash: ${hash}`)
    return hash
}

// ─── TARGETING (MANUAL — NO ADVANTAGE+) ───
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
    console.log('🚀 METODO SINCRO — Lancio Campagne Meta Ads')
    console.log('━'.repeat(50))
    console.log(`Budget: €300/giorno | Targeting: Manuale (no Advantage+)`)
    console.log(`Landing: ${LANDING_URL}`)
    console.log(`Pixel: ${PIXEL_ID} | Page: ${PAGE_ID}`)
    console.log('━'.repeat(50))

    // ── STEP 1: Upload images ──
    console.log('\n📸 Step 1: Uploading images to Meta Ad Library...')
    const imageHashes = {}

    for (const filename of [...painImages, ...transformImages]) {
        const hash = await uploadImage(filename)
        if (hash) imageHashes[filename] = hash
    }

    const uploadedCount = Object.keys(imageHashes).length
    console.log(`\n✅ ${uploadedCount}/8 images uploaded\n`)

    if (uploadedCount === 0) {
        console.error('❌ No images uploaded. Check token permissions.')
        process.exit(1)
    }

    // ── STEP 2: Create Campaigns ──
    console.log('📋 Step 2: Creating campaigns...')

    const campaign1 = await metaPost(`${AD_ACCOUNT}/campaigns`, {
        name: 'MS - Lead Immagini - Dolore',
        objective: 'OUTCOME_LEADS',
        status: 'PAUSED',
        special_ad_categories: ['NONE'],
        is_adset_budget_sharing_enabled: false,
    })
    console.log(`  ✅ Campaign 1: ${campaign1.id} (Dolore)`)

    const campaign2 = await metaPost(`${AD_ACCOUNT}/campaigns`, {
        name: 'MS - Lead Immagini - Trasformazione',
        objective: 'OUTCOME_LEADS',
        status: 'PAUSED',
        special_ad_categories: ['NONE'],
        is_adset_budget_sharing_enabled: false,
    })
    console.log(`  ✅ Campaign 2: ${campaign2.id} (Trasformazione)`)

    // ── STEP 3: Create Ad Sets ──
    console.log('\n🎯 Step 3: Creating ad sets (manual targeting)...')

    const adSet1A = await metaPost(`${AD_ACCOUNT}/adsets`, {
        name: 'Genitori Calcio IT - Dolore',
        campaign_id: campaign1.id,
        daily_budget: 6000,
        billing_event: 'IMPRESSIONS',
        optimization_goal: 'OFFSITE_CONVERSIONS',
        bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
        targeting: targetingCalcio,
        promoted_object: { pixel_id: PIXEL_ID, custom_event_type: 'LEAD' },
        status: 'PAUSED',
    })
    console.log(`  ✅ Ad Set 1A: ${adSet1A.id} (Calcio IT - Dolore €60/gg)`)

    const adSet1B = await metaPost(`${AD_ACCOUNT}/adsets`, {
        name: 'Genitori Sport Mentale - Dolore',
        campaign_id: campaign1.id,
        daily_budget: 6000,
        billing_event: 'IMPRESSIONS',
        optimization_goal: 'OFFSITE_CONVERSIONS',
        bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
        targeting: targetingMentale,
        promoted_object: { pixel_id: PIXEL_ID, custom_event_type: 'LEAD' },
        status: 'PAUSED',
    })
    console.log(`  ✅ Ad Set 1B: ${adSet1B.id} (Sport Mentale - Dolore €60/gg)`)

    const adSet2A = await metaPost(`${AD_ACCOUNT}/adsets`, {
        name: 'Genitori Calcio IT - Trasformazione',
        campaign_id: campaign2.id,
        daily_budget: 6000,
        billing_event: 'IMPRESSIONS',
        optimization_goal: 'OFFSITE_CONVERSIONS',
        bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
        targeting: targetingCalcio,
        promoted_object: { pixel_id: PIXEL_ID, custom_event_type: 'LEAD' },
        status: 'PAUSED',
    })
    console.log(`  ✅ Ad Set 2A: ${adSet2A.id} (Calcio IT - Trasformazione €60/gg)`)

    const adSet2B = await metaPost(`${AD_ACCOUNT}/adsets`, {
        name: 'Genitori Sport Mentale - Trasformazione',
        campaign_id: campaign2.id,
        daily_budget: 6000,
        billing_event: 'IMPRESSIONS',
        optimization_goal: 'OFFSITE_CONVERSIONS',
        bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
        targeting: targetingMentale,
        promoted_object: { pixel_id: PIXEL_ID, custom_event_type: 'LEAD' },
        status: 'PAUSED',
    })
    console.log(`  ✅ Ad Set 2B: ${adSet2B.id} (Sport Mentale - Trasformazione €60/gg)`)

    // ── STEP 4: Create Ads ──
    console.log('\n🎨 Step 4: Creating ads with creatives...')

    let adCount = 0

    // Pain ads
    for (let i = 0; i < painImages.length; i++) {
        const hash = imageHashes[painImages[i]]
        if (!hash) continue

        const creative = await metaPost(`${AD_ACCOUNT}/adcreatives`, {
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

        await metaPost(`${AD_ACCOUNT}/ads`, {
            name: `Dolore ${i + 1} - Calcio IT`,
            adset_id: adSet1A.id,
            creative: { creative_id: creative.id },
            status: 'PAUSED',
        })

        await metaPost(`${AD_ACCOUNT}/ads`, {
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

        const creative = await metaPost(`${AD_ACCOUNT}/adcreatives`, {
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

        await metaPost(`${AD_ACCOUNT}/ads`, {
            name: `Trasformazione ${i + 1} - Calcio IT`,
            adset_id: adSet2A.id,
            creative: { creative_id: creative.id },
            status: 'PAUSED',
        })

        await metaPost(`${AD_ACCOUNT}/ads`, {
            name: `Trasformazione ${i + 1} - Sport Mentale`,
            adset_id: adSet2B.id,
            creative: { creative_id: creative.id },
            status: 'PAUSED',
        })

        adCount += 2
        console.log(`  ✅ Transform ad ${i + 1}: 2 ads created`)
    }

    // ── STEP 5: Activate everything ──
    console.log('\n🟢 Step 5: Activating campaigns...')

    for (const id of [campaign1.id, campaign2.id]) {
        await metaPost(id, { status: 'ACTIVE' })
    }
    for (const id of [adSet1A.id, adSet1B.id, adSet2A.id, adSet2B.id]) {
        await metaPost(id, { status: 'ACTIVE' })
    }

    console.log('\n' + '━'.repeat(50))
    console.log(`🎉 LANCIO COMPLETATO!`)
    console.log(`   📋 2 Campagne`)
    console.log(`   🎯 4 Ad Set (€60/gg ciascuno = €240/gg totali immagini)`)
    console.log(`   🎨 ${adCount} Ads`)
    console.log(`   💰 Budget: €240/giorno (€60 riservati per video reels)`)
    console.log('━'.repeat(50))
    console.log('\nIDs per monitoraggio:')
    console.log(`Campaign 1 (Dolore):          ${campaign1.id}`)
    console.log(`Campaign 2 (Trasformazione):  ${campaign2.id}`)
    console.log(`Ad Set 1A (Calcio-Dolore):    ${adSet1A.id}`)
    console.log(`Ad Set 1B (Mentale-Dolore):   ${adSet1B.id}`)
    console.log(`Ad Set 2A (Calcio-Trasf):     ${adSet2A.id}`)
    console.log(`Ad Set 2B (Mentale-Trasf):    ${adSet2B.id}`)
}

main().catch(err => {
    console.error('❌ Fatal error:', err.message)
    process.exit(1)
})
