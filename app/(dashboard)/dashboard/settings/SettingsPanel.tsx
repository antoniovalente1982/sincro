'use client'

import { useState, useEffect, useRef } from 'react'
import { Settings, Building2, User, Layers, Plus, Trash2, GripVertical, Save, X, Zap, AlertTriangle, Shuffle, Shield, TrendingUp, Users as UsersIcon, ToggleLeft, ToggleRight, Gauge, Loader2, Tag, Camera } from 'lucide-react'
import Link from 'next/link'

interface Stage {
    id: string; name: string; slug: string; color: string; sort_order: number
    is_won?: boolean; is_lost?: boolean; fire_capi_event?: string; pipeline_id?: string
}

interface Pipeline {
    id: string; name: string; slug: string; source_type: string; color: string; is_default: boolean
}

interface TrafficSource {
    id: string; name: string; color: string
}

interface CrmTag {
    id: string; name: string; color: string
}

interface Props {
    organization: any
    stages: Stage[]
    pipelines: Pipeline[]
    trafficSources: TrafficSource[]
    crmTags: CrmTag[]
    profile: any
    userRole: string
    userEmail: string
    isGoogleConnected?: boolean
}

export default function SettingsPanel({ organization, stages: initialStages, pipelines, trafficSources: initialSources, crmTags: initialCrmTags, profile, userRole, userEmail, isGoogleConnected }: Props) {
    const [orgName, setOrgName] = useState(organization?.name || '')
    const [fullName, setFullName] = useState(profile?.full_name || '')
    const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url || '')
    const [phone, setPhone] = useState(profile?.phone || '')
    const [stages, setStages] = useState<Stage[]>(initialStages)
    const [pipelineList, setPipelineList] = useState<Pipeline[]>(pipelines || [])
    const [saving, setSaving] = useState<string | null>(null)
    const [showNewStage, setShowNewStage] = useState(false)
    const [newStage, setNewStage] = useState({ name: '', color: '#6366f1', fire_capi_event: '', pipeline_id: '' })
    const [addToPipelineId, setAddToPipelineId] = useState<string>('')

    const [showNewPipeline, setShowNewPipeline] = useState(false)
    const [newPipeline, setNewPipeline] = useState({ name: '', color: '#3b82f6', source_type: 'custom' })

    const [sources, setSources] = useState<TrafficSource[]>(initialSources || [])
    const [showNewSource, setShowNewSource] = useState(false)
    const [newSource, setNewSource] = useState({ name: '', color: '#6366f1' })

    const [tagsList, setTagsList] = useState<CrmTag[]>(initialCrmTags || [])
    const [showNewTag, setShowNewTag] = useState(false)
    const [newTagInput, setNewTagInput] = useState({ name: '', color: '#10b981' })

    const canEdit = userRole === 'owner' || userRole === 'admin'
    const canAssignLeads = canEdit || userRole === 'manager'

    // Assignment state
    const [assignConfig, setAssignConfig] = useState<any>({ assignment_mode: 'manual', auto_assign_enabled: false, fallback_mode: 'manual' })
    const [settersList, setSettersList] = useState<any[]>([])
    const [assignStats, setAssignStats] = useState<Record<string, { total: number; won: number }>>({})
    const [savingAssign, setSavingAssign] = useState(false)
    const fileInputRef = useRef<HTMLInputElement>(null)

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return
        
        const reader = new FileReader()
        reader.onload = (event) => {
            const img = new Image()
            img.onload = () => {
                const canvas = document.createElement('canvas')
                const SIZE = 200
                canvas.width = SIZE
                canvas.height = SIZE
                const ctx = canvas.getContext('2d')
                if (!ctx) return
                
                const minDim = Math.min(img.width, img.height)
                const sx = (img.width - minDim) / 2
                const sy = (img.height - minDim) / 2
                ctx.drawImage(img, sx, sy, minDim, minDim, 0, 0, SIZE, SIZE)
                
                const dataUrl = canvas.toDataURL('image/jpeg', 0.8)
                setAvatarUrl(dataUrl)
            }
            img.src = event.target?.result as string
        }
        reader.readAsDataURL(file)
    }

    useEffect(() => {
        const loadAssignment = async () => {
            try {
                const res = await fetch('/api/assignment')
                if (res.ok) {
                    const data = await res.json()
                    if (data.config) setAssignConfig(data.config)
                    // Merge setter availability with member list
                    const merged = (data.members || []).map((m: any) => {
                        const sa = (data.setters || []).find((s: any) => s.user_id === m.user_id)
                        return {
                            user_id: m.user_id,
                            role: m.role,
                            full_name: m.profiles?.full_name || m.profiles?.email || m.user_id.slice(0, 8),
                            is_available: sa?.is_available ?? true,
                            max_daily_leads: sa?.max_daily_leads ?? 50,
                            weight: sa?.weight ?? 1,
                            leads_today: sa?.leads_today ?? 0,
                        }
                    })
                    setSettersList(merged)
                    setAssignStats(data.stats || {})
                }
            } catch {}
        }
        loadAssignment()
    }, [])

    const saveAssignConfig = async (mode?: string) => {
        setSavingAssign(true)
        try {
            await fetch('/api/assignment', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'update_config',
                    assignment_mode: mode || assignConfig.assignment_mode,
                    auto_assign_enabled: assignConfig.auto_assign_enabled,
                    fallback_mode: assignConfig.fallback_mode,
                }),
            })
            if (mode) setAssignConfig((p: any) => ({ ...p, assignment_mode: mode }))
        } catch {}
        setSavingAssign(false)
    }

    const updateSetter = async (userId: string, updates: any) => {
        setSettersList(prev => prev.map(s => s.user_id === userId ? { ...s, ...updates } : s))
        await fetch('/api/assignment', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'update_setter', user_id: userId, ...updates }),
        })
    }

    const assignModes = [
        { value: 'round_robin', label: 'Round Robin', icon: Shuffle, desc: 'Ciclico: A→B→C→A→B→C', color: '#3b82f6' },
        { value: 'manual', label: 'Manuale', icon: UsersIcon, desc: 'Assegna manualmente dal CRM', color: '#71717a' },
        { value: 'availability', label: 'Disponibilità', icon: Shield, desc: 'Solo setter disponibili con limite', color: '#22c55e' },
        { value: 'performance', label: 'Performance', icon: TrendingUp, desc: 'Priorità a chi chiude di più', color: '#f59e0b' },
        { value: 'weighted', label: 'Weighted', icon: Gauge, desc: 'Peso configurabile per setter', color: '#a855f7' },
    ]

    const saveAction = async (action: string, body: any) => {
        setSaving(action)
        try {
            const res = await fetch('/api/settings', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action, ...body }),
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || 'Unknown error occurred')
            
            // Show success alert only for profile updates
            if (action === 'update_profile') alert('Profilo salvato con successo!')
            return data
        } catch (err: any) {
            console.error(err)
            alert('Errore: ' + (err.message || 'Salvataggio fallito. Riprova.'))
            return null
        } finally {
            setSaving(null)
        }
    }

    const handleSaveOrg = () => saveAction('update_org', { name: orgName })
    const handleSaveProfile = () => saveAction('update_profile', { full_name: fullName, avatar_url: avatarUrl, phone: phone })

    const handleCreateStage = async () => {
        if (!newStage.name || !addToPipelineId) return
        const pipelineStages = stages.filter(s => s.pipeline_id === addToPipelineId)
        const result = await saveAction('create_stage', {
            ...newStage,
            pipeline_id: addToPipelineId,
            sort_order: pipelineStages.length,
            slug: newStage.name.toLowerCase().replace(/[^a-z0-9]/g, '_'),
        })
        if (result?.id) {
            setStages(prev => [...prev, { ...result, pipeline_id: addToPipelineId }])
            setNewStage({ name: '', color: '#6366f1', fire_capi_event: '', pipeline_id: '' })
            setShowNewStage(false)
            setAddToPipelineId('')
        }
    }

    const handleCreatePipeline = async () => {
        if (!newPipeline.name) return
        setSaving('create_pipeline')
        try {
            const res = await fetch('/api/pipelines', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newPipeline),
            })
            if (res.ok) {
                const data = await res.json()
                setPipelineList(prev => [...prev, data])
                setNewPipeline({ name: '', color: '#3b82f6', source_type: 'custom' })
                setShowNewPipeline(false)
                // Force a page turn refresh because stages are tied to pipeline creation defaults
                window.location.reload()
            } else {
                const err = await res.json()
                alert(err.error || 'Errore nella creazione della pipeline')
            }
        } catch {}
        setSaving(null)
    }

    const handleUpdatePipeline = async (pipeline: Pipeline, updates: Partial<Pipeline>) => {
        const result = await saveAction('update_pipeline', { id: pipeline.id, ...updates })
        if (result) setPipelineList(prev => prev.map(p => p.id === pipeline.id ? { ...p, ...updates } : p))
    }

    const handleDeletePipeline = async (id: string, name: string) => {
        if (!confirm(`Vuoi davvero eliminare la pipeline "${name}" e TUTTI i suoi stage? L'azione è irreversibile.`)) return
        setSaving('delete_pipeline')
        try {
            const res = await fetch(`/api/pipelines?id=${id}`, { method: 'DELETE' })
            if (res.ok) {
                setPipelineList(prev => prev.filter(p => p.id !== id))
            } else {
                const err = await res.json()
                alert(err.error || 'Errore durante l\'eliminazione. Ci sono lead in questa pipeline?')
            }
        } catch {}
        setSaving(null)
    }

    const handleUpdateStage = async (stage: Stage, updates: Partial<Stage>) => {
        const result = await saveAction('update_stage', { id: stage.id, ...updates })
        if (result) setStages(prev => prev.map(s => s.id === stage.id ? { ...s, ...updates } : s))
    }

    const handleDeleteStage = async (id: string) => {
        if (!confirm('Eliminare questo stage? I lead associati perderanno lo stage (torneranno su "Nuovi Lead").')) return
        const res = await saveAction('delete_stage', { id })
        if (res) {
            setStages(prev => prev.filter(s => s.id !== id))
        } else {
            alert('Errore durante l\'eliminazione. Riprova.')
        }
    }

    const handleCreateSource = async () => {
        if (!newSource.name) return
        const result = await saveAction('create_traffic_source', newSource)
        if (result?.id) {
            setSources(prev => [...prev, result].sort((a, b) => a.name.localeCompare(b.name)))
            setNewSource({ name: '', color: '#6366f1' })
            setShowNewSource(false)
        }
    }

    const handleUpdateSource = async (source: TrafficSource, updates: Partial<TrafficSource>) => {
        const result = await saveAction('update_traffic_source', { id: source.id, ...updates })
        if (result) setSources(prev => prev.map(s => s.id === source.id ? { ...s, ...updates } : s))
    }

    const handleDeleteSource = async (id: string, name: string) => {
        if (!confirm(`Vuoi davvero eliminare la fonte "${name}"? I lead che la possiedono non perderanno il testo, ma la fonte non avrà più il suo colore personalizzato.`)) return
        const res = await saveAction('delete_traffic_source', { id })
        if (res) setSources(prev => prev.filter(s => s.id !== id))
    }

    const handleCreateTag = async () => {
        if (!newTagInput.name) return
        try {
            const res = await fetch('/api/crm-tags', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: newTagInput.name, color: newTagInput.color }),
            })
            if (res.ok) {
                const created = await res.json()
                setTagsList(prev => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)))
                setNewTagInput({ name: '', color: '#10b981' })
                setShowNewTag(false)
            }
        } catch(e) { console.error(e) }
    }

    const handleUpdateTag = async (tag: CrmTag, updates: Partial<CrmTag>) => {
        setTagsList(prev => prev.map(t => t.id === tag.id ? { ...t, ...updates } : t))
        try {
            await fetch('/api/crm-tags', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: tag.id, ...updates }),
            })
        } catch(e) { console.error(e) }
    }

    const handleDeleteTag = async (id: string, name: string) => {
        if (!confirm(`Vuoi davvero eliminare il tag "${name}"? Verrà rimosso da tutti i lead (azione irreversibile).`)) return
        setTagsList(prev => prev.filter(t => t.id !== id))
        try {
            await fetch(`/api/crm-tags?id=${id}`, { method: 'DELETE' })
        } catch(e) { console.error(e) }
    }

    const stageColors = ['#3b82f6', '#8b5cf6', '#6366f1', '#22c55e', '#f59e0b', '#ec4899', '#ef4444', '#06b6d4', '#14b8a6', '#f97316']

    return (
        <div className="space-y-6 animate-fade-in max-w-3xl">
            <div>
                <h1 className="text-2xl font-bold text-white flex items-center gap-3">
                    <Settings className="w-6 h-6" style={{ color: 'var(--color-surface-500)' }} />
                    Impostazioni
                </h1>
                <p className="text-sm mt-1" style={{ color: 'var(--color-surface-600)' }}>
                    Configurazione organizzazione, pipeline e profilo
                </p>
            </div>

            {/* Organization */}
            <div className="glass-card p-6">
                <div className="flex items-center gap-2 mb-4">
                    <Building2 className="w-4 h-4" style={{ color: 'var(--color-sincro-400)' }} />
                    <h3 className="text-sm font-bold text-white">Organizzazione</h3>
                </div>
                <div className="space-y-4">
                    <div>
                        <label className="label">Nome</label>
                        <input className="input max-w-md" value={orgName} onChange={e => setOrgName(e.target.value)} disabled={!canEdit} />
                    </div>
                    {canEdit && (
                        <button onClick={handleSaveOrg} className="btn-primary" disabled={saving === 'update_org'}>
                            {saving === 'update_org' ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><Save className="w-4 h-4" /> Salva</>}
                        </button>
                    )}
                </div>
            </div>

            {/* Pipeline Stages — Grouped by Pipeline */}
            <div className="glass-card p-6">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <Layers className="w-4 h-4" style={{ color: 'var(--color-sincro-400)' }} />
                        <h3 className="text-sm font-bold text-white">Pipeline Stages</h3>
                    </div>
                    {canEdit && (
                        <button
                            onClick={() => setShowNewPipeline(true)}
                            className="text-[10px] font-semibold flex items-center gap-1 px-2 py-1 rounded-lg transition-colors hover:bg-white/5"
                            style={{ color: '#6366f1' }}
                        >
                            <Plus className="w-3 h-3" /> Crea Pipeline
                        </button>
                    )}
                </div>

                <p className="text-xs mb-5" style={{ color: 'var(--color-surface-500)' }}>
                    Configura gli stage per ogni pipeline. L'evento CAPI viene inviato a Meta quando un lead entra nello stage.
                </p>

                <div className="space-y-6">
                    {/* Add new pipeline row */}
                    {showNewPipeline && (
                        <div className="p-3 mb-6 rounded-xl animate-fade-in border border-indigo-500/20 bg-indigo-500/5">
                            <div className="flex items-center gap-3">
                                <input
                                    className="input flex-1 !py-2 text-xs"
                                    placeholder="Nome nuova pipeline (es. Lancio Libri)"
                                    value={newPipeline.name}
                                    onChange={e => setNewPipeline({ ...newPipeline, name: e.target.value })}
                                />
                                <input type="color" value={newPipeline.color} onChange={e => setNewPipeline({ ...newPipeline, color: e.target.value })} className="w-7 h-7 rounded cursor-pointer border-0 bg-transparent p-0" />
                                <button onClick={handleCreatePipeline} className="btn-primary !py-2 !px-3" disabled={!newPipeline.name || saving === 'create_pipeline'}>
                                    {saving === 'create_pipeline' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                                </button>
                                <button onClick={() => setShowNewPipeline(false)} className="p-2 rounded-lg hover:bg-white/5">
                                    <X className="w-4 h-4" style={{ color: 'var(--color-surface-500)' }} />
                                </button>
                            </div>
                        </div>
                    )}

                    {pipelineList.map(pipeline => {
                        const pipelineStages = stages.filter(s => s.pipeline_id === pipeline.id)
                        return (
                            <div key={pipeline.id}>
                                {/* Pipeline Header */}
                                <div className="flex items-center justify-between mb-3 pb-2 border-b group" style={{ borderColor: `${pipeline.color}30` }}>
                                    <div className="flex items-center gap-2 flex-1">
                                        <input
                                            type="color"
                                            value={pipeline.color}
                                            onChange={e => handleUpdatePipeline(pipeline, { color: e.target.value })}
                                            className="w-3 h-3 rounded-full cursor-pointer border-0 bg-transparent p-0 flex-shrink-0"
                                            disabled={!canEdit}
                                        />
                                        {canEdit ? (
                                            <input
                                                className="bg-transparent text-sm font-bold border-none outline-none flex-1 min-w-0 px-1 hover:bg-white/5 rounded transition-colors"
                                                style={{ color: pipeline.color }}
                                                value={pipeline.name}
                                                onChange={e => setPipelineList(prev => prev.map(p => p.id === pipeline.id ? { ...p, name: e.target.value } : p))}
                                                onBlur={() => handleUpdatePipeline(pipeline, { name: pipeline.name })}
                                            />
                                        ) : (
                                            <span className="text-sm font-bold" style={{ color: pipeline.color }}>{pipeline.name}</span>
                                        )}
                                        <span className="text-[10px] px-2 py-0.5 rounded-full" style={{
                                            background: `${pipeline.color}15`,
                                            color: pipeline.color,
                                            border: `1px solid ${pipeline.color}30`,
                                        }}>{pipeline.source_type}</span>
                                        {pipeline.is_default && (
                                            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-yellow-500/10 text-yellow-500 border border-yellow-500/20">DEFAULT</span>
                                        )}
                                    </div>
                                    {canEdit && (
                                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button
                                                onClick={() => { setAddToPipelineId(pipeline.id); setShowNewStage(true) }}
                                                className="text-[10px] font-semibold flex items-center gap-1 px-2 py-1 rounded-lg transition-colors hover:bg-white/10"
                                                style={{ color: pipeline.color }}
                                            >
                                                <Plus className="w-3 h-3" /> Aggiungi
                                            </button>
                                            {!pipeline.is_default && (
                                                <button onClick={() => handleDeletePipeline(pipeline.id, pipeline.name)} className="p-1 rounded-lg hover:bg-white/10 ml-1">
                                                    <Trash2 className="w-3 h-3" style={{ color: '#ef4444' }} />
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* Stages list */}
                                <div className="space-y-1.5 ml-3">
                                    {pipelineStages.map(stage => (
                                        <div key={stage.id} className="flex items-center gap-3 p-2.5 rounded-xl group" style={{ background: 'var(--color-surface-100)', border: '1px solid var(--color-surface-200)' }}>
                                            <GripVertical className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'var(--color-surface-400)' }} />
                                            <div className="w-3.5 h-3.5 rounded-full flex-shrink-0" style={{ background: stage.color }} />
                                            <div className="flex-1 min-w-0">
                                                {canEdit ? (
                                                    <input
                                                        className="bg-transparent text-sm font-semibold text-white border-none outline-none w-full"
                                                        value={stage.name}
                                                        onChange={e => setStages(prev => prev.map(s => s.id === stage.id ? { ...s, name: e.target.value } : s))}
                                                        onBlur={() => handleUpdateStage(stage, { name: stage.name })}
                                                    />
                                                ) : (
                                                    <span className="text-sm font-semibold text-white">{stage.name}</span>
                                                )}
                                            </div>
                                            {/* CAPI badge */}
                                            {stage.fire_capi_event ? (
                                                <span className="badge badge-info" style={{ fontSize: '10px' }}>
                                                    <Zap className="w-2.5 h-2.5" /> {stage.fire_capi_event}
                                                </span>
                                            ) : (
                                                <span className="text-[10px] px-2 py-0.5 rounded-lg" style={{ color: 'var(--color-surface-500)', background: 'var(--color-surface-200)' }}>No CAPI</span>
                                            )}
                                            {canEdit && (
                                                <div className="flex items-center gap-1">
                                                    <select
                                                        className="bg-transparent text-[10px] border rounded-lg px-1.5 py-1 outline-none"
                                                        style={{ color: 'var(--color-surface-500)', borderColor: 'var(--color-surface-300)' }}
                                                        value={stage.fire_capi_event || ''}
                                                        onChange={e => handleUpdateStage(stage, { fire_capi_event: e.target.value || null } as any)}
                                                    >
                                                        <option value="">Nessun CAPI</option>
                                                        <option value="Lead">Lead</option>
                                                        <option value="QualifiedLead">QualifiedLead</option>
                                                        <option value="Contact">Contact</option>
                                                        <option value="Schedule">Schedule</option>
                                                        <option value="ShowUp">ShowUp</option>
                                                        <option value="ViewContent">ViewContent</option>
                                                        <option value="InitiateCheckout">InitiateCheckout</option>
                                                        <option value="CompleteRegistration">CompleteRegistration</option>
                                                        <option value="Purchase">Purchase</option>
                                                    </select>
                                                    <input
                                                        type="color"
                                                        value={stage.color}
                                                        onChange={e => handleUpdateStage(stage, { color: e.target.value })}
                                                        className="w-5 h-5 rounded cursor-pointer border-0 bg-transparent"
                                                    />
                                                    <button onClick={() => handleDeleteStage(stage.id)} className="p-1 rounded-lg hover:bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <Trash2 className="w-3 h-3" style={{ color: '#ef4444' }} />
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                    {pipelineStages.length === 0 && (
                                        <p className="text-xs py-2 text-center" style={{ color: 'var(--color-surface-500)' }}>Nessuno stage — aggiungi il primo!</p>
                                    )}
                                </div>
                            </div>
                        )
                    })}
                </div>

                {/* New Stage Form */}
                {showNewStage && (
                    <div className="mt-4 p-3 rounded-xl animate-fade-in" style={{ background: 'rgba(99, 102, 241, 0.05)', border: '1px solid rgba(99, 102, 241, 0.1)' }}>
                        <div className="text-[10px] font-semibold mb-2" style={{ color: 'var(--color-surface-500)' }}>
                            Aggiungere a: <span className="text-white">{pipelines.find(p => p.id === addToPipelineId)?.name || 'Pipeline'}</span>
                        </div>
                        <div className="flex items-center gap-3">
                            <input
                                className="input flex-1 !py-2"
                                placeholder="Nome stage"
                                value={newStage.name}
                                onChange={e => setNewStage({ ...newStage, name: e.target.value })}
                                autoFocus
                            />
                            <select className="input !w-auto !py-2 text-xs" value={newStage.fire_capi_event} onChange={e => setNewStage({ ...newStage, fire_capi_event: e.target.value })}>
                                <option value="">Nessun CAPI</option>
                                <option value="Lead">Lead</option>
                                <option value="QualifiedLead">QualifiedLead</option>
                                <option value="Contact">Contact</option>
                                <option value="Schedule">Schedule</option>
                                <option value="ShowUp">ShowUp</option>
                                <option value="ViewContent">ViewContent</option>
                                <option value="InitiateCheckout">InitiateCheckout</option>
                                <option value="CompleteRegistration">CompleteRegistration</option>
                                <option value="Purchase">Purchase</option>
                            </select>
                            <input type="color" value={newStage.color} onChange={e => setNewStage({ ...newStage, color: e.target.value })} className="w-7 h-7 rounded cursor-pointer border-0 bg-transparent" />
                            <button onClick={handleCreateStage} className="btn-primary !py-2 !px-3" disabled={!newStage.name}>
                                <Plus className="w-4 h-4" />
                            </button>
                            <button onClick={() => { setShowNewStage(false); setAddToPipelineId('') }} className="p-2 rounded-lg hover:bg-white/5">
                                <X className="w-4 h-4" style={{ color: 'var(--color-surface-500)' }} />
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Traffic Sources */}
            <div className="glass-card p-6">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <Tag className="w-4 h-4" style={{ color: 'var(--color-sincro-400)' }} />
                        <h3 className="text-sm font-bold text-white">Fonti di Traffico (Tag)</h3>
                    </div>
                    {canEdit && (
                        <button
                            onClick={() => setShowNewSource(true)}
                            className="text-[10px] font-semibold flex items-center gap-1 px-2 py-1 rounded-lg transition-colors hover:bg-white/5"
                            style={{ color: '#6366f1' }}
                        >
                            <Plus className="w-3 h-3" /> Aggiungi fonte
                        </button>
                    )}
                </div>

                <p className="text-xs mb-5" style={{ color: 'var(--color-surface-500)' }}>
                    Personalizza il colore del badge che apparirà sulle card dei lead raggruppati per "Fonte di traffico".
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {sources.map(source => (
                        <div key={source.id} className="flex items-center justify-between p-3 rounded-xl group" style={{ background: 'var(--color-surface-100)', border: '1px solid var(--color-surface-200)' }}>
                            <div className="flex items-center gap-2 min-w-0 flex-1">
                                <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: source.color }} />
                                {canEdit ? (
                                    <input
                                        className="bg-transparent text-xs font-semibold text-white border-none outline-none w-full truncate"
                                        value={source.name}
                                        onChange={e => setSources(prev => prev.map(s => s.id === source.id ? { ...s, name: e.target.value } : s))}
                                        onBlur={() => handleUpdateSource(source, { name: source.name })}
                                    />
                                ) : (
                                    <span className="text-xs font-semibold text-white truncate">{source.name}</span>
                                )}
                            </div>
                            {canEdit && (
                                <div className="flex items-center gap-2 flex-shrink-0">
                                    <input
                                        type="color"
                                        value={source.color}
                                        onChange={e => handleUpdateSource(source, { color: e.target.value })}
                                        className="w-5 h-5 rounded cursor-pointer border-0 bg-transparent p-0"
                                    />
                                    <button onClick={() => handleDeleteSource(source.id, source.name)} className="p-1 rounded-lg hover:bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <Trash2 className="w-3 h-3" style={{ color: '#ef4444' }} />
                                    </button>
                                </div>
                            )}
                        </div>
                    ))}
                    {sources.length === 0 && (
                        <div className="col-span-full text-xs text-center py-4" style={{ color: 'var(--color-surface-500)' }}>Nessuna fonte configurata.</div>
                    )}
                </div>

                {showNewSource && (
                    <div className="mt-4 p-3 rounded-xl animate-fade-in" style={{ background: 'rgba(99, 102, 241, 0.05)', border: '1px solid rgba(99, 102, 241, 0.1)' }}>
                        <div className="flex items-center gap-3">
                            <input
                                className="input flex-1 !py-2 text-xs"
                                placeholder="Nome esatto della fonte (es: Fonte: Ads - Meta)"
                                value={newSource.name}
                                onChange={e => setNewSource({ ...newSource, name: e.target.value })}
                                autoFocus
                            />
                            <input type="color" value={newSource.color} onChange={e => setNewSource({ ...newSource, color: e.target.value })} className="w-7 h-7 rounded cursor-pointer border-0 bg-transparent p-0" />
                            <button onClick={handleCreateSource} className="btn-primary !py-2 !px-3" disabled={!newSource.name}>
                                <Plus className="w-4 h-4" />
                            </button>
                            <button onClick={() => setShowNewSource(false)} className="p-2 rounded-lg hover:bg-white/5">
                                <X className="w-4 h-4" style={{ color: 'var(--color-surface-500)' }} />
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* CRM Tags */}
            <div className="glass-card p-6">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <Tag className="w-4 h-4" style={{ color: 'var(--color-sincro-400)' }} />
                        <h3 className="text-sm font-bold text-white">Tag CRM</h3>
                    </div>
                    {canEdit && (
                        <button
                            onClick={() => setShowNewTag(true)}
                            className="text-[10px] font-semibold flex items-center gap-1 px-2 py-1 rounded-lg transition-colors hover:bg-white/5"
                            style={{ color: '#10b981' }}
                        >
                            <Plus className="w-3 h-3" /> Crea Tag
                        </button>
                    )}
                </div>

                <p className="text-xs mb-5" style={{ color: 'var(--color-surface-500)' }}>
                    Crea tag globali da poter assegnare ai Lead all'interno delle loro schede.
                </p>

                <div className="flex flex-wrap gap-2">
                    {tagsList.map(tag => (
                        <div key={tag.id} className="flex items-center gap-2 px-3 py-1.5 rounded-lg group" style={{ background: `${tag.color}15`, border: `1px solid ${tag.color}30` }}>
                            {canEdit ? (
                                <>
                                    <input
                                        type="color"
                                        value={tag.color}
                                        onChange={e => handleUpdateTag(tag, { color: e.target.value })}
                                        className="w-4 h-4 rounded cursor-pointer border-0 bg-transparent p-0 flex-shrink-0"
                                    />
                                    <input
                                        className="bg-transparent text-xs font-semibold border-none outline-none min-w-[60px] max-w-[150px]"
                                        style={{ color: tag.color }}
                                        value={tag.name}
                                        onChange={e => setTagsList(prev => prev.map(t => t.id === tag.id ? { ...t, name: e.target.value } : t))}
                                        onBlur={() => handleUpdateTag(tag, { name: tag.name })}
                                    />
                                    <button onClick={() => handleDeleteTag(tag.id, tag.name)} className="opacity-0 group-hover:opacity-100 transition-opacity ml-1 hover:opacity-70">
                                        <X className="w-3 h-3" style={{ color: tag.color }} />
                                    </button>
                                </>
                            ) : (
                                <span className="text-xs font-semibold" style={{ color: tag.color }}>{tag.name}</span>
                            )}
                        </div>
                    ))}
                    {tagsList.length === 0 && (
                        <div className="text-xs py-2 w-full" style={{ color: 'var(--color-surface-500)' }}>Nessun tag disponibile.</div>
                    )}
                </div>

                {showNewTag && (
                    <div className="mt-4 p-3 rounded-xl animate-fade-in" style={{ background: 'rgba(16, 185, 129, 0.05)', border: '1px solid rgba(16, 185, 129, 0.1)' }}>
                        <div className="flex items-center gap-3">
                            <input
                                className="input flex-1 !py-2 text-xs"
                                placeholder="Nome del tag (es: VIP, Urgente...)"
                                value={newTagInput.name}
                                onChange={e => setNewTagInput({ ...newTagInput, name: e.target.value })}
                                autoFocus
                            />
                            <input type="color" value={newTagInput.color} onChange={e => setNewTagInput({ ...newTagInput, color: e.target.value })} className="w-7 h-7 rounded cursor-pointer border-0 bg-transparent p-0" />
                            <button onClick={handleCreateTag} className="btn-primary !py-2 !px-3" disabled={!newTagInput.name}>
                                <Plus className="w-4 h-4" />
                            </button>
                            <button onClick={() => setShowNewTag(false)} className="p-2 rounded-lg hover:bg-white/5">
                                <X className="w-4 h-4" style={{ color: 'var(--color-surface-500)' }} />
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Lead Assignment */}
            {canAssignLeads && (
                <div className="glass-card p-6">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                            <Shuffle className="w-4 h-4" style={{ color: '#3b82f6' }} />
                            <h3 className="text-sm font-bold text-white">Assegnazione Lead</h3>
                        </div>
                        <button
                            onClick={() => {
                                const next = !assignConfig.auto_assign_enabled
                                setAssignConfig((p: any) => ({ ...p, auto_assign_enabled: next }))
                                fetch('/api/assignment', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ action: 'update_config', ...assignConfig, auto_assign_enabled: next }),
                                })
                            }}
                            className="flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
                            style={{
                                background: assignConfig.auto_assign_enabled ? 'rgba(34, 197, 94, 0.1)' : 'var(--color-surface-200)',
                                color: assignConfig.auto_assign_enabled ? '#22c55e' : 'var(--color-surface-500)',
                                border: `1px solid ${assignConfig.auto_assign_enabled ? 'rgba(34, 197, 94, 0.2)' : 'var(--color-surface-300)'}`,
                            }}
                        >
                            {assignConfig.auto_assign_enabled ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
                            {assignConfig.auto_assign_enabled ? 'Auto-assign ON' : 'Auto-assign OFF'}
                        </button>
                    </div>

                    {/* Mode selector */}
                    <div className="grid grid-cols-2 lg:grid-cols-5 gap-2 mb-5">
                        {assignModes.map(mode => (
                            <button
                                key={mode.value}
                                onClick={() => saveAssignConfig(mode.value)}
                                className="p-3 rounded-xl text-left transition-all"
                                style={{
                                    background: assignConfig.assignment_mode === mode.value ? `${mode.color}15` : 'var(--color-surface-100)',
                                    border: `1px solid ${assignConfig.assignment_mode === mode.value ? `${mode.color}40` : 'var(--color-surface-200)'}`,
                                }}
                            >
                                <mode.icon className="w-4 h-4 mb-1" style={{ color: assignConfig.assignment_mode === mode.value ? mode.color : 'var(--color-surface-500)' }} />
                                <div className="text-xs font-bold" style={{ color: assignConfig.assignment_mode === mode.value ? mode.color : 'var(--color-surface-400)' }}>{mode.label}</div>
                                <div className="text-[10px] mt-0.5" style={{ color: 'var(--color-surface-600)' }}>{mode.desc}</div>
                            </button>
                        ))}
                    </div>

                    {/* Setter list */}
                    {settersList.length > 0 && (
                        <div>
                            <div className="text-xs font-semibold text-white mb-2">Team Setter/Closer</div>
                            <div className="space-y-2">
                                {settersList.map(s => (
                                    <div key={s.user_id} className="flex items-center gap-3 p-3 rounded-xl" style={{ background: 'var(--color-surface-100)', border: '1px solid var(--color-surface-200)' }}>
                                        <button
                                            onClick={() => updateSetter(s.user_id, { is_available: !s.is_available, max_daily_leads: s.max_daily_leads, weight: s.weight })}
                                            className="w-5 h-5 rounded-md flex-shrink-0" style={{
                                                background: s.is_available ? 'rgba(34, 197, 94, 0.2)' : 'rgba(239, 68, 68, 0.1)',
                                                border: `1px solid ${s.is_available ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.2)'}`,
                                            }}
                                        >
                                            <div className="w-2 h-2 rounded-full mx-auto mt-[5px]" style={{ background: s.is_available ? '#22c55e' : '#ef4444' }} />
                                        </button>
                                        <div className="flex-1 min-w-0">
                                            <div className="text-xs font-semibold text-white truncate">{s.full_name}</div>
                                            <div className="text-[10px]" style={{ color: 'var(--color-surface-500)' }}>
                                                {s.role} • {s.leads_today} lead oggi • {assignStats[s.user_id]?.won || 0}/{assignStats[s.user_id]?.total || 0} vinti
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <div className="text-center">
                                                <div className="text-[9px] uppercase" style={{ color: 'var(--color-surface-600)' }}>Max/giorno</div>
                                                <input
                                                    type="number"
                                                    className="w-14 text-center text-xs bg-transparent border rounded px-1 py-0.5"
                                                    style={{ borderColor: 'var(--color-surface-300)', color: 'white' }}
                                                    value={s.max_daily_leads}
                                                    onChange={e => updateSetter(s.user_id, { is_available: s.is_available, max_daily_leads: parseInt(e.target.value) || 50, weight: s.weight })}
                                                />
                                            </div>
                                            {assignConfig.assignment_mode === 'weighted' && (
                                                <div className="text-center">
                                                    <div className="text-[9px] uppercase" style={{ color: 'var(--color-surface-600)' }}>Peso</div>
                                                    <input
                                                        type="number"
                                                        min={1} max={10}
                                                        className="w-12 text-center text-xs bg-transparent border rounded px-1 py-0.5"
                                                        style={{ borderColor: 'var(--color-surface-300)', color: 'white' }}
                                                        value={s.weight}
                                                        onChange={e => updateSetter(s.user_id, { is_available: s.is_available, max_daily_leads: s.max_daily_leads, weight: parseInt(e.target.value) || 1 })}
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Prospecting link */}
                    <div className="mt-4 pt-4 border-t" style={{ borderColor: 'var(--color-surface-200)' }}>
                        <Link href="/dashboard/settings/prospecting" className="flex items-center gap-2 text-xs font-semibold transition-colors hover:opacity-80" style={{ color: '#a855f7' }}>
                            <Shield className="w-4 h-4" /> Gestisci Agenti Prospecting →
                        </Link>
                    </div>
                </div>
            )}

            {/* Profile */}
            <div className="glass-card p-6">
                <div className="flex items-center gap-2 mb-4">
                    <User className="w-4 h-4" style={{ color: 'var(--color-sincro-400)' }} />
                    <h3 className="text-sm font-bold text-white">Profilo</h3>
                </div>
                <div className="space-y-4">
                    <div>
                        <label className="label">Email</label>
                        <input className="input max-w-md" value={userEmail} disabled />
                    </div>
                    <div>
                        <label className="label">Foto Profilo</label>
                        <div className="mt-2 flex items-center gap-6">
                            <div 
                                className="relative w-24 h-24 rounded-full overflow-hidden border-2 flex-shrink-0 cursor-pointer group bg-black/40"
                                style={{ borderColor: 'var(--color-surface-400)' }}
                                onClick={() => fileInputRef.current?.click()}
                            >
                                {avatarUrl ? (
                                    <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center">
                                        <User className="w-10 h-10" style={{ color: 'var(--color-surface-500)' }} />
                                    </div>
                                )}
                                <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Camera className="w-6 h-6 text-white mb-1" />
                                    <span className="text-[9px] font-bold text-white uppercase tracking-wider">Cambia</span>
                                </div>
                            </div>
                            <div className="flex-1">
                                <p className="text-xs mb-3" style={{ color: 'var(--color-surface-500)' }}>
                                    Clicca sull'immagine per caricare una nuova foto. Verrà automaticamente ridimensionata e ritagliata.
                                </p>
                                <input 
                                    type="file" 
                                    ref={fileInputRef}
                                    accept="image/*"
                                    className="hidden"
                                    onChange={handleFileChange}
                                />
                            </div>
                        </div>
                    </div>
                    <div>
                        <label className="label">Nome completo</label>
                        <input className="input max-w-md" value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Il tuo nome e cognome" />
                    </div>
                    <div>
                        <label className="label">Numero di Telefono</label>
                        <input className="input max-w-md" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+39 ..." />
                    </div>
                    <button onClick={handleSaveProfile} className="btn-primary" disabled={saving === 'update_profile'}>
                        {saving === 'update_profile' ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><Save className="w-4 h-4" /> Salva Profilo</>}
                    </button>
                </div>
            </div>

            {/* Integrazioni */}
            <div className="glass-card p-6">
                <div className="flex items-center gap-2 mb-4">
                    <Zap className="w-4 h-4" style={{ color: 'var(--color-sincro-400)' }} />
                    <h3 className="text-sm font-bold text-white">Integrazioni</h3>
                </div>
                <div className="space-y-4">
                    <p className="text-xs" style={{ color: 'var(--color-surface-500)' }}>
                        Collega i servizi esterni per abilitare funzionalità avanzate come la sincronizzazione automatica degli appuntamenti.
                    </p>
                    <div className="flex items-center justify-between p-4 rounded-xl border" style={{ background: 'var(--color-surface-100)', borderColor: 'var(--color-surface-200)' }}>
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center flex-shrink-0">
                                {/* Simple Google G logo */}
                                <svg className="w-5 h-5" viewBox="0 0 24 24">
                                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                                </svg>
                            </div>
                            <div>
                                <div className="text-sm font-bold text-white flex items-center gap-2">
                                    Google Calendar
                                    {isGoogleConnected && (
                                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-500/10 text-green-500 border border-green-500/20 font-semibold">
                                            Connesso
                                        </span>
                                    )}
                                </div>
                                <div className="text-[10px]" style={{ color: 'var(--color-surface-500)' }}>
                                    Sincronizza appuntamenti e disponibilità
                                </div>
                            </div>
                        </div>
                        {isGoogleConnected ? (
                            <button
                                onClick={() => {
                                    if(confirm('Sei sicuro di voler disconnettere il calendario? I tuoi appuntamenti smetteranno di sincronizzarsi.')) {
                                        saveAction('disconnect_google', {}).then(() => window.location.reload())
                                    }
                                }}
                                disabled={saving === 'disconnect_google'}
                                className="text-xs font-semibold px-4 py-2 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-colors disabled:opacity-50"
                            >
                                {saving === 'disconnect_google' ? 'Disconnessione...' : 'Disconnetti'}
                            </button>
                        ) : (
                            <a 
                                href="/api/auth/google"
                                className="text-xs font-semibold px-4 py-2 rounded-lg bg-white text-black hover:bg-gray-100 transition-colors"
                            >
                                Connetti
                            </a>
                        )}
                    </div>
                </div>
            </div>

            {/* Danger Zone */}
            <div className="glass-card p-6" style={{ borderColor: 'rgba(239, 68, 68, 0.15)' }}>
                <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="w-4 h-4" style={{ color: '#ef4444' }} />
                    <h3 className="text-sm font-bold" style={{ color: '#ef4444' }}>Zona Pericolosa</h3>
                </div>
                <p className="text-xs mb-4" style={{ color: 'var(--color-surface-500)' }}>Queste azioni sono irreversibili. Contatta il supporto per assistenza.</p>
                <button className="btn-danger opacity-50 cursor-not-allowed" disabled>
                    Elimina Organizzazione
                </button>
            </div>
        </div>
    )
}
