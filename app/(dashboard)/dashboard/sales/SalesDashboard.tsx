'use client'

import { useState, useMemo } from 'react'
import { Target, Users, CalendarCheck, TrendingUp, DollarSign, Calendar as CalendarIcon, Loader2, Award } from 'lucide-react'
import { BarChart, Bar, AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from 'recharts'
import DateRangeFilter, { useDateRange, filterByDateRange } from '@/components/DateRangeFilter'

interface Lead {
    id: string
    created_at: string
    setter_id: string | null
    closer_id: string | null
    closer_appt_status: string | null
    esito: string | null
    closer_outcome: string | null
    value: number | null
    pipeline_stages?: {
        is_won?: boolean
        is_lost?: boolean
    } | null
}

interface Props {
    leads: Lead[]
}

export default function SalesDashboard({ leads }: Props) {
    // Default to 'all' or 'this_year' to see the trend, let's default to all to see historical data.
    const { range, activeKey, setActiveKey, customFrom, setCustomFrom, customTo, setCustomTo } = useDateRange('all')

    // Filter leads by date range based on created_at
    const filteredLeads = useMemo(() => {
        if (!range) return leads
        return filterByDateRange(leads, range, 'created_at')
    }, [leads, range])

    // KPI Calculations
    const assignedLeads = filteredLeads.filter(l => l.setter_id || l.closer_id)
    const appointments = filteredLeads.filter(l => 
        (l.esito && l.esito.toLowerCase().includes('appuntamento')) || 
        (l.closer_appt_status && l.closer_appt_status.toUpperCase() === 'FATTO')
    )
    const sales = filteredLeads.filter(l => 
        l.closer_outcome === 'VINTA' || l.pipeline_stages?.is_won
    )
    
    const totalSalesValue = sales.reduce((acc, lead) => acc + (Number(lead.value) || 0), 0)

    // Monthly Data Aggregation
    const monthlyData = useMemo(() => {
        const monthMap: Record<string, { monthKey: string, date: Date, salesCount: number, salesValue: number }> = {}

        // Initialize months if we want continuous data, but here we just group existing won leads
        sales.forEach(lead => {
            const date = new Date(lead.created_at)
            // Example format: "Jan 2026"
            const monthKey = date.toLocaleDateString('it-IT', { month: 'short', year: 'numeric' })
            // Use YYYY-MM to easily sort keys
            const sortKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`

            if (!monthMap[sortKey]) {
                monthMap[sortKey] = {
                    monthKey,
                    date: new Date(date.getFullYear(), date.getMonth(), 1),
                    salesCount: 0,
                    salesValue: 0,
                }
            }
            monthMap[sortKey].salesCount += 1
            monthMap[sortKey].salesValue += Number(lead.value) || 0
        })

        // Convert to array and sort chronologically
        return Object.keys(monthMap).sort().map(key => monthMap[key])
    }, [sales])

    const formatCurrency = (v: number) =>
        new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v)

    const CustomTooltipCount = ({ active, payload, label }: any) => {
        if (active && payload?.length) {
            return (
                <div className="glass-card p-3" style={{ background: 'var(--glass-bg)', borderColor: 'rgba(255,255,255,0.1)' }}>
                    <p className="text-xs font-bold text-white mb-1">{label}</p>
                    <p className="text-sm font-bold" style={{ color: '#8b5cf6' }}>
                        {payload[0].value} Vendite
                    </p>
                </div>
            )
        }
        return null
    }

    const CustomTooltipValue = ({ active, payload, label }: any) => {
        if (active && payload?.length) {
            return (
                <div className="glass-card p-3" style={{ background: 'var(--glass-bg)', borderColor: 'rgba(255,255,255,0.1)' }}>
                    <p className="text-xs font-bold text-white mb-1">{label}</p>
                    <p className="text-sm font-bold" style={{ color: '#22c55e' }}>
                        {formatCurrency(payload[0].value)}
                    </p>
                </div>
            )
        }
        return null
    }

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header & Date Filter */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold th-heading flex items-center gap-3">
                        <TrendingUp className="w-6 h-6" style={{ color: '#22c55e' }} />
                        Sales Dashboard
                    </h1>
                    <p className="text-sm mt-1" style={{ color: 'var(--color-surface-600)' }}>
                        Monitoraggio performance di vendita, appuntamenti e fatturato.
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <DateRangeFilter
                        activeKey={activeKey} onSelect={setActiveKey}
                        customFrom={customFrom} customTo={customTo}
                        onCustomFromChange={setCustomFrom} onCustomToChange={setCustomTo}
                    />
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Assegnati */}
                <div className="glass-card p-5 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 -mr-4 -mt-4 w-24 h-24 rounded-full bg-blue-500/10 blur-xl group-hover:bg-blue-500/20 transition-colors" />
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-blue-500/10 border border-blue-500/20 text-blue-500">
                            <Users className="w-5 h-5" />
                        </div>
                    </div>
                    <div className="text-3xl font-black text-white">{assignedLeads.length}</div>
                    <div className="text-sm font-medium mt-1" style={{ color: 'var(--color-surface-500)' }}>Leads Assegnati</div>
                </div>

                {/* Appuntamenti */}
                <div className="glass-card p-5 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 -mr-4 -mt-4 w-24 h-24 rounded-full bg-orange-500/10 blur-xl group-hover:bg-orange-500/20 transition-colors" />
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-orange-500/10 border border-orange-500/20 text-orange-500">
                            <CalendarCheck className="w-5 h-5" />
                        </div>
                    </div>
                    <div className="text-3xl font-black text-white">{appointments.length}</div>
                    <div className="text-sm font-medium mt-1" style={{ color: 'var(--color-surface-500)' }}>Appuntamenti Fatti</div>
                </div>

                {/* Vendite */}
                <div className="glass-card p-5 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 -mr-4 -mt-4 w-24 h-24 rounded-full bg-purple-500/10 blur-xl group-hover:bg-purple-500/20 transition-colors" />
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-purple-500/10 border border-purple-500/20 text-purple-500">
                            <Award className="w-5 h-5" />
                        </div>
                    </div>
                    <div className="text-3xl font-black text-white">{sales.length}</div>
                    <div className="text-sm font-medium mt-1" style={{ color: 'var(--color-surface-500)' }}>Vendite Chiuse</div>
                </div>

                {/* Montante Vendite */}
                <div className="glass-card p-5 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 -mr-4 -mt-4 w-24 h-24 rounded-full bg-green-500/10 blur-xl group-hover:bg-green-500/20 transition-colors" />
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-green-500/10 border border-green-500/20 text-green-500">
                            <DollarSign className="w-5 h-5" />
                        </div>
                    </div>
                    <div className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-600">
                        {formatCurrency(totalSalesValue)}
                    </div>
                    <div className="text-sm font-medium mt-1" style={{ color: 'var(--color-surface-500)' }}>Montante Vendite</div>
                </div>
            </div>

            {/* Charts Section */}
            {monthlyData.length > 0 ? (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {/* Volume Vendite Chart */}
                    <div className="glass-card p-6">
                        <h3 className="text-sm font-bold text-white mb-6 flex items-center gap-2">
                            <Award className="w-4 h-4 text-purple-500" />
                            Volume Vendite (Mensile)
                        </h3>
                        <ResponsiveContainer width="100%" height={300}>
                            <BarChart data={monthlyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                                <XAxis dataKey="monthKey" tick={{ fill: '#71717a', fontSize: 12 }} axisLine={false} tickLine={false} dy={10} />
                                <YAxis tick={{ fill: '#71717a', fontSize: 12 }} axisLine={false} tickLine={false} dx={-10} />
                                <Tooltip content={<CustomTooltipCount />} cursor={{ fill: 'rgba(255,255,255,0.02)' }} />
                                <Bar dataKey="salesCount" radius={[6, 6, 0, 0]} maxBarSize={50}>
                                    {monthlyData.map((entry, i) => (
                                        <Cell key={`cell-${i}`} fill="url(#colorSales)" />
                                    ))}
                                </Bar>
                                <defs>
                                    <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.8} />
                                        <stop offset="100%" stopColor="#6366f1" stopOpacity={0.8} />
                                    </linearGradient>
                                </defs>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>

                    {/* Montante Vendite Chart */}
                    <div className="glass-card p-6">
                        <h3 className="text-sm font-bold text-white mb-6 flex items-center gap-2">
                            <DollarSign className="w-4 h-4 text-green-500" />
                            Montante Vendite (Mensile)
                        </h3>
                        <ResponsiveContainer width="100%" height={300}>
                            <AreaChart data={monthlyData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                                <XAxis dataKey="monthKey" tick={{ fill: '#71717a', fontSize: 12 }} axisLine={false} tickLine={false} dy={10} />
                                <YAxis 
                                    tick={{ fill: '#71717a', fontSize: 12 }} 
                                    axisLine={false} tickLine={false} 
                                    tickFormatter={(val) => `€${(val/1000).toFixed(0)}k`}
                                    dx={-10}
                                />
                                <Tooltip content={<CustomTooltipValue />} />
                                <Area 
                                    type="monotone" 
                                    dataKey="salesValue" 
                                    stroke="#22c55e" 
                                    strokeWidth={3}
                                    fillOpacity={1} 
                                    fill="url(#colorValue)" 
                                />
                                <defs>
                                    <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            ) : (
                <div className="glass-card p-12 flex flex-col items-center justify-center text-center mt-6">
                    <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4 text-white/20">
                        <Target className="w-8 h-8" />
                    </div>
                    <h3 className="text-lg font-bold text-white mb-2">Nessun dato di vendita in questo periodo</h3>
                    <p className="text-sm text-zinc-500 max-w-sm">
                        Modifica il filtro della data per visualizzare le performance di altri periodi.
                    </p>
                </div>
            )}
        </div>
    )
}
