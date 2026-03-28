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

import { createClient, SupabaseClient } from '@supabase/supabase-js'

function getSupabaseAdmin() {
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!serviceKey) {
        throw new Error('SUPABASE_SERVICE_ROLE_KEY is missing in environment variables. Cannot initialize Supabase Admin client.')
    }
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        serviceKey,
    )
}

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
        top_ads: { name: string; spend: number; leads: number; cpl: number; ctr: number; roas: number; headline?: string; primary?: string; angle?: string }[]
        avg_cpl_winners: number
        avg_ctr_winners: number
        pattern_analysis: string  // AI-extracted analysis of WHY winners work
    }
    avoid_patterns: {
        killed_ads: { name: string; spend: number; leads: number; kill_reason: string }[]
    }
    distribution: Record<string, { active: number; target: number; deficit: number }>
    total_budget_daily: number
    total_active_ads: number
    total_target_ads: number
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
    const supabase = getSupabaseAdmin()

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
    // Sort by best CPL (lowest cost per lead = most efficient)
    const topByPerformance = [...validAds]
        .filter(a => (Number(a.leads_count) || 0) > 0)
        .sort((a, b) => {
            const cplA = Number(a.cpl) || Infinity
            const cplB = Number(b.cpl) || Infinity
            return cplA - cplB // Best CPL first
        })
        .slice(0, 5)
        .map(a => {
            const c = (existingCreatives || []).find(ec => ec.name === a.ad_name)
            return {
                name: a.ad_name || 'Ad',
                spend: Number(a.spend) || 0,
                leads: Number(a.leads_count) || 0,
                cpl: Number(a.cpl) || 0,
                ctr: Number(a.ctr) || 0,
                roas: Number(a.roas) || 0,
                headline: c?.copy_headline || '',
                primary: c?.copy_primary || '',
                angle: c?.angle || adsetAngles[a.adset_id] || ''
            }
        })

    const avgCPL = topByPerformance.length > 0
        ? topByPerformance.reduce((s, a) => s + a.cpl, 0) / topByPerformance.length : 0
    const avgCTR = topByPerformance.length > 0
        ? topByPerformance.reduce((s, a) => s + a.ctr, 0) / topByPerformance.length : 0

    // 3. Analyze WHY winners work (extract patterns via AI)
    let patternAnalysis = 'Nessun dato sufficiente per l\'analisi dei pattern.'
    if (topByPerformance.length >= 2) {
        const winnersForAnalysis = topByPerformance
            .filter(a => a.headline || a.primary)
            .map(a => `[Angle: ${a.angle}] CPL €${a.cpl.toFixed(2)}, CTR ${a.ctr.toFixed(2)}%\nHeadline: "${a.headline}"\nBody: "${(a.primary || '').substring(0, 250)}"`)
            .join('\n---\n')
        if (winnersForAnalysis) {
            try {
                const analysisRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}` },
                    body: JSON.stringify({
                        model: 'google/gemini-2.5-flash',
                        messages: [{ role: 'system', content: `Analizza queste top ads vincenti per Metodo Sincro (mental coaching per giovani calciatori, target: genitori). Estrai in 4-5 bullet point i PATTERN COMUNI che le rendono efficaci: tipo di hook, leva emotiva, struttura del copy, tono, CTA. Rispondi in italiano, massimo 300 parole.\n\nADS VINCENTI:\n${winnersForAnalysis}` }],
                        temperature: 0.3,
                    }),
                })
                if (analysisRes.ok) {
                    const analysisData = await analysisRes.json()
                    patternAnalysis = analysisData.choices?.[0]?.message?.content || patternAnalysis
                }
            } catch { /* fallback to default */ }
        }
    }

    // 4. Calculate distribution per angle — META ANDROMEDA CBO BEST PRACTICES
    // Total budget determines total target ads, then distribute proportionally
    const totalDailyBudget = Object.values(campaignBudgets).reduce((s, b) => s + b, 0)
    
    // Andromeda CBO recommended active ads based on total daily budget
    let totalTargetAds: number
    if (totalDailyBudget >= 300) totalTargetAds = 12
    else if (totalDailyBudget >= 150) totalTargetAds = 10
    else if (totalDailyBudget >= 50) totalTargetAds = 7
    else totalTargetAds = 5

    // Count active ads per angle
    const activeByAngle: Record<string, number> = {}
    adMetrics.forEach(ad => {
        const angle = adsetAngles[ad.adset_id] || 'unknown'
        if (angle === 'unknown') return
        if (ad.status === 'ACTIVE' || ad.effective_status === 'ACTIVE') {
            activeByAngle[angle] = (activeByAngle[angle] || 0) + 1
        }
    })

    const totalActiveAds = Object.values(activeByAngle).reduce((s, n) => s + n, 0)
    const knownAngles = [...new Set(Object.values(adsetAngles).filter(a => a !== 'unknown'))]
    const numAngles = knownAngles.length || 1

    // Distribute target proportionally across angles (min 2 per angle)
    const distribution: Record<string, { active: number; target: number; deficit: number }> = {}
    const basePerAngle = Math.max(2, Math.floor(totalTargetAds / numAngles))

    knownAngles.forEach(angle => {
        const active = activeByAngle[angle] || 0
        const target = basePerAngle
        distribution[angle] = { active, target, deficit: Math.max(0, target - active) }
    })

    // Find best performing angle (lowest CPL)
    const cplByAngle: Record<string, { spend: number; leads: number }> = {}
    adMetrics.forEach(ad => {
        const angle = adsetAngles[ad.adset_id] || 'unknown'
        if (angle === 'unknown') return
        if (!cplByAngle[angle]) cplByAngle[angle] = { spend: 0, leads: 0 }
        cplByAngle[angle].spend += Number(ad.spend) || 0
        cplByAngle[angle].leads += Number(ad.leads_count) || 0
    })
    const bestAngle = Object.entries(cplByAngle)
        .filter(([_, d]) => d.leads > 0)
        .sort((a, b) => (a[1].spend / a[1].leads) - (b[1].spend / b[1].leads))
        [0]?.[0] || knownAngles[0] || 'efficiency'

    return {
        winning_patterns: {
            best_angle: bestAngle,
            top_ads: topByPerformance,
            avg_cpl_winners: avgCPL,
            avg_ctr_winners: avgCTR,
            pattern_analysis: patternAnalysis,
        },
        avoid_patterns: {
            killed_ads: killedCreatives,
        },
        distribution,
        total_budget_daily: totalDailyBudget,
        total_active_ads: totalActiveAds,
        total_target_ads: totalTargetAds,
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
    const supabase = getSupabaseAdmin()
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
    image_url?: string
}

/**
 * Genera un brief creativo completo per una nuova ad.
 * Include: copy ottimizzato, prompt per immagine 4:5, e contesto dei vincenti.
 * Il copywriter AI genera SIA il copy SIA la descrizione dell'immagine,
 * che viene poi passata al generatore di prompt per Nano Banana.
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

    // 2. Generate copy + image description based on pocket + winning patterns
    const copy = await generateCopyFromPocket(pocket, angle, dna)

    // 3. Generate image prompt using the AI-generated image_description and headline
    const imagePrompt = generateImagePrompt(pocket, angle, dna, copy.image_description, copy.headline)

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
// COPY GENERATOR — Crea copy da pocket + angolo con AI reale
// Inietta pattern vincenti estratti dalle top ads
// ═══════════════════════════════════════════════

async function generateCopyFromPocket(
    pocket: SelectedPocket,
    angle: string,
    dna?: CreativeDNA
): Promise<{ primary: string; headline: string; description: string; image_description: string }> {
    const { buyer_state, core_question, primary_trigger, pocket_name } = pocket

    // Build rich winning context from DNA
    let winningContextSection = ''
    if (dna && dna.winning_patterns) {
        const { top_ads, pattern_analysis, avg_cpl_winners, avg_ctr_winners, best_angle } = dna.winning_patterns

        if (top_ads.length > 0) {
            winningContextSection += `\n\n═══ ANALISI ADS VINCENTI (DATI REALI) ═══\n`
            winningContextSection += `📊 Performance medie dei vincitori: CPL €${avg_cpl_winners.toFixed(2)}, CTR ${avg_ctr_winners.toFixed(2)}%\n`
            winningContextSection += `🏆 Angolo migliore: ${best_angle}\n\n`

            // Include top 3 ads with FULL copy
            top_ads.slice(0, 3).forEach((ad, i) => {
                winningContextSection += `--- AD #${i + 1}: "${ad.name}" (CPL €${ad.cpl.toFixed(2)}, CTR ${ad.ctr.toFixed(2)}%, ${ad.leads} lead) ---\n`
                winningContextSection += `Angolo: ${ad.angle}\n`
                if (ad.headline) winningContextSection += `Headline: "${ad.headline}"\n`
                if (ad.primary) winningContextSection += `Body completo:\n"${ad.primary}"\n\n`
            })

            // Include AI-extracted pattern analysis
            if (pattern_analysis && pattern_analysis !== 'Nessun dato sufficiente per l\'analisi dei pattern.') {
                winningContextSection += `\n═══ PATTERN VINCENTI ESTRATTI ═══\n${pattern_analysis}\n`
            }
        }

        // Include what to avoid
        if (dna.avoid_patterns.killed_ads.length > 0) {
            winningContextSection += `\n═══ DA EVITARE (ads killate) ═══\n`
            dna.avoid_patterns.killed_ads.slice(0, 3).forEach(ad => {
                winningContextSection += `❌ "${ad.name}" — Spesa €${ad.spend.toFixed(2)}, ${ad.leads} lead, Motivo: ${ad.kill_reason}\n`
            })
        }
    }

    const systemPrompt = `Sei un esperto copywriter di Metodo Sincro, un sistema di mental coaching per giovani calciatori.
Devi scrivere il copy per una nuova ad di Facebook E descrivere l'immagine ideale per accompagnarla.

═══ REGOLE FONDAMENTALI ═══
1. TARGET CRITICO: L'ad si rivolge ai GENITORI (madri e padri) di giovani calciatori. Usa "tuo figlio", "tuo ragazzo", "come genitore". Il target è ampio (figli dai 10 ai 20+ anni), quindi NON menzionare MAI un'età specifica nel copy (non scrivere "16-18 anni" o simili). Parla genericamente di "giovani calciatori" o "tuo figlio".
2. LINGUA: Scrivi TASSATIVAMENTE e SOLTANTO in lingua ITALIANA.
3. TONO: Persuasivo, diretto, emotivamente profondo ma pratico.
4. FORMATTAZIONE E IMPAGINAZIONE: Il copy deve essere ESTREMAMENTE leggibile e scansionabile da mobile.
   - Usa frasi corte e paragrafi di massimo 1-2 righe.
   - Inserisci SEMPRE una riga vuota tra un concetto e l'altro (usa doppi a capo \n\n).
   - Usa emoji strategiche (es. ⚽, 🧠, ⚠️, 🚀, ✅,👇) per catturare l'attenzione e guidare lo sguardo, senza sembrare spam.
   - Usa bullet points per gli elenchi. Niente muri di testo.

═══ STRUTTURA OBBLIGATORIA DEL COPY (I 4 PILASTRI) ═══
A. CATTURA L'ATTENZIONE: Le primissime tre parole devono bloccare lo scroll del genitore.
B. GIOCA FUORI DAGLI SCHEMI: Non essere banale. Usa un "pattern interrupt", ribalta le prospettive standard di chi pensa che serva solo l'allenamento fisico.
C. UN MESSAGGIO CHIARO: Spiega la soluzione (la mentalità e il Metodo Sincro) in modo semplice, senza paroloni complessi.
D. MOSTRA IMMEDIATAMENTE DI COSA SI TRATTA: Fai emergere subito il contesto calcistico e il problema emotivo/razionale affrontato.

═══ REGOLE AGGIUNTIVE ═══
5. CONTESTO SPORTIVO: Stiamo parlando di CALCIO (soccer). Il copy DEVE far capire chiaramente che parliamo di calcio e calciatori. Usa riferimenti al campo, alla partita, agli allenamenti, al mister, alla squadra.
6. REPLICA I PATTERN VINCENTI: Studia attentamente le ads vincenti sotto e replica il loro stile, le leve emotive, la struttura del copy. Adatta al nuovo angolo/pocket.
7. MAI MENZIONARE ETÀ SPECIFICHE: Non scrivere "16-18 anni", "tra i 15 e i 17", etc. Ragiona per fasi: "giovane calciatore", "ragazzo che gioca a calcio", "tuo figlio che si allena".
8. AUTORITÀ (CONI): Per aumentare la trust, se appropriato, puoi citare nel copy che abbiamo "Mental Coach con diploma nazionale rilasciato dal CONI". IMPORTANTE: NON chiedere mai all'AI delle immagini di disegnare loghi del CONI.
${winningContextSection}

═══ BRIEF PER LA NUOVA AD ═══
• Buyer Pocket: "${pocket_name}"
• Stato d'animo del genitore target: "${buyer_state}"
• Domanda fondamentale: "${core_question}"
• Trigger principale di conversione: "${primary_trigger}"
• Angolo narrativo: "${angle}"

═══ OUTPUT RICHIESTO (JSON) ═══
Rispondi ESATTAMENTE e SOLO con un oggetto JSON valido con 4 chiavi:
- "primary": il testo lungo del post (testo persuasivo ben impaginato con emoji, doppi spazi tra i brevi paragrafi '\\n\\n', e alta scansionabilità)
- "headline": il titolo dell'ad (massimo 6 parole, impattante)
- "description": il sottotitolo dell'ad (massimo 8 parole)
- "image_description": una descrizione ULTRA-DETTAGLIATA (minimo 100 parole) dell'immagine perfetta per questa ad. L'immagine DEVE essere chiaramente legata al CALCIO/SOCCER. Descrivi dettagliatamente: ambientazione (stadio di calcio, spogliatoio con maglie appese, campo da calcio con righe bianche, porta da calcio sullo sfondo), illuminazione (golden hour, chiaroscuro, drammatica), soggetto (un CALCIATORE maschio di 17-19 anni in divisa da calcio con pallone, scarpini da calcio, parastinchi — MAI bambini), espressione facciale, postura, ELEMENTI CALCISTICI OBBLIGATORI (pallone da calcio, reti della porta, linee del campo, corner flag, panchina), palette colori, angolazione della camera. Questa descrizione sarà usata da un AI per generare l'immagine, quindi sii il più specifico possibile. IL CALCIO DEVE ESSERE IMMEDIATAMENTE RICONOSCIBILE.`

    try {
        const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
            },
            body: JSON.stringify({
                model: 'google/gemini-2.5-flash',
                messages: [{ role: 'system', content: systemPrompt }],
                temperature: 0.7,
            }),
        })

        if (!res.ok) throw new Error('OpenRouter API error')
        
        const data = await res.json()
        const reply = data.choices?.[0]?.message?.content || ''
        
        // Estrai JSON
        const jsonMatch = reply.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0])
            return {
                primary: parsed.primary || `${core_question}\n\nScopri Metodo Sincro.`,
                headline: parsed.headline || `Metodo Sincro — ${primary_trigger}`,
                description: parsed.description || `Sblocca il tuo potenziale mentale.`,
                image_description: parsed.image_description || '',
            }
        }
    } catch (e) {
        console.error('Copy gen error:', e)
    }

    // Fallback in caso di errore
    return {
        primary: `${core_question}\n\nIl 90% dei giovani calciatori con il talento giusto non arriva mai dove potrebbe. Non per le gambe. Per la testa.\n\nMetodo Sincro lavora sulla mente — l'unica variabile che nessun allenatore ti insegna a controllare.`,
        headline: `Metodo Sincro — ${primary_trigger}`,
        description: `Il sistema mentale per giovani calciatori.`,
        image_description: '',
    }
}

