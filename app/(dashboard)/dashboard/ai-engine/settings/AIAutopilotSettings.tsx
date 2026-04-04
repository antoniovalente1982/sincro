'use client'

import { useState, useEffect } from 'react'
import {
    ArrowLeft, Brain, Zap, DollarSign, Target, Shield, Flame,
    Activity, ToggleLeft, ToggleRight, Save, Loader2, Clock,
    TrendingUp, AlertTriangle, CheckCircle, XCircle, Paintbrush,
    Settings, ChevronDown, RefreshCw, Eye, Rocket, MousePointerClick,
    Sparkles, Users, Layout, Palette
} from 'lucide-react'
import Link from 'next/link'

interface Config {
    id: string; organization_id: string
    budget_daily: number; budget_weekly: number; budget_monthly: number
    auto_pause_enabled: boolean; auto_scale_enabled: boolean
    auto_creative_refresh: boolean; autopilot_active: boolean
    analysis_interval_minutes: number; risk_tolerance: string
    execution_mode: 'dry_run' | 'live'
    advantage_plus_budget: boolean; advantage_plus_audience: boolean
    advantage_plus_placements: boolean; advantage_plus_creative: boolean
    objectives: { target_cpl: number; target_roas: number; target_ctr: number }
}

interface Log {
    id: string; action_type: string; action_data: any
    result: string; ai_reasoning: string; created_at: string
}

interface Budget {
    id: string; period_type: string; period_start: string; period_end: string
    budget_limit: number; spent: number; remaining: number; status: string
}

interface Props {
    config: Config | null
    logs: Log[]
    budget: Budget[]
    targets: { target_cpl: number; target_cpa_appointment: number; target_cpa_show: number; target_cac: number; target_roas: number } | null
}

const INTERVALS = [
    { value: 15, label: 'Ogni 15 min' },
    { value: 30, label: 'Ogni 30 min' },
    { value: 60, label: 'Ogni 1 ora' },
    { value: 360, label: 'Ogni 6 ore' },
    { value: 1440, label: 'Ogni 24 ore' },
]

const RISK_LEVELS = [
    { value: 'low', label: 'Conservativo', icon: Shield, color: '#22c55e', desc: 'Solo azioni sicure, soglie alte per modifiche' },
    { value: 'medium', label: 'Bilanciato', icon: Target, color: '#f59e0b', desc: 'Equilibrio tra sicurezza e performance' },
    { value: 'high', label: 'Aggressivo', icon: Flame, color: '#ef4444', desc: 'Azioni rapide, scala veloce, tolleranza alta' },
]

