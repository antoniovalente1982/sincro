'use client'

import { useState, useMemo } from 'react'
import { Calendar, ChevronDown } from 'lucide-react'

export type DateRange = {
    from: Date
    to: Date
    label: string
    key: string
}

const PRESETS = [
    { key: 'today', label: 'Oggi' },
    { key: 'yesterday', label: 'Ieri' },
    { key: '7d', label: '7 Giorni' },
    { key: '30d', label: '30 Giorni' },
    { key: 'all', label: 'Tutto' },
] as const

function getPresetRange(key: string): { from: Date; to: Date } {
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    
    // Robust date math using setDate to avoid DST bugs (23h or 25h days)
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
        case '7d':
            return { from: addDays(today, -7), to: tomorrow }
        case '30d':
            return { from: addDays(today, -30), to: tomorrow }
        case 'all':
            return { from: new Date(2020, 0, 1), to: tomorrow }
        default:
            return { from: new Date(2020, 0, 1), to: tomorrow }
    }
}

export function useDateRange(defaultKey: string = 'all') {
    const [activeKey, setActiveKey] = useState(defaultKey)
    const [customFrom, setCustomFrom] = useState('')
    const [customTo, setCustomTo] = useState('')

    const range: DateRange = useMemo(() => {
        if (activeKey === 'custom' && customFrom && customTo) {
            const endOfDay = new Date(customTo)
            endOfDay.setDate(endOfDay.getDate() + 1)
            
            return {
                from: new Date(customFrom),
                to: endOfDay, // end of day
                label: `${customFrom} — ${customTo}`,
                key: 'custom',
            }
        }
        const preset = PRESETS.find(p => p.key === activeKey) || PRESETS[4]
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
    const [showCustom, setShowCustom] = useState(false)

    return (
        <div className="flex items-center gap-1.5 flex-wrap">
            {PRESETS.map(p => (
                <button
                    key={p.key}
                    onClick={() => { onSelect(p.key); setShowCustom(false) }}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                    style={{
                        background: activeKey === p.key ? 'rgba(99, 102, 241, 0.15)' : 'transparent',
                        color: activeKey === p.key ? '#818cf8' : 'var(--color-surface-600)',
                        border: `1px solid ${activeKey === p.key ? 'rgba(99, 102, 241, 0.3)' : 'var(--color-surface-300)'}`,
                    }}
                >
                    {p.label}
                </button>
            ))}
            <div className="relative">
                <button
                    onClick={() => setShowCustom(!showCustom)}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                    style={{
                        background: activeKey === 'custom' ? 'rgba(99, 102, 241, 0.15)' : 'transparent',
                        color: activeKey === 'custom' ? '#818cf8' : 'var(--color-surface-600)',
                        border: `1px solid ${activeKey === 'custom' ? 'rgba(99, 102, 241, 0.3)' : 'var(--color-surface-300)'}`,
                    }}
                >
                    <Calendar className="w-3 h-3" />
                    {activeKey === 'custom' ? `${customFrom} → ${customTo}` : 'Custom'}
                    <ChevronDown className="w-3 h-3" />
                </button>
                {showCustom && (
                    <div className="absolute right-0 top-full mt-2 z-50 glass-card p-3 space-y-2 min-w-[240px] animate-fade-in">
                        <div>
                            <label className="text-[10px] font-semibold block mb-1" style={{ color: 'var(--color-surface-600)' }}>Da</label>
                            <input type="date" className="input text-xs !py-1.5" value={customFrom} onChange={e => onCustomFromChange(e.target.value)} />
                        </div>
                        <div>
                            <label className="text-[10px] font-semibold block mb-1" style={{ color: 'var(--color-surface-600)' }}>A</label>
                            <input type="date" className="input text-xs !py-1.5" value={customTo} onChange={e => onCustomToChange(e.target.value)} />
                        </div>
                        <button
                            className="btn-primary w-full text-xs !py-1.5"
                            onClick={() => {
                                if (customFrom && customTo) {
                                    onSelect('custom')
                                    setShowCustom(false)
                                }
                            }}
                        >
                            Applica
                        </button>
                    </div>
                )}
            </div>
        </div>
    )
}
