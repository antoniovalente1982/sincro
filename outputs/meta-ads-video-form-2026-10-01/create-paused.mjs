// Crea campagna, adset, 6 video, creatività e annunci IN PAUSA. Idempotente: riprende da CREATED_OBJECTS.json.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { out, account, pixel, db, graph, save } from './meta-client.mjs';

const cfg = JSON.parse(fs.readFileSync(path.join(out, 'CAMPAGNA.json')));
const src = JSON.parse(fs.readFileSync(path.join(out, 'SOURCE_CAMPAIGN_READ.json')));
const videoDir = path.join(process.env.HOME, 'Desktop', 'Video ads meta per claude');
const statePath = path.join(out, 'CREATED_OBJECTS.json');
const state = fs.existsSync(statePath) ? JSON.parse(fs.readFileSync(statePath)) : { created_at: new Date().toISOString(), campaign: null, adset: null, ads: [] };
const persist = () => save('CREATED_OBJECTS.json', state);

// Controlli preliminari
assert.equal(cfg.ads.length, 6)
assert.equal(cfg.daily_budget_cents, 10000)
const { data: tags, error } = await db.from('funnel_routing_engine').select('trigger_keyword')
if (error) throw new Error(error.message)
for (const ad of cfg.ads) {
    assert(tags.some(t => t.trigger_keyword === ad.trigger), 'tag mancante ' + ad.trigger)
    assert(ad.ad_name.endsWith('T: ' + ad.trigger))
    assert(fs.existsSync(path.join(videoDir, ad.file)), 'video mancante ' + ad.file)
}
const sourceAdset = src.matching_campaigns[0].adsets.find(a => a.id === cfg.source_adset_id)
assert(sourceAdset, 'adset sorgente non trovato')

// Pubblico: copia dell'adset sorgente + gruppo genitori (AND con gli altri gruppi)
const { targeting: t } = sourceAdset
const targeting = {
    age_min: t.age_min, age_max: t.age_max,
    geo_locations: t.geo_locations, locales: t.locales,
    flexible_spec: [...t.flexible_spec, { family_statuses: cfg.parents_group.map(({ id }) => ({ id })) }],
    brand_safety_content_filter_levels: t.brand_safety_content_filter_levels,
    targeting_automation: t.targeting_automation,
    publisher_platforms: t.publisher_platforms, facebook_positions: t.facebook_positions,
    // "explore_home" richiede anche "explore" (errore Meta 2490392 sull'adset sorgente copiato)
    instagram_positions: [...new Set([...t.instagram_positions, 'explore'])], device_platforms: t.device_platforms,
}

if (!state.campaign) {
    const existing = await graph(account + '/campaigns', { fields: 'id,name', limit: 200 })
    assert(!existing.data.some(c => c.name === cfg.campaign_name), 'Esiste già una campagna con questo nome')
    const payload = { name: cfg.campaign_name, objective: 'OUTCOME_LEADS', buying_type: 'AUCTION', status: 'PAUSED', special_ad_categories: [], is_adset_budget_sharing_enabled: false }
    state.campaign = { ...await graph(account + '/campaigns', payload, 'POST'), requested: payload }; persist()
    console.log('campaign PAUSED', state.campaign.id)
}

if (!state.adset) {
    const payload = {
        name: cfg.adset_name, campaign_id: state.campaign.id, status: 'PAUSED',
        daily_budget: cfg.daily_budget_cents, bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
        billing_event: 'IMPRESSIONS', optimization_goal: 'OFFSITE_CONVERSIONS', destination_type: 'WEBSITE',
        promoted_object: { pixel_id: pixel, custom_event_type: 'LEAD' },
        attribution_spec: sourceAdset.attribution_spec,
        start_time: cfg.start_time,
        dsa_beneficiary: sourceAdset.dsa_beneficiary, dsa_payor: sourceAdset.dsa_payor,
        targeting,
    }
    state.adset = { ...await graph(account + '/adsets', payload, 'POST'), requested: payload }; persist()
    console.log('adset PAUSED', state.adset.id)
}

