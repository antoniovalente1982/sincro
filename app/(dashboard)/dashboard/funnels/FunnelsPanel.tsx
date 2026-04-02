'use client'

import { useState, useMemo } from 'react'
import { Target, Plus, Globe, Eye, Pause, Archive, Play, Edit3, Trash2, X, ExternalLink, Inbox, Copy, Check, Link2, Sparkles, BarChart3, ArrowUpRight, ArrowDownRight, Smartphone, Monitor, Tablet, FlaskConical, Trophy, Users, ToggleLeft, ToggleRight, Calendar } from 'lucide-react'

interface Pipeline {
    id: string; name: string; is_default?: boolean
}

interface Funnel {
    id: string; name: string; slug: string; description?: string
    objective?: string
    status: 'draft' | 'active' | 'paused' | 'archived'
    meta_pixel_id?: string; settings?: any; created_at: string; updated_at: string
    submission_count?: number
    pipeline_id?: string
    ai_settings?: any
}

interface PageView {
    id: string; funnel_id?: string; page_path: string; page_variant?: string
    visitor_id?: string; ip_hash?: string
    utm_source?: string; utm_campaign?: string; utm_content?: string; device_type?: string; created_at: string
}

interface Submission {
    id: string; funnel_id?: string; page_variant?: string; created_at: string; utm_source?: string; utm_campaign?: string
}

const statusConfig: Record<string, { label: string; color: string; icon: any }> = {
    draft: { label: 'Bozza', color: '#71717a', icon: Edit3 },
    active: { label: 'Attivo', color: '#22c55e', icon: Play },
    paused: { label: 'In pausa', color: '#f59e0b', icon: Pause },
    archived: { label: 'Archiviato', color: '#ef4444', icon: Archive },
}

// Helper: count unique visitors from page views by visitor_id (fallback to ip_hash)
function countUniqueVisitors(views: PageView[]): number {
    const seen = new Set<string>()
    views.forEach(v => {
        const key = v.visitor_id || v.ip_hash || v.id
        seen.add(key)
    })
    return seen.size
}

