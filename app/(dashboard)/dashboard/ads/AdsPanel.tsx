'use client'

import { Megaphone, TrendingUp, DollarSign, Eye, MousePointerClick, Target, AlertTriangle, Plug, Zap, Play, Pause, ToggleLeft, ToggleRight, Brain, Lightbulb, ArrowRight, Flame } from 'lucide-react'
import Link from 'next/link'
import DateRangeFilter, { useDateRange, filterByDateRange } from '@/components/DateRangeFilter'

interface Campaign {
    id: string
    campaign_name?: string
    status?: string
    objective?: string
    daily_budget?: number
    spend?: number
    impressions?: number
    clicks?: number
    leads_count?: number
    cpl?: number
    cpc?: number
    ctr?: number
    conversions?: number
    roas?: number
    synced_at?: string
}

interface Rule {
    id: string
    name: string
    description?: string
    is_active: boolean
    conditions: any
    actions: any
}

interface Connection {
    id: string
    provider: string
    status: string
}

interface Recommendation {
    id: string
    recommendation_type: string
    priority: string
    title: string
    description?: string
    status: string
    impact_estimate?: any
}

interface Props {
    campaigns: Campaign[]
    rules: Rule[]
    connections: Connection[]
    recommendations: Recommendation[]
}

export default function AdsPanel({ campaigns: allCampaigns, rules, connections, recommendations }: Props) {
    const hasMetaAds = connections.some(c => c.provider === 'meta_ads' && c.status === 'active')
    const hasMetaCapi = connections.some(c => c.provider === 'meta_capi' && c.status === 'active')
    const { range, activeKey, setActiveKey, customFrom, setCustomFrom, customTo, setCustomTo } = useDateRange('all')
    const campaigns = filterByDateRange(allCampaigns, range, 'synced_at' as any)

    const totalSpend = campaigns.reduce((s, c) => s + (Number(c.spend) || 0), 0)
    const totalLeads = campaigns.reduce((s, c) => s + (Number(c.leads_count) || 0), 0)
    const totalClicks = campaigns.reduce((s, c) => s + (Number(c.clicks) || 0), 0)
    const avgCPL = totalLeads > 0 ? totalSpend / totalLeads : 0
    const avgCTR = campaigns.length > 0
        ? campaigns.reduce((s, c) => s + (Number(c.ctr) || 0), 0) / campaigns.length : 0

    const formatCurrency = (v: number) =>
        new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(v)

    const formatNumber = (v: number) =>
        new Intl.NumberFormat('it-IT').format(v)

    // No connections yet
    if (!hasMetaAds && !hasMetaCapi) {
        return (
            <div className="space-y-6 animate-fade-in">
                <div>
                    <h1 className="text-2xl font-bold text-white flex items-center gap-3">
                        <Megaphone className="w-6 h-6" style={{ color: '#f59e0b' }} />
                        Ads
                    </h1>
                    <p className="text-sm mt-1" style={{ color: 'var(--color-surface-600)' }}>
                        Campagne Meta Ads, performance e regole automatiche
                    </p>
                </div>

                <div className="glass-card p-8 text-center">
                    <div className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center" style={{ background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.2)' }}>
                        <Plug className="w-8 h-8" style={{ color: '#f59e0b' }} />
                    </div>
                    <h2 className="text-lg font-bold text-white mb-2">Connetti Meta Ads</h2>
                    <p className="text-sm mb-6 max-w-md mx-auto" style={{ color: 'var(--color-surface-500)' }}>
                        Per visualizzare le campagne e gestire le regole automatiche, collegare prima Meta Ads e Meta CAPI nella sezione Connessioni.
                    </p>
                    <Link href="/dashboard/connections" className="btn-primary">
                        <Plug className="w-4 h-4" /> Vai a Connessioni
                    </Link>
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex items-center justify-between gap-4 flex-wrap">
                <div>
                    <h1 className="text-2xl font-bold text-white flex items-center gap-3">
                        <Megaphone className="w-6 h-6" style={{ color: '#f59e0b' }} />
                        Ads
                    </h1>
                    <p className="text-sm mt-1" style={{ color: 'var(--color-surface-600)' }}>
                        Campagne Meta Ads, performance e regole automatiche
                    </p>
                </div>
                <DateRangeFilter activeKey={activeKey} onSelect={setActiveKey}
                    customFrom={customFrom} customTo={customTo}
                    onCustomFromChange={setCustomFrom} onCustomToChange={setCustomTo} />
            </div>

            {/* Connection Status */}
            <div className="flex gap-3 flex-wrap">
                <div className={`badge ${hasMetaAds ? 'badge-success' : 'badge-warning'}`}>
                    {hasMetaAds ? '✓' : '⚠'} Meta Ads
                </div>
                <div className={`badge ${hasMetaCapi ? 'badge-success' : 'badge-warning'}`}>
                    {hasMetaCapi ? '✓' : '⚠'} Meta CAPI
                </div>
            </div>

            {/* KPI Summary */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                    { label: 'Spesa Totale', value: formatCurrency(totalSpend), icon: DollarSign, color: '#ef4444' },
                    { label: 'Lead Generati', value: formatNumber(totalLeads), icon: Target, color: '#3b82f6' },
                    { label: 'CPL Medio', value: formatCurrency(avgCPL), icon: TrendingUp, color: '#f59e0b' },
                    { label: 'Click Totali', value: formatNumber(totalClicks), icon: MousePointerClick, color: '#8b5cf6' },
                ].map(kpi => (
                    <div key={kpi.label} className="kpi-card">
                        <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-3" style={{ background: `${kpi.color}15`, border: `1px solid ${kpi.color}30` }}>
                            <kpi.icon className="w-4 h-4" style={{ color: kpi.color }} />
                        </div>
                        <div className="text-xl font-bold text-white">{kpi.value}</div>
                        <div className="text-xs mt-1" style={{ color: 'var(--color-surface-500)' }}>{kpi.label}</div>
                    </div>
                ))}
            </div>

            {/* Campaigns */}
            <div className="glass-card overflow-hidden">
                <div className="p-4 border-b" style={{ borderColor: 'var(--color-surface-200)' }}>
                    <h3 className="text-sm font-bold text-white">Campagne ({campaigns.length})</h3>
                </div>
                {campaigns.length > 0 ? (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr style={{ borderBottom: '1px solid var(--color-surface-200)' }}>
                                    {['Campagna', 'Status', 'Spesa', 'Impression', 'Click', 'CTR', 'Lead', 'CPL', 'ROAS'].map(h => (
                                        <th key={h} className="text-left px-4 py-3 text-[11px] uppercase tracking-wider font-semibold" style={{ color: 'var(--color-surface-500)' }}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {campaigns.map(c => (
                                    <tr key={c.id} className="hover:bg-white/[0.02] transition-colors" style={{ borderBottom: '1px solid var(--color-surface-200)' }}>
                                        <td className="px-4 py-3 text-sm font-semibold text-white max-w-[200px] truncate">{c.campaign_name || '—'}</td>
                                        <td className="px-4 py-3">
                                            <span className={`badge ${c.status === 'ACTIVE' ? 'badge-success' : c.status === 'PAUSED' ? 'badge-warning' : 'badge-info'}`} style={{ fontSize: '10px' }}>
                                                {c.status === 'ACTIVE' ? <Play className="w-2.5 h-2.5" /> : <Pause className="w-2.5 h-2.5" />}
                                                {c.status || '—'}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-sm" style={{ color: 'var(--color-surface-700)' }}>{c.spend ? formatCurrency(Number(c.spend)) : '—'}</td>
                                        <td className="px-4 py-3 text-sm" style={{ color: 'var(--color-surface-700)' }}>{c.impressions ? formatNumber(Number(c.impressions)) : '—'}</td>
                                        <td className="px-4 py-3 text-sm" style={{ color: 'var(--color-surface-700)' }}>{c.clicks ? formatNumber(Number(c.clicks)) : '—'}</td>
                                        <td className="px-4 py-3 text-sm" style={{ color: 'var(--color-surface-700)' }}>{c.ctr ? `${Number(c.ctr).toFixed(2)}%` : '—'}</td>
                                        <td className="px-4 py-3 text-sm font-semibold" style={{ color: '#3b82f6' }}>{c.leads_count || '—'}</td>
                                        <td className="px-4 py-3 text-sm font-semibold" style={{ color: '#f59e0b' }}>{c.cpl ? formatCurrency(Number(c.cpl)) : '—'}</td>
                                        <td className="px-4 py-3 text-sm font-semibold" style={{ color: '#22c55e' }}>{c.roas ? `${Number(c.roas).toFixed(2)}x` : '—'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="p-8 text-center">
                        <p className="text-sm" style={{ color: 'var(--color-surface-500)' }}>Nessuna campagna sincronizzata. I dati appariranno dopo il primo sync con Meta.</p>
                    </div>
                )}
            </div>

            {/* Automated Rules */}
            <div className="glass-card p-5">
                <div className="flex items-center gap-2 mb-4">
                    <Zap className="w-4 h-4" style={{ color: '#f59e0b' }} />
                    <h3 className="text-sm font-bold text-white">Regole Automatiche ({rules.length})</h3>
                </div>
                {rules.length > 0 ? (
                    <div className="space-y-3">
                        {rules.map(rule => (
                            <div key={rule.id} className="flex items-center gap-4 p-3 rounded-xl" style={{ background: 'var(--color-surface-100)', border: '1px solid var(--color-surface-200)' }}>
                                {rule.is_active ? (
                                    <ToggleRight className="w-5 h-5 flex-shrink-0" style={{ color: '#22c55e' }} />
                                ) : (
                                    <ToggleLeft className="w-5 h-5 flex-shrink-0" style={{ color: 'var(--color-surface-500)' }} />
                                )}
                                <div className="flex-1 min-w-0">
                                    <div className="text-sm font-semibold text-white">{rule.name}</div>
                                    {rule.description && (
                                        <div className="text-xs mt-0.5" style={{ color: 'var(--color-surface-500)' }}>{rule.description}</div>
                                    )}
                                </div>
                                <span className={`badge ${rule.is_active ? 'badge-success' : ''}`} style={!rule.is_active ? { background: 'var(--color-surface-200)', color: 'var(--color-surface-500)', border: '1px solid var(--color-surface-300)' } : undefined}>
                                    {rule.is_active ? 'Attiva' : 'Inattiva'}
                                </span>
                            </div>
                        ))}
                    </div>
                ) : (
                    <p className="text-xs text-center py-4" style={{ color: 'var(--color-surface-500)' }}>Nessuna regola configurata. Saranno disponibili dopo il collegamento Meta Ads.</p>
                )}
            </div>

            {/* AI Advisor */}
            {recommendations.length > 0 && (
                <div className="glass-card p-5">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(168, 85, 247, 0.15)', border: '1px solid rgba(168, 85, 247, 0.3)' }}>
                                <Brain className="w-4 h-4" style={{ color: '#a855f7' }} />
                            </div>
                            <h3 className="text-sm font-bold text-white">AI Advisor</h3>
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: 'rgba(168, 85, 247, 0.15)', color: '#a855f7' }}>SMART</span>
                        </div>
                        <Link href="/dashboard/ai-engine" className="text-xs flex items-center gap-1 hover:underline" style={{ color: 'var(--color-surface-500)' }}>
                            AI Engine <ArrowRight className="w-3 h-3" />
                        </Link>
                    </div>
                    <div className="space-y-2">
                        {recommendations.slice(0, 3).map(rec => {
                            const priorityColors: Record<string, string> = {
                                critical: '#ef4444', high: '#f59e0b', medium: '#3b82f6', low: '#22c55e',
                            }
                            const pColor = priorityColors[rec.priority] || '#3b82f6'
                            return (
                                <div key={rec.id} className="flex items-start gap-3 p-3 rounded-xl" style={{
                                    background: `${pColor}08`, border: `1px solid ${pColor}20`,
                                }}>
                                    <Lightbulb className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: pColor }} />
                                    <div className="flex-1 min-w-0">
                                        <div className="text-xs font-semibold text-white">{rec.title}</div>
                                        {rec.description && (
                                            <div className="text-[11px] mt-0.5 line-clamp-2" style={{ color: 'var(--color-surface-500)' }}>{rec.description}</div>
                                        )}
                                    </div>
                                    <span className="badge flex-shrink-0" style={{
                                        fontSize: '9px', background: `${pColor}15`, color: pColor, border: `1px solid ${pColor}30`,
                                    }}>{rec.priority === 'critical' ? '🔥' : rec.priority === 'high' ? '⚠️' : '💡'} {rec.priority}</span>
                                </div>
                            )
                        })}
                    </div>
                    <Link href="/dashboard/ai-engine" className="flex items-center justify-center gap-1 text-xs mt-3 py-2 rounded-xl transition-colors hover:bg-white/[0.03]" style={{ color: '#a855f7' }}>
                        Vedi tutti i consigli AI <ArrowRight className="w-3 h-3" />
                    </Link>
                </div>
            )}
        </div>
    )
}