// Upload multipart per video e immagini (il client JSON non gestisce i file)
async function upload(endpoint, fields, filePath, fileField) {
    const { credentials } = (await db.from('connections').select('credentials').eq('organization_id', 'a5dd4842-f0ea-4909-b4a3-be2cb1c6ffa5').eq('provider', 'meta_ads').eq('status', 'active').single()).data
    const form = new FormData()
    for (const [k, v] of Object.entries(fields)) form.append(k, v)
    form.append(fileField, new Blob([fs.readFileSync(filePath)]), path.basename(filePath))
    const res = await fetch('https://graph.facebook.com/v21.0/' + endpoint, { method: 'POST', headers: { Authorization: 'Bearer ' + credentials.access_token }, body: form })
    const data = await res.json()
    if (data.error) throw new Error(JSON.stringify({ endpoint, message: data.error.message, user_message: data.error.error_user_msg }))
    return data
}

// Funzioni creative da tenere fisse: Meta non deve riscrivere testi o modificare il video
const optOut = keys => Object.fromEntries(keys.map(k => [k, { enroll_status: 'OPT_OUT' }]))
const featureSets = [
    ['adapt_to_placement', 'add_text_overlay', 'audio', 'description_automation', 'enhance_cta', 'inline_comment', 'site_extensions', 'text_optimizations', 'text_translation', 'video_auto_crop'],
    ['enhance_cta', 'inline_comment', 'text_optimizations'],
]

for (const ad of cfg.ads) {
    let item = state.ads.find(x => x.code === ad.code)
    if (!item) { item = { code: ad.code, file: ad.file }; state.ads.push(item); persist() }
    const file = path.join(videoDir, ad.file)

    if (!item.video_id) {
        const data = await upload(account + '/advideos', { name: `MS ${ad.code} ${ad.file}`, title: `MS ${ad.code} ${ad.theme}` }, file, 'source')
        item.video_id = data.id; persist(); console.log('video caricato', ad.code, data.id)
    }
    if (!item.thumb_hash) {
        const thumb = path.join(out, `thumb-${ad.code}.jpg`)
        execFileSync('ffmpeg', ['-v', 'error', '-y', '-ss', '1', '-i', file, '-frames:v', '1', '-q:v', '2', thumb])
        const data = await upload(account + '/adimages', {}, thumb, 'filename')
        item.thumb_hash = Object.values(data.images)[0].hash; persist(); console.log('copertina caricata', ad.code)
    }
    // Il video deve essere elaborato prima di creare il creativo
    for (let i = 0; i < 60; i++) {
        const v = await graph(item.video_id, { fields: 'status' })
        item.video_status = v.status?.video_status
        if (item.video_status === 'ready') break
        if (item.video_status === 'error') throw new Error('elaborazione video fallita ' + ad.code)
        await new Promise(r => setTimeout(r, 10000))
    }
    assert.equal(item.video_status, 'ready', 'video non pronto ' + ad.code)

    if (!item.creative_id) {
        const base = {
            name: `MS Video ${ad.code} ${ad.theme}`,
            object_story_spec: {
                page_id: cfg.page_id, instagram_user_id: cfg.instagram_user_id,
                video_data: {
                    video_id: item.video_id, image_hash: item.thumb_hash,
                    message: ad.body, title: ad.headline, link_description: cfg.description,
                    call_to_action: { type: cfg.cta, value: { link: cfg.destination_url } },
                },
            },
            url_tags: cfg.url_tags,
        }
        let lastError
        for (const keys of [...featureSets, null]) {
            const payload = keys ? { ...base, degrees_of_freedom_spec: { creative_features_spec: optOut(keys) } } : base
            try {
                const result = await graph(account + '/adcreatives', payload, 'POST')
                item.creative_id = result.id; item.creative_requested = payload; item.creative_opt_out = keys; persist()
                console.log('creativo', ad.code, result.id, keys ? `opt-out ${keys.length}` : 'senza opt-out')
                break
            } catch (e) { lastError = e; console.log('tentativo creativo fallito', ad.code, String(e).slice(0, 300)) }
        }
        if (!item.creative_id) throw lastError
    }

    if (!item.ad_id) {
        const payload = { name: ad.ad_name, adset_id: state.adset.id, status: 'PAUSED', creative: { creative_id: item.creative_id }, tracking_specs: [{ 'action.type': ['offsite_conversion'], fb_pixel: [pixel] }] }
        const result = await graph(account + '/ads', payload, 'POST')
        item.ad_id = result.id; persist(); console.log('annuncio PAUSED', ad.code, result.id)
    }
}
state.completed_at = new Date().toISOString(); persist()
console.log('COMPLETATO: campagna, adset e 6 annunci IN PAUSA')
