// Launch Andromeda Campaign — CBO €300/day, 10 Ad Sets × 2 Ads each
// Phase 1: Start with the v3 (3D CGI) + v4 (Cinematic) variants

import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'
import { createClient } from '@supabase/supabase-js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')

const SUPABASE_URL = 'https://bktiuhxenxwhkgvdaxnp.supabase.co'
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const SKIP_UPLOAD = process.argv.includes('--skip-upload')
const RESUME_CAMPAIGN_ID = process.argv.find(a => a.startsWith('--campaign-id='))?.split('=')[1]
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

async function uploadImageFile(adAccount, token, filePath, name) {
    const fileBuffer = fs.readFileSync(filePath)
    const base64 = fileBuffer.toString('base64')
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

// ─── TARGETING (broad — CBO will optimize) ───
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

// ─── 10 CLUSTERS — Images + Ad Copy ───
const ADS_DIR = path.join(ROOT, 'data', 'ads_andromeda')

const clusters = [
    {
        name: 'EDUCATION',
        buyerState: 'Curioso/Consapevole — TOFU',
        ads: [
            {
                file: 'v3_education_1774001807641.png',
                adName: 'Education A — Cervello Oro 3D',
                message: `⚽ Tuo figlio ha talento… ma non lo dimostra in campo?\n\nL'87% dei giovani calciatori si blocca per un PROBLEMA MENTALE che nessuno allena.\n\n🧠 Metodo Sincro® è il percorso di mental coaching #1 in Italia dedicato ai giovani calciatori.\n\n✅ Coach dedicato ONE-TO-ONE\n✅ 100% online, risultati in 3 mesi\n✅ 2.100+ famiglie trasformate • 4.9★ TrustPilot\n\n👇 Consulenza gratuita senza impegno`,
                headline: 'Il Talento È Solo Il 20%. Il Resto È Mente.',
                description: 'Consulenza gratuita — Metodo Sincro® per giovani calciatori',
            },
            {
                file: 'v4_education_1774002849900.png',
                adName: 'Education B — X-Ray Mente',
                message: `⚽ La tecnica c'è. Ma qualcosa blocca tuo figlio.\n\nNon è un problema fisico. È un muro MENTALE invisibile che frena il 90% dei giovani atleti.\n\n🧠 Con Metodo Sincro® i ragazzi imparano a gestire ansia, pressione e paura del giudizio.\n\n✅ Usato da calciatori di Serie A, B e Lega Pro\n✅ Percorso personalizzato al 100%\n✅ Primo incontro GRATUITO\n\n👇 Prenota la consulenza gratuita`,
                headline: "La Tecnica C'è. La Mente Blocca.",
                description: 'Mental coaching per sbloccare il potenziale di tuo figlio',
            },
        ],
    },
    {
        name: 'EMOTIONAL',
        buyerState: 'Sovraccarico/Stressato — MOFU',
        ads: [
            {
                file: 'v3_emotional_1774001820791.png',
                adName: 'Emotional A — Scarpe Fango 3D',
                message: `⚽ Lo conosci quel silenzio in macchina dopo la partita?\n\nQuando vedi tuo figlio soffrire per lo sport che ama, il cuore di un genitore si spezza.\n\n🧠 Metodo Sincro® non lavora solo con il ragazzo — supporta TUTTA la famiglia nel percorso.\n\n✅ Risultati visibili in 30 giorni\n✅ 9 genitori su 10 notano un cambiamento positivo\n✅ Consulenza gratuita, zero impegno\n\n👇 Fai il primo passo per lui`,
                headline: 'Quel Silenzio Dopo La Partita. Tu Lo Conosci.',
                description: 'Il primo passo per cambiare tutto — Consulenza gratuita',
            },
            {
                file: 'v4_emotional_1774002865914.png',
                adName: 'Emotional B — Silenzio Macchina',
                message: `⚽ "Papà, non mi diverto più."\n\nSe hai sentito questa frase, sai che il problema NON è il calcio. È qualcosa di più profondo.\n\n🧠 Metodo Sincro® aiuta i ragazzi a ritrovare la gioia, la fiducia e la voglia di competere.\n\n✅ Percorso 100% online e personalizzato\n✅ 2.100+ famiglie già trasformate\n✅ Garanzia risultati nel contratto\n\n👇 Consulenza gratuita per tuo figlio`,
                headline: 'Non Lasciarlo Solo Con Le Sue Paure.',
                description: 'Metodo Sincro® — Il mental coaching che cambia tutto',
            },
        ],
    },
    {
        name: 'TRAUMA',
        buyerState: 'Scottato/Frustrato — BOFU',
        ads: [
            {
                file: 'v3_trauma_1774001835322.png',
                adName: 'Trauma A — Clessidra 3D',
                message: `⚽ Quel talento che vedevi brillare… dove è finito?\n\nOgni giorno che passa senza agire, il potenziale di tuo figlio si spegne un po' di più.\n\n🧠 Metodo Sincro® ha un protocollo specifico per ragazzi che hanno subito traumi sportivi, infortuni e perdita di fiducia.\n\n✅ Formatori CONI certificati\n✅ Garanzia risultati scritta nel contratto\n✅ Consulenza gratuita senza impegno\n\n👇 Non aspettare che sia troppo tardi`,
                headline: 'Ogni Giorno Il Potenziale Si Perde.',
                description: 'Protocollo anti-trauma — Consulenza gratuita',
            },
            {
                file: 'v4_trauma_1774002879549.png',
                adName: 'Trauma B — Trofei Dimenticati',
                message: `⚽ Hai già provato altri percorsi senza risultati?\n\nÈ normale essere scettico. Ma Metodo Sincro® è l'unico percorso in Italia con GARANZIA SCRITTA nel contratto.\n\n🧠 Non promettiamo miracoli — dimostriamo risultati misurabili in 90 giorni.\n\n✅ 2.100+ ragazzi trasformati\n✅ 4.9 stelle TrustPilot\n✅ Se non funziona, non paghi\n\n👇 Rischia zero. Guadagna tutto.`,
                headline: 'Quel Talento Non È Sparito. È Solo Nascosto.',
                description: 'Garanzia risultati — Consulenza gratuita',
            },
        ],
    },
    {
        name: 'GROWTH',
        buyerState: 'Espansivo/Bloccato — MOFU',
        ads: [
            {
                file: 'v4_growth_fix_1774004882875.png',
                adName: 'Growth A — Fenice Dorata 3D',
                message: `⚽ Tuo figlio è pronto per il prossimo livello?\n\nQuando LA MENTE si sblocca, il corpo vola. Il mental coaching è la chiave che separa chi ha talento da chi diventa campione.\n\n🧠 Metodo Sincro® ha un sistema collaudato per portare i giovani atleti al livello successivo.\n\n✅ Usato da calciatori di Serie A\n✅ Risultati misurabili in 3 mesi\n✅ ONE-TO-ONE dedicato\n\n👇 Scopri cosa può cambiare`,
                headline: 'Quando LA MENTE Si Sblocca, Il Corpo Vola.',
                description: 'Il prossimo livello inizia dalla mente — Consulenza gratuita',
            },
            {
                file: 'v4_growth_1774002917847.png',
                adName: 'Growth B — Rovesciata Costellazioni',
                message: `⚽ Ha il talento ma gli manca quel "qualcosa" in più?\n\nQuel qualcosa si chiama MENTALITÀ VINCENTE. E si può allenare.\n\n🧠 Metodo Sincro® è il percorso di mental coaching specializzato per giovani calciatori che vogliono esplodere.\n\n✅ 2.100+ famiglie trasformate in tutta Italia\n✅ Sistema in 3 fasi: Analisi → Intervento → Risultato\n✅ Consulenza gratuita\n\n👇 La trasformazione inizia da qui`,
                headline: 'La Trasformazione Che Aspettavi.',
                description: 'Da "bravo" a campione — Consulenza gratuita',
            },
        ],
    },
    {
        name: 'AUTHORITY',
        buyerState: 'Affidamento/Guidato — MOFU',
        ads: [
            {
                file: 'v3_trustpilot_1774002184321.png',
                adName: 'Authority A — Trustpilot 3D',
                message: `⚽ 2.100+ famiglie. 4.9★ TrustPilot. #1 in Italia.\n\nNon siamo noi a dirlo — sono i genitori che hanno visto i risultati con i propri occhi.\n\n🧠 Metodo Sincro® è il percorso di mental coaching più recensito e certificato d'Italia per giovani calciatori.\n\n✅ Formatori CONI certificati\n✅ Usato da calciatori di Serie A, B e Lega Pro\n✅ Garanzia risultati nel contratto\n\n👇 Unisciti alle 2.100+ famiglie`,
                headline: '356 Famiglie. 4.9 Stelle. Zero Dubbi.',
                description: 'Il metodo #1 in Italia — Consulenza gratuita',
            },
            {
                file: 'v4_authority_1774002931796.png',
                adName: 'Authority B — 356 Stelle Campo',
                message: `⚽ Perché le migliori famiglie d'Italia scelgono Metodo Sincro®?\n\n1️⃣ Formatori CONI certificati\n2️⃣ Percorso 100% personalizzato ONE-TO-ONE\n3️⃣ Garanzia risultati SCRITTA nel contratto\n4️⃣ 4.9★ su TrustPilot (il più alto del settore)\n\n🧠 Non è un corso. È un percorso su misura per tuo figlio.\n\n✅ 2.100+ famiglie in tutta Italia\n✅ Consulenza gratuita senza impegno\n\n👇 Scopri perché funziona`,
                headline: '2.100+ Famiglie Hanno Già Scelto.',
                description: 'Formatori CONI certificati — Consulenza gratuita',
            },
        ],
    },
    {
        name: 'SECURITY',
        buyerState: 'Prudente/Avverso rischio — MOFU',
        ads: [
            {
                file: 'v3_security_1774001905562.png',
                adName: 'Security A — Scudo 3D',
                message: `⚽ "E se non funziona?"\n\nÈ la domanda che ogni genitore si fa. Per questo Metodo Sincro® è l'UNICO in Italia con garanzia risultati SCRITTA nel contratto.\n\n🧠 Zero rischi per te. Solo risultati per tuo figlio.\n\n✅ Se non vedi miglioramenti, non paghi\n✅ Consulenza gratuita per capire se è il percorso giusto\n✅ 2.100+ famiglie soddisfatte\n\n👇 Provalo senza rischi`,
                headline: "L'Unico Con Garanzia Scritta Nel Contratto.",
                description: 'Zero rischi, solo risultati — Consulenza gratuita',
            },
            {
                file: 'v4_security_b_1774004896293.png',
                adName: 'Security B — Padre Figlio Teenager',
                message: `⚽ Lo capiamo: investire nel futuro di tuo figlio è una decisione importante.\n\nPer questo abbiamo reso tutto a RISCHIO ZERO:\n\n1️⃣ Prima consulenza gratuita — capisci se fa per voi\n2️⃣ Garanzia risultati scritta nel contratto\n3️⃣ Percorso flessibile, 100% online\n\n🧠 Metodo Sincro® non è una spesa. È il miglior investimento per il suo futuro.\n\n✅ 4.9★ TrustPilot\n✅ Formatori CONI\n\n👇 Non sei solo. Passo dopo passo.`,
                headline: 'Non Sei Solo. Passo Dopo Passo.',
                description: 'Investimento sicuro — Consulenza gratuita',
            },
        ],
    },
    {
        name: 'DECISION',
        buyerState: 'Valutazione/Scettico — BOFU',
        ads: [
            {
                file: 'v3_decision_1774001943119.png',
                adName: 'Decision A — Porte 3D',
                message: `⚽ Due strade. Una sola porta al successo.\n\nOgni giorno che aspetti, il gap tra il suo talento e i suoi risultati si allarga.\n\n🧠 Metodo Sincro® ti offre una consulenza gratuita per capire in 15 minuti se il percorso è giusto per tuo figlio.\n\n✅ Nessun impegno, nessun costo\n✅ Analisi personalizzata del suo profilo mentale\n✅ Piano d'azione concreto\n\n👇 La scelta giusta è sempre la prossima`,
                headline: 'La Scelta Giusta Oggi Cambia Tutto Domani.',
                description: '15 minuti per capire — Consulenza gratuita',
            },
            {
                file: 'v4_decision_1774002984583.png',
                adName: 'Decision B — Scarpa Dorata',
                message: `⚽ Stai ancora pensando? Intanto il tempo passa.\n\nMentre valuti, altri genitori hanno già prenotato la consulenza gratuita e visto il cambiamento.\n\n🧠 Non serve decidere oggi. Serve fare UN passo: la consulenza gratuita.\n\n✅ 15 minuti per capire se è il percorso giusto\n✅ Zero impegno, zero spese\n✅ Analisi personalizzata del suo profilo\n\n👇 Il primo passo è gratuito. Fallo ora.`,
                headline: 'Ogni Giorno Che Aspetti, Il Gap Si Allarga.',
                description: 'Il primo passo è sempre gratuito — Prenota ora',
            },
        ],
    },
    {
        name: 'EFFICIENCY',
        buyerState: 'Ottimizzatore/Razionale — MOFU',
        ads: [
            {
                file: 'v3_efficiency_1774001954549.png',
                adName: 'Efficiency A — Timer 90 Giorni',
                message: `⚽ Risultati incredibili in soli 3 mesi.\n\nNon anni. Non "forse". In 90 giorni la mentalità di tuo figlio cambia in modo misurabile.\n\n🧠 Metodo Sincro® non è un percorso infinito — è un sistema in 3 fasi con risultati tracciabili.\n\n✅ Percorso 100% online, flessibile\n✅ Report progressi settimanali\n✅ ONE-TO-ONE con coach dedicato\n\n👇 Scopri come funziona — Consulenza gratuita`,
                headline: 'In Soli 3 Mesi. Un Figlio Diverso.',
                description: 'Risultati misurabili e garantiti — Consulenza gratuita',
            },
            {
                file: 'v4_efficiency_b_1774004911007.png',
                adName: 'Efficiency B — Split Trasformazione',
                message: `⚽ 3 mesi per trasformare un ragazzo insicuro in un atleta mentalmente forte.\n\nIl percorso è chiaro:\n\n📊 Mese 1 — Analisi profilo mentale + primi interventi\n📊 Mese 2 — Allenamento mentale intensivo\n📊 Mese 3 — Consolidamento + autonomia\n\n🧠 Non è magia. È un SISTEMA che funziona dal 2019.\n\n✅ 2.100+ ragazzi trasformati\n✅ Ogni sessione è mirata e tracciata\n\n👇 Prenota la consulenza gratuita`,
                headline: 'In Soli 3 Mesi. La Trasformazione.',
                description: 'Un sistema. Non una speranza. — Consulenza gratuita',
            },
        ],
    },
    {
        name: 'STATUS',
        buyerState: 'Immagine/Elite — MOFU',
        ads: [
            {
                file: 'v3_status_1774001966791.png',
                adName: 'Status A — Corona Oro 3D',
                message: `⚽ Tuo figlio merita il percorso dei campioni.\n\nI migliori atleti italiani non si allenano solo fisicamente — allenano la MENTE.\n\n🧠 Metodo Sincro® è usato da calciatori di Serie A, B e Lega Pro. Ora è disponibile per tuo figlio.\n\n✅ Stesso metodo dei professionisti\n✅ ONE-TO-ONE con coach dedicato\n✅ Percorso premium, risultati d'élite\n\n👇 Accedi al percorso dei campioni — Consulenza gratuita`,
                headline: 'Il Percorso Dei Campioni. Ora Per Tuo Figlio.',
                description: 'Lo stesso metodo della Serie A — Consulenza gratuita',
            },
            {
                file: 'v4_status_1774003012245.png',
                adName: 'Status B — Stemma Mano',
                message: `⚽ Ogni campione è partito da dove sta tuo figlio oggi.\n\nLa differenza? Hanno investito nella MENTE prima degli altri.\n\n🧠 Metodo Sincro® trasforma ragazzi con talento in atleti con MENTALITÀ VINCENTE.\n\n✅ Il percorso d'élite del mental coaching in Italia\n✅ Formatori CONI, 4.9★ TrustPilot\n✅ Garanzia risultati nel contratto\n\n👇 Tuo figlio è il prossimo`,
                headline: 'Trasforma Ragazzi In Campioni.',
                description: "Percorso d'élite — Consulenza gratuita",
            },
        ],
    },
    {
        name: 'SYSTEM',
        buyerState: 'Controllo/Organizzativo — MOFU',
        ads: [
            {
                file: 'v3_system_1774001981832.png',
                adName: 'System A — Rete Neurale 3D',
                message: `⚽ Non è fortuna. Non è motivazione. È un SISTEMA.\n\nMetodo Sincro® funziona perché è basato su un protocollo scientifico replicabile:\n\n📊 Fase 1: Analisi del profilo mentale\n📊 Fase 2: Intervento personalizzato ONE-TO-ONE\n📊 Fase 3: Consolidamento e autonomia\n\n🧠 Risultati tracciabili settimana dopo settimana.\n\n✅ 2.100+ ragazzi hanno completato il percorso\n✅ Garanzia risultati nel contratto\n\n👇 Scopri il Sistema — Consulenza gratuita`,
                headline: 'Non È Fortuna. È Un Sistema.',
                description: 'Protocollo scientifico replicabile — Consulenza gratuita',
            },
            {
                file: 'v4_system_1774003024781.png',
                adName: 'System B — Lavagna Tattica',
                message: `⚽ Un metodo. Risultati replicabili.\n\nNon lasciamo nulla al caso. Ogni seduta è pianificata, ogni progresso è misurato, ogni risultato è documentato.\n\n🧠 Metodo Sincro® è il primo sistema scientifico in Italia per il mental coaching dei giovani calciatori.\n\n✅ Dati alla mano: miglioramento medio del 73% in 90 giorni\n✅ Report settimanali inviati ai genitori\n✅ Formatori CONI certificati\n\n👇 Prenota la consulenza gratuita`,
                headline: 'Un Metodo. Risultati Replicabili.',
                description: 'Dati e scienza, non opinioni — Consulenza gratuita',
            },
        ],
    },
]

// ─── MAIN ───
async function main() {
    console.log('🚀 ANDROMEDA CAMPAIGN — Launch Phase 1 (2 ads/cluster)')
    console.log('━'.repeat(60))

    // ── Get Meta token ──
    console.log('\n🔑 Step 0: Getting Meta token...')
    const { data: conn, error: connErr } = await supabase
        .from('connections')
        .select('credentials')
        .eq('provider', 'meta_ads')
        .eq('status', 'active')
        .single()

    if (connErr || !conn?.credentials?.access_token) {
        console.error('❌ Cannot get Meta token:', connErr?.message || 'No token')
        process.exit(1)
    }

    const TOKEN = conn.credentials.access_token
    const AD_ACCOUNT = `act_${conn.credentials.ad_account_id}`
    console.log(`  ✅ Token OK. Ad Account: ${AD_ACCOUNT}`)

    // ── Step 1: Upload images ──
    console.log('\n📸 Step 1: Uploading 20 images to Meta...')
    const imageHashes = {}
    for (const cluster of clusters) {
        for (const ad of cluster.ads) {
            const filePath = path.join(ADS_DIR, ad.file)
            if (!fs.existsSync(filePath)) {
                console.error(`  ❌ File not found: ${ad.file}`)
                continue
            }
            const hash = await uploadImageFile(AD_ACCOUNT, TOKEN, filePath, ad.file)
            if (hash) imageHashes[ad.file] = hash
        }
    }
    console.log(`  ✅ ${Object.keys(imageHashes).length}/20 images uploaded`)

    // ── Step 2: Create CBO Campaign ──
    let campaignId
    if (RESUME_CAMPAIGN_ID) {
        campaignId = RESUME_CAMPAIGN_ID
        console.log(`\n⏭️ Step 2: Resuming with existing campaign: ${campaignId}`)
    } else {
        console.log('\n📋 Step 2: Creating campaign (PAUSED)...')
        const campaign = await metaPost(`${AD_ACCOUNT}/campaigns`, TOKEN, {
            name: 'MS - Lead Gen - Andromeda',
            objective: 'OUTCOME_LEADS',
            status: 'PAUSED',
            special_ad_categories: ['NONE'],
            is_adset_budget_sharing_enabled: false,
        })
        campaignId = campaign.id
        console.log(`  ✅ Campaign: ${campaignId} — ABO €30/day x 10`)
    }

    // ── Step 3: Create 10 Ad Sets (one per cluster) ──
    console.log('\n🎯 Step 3: Creating 10 ad sets (targeting 38-65, IT, OFFSITE_CONVERSIONS)...')
    const adSetIds = {}

    for (const cluster of clusters) {
        const adSet = await metaPost(`${AD_ACCOUNT}/adsets`, TOKEN, {
            name: `${cluster.name} (${cluster.buyerState})`,
            campaign_id: campaignId,
            daily_budget: 3000, // €30/day per ad set
            billing_event: 'IMPRESSIONS',
            optimization_goal: 'OFFSITE_CONVERSIONS',
            bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
            targeting: targeting,
            promoted_object: { pixel_id: PIXEL_ID, custom_event_type: 'LEAD' },
            status: 'PAUSED',
        })
        adSetIds[cluster.name] = adSet.id
        console.log(`  ✅ Ad Set: ${cluster.name} → ${adSet.id}`)
    }

    // ── Step 4: Create Ads (2 per ad set = 20 total) ──
    console.log('\n🎨 Step 4: Creating 20 ads with cluster-specific copy...')
    let adCount = 0

    for (const cluster of clusters) {
        for (const ad of cluster.ads) {
            const hash = imageHashes[ad.file]
            if (!hash) {
                console.error(`  ❌ No hash for ${ad.file}, skipping`)
                continue
            }

            const creative = await metaPost(`${AD_ACCOUNT}/adcreatives`, TOKEN, {
                name: ad.adName,
                object_story_spec: {
                    page_id: PAGE_ID,
                    instagram_user_id: INSTAGRAM_USER_ID,
                    link_data: {
                        image_hash: hash,
                        link: LANDING_URL,
                        message: ad.message,
                        name: ad.headline,
                        description: ad.description,
                        call_to_action: { type: 'LEARN_MORE' },
                    },
                },
                url_tags: URL_TAGS,
            })

            await metaPost(`${AD_ACCOUNT}/ads`, TOKEN, {
                name: ad.adName,
                adset_id: adSetIds[cluster.name],
                creative: { creative_id: creative.id },
                status: 'PAUSED',
            })
            adCount++
            console.log(`  ✅ [${cluster.name}] ${ad.adName}`)
        }
    }

    // ── Step 5: Verify ──
    console.log('\n🔍 Step 5: Verifying ad sets...')
    let allOk = true
    for (const [name, id] of Object.entries(adSetIds)) {
        const details = await metaGet(id, TOKEN, { fields: 'targeting,optimization_goal' })
        const t = details.targeting || {}
        const checks = {
            age_min: t.age_min === 38,
            age_max: t.age_max === 65,
            it_only: JSON.stringify(t.geo_locations?.countries) === '["IT"]',
            optimization: details.optimization_goal === 'OFFSITE_CONVERSIONS',
        }
        const passed = Object.values(checks).every(Boolean)
        if (!passed) {
            allOk = false
            console.log(`  ❌ ${name}: FAILED`, checks)
        } else {
            console.log(`  ✅ ${name}: all checks passed`)
        }
    }

    if (!allOk) {
        console.error('\n⚠️ VERIFICATION FAILED — campaign left PAUSED')
        return
    }

    // ── Step 6: Activate ──
    console.log('\n🟢 Step 6: Activating...')
    await metaPost(campaignId, TOKEN, { status: 'ACTIVE' })
    for (const id of Object.values(adSetIds)) {
        await metaPost(id, TOKEN, { status: 'ACTIVE' })
    }

    console.log('\n' + '━'.repeat(60))
    console.log('🎉 ANDROMEDA PHASE 1 — LIVE!')
    console.log(`   📋 1 Campagna CBO €300/gg`)
    console.log(`   🎯 10 Ad Set (1 per cluster)`)
    console.log(`   🎨 ${adCount} Ads (2 per cluster)`)
    console.log('   ✅ Età: 38-65 | Lingua: IT | OFFSITE_CONVERSIONS')
    console.log('   ✅ UTM tags + Instagram/Facebook')
    console.log('━'.repeat(60))
    console.log(`\nCampaign ID: ${campaignId}`)
    for (const [name, id] of Object.entries(adSetIds)) {
        console.log(`Ad Set [${name}]: ${id}`)
    }
}

main().catch(err => {
    console.error('❌ Fatal error:', err.message)
    process.exit(1)
})
