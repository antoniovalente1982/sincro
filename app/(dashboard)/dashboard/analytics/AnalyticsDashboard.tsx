'use client'

import { BarChart3, TrendingUp, DollarSign, Users, Target, ArrowUp, ArrowDown, Minus } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area, CartesianGrid } from 'recharts'

interface Stage {
    id: string; name: string; slug: string; color: string; sort_order: number; is_won?: boolean; is_lost?: boolean
}

interface Lead {
    id: string; stage_id?: string; value?: number; product?: string; utm_source?: string; created_at: string
    pipeline_stages?: { name: string; slug: string; color: string; is_won?: boolean; is_lost?: boolean }
}

interface Props {
    stages: Stage[]
    leads: Lead[]
    activities: any[]
}

export default function AnalyticsDashboard({ stages, leads, activities }: Props) {
    // KPIs
    const totalLeads = leads.length
    const wonLeads = leads.filter(l => l.pipeline_stages?.is_won)
    const lostLeads = leads.filter(l => l.pipeline_stages?.is_lost)
    const conversionRate = totalLeads > 0 ? (wonLeads.length / totalLeads) * 100 : 0
    const totalRevenue = wonLeads.reduce((sum, l) => sum + (Number(l.value) || 0), 0)
    const avgDealValue = wonLeads.length > 0 ? totalRevenue / wonLeads.length : 0

    // Pipeline Funnel Data
    const funnelData = stages.map(stage => ({
        name: stage.name,
        count: leads.filter(l => l.stage_id === stage.id).length,
        color: stage.color,
    }))

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
            <div>
                <h1 className="text-2xl font-bold text-white flex items-center gap-3">
                    <BarChart3 className="w-6 h-6" style={{ color: '#10b981' }} />
                    Analytics
                </h1>
                <p className="text-sm mt-1" style={{ color: 'var(--color-surface-600)' }}>
                    Performance, conversione e tracciamento del pipeline
                </p>
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
        </div>
    )
}
