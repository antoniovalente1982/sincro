'use client'

import { useState, useMemo } from 'react'
import { Target, Plus, Globe, Eye, Pause, Archive, Play, Edit3, Trash2, X, ExternalLink, Inbox, Copy, Check, Link2, Sparkles, BarChart3, ArrowUpRight, ArrowDownRight, Smartphone, Monitor, Tablet, FlaskConical } from 'lucide-react'

interface Funnel {
    id: string; name: string; slug: string; description?: string
    objective?: string
    status: 'draft' | 'active' | 'paused' | 'archived'
    meta_pixel_id?: string; settings?: any; created_at: string; updated_at: string
    submission_count?: number
}

interface PageView {
    id: string; funnel_id?: string; page_path: string; page_variant?: string
    utm_source?: string; utm_campaign?: string; utm_content?: string; device_type?: string; created_at: string
}

interface Submission {
    id: string; funnel_id?: string; created_at: string; utm_source?: string; utm_campaign?: string
}

const statusConfig: Record<string, { label: string; color: string; icon: any }> = {
    draft: { label: 'Bozza', color: '#71717a', icon: Edit3 },
    active: { label: 'Attivo', color: '#22c55e', icon: Play },
    paused: { label: 'In pausa', color: '#f59e0b', icon: Pause },
    archived: { label: 'Archiviato', color: '#ef4444', icon: Archive },
}

