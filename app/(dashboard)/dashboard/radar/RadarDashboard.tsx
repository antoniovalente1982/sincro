'use client'

import { useState, useEffect, useCallback } from 'react'
import { Activity, Brain, AlertTriangle, CheckCircle, ExternalLink, Mail, Phone, Search, TrendingUp, Users, Copy, Check, ChevronRight, ArrowRight, Zap, Target, Shield, Flame, Lock } from 'lucide-react'

interface RadarSubmission {
    id: string
    created_at: string
    child_name: string
    child_sport: string | null
    parent_name: string
    parent_email: string
    parent_phone: string | null
    partner_id: string | null
    scores: { fiducia: number; pressione: number; motivazione: number; blocchi: number; overall: number }
    converted: boolean
    converted_at: string | null
}

/* ── Radial Score Ring ── */
function ScoreRing({ score, size = 72 }: { score: number; size?: number }) {
    const radius = (size - 8) / 2
    const circumference = 2 * Math.PI * radius
    const offset = circumference - (score / 100) * circumference
    const color = score >= 75 ? '#22c55e' : score >= 50 ? '#f59e0b' : '#ef4444'
    const label = score >= 75 ? 'Buono' : score >= 50 ? 'Attenzione' : 'Critico'
    const bgRing = score >= 75 ? 'rgba(34,197,94,0.08)' : score >= 50 ? 'rgba(245,158,11,0.08)' : 'rgba(239,68,68,0.08)'

    return (
        <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
            <svg width={size} height={size} className="rotate-[-90deg]">
                <circle cx={size / 2} cy={size / 2} r={radius} fill={bgRing}
                    stroke="var(--color-surface-200)" strokeWidth="3" opacity="0.4" />
                <circle cx={size / 2} cy={size / 2} r={radius} fill="none"
                    stroke={color} strokeWidth="3.5" strokeLinecap="round"
                    strokeDasharray={circumference} strokeDashoffset={offset}
                    style={{ transition: 'stroke-dashoffset 1s cubic-bezier(0.4, 0, 0.2, 1)' }} />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-lg font-black leading-none" style={{ color }}>{score}%</span>
                <span className="text-[9px] font-bold mt-0.5 uppercase tracking-wide" style={{ color: 'var(--color-surface-500)' }}>{label}</span>
            </div>
        </div>
    )
}

/* ── Score Bar (for detail rows) ── */
function ScoreBar({ score, label, icon: Icon }: { score: number; label: string; icon: React.ElementType }) {
    const color = score >= 75 ? '#22c55e' : score >= 50 ? '#f59e0b' : '#ef4444'
    const bg = score >= 75 ? 'rgba(34,197,94,0.1)' : score >= 50 ? 'rgba(245,158,11,0.1)' : 'rgba(239,68,68,0.1)'
    return (
        <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: bg }}>
                <Icon className="w-3 h-3" style={{ color }} />
            </div>
            <span className="text-[12px] font-semibold w-[76px] truncate th-label">{label}</span>
            <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: 'var(--color-surface-200)' }}>
                <div className="h-full rounded-full" style={{
                    width: `${score}%`, background: `linear-gradient(90deg, ${color}, ${color}cc)`,
                    transition: 'width 0.8s cubic-bezier(0.4, 0, 0.2, 1)',
                }} />
            </div>
            <span className="text-[12px] font-bold w-10 text-right tabular-nums" style={{ color }}>{score}%</span>
        </div>
    )
}

/* ── Funnel Step Card ── */
function FunnelStep({ label, value, color, emoji, rate, isLast }: {
    label: string; value: number; color: string; emoji: string; rate: number | null; isLast?: boolean
}) {
    return (
        <div className="flex items-center gap-2 flex-1 min-w-0">
            <div className="glass-card p-4 flex-1 text-center relative overflow-hidden group cursor-default" style={{
                borderColor: `${color}15`,
            }}>
                {/* Subtle gradient accent */}
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300" style={{
                    background: `radial-gradient(ellipse at center, ${color}08 0%, transparent 70%)`
                }} />
                <div className="relative">
                    <span className="text-lg mb-1 block">{emoji}</span>
                    <span className="text-[11px] font-semibold block mb-1.5 th-muted">{label}</span>
                    <span className="text-2xl font-black block leading-none" style={{ color }}>{value}</span>
                    {rate !== null && (
                        <span className="text-[10px] font-bold mt-2 inline-block px-2.5 py-0.5 rounded-full" style={{
                            background: `${color}12`, color
                        }}>
                            {rate}% conv.
                        </span>
                    )}
                </div>
            </div>
            {!isLast && (
                <ChevronRight className="w-4 h-4 flex-shrink-0 hidden md:block" style={{ color: 'var(--color-surface-300)' }} />
            )}
        </div>
    )
}