export default function AIAutopilotSettings({ config: initialConfig, logs, budget, targets: initialTargets }: Props) {
    const defaults: Omit<Config, 'id' | 'organization_id'> = {
        budget_daily: 0, budget_weekly: 0, budget_monthly: 0,
        auto_pause_enabled: false, auto_scale_enabled: false,
        auto_creative_refresh: false, autopilot_active: false,
        analysis_interval_minutes: 60, risk_tolerance: 'medium',
        execution_mode: 'dry_run' as const,
        advantage_plus_budget: false, advantage_plus_audience: false,
        advantage_plus_placements: false, advantage_plus_creative: false,
        objectives: { target_cpl: 0, target_roas: 0, target_ctr: 0 },
    }

    const [form, setForm] = useState({
        ...defaults,
        ...(initialConfig || {}),
    })

    // Unified targets (from ad_optimization_targets)
    const [targetForm, setTargetForm] = useState({
        target_cpl: initialTargets?.target_cpl || 20,
        target_cpa_appointment: initialTargets?.target_cpa_appointment || 60,
        target_cpa_show: initialTargets?.target_cpa_show || 120,
        target_cac: initialTargets?.target_cac || 500,
        target_roas: initialTargets?.target_roas || 3.0,
    })

    const [saving, setSaving] = useState(false)
    const [saved, setSaved] = useState(false)

    // Hermes Connection Status & Logs
    const [hermesStatus, setHermesStatus] = useState<'checking' | 'online' | 'offline'>('checking')
    const [hermesLogs, setHermesLogs] = useState<string[]>([])

    useEffect(() => {
        const checkHermes = async () => {
            try {
                const res = await fetch('/api/hermes/status')
                setHermesStatus(res.ok ? 'online' : 'offline')
                if (res.ok) {
                    const logsRes = await fetch('/api/hermes/logs')
                    if (logsRes.ok) {
                        const logsData = await logsRes.json()
                        setHermesLogs(logsData.logs || [])
                    }
                }
            } catch {
                setHermesStatus('offline')
            }
        }
        checkHermes()
        // Check every minute
        const interval = setInterval(checkHermes, 60000)
        return () => clearInterval(interval)
    }, [])

    const formatCurrency = (v: number) =>
        new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(v)

    const handleSave = async () => {
        setSaving(true)
        try {
            await fetch('/api/ai-engine/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...form, targets: targetForm }),
            })
            setSaved(true)
            setTimeout(() => setSaved(false), 3000)
        } catch (err) {
            console.error(err)
        }
        setSaving(false)
    }

    const actionIcons: Record<string, any> = {
        analysis: Brain, budget_exceeded: DollarSign, budget_pause: AlertTriangle,
        budget_scale: TrendingUp, creative_alert: Paintbrush, snapshot: Activity,
    }
    const resultColors: Record<string, string> = {
        success: '#22c55e', failed: '#ef4444', skipped: '#f59e0b',
    }

    return (
        <div className="space-y-6 animate-fade-in max-w-4xl mx-auto">
            {/* Header */}
            <div className="flex items-start justify-between flex-wrap gap-4">
                <div>
                    <Link href="/dashboard/ai-engine"
                        className="text-xs flex items-center gap-1 mb-2 hover:underline" style={{ color: 'var(--color-surface-500)' }}>
                        <ArrowLeft className="w-3 h-3" /> AI Engine
                    </Link>
                    <div className="flex items-center gap-4">
                        <h1 className="text-2xl font-bold text-white flex items-center gap-3">
                            <Settings className="w-7 h-7" style={{ color: '#a855f7' }} />
                            AI Autopilot Settings
                        </h1>
                        {/* Hermes Connection Badge */}
                        <div className="flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-semibold border" style={{
                            background: hermesStatus === 'online' ? 'rgba(34, 197, 94, 0.1)' : hermesStatus === 'offline' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(245, 158, 11, 0.1)',
                            borderColor: hermesStatus === 'online' ? 'rgba(34, 197, 94, 0.3)' : hermesStatus === 'offline' ? 'rgba(239, 68, 68, 0.3)' : 'rgba(245, 158, 11, 0.3)',
                            color: hermesStatus === 'online' ? '#22c55e' : hermesStatus === 'offline' ? '#ef4444' : '#f59e0b',
                        }}>
                            {hermesStatus === 'checking' ? <RefreshCw className="w-3 h-3 animate-spin mx-0.5" /> : (
                                <div className={`w-2 h-2 rounded-full ${hermesStatus === 'online' ? 'bg-green-500' : 'bg-red-500'} ${hermesStatus === 'online' ? 'animate-pulse' : ''}`} />
                            )}
                            HERMES VPS: {hermesStatus.toUpperCase()}
                        </div>
                    </div>
                    <p className="text-sm mt-1" style={{ color: 'var(--color-surface-600)' }}>
                        Configura budget, obiettivi e automazioni — Hermes Agent lavora in autonomia sulla tua VPS
                    </p>
                </div>
                <button onClick={handleSave} className="btn-primary" disabled={saving}>
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> :
                        saved ? <CheckCircle className="w-4 h-4" /> : <Save className="w-4 h-4" />}
                    {saving ? 'Salvando...' : saved ? 'Salvato!' : 'Salva Impostazioni'}
                </button>
            </div>

            {/* Autopilot Master Toggle */}
            <div className="glass-card p-6 relative overflow-hidden">
                <div className="absolute inset-0 opacity-5" style={{
                    background: form.autopilot_active
                        ? 'radial-gradient(ellipse at center, #22c55e 0%, transparent 70%)'
                        : 'radial-gradient(ellipse at center, #ef4444 0%, transparent 70%)',
                }} />
                <div className="relative z-10 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{
                            background: form.autopilot_active ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.1)',
                            border: `1px solid ${form.autopilot_active ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.2)'}`,
                        }}>
                            <Rocket className="w-7 h-7" style={{ color: form.autopilot_active ? '#22c55e' : '#ef4444' }} />
                        </div>
                        <div>
                            <div className="text-lg font-bold text-white flex items-center gap-2">
                                Autopilot
                                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{
                                    background: form.autopilot_active ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.1)',
                                    color: form.autopilot_active ? '#22c55e' : '#ef4444',
                                }}>{form.autopilot_active ? '🟢 ATTIVO' : '🔴 INATTIVO'}</span>
                            </div>
                            <p className="text-xs mt-0.5" style={{ color: 'var(--color-surface-500)' }}>
                                {form.autopilot_active
                                    ? `L'AI analizza le campagne ogni ${INTERVALS.find(i => i.value === form.analysis_interval_minutes)?.label?.toLowerCase() || '60 min'} e agisce in autonomia`
                                    : 'Attiva per far lavorare l\'AI in autonomia sulle tue campagne'}
                            </p>
                        </div>
                    </div>
                    <button onClick={() => setForm(f => ({ ...f, autopilot_active: !f.autopilot_active }))}
                        className="p-2 rounded-xl transition-all hover:bg-white/5">
                        {form.autopilot_active
                            ? <ToggleRight className="w-10 h-10" style={{ color: '#22c55e' }} />
                            : <ToggleLeft className="w-10 h-10" style={{ color: 'var(--color-surface-500)' }} />}
                    </button>
                </div>
            </div>

            {/* Execution Mode Toggle — DRY RUN / LIVE */}
            <div className="glass-card p-6">
                <div className="flex items-center gap-2 mb-4">
                    <Zap className="w-5 h-5" style={{ color: form.execution_mode === 'live' ? '#ef4444' : '#f59e0b' }} />
                    <h2 className="text-base font-bold text-white">Modalità Esecuzione</h2>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{
                        background: form.execution_mode === 'live' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                        color: form.execution_mode === 'live' ? '#ef4444' : '#f59e0b',
                    }}>{form.execution_mode === 'live' ? '🟢 LIVE — Azioni reali su Meta' : '🟡 DRY RUN — Solo log'}</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                    <button
                        type="button"
                        onClick={() => setForm(f => ({ ...f, execution_mode: 'dry_run' }))}
                        className="p-4 rounded-xl text-left transition-all" style={{
                            background: form.execution_mode === 'dry_run' ? 'rgba(245, 158, 11, 0.1)' : 'var(--color-surface-100)',
                            border: `2px solid ${form.execution_mode === 'dry_run' ? 'rgba(245, 158, 11, 0.4)' : 'var(--color-surface-200)'}`,
                        }}
                    >
                        <div className="flex items-center gap-2 mb-1">
                            <Eye className="w-4 h-4" style={{ color: '#f59e0b' }} />
                            <span className="text-sm font-bold text-white">DRY RUN</span>
                            {form.execution_mode === 'dry_run' && <CheckCircle className="w-4 h-4 ml-auto" style={{ color: '#f59e0b' }} />}
                        </div>
                        <p className="text-[10px]" style={{ color: 'var(--color-surface-500)' }}>Le regole vengono valutate e loggate, ma nessuna azione viene eseguita su Meta. Ideale per testare.</p>
                    </button>
                    <button
                        type="button"
                        onClick={() => {
                            if (confirm('⚠️ ATTENZIONE: In modalità LIVE, l\'AI eseguirà azioni reali su Meta (pause ads, modifica budget). Sei sicuro?')) {
                                setForm(f => ({ ...f, execution_mode: 'live' }))
                            }
                        }}
                        className="p-4 rounded-xl text-left transition-all" style={{
                            background: form.execution_mode === 'live' ? 'rgba(239, 68, 68, 0.1)' : 'var(--color-surface-100)',
                            border: `2px solid ${form.execution_mode === 'live' ? 'rgba(239, 68, 68, 0.4)' : 'var(--color-surface-200)'}`,
                        }}
                    >
                        <div className="flex items-center gap-2 mb-1">
                            <Rocket className="w-4 h-4" style={{ color: '#ef4444' }} />
                            <span className="text-sm font-bold text-white">LIVE</span>
                            {form.execution_mode === 'live' && <CheckCircle className="w-4 h-4 ml-auto" style={{ color: '#ef4444' }} />}
                        </div>
                        <p className="text-[10px]" style={{ color: 'var(--color-surface-500)' }}>L'AI esegue azioni reali: pause ads, modifica budget. Max 5 azioni/ora con cooldown 24h.</p>
                    </button>
                </div>
                {form.execution_mode === 'live' && (
                    <div className="mt-3 p-3 rounded-xl text-xs" style={{ background: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.2)', color: '#ef4444' }}>
                        ⚠️ <strong>Modalità LIVE attiva.</strong> L'AI eseguirà azioni reali ogni ora: pause di ads sottoperformanti, modifiche budget. Riceverai notifiche Telegram per ogni azione.
                    </div>
                )}
            </div>

            {/* Advantage+ Configuration */}
            <div className="glass-card p-6">
                <div className="flex items-center gap-2 mb-2">
                    <Sparkles className="w-5 h-5" style={{ color: '#818cf8' }} />
                    <h2 className="text-base font-bold text-white">Advantage+ Configurazione</h2>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{
                        background: 'rgba(129, 140, 248, 0.15)', color: '#818cf8',
                    }}>Meta AI</span>
                </div>
                <p className="text-[11px] mb-4" style={{ color: 'var(--color-surface-500)' }}>
                    Indica quali funzionalità Advantage+ stai usando su Meta. L'AI regola le regole di conseguenza.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {[
                        {
                            key: 'advantage_plus_budget', label: 'Advantage+ Budget',
                            icon: DollarSign, color: '#f59e0b',
                            desc: 'Meta gestisce il budget su base settimanale (può spendere fino a 1.75x in un giorno). Le regole AI useranno il budget settimanale.',
                        },
                        {
                            key: 'advantage_plus_audience', label: 'Advantage+ Pubblico',
                            icon: Users, color: '#3b82f6',
                            desc: 'Meta espande automaticamente il pubblico oltre la definizione manuale. Le regole di targeting non si applicano.',
                        },
                        {
                            key: 'advantage_plus_placements', label: 'Advantage+ Posizionamenti',
                            icon: Layout, color: '#22c55e',
                            desc: 'Meta sceglie automaticamente dove mostrare gli ads (Feed, Stories, Reels, ecc.).',
                        },
                        {
                            key: 'advantage_plus_creative', label: 'Advantage+ Creative',
                            icon: Palette, color: '#a855f7',
                            desc: 'Meta ottimizza automaticamente testo, immagini e formati degli ads per ogni utente.',
                        },
                    ].map(toggle => (
                        <div key={toggle.key} className="flex items-start gap-3 p-3 rounded-xl" style={{
                            background: (form as any)[toggle.key] ? `${toggle.color}08` : 'var(--color-surface-100)',
                            border: `1px solid ${(form as any)[toggle.key] ? `${toggle.color}30` : 'var(--color-surface-200)'}`,
                        }}>
                            <toggle.icon className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: toggle.color }} />
                            <div className="flex-1 min-w-0">
                                <div className="text-xs font-semibold text-white">{toggle.label}</div>
                                <div className="text-[10px] mt-0.5" style={{ color: 'var(--color-surface-600)' }}>{toggle.desc}</div>
                            </div>
                            <button onClick={() => setForm(f => ({ ...f, [toggle.key]: !(f as any)[toggle.key] }))}
                                className="flex-shrink-0 mt-0.5">
                                {(form as any)[toggle.key]
                                    ? <ToggleRight className="w-7 h-7" style={{ color: toggle.color }} />
                                    : <ToggleLeft className="w-7 h-7" style={{ color: 'var(--color-surface-500)' }} />}
                            </button>
                        </div>
                    ))}
                </div>
            </div>

            {/* Budget Controls */}
            <div className="glass-card p-6">
                <div className="flex items-center gap-2 mb-2">
                    <DollarSign className="w-5 h-5" style={{ color: '#f59e0b' }} />
                    <h2 className="text-base font-bold text-white">Budget Limits</h2>
                    {form.advantage_plus_budget && (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{
                            background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b',
                        }}>⚡ Advantage+ Budget — Base settimanale</span>
                    )}
                </div>
                {form.advantage_plus_budget && (
                    <p className="text-[11px] mb-4 p-2 rounded-lg" style={{ background: 'rgba(245, 158, 11, 0.05)', border: '1px solid rgba(245, 158, 11, 0.15)', color: '#f59e0b' }}>
                        Con Advantage+ Budget, Meta può spendere fino a 1.75x in un singolo giorno. Il budget giornaliero non è rilevante — imposta il <strong>budget settimanale</strong> come riferimento.
                    </p>
                )}
                <div className={`grid gap-4 ${form.advantage_plus_budget ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1 md:grid-cols-3'}`}>
                    {[
                        { key: 'budget_daily', label: 'Giornaliero', desc: 'Spesa massima al giorno', hideIfAdvantage: true },
                        { key: 'budget_weekly', label: 'Settimanale', desc: form.advantage_plus_budget ? 'Budget principale — Meta gestisce la distribuzione giornaliera' : 'Spesa massima a settimana', hideIfAdvantage: false },
                        { key: 'budget_monthly', label: 'Mensile', desc: 'Spesa massima al mese', hideIfAdvantage: false },
                    ].filter(b => !(b.hideIfAdvantage && form.advantage_plus_budget)).map(b => {
                        const budgetEntry = budget.find(bt => bt.period_type === b.key.replace('budget_', ''))
                        const isWeeklyHighlight = b.key === 'budget_weekly' && form.advantage_plus_budget
                        return (
                            <div key={b.key} className="p-4 rounded-xl" style={{
                                background: isWeeklyHighlight ? 'rgba(245, 158, 11, 0.05)' : 'var(--color-surface-100)',
                                border: `1px solid ${isWeeklyHighlight ? 'rgba(245, 158, 11, 0.3)' : 'var(--color-surface-200)'}`,
                            }}>
                                <label className="label flex items-center gap-1">
                                    {b.label}
                                    {isWeeklyHighlight && <span className="text-[9px]" style={{ color: '#f59e0b' }}>⭐ PRINCIPALE</span>}
                                </label>
                                <div className="flex items-center gap-2">
                                    <span className="text-sm font-semibold" style={{ color: '#f59e0b' }}>€</span>
                                    <input
                                        type="number" className="input" min={0} step={5}
                                        value={(form as any)[b.key] || ''}
                                        onChange={e => setForm(f => ({ ...f, [b.key]: Number(e.target.value) }))}
                                        placeholder="0"
                                    />
                                </div>
                                <p className="text-[10px] mt-1" style={{ color: 'var(--color-surface-600)' }}>{b.desc}</p>
                                {budgetEntry && (
                                    <div className="mt-2">
                                        <div className="flex items-center justify-between text-[10px] mb-1">
                                            <span style={{ color: 'var(--color-surface-500)' }}>
                                                {formatCurrency(budgetEntry.spent)} / {formatCurrency(budgetEntry.budget_limit)}
                                            </span>
                                            <span style={{
                                                color: budgetEntry.status === 'exceeded' ? '#ef4444' :
                                                    budgetEntry.status === 'warning' ? '#f59e0b' : '#22c55e',
                                            }}>{budgetEntry.status === 'exceeded' ? '⚠️ Superato' :
                                                budgetEntry.status === 'warning' ? '⚡ 80%+' : '✅ OK'}</span>
                                        </div>
                                        <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--color-surface-200)' }}>
                                            <div className="h-full rounded-full transition-all" style={{
                                                width: `${Math.min((budgetEntry.spent / (budgetEntry.budget_limit || 1)) * 100, 100)}%`,
                                                background: budgetEntry.status === 'exceeded' ? '#ef4444' :
                                                    budgetEntry.status === 'warning' ? '#f59e0b' : '#22c55e',
                                            }} />
                                        </div>
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </div>
            </div>

            {/* Target di Performance — Single Source of Truth */}
            <div className="glass-card p-6">
                <div className="flex items-center gap-2 mb-2">
                    <Target className="w-5 h-5" style={{ color: '#3b82f6' }} />
                    <h2 className="text-base font-bold text-white">Target di Performance</h2>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{
                        background: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6',
                    }}>Fonte unica</span>
                </div>
                <p className="text-[11px] mb-4" style={{ color: 'var(--color-surface-500)' }}>
                    Questi target guidano tutte le regole automatiche. Modificandoli qui, le regole si adattano automaticamente.
                </p>
                {/* Funnel visual */}
                <div className="flex items-center gap-1 mb-4 p-3 rounded-xl overflow-x-auto" style={{ background: 'var(--color-surface-100)', border: '1px solid var(--color-surface-200)' }}>
                    {[
                        { label: 'Lead', value: targetForm.target_cpl, color: '#f59e0b', key: 'target_cpl' },
                        { label: 'Appuntamento', value: targetForm.target_cpa_appointment, color: '#3b82f6', key: 'target_cpa_appointment' },
                        { label: 'Show', value: targetForm.target_cpa_show, color: '#8b5cf6', key: 'target_cpa_show' },
                        { label: 'Vendita', value: targetForm.target_cac, color: '#22c55e', key: 'target_cac' },
                    ].map((step, i) => (
                        <div key={step.key} className="flex items-center gap-1">
                            <div className="text-center px-3 py-1.5 rounded-lg" style={{ background: `${step.color}10`, border: `1px solid ${step.color}25` }}>
                                <div className="text-[9px] font-semibold" style={{ color: step.color }}>{step.label}</div>
                                <div className="text-xs font-bold text-white">€{step.value}</div>
                            </div>
                            {i < 3 && <ChevronDown className="w-3 h-3 -rotate-90 flex-shrink-0" style={{ color: 'var(--color-surface-500)' }} />}
                        </div>
                    ))}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-3">
                    {[
                        { key: 'target_cpl', label: 'Target CPL', icon: DollarSign, color: '#f59e0b', desc: 'Costo per lead massimo — usato dalle regole Kill e Winner' },
                        { key: 'target_cpa_appointment', label: 'CPA Appuntamento', icon: Target, color: '#3b82f6', desc: 'Costo per appuntamento fissato' },
                        { key: 'target_cpa_show', label: 'CPA Show', icon: Eye, color: '#8b5cf6', desc: 'Costo per appuntamento presentato' },
                    ].map(obj => (
                        <div key={obj.key} className="p-4 rounded-xl" style={{
                            background: 'var(--color-surface-100)', border: '1px solid var(--color-surface-200)',
                        }}>
                            <div className="flex items-center gap-2 mb-2">
                                <obj.icon className="w-4 h-4" style={{ color: obj.color }} />
                                <label className="label mb-0">{obj.label}</label>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-sm font-semibold" style={{ color: obj.color }}>€</span>
                                <input
                                    type="number" className="input" min={0} step={1}
                                    value={(targetForm as any)[obj.key] || ''}
                                    onChange={e => setTargetForm(f => ({ ...f, [obj.key]: Number(e.target.value) }))}
                                    placeholder="0"
                                />
                            </div>
                            <p className="text-[10px] mt-1" style={{ color: 'var(--color-surface-600)' }}>{obj.desc}</p>
                        </div>
                    ))}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 rounded-xl" style={{ background: 'var(--color-surface-100)', border: '1px solid var(--color-surface-200)' }}>
                        <div className="flex items-center gap-2 mb-2">
                            <DollarSign className="w-4 h-4" style={{ color: '#22c55e' }} />
                            <label className="label mb-0">Max CAC (Costo Acquisizione)</label>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold" style={{ color: '#22c55e' }}>€</span>
                            <input type="number" className="input" min={0} step={10}
                                value={targetForm.target_cac || ''}
                                onChange={e => setTargetForm(f => ({ ...f, target_cac: Number(e.target.value) }))}
                                placeholder="0" />
                        </div>
                        <p className="text-[10px] mt-1" style={{ color: 'var(--color-surface-600)' }}>Costo massimo per acquisire un cliente (vendita chiusa)</p>
                    </div>
                    <div className="p-4 rounded-xl" style={{ background: 'var(--color-surface-100)', border: '1px solid var(--color-surface-200)' }}>
                        <div className="flex items-center gap-2 mb-2">
                            <TrendingUp className="w-4 h-4" style={{ color: '#a855f7' }} />
                            <label className="label mb-0">Target ROAS</label>
                        </div>
                        <div className="flex items-center gap-2">
                            <input type="number" className="input" min={0} step={0.1}
                                value={targetForm.target_roas || ''}
                                onChange={e => setTargetForm(f => ({ ...f, target_roas: Number(e.target.value) }))}
                                placeholder="0" />
                            <span className="text-sm font-semibold" style={{ color: '#a855f7' }}>x</span>
                        </div>
                        <p className="text-[10px] mt-1" style={{ color: 'var(--color-surface-600)' }}>Return on Ad Spend minimo (se tracciato)</p>
                    </div>
                </div>
            </div>

            {/* Automation Toggles + Risk + Interval */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Automations */}
                <div className="glass-card p-6">
                    <div className="flex items-center gap-2 mb-4">
                        <Zap className="w-5 h-5" style={{ color: '#a855f7' }} />
                        <h2 className="text-sm font-bold text-white">Automazioni</h2>
                    </div>
                    <div className="space-y-3">
                        {[
                            { key: 'auto_pause_enabled', label: 'Auto-Pause Budget', desc: 'Pausa automatica se il budget viene superato', icon: AlertTriangle, color: '#ef4444' },
                            { key: 'auto_scale_enabled', label: 'Auto-Scale', desc: 'Scala automaticamente campagne con ROAS alto', icon: TrendingUp, color: '#22c55e' },
                            { key: 'auto_creative_refresh', label: 'Creative Refresh Alert', desc: 'Alert quando le creativi mostrano segni di fatigue', icon: Paintbrush, color: '#a855f7' },
                        ].map(toggle => (
                            <div key={toggle.key} className="flex items-center gap-3 p-3 rounded-xl" style={{
                                background: 'var(--color-surface-100)', border: '1px solid var(--color-surface-200)',
                            }}>
                                <toggle.icon className="w-4 h-4 flex-shrink-0" style={{ color: toggle.color }} />
                                <div className="flex-1 min-w-0">
                                    <div className="text-xs font-semibold text-white">{toggle.label}</div>
                                    <div className="text-[10px]" style={{ color: 'var(--color-surface-600)' }}>{toggle.desc}</div>
                                </div>
                                <button onClick={() => setForm(f => ({ ...f, [toggle.key]: !(f as any)[toggle.key] }))}
                                    className="flex-shrink-0">
                                    {(form as any)[toggle.key]
                                        ? <ToggleRight className="w-7 h-7" style={{ color: '#22c55e' }} />
                                        : <ToggleLeft className="w-7 h-7" style={{ color: 'var(--color-surface-500)' }} />}
                                </button>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Risk + Interval */}
                <div className="space-y-4">
                    {/* Risk */}
                    <div className="glass-card p-6">
                        <div className="flex items-center gap-2 mb-4">
                            <Shield className="w-5 h-5" style={{ color: '#3b82f6' }} />
                            <h2 className="text-sm font-bold text-white">Risk Tolerance</h2>
                        </div>
                        <div className="space-y-2">
                            {RISK_LEVELS.map(r => (
                                <button key={r.value} onClick={() => setForm(f => ({ ...f, risk_tolerance: r.value }))}
                                    className="w-full flex items-center gap-3 p-3 rounded-xl text-left transition-all" style={{
                                        background: form.risk_tolerance === r.value ? `${r.color}10` : 'var(--color-surface-100)',
                                        border: `1px solid ${form.risk_tolerance === r.value ? `${r.color}40` : 'var(--color-surface-200)'}`,
                                    }}>
                                    <r.icon className="w-4 h-4 flex-shrink-0" style={{ color: r.color }} />
                                    <div className="flex-1 min-w-0">
                                        <div className="text-xs font-semibold text-white">{r.label}</div>
                                        <div className="text-[10px]" style={{ color: 'var(--color-surface-600)' }}>{r.desc}</div>
                                    </div>
                                    {form.risk_tolerance === r.value && (
                                        <CheckCircle className="w-4 h-4 flex-shrink-0" style={{ color: r.color }} />
                                    )}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Interval */}
                    <div className="glass-card p-6">
                        <div className="flex items-center gap-2 mb-4">
                            <Clock className="w-5 h-5" style={{ color: '#f59e0b' }} />
                            <h2 className="text-sm font-bold text-white">Frequenza Analisi</h2>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {INTERVALS.map(i => (
                                <button key={i.value}
                                    onClick={() => setForm(f => ({ ...f, analysis_interval_minutes: i.value }))}
                                    className="px-3 py-2 rounded-xl text-xs font-medium transition-all" style={{
                                        background: form.analysis_interval_minutes === i.value ? 'rgba(245, 158, 11, 0.15)' : 'var(--color-surface-100)',
                                        border: `1px solid ${form.analysis_interval_minutes === i.value ? 'rgba(245, 158, 11, 0.4)' : 'var(--color-surface-200)'}`,
                                        color: form.analysis_interval_minutes === i.value ? '#f59e0b' : 'var(--color-surface-700)',
                                    }}>
                                    {i.label}
                                </button>
                            ))}
                        </div>
                        <p className="text-[10px] mt-2" style={{ color: 'var(--color-surface-600)' }}>
                            Il cron job gira ogni 15 min, ma l'AI analizza solo quando l'intervallo è trascorso
                        </p>
                    </div>
                </div>
            </div>

            {/* Agent Activity Logs & Hermes VPS Console */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Agent Activity Logs */}
                <div className="glass-card p-6">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                            <Activity className="w-5 h-5" style={{ color: '#6366f1' }} />
                            <h2 className="text-sm font-bold text-white">Cron Logs (Sincro)</h2>
                            <span className="text-[10px] px-2 py-0.5 rounded-full" style={{
                                background: 'rgba(99, 102, 241, 0.15)', color: '#6366f1',
                            }}>
                                Ultime {logs.length} azioni
                            </span>
                        </div>
                    </div>

                    {logs.length > 0 ? (
                        <div className="space-y-2 max-h-96 overflow-y-auto">
                            {logs.map(log => {
                                const Icon = actionIcons[log.action_type] || Brain
                                const rColor = resultColors[log.result] || '#6366f1'
                                return (
                                    <div key={log.id} className="flex items-start gap-3 p-3 rounded-xl" style={{
                                        background: 'var(--color-surface-100)', border: '1px solid var(--color-surface-200)',
                                    }}>
                                        <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5" style={{
                                            background: `${rColor}15`, border: `1px solid ${rColor}30`,
                                        }}>
                                            <Icon className="w-3.5 h-3.5" style={{ color: rColor }} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-0.5">
                                                <span className="text-xs font-semibold text-white">{log.action_type.replace(/_/g, ' ')}</span>
                                                <span className="badge" style={{
                                                    fontSize: '9px', background: `${rColor}15`, color: rColor,
                                                    border: `1px solid ${rColor}30`,
                                                }}>{log.result}</span>
                                                <span className="text-[10px]" style={{ color: 'var(--color-surface-600)' }}>
                                                    {new Date(log.created_at).toLocaleString('it-IT', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                            </div>
                                            {log.ai_reasoning && (
                                                <p className="text-[11px] line-clamp-2" style={{ color: 'var(--color-surface-500)' }}>{log.ai_reasoning}</p>
                                            )}
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    ) : (
                        <div className="text-center py-8">
                            <Brain className="w-8 h-8 mx-auto mb-3" style={{ color: 'var(--color-surface-400)' }} />
                            <p className="text-sm" style={{ color: 'var(--color-surface-500)' }}>
                                Nessuna attività del cron locale
                            </p>
                        </div>
                    )}
                </div>

                {/* Hermes Realtime Console */}
                <div className="glass-card p-6 flex flex-col h-[450px]">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                            <h2 className="text-sm font-bold text-white">Hermes VPS Console</h2>
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded" style={{
                                background: 'rgba(34, 197, 94, 0.1)', color: '#22c55e', border: '1px solid rgba(34, 197, 94, 0.3)'
                            }}>
                                live feed
                            </span>
                        </div>
                    </div>
                    
                    <div className="flex-1 bg-black rounded-xl p-4 font-mono text-[10px] sm:text-xs overflow-y-auto" style={{ border: '1px solid var(--color-surface-200)' }}>
                        <div className="text-green-500/70 mb-2">Hermes Node: connection established.</div>
                        <div className="text-green-500/70 mb-4">System ready... awaiting tasks.</div>
                        {hermesLogs.map((logLine, idx) => (
                            <div key={idx} className="text-white mt-1">
                                {logLine.includes('[Orchestrator]') ? (
                                    <><span className="text-blue-400">[{new Date().toLocaleTimeString('it-IT')}] </span><span className="text-purple-400">[Orchestrator] </span>{logLine.replace('[Orchestrator]', '')}</>
                                ) : logLine.includes('[MediaBuyer]') ? (
                                    <><span className="text-blue-400">[{new Date().toLocaleTimeString('it-IT')}] </span><span className="text-yellow-400">[MediaBuyer] </span>{logLine.replace('[MediaBuyer]', '')}</>
                                ) : (
                                    <><span className="text-blue-400">[{new Date().toLocaleTimeString('it-IT')}] </span><span className="text-green-400">[System] </span>{logLine}</>
                                )}
                            </div>
                        ))}
                        {hermesLogs.length === 0 && hermesStatus === 'online' && (
                            <div className="text-gray-400 italic mt-2">Nessun log ricevuto di recente.</div>
                        )}
                        {hermesStatus === 'offline' && (
                            <div className="mt-4 text-red-500">
                                <span className="text-blue-400">[{new Date().toLocaleTimeString('it-IT')}] </span>
                                Connection lost: No response from Hermes API. (VPS Offline)
                            </div>
                        )}
                        <div className="animate-pulse mt-1 text-gray-500">_</div>
                    </div>
                </div>
            </div>

            {/* Bottom save bar */}
            <div className="sticky bottom-4 glass-card p-4 flex items-center justify-between" style={{
                borderColor: 'rgba(168, 85, 247, 0.3)',
            }}>
                <div className="text-xs" style={{ color: 'var(--color-surface-500)' }}>
                    {form.autopilot_active ? '🟢 Autopilot attivo — salva per applicare le modifiche' : '🔴 Autopilot inattivo'}
                </div>
                <button onClick={handleSave} className="btn-primary" disabled={saving}>
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> :
                        saved ? <CheckCircle className="w-4 h-4" /> : <Save className="w-4 h-4" />}
                    {saving ? 'Salvando...' : saved ? 'Salvato!' : 'Salva'}
                </button>
            </div>
        </div>
    )
}
