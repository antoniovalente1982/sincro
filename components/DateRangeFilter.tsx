'use client'

import { useState, useMemo, useRef, useEffect } from 'react'
import { Calendar, ChevronDown } from 'lucide-react'

export type DateRange = {
    from: Date
    to: Date
    label: string
    key: string
}

export const PRESETS = [
    { key: 'today',        label: 'Oggi' },
    { key: 'yesterday',    label: 'Ieri' },
    { key: 'this_week',    label: 'Settimana corrente' },
    { key: '7d',           label: 'Ultimi 7 giorni' },
    { key: 'this_month',   label: 'Mese corrente' },
    { key: '30d',          label: 'Ultimi 30 giorni' },
    { key: 'all',          label: 'Tutto' },
    { key: 'custom',       label: '📅 Personalizzato...' },
] as const

export type PresetKey = typeof PRESETS[number]['key']

function getPresetRange(key: string): { from: Date; to: Date } {
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())

    const addDays = (d: Date, days: number) => {
        const copy = new Date(d)
        copy.setDate(copy.getDate() + days)
        return copy
    }

    const tomorrow = addDays(today, 1)

    switch (key) {
        case 'today':
            return { from: today, to: tomorrow }

        case 'yesterday': {
            const yest = addDays(today, -1)
            return { from: yest, to: today }
        }

        case 'this_week': {
            // Monday of current week
            const dow = today.getDay() // 0=Sun
            const diff = dow === 0 ? -6 : 1 - dow
            const monday = addDays(today, diff)
            return { from: monday, to: tomorrow }
        }

        case '7d':
            return { from: addDays(today, -7), to: tomorrow }

        case 'this_month': {
            // From 1st of current month to end of today
            const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
            return { from: firstOfMonth, to: tomorrow }
        }

        case '30d':
            return { from: addDays(today, -30), to: tomorrow }

        case 'all':
        default:
            return { from: new Date(2020, 0, 1), to: tomorrow }
    }
}

export function useDateRange(defaultKey: string = 'this_month') {
    const [activeKey, setActiveKey] = useState(defaultKey)
    const [customFrom, setCustomFrom] = useState('')
    const [customTo, setCustomTo] = useState('')

    const range: DateRange = useMemo(() => {
        if (activeKey === 'custom' && customFrom && customTo) {
            const endOfDay = new Date(customTo)
            endOfDay.setDate(endOfDay.getDate() + 1)
            return {
                from: new Date(customFrom),
                to: endOfDay,
                label: `${customFrom} — ${customTo}`,
                key: 'custom',
            }
        }
        const preset = PRESETS.find(p => p.key === activeKey) || PRESETS[6]
        if (preset.key === 'custom') {
            // custom not yet filled — fall back to all
            const { from, to } = getPresetRange('all')
            return { from, to, label: 'Tutto', key: 'all' }
        }
        const { from, to } = getPresetRange(preset.key)
        return { from, to, label: preset.label, key: preset.key }
    }, [activeKey, customFrom, customTo])

    return { range, activeKey, setActiveKey, customFrom, setCustomFrom, customTo, setCustomTo }
}

export function filterByDateRange<T>(items: T[], range: DateRange, dateField: keyof T): T[] {
    if (range.key === 'all') return items
    return items.filter(item => {
        const d = new Date(item[dateField] as any)
        return d >= range.from && d < range.to
    })
}

// ─── Component ────────────────────────────────────────────────────────────────

interface DateRangeFilterProps {
    activeKey: string
    onSelect: (key: string) => void
    customFrom: string
    customTo: string
    onCustomFromChange: (v: string) => void
    onCustomToChange: (v: string) => void
}

export default function DateRangeFilter({
    activeKey, onSelect, customFrom, customTo, onCustomFromChange, onCustomToChange
}: DateRangeFilterProps) {
    const [open, setOpen] = useState(false)
    const [showCustomInputs, setShowCustomInputs] = useState(activeKey === 'custom')
    const ref = useRef<HTMLDivElement>(null)

    // Close on outside click
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
        }
        document.addEventListener('mousedown', handler)
        return () => document.removeEventListener('mousedown', handler)
    }, [])

    const activePreset = PRESETS.find(p => p.key === activeKey)
    const displayLabel = activeKey === 'custom' && customFrom && customTo
        ? `${customFrom} → ${customTo}`
        : activePreset?.label || 'Periodo'

    const handleSelect = (key: string) => {
        if (key === 'custom') {
            setShowCustomInputs(true)
            onSelect('custom')
            // keep open to show date inputs
        } else {
            setShowCustomInputs(false)
            onSelect(key)
            setOpen(false)
        }
    }

    return (
        <div ref={ref} className="relative" style={{ userSelect: 'none' }}>
            {/* Trigger button */}
            <button
                onClick={() => setOpen(v => !v)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap"
                style={{
                    background: open || activeKey !== 'all' ? 'rgba(99,102,241,0.12)' : 'transparent',
                    color: open || activeKey !== 'all' ? '#818cf8' : 'var(--color-surface-600)',
                    border: `1px solid ${open || activeKey !== 'all' ? 'rgba(99,102,241,0.30)' : 'var(--color-surface-300)'}`,
                }}
            >
                <Calendar className="w-3 h-3 flex-shrink-0" />
                <span style={{ maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis' }}>{displayLabel}</span>
                <ChevronDown
                    className="w-3 h-3 flex-shrink-0 transition-transform"
                    style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}
                />
            </button>

            {/* Dropdown */}
            {open && (
                <div
                    className="absolute right-0 top-full mt-1.5 z-50 animate-fade-in"
                    style={{
                        background: 'rgba(15,15,19,0.97)',
                        border: '1px solid rgba(99,102,241,0.15)',
                        borderRadius: 12,
                        boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
                        minWidth: 200,
                        padding: '6px',
                    }}
                >
                    {PRESETS.map(p => {
                        const isActive = activeKey === p.key
                        return (
                            <button
                                key={p.key}
                                onClick={() => handleSelect(p.key)}
                                className="w-full text-left px-3 py-2 rounded-lg text-xs font-semibold transition-all flex items-center justify-between"
                                style={{
                                    background: isActive ? 'rgba(99,102,241,0.15)' : 'transparent',
                                    color: isActive ? '#818cf8' : 'var(--color-surface-600)',
                                }}
                            >
                                {p.label}
                                {isActive && (
                                    <span style={{ color: '#818cf8', fontSize: 10 }}>✓</span>
                                )}
                            </button>
                        )
                    })}

                    {/* Custom date inputs — shown inline when selected */}
                    {showCustomInputs && (
                        <div
                            className="space-y-2 mt-1 pt-2"
                            style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}
                        >
                            <div className="px-1">
                                <label className="text-[10px] font-semibold block mb-1" style={{ color: 'var(--color-surface-500)' }}>Da</label>
                                <input
                                    type="date"
                                    className="input text-xs !py-1"
                                    value={customFrom}
                                    onChange={e => onCustomFromChange(e.target.value)}
                                />
                            </div>
                            <div className="px-1">
                                <label className="text-[10px] font-semibold block mb-1" style={{ color: 'var(--color-surface-500)' }}>A</label>
                                <input
                                    type="date"
                                    className="input text-xs !py-1"
                                    value={customTo}
                                    onChange={e => onCustomToChange(e.target.value)}
                                />
                            </div>
                            <div className="px-1 pb-1">
                                <button
                                    className="btn-primary w-full text-xs !py-1.5"
                                    onClick={() => {
                                        if (customFrom && customTo) {
                                            onSelect('custom')
                                            setOpen(false)
                                        }
                                    }}
                                >
                                    Applica
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
