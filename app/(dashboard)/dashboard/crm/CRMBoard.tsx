'use client'

import { useState, useCallback, useMemo } from 'react'
import { Plus, Search, Filter, GripVertical, Phone, Mail, DollarSign, Calendar, User, X, MessageSquare, ArrowRight, Clock, Trash2, Edit3, Eye, Flame, Zap, Snowflake, TrendingUp } from 'lucide-react'
import DateRangeFilter, { useDateRange, filterByDateRange } from '@/components/DateRangeFilter'

interface Stage {
    id: string
    name: string
    slug: string
    color: string
    sort_order: number
    is_won?: boolean
    is_lost?: boolean
    fire_capi_event?: string
    pipeline_id?: string
}

interface Pipeline {
    id: string
    name: string
    slug: string
    source_type: string
    color: string
    is_default: boolean
    sort_order: number
}

interface Lead {
    id: string
    name: string
    email?: string
    phone?: string
    product?: string
    value?: number
    stage_id?: string
    assigned_to?: string
    notes?: string
    utm_source?: string
    utm_campaign?: string
    created_at: string
    updated_at: string
    funnels?: { id: string; name: string; objective: string } | null
}

interface Member {
    user_id: string
    role: string
    profiles: { full_name?: string; email?: string } | null
}

interface Props {
    pipelines: Pipeline[]
    stages: Stage[]
    initialLeads: Lead[]
    members: Member[]
    userRole: string
    objectives: string[]
}

// ── AI Lead Scoring Algorithm ──
function calculateLeadScore(lead: Lead): { score: number; label: string; emoji: string; color: string; icon: any } {
    let score = 0

    // Data completeness (0-30)
    if (lead.name) score += 10
    if (lead.email) score += 10
    if (lead.phone) score += 10

    // Has value assigned (0-20)
    if (lead.value && lead.value > 0) score += 20

    // Recency: newer leads score higher (0-25)
    const daysSinceCreated = (Date.now() - new Date(lead.created_at).getTime()) / (1000 * 60 * 60 * 24)
    if (daysSinceCreated < 1) score += 25
    else if (daysSinceCreated < 3) score += 20
    else if (daysSinceCreated < 7) score += 10
    else if (daysSinceCreated < 14) score += 5

    // Source quality (0-15)
    if (lead.utm_source === 'meta' || lead.utm_source === 'facebook' || lead.utm_source === 'instagram') score += 15
    else if (lead.utm_source === 'google') score += 12
    else if (lead.utm_source) score += 8

    // Product assigned (0-10)
    if (lead.product) score += 10

    if (score >= 70) return { score, label: 'Hot', emoji: '🔥', color: '#ef4444', icon: Flame }
    if (score >= 40) return { score, label: 'Warm', emoji: '⚡', color: '#f59e0b', icon: Zap }
    return { score, label: 'Cold', emoji: '🧊', color: '#3b82f6', icon: Snowflake }
}

