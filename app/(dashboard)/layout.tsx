'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import {
    LayoutDashboard, Target, Users, BarChart3, Plug, UserCircle,
    LogOut, ChevronLeft, ChevronRight, Megaphone, Settings,
    type LucideIcon
} from 'lucide-react'

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
    { label: 'Analytics', href: '/dashboard/analytics', icon: BarChart3 },
    { label: 'Team', href: '/dashboard/team', icon: UserCircle },
    { label: 'Connessioni', href: '/dashboard/connections', icon: Plug },
    { label: 'Impostazioni', href: '/dashboard/settings', icon: Settings },
]

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
    const [collapsed, setCollapsed] = useState(false)
    const [user, setUser] = useState<any>(null)
    const [orgName, setOrgName] = useState('')
    const pathname = usePathname()
    const router = useRouter()
    const supabase = createClient()

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
    }, [])

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
                <div className="p-6 lg:p-8 max-w-[1600px] mx-auto">
                    {children}
                </div>
            </main>
        </div>
    )
}
