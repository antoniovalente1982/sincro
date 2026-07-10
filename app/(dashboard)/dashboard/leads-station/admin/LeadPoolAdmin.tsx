'use client'

import { useState, useCallback, useEffect } from 'react'
import Link from 'next/link'
import { ArrowLeft, Upload, Settings, Users, BarChart3, Trash2, RefreshCw, ToggleLeft, ToggleRight, ChevronDown, ChevronUp, Search, Eye } from 'lucide-react'
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

    // Leads list inspection states
    const [expandedListId, setExpandedListId] = useState<string | null>(null)
    const [leadsList, setLeadsList] = useState<any[]>([])
    const [leadsLoading, setLeadsLoading] = useState(false)
    const [leadsPagination, setLeadsPagination] = useState<any>(null)
    const [leadsPage, setLeadsPage] = useState(1)
    const [statusFilter, setStatusFilter] = useState<string | null>(null)

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

    const loadListLeads = useCallback(async (listId: string, page = 1, status = statusFilter) => {
        setLeadsLoading(true)
        try {
            const url = `/api/leads-pool/admin/list-leads?list_id=${listId}&page=${page}&limit=20${status ? `&status=${status}` : ''}`
            const res = await fetch(url)
            if (res.ok) {
                const data = await res.json()
                setLeadsList(data.leads || [])
                setLeadsPagination(data.pagination || null)
            }
        } catch (err) {
            console.error('Failed to load leads', err)
        } finally {
            setLeadsLoading(false)
        }
    }, [statusFilter])

    const handleExpandList = (listId: string) => {
        if (expandedListId === listId) {
            setExpandedListId(null)
            setLeadsList([])
            setLeadsPagination(null)
        } else {
            setExpandedListId(listId)
            setLeadsPage(1)
            loadListLeads(listId, 1, statusFilter)
        }
    }

    const handlePageChange = (newPage: number) => {
        if (!expandedListId) return
        setLeadsPage(newPage)
        loadListLeads(expandedListId, newPage, statusFilter)
    }

    const handleStatusFilterChange = (newStatus: string | null) => {
        if (!expandedListId) return
        setStatusFilter(newStatus)
        setLeadsPage(1)
        loadListLeads(expandedListId, 1, newStatus)
    }

    const toggleList = async (listId: string, isActive: boolean) => {
        try {
            setLists(prev => prev.map(l => l.id === listId ? { ...l, is_active: !isActive } : l))
            // Chiamata PATCH (o POST) per attivare/disattivare
            await fetch('/api/leads-pool/admin/rules', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'toggle_list', list_id: listId, is_active: !isActive })
            })
            refreshLists()
        } catch (err) {
            console.error(err)
        }
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
                                        borderRadius: '14px',
                                        border: `1px solid ${list.is_active ? 'var(--color-surface-200)' : 'var(--color-surface-300)'}`,
                                        opacity: list.is_active ? 1 : 0.6,
                                        display: 'flex',
                                        flexDirection: 'column',
                                        marginBottom: '8px',
                                        overflow: 'hidden',
                                    }}>
                                        <div style={{
                                            padding: '16px 18px',
                                            display: 'grid',
                                            gridTemplateColumns: '1fr auto auto auto',
                                            gap: '16px',
                                            alignItems: 'center',
                                            cursor: 'pointer',
                                        }} onClick={() => handleExpandList(list.id)}>
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

                                            <div style={{ color: 'var(--color-surface-500)', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}>
                                                <Eye className="w-4 h-4" />
                                                <span>{expandedListId === list.id ? 'Nascondi lead' : 'Vedi lead'}</span>
                                            </div>

                                            <button
                                                onClick={(e) => { e.stopPropagation(); toggleList(list.id, list.is_active); }}
                                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-surface-500)' }}
                                                title={list.is_active ? 'Metti in pausa' : 'Attiva'}
                                            >
                                                {list.is_active
                                                    ? <ToggleRight className="w-5 h-5" style={{ color: '#22c55e' }} />
                                                    : <ToggleLeft className="w-5 h-5" />
                                                }
                                            </button>

                                            <div>
                                                {expandedListId === list.id ? <ChevronUp className="w-4 h-4 text-surface-500" /> : <ChevronDown className="w-4 h-4 text-surface-500" />}
                                            </div>
                                        </div>

                                        {/* Collapsible Leads Table */}
                                        {expandedListId === list.id && (
                                            <div style={{
                                                borderTop: '1px solid var(--color-surface-200)',
                                                background: 'var(--color-surface-50)',
                                                padding: '16px',
                                            }}>
                                                {/* Leads filters */}
                                                <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', overflowX: 'auto', paddingBottom: '6px' }}>
                                                    {[
                                                        { value: null, label: 'Tutti i lead' },
                                                        { value: 'available', label: 'Disponibili 🎯' },
                                                        { value: 'assigned', label: 'Assegnati ⏳' },
                                                        { value: 'called', label: 'Chiamati 📞' },
                                                        { value: 'converted', label: 'Convertiti 💎' },
                                                    ].map((f) => (
                                                        <button
                                                            key={f.value || 'all'}
                                                            onClick={(e) => { e.stopPropagation(); handleStatusFilterChange(f.value); }}
                                                            style={{
                                                                padding: '4px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: '500',
                                                                background: statusFilter === f.value ? 'rgba(168,85,247,0.1)' : 'var(--color-surface-100)',
                                                                color: statusFilter === f.value ? '#a855f7' : 'var(--color-surface-600)',
                                                                border: `1px solid ${statusFilter === f.value ? 'rgba(168,85,247,0.3)' : 'var(--color-surface-200)'}`,
                                                                cursor: 'pointer', whiteSpace: 'nowrap',
                                                            }}
                                                        >
                                                            {f.label}
                                                        </button>
                                                    ))}
                                                </div>

                                                {leadsLoading ? (
                                                    <div style={{ padding: '24px', textAlign: 'center', color: 'var(--color-surface-500)', fontSize: '12px' }}>
                                                        Caricamento leads...
                                                    </div>
                                                ) : leadsList.length === 0 ? (
                                                    <div style={{ padding: '24px', textAlign: 'center', color: 'var(--color-surface-400)', fontSize: '12px' }}>
                                                        Nessun lead trovato con questo filtro.
                                                    </div>
                                                ) : (
                                                    <div style={{ overflowX: 'auto' }}>
                                                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', textAlign: 'left' }}>
                                                            <thead>
                                                                <tr style={{ borderBottom: '1px solid var(--color-surface-200)', color: 'var(--color-surface-500)' }}>
                                                                    <th style={{ padding: '6px 8px' }}>Nome</th>
                                                                    <th style={{ padding: '6px 8px' }}>Telefono</th>
                                                                    <th style={{ padding: '6px 8px' }}>Email</th>
                                                                    <th style={{ padding: '6px 8px' }}>Priorità</th>
                                                                    <th style={{ padding: '6px 8px' }}>Stato</th>
                                                                    <th style={{ padding: '6px 8px' }}>Esito / Note</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody>
                                                                {leadsList.map((lead) => (
                                                                    <tr key={lead.id} style={{ borderBottom: '1px solid var(--color-surface-200)', color: 'var(--color-surface-700)' }}>
                                                                        <td style={{ padding: '6px 8px', fontWeight: '600' }}>{lead.full_name || '—'}</td>
                                                                        <td style={{ padding: '6px 8px' }}>{lead.phone || '—'}</td>
                                                                        <td style={{ padding: '6px 8px' }}>{lead.email || '—'}</td>
                                                                        <td style={{ padding: '6px 8px' }}>
                                                                            <span style={{
                                                                                padding: '2px 6px', borderRadius: '4px', fontSize: '9px', fontWeight: 'bold',
                                                                                background: lead.priority_score >= 0.8 ? 'rgba(34,197,94,0.1)' : 'rgba(245,158,11,0.1)',
                                                                                color: lead.priority_score >= 0.8 ? '#22c55e' : '#f59e0b',
                                                                            }}>
                                                                                {Math.round(lead.priority_score * 100)}
                                                                            </span>
                                                                        </td>
                                                                        <td style={{ padding: '6px 8px' }}>
                                                                            <span style={{
                                                                                padding: '2px 6px', borderRadius: '4px', fontSize: '9px', textTransform: 'uppercase', fontWeight: '600',
                                                                                background: lead.status === 'available' ? 'rgba(34,197,94,0.1)' : lead.status === 'assigned' ? 'rgba(59,130,246,0.1)' : 'rgba(107,114,128,0.1)',
                                                                                color: lead.status === 'available' ? '#22c55e' : lead.status === 'assigned' ? '#3b82f6' : '#6b7280',
                                                                            }}>
                                                                                {lead.status}
                                                                            </span>
                                                                        </td>
                                                                        <td style={{ padding: '6px 8px', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                                            {lead.feedback ? `[${lead.feedback}] ` : ''}{lead.notes || '—'}
                                                                        </td>
                                                                    </tr>
                                                                ))}
                                                            </tbody>
                                                        </table>

                                                        {/* Pagination */}
                                                        {leadsPagination && leadsPagination.total > 20 && (
                                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px', borderTop: '1px solid var(--color-surface-200)', paddingTop: '8px' }}>
                                                                <span style={{ fontSize: '10px', color: 'var(--color-surface-500)' }}>
                                                                    Mostrati {leadsList.length} di {leadsPagination.total}
                                                                </span>
                                                                <div style={{ display: 'flex', gap: '4px' }}>
                                                                    <button
                                                                        disabled={leadsPage === 1}
                                                                        onClick={(e) => { e.stopPropagation(); handlePageChange(leadsPage - 1); }}
                                                                        style={{
                                                                            padding: '3px 8px', borderRadius: '4px', fontSize: '10px',
                                                                            background: 'var(--color-surface-100)', color: 'var(--color-surface-600)',
                                                                            border: '1px solid var(--color-surface-200)', cursor: leadsPage === 1 ? 'not-allowed' : 'pointer',
                                                                        }}
                                                                    >
                                                                        Precedente
                                                                    </button>
                                                                    <span style={{ fontSize: '10px', alignSelf: 'center', padding: '0 8px', color: 'var(--color-surface-700)' }}>
                                                                        Pagina {leadsPage}
                                                                    </span>
                                                                    <button
                                                                        disabled={leadsList.length < 20}
                                                                        onClick={(e) => { e.stopPropagation(); handlePageChange(leadsPage + 1); }}
                                                                        style={{
                                                                            padding: '3px 8px', borderRadius: '4px', fontSize: '10px',
                                                                            background: 'var(--color-surface-100)', color: 'var(--color-surface-600)',
                                                                            border: '1px solid var(--color-surface-200)', cursor: leadsList.length < 20 ? 'not-allowed' : 'pointer',
                                                                        }}
                                                                    >
                                                                        Successiva
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        )}
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
