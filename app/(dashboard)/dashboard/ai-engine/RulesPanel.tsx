'use client'

import { useState, useEffect, useCallback } from 'react'
import {
    Shield, Zap, TrendingUp, TrendingDown, AlertTriangle, ToggleLeft, ToggleRight,
    Play, Pause, Target, DollarSign, ChevronDown, ChevronRight, Loader2,
    CheckCircle, XCircle, Clock, Flame, Eye, RefreshCw, Settings, History,
    BarChart3, ArrowUpRight, ArrowDownRight, Brain, Sparkles
} from 'lucide-react'

interface Rule {
    id: string; name: string; category: string; is_enabled: boolean
    conditions: any[]; actions: any[]; min_spend_before_eval: number
    min_days_before_eval: number; meta_rule_id: string | null
    created_at: string; updated_at: string
}

interface Targets {
    target_cpl: number; target_cpa_appointment: number
    target_cpa_show: number; target_cac: number; target_roas: number
    funnel_conversion_rates: any
}

interface Execution {
    id: string; rule_name: string; entity_name: string
    action_taken: string; metrics_snapshot: any; result: string
    notes: string; executed_at: string
}

interface Props {
    campaigns: any[]
}

const CATEGORY_META: Record<string, { label: string; icon: any; color: string; emoji: string }> = {
    creative_kill: { label: 'Kill Creative', icon: XCircle, color: '#ef4444', emoji: '🔴' },
    creative_winner: { label: 'Winner Detection', icon: Sparkles, color: '#22c55e', emoji: '🟢' },
    budget_scale_up: { label: 'Budget Scale Up', icon: TrendingUp, color: '#3b82f6', emoji: '📈' },
    budget_scale_down: { label: 'Budget Scale Down', icon: TrendingDown, color: '#f59e0b', emoji: '📉' },
    fatigue: { label: 'Creative Fatigue', icon: AlertTriangle, color: '#f97316', emoji: '🔄' },
    learning_protection: { label: 'Learning Protection', icon: Shield, color: '#8b5cf6', emoji: '⏸' },
}

