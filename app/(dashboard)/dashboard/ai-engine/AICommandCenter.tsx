'use client'

import { useState, useMemo, useEffect, useCallback } from 'react'
import {
    Brain, Zap, Target, TrendingUp, DollarSign, AlertTriangle, CheckCircle,
    ArrowRight, Sparkles, Paintbrush, BarChart3, Rocket, Eye, RefreshCw,
    ThumbsUp, ThumbsDown, Loader2, ChevronRight, Clock, XCircle, Flame,
    Lightbulb, Shield, ArrowUpRight, MousePointerClick, Megaphone, Plug,
    Settings, ToggleRight, ToggleLeft, BookOpen, Database, Activity
} from 'lucide-react'
import Link from 'next/link'
import DateRangeFilter, { useDateRange } from '@/components/DateRangeFilter'
import { createClient } from '@/lib/supabase/client'

interface Campaign {
    id: string; campaign_name?: string; status?: string; spend?: number
    impressions?: number; clicks?: number; leads_count?: number
    cpl?: number; cpc?: number; ctr?: number; roas?: number
}

interface Recommendation {
    id: string; recommendation_type: string; priority: string
    title: string; description?: string; action_data?: any
    status: string; impact_estimate?: any; created_at: string
}

interface Brief {
    id: string; brief_data: any; generated_copies: any[]
    status: string; performance_score?: number; created_at: string
}

interface Snapshot {
    id: string; snapshot_date: string; metrics: any
    ai_commentary?: string
}

interface Props {
    campaigns: Campaign[]
    recommendations: Recommendation[]
    briefs: Brief[]
    snapshots: Snapshot[]
    connections: { id: string; provider: string; status: string }[]
    orgId: string
    agentConfig: any
    budgetTracking: any[]
    episodes: any[]
    knowledge: any[]
    workingMemory: any
}

