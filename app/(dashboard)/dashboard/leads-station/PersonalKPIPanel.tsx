'use client'

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'

interface Props {
    stats: any
}

export default function PersonalKPIPanel({ stats }: Props) {
    const kpi = stats?.kpi || {}
    const history = stats?.history || []

    const chartData = history.slice(-14).map((h: any) => ({
        date: new Date(h.date).toLocaleDateString('it-IT', { day: '2-digit', month: 'short' }),
        richiesti: h.requested,
        chiamate: h.called,
        conversioni: h.converted,
    }))

    const cards = [
        { label: '🔥 Streak', value: `${kpi.streak_days || 0}gg`, sub: 'giorni consecutivi', color: '#f97316' },
        { label: '📞 Tasso chiamata', value: `${kpi.call_rate || 0}%`, sub: 'ultimi 30 giorni', color: '#3b82f6' },
        { label: '💎 Conversioni', value: `${kpi.conversion_rate || 0}%`, sub: 'su leads chiamati', color: '#22c55e' },
        { label: '📋 Tot. leads 30gg', value: kpi.total_requested_30d || 0, sub: 'leads richiesti', color: '#a855f7' },
    ]

    return (
        <div
            className="glass-card"
            style={{
                padding: '20px 24px',
                borderRadius: '16px',
                border: '1px solid var(--color-surface-200)',
                marginBottom: '24px',
            }}
        >
            <h3 className="text-sm font-bold mb-4" style={{ color: 'var(--color-surface-700)' }}>
                📊 I tuoi KPI personali — ultimi 30 giorni
            </h3>

            {/* KPI Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '20px' }}>
                {cards.map((card, i) => (
                    <div key={i} style={{
                        padding: '14px 16px',
                        borderRadius: '12px',
                        background: 'var(--color-surface-100)',
                        border: `1px solid ${card.color}30`,
                        textAlign: 'center',
                    }}>
                        <div style={{ fontSize: '11px', color: 'var(--color-surface-500)', marginBottom: '4px' }}>
                            {card.label}
                        </div>
                        <div style={{ fontSize: '24px', fontWeight: '800', color: card.color, lineHeight: 1 }}>
                            {card.value}
                        </div>
                        <div style={{ fontSize: '10px', color: 'var(--color-surface-400)', marginTop: '4px' }}>
                            {card.sub}
                        </div>
                    </div>
                ))}
            </div>

            {/* Mini bar chart */}
            {chartData.length > 0 && (
                <div>
                    <p style={{ fontSize: '11px', color: 'var(--color-surface-500)', marginBottom: '8px' }}>
                        Ultimi 14 giorni — leads richiesti vs. chiamate
                    </p>
                    <ResponsiveContainer width="100%" height={100}>
                        <BarChart data={chartData} barSize={8} barGap={2}>
                            <XAxis
                                dataKey="date"
                                tick={{ fontSize: 9, fill: 'var(--color-surface-500)' }}
                                axisLine={false} tickLine={false}
                            />
                            <YAxis hide />
                            <Tooltip
                                contentStyle={{
                                    fontSize: '11px',
                                    background: 'var(--color-surface-50)',
                                    border: '1px solid var(--color-surface-200)',
                                    borderRadius: '8px',
                                }}
                                itemStyle={{ color: 'var(--color-surface-700)' }}
                            />
                            <Bar dataKey="richiesti" fill="#a855f7" radius={[3, 3, 0, 0]} opacity={0.6} name="Richiesti" />
                            <Bar dataKey="chiamate" fill="#3b82f6" radius={[3, 3, 0, 0]} name="Chiamate" />
                            <Bar dataKey="conversioni" fill="#22c55e" radius={[3, 3, 0, 0]} name="Conversioni" />
                        </BarChart>
                    </ResponsiveContainer>
                    <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', marginTop: '6px' }}>
                        {[
                            { color: '#a855f7', label: 'Richiesti' },
                            { color: '#3b82f6', label: 'Chiamate' },
                            { color: '#22c55e', label: 'Conversioni' },
                        ].map((l, i) => (
                            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <div style={{ width: '8px', height: '8px', borderRadius: '2px', background: l.color }} />
                                <span style={{ fontSize: '10px', color: 'var(--color-surface-500)' }}>{l.label}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {chartData.length === 0 && (
                <div style={{ textAlign: 'center', padding: '20px', color: 'var(--color-surface-400)', fontSize: '12px' }}>
                    Nessun dato ancora. Fai il primo spin!
                </div>
            )}
        </div>
    )
}
