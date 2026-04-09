'use client'

import { useState, useEffect } from 'react'
import { UserCircle, Plus, Trophy, TrendingUp, DollarSign, Users, Mail, Shield, Trash2, X, Crown, Phone, Eye, EyeOff, RotateCcw, Filter } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { ROLE_CONFIG, DEPARTMENT_CONFIG, INVITABLE_ROLES, ALL_DEPARTMENTS, type Role, type Department } from '@/lib/permissions'

interface TeamMember {
    id: string
    user_id: string
    role: string
    department?: string | null
    invited_email?: string
    joined_at?: string
    deactivated_at?: string | null
    profiles: { full_name?: string; email?: string; avatar_url?: string } | null
    leads_assigned: number
    won_count: number
    won_revenue: number
}

export default function TeamPanel({ orgId, userRole }: { orgId: string; userRole: string }) {
    const [members, setMembers] = useState<TeamMember[]>([])
    const [loading, setLoading] = useState(true)
    const [showInvite, setShowInvite] = useState(false)
    const [inviteEmail, setInviteEmail] = useState('')
    const [inviteRole, setInviteRole] = useState<string>('setter')
    const [inviteDepartment, setInviteDepartment] = useState<string>('setting')
    const [inviting, setInviting] = useState(false)
    const [showDeactivated, setShowDeactivated] = useState(false)
    const [deptFilter, setDeptFilter] = useState<string>('all')
    const [showDeactivateModal, setShowDeactivateModal] = useState<TeamMember | null>(null)
    const [reassignTo, setReassignTo] = useState<string>('')
    const [loadError, setLoadError] = useState<string | null>(null)
    const supabase = createClient()

    useEffect(() => { loadMembers() }, [])

    const loadMembers = async () => {
        setLoading(true)
        setLoadError(null)
        try {
            const res = await fetch('/api/team')
            const data = await res.json()
            console.log("Team members loaded:", data) // <--- DEBUG LOG
            if (!res.ok || !Array.isArray(data)) {
                setLoadError(data.error || JSON.stringify(data))
                setMembers([])
            } else {
                setMembers(data)
            }
        } catch (e: any) {
            setLoadError(e.message)
            setMembers([])
        }
        setLoading(false)
    }

    const handleInvite = async (e: React.FormEvent) => {
        e.preventDefault()
        setInviting(true)
        try {
            const res = await fetch('/api/team', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: inviteEmail, role: inviteRole, department: inviteDepartment }),
            })
            if (res.ok) {
                setShowInvite(false)
                setInviteEmail('')
                loadMembers()
            } else {
                const data = await res.json()
                console.error("Invite error:", data.error)
                alert("Errore durante l'invito: " + (data.error || "Riprova"))
            }
        } catch (err) { 
            console.error(err)
            alert("Errore di rete, riprova.")
        }
        setInviting(false)
    }

    const handleDeactivate = async (member: TeamMember) => {
        try {
            const body: any = { action: 'deactivate', member_id: member.id }
            if (reassignTo) body.reassign_to = reassignTo
            
            const res = await fetch('/api/team', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            })
            if (res.ok) {
                setShowDeactivateModal(null)
                setReassignTo('')
                loadMembers()
            }
        } catch (err) { console.error(err) }
    }

    const handleReactivate = async (memberId: string) => {
        if (!confirm('Riattivare questo membro?')) return
        const res = await fetch('/api/team', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'reactivate', member_id: memberId }),
        })
        if (res.ok) loadMembers()
    }

    const handleUpdateRole = async (memberId: string, role: string, department?: string) => {
        await fetch('/api/team', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'update_role', member_id: memberId, role, department }),
        })
        loadMembers()
    }

    const canManage = userRole === 'owner' || userRole === 'admin'
    
    const activeMembers = members.filter(m => !m.deactivated_at)
    const deactivatedMembers = members.filter(m => m.deactivated_at)
    
    const filteredActive = deptFilter === 'all' 
        ? activeMembers 
        : activeMembers.filter(m => m.department === deptFilter)
    
    const setters = filteredActive.filter(m => m.role === 'setter')
    const closers = filteredActive.filter(m => m.role === 'closer')

    const formatCurrency = (v: number) =>
        new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(v)

    const getRoleIcon = (role: string) => {
        const cfg = ROLE_CONFIG[role as Role]
        if (!cfg) return UserCircle
        if (role === 'owner') return Crown
        if (role === 'admin') return Shield
        if (role === 'setter') return Phone
        if (role === 'closer') return TrendingUp
        if (role === 'manager') return Users
        return UserCircle
    }

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
                        {activeMembers.length} membr{activeMembers.length !== 1 ? 'i' : 'o'} attiv{activeMembers.length !== 1 ? 'i' : 'o'}
                        {deactivatedMembers.length > 0 && (
                            <span style={{ color: 'var(--color-surface-500)' }}> • {deactivatedMembers.length} disattivat{deactivatedMembers.length !== 1 ? 'i' : 'o'}</span>
                        )}
                    </p>
                    {loadError && (
                        <p className="text-red-500 text-xs mt-2 bg-red-500/10 p-2 rounded border border-red-500/20">
                            Errore Caricamento: {loadError}
                        </p>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    {canManage && (
                        <button onClick={() => setShowInvite(true)} className="btn-primary">
                            <Plus className="w-4 h-4" /> Invita Membro
                        </button>
                    )}
                </div>
            </div>

            {/* Filter Bar */}
            <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-1.5">
                    <Filter className="w-4 h-4" style={{ color: 'var(--color-surface-500)' }} />
                    <span className="text-xs font-semibold" style={{ color: 'var(--color-surface-500)' }}>Reparto:</span>
                </div>
                <div className="flex gap-1.5 flex-wrap">
                    <button
                        onClick={() => setDeptFilter('all')}
                        className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
                        style={{
                            background: deptFilter === 'all' ? 'rgba(99, 102, 241, 0.15)' : 'transparent',
                            color: deptFilter === 'all' ? '#6366f1' : 'var(--color-surface-500)',
                            border: `1px solid ${deptFilter === 'all' ? 'rgba(99, 102, 241, 0.3)' : 'var(--color-surface-200)'}`,
                        }}
                    >
                        Tutti ({activeMembers.length})
                    </button>
                    {ALL_DEPARTMENTS.map(dept => {
                        const cfg = DEPARTMENT_CONFIG[dept]
                        const count = activeMembers.filter(m => m.department === dept).length
                        if (count === 0) return null
                        return (
                            <button
                                key={dept}
                                onClick={() => setDeptFilter(dept)}
                                className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
                                style={{
                                    background: deptFilter === dept ? `${cfg.color}15` : 'transparent',
                                    color: deptFilter === dept ? cfg.color : 'var(--color-surface-500)',
                                    border: `1px solid ${deptFilter === dept ? cfg.color + '30' : 'var(--color-surface-200)'}`,
                                }}
                            >
                                {cfg.emoji} {cfg.label} ({count})
                            </button>
                        )
                    })}
                </div>

                {deactivatedMembers.length > 0 && (
                    <button 
                        onClick={() => setShowDeactivated(!showDeactivated)} 
                        className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all hover:bg-white/5"
                        style={{ color: 'var(--color-surface-500)', border: '1px solid var(--color-surface-200)' }}
                    >
                        {showDeactivated ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        {showDeactivated ? 'Nascondi' : 'Mostra'} disattivati
                    </button>
                )}
            </div>

            {/* Leaderboard */}
            {(setters.length > 0 || closers.length > 0) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

            {/* Active Members List */}
            <div className="glass-card overflow-hidden">
                <div className="p-4 border-b" style={{ borderColor: 'var(--color-surface-200)' }}>
                    <h3 className="text-sm font-bold text-white">Membri Attivi</h3>
                </div>
                {loading ? (
                    <div className="p-8 text-center">
                        <div className="w-6 h-6 border-2 border-white/20 border-t-white/60 rounded-full animate-spin mx-auto" />
                    </div>
                ) : (
                    <div className="divide-y" style={{ borderColor: 'var(--color-surface-200)' }}>
                        {filteredActive.map(m => {
                            const roleCfg = ROLE_CONFIG[m.role as Role] || ROLE_CONFIG.viewer
                            const deptCfg = m.department ? DEPARTMENT_CONFIG[m.department] : null
                            const RoleIcon = getRoleIcon(m.role)
                            return (
                                <div key={m.id} className="flex items-center gap-4 p-4 hover:bg-white/[0.02] transition-colors">
                                    <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold" style={{ background: `${roleCfg.color}15`, color: roleCfg.color, border: `1px solid ${roleCfg.color}30` }}>
                                        {((m.profiles as any)?.full_name || (m.profiles as any)?.email || '?')[0].toUpperCase()}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="text-sm font-semibold text-white truncate">{(m.profiles as any)?.full_name || (m.profiles as any)?.email || m.invited_email}</div>
                                        <div className="text-xs truncate" style={{ color: 'var(--color-surface-500)' }}>{(m.profiles as any)?.email || m.invited_email}</div>
                                    </div>
                                    <div className="flex items-center gap-2 flex-wrap justify-end">
                                        {/* Department Badge */}
                                        {deptCfg && (
                                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: `${deptCfg.color}10`, color: deptCfg.color, border: `1px solid ${deptCfg.color}20` }}>
                                                {deptCfg.emoji} {deptCfg.label}
                                            </span>
                                        )}
                                        {/* Role Badge */}
                                        <span className="badge flex items-center gap-1" style={{ background: `${roleCfg.color}10`, color: roleCfg.color, border: `1px solid ${roleCfg.color}20` }}>
                                            <RoleIcon className="w-3 h-3" /> {roleCfg.label}
                                        </span>
                                        {m.leads_assigned > 0 && (
                                            <span className="text-xs font-medium" style={{ color: 'var(--color-surface-500)' }}>{m.leads_assigned} lead</span>
                                        )}
                                        {canManage && m.role !== 'owner' && (
                                            <button 
                                                onClick={() => setShowDeactivateModal(m)} 
                                                className="p-1.5 rounded-lg hover:bg-white/5" 
                                                title="Disattiva"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" style={{ color: '#ef4444' }} />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            )
                        })}
                        {filteredActive.length === 0 && (
                            <div className="p-8 text-center text-sm" style={{ color: 'var(--color-surface-500)' }}>
                                Nessun membro in questo reparto
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Deactivated Members */}
            {showDeactivated && deactivatedMembers.length > 0 && (
                <div className="glass-card overflow-hidden" style={{ opacity: 0.7 }}>
                    <div className="p-4 border-b" style={{ borderColor: 'var(--color-surface-200)' }}>
                        <h3 className="text-sm font-bold" style={{ color: 'var(--color-surface-500)' }}>Membri Disattivati</h3>
                    </div>
                    <div className="divide-y" style={{ borderColor: 'var(--color-surface-200)' }}>
                        {deactivatedMembers.map(m => {
                            const roleCfg = ROLE_CONFIG[m.role as Role] || ROLE_CONFIG.viewer
                            return (
                                <div key={m.id} className="flex items-center gap-4 p-4">
                                    <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold" style={{ background: 'rgba(113, 113, 122, 0.1)', color: '#71717a', border: '1px solid rgba(113, 113, 122, 0.2)' }}>
                                        {((m.profiles as any)?.full_name || (m.profiles as any)?.email || '?')[0].toUpperCase()}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="text-sm font-semibold truncate" style={{ color: 'var(--color-surface-500)' }}>
                                            {(m.profiles as any)?.full_name || (m.profiles as any)?.email || m.invited_email}
                                        </div>
                                        <div className="text-[11px]" style={{ color: 'var(--color-surface-600)' }}>
                                            Disattivato il {new Date(m.deactivated_at!).toLocaleDateString('it-IT')}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="badge" style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                                            Disattivato
                                        </span>
                                        {canManage && (
                                            <button onClick={() => handleReactivate(m.id)} className="p-1.5 rounded-lg hover:bg-white/5" title="Riattiva">
                                                <RotateCcw className="w-3.5 h-3.5" style={{ color: '#22c55e' }} />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>
            )}

            {/* Invite Modal */}
            {showInvite && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
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
                                    {INVITABLE_ROLES.map(r => (
                                        <option key={r} value={r}>
                                            {ROLE_CONFIG[r].label} — {ROLE_CONFIG[r].description}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="label">Reparto</label>
                                <select className="input" value={inviteDepartment} onChange={e => setInviteDepartment(e.target.value)}>
                                    {ALL_DEPARTMENTS.map(d => (
                                        <option key={d} value={d}>
                                            {DEPARTMENT_CONFIG[d].emoji} {DEPARTMENT_CONFIG[d].label}
                                        </option>
                                    ))}
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

            {/* Deactivate Confirmation Modal */}
            {showDeactivateModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in" onClick={() => setShowDeactivateModal(null)}>
                    <div className="w-full max-w-lg glass-card p-6 m-4" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-bold text-white">🚫 Disattiva Membro</h2>
                            <button onClick={() => setShowDeactivateModal(null)} className="p-2 rounded-xl hover:bg-white/5"><X className="w-5 h-5" style={{ color: 'var(--color-surface-500)' }} /></button>
                        </div>
                        
                        <div className="p-4 rounded-xl mb-4" style={{ background: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.15)' }}>
                            <p className="text-sm text-white font-semibold mb-2">
                                Stai per disattivare: {(showDeactivateModal.profiles as any)?.full_name || (showDeactivateModal.profiles as any)?.email}
                            </p>
                            <div className="space-y-1 text-xs" style={{ color: 'var(--color-surface-400)' }}>
                                <p>• L'utente non potrà più accedere al software</p>
                                <p>• I dati storici (lead, vendite, attività) resteranno intatti</p>
                                <p>• Potrai riattivarlo in futuro se necessario</p>
                            </div>
                        </div>

                        {showDeactivateModal.leads_assigned > 0 && (
                            <div className="space-y-3 mb-4">
                                <p className="text-sm font-semibold" style={{ color: '#f59e0b' }}>
                                    ⚠️ Questo membro ha {showDeactivateModal.leads_assigned} lead assegnati
                                </p>
                                <div>
                                    <label className="label">Riassegna lead a:</label>
                                    <select className="input" value={reassignTo} onChange={e => setReassignTo(e.target.value)}>
                                        <option value="">— Non riassegnare (restano all'ex-membro) —</option>
                                        {activeMembers
                                            .filter(m => m.id !== showDeactivateModal.id && (m.role === 'setter' || m.role === 'closer' || m.role === 'admin' || m.role === 'owner'))
                                            .map(m => (
                                                <option key={m.id} value={m.user_id}>
                                                    {(m.profiles as any)?.full_name || (m.profiles as any)?.email} ({ROLE_CONFIG[m.role as Role]?.label})
                                                </option>
                                            ))
                                        }
                                    </select>
                                </div>
                            </div>
                        )}

                        <div className="flex gap-3 pt-2">
                            <button onClick={() => setShowDeactivateModal(null)} className="btn-secondary flex-1">Annulla</button>
                            <button 
                                onClick={() => handleDeactivate(showDeactivateModal)} 
                                className="flex-1 py-2.5 px-4 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2"
                                style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.3)' }}
                            >
                                <Trash2 className="w-4 h-4" /> Conferma Disattivazione
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
