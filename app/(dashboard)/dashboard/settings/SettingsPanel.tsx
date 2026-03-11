'use client'

import { useState } from 'react'
import { Settings, Building2, User, Layers, Plus, Trash2, GripVertical, Save, X, Zap, AlertTriangle } from 'lucide-react'

interface Stage {
    id: string; name: string; slug: string; color: string; sort_order: number
    is_won?: boolean; is_lost?: boolean; fire_capi_event?: string
}

interface Props {
    organization: any
    stages: Stage[]
    profile: any
    userRole: string
    userEmail: string
}

export default function SettingsPanel({ organization, stages: initialStages, profile, userRole, userEmail }: Props) {
    const [orgName, setOrgName] = useState(organization?.name || '')
    const [fullName, setFullName] = useState(profile?.full_name || '')
    const [stages, setStages] = useState<Stage[]>(initialStages)
    const [saving, setSaving] = useState<string | null>(null)
    const [showNewStage, setShowNewStage] = useState(false)
    const [newStage, setNewStage] = useState({ name: '', color: '#6366f1', fire_capi_event: '' })

    const canEdit = userRole === 'owner' || userRole === 'admin'

    const saveAction = async (action: string, body: any) => {
        setSaving(action)
        try {
            const res = await fetch('/api/settings', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action, ...body }),
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error)
            return data
        } catch (err) {
            console.error(err)
            return null
        } finally {
            setSaving(null)
        }
    }

    const handleSaveOrg = () => saveAction('update_org', { name: orgName })
    const handleSaveProfile = () => saveAction('update_profile', { full_name: fullName })

    const handleCreateStage = async () => {
        if (!newStage.name) return
        const result = await saveAction('create_stage', {
            ...newStage,
            sort_order: stages.length,
            slug: newStage.name.toLowerCase().replace(/[^a-z0-9]/g, '_'),
        })
        if (result?.id) {
            setStages(prev => [...prev, result])
            setNewStage({ name: '', color: '#6366f1', fire_capi_event: '' })
            setShowNewStage(false)
        }
    }

    const handleUpdateStage = async (stage: Stage, updates: Partial<Stage>) => {
        const result = await saveAction('update_stage', { id: stage.id, ...updates })
        if (result) setStages(prev => prev.map(s => s.id === stage.id ? { ...s, ...updates } : s))
    }

    const handleDeleteStage = async (id: string) => {
        if (!confirm('Eliminare questo stage? I lead associati perderanno lo stage.')) return
        await saveAction('delete_stage', { id })
        setStages(prev => prev.filter(s => s.id !== id))
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

            {/* Pipeline Stages */}
            <div className="glass-card p-6">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <Layers className="w-4 h-4" style={{ color: 'var(--color-sincro-400)' }} />
                        <h3 className="text-sm font-bold text-white">Pipeline Stages</h3>
                    </div>
                    {canEdit && (
                        <button onClick={() => setShowNewStage(true)} className="btn-primary !py-1.5 !px-3 !text-xs">
                            <Plus className="w-3 h-3" /> Aggiungi
                        </button>
                    )}
                </div>

                <p className="text-xs mb-4" style={{ color: 'var(--color-surface-500)' }}>
                    Configura gli stage del pipeline. L'evento Meta CAPI viene inviato automaticamente quando un lead entra in quello stage.
                </p>

                <div className="space-y-2">
                    {stages.map((stage, i) => (
                        <div key={stage.id} className="flex items-center gap-3 p-3 rounded-xl group" style={{ background: 'var(--color-surface-100)', border: '1px solid var(--color-surface-200)' }}>
                            <GripVertical className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--color-surface-400)' }} />
                            <div className="w-4 h-4 rounded-full flex-shrink-0" style={{ background: stage.color }} />
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
                            {stage.fire_capi_event && (
                                <span className="badge badge-info" style={{ fontSize: '10px' }}>
                                    <Zap className="w-2.5 h-2.5" /> {stage.fire_capi_event}
                                </span>
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
                                        <option value="Schedule">Schedule</option>
                                        <option value="Contact">Contact</option>
                                        <option value="ViewContent">ViewContent</option>
                                        <option value="Purchase">Purchase</option>
                                    </select>
                                    <input
                                        type="color"
                                        value={stage.color}
                                        onChange={e => handleUpdateStage(stage, { color: e.target.value })}
                                        className="w-6 h-6 rounded cursor-pointer border-0 bg-transparent"
                                    />
                                    <button onClick={() => handleDeleteStage(stage.id)} className="p-1 rounded-lg hover:bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <Trash2 className="w-3.5 h-3.5" style={{ color: '#ef4444' }} />
                                    </button>
                                </div>
                            )}
                        </div>
                    ))}
                </div>

                {/* New Stage Form */}
                {showNewStage && (
                    <div className="mt-3 p-3 rounded-xl animate-fade-in" style={{ background: 'rgba(99, 102, 241, 0.05)', border: '1px solid rgba(99, 102, 241, 0.1)' }}>
                        <div className="flex items-center gap-3">
                            <input
                                className="input flex-1 !py-2"
                                placeholder="Nome stage"
                                value={newStage.name}
                                onChange={e => setNewStage({ ...newStage, name: e.target.value })}
                                autoFocus
                            />
                            <select className="input !w-auto !py-2" value={newStage.fire_capi_event} onChange={e => setNewStage({ ...newStage, fire_capi_event: e.target.value })}>
                                <option value="">Nessun CAPI</option>
                                <option value="Lead">Lead</option>
                                <option value="Schedule">Schedule</option>
                                <option value="Contact">Contact</option>
                                <option value="Purchase">Purchase</option>
                            </select>
                            <input type="color" value={newStage.color} onChange={e => setNewStage({ ...newStage, color: e.target.value })} className="w-8 h-8 rounded cursor-pointer border-0 bg-transparent" />
                            <button onClick={handleCreateStage} className="btn-primary !py-2 !px-3" disabled={!newStage.name}>
                                <Plus className="w-4 h-4" />
                            </button>
                            <button onClick={() => setShowNewStage(false)} className="p-2 rounded-lg hover:bg-white/5">
                                <X className="w-4 h-4" style={{ color: 'var(--color-surface-500)' }} />
                            </button>
                        </div>
                    </div>
                )}
            </div>

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
                        <label className="label">Nome completo</label>
                        <input className="input max-w-md" value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Il tuo nome" />
                    </div>
                    <button onClick={handleSaveProfile} className="btn-primary" disabled={saving === 'update_profile'}>
                        {saving === 'update_profile' ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><Save className="w-4 h-4" /> Salva Profilo</>}
                    </button>
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
