import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
)

const META_API = 'https://graph.facebook.com/v21.0'

// ─── HELPERS ───
async function metaPost(endpoint: string, token: string, body: Record<string, any>) {
    const res = await fetch(`${META_API}/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...body, access_token: token }),
    })
    const data = await res.json()
    if (data.error) throw new Error(`Meta API: ${data.error.message}`)
    return data
}

async function metaGet(endpoint: string, token: string, params: Record<string, string> = {}) {
    const qs = new URLSearchParams({ ...params, access_token: token }).toString()
    const res = await fetch(`${META_API}/${endpoint}?${qs}`)
    return res.json()
}

// ─── Upload image by URL (ad images endpoint) ───
async function uploadImageByUrl(adAccount: string, token: string, imageUrl: string, name: string) {
    const formData = new FormData()
    formData.append('url', imageUrl)
    formData.append('name', name)
    formData.append('access_token', token)
    
    const res = await fetch(`${META_API}/${adAccount}/adimages`, {
        method: 'POST',
        body: formData,
    })
    const data = await res.json()
    if (data.error) throw new Error(`Upload image: ${data.error.message}`)
    // data.images.<filename>.hash
    const images = data.images || {}
    const firstKey = Object.keys(images)[0]
    return images[firstKey]?.hash || null
}

// ─── Upload image by base64 ───
async function uploadImageBase64(adAccount: string, token: string, base64: string, name: string) {
    const res = await fetch(`${META_API}/${adAccount}/adimages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            access_token: token,
            bytes: base64,
            name: name,
        }),
    })
    const data = await res.json()
    if (data.error) throw new Error(`Upload image base64: ${data.error.message}`)
    const images = data.images || {}
    const firstKey = Object.keys(images)[0]
    return images[firstKey]?.hash || null
}

// ─── MAIN ───
export async function POST(req: NextRequest) {
    try {
        // Auth check
        const authHeader = req.headers.get('authorization')
        if (!authHeader) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const userToken = authHeader.replace('Bearer ', '')
        const { data: { user } } = await supabaseAdmin.auth.getUser(userToken)
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { data: member } = await supabaseAdmin
            .from('organization_members')
            .select('organization_id, role')
            .eq('user_id', user.id)
            .single()

        if (!member || !['owner', 'admin'].includes(member.role)) {
            return NextResponse.json({ error: 'Only owner/admin can create campaigns' }, { status: 403 })
        }

        // Get Meta credentials
        const { data: conn } = await supabaseAdmin
            .from('connections')
            .select('credentials')
            .eq('organization_id', member.organization_id)
            .eq('provider', 'meta_ads')
            .eq('status', 'active')
            .single()

        if (!conn?.credentials?.access_token) {
            return NextResponse.json({ error: 'Meta Ads not connected' }, { status: 400 })
        }

        const { access_token, ad_account_id, page_id, pixel_id } = conn.credentials
        const adAccount = `act_${ad_account_id}`

        const body = await req.json()
        const { action } = body

        if (action === 'launch_strategy') {
            return await launchFullStrategy(adAccount, access_token, page_id, pixel_id, member.organization_id)
        }

        return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
    } catch (err: any) {
        console.error('Campaign creation error:', err)
        return NextResponse.json({ error: err.message || 'Failed' }, { status: 500 })
    }
}

