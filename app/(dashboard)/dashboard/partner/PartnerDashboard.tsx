'use client'

import { useState, useEffect } from 'react'
import { Handshake, Plus, Copy, Check, Users, TrendingUp, Activity, Brain, ExternalLink, Trash2, Mail, Phone, Edit3, X, Save, Send } from 'lucide-react'

interface Partner {
    id: string
    name: string
    type: 'strategic_partner' | 'ambassador'
    commission: number // 10 or 15
    email: string
    phone: string
    slug: string // URL slug for tracking
    status: 'active' | 'inactive'
    notes: string
    created_at: string
    // Computed from radar_submissions
    stats?: {
        quizzes: number
        converted: number
        revenue: number
    }
}

export default function PartnerDashboard() {
    const [partners, setPartners] = useState<Partner[]>([])
    const [loading, setLoading] = useState(true)
    const [showAddModal, setShowAddModal] = useState(false)
    const [editingPartner, setEditingPartner] = useState<Partner | null>(null)
    const [copiedSlug, setCopiedSlug] = useState<string | null>(null)

    // Form state
    const [formName, setFormName] = useState('')
    const [formEmail, setFormEmail] = useState('')
    const [formPhone, setFormPhone] = useState('')
    const [formType, setFormType] = useState<'strategic_partner' | 'ambassador'>('strategic_partner')
    const [formNotes, setFormNotes] = useState('')
    const [saving, setSaving] = useState(false)

    useEffect(() => { loadPartners() }, [])

    async function loadPartners() {
        setLoading(true)
        try {
            const res = await fetch('/api/partner/list')
            if (res.ok) {
                const data = await res.json()
                setPartners(data.partners || [])
            }
        } catch (e) { console.error(e) }
        setLoading(false)
    }

    function resetForm() {
        setFormName(''); setFormEmail(''); setFormPhone('')
        setFormType('strategic_partner'); setFormNotes('')
        setEditingPartner(null)
    }

    function openEdit(partner: Partner) {
        setFormName(partner.name); setFormEmail(partner.email)
        setFormPhone(partner.phone); setFormType(partner.type)
        setFormNotes(partner.notes); setEditingPartner(partner)
        setShowAddModal(true)
    }

    async function handleSave() {
        if (!formName) return
        setSaving(true)
        try {
            const body = {
                id: editingPartner?.id || undefined,
                name: formName, email: formEmail, phone: formPhone,
                type: formType, notes: formNotes,
            }
            await fetch('/api/partner/save', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            })
            await loadPartners()
            setShowAddModal(false)
            resetForm()
        } catch (e) { console.error(e) }
        setSaving(false)
    }

    async function handleDelete(partnerId: string) {
        if (!confirm('Eliminare questo partner?')) return
        await fetch('/api/partner/save', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: partnerId }),
        })
        await loadPartners()
    }

    function copyLink(slug: string, type: 'radar' | 'segnala' = 'radar') {
        const path = type === 'segnala' ? '/segnala' : '/radar'
        const link = `${window.location.origin}${path}?p=${slug}`
        navigator.clipboard.writeText(link)
        setCopiedSlug(`${type}-${slug}`)
        setTimeout(() => setCopiedSlug(null), 2000)
    }

    const totalQuizzes = partners.reduce((sum, p) => sum + (p.stats?.quizzes || 0), 0)
    const totalConverted = partners.reduce((sum, p) => sum + (p.stats?.converted || 0), 0)
    const totalRevenue = partners.reduce((sum, p) => sum + (p.stats?.revenue || 0), 0)

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                    <h1 className="text-2xl font-black text-white flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(34, 197, 94, 0.1)', border: '1px solid rgba(34, 197, 94, 0.2)' }}>
                            <Handshake className="w-5 h-5" style={{ color: '#22c55e' }} />
                        </div>
                        Partner Program
                    </h1>
                    <p className="text-sm mt-1" style={{ color: '#71717a' }}>
                        Gestisci i tuoi Strategic Partner e Ambassador
                    </p>
                </div>
                <button
                    onClick={() => { resetForm(); setShowAddModal(true) }}
                    className="btn-primary text-sm"
                >
                    <Plus className="w-4 h-4" /> Aggiungi Partner
                </button>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                    { label: 'Partner Attivi', value: partners.filter(p => p.status === 'active').length, icon: Users, color: '#22c55e' },
                    { label: 'Quiz Generati', value: totalQuizzes, icon: Brain, color: '#818cf8' },
                    { label: 'Conversioni', value: totalConverted, icon: TrendingUp, color: '#f59e0b' },
                    { label: 'Revenue Partner', value: `€${totalRevenue.toLocaleString()}`, icon: Activity, color: '#ec4899' },
                ].map(kpi => (
                    <div key={kpi.label} className="kpi-card">
                        <div className="flex items-center gap-2 mb-3">
                            <kpi.icon className="w-4 h-4" style={{ color: kpi.color }} />
                            <span className="text-xs font-medium" style={{ color: '#71717a' }}>{kpi.label}</span>
                        </div>
                        <div className="text-3xl font-black" style={{ color: kpi.color }}>
                            {typeof kpi.value === 'number' ? kpi.value : kpi.value}
                        </div>
                    </div>
                ))}
            </div>

            {/* Partners Grid */}
            {loading ? (
                <div className="text-center py-16">
                    <div className="w-8 h-8 border-2 border-green-500/30 border-t-green-500 rounded-full animate-spin mx-auto mb-3" />
                    <p className="text-sm" style={{ color: '#71717a' }}>Caricamento partner...</p>
                </div>
            ) : partners.length === 0 ? (
                <div className="text-center py-16 glass-card">
                    <Handshake className="w-12 h-12 mx-auto mb-4" style={{ color: '#3f3f46' }} />
                    <h3 className="text-lg font-bold th-heading mb-2">Nessun partner ancora</h3>
                    <p className="text-sm mb-6" style={{ color: '#71717a' }}>
                        Aggiungi il primo partner per generare il suo link tracciato al Radar Sincro.
                    </p>
                    <button onClick={() => { resetForm(); setShowAddModal(true) }} className="btn-primary text-sm">
                        <Plus className="w-4 h-4" /> Aggiungi il Primo Partner
                    </button>
                </div>
            ) : (
                <div className="grid md:grid-cols-2 gap-4">
                    {partners.map(partner => {
                        const typeColor = partner.type === 'ambassador' ? '#f59e0b' : '#22c55e'
                        const typeLabel = partner.type === 'ambassador' ? '🏆 Ambassador (15%)' : '⚡ Strategic Partner (10%)'

                        return (
                            <div key={partner.id} className="glass-card p-6 group">
                                <div className="flex items-start justify-between mb-4">
                                    <div>
                                        <div className="flex items-center gap-2 mb-1">
                                            <h3 className="text-lg font-bold th-heading">{partner.name}</h3>
                                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{
                                                background: `${typeColor}15`, color: typeColor, border: `1px solid ${typeColor}30`
                                            }}>
                                                {typeLabel}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-3 text-xs" style={{ color: '#71717a' }}>
                                            {partner.email && (
                                                <a href={`mailto:${partner.email}`} className="flex items-center gap-1 hover:text-indigo-400 transition-colors">
                                                    <Mail className="w-3 h-3" /> {partner.email}
                                                </a>
                                            )}
                                            {partner.phone && (
                                                <a href={`tel:${partner.phone}`} className="flex items-center gap-1 hover:text-indigo-400 transition-colors">
                                                    <Phone className="w-3 h-3" /> {partner.phone}
                                                </a>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button onClick={() => openEdit(partner)} className="p-1.5 rounded-lg th-bg-hover" title="Modifica">
                                            <Edit3 className="w-3.5 h-3.5" style={{ color: '#71717a' }} />
                                        </button>
                                        <button onClick={() => handleDelete(partner.id)} className="p-1.5 rounded-lg th-bg-hover" title="Elimina">
                                            <Trash2 className="w-3.5 h-3.5" style={{ color: '#ef4444' }} />
                                        </button>
                                    </div>
                                </div>

                                {/* Stats */}
                                <div className="grid grid-cols-3 gap-3 mb-4 p-3 rounded-xl" style={{ background: 'rgba(9, 9, 11, 0.5)' }}>
                                    <div className="text-center">
                                        <div className="text-lg font-black" style={{ color: '#818cf8' }}>{partner.stats?.quizzes || 0}</div>
                                        <div className="text-[10px]" style={{ color: '#52525b' }}>Quiz</div>
                                    </div>
                                    <div className="text-center">
                                        <div className="text-lg font-black" style={{ color: '#22c55e' }}>{partner.stats?.converted || 0}</div>
                                        <div className="text-[10px]" style={{ color: '#52525b' }}>Convertiti</div>
                                    </div>
                                    <div className="text-center">
                                        <div className="text-lg font-black" style={{ color: '#f59e0b' }}>€{partner.stats?.revenue || 0}</div>
                                        <div className="text-[10px]" style={{ color: '#52525b' }}>Commissioni</div>
                                    </div>
                                </div>

                                {/* Links */}
                                <div className="space-y-2">
                                    {/* Quiz Link */}
                                    <div className="flex items-center gap-2">
                                        <div className="flex items-center gap-1.5 flex-1 px-3 py-2 rounded-lg text-xs font-mono truncate" style={{ background: '#18181b', color: '#71717a', border: '1px solid #27272a' }}>
                                            <Brain className="w-3 h-3 flex-shrink-0" style={{ color: '#818cf8' }} />
                                            /radar?p={partner.slug}
                                        </div>
                                        <button
                                            onClick={() => copyLink(partner.slug, 'radar')}
                                            className="px-3 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap"
                                            style={{
                                                background: copiedSlug === `radar-${partner.slug}` ? 'rgba(34, 197, 94, 0.15)' : 'rgba(99, 102, 241, 0.1)',
                                                color: copiedSlug === `radar-${partner.slug}` ? '#22c55e' : '#818cf8',
                                                border: `1px solid ${copiedSlug === `radar-${partner.slug}` ? 'rgba(34, 197, 94, 0.3)' : 'rgba(99, 102, 241, 0.2)'}`,
                                            }}
                                        >
                                            {copiedSlug === `radar-${partner.slug}` ? <><Check className="w-3 h-3 inline mr-1" />Copiato</> : <><Copy className="w-3 h-3 inline mr-1" />Quiz</>}
                                        </button>
                                    </div>
                                    {/* Segnala Link */}
                                    <div className="flex items-center gap-2">
                                        <div className="flex items-center gap-1.5 flex-1 px-3 py-2 rounded-lg text-xs font-mono truncate" style={{ background: '#18181b', color: '#71717a', border: '1px solid #27272a' }}>
                                            <Send className="w-3 h-3 flex-shrink-0" style={{ color: '#22c55e' }} />
                                            /segnala?p={partner.slug}
                                        </div>
                                        <button
                                            onClick={() => copyLink(partner.slug, 'segnala')}
                                            className="px-3 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap"
                                            style={{
                                                background: copiedSlug === `segnala-${partner.slug}` ? 'rgba(34, 197, 94, 0.15)' : 'rgba(34, 197, 94, 0.1)',
                                                color: copiedSlug === `segnala-${partner.slug}` ? '#22c55e' : '#22c55e',
                                                border: `1px solid ${copiedSlug === `segnala-${partner.slug}` ? 'rgba(34, 197, 94, 0.3)' : 'rgba(34, 197, 94, 0.2)'}`,
                                            }}
                                        >
                                            {copiedSlug === `segnala-${partner.slug}` ? <><Check className="w-3 h-3 inline mr-1" />Copiato</> : <><Copy className="w-3 h-3 inline mr-1" />Segnala</>}
                                        </button>
                                    </div>
                                </div>

                                {partner.notes && (
                                    <p className="text-xs mt-3" style={{ color: '#52525b' }}>📝 {partner.notes}</p>
                                )}
                            </div>
                        )
                    })}
                </div>
            )}

            {/* Add/Edit Modal */}
            {showAddModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }}>
                    <div className="w-full max-w-lg glass-card p-8 animate-fade-in" style={{ background: 'var(--glass-bg)' }}>
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-xl font-bold th-heading">
                                {editingPartner ? 'Modifica Partner' : 'Nuovo Partner'}
                            </h2>
                            <button onClick={() => { setShowAddModal(false); resetForm() }}>
                                <X className="w-5 h-5" style={{ color: '#71717a' }} />
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="label">Nome *</label>
                                <input type="text" value={formName} onChange={e => setFormName(e.target.value)}
                                    placeholder="Es. Mario Rossi" className="input" />
                            </div>
                            <div>
                                <label className="label">Email</label>
                                <input type="email" value={formEmail} onChange={e => setFormEmail(e.target.value)}
                                    placeholder="mario@esempio.it" className="input" />
                            </div>
                            <div>
                                <label className="label">Telefono</label>
                                <input type="tel" value={formPhone} onChange={e => setFormPhone(e.target.value)}
                                    placeholder="+39 xxx xxx xxxx" className="input" />
                            </div>
                            <div>
                                <label className="label">Tipo Partnership</label>
                                <div className="grid grid-cols-2 gap-3">
                                    {[
                                        { value: 'strategic_partner', label: '⚡ Strategic Partner', sub: '10% commissione', color: '#22c55e' },
                                        { value: 'ambassador', label: '🏆 Ambassador', sub: '15% con squadra', color: '#f59e0b' },
                                    ].map(opt => (
                                        <button
                                            key={opt.value}
                                            onClick={() => setFormType(opt.value as any)}
                                            className="p-4 rounded-xl text-left transition-all"
                                            style={{
                                                background: formType === opt.value ? `${opt.color}12` : '#18181b',
                                                border: `1px solid ${formType === opt.value ? `${opt.color}40` : '#27272a'}`,
                                            }}
                                        >
                                            <div className="text-sm font-bold th-heading">{opt.label}</div>
                                            <div className="text-xs mt-0.5" style={{ color: opt.color }}>{opt.sub}</div>
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <label className="label">Note</label>
                                <textarea value={formNotes} onChange={e => setFormNotes(e.target.value)}
                                    placeholder="Es. Allenatore giovanili Virtus Bologna..." className="input" rows={3}
                                    style={{ resize: 'none' }}
                                />
                            </div>

                            <div className="flex gap-3 pt-2">
                                <button onClick={() => { setShowAddModal(false); resetForm() }} className="btn-secondary flex-1">
                                    Annulla
                                </button>
                                <button onClick={handleSave} disabled={!formName || saving} className="btn-primary flex-1">
                                    {saving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><Save className="w-4 h-4" /> {editingPartner ? 'Salva' : 'Crea Partner'}</>}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
