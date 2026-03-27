/**
 * Creative Pipeline — Circuito Chiuso per la Generazione Automatica di Ads
 * 
 * Questo modulo gestisce:
 * 1. Calcolo deficit ads per AdSet (quante ads servono vs quante sono attive)
 * 2. Analisi pattern vincenti dalle top ads di Meta
 * 3. Selezione intelligente dei Buyer Pockets (100 pocket)
 * 4. Generazione brief creativi con prompt per immagini 4:5
 * 
 * STRUTTURA ADS: Campagna (CBO) → AdSet (= 1 Angolo) → Ads
 * L'angolo vive a livello di AdSet e determina il utm_term della landing page.
 */

import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
)

// ═══════════════════════════════════════════════
// BUYER POCKETS — I 100 profili buyer dal CSV
// Mappatura Angolo AdSet → Clusters utilizzabili
// ═══════════════════════════════════════════════

const ANGLE_TO_CLUSTERS: Record<string, string[]> = {
    efficiency: ['Efficiency', 'Growth'],
    system: ['System', 'Authority'],
    emotional: ['Emotional', 'Trauma'],
    status: ['Status', 'Security'],
    growth: ['Growth', 'Efficiency'],
    authority: ['Authority', 'System'],
    education: ['Education'],
    security: ['Security', 'Status'],
    trauma: ['Trauma', 'Emotional'],
    decision: ['Decision'],
    generic: ['Efficiency', 'Emotional', 'System', 'Status'],
    sport_performance: ['Efficiency', 'Growth'],
    mental_coaching: ['Emotional', 'Trauma'],
}

// I 100 Buyer Pockets (caricati dal CSV nella knowledge base)
// Ogni pocket ha: pocket_id, pocket_name, cluster, buyer_state, core_question, primary_trigger, funnel_role, scalability
interface BuyerPocket {
    pocket_id: number
    pocket_name: string
    cluster: string
    buyer_state: string
    core_question: string
    primary_trigger: string
    funnel_role: string
    scalability: string
}

// Carica i pocket dal CSV a runtime
let _pocketsCache: BuyerPocket[] | null = null

async function loadBuyerPockets(): Promise<BuyerPocket[]> {
    if (_pocketsCache) return _pocketsCache

    const fs = await import('fs')
    const path = await import('path')
    const csvPath = path.join(process.cwd(), 'docs', 'knowledge-base', 'creative-strategy', '100 Buyer Pockets.xlsx - Foglio1.csv')

    try {
        const raw = fs.readFileSync(csvPath, 'utf-8')
        const lines = raw.trim().split('\n')
        const headers = lines[0].split(',')

        _pocketsCache = lines.slice(1).map(line => {
            const values = line.replace('\r', '').split(',')
            return {
                pocket_id: parseInt(values[0]),
                pocket_name: values[1],
                cluster: values[2],
                buyer_state: values[3],
                core_question: values[4],
                primary_trigger: values[5],
                funnel_role: values[6],
                scalability: values[7],
            }
        })
    } catch {
        // Fallback: empty array if CSV not found
        _pocketsCache = []
    }

    return _pocketsCache
}

// ═══════════════════════════════════════════════
// CREATIVE DNA — Analisi pattern vincenti
// ═══════════════════════════════════════════════

export interface CreativeDNA {
    winning_patterns: {
        best_angle: string
        top_ads: { name: string; spend: number; leads: number; cpl: number; ctr: number; roas: number }[]
        avg_cpl_winners: number
        avg_ctr_winners: number
    }
    avoid_patterns: {
        killed_ads: { name: string; spend: number; leads: number; kill_reason: string }[]
    }
    distribution: Record<string, { active: number; target: number; deficit: number }>
}

/**
 * Analizza le performance delle ads per estrarre il "DNA creativo":
 * - Top ads per ROAS/CTR
 * - Ads killate (cosa evitare)
 * - Distribuzione per angolo con deficit
 */
