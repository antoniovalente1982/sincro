'use client'

import { Users, Target, Plug, ArrowRight, BarChart3, TrendingUp, Rocket, Brain, Zap, DollarSign, Clock, AlertTriangle, CheckCircle, XCircle, ArrowUpRight, ArrowDownRight, Sparkles, ExternalLink } from 'lucide-react'
import Link from 'next/link'
import DateRangeFilter, { useDateRange, filterByDateRange } from '@/components/DateRangeFilter'

interface Lead {
    id: string; value?: number; stage_id?: string; created_at: string; updated_at: string
    funnel_id?: string; utm_source?: string
}

interface Stage {
    id: string; name: string; slug: string; color: string; sort_order: number
    fire_capi_event?: string; is_won?: boolean; is_lost?: boolean
}

interface Props {
    userName: string; orgName: string
    leadCount: number; funnelCount: number; connectionCount: number
    stages: Stage[]
    leads: Lead[]
    recentActivities: any[]
}

export default function DashboardOverview({ userName, orgName, leadCount, funnelCount, connectionCount, stages, leads: allLeads, recentActivities }: Props) {
    const firstName = userName.split(' ')[0]
    const hour = new Date().getHours()
    const greeting = hour < 12 ? 'Buongiorno' : hour < 18 ? 'Buon pomeriggio' : 'Buonasera'
    const { range, activeKey, setActiveKey, customFrom, setCustomFrom, customTo, setCustomTo } = useDateRange('today')
    const leads = filterByDateRange(allLeads, range, 'created_at')

    const getRelativeTime = (dateStr: string) => {
        const diffMs = Date.now() - new Date(dateStr).getTime()
        const mins = Math.floor(diffMs / 60000)
        if (mins < 1) return 'adesso'
        if (mins < 60) return `${mins}m fa`
        const hrs = Math.floor(mins / 60)
        if (hrs < 24) return `${hrs}h fa`
        const days = Math.floor(hrs / 24)
        return `${days}g fa`
    }

    // --- AI INSIGHTS CALCULATIONS ---
    const wonStage = stages.find(s => s.is_won)
    const lostStage = stages.find(s => s.is_lost)
    const totalLeads = leads.length

    // Leads per stage
    const leadsPerStage: Record<string, number> = {}
    stages.forEach(s => leadsPerStage[s.id] = 0)
    leads.forEach(l => { if (l.stage_id) leadsPerStage[l.stage_id] = (leadsPerStage[l.stage_id] || 0) + 1 })

    // Win/loss counts
    const wonCount = wonStage ? (leadsPerStage[wonStage.id] || 0) : 0
    const lostCount = lostStage ? (leadsPerStage[lostStage.id] || 0) : 0
    const activeLeads = totalLeads - wonCount - lostCount
    const conversionRate = totalLeads > 0 ? Math.round((wonCount / totalLeads) * 100) : 0

    // Pipeline value
    const pipelineValue = leads.filter(l => l.stage_id !== lostStage?.id).reduce((sum, l) => sum + (l.value || 0), 0)
    const wonValue = leads.filter(l => l.stage_id === wonStage?.id).reduce((sum, l) => sum + (l.value || 0), 0)

    // Avg time in pipeline (days)
    const closedLeads = leads.filter(l => l.stage_id === wonStage?.id || l.stage_id === lostStage?.id)
    const avgDays = closedLeads.length > 0
        ? Math.round(closedLeads.reduce((sum, l) => {
            const diff = new Date(l.updated_at).getTime() - new Date(l.created_at).getTime()
            return sum + diff / (1000 * 60 * 60 * 24)
        }, 0) / closedLeads.length)
        : 0

    // Source attribution
    const sources: Record<string, number> = {}
    leads.forEach(l => { const src = l.utm_source || 'diretto'; sources[src] = (sources[src] || 0) + 1 })
    const topSource = Object.entries(sources).sort(([, a], [, b]) => b - a)[0]

    // Bottleneck detection: find stage with most leads (excluding won/lost)
    const activeStages = stages.filter(s => !s.is_won && !s.is_lost)
    let bottleneckName = ''
    let maxLeads = 0
    activeStages.forEach(s => {
        if ((leadsPerStage[s.id] || 0) > maxLeads) {
            maxLeads = leadsPerStage[s.id] || 0
            bottleneckName = s.name
        }
    })

    // AI Insights
    const insights: { text: string; type: 'success' | 'warning' | 'info' | 'danger'; icon: any }[] = []

    if (totalLeads === 0) {
        insights.push({
            text: 'Nessun lead nel pipeline. Crea un funnel e attiva le campagne per iniziare!',
            type: 'info', icon: Sparkles
        })
    } else {
        if (conversionRate > 20) {
            insights.push({ text: `Tasso di conversione del ${conversionRate}% — ottimo lavoro! Continua così.`, type: 'success', icon: CheckCircle })
        } else if (conversionRate > 0) {
            insights.push({ text: `Tasso di conversione del ${conversionRate}%. Punta al 20%+ ottimizzando il follow-up.`, type: 'warning', icon: AlertTriangle })
        }

        if (bottleneckName && maxLeads > 2) {
            insights.push({
                text: `${maxLeads} lead bloccati in "${bottleneckName}". Velocizza i follow-up per questa fase.`,
                type: 'warning', icon: Clock
            })
        }

        if (topSource && totalLeads > 3) {
            insights.push({
                text: `La fonte migliore è "${topSource[0]}" con ${topSource[1]} lead (${Math.round(topSource[1] / totalLeads * 100)}%).`,
                type: 'info', icon: TrendingUp
            })
        }

        if (wonValue > 0) {
            insights.push({
                text: `Revenue consolidata: €${wonValue.toLocaleString('it-IT')}. Pipeline attiva: €${pipelineValue.toLocaleString('it-IT')}.`,
                type: 'success', icon: DollarSign
            })
        }

        if (avgDays > 14) {
            insights.push({ text: `Tempo medio di conversione: ${avgDays} giorni. Prova a ridurlo sotto i 7 giorni.`, type: 'danger', icon: Clock })
        }
    }

    const kpis = [
        { label: 'Lead totali', value: leads.length, icon: Users, color: '#3b82f6', href: '/dashboard/crm' },
        { label: 'Conversion Rate', value: `${conversionRate}%`, icon: TrendingUp, color: '#22c55e', href: '/dashboard/analytics' },
        { label: 'Valore Pipeline', value: `€${pipelineValue.toLocaleString('it-IT')}`, icon: DollarSign, color: '#f59e0b', href: '/dashboard/crm' },
        { label: 'Funnel attivi', value: funnelCount, icon: Target, color: '#8b5cf6', href: '/dashboard/funnels' },
    ]

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header */}
            <div className="flex items-center justify-between gap-4 flex-wrap">
                <div>
                    <h1 className="text-2xl font-bold text-white">
                        {greeting}, {firstName} 👋
                    </h1>
                    <p className="text-sm mt-1" style={{ color: 'var(--color-surface-600)' }}>
                        Ecco cosa succede su <span className="font-semibold" style={{ color: 'var(--color-sincro-400)' }}>{orgName}</span>
                    </p>
                </div>
                <DateRangeFilter activeKey={activeKey} onSelect={setActiveKey}
                    customFrom={customFrom} customTo={customTo}
                    onCustomFromChange={setCustomFrom} onCustomToChange={setCustomTo} />
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {kpis.map((kpi) => (
                    <Link key={kpi.label} href={kpi.href}>
                        <div className="kpi-card group cursor-pointer">
                            <div className="flex items-center justify-between mb-3">
                                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${kpi.color}15`, border: `1px solid ${kpi.color}30` }}>
                                    <kpi.icon className="w-5 h-5" style={{ color: kpi.color }} />
                                </div>
                                <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: 'var(--color-surface-500)' }} />
                            </div>
                            <div className="text-2xl font-bold text-white mb-0.5">{kpi.value}</div>
                            <div className="text-xs" style={{ color: 'var(--color-surface-600)' }}>{kpi.label}</div>
                        </div>
                    </Link>
                ))}
            </div>

            {/* AI Insights */}
            {insights.length > 0 && (
                <div className="glass-card p-6">
                    <div className="flex items-center gap-2 mb-4">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(168, 85, 247, 0.15)', border: '1px solid rgba(168, 85, 247, 0.3)' }}>
                            <Brain className="w-4 h-4" style={{ color: '#a855f7' }} />
                        </div>
                        <h2 className="text-base font-bold text-white">AI Insights</h2>
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: 'rgba(168, 85, 247, 0.15)', color: '#a855f7' }}>SMART</span>
                    </div>
                    <div className="space-y-3">
                        {insights.map((insight, i) => {
                            const colors = {
                                success: { bg: 'rgba(34, 197, 94, 0.08)', border: 'rgba(34, 197, 94, 0.2)', text: '#22c55e' },
                                warning: { bg: 'rgba(245, 158, 11, 0.08)', border: 'rgba(245, 158, 11, 0.2)', text: '#f59e0b' },
                                info: { bg: 'rgba(59, 130, 246, 0.08)', border: 'rgba(59, 130, 246, 0.2)', text: '#3b82f6' },
                                danger: { bg: 'rgba(239, 68, 68, 0.08)', border: 'rgba(239, 68, 68, 0.2)', text: '#ef4444' },
                            }[insight.type]

                            return (
                                <div key={i} className="flex items-start gap-3 p-3 rounded-xl" style={{ background: colors.bg, border: `1px solid ${colors.border}` }}>
                                    <insight.icon className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: colors.text }} />
                                    <p className="text-sm" style={{ color: colors.text }}>{insight.text}</p>
                                </div>
                            )
                        })}
                    </div>
                </div>
            )}

            {/* Pipeline Funnel Visualization */}
            {stages.length > 0 && totalLeads > 0 && (
                <div className="glass-card p-6">
                    <div className="flex items-center gap-2 mb-5">
                        <Zap className="w-5 h-5" style={{ color: 'var(--color-sincro-400)' }} />
                        <h2 className="text-base font-bold text-white">Pipeline — Conversion Funnel</h2>
                    </div>
                    <div className="space-y-2">
                        {(() => {
                            const activeStagesList = stages.filter(s => !s.is_lost)
                            const cumulativeCounts: Record<string, number> = {}
                            let runningTotal = 0
                            for (let i = activeStagesList.length - 1; i >= 0; i--) {
                                runningTotal += (leadsPerStage[activeStagesList[i].id] || 0)
                                cumulativeCounts[activeStagesList[i].id] = runningTotal
                            }
                            if (activeStagesList.length > 0) {
                                cumulativeCounts[activeStagesList[0].id] = totalLeads
                            }

                            return stages.map((stage, index) => {
                                const isLost = stage.is_lost
                                const rawCount = leadsPerStage[stage.id] || 0
                                const count = isLost ? rawCount : (cumulativeCounts[stage.id] || 0)
                                const pct = totalLeads > 0 ? Math.round((count / totalLeads) * 100) : 0
                                
                                // Calculate conversion from previous stage (only for active stages > 0)
                                let dropoffText = ''
                                if (!isLost && index > 0) {
                                    const prevStage = activeStagesList[index - 1]
                                    const prevCount = prevStage ? cumulativeCounts[prevStage.id] : 0
                                    if (prevCount > 0 && count > 0 && prevCount !== count) {
                                        const conv = Math.round((count / prevCount) * 100)
                                        dropoffText = `${conv}% dal prec.`
                                    }
                                }

                                return (
                                    <div key={stage.id} className="flex items-center gap-3">
                                        <div className="w-28 text-xs font-medium truncate flex items-center gap-2" style={{ color: stage.color }}>
                                            <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: stage.color }} />
                                            {stage.name}
                                        </div>
                                        <div className="flex-1 h-7 rounded-lg overflow-hidden relative" style={{ background: 'var(--color-surface-200)' }}>
                                            <div
                                                className="h-full rounded-lg transition-all duration-700 flex items-center px-3 justify-between"
                                                style={{
                                                    width: `${Math.max(pct, count > 0 ? 8 : 0)}%`,
                                                    background: `linear-gradient(90deg, ${stage.color}40, ${stage.color}80)`,
                                                    minWidth: count > 0 ? '40px' : '0',
                                                }}
                                            >
                                                <span className="text-xs font-bold text-white whitespace-nowrap">{count}</span>
                                                {(dropoffText && pct > 20) && (
                                                    <span className="text-[9px] font-semibold opacity-70 whitespace-nowrap ml-2 hidden sm:inline-block">{dropoffText}</span>
                                                )}
                                            </div>
                                        </div>
                                        <div className="w-12 text-right text-xs font-semibold" style={{ color: 'var(--color-surface-500)' }}>{pct}%</div>
                                    </div>
                                )
                            })
                        })()}
                    </div>
                </div>
            )}

            {/* Pipeline Stage Flow */}
            {stages.length > 0 && (
                <div className="glass-card p-6">
                    <div className="flex items-center gap-2 mb-4">
                        <TrendingUp className="w-5 h-5" style={{ color: 'var(--color-sincro-400)' }} />
                        <h2 className="text-base font-bold text-white">Pipeline CRM → Meta CAPI</h2>
                    </div>
                    <p className="text-xs mb-4" style={{ color: 'var(--color-surface-500)' }}>
                        Ogni cambio di stage invia automaticamente l'evento a Meta per ottimizzare l'algoritmo
                    </p>
                    <div className="flex flex-wrap gap-2">
                        {stages.map((stage, i) => (
                            <div key={stage.id} className="flex items-center gap-2">
                                <div className="stage-pill" style={{ background: `${stage.color}15`, color: stage.color, border: `1px solid ${stage.color}30` }}>
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
                <h2 className="text-base font-bold text-white mb-3">Azioni rapide</h2>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    {[
                        { label: 'Gestisci Pipeline', desc: 'CRM setter/closer', icon: Users, href: '/dashboard/crm', color: '#3b82f6' },
                        { label: 'Vedi Analytics', desc: 'Performance', icon: BarChart3, href: '/dashboard/analytics', color: '#8b5cf6' },
                        { label: 'Connessioni', desc: 'Meta Ads / CAPI', icon: Plug, href: '/dashboard/connections', color: '#10b981' },
                        { label: 'Crea Funnel', desc: 'Landing page', icon: Target, href: '/dashboard/funnels', color: '#f59e0b' },
                    ].map((action) => (
                        <Link key={action.label} href={action.href}>
                            <div className="glass-card p-4 group cursor-pointer">
                                <div className="w-9 h-9 rounded-lg flex items-center justify-center mb-3" style={{ background: `${action.color}15`, border: `1px solid ${action.color}30` }}>
                                    <action.icon className="w-4 h-4" style={{ color: action.color }} />
                                </div>
                                <div className="text-sm font-semibold text-white mb-0.5">{action.label}</div>
                                <div className="text-xs" style={{ color: 'var(--color-surface-500)' }}>{action.desc}</div>
                            </div>
                        </Link>
                    ))}
                </div>
            </div>

            {/* Recent Activity Feed */}
            {recentActivities.length > 0 && (
                <div className="glass-card p-6">
                    <div className="flex items-center gap-2 mb-4">
                        <Clock className="w-5 h-5" style={{ color: '#f59e0b' }} />
                        <h2 className="text-base font-bold text-white">Attività Recenti</h2>
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full ml-1" style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b' }}>LIVE</span>
                    </div>
                    <div className="space-y-3">
                        {recentActivities.slice(0, 6).map((act: any) => {
                            const typeConfig: Record<string, { color: string; label: string }> = {
                                stage_changed: { color: '#3b82f6', label: 'Stage cambiato' },
                                capi_event_sent: { color: '#8b5cf6', label: 'CAPI inviato' },
                                note_added: { color: '#71717a', label: 'Nota aggiunta' },
                                assigned: { color: '#f59e0b', label: 'Lead assegnato' },
                                sale: { color: '#22c55e', label: 'Vendita!' },
                                lost: { color: '#ef4444', label: 'Perso' },
                            }
                            const cfg = typeConfig[act.activity_type] || { color: '#71717a', label: act.activity_type?.replace(/_/g, ' ') }
                            const timeAgo = getRelativeTime(act.created_at)

                            return (
                                <div key={act.id} className="flex items-center gap-3">
                                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: cfg.color }} />
                                    <div className="flex-1 min-w-0">
                                        <span className="text-xs font-medium" style={{ color: cfg.color }}>{cfg.label}</span>
                                        {act.notes && (
                                            <span className="text-xs ml-2" style={{ color: 'var(--color-surface-500)' }}>{act.notes}</span>
                                        )}
                                    </div>
                                    <span className="text-[10px] flex-shrink-0" style={{ color: 'var(--color-surface-500)' }}>{timeAgo}</span>
                                </div>
                            )
                        })}
                    </div>
                </div>
            )}

            {/* CAPI Info */}
            <div className="glass-card p-5 animate-pulse-glow">
                <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(99, 102, 241, 0.1)', border: '1px solid rgba(99, 102, 241, 0.2)' }}>
                        <Rocket className="w-5 h-5" style={{ color: 'var(--color-sincro-400)' }} />
                    </div>
                    <div>
                        <div className="text-sm font-bold text-white mb-1">Come funziona ADPILOTIK</div>
                        <div className="text-xs leading-relaxed" style={{ color: 'var(--color-surface-500)' }}>
                            1. Crei un <strong>funnel</strong> e condividi il link nelle ads → 2. I lead arrivano automaticamente nel <strong>CRM</strong> → 
                            3. Muovi i lead tra gli stage → 4. Meta riceve gli <strong>eventi CAPI</strong> e ottimizza per persone simili a chi compra
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
