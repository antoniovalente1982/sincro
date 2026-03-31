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
    const [forceRunning, setForceRunning] = useState(false)
    const [evalResults, setEvalResults] = useState<any[] | null>(null)
    const [showHistory, setShowHistory] = useState(false)
    const [executionMode, setExecutionMode] = useState<'dry_run' | 'live'>('dry_run')



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
            if (data.targets) setTargets(data.targets)
            if (data.execution_mode) setExecutionMode(data.execution_mode)
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



    const handleEvaluate = async () => {
        setEvaluating(true)
        setEvalResults(null)
        try {
            // Get auth token for Meta API
            const { createClient } = await import('@/lib/supabase/client')
            const supabase = createClient()
            const { data: { session } } = await supabase.auth.getSession()

            // Fetch ad-level insights from Meta (last 7 days for evaluation)
            const until = new Date().toISOString().slice(0, 10)
            const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

            let adData: any[] = []
            let campaignBudgets: Record<string, number> = {}

            if (session?.access_token) {
                const adRes = await fetch(`/api/meta/ad-insights?since=${since}&until=${until}`, {
                    headers: { Authorization: `Bearer ${session.access_token}` },
                })
                if (adRes.ok) {
                    const adJson = await adRes.json()
                    adData = (adJson.ads || []).filter((a: any) => a.status === 'ACTIVE')
                    campaignBudgets = adJson.campaign_budgets || {}
                }
            }

            // Send ad-level data to evaluation engine
            const res = await fetch('/api/ai-engine', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'evaluate_rules',
                    ads: adData,
                    campaign_budgets: campaignBudgets,
                    campaigns: campaigns.filter(c => c.status === 'ACTIVE'),
                }),
            })
            const data = await res.json()
            setEvalResults(data.results || [])
            fetchRules()
        } catch { }
        setEvaluating(false)
    }

    const handleForceRun = async () => {
        if (!confirm(
            executionMode === 'live'
                ? '⚡ FORCE RUN LIVE\n\nQuesto eseguirà le regole ORA e applicherà azioni reali su Meta (pausa ads, modifica budget).\n\nContinuare?'
                : '⚡ FORCE RUN DRY RUN\n\nQuesto valuterà le regole ORA ma NON applicherà azioni su Meta (solo log).\n\nContinuare?'
        )) return

        setForceRunning(true)
        try {
            const res = await fetch('/api/ai-engine', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'force_run' }),
            })
            const data = await res.json()
            if (data.ok) {
                const actions = data.actions || []
                const executed = actions.filter((a: any) => a.status === 'executed')
                const dryRun = actions.filter((a: any) => a.status === 'dry_run')
                const blocked = actions.filter((a: any) => a.status === 'skipped_safety')
                const learning = actions.filter((a: any) => a.category === 'learning_protection')

                let summary = `⚡ Force Run completato!\n\n`
                
                if (executed.length > 0) {
                    summary += `✅ ESEGUITE (${executed.length}):\n`
                    executed.forEach((a: any) => { summary += `  • ${a.name} → ${a.action}\n` })
                    summary += '\n'
                }
                if (blocked.length > 0) {
                    summary += `🛡 BLOCCATE (safety guard) (${blocked.length}):\n`
                    blocked.forEach((a: any) => { summary += `  • ${a.name}\n` })
                    summary += '\n'
                }
                if (learning.length > 0) {
                    summary += `⏸ LEARNING PROTECTION (${learning.length}):\n`
                    learning.forEach((a: any) => { summary += `  • ${a.name}\n` })
                    summary += '\n'
                }
                if (actions.length === 0) {
                    summary += '✨ Nessuna azione necessaria — tutte le ads nei parametri'
                }
                
                alert(summary)
            } else {
                alert(`❌ Errore: ${data.error || 'Errore sconosciuto'}`)
            }
            fetchRules() // Refresh history
        } catch (err) {
            alert('❌ Errore di rete durante il Force Run')
        }
        setForceRunning(false)
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
                            background: executionMode === 'live' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(129, 140, 248, 0.15)',
                            color: executionMode === 'live' ? '#ef4444' : '#818cf8',
                        }}>{executionMode === 'live' ? '🟢 LIVE — Azioni reali' : '🟡 DRY RUN — Solo log'}</span>
                    </h2>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--color-surface-500)' }}>
                        {enabledCount}/{rules.length} regole attive • {executionMode === 'live' ? 'Le azioni vengono eseguite su Meta ogni ora' : 'Le azioni vengono solo loggate (non eseguite su Meta)'}
                    </p>
                </div>
                <div className="flex gap-2">
                    <button onClick={() => setShowHistory(!showHistory)} className="btn-primary text-xs" style={{
                        background: 'rgba(129, 140, 248, 0.1)', border: '1px solid rgba(129, 140, 248, 0.3)', color: '#818cf8',
                    }}>
                        <History className="w-3.5 h-3.5" /> Log
                    </button>
                    <button onClick={handleEvaluate} className="btn-primary text-xs" disabled={evaluating}>
                        {evaluating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                        {evaluating ? 'Valutando...' : 'Valuta Regole'}
                    </button>
                    <button onClick={handleForceRun} className="btn-primary text-xs" disabled={forceRunning} style={{
                        background: executionMode === 'live' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                        border: `1px solid ${executionMode === 'live' ? 'rgba(239, 68, 68, 0.4)' : 'rgba(245, 158, 11, 0.4)'}`,
                        color: executionMode === 'live' ? '#ef4444' : '#f59e0b',
                    }}>
                        {forceRunning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
                        {forceRunning ? 'Eseguendo...' : '⚡ Force Run'}
                    </button>
                </div>
            </div>



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
                                                {r.metrics?.link_ctr > 0 && ` | Link CTR ${r.metrics.link_ctr.toFixed(2)}%`}
                                                {r.metrics?.cpc_link > 0 && ` | CPC Link €${r.metrics.cpc_link.toFixed(2)}`}
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
