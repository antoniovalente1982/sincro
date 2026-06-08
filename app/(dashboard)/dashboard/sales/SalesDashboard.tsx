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
    } | null | any
    setter_profile?: any
    closer_profile?: any
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

        // Convert to array and sort chronologically (descending for table, ascending for charts)
        return Object.keys(monthMap).sort().map(key => monthMap[key])
    }, [sales])

    // Seller Leaderboard
    const sellerLeaderboard = useMemo(() => {
        const map = new Map<string, { id: string, name: string, leads: number, appts: number, sales: number, value: number, avatar?: string }>()
        
        filteredLeads.forEach(l => {
            const isAppt = (l.esito && l.esito.toLowerCase().includes('appuntamento')) || (l.closer_appt_status && l.closer_appt_status.toUpperCase() === 'FATTO')
            const isWon = l.closer_outcome === 'VINTA' || l.pipeline_stages?.is_won
            const val = Number(l.value) || 0

            const addStats = (id: string, profile: any) => {
                if (!map.has(id)) {
                    map.set(id, { id, name: profile?.full_name || profile?.email || 'Sconosciuto', avatar: profile?.avatar_url, leads: 0, appts: 0, sales: 0, value: 0 })
                }
                const s = map.get(id)!
                s.leads += 1
                if (isAppt) s.appts += 1
                if (isWon) {
                    s.sales += 1
                    s.value += val
                }
            }

            if (l.closer_id && l.setter_id && l.closer_id === l.setter_id) {
                addStats(l.closer_id, l.closer_profile || l.setter_profile)
            } else {
                if (l.closer_id) addStats(l.closer_id, l.closer_profile)
                if (l.setter_id) addStats(l.setter_id, l.setter_profile)
            }
        })
        return Array.from(map.values()).sort((a, b) => b.value - a.value || b.sales - a.sales)
    }, [filteredLeads])

    // Per Monthly Table (aggregate leads and appts too)
    const monthlyTableData = useMemo(() => {
        const monthMap: Record<string, { monthKey: string, leads: number, appts: number, sales: number, value: number }> = {}
        filteredLeads.forEach(l => {
            const date = new Date(l.created_at)
            const monthKey = date.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' })
            const sortKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`

            if (!monthMap[sortKey]) {
                monthMap[sortKey] = { monthKey: monthKey.charAt(0).toUpperCase() + monthKey.slice(1), leads: 0, appts: 0, sales: 0, value: 0 }
            }
            monthMap[sortKey].leads += 1
            
            const isAppt = (l.esito && l.esito.toLowerCase().includes('appuntamento')) || (l.closer_appt_status && l.closer_appt_status.toUpperCase() === 'FATTO')
            if (isAppt) monthMap[sortKey].appts += 1

            const isWon = l.closer_outcome === 'VINTA' || l.pipeline_stages?.is_won
            if (isWon) {
                monthMap[sortKey].sales += 1
                monthMap[sortKey].value += Number(l.value) || 0
            }
        })
        return Object.keys(monthMap).sort((a, b) => b.localeCompare(a)).map(key => monthMap[key])
    }, [filteredLeads])

    const formatCurrency = (v: number) =>
        new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v)

    const CustomTooltipCount = ({ active, payload, label }: any) => {
        if (active && payload?.length) {
            return (
                <div className="glass-card p-3" style={{ background: 'var(--glass-bg)', borderColor: 'rgba(255,255,255,0.1)' }}>
                    <p className="text-xs font-bold th-heading mb-1">{label}</p>
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
                    <p className="text-xs font-bold th-heading mb-1">{label}</p>
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
                    <div className="text-3xl font-black th-heading">{assignedLeads.length}</div>
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
                    <div className="text-3xl font-black th-heading">{appointments.length}</div>
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
                    <div className="text-3xl font-black th-heading">{sales.length}</div>
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
            {monthlyData.length > 0 && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {/* Volume Vendite Chart */}
                    <div className="glass-card p-6">
                        <h3 className="text-sm font-bold th-heading mb-6 flex items-center gap-2">
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
                        <h3 className="text-sm font-bold th-heading mb-6 flex items-center gap-2">
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
            )}
            {/* Additional Data Tables */}
            {filteredLeads.length > 0 && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-6">
                    {/* Leaderboard Venditori */}
                    <div className="glass-card overflow-hidden">
                        <div className="p-5 border-b" style={{ borderColor: 'var(--color-surface-200)' }}>
                            <h3 className="text-sm font-bold th-heading flex items-center gap-2">
                                <Users className="w-4 h-4" style={{ color: '#06b6d4' }} />
                                Performance per Venditore
                            </h3>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead style={{ background: 'var(--color-surface-50)' }}>
                                    <tr>
                                        <th className="px-5 py-3 font-medium" style={{ color: 'var(--color-surface-500)' }}>Nome</th>
                                        <th className="px-5 py-3 font-medium text-center" style={{ color: 'var(--color-surface-500)' }}>Leads</th>
                                        <th className="px-5 py-3 font-medium text-center" style={{ color: 'var(--color-surface-500)' }}>Appt</th>
                                        <th className="px-5 py-3 font-medium text-center" style={{ color: 'var(--color-surface-500)' }}>Vendite</th>
                                        <th className="px-5 py-3 font-medium text-right" style={{ color: 'var(--color-surface-500)' }}>Valore</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y" style={{ borderColor: 'var(--color-surface-200)' }}>
                                    {sellerLeaderboard.map(seller => (
                                        <tr key={seller.id} className="hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                                            <td className="px-5 py-3 font-semibold th-heading flex items-center gap-2">
                                                {seller.avatar ? (
                                                    <img src={seller.avatar} alt={seller.name} className="w-6 h-6 rounded-full" />
                                                ) : (
                                                    <div className="w-6 h-6 rounded-full bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center text-[10px]">
                                                        {seller.name.charAt(0)}
                                                    </div>
                                                )}
                                                {seller.name}
                                            </td>
                                            <td className="px-5 py-3 text-center" style={{ color: 'var(--color-surface-600)' }}>{seller.leads}</td>
                                            <td className="px-5 py-3 text-center text-orange-500 font-medium">{seller.appts}</td>
                                            <td className="px-5 py-3 text-center text-purple-500 font-medium">{seller.sales}</td>
                                            <td className="px-5 py-3 text-right text-green-500 font-bold">{formatCurrency(seller.value)}</td>
                                        </tr>
                                    ))}
                                    {sellerLeaderboard.length === 0 && (
                                        <tr>
                                            <td colSpan={5} className="px-5 py-8 text-center" style={{ color: 'var(--color-surface-500)' }}>
                                                Nessun venditore assegnato in questo periodo.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Dati Mensili Tabellari */}
                    <div className="glass-card overflow-hidden">
                        <div className="p-5 border-b" style={{ borderColor: 'var(--color-surface-200)' }}>
                            <h3 className="text-sm font-bold th-heading flex items-center gap-2">
                                <CalendarIcon className="w-4 h-4" style={{ color: '#f59e0b' }} />
                                Dati Tabellari per Mese
                            </h3>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead style={{ background: 'var(--color-surface-50)' }}>
                                    <tr>
                                        <th className="px-5 py-3 font-medium" style={{ color: 'var(--color-surface-500)' }}>Mese</th>
                                        <th className="px-5 py-3 font-medium text-center" style={{ color: 'var(--color-surface-500)' }}>Leads</th>
                                        <th className="px-5 py-3 font-medium text-center" style={{ color: 'var(--color-surface-500)' }}>Appt</th>
                                        <th className="px-5 py-3 font-medium text-center" style={{ color: 'var(--color-surface-500)' }}>Vendite</th>
                                        <th className="px-5 py-3 font-medium text-right" style={{ color: 'var(--color-surface-500)' }}>Valore</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y" style={{ borderColor: 'var(--color-surface-200)' }}>
                                    {monthlyTableData.map(row => (
                                        <tr key={row.monthKey} className="hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                                            <td className="px-5 py-3 font-semibold th-heading">{row.monthKey}</td>
                                            <td className="px-5 py-3 text-center" style={{ color: 'var(--color-surface-600)' }}>{row.leads}</td>
                                            <td className="px-5 py-3 text-center text-orange-500 font-medium">{row.appts}</td>
                                            <td className="px-5 py-3 text-center text-purple-500 font-medium">{row.sales}</td>
                                            <td className="px-5 py-3 text-right text-green-500 font-bold">{formatCurrency(row.value)}</td>
                                        </tr>
                                    ))}
                                    {monthlyTableData.length === 0 && (
                                        <tr>
                                            <td colSpan={5} className="px-5 py-8 text-center" style={{ color: 'var(--color-surface-500)' }}>
                                                Nessun dato mensile disponibile.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}
            
            {monthlyData.length === 0 && filteredLeads.length === 0 && (
                <div className="glass-card p-12 flex flex-col items-center justify-center text-center mt-6">
                    <div className="w-16 h-16 rounded-full bg-white/5 border border-zinc-200 dark:border-zinc-800 flex items-center justify-center mb-4 th-heading">
                        <Target className="w-8 h-8" />
                    </div>
                    <h3 className="text-lg font-bold th-heading mb-2">Nessun dato disponibile</h3>
                    <p className="text-sm" style={{ color: 'var(--color-surface-500)' }}>
                        Non ci sono leads o vendite nel periodo selezionato.
                    </p>
                </div>
            )}
        </div>
    )
}
