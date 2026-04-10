'use client'

import { useState } from 'react'
import { Info, X, Sparkles } from 'lucide-react'

export interface HowItWorksStep {
    emoji: string
    title: string
    description: string
}

interface Props {
    title?: string
    steps: HowItWorksStep[]
    /** Optional footer note */
    footer?: string
    /** Compact mode: smaller button */
    compact?: boolean
}

/**
 * HowItWorks — Componente riutilizzabile per spiegare come funziona ogni sezione.
 * 
 * Uso: definisci gli step inline nella pagina, così restano co-locati col codice
 * e vengono aggiornati automaticamente quando cambi la logica.
 * 
 * Esempio:
 * ```tsx
 * <HowItWorks steps={[
 *   { emoji: '📊', title: 'Analisi', description: 'Il sistema analizza i dati...' },
 *   { emoji: '🧠', title: 'AI Engine', description: 'L\'AI genera...' },
 * ]} />
 * ```
 */
export default function HowItWorks({ title = 'Come Funziona', steps, footer, compact }: Props) {
    const [open, setOpen] = useState(false)

    return (
        <>
            {/* Trigger Button */}
            <button
                onClick={() => setOpen(true)}
                className={`flex items-center gap-1.5 font-semibold rounded-xl transition-all hover:scale-105 ${compact ? 'text-[10px] px-2.5 py-1.5' : 'text-xs px-3 py-2'}`}
                style={{
                    background: 'rgba(99, 102, 241, 0.08)',
                    border: '1px solid rgba(99, 102, 241, 0.25)',
                    color: '#6366f1',
                }}
            >
                <Info className={compact ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
                {title}
            </button>

            {/* Modal */}
            {open && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center"
                    style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}
                    onClick={() => setOpen(false)}
                >
                    <div
                        className="glass-card p-6 w-full max-w-lg mx-4 animate-fade-in max-h-[85vh] overflow-y-auto"
                        onClick={e => e.stopPropagation()}
                        style={{ background: 'var(--color-surface-50)', border: '1px solid rgba(99, 102, 241, 0.3)' }}
                    >
                        {/* Header */}
                        <div className="flex items-center gap-3 mb-5">
                            <div
                                className="w-10 h-10 rounded-xl flex items-center justify-center"
                                style={{ background: 'rgba(99, 102, 241, 0.1)', border: '1px solid rgba(99, 102, 241, 0.2)' }}
                            >
                                <Sparkles className="w-5 h-5" style={{ color: '#6366f1' }} />
                            </div>
                            <div>
                                <h3 className="text-base font-bold text-white">{title}</h3>
                                <p className="text-xs" style={{ color: 'var(--color-surface-500)' }}>
                                    Guida rapida di questa sezione
                                </p>
                            </div>
                            <button onClick={() => setOpen(false)} className="ml-auto text-[var(--color-surface-500)] hover:text-white transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Steps */}
                        <div className="space-y-3">
                            {steps.map((step, i) => (
                                <div
                                    key={i}
                                    className="flex gap-3 p-3 rounded-xl transition-all hover:scale-[1.01]"
                                    style={{
                                        background: 'var(--color-surface-100)',
                                        border: '1px solid var(--color-surface-200)',
                                    }}
                                >
                                    <div
                                        className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 text-lg"
                                        style={{
                                            background: `hsl(${(i * 50 + 240) % 360}, 60%, 15%)`,
                                            border: `1px solid hsl(${(i * 50 + 240) % 360}, 60%, 25%)`,
                                        }}
                                    >
                                        {step.emoji}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-0.5">
                                            <span
                                                className="text-[9px] font-bold uppercase tracking-wider"
                                                style={{ color: `hsl(${(i * 50 + 240) % 360}, 70%, 65%)` }}
                                            >
                                                Step {i + 1}
                                            </span>
                                        </div>
                                        <div className="text-sm font-semibold text-white">{step.title}</div>
                                        <div className="text-[11px] mt-0.5 leading-relaxed" style={{ color: 'var(--color-surface-500)' }}>
                                            {step.description}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Footer */}
                        {footer && (
                            <div className="mt-4 p-3 rounded-xl" style={{ background: 'rgba(34, 197, 94, 0.05)', border: '1px solid rgba(34, 197, 94, 0.1)' }}>
                                <div className="text-[10px] leading-relaxed" style={{ color: 'var(--color-surface-500)' }}>
                                    💡 {footer}
                                </div>
                            </div>
                        )}

                        {/* Close */}
                        <div className="mt-4 flex justify-end">
                            <button
                                onClick={() => setOpen(false)}
                                className="px-4 py-2 rounded-xl text-xs font-semibold transition-all hover:scale-105"
                                style={{
                                    background: 'rgba(99, 102, 241, 0.1)',
                                    border: '1px solid rgba(99, 102, 241, 0.2)',
                                    color: '#6366f1',
                                }}
                            >
                                Ho capito ✓
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    )
}
