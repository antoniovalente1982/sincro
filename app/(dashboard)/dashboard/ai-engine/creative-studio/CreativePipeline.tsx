'use client'

import { useState, useCallback } from 'react'
import {
    Zap, Loader2, CheckCircle, XCircle, Rocket, RefreshCw, Brain,
    Target, ArrowRight, Clock, Trash2, Eye, ChevronDown, Filter, Play, X,
    MessageSquare, ThumbsUp, ThumbsDown, Lightbulb, Send
} from 'lucide-react'

interface AdCreative {
    id: string
    name: string
    angle: string
    pocket_id: number | null
    pocket_name: string | null
    buyer_state: string | null
    core_question: string | null
    target_adset_name: string | null
    landing_utm_term: string | null
    image_url: string | null
    copy_primary: string | null
    copy_headline: string | null
    copy_description: string | null
    status: string
    meta_ad_id: string | null
    spend: number
    impressions: number
    clicks: number
    leads_count: number
    cpl: number | null
    ctr: number | null
    roas: number | null
    created_by: string
    created_at: string
    launched_at: string | null
    rejection_reason: string | null
    human_feedback: { text: string; type: string; created_at: string }[] | null
}

interface PipelineSummary {
    by_status: Record<string, number>
    by_angle: Record<string, Record<string, number>>
    total: number
}

interface Props {
    creatives: AdCreative[]
    summary: PipelineSummary
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: any }> = {
    draft: { label: 'Bozza', color: '#6366f1', bg: 'rgba(99, 102, 241, 0.1)', icon: Clock },
    ready: { label: 'Pronta', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.1)', icon: Zap },
    approved: { label: 'Approvata', color: '#22c55e', bg: 'rgba(34, 197, 94, 0.1)', icon: CheckCircle },
    launched: { label: 'Lanciata', color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.1)', icon: Rocket },
    active: { label: 'Attiva', color: '#10b981', bg: 'rgba(16, 185, 129, 0.1)', icon: Zap },
    paused: { label: 'In Pausa', color: '#eab308', bg: 'rgba(234, 179, 8, 0.1)', icon: Clock },
    killed: { label: 'Killata', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.1)', icon: XCircle },
    rejected: { label: 'Rifiutata', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.1)', icon: XCircle },
    archived: { label: 'Archiviata', color: '#6b7280', bg: 'rgba(107, 114, 128, 0.1)', icon: Trash2 },
}

const ANGLE_COLORS: Record<string, string> = {
    efficiency: '#22c55e', system: '#3b82f6', emotional: '#f59e0b', status: '#a855f7',
    growth: '#10b981', authority: '#6366f1', education: '#06b6d4', security: '#6b7280',
    trauma: '#ef4444', decision: '#ec4899',
}

