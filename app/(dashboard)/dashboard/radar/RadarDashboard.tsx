'use client'

import { useState, useEffect } from 'react'
import { Activity, Brain, AlertTriangle, CheckCircle, ExternalLink, Mail, Phone, Search, Filter, TrendingUp, Users, Copy, Check } from 'lucide-react'

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

export default function RadarDashboard() {
    const [submissions, setSubmissions] = useState<RadarSubmission[]>([])
    const [loading, setLoading] = useState(true)
    const [filter, setFilter] = useState<'all' | 'critical' | 'converted' | 'not_converted'>('all')
    const [search, setSearch] = useState('')
    const [copiedId, setCopiedId] = useState<string | null>(null)

    useEffect(() => { loadSubmissions() }, [])

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

    function copyLink(partnerId?: string) {
        const base = `${window.location.origin}/radar`
        const link = partnerId ? `${base}?p=${partnerId}` : base
        navigator.clipboard.writeText(link)
        setCopiedId(partnerId || 'base')
        setTimeout(() => setCopiedId(null), 2000)
    }

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

    function ScoreBar({ score, label }: { score: number; label: string }) {
        const color = score >= 75 ? '#22c55e' : score >= 50 ? '#f59e0b' : '#ef4444'
        return (
            <div className="flex items-center gap-2">
                <span className="text-[11px] font-medium w-20 truncate" style={{ color: '#71717a' }}>{label}</span>
                <div className="flex-1 h-1.5 rounded-full" style={{ background: '#1f1f23' }}>
                    <div className="h-full rounded-full transition-all" style={{ width: `${score}%`, background: color }} />
                </div>
                <span className="text-[11px] font-bold w-8 text-right" style={{ color }}>{score}%</span>
            </div>
        )
    }

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                    <h1 className="text-2xl font-black text-white flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(99, 102, 241, 0.1)', border: '1px solid rgba(99, 102, 241, 0.2)' }}>
                            <Activity className="w-5 h-5" style={{ color: '#818cf8' }} />
                        </div>
                        Radar Sincro
                    </h1>
                    <p className="text-sm mt-1" style={{ color: '#71717a' }}>
                        Quiz completati · Lead generati · Risultati
                    </p>
                </div>
                <button
                    onClick={() => copyLink()}
                    className="btn-primary text-sm"
                >
                    {copiedId === 'base' ? <><Check className="w-4 h-4" /> Copiato!</> : <><Copy className="w-4 h-4" /> Copia Link Quiz</>}
                </button>
            </div>

            {/* Quiz Link Banner */}
            <div className="rounded-2xl p-5 flex items-center justify-between flex-wrap gap-4" style={{
                background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.08), rgba(139, 92, 246, 0.05))',
                border: '1px solid rgba(99, 102, 241, 0.15)',
            }}>
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: 'rgba(99, 102, 241, 0.15)', border: '1px solid rgba(99, 102, 241, 0.25)' }}>
                        <Brain className="w-6 h-6" style={{ color: '#818cf8' }} />
                    </div>
                    <div>
                        <div className="text-sm font-bold text-white">Il tuo Quiz "Il Freno Invisibile"</div>
                        <div className="text-xs font-mono mt-0.5" style={{ color: '#71717a' }}>
                            {typeof window !== 'undefined' ? `${window.location.origin}/radar` : '/radar'}
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => copyLink()}
                        className="px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2"
                        style={{
                            background: copiedId === 'base' ? 'rgba(34, 197, 94, 0.15)' : 'rgba(99, 102, 241, 0.1)',
                            color: copiedId === 'base' ? '#22c55e' : '#818cf8',
                            border: `1px solid ${copiedId === 'base' ? 'rgba(34, 197, 94, 0.3)' : 'rgba(99, 102, 241, 0.2)'}`,
                        }}
                    >
                        {copiedId === 'base' ? <><Check className="w-3.5 h-3.5" /> Copiato!</> : <><Copy className="w-3.5 h-3.5" /> Copia Link</>}
                    </button>
                    <a
                        href="/radar"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 hover:translate-y-[-2px]"
                        style={{
                            background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                            color: 'white',
                            boxShadow: '0 0 20px rgba(99, 102, 241, 0.2)',
                        }}
                    >
                        <ExternalLink className="w-3.5 h-3.5" /> Apri Quiz
                    </a>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                    { label: 'Quiz Completati', value: stats.total, icon: Brain, color: '#818cf8' },
                    { label: 'Aree Critiche', value: stats.critical, icon: AlertTriangle, color: '#ef4444' },
                    { label: 'Da Partner', value: stats.fromPartners, icon: Users, color: '#22c55e' },
                    { label: 'Convertiti', value: stats.converted, icon: TrendingUp, color: '#f59e0b' },
                ].map(kpi => (
                    <div key={kpi.label} className="kpi-card">
                        <div className="flex items-center gap-2 mb-3">
                            <kpi.icon className="w-4 h-4" style={{ color: kpi.color }} />
                            <span className="text-xs font-medium" style={{ color: '#71717a' }}>{kpi.label}</span>
                        </div>
                        <div className="text-3xl font-black" style={{ color: kpi.color }}>{kpi.value}</div>
                    </div>
                ))}
            </div>

            {/* Filters + Search */}
            <div className="flex items-center gap-3 flex-wrap">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: '#52525b' }} />
                    <input
                        type="text" value={search} onChange={e => setSearch(e.target.value)}
                        placeholder="Cerca per nome, email, partner..."
                        className="input pl-10"
                    />
                </div>
                <div className="flex gap-1.5">
                    {[
                        { key: 'all', label: 'Tutti' },
                        { key: 'critical', label: '🔴 Critici' },
                        { key: 'not_converted', label: 'Da contattare' },
                        { key: 'converted', label: '✅ Convertiti' },
                    ].map(f => (
                        <button
                            key={f.key}
                            onClick={() => setFilter(f.key as any)}
                            className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
                            style={{
                                background: filter === f.key ? 'rgba(99, 102, 241, 0.15)' : 'rgba(15, 15, 19, 0.6)',
                                color: filter === f.key ? '#818cf8' : '#71717a',
                                border: `1px solid ${filter === f.key ? 'rgba(99, 102, 241, 0.3)' : 'rgba(99, 102, 241, 0.08)'}`,
                            }}
                        >
                            {f.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Submissions List */}
            {loading ? (
                <div className="text-center py-16">
                    <div className="w-8 h-8 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin mx-auto mb-3" />
                    <p className="text-sm" style={{ color: '#71717a' }}>Caricamento quiz...</p>
                </div>
            ) : filtered.length === 0 ? (
                <div className="text-center py-16 glass-card">
                    <Brain className="w-12 h-12 mx-auto mb-4" style={{ color: '#3f3f46' }} />
                    <h3 className="text-lg font-bold text-white mb-2">
                        {submissions.length === 0 ? 'Nessun quiz completato' : 'Nessun risultato per questo filtro'}
                    </h3>
                    <p className="text-sm" style={{ color: '#71717a' }}>
                        {submissions.length === 0
                            ? 'Condividi il link del Radar Sincro per iniziare a raccogliere lead.'
                            : 'Prova a cambiare i filtri di ricerca.'
                        }
                    </p>
                </div>
            ) : (
                <div className="space-y-3">
                    {filtered.map(sub => {
                        const score = sub.scores?.overall || 0
                        const scoreColor = score >= 75 ? '#22c55e' : score >= 50 ? '#f59e0b' : '#ef4444'
                        const scoreLabel = score >= 75 ? 'Buono' : score >= 50 ? 'Attenzione' : 'Critico'
                        const date = new Date(sub.created_at)

                        return (
                            <div key={sub.id} className="glass-card p-5 group" style={{ transition: 'all 0.2s' }}>
                                <div className="flex items-start gap-5">
                                    {/* Score Circle */}
                                    <div className="w-16 h-16 rounded-2xl flex flex-col items-center justify-center flex-shrink-0"
                                        style={{ background: `${scoreColor}12`, border: `1px solid ${scoreColor}30` }}
                                    >
                                        <span className="text-xl font-black" style={{ color: scoreColor }}>{score}%</span>
                                        <span className="text-[9px] font-bold" style={{ color: scoreColor }}>{scoreLabel}</span>
                                    </div>

                                    {/* Info */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-3 mb-1">
                                            <h3 className="text-base font-bold text-white">{sub.child_name}</h3>
                                            {sub.child_sport && (
                                                <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(99, 102, 241, 0.1)', color: '#818cf8' }}>
                                                    {sub.child_sport}
                                                </span>
                                            )}
                                            {sub.converted && (
                                                <span className="text-xs px-2 py-0.5 rounded-full font-bold" style={{ background: 'rgba(34, 197, 94, 0.1)', color: '#22c55e', border: '1px solid rgba(34, 197, 94, 0.2)' }}>
                                                    ✅ Convertito
                                                </span>
                                            )}
                                            {sub.partner_id && (
                                                <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b' }}>
                                                    🤝 {sub.partner_id}
                                                </span>
                                            )}
                                        </div>

                                        <div className="flex items-center gap-4 mb-3 text-xs" style={{ color: '#71717a' }}>
                                            <span>👤 {sub.parent_name}</span>
                                            <a href={`mailto:${sub.parent_email}`} className="flex items-center gap-1 hover:text-indigo-400 transition-colors">
                                                <Mail className="w-3 h-3" /> {sub.parent_email}
                                            </a>
                                            {sub.parent_phone && (
                                                <a href={`tel:${sub.parent_phone}`} className="flex items-center gap-1 hover:text-indigo-400 transition-colors">
                                                    <Phone className="w-3 h-3" /> {sub.parent_phone}
                                                </a>
                                            )}
                                            <span>{date.toLocaleDateString('it-IT', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                                        </div>

                                        {/* Score Bars */}
                                        <div className="grid grid-cols-2 gap-x-6 gap-y-1.5">
                                            <ScoreBar score={sub.scores?.fiducia || 0} label="Fiducia" />
                                            <ScoreBar score={sub.scores?.pressione || 0} label="Pressione" />
                                            <ScoreBar score={sub.scores?.motivazione || 0} label="Motivazione" />
                                            <ScoreBar score={sub.scores?.blocchi || 0} label="Blocchi" />
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
