'use client'

import { useState, useEffect } from 'react'
import {
  Activity, Brain, Sparkles, Shield, TrendingUp, AlertTriangle,
  BarChart3, Filter, ChevronDown, ChevronUp, Megaphone, DollarSign,
  Users, Settings, Palette, Target, type LucideIcon
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
  creative:     { icon: Palette, label: 'Creativi', color: '#14b8a6' },
  optimization: { icon: TrendingUp, label: 'Ottimizzazione', color: '#ef4444' },
  analysis:     { icon: BarChart3, label: 'Analisi', color: '#8b5cf6' },
}

const OUTCOME_STYLES: Record<string, { label: string; color: string }> = {
  positive: { label: 'Positivo', color: '#22c55e' },
  negative: { label: 'Negativo', color: '#ef4444' },
  neutral:  { label: 'Neutrale', color: '#71717a' },
  pending:  { label: 'In corso', color: '#f59e0b' },
}

interface Props { orgId: string }

export default function ActivityTab({ orgId }: Props) {
  const [episodes, setEpisodes] = useState<Episode[]>([])
  const [tagCounts, setTagCounts] = useState<Record<string, number>>({})
  const [activeTag, setActiveTag] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const loadEpisodes = async (tag?: string | null) => {
    setLoading(true)
    const params = new URLSearchParams({ org_id: orgId, limit: '100' })
    if (tag) params.set('tag', tag)
    try {
      const res = await fetch(`/api/operations?${params}`)
      const data = await res.json()
      setEpisodes(data.episodes || [])
      setTagCounts(data.tagCounts || {})
    } catch {}
    setLoading(false)
  }

  useEffect(() => { loadEpisodes() }, [orgId])

  const handleTagFilter = (tag: string) => {
    const newTag = activeTag === tag ? null : tag
    setActiveTag(newTag)
    loadEpisodes(newTag)
  }

  const total = Object.values(tagCounts).reduce((s, c) => s + c, 0)

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Activity className="w-5 h-5" style={{ color: '#a855f7' }} />
          <div>
            <h2 className="text-lg font-bold text-white">Activity Feed</h2>
            <p className="text-[11px]" style={{ color: 'var(--color-surface-500)' }}>
              {total} operazioni registrate — tutto quello che ha fatto l'agente
            </p>
          </div>
        </div>
        <button onClick={() => loadEpisodes(activeTag)} className="text-[11px] px-3 py-1.5 rounded-lg font-semibold transition-colors hover:bg-white/5"
          style={{ color: 'var(--color-surface-500)', border: '1px solid var(--color-surface-300)' }}>
          ↻ Aggiorna
        </button>
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
        <button onClick={() => { setActiveTag(null); loadEpisodes(null) }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all whitespace-nowrap"
          style={{
            background: !activeTag ? 'rgba(168,85,247,0.12)' : 'transparent',
            color: !activeTag ? '#c084fc' : 'var(--color-surface-500)',
            border: `1px solid ${!activeTag ? 'rgba(168,85,247,0.25)' : 'var(--color-surface-200)'}`,
          }}>
          <Filter className="w-3 h-3" /> Tutte ({total})
        </button>
        {Object.entries(TAG_META).map(([key, meta]) => {
          const count = tagCounts[key] || 0
          if (count === 0 && activeTag !== key) return null
          const Icon = meta.icon
          return (
            <button key={key} onClick={() => handleTagFilter(key)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all whitespace-nowrap"
              style={{
                background: activeTag === key ? `${meta.color}12` : 'transparent',
                color: activeTag === key ? meta.color : 'var(--color-surface-500)',
                border: `1px solid ${activeTag === key ? meta.color + '25' : 'var(--color-surface-200)'}`,
              }}>
              <Icon className="w-3 h-3" /> {meta.label} ({count})
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
        <div className="glass-card text-center py-16">
          <Activity className="w-10 h-10 mx-auto mb-3" style={{ color: 'var(--color-surface-400)' }} />
          <h3 className="text-white font-bold mb-1">Nessuna operazione</h3>
          <p className="text-xs" style={{ color: 'var(--color-surface-500)' }}>Il feed si popolerà automaticamente ad ogni ciclo dell'agente.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {episodes.map(ep => {
            const tagMeta = TAG_META[ep.action_type] || TAG_META.system
            const outcomeMeta = OUTCOME_STYLES[ep.outcome] || OUTCOME_STYLES.pending
            const TagIcon = tagMeta.icon
            const isExpanded = expandedId === ep.id
            const hasDetail = ep.reasoning || Object.keys(ep.metrics_before || {}).length > 0 || ep.outcome_notes

            return (
              <div key={ep.id} className="glass-card p-4 transition-all hover:border-white/10"
                style={{ borderLeft: `3px solid ${tagMeta.color}` }}>
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                    style={{ background: `${tagMeta.color}12`, border: `1px solid ${tagMeta.color}20` }}>
                    <TagIcon className="w-4 h-4" style={{ color: tagMeta.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{
                        background: `${tagMeta.color}12`, color: tagMeta.color
                      }}>{tagMeta.label.toUpperCase()}</span>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full ml-auto" style={{
                        background: `${outcomeMeta.color}12`, color: outcomeMeta.color
                      }}>{outcomeMeta.label}</span>
                    </div>
                    <div className="text-sm font-semibold text-white mt-1">
                      {ep.target_name || ep.target_type || 'Operazione'}
                    </div>
                    {ep.reasoning && !isExpanded && (
                      <p className="text-xs mt-0.5 line-clamp-1" style={{ color: 'var(--color-surface-500)' }}>{ep.reasoning}</p>
                    )}
                    {isExpanded && (
                      <div className="mt-3 space-y-3 animate-fade-in">
                        {ep.reasoning && (
                          <div className="p-3 rounded-xl" style={{ background: 'var(--color-surface-100)', border: '1px solid var(--color-surface-200)' }}>
                            <div className="text-[10px] uppercase tracking-wider font-bold mb-1" style={{ color: 'var(--color-surface-500)' }}>Motivazione LLM</div>
                            <p className="text-xs leading-relaxed" style={{ color: 'var(--color-surface-700)' }}>{ep.reasoning}</p>
                          </div>
                        )}
                        {(Object.keys(ep.metrics_before || {}).length > 0 || Object.keys(ep.metrics_after || {}).length > 0) && (
                          <div className="grid grid-cols-2 gap-3">
                            {Object.keys(ep.metrics_before || {}).length > 0 && (
                              <div className="p-3 rounded-xl" style={{ background: 'rgba(239,68,68,0.04)', border: '1px solid rgba(239,68,68,0.1)' }}>
                                <div className="text-[10px] font-bold uppercase mb-1" style={{ color: '#ef4444' }}>Prima</div>
                                {Object.entries(ep.metrics_before).map(([k, v]) => (
                                  <div key={k} className="flex justify-between text-[11px] py-0.5">
                                    <span style={{ color: 'var(--color-surface-500)' }}>{k}</span>
                                    <span className="font-bold text-white">{typeof v === 'number' ? v.toLocaleString('it-IT') : String(v)}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                            {Object.keys(ep.metrics_after || {}).length > 0 && (
                              <div className="p-3 rounded-xl" style={{ background: 'rgba(34,197,94,0.04)', border: '1px solid rgba(34,197,94,0.1)' }}>
                                <div className="text-[10px] font-bold uppercase mb-1" style={{ color: '#22c55e' }}>Dopo</div>
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
                          <div className="p-3 rounded-xl" style={{ background: `${outcomeMeta.color}08` }}>
                            <div className="text-[10px] font-bold uppercase mb-1" style={{ color: outcomeMeta.color }}>Risultato</div>
                            <p className="text-xs" style={{ color: 'var(--color-surface-700)' }}>{ep.outcome_notes}</p>
                          </div>
                        )}
                      </div>
                    )}
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-[10px]" style={{ color: 'var(--color-surface-600)' }}>
                        {new Date(ep.created_at).toLocaleString('it-IT', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </span>
                      {hasDetail && (
                        <button onClick={() => setExpandedId(isExpanded ? null : ep.id)}
                          className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-lg hover:bg-white/5 transition"
                          style={{ color: 'var(--color-surface-500)' }}>
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
