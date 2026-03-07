'use client'

import { Users, Target, Plug, ArrowRight, BarChart3, TrendingUp, Rocket } from 'lucide-react'
import Link from 'next/link'

interface Props {
    userName: string
    orgName: string
    leadCount: number
    funnelCount: number
    connectionCount: number
    stages: any[]
}

export default function DashboardOverview({ userName, orgName, leadCount, funnelCount, connectionCount, stages }: Props) {
    const firstName = userName.split(' ')[0]
    const hour = new Date().getHours()
    const greeting = hour < 12 ? 'Buongiorno' : hour < 18 ? 'Buon pomeriggio' : 'Buonasera'

    const kpis = [
        { label: 'Lead totali', value: leadCount, icon: Users, color: '#3b82f6', href: '/dashboard/crm' },
        { label: 'Funnel attivi', value: funnelCount, icon: Target, color: '#8b5cf6', href: '/dashboard/funnels' },
        { label: 'Connessioni', value: connectionCount, icon: Plug, color: '#10b981', href: '/dashboard/connections' },
    ]

    const quickActions = [
        { label: 'Gestisci Pipeline', desc: 'CRM setter/closer', icon: Users, href: '/dashboard/crm', color: '#3b82f6' },
        { label: 'Vedi Analytics', desc: 'Performance campagne', icon: BarChart3, href: '/dashboard/analytics', color: '#8b5cf6' },
        { label: 'Collega Meta Ads', desc: 'Configura tracking', icon: Plug, href: '/dashboard/connections', color: '#10b981' },
        { label: 'Crea Funnel', desc: 'Nuova landing page', icon: Target, href: '/dashboard/funnels', color: '#f59e0b' },
    ]

    return (
        <div className="space-y-8 animate-fade-in">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-white">
                    {greeting}, {firstName} 👋
                </h1>
                <p className="text-sm mt-1" style={{ color: 'var(--color-surface-600)' }}>
                    Ecco cosa succede su <span className="font-semibold" style={{ color: 'var(--color-sincro-400)' }}>{orgName}</span>
                </p>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {kpis.map((kpi) => (
                    <Link key={kpi.label} href={kpi.href}>
                        <div className="kpi-card group cursor-pointer">
                            <div className="flex items-center justify-between mb-4">
                                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${kpi.color}15`, border: `1px solid ${kpi.color}30` }}>
                                    <kpi.icon className="w-5 h-5" style={{ color: kpi.color }} />
                                </div>
                                <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: 'var(--color-surface-500)' }} />
                            </div>
                            <div className="text-3xl font-bold text-white mb-1">{kpi.value}</div>
                            <div className="text-sm" style={{ color: 'var(--color-surface-600)' }}>{kpi.label}</div>
                        </div>
                    </Link>
                ))}
            </div>

            {/* Pipeline Overview */}
            {stages.length > 0 && (
                <div className="glass-card p-6">
                    <div className="flex items-center gap-2 mb-4">
                        <TrendingUp className="w-5 h-5" style={{ color: 'var(--color-sincro-400)' }} />
                        <h2 className="text-lg font-bold text-white">Pipeline CRM → Meta CAPI</h2>
                    </div>
                    <p className="text-xs mb-5" style={{ color: 'var(--color-surface-500)' }}>
                        Ogni cambio di stage invia automaticamente un evento a Meta per ottimizzare l'algoritmo
                    </p>
                    <div className="flex flex-wrap gap-3">
                        {stages.map((stage, i) => (
                            <div key={stage.id} className="flex items-center gap-2">
                                <div
                                    className="stage-pill"
                                    style={{
                                        background: `${stage.color}15`,
                                        color: stage.color,
                                        border: `1px solid ${stage.color}30`,
                                    }}
                                >
                                    <div className="w-2 h-2 rounded-full" style={{ background: stage.color }} />
                                    {stage.name}
                                    {stage.fire_capi_event && (
                                        <span className="text-[10px] opacity-60 ml-1">→ {stage.fire_capi_event}</span>
                                    )}
                                </div>
                                {i < stages.length - 1 && (
                                    <ArrowRight className="w-3 h-3 flex-shrink-0" style={{ color: 'var(--color-surface-400)' }} />
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Quick Actions */}
            <div>
                <h2 className="text-lg font-bold text-white mb-4">Azioni rapide</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {quickActions.map((action) => (
                        <Link key={action.label} href={action.href}>
                            <div className="glass-card p-5 group cursor-pointer hover:border-opacity-30 transition-all">
                                <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4" style={{ background: `${action.color}15`, border: `1px solid ${action.color}30` }}>
                                    <action.icon className="w-5 h-5" style={{ color: action.color }} />
                                </div>
                                <div className="text-sm font-semibold text-white mb-1">{action.label}</div>
                                <div className="text-xs" style={{ color: 'var(--color-surface-500)' }}>{action.desc}</div>
                            </div>
                        </Link>
                    ))}
                </div>
            </div>

            {/* CAPI Flow Info */}
            <div className="glass-card p-6 animate-pulse-glow">
                <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(99, 102, 241, 0.1)', border: '1px solid rgba(99, 102, 241, 0.2)' }}>
                        <Rocket className="w-5 h-5" style={{ color: 'var(--color-sincro-400)' }} />
                    </div>
                    <div>
                        <div className="text-sm font-bold text-white mb-1">Tracciamento CRM → Meta CAPI</div>
                        <div className="text-xs leading-relaxed" style={{ color: 'var(--color-surface-500)' }}>
                            Quando un setter/closer sposta un lead nel pipeline (es: da "Lead" a "Qualificato"), il sistema invia
                            automaticamente l'evento corrispondente a Meta via CAPI. Così Meta ottimizza per trovare genitori
                            simili a quelli che prenotano, si presentano e comprano — non solo quelli che compilano il form.
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