export async function analyzeCreativeDNA(
    orgId: string,
    adMetrics: any[],           // Dati live da Meta API (ad-level)
    campaignBudgets: Record<string, number>,
    adsetAngles: Record<string, string>  // mapping adset_id → angle
): Promise<CreativeDNA> {
    const supabase = supabaseAdmin

    // 1. Fetch existing ad_creatives to see what's been killed
    const { data: existingCreatives } = await supabase
        .from('ad_creatives')
        .select('*')
        .eq('organization_id', orgId)

    const killedCreatives = (existingCreatives || [])
        .filter(c => c.status === 'killed')
        .slice(0, 10)
        .map(c => ({
            name: c.name,
            spend: Number(c.spend) || 0,
            leads: c.leads_count || 0,
            kill_reason: c.kill_reason || 'unknown',
        }))

    // 2. Analyze ad-level metrics from Meta
    const validAds = adMetrics.filter(a => (Number(a.spend) || 0) > 5)
    const topByROAS = [...validAds]
        .filter(a => (Number(a.leads_count) || 0) > 0)
        .sort((a, b) => {
            const roasA = Number(a.roas) || 0
            const roasB = Number(b.roas) || 0
            return roasB - roasA
        })
        .slice(0, 5)
        .map(a => ({
            name: a.ad_name || 'Ad',
            spend: Number(a.spend) || 0,
            leads: Number(a.leads_count) || 0,
            cpl: Number(a.cpl) || 0,
            ctr: Number(a.ctr) || 0,
            roas: Number(a.roas) || 0,
        }))

    const avgCPL = topByROAS.length > 0
        ? topByROAS.reduce((s, a) => s + a.cpl, 0) / topByROAS.length : 0
    const avgCTR = topByROAS.length > 0
        ? topByROAS.reduce((s, a) => s + a.ctr, 0) / topByROAS.length : 0

    // 3. Calculate distribution per angle
    // Group ads by AdSet → angle, count active vs target
    const activeByAngle: Record<string, number> = {}
    const budgetByAngle: Record<string, number> = {}

    adMetrics.forEach(ad => {
        const adsetId = ad.adset_id
        const angle = adsetAngles[adsetId] || 'unknown'
        if (!activeByAngle[angle]) activeByAngle[angle] = 0
        if (!budgetByAngle[angle]) budgetByAngle[angle] = 0

        if (ad.status === 'ACTIVE' || ad.effective_status === 'ACTIVE') {
            activeByAngle[angle]++
        }
    })

    // Calculate budget per angle from campaign budgets
    Object.entries(adsetAngles).forEach(([adsetId, angle]) => {
        // For CBO, budget is at campaign level — estimate per-adset budget
        const campaignId = adMetrics.find(a => a.adset_id === adsetId)?.campaign_id
        if (campaignId && campaignBudgets[campaignId]) {
            const adsetsInCampaign = Object.entries(adsetAngles)
                .filter(([_, a]) => adMetrics.find(ad => ad.adset_id === _ && ad.campaign_id === campaignId))
                .length || 1
            budgetByAngle[angle] = (budgetByAngle[angle] || 0) + (campaignBudgets[campaignId] / adsetsInCampaign)
        }
    })

    const distribution: Record<string, { active: number; target: number; deficit: number }> = {}
    const allAngles = new Set([...Object.keys(activeByAngle), ...Object.keys(budgetByAngle)])

    allAngles.forEach(angle => {
        if (angle === 'unknown') return
        const active = activeByAngle[angle] || 0
        const budget = budgetByAngle[angle] || 0
        // Best practice CBO: 3-5 ads per AdSet
        // €0-15/day → 3 ads, €15-30 → 4 ads, €30+ → 5 ads
        let target = 3
        if (budget >= 30) target = 5
        else if (budget >= 15) target = 4
        distribution[angle] = { active, target, deficit: Math.max(0, target - active) }
    })

    // Find best angle
    const bestAngle = Object.entries(distribution)
        .sort((a, b) => (activeByAngle[b[0]] || 0) - (activeByAngle[a[0]] || 0))
        [0]?.[0] || 'efficiency'

    return {
        winning_patterns: {
            best_angle: bestAngle,
            top_ads: topByROAS,
            avg_cpl_winners: avgCPL,
            avg_ctr_winners: avgCTR,
        },
        avoid_patterns: {
            killed_ads: killedCreatives,
        },
        distribution,
    }
}

