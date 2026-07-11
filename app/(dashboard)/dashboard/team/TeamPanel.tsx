'use client'

import { useState, useEffect } from 'react'
import { UserCircle, Plus, Trophy, TrendingUp, DollarSign, Users as UsersIcon, Mail, Shield, Trash2, X, Crown, Phone, Eye, EyeOff, RotateCcw, Filter, CalendarDays, Shuffle, ToggleLeft, ToggleRight, Scale, HandIcon, KeyRound } from 'lucide-react'
import HowItWorks from '@/components/HowItWorks'
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
    display_color?: string | null
}

export default function TeamPanel({ orgId, userRole }: { orgId: string; userRole: string }) {
    const [activeTab, setActiveTab] = useState<'members' | 'assignments'>('members')
    const [members, setMembers] = useState<TeamMember[]>([])
    const [loading, setLoading] = useState(true)
    const [showInvite, setShowInvite] = useState(false)
    const [inviteEmail, setInviteEmail] = useState('')
    const [inviteRole, setInviteRole] = useState<string>('closer')
    const [inviteDepartment, setInviteDepartment] = useState<string>('sales')
    const [inviting, setInviting] = useState(false)
    const [showDeactivated, setShowDeactivated] = useState(false)
    const [deptFilter, setDeptFilter] = useState<string>('all')
    const [showDeactivateModal, setShowDeactivateModal] = useState<TeamMember | null>(null)
    const [reassignTo, setReassignTo] = useState<string>('')
    const [loadError, setLoadError] = useState<string | null>(null)
    const [inviteLink, setInviteLink] = useState<string | null>(null)
    const [linkCopied, setLinkCopied] = useState(false)
    const [resetPasswordLink, setResetPasswordLink] = useState<string | null>(null)
    const [resetPasswordFor, setResetPasswordFor] = useState<string>('')
    const [resetLinkCopied, setResetLinkCopied] = useState(false)
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

    // Assignment state
    const [assignConfig, setAssignConfig] = useState<any>({ assignment_mode: 'manual', auto_assign_enabled: false, fallback_mode: 'manual' })
    const [calendarAssignMode, setCalendarAssignMode] = useState<string>('round_robin')
    const [settersList, setSettersList] = useState<any[]>([])
    const [assignStats, setAssignStats] = useState<Record<string, { total: number; won: number }>>({})
    const [savingAssign, setSavingAssign] = useState(false)

    useEffect(() => {
        if (activeTab === 'assignments') {
            loadAssignment()
        }
    }, [activeTab])

    const loadAssignment = async () => {
        try {
            const res = await fetch('/api/assignment')
            if (res.ok) {
                const data = await res.json()
                if (data.config) setAssignConfig(data.config)
                if (data.calendarConfig?.calendar_assignment_mode) setCalendarAssignMode(data.calendarConfig.calendar_assignment_mode)
                
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

    const saveCalendarAssignConfig = async (mode: string) => {
        setSavingAssign(true)
        try {
            await fetch('/api/assignment', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'update_calendar_config', calendar_assignment_mode: mode }),
            })
            setCalendarAssignMode(mode)
        } catch {}
        setSavingAssign(false)
    }

    const updateSetter = async (user_id: string, updates: any) => {
        setSettersList(prev => prev.map(s => s.user_id === user_id ? { ...s, ...updates } : s))
        try {
            await fetch('/api/assignment', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'update_setter', user_id, ...updates }),
            })
        } catch {}
    }

    const assignModes = [
        { value: 'round_robin', label: 'Round Robin', icon: Shuffle, desc: 'Ciclico: A→B→C→A→B→C', color: '#3b82f6' },
        { value: 'manual', label: 'Manuale', icon: UsersIcon, desc: 'Assegna manualmente dal CRM', color: '#71717a' },
        { value: 'availability', label: 'Disponibilità', icon: Shield, desc: 'Solo venditori disponibili con limite', color: '#22c55e' },
        { value: 'performance', label: 'Performance', icon: TrendingUp, desc: 'Priorità a chi chiude di più', color: '#f59e0b' },
        { value: 'weighted', label: 'Weighted', icon: Scale, desc: 'Peso configurabile per venditore', color: '#a855f7' },
    ]

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
                const result = await res.json()
                setShowInvite(false)
                setInviteEmail('')
                loadMembers()
                
                if (result.invite_url) {
                    setInviteLink(result.invite_url)
                    setLinkCopied(false)
                }
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

    const handleUpdateColor = async (memberId: string, color: string) => {
        setMembers(prev => prev.map(m => m.id === memberId ? { ...m, display_color: color } : m))
        await fetch('/api/team', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'update_color', member_id: memberId, display_color: color }),
        })
    }

    const handleResetPassword = async (member: TeamMember) => {
        const email = (member.profiles as any)?.email || member.invited_email
        if (!email) {
            alert('Email non disponibile per questo membro')
            return
        }
        try {
            const res = await fetch('/api/team', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'reset_password', member_id: member.id, email }),
            })
            const data = await res.json()
            if (res.ok && data.recovery_url) {
                setResetPasswordLink(data.recovery_url)
                setResetPasswordFor((member.profiles as any)?.full_name || email)
                setResetLinkCopied(false)
            } else {
                alert('Errore: ' + (data.error || 'Impossibile generare link'))
            }
        } catch (e) {
            alert('Errore di rete, riprova.')
        }
    }

    const canManage = userRole === 'owner' || userRole === 'admin'
    
    const activeMembers = members.filter(m => !m.deactivated_at)
    const deactivatedMembers = members.filter(m => m.deactivated_at)
    
    const filteredActive = deptFilter === 'all' 
        ? activeMembers 
        : activeMembers.filter(m => m.department === deptFilter)
    
    const venditori = filteredActive.filter(m => m.role === 'closer')

    const formatCurrency = (v: number) =>
        new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(v)

    const getRoleIcon = (role: string) => {
        const cfg = ROLE_CONFIG[role as Role]
        if (!cfg) return UserCircle
        if (role === 'owner') return Crown
        if (role === 'admin') return Shield
        if (role === 'closer') return TrendingUp
        if (role === 'manager') return UsersIcon
        return UserCircle
    }

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header */}
            <div className="flex items-center justify-between gap-4 flex-wrap">
                <div>
                    <h1 className="text-2xl font-bold th-heading flex items-center gap-3">
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
                    <HowItWorks compact steps={[
                        { emoji: '👑', title: 'Ruoli e Permessi', description: 'Owner ha controllo totale. Admin gestisce team e lead. Venditori gestiscono i lead dall\'inizio alla vendita.' },
                        { emoji: '📧', title: 'Invita Membro', description: 'Invita via email con ruolo e reparto. Il membro riceve un link di accesso diretto — nessuna password da configurare.' },
                        { emoji: '🏆', title: 'Leaderboard', description: 'Classifica automatica Venditori per lead assegnati, vendite e revenue. Alimentata dai dati CRM.' },
                        { emoji: '🔄', title: 'Disattivazione', description: 'Disattiva un membro per revocare l\'accesso. I dati storici restano. Puoi riassegnare i suoi lead a un altro membro.' },
                        { emoji: '🏬', title: 'Reparti', description: 'Ogni membro appartiene a un reparto (Setting, Closing, Marketing, ecc). Filtra per reparto per vedere le performance.' },
                    ]} footer="Solo Owner e Admin possono invitare, disattivare e gestire i ruoli dei membri." />
                    {canManage && (
                        <button onClick={() => setShowInvite(true)} className="btn-primary">
                            <Plus className="w-4 h-4" /> Invita Membro
                        </button>
                    )}
                </div>
            </div>

            {canManage && (
                <div className="flex items-center gap-4 border-b pb-2 mb-4" style={{ borderColor: 'var(--color-surface-200)' }}>
                    <button
                        onClick={() => setActiveTab('members')}
                        className={`text-sm font-bold pb-2 border-b-2 transition-colors ${activeTab === 'members' ? 'th-heading border-indigo-500' : 'th-muted border-transparent hover:th-heading'}`}
                    >
                        Membri & Leaderboard
                    </button>
                    <button
                        onClick={() => setActiveTab('assignments')}
                        className={`text-sm font-bold pb-2 border-b-2 transition-colors ${activeTab === 'assignments' ? 'th-heading border-indigo-500' : 'th-muted border-transparent hover:th-heading'}`}
                    >
                        Assegnazioni Lead / Appuntamenti
                    </button>
                </div>
            )}

            {activeTab === 'members' ? (
                <>
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
                        className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all th-bg-hover"
                        style={{ color: 'var(--color-surface-500)', border: '1px solid var(--color-surface-200)' }}
                    >
                        {showDeactivated ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        {showDeactivated ? 'Nascondi' : 'Mostra'} disattivati
                    </button>
                )}
            </div>

            {/* Leaderboard Venditori — unica classifica */}
            {venditori.length > 0 && (
                <div className="glass-card p-5">
                    <div className="flex items-center gap-2 mb-4">
                        <Trophy className="w-4 h-4" style={{ color: '#22c55e' }} />
                        <h3 className="text-sm font-bold th-heading">Leaderboard Venditori</h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Per Lead Assegnati */}
                        <div>
                            <div className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: '#3b82f6' }}>📋 Lead Assegnati</div>
                            <div className="space-y-3">
                                {[...venditori].sort((a, b) => b.leads_assigned - a.leads_assigned).map((m, i) => (
                                    <div key={m.id} className="flex items-center gap-3">
                                        <span className="text-lg font-bold w-6 text-center" style={{ color: i === 0 ? '#f59e0b' : i === 1 ? '#94a3b8' : i === 2 ? '#cd7f32' : 'var(--color-surface-500)' }}>
                                            {i + 1}
                                        </span>
                                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold" style={{ background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
                                            {((m.profiles as any)?.full_name || (m.profiles as any)?.email || '?')[0].toUpperCase()}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="text-sm font-semibold th-heading truncate">{(m.profiles as any)?.full_name || (m.profiles as any)?.email}</div>
                                            <div className="text-[11px]" style={{ color: 'var(--color-surface-500)' }}>{m.leads_assigned} lead</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                        {/* Per Revenue */}
                        <div>
                            <div className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: '#22c55e' }}>💰 Vendite & Revenue</div>
                            <div className="space-y-3">
                                {[...venditori].sort((a, b) => b.won_revenue - a.won_revenue).map((m, i) => (
                                    <div key={m.id} className="flex items-center gap-3">
                                        <span className="text-lg font-bold w-6 text-center" style={{ color: i === 0 ? '#f59e0b' : i === 1 ? '#94a3b8' : i === 2 ? '#cd7f32' : 'var(--color-surface-500)' }}>
                                            {i + 1}
                                        </span>
                                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold" style={{ background: 'rgba(34, 197, 94, 0.1)', color: '#22c55e', border: '1px solid rgba(34, 197, 94, 0.2)' }}>
                                            {((m.profiles as any)?.full_name || (m.profiles as any)?.email || '?')[0].toUpperCase()}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="text-sm font-semibold th-heading truncate">{(m.profiles as any)?.full_name || (m.profiles as any)?.email}</div>
                                            <div className="text-[11px]" style={{ color: 'var(--color-surface-500)' }}>{m.won_count} vendite • {formatCurrency(m.won_revenue)}</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Active Members List */}
            <div className="glass-card overflow-hidden">
                <div className="p-4 border-b" style={{ borderColor: 'var(--color-surface-200)' }}>
                    <h3 className="text-sm font-bold th-heading">Membri Attivi</h3>
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
                                <div key={m.id} className="flex items-center gap-4 p-4 th-bg-hover transition-colors">
                                    <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold" style={{ background: `${roleCfg.color}15`, color: roleCfg.color, border: `1px solid ${roleCfg.color}30` }}>
                                        {((m.profiles as any)?.full_name || (m.profiles as any)?.email || '?')[0].toUpperCase()}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="text-sm font-semibold th-heading truncate">{(m.profiles as any)?.full_name || (m.profiles as any)?.email || m.invited_email}</div>
                                        <div className="text-xs truncate" style={{ color: 'var(--color-surface-500)' }}>{(m.profiles as any)?.email || m.invited_email}</div>
                                    </div>
                                    <div className="flex items-center gap-2 flex-wrap justify-end">
                                        {/* Color Picker for Calendar view */}
                                        {canManage && (
                                            <div className="flex items-center gap-1.5 bg-[var(--hover-bg)] border border-[var(--color-surface-200)] px-2 py-1 rounded-lg mr-2" title="Colore in Calendario">
                                                <div className="text-[10px] font-semibold th-heading/50">Colore</div>
                                                <input 
                                                    type="color" 
                                                    value={m.display_color || '#3b82f6'} 
                                                    onBlur={(e) => handleUpdateColor(m.id, e.target.value)}
                                                    onChange={(e) => setMembers(prev => prev.map(p => p.id === m.id ? { ...p, display_color: e.target.value } : p))}
                                                    className="w-5 h-5 rounded cursor-pointer border-0 p-0 shadow-sm"
                                                    style={{ backgroundColor: 'transparent' }}
                                                />
                                            </div>
                                        )}
                                        
                                        {/* Department Dropdown / Badge */}
                                        {canManage && m.role !== 'owner' ? (
                                            <select
                                                value={m.department || ''}
                                                onChange={(e) => handleUpdateRole(m.id, m.role, e.target.value || undefined)}
                                                className="text-[10px] font-bold px-2.5 py-1.5 rounded-lg bg-[var(--hover-bg)] border border-[var(--color-surface-200)] text-[var(--color-surface-800)] cursor-pointer focus:outline-none focus:ring-1 focus:ring-indigo-500 hover:border-[var(--color-surface-300)]"
                                                style={{ color: 'var(--color-surface-900)', backgroundColor: 'var(--color-surface-50)' }}
                                            >
                                                <option value="">Nessun Reparto</option>
                                                {ALL_DEPARTMENTS.map(d => (
                                                    <option key={d} value={d}>
                                                        {DEPARTMENT_CONFIG[d].emoji} {DEPARTMENT_CONFIG[d].label}
                                                    </option>
                                                ))}
                                            </select>
                                        ) : (
                                            deptCfg && (
                                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: `${deptCfg.color}10`, color: deptCfg.color, border: `1px solid ${deptCfg.color}20` }}>
                                                    {deptCfg.emoji} {deptCfg.label}
                                                </span>
                                            )
                                        )}

                                        {/* Role Dropdown / Badge */}
                                        {canManage && m.role !== 'owner' ? (
                                            <select
                                                value={m.role}
                                                onChange={(e) => handleUpdateRole(m.id, e.target.value, m.department || undefined)}
                                                className="text-[10px] font-bold px-2.5 py-1.5 rounded-lg bg-[var(--hover-bg)] border border-[var(--color-surface-200)] text-[var(--color-surface-800)] cursor-pointer focus:outline-none focus:ring-1 focus:ring-indigo-500 hover:border-[var(--color-surface-300)]"
                                                style={{ color: 'var(--color-surface-900)', backgroundColor: 'var(--color-surface-50)' }}
                                            >
                                                {INVITABLE_ROLES.map(r => (
                                                    <option key={r} value={r}>
                                                        {ROLE_CONFIG[r].label}
                                                    </option>
                                                ))}
                                            </select>
                                        ) : (
                                            <span className="badge flex items-center gap-1" style={{ background: `${roleCfg.color}10`, color: roleCfg.color, border: `1px solid ${roleCfg.color}20` }}>
                                                <RoleIcon className="w-3 h-3" /> {roleCfg.label}
                                            </span>
                                        )}

                                        {m.leads_assigned > 0 && (
                                            <span className="text-xs font-medium" style={{ color: 'var(--color-surface-500)' }}>{m.leads_assigned} lead</span>
                                        )}
                                        {canManage && m.role !== 'owner' && (
                                            <>
                                                <button 
                                                    onClick={() => handleResetPassword(m)} 
                                                    className="p-1.5 rounded-lg th-bg-hover" 
                                                    title="Reset Password"
                                                >
                                                    <KeyRound className="w-3.5 h-3.5" style={{ color: '#f59e0b' }} />
                                                </button>
                                                <button 
                                                    onClick={() => setShowDeactivateModal(m)} 
                                                    className="p-1.5 rounded-lg th-bg-hover" 
                                                    title="Disattiva"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" style={{ color: '#ef4444' }} />
                                                </button>
                                            </>
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
                                            <button onClick={() => handleReactivate(m.id)} className="p-1.5 rounded-lg th-bg-hover" title="Riattiva">
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
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--overlay-bg)] backdrop-blur-sm animate-fade-in">
                    <div className="w-full max-w-md glass-card p-6 m-4" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-lg font-bold th-heading">Invita Membro</h2>
                            <button onClick={() => setShowInvite(false)} className="p-2 rounded-xl th-bg-hover"><X className="w-5 h-5" style={{ color: 'var(--color-surface-500)' }} /></button>
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
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--overlay-bg)] backdrop-blur-sm animate-fade-in" onClick={() => setShowDeactivateModal(null)}>
                    <div className="w-full max-w-lg glass-card p-6 m-4" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-bold th-heading">🚫 Disattiva Membro</h2>
                            <button onClick={() => setShowDeactivateModal(null)} className="p-2 rounded-xl th-bg-hover"><X className="w-5 h-5" style={{ color: 'var(--color-surface-500)' }} /></button>
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
                                            .filter(m => m.id !== showDeactivateModal.id && (m.role === 'closer' || m.role === 'admin' || m.role === 'owner'))
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

            {/* Modal Link Invito */}
            {inviteLink && (
                <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.7)' }}>
                    <div className="glass-card p-6 w-full max-w-lg mx-4 space-y-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: 'rgba(34, 197, 94, 0.15)' }}>
                                <span className="text-lg">✅</span>
                            </div>
                            <div>
                                <h3 className="text-lg font-bold th-heading">Membro invitato!</h3>
                                <p className="text-xs" style={{ color: 'var(--color-surface-400)' }}>Invia questo link al membro per farlo accedere</p>
                            </div>
                        </div>

                        <div className="flex gap-2">
                            <input
                                type="text"
                                readOnly
                                value={inviteLink}
                                className="input flex-1 text-xs font-mono"
                                style={{ cursor: 'text', userSelect: 'all' }}
                                onClick={(e) => (e.target as HTMLInputElement).select()}
                            />
                            <button
                                onClick={async () => {
                                    await navigator.clipboard.writeText(inviteLink)
                                    setLinkCopied(true)
                                    setTimeout(() => setLinkCopied(false), 3000)
                                }}
                                className="btn-primary whitespace-nowrap"
                                style={{ minWidth: '120px' }}
                            >
                                {linkCopied ? '✓ Copiato!' : '📋 Copia Link'}
                            </button>
                        </div>

                        <div className="flex justify-end pt-2">
                            <button 
                                onClick={() => setInviteLink(null)} 
                                className="btn-secondary"
                            >
                                Chiudi
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal Reset Password Link */}
            {resetPasswordLink && (
                <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.7)' }}>
                    <div className="glass-card p-6 w-full max-w-lg mx-4 space-y-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: 'rgba(245, 158, 11, 0.15)' }}>
                                <KeyRound className="w-5 h-5" style={{ color: '#f59e0b' }} />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold th-heading">Reset Password</h3>
                                <p className="text-xs" style={{ color: 'var(--color-surface-400)' }}>Link di reset per <strong className="th-heading">{resetPasswordFor}</strong></p>
                            </div>
                        </div>

                        <div className="p-3 rounded-xl text-sm" style={{ background: 'rgba(245, 158, 11, 0.05)', border: '1px solid rgba(245, 158, 11, 0.15)', color: 'var(--color-surface-400)' }}>
                            Invia questo link al membro del team. Cliccandolo potrà impostare una nuova password.
                        </div>

                        <div className="flex gap-2">
                            <input
                                type="text"
                                readOnly
                                value={resetPasswordLink}
                                className="input flex-1 text-xs font-mono"
                                style={{ cursor: 'text', userSelect: 'all' }}
                                onClick={(e) => (e.target as HTMLInputElement).select()}
                            />
                            <button
                                onClick={async () => {
                                    await navigator.clipboard.writeText(resetPasswordLink)
                                    setResetLinkCopied(true)
                                    setTimeout(() => setResetLinkCopied(false), 3000)
                                }}
                                className="btn-primary whitespace-nowrap"
                                style={{ minWidth: '120px' }}
                            >
                                {resetLinkCopied ? '✓ Copiato!' : '📋 Copia Link'}
                            </button>
                        </div>

                        <div className="flex justify-end pt-2">
                            <button 
                                onClick={() => setResetPasswordLink(null)} 
                                className="btn-secondary"
                            >
                                Chiudi
                            </button>
                        </div>
                    </div>
                </div>
            )}

            </>
            ) : (
                <div className="space-y-6">
                    {/* Lead Assignment */}
                    <div className="glass-card p-6">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                                <Shuffle className="w-4 h-4" style={{ color: '#3b82f6' }} />
                                <h3 className="text-sm font-bold th-heading">Assegnazione Lead</h3>
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

                        {/* Calendar Assignment Mode */}
                        <div className="mt-8 mb-5 pt-6 border-t border-[var(--color-surface-200)]">
                            <div className="flex items-center gap-2 mb-4">
                                <CalendarDays className="w-4 h-4 text-indigo-400" />
                                <h3 className="text-sm font-bold th-heading">Appuntamenti / Calendario</h3>
                            </div>
                            <p className="text-xs th-muted mb-3">Scegli come Sincro decide chi è il venditore da assegnare all'appuntamento (Fast Booking Auto-Assegna).</p>

                            <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
                                {[
                                    { value: 'round_robin', label: 'Round Robin', icon: Shuffle, desc: 'Esatta distribuzione equilibrata e matematica.', color: '#3b82f6' },
                                    { value: 'availability', label: 'Miglior Disponibilità (Load Balancing)', icon: Shield, desc: 'Chi ha meno appuntamenti totali questa settimana.', color: '#22c55e' },
                                    { value: 'performance', label: 'Miglior Venditore (Performance)', icon: TrendingUp, desc: 'Chi ha completato positivamente più appuntamenti in passato.', color: '#f59e0b' }
                                ].map(mode => (
                                    <button
                                        key={`cal_${mode.value}`}
                                        onClick={() => saveCalendarAssignConfig(mode.value)}
                                        className="p-3 rounded-xl text-left transition-all"
                                        style={{
                                            background: calendarAssignMode === mode.value ? `${mode.color}15` : 'var(--color-surface-100)',
                                            border: `1px solid ${calendarAssignMode === mode.value ? `${mode.color}40` : 'var(--color-surface-200)'}`,
                                        }}
                                    >
                                        <mode.icon className="w-4 h-4 mb-1" style={{ color: calendarAssignMode === mode.value ? mode.color : 'var(--color-surface-500)' }} />
                                        <div className="text-xs font-bold" style={{ color: calendarAssignMode === mode.value ? mode.color : 'var(--color-surface-400)' }}>{mode.label}</div>
                                        <div className="text-[10px] mt-0.5" style={{ color: 'var(--color-surface-600)' }}>{mode.desc}</div>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Setter list */}
                        {settersList.length > 0 && (
                            <div>
                                <div className="text-xs font-semibold th-heading mb-2">Team Venditori</div>
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
                                                <div className="text-xs font-semibold th-heading truncate">{s.full_name}</div>
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
                    </div>
                </div>
            )}
        </div>
    )
}
