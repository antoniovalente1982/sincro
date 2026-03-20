// Complete setup: add 10 ad sets + 20 ads to CBO campaign 120242756251050047
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
const CAMPAIGN_ID = '120242756251050047'
const ADS_DIR = path.join(ROOT, 'data', 'ads_andromeda')

async function metaPost(ep, token, body) {
    const r = await fetch(`${META_API}/${ep}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...body, access_token: token }) })
    const d = await r.json()
    if (d.error) { console.error(`❌ ${ep}:`, JSON.stringify(d.error, null, 2)); throw new Error(d.error.message) }
    return d
}
async function metaGet(ep, token, params = {}) {
    const qs = new URLSearchParams({ ...params, access_token: token }).toString()
    return (await fetch(`${META_API}/${ep}?${qs}`)).json()
}
async function uploadImg(acct, token, fp, name) {
    const b64 = fs.readFileSync(fp).toString('base64')
    const r = await fetch(`${META_API}/${acct}/adimages`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ access_token: token, bytes: b64, name }) })
    const d = await r.json()
    if (d.error) { console.error(`  ❌ ${name}:`, d.error.message); return null }
    const h = d.images?.[Object.keys(d.images)[0]]?.hash
    console.log(`  ✅ ${name} → ${h}`)
    return h
}

const targeting = {
    geo_locations: { countries: ['IT'] },
    age_min: 38, age_max: 65, locales: [10],
    flexible_spec: [{ interests: [
        { id: '6003107902433', name: 'Calcio (calcio)' },
        { id: '6003332764437', name: 'Genitori' },
        { id: '6003051822645', name: 'Coaching (istruzione)' },
        { id: '6003748928462', name: 'Sviluppo personale' },
    ]}],
    genders: [0],
    publisher_platforms: ['facebook', 'instagram'],
    targeting_automation: { advantage_audience: 0 },
}

const clusters = [
    { name: 'EDUCATION', bs: 'Curioso/Consapevole — TOFU', ads: [
        { file: 'v3_education_1774001807641.png', adName: 'Education A — Cervello Oro 3D',
          msg: `⚽ Tuo figlio ha talento… ma non lo dimostra in campo?\n\nL'87% dei giovani calciatori si blocca per un PROBLEMA MENTALE che nessuno allena.\n\n🧠 Metodo Sincro® è il percorso di mental coaching #1 in Italia dedicato ai giovani calciatori.\n\n✅ Coach dedicato ONE-TO-ONE\n✅ 100% online, risultati in 3 mesi\n✅ 2.100+ famiglie trasformate • 4.9★ TrustPilot\n\n👇 Consulenza gratuita senza impegno`,
          hl: "Il Talento È Solo Il 20%. Il Resto È Mente.", desc: "Consulenza gratuita — Metodo Sincro® per giovani calciatori" },
        { file: 'v4_education_1774002849900.png', adName: 'Education B — X-Ray Mente',
          msg: `⚽ La tecnica c'è. Ma qualcosa blocca tuo figlio.\n\nNon è un problema fisico. È un muro MENTALE invisibile che frena il 90% dei giovani atleti.\n\n🧠 Con Metodo Sincro® i ragazzi imparano a gestire ansia, pressione e paura del giudizio.\n\n✅ Usato da calciatori di Serie A, B e Lega Pro\n✅ Percorso personalizzato al 100%\n✅ Primo incontro GRATUITO\n\n👇 Prenota la consulenza gratuita`,
          hl: "La Tecnica C'è. La Mente Blocca.", desc: "Mental coaching per sbloccare il potenziale di tuo figlio" },
    ]},
    { name: 'EMOTIONAL', bs: 'Sovraccarico/Stressato — MOFU', ads: [
        { file: 'v3_emotional_1774001820791.png', adName: 'Emotional A — Scarpe Fango 3D',
          msg: `⚽ Lo conosci quel silenzio in macchina dopo la partita?\n\nQuando vedi tuo figlio soffrire per lo sport che ama, il cuore di un genitore si spezza.\n\n🧠 Metodo Sincro® non lavora solo con il ragazzo — supporta TUTTA la famiglia nel percorso.\n\n✅ Risultati visibili in 30 giorni\n✅ 9 genitori su 10 notano un cambiamento positivo\n✅ Consulenza gratuita, zero impegno\n\n👇 Fai il primo passo per lui`,
          hl: "Quel Silenzio Dopo La Partita. Tu Lo Conosci.", desc: "Il primo passo per cambiare tutto — Consulenza gratuita" },
        { file: 'v4_emotional_1774002865914.png', adName: 'Emotional B — Silenzio Macchina',
          msg: `⚽ "Papà, non mi diverto più."\n\nSe hai sentito questa frase, sai che il problema NON è il calcio. È qualcosa di più profondo.\n\n🧠 Metodo Sincro® aiuta i ragazzi a ritrovare la gioia, la fiducia e la voglia di competere.\n\n✅ Percorso 100% online e personalizzato\n✅ 2.100+ famiglie già trasformate\n✅ Garanzia risultati nel contratto\n\n👇 Consulenza gratuita per tuo figlio`,
          hl: "Non Lasciarlo Solo Con Le Sue Paure.", desc: "Metodo Sincro® — Il mental coaching che cambia tutto" },
    ]},
    { name: 'TRAUMA', bs: 'Scottato/Frustrato — BOFU', ads: [
        { file: 'v3_trauma_1774001835322.png', adName: 'Trauma A — Clessidra 3D',
          msg: `⚽ Quel talento che vedevi brillare… dove è finito?\n\nOgni giorno che passa senza agire, il potenziale di tuo figlio si spegne un po' di più.\n\n🧠 Metodo Sincro® ha un protocollo specifico per ragazzi che hanno subito traumi sportivi, infortuni e perdita di fiducia.\n\n✅ Formatori CONI certificati\n✅ Garanzia risultati scritta nel contratto\n✅ Consulenza gratuita senza impegno\n\n👇 Non aspettare che sia troppo tardi`,
          hl: "Ogni Giorno Il Potenziale Si Perde.", desc: "Protocollo anti-trauma — Consulenza gratuita" },
        { file: 'v4_trauma_1774002879549.png', adName: 'Trauma B — Trofei Dimenticati',
          msg: `⚽ Hai già provato altri percorsi senza risultati?\n\nÈ normale essere scettico. Ma Metodo Sincro® è l'unico percorso in Italia con GARANZIA SCRITTA nel contratto.\n\n🧠 Non promettiamo miracoli — dimostriamo risultati misurabili in 90 giorni.\n\n✅ 2.100+ ragazzi trasformati\n✅ 4.9 stelle TrustPilot\n✅ Se non funziona, non paghi\n\n👇 Rischia zero. Guadagna tutto.`,
          hl: "Quel Talento Non È Sparito. È Solo Nascosto.", desc: "Garanzia risultati — Consulenza gratuita" },
    ]},
    { name: 'GROWTH', bs: 'Espansivo/Bloccato — MOFU', ads: [
        { file: 'v4_growth_fix_1774004882875.png', adName: 'Growth A — Fenice Dorata 3D',
          msg: `⚽ Tuo figlio è pronto per il prossimo livello?\n\nQuando LA MENTE si sblocca, il corpo vola. Il mental coaching è la chiave che separa chi ha talento da chi diventa campione.\n\n🧠 Metodo Sincro® ha un sistema collaudato per portare i giovani atleti al livello successivo.\n\n✅ Usato da calciatori di Serie A\n✅ Risultati misurabili in 3 mesi\n✅ ONE-TO-ONE dedicato\n\n👇 Scopri cosa può cambiare`,
          hl: "Quando LA MENTE Si Sblocca, Il Corpo Vola.", desc: "Il prossimo livello inizia dalla mente — Consulenza gratuita" },
        { file: 'v4_growth_1774002917847.png', adName: 'Growth B — Rovesciata Costellazioni',
          msg: `⚽ Ha il talento ma gli manca quel "qualcosa" in più?\n\nQuel qualcosa si chiama MENTALITÀ VINCENTE. E si può allenare.\n\n🧠 Metodo Sincro® è il percorso di mental coaching specializzato per giovani calciatori che vogliono esplodere.\n\n✅ 2.100+ famiglie trasformate in tutta Italia\n✅ Sistema in 3 fasi: Analisi → Intervento → Risultato\n✅ Consulenza gratuita\n\n👇 La trasformazione inizia da qui`,
          hl: "La Trasformazione Che Aspettavi.", desc: "Da \"bravo\" a campione — Consulenza gratuita" },
    ]},
    { name: 'AUTHORITY', bs: 'Affidamento/Guidato — MOFU', ads: [
        { file: 'v3_trustpilot_1774002184321.png', adName: 'Authority A — Trustpilot 3D',
          msg: `⚽ 2.100+ famiglie. 4.9★ TrustPilot. #1 in Italia.\n\nNon siamo noi a dirlo — sono i genitori che hanno visto i risultati con i propri occhi.\n\n🧠 Metodo Sincro® è il percorso di mental coaching più recensito e certificato d'Italia per giovani calciatori.\n\n✅ Formatori CONI certificati\n✅ Usato da calciatori di Serie A, B e Lega Pro\n✅ Garanzia risultati nel contratto\n\n👇 Unisciti alle 2.100+ famiglie`,
          hl: "356 Famiglie. 4.9 Stelle. Zero Dubbi.", desc: "Il metodo #1 in Italia — Consulenza gratuita" },
        { file: 'v4_authority_1774002931796.png', adName: 'Authority B — 356 Stelle Campo',
          msg: `⚽ Perché le migliori famiglie d'Italia scelgono Metodo Sincro®?\n\n1️⃣ Formatori CONI certificati\n2️⃣ Percorso 100% personalizzato ONE-TO-ONE\n3️⃣ Garanzia risultati SCRITTA nel contratto\n4️⃣ 4.9★ su TrustPilot (il più alto del settore)\n\n🧠 Non è un corso. È un percorso su misura per tuo figlio.\n\n✅ 2.100+ famiglie in tutta Italia\n✅ Consulenza gratuita senza impegno\n\n👇 Scopri perché funziona`,
          hl: "2.100+ Famiglie Hanno Già Scelto.", desc: "Formatori CONI certificati — Consulenza gratuita" },
    ]},
    { name: 'SECURITY', bs: 'Prudente/Avverso rischio — MOFU', ads: [
        { file: 'v3_security_1774001905562.png', adName: 'Security A — Scudo 3D',
          msg: `⚽ "E se non funziona?"\n\nÈ la domanda che ogni genitore si fa. Per questo Metodo Sincro® è l'UNICO in Italia con garanzia risultati SCRITTA nel contratto.\n\n🧠 Zero rischi per te. Solo risultati per tuo figlio.\n\n✅ Se non vedi miglioramenti, non paghi\n✅ Consulenza gratuita per capire se è il percorso giusto\n✅ 2.100+ famiglie soddisfatte\n\n👇 Provalo senza rischi`,
          hl: "L'Unico Con Garanzia Scritta Nel Contratto.", desc: "Zero rischi, solo risultati — Consulenza gratuita" },
        { file: 'v4_security_b_1774004896293.png', adName: 'Security B — Padre Figlio Teenager',
          msg: `⚽ Lo capiamo: investire nel futuro di tuo figlio è una decisione importante.\n\nPer questo abbiamo reso tutto a RISCHIO ZERO:\n\n1️⃣ Prima consulenza gratuita — capisci se fa per voi\n2️⃣ Garanzia risultati scritta nel contratto\n3️⃣ Percorso flessibile, 100% online\n\n🧠 Metodo Sincro® non è una spesa. È il miglior investimento per il suo futuro.\n\n✅ 4.9★ TrustPilot\n✅ Formatori CONI\n\n👇 Non sei solo. Passo dopo passo.`,
          hl: "Non Sei Solo. Passo Dopo Passo.", desc: "Investimento sicuro — Consulenza gratuita" },
    ]},
    { name: 'DECISION', bs: 'Valutazione/Scettico — BOFU', ads: [
        { file: 'v3_decision_1774001943119.png', adName: 'Decision A — Porte 3D',
          msg: `⚽ Due strade. Una sola porta al successo.\n\nOgni giorno che aspetti, il gap tra il suo talento e i suoi risultati si allarga.\n\n🧠 Metodo Sincro® ti offre una consulenza gratuita per capire in 15 minuti se il percorso è giusto per tuo figlio.\n\n✅ Nessun impegno, nessun costo\n✅ Analisi personalizzata del suo profilo mentale\n✅ Piano d'azione concreto\n\n👇 La scelta giusta è sempre la prossima`,
          hl: "La Scelta Giusta Oggi Cambia Tutto Domani.", desc: "15 minuti per capire — Consulenza gratuita" },
        { file: 'v4_decision_1774002984583.png', adName: 'Decision B — Scarpa Dorata',
          msg: `⚽ Stai ancora pensando? Intanto il tempo passa.\n\nMentre valuti, altri genitori hanno già prenotato la consulenza gratuita e visto il cambiamento.\n\n🧠 Non serve decidere oggi. Serve fare UN passo: la consulenza gratuita.\n\n✅ 15 minuti per capire se è il percorso giusto\n✅ Zero impegno, zero spese\n✅ Analisi personalizzata del suo profilo\n\n👇 Il primo passo è gratuito. Fallo ora.`,
          hl: "Ogni Giorno Che Aspetti, Il Gap Si Allarga.", desc: "Il primo passo è sempre gratuito — Prenota ora" },
    ]},
    { name: 'EFFICIENCY', bs: 'Ottimizzatore/Razionale — MOFU', ads: [
        { file: 'v3_efficiency_1774001954549.png', adName: 'Efficiency A — Timer 90 Giorni',
          msg: `⚽ Risultati incredibili in soli 3 mesi.\n\nNon anni. Non "forse". In 90 giorni la mentalità di tuo figlio cambia in modo misurabile.\n\n🧠 Metodo Sincro® non è un percorso infinito — è un sistema in 3 fasi con risultati tracciabili.\n\n✅ Percorso 100% online, flessibile\n✅ Report progressi settimanali\n✅ ONE-TO-ONE con coach dedicato\n\n👇 Scopri come funziona — Consulenza gratuita`,
          hl: "In Soli 3 Mesi. Un Figlio Diverso.", desc: "Risultati misurabili e garantiti — Consulenza gratuita" },
        { file: 'v4_efficiency_b_1774004911007.png', adName: 'Efficiency B — Split Trasformazione',
          msg: `⚽ 3 mesi per trasformare un ragazzo insicuro in un atleta mentalmente forte.\n\nIl percorso è chiaro:\n\n📊 Mese 1 — Analisi profilo mentale + primi interventi\n📊 Mese 2 — Allenamento mentale intensivo\n📊 Mese 3 — Consolidamento + autonomia\n\n🧠 Non è magia. È un SISTEMA che funziona dal 2019.\n\n✅ 2.100+ ragazzi trasformati\n✅ Ogni sessione è mirata e tracciata\n\n👇 Prenota la consulenza gratuita`,
          hl: "In Soli 3 Mesi. La Trasformazione.", desc: "Un sistema. Non una speranza. — Consulenza gratuita" },
    ]},
    { name: 'STATUS', bs: 'Immagine/Elite — MOFU', ads: [
        { file: 'v3_status_1774001966791.png', adName: 'Status A — Corona Oro 3D',
          msg: `⚽ Tuo figlio merita il percorso dei campioni.\n\nI migliori atleti italiani non si allenano solo fisicamente — allenano la MENTE.\n\n🧠 Metodo Sincro® è usato da calciatori di Serie A, B e Lega Pro. Ora è disponibile per tuo figlio.\n\n✅ Stesso metodo dei professionisti\n✅ ONE-TO-ONE con coach dedicato\n✅ Percorso premium, risultati d'élite\n\n👇 Accedi al percorso dei campioni — Consulenza gratuita`,
          hl: "Il Percorso Dei Campioni. Ora Per Tuo Figlio.", desc: "Lo stesso metodo della Serie A — Consulenza gratuita" },
        { file: 'v4_status_1774003012245.png', adName: 'Status B — Stemma Mano',
          msg: `⚽ Ogni campione è partito da dove sta tuo figlio oggi.\n\nLa differenza? Hanno investito nella MENTE prima degli altri.\n\n🧠 Metodo Sincro® trasforma ragazzi con talento in atleti con MENTALITÀ VINCENTE.\n\n✅ Il percorso d'élite del mental coaching in Italia\n✅ Formatori CONI, 4.9★ TrustPilot\n✅ Garanzia risultati nel contratto\n\n👇 Tuo figlio è il prossimo`,
          hl: "Trasforma Ragazzi In Campioni.", desc: "Percorso d'élite — Consulenza gratuita" },
    ]},
    { name: 'SYSTEM', bs: 'Controllo/Organizzativo — MOFU', ads: [
        { file: 'v3_system_1774001981832.png', adName: 'System A — Rete Neurale 3D',
          msg: `⚽ Non è fortuna. Non è motivazione. È un SISTEMA.\n\nMetodo Sincro® funziona perché è basato su un protocollo scientifico replicabile:\n\n📊 Fase 1: Analisi del profilo mentale\n📊 Fase 2: Intervento personalizzato ONE-TO-ONE\n📊 Fase 3: Consolidamento e autonomia\n\n🧠 Risultati tracciabili settimana dopo settimana.\n\n✅ 2.100+ ragazzi hanno completato il percorso\n✅ Garanzia risultati nel contratto\n\n👇 Scopri il Sistema — Consulenza gratuita`,
          hl: "Non È Fortuna. È Un Sistema.", desc: "Protocollo scientifico replicabile — Consulenza gratuita" },
        { file: 'v4_system_1774003024781.png', adName: 'System B — Lavagna Tattica',
          msg: `⚽ Un metodo. Risultati replicabili.\n\nNon lasciamo nulla al caso. Ogni seduta è pianificata, ogni progresso è misurato, ogni risultato è documentato.\n\n🧠 Metodo Sincro® è il primo sistema scientifico in Italia per il mental coaching dei giovani calciatori.\n\n✅ Dati alla mano: miglioramento medio del 73% in 90 giorni\n✅ Report settimanali inviati ai genitori\n✅ Formatori CONI certificati\n\n👇 Prenota la consulenza gratuita`,
          hl: "Un Metodo. Risultati Replicabili.", desc: "Dati e scienza, non opinioni — Consulenza gratuita" },
    ]},
]

