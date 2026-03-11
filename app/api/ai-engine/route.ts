import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

// AI Engine API — Generates recommendations and manages AI sessions
export async function GET(req: NextRequest) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: member } = await supabase
        .from('organization_members')
        .select('organization_id')
        .eq('user_id', user.id)
        .single()

    if (!member) return NextResponse.json({ error: 'No organization' }, { status: 404 })

    const orgId = member.organization_id

    const [recommendationsRes, briefsRes, snapshotsRes] = await Promise.all([
        supabase
            .from('ai_ad_recommendations')
            .select('*')
            .eq('organization_id', orgId)
            .order('created_at', { ascending: false })
            .limit(20),
        supabase
            .from('ai_creative_briefs')
            .select('*')
            .eq('organization_id', orgId)
            .order('created_at', { ascending: false })
            .limit(10),
        supabase
            .from('ai_performance_snapshots')
            .select('*')
            .eq('organization_id', orgId)
            .order('snapshot_date', { ascending: false })
            .limit(30),
    ])

    return NextResponse.json({
        recommendations: recommendationsRes.data || [],
        briefs: briefsRes.data || [],
        snapshots: snapshotsRes.data || [],
    })
}

// POST — Create recommendation, brief, or update status
export async function POST(req: NextRequest) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: member } = await supabase
        .from('organization_members')
        .select('organization_id')
        .eq('user_id', user.id)
        .single()

    if (!member) return NextResponse.json({ error: 'No organization' }, { status: 404 })

    const body = await req.json()
    const { action } = body

    if (action === 'generate_recommendations') {
        // Fetch campaign data and generate AI-powered recommendations
        const { data: campaigns } = await supabase
            .from('campaigns_cache')
            .select('*')
            .eq('organization_id', member.organization_id)

        const recommendations = generateRecommendations(campaigns || [])

        // Save recommendations
        if (recommendations.length > 0) {
            await supabase.from('ai_ad_recommendations').insert(
                recommendations.map(r => ({
                    ...r,
                    organization_id: member.organization_id,
                }))
            )
        }

        return NextResponse.json({ recommendations })
    }

    if (action === 'update_recommendation') {
        const { id, status } = body
        await supabase
            .from('ai_ad_recommendations')
            .update({ status })
            .eq('id', id)
            .eq('organization_id', member.organization_id)

        return NextResponse.json({ success: true })
    }

    if (action === 'create_brief') {
        const { brief_data } = body
        const generatedCopies = generateAdCopies(brief_data)

        const { data, error } = await supabase
            .from('ai_creative_briefs')
            .insert({
                organization_id: member.organization_id,
                brief_data,
                generated_copies: generatedCopies,
                status: 'ready',
            })
            .select()
            .single()

        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
        return NextResponse.json({ brief: data })
    }

    if (action === 'save_snapshot') {
        const { data: campaigns } = await supabase
            .from('campaigns_cache')
            .select('*')
            .eq('organization_id', member.organization_id)

        const metrics = calculateMetrics(campaigns || [])

        const { data, error } = await supabase
            .from('ai_performance_snapshots')
            .insert({
                organization_id: member.organization_id,
                metrics,
                ai_commentary: generateCommentary(metrics),
            })
            .select()
            .single()

        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
        return NextResponse.json({ snapshot: data })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}

// --- AI Logic (local, no external API needed) ---

