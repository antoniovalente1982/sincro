'use client'

import { useState, useMemo, useEffect, useCallback } from 'react'
import { Megaphone, TrendingUp, DollarSign, Eye, MousePointerClick, Target, Plug, Zap, Play, Pause, ToggleLeft, ToggleRight, Brain, Lightbulb, ArrowRight, RefreshCw, ChevronUp, ChevronDown, ChevronsUpDown, ArrowUpDown, Loader2 } from 'lucide-react'
import Link from 'next/link'
import DateRangeFilter, { useDateRange, filterByDateRange } from '@/components/DateRangeFilter'
import { createClient } from '@/lib/supabase/client'

interface Campaign {
    id: string
    campaign_name?: string
    status?: string
    objective?: string
    daily_budget?: number
    spend?: number
    impressions?: number
    clicks?: number
    link_clicks?: number
    link_click_ctr?: number
    leads_count?: number
    cpl?: number
    cpc?: number
    ctr?: number
    conversions?: number
    roas?: number
    synced_at?: string
    date_range_start?: string
    date_range_end?: string
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

type SortKey = 'status' | 'spend' | 'impressions' | 'clicks' | 'link_clicks' | 'ctr' | 'leads_count' | 'cpl' | 'roas'
type SortDir = 'asc' | 'desc'

export default function AdsPanel({ campaigns: cachedCampaigns, rules, connections, recommendations }: Props) {
    const hasMetaAds = connections.some(c => c.provider === 'meta_ads' && c.status === 'active')
    const hasMetaCapi = connections.some(c => c.provider === 'meta_capi' && c.status === 'active')
    const { range, activeKey, setActiveKey, customFrom, setCustomFrom, customTo, setCustomTo } = useDateRange('today')
    const [syncing, setSyncing] = useState(false)
    const [loadingInsights, setLoadingInsights] = useState(false)
    const [lastSync, setLastSync] = useState<string | null>(null)
    const [sortKey, setSortKey] = useState<SortKey>('status')
    const [sortDir, setSortDir] = useState<SortDir>('desc')
    const [liveCampaigns, setLiveCampaigns] = useState<Campaign[] | null>(null)
    const [liveError, setLiveError] = useState<string | null>(null)

    // When user changes period (not "Tutto"), fetch live data from Meta
    const fetchLiveInsights = useCallback(async (since: string, until: string) => {
        setLoadingInsights(true)
        setLiveError(null)
        try {
            const supabase = createClient()
            const { data: { session } } = await supabase.auth.getSession()
            const res = await fetch(`/api/meta/insights?since=${since}&until=${until}`, {
                headers: { Authorization: `Bearer ${session?.access_token}` },
            })
            const data = await res.json()
            if (data.success && data.campaigns) {
                setLiveCampaigns(data.campaigns)
                setLastSync(new Date().toLocaleTimeString('it-IT'))
            } else {
                setLiveError(data.error || 'Errore nel caricamento')
                setLiveCampaigns(null)
            }
        } catch (e: any) {
            setLiveError(e.message || 'Errore di connessione')
            setLiveCampaigns(null)
        } finally {
            setLoadingInsights(false)
        }
    }, [])

    // Format date as YYYY-MM-DD in LOCAL timezone (not UTC!)
    // toISOString() converts to UTC which shifts dates back for CET/CEST users
    const formatLocalDate = (d: Date) => {
        const y = d.getFullYear()
        const m = String(d.getMonth() + 1).padStart(2, '0')
        const day = String(d.getDate()).padStart(2, '0')
        return `${y}-${m}-${day}`
    }

    // Auto-fetch when period changes
    useEffect(() => {
        if (activeKey === 'all') {
            setLiveCampaigns(null) // Use cached data for "Tutto"
            setLiveError(null)
            return
        }
        const since = formatLocalDate(range.from)
        // range.to is exclusive (next day midnight), so subtract 1 day for inclusive end
        const untilDate = new Date(range.to.getTime() - 24 * 60 * 60 * 1000)
        const until = formatLocalDate(untilDate)
        fetchLiveInsights(since, until)
    }, [activeKey, range.from.getTime(), range.to.getTime(), fetchLiveInsights])

    // Use live data when available, otherwise cached
    const campaigns = liveCampaigns || cachedCampaigns

    // Sort campaigns: ACTIVE first, then by selected sort key
    const sortedCampaigns = useMemo(() => {
        return [...campaigns].sort((a, b) => {
            // Active campaigns always first
            const aActive = a.status === 'ACTIVE' ? 1 : 0
            const bActive = b.status === 'ACTIVE' ? 1 : 0
            if (aActive !== bActive) return bActive - aActive

            // Among same-status campaigns — those with spend above those without
            const aHasSpend = (Number(a.spend) || 0) > 0 ? 1 : 0
            const bHasSpend = (Number(b.spend) || 0) > 0 ? 1 : 0
            if (aHasSpend !== bHasSpend) return bHasSpend - aHasSpend

            // Then sort by selected column
            let aVal = 0, bVal = 0
            switch (sortKey) {
                case 'spend': aVal = Number(a.spend) || 0; bVal = Number(b.spend) || 0; break
                case 'impressions': aVal = Number(a.impressions) || 0; bVal = Number(b.impressions) || 0; break
                case 'clicks': aVal = Number(a.clicks) || 0; bVal = Number(b.clicks) || 0; break
                case 'link_clicks': aVal = Number(a.link_clicks) || 0; bVal = Number(b.link_clicks) || 0; break
                case 'ctr': aVal = Number(a.ctr) || 0; bVal = Number(b.ctr) || 0; break
                case 'leads_count': aVal = Number(a.leads_count) || 0; bVal = Number(b.leads_count) || 0; break
                case 'cpl': aVal = Number(a.cpl) || 0; bVal = Number(b.cpl) || 0; break
                case 'roas': aVal = Number(a.roas) || 0; bVal = Number(b.roas) || 0; break
                default: aVal = Number(a.spend) || 0; bVal = Number(b.spend) || 0; break
            }
            return sortDir === 'desc' ? bVal - aVal : aVal - bVal
        })
    }, [campaigns, sortKey, sortDir])

    const handleSort = (key: SortKey) => {
        if (sortKey === key) {
            setSortDir(d => d === 'desc' ? 'asc' : 'desc')
        } else {
            setSortKey(key)
            setSortDir('desc')
        }
    }

    const handleSync = async () => {
        setSyncing(true)
        try {
            const supabase = createClient()
            const { data: { session } } = await supabase.auth.getSession()
            // Full sync to update DB cache
            const res = await fetch('/api/meta/sync', {
                method: 'POST',
                headers: { 
                    Authorization: `Bearer ${session?.access_token}`,
                    'Content-Type': 'application/json',
                },
            })
            const data = await res.json()
            if (data.success) {
                setLastSync(new Date().toLocaleTimeString('it-IT'))
                // If a period is selected, also refresh live data
                if (activeKey !== 'all') {
                    const since = formatLocalDate(range.from)
                    const until = formatLocalDate(new Date(range.to.getTime() - 24 * 60 * 60 * 1000))
                    await fetchLiveInsights(since, until)
                } else {
                    window.location.reload()
                }
            } else {
                alert('Sync error: ' + (data.error || 'Unknown'))
            }
        } catch (e: any) {
            alert('Sync failed: ' + e.message)
        } finally {
            setSyncing(false)
        }
    }

    const totalSpend = campaigns.reduce((s, c) => s + (Number(c.spend) || 0), 0)
    const totalLeads = campaigns.reduce((s, c) => s + (Number(c.leads_count) || 0), 0)
    const totalClicks = campaigns.reduce((s, c) => s + (Number(c.clicks) || 0), 0)
    const totalImpressions = campaigns.reduce((s, c) => s + (Number(c.impressions) || 0), 0)
    const avgCPL = totalLeads > 0 ? totalSpend / totalLeads : 0
    const avgCTR = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0

    const formatCurrency = (v: number) =>
        new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(v)

    const formatNumber = (v: number) =>
        new Intl.NumberFormat('it-IT').format(v)

    const SortHeader = ({ label, sortField }: { label: string; sortField: SortKey }) => {
        const isActive = sortKey === sortField
        return (
            <th
                className="text-left px-4 py-3 text-[11px] uppercase tracking-wider font-semibold cursor-pointer select-none hover:text-white transition-colors group"
                style={{ color: isActive ? '#f59e0b' : 'var(--color-surface-500)' }}
                onClick={() => handleSort(sortField)}
            >
                <span className="flex items-center gap-1">
                    {label}
                    {isActive ? (
                        sortDir === 'desc' ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />
                    ) : (
                        <ChevronsUpDown className="w-3 h-3 opacity-0 group-hover:opacity-50 transition-opacity" />
                    )}
                </span>
            </th>
        )
    }

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
                <div className="flex items-center gap-3">
                    <button onClick={handleSync} disabled={syncing}
                        className="badge badge-info flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity"
                        style={{ padding: '6px 14px', fontSize: '12px' }}>
                        <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
                        {syncing ? 'Sincronizzando...' : '🔄 Sync Now'}
                    </button>
            {lastSync && <span className="text-[10px]" style={{ color: 'var(--color-surface-500)' }}>Ultimo: {lastSync}</span>}
                    {loadingInsights && <Loader2 className="w-4 h-4 animate-spin" style={{ color: '#818cf8' }} />}
                    <DateRangeFilter activeKey={activeKey} onSelect={setActiveKey}
                        customFrom={customFrom} customTo={customTo}
                        onCustomFromChange={setCustomFrom} onCustomToChange={setCustomTo} />
                </div>
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

            {/* Error notice */}
            {liveError && (
                <div className="text-xs px-3 py-2 rounded-lg" style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                    ⚠️ Errore nel caricamento dati live: {liveError}
                </div>
            )}

            {/* Data period notice */}
            {activeKey !== 'all' && !loadingInsights && liveCampaigns && (
                <div className="text-[10px] px-3 py-1.5 rounded-lg inline-flex items-center gap-2" style={{ background: 'rgba(99, 102, 241, 0.06)', color: 'var(--color-surface-500)', border: '1px solid rgba(99, 102, 241, 0.1)' }}>
                    📊 Dati live da Meta per il periodo selezionato
                    {lastSync && <span>· Aggiornato: {lastSync}</span>}
                </div>
            )}
            {activeKey === 'all' && campaigns.length > 0 && campaigns[0]?.date_range_start && (
                <div className="text-[10px] px-3 py-1.5 rounded-lg inline-flex items-center gap-2" style={{ background: 'rgba(245, 158, 11, 0.06)', color: 'var(--color-surface-500)', border: '1px solid rgba(245, 158, 11, 0.1)' }}>
                    ℹ️ Dati Meta: periodo {campaigns[0].date_range_start} → {campaigns[0].date_range_end}
                    {campaigns[0].synced_at && <span>· Sync: {new Date(campaigns[0].synced_at).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>}
                </div>
            )}

            {/* Campaigns */}
            <div className="glass-card overflow-hidden">
                <div className="p-4 flex items-center justify-between" style={{ borderBottom: '1px solid var(--color-surface-200)' }}>
                    <h3 className="text-sm font-bold text-white">Campagne ({sortedCampaigns.length})</h3>
                    <div className="flex items-center gap-2">
                        <ArrowUpDown className="w-3 h-3" style={{ color: 'var(--color-surface-500)' }} />
                        <span className="text-[10px]" style={{ color: 'var(--color-surface-500)' }}>
                            Clicca sulle colonne per ordinare
                        </span>
                    </div>
                </div>
                {sortedCampaigns.length > 0 ? (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr style={{ borderBottom: '1px solid var(--color-surface-200)' }}>
                                    <th className="text-left px-4 py-3 text-[11px] uppercase tracking-wider font-semibold" style={{ color: 'var(--color-surface-500)' }}>Campagna</th>
                                    <SortHeader label="Status" sortField="status" />
                                    <SortHeader label="Spesa" sortField="spend" />
                                    <SortHeader label="Impression" sortField="impressions" />
                                    <SortHeader label="Click" sortField="clicks" />
                                    <SortHeader label="Click Link" sortField="link_clicks" />
                                    <SortHeader label="CTR" sortField="ctr" />
                                    <SortHeader label="Lead" sortField="leads_count" />
                                    <SortHeader label="CPL" sortField="cpl" />
                                    <SortHeader label="ROAS" sortField="roas" />
                                </tr>
                            </thead>
                            <tbody>
                                {sortedCampaigns.map(c => (
                                    <tr key={c.id} className="hover:bg-white/[0.02] transition-colors" style={{ borderBottom: '1px solid var(--color-surface-200)' }}>
                                        <td className="px-4 py-3 text-sm font-semibold text-white max-w-[250px] truncate">{c.campaign_name || '—'}</td>
                                        <td className="px-4 py-3">
                                            <span className={`badge ${c.status === 'ACTIVE' ? 'badge-success' : c.status === 'PAUSED' ? 'badge-warning' : 'badge-info'}`} style={{ fontSize: '10px' }}>
                                                {c.status === 'ACTIVE' ? <Play className="w-2.5 h-2.5" /> : <Pause className="w-2.5 h-2.5" />}
                                                {c.status === 'ACTIVE' ? 'active' : c.status === 'PAUSED' ? 'paused' : c.status?.toLowerCase() || '—'}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-sm font-medium" style={{ color: 'var(--color-surface-700)' }}>{c.spend ? formatCurrency(Number(c.spend)) : '—'}</td>
                                        <td className="px-4 py-3 text-sm" style={{ color: 'var(--color-surface-700)' }}>{c.impressions ? formatNumber(Number(c.impressions)) : '—'}</td>
                                        <td className="px-4 py-3 text-sm" style={{ color: 'var(--color-surface-700)' }}>{c.clicks ? formatNumber(Number(c.clicks)) : '—'}</td>
                                        <td className="px-4 py-3 text-sm" style={{ color: Number(c.link_clicks) > 0 ? '#14b8a6' : 'var(--color-surface-500)' }}>
                                            {c.link_clicks ? <><span className="font-semibold">{formatNumber(Number(c.link_clicks))}</span> <span className="text-[10px] opacity-70">({Number(c.link_click_ctr || 0).toFixed(2)}%)</span></> : '—'}
                                        </td>
                                        <td className="px-4 py-3 text-sm" style={{ color: 'var(--color-surface-700)' }}>{c.ctr ? `${Number(c.ctr).toFixed(2)}%` : '—'}</td>
                                        <td className="px-4 py-3 text-sm font-semibold" style={{ color: Number(c.leads_count) > 0 ? '#3b82f6' : 'var(--color-surface-500)' }}>{c.leads_count || '—'}</td>
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
