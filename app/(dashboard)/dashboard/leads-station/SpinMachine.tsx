'use client'

import { useEffect, useRef } from 'react'

interface Props {
    state: 'idle' | 'spinning' | 'done'
    batchSize: number
}

// Simboli per i rulli (lead-themed)
const SYMBOLS = ['📞', '🎯', '💰', '⭐', '🔥', '✅', '💎', '🚀']

export default function SpinMachine({ state, batchSize }: Props) {
    const reel1Ref = useRef<HTMLDivElement>(null)
    const reel2Ref = useRef<HTMLDivElement>(null)
    const reel3Ref = useRef<HTMLDivElement>(null)

    useEffect(() => {
        const reels = [reel1Ref, reel2Ref, reel3Ref]
        reels.forEach((ref, i) => {
            if (!ref.current) return
            if (state === 'spinning') {
                ref.current.style.animation = `reelSpin ${0.15 + i * 0.05}s linear infinite`
                ref.current.style.animationDelay = `${i * 0.1}s`
            } else {
                ref.current.style.animation = 'none'
                ref.current.style.transform = 'translateY(0)'
            }
        })
    }, [state])

    return (
        <div>
            <style>{`
                @keyframes reelSpin {
                    0%   { transform: translateY(0); }
                    25%  { transform: translateY(-60px); }
                    50%  { transform: translateY(-120px); }
                    75%  { transform: translateY(-60px); }
                    100% { transform: translateY(0); }
                }
                @keyframes winGlow {
                    0%, 100% { box-shadow: 0 0 20px rgba(168,85,247,0.3); }
                    50%       { box-shadow: 0 0 40px rgba(168,85,247,0.7), 0 0 80px rgba(168,85,247,0.3); }
                }
            `}</style>

            {/* Titolo */}
            <div style={{ marginBottom: '8px' }}>
                <span style={{
                    fontSize: '11px', fontWeight: '600', letterSpacing: '0.15em',
                    textTransform: 'uppercase', color: 'var(--color-surface-500)',
                }}>
                    {state === 'idle' ? 'Pronto al prossimo spin' :
                        state === 'spinning' ? 'Estrazione in corso...' : 'Leads trovati!'}
                </span>
            </div>

            {/* Slot machine frame */}
            <div style={{
                display: 'flex', justifyContent: 'center', gap: '8px',
                padding: '16px',
                borderRadius: '16px',
                background: 'var(--color-surface-100)',
                border: '2px solid var(--color-surface-200)',
                animation: state === 'done' ? 'winGlow 0.8s ease-in-out' : 'none',
            }}>
                {[reel1Ref, reel2Ref, reel3Ref].map((ref, idx) => (
                    <div
                        key={idx}
                        style={{
                            width: '72px', height: '72px',
                            borderRadius: '12px',
                            overflow: 'hidden',
                            background: 'var(--color-surface-0)',
                            border: '1px solid var(--color-surface-300)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            position: 'relative',
                            boxShadow: 'inset 0 2px 8px rgba(0,0,0,0.08)',
                        }}
                    >
                        <div ref={ref} style={{
                            fontSize: '2rem',
                            transition: state !== 'spinning' ? 'transform 0.3s' : 'none',
                            willChange: 'transform',
                        }}>
                            {SYMBOLS[idx % SYMBOLS.length]}
                        </div>
                        {/* Fade top & bottom */}
                        <div style={{
                            position: 'absolute', inset: 0,
                            background: 'linear-gradient(to bottom, var(--color-surface-0) 0%, transparent 30%, transparent 70%, var(--color-surface-0) 100%)',
                            pointerEvents: 'none',
                        }} />
                    </div>
                ))}
            </div>

            {/* Batch size indicator */}
            <div style={{
                marginTop: '10px',
                display: 'flex', justifyContent: 'center', gap: '6px',
            }}>
                {Array.from({ length: batchSize }).map((_, i) => (
                    <div key={i} style={{
                        width: '8px', height: '8px', borderRadius: '50%',
                        background: state === 'done' ? '#a855f7' : 'var(--color-surface-300)',
                        transition: `background 0.3s ${i * 0.1}s`,
                        boxShadow: state === 'done' ? '0 0 6px rgba(168,85,247,0.5)' : 'none',
                    }} />
                ))}
            </div>
        </div>
    )
}