export default function RulesPanel({ campaigns }: Props) {
    const [rules, setRules] = useState<Rule[]>([])
    const [targets, setTargets] = useState<Targets | null>(null)
    const [history, setHistory] = useState<Execution[]>([])
    const [loading, setLoading] = useState(true)
    const [toggling, setToggling] = useState<string | null>(null)
    const [evaluating, setEvaluating] = useState(false)
    const [evalResults, setEvalResults] = useState<any[] | null>(null)
    const [showTargets, setShowTargets] = useState(false)
    const [showHistory, setShowHistory] = useState(false)
    const [savingTargets, setSavingTargets] = useState(false)

    // Editable targets
    const [editCPL, setEditCPL] = useState('20')
    const [editCAC, setEditCAC] = useState('500')
    const [editROAS, setEditROAS] = useState('3.0')

    const fetchRules = useCallback(async () => {
        try {
            const res = await fetch('/api/ai-engine', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'get_rules' }),
            })
            const data = await res.json()
            setRules(data.rules || [])
            setTargets(data.targets || null)
            setHistory(data.history || [])
            if (data.targets) {
                setEditCPL(String(data.targets.target_cpl || 20))
                setEditCAC(String(data.targets.target_cac || 500))
                setEditROAS(String(data.targets.target_roas || 3.0))
            }
        } catch { }
        setLoading(false)
    }, [])

    useEffect(() => { fetchRules() }, [fetchRules])

    const handleToggle = async (ruleId: string, newState: boolean) => {
        setToggling(ruleId)
        try {
            await fetch('/api/ai-engine', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'toggle_rule', rule_id: ruleId, is_enabled: newState }),
            })
            setRules(prev => prev.map(r => r.id === ruleId ? { ...r, is_enabled: newState } : r))
        } catch { }
        setToggling(null)
    }

    const handleSaveTargets = async () => {
        setSavingTargets(true)
        try {
            await fetch('/api/ai-engine', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'save_targets',
                    targets: {
                        target_cpl: Number(editCPL) || 20,
                        target_cac: Number(editCAC) || 500,
                        target_roas: Number(editROAS) || 3.0,
                    },
                }),
            })
            setTargets(prev => prev ? { ...prev, target_cpl: Number(editCPL), target_cac: Number(editCAC), target_roas: Number(editROAS) } : null)
        } catch { }
        setSavingTargets(false)
    }

    const handleEvaluate = async () => {
        setEvaluating(true)
        setEvalResults(null)
        try {
            const res = await fetch('/api/ai-engine', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'evaluate_rules', campaigns: campaigns.filter(c => c.status === 'ACTIVE') }),
            })
            const data = await res.json()
            setEvalResults(data.results || [])
            // Refresh history
            fetchRules()
        } catch { }
        setEvaluating(false)
    }

    // Group rules by category
    const groupedRules = rules.reduce((acc, rule) => {
        if (!acc[rule.category]) acc[rule.category] = []
        acc[rule.category].push(rule)
        return acc
    }, {} as Record<string, Rule[]>)

    const enabledCount = rules.filter(r => r.is_enabled).length

    if (loading) {
        return (
            <div className="glass-card p-8 text-center">
                <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" style={{ color: '#818cf8' }} />
                <div className="text-sm" style={{ color: 'var(--color-surface-500)' }}>Caricamento regole...</div>
            </div>
        )
    }

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-start justify-between flex-wrap gap-3">
                <div>
                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                        <Shield className="w-5 h-5" style={{ color: '#818cf8' }} />
                        Regole Automatiche
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{
                            background: 'rgba(129, 140, 248, 0.15)', color: '#818cf8',
                        }}>PHASE 1 — DRY RUN</span>
                    </h2>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--color-surface-500)' }}>
                        {enabledCount}/{rules.length} regole attive • Le azioni vengono solo loggate (non eseguite su Meta)
                    </p>
                </div>
                <div className="flex gap-2">
                    <button onClick={() => setShowTargets(!showTargets)} className="btn-primary text-xs" style={{
                        background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.3)', color: '#f59e0b',
                    }}>
                        <Target className="w-3.5 h-3.5" /> Target
                    </button>
                    <button onClick={() => setShowHistory(!showHistory)} className="btn-primary text-xs" style={{
                        background: 'rgba(129, 140, 248, 0.1)', border: '1px solid rgba(129, 140, 248, 0.3)', color: '#818cf8',
                    }}>
                        <History className="w-3.5 h-3.5" /> Log
                    </button>
                    <button onClick={handleEvaluate} className="btn-primary text-xs" disabled={evaluating}>
                        {evaluating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                        {evaluating ? 'Valutando...' : 'Valuta Regole'}
                    </button>
                </div>
            </div>

            {/* Targets Editor */}
            {showTargets && (
                <div className="glass-card p-4 animate-fade-in">
                    <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                        <Target className="w-4 h-4" style={{ color: '#f59e0b' }} />
                        Target Metriche — Metodo Sincro
                    </h3>
                    <div className="grid grid-cols-3 gap-3">
                        <div>
                            <label className="label text-[10px]">Target CPL (€)</label>
                            <input type="number" className="input text-sm" value={editCPL}
                                onChange={e => setEditCPL(e.target.value)} />
                        </div>
                        <div>
                            <label className="label text-[10px]">Max CAC (€)</label>
                            <input type="number" className="input text-sm" value={editCAC}
                                onChange={e => setEditCAC(e.target.value)} />
                        </div>
                        <div>
                            <label className="label text-[10px]">Target ROAS (x)</label>
                            <input type="number" step="0.1" className="input text-sm" value={editROAS}
                                onChange={e => setEditROAS(e.target.value)} />
                        </div>
                    </div>
                    <button onClick={handleSaveTargets} className="btn-primary text-xs mt-3" disabled={savingTargets}>
                        {savingTargets ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
                        Salva Target
                    </button>
                </div>
            )}

            {/* Evaluation Results */}
            {evalResults !== null && (
                <div className="glass-card p-4 animate-fade-in">
                    <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                        <Brain className="w-4 h-4" style={{ color: '#a855f7' }} />
                        Risultato Valutazione
                        <span className="text-[10px] px-2 py-0.5 rounded-full" style={{
                            background: evalResults.length > 0 ? 'rgba(245, 158, 11, 0.1)' : 'rgba(34, 197, 94, 0.1)',
                            color: evalResults.length > 0 ? '#f59e0b' : '#22c55e',
                        }}>{evalResults.length} regole triggered</span>
                    </h3>
                    {evalResults.length === 0 ? (
                        <div className="text-xs p-3 rounded-xl text-center" style={{
                            background: 'rgba(34, 197, 94, 0.05)', color: '#22c55e',
                        }}>
                            ✅ Nessuna regola attivata — tutte le metriche sono nei parametri
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {evalResults.map((r, i) => {
                                const cat = CATEGORY_META[r.category] || { label: r.category, color: '#666', emoji: '•' }
                                return (
                                    <div key={i} className="p-3 rounded-xl flex items-start gap-3" style={{
                                        background: 'var(--color-surface-100)', border: `1px solid ${cat.color}30`,
                                    }}>
                                        <span className="text-sm">{cat.emoji}</span>
                                        <div className="flex-1 min-w-0">
                                            <div className="text-xs font-bold text-white">{r.rule_name}</div>
                                            <div className="text-[10px] mt-0.5" style={{ color: 'var(--color-surface-500)' }}>
                                                Campagna: <strong>{r.entity_name}</strong> • Azione: <strong style={{ color: cat.color }}>{r.action}</strong>
                                                {r.action_value && ` (${r.action_value}%)`}
                                            </div>
                                            <div className="text-[10px] mt-1" style={{ color: 'var(--color-surface-600)' }}>
                                                Metriche: SPD €{r.metrics?.spend?.toFixed(2)} | CPL €{r.metrics?.cpl?.toFixed(2)} | CTR {r.metrics?.ctr?.toFixed(2)}%
                                            </div>
                                        </div>
                                        <span className="badge text-[9px]" style={{
                                            background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b',
                                            border: '1px solid rgba(245, 158, 11, 0.2)',
                                        }}>DRY RUN</span>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* History */}
            {showHistory && history.length > 0 && (
                <div className="glass-card p-4 animate-fade-in">
                    <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                        <History className="w-4 h-4" style={{ color: '#818cf8' }} />
                        Ultime Esecuzioni
                    </h3>
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                        {history.map(h => (
                            <div key={h.id} className="p-2 rounded-lg flex items-center gap-2 text-xs" style={{
                                background: 'var(--color-surface-100)',
                            }}>
                                <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0`} style={{
                                    background: h.result === 'success' ? '#22c55e' : h.result === 'dry_run' ? '#f59e0b' : '#ef4444',
                                }} />
                                <span className="font-semibold text-white truncate">{h.rule_name}</span>
                                <span style={{ color: 'var(--color-surface-500)' }}>→ {h.entity_name}</span>
                                <span className="ml-auto text-[10px] flex-shrink-0" style={{ color: 'var(--color-surface-600)' }}>
                                    {new Date(h.executed_at).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Rules by Category */}
            {Object.entries(CATEGORY_META).map(([catKey, catMeta]) => {
                const catRules = groupedRules[catKey]
                if (!catRules || catRules.length === 0) return null
                const Icon = catMeta.icon
                const enabledInCat = catRules.filter(r => r.is_enabled).length

                return (
                    <div key={catKey} className="glass-card p-4">
                        <div className="flex items-center gap-2 mb-3">
                            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{
                                background: `${catMeta.color}15`, border: `1px solid ${catMeta.color}30`,
                            }}>
                                <Icon className="w-3.5 h-3.5" style={{ color: catMeta.color }} />
                            </div>
                            <h3 className="text-sm font-bold text-white">{catMeta.label}</h3>
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{
                                background: `${catMeta.color}15`, color: catMeta.color,
                            }}>{enabledInCat}/{catRules.length}</span>
                        </div>
                        <div className="space-y-2">
                            {catRules.map(rule => (
                                <div key={rule.id} className="flex items-center gap-3 p-2.5 rounded-xl transition-all" style={{
                                    background: rule.is_enabled ? 'var(--color-surface-100)' : 'transparent',
                                    border: `1px solid ${rule.is_enabled ? 'var(--color-surface-200)' : 'var(--color-surface-100)'}`,
                                    opacity: rule.is_enabled ? 1 : 0.5,
                                }}>
                                    <button
                                        onClick={() => handleToggle(rule.id, !rule.is_enabled)}
                                        disabled={toggling === rule.id}
                                        className="flex-shrink-0"
                                    >
                                        {toggling === rule.id ? (
                                            <Loader2 className="w-5 h-5 animate-spin" style={{ color: 'var(--color-surface-500)' }} />
                                        ) : rule.is_enabled ? (
                                            <ToggleRight className="w-5 h-5" style={{ color: catMeta.color }} />
                                        ) : (
                                            <ToggleLeft className="w-5 h-5" style={{ color: 'var(--color-surface-400)' }} />
                                        )}
                                    </button>
                                    <div className="flex-1 min-w-0">
                                        <div className="text-xs font-semibold text-white">{rule.name}</div>
                                        <div className="text-[10px] mt-0.5" style={{ color: 'var(--color-surface-500)' }}>
                                            {rule.conditions.map((c: any, i: number) => (
                                                <span key={i}>
                                                    {i > 0 && ' + '}
                                                    {c.metric} {c.operator} {c.value ?? `${c.value_multiplier}x target`}
                                                </span>
                                            ))}
                                            {' → '}
                                            {rule.actions.map((a: any) => a.type).join(', ')}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1.5 flex-shrink-0">
                                        <span className="text-[9px] px-1.5 py-0.5 rounded-full" style={{
                                            background: 'var(--color-surface-200)',
                                            color: 'var(--color-surface-600)',
                                        }}>min €{rule.min_spend_before_eval} / {rule.min_days_before_eval}gg</span>
                                        {rule.meta_rule_id && (
                                            <span className="text-[9px] px-1.5 py-0.5 rounded-full" style={{
                                                background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6',
                                            }}>Meta</span>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )
            })}
        </div>
    )
}