async function main() {
    console.log('🚀 ANDROMEDA CBO — Creating ad sets + ads')
    console.log('━'.repeat(60))

    const { data: conn } = await supabase.from('connections').select('credentials').eq('provider', 'meta_ads').eq('status', 'active').single()
    const TOKEN = conn.credentials.access_token
    const AD_ACCOUNT = `act_${conn.credentials.ad_account_id}`
    console.log(`✅ Token OK: ${AD_ACCOUNT}`)

    // Upload images
    console.log('\n📸 Uploading 20 images...')
    const hashes = {}
    for (const c of clusters) for (const a of c.ads) {
        const fp = path.join(ADS_DIR, a.file)
        if (fs.existsSync(fp)) hashes[a.file] = await uploadImg(AD_ACCOUNT, TOKEN, fp, a.file)
    }
    console.log(`  ✅ ${Object.values(hashes).filter(Boolean).length}/20`)

    // Create ad sets + ads
    console.log('\n🎯 Creating 10 ad sets + 20 ads...')
    const adSetIds = {}
    let adCount = 0

    for (const c of clusters) {
        // Create CBO ad set (NO budget, NO bid_strategy — campaign handles it)
        const adSet = await metaPost(`${AD_ACCOUNT}/adsets`, TOKEN, {
            name: `${c.name} (${c.bs})`,
            campaign_id: CAMPAIGN_ID,
            billing_event: 'IMPRESSIONS',
            optimization_goal: 'OFFSITE_CONVERSIONS',
            targeting,
            promoted_object: { pixel_id: PIXEL_ID, custom_event_type: 'LEAD' },
            status: 'PAUSED',
        })
        adSetIds[c.name] = adSet.id
        console.log(`  ✅ Ad Set: ${c.name} → ${adSet.id}`)

        // Create 2 ads
        for (const a of c.ads) {
            const h = hashes[a.file]
            if (!h) continue
            const cr = await metaPost(`${AD_ACCOUNT}/adcreatives`, TOKEN, {
                name: a.adName,
                object_story_spec: {
                    page_id: PAGE_ID,
                    instagram_user_id: INSTAGRAM_USER_ID,
                    link_data: { image_hash: h, link: LANDING_URL, message: a.msg, name: a.hl, description: a.desc, call_to_action: { type: 'LEARN_MORE' } },
                },
                url_tags: URL_TAGS,
            })
            await metaPost(`${AD_ACCOUNT}/ads`, TOKEN, { name: a.adName, adset_id: adSet.id, creative: { creative_id: cr.id }, status: 'PAUSED' })
            adCount++
            console.log(`    ✅ ${a.adName}`)
        }
    }

    // Verify
    console.log('\n🔍 Verifying...')
    const camp = await metaGet(CAMPAIGN_ID, TOKEN, { fields: 'daily_budget,bid_strategy,status' })
    console.log(`  Campaign: €${(camp.daily_budget/100).toFixed(0)}/day | ${camp.bid_strategy} | ${camp.status}`)
    for (const [n, id] of Object.entries(adSetIds)) {
        const d = await metaGet(id, TOKEN, { fields: 'targeting,optimization_goal,daily_budget' })
        const t = d.targeting || {}
        const ok = t.age_min===38 && t.age_max===65 && !d.daily_budget && d.optimization_goal==='OFFSITE_CONVERSIONS'
        console.log(`  ${ok?'✅':'❌'} ${n}: age ${t.age_min}-${t.age_max} | opt: ${d.optimization_goal} | CBO: ${!d.daily_budget}`)
    }

    // Activate
    console.log('\n🟢 Activating...')
    if (camp.status !== 'ACTIVE') await metaPost(CAMPAIGN_ID, TOKEN, { status: 'ACTIVE' })
    for (const id of Object.values(adSetIds)) await metaPost(id, TOKEN, { status: 'ACTIVE' })
    const allAds = await metaGet(`${CAMPAIGN_ID}/ads`, TOKEN, { fields: 'id', limit: '30' })
    for (const ad of (allAds.data||[])) await metaPost(ad.id, TOKEN, { status: 'ACTIVE' })

    console.log('\n' + '━'.repeat(60))
    console.log(`🎉 ANDROMEDA CBO LIVE! Campaign: ${CAMPAIGN_ID}`)
    console.log(`   €300/day CBO | 10 ad sets | ${adCount} ads | LOWEST_COST_WITHOUT_CAP`)
    console.log('━'.repeat(60))
    for (const [n,id] of Object.entries(adSetIds)) console.log(`  ${n}: ${id}`)
}

main().catch(e => { console.error('❌', e.message); process.exit(1) })
