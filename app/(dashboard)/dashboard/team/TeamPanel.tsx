'use client'

import { useState, useEffect } from 'react'
import { UserCircle, Plus, Trophy, TrendingUp, DollarSign, Users, Mail, Shield, Trash2, X, Crown } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface TeamMember {
    id: string
    user_id: string
    role: string
    invited_email?: string
    joined_at?: string
    profiles: { full_name?: string; email?: string; avatar_url?: string } | null
    leads_assigned: number
    won_count: number
    won_revenue: number
}

const roleConfig: Record<string, { label: string; color: string; icon: any }> = {
    owner: { label: 'Owner', color: '#f59e0b', icon: Crown },
    admin: { label: 'Admin', color: '#8b5cf6', icon: Shield },
    setter: { label: 'Setter', color: '#3b82f6', icon: Users },
    closer: { label: 'Closer', color: '#22c55e', icon: TrendingUp },
    viewer: { label: 'Viewer', color: '#71717a', icon: UserCircle },
}

export default function TeamPanel({ orgId, userRole }: { orgId: string; userRole: string }) {
    const [members, setMembers] = useState<TeamMember[]>([])
    const [loading, setLoading] = useState(true)
    const [showInvite, setShowInvite] = useState(false)
    const [inviteEmail, setInviteEmail] = useState('')
    const [inviteRole, setInviteRole] = useState('setter')
    const [inviting, setInviting] = useState(false)
    const supabase = createClient()

    useEffect(() => { loadMembers() }, [])

    const loadMembers = async () => {
        setLoading(true)
        const res = await fetch('/api/team')
        const data = await res.json()
        setMembers(Array.isArray(data) ? data : [])
        setLoading(false)
    }

    const handleInvite = async (e: React.FormEvent) => {
        e.preventDefault()
        setInviting(true)
        try {
            const res = await fetch('/api/team', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
            })
            if (res.ok) {
                setShowInvite(false)
                setInviteEmail('')
                loadMembers()
            }
        } catch (err) { console.error(err) }
        setInviting(false)
    }

    const handleRemove = async (id: string) => {
        if (!confirm('Rimuovere questo membro dal team?')) return
        await fetch(`/api/team?id=${id}`, { method: 'DELETE' })
        loadMembers()
    }

    const canManage = userRole === 'owner' || userRole === 'admin'
    const setters = members.filter(m => m.role === 'setter')
    const closers = members.filter(m => m.role === 'closer')

    const formatCurrency = (v: number) =>
        new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(v)

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header */}
            <div className="flex items-center justify-between gap-4 flex-wrap">
                <div>
                    <h1 className="text-2xl font-bold text-white flex items-center gap-3">
                        <UserCircle className="w-6 h-6" style={{ color: '#ec4899' }} />
                        Team
                    </h1>
                    <p className="text-sm mt-1" style={{ color: 'var(--color-surface-600)' }}>
                        {members.length} membr{members.length !== 1 ? 'i' : 'o'} nel team
                    </p>
                </div>
                {canManage && (
                    <button onClick={() => setShowInvite(true)} className="btn-primary">
                        <Plus className="w-4 h-4" /> Invita Membro
                    </button>
                )}
            </div>

            {/* Leaderboard */}
            {(setters.length > 0 || closers.length > 0) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Setter Leaderboard */}
                    {setters.length > 0 && (
                        <div className="glass-card p-5">
                            <div className="flex items-center gap-2 mb-4">
                                <Trophy className="w-4 h-4" style={{ color: '#3b82f6' }} />
                                <h3 className="text-sm font-bold text-white">Leaderboard Setter</h3>
                            </div>
                            <div className="space-y-3">
                                {setters.sort((a, b) => b.leads_assigned - a.leads_assigned).map((m, i) => (
                                    <div key={m.id} className="flex items-center gap-3">
                                        <span className="text-lg font-bold w-6 text-center" style={{ color: i === 0 ? '#f59e0b' : i === 1 ? '#94a3b8' : i === 2 ? '#cd7f32' : 'var(--color-surface-500)' }}>
                                            {i + 1}
                                        </span>
                                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold" style={{ background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
                                            {((m.profiles as any)?.full_name || (m.profiles as any)?.email || '?')[0].toUpperCase()}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="text-sm font-semibold text-white truncate">{(m.profiles as any)?.full_name || (m.profiles as any)?.email}</div>
                                            <div className="text-[11px]" style={{ color: 'var(--color-surface-500)' }}>{m.leads_assigned} lead assegnati</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Closer Leaderboard */}
                    {closers.length > 0 && (
                        <div className="glass-card p-5">
                            <div className="flex items-center gap-2 mb-4">
                                <Trophy className="w-4 h-4" style={{ color: '#22c55e' }} />
                                <h3 className="text-sm font-bold text-white">Leaderboard Closer</h3>
                            </div>
                            <div className="space-y-3">
                                {closers.sort((a, b) => b.won_revenue - a.won_revenue).map((m, i) => (
                                    <div key={m.id} className="flex items-center gap-3">
                                        <span className="text-lg font-bold w-6 text-center" style={{ color: i === 0 ? '#f59e0b' : i === 1 ? '#94a3b8' : i === 2 ? '#cd7f32' : 'var(--color-surface-500)' }}>
                                            {i + 1}
                                        </span>
                                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold" style={{ background: 'rgba(34, 197, 94, 0.1)', color: '#22c55e', border: '1px solid rgba(34, 197, 94, 0.2)' }}>
                                            {((m.profiles as any)?.full_name || (m.profiles as any)?.email || '?')[0].toUpperCase()}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="text-sm font-semibold text-white truncate">{(m.profiles as any)?.full_name || (m.profiles as any)?.email}</div>
                                            <div className="text-[11px]" style={{ color: 'var(--color-surface-500)' }}>{m.won_count} vendite • {formatCurrency(m.won_revenue)}</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Members List */}
            <div className="glass-card overflow-hidden">
                <div className="p-4 border-b" style={{ borderColor: 'var(--color-surface-200)' }}>
                    <h3 className="text-sm font-bold text-white">Tutti i membri</h3>
                </div>
                {loading ? (
                    <div className="p-8 text-center">
                        <div className="w-6 h-6 border-2 border-white/20 border-t-white/60 rounded-full animate-spin mx-auto" />
                    </div>
                ) : (
                    <div className="divide-y" style={{ borderColor: 'var(--color-surface-200)' }}>
                        {members.map(m => {
                            const cfg = roleConfig[m.role] || roleConfig.viewer
                            const RoleIcon = cfg.icon
                            return (
                                <div key={m.id} className="flex items-center gap-4 p-4 hover:bg-white/[0.02] transition-colors">
                                    <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold" style={{ background: `${cfg.color}15`, color: cfg.color, border: `1px solid ${cfg.color}30` }}>
                                        {((m.profiles as any)?.full_name || (m.profiles as any)?.email || '?')[0].toUpperCase()}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="text-sm font-semibold text-white truncate">{(m.profiles as any)?.full_name || (m.profiles as any)?.email || m.invited_email}</div>
                                        <div className="text-xs truncate" style={{ color: 'var(--color-surface-500)' }}>{(m.profiles as any)?.email || m.invited_email}</div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <span className="badge" style={{ background: `${cfg.color}10`, color: cfg.color, border: `1px solid ${cfg.color}20` }}>
                                            <RoleIcon className="w-3 h-3" /> {cfg.label}
                                        </span>
                                        {m.leads_assigned > 0 && (
                                            <span className="text-xs font-medium" style={{ color: 'var(--color-surface-500)' }}>{m.leads_assigned} lead</span>
                                        )}
                                        {canManage && m.role !== 'owner' && (
                                            <button onClick={() => handleRemove(m.id)} className="p-1.5 rounded-lg hover:bg-white/5" title="Rimuovi">
                                                <Trash2 className="w-3.5 h-3.5" style={{ color: '#ef4444' }} />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>

            {/* Invite Modal */}
            {showInvite && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in" onClick={() => setShowInvite(false)}>
                    <div className="w-full max-w-md glass-card p-6 m-4" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-lg font-bold text-white">Invita Membro</h2>
                            <button onClick={() => setShowInvite(false)} className="p-2 rounded-xl hover:bg-white/5"><X className="w-5 h-5" style={{ color: 'var(--color-surface-500)' }} /></button>
                        </div>
                        <form onSubmit={handleInvite} className="space-y-4">
                            <div>
                                <label className="label">Email</label>
                                <input type="email" className="input" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} placeholder="email@esempio.it" required />
                            </div>
                            <div>
                                <label className="label">Ruolo</label>
                                <select className="input" value={inviteRole} onChange={e => setInviteRole(e.target.value)}>
                                    <option value="setter">Setter</option>
                                    <option value="closer">Closer</option>
                                    <option value="admin">Admin</option>
                                    <option value="viewer">Viewer</option>
                                </select>
                            </div>
                            <div className="flex gap-3 pt-2">
                                <button type="button" onClick={() => setShowInvite(false)} className="btn-secondary flex-1">Annulla</button>
                                <button type="submit" className="btn-primary flex-1" disabled={inviting}>
                                    {inviting ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><Mail className="w-4 h-4" /> Invita</>}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}
