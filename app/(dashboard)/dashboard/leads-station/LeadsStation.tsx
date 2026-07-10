'use client'

import { useState, useCallback, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { Settings, TrendingUp, Phone, Flame, Zap } from 'lucide-react'
import SpinMachine from './SpinMachine'
import LeadCard from './LeadCard'
import DailyProgressBar from './DailyProgressBar'
import PersonalKPIPanel from './PersonalKPIPanel'

interface Props {
    userId: string
    orgId: string
    userRole: string
    isAdmin: boolean
    initialStats: any
}

export default function LeadsStation({ userId, orgId, userRole, isAdmin, initialStats }: Props) {
    const [stats, setStats] = useState<any>(initialStats)
    const [isLoading, setIsLoading] = useState(false)
    const [spinState, setSpinState] = useState<'idle' | 'spinning' | 'done'>('idle')
    const [spinError, setSpinError] = useState<string | null>(null)
    const [requestMessage, setRequestMessage] = useState('')
    const [showKPI, setShowKPI] = useState(false)
    const supabase = createClient()

    const refreshStats = useCallback(async () => {
        const res = await fetch('/api/leads-pool/my-stats', { cache: 'no-store' })
        if (res.ok) {
            const data = await res.json()
            setStats(data)
        }
    }, [])

    // Realtime: aggiorna quota live
    useEffect(() => {
        const channel = supabase
            .channel(`lead-quota-${userId}`)
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'lead_daily_quota',
                filter: `user_id=eq.${userId}`,
            }, () => refreshStats())
            .subscribe()
        return () => { supabase.removeChannel(channel) }
    }, [userId])

    const handleSpin = async () => {
        if (spinState === 'spinning') return
        setSpinError(null)
        setSpinState('spinning')

        // Aspetta animazione (1.8s)
        await new Promise(r => setTimeout(r, 1800))

        try {
            const res = await fetch('/api/leads-pool/spin', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: requestMessage || null }),
            })
            const data = await res.json()

            if (!res.ok) {
                setSpinError(data.detail || data.error || 'Errore durante lo spin')
                setSpinState('idle')
                return
            }

            setRequestMessage('')
            await refreshStats()
            setSpinState('done')
            setTimeout(() => setSpinState('idle'), 500)
        } catch (err) {
            setSpinError('Errore di rete. Riprova.')
            setSpinState('idle')
        }
    }

    const handleFeedback = async (leadId: string, feedback: string, notes?: string) => {
        const sessionId = stats?.active_session?.id
        await fetch('/api/leads-pool/feedback', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                lead_pool_id: leadId,
                feedback,
                feedback_notes: notes || null,
                session_id: sessionId,
            }),
        })
        await refreshStats()
    }

    const today = stats?.today || {}
    const sessionLeads: any[] = stats?.session_leads || []
    const activeSession = stats?.active_session
    const rules = stats?.rules || {}

    const maxLeads = today.max_allowed || 50
    const requested = today.leads_requested || 0
    const remaining = today.remaining ?? (maxLeads - requested)
    const canSpin = remaining >= (rules.batch_size || 5)

    // Check se il feedback è sufficiente per il prossimo spin
    const totalInSession = activeSession?.total_leads || 0
    const feedbackInSession = activeSession?.leads_with_feedback || 0
    const feedbackPct = totalInSession > 0 ? Math.round((feedbackInSession / totalInSession) * 100) : 100
    const minFeedbackPct = rules.min_feedback_pct !== undefined ? rules.min_feedback_pct : 100
    const feedbackOk = !activeSession || feedbackPct >= minFeedbackPct

    // Testo blocco spin
    let spinBlockReason: string | null = null
    if (!canSpin) spinBlockReason = `Quota giornaliera raggiunta (${requested}/${maxLeads})`
    else if (!feedbackOk) spinBlockReason = `Aggiorna feedback: ${feedbackInSession}/${totalInSession} (${feedbackPct}% / min. ${minFeedbackPct}%)`

    return (
        <div style={{ minHeight: '100vh' }}>
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2" style={{ color: 'var(--color-surface-900)' }}>
                        <span style={{ fontSize: '1.6rem' }}>🎰</span>
                        Stazione Leads
                    </h1>
                    <p className="text-sm mt-0.5" style={{ color: 'var(--color-surface-500)' }}>
                        Richiedi leads da chiamare — auto-rifornimento controllato
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setShowKPI(!showKPI)}
                        className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all"
                        style={{
                            background: showKPI ? 'rgba(168,85,247,0.12)' : 'var(--color-surface-100)',
                            color: showKPI ? '#a855f7' : 'var(--color-surface-600)',
                            border: showKPI ? '1px solid rgba(168,85,247,0.3)' : '1px solid var(--color-surface-200)',
                        }}
                    >
                        <TrendingUp className="w-4 h-4" />
                        I miei KPI
                    </button>
                    {isAdmin && (
                        <Link
                            href="/dashboard/leads-station/admin"
                            className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all"
                            style={{
                                background: 'var(--color-surface-100)',
                                color: 'var(--color-surface-600)',
                                border: '1px solid var(--color-surface-200)',
                            }}
                        >
                            <Settings className="w-4 h-4" />
                            Gestione Pool
                        </Link>
                    )}
                </div>
            </div>

            {/* KPI Panel (collapsible) */}
            {showKPI && stats && (
                <PersonalKPIPanel stats={stats} />
            )}

            {/* Layout principale: spin a sx, leads a dx */}
            <div style={{ display: 'grid', gridTemplateColumns: '420px 1fr', gap: '24px', alignItems: 'start' }}>

                {/* ── COLONNA SX: Slot Machine + Progress ── */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

                    {/* Progress bar quota */}
                    <DailyProgressBar
                        requested={requested}
                        max={maxLeads}
                        called={today.leads_called || 0}
                        converted={today.leads_converted || 0}
                        spins={today.spins_count || 0}
                    />

                    {/* Slot Machine */}
                    <div
                        className="glass-card"
                        style={{
                            padding: '28px',
                            textAlign: 'center',
                            border: '1px solid var(--color-surface-200)',
                            borderRadius: '20px',
                            position: 'relative',
                            overflow: 'hidden',
                        }}
                    >
                        {/* Glow background */}
                        <div style={{
                            position: 'absolute', inset: 0,
                            background: spinState === 'spinning'
                                ? 'radial-gradient(ellipse at center, rgba(168,85,247,0.08) 0%, transparent 70%)'
                                : 'transparent',
                            transition: 'background 0.5s',
                            pointerEvents: 'none',
                        }} />

                        <SpinMachine state={spinState} batchSize={rules.batch_size || 5} />

                        {/* Error message */}
                        {spinError && (
                            <div style={{
                                marginTop: '12px',
                                padding: '10px 14px',
                                borderRadius: '10px',
                                background: 'rgba(239,68,68,0.1)',
                                border: '1px solid rgba(239,68,68,0.2)',
                                color: '#ef4444',
                                fontSize: '12px',
                                lineHeight: '1.5',
                                textAlign: 'left',
                            }}>
                                ⚠️ {spinError}
                            </div>
                        )}

                        {/* Block reason */}
                        {spinBlockReason && !spinError && (
                            <div style={{
                                marginTop: '12px',
                                padding: '10px 14px',
                                borderRadius: '10px',
                                background: 'rgba(245,158,11,0.1)',
                                border: '1px solid rgba(245,158,11,0.2)',
                                color: '#f59e0b',
                                fontSize: '12px',
                                textAlign: 'left',
                            }}>
                                🔒 {spinBlockReason}
                            </div>
                        )}

                        {/* Spin button */}
                        <button
                            onClick={handleSpin}
                            disabled={!canSpin || !feedbackOk || spinState === 'spinning'}
                            style={{
                                marginTop: '20px',
                                width: '100%',
                                padding: '14px 0',
                                borderRadius: '14px',
                                fontSize: '16px',
                                fontWeight: '700',
                                cursor: (!canSpin || !feedbackOk || spinState === 'spinning') ? 'not-allowed' : 'pointer',
                                opacity: (!canSpin || !feedbackOk) ? 0.5 : 1,
                                background: spinState === 'spinning'
                                    ? 'linear-gradient(135deg, #7c3aed 0%, #a855f7 100%)'
                                    : 'linear-gradient(135deg, #a855f7 0%, #7c3aed 100%)',
                                color: 'white',
                                border: 'none',
                                boxShadow: (!canSpin || !feedbackOk) ? 'none' : '0 4px 20px rgba(168,85,247,0.4)',
                                transition: 'all 0.2s',
                                letterSpacing: '0.05em',
                            }}
                        >
                            {spinState === 'spinning'
                                ? '✨ Estrazione in corso...'
                                : `🎰 SPIN — Ottieni ${rules.batch_size || 5} Leads`
                            }
                        </button>

                        {/* Stats sotto il bottone */}
                        <div style={{
                            display: 'flex', justifyContent: 'center', gap: '20px',
                            marginTop: '14px', fontSize: '11px', color: 'var(--color-surface-500)',
                        }}>
                            <span><Phone className="w-3 h-3 inline mr-1" />{today.leads_called || 0} chiamate oggi</span>
                            <span><Flame className="w-3 h-3 inline mr-1" />{stats?.kpi?.streak_days || 0} giorni streak</span>
                            <span><Zap className="w-3 h-3 inline mr-1" />{today.spins_count || 0} spin</span>
                        </div>
                    </div>

                    {/* Richiesta nuovo batch (se sessione attiva con feedback ok) */}
                    {activeSession && feedbackOk && canSpin && (
                        <div
                            className="glass-card"
                            style={{
                                padding: '16px',
                                borderRadius: '16px',
                                border: '1px solid var(--color-surface-200)',
                            }}
                        >
                            <p className="text-xs font-semibold mb-2" style={{ color: 'var(--color-surface-600)' }}>
                                ✍️ Messaggio (opzionale) per il prossimo spin
                            </p>
                            <textarea
                                value={requestMessage}
                                onChange={e => setRequestMessage(e.target.value)}
                                placeholder="Es. Ho chiamato tutti i 5 leads, sono pronto per altri..."
                                rows={2}
                                style={{
                                    width: '100%', resize: 'none',
                                    padding: '10px 12px', borderRadius: '10px',
                                    fontSize: '12px', lineHeight: '1.5',
                                    background: 'var(--color-surface-100)',
                                    border: '1px solid var(--color-surface-200)',
                                    color: 'var(--color-surface-900)',
                                    outline: 'none', fontFamily: 'inherit',
                                }}
                            />
                        </div>
                    )}
                </div>

                {/* ── COLONNA DX: Leads correnti ── */}
                <div>
                    {sessionLeads.length === 0 ? (
                        <div
                            className="glass-card"
                            style={{
                                padding: '48px 24px',
                                borderRadius: '20px',
                                textAlign: 'center',
                                border: '1px dashed var(--color-surface-300)',
                            }}
                        >
                            <div style={{ fontSize: '3rem', marginBottom: '12px' }}>🎯</div>
                            <h3 className="font-bold mb-2" style={{ color: 'var(--color-surface-700)' }}>
                                Nessun lead attivo
                            </h3>
                            <p className="text-sm" style={{ color: 'var(--color-surface-500)', maxWidth: '300px', margin: '0 auto' }}>
                                Premi <strong>SPIN</strong> per ricevere i tuoi prossimi leads da chiamare.
                            </p>
                        </div>
                    ) : (
                        <div>
                            <div className="flex items-center justify-between mb-3">
                                <h2 className="text-sm font-bold" style={{ color: 'var(--color-surface-700)' }}>
                                    📋 Leads da chiamare — sessione corrente
                                </h2>
                                {activeSession && (
                                    <span className="text-xs px-2 py-1 rounded-full font-medium" style={{
                                        background: 'rgba(34,197,94,0.1)',
                                        color: '#22c55e',
                                        border: '1px solid rgba(34,197,94,0.2)',
                                    }}>
                                        {feedbackInSession}/{totalInSession} aggiornati
                                    </span>
                                )}
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                {sessionLeads.map((lead: any) => (
                                    <LeadCard
                                        key={lead.id}
                                        lead={lead}
                                        sessionId={activeSession?.id}
                                        onFeedback={handleFeedback}
                                    />
                                ))}
                            </div>

                            {/* Feedback progress nel blocco leads */}
                            {activeSession && feedbackPct < minFeedbackPct && (
                                <div style={{
                                    marginTop: '16px',
                                    padding: '12px 16px',
                                    borderRadius: '12px',
                                    background: 'rgba(245,158,11,0.08)',
                                    border: '1px solid rgba(245,158,11,0.2)',
                                    display: 'flex', alignItems: 'center', gap: '10px',
                                }}>
                                    <span style={{ fontSize: '1.2rem' }}>⚠️</span>
                                    <div>
                                        <p className="text-xs font-semibold" style={{ color: '#f59e0b' }}>
                                            Aggiorna il feedback per sbloccare il prossimo spin
                                        </p>
                                        <p className="text-xs mt-0.5" style={{ color: 'var(--color-surface-500)' }}>
                                            {feedbackInSession}/{totalInSession} leads aggiornati ({feedbackPct}% — minimo {minFeedbackPct}%)
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
