'use client'

import { useState, useCallback, useEffect } from 'react'
import Link from 'next/link'
import { ArrowLeft, Upload, Settings, Users, BarChart3, Trash2, RefreshCw, ToggleLeft, ToggleRight, ChevronDown, ChevronUp, Search, Eye, Sparkles } from 'lucide-react'
import FileImportWizard from './FileImportWizard'
import QuotaManager from './QuotaManager'
import SpinMachine from '../SpinMachine'
import LeadCard from '../LeadCard'
import DailyProgressBar from '../DailyProgressBar'

interface Props {
    orgId: string
    initialLists: any[]
    initialRules: any[]
    closers: { user_id: string; role: string; profile: any }[]
    todayQuotas: any[]
}

export default function LeadPoolAdmin({ orgId, initialLists, initialRules, closers, todayQuotas }: Props) {
    const [tab, setTab] = useState<'lists' | 'rules' | 'kpi' | 'simulation'>('lists')
    const [lists, setLists] = useState(initialLists)
    const [rules, setRules] = useState(initialRules)
    const [showImportWizard, setShowImportWizard] = useState(false)

    // Leads list inspection states
    const [expandedListId, setExpandedListId] = useState<string | null>(null)
    const [leadsList, setLeadsList] = useState<any[]>([])
    const [leadsLoading, setLeadsLoading] = useState(false)
    const [leadsPagination, setLeadsPagination] = useState<any>(null)
    const [leadsFeedbackCounts, setLeadsFeedbackCounts] = useState<Record<string, number>>({})
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
                setLeadsFeedbackCounts(data.feedback_counts || {})
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
        { id: 'simulation', label: '🔮 Simulazione Venditore', icon: Sparkles },
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
                <div className="flex items-center gap-3">
                    <button
                        onClick={async () => {
                            if (!confirm("Sei sicuro di voler resettare tutti i tuoi dati di test (quota giornaliera, sessioni e contatti assegnati al tuo account)? Questa azione rimetterà i tuoi contatti di test nel pool dei disponibili per i venditori.")) return;
                            try {
                                const res = await fetch('/api/leads-pool/admin/clean-tests', { method: 'POST' });
                                if (res.ok) {
                                    const d = await res.json();
                                    alert(`Test resettati con successo! Liberati ${d.released_count} contatti.`);
                                    refreshLists();
                                } else {
                                    const d = await res.json();
                                    alert(d.error || "Errore durante il reset");
                                }
                            } catch (e) {
                                console.error(e);
                                alert("Errore di rete");
                            }
                        }}
                        style={{
                            display: 'flex', alignItems: 'center', gap: '8px',
                            padding: '10px 18px', borderRadius: '12px',
                            background: 'rgba(239, 68, 68, 0.08)',
                            color: '#ef4444',
                            border: '1px solid rgba(239, 68, 68, 0.2)',
                            fontSize: '13px', fontWeight: '600',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                        }}
                        className="hover:bg-red-500/10"
                    >
                        🔄 Resetta i miei Test
                    </button>
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
                                            gridTemplateColumns: '1fr auto auto auto auto',
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

                                            <button
                                                onClick={async (e) => {
                                                    e.stopPropagation();
                                                    if (!confirm(`Sei sicuro di voler eliminare la lista "${list.name}" e tutti i suoi lead? Questa azione cancellerà permanentemente tutti i contatti associati.`)) return;
                                                    try {
                                                        const res = await fetch(`/api/leads-pool/import?list_id=${list.id}`, { method: 'DELETE' });
                                                        if (res.ok) {
                                                            refreshLists();
                                                            if (expandedListId === list.id) {
                                                                setExpandedListId(null);
                                                                setLeadsList([]);
                                                            }
                                                        } else {
                                                            const d = await res.json();
                                                            alert(d.error || 'Errore durante l\'eliminazione');
                                                        }
                                                    } catch (err) {
                                                        console.error(err);
                                                    }
                                                }}
                                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                                title="Elimina permanentemente lista e lead"
                                            >
                                                <Trash2 className="w-4 h-4" />
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
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '10px' }}>
                                                    {/* Leads filters */}
                                                    <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '6px' }}>
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

                                                    {/* Clean wrong numbers button */}
                                                    {leadsFeedbackCounts?.wrong_number > 0 && (
                                                        <button
                                                            onClick={async (e) => {
                                                                e.stopPropagation();
                                                                if (!confirm(`Sei sicuro di voler eliminare permanentemente tutti i ${leadsFeedbackCounts.wrong_number} numeri errati da questa lista? Questa operazione è irreversibile.`)) return;
                                                                
                                                                try {
                                                                    const res = await fetch(`/api/leads-pool/admin/list-leads?list_id=${list.id}&action=clean_wrong_numbers`, {
                                                                        method: 'DELETE'
                                                                    });
                                                                    if (res.ok) {
                                                                        const data = await res.json();
                                                                        alert(`Pulizia completata! Eliminati con successo ${data.deleted_count} numeri errati.`);
                                                                        loadListLeads(list.id, 1, statusFilter);
                                                                        refreshLists();
                                                                    } else {
                                                                        const d = await res.json();
                                                                        alert(d.error || 'Errore durante la pulizia');
                                                                    }
                                                                } catch (err) {
                                                                    console.error(err);
                                                                }
                                                            }}
                                                            style={{
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                gap: '4px',
                                                                padding: '5px 12px',
                                                                borderRadius: '6px',
                                                                fontSize: '11px',
                                                                fontWeight: '600',
                                                                background: 'rgba(239, 68, 68, 0.1)',
                                                                color: '#ef4444',
                                                                border: '1px solid rgba(239, 68, 68, 0.3)',
                                                                cursor: 'pointer',
                                                                transition: 'all 0.2s',
                                                            }}
                                                        >
                                                            🧹 Pulisci {leadsFeedbackCounts.wrong_number} Numeri Errati
                                                        </button>
                                                    )}
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

            {tab === 'simulation' && (
                <SimulationSandbox />
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

// 🔮 Interactive Sandbox Component
function SimulationSandbox() {
    const [simRequested, setSimRequested] = useState(0)
    const [simMax, setSimMax] = useState(50)
    const [simCalled, setSimCalled] = useState(0)
    const [simConverted, setSimConverted] = useState(0)
    const [simSpins, setSimSpins] = useState(0)
    const [simLeads, setSimLeads] = useState<any[]>([])
    const [simCallbacks, setSimCallbacks] = useState<any[]>([])
    const [activeTab, setActiveTab] = useState<'session' | 'callbacks'>('session')
    const [spinState, setSpinState] = useState<'idle' | 'spinning' | 'done'>('idle')
    const [feedbackRequirement, setFeedbackRequirement] = useState(100) // 100%
    const [batchSize, setBatchSize] = useState(5)

    const MOCK_PROFILES = [
        { full_name: 'Nicola Rossi', phone: '+393331122334', email: 'nicola.rossi@gmail.com', city: 'Milano', province: 'MI' },
        { full_name: 'Sofia Bianchi', phone: '+393479988776', email: 'sofia.bianchi@hotmail.it', city: 'Roma', province: 'RM' },
        { full_name: 'Gabriele Verdi', phone: '+393205556667', email: 'g.verdi@yahoo.com', city: 'Torino', province: 'TO' },
        { full_name: 'Martina Neri', phone: '+393394443322', email: 'martina.neri@gmail.com', city: 'Napoli', province: 'NA' },
        { full_name: 'Lorenzo Russo', phone: '+393407778899', email: 'lorenzo.russo@libero.it', city: 'Firenze', province: 'FI' },
        { full_name: 'Chiara Ferrari', phone: '+393281112233', email: 'chiara.ferrari@outlook.it', city: 'Bologna', province: 'BO' },
        { full_name: 'Andrea Esposito', phone: '+393356665544', email: 'andrea.esposito@gmail.com', city: 'Salerno', province: 'SA' },
        { full_name: 'Giulia Romano', phone: '+393482223344', email: 'giulia.romano@gmail.com', city: 'Genova', province: 'GE' },
        { full_name: 'Federico Colombo', phone: '+393318889900', email: 'federico.colombo@gmail.com', city: 'Varese', province: 'VA' },
        { full_name: 'Elisa Ricci', phone: '+393297778888', email: 'elisa.ricci@gmail.com', city: 'Bari', province: 'BA' },
    ]

    const handleSpin = async () => {
        if (spinState === 'spinning') return
        setSpinState('spinning')

        // Sposta i lead irrisolti della vecchia sessione (callback/non risponde) nei richiami simulati
        const unresolved = simLeads.filter(l => l.feedback === 'callback' || l.feedback === 'no_answer')
        if (unresolved.length > 0) {
            setSimCallbacks(prev => [...unresolved, ...prev])
        }

        await new Promise(r => setTimeout(r, 1800))

        // Get random profiles from MOCK_PROFILES
        const shuffled = [...MOCK_PROFILES].sort(() => 0.5 - Math.random())
        const selected = shuffled.slice(0, batchSize).map((p, index) => ({
            id: `mock-lead-${simSpins}-${index}`,
            full_name: p.full_name,
            phone: p.phone,
            email: p.email,
            city: p.city,
            province: p.province,
            status: 'available',
            call_count: 0,
            feedback: null,
            assigned_at: new Date().toISOString(),
        }))

        setSimLeads(selected)
        setSimRequested(prev => prev + batchSize)
        setSimSpins(prev => prev + 1)
        setActiveTab('session') // Torna a sessione dopo il nuovo spin
        setSpinState('done')
        setTimeout(() => setSpinState('idle'), 500)
    }

    const handleFeedback = async (leadId: string, feedback: string, notes?: string) => {
        const isFromCallbacks = simCallbacks.some(l => l.id === leadId)

        const updateFunction = (l: any) => {
            const wasCalled = !!l.feedback
            const isConverted = feedback === 'converted'
            const wasConverted = l.feedback === 'converted'

            if (!wasCalled) {
                setSimCalled(c => c + 1)
            }
            if (isConverted && !wasConverted) {
                setSimConverted(c => c + 1)
            } else if (!isConverted && wasConverted) {
                setSimConverted(c => Math.max(0, c - 1))
            }

            return {
                ...l,
                feedback,
                notes: notes || l.notes,
                status: isConverted ? 'converted' : 'called',
                call_count: l.call_count + (wasCalled ? 0 : 1),
            }
        }

        if (isFromCallbacks) {
            const isResolved = ['converted', 'not_interested', 'wrong_number', 'interested'].includes(feedback)
            if (isResolved) {
                // Rimuovi dal tab dei richiami se è stato risolto (es. convertito o scartato)
                setSimCallbacks(prev => prev.filter(l => l.id !== leadId))
            } else {
                setSimCallbacks(prev => prev.map(l => l.id === leadId ? updateFunction(l) : l))
            }
        } else {
            setSimLeads(prev => prev.map(l => {
                if (l.id !== leadId) return l
                const updated = updateFunction(l)

                // Aggiunge o aggiorna immediatamente nei richiami se è un callback/no_answer
                if (feedback === 'callback' || feedback === 'no_answer') {
                    setSimCallbacks(c => {
                        if (c.some(x => x.id === leadId)) {
                            return c.map(x => x.id === leadId ? updated : x)
                        }
                        return [updated, ...c]
                    })
                } else {
                    // Rimuove dai richiami se l'utente cambia l'esito (es. da callback a interessato)
                    setSimCallbacks(c => c.filter(x => x.id !== leadId))
                }

                return updated
            }))
        }
    }

    const remaining = simMax - simRequested
    const canSpin = remaining >= batchSize

    const totalLeads = simLeads.length
    const feedbackCount = simLeads.filter(l => l.feedback).length
    const feedbackPct = totalLeads > 0 ? Math.round((feedbackCount / totalLeads) * 100) : 100
    const feedbackOk = feedbackPct >= feedbackRequirement

    let spinBlockReason: string | null = null
    if (!canSpin) spinBlockReason = `Quota giornaliera raggiunta (${simRequested}/${simMax})`
    else if (!feedbackOk) spinBlockReason = `Aggiorna feedback: ${feedbackCount}/${totalLeads} (${feedbackPct}% / min. ${feedbackRequirement}%)`

    const resetSimulation = () => {
        setSimRequested(0)
        setSimCalled(0)
        setSimConverted(0)
        setSimSpins(0)
        setSimLeads([])
        setSimCallbacks([])
        setActiveTab('session')
        setSpinState('idle')
    }

    return (
        <div style={{ padding: '8px 0' }}>
            {/* Info panel */}
            <div style={{
                padding: '16px 20px', borderRadius: '14px',
                background: 'rgba(168,85,247,0.06)',
                border: '1px solid rgba(168,85,247,0.2)',
                marginBottom: '20px',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px',
            }}>
                <div style={{ flex: 1 }}>
                    <h4 className="font-semibold text-sm mb-1" style={{ color: '#a855f7' }}>
                        🔮 Sandbox di Simulazione Interattiva
                    </h4>
                    <p style={{ fontSize: '12px', color: 'var(--color-surface-600)', lineHeight: '1.4' }}>
                        In questa area puoi testare l'esperienza esatta che vedrà un venditore (closer). Puoi simulare lo <strong>SPIN</strong> per ricevere i lead,
                        aggiornare i loro esiti/feedback, vedere come la quota giornaliera si aggiorna in tempo reale e capire le regole di blocco.
                        <strong> Nota:</strong> Nessun dato inserito qui andrà ad influire sulle statistiche reali o sul database.
                    </p>
                </div>
                <button
                    onClick={resetSimulation}
                    style={{
                        padding: '8px 16px', borderRadius: '10px', fontSize: '12px', fontWeight: '600',
                        background: 'var(--color-surface-100)', color: 'var(--color-surface-700)',
                        border: '1px solid var(--color-surface-300)', cursor: 'pointer',
                        whiteSpace: 'nowrap',
                    }}
                >
                    🔄 Ripristina Test
                </button>
            </div>

            {/* Sandbox controller */}
            <div className="glass-card" style={{
                padding: '16px', borderRadius: '14px',
                border: '1px solid var(--color-surface-200)',
                marginBottom: '24px',
                display: 'flex', gap: '24px', flexWrap: 'wrap',
            }}>
                <div>
                    <label style={{ fontSize: '11px', fontWeight: '600', color: 'var(--color-surface-500)', display: 'block', marginBottom: '6px' }}>
                        Quota Max Giornaliera (Test)
                    </label>
                    <input
                        type="number" min={5} max={200} step={5}
                        value={simMax}
                        onChange={e => setSimMax(parseInt(e.target.value) || 50)}
                        style={{
                            padding: '6px 10px', borderRadius: '8px', fontSize: '12px',
                            background: 'var(--color-surface-100)', border: '1px solid var(--color-surface-300)',
                            color: 'var(--color-surface-950)', width: '120px',
                        }}
                    />
                </div>
                <div>
                    <label style={{ fontSize: '11px', fontWeight: '600', color: 'var(--color-surface-500)', display: 'block', marginBottom: '6px' }}>
                        Lead per Spin
                    </label>
                    <select
                        value={batchSize}
                        onChange={e => setBatchSize(parseInt(e.target.value) || 5)}
                        style={{
                            padding: '6px 10px', borderRadius: '8px', fontSize: '12px',
                            background: 'var(--color-surface-100)', border: '1px solid var(--color-surface-300)',
                            color: 'var(--color-surface-950)', width: '100px',
                        }}
                    >
                        <option value={3}>3 lead</option>
                        <option value={5}>5 lead</option>
                        <option value={7}>7 lead</option>
                        <option value={10}>10 lead</option>
                    </select>
                </div>
                <div>
                    <label style={{ fontSize: '11px', fontWeight: '600', color: 'var(--color-surface-500)', display: 'block', marginBottom: '6px' }}>
                        % Minima Feedback richiesto
                    </label>
                    <select
                        value={feedbackRequirement}
                        onChange={e => setFeedbackRequirement(parseInt(e.target.value) ?? 100)}
                        style={{
                            padding: '6px 10px', borderRadius: '8px', fontSize: '12px',
                            background: 'var(--color-surface-100)', border: '1px solid var(--color-surface-300)',
                            color: 'var(--color-surface-950)', width: '140px',
                        }}
                    >
                        <option value={0}>Nessuno (0%)</option>
                        <option value={40}>Basso (40%)</option>
                        <option value={60}>Standard (60%)</option>
                        <option value={80}>Alto (80%)</option>
                        <option value={100}>Tutti (100%)</option>
                    </select>
                </div>
            </div>

            {/* Simulated Workspace */}
            <div style={{ display: 'grid', gridTemplateColumns: '400px 1fr', gap: '24px', alignItems: 'start' }}>
                {/* Column left: Spin Machine + Progress */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    
                    {/* Simulated Daily Progress */}
                    <DailyProgressBar
                        requested={simRequested}
                        max={simMax}
                        called={simCalled}
                        converted={simConverted}
                        spins={simSpins}
                    />

                    {/* Simulated Slot Machine Card */}
                    <div
                        className="glass-card"
                        style={{
                            padding: '24px',
                            borderRadius: '16px',
                            border: '1px solid var(--color-surface-200)',
                            textAlign: 'center',
                            position: 'relative',
                            overflow: 'hidden',
                        }}
                    >
                        {/* Glow background */}
                        <div style={{
                            position: 'absolute', inset: 0,
                            background: spinState === 'spinning'
                                ? 'radial-gradient(ellipse at center, rgba(168,85,247,0.08) 0%, transparent 70%)'
                                : 'transparent',
                            transition: 'background 0.5s',
                            pointerEvents: 'none',
                        }} />

                        <SpinMachine state={spinState} batchSize={batchSize} />

                        {spinBlockReason && (
                            <div style={{
                                marginTop: '12px',
                                padding: '10px 14px',
                                borderRadius: '10px',
                                background: 'rgba(245,158,11,0.08)',
                                border: '1px solid rgba(245,158,11,0.2)',
                                color: '#f59e0b',
                                fontSize: '11px',
                                textAlign: 'left',
                                lineHeight: '1.4',
                            }}>
                                🔒 {spinBlockReason}
                            </div>
                        )}

                        <button
                            onClick={handleSpin}
                            disabled={!canSpin || !feedbackOk || spinState === 'spinning'}
                            style={{
                                marginTop: '20px',
                                width: '100%',
                                padding: '12px 0',
                                borderRadius: '12px',
                                fontSize: '15px',
                                fontWeight: '700',
                                cursor: (!canSpin || !feedbackOk || spinState === 'spinning') ? 'not-allowed' : 'pointer',
                                opacity: (!canSpin || !feedbackOk) ? 0.5 : 1,
                                background: spinState === 'spinning'
                                    ? 'linear-gradient(135deg, #7c3aed 0%, #a855f7 100%)'
                                    : 'linear-gradient(135deg, #a855f7 0%, #7c3aed 100%)',
                                color: 'white',
                                border: 'none',
                                boxShadow: (!canSpin || !feedbackOk) ? 'none' : '0 4px 16px rgba(168,85,247,0.3)',
                                transition: 'all 0.2s',
                            }}
                        >
                            {spinState === 'spinning' ? '🎰 Estrazione...' : `🎰 SPIN — Richiedi ${batchSize} Lead`}
                        </button>
                    </div>
                </div>

                {/* Column right: Simulated Leads */}
                <div>
                    {/* Tab Selector */}
                    <div style={{
                        display: 'flex', gap: '8px', padding: '4px',
                        background: 'var(--color-surface-100)',
                        borderRadius: '12px', marginBottom: '16px',
                        width: 'fit-content',
                    }}>
                        <button
                            onClick={() => setActiveTab('session')}
                            style={{
                                padding: '8px 16px', borderRadius: '9px',
                                fontSize: '13px', fontWeight: '600',
                                border: 'none', cursor: 'pointer',
                                background: activeTab === 'session' ? 'var(--color-surface-0)' : 'transparent',
                                color: activeTab === 'session' ? 'var(--color-surface-900)' : 'var(--color-surface-500)',
                                boxShadow: activeTab === 'session' ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
                                transition: 'all 0.15s',
                            }}
                        >
                            📋 Sessione Corrente ({simLeads.length})
                        </button>
                        <button
                            onClick={() => setActiveTab('callbacks')}
                            style={{
                                padding: '8px 16px', borderRadius: '9px',
                                fontSize: '13px', fontWeight: '600',
                                border: 'none', cursor: 'pointer',
                                background: activeTab === 'callbacks' ? 'var(--color-surface-0)' : 'transparent',
                                color: activeTab === 'callbacks' ? 'var(--color-surface-900)' : 'var(--color-surface-500)',
                                boxShadow: activeTab === 'callbacks' ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
                                transition: 'all 0.15s',
                            }}
                        >
                            🔄 Da richiamare ({simCallbacks.length})
                        </button>
                    </div>

                    {activeTab === 'session' ? (
                        simLeads.length === 0 ? (
                            <div style={{
                                padding: '48px 24px', borderRadius: '16px',
                                textAlign: 'center', border: '2px dashed var(--color-surface-300)',
                                background: 'var(--color-surface-55)',
                            }}>
                                <span style={{ fontSize: '2.5rem', display: 'block', marginBottom: '10px' }}>🎯</span>
                                <h4 className="font-bold text-sm mb-1" style={{ color: 'var(--color-surface-700)' }}>
                                    Nessun lead attivo simulato
                                </h4>
                                <p className="text-xs" style={{ color: 'var(--color-surface-500)', maxWidth: '280px', margin: '0 auto' }}>
                                    Clicca su <strong>SPIN</strong> per generare {batchSize} lead fittizi e testare l'inserimento dei feedback.
                                </p>
                            </div>
                        ) : (
                            <div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                                    <h4 className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--color-surface-500)' }}>
                                        📋 Leads estratti per il test
                                    </h4>
                                    <span style={{
                                        fontSize: '11px', padding: '2px 8px', borderRadius: '999px', fontWeight: '650',
                                        background: feedbackOk ? 'rgba(34,197,94,0.1)' : 'rgba(245,158,11,0.1)',
                                        color: feedbackOk ? '#22c55e' : '#f59e0b',
                                    }}>
                                        Feedback: {feedbackCount}/{totalLeads} ({feedbackPct}%)
                                    </span>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    {simLeads.map((lead) => (
                                        <LeadCard
                                            key={lead.id}
                                            lead={lead}
                                            onFeedback={handleFeedback}
                                        />
                                    ))}
                                </div>
                            </div>
                        )
                    ) : (
                        simCallbacks.length === 0 ? (
                            <div style={{
                                padding: '48px 24px', borderRadius: '16px',
                                textAlign: 'center', border: '2px dashed var(--color-surface-300)',
                                background: 'var(--color-surface-55)',
                            }}>
                                <span style={{ fontSize: '2.5rem', display: 'block', marginBottom: '10px' }}>🎉</span>
                                <h4 className="font-bold text-sm mb-1" style={{ color: 'var(--color-surface-700)' }}>
                                    Nessun richiamo simulato
                                </h4>
                                <p className="text-xs" style={{ color: 'var(--color-surface-500)', maxWidth: '280px', margin: '0 auto' }}>
                                    I contatti contrassegnati come <strong>Richiama</strong> o <strong>Non risponde</strong> verranno spostati qui dopo il prossimo SPIN.
                                </p>
                            </div>
                        ) : (
                            <div>
                                <h4 className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: 'var(--color-surface-500)' }}>
                                    🔄 Contatti da richiamare (Sandbox)
                                </h4>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    {simCallbacks.map((lead) => (
                                        <LeadCard
                                            key={lead.id}
                                            lead={lead}
                                            onFeedback={handleFeedback}
                                        />
                                    ))}
                                </div>
                            </div>
                        )
                    )}
                </div>
            </div>
        </div>
    )
}