export default function FunnelsPanel({ initialFunnels, pageViews = [], submissions = [], pipelines = [] }: {
    initialFunnels: Funnel[]; pageViews?: PageView[]; submissions?: Submission[]; pipelines?: Pipeline[]
}) {
    const [funnels, setFunnels] = useState<Funnel[]>(initialFunnels)
    const [showModal, setShowModal] = useState(false)
    const [editing, setEditing] = useState<Funnel | null>(null)
    const [saving, setSaving] = useState(false)
    const [copiedId, setCopiedId] = useState<string | null>(null)
    const [activeTab, setActiveTab] = useState<'funnels' | 'analytics'>('analytics')
    const [timeRange, setTimeRange] = useState<'today' | 'yesterday' | '7d' | '30d' | 'all' | 'custom'>('today')
    const [customFrom, setCustomFrom] = useState('')
    const [customTo, setCustomTo] = useState('')

    const baseUrl = typeof window !== 'undefined' ? window.location.origin : ''

    // --- Analytics calculations ---
    const analytics = useMemo(() => {
        const now = new Date()
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
        const yesterdayStart = new Date(todayStart.getTime() - 86400000)
        const ranges: Record<string, { from: Date; to: Date }> = {
            today: { from: todayStart, to: now },
            yesterday: { from: yesterdayStart, to: todayStart },
            '7d': { from: new Date(now.getTime() - 7 * 86400000), to: now },
            '30d': { from: new Date(now.getTime() - 30 * 86400000), to: now },
            all: { from: new Date(0), to: now },
            custom: {
                from: customFrom ? new Date(customFrom + 'T00:00:00') : todayStart,
                to: customTo ? new Date(customTo + 'T23:59:59') : now,
            },
        }
        const { from: since, to: until } = ranges[timeRange]

        const filteredViews = pageViews.filter(v => { const d = new Date(v.created_at); return d >= since && d <= until })
        const filteredSubs = submissions.filter(s => { const d = new Date(s.created_at); return d >= since && d <= until })

        // Per-funnel stats
        const funnelStats = funnels.map(f => {
            const views = filteredViews.filter(v => v.funnel_id === f.id)
            const subs = filteredSubs.filter(s => s.funnel_id === f.id)
            const uniqueVisitors = countUniqueVisitors(views)
            const convRate = uniqueVisitors > 0 ? (subs.length / uniqueVisitors * 100) : 0

            // A/B test settings
            const abActive = f.settings?.ab_test_active === true

            // Per-variant A/B with proper submission tracking
            const variants = ['A', 'B']
            const variantStats = variants.map(v => {
                const vViews = views.filter(pv => (pv.page_variant || 'A') === v)
                const vSubs = subs.filter(s => (s.page_variant || 'A') === v)
                const vUniqueVisitors = countUniqueVisitors(vViews)
                const vRate = vUniqueVisitors > 0 ? (vSubs.length / vUniqueVisitors * 100) : 0
                return { variant: v, views: vViews.length, uniqueVisitors: vUniqueVisitors, conversions: vSubs.length, rate: vRate }
            }).filter(v => v.views > 0 || abActive)

            // Determine winner (only if both variants have data)
            let winner: string | null = null
            const hasEnoughData = variantStats.length >= 2 && variantStats.every(v => v.uniqueVisitors >= 30)
            if (hasEnoughData) {
                const sorted = [...variantStats].sort((a, b) => b.rate - a.rate)
                const diff = sorted[0].rate - sorted[1].rate
                // Winner if >10% relative difference and both have enough data
                if (diff > 0 && sorted[0].rate > 0) {
                    const relativeDiff = (diff / Math.max(sorted[1].rate, 0.01)) * 100
                    if (relativeDiff > 10 || sorted[0].uniqueVisitors >= 100) {
                        winner = sorted[0].variant
                    }
                }
            }

            // Device breakdown
            const devices = { mobile: 0, desktop: 0, tablet: 0 }
            views.forEach(v => {
                if (v.device_type === 'mobile') devices.mobile++
                else if (v.device_type === 'tablet') devices.tablet++
                else devices.desktop++
            })

            // UTM campaign breakdown
            const campaignMap: Record<string, { views: number; conversions: number }> = {}
            views.forEach(v => {
                const camp = v.utm_campaign || 'Diretto'
                if (!campaignMap[camp]) campaignMap[camp] = { views: 0, conversions: 0 }
                campaignMap[camp].views++
            })
            subs.forEach(s => {
                const camp = s.utm_campaign || 'Diretto'
                if (campaignMap[camp]) campaignMap[camp].conversions++
            })

            return { funnel: f, views: views.length, uniqueVisitors, conversions: subs.length, convRate, variantStats, winner, abActive, devices, campaigns: campaignMap }
        })

        // Totals
        const totalViews = filteredViews.length
        const totalUniqueVisitors = countUniqueVisitors(filteredViews)
        const totalConv = filteredSubs.length
        const totalRate = totalUniqueVisitors > 0 ? (totalConv / totalUniqueVisitors * 100) : 0

        return { funnelStats, totalViews, totalUniqueVisitors, totalConv, totalRate }
    }, [funnels, pageViews, submissions, timeRange, customFrom, customTo])

    const handleSave = async (formData: any) => {
        setSaving(true)
        try {
            if (editing) {
                const res = await fetch('/api/funnels', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id: editing.id, ...formData }),
                })
                if (res.ok) setFunnels(prev => prev.map(f => f.id === editing.id ? { ...f, ...formData } : f))
            } else {
                const res = await fetch('/api/funnels', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(formData),
                })
                const created = await res.json()
                if (res.ok) setFunnels(prev => [created, ...prev])
            }
            setShowModal(false)
            setEditing(null)
        } catch (err) { console.error(err) }
        setSaving(false)
    }

    const handleDelete = async (id: string) => {
        if (!confirm('Eliminare questo funnel?')) return
        await fetch(`/api/funnels?id=${id}`, { method: 'DELETE' })
        setFunnels(prev => prev.filter(f => f.id !== id))
    }

    const handleStatusChange = async (funnel: Funnel, newStatus: string) => {
        const res = await fetch('/api/funnels', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: funnel.id, status: newStatus }),
        })
        if (res.ok) setFunnels(prev => prev.map(f => f.id === funnel.id ? { ...f, status: newStatus as any } : f))
    }

    const toggleAbTest = async (funnel: Funnel) => {
        const currentSettings = funnel.settings || {}
        const newSettings = { ...currentSettings, ab_test_active: !currentSettings.ab_test_active }
        const res = await fetch('/api/funnels', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: funnel.id, settings: newSettings }),
        })
        if (res.ok) setFunnels(prev => prev.map(f => f.id === funnel.id ? { ...f, settings: newSettings } : f))
    }

    const declareWinner = async (funnel: Funnel, winnerVariant: string) => {
        if (!confirm(`Dichiarare la Variante ${winnerVariant} come vincitrice? Il test verrà disattivato.`)) return
        const currentSettings = funnel.settings || {}
        const newSettings = { 
            ...currentSettings, 
            ab_test_active: false, 
            ab_winner: winnerVariant,
            ab_winner_declared_at: new Date().toISOString(),
        }
        const res = await fetch('/api/funnels', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: funnel.id, settings: newSettings }),
        })
        if (res.ok) setFunnels(prev => prev.map(f => f.id === funnel.id ? { ...f, settings: newSettings } : f))
    }

    const copyUrl = (slug: string, id: string) => {
        navigator.clipboard.writeText(`${baseUrl}/f/${slug}`)
        setCopiedId(id)
        setTimeout(() => setCopiedId(null), 2000)
    }

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex items-center justify-between gap-4 flex-wrap">
                <div>
                    <h1 className="text-2xl font-bold text-white flex items-center gap-3">
                        <Target className="w-6 h-6" style={{ color: '#8b5cf6' }} />
                        Funnel & Analytics
                    </h1>
                    <p className="text-sm mt-1" style={{ color: 'var(--color-surface-600)' }}>
                        Landing page, utenti unici, conversion rate e A/B testing
                    </p>
                </div>
                <div className="flex gap-2">
                    <button onClick={() => { setEditing(null); setShowModal(true) }} className="btn-primary">
                        <Plus className="w-4 h-4" /> Nuovo Funnel
                    </button>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 p-1 rounded-xl" style={{ background: 'var(--color-surface-100)' }}>
                <button
                    onClick={() => setActiveTab('analytics')}
                    className={`flex-1 px-4 py-2 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-2 ${activeTab === 'analytics' ? 'text-white' : ''}`}
                    style={activeTab === 'analytics' ? { background: 'rgba(139, 92, 246, 0.15)', color: '#a78bfa' } : { color: 'var(--color-surface-500)' }}
                >
                    <BarChart3 className="w-3.5 h-3.5" /> Analytics
                </button>
                <button
                    onClick={() => setActiveTab('funnels')}
                    className={`flex-1 px-4 py-2 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-2 ${activeTab === 'funnels' ? 'text-white' : ''}`}
                    style={activeTab === 'funnels' ? { background: 'rgba(139, 92, 246, 0.15)', color: '#a78bfa' } : { color: 'var(--color-surface-500)' }}
                >
                    <Globe className="w-3.5 h-3.5" /> Funnel
                </button>
            </div>

            {activeTab === 'analytics' && (
                <div className="space-y-4">
                    {/* Time Range Filter */}
                    <div className="flex flex-wrap gap-2 items-center">
                        {[
                            { key: 'today', label: 'Oggi' },
                            { key: 'yesterday', label: 'Ieri' },
                            { key: '7d', label: '7 giorni' },
                            { key: '30d', label: '30 giorni' },
                            { key: 'all', label: 'Tutto' },
                            { key: 'custom', label: 'Personalizzata' },
                        ].map(r => (
                            <button
                                key={r.key}
                                onClick={() => setTimeRange(r.key as any)}
                                className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5"
                                style={timeRange === r.key
                                    ? { background: 'rgba(139, 92, 246, 0.15)', color: '#a78bfa', border: '1px solid rgba(139, 92, 246, 0.3)' }
                                    : { background: 'var(--color-surface-100)', color: 'var(--color-surface-500)', border: '1px solid transparent' }
                                }
                            >
                                {r.key === 'custom' && <Calendar className="w-3 h-3" />}
                                {r.label}
                            </button>
                        ))}
                    </div>
                    {/* Custom Date Picker */}
                    {timeRange === 'custom' && (
                        <div className="flex gap-3 items-center flex-wrap">
                            <div className="flex items-center gap-2">
                                <label className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: 'var(--color-surface-500)' }}>Da</label>
                                <input
                                    type="date"
                                    value={customFrom}
                                    onChange={e => setCustomFrom(e.target.value)}
                                    className="px-3 py-1.5 rounded-lg text-xs font-medium"
                                    style={{ background: 'var(--color-surface-100)', color: 'var(--color-surface-400)', border: '1px solid rgba(255,255,255,0.06)', colorScheme: 'dark' }}
                                />
                            </div>
                            <div className="flex items-center gap-2">
                                <label className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: 'var(--color-surface-500)' }}>A</label>
                                <input
                                    type="date"
                                    value={customTo}
                                    onChange={e => setCustomTo(e.target.value)}
                                    className="px-3 py-1.5 rounded-lg text-xs font-medium"
                                    style={{ background: 'var(--color-surface-100)', color: 'var(--color-surface-400)', border: '1px solid rgba(255,255,255,0.06)', colorScheme: 'dark' }}
                                />
                            </div>
                        </div>
                    )}

                    {/* Summary KPIs */}
                    <div className="grid grid-cols-4 gap-4">
                        <div className="glass-card p-5">
                            <div className="flex items-center gap-2 mb-2">
                                <Users className="w-4 h-4" style={{ color: '#8b5cf6' }} />
                                <span className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: 'var(--color-surface-500)' }}>Utenti Unici</span>
                            </div>
                            <p className="text-2xl font-bold text-white">{analytics.totalUniqueVisitors.toLocaleString()}</p>
                            <p className="text-[10px] mt-1" style={{ color: 'var(--color-surface-600)' }}>{analytics.totalViews.toLocaleString()} page views totali</p>
                        </div>
                        <div className="glass-card p-5">
                            <div className="flex items-center gap-2 mb-2">
                                <Eye className="w-4 h-4" style={{ color: '#3b82f6' }} />
                                <span className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: 'var(--color-surface-500)' }}>Page Views</span>
                            </div>
                            <p className="text-2xl font-bold text-white">{analytics.totalViews.toLocaleString()}</p>
                        </div>
                        <div className="glass-card p-5">
                            <div className="flex items-center gap-2 mb-2">
                                <Target className="w-4 h-4" style={{ color: '#22c55e' }} />
                                <span className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: 'var(--color-surface-500)' }}>Conversioni</span>
                            </div>
                            <p className="text-2xl font-bold text-white">{analytics.totalConv.toLocaleString()}</p>
                        </div>
                        <div className="glass-card p-5">
                            <div className="flex items-center gap-2 mb-2">
                                <ArrowUpRight className="w-4 h-4" style={{ color: '#f59e0b' }} />
                                <span className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: 'var(--color-surface-500)' }}>Conv. Rate</span>
                            </div>
                            <p className="text-2xl font-bold" style={{ color: analytics.totalRate >= 5 ? '#22c55e' : analytics.totalRate >= 2 ? '#f59e0b' : '#ef4444' }}>
                                {analytics.totalRate.toFixed(1)}%
                            </p>
                            <p className="text-[10px] mt-1" style={{ color: 'var(--color-surface-600)' }}>su utenti unici</p>
                        </div>
                    </div>

                    {/* Per-Funnel Analytics */}
                    {analytics.funnelStats.map(stat => (
                        <div key={stat.funnel.id} className="glass-card p-5 space-y-4">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(139, 92, 246, 0.1)', border: '1px solid rgba(139, 92, 246, 0.2)' }}>
                                        <Globe className="w-4 h-4" style={{ color: '#8b5cf6' }} />
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-bold text-white">{stat.funnel.name}</h3>
                                        <p className="text-[10px]" style={{ color: 'var(--color-surface-500)' }}>/f/{stat.funnel.slug}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    {stat.abActive && (
                                        <span className="badge" style={{ background: 'rgba(139, 92, 246, 0.1)', color: '#a855f7', border: '1px solid rgba(139, 92, 246, 0.2)' }}>
                                            <FlaskConical className="w-3 h-3" /> A/B Test Attivo
                                        </span>
                                    )}
                                    {stat.funnel.settings?.ab_winner && !stat.abActive && (
                                        <span className="badge" style={{ background: 'rgba(34, 197, 94, 0.1)', color: '#22c55e', border: '1px solid rgba(34, 197, 94, 0.2)' }}>
                                            <Trophy className="w-3 h-3" /> Winner: Variante {stat.funnel.settings.ab_winner}
                                        </span>
                                    )}
                                    <span className="badge" style={{
                                        background: statusConfig[stat.funnel.status]?.color + '10',
                                        color: statusConfig[stat.funnel.status]?.color,
                                        border: `1px solid ${statusConfig[stat.funnel.status]?.color}20`
                                    }}>
                                        {statusConfig[stat.funnel.status]?.label}
                                    </span>
                                </div>
                            </div>

                            {/* Stats Row */}
                            <div className="grid grid-cols-5 gap-3">
                                <div className="px-3 py-2 rounded-lg" style={{ background: 'var(--color-surface-100)' }}>
                                    <p className="text-[10px] mb-0.5" style={{ color: 'var(--color-surface-500)' }}>Utenti Unici</p>
                                    <p className="text-lg font-bold text-white">{stat.uniqueVisitors.toLocaleString()}</p>
                                    <p className="text-[9px]" style={{ color: 'var(--color-surface-600)' }}>{stat.views} views</p>
                                </div>
                                <div className="px-3 py-2 rounded-lg" style={{ background: 'var(--color-surface-100)' }}>
                                    <p className="text-[10px] mb-0.5" style={{ color: 'var(--color-surface-500)' }}>Lead</p>
                                    <p className="text-lg font-bold" style={{ color: '#22c55e' }}>{stat.conversions}</p>
                                </div>
                                <div className="px-3 py-2 rounded-lg" style={{ background: 'var(--color-surface-100)' }}>
                                    <p className="text-[10px] mb-0.5" style={{ color: 'var(--color-surface-500)' }}>Conv Rate</p>
                                    <p className="text-lg font-bold" style={{ color: stat.convRate >= 5 ? '#22c55e' : stat.convRate >= 2 ? '#f59e0b' : '#ef4444' }}>
                                        {stat.convRate.toFixed(1)}%
                                    </p>
                                </div>
                                <div className="px-3 py-2 rounded-lg" style={{ background: 'var(--color-surface-100)' }}>
                                    <p className="text-[10px] mb-0.5" style={{ color: 'var(--color-surface-500)' }}>Dispositivi</p>
                                    <div className="flex items-center gap-2 mt-1">
                                        <span className="flex items-center gap-1 text-[10px]" style={{ color: 'var(--color-surface-600)' }}>
                                            <Smartphone className="w-3 h-3" /> {stat.devices.mobile}
                                        </span>
                                        <span className="flex items-center gap-1 text-[10px]" style={{ color: 'var(--color-surface-600)' }}>
                                            <Monitor className="w-3 h-3" /> {stat.devices.desktop}
                                        </span>
                                    </div>
                                </div>
                                <div className="px-3 py-2 rounded-lg" style={{ background: 'var(--color-surface-100)' }}>
                                    <p className="text-[10px] mb-0.5" style={{ color: 'var(--color-surface-500)' }}>A/B Test</p>
                                    <button 
                                        onClick={() => toggleAbTest(stat.funnel)}
                                        className="flex items-center gap-1.5 mt-1 text-[11px] font-medium transition-all hover:opacity-80"
                                        style={{ color: stat.abActive ? '#a855f7' : 'var(--color-surface-500)' }}
                                    >
                                        {stat.abActive 
                                            ? <><ToggleRight className="w-4 h-4" /> Attivo</>
                                            : <><ToggleLeft className="w-4 h-4" /> Off</>
                                        }
                                    </button>
                                </div>
                            </div>

                            {/* A/B Test Variants — enhanced */}
                            {(stat.variantStats.length > 1 || stat.abActive) && (
                                <div className="pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                                    <div className="flex items-center justify-between mb-3">
                                        <div className="flex items-center gap-2">
                                            <FlaskConical className="w-3.5 h-3.5" style={{ color: '#8b5cf6' }} />
                                            <span className="text-xs font-semibold text-white">Split Test — Confronto Varianti</span>
                                        </div>
                                        {stat.winner && (
                                            <span className="badge" style={{ background: 'rgba(34, 197, 94, 0.1)', color: '#22c55e', border: '1px solid rgba(34, 197, 94, 0.2)', fontSize: '10px' }}>
                                                <Trophy className="w-3 h-3" /> Variante {stat.winner} sta vincendo
                                            </span>
                                        )}
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        {stat.variantStats.map(v => {
                                            const isWinner = stat.winner === v.variant
                                            const colorA = '#3b82f6'
                                            const colorB = '#a855f7'
                                            const varColor = v.variant === 'A' ? colorA : colorB
                                            return (
                                                <div key={v.variant} className="px-4 py-4 rounded-xl relative" style={{ 
                                                    background: 'var(--color-surface-100)', 
                                                    border: isWinner 
                                                        ? '2px solid rgba(34, 197, 94, 0.4)' 
                                                        : `1px solid ${varColor}20`,
                                                }}>
                                                    {isWinner && (
                                                        <div className="absolute -top-2 -right-2 w-6 h-6 rounded-full flex items-center justify-center" style={{ background: '#22c55e' }}>
                                                            <Trophy className="w-3 h-3 text-white" />
                                                        </div>
                                                    )}
                                                    <div className="flex items-center justify-between mb-3">
                                                        <span className="text-sm font-bold" style={{ color: varColor }}>
                                                            Variante {v.variant}
                                                        </span>
                                                        <span className="text-lg font-black" style={{ color: v.rate >= 5 ? '#22c55e' : v.rate >= 2 ? '#f59e0b' : v.rate > 0 ? '#ef4444' : 'var(--color-surface-500)' }}>
                                                            {v.rate.toFixed(1)}%
                                                        </span>
                                                    </div>
                                                    <div className="grid grid-cols-3 gap-2 text-center mb-3">
                                                        <div>
                                                            <p className="text-[9px] uppercase" style={{ color: 'var(--color-surface-500)' }}>Unici</p>
                                                            <p className="text-sm font-bold text-white">{v.uniqueVisitors}</p>
                                                        </div>
                                                        <div>
                                                            <p className="text-[9px] uppercase" style={{ color: 'var(--color-surface-500)' }}>Lead</p>
                                                            <p className="text-sm font-bold" style={{ color: '#22c55e' }}>{v.conversions}</p>
                                                        </div>
                                                        <div>
                                                            <p className="text-[9px] uppercase" style={{ color: 'var(--color-surface-500)' }}>Views</p>
                                                            <p className="text-sm font-bold" style={{ color: 'var(--color-surface-600)' }}>{v.views}</p>
                                                        </div>
                                                    </div>
                                                    {/* Conversion bar */}
                                                    <div className="h-2 rounded-full" style={{ background: 'rgba(255,255,255,0.05)' }}>
                                                        <div className="h-full rounded-full transition-all" style={{
                                                            width: `${Math.min(v.rate * 2, 100)}%`,
                                                            background: isWinner ? '#22c55e' : varColor,
                                                        }} />
                                                    </div>
                                                    {/* Declare winner button */}
                                                    {stat.abActive && v.uniqueVisitors >= 30 && (
                                                        <button
                                                            onClick={() => declareWinner(stat.funnel, v.variant)}
                                                            className="mt-3 w-full py-1.5 rounded-lg text-[10px] font-semibold transition-all hover:opacity-80"
                                                            style={{ 
                                                                background: isWinner ? 'rgba(34, 197, 94, 0.1)' : 'rgba(255,255,255,0.03)', 
                                                                color: isWinner ? '#22c55e' : 'var(--color-surface-500)',
                                                                border: `1px solid ${isWinner ? 'rgba(34, 197, 94, 0.2)' : 'rgba(255,255,255,0.06)'}`,
                                                            }}
                                                        >
                                                            <Trophy className="w-3 h-3 inline mr-1" />
                                                            Dichiara Winner
                                                        </button>
                                                    )}
                                                </div>
                                            )
                                        })}
                                    </div>
                                    {stat.abActive && stat.variantStats.every(v => v.uniqueVisitors < 30) && (
                                        <p className="text-[10px] mt-2 text-center" style={{ color: 'var(--color-surface-500)' }}>
                                            ⏳ Serve un minimo di 30 visitatori unici per variante per dichiarare un vincitore
                                        </p>
                                    )}
                                </div>
                            )}

                            {/* Campaign breakdown */}
                            {Object.keys(stat.campaigns).length > 0 && (
                                <div className="pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                                    <p className="text-[10px] uppercase tracking-wider font-semibold mb-2" style={{ color: 'var(--color-surface-500)' }}>Per Campagna</p>
                                    <div className="space-y-1.5">
                                        {Object.entries(stat.campaigns).sort((a, b) => b[1].views - a[1].views).slice(0, 5).map(([name, data]) => {
                                            const rate = data.views > 0 ? (data.conversions / data.views * 100) : 0
                                            return (
                                                <div key={name} className="flex items-center justify-between text-[11px] px-2 py-1.5 rounded-lg" style={{ background: 'var(--color-surface-100)' }}>
                                                    <span className="text-white font-medium truncate flex-1 mr-3">{name}</span>
                                                    <div className="flex items-center gap-3 flex-shrink-0">
                                                        <span style={{ color: 'var(--color-surface-500)' }}>{data.views} <Eye className="w-3 h-3 inline" /></span>
                                                        <span style={{ color: '#22c55e' }}>{data.conversions} <Target className="w-3 h-3 inline" /></span>
                                                        <span style={{ color: rate >= 5 ? '#22c55e' : '#f59e0b' }} className="font-semibold w-12 text-right">{rate.toFixed(1)}%</span>
                                                    </div>
                                                </div>
                                            )
                                        })}
                                    </div>
                                </div>
                            )}

                            {stat.views === 0 && (
                                <div className="text-center py-4">
                                    <p className="text-xs" style={{ color: 'var(--color-surface-500)' }}>Nessun dato ancora — le visite appariranno qui non appena le ads iniziano a portare traffico</p>
                                </div>
                            )}
                        </div>
                    ))}

                    {analytics.funnelStats.length === 0 && (
                        <div className="glass-card p-12 text-center">
                            <BarChart3 className="w-12 h-12 mx-auto mb-4" style={{ color: 'var(--color-surface-400)', opacity: 0.3 }} />
                            <p className="text-sm font-semibold text-white mb-2">Nessun dato analytics</p>
                            <p className="text-xs" style={{ color: 'var(--color-surface-500)' }}>Crea un funnel e le visite appariranno qui</p>
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'funnels' && (
                <>
                    {/* How it works */}
                    <div className="glass-card p-5">
                        <div className="flex items-start gap-3">
                            <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(139, 92, 246, 0.15)', border: '1px solid rgba(139, 92, 246, 0.3)' }}>
                                <Sparkles className="w-4 h-4" style={{ color: '#8b5cf6' }} />
                            </div>
                            <div className="text-xs leading-relaxed" style={{ color: 'var(--color-surface-500)' }}>
                                <strong className="text-white">Come funziona:</strong> Crea un funnel → Attivalo → Copia il link pubblico → Usalo nelle ads di Meta/Google.
                                Quando un utente compila il form, il lead viene creato automaticamente nel CRM, nella prima fase del pipeline,
                                e l&apos;evento viene inviato a Meta CAPI per ottimizzare le campagne.
                                <br /><br />
                                <strong className="text-white">A/B Testing:</strong> Attiva lo split test dalla tab Analytics per dividere il traffico 50/50 tra due varianti.
                                Imposta la variante B nelle impostazioni del funnel (campo &quot;Variante A/B&quot;). Confronta i risultati e dichiara il vincitore.
                            </div>
                        </div>
                    </div>

                    {/* Funnel Cards */}
                    {funnels.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {funnels.map(funnel => {
                                const st = statusConfig[funnel.status] || statusConfig.draft
                                const StIcon = st.icon
                                const publicUrl = `${baseUrl}/f/${funnel.slug}`
                                return (
                                    <div key={funnel.id} className="glass-card p-5 group">
                                        <div className="flex items-start justify-between mb-3">
                                            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(139, 92, 246, 0.1)', border: '1px solid rgba(139, 92, 246, 0.2)' }}>
                                                <Globe className="w-5 h-5" style={{ color: '#8b5cf6' }} />
                                            </div>
                                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button onClick={() => { setEditing(funnel); setShowModal(true) }} className="p-1.5 rounded-lg hover:bg-white/5">
                                                    <Edit3 className="w-3.5 h-3.5" style={{ color: 'var(--color-sincro-400)' }} />
                                                </button>
                                                <button onClick={() => handleDelete(funnel.id)} className="p-1.5 rounded-lg hover:bg-white/5">
                                                    <Trash2 className="w-3.5 h-3.5" style={{ color: '#ef4444' }} />
                                                </button>
                                            </div>
                                        </div>

                                        <h3 className="text-sm font-bold text-white mb-1">{funnel.name}</h3>
                                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                                            {funnel.objective && (
                                                <span className="badge inline-flex" style={{
                                                    background: funnel.objective === 'partner' ? 'rgba(245, 158, 11, 0.1)' : 'rgba(59, 130, 246, 0.1)',
                                                    color: funnel.objective === 'partner' ? '#f59e0b' : '#3b82f6',
                                                    border: `1px solid ${funnel.objective === 'partner' ? 'rgba(245, 158, 11, 0.2)' : 'rgba(59, 130, 246, 0.2)'}`,
                                                    fontSize: '10px',
                                                }}>
                                                    {funnel.objective === 'partner' ? '🤝 Partner' : funnel.objective === 'cliente' ? '👤 Cliente' : `🎯 ${funnel.objective}`}
                                                </span>
                                            )}
                                            {funnel.settings?.ab_test_active && (
                                                <span className="badge inline-flex" style={{
                                                    background: 'rgba(139, 92, 246, 0.1)',
                                                    color: '#a855f7',
                                                    border: '1px solid rgba(139, 92, 246, 0.2)',
                                                    fontSize: '10px',
                                                }}>
                                                    <FlaskConical className="w-3 h-3" /> A/B
                                                </span>
                                            )}
                                        </div>
                                        {funnel.description && (
                                            <p className="text-xs mb-3 line-clamp-2" style={{ color: 'var(--color-surface-500)' }}>{funnel.description}</p>
                                        )}

                                        {/* Public URL */}
                                        <div className="flex items-center gap-2 mb-3">
                                            <div className="flex-1 text-[11px] font-mono px-2.5 py-1.5 rounded-lg truncate" style={{ background: 'var(--color-surface-100)', color: 'var(--color-surface-600)' }}>
                                                <Link2 className="w-3 h-3 inline mr-1.5 opacity-50" />
                                                /f/{funnel.slug}
                                            </div>
                                            <button
                                                onClick={() => copyUrl(funnel.slug, funnel.id)}
                                                className="p-1.5 rounded-lg hover:bg-white/5 transition-colors"
                                                title="Copia URL"
                                            >
                                                {copiedId === funnel.id
                                                    ? <Check className="w-3.5 h-3.5" style={{ color: '#22c55e' }} />
                                                    : <Copy className="w-3.5 h-3.5" style={{ color: 'var(--color-surface-500)' }} />
                                                }
                                            </button>
                                            {funnel.status === 'active' && (
                                                <a href={publicUrl} target="_blank" rel="noopener" className="p-1.5 rounded-lg hover:bg-white/5">
                                                    <ExternalLink className="w-3.5 h-3.5" style={{ color: '#8b5cf6' }} />
                                                </a>
                                            )}
                                        </div>

                                        <div className="flex items-center justify-between pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                                            <span className="badge" style={{ background: `${st.color}10`, color: st.color, border: `1px solid ${st.color}20` }}>
                                                <StIcon className="w-3 h-3" /> {st.label}
                                            </span>
                                            <div className="flex gap-1">
                                                {funnel.status !== 'active' && (
                                                    <button onClick={() => handleStatusChange(funnel, 'active')} className="p-1 rounded-lg hover:bg-white/5" title="Attiva">
                                                        <Play className="w-3.5 h-3.5" style={{ color: '#22c55e' }} />
                                                    </button>
                                                )}
                                                {funnel.status === 'active' && (
                                                    <button onClick={() => handleStatusChange(funnel, 'paused')} className="p-1 rounded-lg hover:bg-white/5" title="Pausa">
                                                        <Pause className="w-3.5 h-3.5" style={{ color: '#f59e0b' }} />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    ) : (
                        <div className="glass-card p-12 text-center">
                            <Inbox className="w-12 h-12 mx-auto mb-4" style={{ color: 'var(--color-surface-400)', opacity: 0.3 }} />
                            <p className="text-sm font-semibold text-white mb-2">Nessun funnel</p>
                            <p className="text-xs mb-4" style={{ color: 'var(--color-surface-500)' }}>Crea il tuo primo funnel per iniziare a raccogliere lead</p>
                            <button onClick={() => setShowModal(true)} className="btn-primary">
                                <Plus className="w-4 h-4" /> Crea Funnel
                            </button>
                        </div>
                    )}
                </>
            )}

            {showModal && (
                <FunnelModal
                    funnel={editing}
                    pipelines={pipelines}
                    saving={saving}
                    onSave={handleSave}
                    onClose={() => { setShowModal(false); setEditing(null) }}
                />
            )}
        </div>
    )
}

function FunnelModal({ funnel, pipelines, saving, onSave, onClose }: {
    funnel: Funnel | null; pipelines: Pipeline[]; saving: boolean; onSave: (data: any) => void; onClose: () => void
}) {
    const [form, setForm] = useState({
        name: funnel?.name || '',
        slug: funnel?.slug || '',
        description: funnel?.description || '',
        objective: funnel?.objective || 'cliente',
        meta_pixel_id: funnel?.meta_pixel_id || '',
        pipeline_id: funnel?.pipeline_id || '',
        status: funnel?.status || 'draft',
        settings: {
            headline: funnel?.settings?.headline || '',
            subheadline: funnel?.settings?.subheadline || '',
            cta_text: funnel?.settings?.cta_text || 'Invia Richiesta',
            thank_you: funnel?.settings?.thank_you || 'Grazie! Ti contatteremo il prima possibile.',
            accent_color: funnel?.settings?.accent_color || '#6366f1',
            ab_variant: funnel?.settings?.ab_variant || 'A',
            ab_test_active: funnel?.settings?.ab_test_active || false,
            ab_variant_b_slug: funnel?.settings?.ab_variant_b_slug || '',
            template: funnel?.settings?.template || '',
            organization_id: funnel?.settings?.organization_id || '',
            google_ads_id: funnel?.settings?.google_ads_id || '',
            google_ads_label: funnel?.settings?.google_ads_label || '',
            tiktok_pixel_id: funnel?.settings?.tiktok_pixel_id || '',
        },
        ai_settings: {
            tone: funnel?.ai_settings?.tone || '',
            target: funnel?.ai_settings?.target || '',
            optimize_for: funnel?.ai_settings?.optimize_for || 'lead_quality',
        },
    })

    const handleNameChange = (name: string) => {
        const slug = funnel ? form.slug : name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')
        setForm({ ...form, name, slug })
    }

    const updateSettings = (key: string, val: any) => {
        setForm({ ...form, settings: { ...form.settings, [key]: val } })
    }

    const updateAi = (key: string, val: any) => {
        setForm({ ...form, ai_settings: { ...form.ai_settings, [key]: val } })
    }

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        onSave(form)
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in" onClick={onClose}>
            <div className="w-full max-w-lg glass-card p-6 m-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-lg font-bold text-white">{funnel ? 'Modifica Funnel' : 'Nuovo Funnel'}</h2>
                    <button onClick={onClose} className="p-2 rounded-xl hover:bg-white/5"><X className="w-5 h-5" style={{ color: 'var(--color-surface-500)' }} /></button>
                </div>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="label">Nome *</label>
                        <input className="input" value={form.name} onChange={e => handleNameChange(e.target.value)} placeholder="es. Landing Platinum" required />
                    </div>
                    <div>
                        <label className="label">Slug (URL)</label>
                        <input className="input" value={form.slug} onChange={e => setForm({ ...form, slug: e.target.value })} placeholder="landing-platinum" />
                        <p className="text-[10px] mt-1" style={{ color: 'var(--color-surface-500)' }}>Pagina pubblica: /f/{form.slug || '...'}</p>
                    </div>
                    <div>
                        <label className="label">Obiettivo campagna</label>
                        <select className="input" value={form.objective} onChange={e => setForm({ ...form, objective: e.target.value })}>
                            <option value="cliente">👤 Acquisizione Clienti</option>
                            <option value="partner">🤝 Acquisizione Partner</option>
                            <option value="brand">📢 Brand Awareness</option>
                            <option value="evento">🎟️ Evento / Webinar</option>
                        </select>
                        <p className="text-[10px] mt-1" style={{ color: 'var(--color-surface-500)' }}>Meta CAPI userà questo come content_category per distinguere le campagne</p>
                    </div>
                    <div>
                        <label className="label">Descrizione</label>
                        <textarea className="input" rows={2} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Descrizione del funnel..." />
                    </div>

                    {/* Landing Page Settings */}
                    <div className="pt-2 mt-2" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                        <div className="flex items-center gap-2 mb-3">
                            <Sparkles className="w-4 h-4" style={{ color: '#8b5cf6' }} />
                            <span className="text-xs font-semibold text-white">Personalizza Landing Page</span>
                        </div>
                        <div className="space-y-3">
                            <div>
                                <label className="label">Titolo principale</label>
                                <input className="input" value={form.settings.headline} onChange={e => updateSettings('headline', e.target.value)} placeholder="Il titolo che vedranno i visitatori" />
                            </div>
                            <div>
                                <label className="label">Sottotitolo</label>
                                <input className="input" value={form.settings.subheadline} onChange={e => updateSettings('subheadline', e.target.value)} placeholder="Descrizione persuasiva" />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="label">Testo CTA</label>
                                    <input className="input" value={form.settings.cta_text} onChange={e => updateSettings('cta_text', e.target.value)} placeholder="Invia Richiesta" />
                                </div>
                                <div>
                                    <label className="label">Colore accento</label>
                                    <div className="flex gap-2">
                                        <input type="color" value={form.settings.accent_color} onChange={e => updateSettings('accent_color', e.target.value)} className="w-10 h-10 rounded-lg cursor-pointer border-0" />
                                        <input className="input flex-1" value={form.settings.accent_color} onChange={e => updateSettings('accent_color', e.target.value)} />
                                    </div>
                                </div>
                            </div>
                            <div>
                                <label className="label">Messaggio di ringraziamento</label>
                                <input className="input" value={form.settings.thank_you} onChange={e => updateSettings('thank_you', e.target.value)} placeholder="Grazie! Ti contatteremo..." />
                            </div>
                        </div>
                    </div>

                    {/* A/B Test Settings */}
                    <div className="pt-2 mt-2" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                        <div className="flex items-center gap-2 mb-3">
                            <FlaskConical className="w-4 h-4" style={{ color: '#a855f7' }} />
                            <span className="text-xs font-semibold text-white">A/B Testing</span>
                        </div>
                        <div className="space-y-3">
                            <div className="flex items-center justify-between px-3 py-3 rounded-xl" style={{ background: 'var(--color-surface-100)' }}>
                                <div>
                                    <p className="text-xs font-semibold text-white">Split Test Attivo</p>
                                    <p className="text-[10px]" style={{ color: 'var(--color-surface-500)' }}>Divide il traffico 50/50 tra variante A e B</p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => updateSettings('ab_test_active', !form.settings.ab_test_active)}
                                    style={{ color: form.settings.ab_test_active ? '#a855f7' : 'var(--color-surface-500)' }}
                                >
                                    {form.settings.ab_test_active
                                        ? <ToggleRight className="w-8 h-8" />
                                        : <ToggleLeft className="w-8 h-8" />
                                    }
                                </button>
                            </div>
                            <div>
                                <label className="label">Variante di questa pagina</label>
                                <select className="input" value={form.settings.ab_variant} onChange={e => updateSettings('ab_variant', e.target.value)}>
                                    <option value="A">Variante A (Control)</option>
                                    <option value="B">Variante B (Challenger)</option>
                                </select>
                                <p className="text-[10px] mt-1" style={{ color: 'var(--color-surface-500)' }}>
                                    Imposta quale variante rappresenta questo funnel. Crea un secondo funnel per l&apos;altra variante.
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Pipeline CRM */}
                    <div className="pt-2 mt-2" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                        <div className="flex items-center gap-2 mb-3">
                            <Target className="w-4 h-4" style={{ color: '#22c55e' }} />
                            <span className="text-xs font-semibold text-white">Pipeline CRM</span>
                        </div>
                        <div>
                            <label className="label">Pipeline dei Lead</label>
                            <select className="input" value={form.pipeline_id} onChange={e => setForm({ ...form, pipeline_id: e.target.value })}>
                                <option value="">Pipeline di default</option>
                                {pipelines.map(p => (
                                    <option key={p.id} value={p.id}>{p.name}{p.is_default ? ' (default)' : ''}</option>
                                ))}
                            </select>
                            <p className="text-[10px] mt-1" style={{ color: 'var(--color-surface-500)' }}>I lead da questo funnel entrano nella pipeline selezionata. Lascia vuoto per usare la default.</p>
                        </div>
                    </div>

                    {/* Tracking Pixels */}
                    <div className="pt-2 mt-2" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                        <div className="flex items-center gap-2 mb-3">
                            <Eye className="w-4 h-4" style={{ color: '#f59e0b' }} />
                            <span className="text-xs font-semibold text-white">Pixel di Tracciamento</span>
                        </div>
                        <div className="space-y-3">
                            <div>
                                <label className="label">Meta Pixel ID</label>
                                <input className="input" value={form.meta_pixel_id} onChange={e => setForm({ ...form, meta_pixel_id: e.target.value })} placeholder="1234567890" />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="label">Google Ads ID <span style={{ color: 'var(--color-surface-400)', fontWeight: 400 }}>(prossimamente)</span></label>
                                    <input className="input" value={form.settings.google_ads_id} onChange={e => updateSettings('google_ads_id', e.target.value)} placeholder="AW-123456789" disabled style={{ opacity: 0.5 }} />
                                </div>
                                <div>
                                    <label className="label">Google Ads Label</label>
                                    <input className="input" value={form.settings.google_ads_label} onChange={e => updateSettings('google_ads_label', e.target.value)} placeholder="conversion label" disabled style={{ opacity: 0.5 }} />
                                </div>
                            </div>
                            <div>
                                <label className="label">TikTok Pixel ID <span style={{ color: 'var(--color-surface-400)', fontWeight: 400 }}>(prossimamente)</span></label>
                                <input className="input" value={form.settings.tiktok_pixel_id} onChange={e => updateSettings('tiktok_pixel_id', e.target.value)} placeholder="C12345ABCDE" disabled style={{ opacity: 0.5 }} />
                            </div>
                        </div>
                    </div>

                    {/* AI Engine per funnel */}
                    <div className="pt-2 mt-2" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                        <div className="flex items-center gap-2 mb-3">
                            <Sparkles className="w-4 h-4" style={{ color: '#a855f7' }} />
                            <span className="text-xs font-semibold text-white">AI Engine — Configurazione Funnel</span>
                        </div>
                        <div className="space-y-3">
                            <div>
                                <label className="label">Tone of Voice</label>
                                <input className="input" value={form.ai_settings.tone} onChange={e => updateAi('tone', e.target.value)} placeholder="es. autorevole e motivazionale, professionale ma diretto..." />
                                <p className="text-[10px] mt-1" style={{ color: 'var(--color-surface-500)' }}>L&apos;AI userà questo tono quando crea copy e creatività per questo funnel</p>
                            </div>
                            <div>
                                <label className="label">Target Audience</label>
                                <input className="input" value={form.ai_settings.target} onChange={e => updateAi('target', e.target.value)} placeholder="es. genitori 35-50 anni con figli calciatori 14-18 anni" />
                            </div>
                            <div>
                                <label className="label">Ottimizza per</label>
                                <select className="input" value={form.ai_settings.optimize_for} onChange={e => updateAi('optimize_for', e.target.value)}>
                                    <option value="lead_quality">🎯 Qualità Lead (CPL + Show-up rate)</option>
                                    <option value="volume">📈 Volume Lead (CPL basso)</option>
                                    <option value="roas">💰 ROAS (Ritorno sulla spesa)</option>
                                    <option value="awareness">📢 Awareness (Impression e reach)</option>
                                </select>
                            </div>
                        </div>
                    </div>
                    <div className="flex gap-3 pt-2">
                        <button type="button" onClick={onClose} className="btn-secondary flex-1">Annulla</button>
                        <button type="submit" className="btn-primary flex-1" disabled={saving}>
                            {saving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : funnel ? 'Salva' : 'Crea Funnel'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}
