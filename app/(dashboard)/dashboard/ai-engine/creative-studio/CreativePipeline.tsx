'use client'

import { useState, useCallback } from 'react'
import {
    Zap, Loader2, CheckCircle, XCircle, Rocket, RefreshCw, Brain,
    Target, ArrowRight, Clock, Trash2, Eye, ChevronDown, Filter
} from 'lucide-react'

interface AdCreative {
    id: string
    name: string
    angle: string
    pocket_id: number | null
    pocket_name: string | null
    buyer_state: string | null
    core_question: string | null
    target_adset_name: string | null
    landing_utm_term: string | null
    image_url: string | null
    copy_primary: string | null
    copy_headline: string | null
    copy_description: string | null
    status: string
    meta_ad_id: string | null
    spend: number
    impressions: number
    clicks: number
    leads_count: number
    cpl: number | null
    ctr: number | null
    roas: number | null
    created_by: string
    created_at: string
    launched_at: string | null
}

interface PipelineSummary {
    by_status: Record<string, number>
    by_angle: Record<string, Record<string, number>>
    total: number
}

interface Props {
    creatives: AdCreative[]
    summary: PipelineSummary
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: any }> = {
    draft: { label: 'Bozza', color: '#6366f1', bg: 'rgba(99, 102, 241, 0.1)', icon: Clock },
    ready: { label: 'Pronta', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.1)', icon: Zap },
    approved: { label: 'Approvata', color: '#22c55e', bg: 'rgba(34, 197, 94, 0.1)', icon: CheckCircle },
    launched: { label: 'Lanciata', color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.1)', icon: Rocket },
    active: { label: 'Attiva', color: '#10b981', bg: 'rgba(16, 185, 129, 0.1)', icon: Zap },
    paused: { label: 'In Pausa', color: '#eab308', bg: 'rgba(234, 179, 8, 0.1)', icon: Clock },
    killed: { label: 'Killata', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.1)', icon: XCircle },
    rejected: { label: 'Rifiutata', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.1)', icon: XCircle },
    archived: { label: 'Archiviata', color: '#6b7280', bg: 'rgba(107, 114, 128, 0.1)', icon: Trash2 },
}

const ANGLE_COLORS: Record<string, string> = {
    efficiency: '#22c55e', system: '#3b82f6', emotional: '#f59e0b', status: '#a855f7',
    growth: '#10b981', authority: '#6366f1', education: '#06b6d4', security: '#6b7280',
    trauma: '#ef4444', decision: '#ec4899',
}