// ═══════════════════════════════════════════════
// POCKET SELECTOR — Sceglie il pocket migliore
// ═══════════════════════════════════════════════

interface SelectedPocket extends BuyerPocket {
    selection_reason: string
}

/**
 * Seleziona il miglior Buyer Pocket per una nuova ad in un dato angolo.
 * 
 * Logica:
 * 1. Filtra i pocket compatibili con l'angolo dell'AdSet
 * 2. Escludi i pocket già usati in ads active/launched nello stesso AdSet
 * 3. Prioritizza pocket con scalability = 'High'
 */
export async function selectBuyerPocket(
    orgId: string,
    angle: string,
    targetAdsetId?: string
): Promise<SelectedPocket | null> {
    const supabase = supabaseAdmin
    const pockets = await loadBuyerPockets()

    // 1. Get compatible clusters for this angle
    const compatibleClusters = ANGLE_TO_CLUSTERS[angle] || []
    const compatiblePockets = pockets.filter(p => compatibleClusters.includes(p.cluster))

    if (compatiblePockets.length === 0) return null

    // 2. Get already used pocket_ids in active/launched ads for this adset
    let usedPocketIds: number[] = []
    if (targetAdsetId) {
        const { data: existingAds } = await supabase
            .from('ad_creatives')
            .select('pocket_id')
            .eq('organization_id', orgId)
            .eq('target_adset_id', targetAdsetId)
            .in('status', ['active', 'launched', 'approved', 'ready'])
            .not('pocket_id', 'is', null)

        usedPocketIds = (existingAds || []).map(a => a.pocket_id).filter(Boolean)
    }

    // 3. Filter out already used pockets
    const availablePockets = compatiblePockets.filter(p => !usedPocketIds.includes(p.pocket_id))

    // If all pockets used, return null (no more unique angles to try)
    if (availablePockets.length === 0) {
        // Fallback: pick from ALL compatible pockets (allow reuse)
        const highScalability = compatiblePockets.filter(p => p.scalability === 'High')
        const pick = highScalability.length > 0
            ? highScalability[Math.floor(Math.random() * highScalability.length)]
            : compatiblePockets[Math.floor(Math.random() * compatiblePockets.length)]
        return { ...pick, selection_reason: 'Riuso forzato — tutti i pocket sono già stati usati' }
    }

    // 4. Prioritize: High scalability > Medium > Low
    const highScalability = availablePockets.filter(p => p.scalability === 'High')
    const mediumScalability = availablePockets.filter(p => p.scalability === 'Medium')

    let selected: BuyerPocket
    let reason: string

    if (highScalability.length > 0) {
        selected = highScalability[Math.floor(Math.random() * highScalability.length)]
        reason = `Pocket ad alta scalabilità, mai testato in questo AdSet`
    } else if (mediumScalability.length > 0) {
        selected = mediumScalability[Math.floor(Math.random() * mediumScalability.length)]
        reason = `Pocket a media scalabilità (tutti quelli High sono già in uso)`
    } else {
        selected = availablePockets[Math.floor(Math.random() * availablePockets.length)]
        reason = `Pocket a bassa scalabilità — unico rimasto disponibile`
    }

    return { ...selected, selection_reason: reason }
}

