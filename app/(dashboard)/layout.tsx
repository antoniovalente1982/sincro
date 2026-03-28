'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import {
    LayoutDashboard, Target, Users, BarChart3, Plug, UserCircle,
    LogOut, ChevronLeft, ChevronRight, Megaphone, Settings, Brain,
    Bell, X, Check, AlertTriangle, Info, Sparkles, CheckCircle,
    History,
    type LucideIcon
} from 'lucide-react'
import DanteChat from './dashboard/DanteChat'

interface NavItem {
    label: string
    href: string
    icon: LucideIcon
}

const navItems: NavItem[] = [
    { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { label: 'CRM Pipeline', href: '/dashboard/crm', icon: Users },
    { label: 'Funnel', href: '/dashboard/funnels', icon: Target },
    { label: 'Ads', href: '/dashboard/ads', icon: Megaphone },
    { label: 'AI Engine', href: '/dashboard/ai-engine/video-editor', icon: Brain },
    { label: 'Operazioni', href: '/dashboard/operations', icon: History },
    { label: 'Analytics', href: '/dashboard/analytics', icon: BarChart3 },
    { label: 'Team', href: '/dashboard/team', icon: UserCircle },
    { label: 'Connessioni', href: '/dashboard/connections', icon: Plug },
    { label: 'Impostazioni', href: '/dashboard/settings', icon: Settings },
]

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
    const [collapsed, setCollapsed] = useState(false)
    const [user, setUser] = useState<any>(null)
    const [orgName, setOrgName] = useState('')
    const [notifications, setNotifications] = useState<any[]>([])
    const [unreadCount, setUnreadCount] = useState(0)
    const [showNotifs, setShowNotifs] = useState(false)
    const notifRef = useRef<HTMLDivElement>(null)
    const pathname = usePathname()
    const router = useRouter()
    const supabase = createClient()

    const loadNotifications = async () => {
        try {
            const res = await fetch('/api/notifications')
            if (res.ok) {
                const data = await res.json()
                setNotifications(data.notifications || [])
                setUnreadCount(data.unreadCount || 0)
            }
        } catch {}
    }

    useEffect(() => {
        const getUser = async () => {
            const { data: { user } } = await supabase.auth.getUser()
            if (user) {
                setUser(user)
                const { data: member } = await supabase
                    .from('organization_members')
                    .select('organizations(name)')
                    .eq('user_id', user.id)
                    .single()
                if (member?.organizations) {
                    setOrgName((member.organizations as any).name)
                }
            }
        }
        getUser()
        loadNotifications()
        const interval = setInterval(loadNotifications, 120000)
        return () => clearInterval(interval)
    }, [])

    // Close dropdown on click outside
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (notifRef.current && !notifRef.current.contains(e.target as Node)) setShowNotifs(false)
        }
        document.addEventListener('mousedown', handler)
        return () => document.removeEventListener('mousedown', handler)
    }, [])

    const markAllRead = async () => {
        await fetch('/api/notifications', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'mark_read', id: 'all' }),
        })
        loadNotifications()
    }

    const notifIcon = (type: string) => {
        if (type === 'warning') return <AlertTriangle className="w-3.5 h-3.5" style={{ color: '#f59e0b' }} />
        if (type === 'critical') return <AlertTriangle className="w-3.5 h-3.5" style={{ color: '#ef4444' }} />
        if (type === 'success') return <CheckCircle className="w-3.5 h-3.5" style={{ color: '#22c55e' }} />
        if (type === 'ai') return <Sparkles className="w-3.5 h-3.5" style={{ color: '#a855f7' }} />
        return <Info className="w-3.5 h-3.5" style={{ color: '#3b82f6' }} />
    }

    const handleLogout = async () => {
        await supabase.auth.signOut()
        router.push('/login')
        router.refresh()
    }

    const isActive = (href: string) => {
        if (href === '/dashboard') return pathname === '/dashboard'
        return pathname.startsWith(href)
    }

    return (
        <div className="flex h-screen overflow-hidden" style={{ background: 'var(--color-surface-0)' }}>
            {/* Sidebar */}
            <aside
                className="flex flex-col border-r transition-all duration-300 relative"
                style={{
                    width: collapsed ? '72px' : '260px',
                    background: 'var(--color-surface-50)',
                    borderColor: 'var(--color-surface-200)',
                }}
            >
                {/* Logo */}
                <div className="flex items-center gap-3 p-5 border-b" style={{ borderColor: 'var(--color-surface-200)' }}>
                    <Image src="/logo.png" alt="ADPILOTIK" width={36} height={36} className="rounded-xl flex-shrink-0" />
                    {!collapsed && (
                        <div className="animate-fade-in">
                            <div className="text-sm font-bold text-white tracking-tight">ADPILOTIK</div>
                            <div className="text-[11px] truncate max-w-[160px]" style={{ color: 'var(--color-surface-500)' }}>
                                {orgName || 'Caricamento...'}
                            </div>
                        </div>
                    )}
                </div>

                {/* Nav */}
                <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
                    {navItems.map((item) => (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={`nav-item ${isActive(item.href) ? 'nav-item-active' : ''}`}
                            title={collapsed ? item.label : undefined}
                        >
                            <item.icon className="w-5 h-5 flex-shrink-0" />
                            {!collapsed && <span>{item.label}</span>}
                        </Link>
                    ))}
                </nav>

                {/* User + Logout */}
                <div className="p-3 border-t" style={{ borderColor: 'var(--color-surface-200)' }}>
                    {!collapsed && user && (
                        <div className="px-3 py-2 mb-2">
                            <div className="text-xs font-semibold text-white truncate">
                                {user.user_metadata?.full_name || user.email}
                            </div>
                            <div className="text-[11px] truncate" style={{ color: 'var(--color-surface-500)' }}>
                                {user.email}
                            </div>
                        </div>
                    )}
                    <button
                        onClick={handleLogout}
                        className="nav-item w-full text-left hover:!text-red-400"
                        title={collapsed ? 'Esci' : undefined}
                    >
                        <LogOut className="w-5 h-5 flex-shrink-0" />
                        {!collapsed && <span>Esci</span>}
                    </button>
                </div>

                {/* Collapse toggle */}
                <button
                    onClick={() => setCollapsed(!collapsed)}
                    className="absolute -right-3 top-20 w-6 h-6 rounded-full flex items-center justify-center border z-50"
                    style={{
                        background: 'var(--color-surface-100)',
                        borderColor: 'var(--color-surface-300)',
                        color: 'var(--color-surface-600)',
                    }}
                >
                    {collapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
                </button>
            </aside>

            {/* Main Content */}
            <main className="flex-1 overflow-y-auto">
                {/* Top bar with notifications */}
                <div className="flex items-center justify-end gap-3 px-6 lg:px-8 pt-4 pb-0">
                    <div className="relative" ref={notifRef}>
                        <button
                            onClick={() => { setShowNotifs(!showNotifs); if (!showNotifs) loadNotifications() }}
                            className="relative p-2 rounded-xl transition-colors hover:bg-white/5"
                        >
                            <Bell className="w-5 h-5" style={{ color: unreadCount > 0 ? '#a855f7' : 'var(--color-surface-500)' }} />
                            {unreadCount > 0 && (
                                <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold text-white animate-pulse" style={{ background: '#ef4444' }}>
                                    {unreadCount > 9 ? '9+' : unreadCount}
                                </span>
                            )}
                        </button>
                        {showNotifs && (
                            <div className="absolute right-0 top-12 w-96 max-h-[500px] overflow-y-auto glass-card shadow-2xl z-50 animate-fade-in">
                                <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: 'var(--color-surface-200)' }}>
                                    <h3 className="text-sm font-bold text-white">Notifiche</h3>
                                    <div className="flex items-center gap-2">
                                        {unreadCount > 0 && (
                                            <button onClick={markAllRead} className="text-[11px] font-medium px-2 py-0.5 rounded" style={{ color: '#a855f7' }}>Segna tutte lette</button>
                                        )}
                                        <button onClick={() => setShowNotifs(false)}><X className="w-4 h-4" style={{ color: 'var(--color-surface-500)' }} /></button>
                                    </div>
                                </div>
                                {notifications.length === 0 ? (
                                    <div className="p-6 text-center text-sm" style={{ color: 'var(--color-surface-500)' }}>Nessuna notifica</div>
                                ) : (
                                    <div className="divide-y" style={{ borderColor: 'var(--color-surface-200)' }}>
                                        {notifications.map((n: any) => (
                                            <Link key={n.id} href={n.link || '#'} onClick={() => setShowNotifs(false)}
                                                className={`flex items-start gap-3 p-3 transition-colors hover:bg-white/[0.03] ${!n.is_read ? 'bg-white/[0.02]' : ''}`}>
                                                <div className="mt-0.5">{notifIcon(n.type)}</div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="text-xs font-semibold text-white truncate">{n.title}</div>
                                                    {n.message && <div className="text-[11px] mt-0.5 line-clamp-2" style={{ color: 'var(--color-surface-500)' }}>{n.message}</div>}
                                                    <div className="text-[10px] mt-1" style={{ color: 'var(--color-surface-600)' }}>
                                                        {new Date(n.created_at).toLocaleString('it-IT', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' })}
                                                    </div>
                                                </div>
                                                {!n.is_read && <div className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0" style={{ background: '#a855f7' }} />}
                                            </Link>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
                <div className="p-6 lg:p-8 pt-2 max-w-[1600px] mx-auto">
                    {children}
                </div>
            </main>

            {/* Dante AI Chat Widget */}
            <DanteChat />
        </div>
    )
}