export default function CreativePipeline({ creatives: initialCreatives, summary: initialSummary }: Props) {
    const [creatives, setCreatives] = useState(initialCreatives)
    const [summary, setSummary] = useState(initialSummary)
    const [filterStatus, setFilterStatus] = useState<string | null>(null)
    const [filterAngle, setFilterAngle] = useState<string | null>(null)
    const [loading, setLoading] = useState<Record<string, boolean>>({})
    const [runningPipeline, setRunningPipeline] = useState(false)
    const [syncing, setSyncing] = useState(false)
    const [expandedId, setExpandedId] = useState<string | null>(null)
    const [pipelineResult, setPipelineResult] = useState<any>(null)
    const [approveResult, setApproveResult] = useState<any>(null)
    const [pipelineStep, setPipelineStep] = useState(0) // 0 = not running
    const [rejectingId, setRejectingId] = useState<string | null>(null)
    const [rejectionReason, setRejectionReason] = useState('')
    const [feedbackId, setFeedbackId] = useState<string | null>(null)
    const [feedbackText, setFeedbackText] = useState('')
    const [feedbackType, setFeedbackType] = useState<'positive' | 'negative' | 'suggestion'>('suggestion')
    const [feedbackSubmitting, setFeedbackSubmitting] = useState(false)
    const [bulkDeleting, setBulkDeleting] = useState(false)

    const refresh = useCallback(async () => {
        const res = await fetch('/api/ai-engine', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'get_creative_pipeline_status' }),
        })
        const data = await res.json()
        if (data.creatives) {
            setCreatives(data.creatives)
            setSummary(data.summary)
        }
    }, [])

    const handleApprove = async (id: string, decision: 'approve' | 'reject', rejectionReasonText?: string) => {
        // If rejecting without a reason, open the modal first
        if (decision === 'reject' && !rejectionReasonText) {
            setRejectingId(id)
            setRejectionReason('')
            return
        }
        setLoading(prev => ({ ...prev, [id]: true }))
        setApproveResult(null)
        try {
            const payload: Record<string, any> = { action: 'approve_creative', creative_id: id, decision }
            if (decision === 'reject' && rejectionReasonText) {
                payload.rejection_reason = rejectionReasonText
            }
            const res = await fetch('/api/ai-engine', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            })
            const data = await res.json()
            if (data.error) throw new Error(data.error)

            if (decision === 'approve') {
                const launchRes = await fetch('/api/meta/create-campaign', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'launch_ad_creative', creative_id: id }),
                })
                const launchData = await launchRes.json()
                if (launchData.error) throw new Error(`Errore lancio Meta: ${launchData.error}`)
                setApproveResult({ success: true, message: '🚀 Ad lanciata con successo su Meta!' })
            } else {
                setApproveResult({ success: true, message: `❌ Ad rifiutata — il feedback migliorerà le prossime generazioni AI` })
            }
            
            await refresh()
        } catch (err: any) {
            setApproveResult({ error: err.message })
            await refresh()
        }
        setLoading(prev => ({ ...prev, [id]: false }))
        setTimeout(() => setApproveResult(null), 10000)
    }

    const submitRejection = () => {
        if (!rejectingId) return
        const reason = rejectionReason.trim()
        if (!reason) {
            alert('Scrivi il motivo del rifiuto per aiutare l\'AI a migliorare')
            return
        }
        setRejectingId(null)
        handleApprove(rejectingId, 'reject', reason)
    }

    const handleDelete = async (id: string, name: string) => {
        if (!confirm(`Eliminare definitivamente "${name}"?`)) return
        setLoading(prev => ({ ...prev, [id]: true }))
        try {
            const res = await fetch('/api/ai-engine', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'delete_creative', creative_id: id }),
            })
            const data = await res.json()
            if (data.error) setApproveResult({ error: data.error })
            else setApproveResult({ success: true, message: `🗑️ "${name}" eliminata` })
            await refresh()
        } catch (err: any) {
            setApproveResult({ error: err.message })
        }
        setLoading(prev => ({ ...prev, [id]: false }))
        setTimeout(() => setApproveResult(null), 5000)
    }

    const handleSubmitFeedback = async () => {
        if (!feedbackId || !feedbackText.trim()) {
            alert('Scrivi il tuo feedback per aiutare l\'AI a migliorare')
            return
        }
        setFeedbackSubmitting(true)
        try {
            const res = await fetch('/api/ai-engine', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'submit_feedback',
                    creative_id: feedbackId,
                    feedback_text: feedbackText.trim(),
                    feedback_type: feedbackType,
                }),
            })
            const data = await res.json()
            if (data.error) throw new Error(data.error)

            const typeEmoji = feedbackType === 'positive' ? '✅' : feedbackType === 'negative' ? '❌' : '💡'
            setApproveResult({ success: true, message: `${typeEmoji} Feedback salvato — l'AI ne terrà conto nelle prossime generazioni` })
            setFeedbackId(null)
            setFeedbackText('')
            setFeedbackType('suggestion')
            await refresh()
        } catch (err: any) {
            setApproveResult({ error: err.message })
        }
        setFeedbackSubmitting(false)
        setTimeout(() => setApproveResult(null), 8000)
    }

    // Bulk cleanup — delete all rejected/archived/draft ads
    const cleanableStatuses = ['rejected', 'archived', 'draft']
    const cleanableCount = creatives.filter(c => cleanableStatuses.includes(c.status)).length

    const handleBulkCleanup = async () => {
        if (!confirm(`Eliminare definitivamente ${cleanableCount} ads (rifiutate, archiviate, bozze)?\n\nQuesta azione è irreversibile.`)) return
        setBulkDeleting(true)
        try {
            const res = await fetch('/api/ai-engine', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'bulk_delete_creatives', statuses: cleanableStatuses }),
            })
            const data = await res.json()
            if (data.error) throw new Error(data.error)
            setApproveResult({ success: true, message: data.message || `🗑️ ${data.deleted_count} ads eliminate` })
            await refresh()
        } catch (err: any) {
            setApproveResult({ error: err.message })
        }
        setBulkDeleting(false)
        setTimeout(() => setApproveResult(null), 8000)
    }

    const PIPELINE_STEPS = [
        { label: 'Sincronizzazione ads attive', icon: '🔄', duration: 4000 },
        { label: 'Analisi performance', icon: '📊', duration: 3000 },
        { label: 'Estrazione pattern vincenti', icon: '🧠', duration: 4000 },
        { label: 'Generazione copy persuasivo', icon: '✍️', duration: 8000 },
        { label: 'Generazione immagine AI', icon: '🎨', duration: 10000 },
        { label: 'Salvataggio e finalizzazione', icon: '💾', duration: 2000 },
    ]

    const handleRunPipeline = async () => {
        setRunningPipeline(true)
        setPipelineResult(null)
        setPipelineStep(1)

        // Simulate step progression based on estimated timing
        const stepTimers: NodeJS.Timeout[] = []
        let elapsed = 0
        PIPELINE_STEPS.forEach((step, i) => {
            elapsed += step.duration
            if (i > 0) {
                stepTimers.push(setTimeout(() => setPipelineStep(i + 1), elapsed - step.duration))
            }
        })

        try {
            // STEP 1: Sync active ads with Meta
            await fetch('/api/meta/create-campaign', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'sync_creative_performance' }),
            })

            // STEP 2: Run pipeline
            const res = await fetch('/api/ai-engine', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'run_creative_pipeline' }),
            })
            const data = await res.json()
            stepTimers.forEach(t => clearTimeout(t))
            setPipelineStep(PIPELINE_STEPS.length) // All done
            setPipelineResult(data)
            await refresh()
        } catch (err: any) {
            stepTimers.forEach(t => clearTimeout(t))
            setPipelineResult({ error: err.message })
        }
        setTimeout(() => {
            setRunningPipeline(false)
            setPipelineStep(0)
        }, 1500)
        setTimeout(() => setPipelineResult(null), 20000)
    }

    const filtered = creatives.filter(c => {
        if (filterStatus && c.status !== filterStatus) return false
        if (filterAngle && c.angle !== filterAngle) return false
        return true
    })

    const allAngles = [...new Set(creatives.map(c => c.angle))]
    const allStatuses = [...new Set(creatives.map(c => c.status))]

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header */}
            <div className="flex items-start justify-between flex-wrap gap-4">
                <div>
                    <h2 className="text-xl font-bold text-white flex items-center gap-3">
                        <Zap className="w-6 h-6" style={{ color: '#f59e0b' }} />
                        Creative Pipeline
                    </h2>
                    <p className="text-sm mt-1" style={{ color: 'var(--color-surface-600)' }}>
                        Circuito chiuso: generazione → approvazione → lancio → performance
                    </p>
                </div>
                <div className="flex gap-2 flex-wrap">
                    {cleanableCount > 0 && (
                        <button onClick={handleBulkCleanup} disabled={bulkDeleting}
                            className="text-xs font-semibold px-3 py-2 rounded-xl flex items-center gap-1.5 transition-all hover:scale-105"
                            style={{
                                background: 'rgba(239, 68, 68, 0.08)',
                                border: '1px solid rgba(239, 68, 68, 0.25)',
                                color: '#ef4444',
                                opacity: bulkDeleting ? 0.6 : 1,
                            }}>
                            {bulkDeleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                            Pulisci ({cleanableCount})
                        </button>
                    )}
                    <button onClick={handleRunPipeline} disabled={runningPipeline}
                        className="btn-primary text-xs" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        {runningPipeline ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Brain className="w-3.5 h-3.5" />}
                        Run Pipeline
                    </button>
                </div>
            </div>

            {/* Pipeline Progress Tracker */}
            {runningPipeline && pipelineStep > 0 && (
                <div className="glass-card p-5" style={{
                    background: 'rgba(99, 102, 241, 0.05)',
                    border: '1px solid rgba(99, 102, 241, 0.2)',
                }}>
                    <div className="flex items-center gap-2 mb-4">
                        <Loader2 className="w-5 h-5 animate-spin" style={{ color: '#6366f1' }} />
                        <span className="text-sm font-bold text-white">Pipeline in esecuzione...</span>
                        <span className="text-xs ml-auto" style={{ color: 'var(--color-surface-500)' }}>
                            Step {pipelineStep}/{PIPELINE_STEPS.length}
                        </span>
                    </div>
                    {/* Progress bar */}
                    <div className="h-1.5 rounded-full mb-4" style={{ background: 'var(--color-surface-200)' }}>
                        <div className="h-full rounded-full transition-all duration-1000 ease-out" style={{
                            width: `${(pipelineStep / PIPELINE_STEPS.length) * 100}%`,
                            background: 'linear-gradient(90deg, #6366f1, #a855f7)',
                        }} />
                    </div>
                    {/* Steps */}
                    <div className="space-y-2">
                        {PIPELINE_STEPS.map((step, i) => {
                            const stepNum = i + 1
                            const isDone = pipelineStep > stepNum
                            const isCurrent = pipelineStep === stepNum
                            return (
                                <div key={i} className="flex items-center gap-3 transition-all" style={{
                                    opacity: stepNum > pipelineStep ? 0.3 : 1,
                                }}>
                                    <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs flex-shrink-0" style={{
                                        background: isDone ? 'rgba(34, 197, 94, 0.15)' : isCurrent ? 'rgba(99, 102, 241, 0.15)' : 'var(--color-surface-100)',
                                        border: `1px solid ${isDone ? 'rgba(34, 197, 94, 0.3)' : isCurrent ? 'rgba(99, 102, 241, 0.3)' : 'var(--color-surface-200)'}`,
                                    }}>
                                        {isDone ? (
                                            <CheckCircle className="w-3.5 h-3.5" style={{ color: '#22c55e' }} />
                                        ) : isCurrent ? (
                                            <Loader2 className="w-3.5 h-3.5 animate-spin" style={{ color: '#6366f1' }} />
                                        ) : (
                                            <span style={{ color: 'var(--color-surface-500)' }}>{step.icon}</span>
                                        )}
                                    </div>
                                    <span className="text-xs" style={{
                                        color: isDone ? '#22c55e' : isCurrent ? '#fff' : 'var(--color-surface-500)',
                                        fontWeight: isCurrent ? 600 : 400,
                                    }}>
                                        {step.label}{isCurrent && '...'}
                                    </span>
                                </div>
                            )
                        })}
                    </div>
                </div>
            )}

            {/* Pipeline Result Banner */}
            {pipelineResult && (
                <div className="glass-card p-4 relative" style={{
                    background: pipelineResult.error ? 'rgba(239, 68, 68, 0.1)' : 'rgba(34, 197, 94, 0.1)',
                    border: `1px solid ${pipelineResult.error ? 'rgba(239, 68, 68, 0.3)' : 'rgba(34, 197, 94, 0.3)'}`,
                }}>
                    <button onClick={() => setPipelineResult(null)} className="absolute top-2 right-2">
                        <X className="w-4 h-4" style={{ color: 'var(--color-surface-500)' }} />
                    </button>
                    {pipelineResult.error ? (
                        <div className="text-sm" style={{ color: '#ef4444' }}>❌ Errore: {pipelineResult.error}</div>
                    ) : (
                        <div>
                            <div className="text-sm font-bold text-white flex items-center gap-2">
                                <CheckCircle className="w-4 h-4" style={{ color: '#22c55e' }} />
                                Pipeline completato!
                            </div>
                            <div className="text-xs mt-1 space-y-0.5" style={{ color: 'var(--color-surface-500)' }}>
                                {pipelineResult.total_deficit !== undefined && (
                                    <div>📊 Deficit totale: {pipelineResult.total_deficit} ads mancanti</div>
                                )}
                                {pipelineResult.briefs_generated !== undefined && (
                                    <div>✨ Briefs generati: {Array.isArray(pipelineResult.briefs_generated) ? pipelineResult.briefs_generated.length : pipelineResult.briefs_generated}</div>
                                )}
                                {pipelineResult.angles_analyzed && (
                                    <div>🎯 Angoli analizzati: {Array.isArray(pipelineResult.angles_analyzed) ? pipelineResult.angles_analyzed.join(', ') : pipelineResult.angles_analyzed}</div>
                                )}
                                {pipelineResult.skipped_reasons?.length > 0 && (
                                    <div>⏭ Skipped: {pipelineResult.skipped_reasons.join(' | ')}</div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Approve Result Banner */}
            {approveResult && (
                <div className="glass-card p-4 relative" style={{
                    background: approveResult.success ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                    border: `1px solid ${approveResult.success ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                }}>
                    <button onClick={() => setApproveResult(null)} className="absolute top-2 right-2">
                        <X className="w-4 h-4" style={{ color: 'var(--color-surface-500)' }} />
                    </button>
                    <div className="text-sm" style={{ color: approveResult.success ? '#22c55e' : '#ef4444' }}
                        dangerouslySetInnerHTML={{ __html: approveResult.message || approveResult.error || 'Azione completata' }} />
                </div>
            )}

            {/* KPI Summary */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {[
                    { label: 'Totali', value: summary.total, color: '#6366f1' },
                    { label: 'Pronte', value: summary.by_status?.ready || 0, color: '#f59e0b' },
                    { label: 'Approvate', value: summary.by_status?.approved || 0, color: '#22c55e' },
                    { label: 'Attive', value: (summary.by_status?.active || 0) + (summary.by_status?.launched || 0), color: '#3b82f6' },
                    { label: 'Killate', value: summary.by_status?.killed || 0, color: '#ef4444' },
                ].map(stat => (
                    <div key={stat.label} className="kpi-card">
                        <div className="text-2xl font-bold text-white">{stat.value}</div>
                        <div className="text-xs mt-1" style={{ color: stat.color }}>{stat.label}</div>
                    </div>
                ))}
            </div>

            {/* Angle Distribution */}
            {Object.keys(summary.by_angle || {}).length > 0 && (
                <div className="glass-card p-4">
                    <div className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: 'var(--color-surface-500)' }}>
                        Distribuzione per Angolo
                    </div>
                    <div className="flex flex-wrap gap-3">
                        {Object.entries(summary.by_angle).map(([angle, statuses]) => {
                            const total = Object.values(statuses).reduce((s, v) => s + v, 0)
                            const active = (statuses.active || 0) + (statuses.launched || 0)
                            return (
                                <div key={angle} className="px-4 py-2 rounded-xl cursor-pointer transition-all hover:scale-105"
                                    onClick={() => setFilterAngle(filterAngle === angle ? null : angle)}
                                    style={{
                                        background: ANGLE_COLORS[angle] ? `${ANGLE_COLORS[angle]}15` : 'var(--color-surface-100)',
                                        border: `1px solid ${filterAngle === angle ? (ANGLE_COLORS[angle] || '#666') : 'transparent'}`,
                                    }}>
                                    <div className="text-xs font-bold" style={{ color: ANGLE_COLORS[angle] || '#fff' }}>
                                        {angle.toUpperCase()}
                                    </div>
                                    <div className="text-[10px] mt-0.5" style={{ color: 'var(--color-surface-500)' }}>
                                        {total} ads • {active} attive
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>
            )}

            {/* Filters */}
            <div className="flex items-center gap-2 flex-wrap">
                <Filter className="w-4 h-4" style={{ color: 'var(--color-surface-500)' }} />
                <button onClick={() => { setFilterStatus(null); setFilterAngle(null) }}
                    className="text-xs px-3 py-1 rounded-lg transition-all" style={{ 
                        background: !filterStatus && !filterAngle ? 'rgba(99, 102, 241, 0.15)' : 'var(--color-surface-100)',
                        color: !filterStatus && !filterAngle ? '#6366f1' : 'var(--color-surface-500)',
                        border: `1px solid ${!filterStatus && !filterAngle ? 'rgba(99, 102, 241, 0.3)' : 'var(--color-surface-200)'}`,
                    }}>Tutte ({summary.total})</button>
                {allStatuses.map(status => {
                    const cfg = STATUS_CONFIG[status] || { label: status, color: '#666', bg: '#66615' }
                    const count = creatives.filter(c => c.status === status).length
                    return (
                        <button key={status} onClick={() => setFilterStatus(filterStatus === status ? null : status)}
                            className="text-xs px-3 py-1 rounded-lg transition-all" style={{
                                background: filterStatus === status ? cfg.bg : 'var(--color-surface-100)',
                                color: filterStatus === status ? cfg.color : 'var(--color-surface-500)',
                                border: `1px solid ${filterStatus === status ? cfg.color + '40' : 'var(--color-surface-200)'}`,
                            }}>{cfg.label} ({count})</button>
                    )
                })}
            </div>

            {/* Creative Cards */}
            {filtered.length > 0 ? (
                <div className="space-y-3">
                    {filtered.map(creative => {
                        const statusCfg = STATUS_CONFIG[creative.status] || { label: creative.status, color: '#666', bg: '#66615', icon: Clock }
                        const StatusIcon = statusCfg.icon
                        const isExpanded = expandedId === creative.id
                        const isLoading = loading[creative.id]
                        const angleColor = ANGLE_COLORS[creative.angle] || '#6366f1'

                        return (
                            <div key={creative.id} className="glass-card overflow-hidden transition-all">
                                {/* Main Row */}
                                <div className="p-4 flex items-center gap-4 cursor-pointer" onClick={() => setExpandedId(isExpanded ? null : creative.id)}>
                                    {/* Status Indicator */}
                                    <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                                        style={{ background: statusCfg.bg, border: `1px solid ${statusCfg.color}30` }}>
                                        <StatusIcon className="w-4 h-4" style={{ color: statusCfg.color }} />
                                    </div>

                                    {/* Info */}
                                    <div className="flex-1 min-w-0">
                                        <div className="text-sm font-bold text-white truncate">{creative.name}</div>
                                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                                            <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold" style={{
                                                background: `${angleColor}15`, color: angleColor, border: `1px solid ${angleColor}30`,
                                            }}>{creative.angle}</span>
                                            {creative.pocket_name && (
                                                <span className="text-[10px]" style={{ color: 'var(--color-surface-500)' }}>
                                                    #{creative.pocket_id} {creative.pocket_name}
                                                </span>
                                            )}
                                            {creative.target_adset_name && (
                                                <span className="text-[10px]" style={{ color: 'var(--color-surface-600)' }}>
                                                    → {creative.target_adset_name}
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Performance (if launched) */}
                                    {(creative.status === 'active' || creative.status === 'launched' || creative.status === 'killed') && creative.spend > 0 && (
                                        <div className="hidden md:flex items-center gap-4 flex-shrink-0">
                                            <div className="text-right">
                                                <div className="text-xs font-bold text-white">€{creative.spend.toFixed(2)}</div>
                                                <div className="text-[10px]" style={{ color: 'var(--color-surface-500)' }}>Spend</div>
                                            </div>
                                            <div className="text-right">
                                                <div className="text-xs font-bold" style={{ color: creative.leads_count > 0 ? '#22c55e' : '#ef4444' }}>{creative.leads_count}</div>
                                                <div className="text-[10px]" style={{ color: 'var(--color-surface-500)' }}>Lead</div>
                                            </div>
                                            {creative.cpl && (
                                                <div className="text-right">
                                                    <div className="text-xs font-bold" style={{ color: creative.cpl < 20 ? '#22c55e' : '#ef4444' }}>€{creative.cpl.toFixed(2)}</div>
                                                    <div className="text-[10px]" style={{ color: 'var(--color-surface-500)' }}>CPL</div>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* Status Badge + Actions */}
                                    <div className="flex items-center gap-2 flex-shrink-0">
                                        <span className="text-[10px] px-2.5 py-1 rounded-full font-semibold" style={{
                                            background: statusCfg.bg, color: statusCfg.color, border: `1px solid ${statusCfg.color}30`,
                                        }}>{statusCfg.label}</span>

                                        {/* Quick Actions */}
                                        {(creative.status === 'ready' || creative.status === 'approved') && !isLoading && (
                                            <>
                                                <button onClick={(e) => {
                                                    e.stopPropagation();
                                                    const fullScript = `${creative.copy_headline || ''}\n\n${creative.copy_primary || ''}`;
                                                    window.location.href = `/dashboard/ai-engine/video-editor?autopilotText=${encodeURIComponent(fullScript)}`;
                                                }}
                                                    className="h-7 px-2.5 rounded-lg flex items-center justify-center gap-1 transition-all hover:scale-105"
                                                    style={{ background: 'rgba(168, 85, 247, 0.1)', border: '1px solid rgba(168, 85, 247, 0.3)' }}
                                                    title="Genera Video Cinematico (Autopilot)">
                                                    <Play className="w-3 h-3" style={{ color: '#a855f7' }} />
                                                    <span className="text-[10px] font-semibold" style={{ color: '#a855f7' }}>Video AI</span>
                                                </button>
                                                <button onClick={(e) => { e.stopPropagation(); handleApprove(creative.id, 'approve') }}
                                                    className="h-7 px-2.5 rounded-lg flex items-center justify-center gap-1 transition-all hover:scale-105"
                                                    style={{ background: 'rgba(34, 197, 94, 0.1)', border: '1px solid rgba(34, 197, 94, 0.3)' }}
                                                    title={creative.status === 'approved' ? "Ritenta lancio su Meta" : "Approva e Lancia su Meta"}>
                                                    <Rocket className="w-3 h-3" style={{ color: '#22c55e' }} />
                                                    <span className="text-[10px] font-semibold" style={{ color: '#22c55e' }}>Lancia</span>
                                                </button>
                                                {creative.status === 'ready' && (
                                                    <button onClick={(e) => { e.stopPropagation(); handleApprove(creative.id, 'reject') }}
                                                        className="w-7 h-7 rounded-lg flex items-center justify-center transition-all hover:scale-110"
                                                        style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)' }}
                                                        title="Rifiuta">
                                                        <XCircle className="w-3.5 h-3.5" style={{ color: '#ef4444' }} />
                                                    </button>
                                                )}
                                            </>
                                        )}

                                        {['rejected', 'archived', 'draft'].includes(creative.status) && !isLoading && (
                                            <button onClick={(e) => { e.stopPropagation(); handleDelete(creative.id, creative.name) }}
                                                className="w-7 h-7 rounded-lg flex items-center justify-center transition-all hover:scale-110"
                                                style={{ background: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.2)' }}
                                                title="Elimina definitivamente">
                                                <Trash2 className="w-3.5 h-3.5" style={{ color: '#ef4444' }} />
                                            </button>
                                        )}

                                        {/* Feedback Button — available on ALL ads */}
                                        {!isLoading && (
                                            <button onClick={(e) => {
                                                e.stopPropagation()
                                                setFeedbackId(creative.id)
                                                setFeedbackText('')
                                                setFeedbackType('suggestion')
                                            }}
                                                className="w-7 h-7 rounded-lg flex items-center justify-center transition-all hover:scale-110 relative"
                                                style={{ background: 'rgba(99, 102, 241, 0.08)', border: '1px solid rgba(99, 102, 241, 0.2)' }}
                                                title="Lascia feedback per l'AI">
                                                <MessageSquare className="w-3.5 h-3.5" style={{ color: '#6366f1' }} />
                                                {(creative.human_feedback?.length || 0) > 0 && (
                                                    <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full text-[8px] font-bold flex items-center justify-center"
                                                        style={{ background: '#6366f1', color: '#fff' }}>
                                                        {creative.human_feedback!.length}
                                                    </span>
                                                )}
                                            </button>
                                        )}
                                        {isLoading && <Loader2 className="w-4 h-4 animate-spin" style={{ color: '#6366f1' }} />}

                                        <ChevronDown className="w-4 h-4 transition-transform" style={{
                                            color: 'var(--color-surface-500)',
                                            transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                                        }} />
                                    </div>
                                </div>

                                {/* Expanded Details */}
                                {isExpanded && (
                                    <div className="px-4 pb-4 pt-0 space-y-3 border-t" style={{ borderColor: 'var(--color-surface-200)' }}>
                                        {/* Copy */}
                                        {creative.copy_headline && (
                                            <div className="mt-3">
                                                <div className="text-[10px] uppercase tracking-wider font-semibold mb-1" style={{ color: 'var(--color-surface-500)' }}>Copy</div>
                                                <div className="text-sm font-bold text-white mb-1">{creative.copy_headline}</div>
                                                <div className="text-xs leading-relaxed" style={{ color: 'var(--color-surface-600)' }}>
                                                    {creative.copy_primary?.substring(0, 300)}
                                                    {(creative.copy_primary?.length || 0) > 300 ? '...' : ''}
                                                </div>
                                            </div>
                                        )}

                                        {/* Pocket Info & Image */}
                                        <div className="flex flex-col md:flex-row gap-4">
                                            {creative.image_url && (
                                                <div className="flex-shrink-0">
                                                    <div className="text-[10px] uppercase tracking-wider font-semibold mb-1" style={{ color: 'var(--color-surface-500)' }}>Visual (Nano Banana 2)</div>
                                                    <a href={creative.image_url} target="_blank" rel="noreferrer">
                                                        <img src={creative.image_url} alt={creative.name} className="w-32 h-40 object-cover rounded-xl border transition-all hover:scale-105" style={{ borderColor: 'var(--color-surface-200)' }} />
                                                    </a>
                                                </div>
                                            )}
                                            
                                            {creative.pocket_name && (
                                                <div className="flex items-start gap-3 flex-wrap mt-5">
                                                    <div className="px-3 py-1.5 rounded-lg" style={{ background: 'var(--color-surface-100)', border: '1px solid var(--color-surface-200)' }}>
                                                        <div className="text-[10px] uppercase tracking-wider mb-0.5" style={{ color: 'var(--color-surface-500)' }}>Buyer Pocket</div>
                                                        <div className="text-xs font-semibold text-white">#{creative.pocket_id} {creative.pocket_name}</div>
                                                    </div>
                                                    <div className="px-3 py-1.5 rounded-lg" style={{ background: 'var(--color-surface-100)', border: '1px solid var(--color-surface-200)' }}>
                                                        <div className="text-[10px] uppercase tracking-wider mb-0.5" style={{ color: 'var(--color-surface-500)' }}>Buyer State</div>
                                                        <div className="text-xs font-semibold text-white">{creative.buyer_state}</div>
                                                    </div>
                                                    <div className="px-3 py-1.5 rounded-lg" style={{ background: 'var(--color-surface-100)', border: '1px solid var(--color-surface-200)' }}>
                                                        <div className="text-[10px] uppercase tracking-wider mb-0.5" style={{ color: 'var(--color-surface-500)' }}>Core Question</div>
                                                        <div className="text-xs font-semibold text-white">{creative.core_question}</div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        {/* Meta Info */}
                                        {creative.meta_ad_id && (
                                            <div className="flex items-center gap-2 text-[10px]" style={{ color: 'var(--color-surface-500)' }}>
                                                <span>Meta Ad ID: {creative.meta_ad_id}</span>
                                                {creative.launched_at && (
                                                    <span>• Lanciata: {new Date(creative.launched_at).toLocaleDateString('it-IT')}</span>
                                                )}
                                            </div>
                                        )}

                                        {/* Rejection Reason */}
                                        {creative.status === 'rejected' && creative.rejection_reason && (
                                            <div className="mt-2 p-3 rounded-xl" style={{
                                                background: 'rgba(239, 68, 68, 0.05)',
                                                border: '1px solid rgba(239, 68, 68, 0.15)',
                                            }}>
                                                <div className="text-[10px] uppercase tracking-wider font-semibold mb-1" style={{ color: '#ef4444' }}>📝 Motivo Rifiuto</div>
                                                <div className="text-xs" style={{ color: 'var(--color-surface-600)' }}>"{creative.rejection_reason}"</div>
                                                <div className="text-[10px] mt-1 italic" style={{ color: 'var(--color-surface-500)' }}>Questo feedback verrà usato per migliorare le prossime generazioni AI</div>
                                            </div>
                                        )}

                                        {/* Human Feedback Entries */}
                                        {creative.human_feedback && creative.human_feedback.length > 0 && (
                                            <div className="mt-2 space-y-2">
                                                <div className="text-[10px] uppercase tracking-wider font-semibold flex items-center gap-1.5" style={{ color: '#6366f1' }}>
                                                    <Brain className="w-3 h-3" />
                                                    Feedback AI Learning ({creative.human_feedback.length})
                                                </div>
                                                {creative.human_feedback.map((fb, idx) => {
                                                    const typeConfig = fb.type === 'positive'
                                                        ? { emoji: '✅', color: '#22c55e', bg: 'rgba(34, 197, 94, 0.05)', border: 'rgba(34, 197, 94, 0.15)', label: 'Positivo' }
                                                        : fb.type === 'negative'
                                                        ? { emoji: '❌', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.05)', border: 'rgba(239, 68, 68, 0.15)', label: 'Negativo' }
                                                        : { emoji: '💡', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.05)', border: 'rgba(245, 158, 11, 0.15)', label: 'Suggerimento' }
                                                    return (
                                                        <div key={idx} className="p-2.5 rounded-xl flex items-start gap-2" style={{
                                                            background: typeConfig.bg,
                                                            border: `1px solid ${typeConfig.border}`,
                                                        }}>
                                                            <span className="text-xs flex-shrink-0">{typeConfig.emoji}</span>
                                                            <div className="flex-1 min-w-0">
                                                                <div className="text-xs" style={{ color: 'var(--color-surface-600)' }}>"{fb.text}"</div>
                                                                <div className="text-[9px] mt-1 flex items-center gap-2" style={{ color: 'var(--color-surface-500)' }}>
                                                                    <span style={{ color: typeConfig.color }}>{typeConfig.label}</span>
                                                                    <span>•</span>
                                                                    <span>{new Date(fb.created_at).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                        )}

                                        {/* Performance (mobile) */}
                                        {creative.spend > 0 && (
                                            <div className="md:hidden grid grid-cols-4 gap-2">
                                                {[
                                                    { label: 'Spend', value: `€${creative.spend.toFixed(2)}` },
                                                    { label: 'Lead', value: creative.leads_count },
                                                    { label: 'CPL', value: creative.cpl ? `€${creative.cpl.toFixed(2)}` : '-' },
                                                    { label: 'CTR', value: creative.ctr ? `${creative.ctr.toFixed(2)}%` : '-' },
                                                ].map(m => (
                                                    <div key={m.label} className="p-2 rounded-lg text-center" style={{ background: 'var(--color-surface-100)' }}>
                                                        <div className="text-xs font-bold text-white">{m.value}</div>
                                                        <div className="text-[10px]" style={{ color: 'var(--color-surface-500)' }}>{m.label}</div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </div>
            ) : (
                <div className="glass-card p-12 text-center">
                    <div className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center" style={{
                        background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.2)',
                    }}>
                        <Zap className="w-8 h-8" style={{ color: '#f59e0b' }} />
                    </div>
                    <h2 className="text-lg font-bold text-white mb-2">
                        {filterStatus || filterAngle ? 'Nessun risultato per questi filtri' : 'Nessuna ad nel pipeline'}
                    </h2>
                    <p className="text-sm mb-6 max-w-md mx-auto" style={{ color: 'var(--color-surface-500)' }}>
                        {filterStatus || filterAngle
                            ? 'Prova a cambiare i filtri o avvia la pipeline per generare nuove ads.'
                            : 'Avvia il pipeline per analizzare il deficit ads e generare automaticamente nuove creative.'}
                    </p>
                    <button onClick={handleRunPipeline} disabled={runningPipeline} className="btn-primary">
                        {runningPipeline ? <Loader2 className="w-4 h-4 animate-spin" /> : <Brain className="w-4 h-4" />}
                        Avvia Creative Pipeline
                    </button>
                </div>
            )}

            {/* Rejection Reason Modal */}
            {rejectingId && (
                <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}
                    onClick={() => setRejectingId(null)}>
                    <div className="glass-card p-6 w-full max-w-lg mx-4 animate-fade-in" onClick={e => e.stopPropagation()}
                        style={{ background: 'var(--color-surface-50)', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                                style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                                <XCircle className="w-5 h-5" style={{ color: '#ef4444' }} />
                            </div>
                            <div>
                                <h3 className="text-base font-bold text-white">Rifiuta Ad Creative</h3>
                                <p className="text-xs" style={{ color: 'var(--color-surface-500)' }}>
                                    Il tuo feedback migliorerà automaticamente le prossime generazioni AI
                                </p>
                            </div>
                        </div>

                        <div className="mb-4">
                            <label className="text-xs font-semibold mb-2 block" style={{ color: 'var(--color-surface-400)' }}>
                                Perché rifiuti questa ad? *
                            </label>
                            <textarea
                                value={rejectionReason}
                                onChange={e => setRejectionReason(e.target.value)}
                                placeholder="Es: Copy troppo lungo, immagine sembra un bambino piccolo, headline debole, testo illeggibile sull'immagine..."
                                className="w-full p-3 rounded-xl text-sm text-white resize-none focus:outline-none focus:ring-2"
                                style={{
                                    background: 'var(--color-surface-100)',
                                    border: '1px solid var(--color-surface-200)',
                                    minHeight: '100px',
                                }}
                                autoFocus
                                onKeyDown={e => { if (e.key === 'Enter' && e.metaKey) submitRejection() }}
                            />
                            <div className="text-[10px] mt-1" style={{ color: 'var(--color-surface-500)' }}>
                                ⌘+Enter per confermare • Più sei specifico, meglio l'AI apprende
                            </div>
                        </div>

                        <div className="flex gap-2 justify-end">
                            <button onClick={() => setRejectingId(null)}
                                className="px-4 py-2 rounded-xl text-xs font-semibold transition-all"
                                style={{ background: 'var(--color-surface-100)', color: 'var(--color-surface-500)', border: '1px solid var(--color-surface-200)' }}>
                                Annulla
                            </button>
                            <button onClick={submitRejection}
                                className="px-4 py-2 rounded-xl text-xs font-semibold transition-all hover:scale-105"
                                style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
                                ❌ Rifiuta e Invia Feedback
                            </button>
                        </div>

                        <div className="mt-4 p-3 rounded-xl" style={{ background: 'rgba(99, 102, 241, 0.05)', border: '1px solid rgba(99, 102, 241, 0.1)' }}>
                            <div className="flex items-center gap-2 text-[10px]" style={{ color: '#6366f1' }}>
                                <Brain className="w-3 h-3" />
                                <span className="font-semibold">Come funziona il learning loop</span>
                            </div>
                            <div className="text-[10px] mt-1" style={{ color: 'var(--color-surface-500)' }}>
                                Il tuo feedback viene iniettato direttamente nel prompt di generazione AI.
                                Le prossime ads terranno conto dei tuoi rifiuti per NON ripetere gli stessi errori.
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Feedback Modal — for ANY ad */}
            {feedbackId && (
                <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}
                    onClick={() => setFeedbackId(null)}>
                    <div className="glass-card p-6 w-full max-w-lg mx-4 animate-fade-in" onClick={e => e.stopPropagation()}
                        style={{ background: 'var(--color-surface-50)', border: '1px solid rgba(99, 102, 241, 0.3)' }}>
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                                style={{ background: 'rgba(99, 102, 241, 0.1)', border: '1px solid rgba(99, 102, 241, 0.2)' }}>
                                <MessageSquare className="w-5 h-5" style={{ color: '#6366f1' }} />
                            </div>
                            <div>
                                <h3 className="text-base font-bold text-white">Feedback per l'AI Engine</h3>
                                <p className="text-xs" style={{ color: 'var(--color-surface-500)' }}>
                                    Il tuo feedback calibra automaticamente le prossime generazioni
                                </p>
                            </div>
                        </div>

                        {/* Feedback Type Selector */}
                        <div className="mb-4">
                            <label className="text-xs font-semibold mb-2 block" style={{ color: 'var(--color-surface-400)' }}>
                                Tipo di feedback
                            </label>
                            <div className="flex gap-2">
                                {[
                                    { type: 'positive' as const, label: 'Positivo', emoji: '✅', icon: ThumbsUp, color: '#22c55e', desc: 'Da replicare' },
                                    { type: 'negative' as const, label: 'Negativo', emoji: '❌', icon: ThumbsDown, color: '#ef4444', desc: 'Da evitare' },
                                    { type: 'suggestion' as const, label: 'Suggerimento', emoji: '💡', icon: Lightbulb, color: '#f59e0b', desc: 'Idea / nota' },
                                ].map(opt => (
                                    <button key={opt.type} onClick={() => setFeedbackType(opt.type)}
                                        className="flex-1 p-3 rounded-xl text-center transition-all hover:scale-[1.02]"
                                        style={{
                                            background: feedbackType === opt.type ? `${opt.color}15` : 'var(--color-surface-100)',
                                            border: `1.5px solid ${feedbackType === opt.type ? opt.color : 'var(--color-surface-200)'}`,
                                        }}>
                                        <opt.icon className="w-4 h-4 mx-auto mb-1" style={{ color: feedbackType === opt.type ? opt.color : 'var(--color-surface-500)' }} />
                                        <div className="text-xs font-semibold" style={{ color: feedbackType === opt.type ? opt.color : 'var(--color-surface-500)' }}>
                                            {opt.label}
                                        </div>
                                        <div className="text-[9px] mt-0.5" style={{ color: 'var(--color-surface-500)' }}>{opt.desc}</div>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Feedback Text */}
                        <div className="mb-4">
                            <label className="text-xs font-semibold mb-2 block" style={{ color: 'var(--color-surface-400)' }}>
                                {feedbackType === 'positive' ? 'Cosa ti piace di questa ad?' :
                                 feedbackType === 'negative' ? 'Cosa non funziona in questa ad?' :
                                 'Che suggerimento hai per le prossime ads?'} *
                            </label>
                            <textarea
                                value={feedbackText}
                                onChange={e => setFeedbackText(e.target.value)}
                                placeholder={feedbackType === 'positive'
                                    ? 'Es: Hook efficace, immagine potente, copy diretto e persuasivo...'
                                    : feedbackType === 'negative'
                                    ? 'Es: Immagine troppo generica, copy poco emotivo, headline debole...'
                                    : 'Es: Provare più copy brevi, usare più social proof, testare angolo trauma...'}
                                className="w-full p-3 rounded-xl text-sm text-white resize-none focus:outline-none focus:ring-2"
                                style={{
                                    background: 'var(--color-surface-100)',
                                    border: '1px solid var(--color-surface-200)',
                                    minHeight: '100px',
                                }}
                                autoFocus
                                onKeyDown={e => { if (e.key === 'Enter' && e.metaKey) handleSubmitFeedback() }}
                            />
                            <div className="text-[10px] mt-1" style={{ color: 'var(--color-surface-500)' }}>
                                ⌘+Enter per confermare • Più dettagli dai, meglio l'AI impara
                            </div>
                        </div>

                        <div className="flex gap-2 justify-end">
                            <button onClick={() => setFeedbackId(null)}
                                className="px-4 py-2 rounded-xl text-xs font-semibold transition-all"
                                style={{ background: 'var(--color-surface-100)', color: 'var(--color-surface-500)', border: '1px solid var(--color-surface-200)' }}>
                                Annulla
                            </button>
                            <button onClick={handleSubmitFeedback} disabled={feedbackSubmitting || !feedbackText.trim()}
                                className="px-4 py-2 rounded-xl text-xs font-semibold transition-all hover:scale-105 flex items-center gap-1.5"
                                style={{
                                    background: 'rgba(99, 102, 241, 0.15)',
                                    color: '#6366f1',
                                    border: '1px solid rgba(99, 102, 241, 0.3)',
                                    opacity: feedbackSubmitting || !feedbackText.trim() ? 0.5 : 1,
                                }}>
                                {feedbackSubmitting
                                    ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    : <Send className="w-3.5 h-3.5" />}
                                Invia Feedback
                            </button>
                        </div>

                        <div className="mt-4 p-3 rounded-xl" style={{ background: 'rgba(99, 102, 241, 0.05)', border: '1px solid rgba(99, 102, 241, 0.1)' }}>
                            <div className="flex items-center gap-2 text-[10px]" style={{ color: '#6366f1' }}>
                                <Brain className="w-3 h-3" />
                                <span className="font-semibold">Come funziona il learning loop</span>
                            </div>
                            <div className="text-[10px] mt-1 space-y-1" style={{ color: 'var(--color-surface-500)' }}>
                                <div>✅ <strong>Positivo</strong> → L'AI replicherà questi pattern nelle nuove ads</div>
                                <div>❌ <strong>Negativo</strong> → L'AI eviterà questi errori nelle generazioni future</div>
                                <div>💡 <strong>Suggerimento</strong> → L'AI considererà questa nota come direttiva creativa</div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