export default function FunnelsPanel({ initialFunnels, pageViews = [], submissions = [] }: {
    initialFunnels: Funnel[]; pageViews?: PageView[]; submissions?: Submission[]
}) {
    const [funnels, setFunnels] = useState<Funnel[]>(initialFunnels)
    const [showModal, setShowModal] = useState(false)
    const [editing, setEditing] = useState<Funnel | null>(null)
    const [saving, setSaving] = useState(false)
    const [copiedId, setCopiedId] = useState<string | null>(null)
    const [activeTab, setActiveTab] = useState<'funnels' | 'analytics'>('analytics')
    const [timeRange, setTimeRange] = useState<'today' | '7d' | '30d' | 'all'>('7d')

    const baseUrl = typeof window !== 'undefined' ? window.location.origin : ''

    // --- Analytics calculations ---
    const analytics = useMemo(() => {
        const now = new Date()
        const ranges: Record<string, Date> = {
            today: new Date(now.getFullYear(), now.getMonth(), now.getDate()),
            '7d': new Date(now.getTime() - 7 * 86400000),
            '30d': new Date(now.getTime() - 30 * 86400000),
            all: new Date(0),
        }
        const since = ranges[timeRange]

        const filteredViews = pageViews.filter(v => new Date(v.created_at) >= since)
        const filteredSubs = submissions.filter(s => new Date(s.created_at) >= since)

        // Per-funnel stats
        const funnelStats = funnels.map(f => {
            const views = filteredViews.filter(v => v.funnel_id === f.id)
            const subs = filteredSubs.filter(s => s.funnel_id === f.id)
            const convRate = views.length > 0 ? (subs.length / views.length * 100) : 0

            // Per-variant A/B
            const variants = ['A', 'B']
            const variantStats = variants.map(v => {
                const vViews = views.filter(pv => (pv.page_variant || 'A') === v)
                const vSubs = subs.length // submissions don't have variant tracking yet, use total
                const vRate = vViews.length > 0 ? (vSubs / vViews.length * 100) : 0
                return { variant: v, views: vViews.length, conversions: vSubs, rate: vRate }
            }).filter(v => v.views > 0)

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

            return { funnel: f, views: views.length, conversions: subs.length, convRate, variantStats, devices, campaigns: campaignMap }
        })

        // Totals
        const totalViews = filteredViews.length
        const totalConv = filteredSubs.length
        const totalRate = totalViews > 0 ? (totalConv / totalViews * 100) : 0

        return { funnelStats, totalViews, totalConv, totalRate }
    }, [funnels, pageViews, submissions, timeRange])

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
                        Landing page, conversion rate e A/B testing
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
                    <div className="flex gap-2">
                        {[
                            { key: 'today', label: 'Oggi' },
                            { key: '7d', label: '7 giorni' },
                            { key: '30d', label: '30 giorni' },
                            { key: 'all', label: 'Tutto' },
                        ].map(r => (
                            <button
                                key={r.key}
                                onClick={() => setTimeRange(r.key as any)}
                                className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                                style={timeRange === r.key
                                    ? { background: 'rgba(139, 92, 246, 0.15)', color: '#a78bfa', border: '1px solid rgba(139, 92, 246, 0.3)' }
                                    : { background: 'var(--color-surface-100)', color: 'var(--color-surface-500)', border: '1px solid transparent' }
                                }
                            >
                                {r.label}
                            </button>
                        ))}
                    </div>

                    {/* Summary KPIs */}
                    <div className="grid grid-cols-3 gap-4">
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
                                <span className="badge" style={{
                                    background: statusConfig[stat.funnel.status]?.color + '10',
                                    color: statusConfig[stat.funnel.status]?.color,
                                    border: `1px solid ${statusConfig[stat.funnel.status]?.color}20`
                                }}>
                                    {statusConfig[stat.funnel.status]?.label}
                                </span>
                            </div>

                            {/* Stats Row */}
                            <div className="grid grid-cols-4 gap-3">
                                <div className="px-3 py-2 rounded-lg" style={{ background: 'var(--color-surface-100)' }}>
                                    <p className="text-[10px] mb-0.5" style={{ color: 'var(--color-surface-500)' }}>Views</p>
                                    <p className="text-lg font-bold text-white">{stat.views.toLocaleString()}</p>
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
                            </div>

                            {/* A/B Test Variants (if data exists) */}
                            {stat.variantStats.length > 1 && (
                                <div className="pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                                    <div className="flex items-center gap-2 mb-3">
                                        <FlaskConical className="w-3.5 h-3.5" style={{ color: '#8b5cf6' }} />
                                        <span className="text-xs font-semibold text-white">A/B Test</span>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        {stat.variantStats.map(v => (
                                            <div key={v.variant} className="px-3 py-3 rounded-lg" style={{ background: 'var(--color-surface-100)', border: v.variant === 'A' ? '1px solid rgba(59, 130, 246, 0.2)' : '1px solid rgba(168, 85, 247, 0.2)' }}>
                                                <div className="flex items-center justify-between mb-2">
                                                    <span className="text-xs font-bold" style={{ color: v.variant === 'A' ? '#3b82f6' : '#a855f7' }}>
                                                        Variante {v.variant}
                                                    </span>
                                                    <span className="text-[10px] font-semibold" style={{ color: v.rate >= 5 ? '#22c55e' : '#f59e0b' }}>
                                                        {v.rate.toFixed(1)}%
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-4 text-[10px]" style={{ color: 'var(--color-surface-500)' }}>
                                                    <span>{v.views} views</span>
                                                    <span>{v.conversions} conv</span>
                                                </div>
                                                {/* Visual bar */}
                                                <div className="mt-2 h-1.5 rounded-full" style={{ background: 'rgba(255,255,255,0.05)' }}>
                                                    <div className="h-full rounded-full transition-all" style={{
                                                        width: `${Math.min(v.rate, 100)}%`,
                                                        background: v.variant === 'A' ? '#3b82f6' : '#a855f7'
                                                    }} />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
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
                                        {funnel.objective && (
                                            <span className="badge mb-2 inline-flex" style={{
                                                background: funnel.objective === 'partner' ? 'rgba(245, 158, 11, 0.1)' : 'rgba(59, 130, 246, 0.1)',
                                                color: funnel.objective === 'partner' ? '#f59e0b' : '#3b82f6',
                                                border: `1px solid ${funnel.objective === 'partner' ? 'rgba(245, 158, 11, 0.2)' : 'rgba(59, 130, 246, 0.2)'}`,
                                                fontSize: '10px',
                                            }}>
                                                {funnel.objective === 'partner' ? '🤝 Partner' : funnel.objective === 'cliente' ? '👤 Cliente' : `🎯 ${funnel.objective}`}
                                            </span>
                                        )}
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
                    saving={saving}
                    onSave={handleSave}
                    onClose={() => { setShowModal(false); setEditing(null) }}
                />
            )}
        </div>
    )
}

function FunnelModal({ funnel, saving, onSave, onClose }: {
    funnel: Funnel | null; saving: boolean; onSave: (data: any) => void; onClose: () => void
}) {
    const [form, setForm] = useState({
        name: funnel?.name || '',
        slug: funnel?.slug || '',
        description: funnel?.description || '',
        objective: funnel?.objective || 'cliente',
        meta_pixel_id: funnel?.meta_pixel_id || '',
        status: funnel?.status || 'draft',
        settings: {
            headline: funnel?.settings?.headline || '',
            subheadline: funnel?.settings?.subheadline || '',
            cta_text: funnel?.settings?.cta_text || 'Invia Richiesta',
            thank_you: funnel?.settings?.thank_you || 'Grazie! Ti contatteremo il prima possibile.',
            accent_color: funnel?.settings?.accent_color || '#6366f1',
        },
    })

    const handleNameChange = (name: string) => {
        const slug = funnel ? form.slug : name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')
        setForm({ ...form, name, slug })
    }

    const updateSettings = (key: string, val: string) => {
        setForm({ ...form, settings: { ...form.settings, [key]: val } })
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

                    <div>
                        <label className="label">Meta Pixel ID</label>
                        <input className="input" value={form.meta_pixel_id} onChange={e => setForm({ ...form, meta_pixel_id: e.target.value })} placeholder="1234567890" />
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