export default function CRMBoard({ pipelines, stages, initialLeads, members, userRole, objectives }: Props) {
    const defaultPipeline = pipelines.find(p => p.is_default)?.id || pipelines[0]?.id || ''
    const [activePipelineId, setActivePipelineId] = useState(defaultPipeline)
    const [leads, setLeads] = useState<Lead[]>(initialLeads)
    const [dragLead, setDragLead] = useState<string | null>(null)
    const [dragOverStage, setDragOverStage] = useState<string | null>(null)
    const [searchQuery, setSearchQuery] = useState('')
    const [objectiveFilter, setObjectiveFilter] = useState<string>('all')
    const [showModal, setShowModal] = useState(false)
    const [editingLead, setEditingLead] = useState<Lead | null>(null)
    const [selectedLead, setSelectedLead] = useState<Lead | null>(null)
    const [activities, setActivities] = useState<any[]>([])
    const [loadingActivities, setLoadingActivities] = useState(false)
    const [saving, setSaving] = useState(false)

    // Date range filter
    const { range, activeKey, setActiveKey, customFrom, setCustomFrom, customTo, setCustomTo } = useDateRange('all')

    // Pipeline CRUD state
    const [showCreatePipeline, setShowCreatePipeline] = useState(false)
    const [newPipelineName, setNewPipelineName] = useState('')
    const [newPipelineSource, setNewPipelineSource] = useState('custom')
    const [newPipelineColor, setNewPipelineColor] = useState('#6366f1')
    const [pipelineLoading, setPipelineLoading] = useState(false)

    const handleCreatePipeline = async () => {
        if (!newPipelineName.trim()) return
        setPipelineLoading(true)
        try {
            const res = await fetch('/api/pipelines', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: newPipelineName, source_type: newPipelineSource, color: newPipelineColor }),
            })
            if (res.ok) window.location.reload()
            else { const err = await res.json(); alert(err.error || 'Errore') }
        } catch { alert('Errore di rete') }
        setPipelineLoading(false)
    }

    const handleDeletePipeline = async (pid: string) => {
        const p = pipelines.find(pp => pp.id === pid)
        if (p?.is_default) { alert('Non puoi eliminare la pipeline predefinita'); return }
        if (!confirm(`Eliminare "${p?.name}"? Gli stage verranno rimossi.`)) return
        try {
            const res = await fetch(`/api/pipelines?id=${pid}`, { method: 'DELETE' })
            if (res.ok) window.location.reload()
            else { const err = await res.json(); alert(err.error || 'Errore') }
        } catch { alert('Errore di rete') }
    }

    // Filter stages by active pipeline
    const activeStages = stages.filter(s => s.pipeline_id === activePipelineId)
    const activePipeline = pipelines.find(p => p.id === activePipelineId)
    const activeStageIds = new Set(activeStages.map(s => s.id))

    const filteredLeads = leads.filter(l => {
        const matchSearch = l.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (l.email || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
            (l.phone || '').toLowerCase().includes(searchQuery.toLowerCase())
        const matchObjective = objectiveFilter === 'all' || (l.funnels?.objective || '') === objectiveFilter
        const matchPipeline = l.stage_id ? activeStageIds.has(l.stage_id) : true
        const matchDate = range.key === 'all' || (() => {
            const d = new Date(l.created_at)
            return d >= range.from && d < range.to
        })()
        return matchSearch && matchObjective && matchPipeline && matchDate
    })

    // Sort leads by AI score (highest first) within each stage
    const getLeadsForStage = (stageId: string) =>
        filteredLeads
            .filter(l => l.stage_id === stageId)
            .sort((a, b) => calculateLeadScore(b).score - calculateLeadScore(a).score)

    // Calculate stage value totals
    const getStageValue = (stageId: string) =>
        filteredLeads.filter(l => l.stage_id === stageId).reduce((sum, l) => sum + (l.value || 0), 0)

    const getUnassignedLeads = () =>
        filteredLeads.filter(l => !l.stage_id)

    const getMemberName = (userId: string) => {
        const m = members.find(m => m.user_id === userId)
        return (m?.profiles as any)?.full_name || (m?.profiles as any)?.email || 'Non assegnato'
    }

    // Drag & Drop
    const handleDragStart = (leadId: string) => setDragLead(leadId)
    const handleDragOver = (e: React.DragEvent, stageId: string) => {
        e.preventDefault()
        setDragOverStage(stageId)
    }
    const handleDragLeave = () => setDragOverStage(null)

    const handleDrop = async (stageId: string) => {
        if (!dragLead) return
        setDragOverStage(null)

        const lead = leads.find(l => l.id === dragLead)
        if (!lead || lead.stage_id === stageId) {
            setDragLead(null)
            return
        }

        const oldStageId = lead.stage_id
        // Optimistic update
        setLeads(prev => prev.map(l => l.id === dragLead ? { ...l, stage_id: stageId } : l))
        setDragLead(null)

        try {
            await fetch('/api/leads', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: dragLead, stage_id: stageId, _old_stage_id: oldStageId }),
            })
        } catch {
            setLeads(prev => prev.map(l => l.id === dragLead ? { ...l, stage_id: oldStageId } : l))
        }
    }

    const handleSaveLead = async (formData: any) => {
        setSaving(true)
        try {
            if (editingLead) {
                const res = await fetch('/api/leads', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id: editingLead.id, ...formData }),
                })
                const updated = await res.json()
                if (!res.ok) throw new Error(updated.error)
                setLeads(prev => prev.map(l => l.id === editingLead.id ? { ...l, ...formData } : l))
            } else {
                const res = await fetch('/api/leads', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(formData),
                })
                const newLead = await res.json()
                if (!res.ok) throw new Error(newLead.error)
                setLeads(prev => [newLead, ...prev])
            }
            setShowModal(false)
            setEditingLead(null)
        } catch (err) {
            console.error('Error saving lead:', err)
        }
        setSaving(false)
    }

    const handleDeleteLead = async (id: string) => {
        if (!confirm('Eliminare questo lead?')) return
        try {
            await fetch(`/api/leads?id=${id}`, { method: 'DELETE' })
            setLeads(prev => prev.filter(l => l.id !== id))
            setSelectedLead(null)
        } catch (err) {
            console.error('Error deleting:', err)
        }
    }

    const openDetail = async (lead: Lead) => {
        setSelectedLead(lead)
        setLoadingActivities(true)
        try {
            const res = await fetch(`/api/lead-activities?lead_id=${lead.id}`)
            const data = await res.json()
            setActivities(Array.isArray(data) ? data : [])
        } catch {
            setActivities([])
        }
        setLoadingActivities(false)
    }

    const formatDate = (d: string) => {
        const date = new Date(d)
        return date.toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' })
    }

    const formatTime = (d: string) => {
        const date = new Date(d)
        return date.toLocaleString('it-IT', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
    }

    const formatCurrency = (v: number) =>
        new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(v)

    // Stats
    const totalValue = leads.reduce((s, l) => s + (l.value || 0), 0)
    const hotLeads = leads.filter(l => calculateLeadScore(l).label === 'Hot').length

    return (
        <div className="space-y-5 animate-fade-in">
            {/* Header */}
            <div className="flex items-center justify-between gap-4 flex-wrap">
                <div>
                    <h1 className="text-2xl font-bold text-white flex items-center gap-3">
                        <User className="w-6 h-6" style={{ color: '#3b82f6' }} />
                        CRM Pipeline
                    </h1>
                    <p className="text-sm mt-1" style={{ color: 'var(--color-surface-600)' }}>
                        {leads.length} lead{leads.length !== 1 ? 's' : ''} • {hotLeads > 0 && <span style={{ color: '#ef4444' }}>🔥 {hotLeads} hot</span>}{hotLeads > 0 && ' • '}{totalValue > 0 && <span style={{ color: '#22c55e' }}>{formatCurrency(totalValue)}</span>}
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    {objectives.length > 0 && (
                        <select
                            className="input !w-[180px] text-xs"
                            value={objectiveFilter}
                            onChange={e => setObjectiveFilter(e.target.value)}
                        >
                            <option value="all">🎯 Tutti gli obiettivi</option>
                            {objectives.map(obj => (
                                <option key={obj} value={obj}>
                                    {obj === 'cliente' ? '👤 Clienti' : obj === 'partner' ? '🤝 Partner' : obj === 'reclutamento' ? '👥 Reclutamento' : obj === 'brand' ? '📢 Brand' : obj === 'evento' ? '🎟️ Evento' : `🎯 ${obj}`}
                                </option>
                            ))}
                        </select>
                    )}
                    <DateRangeFilter activeKey={activeKey} onSelect={setActiveKey}
                        customFrom={customFrom} customTo={customTo}
                        onCustomFromChange={setCustomFrom} onCustomToChange={setCustomTo} />
                    <div className="relative">
                        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-surface-500)' }} />
                        <input
                            type="text"
                            className="input pl-10 !w-[220px]"
                            placeholder="Cerca lead..."
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                        />
                    </div>
                    <button onClick={() => { setEditingLead(null); setShowModal(true) }} className="btn-primary">
                        <Plus className="w-4 h-4" /> Nuovo Lead
                    </button>
                </div>
            </div>

            {/* Pipeline Tabs with CRUD */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
                {pipelines.map(p => {
                    const leadCount = leads.filter(l => l.stage_id && stages.some(s => s.id === l.stage_id && s.pipeline_id === p.id)).length
                    return (
                        <div key={p.id} className="flex items-center group/tab">
                            <button
                                onClick={() => setActivePipelineId(p.id)}
                                className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap"
                                style={{
                                    background: activePipelineId === p.id ? `${p.color}15` : 'transparent',
                                    color: activePipelineId === p.id ? p.color : 'var(--color-surface-500)',
                                    border: `1px solid ${activePipelineId === p.id ? p.color + '30' : 'var(--color-surface-200)'}`,
                                }}
                            >
                                <div className="w-2.5 h-2.5 rounded-full" style={{ background: p.color }} />
                                {p.name}
                                <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: `${p.color}10`, color: p.color }}>{leadCount}</span>
                                {!p.is_default && (
                                    <span onClick={(e) => { e.stopPropagation(); handleDeletePipeline(p.id) }}
                                        className="opacity-0 group-hover/tab:opacity-100 transition-opacity ml-1 hover:text-red-400 cursor-pointer">
                                        <X className="w-3 h-3" />
                                    </span>
                                )}
                            </button>
                        </div>
                    )
                })}
                <button onClick={() => setShowCreatePipeline(true)}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap hover:bg-white/5"
                    style={{ color: 'var(--color-surface-500)', border: '1px dashed var(--color-surface-300)' }}>
                    <Plus className="w-3 h-3" /> Nuova
                </button>
            </div>

            {/* Create Pipeline Modal */}
            {showCreatePipeline && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in" onClick={() => setShowCreatePipeline(false)}>
                    <div className="w-full max-w-md glass-card p-6 m-4" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-5">
                            <h2 className="text-lg font-bold text-white">Nuova Pipeline</h2>
                            <button onClick={() => setShowCreatePipeline(false)} className="p-2 rounded-xl hover:bg-white/5"><X className="w-5 h-5" style={{ color: 'var(--color-surface-500)' }} /></button>
                        </div>
                        <div className="space-y-4">
                            <div><label className="label">Nome *</label>
                                <input className="input" value={newPipelineName} onChange={e => setNewPipelineName(e.target.value)} placeholder="Es: Google Ads, LinkedIn, Webinar..." /></div>
                            <div><label className="label">Fonte</label>
                                <select className="input" value={newPipelineSource} onChange={e => setNewPipelineSource(e.target.value)}>
                                    <option value="ads">📢 ADS</option><option value="email">📧 Email</option>
                                    <option value="outreach">📞 Outreach</option><option value="affiliate">🤝 Affiliati</option>
                                    <option value="organic">🌱 Organico</option><option value="custom">⚙️ Custom</option>
                                </select></div>
                            <div><label className="label">Colore</label>
                                <div className="flex gap-2">
                                    {['#6366f1','#3b82f6','#22c55e','#f59e0b','#ef4444','#ec4899','#a855f7','#14b8a6'].map(c => (
                                        <button key={c} onClick={() => setNewPipelineColor(c)} className="w-7 h-7 rounded-lg" style={{ background: c, border: newPipelineColor === c ? '2px solid white' : '2px solid transparent', transform: newPipelineColor === c ? 'scale(1.15)' : 'scale(1)' }} />
                                    ))}
                                </div></div>
                            <div className="flex gap-3 pt-2">
                                <button onClick={() => setShowCreatePipeline(false)} className="btn-secondary flex-1">Annulla</button>
                                <button onClick={handleCreatePipeline} className="btn-primary flex-1" disabled={pipelineLoading || !newPipelineName.trim()}>
                                    {pipelineLoading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Crea'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Kanban Board */}
            <div className="flex gap-4 overflow-x-auto pb-4" style={{ minHeight: 'calc(100vh - 280px)' }}>
                {activeStages.map(stage => {
                    const stageLeads = getLeadsForStage(stage.id)
                    const isOver = dragOverStage === stage.id
                    return (
                        <div
                            key={stage.id}
                            className="flex-shrink-0 w-[300px] flex flex-col rounded-2xl transition-all duration-200"
                            style={{
                                background: isOver ? `${stage.color}10` : 'rgba(15, 15, 19, 0.4)',
                                border: `1px solid ${isOver ? stage.color + '40' : 'rgba(99, 102, 241, 0.06)'}`,
                            }}
                            onDragOver={(e) => handleDragOver(e, stage.id)}
                            onDragLeave={handleDragLeave}
                            onDrop={() => handleDrop(stage.id)}
                        >
                            {/* Stage Header */}
                            <div className="p-4 border-b" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
                                <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 rounded-full" style={{ background: stage.color }} />
                                    <span className="text-sm font-bold text-white">{stage.name}</span>
                                    <span className="ml-auto text-xs font-semibold px-2 py-0.5 rounded-full" style={{
                                        background: `${stage.color}20`,
                                        color: stage.color,
                                    }}>
                                        {stageLeads.length}
                                    </span>
                                </div>
                                <div className="flex items-center gap-2 mt-1">
                                    {stage.fire_capi_event && (
                                        <span className="text-[10px] font-medium" style={{ color: 'var(--color-surface-500)' }}>
                                            → {stage.fire_capi_event}
                                        </span>
                                    )}
                                    {getStageValue(stage.id) > 0 && (
                                        <span className="text-[10px] font-bold ml-auto" style={{ color: '#22c55e' }}>
                                            {formatCurrency(getStageValue(stage.id))}
                                        </span>
                                    )}
                                </div>
                            </div>

                            {/* Leads */}
                            <div className="flex-1 p-2 space-y-2 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 320px)' }}>
                                {stageLeads.map(lead => {
                                    const aiScore = calculateLeadScore(lead)
                                    const ScoreIcon = aiScore.icon
                                    return (
                                    <div
                                        key={lead.id}
                                        draggable
                                        onDragStart={() => handleDragStart(lead.id)}
                                        className="group p-3 rounded-xl cursor-grab active:cursor-grabbing transition-all duration-200 hover:scale-[1.02]"
                                        style={{
                                            background: 'rgba(15, 15, 19, 0.8)',
                                            border: `1px solid ${aiScore.label === 'Hot' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(255,255,255,0.06)'}`,
                                            opacity: dragLead === lead.id ? 0.5 : 1,
                                            boxShadow: aiScore.label === 'Hot' ? '0 0 20px rgba(239, 68, 68, 0.05)' : undefined,
                                        }}
                                    >
                                        <div className="flex items-start justify-between">
                                            <div className="flex items-center gap-2 flex-1 min-w-0">
                                                <GripVertical className="w-3 h-3 flex-shrink-0 opacity-30" style={{ color: 'var(--color-surface-500)' }} />
                                                <span className="text-sm font-semibold text-white truncate">{lead.name}</span>
                                            </div>
                                            <div className="flex items-center gap-1 flex-shrink-0">
                                                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-0.5" style={{
                                                    background: `${aiScore.color}15`,
                                                    color: aiScore.color,
                                                    border: `1px solid ${aiScore.color}25`,
                                                }}>
                                                    <ScoreIcon className="w-2.5 h-2.5" />
                                                    {aiScore.score}
                                                </span>
                                                <button onClick={() => openDetail(lead)} className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-lg hover:bg-white/5">
                                                    <Eye className="w-3.5 h-3.5" style={{ color: 'var(--color-surface-500)' }} />
                                                </button>
                                            </div>
                                        </div>

                                        {lead.product && (
                                            <div className="mt-2">
                                                <span className="badge" style={{
                                                    background: lead.product === 'Platinum' ? 'rgba(139, 92, 246, 0.1)' : 'rgba(245, 158, 11, 0.1)',
                                                    color: lead.product === 'Platinum' ? '#8b5cf6' : '#f59e0b',
                                                    border: `1px solid ${lead.product === 'Platinum' ? 'rgba(139, 92, 246, 0.2)' : 'rgba(245, 158, 11, 0.2)'}`,
                                                    fontSize: '11px',
                                                }}>
                                                    {lead.product}
                                                </span>
                                            </div>
                                        )}

                                        <div className="mt-2 space-y-1">
                                            {lead.phone && (
                                                <div className="flex items-center gap-1.5 text-[11px]" style={{ color: 'var(--color-surface-500)' }}>
                                                    <Phone className="w-3 h-3" /> {lead.phone}
                                                </div>
                                            )}
                                            {lead.value && (
                                                <div className="flex items-center gap-1.5 text-[11px] font-semibold" style={{ color: 'var(--color-success)' }}>
                                                    <DollarSign className="w-3 h-3" /> {formatCurrency(lead.value)}
                                                </div>
                                            )}
                                        </div>

                                        <div className="flex items-center justify-between mt-2 pt-2" style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                                            <span className="text-[10px]" style={{ color: 'var(--color-surface-500)' }}>
                                                {formatDate(lead.created_at)}
                                            </span>
                                            {lead.assigned_to && (
                                                <span className="text-[10px] px-2 py-0.5 rounded-full" style={{
                                                    background: 'rgba(59, 130, 246, 0.1)',
                                                    color: '#3b82f6',
                                                    border: '1px solid rgba(59, 130, 246, 0.15)',
                                                }}>
                                                    {getMemberName(lead.assigned_to)}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    )
                                })}

                                {stageLeads.length === 0 && (
                                    <div className="py-8 text-center">
                                        <p className="text-xs" style={{ color: 'var(--color-surface-500)' }}>Trascina qui un lead</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )
                })}
            </div>

            {/* Lead Modal (Create/Edit) */}
            {showModal && (
                <LeadModal
                    lead={editingLead}
                    stages={stages}
                    members={members}
                    saving={saving}
                    onSave={handleSaveLead}
                    onClose={() => { setShowModal(false); setEditingLead(null) }}
                />
            )}

            {/* Lead Detail Panel */}
            {selectedLead && (
                <LeadDetail
                    lead={selectedLead}
                    stages={stages}
                    members={members}
                    activities={activities}
                    loadingActivities={loadingActivities}
                    onClose={() => setSelectedLead(null)}
                    onEdit={(lead) => { setSelectedLead(null); setEditingLead(lead); setShowModal(true) }}
                    onDelete={handleDeleteLead}
                    getMemberName={getMemberName}
                    formatDate={formatDate}
                    formatTime={formatTime}
                    formatCurrency={formatCurrency}
                />
            )}
        </div>
    )
}

// ── Lead Create/Edit Modal ──
function LeadModal({ lead, stages, members, saving, onSave, onClose }: {
    lead: Lead | null
    stages: Stage[]
    members: Member[]
    saving: boolean
    onSave: (data: any) => void
    onClose: () => void
}) {
    const [form, setForm] = useState({
        name: lead?.name || '',
        email: lead?.email || '',
        phone: lead?.phone || '',
        product: lead?.product || '',
        value: lead?.value?.toString() || '',
        stage_id: lead?.stage_id || stages[0]?.id || '',
        assigned_to: lead?.assigned_to || '',
        notes: lead?.notes || '',
    })

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        onSave({
            ...form,
            value: form.value ? parseFloat(form.value) : null,
            assigned_to: form.assigned_to || null,
        })
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in" onClick={onClose}>
            <div className="w-full max-w-lg glass-card p-6 m-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-lg font-bold text-white">{lead ? 'Modifica Lead' : 'Nuovo Lead'}</h2>
                    <button onClick={onClose} className="p-2 rounded-xl hover:bg-white/5"><X className="w-5 h-5" style={{ color: 'var(--color-surface-500)' }} /></button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="label">Nome *</label>
                        <input className="input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Nome del lead" required />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="label">Email</label>
                            <input type="email" className="input" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="email@esempio.it" />
                        </div>
                        <div>
                            <label className="label">Telefono</label>
                            <input className="input" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="+39 ..." />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="label">Prodotto</label>
                            <select className="input" value={form.product} onChange={e => setForm({ ...form, product: e.target.value })}>
                                <option value="">Seleziona...</option>
                                <option value="Platinum">Platinum — €2.250</option>
                                <option value="Impact">Impact — €3.000</option>
                            </select>
                        </div>
                        <div>
                            <label className="label">Valore (€)</label>
                            <input type="number" step="0.01" className="input" value={form.value} onChange={e => setForm({ ...form, value: e.target.value })} placeholder="2250" />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="label">Stage</label>
                            <select className="input" value={form.stage_id} onChange={e => setForm({ ...form, stage_id: e.target.value })}>
                                {stages.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="label">Assegnato a</label>
                            <select className="input" value={form.assigned_to} onChange={e => setForm({ ...form, assigned_to: e.target.value })}>
                                <option value="">Non assegnato</option>
                                {members.filter(m => m.role === 'setter' || m.role === 'closer' || m.role === 'admin' || m.role === 'owner').map(m => (
                                    <option key={m.user_id} value={m.user_id}>
                                        {(m.profiles as any)?.full_name || (m.profiles as any)?.email} ({m.role})
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className="label">Note</label>
                        <textarea className="input" rows={3} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Note interne..." />
                    </div>

                    <div className="flex gap-3 pt-2">
                        <button type="button" onClick={onClose} className="btn-secondary flex-1">Annulla</button>
                        <button type="submit" className="btn-primary flex-1" disabled={saving}>
                            {saving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : lead ? 'Salva Modifiche' : 'Crea Lead'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}

// ── Lead Detail Panel ──
function LeadDetail({ lead, stages, members, activities, loadingActivities, onClose, onEdit, onDelete, getMemberName, formatDate, formatTime, formatCurrency }: {
    lead: Lead
    stages: Stage[]
    members: Member[]
    activities: any[]
    loadingActivities: boolean
    onClose: () => void
    onEdit: (lead: Lead) => void
    onDelete: (id: string) => void
    getMemberName: (id: string) => string
    formatDate: (d: string) => string
    formatTime: (d: string) => string
    formatCurrency: (v: number) => string
}) {
    const stage = stages.find(s => s.id === lead.stage_id)

    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in" onClick={onClose}>
            <div className="w-full max-w-lg glass-card p-6 m-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-5">
                    <h2 className="text-lg font-bold text-white">{lead.name}</h2>
                    <div className="flex items-center gap-2">
                        <button onClick={() => onEdit(lead)} className="p-2 rounded-xl hover:bg-white/5">
                            <Edit3 className="w-4 h-4" style={{ color: 'var(--color-sincro-400)' }} />
                        </button>
                        <button onClick={() => onDelete(lead.id)} className="p-2 rounded-xl hover:bg-white/5">
                            <Trash2 className="w-4 h-4" style={{ color: '#ef4444' }} />
                        </button>
                        <button onClick={onClose} className="p-2 rounded-xl hover:bg-white/5">
                            <X className="w-5 h-5" style={{ color: 'var(--color-surface-500)' }} />
                        </button>
                    </div>
                </div>

                {/* Info Grid */}
                <div className="grid grid-cols-2 gap-3 mb-5">
                    {stage && (
                        <div className="p-3 rounded-xl" style={{ background: `${stage.color}10`, border: `1px solid ${stage.color}20` }}>
                            <div className="text-[10px] uppercase tracking-wider font-semibold mb-1" style={{ color: 'var(--color-surface-500)' }}>Stage</div>
                            <div className="text-sm font-bold" style={{ color: stage.color }}>{stage.name}</div>
                        </div>
                    )}
                    {lead.product && (
                        <div className="p-3 rounded-xl" style={{ background: 'rgba(139, 92, 246, 0.05)', border: '1px solid rgba(139, 92, 246, 0.1)' }}>
                            <div className="text-[10px] uppercase tracking-wider font-semibold mb-1" style={{ color: 'var(--color-surface-500)' }}>Prodotto</div>
                            <div className="text-sm font-bold" style={{ color: '#8b5cf6' }}>{lead.product}</div>
                        </div>
                    )}
                    {lead.value && (
                        <div className="p-3 rounded-xl" style={{ background: 'rgba(34, 197, 94, 0.05)', border: '1px solid rgba(34, 197, 94, 0.1)' }}>
                            <div className="text-[10px] uppercase tracking-wider font-semibold mb-1" style={{ color: 'var(--color-surface-500)' }}>Valore</div>
                            <div className="text-sm font-bold" style={{ color: '#22c55e' }}>{formatCurrency(lead.value)}</div>
                        </div>
                    )}
                    {lead.assigned_to && (
                        <div className="p-3 rounded-xl" style={{ background: 'rgba(59, 130, 246, 0.05)', border: '1px solid rgba(59, 130, 246, 0.1)' }}>
                            <div className="text-[10px] uppercase tracking-wider font-semibold mb-1" style={{ color: 'var(--color-surface-500)' }}>Assegnato a</div>
                            <div className="text-sm font-bold" style={{ color: '#3b82f6' }}>{getMemberName(lead.assigned_to)}</div>
                        </div>
                    )}
                </div>

                {/* Contact */}
                <div className="space-y-2 mb-5">
                    {lead.email && (
                        <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--color-surface-600)' }}>
                            <Mail className="w-4 h-4" /> {lead.email}
                        </div>
                    )}
                    {lead.phone && (
                        <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--color-surface-600)' }}>
                            <Phone className="w-4 h-4" /> {lead.phone}
                        </div>
                    )}
                    <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--color-surface-600)' }}>
                        <Calendar className="w-4 h-4" /> Creato: {formatDate(lead.created_at)}
                    </div>
                </div>

                {/* Notes */}
                {lead.notes && (
                    <div className="mb-5 p-3 rounded-xl" style={{ background: 'var(--color-surface-100)', border: '1px solid var(--color-surface-200)' }}>
                        <div className="text-[10px] uppercase tracking-wider font-semibold mb-2" style={{ color: 'var(--color-surface-500)' }}>Note</div>
                        <p className="text-sm whitespace-pre-wrap" style={{ color: 'var(--color-surface-700)' }}>{lead.notes}</p>
                    </div>
                )}

                {/* Activity Timeline */}
                <div>
                    <div className="text-xs uppercase tracking-wider font-semibold mb-3" style={{ color: 'var(--color-surface-500)' }}>
                        <Clock className="w-3 h-3 inline mr-1" /> Attività
                    </div>
                    {loadingActivities ? (
                        <div className="py-4 text-center">
                            <div className="w-5 h-5 border-2 border-white/20 border-t-white/60 rounded-full animate-spin mx-auto" />
                        </div>
                    ) : activities.length > 0 ? (
                        <div className="space-y-3">
                            {activities.map((act: any) => (
                                <div key={act.id} className="flex gap-3">
                                    <div className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0" style={{ background: 'var(--color-sincro-500)' }} />
                                    <div>
                                        {act.activity_type === 'stage_changed' ? (
                                            <p className="text-xs" style={{ color: 'var(--color-surface-700)' }}>
                                                <span style={{ color: act.from_stage?.color }}>{act.from_stage?.name || '—'}</span>
                                                {' '}<ArrowRight className="w-3 h-3 inline" />{' '}
                                                <span style={{ color: act.to_stage?.color }}>{act.to_stage?.name || '—'}</span>
                                            </p>
                                        ) : (
                                            <p className="text-xs" style={{ color: 'var(--color-surface-700)' }}>
                                                {act.activity_type.replace(/_/g, ' ')}
                                            </p>
                                        )}
                                        <p className="text-[10px] mt-0.5" style={{ color: 'var(--color-surface-500)' }}>
                                            {act.user?.full_name || act.user?.email || 'Sistema'} • {formatTime(act.created_at)}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-xs text-center py-4" style={{ color: 'var(--color-surface-500)' }}>Nessuna attività</p>
                    )}
                </div>
            </div>
        </div>
    )
}