// ═══════════════════════════════════════════════
// IMAGE PROMPT — Genera il prompt dettagliato per Nano Banana
// Usa la image_description dal copywriter + regole visive
// ═══════════════════════════════════════════════

function generateImagePrompt(pocket: SelectedPocket, angle: string, dna: CreativeDNA, imageDescription?: string, headline?: string): string {
    const baseRules = `STRICT TECHNICAL RULES:
- Format: Vertical 4:5 aspect ratio photograph (Mobile optimized for highest CTR)
- Style: Cinematic, high-impact, professional SOCCER/FOOTBALL sports photography
- Composition: Use a single focal point. Focus heavily on human emotion, tension, and eye contact to act as a "pattern interrupt" and stop the scroll.
- Lighting: Dark moody atmosphere with vibrant golden/amber or neon accent lighting. Use extreme contrast.
- Camera: Shot on Sony A7III with 85mm f/1.4 lens, shallow depth of field (blur the background strictly)
- ABSOLUTELY NO logos, NO brand names, NO watermarks
- ABSOLUTELY NO CHILDREN, NO LITTLE BOYS — the subject must be an older teenager (17-19 years old) who looks like a young adult almost ready for professional leagues
- Color grading: High contrast, visceral color pops. AVOID generic blue/white palettes which blend into the Facebook UI. Use striking dark teal shadows with warm golden high-contrast highlights.

MANDATORY MARKETING GUIDELINES (4 PILLARS):
1. CATTURA L'ATTENZIONE: The image must be a scroll-stopper. Use intense emotional hooks, aggressive lighting, and pattern interrupts.
2. GIOCA FUORI DAGLI SCHEMI: Avoid boring, standard sports stock-photo vibes. Be unconventional, cinematic, and thought-provoking.
3. UN MESSAGGIO CHIARO: The visual metaphor must be instantly readable by a busy parent scrolling their feed.
4. MOSTRA IMMEDIATAMENTE DI COSA SI TRATTA: The soccer/football context (pitch, ball, kit) and the core emotional struggle MUST be blindingly obvious in the first 0.1 seconds of viewing.

MANDATORY SOCCER/FOOTBALL ELEMENTS (at least 3 must be clearly visible):
- A recognizable soccer/football ball (white with black pentagons or modern design)
- Soccer pitch/field with visible white lines, penalty area, center circle, or corner arc
- Soccer goal with net visible in background or foreground
- Soccer cleats/boots (no brand logos but recognizable form)
- Soccer jersey/kit — a proper football shirt, shorts, long socks
- Soccer training equipment (agility ladders, hurdles, or tactical board) — DO NOT use training cones.
- Corner flags, touchline, dugout/bench area
THE IMAGE MUST BE IMMEDIATELY RECOGNIZABLE AS SOCCER/FOOTBALL — not generic sports.`

    const textOverlayStr = headline ? `\n\n═══ TYPOGRAPHY OVERLAY (MAXIMIZE CTR) ═══\nAdd massive, ultra-bold, high-impact typography at the top of the image reading exactly: "${headline}". \nThe text MUST serve as a scroll-stopper: use vibrant, high-contrast colors (like electric yellow, bright orange, or pure white against a dark background). The typography should pop out of the screen using subtle drop shadows or neon glow. It must look like a high-end, aggressive sports advertising poster (e.g., Nike/Adidas). Ensure perfect legibility for mobile screens.` : ''

    // If copywriter provided a detailed image description, use it as primary direction
    if (imageDescription && imageDescription.length > 50) {
        return `${baseRules}\n\n═══ SCENE DESCRIPTION ═══\n${imageDescription}\n\n═══ CRITICAL REMINDER ═══\nThe scene MUST clearly show this is SOCCER/FOOTBALL. Include: soccer ball, pitch markings, goal nets, cleats, or jersey. A viewer scrolling Facebook must instantly recognize this is about football.${textOverlayStr}\n\n═══ EMOTIONAL CONTEXT ═══\nThe image must evoke the emotional state: "${pocket.buyer_state}"\nThe viewer (a parent) should feel the tension of: "${pocket.core_question}"\nThe visual should trigger: "${pocket.primary_trigger}"`
    }

    // Fallback: angle-based templates with prominent soccer elements
    const playerDesc = `An older teenage male SOCCER PLAYER (17-19 years old), athletic build, wearing a dark football kit (jersey, shorts, long socks) and soccer cleats. MUST look like a young adult.`

    const angleScenes: Record<string, string> = {
        efficiency: `${playerDesc} Standing alone in the center circle of a massive empty soccer stadium at golden hour. A white soccer ball sits at his feet on the perfectly manicured green pitch. White pitch lines are crisp and visible. Split lighting — one half of his face in deep shadow, one half illuminated by warm golden sunlight streaming through the stands. He's looking directly at camera with fierce determination. The soccer goal with net is visible in the background, slightly out of focus. Shallow depth of field blurs the distant seats into golden bokeh. His soccer cleats grip the turf.`,
        system: `${playerDesc} In a state-of-the-art soccer training facility. He's mid-drill moving through agility ladders on a green artificial pitch with white lines. A tactical formation board is visible to one side. His body shows perfect form — low center of gravity, ball close to his feet. A soccer ball is mid-touch at his right foot. Expression: calm, calculating, completely in control. Geometric training markers on the ground create lines converging at him. Shot from a low angle making him look powerful. A goal with net visible behind.`,
        emotional: `${playerDesc} Sitting alone on a wooden bench in a dimly lit soccer locker room. Rows of team jerseys hang on hooks behind him. His soccer cleats are on the floor next to a ball. His head is slightly bowed, hands clasped between his knees. A single overhead light creates dramatic chiaroscuro. His football jersey is slightly disheveled, number visible on the back of a teammate's shirt hanging nearby. Expression: deep introspection, carrying weight, but with resolve in his eyes. Intimate close-up. Shin guards rest on the bench beside him.`,
        status: `${playerDesc} Walking alone through a player tunnel towards a brilliantly lit soccer pitch. Shot from behind, his silhouette framed by the tunnel. He's carrying a soccer ball under his arm. His cleats click on the concrete. Through the tunnel exit, the lush green pitch, white goal posts with net, and stadium lights are visible. Dramatic backlight floods through creating a halo of golden light. The pitch markings (center circle, penalty box) glow in the distance. Wide cinematic framing.`,
        education: `${playerDesc} On a misty soccer training pitch at dawn, alone. He's studying a tactical whiteboard showing football formations (4-3-3, passing triangles). Soccer balls are scattered around the pitch. Agility ladders and hurdles mark drills. One hand on his chin, analyzing. Morning fog creates atmospheric depth over the green pitch with white line markings. A goal with net is visible through the mist. Warm sunrise light backlights the scene. His expression is studious, hungry to learn.`,
        growth: `${playerDesc} Standing at the edge of a professional soccer pitch, one foot on a ball, looking out at the vast green field stretching ahead. Soccer goal with net visible at the far end. Shot from a 3/4 angle behind him, showing his profile. Pitch markings (touchline, penalty area) are crisp. Golden hour light catches the edge of his face and glints off his soccer cleats. His posture is upright — ready to step onto the field. Corner flags flutter in a light breeze. The composition emphasizes the threshold moment.`,
    }

    const scene = angleScenes[angle] || angleScenes.efficiency

    return `${baseRules}\n\n═══ SCENE ═══\n${scene}${textOverlayStr}\n\n═══ EMOTIONAL CONTEXT ═══\nThe image must resonate with a parent who feels: "${pocket.buyer_state}"\nIt should visually answer: "${pocket.core_question}"\nThe visual trigger is: "${pocket.primary_trigger}"`
}

