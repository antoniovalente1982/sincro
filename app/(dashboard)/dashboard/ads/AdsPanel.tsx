'use client'

import { useState, useMemo, useEffect, useCallback } from 'react'
import { Megaphone, TrendingUp, DollarSign, Eye, MousePointerClick, Plug, Zap, Play, Pause, ToggleLeft, ToggleRight, Brain, Lightbulb, ArrowRight, RefreshCw, ChevronUp, ChevronDown, ChevronsUpDown, ArrowUpDown, Loader2, Rocket } from 'lucide-react'
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
    crm_appts?: number
    crm_showups?: number
    crm_sales?: number
    crm_revenue?: number
    cp_appt?: number
    cp_showup?: number
    cac?: number
    synced_at?: string
    date_range_start?: string
    date_range_end?: string
    funnel_id?: string
}

interface FunnelOption {
    id: string; name: string; slug: string
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
    funnels?: FunnelOption[]
}

type SortKey = 'status' | 'spend' | 'impressions' | 'clicks' | 'link_clicks' | 'ctr' | 'leads_count' | 'cpl' | 'roas'
type SortDir = 'asc' | 'desc'

export default function AdsPanel({ campaigns: cachedCampaigns, rules, connections, recommendations, funnels = [] }: Props) {
    const hasMetaAds = connections.some(c => c.provider === 'meta_ads' && c.status === 'active')
    const hasMetaCapi = connections.some(c => c.provider === 'meta_capi' && c.status === 'active')
    const { range, activeKey, setActiveKey, customFrom, setCustomFrom, customTo, setCustomTo } = useDateRange('this_month')
    const [syncing, setSyncing] = useState(false)
    const [loadingInsights, setLoadingInsights] = useState(false)
    const [lastSync, setLastSync] = useState<string | null>(null)
    const [sortKey, setSortKey] = useState<SortKey>('status')
    const [sortDir, setSortDir] = useState<SortDir>('desc')
    const [statusFilter, setStatusFilter] = useState<'ACTIVE' | 'ALL'>('ACTIVE')
    const [pageSize, setPageSize] = useState<number>(50)
    const [currentPage, setCurrentPage] = useState<number>(1)
    const [liveCampaigns, setLiveCampaigns] = useState<Campaign[] | null>(null)
    const [liveError, setLiveError] = useState<string | null>(null)
    const [dateFilterMode, setDateFilterMode] = useState<'created' | 'updated'>('created')

    // When user changes period (not "Tutto"), fetch live data from Meta
    const fetchLiveInsights = useCallback(async (since: string, until: string, dMode: string) => {
        setLoadingInsights(true)
        setLiveError(null)
        try {
            const supabase = createClient()
            const { data: { session } } = await supabase.auth.getSession()
            const res = await fetch(`/api/meta/insights?since=${since}&until=${until}&date_mode=${dMode}&_t=${Date.now()}`, {
                headers: { 
                    Authorization: `Bearer ${session?.access_token}`,
                    'Cache-Control': 'no-cache'
                },
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
            setTopPairs([])
            setLiveError(null)
            return
        }
        const since = formatLocalDate(range.from)
        const untilDate = new Date(range.to)
        untilDate.setDate(untilDate.getDate() - 1)
        const until = formatLocalDate(untilDate)
        fetchLiveInsights(since, until, dateFilterMode)
    }, [activeKey, range.from.getTime(), range.to.getTime(), dateFilterMode, fetchLiveInsights])

    // Use live data when available, otherwise cached
    const campaigns = liveCampaigns || cachedCampaigns

    // Sort campaigns: ACTIVE first, then by selected sort key
    const sortedCampaigns = useMemo(() => {
        let list = [...campaigns]
        if (statusFilter === 'ACTIVE') {
            list = list.filter(c => c.status === 'ACTIVE')
        }
        return list.sort((a, b) => {
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
    }, [campaigns, sortKey, sortDir, statusFilter])

    const totalPages = Math.ceil(sortedCampaigns.length / pageSize)
    const paginatedCampaigns = sortedCampaigns.slice((currentPage - 1) * pageSize, currentPage * pageSize)

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
                    const untilDate = new Date(range.to)
                    untilDate.setDate(untilDate.getDate() - 1)
                    await fetchLiveInsights(since, formatLocalDate(untilDate), dateFilterMode)
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
    const totalAppts = campaigns.reduce((s, c) => s + (Number(c.crm_appts) || 0), 0)
    const totalShowups = campaigns.reduce((s, c) => s + (Number(c.crm_showups) || 0), 0)
    const totalSales = campaigns.reduce((s, c) => s + (Number(c.crm_sales) || 0), 0)
    const totalRevenue = campaigns.reduce((s, c) => s + (Number(c.crm_revenue) || 0), 0)

    const avgCPL = totalLeads > 0 ? totalSpend / totalLeads : 0
    const cpAppt = totalAppts > 0 ? totalSpend / totalAppts : 0
    const cpShowup = totalShowups > 0 ? totalSpend / totalShowups : 0
    const cac = totalSales > 0 ? totalSpend / totalSales : 0
    const roas = totalSpend > 0 ? totalRevenue / totalSpend : 0

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
                    <div className="flex bg-white/5 rounded-xl p-1 gap-1" style={{ border: '1px solid rgba(255,255,255,0.1)' }}>
                        <button 
                            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${dateFilterMode === 'created' ? 'bg-[#3b82f6] text-white shadow-md' : 'text-zinc-400 hover:text-white hover:bg-white/5'}`}
                            onClick={() => setDateFilterMode('created')}
                        >
                            Data Acquisizione
                        </button>
                        <button 
                            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${dateFilterMode === 'updated' ? 'bg-[#f59e0b] text-white shadow-md' : 'text-zinc-400 hover:text-white hover:bg-white/5'}`}
                            onClick={() => setDateFilterMode('updated')}
                        >
                            Ultimo Movimento
                        </button>
                    </div>
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
            <div className={`grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 transition-opacity duration-300 ${loadingInsights ? 'opacity-50 pointer-events-none blur-[1px]' : ''}`}>
                {[
                    { label: 'Spesa Meta', value: formatCurrency(totalSpend), icon: DollarSign, color: '#ef4444' },
                    { label: 'CPL Medio', value: formatCurrency(avgCPL), icon: TrendingUp, color: '#f59e0b' },
                    { label: 'Costo Appt', value: formatCurrency(cpAppt), icon: Target, color: '#3b82f6' },
                    { label: 'Costo ShowUp', value: formatCurrency(cpShowup), icon: Eye, color: '#8b5cf6' },
                    { label: 'CAC Medio', value: formatCurrency(cac), icon: Zap, color: cac > 0 && cac < 500 ? '#22c55e' : '#f43f5e' },
                    { label: `Vendite (${totalSales})`, value: formatCurrency(totalRevenue), icon: DollarSign, color: '#22c55e' },
                    { label: 'ROAS', value: `${roas.toFixed(2)}x`, icon: Rocket, color: roas >= 3 ? '#22c55e' : '#f59e0b' },
                ].map(kpi => (
                    <div key={kpi.label} className="glass-card p-4 flex flex-col justify-between" style={{ border: `1px solid ${kpi.color}15` }}>
                        <div className="flex items-center gap-2 mb-2">
                            <div className="w-6 h-6 rounded-md flex justify-center items-center" style={{ background: `${kpi.color}15` }}>
                                <kpi.icon className="w-3.5 h-3.5" style={{ color: kpi.color }} />
                            </div>
                            <span className="text-[10px] font-semibold tracking-wide uppercase" style={{ color: 'var(--color-surface-400)' }}>{kpi.label}</span>
                        </div>
                        <div className="text-xl font-bold whitespace-nowrap" style={{ color: kpi.color }}>{kpi.value}</div>
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
            <div className={`glass-card overflow-hidden transition-opacity duration-300 ${loadingInsights ? 'opacity-50 pointer-events-none blur-[1px]' : ''}`}>
                <div className="p-4 flex items-center justify-between" style={{ borderBottom: '1px solid var(--color-surface-200)' }}>
                    <h3 className="text-sm font-bold text-white">Campagne ({sortedCampaigns.length})</h3>
                    <div className="flex flex-wrap items-center gap-4">
                        <select
                            className="text-xs rounded-lg px-2 py-1 border-0 outline-none cursor-pointer"
                            style={{ background: 'var(--color-surface-100)', color: 'var(--color-surface-500)' }}
                            value={statusFilter}
                            onChange={e => { setStatusFilter(e.target.value as any); setCurrentPage(1) }}
                        >
                            <option value="ACTIVE">Solo Attive</option>
                            <option value="ALL">Tutte</option>
                        </select>
                        <select
                            className="text-xs rounded-lg px-2 py-1 border-0 outline-none cursor-pointer"
                            style={{ background: 'var(--color-surface-100)', color: 'var(--color-surface-500)' }}
                            value={pageSize}
                            onChange={e => { setPageSize(Number(e.target.value)); setCurrentPage(1) }}
                        >
                            <option value="10">10 per pagina</option>
                            <option value="50">50 per pagina</option>
                            <option value="200">200 per pagina</option>
                            <option value="1000000">Mostra tutte</option>
                        </select>
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
                                    <SortHeader label="CTR" sortField="ctr" />
                                    <SortHeader label="Click Link" sortField="link_clicks" />
                                    <SortHeader label="Lead" sortField="leads_count" />
                                    <SortHeader label="CPL" sortField="cpl" />
                                    <SortHeader label="ROAS" sortField="roas" />
                                </tr>
                            </thead>
                            <tbody>
                                {paginatedCampaigns.map(c => (
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
                                        <td className="px-4 py-3 text-sm" style={{ color: 'var(--color-surface-700)' }}>{c.ctr ? `${Number(c.ctr).toFixed(2)}%` : '—'}</td>
                                        <td className="px-4 py-3 text-sm" style={{ color: Number(c.link_clicks) > 0 ? '#14b8a6' : 'var(--color-surface-500)' }}>
                                            {c.link_clicks ? <><span className="font-semibold">{formatNumber(Number(c.link_clicks))}</span> <span className="text-[10px] opacity-70">({Number(c.link_click_ctr || 0).toFixed(2)}%)</span></> : '—'}
                                        </td>
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
                {totalPages > 1 && (
                    <div className="p-4 flex items-center justify-center gap-4" style={{ borderTop: '1px solid var(--color-surface-200)' }}>
                        <button
                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                            disabled={currentPage === 1}
                            className="btn-secondary !py-1 !px-3 text-xs disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                            Precedente
                        </button>
                        <span className="text-xs font-semibold" style={{ color: 'var(--color-surface-400)' }}>
                            Pagina {currentPage} di {totalPages}
                        </span>
                        <button
                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                            disabled={currentPage === totalPages}
                            className="btn-secondary !py-1 !px-3 text-xs disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                            Successiva
                        </button>
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

        </div>
    )
}
