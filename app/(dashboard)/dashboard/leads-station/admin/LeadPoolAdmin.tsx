'use client'

import { useState, useCallback } from 'react'
import Link from 'next/link'
import { ArrowLeft, Upload, Settings, Users, BarChart3, Trash2, RefreshCw, ToggleLeft, ToggleRight } from 'lucide-react'
import FileImportWizard from './FileImportWizard'
import QuotaManager from './QuotaManager'

interface Props {
    orgId: string
    initialLists: any[]
    initialRules: any[]
    closers: { user_id: string; role: string; profile: any }[]
    todayQuotas: any[]
}

export default function LeadPoolAdmin({ orgId, initialLists, initialRules, closers, todayQuotas }: Props) {
    const [tab, setTab] = useState<'lists' | 'rules' | 'kpi'>('lists')
    const [lists, setLists] = useState(initialLists)
    const [rules, setRules] = useState(initialRules)
    const [showImportWizard, setShowImportWizard] = useState(false)

    const refreshLists = useCallback(async () => {
        const res = await fetch('/api/leads-pool/import')
        if (res.ok) {
            const data = await res.json()
            setLists(data.lists || [])
        }
    }, [])

    const refreshRules = useCallback(async () => {
        const res = await fetch('/api/leads-pool/admin/rules')
        if (res.ok) {
            const data = await res.json()
            setRules(data.rules || [])
        }
    }, [])

    const toggleList = async (listId: string, isActive: boolean) => {
        // We'll use a direct supabase update via a simple API call
        // For now, we optimistically update the UI
        setLists(prev => prev.map(l => l.id === listId ? { ...l, is_active: !isActive } : l))
        // TODO: implement PATCH endpoint for list toggle
    }

    const TABS = [
        { id: 'lists', label: '📋 Liste', icon: BarChart3 },
        { id: 'rules', label: '⚙️ Quote & Regole', icon: Settings },
        { id: 'kpi', label: '📊 KPI Team', icon: Users },
    ] as const

    const totalAvailable = lists.reduce((s, l) => s + (l.available_count || 0), 0)
    const totalInLists = lists.reduce((s, l) => s + (l.total_count || 0), 0)

    return (
        <div>
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <Link
                        href="/dashboard/leads-station"
                        className="p-2 rounded-xl transition-all"
                        style={{ background: 'var(--color-surface-100)', color: 'var(--color-surface-600)' }}
                    >
                        <ArrowLeft className="w-4 h-4" />
                    </Link>
                    <div>
                        <h1 className="text-xl font-bold" style={{ color: 'var(--color-surface-900)' }}>
                            Gestione Pool Leads
                        </h1>
                        <p className="text-xs mt-0.5" style={{ color: 'var(--color-surface-500)' }}>
                            {totalAvailable.toLocaleString('it-IT')} leads disponibili su {totalInLists.toLocaleString('it-IT')} totali
                        </p>
                    </div>
                </div>
                <button
                    onClick={() => setShowImportWizard(true)}
                    style={{
                        display: 'flex', alignItems: 'center', gap: '8px',
                        padding: '10px 18px', borderRadius: '12px',
                        background: 'linear-gradient(135deg, #a855f7, #7c3aed)',
                        color: 'white', fontSize: '13px', fontWeight: '600',
                        border: 'none', cursor: 'pointer',
                        boxShadow: '0 4px 14px rgba(168,85,247,0.35)',
                    }}
                >
                    <Upload className="w-4 h-4" />
                    Carica Nuova Lista
                </button>
            </div>

            {/* Summary cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '24px' }}>
                {[
                    { label: 'Liste attive', value: lists.filter(l => l.is_active).length, color: '#22c55e', emoji: '✅' },
                    { label: 'Disponibili', value: totalAvailable.toLocaleString('it-IT'), color: '#a855f7', emoji: '🎯' },
                    { label: 'Totale in pool', value: totalInLists.toLocaleString('it-IT'), color: '#3b82f6', emoji: '📋' },
                    { label: 'Venditori attivi', value: closers.length, color: '#f59e0b', emoji: '👥' },
                ].map((card, i) => (
                    <div key={i} className="glass-card" style={{
                        padding: '16px', borderRadius: '12px',
                        border: `1px solid ${card.color}30`,
                        textAlign: 'center',
                    }}>
                        <div style={{ fontSize: '1.4rem', marginBottom: '4px' }}>{card.emoji}</div>
                        <div style={{ fontSize: '22px', fontWeight: '800', color: card.color }}>{card.value}</div>
                        <div style={{ fontSize: '11px', color: 'var(--color-surface-500)', marginTop: '2px' }}>{card.label}</div>
                    </div>
                ))}
            </div>

            {/* Tabs */}
            <div style={{
                display: 'flex', gap: '4px', padding: '4px',
                background: 'var(--color-surface-100)',
                borderRadius: '12px', marginBottom: '20px',
                width: 'fit-content',
            }}>
                {TABS.map(t => (
                    <button
                        key={t.id}
                        onClick={() => setTab(t.id)}
                        style={{
                            padding: '8px 16px', borderRadius: '9px',
                            fontSize: '13px', fontWeight: '500',
                            border: 'none', cursor: 'pointer',
                            background: tab === t.id ? 'var(--color-surface-0)' : 'transparent',
                            color: tab === t.id ? 'var(--color-surface-900)' : 'var(--color-surface-500)',
                            boxShadow: tab === t.id ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
                            transition: 'all 0.15s',
                        }}
                    >
                        {t.label}
                    </button>
                ))}
            </div>

            {/* Tab content */}
            {tab === 'lists' && (
                <div>
                    <div className="flex items-center justify-between mb-3">
                        <h2 className="text-sm font-bold" style={{ color: 'var(--color-surface-700)' }}>
                            Liste Leads
                        </h2>
                        <button
                            onClick={refreshLists}
                            className="flex items-center gap-1 text-xs"
                            style={{ color: 'var(--color-surface-500)', background: 'none', border: 'none', cursor: 'pointer' }}
                        >
                            <RefreshCw className="w-3 h-3" /> Aggiorna
                        </button>
                    </div>

                    {lists.length === 0 ? (
                        <div style={{
                            padding: '48px', textAlign: 'center',
                            background: 'var(--color-surface-50)',
                            borderRadius: '16px',
                            border: '2px dashed var(--color-surface-200)',
                        }}>
                            <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>📭</div>
                            <h3 className="font-bold mb-2" style={{ color: 'var(--color-surface-600)' }}>Nessuna lista ancora</h3>
                            <p className="text-sm" style={{ color: 'var(--color-surface-400)' }}>
                                Carica la prima lista leads cliccando su "Carica Nuova Lista"
                            </p>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {lists.map(list => {
                                const availPct = list.total_count > 0
                                    ? Math.round((list.available_count / list.total_count) * 100)
                                    : 0
                                return (
                                    <div key={list.id} className="glass-card" style={{
                                        padding: '16px 18px',
                                        borderRadius: '14px',
                                        border: `1px solid ${list.is_active ? 'var(--color-surface-200)' : 'var(--color-surface-300)'}`,
                                        opacity: list.is_active ? 1 : 0.6,
                                        display: 'grid',
                                        gridTemplateColumns: '1fr auto auto',
                                        gap: '16px',
                                        alignItems: 'center',
                                    }}>
                                        <div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <span style={{ fontSize: '1rem' }}>
                                                    {list.source_format === 'xlsx' ? '📊' : list.source_format === 'json' ? '🔷' : '📄'}
                                                </span>
                                                <span className="font-semibold text-sm" style={{ color: 'var(--color-surface-900)' }}>
                                                    {list.name}
                                                </span>
                                                <span style={{
                                                    fontSize: '10px', padding: '2px 6px', borderRadius: '999px',
                                                    background: list.is_active ? 'rgba(34,197,94,0.1)' : 'var(--color-surface-200)',
                                                    color: list.is_active ? '#22c55e' : 'var(--color-surface-500)',
                                                    border: `1px solid ${list.is_active ? 'rgba(34,197,94,0.3)' : 'var(--color-surface-300)'}`,
                                                }}>
                                                    {list.is_active ? 'Attiva' : 'Pausa'}
                                                </span>
                                            </div>
                                            <div style={{ display: 'flex', gap: '16px', marginTop: '6px' }}>
                                                <span style={{ fontSize: '12px', color: 'var(--color-surface-500)' }}>
                                                    🎯 <strong style={{ color: '#a855f7' }}>{list.available_count.toLocaleString('it-IT')}</strong> disponibili
                                                </span>
                                                <span style={{ fontSize: '12px', color: 'var(--color-surface-500)' }}>
                                                    📋 {list.total_count.toLocaleString('it-IT')} totali ({availPct}%)
                                                </span>
                                                <span style={{ fontSize: '11px', color: 'var(--color-surface-400)' }}>
                                                    {new Date(list.created_at).toLocaleDateString('it-IT')}
                                                </span>
                                            </div>
                                            {/* Mini progress bar */}
                                            <div style={{
                                                marginTop: '6px', height: '4px', borderRadius: '2px',
                                                background: 'var(--color-surface-200)', overflow: 'hidden', width: '200px',
                                            }}>
                                                <div style={{
                                                    height: '100%', width: `${availPct}%`,
                                                    background: availPct > 30 ? '#22c55e' : availPct > 10 ? '#f59e0b' : '#ef4444',
                                                    borderRadius: '2px', transition: 'width 0.5s',
                                                }} />
                                            </div>
                                        </div>

                                        <button
                                            onClick={() => toggleList(list.id, list.is_active)}
                                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-surface-500)' }}
                                            title={list.is_active ? 'Metti in pausa' : 'Attiva'}
                                        >
                                            {list.is_active
                                                ? <ToggleRight className="w-5 h-5" style={{ color: '#22c55e' }} />
                                                : <ToggleLeft className="w-5 h-5" />
                                            }
                                        </button>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>
            )}

            {tab === 'rules' && (
                <QuotaManager
                    orgId={orgId}
                    initialRules={rules}
                    closers={closers}
                    onUpdate={refreshRules}
                />
            )}

            {tab === 'kpi' && (
                <div>
                    <h2 className="text-sm font-bold mb-4" style={{ color: 'var(--color-surface-700)' }}>
                        📊 Performance Team — Oggi
                    </h2>
                    {todayQuotas.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '32px', color: 'var(--color-surface-400)', fontSize: '13px' }}>
                            Nessuna attività registrata oggi ancora.
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {todayQuotas
                                .sort((a, b) => b.leads_requested - a.leads_requested)
                                .map(q => {
                                    const closer = closers.find(c => c.user_id === q.user_id)
                                    const name = closer?.profile?.full_name || 'Venditore'
                                    const pct = q.max_allowed > 0 ? Math.round((q.leads_requested / q.max_allowed) * 100) : 0
                                    const callPct = q.leads_requested > 0 ? Math.round((q.leads_called / q.leads_requested) * 100) : 0
                                    return (
                                        <div key={q.id} className="glass-card" style={{
                                            padding: '14px 18px',
                                            borderRadius: '12px',
                                            border: '1px solid var(--color-surface-200)',
                                        }}>
                                            <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: '16px', alignItems: 'center' }}>
                                                <div>
                                                    <div className="font-semibold text-sm" style={{ color: 'var(--color-surface-900)' }}>{name}</div>
                                                    <div className="text-xs" style={{ color: 'var(--color-surface-500)' }}>
                                                        {q.leads_requested}/{q.max_allowed} leads · {q.spins_count} spin
                                                    </div>
                                                </div>
                                                <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                                                    <div style={{ flex: 1 }}>
                                                        <div style={{ height: '6px', borderRadius: '3px', background: 'var(--color-surface-200)', overflow: 'hidden' }}>
                                                            <div style={{
                                                                height: '100%', width: `${pct}%`,
                                                                background: pct < 60 ? '#22c55e' : pct < 90 ? '#f59e0b' : '#ef4444',
                                                                borderRadius: '3px',
                                                            }} />
                                                        </div>
                                                        <div className="text-xs mt-1" style={{ color: 'var(--color-surface-500)' }}>
                                                            Quota: {pct}%
                                                        </div>
                                                    </div>
                                                    <div style={{ textAlign: 'center', minWidth: '60px' }}>
                                                        <div style={{ fontSize: '18px', fontWeight: '700', color: '#3b82f6' }}>{q.leads_called}</div>
                                                        <div style={{ fontSize: '10px', color: 'var(--color-surface-500)' }}>📞 chiamate</div>
                                                    </div>
                                                    <div style={{ textAlign: 'center', minWidth: '60px' }}>
                                                        <div style={{ fontSize: '18px', fontWeight: '700', color: '#22c55e' }}>{q.leads_converted}</div>
                                                        <div style={{ fontSize: '10px', color: 'var(--color-surface-500)' }}>💎 conv.</div>
                                                    </div>
                                                    <div style={{ textAlign: 'center', minWidth: '60px' }}>
                                                        <div style={{ fontSize: '18px', fontWeight: '700', color: '#f59e0b' }}>{callPct}%</div>
                                                        <div style={{ fontSize: '10px', color: 'var(--color-surface-500)' }}>tasso</div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )
                                })}
                        </div>
                    )}
                </div>
            )}

            {/* Import Wizard Modal */}
            {showImportWizard && (
                <FileImportWizard
                    onClose={() => { setShowImportWizard(false); refreshLists() }}
                />
            )}
        </div>
    )
}
