'use client'

import { useState } from 'react'
import { Target, Plus, Globe, Eye, Pause, Archive, Play, Edit3, Trash2, X, ExternalLink, Inbox } from 'lucide-react'

interface Funnel {
    id: string
    name: string
    slug: string
    description?: string
    status: 'draft' | 'active' | 'paused' | 'archived'
    meta_pixel_id?: string
    settings?: any
    created_at: string
    updated_at: string
}

const statusConfig: Record<string, { label: string; color: string; icon: any }> = {
    draft: { label: 'Bozza', color: '#71717a', icon: Edit3 },
    active: { label: 'Attivo', color: '#22c55e', icon: Play },
    paused: { label: 'In pausa', color: '#f59e0b', icon: Pause },
    archived: { label: 'Archiviato', color: '#ef4444', icon: Archive },
}

export default function FunnelsPanel({ initialFunnels }: { initialFunnels: Funnel[] }) {
    const [funnels, setFunnels] = useState<Funnel[]>(initialFunnels)
    const [showModal, setShowModal] = useState(false)
    const [editing, setEditing] = useState<Funnel | null>(null)
    const [saving, setSaving] = useState(false)

    const handleSave = async (formData: any) => {
        setSaving(true)
        try {
            if (editing) {
                const res = await fetch('/api/funnels', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id: editing.id, ...formData }),
                })
                const updated = await res.json()
                if (res.ok) setFunnels(prev => prev.map(f => f.id === editing.id ? { ...f, ...formData } : f))
            } else {
                const res = await fetch('/api/funnels', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(formData),
                })
                const created = await res.json()
                if (res.ok) setFunnels(prev => [created, ...prev])
            }
            setShowModal(false)
            setEditing(null)
        } catch (err) { console.error(err) }
        setSaving(false)
    }

    const handleDelete = async (id: string) => {
        if (!confirm('Eliminare questo funnel?')) return
        await fetch(`/api/funnels?id=${id}`, { method: 'DELETE' })
        setFunnels(prev => prev.filter(f => f.id !== id))
    }

    const handleStatusChange = async (funnel: Funnel, newStatus: string) => {
        const res = await fetch('/api/funnels', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: funnel.id, status: newStatus }),
        })
        if (res.ok) setFunnels(prev => prev.map(f => f.id === funnel.id ? { ...f, status: newStatus as any } : f))
    }

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex items-center justify-between gap-4 flex-wrap">
                <div>
                    <h1 className="text-2xl font-bold text-white flex items-center gap-3">
                        <Target className="w-6 h-6" style={{ color: '#8b5cf6' }} />
                        Funnel
                    </h1>
                    <p className="text-sm mt-1" style={{ color: 'var(--color-surface-600)' }}>
                        Landing page e funnel di acquisizione lead
                    </p>
                </div>
                <button onClick={() => { setEditing(null); setShowModal(true) }} className="btn-primary">
                    <Plus className="w-4 h-4" /> Nuovo Funnel
                </button>
            </div>

            {/* Funnel Cards */}
            {funnels.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {funnels.map(funnel => {
                        const st = statusConfig[funnel.status] || statusConfig.draft
                        const StIcon = st.icon
                        return (
                            <div key={funnel.id} className="glass-card p-5 group">
                                <div className="flex items-start justify-between mb-3">
                                    <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(139, 92, 246, 0.1)', border: '1px solid rgba(139, 92, 246, 0.2)' }}>
                                        <Globe className="w-5 h-5" style={{ color: '#8b5cf6' }} />
                                    </div>
                                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button onClick={() => { setEditing(funnel); setShowModal(true) }} className="p-1.5 rounded-lg hover:bg-white/5">
                                            <Edit3 className="w-3.5 h-3.5" style={{ color: 'var(--color-sincro-400)' }} />
                                        </button>
                                        <button onClick={() => handleDelete(funnel.id)} className="p-1.5 rounded-lg hover:bg-white/5">
                                            <Trash2 className="w-3.5 h-3.5" style={{ color: '#ef4444' }} />
                                        </button>
                                    </div>
                                </div>

                                <h3 className="text-sm font-bold text-white mb-1">{funnel.name}</h3>
                                {funnel.description && (
                                    <p className="text-xs mb-3 line-clamp-2" style={{ color: 'var(--color-surface-500)' }}>{funnel.description}</p>
                                )}
                                <div className="text-[10px] font-mono mb-3 px-2 py-1 rounded-lg inline-block" style={{ background: 'var(--color-surface-100)', color: 'var(--color-surface-600)' }}>
                                    /{funnel.slug}
                                </div>

                                <div className="flex items-center justify-between pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                                    <span className="badge" style={{ background: `${st.color}10`, color: st.color, border: `1px solid ${st.color}20` }}>
                                        <StIcon className="w-3 h-3" /> {st.label}
                                    </span>
                                    <div className="flex gap-1">
                                        {funnel.status !== 'active' && (
                                            <button onClick={() => handleStatusChange(funnel, 'active')} className="p-1 rounded-lg hover:bg-white/5" title="Attiva">
                                                <Play className="w-3.5 h-3.5" style={{ color: '#22c55e' }} />
                                            </button>
                                        )}
                                        {funnel.status === 'active' && (
                                            <button onClick={() => handleStatusChange(funnel, 'paused')} className="p-1 rounded-lg hover:bg-white/5" title="Pausa">
                                                <Pause className="w-3.5 h-3.5" style={{ color: '#f59e0b' }} />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                </div>
            ) : (
                <div className="glass-card p-12 text-center">
                    <Inbox className="w-12 h-12 mx-auto mb-4" style={{ color: 'var(--color-surface-400)', opacity: 0.3 }} />
                    <p className="text-sm font-semibold text-white mb-2">Nessun funnel</p>
                    <p className="text-xs mb-4" style={{ color: 'var(--color-surface-500)' }}>Crea il tuo primo funnel per iniziare a raccogliere lead</p>
                    <button onClick={() => setShowModal(true)} className="btn-primary">
                        <Plus className="w-4 h-4" /> Crea Funnel
                    </button>
                </div>
            )}

            {/* Create/Edit Modal */}
            {showModal && (
                <FunnelModal
                    funnel={editing}
                    saving={saving}
                    onSave={handleSave}
                    onClose={() => { setShowModal(false); setEditing(null) }}
                />
            )}
        </div>
    )
}

function FunnelModal({ funnel, saving, onSave, onClose }: {
    funnel: Funnel | null; saving: boolean; onSave: (data: any) => void; onClose: () => void
}) {
    const [form, setForm] = useState({
        name: funnel?.name || '',
        slug: funnel?.slug || '',
        description: funnel?.description || '',
        meta_pixel_id: funnel?.meta_pixel_id || '',
        status: funnel?.status || 'draft',
    })

    const handleNameChange = (name: string) => {
        const slug = funnel ? form.slug : name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')
        setForm({ ...form, name, slug })
    }

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        onSave(form)
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in" onClick={onClose}>
            <div className="w-full max-w-lg glass-card p-6 m-4" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-lg font-bold text-white">{funnel ? 'Modifica Funnel' : 'Nuovo Funnel'}</h2>
                    <button onClick={onClose} className="p-2 rounded-xl hover:bg-white/5"><X className="w-5 h-5" style={{ color: 'var(--color-surface-500)' }} /></button>
                </div>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="label">Nome *</label>
                        <input className="input" value={form.name} onChange={e => handleNameChange(e.target.value)} placeholder="es. Landing Platinum" required />
                    </div>
                    <div>
                        <label className="label">Slug (URL)</label>
                        <input className="input" value={form.slug} onChange={e => setForm({ ...form, slug: e.target.value })} placeholder="landing-platinum" />
                    </div>
                    <div>
                        <label className="label">Descrizione</label>
                        <textarea className="input" rows={2} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Descrizione breve..." />
                    </div>
                    <div>
                        <label className="label">Meta Pixel ID</label>
                        <input className="input" value={form.meta_pixel_id} onChange={e => setForm({ ...form, meta_pixel_id: e.target.value })} placeholder="Es. 1234567890" />
                    </div>
                    <div className="flex gap-3 pt-2">
                        <button type="button" onClick={onClose} className="btn-secondary flex-1">Annulla</button>
                        <button type="submit" className="btn-primary flex-1" disabled={saving}>
                            {saving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : funnel ? 'Salva' : 'Crea Funnel'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}
