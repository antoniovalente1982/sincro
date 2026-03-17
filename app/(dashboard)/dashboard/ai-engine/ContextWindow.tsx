'use client'

import { useState, useEffect } from 'react'
import {
    History, Tag, ArrowRight, CheckCircle, AlertTriangle, Clock,
    Brain, Target, DollarSign, Megaphone, Users, Settings, Sparkles,
    TrendingUp, Palette, BarChart3, Filter, ChevronDown, ChevronUp,
    type LucideIcon
} from 'lucide-react'

interface Episode {
    id: string
    episode_type: string
    action_type: string
    target_type: string | null
    target_id: string | null
    target_name: string | null
    reasoning: string | null
    context: Record<string, any>
    metrics_before: Record<string, any>
    metrics_after: Record<string, any>
    outcome: string
    outcome_notes: string | null
    outcome_score: number
    created_at: string
}

const TAG_META: Record<string, { icon: LucideIcon; label: string; color: string }> = {
    ads:          { icon: Megaphone, label: 'ADS', color: '#6366f1' },
    budget:       { icon: DollarSign, label: 'Budget', color: '#22c55e' },
    campaign:     { icon: Target, label: 'Campagna', color: '#f59e0b' },
    crm:          { icon: Users, label: 'CRM', color: '#3b82f6' },
    strategy:     { icon: Brain, label: 'Strategia', color: '#a855f7' },
    system:       { icon: Settings, label: 'Sistema', color: '#71717a' },
    pipeline:     { icon: ArrowRight, label: 'Pipeline', color: '#ec4899' },
    creative:     { icon: Palette, label: 'Creativi', color: '#14b8a6' },
    optimization: { icon: TrendingUp, label: 'Ottimizzazione', color: '#ef4444' },
    analysis:     { icon: BarChart3, label: 'Analisi', color: '#8b5cf6' },
}

const EPISODE_ICONS: Record<string, { icon: LucideIcon; color: string }> = {
    action:      { icon: Sparkles, color: '#6366f1' },
    observation: { icon: BarChart3, color: '#3b82f6' },
    decision:    { icon: Brain, color: '#a855f7' },
    alert:       { icon: AlertTriangle, color: '#f59e0b' },
    learning:    { icon: TrendingUp, color: '#22c55e' },
}

const OUTCOME_STYLES: Record<string, { label: string; color: string; bg: string }> = {
    positive: { label: 'Positivo', color: '#22c55e', bg: 'rgba(34, 197, 94, 0.1)' },
    negative: { label: 'Negativo', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.1)' },
    neutral:  { label: 'Neutrale', color: '#71717a', bg: 'rgba(113, 113, 122, 0.1)' },
    pending:  { label: 'In corso', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.1)' },
    unknown:  { label: 'N/D', color: '#52525b', bg: 'rgba(82, 82, 91, 0.1)' },
}

interface Props {
    organizationId: string
}

