'use client'

import { Users, Target, BarChart3, Megaphone, UserCircle, Settings } from 'lucide-react'

function PlaceholderPage({ title, icon: Icon, color, description }: { title: string; icon: any; color: string; description: string }) {
    return (
        <div className="space-y-6 animate-fade-in">
            <div>
                <h1 className="text-2xl font-bold text-white flex items-center gap-3">
                    <Icon className="w-6 h-6" style={{ color }} />
                    {title}
                </h1>
                <p className="text-sm mt-1" style={{ color: 'var(--color-surface-600)' }}>{description}</p>
            </div>
            <div className="glass-card p-12 text-center">
                <Icon className="w-12 h-12 mx-auto mb-4" style={{ color, opacity: 0.3 }} />
                <p className="text-sm font-semibold text-white mb-2">In costruzione</p>
                <p className="text-xs" style={{ color: 'var(--color-surface-500)' }}>
                    Questa sezione sarà disponibile a breve
                </p>
            </div>
        </div>
    )
}

export function CRMPlaceholder() {
    return <PlaceholderPage title="CRM Pipeline" icon={Users} color="#3b82f6" description="Gestisci lead, setter e closer con pipeline kanban" />
}

export function FunnelsPlaceholder() {
    return <PlaceholderPage title="Funnel" icon={Target} color="#8b5cf6" description="Landing page e funnel di acquisizione" />
}

export function AdsPlaceholder() {
    return <PlaceholderPage title="Ads" icon={Megaphone} color="#f59e0b" description="Campagne Meta Ads, performance e regole automatiche" />
}

export function AnalyticsPlaceholder() {
    return <PlaceholderPage title="Analytics" icon={BarChart3} color="#10b981" description="KPI, grafici e breakdown performance" />
}

export function TeamPlaceholder() {
    return <PlaceholderPage title="Team" icon={UserCircle} color="#ec4899" description="Leaderboard setter/closer e attività team" />
}

export function SettingsPlaceholder() {
    return <PlaceholderPage title="Impostazioni" icon={Settings} color="#71717a" description="Configurazione organizzazione e pipeline" />
}
