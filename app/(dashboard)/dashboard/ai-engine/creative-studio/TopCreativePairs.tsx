'use client'

import { useState, useEffect, useCallback } from 'react'
import { Target, Megaphone, Loader2, RefreshCw, Info } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import DateRangeFilter, { useDateRange } from '@/components/DateRangeFilter'

interface TopPair {
    creative: string
    headline: string
    leads: number
    thumbnail_url?: string
}

// Format date as YYYY-MM-DD in LOCAL timezone (CET/CEST safe)
function formatLocalDate(d: Date): string {
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
}

export default function TopCreativePairs() {
    const { range, activeKey, setActiveKey, customFrom, setCustomFrom, customTo, setCustomTo } = useDateRange('7d')
    const [pairs, setPairs] = useState<TopPair[]>([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [lastSync, setLastSync] = useState<string | null>(null)

    const fetchPairs = useCallback(async (since: string, until: string) => {
        setLoading(true)
        setError(null)
        try {
            const supabase = createClient()
            const { data: { session } } = await supabase.auth.getSession()
            const res = await fetch(
                `/api/meta/insights?since=${since}&until=${until}&date_mode=created&_t=${Date.now()}`,
                {
                    headers: {
                        Authorization: `Bearer ${session?.access_token}`,
                        'Cache-Control': 'no-cache',
                    },
                }
            )
            const data = await res.json()
            if (data.success && data.topPairs) {
                setPairs(data.topPairs)
                setLastSync(new Date().toLocaleTimeString('it-IT'))
            } else {
                setError(data.error || 'Errore nel caricamento')
                setPairs([])
            }
        } catch (e: any) {
            setError(e.message || 'Errore di connessione')
            setPairs([])
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        if (activeKey === 'all') {
            setPairs([])
            setError(null)
            return
        }
        const since = formatLocalDate(range.from)
        const untilDate = new Date(range.to)
        untilDate.setDate(untilDate.getDate() - 1)
        const until = formatLocalDate(untilDate)
        fetchPairs(since, until)
    }, [activeKey, range.from.getTime(), range.to.getTime(), fetchPairs])

    const handleRefresh = () => {
        if (activeKey === 'all') return
        const since = formatLocalDate(range.from)
        const untilDate = new Date(range.to)
        untilDate.setDate(untilDate.getDate() - 1)
        const until = formatLocalDate(untilDate)
        fetchPairs(since, until)
    }

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: 'rgba(236, 72, 153, 0.12)', border: '1px solid rgba(236, 72, 153, 0.25)' }}>
                        <Target className="w-4 h-4" style={{ color: '#ec4899' }} />
                    </div>
                    <div>
                        <h2 className="text-base font-bold text-white">Top Creative & Headline per Lead</h2>
                        <p className="text-[11px]" style={{ color: 'var(--color-surface-500)' }}>
                            Combinazioni creative + headline ordinate per lead generati
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-3 flex-wrap">
                    <button
                        onClick={handleRefresh}
                        disabled={loading || activeKey === 'all'}
                        className="badge badge-info flex items-center gap-1.5 cursor-pointer hover:opacity-80 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
                        style={{ padding: '5px 12px', fontSize: '11px' }}
                    >
                        <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
                        {loading ? 'Caricamento...' : 'Aggiorna'}
                    </button>
                    <DateRangeFilter
                        activeKey={activeKey}
                        onSelect={setActiveKey}
                        customFrom={customFrom}
                        customTo={customTo}
                        onCustomFromChange={setCustomFrom}
                        onCustomToChange={setCustomTo}
                    />
                </div>
            </div>

            {/* Body */}
            <div className="glass-card overflow-hidden relative">
                {loading && (
                    <div className="absolute inset-0 z-10 flex items-center justify-center rounded-xl" style={{ background: 'rgba(15,15,19,0.7)', backdropFilter: 'blur(4px)' }}>
                        <Loader2 className="w-7 h-7 animate-spin" style={{ color: '#ec4899' }} />
                    </div>
                )}

                {/* Nota "Predefinita" */}
                <div className="flex items-start gap-2 px-4 pt-4 pb-2 rounded-t-xl" style={{ background: 'rgba(99,102,241,0.04)', borderBottom: '1px solid rgba(99,102,241,0.1)' }}>
                    <Info className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" style={{ color: '#6366f1' }} />
                    <p className="text-[11px]" style={{ color: 'var(--color-surface-500)' }}>
                        La headline <span className="font-semibold text-white">Predefinita</span> indica che il lead è arrivato senza una Dynamic Creative Headline passata via <code className="text-[10px] px-1 py-0.5 rounded" style={{ background: 'rgba(255,255,255,0.05)' }}>utm_content</code> (formato atteso: <code className="text-[10px] px-1 py-0.5 rounded" style={{ background: 'rgba(255,255,255,0.05)' }}>Nome Creative - T: Headline</code>). Controlla il template UTM sull'ad set Meta.
                    </p>
                </div>

                {activeKey === 'all' ? (
                    <div className="p-8 text-center">
                        <p className="text-sm" style={{ color: 'var(--color-surface-500)' }}>
                            ⏳ Seleziona un intervallo di tempo per visualizzare le Top Creative & Headline.
                        </p>
                    </div>
                ) : error ? (
                    <div className="p-4">
                        <div className="text-xs px-3 py-2 rounded-lg" style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)' }}>
                            ⚠️ {error}
                        </div>
                    </div>
                ) : pairs.length === 0 && !loading ? (
                    <div className="p-8 text-center">
                        <p className="text-sm" style={{ color: 'var(--color-surface-500)' }}>
                            Nessun dato per il periodo selezionato.
                        </p>
                    </div>
                ) : (
                    <div className="p-4 space-y-3">
                        {pairs.map((pair, idx) => (
                            <div
                                key={idx}
                                className="flex flex-col sm:flex-row sm:items-center gap-4 p-3 rounded-xl hover:bg-white/[0.02] transition-colors"
                                style={{ background: 'var(--color-surface-100)', border: '1px solid var(--color-surface-200)' }}
                            >
                                {/* Rank badge */}
                                <div className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black"
                                    style={{
                                        background: idx === 0 ? 'rgba(245,158,11,0.15)' : idx === 1 ? 'rgba(156,163,175,0.12)' : idx === 2 ? 'rgba(180,83,9,0.12)' : 'rgba(255,255,255,0.04)',
                                        color: idx === 0 ? '#f59e0b' : idx === 1 ? '#9ca3af' : idx === 2 ? '#b45309' : 'var(--color-surface-500)',
                                        border: `1px solid ${idx === 0 ? 'rgba(245,158,11,0.3)' : idx === 1 ? 'rgba(156,163,175,0.2)' : idx === 2 ? 'rgba(180,83,9,0.2)' : 'rgba(255,255,255,0.05)'}`,
                                    }}>
                                    {idx + 1}
                                </div>

                                {/* Thumbnail */}
                                {pair.thumbnail_url ? (
                                    <div className="w-14 h-14 rounded-lg overflow-hidden flex-shrink-0 relative" style={{ border: '1px solid rgba(255,255,255,0.05)' }}>
                                        <img src={pair.thumbnail_url} alt="Ad Creative" className="w-full h-full object-cover" />
                                    </div>
                                ) : (
                                    <div className="w-14 h-14 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
                                        <Megaphone className="w-5 h-5 opacity-20" />
                                    </div>
                                )}

                                {/* Info */}
                                <div className="flex-1 min-w-0">
                                    <div className="text-sm font-semibold text-white mb-1 flex items-start gap-2">
                                        <span style={{ color: 'var(--color-surface-500)', marginTop: '2px' }} className="text-[9px] uppercase tracking-wider font-bold flex-shrink-0">Headline</span>
                                        <span className="leading-tight">
                                            {pair.headline === 'Predefinita'
                                                ? <span style={{ color: 'var(--color-surface-500)', fontStyle: 'italic' }}>Predefinita <span className="text-[9px] font-normal">(nessuna dynamic headline)</span></span>
                                                : pair.headline
                                            }
                                        </span>
                                    </div>
                                    <div className="text-[11px] flex items-start gap-2" style={{ color: 'var(--color-surface-400)' }}>
                                        <span className="text-[9px] uppercase tracking-wider font-bold flex-shrink-0 mt-0.5">Creative</span>
                                        <span className="leading-tight">{pair.creative}</span>
                                    </div>
                                </div>

                                {/* Lead count */}
                                <div className="flex items-center gap-3 flex-shrink-0 px-2">
                                    <div className="text-xl font-bold" style={{ color: '#3b82f6' }}>{pair.leads}</div>
                                    <div className="text-[10px] uppercase font-semibold tracking-wider" style={{ color: 'var(--color-surface-500)' }}>Lead</div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Footer */}
                {lastSync && pairs.length > 0 && (
                    <div className="px-4 pb-3 text-[10px]" style={{ color: 'var(--color-surface-500)' }}>
                        📊 Dati live da Meta · Aggiornato: {lastSync}
                    </div>
                )}
            </div>
        </div>
    )
}
