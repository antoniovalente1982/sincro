'use client'

import { useState } from 'react'
import { BarChart3, TrendingUp, DollarSign, Users, Target, ArrowUp, ArrowDown, Minus, Zap, Globe, Brain, CircleDollarSign, AlertTriangle, ArrowRightLeft, Dna, Shield, Clock, Search, Filter } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area, CartesianGrid } from 'recharts'
import DateRangeFilter, { useDateRange, filterByDateRange } from '@/components/DateRangeFilter'

interface Stage {
    id: string; name: string; slug: string; color: string; sort_order: number; is_won?: boolean; is_lost?: boolean; pipeline_id?: string
}

interface Lead {
    id: string; stage_id?: string; value?: number; product?: string; utm_source?: string; created_at: string
    pipeline_stages?: { name: string; slug: string; color: string; is_won?: boolean; is_lost?: boolean; pipeline_id?: string }
    funnels?: { id: string; name: string; objective: string } | null
}

interface Props {
    pipelines: { id: string; name: string; is_default: boolean }[]
    stages: Stage[]
    leads: Lead[]
    activities: any[]
    attributions: any[]
    predictions: any[]
    globalIntel: any[]
    leaks: any[]
    reallocations: any[]
    dnaClusters: any[]
    objectives: string[]
}

