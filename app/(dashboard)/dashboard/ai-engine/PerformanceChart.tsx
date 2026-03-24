'use client'

import { useState, useEffect, useMemo } from 'react'
import { BarChart3, TrendingUp, Target, Zap, Calendar } from 'lucide-react'

interface Props {
    orgId: string
}

interface DataPoint {
    date: string
    spend: number
    leads: number
    cpl: number
    ctr: number
    rules_triggered: number
    kills: number
    winners: number
    scale_ups: number
}

export default function PerformanceChart({ orgId }: Props) {
    const [data, setData] = useState<DataPoint[]>([])
    const [period, setPeriod] = useState<'7d' | '14d' | '30d'>('7d')
    const [loading, setLoading] = useState(true)
    const [metric, setMetric] = useState<'cpl' | 'leads' | 'ctr' | 'rules_triggered'>('cpl')

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true)
            try {
                const res = await fetch('/api/ai-engine', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'get_performance_trend', period }),
                })
                const json = await res.json()
                setData(json.trend || [])
            } catch { }
            setLoading(false)
        }
        fetchData()
    }, [period])

    const maxVal = useMemo(() => {
        if (data.length === 0) return 1
        return Math.max(...data.map(d => d[metric] || 0), 1)
    }, [data, metric])

    const avgVal = useMemo(() => {
        if (data.length === 0) return 0
        return data.reduce((s, d) => s + (d[metric] || 0), 0) / data.length
    }, [data, metric])

    const trend = useMemo(() => {
        if (data.length < 3) return 0
        const first3 = data.slice(0, 3).reduce((s, d) => s + (d[metric] || 0), 0) / 3
        const last3 = data.slice(-3).reduce((s, d) => s + (d[metric] || 0), 0) / 3
        if (first3 === 0) return 0
        return ((last3 - first3) / first3) * 100
    }, [data, metric])

    const metricConfig: Record<string, { label: string; color: string; format: (v: number) => string; goodDirection: 'up' | 'down' }> = {
        cpl: { label: 'CPL', color: '#f59e0b', format: v => `€${v.toFixed(2)}`, goodDirection: 'down' },
        leads: { label: 'Lead', color: '#22c55e', format: v => String(Math.round(v)), goodDirection: 'up' },
        ctr: { label: 'CTR %', color: '#3b82f6', format: v => `${v.toFixed(2)}%`, goodDirection: 'up' },
        rules_triggered: { label: 'Regole', color: '#a855f7', format: v => String(Math.round(v)), goodDirection: 'down' },
    }

    const cfg = metricConfig[metric]
    const isGoodTrend = (cfg.goodDirection === 'up' && trend > 0) || (cfg.goodDirection === 'down' && trend < 0)

    return (
        <div className="glass-card p-5">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <BarChart3 className="w-4 h-4" style={{ color: '#818cf8' }} />
                    Performance AI Engine
                </h3>
                <div className="flex gap-1.5">
                    {(['7d', '14d', '30d'] as const).map(p => (
                        <button key={p} onClick={() => setPeriod(p)}
                            className="text-[10px] px-2 py-1 rounded-lg transition-all font-semibold" style={{
                                background: period === p ? 'rgba(129, 140, 248, 0.15)' : 'transparent',
                                color: period === p ? '#818cf8' : 'var(--color-surface-500)',
                                border: `1px solid ${period === p ? 'rgba(129, 140, 248, 0.3)' : 'transparent'}`,
                            }}>{p === '7d' ? '7 gg' : p === '14d' ? '14 gg' : '30 gg'}</button>
                    ))}
                </div>
            </div>

            {/* Metric selector */}
            <div className="flex gap-1.5 mb-4">
                {Object.entries(metricConfig).map(([key, cfg]) => (
                    <button key={key} onClick={() => setMetric(key as any)}
                        className="text-[10px] px-2.5 py-1 rounded-lg transition-all font-semibold" style={{
                            background: metric === key ? `${cfg.color}15` : 'transparent',
                            color: metric === key ? cfg.color : 'var(--color-surface-500)',
                            border: `1px solid ${metric === key ? `${cfg.color}30` : 'transparent'}`,
                        }}>{cfg.label}</button>
                ))}
            </div>

            {/* Summary stats */}
            <div className="flex items-center gap-4 mb-4">
                <div>
                    <div className="text-[10px] uppercase font-semibold" style={{ color: 'var(--color-surface-600)' }}>Media</div>
                    <div className="text-lg font-bold" style={{ color: cfg.color }}>{cfg.format(avgVal)}</div>
                </div>
                <div>
                    <div className="text-[10px] uppercase font-semibold" style={{ color: 'var(--color-surface-600)' }}>Trend</div>
                    <div className="text-lg font-bold flex items-center gap-1" style={{
                        color: trend === 0 ? 'var(--color-surface-500)' : isGoodTrend ? '#22c55e' : '#ef4444',
                    }}>
                        {trend > 0 ? '+' : ''}{trend.toFixed(1)}%
                        {trend !== 0 && <TrendingUp className="w-4 h-4" style={{
                            transform: trend < 0 ? 'rotate(180deg)' : undefined,
                        }} />}
                    </div>
                </div>
                <div>
                    <div className="text-[10px] uppercase font-semibold" style={{ color: 'var(--color-surface-600)' }}>Punti dati</div>
                    <div className="text-lg font-bold text-white">{data.length}</div>
                </div>
            </div>

            {/* Chart */}
            <div className="relative h-32">
                {loading ? (
                    <div className="absolute inset-0 flex items-center justify-center">
                        <div className="text-xs" style={{ color: 'var(--color-surface-500)' }}>Caricamento...</div>
                    </div>
                ) : data.length === 0 ? (
                    <div className="absolute inset-0 flex items-center justify-center">
                        <div className="text-xs text-center" style={{ color: 'var(--color-surface-500)' }}>
                            Nessun dato disponibile.<br />Clicca "Valuta Regole" per generare il primo snapshot.
                        </div>
                    </div>
                ) : (
                    <div className="flex items-end gap-[2px] h-full">
                        {data.map((d, i) => {
                            const val = d[metric] || 0
                            const h = maxVal > 0 ? (val / maxVal) * 100 : 0
                            return (
                                <div key={i} className="flex-1 flex flex-col items-center group relative">
                                    <div className="w-full rounded-t-sm transition-all cursor-pointer" style={{
                                        height: `${Math.max(h, 2)}%`,
                                        background: `${cfg.color}40`,
                                        borderTop: `2px solid ${cfg.color}`,
                                    }} />
                                    {/* Tooltip */}
                                    <div className="absolute bottom-full mb-2 hidden group-hover:block z-20">
                                        <div className="p-2 rounded-lg shadow-xl text-[10px] whitespace-nowrap" style={{
                                            background: 'var(--color-surface-200)', border: '1px solid var(--color-surface-300)',
                                        }}>
                                            <div className="font-bold text-white">{cfg.format(val)}</div>
                                            <div style={{ color: 'var(--color-surface-500)' }}>{d.date}</div>
                                            {d.rules_triggered > 0 && metric !== 'rules_triggered' && (
                                                <div style={{ color: '#a855f7' }}>⚡ {d.rules_triggered} regole</div>
                                            )}
                                        </div>
                                    </div>
                                    {/* Date label (show every few) */}
                                    {(i === 0 || i === data.length - 1 || i === Math.floor(data.length / 2)) && (
                                        <div className="text-[8px] mt-1 absolute -bottom-4" style={{ color: 'var(--color-surface-600)' }}>
                                            {d.date.slice(5)}
                                        </div>
                                    )}
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>

            {/* AI Learning summary */}
            {data.length > 3 && (
                <div className="mt-6 p-3 rounded-xl text-xs" style={{
                    background: 'rgba(129, 140, 248, 0.05)', border: '1px solid rgba(129, 140, 248, 0.15)',
                }}>
                    <div className="flex items-center gap-1.5 mb-1">
                        <Zap className="w-3.5 h-3.5" style={{ color: '#818cf8' }} />
                        <span className="font-bold text-white">AI Learning Insight</span>
                    </div>
                    <div style={{ color: 'var(--color-surface-500)' }}>
                        {isGoodTrend
                            ? `📈 ${cfg.label} sta migliorando (${trend > 0 ? '+' : ''}${trend.toFixed(1)}%). Le regole stanno funzionando. Continua così.`
                            : trend === 0
                            ? `📊 ${cfg.label} stabile. Considera di testare nuovi angoli creative per spingere le performance.`
                            : `⚠️ ${cfg.label} in peggioramento (${trend.toFixed(1)}%). Valuta di ruotare le creative o rivedere il targeting.`
                        }
                    </div>
                </div>
            )}
        </div>
    )
}