// ═══════════════════════════════════════════════
// BRIEF GENERATOR — Crea il brief per la nuova ad
// ═══════════════════════════════════════════════

export interface CreativeBrief {
    name: string
    angle: string
    pocket: SelectedPocket
    adset: { id: string; name: string; utm_term: string }
    copy: { primary: string; headline: string; description: string }
    image_prompt: string
    cta_type: string
    aspect_ratio: string
    winning_context: {
        top_ads_summary: string
        avg_cpl: number
        avg_ctr: number
    }
}

/**
 * Genera un brief creativo completo per una nuova ad.
 * Include: copy ottimizzato, prompt per immagine 4:5, e contesto dei vincenti.
 */
export async function generateCreativeBrief(
    orgId: string,
    angle: string,
    adset: { id: string; name: string; utm_term: string },
    dna: CreativeDNA
): Promise<CreativeBrief | null> {
    // 1. Select the best buyer pocket for this angle
    const pocket = await selectBuyerPocket(orgId, angle, adset.id)
    if (!pocket) return null

    // 2. Generate copy based on pocket + winning patterns
    const copy = generateCopyFromPocket(pocket, angle)

    // 3. Generate image prompt for 4:5 format
    const imagePrompt = generateImagePrompt(pocket, angle, dna)

    // 4. Create the brief name
    const pocketShort = pocket.pocket_name.replace(/\s+/g, '_').substring(0, 20)
    const briefName = `${angle}_${pocketShort}_${Date.now()}`

    // 5. Summarize winning context
    const topAdsSummary = dna.winning_patterns.top_ads.length > 0
        ? `Top performer: ${dna.winning_patterns.top_ads[0].name} (CPL €${dna.winning_patterns.top_ads[0].cpl.toFixed(2)}, CTR ${dna.winning_patterns.top_ads[0].ctr.toFixed(2)}%)`
        : 'Nessun dato di performance disponibile'

    return {
        name: briefName,
        angle,
        pocket,
        adset,
        copy,
        image_prompt: imagePrompt,
        cta_type: 'LEARN_MORE',
        aspect_ratio: '4:5',
        winning_context: {
            top_ads_summary: topAdsSummary,
            avg_cpl: dna.winning_patterns.avg_cpl_winners,
            avg_ctr: dna.winning_patterns.avg_ctr_winners,
        },
    }
}

// ═══════════════════════════════════════════════
// COPY GENERATOR — Crea copy da pocket + angolo
// ═══════════════════════════════════════════════

function generateCopyFromPocket(
    pocket: SelectedPocket,
    angle: string
): { primary: string; headline: string; description: string } {
    // Copy templates per buyer state e trigger
    const { buyer_state, core_question, primary_trigger, pocket_name } = pocket

    // Il copy è costruito attorno alla core_question del pocket
    // e al trigger che lo fa scattare
    const copyTemplates: Record<string, (p: SelectedPocket) => { primary: string; headline: string; description: string }> = {
        efficiency: (p) => ({
            primary: `${p.core_question}\n\nIl 90% dei giovani calciatori con il talento giusto non arriva mai dove potrebbe. Non per le gambe. Per la testa.\n\nMetodo Sincro lavora sulla mente — l'unica variabile che nessun allenatore ti insegna a controllare.`,
            headline: `Metodo Sincro — ${p.primary_trigger}`,
            description: `Il sistema mentale per giovani calciatori che vogliono rendere al massimo.`,
        }),
        system: (p) => ({
            primary: `${p.core_question}\n\nNon serve più talento. Serve un sistema.\n\nMetodo Sincro è il protocollo mentale che trasforma la pressione in performance. Testato su centinaia di giovani calciatori.`,
            headline: `Il Sistema Mentale — ${p.primary_trigger}`,
            description: `Il protocollo strutturato per la performance mentale nel calcio.`,
        }),
        emotional: (p) => ({
            primary: `${p.core_question}\n\nQuando la pressione sale, il talento scompare. Non è colpa tua — è che nessuno ti ha insegnato a gestire quello che senti dentro.\n\nMetodo Sincro ti dà il controllo.`,
            headline: `Basta Sovraccarico — ${p.primary_trigger}`,
            description: `Libera il tuo potenziale mentale con Metodo Sincro.`,
        }),
        status: (p) => ({
            primary: `${p.core_question}\n\nI calciatori che arrivano non sono quelli con più talento. Sono quelli che sanno come apparire, come comunicare sicurezza, come dominare mentalmente.\n\nMetodo Sincro è il codice mentale dell'élite.`,
            headline: `Mentalità da Pro — ${p.primary_trigger}`,
            description: `Distinguiti. Il talento non basta — la mentalità fa la differenza.`,
        }),
    }

    const template = copyTemplates[angle] || copyTemplates.efficiency
    return template(pocket)
}

