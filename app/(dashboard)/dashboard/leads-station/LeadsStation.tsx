'use client'

import { useState, useCallback, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { Settings, TrendingUp, Phone, Flame, Zap } from 'lucide-react'
import SpinMachine from './SpinMachine'
import LeadCard from './LeadCard'
import DailyProgressBar from './DailyProgressBar'
import PersonalKPIPanel from './PersonalKPIPanel'
import OperatingProcedure from './OperatingProcedure'

interface Props {
    userId: string
    orgId: string
    userRole: string
    isAdmin: boolean
    initialStats: any
}

export default function LeadsStation({ userId, orgId, userRole, isAdmin, initialStats }: Props) {
    const [activeTab, setActiveTab] = useState<'session' | 'callbacks' | 'interested'>('session')
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

    // Carica le statistiche fresche al montaggio
    useEffect(() => {
        refreshStats()
    }, [refreshStats])

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
    }, [userId, refreshStats])

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
            setActiveTab('session') // Ritorna al tab sessione dopo uno spin con nuovi lead
            setSpinState('done')
            setTimeout(() => setSpinState('idle'), 500)
        } catch (err) {
            setSpinError('Errore di rete. Riprova.')
            setSpinState('idle')
        }
    }

    const WIN = ['appointment', 'converted']

    const handleFeedback = async (leadId: string, feedback: string, extra?: { notes?: string; callback_at?: string; appointment_at?: string }) => {
        const notes = extra?.notes
        const isInList = (list: string) => stats?.[list]?.some((l: any) => l.id === leadId)
        const inSession = isInList('session_leads')
        const sessionId = inSession ? stats?.active_session?.id : null

        // ── AGGIORNAMENTO OTTIMISTICO LOCALE (istantaneo) ──
        setStats((prev: any) => {
            if (!prev) return prev
            const isWin = WIN.includes(feedback)

            const patchLead = (l: any) => ({
                ...l,
                feedback,
                feedback_notes: notes || l.feedback_notes,
                status: isWin ? 'converted' : 'called',
                callback_at: feedback === 'callback' ? extra?.callback_at : l.callback_at,
                appointment_at: feedback === 'appointment' ? extra?.appointment_at : l.appointment_at,
                call_count: l.call_count + (l.feedback ? 0 : 1),
            })

            const updatedSessionLeads = (prev.session_leads || []).map((l: any) => l.id === leadId ? patchLead(l) : l)

            const originalLead = (prev.session_leads || []).find((l: any) => l.id === leadId)
            let leadsCalled = prev.active_session?.leads_called || 0
            let leadsWithFeedback = prev.active_session?.leads_with_feedback || 0
            if (originalLead && !originalLead.feedback) { leadsCalled += 1; leadsWithFeedback += 1 }

            // Code laterali: rimuovi se risolto, altrimenti aggiorna
            const resolvedFromCallback = !['callback', 'no_answer'].includes(feedback)
            const updatedCallbackLeads = (prev.callback_leads || [])
                .filter((l: any) => !(l.id === leadId && resolvedFromCallback))
                .map((l: any) => l.id === leadId ? patchLead(l) : l)

            const updatedInterestedLeads = (prev.interested_leads || [])
                .filter((l: any) => !(l.id === leadId && feedback !== 'interested'))
                .map((l: any) => l.id === leadId ? patchLead(l) : l)

            // Quota di oggi
            let todayCalled = prev.today?.leads_called || 0
            let todayConverted = prev.today?.leads_converted || 0
            const wasWin = originalLead && WIN.includes(originalLead.feedback)
            if (originalLead && !originalLead.feedback) todayCalled += 1
            if (isWin && !wasWin) todayConverted += 1

            return {
                ...prev,
                session_leads: updatedSessionLeads,
                callback_leads: updatedCallbackLeads,
                interested_leads: updatedInterestedLeads,
                active_session: prev.active_session ? {
                    ...prev.active_session,
                    leads_called: leadsCalled,
                    leads_with_feedback: leadsWithFeedback,
                } : null,
                today: prev.today ? {
                    ...prev.today,
                    leads_called: todayCalled,
                    leads_converted: todayConverted,
                } : prev.today,
            }
        })

        // ── CHIAMATA API IN BACKGROUND ──
        fetch('/api/leads-pool/feedback', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                lead_pool_id: leadId,
                feedback,
                feedback_notes: notes || null,
                session_id: sessionId,
                callback_at: extra?.callback_at || null,
                appointment_at: extra?.appointment_at || null,
            }),
        })
        .then(() => refreshStats())
        .catch(err => console.error('[Feedback background error]:', err))
    }

    const today = stats?.today || {}
    const sessionLeads: any[] = stats?.session_leads || []
    const callbackLeads: any[] = stats?.callback_leads || []
    const interestedLeads: any[] = stats?.interested_leads || []
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

            {/* Layout principale: spin a sx, leads a dx (responsive su mobile) */}
            <div className="station-grid">

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

                    {/* Guida procedurale "Come funziona?" — sorgente unica in OperatingProcedure */}
                    <OperatingProcedure batchSize={rules.batch_size || 5} minFeedbackPct={minFeedbackPct} />
                </div>

                {/* ── COLONNA DX: Leads correnti o Richiami ── */}
                <div>
                    {/* Tab Selector */}
                    <div style={{
                        display: 'flex', gap: '8px', padding: '4px',
                        background: 'var(--color-surface-100)',
                        borderRadius: '12px', marginBottom: '16px',
                        width: 'fit-content',
                    }}>
                        <button
                            onClick={() => setActiveTab('session')}
                            style={{
                                padding: '8px 16px', borderRadius: '9px',
                                fontSize: '13px', fontWeight: '600',
                                border: 'none', cursor: 'pointer',
                                background: activeTab === 'session' ? 'var(--color-surface-0)' : 'transparent',
                                color: activeTab === 'session' ? 'var(--color-surface-900)' : 'var(--color-surface-500)',
                                boxShadow: activeTab === 'session' ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
                                transition: 'all 0.15s',
                            }}
                        >
                            📋 Sessione Corrente ({sessionLeads.length})
                        </button>
                        <button
                            onClick={() => setActiveTab('callbacks')}
                            style={{
                                padding: '8px 16px', borderRadius: '9px',
                                fontSize: '13px', fontWeight: '600',
                                border: 'none', cursor: 'pointer',
                                background: activeTab === 'callbacks' ? 'var(--color-surface-0)' : 'transparent',
                                color: activeTab === 'callbacks' ? 'var(--color-surface-900)' : 'var(--color-surface-500)',
                                boxShadow: activeTab === 'callbacks' ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
                                transition: 'all 0.15s',
                            }}
                        >
                            🔄 Da richiamare ({callbackLeads.length})
                        </button>
                        <button
                            onClick={() => setActiveTab('interested')}
                            style={{
                                padding: '8px 16px', borderRadius: '9px',
                                fontSize: '13px', fontWeight: '600',
                                border: 'none', cursor: 'pointer',
                                background: activeTab === 'interested' ? 'var(--color-surface-0)' : 'transparent',
                                color: activeTab === 'interested' ? 'var(--color-surface-900)' : 'var(--color-surface-500)',
                                boxShadow: activeTab === 'interested' ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
                                transition: 'all 0.15s',
                            }}
                        >
                            ⭐ Interessati ({interestedLeads.length})
                        </button>
                    </div>

                    {activeTab === 'session' ? (
                        sessionLeads.length === 0 ? (
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
                        )
                    ) : activeTab === 'callbacks' ? (
                        callbackLeads.length === 0 ? (
                            <div
                                className="glass-card"
                                style={{
                                    padding: '48px 24px',
                                    borderRadius: '20px',
                                    textAlign: 'center',
                                    border: '1px dashed var(--color-surface-300)',
                                }}
                            >
                                <div style={{ fontSize: '3rem', marginBottom: '12px' }}>🎉</div>
                                <h3 className="font-bold mb-2" style={{ color: 'var(--color-surface-700)' }}>
                                    Nessun richiamo in agenda
                                </h3>
                                <p className="text-sm" style={{ color: 'var(--color-surface-500)', maxWidth: '300px', margin: '0 auto' }}>
                                    Ottimo lavoro! Tutti i contatti passati sono stati lavorati o chiusi.
                                </p>
                            </div>
                        ) : (
                            <div>
                                <h2 className="text-sm font-bold mb-3" style={{ color: 'var(--color-surface-700)' }}>
                                    🔄 Contatti da richiamare o senza risposta
                                </h2>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                    {callbackLeads.map((lead: any) => (
                                        <LeadCard
                                            key={lead.id}
                                            lead={lead}
                                            onFeedback={handleFeedback}
                                        />
                                    ))}
                                </div>
                            </div>
                        )
                    ) : (
                        interestedLeads.length === 0 ? (
                            <div
                                className="glass-card"
                                style={{
                                    padding: '48px 24px',
                                    borderRadius: '20px',
                                    textAlign: 'center',
                                    border: '1px dashed var(--color-surface-300)',
                                }}
                            >
                                <div style={{ fontSize: '3rem', marginBottom: '12px' }}>⭐</div>
                                <h3 className="font-bold mb-2" style={{ color: 'var(--color-surface-700)' }}>
                                    Nessun interessato in coda
                                </h3>
                                <p className="text-sm" style={{ color: 'var(--color-surface-500)', maxWidth: '300px', margin: '0 auto' }}>
                                    I contatti segnati come <strong>Interessato</strong> compaiono qui per il follow-up:
                                    è qui che trasformi l'interesse in appuntamento.
                                </p>
                            </div>
                        ) : (
                            <div>
                                <h2 className="text-sm font-bold mb-3" style={{ color: 'var(--color-surface-700)' }}>
                                    ⭐ Interessati — da trasformare in appuntamento
                                </h2>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                    {interestedLeads.map((lead: any) => (
                                        <LeadCard
                                            key={lead.id}
                                            lead={lead}
                                            onFeedback={handleFeedback}
                                        />
                                    ))}
                                </div>
                            </div>
                        )
                    )}
                </div>
            </div>
        </div>
    )
}