async function launchFullStrategy(
    adAccount: string, 
    token: string, 
    pageId: string, 
    pixelId: string,
    orgId: string
) {
    const results: any = { campaigns: [], adSets: [], ads: [] }
    const LANDING_URL = 'https://landing.metodosincro.com/f/metodo-sincro'

    // ─── Targeting configs (MANUAL — NO Advantage+) ───
    const targetingCalcio = {
        geo_locations: { countries: ['IT'] },
        age_min: 30,
        age_max: 55,
        targeting_optimization: 'none',
        flexible_spec: [
            {
                interests: [
                    { id: '6003107902433', name: 'Association football' },  // Calcio
                    { id: '6003348229498', name: 'Serie A' },
                    { id: '6003012949498', name: 'Football player' },
                    { id: '6003384248987', name: 'Youth sport' },
                ],
            },
        ],
        family_statuses: [{ id: 3, name: 'Parents (All)' }],
        publisher_platforms: ['facebook', 'instagram'],
        facebook_positions: ['feed', 'video_feeds', 'story', 'reels'],
        instagram_positions: ['stream', 'story', 'reels', 'explore'],
    }

    const targetingMentale = {
        geo_locations: { countries: ['IT'] },
        age_min: 30,
        age_max: 55,
        targeting_optimization: 'none',
        flexible_spec: [
            {
                interests: [
                    { id: '6003139266461', name: 'Coaching' },
                    { id: '6003305411158', name: 'Sport psychology' },
                    { id: '6003384592981', name: 'Personal development' },
                    { id: '6003017847520', name: 'Performance' },
                ],
            },
        ],
        family_statuses: [{ id: 3, name: 'Parents (All)' }],
        publisher_platforms: ['facebook', 'instagram'],
        facebook_positions: ['feed', 'video_feeds', 'story', 'reels'],
        instagram_positions: ['stream', 'story', 'reels', 'explore'],
    }

    // ─── Ad copy variants ───
    const adCopyPain = {
        message: `⚽ L'ansia da prestazione sta frenando tuo figlio?\n\nIl talento non basta. L'87% dei giovani calciatori talentuosi non emerge per mancanza di preparazione mentale.\n\n🧠 Il Mental Coaching di Metodo Sincro è il percorso specializzato per giovani calciatori che vogliono sbloccare il loro vero potenziale.\n\n✅ Online, personalizzato, risultati in 3 mesi\n✅ Usato da calciatori di Serie A, B e Lega Pro\n✅ Consulenza gratuita senza impegno\n\n👇 Richiedi ora la tua consulenza gratuita`,
        headline: 'Mental Coaching per Giovani Calciatori',
        description: 'Consulenza gratuita — Sblocca il potenziale di tuo figlio',
        cta: 'LEARN_MORE',
    }

    const adCopyTransform = {
        message: `⚽ Tuo figlio vale più di quello che dimostra in campo?\n\nIl gap tra talento e risultati è un problema MENTALE. Il Mental Coaching lo colma.\n\n🏆 Metodo Sincro ha aiutato calciatori di Serie A, B e Lega Pro a superare blocchi mentali, ansia da prestazione e paura dopo infortuni.\n\n✅ Percorso 100% online e personalizzato\n✅ Risultati misurabili in 3 mesi\n✅ Prima consulenza gratuita\n\n👇 Prenota la consulenza gratuita per tuo figlio`,
        headline: 'Da Panchina a Protagonista — Il Mental Coaching Funziona',
        description: 'Prenota una consulenza gratuita per tuo figlio',
        cta: 'LEARN_MORE',
    }

    const adCopyVideo = {
        message: `⚽ Il segreto dei campioni? Non è solo talento.\n\nGuarda come il Mental Coaching trasforma giovani calciatori in protagonisti. Metodo Sincro è il percorso online specializzato usato da atleti di Serie A.\n\n👇 Consulenza gratuita — scopri come sbloccare tuo figlio`,
        headline: 'Mental Coaching — Il Vantaggio Invisibile',
        description: 'Consulenza gratuita per giovani calciatori',
        cta: 'LEARN_MORE',
    }

    // ─── Image file mapping ───
    const painImages = [
        'hf_20260316_142053_6ea0055c-01d9-4318-8d12-26a96910513e.jpeg', // ansia prestazione
        'hf_20260316_142237_ee69b022-f9fb-4325-99c4-2b813a8031e1.jpeg', // paura infortunio (art deco)
        'hf_20260316_142141_8218549f-51b5-4ad0-9a66-deb95420efec.jpeg', // stagione regalata
        'hf_20260316_142925_a411c61d-ef59-474a-94af-39c0b5761e50.jpeg', // 87%
    ]

    const transformImages = [
        'hf_20260316_142546_762e5b3f-832a-4058-9706-226d1698e102.jpeg', // before/after gap
        'hf_20260316_143851_84601b30-7bd6-419e-9261-6ab3b5bc3a7a.jpeg', // vale più di quello che dimostra
        'hf_20260316_144015_248a46b0-443b-49af-8e8e-9712e00c13c4.jpeg', // guarito paura (art deco)
        'hf_20260316_144704_c466e8b0-4a93-4628-838a-1fefbe15d79d.jpeg', // elimina ansia
    ]

    // ─── STEP 1: Upload images to Meta ───
    console.log('[Campaign] Uploading images to Meta...')
    const imageHashes: Record<string, string> = {}

    for (const filename of [...painImages, ...transformImages]) {
        try {
            const filePath = path.join(process.cwd(), 'data', 'ads_immagini', filename)
            const fileBuffer = fs.readFileSync(filePath)
            const base64 = fileBuffer.toString('base64')
            const hash = await uploadImageBase64(adAccount, token, base64, filename)
            if (hash) {
                imageHashes[filename] = hash
                console.log(`[Campaign] Uploaded ${filename} → hash: ${hash}`)
            }
        } catch (e: any) {
            console.error(`[Campaign] Failed to upload ${filename}:`, e.message)
        }
    }

    // ─── STEP 2: Create Campaign 1 — Pain ───
    console.log('[Campaign] Creating Campaign 1: Pain...')
    const campaign1 = await metaPost(`${adAccount}/campaigns`, token, {
        name: 'MS - Lead Immagini - Dolore',
        objective: 'OUTCOME_LEADS',
        status: 'PAUSED',
        special_ad_categories: [],
    })
    results.campaigns.push({ name: 'MS - Lead Immagini - Dolore', id: campaign1.id })

    // ─── STEP 3: Create Campaign 2 — Transformation ───
    console.log('[Campaign] Creating Campaign 2: Transformation...')
    const campaign2 = await metaPost(`${adAccount}/campaigns`, token, {
        name: 'MS - Lead Immagini - Trasformazione',
        objective: 'OUTCOME_LEADS',
        status: 'PAUSED',
        special_ad_categories: [],
    })
    results.campaigns.push({ name: 'MS - Lead Immagini - Trasformazione', id: campaign2.id })

    // ─── STEP 4: Create Campaign 3 — Video ───
    console.log('[Campaign] Creating Campaign 3: Video...')
    const campaign3 = await metaPost(`${adAccount}/campaigns`, token, {
        name: 'MS - Lead Video Reels',
        objective: 'OUTCOME_LEADS',
        status: 'PAUSED',
        special_ad_categories: [],
    })
    results.campaigns.push({ name: 'MS - Lead Video Reels', id: campaign3.id })

    // ─── STEP 5: Create Ad Sets ───
    console.log('[Campaign] Creating Ad Sets...')

    // Campaign 1 Ad Sets
    const adSet1A = await metaPost(`${adAccount}/adsets`, token, {
        name: 'Genitori Calcio IT - Dolore',
        campaign_id: campaign1.id,
        daily_budget: 6000, // €60 in cents
        billing_event: 'IMPRESSIONS',
        optimization_goal: 'LEAD_GENERATION',
        bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
        targeting: targetingCalcio,
        promoted_object: { pixel_id: pixelId, custom_event_type: 'LEAD' },
        status: 'PAUSED',
    })
    results.adSets.push({ name: 'Genitori Calcio IT - Dolore', id: adSet1A.id })

    const adSet1B = await metaPost(`${adAccount}/adsets`, token, {
        name: 'Genitori Sport Mentale - Dolore',
        campaign_id: campaign1.id,
        daily_budget: 6000,
        billing_event: 'IMPRESSIONS',
        optimization_goal: 'LEAD_GENERATION',
        bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
        targeting: targetingMentale,
        promoted_object: { pixel_id: pixelId, custom_event_type: 'LEAD' },
        status: 'PAUSED',
    })
    results.adSets.push({ name: 'Genitori Sport Mentale - Dolore', id: adSet1B.id })

    // Campaign 2 Ad Sets
    const adSet2A = await metaPost(`${adAccount}/adsets`, token, {
        name: 'Genitori Calcio IT - Trasformazione',
        campaign_id: campaign2.id,
        daily_budget: 6000,
        billing_event: 'IMPRESSIONS',
        optimization_goal: 'LEAD_GENERATION',
        bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
        targeting: targetingCalcio,
        promoted_object: { pixel_id: pixelId, custom_event_type: 'LEAD' },
        status: 'PAUSED',
    })
    results.adSets.push({ name: 'Genitori Calcio IT - Trasformazione', id: adSet2A.id })

    const adSet2B = await metaPost(`${adAccount}/adsets`, token, {
        name: 'Genitori Sport Mentale - Trasformazione',
        campaign_id: campaign2.id,
        daily_budget: 6000,
        billing_event: 'IMPRESSIONS',
        optimization_goal: 'LEAD_GENERATION',
        bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
        targeting: targetingMentale,
        promoted_object: { pixel_id: pixelId, custom_event_type: 'LEAD' },
        status: 'PAUSED',
    })
    results.adSets.push({ name: 'Genitori Sport Mentale - Trasformazione', id: adSet2B.id })

    // Campaign 3 Ad Set (Video)
    const adSet3 = await metaPost(`${adAccount}/adsets`, token, {
        name: 'Genitori Calcio IT - Video',
        campaign_id: campaign3.id,
        daily_budget: 6000,
        billing_event: 'IMPRESSIONS',
        optimization_goal: 'LEAD_GENERATION',
        bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
        targeting: targetingCalcio,
        promoted_object: { pixel_id: pixelId, custom_event_type: 'LEAD' },
        status: 'PAUSED',
    })
    results.adSets.push({ name: 'Genitori Calcio IT - Video', id: adSet3.id })

    // ─── STEP 6: Create Ads (Image) ───
    console.log('[Campaign] Creating Ads...')

    // Pain ads - Campaign 1 Ad Set A & B
    for (let i = 0; i < painImages.length; i++) {
        const hash = imageHashes[painImages[i]]
        if (!hash) continue

        const creative = await metaPost(`${adAccount}/adcreatives`, token, {
            name: `Dolore - Creative ${i + 1}`,
            object_story_spec: {
                page_id: pageId,
                instagram_user_id: '17841449195220971',
                link_data: {
                    image_hash: hash,
                    link: LANDING_URL,
                    message: adCopyPain.message,
                    name: adCopyPain.headline,
                    description: adCopyPain.description,
                    call_to_action: { type: adCopyPain.cta, value: { link: LANDING_URL } },
                },
            },
            url_tags: 'utm_source=facebook&utm_medium=paid&utm_campaign={{campaign.name}}&utm_term={{adset.name}}&utm_content={{ad.name}}&fbadid={{ad.id}}',
        })

        // Ad in Ad Set A
        const adA = await metaPost(`${adAccount}/ads`, token, {
            name: `Dolore ${i + 1} - Calcio IT`,
            adset_id: adSet1A.id,
            creative: { creative_id: creative.id },
            status: 'PAUSED',
        })
        results.ads.push({ name: `Dolore ${i + 1} - Calcio IT`, id: adA.id })

        // Ad in Ad Set B
        const adB = await metaPost(`${adAccount}/ads`, token, {
            name: `Dolore ${i + 1} - Sport Mentale`,
            adset_id: adSet1B.id,
            creative: { creative_id: creative.id },
            status: 'PAUSED',
        })
        results.ads.push({ name: `Dolore ${i + 1} - Sport Mentale`, id: adB.id })
    }

    // Transform ads - Campaign 2 Ad Set A & B
    for (let i = 0; i < transformImages.length; i++) {
        const hash = imageHashes[transformImages[i]]
        if (!hash) continue

        const creative = await metaPost(`${adAccount}/adcreatives`, token, {
            name: `Trasformazione - Creative ${i + 1}`,
            object_story_spec: {
                page_id: pageId,
                instagram_user_id: '17841449195220971',
                link_data: {
                    image_hash: hash,
                    link: LANDING_URL,
                    message: adCopyTransform.message,
                    name: adCopyTransform.headline,
                    description: adCopyTransform.description,
                    call_to_action: { type: adCopyTransform.cta, value: { link: LANDING_URL } },
                },
            },
            url_tags: 'utm_source=facebook&utm_medium=paid&utm_campaign={{campaign.name}}&utm_term={{adset.name}}&utm_content={{ad.name}}&fbadid={{ad.id}}',
        })

        // Ad in Ad Set A
        const adA = await metaPost(`${adAccount}/ads`, token, {
            name: `Trasformazione ${i + 1} - Calcio IT`,
            adset_id: adSet2A.id,
            creative: { creative_id: creative.id },
            status: 'PAUSED',
        })
        results.ads.push({ name: `Trasformazione ${i + 1} - Calcio IT`, id: adA.id })

        // Ad in Ad Set B
        const adB = await metaPost(`${adAccount}/ads`, token, {
            name: `Trasformazione ${i + 1} - Sport Mentale`,
            adset_id: adSet2B.id,
            creative: { creative_id: creative.id },
            status: 'PAUSED',
        })
        results.ads.push({ name: `Trasformazione ${i + 1} - Sport Mentale`, id: adB.id })
    }

    // ─── STEP 7: Activate all ───
    console.log('[Campaign] Activating campaigns...')
    for (const c of results.campaigns) {
        await metaPost(c.id, token, { status: 'ACTIVE' })
    }
    for (const as of results.adSets) {
        await metaPost(as.id, token, { status: 'ACTIVE' })
    }
    for (const ad of results.ads) {
        await metaPost(ad.id, token, { status: 'ACTIVE' })
    }

    // ─── STEP 8: Log in operations_log ───
    await supabaseAdmin.from('operations_log').insert({
        organization_id: orgId,
        action: 'campaigns_launched',
        category: 'ads',
        details: {
            campaigns: results.campaigns.length,
            ad_sets: results.adSets.length,
            ads: results.ads.length,
            daily_budget: 300,
            strategy: 'pain_vs_transformation_split_test',
        },
    })

    return NextResponse.json({
        success: true,
        message: `🚀 Lanciate ${results.campaigns.length} campagne, ${results.adSets.length} ad set, ${results.ads.length} ads`,
        results,
    })
}