function generateRecommendations(campaigns: any[]) {
    const recs: any[] = []
    if (campaigns.length === 0) {
        recs.push({
            recommendation_type: 'general',
            priority: 'high',
            title: 'Collega Meta Ads per iniziare',
            description: 'Nessuna campagna trovata. Collega il tuo account Meta Ads nella sezione Connessioni per far analizzare le tue campagne dall\'AI.',
            action_data: { redirect: '/dashboard/connections' },
            status: 'pending',
            impact_estimate: {},
        })
        return recs
    }

    const activeCampaigns = campaigns.filter(c => c.status === 'ACTIVE')
    const totalSpend = campaigns.reduce((s, c) => s + (Number(c.spend) || 0), 0)
    const totalLeads = campaigns.reduce((s, c) => s + (Number(c.leads_count) || 0), 0)
    const avgCPL = totalLeads > 0 ? totalSpend / totalLeads : 0

    // High CPL alert
    campaigns.forEach(c => {
        const cpl = Number(c.cpl) || 0
        if (cpl > avgCPL * 1.5 && cpl > 0) {
            recs.push({
                recommendation_type: 'budget',
                priority: 'critical',
                title: `CPL troppo alto su "${c.campaign_name}"`,
                description: `Il CPL di questa campagna (€${cpl.toFixed(2)}) è ${Math.round((cpl / avgCPL - 1) * 100)}% sopra la media. Considera di ridurre il budget o rivedere il targeting.`,
                action_data: { campaign_id: c.id, suggested_action: 'reduce_budget' },
                status: 'pending',
                impact_estimate: { potential_saving: `€${((cpl - avgCPL) * (Number(c.leads_count) || 0)).toFixed(2)}` },
            })
        }
    })

    // Low CTR campaigns
    campaigns.forEach(c => {
        const ctr = Number(c.ctr) || 0
        if (ctr < 1.0 && ctr > 0 && c.status === 'ACTIVE') {
            recs.push({
                recommendation_type: 'creative',
                priority: 'high',
                title: `CTR basso su "${c.campaign_name}"`,
                description: `Il CTR è solo ${ctr.toFixed(2)}%. Le creativi non stanno catturando l'attenzione. Prova a rinnovare immagini e headline.`,
                action_data: { campaign_id: c.id, suggested_action: 'refresh_creative' },
                status: 'pending',
                impact_estimate: { potential_ctr_increase: '50-100%' },
            })
        }
    })

    // Good ROAS campaigns — scale up
    campaigns.forEach(c => {
        const roas = Number(c.roas) || 0
        if (roas > 3 && c.status === 'ACTIVE') {
            recs.push({
                recommendation_type: 'budget',
                priority: 'medium',
                title: `Scala "${c.campaign_name}" — ROAS ${roas.toFixed(1)}x`,
                description: `Questa campagna ha un ROAS eccellente. Aumenta il budget del 20-30% per massimizzare i risultati.`,
                action_data: { campaign_id: c.id, suggested_action: 'increase_budget', suggested_increase: 25 },
                status: 'pending',
                impact_estimate: { potential_revenue_increase: '20-30%' },
            })
        }
    })

    // No active campaigns
    if (activeCampaigns.length === 0 && campaigns.length > 0) {
        recs.push({
            recommendation_type: 'general',
            priority: 'high',
            title: 'Nessuna campagna attiva',
            description: 'Tutte le campagne sono in pausa. Riattiva almeno le campagne con i migliori performance storici.',
            action_data: { suggested_action: 'reactivate_best' },
            status: 'pending',
            impact_estimate: {},
        })
    }

    // Budget distribution suggestion
    if (campaigns.length >= 3) {
        const best = [...campaigns].sort((a, b) => (Number(b.roas) || 0) - (Number(a.roas) || 0))[0]
        const worst = [...campaigns].sort((a, b) => (Number(a.roas) || 0) - (Number(b.roas) || 0))[0]
        if (best && worst && best.id !== worst.id) {
            recs.push({
                recommendation_type: 'budget',
                priority: 'medium',
                title: 'Ribilancia il budget tra le campagne',
                description: `Sposta budget da "${worst.campaign_name}" (ROAS: ${(Number(worst.roas) || 0).toFixed(1)}x) a "${best.campaign_name}" (ROAS: ${(Number(best.roas) || 0).toFixed(1)}x).`,
                action_data: { from_campaign: worst.id, to_campaign: best.id },
                status: 'pending',
                impact_estimate: { overall_roas_improvement: '10-20%' },
            })
        }
    }

    return recs
}