export default function RadarDashboard() {
    const [submissions, setSubmissions] = useState<RadarSubmission[]>([])
    const [loading, setLoading] = useState(true)
    const [funnelStats, setFunnelStats] = useState({ visits: 0, started: 0, finished: 0, leads: 0 })
    const [isResetting, setIsResetting] = useState(false)
    const [filter, setFilter] = useState<'all' | 'critical' | 'converted' | 'not_converted'>('all')
    const [search, setSearch] = useState('')
    const [copiedId, setCopiedId] = useState<string | null>(null)

    useEffect(() => {
        loadSubmissions()
        loadStats()
    }, [])

    async function loadStats() {
        try {
            const res = await fetch('/api/radar/stats')
            if (res.ok) setFunnelStats(await res.json())
        } catch (e) { console.error(e) }
    }

    async function resetTests() {
        if (!confirm('Sei sicuro di voler azzerare TUTTI i dati del radar (visite, test e lead generati dal quiz)? Questa azione non può essere annullata ed è utile solo in fase di test.')) return
        setIsResetting(true)
        try {
            await fetch('/api/radar/stats', { method: 'DELETE' })
            await loadSubmissions()
            await loadStats()
            alert('Dati di test azzerati con successo.')
        } catch (e) { console.error(e) }
        setIsResetting(false)
    }

    async function loadSubmissions() {
        setLoading(true)
        try {
            const res = await fetch('/api/radar/list')
            if (res.ok) {
                const data = await res.json()
                setSubmissions(data.submissions || [])
            }
        } catch (e) { console.error(e) }
        setLoading(false)
    }

    const copyLink = useCallback((partnerId?: string) => {
        const base = typeof window !== 'undefined' ? `${window.location.origin}/radar` : '/radar'
        const link = partnerId ? `${base}?p=${partnerId}` : base
        navigator.clipboard.writeText(link)
        setCopiedId(partnerId || 'base')
        setTimeout(() => setCopiedId(null), 2000)
    }, [])

    const filtered = submissions.filter(s => {
        if (filter === 'critical' && s.scores?.overall >= 50) return false
        if (filter === 'converted' && !s.converted) return false
        if (filter === 'not_converted' && s.converted) return false
        if (search) {
            const q = search.toLowerCase()
            return s.child_name?.toLowerCase().includes(q) ||
                s.parent_name?.toLowerCase().includes(q) ||
                s.parent_email?.toLowerCase().includes(q) ||
                s.partner_id?.toLowerCase().includes(q)
        }
        return true
    })

    const stats = {
        total: submissions.length,
        critical: submissions.filter(s => s.scores?.overall < 50).length,
        converted: submissions.filter(s => s.converted).length,
        fromPartners: submissions.filter(s => s.partner_id).length,
    }

    const funnelSteps = [
        { label: 'Visite', value: funnelStats.visits, color: '#38bdf8', emoji: '👁️', rate: null },
        { label: 'Quiz iniziati', value: funnelStats.started, color: '#a78bfa', emoji: '✍️', rate: funnelStats.visits > 0 ? Math.round((funnelStats.started / funnelStats.visits) * 100) : 0 },
        { label: 'Report visti', value: funnelStats.finished, color: '#fbbf24', emoji: '📊', rate: funnelStats.started > 0 ? Math.round((funnelStats.finished / funnelStats.started) * 100) : 0 },
        { label: 'Lead generati', value: funnelStats.leads, color: '#34d399', emoji: '✅', rate: funnelStats.finished > 0 ? Math.round((funnelStats.leads / funnelStats.finished) * 100) : 0 },
    ]

    const filterOptions = [
        { key: 'all' as const, label: 'Tutti', count: submissions.length },
        { key: 'critical' as const, label: 'Critici', count: stats.critical, dotColor: '#ef4444' },
        { key: 'not_converted' as const, label: 'Da contattare', count: submissions.length - stats.converted, dotColor: '#f59e0b' },
        { key: 'converted' as const, label: 'Convertiti', count: stats.converted, dotColor: '#22c55e' },
    ]

    return (
        <div className="space-y-6 animate-fade-in">
            {/* ── Header ── */}
            <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl flex items-center justify-center animate-pulse-glow" style={{
                        background: 'linear-gradient(135deg, var(--color-sincro-600), var(--color-sincro-700))',
                    }}>
                        <Activity className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black th-heading tracking-tight">Radar Sincro</h1>
                        <p className="text-sm th-muted mt-0.5">Analisi quiz · Lead generation · Performance</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={resetTests}
                        disabled={isResetting}
                        className="btn-secondary text-xs !py-2.5 !px-4"
                        style={{ color: 'var(--color-danger)', borderColor: 'rgba(239, 68, 68, 0.2)' }}
                    >
                        {isResetting ? 'Azzeramento...' : 'Azzera Dati Test'}
                    </button>
                    <button onClick={() => copyLink()} className="btn-primary text-sm !py-2.5">
                        {copiedId === 'base'
                            ? <><Check className="w-4 h-4" /> Copiato!</>
                            : <><Copy className="w-4 h-4" /> Copia Link Quiz</>
                        }
                    </button>
                </div>
            </div>

            {/* ── Quiz Link Banner ── */}
            <div className="glass-card p-5 flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-4">
                    <div className="w-11 h-11 rounded-xl flex items-center justify-center" style={{
                        background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.12), rgba(139, 92, 246, 0.08))',
                        border: '1px solid rgba(99, 102, 241, 0.15)',
                    }}>
                        <Brain className="w-5 h-5" style={{ color: 'var(--color-sincro-400)' }} />
                    </div>
                    <div>
                        <div className="text-sm font-bold th-heading">Il tuo Quiz &ldquo;Il Freno Invisibile&rdquo;</div>
                        <div className="text-xs font-mono mt-0.5 th-muted">
                            {typeof window !== 'undefined' ? `${window.location.origin}/radar` : '/radar'}
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => copyLink()}
                        className="btn-secondary text-xs !py-2 !px-3.5"
                    >
                        {copiedId === 'base'
                            ? <><Check className="w-3.5 h-3.5" style={{ color: 'var(--color-success)' }} /> Copiato!</>
                            : <><Copy className="w-3.5 h-3.5" /> Copia Link</>
                        }
                    </button>
                    <a href="/radar" target="_blank" rel="noopener noreferrer" className="btn-primary text-xs !py-2 !px-3.5">
                        <ExternalLink className="w-3.5 h-3.5" /> Apri Quiz
                    </a>
                </div>
            </div>

            {/* ── Funnel Performance ── */}
            <div className="glass-card p-6">
                <div className="flex items-center gap-2.5 mb-5">
                    <Zap className="w-4 h-4" style={{ color: 'var(--color-sincro-400)' }} />
                    <span className="text-sm font-bold th-heading">Performance Funnel</span>
                </div>
                <div className="flex flex-col md:flex-row gap-2">
                    {funnelSteps.map((step, i) => (
                        <FunnelStep key={step.label} {...step} isLast={i === funnelSteps.length - 1} />
                    ))}
                </div>
            </div>

            {/* ── KPI Cards ── */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                    { label: 'Quiz Completati', value: stats.total, icon: Brain, color: 'var(--color-sincro-400)', gradient: 'linear-gradient(135deg, rgba(99,102,241,0.08), rgba(139,92,246,0.04))' },
                    { label: 'Aree Critiche', value: stats.critical, icon: AlertTriangle, color: '#ef4444', gradient: 'linear-gradient(135deg, rgba(239,68,68,0.08), rgba(239,68,68,0.03))' },
                    { label: 'Da Partner', value: stats.fromPartners, icon: Users, color: '#22c55e', gradient: 'linear-gradient(135deg, rgba(34,197,94,0.08), rgba(34,197,94,0.03))' },
                    { label: 'Convertiti', value: stats.converted, icon: TrendingUp, color: '#f59e0b', gradient: 'linear-gradient(135deg, rgba(245,158,11,0.08), rgba(245,158,11,0.03))' },
                ].map(kpi => (
                    <div key={kpi.label} className="kpi-card relative overflow-hidden">
                        <div className="absolute inset-0 opacity-60" style={{ background: kpi.gradient }} />
                        <div className="relative">
                            <div className="flex items-center gap-2 mb-3">
                                <kpi.icon className="w-4 h-4" style={{ color: kpi.color }} />
                                <span className="text-xs font-semibold th-muted">{kpi.label}</span>
                            </div>
                            <div className="text-3xl font-black" style={{ color: kpi.color }}>{kpi.value}</div>
                        </div>
                    </div>
                ))}
            </div>

            {/* ── Filters + Search ── */}
            <div className="flex items-center gap-3 flex-wrap">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 th-muted" />
                    <input
                        type="text" value={search} onChange={e => setSearch(e.target.value)}
                        placeholder="Cerca per nome, email, partner..."
                        className="input pl-10"
                    />
                </div>
                <div className="flex gap-1.5">
                    {filterOptions.map(f => (
                        <button
                            key={f.key}
                            onClick={() => setFilter(f.key)}
                            className="px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"
                            style={{
                                background: filter === f.key ? 'rgba(99, 102, 241, 0.1)' : 'var(--color-surface-100)',
                                color: filter === f.key ? 'var(--color-sincro-400)' : 'var(--color-surface-500)',
                                border: `1px solid ${filter === f.key ? 'rgba(99, 102, 241, 0.25)' : 'var(--color-surface-200)'}`,
                            }}
                        >
                            {f.dotColor && <span className="w-1.5 h-1.5 rounded-full" style={{ background: f.dotColor }} />}
                            {f.label}
                            <span className="text-[10px] font-bold opacity-60">{f.count}</span>
                        </button>
                    ))}
                </div>
            </div>

            {/* ── Submissions List ── */}
            {loading ? (
                <div className="glass-card text-center py-20">
                    <div className="w-10 h-10 border-2 rounded-full animate-spin mx-auto mb-4"
                        style={{ borderColor: 'var(--color-surface-200)', borderTopColor: 'var(--color-sincro-500)' }} />
                    <p className="text-sm th-muted">Caricamento quiz...</p>
                </div>
            ) : filtered.length === 0 ? (
                <div className="glass-card text-center py-20">
                    <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5" style={{
                        background: 'var(--color-surface-100)', border: '1px solid var(--color-surface-200)',
                    }}>
                        <Brain className="w-7 h-7" style={{ color: 'var(--color-surface-400)' }} />
                    </div>
                    <h3 className="text-base font-bold th-heading mb-2">
                        {submissions.length === 0 ? 'Nessun quiz completato' : 'Nessun risultato'}
                    </h3>
                    <p className="text-sm th-muted max-w-sm mx-auto">
                        {submissions.length === 0
                            ? 'Condividi il link del Radar Sincro per iniziare a raccogliere lead qualificati.'
                            : 'Prova a cambiare i filtri o il termine di ricerca.'
                        }
                    </p>
                </div>
            ) : (
                <div className="space-y-3">
                    {filtered.map((sub, idx) => {
                        const score = sub.scores?.overall || 0
                        const date = new Date(sub.created_at)

                        return (
                            <div key={sub.id} className="glass-card p-5 group"
                                style={{ animationDelay: `${idx * 50}ms`, animation: 'fadeIn 0.4s ease-out both' }}
                            >
                                <div className="flex items-start gap-5">
                                    {/* Score Ring */}
                                    <ScoreRing score={score} />

                                    {/* Info */}
                                    <div className="flex-1 min-w-0">
                                        {/* Name + Badges */}
                                        <div className="flex items-center gap-2 flex-wrap mb-2">
                                            <h3 className="text-base font-bold th-heading">{sub.child_name}</h3>
                                            {sub.child_sport && (
                                                <span className="badge" style={{
                                                    background: 'rgba(99, 102, 241, 0.08)',
                                                    color: 'var(--color-sincro-400)',
                                                    border: '1px solid rgba(99, 102, 241, 0.15)',
                                                }}>
                                                    {sub.child_sport}
                                                </span>
                                            )}
                                            {sub.converted && (
                                                <span className="badge badge-success">
                                                    <CheckCircle className="w-3 h-3" /> Convertito
                                                </span>
                                            )}
                                            {sub.partner_id && (
                                                <span className="badge badge-warning">
                                                    🤝 {sub.partner_id}
                                                </span>
                                            )}
                                        </div>

                                        {/* Contact Info */}
                                        <div className="flex items-center gap-4 mb-4 flex-wrap">
                                            <span className="text-xs font-medium th-muted flex items-center gap-1.5">
                                                <Users className="w-3 h-3" /> {sub.parent_name}
                                            </span>
                                            <a href={`mailto:${sub.parent_email}`}
                                                className="text-xs font-medium flex items-center gap-1.5 th-muted hover:text-[var(--color-sincro-400)] transition-colors">
                                                <Mail className="w-3 h-3" /> {sub.parent_email}
                                            </a>
                                            {sub.parent_phone && (
                                                <a href={`tel:${sub.parent_phone}`}
                                                    className="text-xs font-medium flex items-center gap-1.5 th-muted hover:text-[var(--color-sincro-400)] transition-colors">
                                                    <Phone className="w-3 h-3" /> {sub.parent_phone}
                                                </a>
                                            )}
                                            <span className="text-[11px] th-muted">
                                                {date.toLocaleDateString('it-IT', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                        </div>

                                        {/* Score Bars */}
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2">
                                            <ScoreBar score={sub.scores?.fiducia || 0} label="Fiducia" icon={Shield} />
                                            <ScoreBar score={sub.scores?.pressione || 0} label="Pressione" icon={Target} />
                                            <ScoreBar score={sub.scores?.motivazione || 0} label="Motivazione" icon={Flame} />
                                            <ScoreBar score={sub.scores?.blocchi || 0} label="Blocchi" icon={Lock} />
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
