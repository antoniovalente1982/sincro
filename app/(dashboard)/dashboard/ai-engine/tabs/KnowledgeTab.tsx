'use client'

import { useState, useEffect } from 'react'
import { Brain, FlaskConical, CheckCircle2, XCircle, Clock, AlertTriangle, Lightbulb, Filter, Sparkles } from 'lucide-react'

interface Knowledge {
  id: string
  knowledge: string
  category: string
  source: string
  priority: string
  still_valid: boolean
  invalidated_by: string | null
  invalidation_reason: string | null
  invalidated_at: string | null
  created_at: string
}

interface Experiment {
  id: string
  cycle_id: string
  hypothesis: string
  action_type: string
  action_details: any
  outcome: string
  learned: string | null
  validated: boolean | null
  started_at: string
  evaluated_at: string | null
  created_at: string
}

export default function KnowledgeTab({ orgId }: { orgId: string }) {
  const [knowledge, setKnowledge] = useState<Knowledge[]>([])
  const [experiments, setExperiments] = useState<Experiment[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'valid' | 'invalidated'>('all')
  const [catFilter, setCatFilter] = useState<string>('all')

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/agent-knowledge?orgId=${orgId}`)
        const data = await res.json()
        setKnowledge(data.knowledge || [])
        setExperiments(data.experiments || [])
      } catch { }
      setLoading(false)
    }
    load()
  }, [orgId])

  const categories = ['all', ...Array.from(new Set(knowledge.map(k => k.category)))]
  
  const filtered = knowledge.filter(k => {
    if (filter === 'valid' && !k.still_valid) return false
    if (filter === 'invalidated' && k.still_valid) return false
    if (catFilter !== 'all' && k.category !== catFilter) return false
    return true
  })

  const validCount = knowledge.filter(k => k.still_valid).length
  const invalidCount = knowledge.filter(k => !k.still_valid).length

  const priorityColor = (p: string) => {
    switch (p) {
      case 'high': return '#ef4444'
      case 'medium': return '#f59e0b'
      case 'low': return '#6b7280'
      default: return '#8b5cf6'
    }
  }

  const outcomeColor = (o: string) => {
    switch (o) {
      case 'improved': return '#22c55e'
      case 'worsened': return '#ef4444'
      case 'neutral': return '#f59e0b'
      case 'active': return '#3b82f6'
      default: return '#6b7280'
    }
  }

  const timeAgo = (dateStr: string) => {
    const ms = Date.now() - new Date(dateStr).getTime()
    const h = Math.floor(ms / 3600000)
    if (h < 1) return 'ora'
    if (h < 24) return `${h}h fa`
    const d = Math.floor(h / 24)
    if (d < 30) return `${d}g fa`
    return `${Math.floor(d / 30)}m fa`
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Brain className="w-8 h-8 text-purple-400 animate-pulse" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* ═══ STATS BAR ═══ */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon={Lightbulb} label="Conoscenze Attive" value={String(validCount)} color="#22c55e" />
        <StatCard icon={XCircle} label="Invalidate" value={String(invalidCount)} color="#ef4444" />
        <StatCard icon={FlaskConical} label="Esperimenti" value={String(experiments.length)} color="#3b82f6" />
        <StatCard icon={Sparkles} label="Ultime 24h" value={String(knowledge.filter(k => Date.now() - new Date(k.created_at).getTime() < 86400000).length)} color="#a855f7" />
      </div>

      {/* ═══ FILTERS ═══ */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1">
          <Filter className="w-4 h-4" style={{ color: 'var(--color-surface-500)' }} />
        </div>
        {(['all', 'valid', 'invalidated'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
            style={{
              background: filter === f ? 'rgba(168,85,247,0.15)' : 'rgba(255,255,255,0.03)',
              color: filter === f ? '#c084fc' : 'var(--color-surface-500)',
              border: filter === f ? '1px solid rgba(168,85,247,0.3)' : '1px solid rgba(255,255,255,0.06)',
            }}
          >
            {f === 'all' ? 'Tutte' : f === 'valid' ? '✅ Valide' : '❌ Invalidate'}
          </button>
        ))}
        <span style={{ color: 'var(--color-surface-600)' }}>|</span>
        <select
          value={catFilter}
          onChange={e => setCatFilter(e.target.value)}
          className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
          style={{
            background: 'rgba(255,255,255,0.03)',
            color: 'var(--color-surface-400)',
            border: '1px solid rgba(255,255,255,0.06)',
            outline: 'none',
          }}
        >
          {categories.map(c => (
            <option key={c} value={c}>{c === 'all' ? 'Tutte le categorie' : c}</option>
          ))}
        </select>
      </div>

      {/* ═══ KNOWLEDGE ENTRIES ═══ */}
      <div>
        <h2 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
          <Brain className="w-4 h-4 text-purple-400" />
          Conoscenze Apprese ({filtered.length})
        </h2>
        
        {filtered.length === 0 ? (
          <div className="glass-card p-8 text-center" style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
            <Brain className="w-10 h-10 mx-auto mb-3" style={{ color: 'var(--color-surface-600)' }} />
            <p style={{ color: 'var(--color-surface-500)' }} className="text-sm">
              Hermes non ha ancora acquisito conoscenze. Verranno create automaticamente durante i cicli agent loop.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map(k => (
              <div
                key={k.id}
                className="glass-card px-4 py-3 transition-all hover:scale-[1.005]"
                style={{
                  border: `1px solid ${k.still_valid ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)'}`,
                  background: k.still_valid ? 'rgba(34,197,94,0.03)' : 'rgba(239,68,68,0.03)',
                  opacity: k.still_valid ? 1 : 0.7,
                }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {k.still_valid ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                      ) : (
                        <XCircle className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
                      )}
                      <span className="text-white text-sm font-medium leading-snug">{k.knowledge}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase" style={{
                        background: `${priorityColor(k.priority)}20`,
                        color: priorityColor(k.priority),
                      }}>
                        {k.priority}
                      </span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono" style={{
                        background: 'rgba(168,85,247,0.1)',
                        color: '#c084fc',
                      }}>
                        {k.category}
                      </span>
                      <span className="text-[10px]" style={{ color: 'var(--color-surface-600)' }}>
                        via {k.source}
                      </span>
                      {!k.still_valid && k.invalidation_reason && (
                        <span className="flex items-center gap-1 text-[10px] text-red-400">
                          <AlertTriangle className="w-3 h-3" />
                          {k.invalidation_reason}
                        </span>
                      )}
                    </div>
                  </div>
                  <span className="text-[10px] whitespace-nowrap" style={{ color: 'var(--color-surface-600)' }}>
                    {timeAgo(k.created_at)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ═══ EXPERIMENTS ═══ */}
      {experiments.length > 0 && (
        <div>
          <h2 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
            <FlaskConical className="w-4 h-4 text-blue-400" />
            Esperimenti ({experiments.length})
          </h2>
          <div className="space-y-2">
            {experiments.map(exp => (
              <div
                key={exp.id}
                className="glass-card px-4 py-3"
                style={{
                  border: `1px solid ${outcomeColor(exp.outcome)}20`,
                  background: `${outcomeColor(exp.outcome)}05`,
                }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="text-white text-sm font-medium mb-1">{exp.hypothesis}</div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase" style={{
                        background: `${outcomeColor(exp.outcome)}20`,
                        color: outcomeColor(exp.outcome),
                      }}>
                        {exp.outcome}
                      </span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono" style={{
                        background: 'rgba(99,102,241,0.1)',
                        color: '#818cf8',
                      }}>
                        {exp.action_type}
                      </span>
                      {exp.learned && (
                        <span className="text-[10px]" style={{ color: 'var(--color-surface-500)' }}>
                          💡 {exp.learned}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] whitespace-nowrap" style={{ color: 'var(--color-surface-600)' }}>
                      {timeAgo(exp.created_at)}
                    </span>
                    {exp.evaluated_at && (
                      <div className="text-[9px] mt-0.5" style={{ color: 'var(--color-surface-600)' }}>
                        valutato {timeAgo(exp.evaluated_at)}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function StatCard({ icon: Icon, label, value, color }: { icon: any; label: string; value: string; color: string }) {
  return (
    <div className="glass-card px-4 py-3" style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${color}15` }}>
          <Icon className="w-4 h-4" style={{ color }} />
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: 'var(--color-surface-500)' }}>{label}</div>
          <div className="text-lg font-bold" style={{ color }}>{value}</div>
        </div>
      </div>
    </div>
  )
}