// ═══════════════════════════════════════════════
// PIPELINE ORCHESTRATOR — Gestisce il ciclo completo
// ═══════════════════════════════════════════════

export interface PipelineResult {
    briefs_generated: CreativeBrief[]
    images_generated: number
    image_errors: string[]
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
/**
 * Esegue la pipeline creativa in autonomia, recuperando prima i dati da Meta.
 * Usa la stessa logica di dante-actions e del cron-job.
 */
export async function runFullPipelineWithApiFetch(orgId: string): Promise<PipelineResult> {
    const supabase = getSupabaseAdmin()

    // 1. Get Meta credentials
    const { data: conn } = await supabase
        .from('connections')
        .select('credentials')
        .eq('organization_id', orgId)
        .eq('provider', 'meta_ads')
        .eq('status', 'active')
        .single()

    if (!conn?.credentials?.access_token) {
        throw new Error('Meta API non connessa')
    }

    const { access_token, ad_account_id } = conn.credentials
    const adAccount = `act_${ad_account_id}`
    const META_API_VERSION = 'v21.0'

    // 2. Fetch weekly insights from Meta
    const today = new Date().toISOString().slice(0, 10)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
    
    const insightsUrl = `https://graph.facebook.com/${META_API_VERSION}/${adAccount}/insights?` +
        `fields=ad_id,ad_name,adset_id,adset_name,campaign_id,campaign_name,spend,impressions,clicks,ctr,actions,cost_per_action_type` +
        `&level=ad&time_range=${encodeURIComponent(JSON.stringify({ since: sevenDaysAgo, until: today }))}&limit=500&access_token=${access_token}`

    const insightsRes = await fetch(insightsUrl)
    if (!insightsRes.ok) throw new Error('Errore download metriche Meta')
    const insightsData = await insightsRes.json()

    const ads = (insightsData.data || []).map((insight: any) => {
        const leadsCount = insight.actions?.find((a: any) => a.action_type === 'lead')?.value || 0
        const cplValue = insight.cost_per_action_type?.find((a: any) => a.action_type === 'lead')?.value || 0
        return {
            ad_id: insight.ad_id, ad_name: insight.ad_name,
            adset_id: insight.adset_id, adset_name: insight.adset_name,
            campaign_id: insight.campaign_id, campaign_name: insight.campaign_name,
            spend: parseFloat(insight.spend || '0'),
            impressions: parseInt(insight.impressions || '0'),
            clicks: parseInt(insight.clicks || '0'),
            ctr: parseFloat(insight.ctr || '0'),
            leads_count: parseInt(leadsCount), cpl: parseFloat(cplValue),
        }
    })

    if (ads.length === 0) {
        return { briefs_generated: [], images_generated: 0, image_errors: [], total_deficit: 0, angles_analyzed: [], skipped_reasons: ['Nessuna ad attiva su Meta'] }
    }

    // 3. Get campaign budgets in EUROS
    const campaignIds = [...new Set(ads.map((a: any) => a.campaign_id))]
    const campaignBudgets: Record<string, number> = {}
    for (const cId of campaignIds) {
        try {
            const cRes = await fetch(`https://graph.facebook.com/${META_API_VERSION}/${cId}?fields=daily_budget&access_token=${access_token}`)
            if (cRes.ok) {
                const cData = await cRes.json()
                campaignBudgets[cId as string] = parseFloat(cData.daily_budget || '0') / 100
            }
        } catch {}
    }

    // 4. Build AdSet mappings
    const adsetAngles: Record<string, string> = {}
    const adsetNames: Record<string, string> = {}
    const adsetUtmTerms: Record<string, string> = {}
    ads.forEach((ad: any) => {
        if (!adsetAngles[ad.adset_id]) {
            const name = (ad.adset_name || '').toLowerCase()
            let angle = 'generic'
            if (name.includes('efficien') || name.includes('eff')) angle = 'efficiency'
            else if (name.includes('system') || name.includes('metodo') || name.includes('sys')) angle = 'system'
            else if (name.includes('emozion') || name.includes('dolor') || name.includes('emo')) angle = 'emotional'
            else if (name.includes('status') || name.includes('corona')) angle = 'status'
            else if (name.includes('edu') || name.includes('educaz')) angle = 'education'
            else if (name.includes('trasf') || name.includes('transform')) angle = 'transformation'
            else if (name.includes('calcio')) angle = 'sport_performance'
            else if (name.includes('mental')) angle = 'mental_coaching'

            adsetAngles[ad.adset_id] = angle
            adsetNames[ad.adset_id] = ad.adset_name
            adsetUtmTerms[ad.adset_id] = angle.replace(/[^a-z_]/g, '_')
        }
    })

    return runCreativePipeline(orgId, ads, campaignBudgets, adsetAngles, adsetNames, adsetUtmTerms)
}

export async function runCreativePipeline(
    orgId: string,
    adMetrics: any[],
    campaignBudgets: Record<string, number>,
    adsetAngles: Record<string, string>,    // adset_id → angle
    adsetNames: Record<string, string>,     // adset_id → name
    adsetUtmTerms: Record<string, string>,  // adset_id → utm_term
): Promise<PipelineResult> {
    const supabase = getSupabaseAdmin()
    const MAX_BRIEFS_PER_CYCLE = 3
    const COOLDOWN_HOURS = 24

    const result: PipelineResult = {
        briefs_generated: [],
        images_generated: 0,
        image_errors: [],
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

        // 4a. Generate image with Nano Banana 2
        let imageUrl: string | null = null
        let imageError: string | null = null
        try {
            const { generateAndUploadAdImage } = await import('@/lib/nano-banana')
            const imgResult = await generateAndUploadAdImage(
                brief.image_prompt,
                orgId,
                brief.name,
                brief.aspect_ratio,
            )
            if (imgResult.success && imgResult.imageUrl) {
                imageUrl = imgResult.imageUrl
                result.images_generated++
            } else {
                imageError = imgResult.error || 'Errore sconosciuto'
                result.image_errors.push(`${angle}: ${imageError}`)
            }
        } catch (imgErr: any) {
            imageError = imgErr.message
        }

        // 4b. Save to ad_creatives with status 'ready'
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
                image_url: imageUrl,
                cta_type: brief.cta_type,
                aspect_ratio: brief.aspect_ratio,
                brief_data: {
                    image_prompt: brief.image_prompt,
                    winning_context: brief.winning_context,
                    pocket_selection_reason: brief.pocket.selection_reason,
                    image_error: imageError,
                },
                winning_patterns: dna.winning_patterns,
                status: 'ready',
                created_by: 'ai_engine',
            })

        if (error) {
            result.skipped_reasons.push(`${angle}: errore salvataggio — ${error.message}`)
            continue
        }

        if (imageUrl) brief.image_url = imageUrl
        result.briefs_generated.push(brief)
        briefsGenerated++
    }

    return result
}
