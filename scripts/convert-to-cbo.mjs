// Convert Andromeda from ABO to CBO
// 1. Archive old ABO campaign
// 2. Create new CBO campaign with daily_budget at campaign level
// 3. Re-create ad sets WITHOUT daily_budget/bid_strategy
// 4. Re-create ads reusing existing image hashes + copy

import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'
import { createClient } from '@supabase/supabase-js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')

const SUPABASE_URL = 'https://bktiuhxenxwhkgvdaxnp.supabase.co'
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_KEY) { console.error('❌ Set SUPABASE_SERVICE_ROLE_KEY'); process.exit(1) }

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)
const META_API = 'https://graph.facebook.com/v21.0'
const PAGE_ID = '108451268302248'
const INSTAGRAM_USER_ID = '17841449195220971'
const PIXEL_ID = '311586900940615'
const LANDING_URL = 'https://landing.metodosincro.com/f/metodo-sincro'
const URL_TAGS = 'utm_source=facebook&utm_medium=paid&utm_campaign={{campaign.name}}&utm_term={{adset.name}}&utm_content={{ad.name}}&fbadid={{ad.id}}'
const OLD_CAMPAIGN_IDS = ['120242756003400047', '120242756175840047'] // ABO + failed CBO
const RESUME_CAMPAIGN_ID = process.argv.find(a => a.startsWith('--campaign='))?.split('=')[1]

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

// Targeting
const targeting = {
    geo_locations: { countries: ['IT'] },
    age_min: 38,
    age_max: 65,
    locales: [10],
    flexible_spec: [
        {
            interests: [
                { id: '6003107902433', name: 'Calcio (calcio)' },
                { id: '6003332764437', name: 'Genitori' },
                { id: '6003051822645', name: 'Coaching (istruzione)' },
                { id: '6003748928462', name: 'Sviluppo personale' },
            ],
        },
    ],
    genders: [0],
    publisher_platforms: ['facebook', 'instagram'],
    targeting_automation: { advantage_audience: 0 },
}

