'use client'

import { useState, useEffect, useCallback } from 'react'
import {
    Activity, Brain, AlertTriangle, CheckCircle, ExternalLink,
    Mail, Phone, Search, TrendingUp, Users, Copy, Check,
    ArrowRight, Shield, Target, Flame, Lock, Zap, BarChart3
} from 'lucide-react'

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

/* ═══════════════════════════════════════════════
   ANIMATED SCORE RING — SVG donut chart
   ═══════════════════════════════════════════════ */
function ScoreRing({ score, size = 80 }: { score: number; size?: number }) {
    const strokeWidth = 5
    const radius = (size - strokeWidth * 2) / 2
    const circumference = 2 * Math.PI * radius
    const offset = circumference - (score / 100) * circumference
    const color = score >= 75 ? '#22c55e' : score >= 50 ? '#eab308' : '#ef4444'
    const label = score >= 75 ? 'BUONO' : score >= 50 ? 'MEDIO' : 'CRITICO'
    const glowColor = score >= 75 ? '34,197,94' : score >= 50 ? '234,179,8' : '239,68,68'

    return (
        <div className="relative flex-shrink-0 group" style={{ width: size, height: size }}>
            {/* Glow effect */}
            <div className="absolute inset-0 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                style={{ boxShadow: `0 0 30px rgba(${glowColor}, 0.25)` }} />
            <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
                {/* Background track */}
                <circle cx={size / 2} cy={size / 2} r={radius} fill="none"
                    stroke="var(--color-surface-200)" strokeWidth={strokeWidth} />
                {/* Score arc */}
                <circle cx={size / 2} cy={size / 2} r={radius} fill="none"
                    stroke={color} strokeWidth={strokeWidth} strokeLinecap="round"
                    strokeDasharray={circumference} strokeDashoffset={offset}
                    style={{ transition: 'stroke-dashoffset 1.2s cubic-bezier(0.4, 0, 0.2, 1)', filter: `drop-shadow(0 0 6px ${color}60)` }} />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-xl font-black leading-none tracking-tight" style={{ color }}>{score}<span className="text-xs">%</span></span>
                <span className="text-[8px] font-extrabold mt-1 tracking-[0.15em]" style={{ color: 'var(--color-surface-400)' }}>{label}</span>
            </div>
        </div>
    )
}

/* ═══════════════════════════════════════════════
   AREA SCORE BAR — compact bar with icon
   ═══════════════════════════════════════════════ */
function AreaBar({ score, label, icon: Icon }: { score: number; label: string; icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }> }) {
    const color = score >= 75 ? '#22c55e' : score >= 50 ? '#eab308' : '#ef4444'
    return (
        <div className="flex items-center gap-3 group/bar">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center transition-transform duration-200 group-hover/bar:scale-110"
                style={{ background: `${color}15`, border: `1px solid ${color}25` }}>
                <Icon className="w-3.5 h-3.5" style={{ color }} />
            </div>
            <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] font-bold th-label uppercase tracking-wider">{label}</span>
                    <span className="text-[12px] font-black tabular-nums" style={{ color }}>{score}%</span>
                </div>
                <div className="h-[6px] rounded-full overflow-hidden" style={{ background: 'var(--color-surface-200)' }}>
                    <div className="h-full rounded-full transition-all duration-[1s] ease-out"
                        style={{ width: `${score}%`, background: `linear-gradient(90deg, ${color}90, ${color})`, boxShadow: `0 0 8px ${color}40` }} />
                </div>
            </div>
        </div>
    )
}

/* ═══════════════════════════════════════════════
   MAIN DASHBOARD
   ═══════════════════════════════════════════════ */