// ═══════════════════════════════════════════════
// IMAGE PROMPT — Genera il prompt per l'immagine
// ═══════════════════════════════════════════════

function generateImagePrompt(pocket: SelectedPocket, angle: string, dna: CreativeDNA): string {
    const baseStyle = `Cinematic vertical 4:5 photo, dark moody atmosphere with golden accent lighting, high contrast, professional sports photography style. NO text overlay, NO logos, NO watermarks.`

    const angleVisuals: Record<string, string> = {
        efficiency: `A young male soccer player (16-18 years old) standing alone in a massive empty stadium at twilight. Split lighting — one half in shadow, one half illuminated by golden light. Expression: focused, determined, intense. The emptiness of the stadium contrasts with his inner fire.`,
        system: `A young male soccer player (16-18 years old) in a controlled training environment. Geometric lines and grid patterns visible in the background (suggesting structure/system). Expression: calm, calculated, in control. Clean aesthetic, precision.`,
        emotional: `A young male soccer player (16-18 years old) sitting alone on a bench in a dim locker room. Head slightly bowed, hands clasped. Dramatic chiaroscuro lighting. Expression: introspective, overwhelmed but not defeated. Raw emotion.`,
        status: `A young male soccer player (16-18 years old) walking through a tunnel towards a brightly lit pitch. Silhouette from behind, golden light ahead. Wide shot showing the scale. Expression not visible — the composition tells the story of aspiration.`,
    }

    const visual = angleVisuals[angle] || angleVisuals.efficiency

    // Add pocket-specific nuance
    const pocketNuance = `The mood should evoke the feeling of "${pocket.core_question}" — the viewer should feel the "${pocket.buyer_state}" state and the pull of "${pocket.primary_trigger}".`

    return `${baseStyle}\n\n${visual}\n\n${pocketNuance}`
}

// ═══════════════════════════════════════════════
// PIPELINE ORCHESTRATOR — Gestisce il ciclo completo
// ═══════════════════════════════════════════════

export interface PipelineResult {
    briefs_generated: CreativeBrief[]
    total_deficit: number
    angles_analyzed: string[]
    skipped_reasons: string[]
}

/**
 * Orchestratore principale del circuito chiuso.
 * Chiamato dal cron job o da Force Run.
 * 
 * 1. Calcola il deficit per ogni AdSet/angolo
 * 2. Analizza i pattern vincenti
 * 3. Genera i brief per le ads mancanti
 * 4. Salva i brief come ad_creatives con status 'ready'
 * 
 * SAFETY GUARDS:
 * - Max 3 ads generate per ciclo
 * - Cooldown 24h per lo stesso angolo
 * - Check duplicati pocket
 */