export default function CreativePipeline({ creatives: initialCreatives, summary: initialSummary }: Props) {
    const [creatives, setCreatives] = useState(initialCreatives)
    const [summary, setSummary] = useState(initialSummary)
    const [filterStatus, setFilterStatus] = useState<string | null>(null)
    const [filterAngle, setFilterAngle] = useState<string | null>(null)
    const [loading, setLoading] = useState<Record<string, boolean>>({})
    const [runningPipeline, setRunningPipeline] = useState(false)
    const [syncing, setSyncing] = useState(false)
    const [expandedId, setExpandedId] = useState<string | null>(null)

    const refresh = useCallback(async () => {
        const res = await fetch('/api/ai-engine', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'get_creative_pipeline_status' }),
        })
        const data = await res.json()
        if (data.creatives) {
            setCreatives(data.creatives)
            setSummary(data.summary)
        }
    }, [])

    const handleApprove = async (id: string, decision: 'approve' | 'reject') => {
        setLoading(prev => ({ ...prev, [id]: true }))
        await fetch('/api/ai-engine', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'approve_creative', creative_id: id, decision }),
        })
        await refresh()
        setLoading(prev => ({ ...prev, [id]: false }))
    }

    const handleLaunch = async (id: string) => {
        setLoading(prev => ({ ...prev, [id]: true }))
        await fetch('/api/meta/create-campaign', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'launch_ad_creative', creative_id: id }),
        })
        await refresh()
        setLoading(prev => ({ ...prev, [id]: false }))
    }

    const handleRunPipeline = async () => {
        setRunningPipeline(true)
        await fetch('/api/ai-engine', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'run_creative_pipeline' }),
        })
        await refresh()
        setRunningPipeline(false)
    }

    const handleSyncPerformance = async () => {
        setSyncing(true)
        await fetch('/api/meta/create-campaign', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'sync_creative_performance' }),
        })
        await refresh()
        setSyncing(false)
    }

    const filtered = creatives.filter(c => {
        if (filterStatus && c.status !== filterStatus) return false
        if (filterAngle && c.angle !== filterAngle) return false
        return true
    })

    const allAngles = [...new Set(creatives.map(c => c.angle))]
    const allStatuses = [...new Set(creatives.map(c => c.status))]

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header */}
            <div className="flex items-start justify-between flex-wrap gap-4">
                <div>
                    <h2 className="text-xl font-bold text-white flex items-center gap-3">
                        <Zap className="w-6 h-6" style={{ color: '#f59e0b' }} />
                        Creative Pipeline
                    </h2>
                    <p className="text-sm mt-1" style={{ color: 'var(--color-surface-600)' }}>
                        Circuito chiuso: generazione → approvazione → lancio → performance
                    </p>
                </div>
                <div className="flex gap-2 flex-wrap">
                    <button onClick={handleSyncPerformance} disabled={syncing}
                        className="btn-secondary text-xs" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        {syncing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                        Sync Meta
                    </button>
                    <button onClick={handleRunPipeline} disabled={runningPipeline}
                        className="btn-primary text-xs" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        {runningPipeline ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Brain className="w-3.5 h-3.5" />}
                        Run Pipeline
                    </button>
                </div>
            </div>

            {/* KPI Summary */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {[
                    { label: 'Totali', value: summary.total, color: '#6366f1' },
                    { label: 'Pronte', value: summary.by_status?.ready || 0, color: '#f59e0b' },
                    { label: 'Approvate', value: summary.by_status?.approved || 0, color: '#22c55e' },
                    { label: 'Attive', value: (summary.by_status?.active || 0) + (summary.by_status?.launched || 0), color: '#3b82f6' },
                    { label: 'Killate', value: summary.by_status?.killed || 0, color: '#ef4444' },
                ].map(stat => (
                    <div key={stat.label} className="kpi-card">
                        <div className="text-2xl font-bold text-white">{stat.value}</div>
                        <div className="text-xs mt-1" style={{ color: stat.color }}>{stat.label}</div>
                    </div>
                ))}
            </div>

            {/* Angle Distribution */}
            {Object.keys(summary.by_angle || {}).length > 0 && (
                <div className="glass-card p-4">
                    <div className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: 'var(--color-surface-500)' }}>
                        Distribuzione per Angolo
                    </div>
                    <div className="flex flex-wrap gap-3">
                        {Object.entries(summary.by_angle).map(([angle, statuses]) => {
                            const total = Object.values(statuses).reduce((s, v) => s + v, 0)
                            const active = (statuses.active || 0) + (statuses.launched || 0)
                            return (
                                <div key={angle} className="px-4 py-2 rounded-xl cursor-pointer transition-all hover:scale-105"
                                    onClick={() => setFilterAngle(filterAngle === angle ? null : angle)}
                                    style={{
                                        background: ANGLE_COLORS[angle] ? `${ANGLE_COLORS[angle]}15` : 'var(--color-surface-100)',
                                        border: `1px solid ${filterAngle === angle ? (ANGLE_COLORS[angle] || '#666') : 'transparent'}`,
                                    }}>
                                    <div className="text-xs font-bold" style={{ color: ANGLE_COLORS[angle] || '#fff' }}>
                                        {angle.toUpperCase()}
                                    </div>
                                    <div className="text-[10px] mt-0.5" style={{ color: 'var(--color-surface-500)' }}>
                                        {total} ads • {active} attive
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>
            )}

            {/* Filters */}
            <div className="flex items-center gap-2 flex-wrap">
                <Filter className="w-4 h-4" style={{ color: 'var(--color-surface-500)' }} />
                <button onClick={() => { setFilterStatus(null); setFilterAngle(null) }}
                    className="text-xs px-3 py-1 rounded-lg transition-all" style={{ 
                        background: !filterStatus && !filterAngle ? 'rgba(99, 102, 241, 0.15)' : 'var(--color-surface-100)',
                        color: !filterStatus && !filterAngle ? '#6366f1' : 'var(--color-surface-500)',
                        border: `1px solid ${!filterStatus && !filterAngle ? 'rgba(99, 102, 241, 0.3)' : 'var(--color-surface-200)'}`,
                    }}>Tutte ({summary.total})</button>
                {allStatuses.map(status => {
                    const cfg = STATUS_CONFIG[status] || { label: status, color: '#666', bg: '#66615' }
                    const count = creatives.filter(c => c.status === status).length
                    return (
                        <button key={status} onClick={() => setFilterStatus(filterStatus === status ? null : status)}
                            className="text-xs px-3 py-1 rounded-lg transition-all" style={{
                                background: filterStatus === status ? cfg.bg : 'var(--color-surface-100)',
                                color: filterStatus === status ? cfg.color : 'var(--color-surface-500)',
                                border: `1px solid ${filterStatus === status ? cfg.color + '40' : 'var(--color-surface-200)'}`,
                            }}>{cfg.label} ({count})</button>
                    )
                })}
            </div>

            {/* Creative Cards */}
            {filtered.length > 0 ? (
                <div className="space-y-3">
                    {filtered.map(creative => {
                        const statusCfg = STATUS_CONFIG[creative.status] || { label: creative.status, color: '#666', bg: '#66615', icon: Clock }
                        const StatusIcon = statusCfg.icon
                        const isExpanded = expandedId === creative.id
                        const isLoading = loading[creative.id]
                        const angleColor = ANGLE_COLORS[creative.angle] || '#6366f1'

                        return (
                            <div key={creative.id} className="glass-card overflow-hidden transition-all">
                                {/* Main Row */}
                                <div className="p-4 flex items-center gap-4 cursor-pointer" onClick={() => setExpandedId(isExpanded ? null : creative.id)}>
                                    {/* Status Indicator */}
                                    <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                                        style={{ background: statusCfg.bg, border: `1px solid ${statusCfg.color}30` }}>
                                        <StatusIcon className="w-4 h-4" style={{ color: statusCfg.color }} />
                                    </div>

                                    {/* Info */}
                                    <div className="flex-1 min-w-0">
                                        <div className="text-sm font-bold text-white truncate">{creative.name}</div>
                                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                                            <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold" style={{
                                                background: `${angleColor}15`, color: angleColor, border: `1px solid ${angleColor}30`,
                                            }}>{creative.angle}</span>
                                            {creative.pocket_name && (
                                                <span className="text-[10px]" style={{ color: 'var(--color-surface-500)' }}>
                                                    #{creative.pocket_id} {creative.pocket_name}
                                                </span>
                                            )}
                                            {creative.target_adset_name && (
                                                <span className="text-[10px]" style={{ color: 'var(--color-surface-600)' }}>
                                                    → {creative.target_adset_name}
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Performance (if launched) */}
                                    {(creative.status === 'active' || creative.status === 'launched' || creative.status === 'killed') && creative.spend > 0 && (
                                        <div className="hidden md:flex items-center gap-4 flex-shrink-0">
                                            <div className="text-right">
                                                <div className="text-xs font-bold text-white">€{creative.spend.toFixed(2)}</div>
                                                <div className="text-[10px]" style={{ color: 'var(--color-surface-500)' }}>Spend</div>
                                            </div>
                                            <div className="text-right">
                                                <div className="text-xs font-bold" style={{ color: creative.leads_count > 0 ? '#22c55e' : '#ef4444' }}>{creative.leads_count}</div>
                                                <div className="text-[10px]" style={{ color: 'var(--color-surface-500)' }}>Lead</div>
                                            </div>
                                            {creative.cpl && (
                                                <div className="text-right">
                                                    <div className="text-xs font-bold" style={{ color: creative.cpl < 20 ? '#22c55e' : '#ef4444' }}>€{creative.cpl.toFixed(2)}</div>
                                                    <div className="text-[10px]" style={{ color: 'var(--color-surface-500)' }}>CPL</div>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* Status Badge + Actions */}
                                    <div className="flex items-center gap-2 flex-shrink-0">
                                        <span className="text-[10px] px-2.5 py-1 rounded-full font-semibold" style={{
                                            background: statusCfg.bg, color: statusCfg.color, border: `1px solid ${statusCfg.color}30`,
                                        }}>{statusCfg.label}</span>

                                        {/* Quick Actions */}
                                        {creative.status === 'ready' && !isLoading && (
                                            <>
                                                <button onClick={(e) => { e.stopPropagation(); handleApprove(creative.id, 'approve') }}
                                                    className="w-7 h-7 rounded-lg flex items-center justify-center transition-all hover:scale-110"
                                                    style={{ background: 'rgba(34, 197, 94, 0.1)', border: '1px solid rgba(34, 197, 94, 0.3)' }}
                                                    title="Approva">
                                                    <CheckCircle className="w-3.5 h-3.5" style={{ color: '#22c55e' }} />
                                                </button>
                                                <button onClick={(e) => { e.stopPropagation(); handleApprove(creative.id, 'reject') }}
                                                    className="w-7 h-7 rounded-lg flex items-center justify-center transition-all hover:scale-110"
                                                    style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)' }}
                                                    title="Rifiuta">
                                                    <XCircle className="w-3.5 h-3.5" style={{ color: '#ef4444' }} />
                                                </button>
                                            </>
                                        )}
                                        {creative.status === 'approved' && !isLoading && (
                                            <button onClick={(e) => { e.stopPropagation(); handleLaunch(creative.id) }}
                                                className="w-7 h-7 rounded-lg flex items-center justify-center transition-all hover:scale-110"
                                                style={{ background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.3)' }}
                                                title="Lancia su Meta">
                                                <Rocket className="w-3.5 h-3.5" style={{ color: '#3b82f6' }} />
                                            </button>
                                        )}
                                        {isLoading && <Loader2 className="w-4 h-4 animate-spin" style={{ color: '#6366f1' }} />}

                                        <ChevronDown className="w-4 h-4 transition-transform" style={{
                                            color: 'var(--color-surface-500)',
                                            transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                                        }} />
                                    </div>
                                </div>

                                {/* Expanded Details */}
                                {isExpanded && (
                                    <div className="px-4 pb-4 pt-0 space-y-3 border-t" style={{ borderColor: 'var(--color-surface-200)' }}>
                                        {/* Copy */}
                                        {creative.copy_headline && (
                                            <div className="mt-3">
                                                <div className="text-[10px] uppercase tracking-wider font-semibold mb-1" style={{ color: 'var(--color-surface-500)' }}>Copy</div>
                                                <div className="text-sm font-bold text-white mb-1">{creative.copy_headline}</div>
                                                <div className="text-xs leading-relaxed" style={{ color: 'var(--color-surface-600)' }}>
                                                    {creative.copy_primary?.substring(0, 300)}
                                                    {(creative.copy_primary?.length || 0) > 300 ? '...' : ''}
                                                </div>
                                            </div>
                                        )}

                                        {/* Pocket Info */}
                                        {creative.pocket_name && (
                                            <div className="flex items-center gap-3 flex-wrap">
                                                <div className="px-3 py-1.5 rounded-lg" style={{ background: 'var(--color-surface-100)', border: '1px solid var(--color-surface-200)' }}>
                                                    <div className="text-[10px] uppercase tracking-wider mb-0.5" style={{ color: 'var(--color-surface-500)' }}>Buyer Pocket</div>
                                                    <div className="text-xs font-semibold text-white">#{creative.pocket_id} {creative.pocket_name}</div>
                                                </div>
                                                <div className="px-3 py-1.5 rounded-lg" style={{ background: 'var(--color-surface-100)', border: '1px solid var(--color-surface-200)' }}>
                                                    <div className="text-[10px] uppercase tracking-wider mb-0.5" style={{ color: 'var(--color-surface-500)' }}>Buyer State</div>
                                                    <div className="text-xs font-semibold text-white">{creative.buyer_state}</div>
                                                </div>
                                                <div className="px-3 py-1.5 rounded-lg" style={{ background: 'var(--color-surface-100)', border: '1px solid var(--color-surface-200)' }}>
                                                    <div className="text-[10px] uppercase tracking-wider mb-0.5" style={{ color: 'var(--color-surface-500)' }}>Core Question</div>
                                                    <div className="text-xs font-semibold text-white">{creative.core_question}</div>
                                                </div>
                                            </div>
                                        )}

                                        {/* Meta Info */}
                                        {creative.meta_ad_id && (
                                            <div className="flex items-center gap-2 text-[10px]" style={{ color: 'var(--color-surface-500)' }}>
                                                <span>Meta Ad ID: {creative.meta_ad_id}</span>
                                                {creative.launched_at && (
                                                    <span>• Lanciata: {new Date(creative.launched_at).toLocaleDateString('it-IT')}</span>
                                                )}
                                            </div>
                                        )}

                                        {/* Performance (mobile) */}
                                        {creative.spend > 0 && (
                                            <div className="md:hidden grid grid-cols-4 gap-2">
                                                {[
                                                    { label: 'Spend', value: `€${creative.spend.toFixed(2)}` },
                                                    { label: 'Lead', value: creative.leads_count },
                                                    { label: 'CPL', value: creative.cpl ? `€${creative.cpl.toFixed(2)}` : '-' },
                                                    { label: 'CTR', value: creative.ctr ? `${creative.ctr.toFixed(2)}%` : '-' },
                                                ].map(m => (
                                                    <div key={m.label} className="p-2 rounded-lg text-center" style={{ background: 'var(--color-surface-100)' }}>
                                                        <div className="text-xs font-bold text-white">{m.value}</div>
                                                        <div className="text-[10px]" style={{ color: 'var(--color-surface-500)' }}>{m.label}</div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </div>
            ) : (
                <div className="glass-card p-12 text-center">
                    <div className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center" style={{
                        background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.2)',
                    }}>
                        <Zap className="w-8 h-8" style={{ color: '#f59e0b' }} />
                    </div>
                    <h2 className="text-lg font-bold text-white mb-2">
                        {filterStatus || filterAngle ? 'Nessun risultato per questi filtri' : 'Nessuna ad nel pipeline'}
                    </h2>
                    <p className="text-sm mb-6 max-w-md mx-auto" style={{ color: 'var(--color-surface-500)' }}>
                        {filterStatus || filterAngle
                            ? 'Prova a cambiare i filtri o avvia la pipeline per generare nuove ads.'
                            : 'Avvia il pipeline per analizzare il deficit ads e generare automaticamente nuove creative.'}
                    </p>
                    <button onClick={handleRunPipeline} disabled={runningPipeline} className="btn-primary">
                        {runningPipeline ? <Loader2 className="w-4 h-4 animate-spin" /> : <Brain className="w-4 h-4" />}
                        Avvia Creative Pipeline
                    </button>
                </div>
            )}
        </div>
    )
}