export default function RadarDashboard() {
    const [submissions, setSubmissions] = useState<RadarSubmission[]>([])
    const [loading, setLoading] = useState(true)
    const [funnelStats, setFunnelStats] = useState({ visits: 0, started: 0, finished: 0, leads: 0 })
    const [isResetting, setIsResetting] = useState(false)
    const [filter, setFilter] = useState<'all' | 'critical' | 'converted' | 'not_converted'>('all')
    const [search, setSearch] = useState('')
    const [copiedId, setCopiedId] = useState<string | null>(null)
    const [expandedId, setExpandedId] = useState<string | null>(null)

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
        if (!confirm('Sei sicuro di voler azzerare TUTTI i dati del radar? Questa azione non può essere annullata.')) return
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

    /* ── Funnel conversion rates ── */
    const funnel = [
        { label: 'Visite', value: funnelStats.visits, icon: '👁️', color: '#38bdf8' },
        { label: 'Quiz iniziati', value: funnelStats.started, icon: '✍️', color: '#a78bfa' },
        { label: 'Report visti', value: funnelStats.finished, icon: '📊', color: '#fbbf24' },
        { label: 'Lead', value: funnelStats.leads, icon: '🎯', color: '#34d399' },
    ]

    const filterBtns = [
        { key: 'all' as const, label: 'Tutti', count: submissions.length },
        { key: 'critical' as const, label: 'Critici', count: stats.critical, dot: '#ef4444' },
        { key: 'not_converted' as const, label: 'Da contattare', count: submissions.length - stats.converted, dot: '#eab308' },
        { key: 'converted' as const, label: 'Convertiti', count: stats.converted, dot: '#22c55e' },
    ]

    return (
        <div className="animate-fade-in" style={{ maxWidth: 1100 }}>
            {/* ══════════════════════════════════════
               HERO HEADER — gradient banner
               ══════════════════════════════════════ */}
            <div style={{
                background: 'linear-gradient(135deg, var(--color-sincro-600) 0%, #7c3aed 50%, #a855f7 100%)',
                borderRadius: 20,
                padding: '32px 32px 28px',
                marginBottom: 24,
                position: 'relative',
                overflow: 'hidden',
            }}>
                {/* Decorative circles */}
                <div style={{
                    position: 'absolute', right: -40, top: -40, width: 200, height: 200,
                    borderRadius: '50%', background: 'rgba(255,255,255,0.06)',
                }} />
                <div style={{
                    position: 'absolute', right: 80, bottom: -60, width: 140, height: 140,
                    borderRadius: '50%', background: 'rgba(255,255,255,0.04)',
                }} />

                <div style={{ position: 'relative', zIndex: 1 }}>
                    <div className="flex items-center justify-between flex-wrap gap-4 mb-6">
                        <div className="flex items-center gap-4">
                            <div style={{
                                width: 48, height: 48, borderRadius: 14,
                                background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(10px)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}>
                                <Activity className="w-6 h-6 text-white" />
                            </div>
                            <div>
                                <h1 style={{ fontSize: 24, fontWeight: 900, color: '#fff', letterSpacing: '-0.02em' }}>
                                    Radar Sincro
                                </h1>
                                <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', marginTop: 2 }}>
                                    Quiz diagnostico · Lead qualificati · Analisi performance
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <button onClick={resetTests} disabled={isResetting}
                                style={{
                                    padding: '10px 16px', borderRadius: 12, fontSize: 12, fontWeight: 700,
                                    background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.8)',
                                    border: '1px solid rgba(255,255,255,0.15)', cursor: 'pointer',
                                    transition: 'all 0.2s',
                                }}
                                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.2)' }}
                                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)' }}
                            >
                                {isResetting ? 'Azzeramento...' : 'Azzera Test'}
                            </button>
                            <button onClick={() => copyLink()}
                                style={{
                                    padding: '10px 20px', borderRadius: 12, fontSize: 13, fontWeight: 700,
                                    background: '#fff', color: 'var(--color-sincro-700)',
                                    border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8,
                                    transition: 'all 0.2s', boxShadow: '0 4px 15px rgba(0,0,0,0.15)',
                                }}
                                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 25px rgba(0,0,0,0.2)' }}
                                onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '0 4px 15px rgba(0,0,0,0.15)' }}
                            >
                                {copiedId === 'base'
                                    ? <><Check className="w-4 h-4" /> Copiato!</>
                                    : <><Copy className="w-4 h-4" /> Copia Link Quiz</>
                                }
                            </button>
                        </div>
                    </div>

                    {/* Quiz URL bar inside hero */}
                    <div style={{
                        background: 'rgba(255,255,255,0.1)', backdropFilter: 'blur(10px)',
                        borderRadius: 14, padding: '14px 20px',
                        border: '1px solid rgba(255,255,255,0.12)',
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        flexWrap: 'wrap', gap: 12,
                    }}>
                        <div className="flex items-center gap-3">
                            <Brain className="w-5 h-5" style={{ color: 'rgba(255,255,255,0.7)' }} />
                            <div>
                                <div style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>Il Freno Invisibile</div>
                                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', fontFamily: 'monospace' }}>
                                    {typeof window !== 'undefined' ? `${window.location.origin}/radar` : 'landing.metodosincro.com/radar'}
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <button onClick={() => copyLink()} style={{
                                padding: '8px 14px', borderRadius: 10, fontSize: 11, fontWeight: 700,
                                background: 'rgba(255,255,255,0.15)', color: '#fff',
                                border: '1px solid rgba(255,255,255,0.2)', cursor: 'pointer',
                                display: 'flex', alignItems: 'center', gap: 6,
                            }}>
                                <Copy className="w-3.5 h-3.5" /> Copia
                            </button>
                            <a href="/radar" target="_blank" rel="noopener noreferrer" style={{
                                padding: '8px 14px', borderRadius: 10, fontSize: 11, fontWeight: 700,
                                background: '#fff', color: 'var(--color-sincro-700)',
                                textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 6,
                            }}>
                                <ExternalLink className="w-3.5 h-3.5" /> Apri
                            </a>
                        </div>
                    </div>
                </div>
            </div>

            {/* ══════════════════════════════════════
               FUNNEL — horizontal flow
               ══════════════════════════════════════ */}
            <div className="glass-card" style={{ padding: 24, marginBottom: 20 }}>
                <div className="flex items-center gap-2 mb-5">
                    <BarChart3 className="w-4 h-4" style={{ color: 'var(--color-sincro-400)' }} />
                    <span style={{ fontSize: 14, fontWeight: 800 }} className="th-heading">Funnel di Conversione</span>
                </div>

                <div style={{ display: 'flex', alignItems: 'stretch', gap: 0 }}>
                    {funnel.map((step, i) => {
                        const rate = i === 0 ? null :
                            funnel[i - 1].value > 0 ? Math.round((step.value / funnel[i - 1].value) * 100) : 0
                        const isLast = i === funnel.length - 1

                        return (
                            <div key={step.label} style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
                                <div style={{
                                    flex: 1, textAlign: 'center', padding: '20px 12px',
                                    borderRadius: 16,
                                    background: `linear-gradient(180deg, ${step.color}08 0%, ${step.color}03 100%)`,
                                    border: `1px solid ${step.color}18`,
                                    transition: 'all 0.3s ease',
                                    cursor: 'default',
                                    position: 'relative',
                                }}
                                    onMouseEnter={e => {
                                        e.currentTarget.style.background = `linear-gradient(180deg, ${step.color}15 0%, ${step.color}06 100%)`
                                        e.currentTarget.style.transform = 'translateY(-2px)'
                                        e.currentTarget.style.boxShadow = `0 8px 25px ${step.color}15`
                                    }}
                                    onMouseLeave={e => {
                                        e.currentTarget.style.background = `linear-gradient(180deg, ${step.color}08 0%, ${step.color}03 100%)`
                                        e.currentTarget.style.transform = ''
                                        e.currentTarget.style.boxShadow = ''
                                    }}
                                >
                                    <div style={{ fontSize: 24, marginBottom: 6 }}>{step.icon}</div>
                                    <div style={{ fontSize: 28, fontWeight: 900, color: step.color, lineHeight: 1 }}>{step.value}</div>
                                    <div style={{ fontSize: 11, fontWeight: 600, marginTop: 6 }} className="th-muted">{step.label}</div>
                                    {rate !== null && (
                                        <div style={{
                                            fontSize: 10, fontWeight: 800, marginTop: 8,
                                            padding: '3px 10px', borderRadius: 20,
                                            background: `${step.color}12`, color: step.color,
                                            display: 'inline-block',
                                        }}>
                                            {rate}% conv.
                                        </div>
                                    )}
                                </div>

                                {/* Arrow connector */}
                                {!isLast && (
                                    <div style={{
                                        width: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        flexShrink: 0,
                                    }}>
                                        <ArrowRight className="w-4 h-4" style={{ color: 'var(--color-surface-300)' }} />
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </div>
            </div>

            {/* ══════════════════════════════════════
               KPI GRID — 4 compact stat cards
               ══════════════════════════════════════ */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
                {[
                    { label: 'Quiz Completati', value: stats.total, icon: Brain, color: '#818cf8', bg: 'linear-gradient(135deg, #818cf815, #818cf808)' },
                    { label: 'Aree Critiche', value: stats.critical, icon: AlertTriangle, color: '#ef4444', bg: 'linear-gradient(135deg, #ef444415, #ef444408)' },
                    { label: 'Da Partner', value: stats.fromPartners, icon: Users, color: '#22c55e', bg: 'linear-gradient(135deg, #22c55e15, #22c55e08)' },
                    { label: 'Convertiti', value: stats.converted, icon: TrendingUp, color: '#eab308', bg: 'linear-gradient(135deg, #eab30815, #eab30808)' },
                ].map(kpi => (
                    <div key={kpi.label} className="glass-card" style={{
                        padding: '20px 18px', cursor: 'default', transition: 'all 0.3s ease',
                        background: kpi.bg,
                    }}>
                        <div className="flex items-center gap-2 mb-2">
                            <kpi.icon className="w-4 h-4" style={{ color: kpi.color }} />
                            <span style={{ fontSize: 11, fontWeight: 600 }} className="th-muted">{kpi.label}</span>
                        </div>
                        <div style={{ fontSize: 30, fontWeight: 900, color: kpi.color, lineHeight: 1 }}>{kpi.value}</div>
                    </div>
                ))}
            </div>

            {/* ══════════════════════════════════════
               SEARCH + FILTERS
               ══════════════════════════════════════ */}
            <div className="flex items-center gap-3 flex-wrap" style={{ marginBottom: 16 }}>
                <div style={{ position: 'relative', flex: 1, maxWidth: 340 }}>
                    <Search className="w-4 h-4" style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-surface-400)' }} />
                    <input
                        type="text" value={search} onChange={e => setSearch(e.target.value)}
                        placeholder="Cerca nome, email, partner..."
                        className="input"
                        style={{ paddingLeft: 40 }}
                    />
                </div>
                <div className="flex gap-1.5 flex-wrap">
                    {filterBtns.map(f => {
                        const active = filter === f.key
                        return (
                            <button key={f.key} onClick={() => setFilter(f.key)}
                                style={{
                                    padding: '9px 14px', borderRadius: 12, fontSize: 12, fontWeight: 700,
                                    background: active ? 'var(--color-sincro-600)' : 'var(--color-surface-100)',
                                    color: active ? '#fff' : 'var(--color-surface-500)',
                                    border: `1px solid ${active ? 'var(--color-sincro-500)' : 'var(--color-surface-200)'}`,
                                    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
                                    transition: 'all 0.2s',
                                }}
                            >
                                {f.dot && !active && <span style={{ width: 6, height: 6, borderRadius: '50%', background: f.dot }} />}
                                {f.label}
                                <span style={{
                                    fontSize: 10, fontWeight: 800,
                                    background: active ? 'rgba(255,255,255,0.2)' : 'var(--color-surface-200)',
                                    color: active ? '#fff' : 'var(--color-surface-500)',
                                    padding: '2px 7px', borderRadius: 8,
                                }}>{f.count}</span>
                            </button>
                        )
                    })}
                </div>
            </div>

            {/* ══════════════════════════════════════
               SUBMISSIONS LIST
               ══════════════════════════════════════ */}
            {loading ? (
                <div className="glass-card" style={{ textAlign: 'center', padding: '80px 20px' }}>
                    <div style={{
                        width: 44, height: 44, border: '3px solid var(--color-surface-200)',
                        borderTopColor: 'var(--color-sincro-500)', borderRadius: '50%',
                        margin: '0 auto 16px', animation: 'spin 0.8s linear infinite',
                    }} />
                    <p style={{ fontSize: 14, fontWeight: 600 }} className="th-muted">Caricamento risultati...</p>
                </div>
            ) : filtered.length === 0 ? (
                <div className="glass-card" style={{ textAlign: 'center', padding: '80px 20px' }}>
                    <div style={{
                        width: 72, height: 72, borderRadius: 20, margin: '0 auto 20px',
                        background: 'var(--color-surface-100)', border: '1px solid var(--color-surface-200)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                        <Brain className="w-8 h-8" style={{ color: 'var(--color-surface-300)' }} />
                    </div>
                    <h3 style={{ fontSize: 17, fontWeight: 800, marginBottom: 8 }} className="th-heading">
                        {submissions.length === 0 ? 'Nessun quiz completato' : 'Nessun risultato'}
                    </h3>
                    <p style={{ fontSize: 13, maxWidth: 360, margin: '0 auto' }} className="th-muted">
                        {submissions.length === 0
                            ? 'Condividi il link del quiz Radar Sincro per iniziare a generare lead qualificati.'
                            : 'Nessun risultato corrisponde ai filtri selezionati.'}
                    </p>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {filtered.map((sub, idx) => {
                        const score = sub.scores?.overall || 0
                        const date = new Date(sub.created_at)
                        const isExpanded = expandedId === sub.id

                        return (
                            <div key={sub.id} className="glass-card"
                                style={{
                                    padding: 0, overflow: 'hidden', cursor: 'pointer',
                                    animation: `fadeIn 0.4s ease-out ${idx * 60}ms both`,
                                }}
                                onClick={() => setExpandedId(isExpanded ? null : sub.id)}
                            >
                                {/* Main row */}
                                <div style={{ padding: '20px 24px', display: 'flex', alignItems: 'center', gap: 20 }}>
                                    {/* Score ring */}
                                    <ScoreRing score={score} />

                                    {/* Center info */}
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div className="flex items-center gap-2 flex-wrap" style={{ marginBottom: 6 }}>
                                            <span style={{ fontSize: 16, fontWeight: 800 }} className="th-heading">{sub.child_name}</span>
                                            {sub.child_sport && (
                                                <span className="badge" style={{
                                                    background: 'var(--color-sincro-600)15', color: 'var(--color-sincro-400)',
                                                    border: '1px solid rgba(99,102,241,0.15)', fontSize: 11,
                                                }}>
                                                    {sub.child_sport}
                                                </span>
                                            )}
                                            {sub.converted && (
                                                <span className="badge badge-success" style={{ fontSize: 11 }}>
                                                    <CheckCircle className="w-3 h-3" /> Convertito
                                                </span>
                                            )}
                                            {sub.partner_id && (
                                                <span className="badge badge-warning" style={{ fontSize: 11 }}>🤝 {sub.partner_id}</span>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-4 flex-wrap">
                                            <span style={{ fontSize: 12, fontWeight: 500 }} className="th-muted flex items-center gap-1.5">
                                                <Users className="w-3 h-3" /> {sub.parent_name}
                                            </span>
                                            <a href={`mailto:${sub.parent_email}`} onClick={e => e.stopPropagation()}
                                                style={{ fontSize: 12, fontWeight: 500, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 5 }}
                                                className="th-muted hover:text-[var(--color-sincro-400)] transition-colors">
                                                <Mail className="w-3 h-3" /> {sub.parent_email}
                                            </a>
                                            {sub.parent_phone && (
                                                <a href={`tel:${sub.parent_phone}`} onClick={e => e.stopPropagation()}
                                                    style={{ fontSize: 12, fontWeight: 500, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 5 }}
                                                    className="th-muted hover:text-[var(--color-sincro-400)] transition-colors">
                                                    <Phone className="w-3 h-3" /> {sub.parent_phone}
                                                </a>
                                            )}
                                        </div>
                                    </div>

                                    {/* Date + expand hint */}
                                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                        <div style={{ fontSize: 12, fontWeight: 600 }} className="th-muted">
                                            {date.toLocaleDateString('it-IT', { day: '2-digit', month: 'short' })}
                                        </div>
                                        <div style={{ fontSize: 11 }} className="th-muted">
                                            {date.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
                                        </div>
                                        <div style={{
                                            fontSize: 10, fontWeight: 700, marginTop: 6,
                                            color: 'var(--color-sincro-400)',
                                            transform: isExpanded ? 'rotate(90deg)' : '',
                                            transition: 'transform 0.2s',
                                            display: 'inline-block',
                                        }}>▶</div>
                                    </div>
                                </div>

                                {/* Expandable detail */}
                                <div style={{
                                    maxHeight: isExpanded ? 200 : 0, overflow: 'hidden',
                                    transition: 'max-height 0.35s cubic-bezier(0.4, 0, 0.2, 1)',
                                }}>
                                    <div style={{
                                        padding: '0 24px 24px',
                                        borderTop: '1px solid var(--glass-border)',
                                        paddingTop: 20,
                                    }}>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px 32px' }}>
                                            <AreaBar score={sub.scores?.fiducia || 0} label="Fiducia" icon={Shield} />
                                            <AreaBar score={sub.scores?.pressione || 0} label="Pressione" icon={Target} />
                                            <AreaBar score={sub.scores?.motivazione || 0} label="Motivazione" icon={Flame} />
                                            <AreaBar score={sub.scores?.blocchi || 0} label="Blocchi" icon={Lock} />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}

            {/* Inline animation keyframe */}
            <style>{`
                @keyframes spin { to { transform: rotate(360deg); } }
            `}</style>
        </div>
    )
}