async function main() {
    console.log('🔄 ANDROMEDA — Converting ABO → CBO')
    console.log('━'.repeat(60))

    // Get token
    const { data: conn } = await supabase
        .from('connections').select('credentials')
        .eq('provider', 'meta_ads').eq('status', 'active').single()
    const TOKEN = conn.credentials.access_token
    const AD_ACCOUNT = `act_${conn.credentials.ad_account_id}`
    console.log(`✅ Token OK. Ad Account: ${AD_ACCOUNT}`)

    // Step 1: Get existing ads from old campaign (to extract creative IDs)
    console.log('\n📋 Step 1: Fetching existing ad set + ad data from old campaign...')
    const oldAdSets = await metaGet(`${OLD_CAMPAIGN_IDS[0]}/adsets`, TOKEN, {
        fields: 'id,name',
        limit: '20',
    })
    
    // For each old ad set, get the ads and their creative IDs
    const adSetData = []
    for (const oldAdSet of (oldAdSets.data || [])) {
        const ads = await metaGet(`${oldAdSet.id}/ads`, TOKEN, {
            fields: 'id,name,creative{id}',
            limit: '10',
        })
        adSetData.push({
            name: oldAdSet.name,
            ads: (ads.data || []).map(a => ({
                name: a.name,
                creativeId: a.creative?.id,
            })),
        })
        console.log(`  📦 ${oldAdSet.name}: ${(ads.data || []).length} ads`)
    }

    // Step 2: Archive old campaigns
    console.log('\n🗑️ Step 2: Archiving old campaigns...')
    for (const oldId of OLD_CAMPAIGN_IDS) {
        try {
            await metaPost(oldId, TOKEN, { status: 'PAUSED' })
            await metaPost(oldId, TOKEN, { status: 'ARCHIVED' })
            console.log(`  ✅ Archived: ${oldId}`)
        } catch (e) {
            console.log(`  ⚠️ ${oldId}: ${e.message} (may already be archived)`)
        }
    }

    // Step 3: Create or resume CBO campaign
    let campaignId
    if (RESUME_CAMPAIGN_ID) {
        campaignId = RESUME_CAMPAIGN_ID
        console.log(`\n⏭️ Step 3: Resuming CBO campaign: ${campaignId}`)
    } else {
        console.log('\n🚀 Step 3: Creating CBO campaign (€300/day)...')
        const campaign = await metaPost(`${AD_ACCOUNT}/campaigns`, TOKEN, {
            name: 'MS - Lead Gen - Andromeda',
            objective: 'OUTCOME_LEADS',
            status: 'PAUSED',
            special_ad_categories: ['NONE'],
            daily_budget: 30000, // €300/day at campaign level = CBO
            bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
        })
        campaignId = campaign.id
        console.log(`  ✅ CBO Campaign: ${campaignId}`)
    }

    // Step 4: Create ad sets WITHOUT budget (CBO distributes)
    console.log('\n🎯 Step 4: Creating 10 CBO ad sets (no individual budget)...')
    const newAdSetMap = {} // oldName -> newId

    for (const oldAS of adSetData) {
        const adSet = await metaPost(`${AD_ACCOUNT}/adsets`, TOKEN, {
            name: oldAS.name,
            campaign_id: campaignId,
            billing_event: 'IMPRESSIONS',
            optimization_goal: 'OFFSITE_CONVERSIONS',
            targeting: targeting,
            promoted_object: { pixel_id: PIXEL_ID, custom_event_type: 'LEAD' },
            status: 'PAUSED',
        })
        newAdSetMap[oldAS.name] = adSet.id
        console.log(`  ✅ ${oldAS.name} → ${adSet.id}`)
    }

    // Step 5: Create ads reusing existing creative IDs
    console.log('\n🎨 Step 5: Creating ads with existing creatives...')
    let adCount = 0
    for (const oldAS of adSetData) {
        const newAdSetId = newAdSetMap[oldAS.name]
        for (const ad of oldAS.ads) {
            if (!ad.creativeId) continue
            await metaPost(`${AD_ACCOUNT}/ads`, TOKEN, {
                name: ad.name,
                adset_id: newAdSetId,
                creative: { creative_id: ad.creativeId },
                status: 'PAUSED',
            })
            adCount++
            console.log(`  ✅ ${ad.name}`)
        }
    }

    // Step 6: Verify
    console.log('\n🔍 Step 6: Verifying...')
    // Check campaign has CBO budget
    const campDetails = await metaGet(campaignId, TOKEN, { fields: 'daily_budget,name' })
    console.log(`  Campaign budget: €${(campDetails.daily_budget / 100).toFixed(0)}/day ✅`)
    
    let allOk = true
    for (const [name, id] of Object.entries(newAdSetMap)) {
        const details = await metaGet(id, TOKEN, { fields: 'targeting,optimization_goal,daily_budget' })
        const t = details.targeting || {}
        const noBudget = !details.daily_budget // CBO ad sets should NOT have their own budget
        const checks = {
            age_38: t.age_min === 38,
            age_65: t.age_max === 65,
            it: JSON.stringify(t.geo_locations?.countries) === '["IT"]',
            opt: details.optimization_goal === 'OFFSITE_CONVERSIONS',
            cbo: noBudget,
        }
        const passed = Object.values(checks).every(Boolean)
        if (!passed) { allOk = false; console.log(`  ❌ ${name}: FAILED`, checks) }
        else { console.log(`  ✅ ${name}: CBO ✓ targeting ✓`) }
    }

    if (!allOk) {
        console.error('\n⚠️ VERIFICATION FAILED — campaign left PAUSED')
        return
    }

    // Step 7: Activate
    console.log('\n🟢 Step 7: Activating CBO campaign...')
    await metaPost(campaignId, TOKEN, { status: 'ACTIVE' })
    for (const id of Object.values(newAdSetMap)) {
        await metaPost(id, TOKEN, { status: 'ACTIVE' })
    }

    console.log('\n' + '━'.repeat(60))
    console.log('🎉 ANDROMEDA CBO — LIVE!')
    console.log(`   📋 1 Campagna CBO €300/gg (budget a livello campagna)`)
    console.log(`   🎯 10 Ad Set (senza budget individuale — CBO distribuisce)`)
    console.log(`   🎨 ${adCount} Ads`)
    console.log('   ✅ Età: 38-65 | Lingua: IT | OFFSITE_CONVERSIONS')
    console.log('━'.repeat(60))
    console.log(`\nCampaign ID: ${campaignId}`)
    for (const [name, id] of Object.entries(newAdSetMap)) {
        console.log(`  ${name}: ${id}`)
    }
}

main().catch(err => { console.error('❌ Fatal:', err.message); process.exit(1) })