export default function AnalyticsDashboard({ pipelines, stages: allStages, leads: allLeads, activities, attributions, predictions, globalIntel, leaks, reallocations, dnaClusters, objectives }: Props) {
    const [objectiveFilter, setObjectiveFilter] = useState<string>('all')
    const defaultPipeline = pipelines.find(p => p.is_default) || pipelines[0]
    const [selectedPipelineId, setSelectedPipelineId] = useState<string>(defaultPipeline?.id || '')
    const { range, activeKey, setActiveKey, customFrom, setCustomFrom, customTo, setCustomTo } = useDateRange('today')

    // Filter stages by selected pipeline
    const stages = allStages.filter(s => s.pipeline_id === selectedPipelineId)
    const stageIds = new Set(stages.map(s => s.id))

    // Filter leads by objective AND date AND pipeline
    const leadsByObjective = objectiveFilter === 'all'
        ? allLeads
        : allLeads.filter(l => (l.funnels?.objective || '') === objectiveFilter)
    const leadsByPipeline = leadsByObjective.filter(l => !l.stage_id || stageIds.has(l.stage_id))
    const leads = filterByDateRange(leadsByPipeline, range, 'created_at')

    const objectiveLabel = objectiveFilter === 'all' ? 'Tutti' :
        objectiveFilter === 'cliente' ? 'Clienti' :
        objectiveFilter === 'partner' ? 'Partner' :
        objectiveFilter === 'reclutamento' ? 'Reclutamento' :
        objectiveFilter === 'brand' ? 'Brand' :
        objectiveFilter === 'evento' ? 'Evento' : objectiveFilter

    // KPIs
    const totalLeads = leads.length
    const wonLeads = leads.filter(l => l.pipeline_stages?.is_won)
    const lostLeads = leads.filter(l => l.pipeline_stages?.is_lost)
    const conversionRate = totalLeads > 0 ? (wonLeads.length / totalLeads) * 100 : 0
    const totalRevenue = wonLeads.reduce((sum, l) => sum + (Number(l.value) || 0), 0)
    const avgDealValue = wonLeads.length > 0 ? totalRevenue / wonLeads.length : 0

    // Pipeline Funnel Data — cumulative
    const activeStagesList = stages.filter(s => !s.is_lost)
    const cumulativeCounts: Record<string, number> = {}
    let runningTotal = 0
    for (let i = activeStagesList.length - 1; i >= 0; i--) {
        const stageId = activeStagesList[i].id
        const currentCount = leads.filter(l => l.stage_id === stageId).length
        runningTotal += currentCount
        cumulativeCounts[stageId] = runningTotal
    }
    if (activeStagesList.length > 0) {
        cumulativeCounts[activeStagesList[0].id] = totalLeads
    }

    const funnelData = stages.map(stage => {
        const isLost = stage.is_lost
        const rawCount = leads.filter(l => l.stage_id === stage.id).length
        return {
            name: stage.name,
            count: isLost ? rawCount : (cumulativeCounts[stage.id] || 0),
            color: stage.color,
        }
    })

    // Product Split
    const productData = ['Platinum', 'Impact'].map(p => ({
        name: p,
        value: leads.filter(l => l.product === p).length,
    })).filter(p => p.value > 0)
    const productColors = ['#8b5cf6', '#f59e0b']

    // Source Breakdown
    const sourceMap: Record<string, number> = {}
    leads.forEach(l => {
        const src = l.utm_source || 'Diretto'
        sourceMap[src] = (sourceMap[src] || 0) + 1
    })
    const sourceData = Object.entries(sourceMap)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6)
        .map(([name, value]) => ({ name, value }))
    const sourceColors = ['#6366f1', '#3b82f6', '#22c55e', '#f59e0b', '#ec4899', '#8b5cf6']

    // Weekly Trend (last 8 weeks)
    const weeklyData: { week: string; leads: number }[] = []
    for (let i = 7; i >= 0; i--) {
        const start = new Date()
        start.setDate(start.getDate() - (i + 1) * 7)
        const end = new Date()
        end.setDate(end.getDate() - i * 7)
        const count = leads.filter(l => {
            const d = new Date(l.created_at)
            return d >= start && d < end
        }).length
        weeklyData.push({
            week: start.toLocaleDateString('it-IT', { day: '2-digit', month: 'short' }),
            leads: count,
        })
    }

    const formatCurrency = (v: number) =>
        new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(v)

    const kpis = [
        { label: 'Lead Totali', value: totalLeads.toString(), icon: Users, color: '#3b82f6', sub: `${wonLeads.length} vinti • ${lostLeads.length} persi` },
        { label: 'Tasso Conversione', value: `${conversionRate.toFixed(1)}%`, icon: Target, color: '#8b5cf6', sub: `${wonLeads.length} su ${totalLeads}` },
        { label: 'Revenue Totale', value: formatCurrency(totalRevenue), icon: DollarSign, color: '#22c55e', sub: `da ${wonLeads.length} vendite` },
        { label: 'Valore Medio Deal', value: formatCurrency(avgDealValue), icon: TrendingUp, color: '#f59e0b', sub: wonLeads.length > 0 ? 'per vendita chiusa' : 'nessuna vendita' },
    ]

    const CustomTooltip = ({ active, payload, label }: any) => {
        if (active && payload?.length) {
            return (
                <div className="glass-card p-3" style={{ background: 'rgba(15,15,19,0.95)' }}>
                    <p className="text-xs font-bold text-white">{label}</p>
                    <p className="text-xs mt-1" style={{ color: 'var(--color-sincro-400)' }}>{payload[0].value}</p>
                </div>
            )
        }
        return null
    }

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex items-center justify-between gap-4 flex-wrap">
                <div>
                    <h1 className="text-2xl font-bold text-white flex items-center gap-3">
                        <BarChart3 className="w-6 h-6" style={{ color: '#10b981' }} />
                        Analytics
                        {objectiveFilter !== 'all' && (
                            <span className="badge text-xs" style={{
                                background: 'rgba(99, 102, 241, 0.1)',
                                color: '#6366f1',
                                border: '1px solid rgba(99, 102, 241, 0.2)',
                            }}>
                                {objectiveLabel}
                            </span>
                        )}
                    </h1>
                    <p className="text-sm mt-1" style={{ color: 'var(--color-surface-600)' }}>
                        Performance, conversione e tracciamento del pipeline
                    </p>
                </div>
                <div className="flex items-center gap-3 flex-wrap">
                    {pipelines.length > 1 && (
                        <select
                            className="input !w-[220px] text-xs"
                            value={selectedPipelineId}
                            onChange={e => setSelectedPipelineId(e.target.value)}
                        >
                            {pipelines.map(p => (
                                <option key={p.id} value={p.id}>
                                    📊 {p.name}{p.is_default ? ' ★' : ''}
                                </option>
                            ))}
                        </select>
                    )}
                    {objectives.length > 0 && (
                        <select
                            className="input !w-[180px] text-xs"
                            value={objectiveFilter}
                            onChange={e => setObjectiveFilter(e.target.value)}
                        >
                            <option value="all">🎯 Tutti gli obiettivi</option>
                            {objectives.map(obj => (
                                <option key={obj} value={obj}>
                                    {obj === 'cliente' ? '👤 Clienti' : obj === 'partner' ? '🤝 Partner' : obj === 'reclutamento' ? '👥 Reclutamento' : obj === 'brand' ? '📢 Brand' : obj === 'evento' ? '🎟️ Evento' : `🎯 ${obj}`}
                                </option>
                            ))}
                        </select>
                    )}
                    <DateRangeFilter activeKey={activeKey} onSelect={setActiveKey}
                        customFrom={customFrom} customTo={customTo}
                        onCustomFromChange={setCustomFrom} onCustomToChange={setCustomTo} />
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {kpis.map(kpi => (
                    <div key={kpi.label} className="kpi-card">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: `${kpi.color}15`, border: `1px solid ${kpi.color}30` }}>
                                <kpi.icon className="w-4 h-4" style={{ color: kpi.color }} />
                            </div>
                        </div>
                        <div className="text-2xl font-bold text-white">{kpi.value}</div>
                        <div className="text-xs mt-1" style={{ color: 'var(--color-surface-500)' }}>{kpi.label}</div>
                        <div className="text-[10px] mt-0.5" style={{ color: 'var(--color-surface-600)' }}>{kpi.sub}</div>
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Pipeline Funnel */}
                <div className="glass-card p-5">
                    <h3 className="text-sm font-bold text-white mb-4">Pipeline Funnel</h3>
                    {funnelData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={250}>
                            <BarChart data={funnelData} layout="vertical">
                                <XAxis type="number" tick={{ fill: '#71717a', fontSize: 11 }} axisLine={false} tickLine={false} />
                                <YAxis type="category" dataKey="name" tick={{ fill: '#d4d4d8', fontSize: 12 }} axisLine={false} tickLine={false} width={100} />
                                <Tooltip content={<CustomTooltip />} />
                                <Bar dataKey="count" radius={[0, 6, 6, 0]}>
                                    {funnelData.map((entry, i) => (
                                        <Cell key={i} fill={entry.color} fillOpacity={0.7} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="h-[250px] flex items-center justify-center text-xs" style={{ color: 'var(--color-surface-500)' }}>Nessun dato</div>
                    )}
                </div>

                {/* Weekly Trend */}
                <div className="glass-card p-5">
                    <h3 className="text-sm font-bold text-white mb-4">Trend Settimanale Lead</h3>
                    <ResponsiveContainer width="100%" height={250}>
                        <AreaChart data={weeklyData}>
                            <defs>
                                <linearGradient id="leadGradient" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                            <XAxis dataKey="week" tick={{ fill: '#71717a', fontSize: 11 }} axisLine={false} tickLine={false} />
                            <YAxis tick={{ fill: '#71717a', fontSize: 11 }} axisLine={false} tickLine={false} />
                            <Tooltip content={<CustomTooltip />} />
                            <Area type="monotone" dataKey="leads" stroke="#6366f1" fill="url(#leadGradient)" strokeWidth={2} />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>

                {/* Product Split */}
                {productData.length > 0 && (
                    <div className="glass-card p-5">
                        <h3 className="text-sm font-bold text-white mb-4">Distribuzione Prodotti</h3>
                        <ResponsiveContainer width="100%" height={250}>
                            <PieChart>
                                <Pie data={productData} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={5} dataKey="value" label={({ name, percent }: any) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}>
                                    {productData.map((_, i) => (
                                        <Cell key={i} fill={productColors[i]} fillOpacity={0.8} />
                                    ))}
                                </Pie>
                                <Tooltip />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                )}

                {/* Source Breakdown */}
                {sourceData.length > 0 && (
                    <div className="glass-card p-5">
                        <h3 className="text-sm font-bold text-white mb-4">Sorgenti Lead</h3>
                        <ResponsiveContainer width="100%" height={250}>
                            <BarChart data={sourceData}>
                                <XAxis dataKey="name" tick={{ fill: '#d4d4d8', fontSize: 11 }} axisLine={false} tickLine={false} />
                                <YAxis tick={{ fill: '#71717a', fontSize: 11 }} axisLine={false} tickLine={false} />
                                <Tooltip content={<CustomTooltip />} />
                                <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                                    {sourceData.map((_, i) => (
                                        <Cell key={i} fill={sourceColors[i % sourceColors.length]} fillOpacity={0.7} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                )}
            </div>

            {/* Recent Activity */}
            <div className="glass-card p-5">
                <h3 className="text-sm font-bold text-white mb-4">Attività Recenti</h3>
                {activities.length > 0 ? (
                    <div className="space-y-2">
                        {activities.slice(0, 10).map((act: any) => (
                            <div key={act.id} className="flex items-center gap-3 p-2 rounded-xl hover:bg-white/[0.02]">
                                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: 'var(--color-sincro-500)' }} />
                                <span className="text-xs flex-1" style={{ color: 'var(--color-surface-700)' }}>
                                    {act.activity_type.replace(/_/g, ' ')}
                                </span>
                                <span className="text-[10px]" style={{ color: 'var(--color-surface-500)' }}>
                                    {new Date(act.created_at).toLocaleString('it-IT', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                </span>
                            </div>
                        ))}
                    </div>
                ) : (
                    <p className="text-xs text-center py-4" style={{ color: 'var(--color-surface-500)' }}>Nessuna attività registrata</p>
                )}
            </div>

            {/* ===== REVENUE ATTRIBUTION ===== */}
            {attributions.length > 0 && (
                <div className="glass-card p-6">
                    <div className="flex items-center gap-2 mb-4">
                        <CircleDollarSign className="w-5 h-5" style={{ color: '#22c55e' }} />
                        <h3 className="text-sm font-bold text-white">Revenue Attribution</h3>
                        <span className="badge" style={{ background: 'rgba(34, 197, 94, 0.1)', color: '#22c55e', fontSize: '10px' }}>
                            {attributions.length} deal chiusi
                        </span>
                    </div>

                    {/* Summary Cards */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                        {[{
                            label: 'Revenue Totale',
                            value: `€${attributions.reduce((s: number, a: any) => s + (Number(a.deal_value) || 0), 0).toLocaleString('it-IT', { minimumFractionDigits: 0 })}`,
                            color: '#22c55e',
                        }, {
                            label: 'Spesa Attribuita',
                            value: `€${attributions.reduce((s: number, a: any) => s + (Number(a.attributed_spend) || 0), 0).toLocaleString('it-IT', { minimumFractionDigits: 0 })}`,
                            color: '#ef4444',
                        }, {
                            label: 'ROI Medio',
                            value: `${(attributions.reduce((s: number, a: any) => s + (Number(a.roi) || 0), 0) / Math.max(attributions.length, 1)).toFixed(0)}%`,
                            color: '#a855f7',
                        }, {
                            label: 'Giorni Medi Chiusura',
                            value: `${(attributions.reduce((s: number, a: any) => s + (Number(a.days_to_close) || 0), 0) / Math.max(attributions.length, 1)).toFixed(0)}`,
                            color: '#3b82f6',
                        }].map((card, i) => (
                            <div key={i} className="p-3 rounded-xl" style={{ background: 'var(--color-surface-100)', border: '1px solid var(--color-surface-200)' }}>
                                <div className="text-[10px] uppercase mb-1" style={{ color: card.color }}>{card.label}</div>
                                <div className="text-lg font-bold text-white">{card.value}</div>
                            </div>
                        ))}
                    </div>

                    {/* Attribution Table */}
                    <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                            <thead>
                                <tr className="border-b" style={{ borderColor: 'var(--color-surface-200)' }}>
                                    <th className="text-left py-2 font-semibold" style={{ color: 'var(--color-surface-500)' }}>Campagna</th>
                                    <th className="text-right py-2 font-semibold" style={{ color: 'var(--color-surface-500)' }}>Revenue</th>
                                    <th className="text-right py-2 font-semibold" style={{ color: 'var(--color-surface-500)' }}>Spesa</th>
                                    <th className="text-right py-2 font-semibold" style={{ color: 'var(--color-surface-500)' }}>ROI</th>
                                    <th className="text-right py-2 font-semibold" style={{ color: 'var(--color-surface-500)' }}>ROAS</th>
                                    <th className="text-right py-2 font-semibold" style={{ color: 'var(--color-surface-500)' }}>Giorni</th>
                                </tr>
                            </thead>
                            <tbody>
                                {attributions.slice(0, 10).map((a: any) => (
                                    <tr key={a.id} className="border-b" style={{ borderColor: 'var(--color-surface-100)' }}>
                                        <td className="py-2 text-white font-medium">
                                            {a.campaign_name || 'Diretto'}
                                            <div className="text-[10px]" style={{ color: 'var(--color-surface-500)' }}>{a.channel_type}</div>
                                        </td>
                                        <td className="py-2 text-right font-bold" style={{ color: '#22c55e' }}>€{Number(a.deal_value).toLocaleString('it-IT')}</td>
                                        <td className="py-2 text-right" style={{ color: 'var(--color-surface-500)' }}>€{Number(a.attributed_spend).toFixed(0)}</td>
                                        <td className="py-2 text-right font-bold" style={{ color: Number(a.roi) > 0 ? '#22c55e' : '#ef4444' }}>{Number(a.roi).toFixed(0)}%</td>
                                        <td className="py-2 text-right" style={{ color: Number(a.roas) > 3 ? '#22c55e' : '#f59e0b' }}>{Number(a.roas).toFixed(1)}x</td>
                                        <td className="py-2 text-right" style={{ color: 'var(--color-surface-500)' }}>{a.days_to_close}gg</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* ===== PREDICTIVE PIPELINE ===== */}
            {predictions.length > 0 && (() => {
                const latest = predictions[0]
                return (
                    <div className="glass-card p-6">
                        <div className="flex items-center gap-2 mb-4">
                            <TrendingUp className="w-5 h-5" style={{ color: '#a855f7' }} />
                            <h3 className="text-sm font-bold text-white">Previsione Revenue</h3>
                            <span className="badge" style={{ background: 'rgba(168, 85, 247, 0.1)', color: '#a855f7', fontSize: '10px' }}>
                                Confidenza {((latest.model_confidence || 0) * 100).toFixed(0)}%
                            </span>
                        </div>

                        {/* Forecast Cards */}
                        <div className="grid grid-cols-3 gap-3 mb-4">
                            {[{
                                label: '30 Giorni', value: latest.forecast_30d,
                                optimistic: latest.forecast_30d_optimistic, pessimistic: latest.forecast_30d_pessimistic,
                                color: '#22c55e',
                            }, {
                                label: '60 Giorni', value: latest.forecast_60d, color: '#3b82f6',
                            }, {
                                label: '90 Giorni', value: latest.forecast_90d, color: '#a855f7',
                            }].map((f, i) => (
                                <div key={i} className="p-4 rounded-xl text-center" style={{
                                    background: `${f.color}08`, border: `1px solid ${f.color}20`,
                                }}>
                                    <div className="text-[10px] uppercase mb-1" style={{ color: f.color }}>{f.label}</div>
                                    <div className="text-xl font-black text-white">€{Number(f.value || 0).toLocaleString('it-IT', { maximumFractionDigits: 0 })}</div>
                                    {f.optimistic && (
                                        <div className="text-[9px] mt-1" style={{ color: 'var(--color-surface-500)' }}>
                                            🔻 €{Number(f.pessimistic || 0).toLocaleString('it-IT', { maximumFractionDigits: 0 })}
                                            {' — '}
                                            🔺 €{Number(f.optimistic || 0).toLocaleString('it-IT', { maximumFractionDigits: 0 })}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>

                        {/* Pipeline Stats */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
                            <div className="p-2 rounded-lg" style={{ background: 'var(--color-surface-100)' }}>
                                <div className="text-[9px] uppercase" style={{ color: 'var(--color-surface-500)' }}>Pipeline Attiva</div>
                                <div className="text-sm font-bold text-white">€{Number(latest.active_pipeline_value || 0).toLocaleString('it-IT', { maximumFractionDigits: 0 })}</div>
                            </div>
                            <div className="p-2 rounded-lg" style={{ background: 'var(--color-surface-100)' }}>
                                <div className="text-[9px] uppercase" style={{ color: 'var(--color-surface-500)' }}>Pipeline Pesata</div>
                                <div className="text-sm font-bold text-white">€{Number(latest.weighted_pipeline_value || 0).toLocaleString('it-IT', { maximumFractionDigits: 0 })}</div>
                            </div>
                            <div className="p-2 rounded-lg" style={{ background: 'var(--color-surface-100)' }}>
                                <div className="text-[9px] uppercase" style={{ color: 'var(--color-surface-500)' }}>Nuovi Lead Stimati</div>
                                <div className="text-sm font-bold text-white">{latest.projected_new_leads_30d || 0}</div>
                            </div>
                            <div className="p-2 rounded-lg" style={{ background: 'var(--color-surface-100)' }}>
                                <div className="text-[9px] uppercase" style={{ color: 'var(--color-surface-500)' }}>ROI Proiettato</div>
                                <div className="text-sm font-bold" style={{ color: Number(latest.projected_roi) > 0 ? '#22c55e' : '#ef4444' }}>{Number(latest.projected_roi || 0).toFixed(0)}%</div>
                            </div>
                        </div>

                        {/* AI Commentary */}
                        {latest.ai_commentary && (
                            <div className="p-3 rounded-xl" style={{ background: 'rgba(168, 85, 247, 0.05)', border: '1px solid rgba(168, 85, 247, 0.1)' }}>
                                <div className="flex items-center gap-1 mb-1">
                                    <Brain className="w-3 h-3" style={{ color: '#a855f7' }} />
                                    <span className="text-[10px] font-bold" style={{ color: '#a855f7' }}>AI Commentary</span>
                                </div>
                                <div className="text-[11px]" style={{ color: 'var(--color-surface-500)' }}>{latest.ai_commentary}</div>
                            </div>
                        )}
                    </div>
                )
            })()}

            {/* ===== CROSS-CLIENT INTELLIGENCE ===== */}
            {globalIntel.length > 0 && (
                <div className="glass-card p-6">
                    <div className="flex items-center gap-2 mb-4">
                        <Globe className="w-5 h-5" style={{ color: '#f59e0b' }} />
                        <h3 className="text-sm font-bold text-white">Intelligenza Cross-Client</h3>
                        <span className="badge" style={{ background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b', fontSize: '10px' }}>
                            Network anonimizzato
                        </span>
                    </div>
                    <div className="space-y-2">
                        {globalIntel.map((intel: any) => (
                            <div key={intel.id} className="p-3 rounded-xl" style={{ background: 'var(--color-surface-100)', border: '1px solid var(--color-surface-200)' }}>
                                <div className="flex items-start justify-between mb-1">
                                    <div className="flex items-center gap-2">
                                        <span className="badge" style={{
                                            background: intel.category === 'benchmark' ? 'rgba(59, 130, 246, 0.1)' :
                                                intel.category === 'best_practice' ? 'rgba(34, 197, 94, 0.1)' : 'rgba(245, 158, 11, 0.1)',
                                            color: intel.category === 'benchmark' ? '#3b82f6' :
                                                intel.category === 'best_practice' ? '#22c55e' : '#f59e0b',
                                            fontSize: '9px',
                                        }}>{intel.category}</span>
                                        {intel.platform && <span className="text-[9px]" style={{ color: 'var(--color-surface-500)' }}>{intel.platform}</span>}
                                    </div>
                                    <span className="text-[9px] font-mono" style={{ color: 'var(--color-surface-500)' }}>
                                        {intel.sample_size} org • {(intel.confidence * 100).toFixed(0)}%
                                    </span>
                                </div>
                                <div className="text-xs font-semibold text-white mb-0.5">{intel.title}</div>
                                <div className="text-[11px] line-clamp-2" style={{ color: 'var(--color-surface-500)' }}>{intel.content}</div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* ===== REVENUE LEAK DETECTOR ===== */}
            {leaks.length > 0 && (
                <div className="glass-card p-6">
                    <div className="flex items-center gap-2 mb-4">
                        <Search className="w-5 h-5" style={{ color: '#ef4444' }} />
                        <h3 className="text-sm font-bold text-white">Revenue Leak Detector</h3>
                        <span className="badge" style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', fontSize: '10px' }}>
                            €{leaks.reduce((s: number, l: any) => s + (Number(l.estimated_lost_revenue) || 0), 0).toLocaleString('it-IT', { maximumFractionDigits: 0 })} a rischio
                        </span>
                    </div>
                    <div className="space-y-2">
                        {leaks.map((leak: any) => (
                            <div key={leak.id} className="p-3 rounded-xl" style={{
                                background: leak.severity === 'critical' ? 'rgba(239, 68, 68, 0.05)' : 'var(--color-surface-100)',
                                border: `1px solid ${leak.severity === 'critical' ? 'rgba(239, 68, 68, 0.2)' : leak.severity === 'high' ? 'rgba(245, 158, 11, 0.2)' : 'var(--color-surface-200)'}`,
                            }}>
                                <div className="flex items-start justify-between mb-1">
                                    <div className="flex items-center gap-2">
                                        <span className="badge" style={{
                                            background: leak.severity === 'critical' ? 'rgba(239, 68, 68, 0.15)' : leak.severity === 'high' ? 'rgba(245, 158, 11, 0.15)' : 'rgba(59, 130, 246, 0.15)',
                                            color: leak.severity === 'critical' ? '#ef4444' : leak.severity === 'high' ? '#f59e0b' : '#3b82f6',
                                            fontSize: '9px',
                                        }}>{leak.severity.toUpperCase()}</span>
                                        <span className="badge" style={{ background: 'var(--color-surface-200)', color: 'var(--color-surface-600)', fontSize: '9px' }}>
                                            {leak.leak_type.replace(/_/g, ' ')}
                                        </span>
                                    </div>
                                    {Number(leak.estimated_lost_revenue) > 0 && (
                                        <span className="text-xs font-bold" style={{ color: '#ef4444' }}>-€{Number(leak.estimated_lost_revenue).toLocaleString('it-IT', { maximumFractionDigits: 0 })}</span>
                                    )}
                                </div>
                                <div className="text-xs font-semibold text-white mb-0.5">{leak.title}</div>
                                <div className="text-[11px] mb-1" style={{ color: 'var(--color-surface-500)' }}>{leak.description}</div>
                                {leak.recommendation && (
                                    <div className="text-[10px] p-2 rounded-lg mt-1" style={{ background: 'rgba(34, 197, 94, 0.05)', border: '1px solid rgba(34, 197, 94, 0.1)', color: '#22c55e' }}>
                                        💡 {leak.recommendation}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* ===== BUDGET REALLOCATION LOG ===== */}
            {reallocations.length > 0 && (
                <div className="glass-card p-6">
                    <div className="flex items-center gap-2 mb-4">
                        <ArrowRightLeft className="w-5 h-5" style={{ color: '#3b82f6' }} />
                        <h3 className="text-sm font-bold text-white">Budget Reallocation</h3>
                        <span className="badge" style={{ background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', fontSize: '10px' }}>
                            {reallocations.length} movimenti
                        </span>
                    </div>
                    <div className="space-y-2">
                        {reallocations.map((r: any) => (
                            <div key={r.id} className="p-3 rounded-xl" style={{ background: 'var(--color-surface-100)', border: '1px solid var(--color-surface-200)' }}>
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="badge" style={{
                                        background: r.status === 'executed' ? 'rgba(34, 197, 94, 0.1)' : 'rgba(245, 158, 11, 0.1)',
                                        color: r.status === 'executed' ? '#22c55e' : '#f59e0b',
                                        fontSize: '9px',
                                    }}>{r.status}</span>
                                    <span className="text-sm font-bold" style={{ color: '#3b82f6' }}>€{Number(r.amount).toLocaleString('it-IT', { maximumFractionDigits: 0 })}</span>
                                </div>
                                <div className="flex items-center gap-2 text-xs text-white">
                                    <span className="truncate" style={{ color: '#ef4444' }}>{r.from_campaign_name}</span>
                                    <ArrowRightLeft className="w-3 h-3 flex-shrink-0" style={{ color: 'var(--color-surface-500)' }} />
                                    <span className="truncate" style={{ color: '#22c55e' }}>{r.to_campaign_name}</span>
                                </div>
                                <div className="text-[10px] mt-1" style={{ color: 'var(--color-surface-500)' }}>
                                    ROAS: {Number(r.from_roas).toFixed(1)}x → {Number(r.to_roas).toFixed(1)}x
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* ===== AUDIENCE DNA ===== */}
            {dnaClusters.length > 0 && (
                <div className="glass-card p-6">
                    <div className="flex items-center gap-2 mb-4">
                        <Dna className="w-5 h-5" style={{ color: '#a855f7' }} />
                        <h3 className="text-sm font-bold text-white">Audience DNA</h3>
                    </div>
                    <div className="space-y-3">
                        {dnaClusters.map((cluster: any) => (
                            <div key={cluster.id} className="p-4 rounded-xl" style={{
                                background: cluster.cluster_rank === 1 ? 'rgba(245, 158, 11, 0.04)' : 'var(--color-surface-100)',
                                border: `1px solid ${cluster.cluster_rank === 1 ? 'rgba(245, 158, 11, 0.2)' : 'var(--color-surface-200)'}`,
                            }}>
                                <div className="flex items-center justify-between mb-2">
                                    <div className="text-sm font-bold text-white">{cluster.cluster_name}</div>
                                    <span className="text-xs font-mono" style={{ color: 'var(--color-surface-500)' }}>{cluster.lead_count} clienti</span>
                                </div>
                                <div className="grid grid-cols-3 gap-2 mb-2">
                                    <div className="p-2 rounded-lg text-center" style={{ background: 'var(--color-surface-200)' }}>
                                        <div className="text-[9px] uppercase" style={{ color: 'var(--color-surface-500)' }}>Deal Medio</div>
                                        <div className="text-sm font-bold text-white">€{Number(cluster.avg_deal_value).toLocaleString('it-IT', { maximumFractionDigits: 0 })}</div>
                                    </div>
                                    <div className="p-2 rounded-lg text-center" style={{ background: 'var(--color-surface-200)' }}>
                                        <div className="text-[9px] uppercase" style={{ color: 'var(--color-surface-500)' }}>Giorni Close</div>
                                        <div className="text-sm font-bold text-white">{Number(cluster.avg_days_to_close).toFixed(0)}</div>
                                    </div>
                                    <div className="p-2 rounded-lg text-center" style={{ background: 'var(--color-surface-200)' }}>
                                        <div className="text-[9px] uppercase" style={{ color: 'var(--color-surface-500)' }}>Revenue</div>
                                        <div className="text-sm font-bold" style={{ color: '#22c55e' }}>€{Number(cluster.total_revenue).toLocaleString('it-IT', { maximumFractionDigits: 0 })}</div>
                                    </div>
                                </div>
                                {cluster.top_channels?.length > 0 && (
                                    <div className="flex flex-wrap gap-1 mb-2">
                                        {cluster.top_channels.map((ch: string) => (
                                            <span key={ch} className="badge" style={{ background: 'rgba(99, 102, 241, 0.1)', color: '#6366f1', fontSize: '9px' }}>{ch}</span>
                                        ))}
                                        {cluster.best_days?.slice(0, 2).map((d: string) => (
                                            <span key={d} className="badge" style={{ background: 'rgba(34, 197, 94, 0.1)', color: '#22c55e', fontSize: '9px' }}>{d}</span>
                                        ))}
                                    </div>
                                )}
                                {cluster.profile_description && (
                                    <div className="text-[11px] mb-1" style={{ color: 'var(--color-surface-500)' }}>{cluster.profile_description}</div>
                                )}
                                {cluster.targeting_suggestion && (
                                    <div className="text-[10px] p-2 rounded-lg" style={{ background: 'rgba(168, 85, 247, 0.05)', border: '1px solid rgba(168, 85, 247, 0.1)', color: '#a855f7' }}>
                                        🎯 {cluster.targeting_suggestion}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}