export default function ContextWindow({ organizationId }: Props) {
    const [episodes, setEpisodes] = useState<Episode[]>([])
    const [tagCounts, setTagCounts] = useState<Record<string, number>>({})
    const [activeTag, setActiveTag] = useState<string | null>(null)
    const [loading, setLoading] = useState(true)
    const [expandedId, setExpandedId] = useState<string | null>(null)

    const loadEpisodes = async (tag?: string | null) => {
        setLoading(true)
        const params = new URLSearchParams({ org_id: organizationId, limit: '100' })
        if (tag) params.set('tag', tag)
        const res = await fetch(`/api/operations?${params}`)
        const data = await res.json()
        setEpisodes(data.episodes || [])
        setTagCounts(data.tagCounts || {})
        setLoading(false)
    }

    useEffect(() => { loadEpisodes() }, [organizationId])

    const handleTagFilter = (tag: string) => {
        const newTag = activeTag === tag ? null : tag
        setActiveTag(newTag)
        loadEpisodes(newTag)
    }

    const formatDate = (d: string) =>
        new Date(d).toLocaleString('it-IT', {
            day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
        })

    const totalOps = Object.values(tagCounts).reduce((s, c) => s + c, 0)

    return (
        <div className="space-y-5 animate-fade-in">
            {/* Header */}
            <div className="flex items-center justify-between gap-4 flex-wrap">
                <div>
                    <h1 className="text-2xl font-bold text-white flex items-center gap-3">
                        <History className="w-6 h-6" style={{ color: '#a855f7' }} />
                        Context Window
                    </h1>
                    <p className="text-sm mt-1" style={{ color: 'var(--color-surface-600)' }}>
                        {totalOps} operazioni registrate • Storico azioni e decisioni AI
                    </p>
                </div>
            </div>

            {/* Tag Filter Bar */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
                <button
                    onClick={() => { setActiveTag(null); loadEpisodes(null) }}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap"
                    style={{
                        background: !activeTag ? 'rgba(168, 85, 247, 0.15)' : 'transparent',
                        color: !activeTag ? '#a855f7' : 'var(--color-surface-500)',
                        border: `1px solid ${!activeTag ? 'rgba(168, 85, 247, 0.3)' : 'var(--color-surface-200)'}`,
                    }}
                >
                    <Filter className="w-3 h-3" /> Tutte ({totalOps})
                </button>
                {Object.entries(TAG_META).map(([key, meta]) => {
                    const count = tagCounts[key] || 0
                    if (count === 0 && activeTag !== key) return null
                    const TagIcon = meta.icon
                    return (
                        <button
                            key={key}
                            onClick={() => handleTagFilter(key)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap"
                            style={{
                                background: activeTag === key ? `${meta.color}15` : 'transparent',
                                color: activeTag === key ? meta.color : 'var(--color-surface-500)',
                                border: `1px solid ${activeTag === key ? meta.color + '30' : 'var(--color-surface-200)'}`,
                            }}
                        >
                            <TagIcon className="w-3 h-3" />
                            {meta.label}
                            <span className="text-[10px] opacity-60">({count})</span>
                        </button>
                    )
                })}
            </div>

            {/* Timeline */}
            {loading ? (
                <div className="flex items-center justify-center py-20">
                    <div className="w-8 h-8 border-3 border-white/10 border-t-purple-500 rounded-full animate-spin" />
                </div>
            ) : episodes.length === 0 ? (
                <div className="text-center py-20 glass-card">
                    <History className="w-12 h-12 mx-auto mb-4" style={{ color: 'var(--color-surface-400)' }} />
                    <h3 className="text-lg font-bold text-white mb-2">Nessuna operazione registrata</h3>
                    <p className="text-sm" style={{ color: 'var(--color-surface-500)' }}>
                        Le operazioni verranno registrate automaticamente man mano che il sistema lavora.
                    </p>
                </div>
            ) : (
                <div className="space-y-3">
                    {episodes.map(ep => {
                        const tagMeta = TAG_META[ep.action_type] || TAG_META.system
                        const epMeta = EPISODE_ICONS[ep.episode_type] || EPISODE_ICONS.action
                        const outcomeMeta = OUTCOME_STYLES[ep.outcome] || OUTCOME_STYLES.pending
                        const EpIcon = epMeta.icon
                        const TagIcon = tagMeta.icon
                        const isExpanded = expandedId === ep.id
                        const hasDetails = ep.reasoning || Object.keys(ep.metrics_before || {}).length > 0 || Object.keys(ep.metrics_after || {}).length > 0 || ep.outcome_notes

                        return (
                            <div
                                key={ep.id}
                                className="glass-card p-4 transition-all hover:border-white/10"
                                style={{ borderLeft: `3px solid ${tagMeta.color}` }}
                            >
                                <div className="flex items-start gap-3">
                                    {/* Icon */}
                                    <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                                        style={{ background: `${epMeta.color}15`, border: `1px solid ${epMeta.color}25` }}
                                    >
                                        <EpIcon className="w-4 h-4" style={{ color: epMeta.color }} />
                                    </div>

                                    {/* Content */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            {/* Tag */}
                                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1"
                                                style={{ background: `${tagMeta.color}15`, color: tagMeta.color, border: `1px solid ${tagMeta.color}25` }}
                                            >
                                                <TagIcon className="w-2.5 h-2.5" /> {tagMeta.label}
                                            </span>
                                            {/* Episode type */}
                                            <span className="text-[10px] font-medium" style={{ color: 'var(--color-surface-500)' }}>
                                                {ep.episode_type === 'action' ? '⚡ Azione' :
                                                 ep.episode_type === 'observation' ? '👁️ Osservazione' :
                                                 ep.episode_type === 'decision' ? '🧠 Decisione' :
                                                 ep.episode_type === 'alert' ? '⚠️ Allarme' :
                                                 ep.episode_type === 'learning' ? '📚 Apprendimento' : ep.episode_type}
                                            </span>
                                            {/* Outcome */}
                                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full ml-auto"
                                                style={{ background: outcomeMeta.bg, color: outcomeMeta.color }}
                                            >
                                                {outcomeMeta.label}
                                            </span>
                                        </div>

                                        {/* Target */}
                                        <div className="mt-1.5">
                                            <span className="text-sm font-semibold text-white">
                                                {ep.target_name || ep.target_type || 'Operazione'}
                                            </span>
                                            {ep.target_type && ep.target_name && (
                                                <span className="text-[10px] ml-2" style={{ color: 'var(--color-surface-500)' }}>
                                                    ({ep.target_type})
                                                </span>
                                            )}
                                        </div>

                                        {/* Reasoning preview */}
                                        {ep.reasoning && !isExpanded && (
                                            <p className="text-xs mt-1 line-clamp-1" style={{ color: 'var(--color-surface-500)' }}>
                                                {ep.reasoning}
                                            </p>
                                        )}

                                        {/* Expanded details */}
                                        {isExpanded && (
                                            <div className="mt-3 space-y-3 animate-fade-in">
                                                {ep.reasoning && (
                                                    <div className="p-3 rounded-xl" style={{ background: 'var(--color-surface-100)', border: '1px solid var(--color-surface-200)' }}>
                                                        <div className="text-[10px] uppercase tracking-wider font-bold mb-1" style={{ color: 'var(--color-surface-500)' }}>Motivazione</div>
                                                        <p className="text-xs leading-relaxed" style={{ color: 'var(--color-surface-700)' }}>{ep.reasoning}</p>
                                                    </div>
                                                )}

                                                {/* Metrics comparison */}
                                                {(Object.keys(ep.metrics_before || {}).length > 0 || Object.keys(ep.metrics_after || {}).length > 0) && (
                                                    <div className="grid grid-cols-2 gap-3">
                                                        {Object.keys(ep.metrics_before || {}).length > 0 && (
                                                            <div className="p-3 rounded-xl" style={{ background: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.1)' }}>
                                                                <div className="text-[10px] uppercase tracking-wider font-bold mb-2" style={{ color: '#ef4444' }}>Prima</div>
                                                                {Object.entries(ep.metrics_before).map(([k, v]) => (
                                                                    <div key={k} className="flex justify-between text-[11px] py-0.5">
                                                                        <span style={{ color: 'var(--color-surface-500)' }}>{k}</span>
                                                                        <span className="font-bold text-white">{typeof v === 'number' ? v.toLocaleString('it-IT') : String(v)}</span>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}
                                                        {Object.keys(ep.metrics_after || {}).length > 0 && (
                                                            <div className="p-3 rounded-xl" style={{ background: 'rgba(34, 197, 94, 0.05)', border: '1px solid rgba(34, 197, 94, 0.1)' }}>
                                                                <div className="text-[10px] uppercase tracking-wider font-bold mb-2" style={{ color: '#22c55e' }}>Dopo</div>
                                                                {Object.entries(ep.metrics_after).map(([k, v]) => (
                                                                    <div key={k} className="flex justify-between text-[11px] py-0.5">
                                                                        <span style={{ color: 'var(--color-surface-500)' }}>{k}</span>
                                                                        <span className="font-bold text-white">{typeof v === 'number' ? v.toLocaleString('it-IT') : String(v)}</span>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                )}

                                                {ep.outcome_notes && (
                                                    <div className="p-3 rounded-xl" style={{ background: outcomeMeta.bg }}>
                                                        <div className="text-[10px] uppercase tracking-wider font-bold mb-1" style={{ color: outcomeMeta.color }}>Risultato</div>
                                                        <p className="text-xs" style={{ color: 'var(--color-surface-700)' }}>{ep.outcome_notes}</p>
                                                    </div>
                                                )}

                                                {Object.keys(ep.context || {}).length > 0 && (
                                                    <details className="text-xs">
                                                        <summary className="cursor-pointer text-[10px] font-bold uppercase" style={{ color: 'var(--color-surface-500)' }}>Contesto Raw</summary>
                                                        <pre className="mt-1 p-2 rounded-lg text-[10px] overflow-x-auto" style={{ background: 'var(--color-surface-100)', color: 'var(--color-surface-600)' }}>
                                                            {JSON.stringify(ep.context, null, 2)}
                                                        </pre>
                                                    </details>
                                                )}
                                            </div>
                                        )}

                                        {/* Footer */}
                                        <div className="flex items-center justify-between mt-2">
                                            <span className="text-[10px]" style={{ color: 'var(--color-surface-500)' }}>
                                                {formatDate(ep.created_at)}
                                            </span>
                                            {hasDetails && (
                                                <button
                                                    onClick={() => setExpandedId(isExpanded ? null : ep.id)}
                                                    className="flex items-center gap-1 text-[10px] font-bold transition-colors rounded-lg px-2 py-0.5 hover:bg-white/5"
                                                    style={{ color: 'var(--color-surface-500)' }}
                                                >
                                                    {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                                                    {isExpanded ? 'Chiudi' : 'Dettagli'}
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
    )
}