function generateAdCopies(brief: any) {
    const { product, audience, tone, platform, format } = brief
    const toneMap: Record<string, { adj: string; cta: string; style: string }> = {
        professionale: { adj: 'efficace e comprovato', cta: 'Scopri di più', style: 'Chiaro, autorevole, basato su dati' },
        amichevole: { adj: 'perfetto per te', cta: 'Provalo ora!', style: 'Caldo, diretto, conversazionale' },
        urgente: { adj: 'da non perdere', cta: 'Agisci ora ⚡', style: 'Senso di urgenza, FOMO, scarsità' },
        esclusivo: { adj: 'riservato a pochi', cta: 'Richiedi l\'accesso', style: 'Lusso, esclusività, premium' },
        provocatorio: { adj: 'che cambierà tutto', cta: 'Scopri perché', style: 'Sfidante, disruptive, bold' },
    }

    const t = toneMap[tone?.toLowerCase()] || toneMap.amichevole
    const productName = product || 'il tuo prodotto'
    const audienceName = audience || 'il tuo target'

    return [
        {
            variant: 'A',
            headline: `${productName} — ${t.adj} per ${audienceName}`,
            body: `Stai cercando la soluzione giusta? ${productName} è stato progettato pensando a persone come te. Risultati concreti, senza complicazioni.`,
            cta: t.cta,
            link_description: `Scopri ${productName} — La scelta intelligente per chi vuole di più.`,
            style_note: t.style,
        },
        {
            variant: 'B',
            headline: `Perché ${audienceName} stanno scegliendo ${productName}?`,
            body: `Oltre 1.000+ persone hanno già scoperto come ${productName} può fare la differenza. Non restare indietro.`,
            cta: t.cta,
            link_description: `Unisciti a chi ha già scelto ${productName}.`,
            style_note: t.style,
        },
        {
            variant: 'C',
            headline: `${productName}: La rivoluzione per ${audienceName}`,
            body: `Dimentica le soluzioni mediocri. ${productName} è il punto di svolta che aspettavi. Testato, approvato, amato.`,
            cta: t.cta,
            link_description: `Il futuro di ${audienceName} inizia qui.`,
            style_note: t.style,
        },
    ]
}

function calculateMetrics(campaigns: any[]) {
    const totalSpend = campaigns.reduce((s, c) => s + (Number(c.spend) || 0), 0)
    const totalLeads = campaigns.reduce((s, c) => s + (Number(c.leads_count) || 0), 0)
    const totalClicks = campaigns.reduce((s, c) => s + (Number(c.clicks) || 0), 0)
    const totalImpressions = campaigns.reduce((s, c) => s + (Number(c.impressions) || 0), 0)
    const avgCPL = totalLeads > 0 ? totalSpend / totalLeads : 0
    const avgCTR = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0
    const avgROAS = campaigns.length > 0
        ? campaigns.reduce((s, c) => s + (Number(c.roas) || 0), 0) / campaigns.length : 0

    return {
        total_spend: totalSpend,
        total_leads: totalLeads,
        total_clicks: totalClicks,
        total_impressions: totalImpressions,
        avg_cpl: avgCPL,
        avg_ctr: avgCTR,
        avg_roas: avgROAS,
        active_campaigns: campaigns.filter(c => c.status === 'ACTIVE').length,
        total_campaigns: campaigns.length,
    }
}

function generateCommentary(metrics: any) {
    const parts: string[] = []

    if (metrics.total_campaigns === 0) {
        return 'Nessuna campagna attiva. Collega Meta Ads e inizia ad analizzare i tuoi dati.'
    }

    if (metrics.avg_cpl > 0) {
        if (metrics.avg_cpl < 5) parts.push(`✅ CPL eccellente a €${metrics.avg_cpl.toFixed(2)}`)
        else if (metrics.avg_cpl < 15) parts.push(`⚡ CPL nella media a €${metrics.avg_cpl.toFixed(2)}`)
        else parts.push(`⚠️ CPL alto a €${metrics.avg_cpl.toFixed(2)} — rivedi il targeting`)
    }

    if (metrics.avg_ctr > 0) {
        if (metrics.avg_ctr > 2) parts.push(`✅ CTR forte al ${metrics.avg_ctr.toFixed(2)}%`)
        else if (metrics.avg_ctr > 1) parts.push(`⚡ CTR adeguato al ${metrics.avg_ctr.toFixed(2)}%`)
        else parts.push(`⚠️ CTR basso al ${metrics.avg_ctr.toFixed(2)}% — cambia le creativi`)
    }

    if (metrics.avg_roas > 0) {
        if (metrics.avg_roas > 3) parts.push(`🚀 ROAS eccezionale ${metrics.avg_roas.toFixed(1)}x — scala il budget!`)
        else if (metrics.avg_roas > 1.5) parts.push(`✅ ROAS positivo ${metrics.avg_roas.toFixed(1)}x`)
        else parts.push(`⚠️ ROAS basso ${metrics.avg_roas.toFixed(1)}x — ottimizza le conversioni`)
    }

    return parts.join(' • ') || 'Dati insufficienti per un commento dettagliato.'
}