export default function AICommandCenter({ campaigns: cachedCampaigns, recommendations: initialRecs, briefs, snapshots, connections, orgId, agentConfig, budgetTracking, episodes, knowledge, workingMemory }: Props) {
    const [recommendations, setRecommendations] = useState(initialRecs)
    const [generating, setGenerating] = useState(false)
    const [updatingId, setUpdatingId] = useState<string | null>(null)
    const { range, activeKey, setActiveKey, customFrom, setCustomFrom, customTo, setCustomTo } = useDateRange('today')
    const [liveCampaigns, setLiveCampaigns] = useState<Campaign[] | null>(null)
    const [loadingInsights, setLoadingInsights] = useState(false)

    const hasMetaAds = connections.some(c => c.provider === 'meta_ads' && c.status === 'active')

    const formatLocalDate = (d: Date) => {
        const y = d.getFullYear()
        const m = String(d.getMonth() + 1).padStart(2, '0')
        const day = String(d.getDate()).padStart(2, '0')
        return `${y}-${m}-${day}`
    }

    const fetchLiveInsights = useCallback(async (since: string, until: string) => {
        setLoadingInsights(true)
        try {
            const supabase = createClient()
            const { data: { session } } = await supabase.auth.getSession()
            const res = await fetch(`/api/meta/insights?since=${since}&until=${until}`, {
                headers: { Authorization: `Bearer ${session?.access_token}` },
            })
            const data = await res.json()
            if (data.success && data.campaigns) {
                setLiveCampaigns(data.campaigns)
            } else {
                setLiveCampaigns(null)
            }
        } catch { setLiveCampaigns(null) }
        finally { setLoadingInsights(false) }
    }, [])

    useEffect(() => {
        if (activeKey === 'all') {
            setLiveCampaigns(null)
            return
        }
        const since = formatLocalDate(range.from)
        const untilDate = new Date(range.to.getTime() - 24 * 60 * 60 * 1000)
        const until = formatLocalDate(untilDate)
        fetchLiveInsights(since, until)
    }, [activeKey, range.from.getTime(), range.to.getTime(), fetchLiveInsights])

    // Use live data when available, otherwise cached
    const campaigns = liveCampaigns || cachedCampaigns

    // Sort campaigns: ACTIVE first, then by spend
    const sortedCampaigns = useMemo(() => {
        return [...campaigns].sort((a, b) => {
            const aActive = a.status === 'ACTIVE' ? 1 : 0
            const bActive = b.status === 'ACTIVE' ? 1 : 0
            if (aActive !== bActive) return bActive - aActive
            return (Number(b.spend) || 0) - (Number(a.spend) || 0)
        })
    }, [campaigns])

    // Metrics from current period
    const totalSpend = campaigns.reduce((s, c) => s + (Number(c.spend) || 0), 0)
    const totalLeads = campaigns.reduce((s, c) => s + (Number(c.leads_count) || 0), 0)
    const totalClicks = campaigns.reduce((s, c) => s + (Number(c.clicks) || 0), 0)
    const totalImpressions = campaigns.reduce((s, c) => s + (Number(c.impressions) || 0), 0)
    const avgCPL = totalLeads > 0 ? totalSpend / totalLeads : 0
    const avgCTR = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0
    const avgROAS = campaigns.length > 0
        ? campaigns.reduce((s, c) => s + (Number(c.roas) || 0), 0) / campaigns.length : 0
    const activeCampaigns = campaigns.filter(c => c.status === 'ACTIVE').length

    const formatCurrency = (v: number) =>
        new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(v)
    const formatNumber = (v: number) =>
        new Intl.NumberFormat('it-IT').format(v)

    // Health Score (0-100)
    const healthFactors: number[] = []
    if (avgCTR > 2) healthFactors.push(100); else if (avgCTR > 1) healthFactors.push(60); else if (avgCTR > 0) healthFactors.push(30); else healthFactors.push(0)
    if (avgCPL > 0 && avgCPL < 5) healthFactors.push(100); else if (avgCPL < 15) healthFactors.push(60); else if (avgCPL > 0) healthFactors.push(20); else healthFactors.push(0)
    if (avgROAS > 3) healthFactors.push(100); else if (avgROAS > 1.5) healthFactors.push(70); else if (avgROAS > 0) healthFactors.push(30); else healthFactors.push(0)
    if (activeCampaigns > 0) healthFactors.push(80); else healthFactors.push(0)
    const healthScore = campaigns.length > 0
        ? Math.round(healthFactors.reduce((a, b) => a + b, 0) / healthFactors.length) : 0

    const healthColor = healthScore >= 70 ? '#22c55e' : healthScore >= 40 ? '#f59e0b' : '#ef4444'
    const healthLabel = healthScore >= 70 ? 'Eccellente' : healthScore >= 40 ? 'Da migliorare' : 'Critico'

    // Pending recommendations
    const pendingRecs = recommendations.filter(r => r.status === 'pending')
    const criticalRecs = pendingRecs.filter(r => r.priority === 'critical')

    const handleGenerateRecs = async () => {
        setGenerating(true)
        try {
            // Send the current period's campaign data for analysis
            const since = formatLocalDate(range.from)
            const untilDate = new Date(range.to.getTime() - 24 * 60 * 60 * 1000)
            const until = formatLocalDate(untilDate)
            const res = await fetch('/api/ai-engine', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'generate_recommendations', since, until, campaigns: sortedCampaigns.filter(c => c.status === 'ACTIVE' || (Number(c.spend) || 0) > 0) }),
            })
            const data = await res.json()
            if (data.recommendations) {
                setRecommendations(data.recommendations)
            }
        } catch (err) {
            console.error(err)
        }
        setGenerating(false)
    }

    const handleUpdateRec = async (id: string, status: string) => {
        setUpdatingId(id)
        try {
            await fetch('/api/ai-engine', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'update_recommendation', id, status }),
            })
            setRecommendations(prev => prev.map(r => r.id === id ? { ...r, status } : r))
        } catch (err) {
            console.error(err)
        }
        setUpdatingId(null)
    }

    const priorityConfig: Record<string, { color: string; icon: any; label: string }> = {
        critical: { color: '#ef4444', icon: Flame, label: 'Critico' },
        high: { color: '#f59e0b', icon: AlertTriangle, label: 'Alto' },
        medium: { color: '#3b82f6', icon: Lightbulb, label: 'Medio' },
        low: { color: '#22c55e', icon: Shield, label: 'Basso' },
    }

    const typeConfig: Record<string, { color: string; icon: any; label: string }> = {
        budget: { color: '#f59e0b', icon: DollarSign, label: 'Budget' },
        creative: { color: '#8b5cf6', icon: Paintbrush, label: 'Creative' },
        audience: { color: '#3b82f6', icon: Target, label: 'Audience' },
        schedule: { color: '#10b981', icon: Clock, label: 'Schedule' },
        general: { color: '#6366f1', icon: Brain, label: 'Generale' },
    }

    // If no Meta Ads connected — onboarding
    if (!hasMetaAds && campaigns.length === 0) {
        return (
            <div className="space-y-6 animate-fade-in">
                <div>
                    <h1 className="text-2xl font-bold text-white flex items-center gap-3">
                        <Brain className="w-7 h-7" style={{ color: '#a855f7' }} />
                        AI Engine
                    </h1>
                    <p className="text-sm mt-1" style={{ color: 'var(--color-surface-600)' }}>
                        Il tuo reparto marketing AI — analisi, creativi e ottimizzazione automatica
                    </p>
                </div>

                {/* Onboarding Hero */}
                <div className="glass-card p-8 text-center relative overflow-hidden">
                    <div className="absolute inset-0 opacity-5" style={{
                        background: 'radial-gradient(ellipse at center, #a855f7 0%, transparent 70%)',
                    }} />
                    <div className="relative z-10">
                        <div className="w-20 h-20 rounded-2xl mx-auto mb-6 flex items-center justify-center" style={{
                            background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.15), rgba(99, 102, 241, 0.15))',
                            border: '1px solid rgba(168, 85, 247, 0.3)',
                        }}>
                            <Brain className="w-10 h-10" style={{ color: '#a855f7' }} />
                        </div>
                        <h2 className="text-xl font-bold text-white mb-3">Attiva il tuo Reparto Marketing AI</h2>
                        <p className="text-sm max-w-lg mx-auto mb-6" style={{ color: 'var(--color-surface-500)' }}>
                            Connetti Meta Ads per far analizzare le tue campagne dall'AI. Riceverai consigli su budget, creativi, audience e molto altro — come avere un team marketing esperto al tuo fianco.
                        </p>
                        <div className="flex items-center justify-center gap-4 flex-wrap">
                            <Link href="/dashboard/connections" className="btn-primary">
                                <Plug className="w-4 h-4" /> Connetti Meta Ads
                            </Link>
                            <Link href="/dashboard/ai-engine/creative-studio" className="btn-primary" style={{
                                background: 'rgba(168, 85, 247, 0.15)',
                                border: '1px solid rgba(168, 85, 247, 0.3)',
                                color: '#a855f7',
                            }}>
                                <Paintbrush className="w-4 h-4" /> Prova il Creative Studio
                            </Link>
                        </div>
                    </div>
                </div>

                {/* Feature Preview Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {[
                        { icon: BarChart3, title: 'Analisi Real-Time', desc: 'L\'AI monitora ogni KPI e ti avvisa quando qualcosa non va', color: '#3b82f6' },
                        { icon: Lightbulb, title: 'Consigli Intelligenti', desc: 'Raccomandazioni su budget, targeting e creativi basate sui dati', color: '#f59e0b' },
                        { icon: Paintbrush, title: 'Creative Studio', desc: 'Genera copy e brief per le ads con AI — headline, body, CTA pronti', color: '#a855f7' },
                    ].map(f => (
                        <div key={f.title} className="glass-card p-5">
                            <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3" style={{
                                background: `${f.color}15`, border: `1px solid ${f.color}30`,
                            }}>
                                <f.icon className="w-5 h-5" style={{ color: f.color }} />
                            </div>
                            <div className="text-sm font-bold text-white mb-1">{f.title}</div>
                            <div className="text-xs" style={{ color: 'var(--color-surface-500)' }}>{f.desc}</div>
                        </div>
                    ))}
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header */}
            <div className="flex items-start justify-between flex-wrap gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-white flex items-center gap-3">
                        <Brain className="w-7 h-7" style={{ color: '#a855f7' }} />
                        AI Engine
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{
                            background: 'rgba(168, 85, 247, 0.15)', color: '#a855f7',
                        }}>BETA</span>
                    </h1>
                    <p className="text-sm mt-1" style={{ color: 'var(--color-surface-600)' }}>
                        Il tuo reparto marketing AI — analisi continua, creativi e ottimizzazione
                    </p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                    {loadingInsights && <Loader2 className="w-4 h-4 animate-spin" style={{ color: '#818cf8' }} />}
                    <DateRangeFilter activeKey={activeKey} onSelect={setActiveKey}
                        customFrom={customFrom} customTo={customTo}
                        onCustomFromChange={setCustomFrom} onCustomToChange={setCustomTo} />
                    <button onClick={handleGenerateRecs} className="btn-primary" disabled={generating}>
                        {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                        {generating ? 'Analizzando...' : 'Analizza Ora'}
                    </button>
                    <Link href="/dashboard/ai-engine/creative-studio" className="btn-primary" style={{
                        background: 'rgba(168, 85, 247, 0.15)', border: '1px solid rgba(168, 85, 247, 0.3)', color: '#a855f7',
                    }}>
                        <Paintbrush className="w-4 h-4" /> Creative Studio
                    </Link>
                </div>
            </div>

            {/* Health Score + KPIs */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
                {/* Health Score Card */}
                <div className="glass-card p-6 lg:col-span-1 flex flex-col items-center justify-center relative overflow-hidden">
                    <div className="absolute inset-0 opacity-5" style={{
                        background: `radial-gradient(ellipse at center, ${healthColor} 0%, transparent 70%)`,
                    }} />
                    <div className="relative z-10 text-center">
                        <div className="text-[10px] uppercase tracking-wider font-semibold mb-2" style={{ color: 'var(--color-surface-500)' }}>
                            Health Score
                        </div>
                        <div className="text-5xl font-black mb-1" style={{ color: healthColor }}>
                            {healthScore}
                        </div>
                        <div className="text-xs font-semibold" style={{ color: healthColor }}>
                            {healthLabel}
                        </div>
                        <div className="w-full h-2 rounded-full mt-3 overflow-hidden" style={{ background: 'var(--color-surface-200)' }}>
                            <div className="h-full rounded-full transition-all duration-1000" style={{
                                width: `${healthScore}%`, background: healthColor,
                            }} />
                        </div>
                    </div>
                </div>

                {/* KPIs */}
                {[
                    { label: 'Spesa Totale', value: formatCurrency(totalSpend), icon: DollarSign, color: '#ef4444', sub: `${activeCampaigns} campagne attive` },
                    { label: 'Lead Generati', value: formatNumber(totalLeads), icon: Target, color: '#3b82f6', sub: `CPL medio: ${formatCurrency(avgCPL)}` },
                    { label: 'CTR Medio', value: `${avgCTR.toFixed(2)}%`, icon: MousePointerClick, color: '#8b5cf6', sub: `${formatNumber(totalClicks)} click totali` },
                    { label: 'ROAS Medio', value: `${avgROAS.toFixed(1)}x`, icon: TrendingUp, color: '#22c55e', sub: avgROAS > 1.5 ? 'Positivo 🚀' : 'Da ottimizzare' },
                ].map(kpi => (
                    <div key={kpi.label} className="kpi-card">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{
                                background: `${kpi.color}15`, border: `1px solid ${kpi.color}30`,
                            }}>
                                <kpi.icon className="w-4 h-4" style={{ color: kpi.color }} />
                            </div>
                        </div>
                        <div className="text-2xl font-bold text-white">{kpi.value}</div>
                        <div className="text-xs mt-1" style={{ color: 'var(--color-surface-500)' }}>{kpi.label}</div>
                        <div className="text-[10px] mt-0.5" style={{ color: 'var(--color-surface-600)' }}>{kpi.sub}</div>
                    </div>
                ))}
            </div>

            {/* Critical Alerts */}
            {criticalRecs.length > 0 && (
                <div className="glass-card p-5" style={{ borderColor: 'rgba(239, 68, 68, 0.3)' }}>
                    <div className="flex items-center gap-2 mb-3">
                        <Flame className="w-5 h-5" style={{ color: '#ef4444' }} />
                        <h2 className="text-sm font-bold" style={{ color: '#ef4444' }}>
                            Attenzione Immediata — {criticalRecs.length} alert critici
                        </h2>
                    </div>
                    <div className="space-y-2">
                        {criticalRecs.slice(0, 3).map(rec => (
                            <div key={rec.id} className="flex items-start gap-3 p-3 rounded-xl" style={{
                                background: 'rgba(239, 68, 68, 0.06)', border: '1px solid rgba(239, 68, 68, 0.15)',
                            }}>
                                <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: '#ef4444' }} />
                                <div className="flex-1 min-w-0">
                                    <div className="text-sm font-semibold text-white">{rec.title}</div>
                                    <div className="text-xs mt-0.5" style={{ color: 'var(--color-surface-500)' }}>{rec.description}</div>
                                </div>
                                <div className="flex gap-1 flex-shrink-0">
                                    <button onClick={() => handleUpdateRec(rec.id, 'applied')} disabled={updatingId === rec.id}
                                        className="p-1.5 rounded-lg transition-colors hover:bg-white/5" title="Applicato">
                                        <ThumbsUp className="w-3.5 h-3.5" style={{ color: '#22c55e' }} />
                                    </button>
                                    <button onClick={() => handleUpdateRec(rec.id, 'dismissed')} disabled={updatingId === rec.id}
                                        className="p-1.5 rounded-lg transition-colors hover:bg-white/5" title="Ignora">
                                        <ThumbsDown className="w-3.5 h-3.5" style={{ color: 'var(--color-surface-500)' }} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Autopilot Status Card */}
            <div className="glass-card p-5 relative overflow-hidden">
                <div className="absolute inset-0 opacity-5" style={{
                    background: agentConfig?.autopilot_active
                        ? 'radial-gradient(ellipse at center, #22c55e 0%, transparent 70%)'
                        : 'radial-gradient(ellipse at center, #6366f1 0%, transparent 70%)',
                }} />
                <div className="relative z-10 flex items-center justify-between flex-wrap gap-4">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{
                            background: agentConfig?.autopilot_active ? 'rgba(34, 197, 94, 0.15)' : 'rgba(99, 102, 241, 0.1)',
                            border: `1px solid ${agentConfig?.autopilot_active ? 'rgba(34, 197, 94, 0.3)' : 'rgba(99, 102, 241, 0.2)'}`,
                        }}>
                            <Rocket className="w-6 h-6" style={{ color: agentConfig?.autopilot_active ? '#22c55e' : '#6366f1' }} />
                        </div>
                        <div>
                            <div className="text-sm font-bold text-white flex items-center gap-2">
                                AI Autopilot
                                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{
                                    background: agentConfig?.autopilot_active ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.1)',
                                    color: agentConfig?.autopilot_active ? '#22c55e' : '#ef4444',
                                }}>{agentConfig?.autopilot_active ? '🟢 ATTIVO' : '🔴 INATTIVO'}</span>
                            </div>
                            <p className="text-xs mt-0.5" style={{ color: 'var(--color-surface-500)' }}>
                                {agentConfig?.autopilot_active
                                    ? `Analisi ogni ${agentConfig?.analysis_interval_minutes || 60} min • Risk: ${agentConfig?.risk_tolerance || 'medium'}`
                                    : 'Configura budget, obiettivi e automazioni per attivare l\'AI autonomo'}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        {/* Budget mini bars */}
                        {budgetTracking.length > 0 && (
                            <div className="flex gap-3">
                                {budgetTracking.slice(0, 3).map(bt => (
                                    <div key={bt.id} className="text-center">
                                        <div className="text-[9px] uppercase font-semibold" style={{ color: 'var(--color-surface-600)' }}>
                                            {bt.period_type === 'daily' ? 'Giorno' : bt.period_type === 'weekly' ? 'Settimana' : 'Mese'}
                                        </div>
                                        <div className="w-16 h-1.5 rounded-full mt-1 overflow-hidden" style={{ background: 'var(--color-surface-200)' }}>
                                            <div className="h-full rounded-full" style={{
                                                width: `${Math.min((bt.spent / (bt.budget_limit || 1)) * 100, 100)}%`,
                                                background: bt.status === 'exceeded' ? '#ef4444' : bt.status === 'warning' ? '#f59e0b' : '#22c55e',
                                            }} />
                                        </div>
                                        <div className="text-[9px] mt-0.5" style={{
                                            color: bt.status === 'exceeded' ? '#ef4444' : bt.status === 'warning' ? '#f59e0b' : '#22c55e',
                                        }}>{formatCurrency(bt.spent)}</div>
                                    </div>
                                ))}
                            </div>
                        )}
                        <Link href="/dashboard/ai-engine/settings" className="btn-primary" style={{
                            background: 'rgba(168, 85, 247, 0.15)', border: '1px solid rgba(168, 85, 247, 0.3)', color: '#a855f7',
                        }}>
                            <Settings className="w-4 h-4" /> Configura
                        </Link>
                    </div>
                </div>
            </div>

            {/* Main Content: Recommendations + Campaign Health */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* AI Recommendations */}
                <div className="lg:col-span-2 glass-card p-6">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{
                                background: 'rgba(168, 85, 247, 0.15)', border: '1px solid rgba(168, 85, 247, 0.3)',
                            }}>
                                <Lightbulb className="w-4 h-4" style={{ color: '#a855f7' }} />
                            </div>
                            <h2 className="text-base font-bold text-white">AI Recommendations</h2>
                            {pendingRecs.length > 0 && (
                                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{
                                    background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b',
                                }}>{pendingRecs.length} da valutare</span>
                            )}
                        </div>
                        <button onClick={handleGenerateRecs} disabled={generating}
                            className="text-xs flex items-center gap-1 px-2 py-1 rounded-lg transition-colors hover:bg-white/5" style={{ color: 'var(--color-surface-500)' }}>
                            {generating ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                            Rigenera
                        </button>
                    </div>

                    {pendingRecs.length > 0 ? (
                        <div className="space-y-3">
                            {pendingRecs.slice(0, 8).map(rec => {
                                const pCfg = priorityConfig[rec.priority] || priorityConfig.medium
                                const tCfg = typeConfig[rec.recommendation_type] || typeConfig.general
                                return (
                                    <div key={rec.id} className="flex items-start gap-3 p-4 rounded-xl transition-colors hover:bg-white/[0.02]" style={{
                                        background: 'var(--color-surface-100)', border: '1px solid var(--color-surface-200)',
                                    }}>
                                        <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{
                                            background: `${tCfg.color}15`, border: `1px solid ${tCfg.color}30`,
                                        }}>
                                            <tCfg.icon className="w-4 h-4" style={{ color: tCfg.color }} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-0.5">
                                                <span className="text-sm font-semibold text-white">{rec.title}</span>
                                                <span className="badge" style={{
                                                    background: `${pCfg.color}15`, color: pCfg.color,
                                                    border: `1px solid ${pCfg.color}30`, fontSize: '9px',
                                                }}>
                                                    <pCfg.icon className="w-2.5 h-2.5" /> {pCfg.label}
                                                </span>
                                            </div>
                                            {rec.description && (
                                                <p className="text-xs mt-1" style={{ color: 'var(--color-surface-500)' }}>{rec.description}</p>
                                            )}
                                            {rec.impact_estimate && Object.keys(rec.impact_estimate).length > 0 && (
                                                <div className="flex gap-2 mt-2 flex-wrap">
                                                    {Object.entries(rec.impact_estimate).map(([key, val]) => (
                                                        <span key={key} className="text-[10px] px-2 py-0.5 rounded-full" style={{
                                                            background: 'rgba(34, 197, 94, 0.1)', color: '#22c55e',
                                                            border: '1px solid rgba(34, 197, 94, 0.2)',
                                                        }}>
                                                            {key.replace(/_/g, ' ')}: {String(val)}
                                                        </span>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex gap-1 flex-shrink-0">
                                            <button onClick={() => handleUpdateRec(rec.id, 'applied')} disabled={updatingId === rec.id}
                                                className="p-2 rounded-xl transition-all hover:bg-green-500/10" title="Applicato">
                                                {updatingId === rec.id ? <Loader2 className="w-4 h-4 animate-spin" /> :
                                                    <ThumbsUp className="w-4 h-4" style={{ color: '#22c55e' }} />}
                                            </button>
                                            <button onClick={() => handleUpdateRec(rec.id, 'dismissed')} disabled={updatingId === rec.id}
                                                className="p-2 rounded-xl transition-all hover:bg-red-500/10" title="Ignora">
                                                <ThumbsDown className="w-4 h-4" style={{ color: 'var(--color-surface-500)' }} />
                                            </button>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    ) : (
                        <div className="text-center py-8">
                            <Sparkles className="w-8 h-8 mx-auto mb-3" style={{ color: 'var(--color-surface-400)' }} />
                            <p className="text-sm" style={{ color: 'var(--color-surface-500)' }}>
                                Nessuna raccomandazione pendente.
                            </p>
                            <p className="text-xs mt-1" style={{ color: 'var(--color-surface-600)' }}>
                                Clicca "Analizza Ora" per generare nuovi consigli AI.
                            </p>
                        </div>
                    )}
                </div>

                {/* Campaign Health Sidebar */}
                <div className="glass-card p-6">
                    <div className="flex items-center gap-2 mb-4">
                        <Megaphone className="w-5 h-5" style={{ color: '#f59e0b' }} />
                        <h2 className="text-sm font-bold text-white">Campagne</h2>
                    </div>

                    {sortedCampaigns.length > 0 ? (
                        <div className="space-y-3">
                            {sortedCampaigns.filter(c => c.status === 'ACTIVE' || (Number(c.spend) || 0) > 0).slice(0, 6).map(c => {
                                const cpl = Number(c.cpl) || 0
                                const roas = Number(c.roas) || 0
                                const spend = Number(c.spend) || 0
                                const campHealth = c.status === 'ACTIVE'
                                    ? (roas > 2 ? 'good' : roas > 1 ? 'ok' : 'bad')
                                    : 'paused'
                                const healthColors: Record<string, string> = {
                                    good: '#22c55e', ok: '#f59e0b', bad: '#ef4444', paused: 'var(--color-surface-500)',
                                }
                                return (
                                    <div key={c.id} className="p-3 rounded-xl" style={{
                                        background: 'var(--color-surface-100)', border: '1px solid var(--color-surface-200)',
                                    }}>
                                        <div className="flex items-center gap-2 mb-2">
                                            <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: healthColors[campHealth] }} />
                                            <span className="text-xs font-semibold text-white truncate flex-1">{c.campaign_name || '—'}</span>
                                            <span className="badge" style={{
                                                fontSize: '9px',
                                                background: c.status === 'ACTIVE' ? 'rgba(34, 197, 94, 0.1)' : 'var(--color-surface-200)',
                                                color: c.status === 'ACTIVE' ? '#22c55e' : 'var(--color-surface-500)',
                                                border: `1px solid ${c.status === 'ACTIVE' ? 'rgba(34, 197, 94, 0.2)' : 'var(--color-surface-300)'}`,
                                            }}>{c.status || '—'}</span>
                                        </div>
                                        <div className="grid grid-cols-4 gap-2">
                                            <div>
                                                <div className="text-[9px] uppercase" style={{ color: 'var(--color-surface-600)' }}>Spesa</div>
                                                <div className="text-xs font-semibold" style={{ color: 'var(--color-surface-700)' }}>{spend > 0 ? formatCurrency(spend) : '—'}</div>
                                            </div>
                                            <div>
                                                <div className="text-[9px] uppercase" style={{ color: 'var(--color-surface-600)' }}>CPL</div>
                                                <div className="text-xs font-semibold" style={{ color: '#f59e0b' }}>{cpl > 0 ? formatCurrency(cpl) : '—'}</div>
                                            </div>
                                            <div>
                                                <div className="text-[9px] uppercase" style={{ color: 'var(--color-surface-600)' }}>CTR</div>
                                                <div className="text-xs font-semibold" style={{ color: '#8b5cf6' }}>{Number(c.ctr) > 0 ? `${Number(c.ctr).toFixed(2)}%` : '—'}</div>
                                            </div>
                                            <div>
                                                <div className="text-[9px] uppercase" style={{ color: 'var(--color-surface-600)' }}>ROAS</div>
                                                <div className="text-xs font-semibold" style={{ color: '#22c55e' }}>{roas > 0 ? `${roas.toFixed(1)}x` : '—'}</div>
                                            </div>
                                        </div>
                                    </div>
                                )
                            })}
                            <Link href="/dashboard/ads" className="flex items-center justify-center gap-1 text-xs py-2 rounded-xl transition-colors hover:bg-white/[0.03]" style={{ color: 'var(--color-surface-500)' }}>
                                Vedi tutte <ChevronRight className="w-3 h-3" />
                            </Link>
                        </div>
                    ) : (
                        <div className="text-center py-6">
                            <p className="text-xs" style={{ color: 'var(--color-surface-500)' }}>Nessuna campagna sincronizzata</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Quick Actions Row */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {[
                    { label: 'Creative Studio', desc: 'Genera copy e brief AI', icon: Paintbrush, href: '/dashboard/ai-engine/creative-studio', color: '#a855f7' },
                    { label: 'Autopilot Settings', desc: 'Budget, obiettivi, cron', icon: Settings, href: '/dashboard/ai-engine/settings', color: '#6366f1' },
                    { label: 'Gestisci Ads', desc: 'Performance campagne', icon: Megaphone, href: '/dashboard/ads', color: '#f59e0b' },
                    { label: 'Vedi Analytics', desc: 'Report e trend', icon: BarChart3, href: '/dashboard/analytics', color: '#3b82f6' },
                ].map((action) => (
                    <Link key={action.label} href={action.href}>
                        <div className="glass-card p-4 group cursor-pointer transition-all hover:scale-[1.02]">
                            <div className="w-9 h-9 rounded-lg flex items-center justify-center mb-3" style={{
                                background: `${action.color}15`, border: `1px solid ${action.color}30`,
                            }}>
                                <action.icon className="w-4 h-4" style={{ color: action.color }} />
                            </div>
                            <div className="text-sm font-semibold text-white mb-0.5">{action.label}</div>
                            <div className="text-xs" style={{ color: 'var(--color-surface-500)' }}>{action.desc}</div>
                        </div>
                    </Link>
                ))}
            </div>

            {/* Recent Briefs */}
            {briefs.length > 0 && (
                <div className="glass-card p-6">
                    <div className="flex items-center gap-2 mb-4">
                        <Paintbrush className="w-5 h-5" style={{ color: '#a855f7' }} />
                        <h2 className="text-sm font-bold text-white">Brief Creativi Recenti</h2>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {briefs.slice(0, 6).map(brief => (
                            <div key={brief.id} className="p-4 rounded-xl" style={{
                                background: 'var(--color-surface-100)', border: '1px solid var(--color-surface-200)',
                            }}>
                                <div className="flex items-center gap-2 mb-2">
                                    <Sparkles className="w-3.5 h-3.5" style={{ color: '#a855f7' }} />
                                    <span className="text-xs font-semibold text-white truncate">
                                        {brief.brief_data?.product || 'Brief senza nome'}
                                    </span>
                                    <span className="badge" style={{
                                        fontSize: '9px',
                                        background: brief.status === 'ready' ? 'rgba(34, 197, 94, 0.1)' : 'rgba(245, 158, 11, 0.1)',
                                        color: brief.status === 'ready' ? '#22c55e' : '#f59e0b',
                                        border: `1px solid ${brief.status === 'ready' ? 'rgba(34, 197, 94, 0.2)' : 'rgba(245, 158, 11, 0.2)'}`,
                                    }}>{brief.status}</span>
                                </div>
                                <div className="text-[10px]" style={{ color: 'var(--color-surface-500)' }}>
                                    {brief.generated_copies?.length || 0} variazioni • {new Date(brief.created_at).toLocaleDateString('it-IT')}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* ===== AI MEMORY SECTION ===== */}
            <div className="glass-card p-6">
                <div className="flex items-center gap-2 mb-4">
                    <Brain className="w-5 h-5" style={{ color: '#a855f7' }} />
                    <h2 className="text-sm font-bold text-white">Memoria AI</h2>
                    <span className="badge" style={{ background: 'rgba(168, 85, 247, 0.1)', color: '#a855f7', border: '1px solid rgba(168, 85, 247, 0.2)' }}>
                        {episodes.length} episodi • {knowledge.length} regole
                    </span>
                </div>

                {workingMemory && (
                    <div className="p-3 rounded-xl mb-4" style={{ background: 'rgba(59, 130, 246, 0.05)', border: '1px solid rgba(59, 130, 246, 0.1)' }}>
                        <div className="flex items-center gap-2 mb-1">
                            <Activity className="w-3.5 h-3.5" style={{ color: '#3b82f6' }} />
                            <span className="text-[10px] uppercase font-bold" style={{ color: '#3b82f6' }}>Working Memory — Ultimo ciclo</span>
                        </div>
                        <div className="text-xs" style={{ color: 'var(--color-surface-500)' }}>
                            Ciclo: {workingMemory.cycle_id || 'N/A'} •
                            {' '}{workingMemory.observations?.length || 0} osservazioni •
                            {' '}{workingMemory.decisions?.length || 0} decisioni •
                            {' '}{workingMemory.retrieved_knowledge?.length || 0} regole caricate
                        </div>
                    </div>
                )}

                {knowledge.length > 0 && (
                    <div className="mb-4">
                        <div className="flex items-center gap-2 mb-2">
                            <Database className="w-3.5 h-3.5" style={{ color: '#22c55e' }} />
                            <span className="text-xs font-bold text-white">Regole Apprese</span>
                        </div>
                        <div className="space-y-2">
                            {knowledge.slice(0, 5).map((rule: any) => (
                                <div key={rule.id} className="p-3 rounded-xl" style={{ background: 'var(--color-surface-100)', border: '1px solid var(--color-surface-200)' }}>
                                    <div className="flex items-start gap-2 mb-1">
                                        <span className="badge" style={{
                                            background: rule.category === 'best_practice' ? 'rgba(34, 197, 94, 0.1)' : 'rgba(245, 158, 11, 0.1)',
                                            color: rule.category === 'best_practice' ? '#22c55e' : '#f59e0b',
                                            fontSize: '9px',
                                        }}>{rule.category === 'best_practice' ? '✅ Best Practice' : '⚠️ Warning'}</span>
                                        <span className="text-xs font-semibold text-white">{rule.title}</span>
                                    </div>
                                    <div className="text-[11px] mb-2 line-clamp-2" style={{ color: 'var(--color-surface-500)' }}>{rule.content}</div>
                                    <div className="flex items-center gap-3">
                                        <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--color-surface-300)' }}>
                                            <div className="h-full rounded-full" style={{
                                                width: `${(rule.confidence * 100).toFixed(0)}%`,
                                                background: rule.confidence > 0.7 ? '#22c55e' : rule.confidence > 0.4 ? '#f59e0b' : '#ef4444',
                                            }} />
                                        </div>
                                        <span className="text-[10px] font-mono" style={{ color: 'var(--color-surface-500)' }}>
                                            {(rule.confidence * 100).toFixed(0)}% • {rule.times_applied || 0}x
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {episodes.length > 0 && (
                    <div>
                        <div className="flex items-center gap-2 mb-2">
                            <BookOpen className="w-3.5 h-3.5" style={{ color: '#a855f7' }} />
                            <span className="text-xs font-bold text-white">Diario Episodico</span>
                        </div>
                        <div className="space-y-1.5 max-h-[300px] overflow-y-auto">
                            {episodes.slice(0, 15).map((ep: any) => (
                                <div key={ep.id} className="flex items-start gap-2 p-2 rounded-lg" style={{ background: 'var(--color-surface-100)' }}>
                                    <div className="w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 mt-0.5" style={{
                                        background: ep.outcome === 'positive' ? 'rgba(34, 197, 94, 0.15)' :
                                            ep.outcome === 'negative' ? 'rgba(239, 68, 68, 0.15)' :
                                            ep.episode_type === 'learning' ? 'rgba(168, 85, 247, 0.15)' : 'rgba(99, 102, 241, 0.15)',
                                    }}>
                                        {ep.outcome === 'positive' ? <CheckCircle className="w-3 h-3" style={{ color: '#22c55e' }} /> :
                                         ep.outcome === 'negative' ? <XCircle className="w-3 h-3" style={{ color: '#ef4444' }} /> :
                                         ep.episode_type === 'learning' ? <Lightbulb className="w-3 h-3" style={{ color: '#a855f7' }} /> :
                                         <Clock className="w-3 h-3" style={{ color: '#6366f1' }} />}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-1">
                                            <span className="text-[11px] font-semibold text-white">{ep.action_type || ep.episode_type}</span>
                                            {ep.target_name && <span className="text-[10px]" style={{ color: 'var(--color-surface-600)' }}>• {ep.target_name}</span>}
                                        </div>
                                        {ep.reasoning && <div className="text-[10px] line-clamp-1" style={{ color: 'var(--color-surface-500)' }}>{ep.reasoning}</div>}
                                        <div className="text-[9px]" style={{ color: 'var(--color-surface-600)' }}>
                                            {new Date(ep.created_at).toLocaleString('it-IT', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' })}
                                            {ep.outcome_score ? ` • score: ${Number(ep.outcome_score).toFixed(2)}` : ''}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {episodes.length === 0 && knowledge.length === 0 && (
                    <div className="text-center py-4">
                        <Brain className="w-8 h-8 mx-auto mb-2" style={{ color: 'var(--color-surface-400)' }} />
                        <div className="text-xs" style={{ color: 'var(--color-surface-500)' }}>La memoria AI si popolerà automaticamente quando l&apos;Autopilot inizierà a lavorare</div>
                    </div>
                )}
            </div>

            {/* AI Engine Info */}
            <div className="glass-card p-5 animate-pulse-glow">
                <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{
                        background: 'rgba(168, 85, 247, 0.1)', border: '1px solid rgba(168, 85, 247, 0.2)',
                    }}>
                        <Rocket className="w-5 h-5" style={{ color: '#a855f7' }} />
                    </div>
                    <div>
                        <div className="text-sm font-bold text-white mb-1">Come funziona l'AI Engine</div>
                        <div className="text-xs leading-relaxed" style={{ color: 'var(--color-surface-500)' }}>
                            1. <strong>Analizza</strong> i dati delle tue campagne Meta Ads in tempo reale →
                            2. <strong>Identifica</strong> problemi (CPL alto, CTR basso, budget sprecato) →
                            3. <strong>Genera</strong> raccomandazioni concrete con stima dell'impatto →
                            4. <strong>Impara</strong> dai tuoi feedback per migliorare nel tempo
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