export async function runCreativePipeline(
    orgId: string,
    adMetrics: any[],
    campaignBudgets: Record<string, number>,
    adsetAngles: Record<string, string>,    // adset_id → angle
    adsetNames: Record<string, string>,     // adset_id → name
    adsetUtmTerms: Record<string, string>,  // adset_id → utm_term
): Promise<PipelineResult> {
    const supabase = supabaseAdmin
    const MAX_BRIEFS_PER_CYCLE = 3
    const COOLDOWN_HOURS = 24

    const result: PipelineResult = {
        briefs_generated: [],
        total_deficit: 0,
        angles_analyzed: [],
        skipped_reasons: [],
    }

    // 1. Analyze Creative DNA
    const dna = await analyzeCreativeDNA(orgId, adMetrics, campaignBudgets, adsetAngles)

    // 2. Check cooldown — don't generate if we generated recently
    const cooldownSince = new Date(Date.now() - COOLDOWN_HOURS * 60 * 60 * 1000).toISOString()
    const { data: recentCreatives } = await supabase
        .from('ad_creatives')
        .select('angle, created_at')
        .eq('organization_id', orgId)
        .eq('created_by', 'ai_engine')
        .gte('created_at', cooldownSince)

    const recentAngles = new Set((recentCreatives || []).map(c => c.angle))

    // 3. For each angle with deficit, generate briefs
    const sortedAngles = Object.entries(dna.distribution)
        .filter(([_, d]) => d.deficit > 0)
        .sort((a, b) => b[1].deficit - a[1].deficit) // Highest deficit first

    let briefsGenerated = 0

    for (const [angle, dist] of sortedAngles) {
        if (briefsGenerated >= MAX_BRIEFS_PER_CYCLE) {
            result.skipped_reasons.push(`Max ${MAX_BRIEFS_PER_CYCLE} brief per ciclo raggiunto`)
            break
        }

        result.angles_analyzed.push(angle)
        result.total_deficit += dist.deficit

        // Check cooldown for this angle
        if (recentAngles.has(angle)) {
            result.skipped_reasons.push(`${angle}: cooldown 24h attivo (ads già generate di recente)`)
            continue
        }

        // Find the adset for this angle
        const adsetEntry = Object.entries(adsetAngles).find(([_, a]) => a === angle)
        if (!adsetEntry) {
            result.skipped_reasons.push(`${angle}: nessun AdSet attivo trovato`)
            continue
        }

        const [adsetId] = adsetEntry
        const adset = {
            id: adsetId,
            name: adsetNames[adsetId] || `AdSet ${angle}`,
            utm_term: adsetUtmTerms[adsetId] || angle,
        }

        // Generate brief (1 per cycle per angle to avoid spam)
        const brief = await generateCreativeBrief(orgId, angle, adset, dna)
        if (!brief) {
            result.skipped_reasons.push(`${angle}: impossibile generare brief (pocket esauriti?)`)
            continue
        }

        // 4. Save to ad_creatives with status 'ready'
        const { error } = await supabase
            .from('ad_creatives')
            .insert({
                organization_id: orgId,
                name: brief.name,
                angle: brief.angle,
                pocket_id: brief.pocket.pocket_id,
                pocket_name: brief.pocket.pocket_name,
                buyer_state: brief.pocket.buyer_state,
                core_question: brief.pocket.core_question,
                target_adset_id: brief.adset.id,
                target_adset_name: brief.adset.name,
                landing_utm_term: brief.adset.utm_term,
                copy_primary: brief.copy.primary,
                copy_headline: brief.copy.headline,
                copy_description: brief.copy.description,
                cta_type: brief.cta_type,
                aspect_ratio: brief.aspect_ratio,
                brief_data: {
                    image_prompt: brief.image_prompt,
                    winning_context: brief.winning_context,
                    pocket_selection_reason: brief.pocket.selection_reason,
                },
                winning_patterns: dna.winning_patterns,
                status: 'ready',
                created_by: 'ai_engine',
            })

        if (error) {
            result.skipped_reasons.push(`${angle}: errore salvataggio — ${error.message}`)
            continue
        }

        result.briefs_generated.push(brief)
        briefsGenerated++
    }

    return result
}
