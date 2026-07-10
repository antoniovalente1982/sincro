'use client'

interface Props {
    requested: number
    max: number
    called: number
    converted: number
    spins: number
}

export default function DailyProgressBar({ requested, max, called, converted, spins }: Props) {
    const pct = max > 0 ? Math.min(100, Math.round((requested / max) * 100)) : 0
    const calledPct = requested > 0 ? Math.round((called / requested) * 100) : 0

    const barColor = pct < 50 ? '#22c55e' : pct < 80 ? '#f59e0b' : '#ef4444'

    return (
        <div
            className="glass-card"
            style={{
                padding: '16px 18px',
                borderRadius: '16px',
                border: '1px solid var(--color-surface-200)',
            }}
        >
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <div>
                    <span style={{ fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--color-surface-500)' }}>
                        Quota Giornaliera
                    </span>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', marginTop: '2px' }}>
                        <span style={{ fontSize: '22px', fontWeight: '800', color: barColor, lineHeight: 1 }}>
                            {requested}
                        </span>
                        <span style={{ fontSize: '14px', color: 'var(--color-surface-400)', fontWeight: '500' }}>
                            / {max}
                        </span>
                        <span style={{ fontSize: '11px', color: 'var(--color-surface-500)', marginLeft: '4px' }}>
                            leads
                        </span>
                    </div>
                </div>
                <div style={{
                    fontSize: '28px', fontWeight: '900',
                    color: barColor,
                    fontVariantNumeric: 'tabular-nums',
                    lineHeight: 1,
                }}>
                    {pct}%
                </div>
            </div>

            {/* Progress bar */}
            <div style={{
                height: '8px', borderRadius: '999px',
                background: 'var(--color-surface-200)',
                overflow: 'hidden',
                marginBottom: '12px',
            }}>
                <div style={{
                    height: '100%',
                    width: `${pct}%`,
                    borderRadius: '999px',
                    background: `linear-gradient(90deg, ${barColor}cc, ${barColor})`,
                    transition: 'width 0.6s cubic-bezier(0.25, 0.8, 0.25, 1)',
                    boxShadow: `0 0 8px ${barColor}60`,
                }} />
            </div>

            {/* Stats row */}
            <div style={{ display: 'flex', gap: '0', borderTop: '1px solid var(--color-surface-200)', paddingTop: '10px' }}>
                {[
                    { label: 'Chiamate', value: called, color: '#3b82f6', emoji: '📞' },
                    { label: 'Conversioni', value: converted, color: '#22c55e', emoji: '💎' },
                    { label: 'Tasso chiamata', value: `${calledPct}%`, color: '#a855f7', emoji: '📊' },
                    { label: 'Spin totali', value: spins, color: '#f59e0b', emoji: '🎰' },
                ].map((stat, i) => (
                    <div key={i} style={{
                        flex: 1, textAlign: 'center', padding: '0 4px',
                        borderRight: i < 3 ? '1px solid var(--color-surface-200)' : 'none',
                    }}>
                        <div style={{ fontSize: '9px', color: 'var(--color-surface-400)', marginBottom: '2px' }}>
                            {stat.emoji}
                        </div>
                        <div style={{ fontSize: '16px', fontWeight: '700', color: stat.color, lineHeight: 1 }}>
                            {stat.value}
                        </div>
                        <div style={{ fontSize: '9px', color: 'var(--color-surface-500)', marginTop: '2px', lineHeight: 1.2 }}>
                            {stat.label}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}
