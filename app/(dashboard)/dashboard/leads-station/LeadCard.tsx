'use client'

import { useState } from 'react'
import { Phone, MessageSquare, Clock, Calendar } from 'lucide-react'

interface LeadPoolEntry {
    id: string
    full_name?: string | null
    first_name?: string | null
    last_name?: string | null
    phone?: string | null
    email?: string | null
    city?: string | null
    province?: string | null
    feedback?: string | null
    status: string
    call_count: number
    assigned_at?: string | null
    callback_at?: string | null
    appointment_at?: string | null
}

export interface FeedbackExtra {
    notes?: string
    callback_at?: string
    appointment_at?: string
}

interface Props {
    lead: LeadPoolEntry
    sessionId?: string
    onFeedback: (leadId: string, feedback: string, extra?: FeedbackExtra) => Promise<void> | void
    /** Registra il tentativo di chiamata (click-to-call). Opzionale. */
    onCall?: (leadId: string, phone: string) => void
}

type FeedbackType = 'appointment' | 'interested' | 'callback' | 'no_answer' | 'not_interested' | 'wrong_number' | 'converted'

const FEEDBACK_CONFIG: Record<FeedbackType, { label: string; emoji: string; color: string; bg: string }> = {
    appointment:    { label: 'Appuntamento',   emoji: '📅', color: '#22c55e', bg: 'rgba(34,197,94,0.1)' },
    interested:     { label: 'Interessato',    emoji: '⭐', color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
    callback:       { label: 'Richiama',       emoji: '🔄', color: '#3b82f6', bg: 'rgba(59,130,246,0.1)' },
    no_answer:      { label: 'Non risponde',   emoji: '📵', color: '#6b7280', bg: 'rgba(107,114,128,0.1)' },
    not_interested: { label: 'Non interessato',emoji: '❌', color: '#ef4444', bg: 'rgba(239,68,68,0.1)' },
    wrong_number:   { label: 'Numero errato',  emoji: '⚠️', color: '#f97316', bg: 'rgba(249,115,22,0.1)' },
    converted:      { label: 'Convertito',     emoji: '💎', color: '#22c55e', bg: 'rgba(34,197,94,0.1)' },
}

// Bottoni mostrati (in ordine). 'converted' resta solo per lo storico.
const BUTTONS: FeedbackType[] = ['appointment', 'interested', 'callback', 'no_answer', 'not_interested', 'wrong_number']

function getDisplayName(lead: LeadPoolEntry): string {
    if (lead.full_name) return lead.full_name
    const parts = [lead.first_name, lead.last_name].filter(Boolean)
    return parts.length > 0 ? parts.join(' ') : 'Lead sconosciuto'
}

function formatAssignedTime(assignedAt: string | null | undefined): string {
    if (!assignedAt) return ''
    const diff = Date.now() - new Date(assignedAt).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return 'adesso'
    if (mins < 60) return `${mins} min fa`
    const hours = Math.floor(mins / 60)
    return `${hours}h fa`
}

// datetime-local value (YYYY-MM-DDTHH:mm) in ora locale del browser
function toLocalInputValue(d: Date): string {
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export default function LeadCard({ lead, onFeedback, onCall }: Props) {
    const [isLoading, setIsLoading] = useState(false)
    const [showNotes, setShowNotes] = useState(false)
    const [notes, setNotes] = useState('')
    const [expanded, setExpanded] = useState(false)
    // Quando si sta programmando un appuntamento o un richiamo
    const [scheduling, setScheduling] = useState<null | 'appointment' | 'callback'>(null)
    const [scheduleAt, setScheduleAt] = useState('')

    const currentFeedback = lead.feedback as FeedbackType | null
    const feedbackInfo = currentFeedback ? FEEDBACK_CONFIG[currentFeedback] : null

    const submit = async (type: FeedbackType, extra?: FeedbackExtra) => {
        if (isLoading) return
        setIsLoading(true)
        try {
            await onFeedback(lead.id, type, { notes: notes || undefined, ...extra })
            setShowNotes(false)
            setScheduling(null)
            setScheduleAt('')
        } finally {
            setIsLoading(false)
        }
    }

    const handleButton = (type: FeedbackType) => {
        if (currentFeedback === type && type !== 'callback' && type !== 'appointment') return
        if (type === 'appointment' || type === 'callback') {
            // Apri il selettore data/ora con un default sensato
            const def = new Date()
            if (type === 'appointment') { def.setDate(def.getDate() + 1); def.setHours(10, 0, 0, 0) }
            else { def.setHours(def.getHours() + 2, 0, 0, 0) }
            setScheduleAt(toLocalInputValue(def))
            setScheduling(type)
            return
        }
        submit(type)
    }

    const confirmSchedule = () => {
        if (!scheduling || !scheduleAt) return
        const iso = new Date(scheduleAt).toISOString()
        if (scheduling === 'appointment') submit('appointment', { appointment_at: iso })
        else submit('callback', { callback_at: iso })
    }

    return (
        <div style={{
            borderRadius: '14px',
            border: `1px solid ${feedbackInfo ? feedbackInfo.color + '40' : 'var(--color-surface-200)'}`,
            background: feedbackInfo ? feedbackInfo.bg : 'var(--color-surface-50)',
            overflow: 'hidden',
            transition: 'all 0.2s',
        }}>
            {/* Main row */}
            <div
                style={{
                    padding: '14px 16px',
                    display: 'grid',
                    gridTemplateColumns: '1fr auto',
                    gap: '12px',
                    alignItems: 'center',
                    cursor: 'pointer',
                }}
                onClick={() => setExpanded(!expanded)}
            >
                {/* Left: info lead */}
                <div style={{ minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <span style={{
                            fontWeight: 600, fontSize: '14px',
                            color: 'var(--color-surface-900)',
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>
                            {getDisplayName(lead)}
                        </span>
                        {feedbackInfo && (
                            <span style={{
                                fontSize: '11px', fontWeight: 600,
                                padding: '2px 8px', borderRadius: '999px',
                                background: feedbackInfo.bg,
                                color: feedbackInfo.color,
                                border: `1px solid ${feedbackInfo.color}40`,
                                whiteSpace: 'nowrap',
                            }}>
                                {feedbackInfo.emoji} {feedbackInfo.label}
                            </span>
                        )}
                        {lead.call_count > 0 && (
                            <span style={{ fontSize: '10px', color: 'var(--color-surface-500)' }}>
                                {lead.call_count}× chiamato
                            </span>
                        )}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '4px', flexWrap: 'wrap' }}>
                        {lead.phone && (
                            <a
                                href={`tel:${lead.phone}`}
                                onClick={e => { e.stopPropagation(); if (onCall && lead.phone) onCall(lead.id, lead.phone) }}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: '4px',
                                    fontSize: '13px', fontWeight: 600,
                                    color: '#3b82f6', textDecoration: 'none',
                                    padding: '2px 6px', borderRadius: '6px',
                                    background: 'rgba(59,130,246,0.1)',
                                }}
                            >
                                <Phone className="w-3 h-3" />
                                {lead.phone}
                            </a>
                        )}
                        {lead.city && (
                            <span style={{ fontSize: '12px', color: 'var(--color-surface-500)' }}>
                                📍 {lead.city}{lead.province ? ` (${lead.province})` : ''}
                            </span>
                        )}
                        {lead.callback_at && (
                            <span style={{ fontSize: '11px', color: '#3b82f6', display: 'flex', alignItems: 'center', gap: '3px' }}>
                                <Clock className="w-3 h-3" />
                                richiamo {new Date(lead.callback_at).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                            </span>
                        )}
                        {lead.appointment_at && (
                            <span style={{ fontSize: '11px', color: '#22c55e', display: 'flex', alignItems: 'center', gap: '3px' }}>
                                <Calendar className="w-3 h-3" />
                                app. {new Date(lead.appointment_at).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                            </span>
                        )}
                        {lead.assigned_at && !lead.callback_at && (
                            <span style={{ fontSize: '10px', color: 'var(--color-surface-400)', display: 'flex', alignItems: 'center', gap: '3px' }}>
                                <Clock className="w-3 h-3" />
                                {formatAssignedTime(lead.assigned_at)}
                            </span>
                        )}
                    </div>
                </div>

                <div style={{ color: 'var(--color-surface-400)', flexShrink: 0, fontSize: '12px' }}>
                    {expanded ? '▲' : '▼'}
                </div>
            </div>

            {/* Expanded: feedback buttons */}
            {expanded && (
                <div style={{
                    padding: '0 16px 14px',
                    borderTop: '1px solid var(--color-surface-200)',
                    paddingTop: '12px',
                }}>
                    {lead.email && (
                        <div style={{ fontSize: '12px', color: 'var(--color-surface-500)', marginBottom: '10px' }}>
                            📧 {lead.email}
                        </div>
                    )}

                    <p style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-surface-500)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                        Aggiorna esito chiamata:
                    </p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                        {BUTTONS.map((key) => {
                            const config = FEEDBACK_CONFIG[key]
                            const active = currentFeedback === key
                            return (
                                <button
                                    key={key}
                                    onClick={() => handleButton(key)}
                                    disabled={isLoading}
                                    style={{
                                        padding: '6px 12px',
                                        borderRadius: '8px',
                                        fontSize: '12px',
                                        fontWeight: 500,
                                        cursor: isLoading ? 'not-allowed' : 'pointer',
                                        border: `1px solid ${active ? config.color : config.color + '40'}`,
                                        background: active ? config.bg : 'transparent',
                                        color: active ? config.color : 'var(--color-surface-600)',
                                        transition: 'all 0.15s',
                                        outline: active ? `2px solid ${config.color}60` : 'none',
                                    }}
                                >
                                    {config.emoji} {config.label}
                                </button>
                            )
                        })}
                    </div>

                    {/* Selettore data/ora per appuntamento o richiamo */}
                    {scheduling && (
                        <div style={{
                            marginTop: '10px',
                            padding: '10px 12px',
                            borderRadius: '10px',
                            background: scheduling === 'appointment' ? 'rgba(34,197,94,0.06)' : 'rgba(59,130,246,0.06)',
                            border: `1px solid ${scheduling === 'appointment' ? 'rgba(34,197,94,0.25)' : 'rgba(59,130,246,0.25)'}`,
                        }}>
                            <p style={{ fontSize: '11px', fontWeight: 600, marginBottom: '6px', color: 'var(--color-surface-700)' }}>
                                {scheduling === 'appointment' ? '📅 Data e ora dell\'appuntamento' : '🔄 Quando richiamare'}
                            </p>
                            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                <input
                                    type="datetime-local"
                                    value={scheduleAt}
                                    onChange={e => setScheduleAt(e.target.value)}
                                    style={{
                                        flex: 1, minWidth: '180px',
                                        padding: '8px 10px', borderRadius: '8px',
                                        fontSize: '12px',
                                        background: 'var(--color-surface-100)',
                                        border: '1px solid var(--color-surface-300)',
                                        color: 'var(--color-surface-900)', outline: 'none',
                                    }}
                                />
                                <button
                                    onClick={confirmSchedule}
                                    disabled={isLoading || !scheduleAt}
                                    style={{
                                        padding: '8px 14px', borderRadius: '8px',
                                        fontSize: '12px', fontWeight: 600, cursor: 'pointer',
                                        border: 'none', color: 'white',
                                        background: scheduling === 'appointment' ? '#22c55e' : '#3b82f6',
                                    }}
                                >
                                    Conferma
                                </button>
                                <button
                                    onClick={() => { setScheduling(null); setScheduleAt('') }}
                                    style={{
                                        padding: '8px 12px', borderRadius: '8px',
                                        fontSize: '12px', cursor: 'pointer',
                                        border: '1px solid var(--color-surface-300)',
                                        background: 'transparent', color: 'var(--color-surface-500)',
                                    }}
                                >
                                    Annulla
                                </button>
                            </div>
                        </div>
                    )}

                    <button
                        onClick={() => setShowNotes(!showNotes)}
                        style={{
                            marginTop: '8px',
                            fontSize: '11px', color: 'var(--color-surface-500)',
                            background: 'none', border: 'none', cursor: 'pointer',
                            display: 'flex', alignItems: 'center', gap: '4px', padding: '2px 0',
                        }}
                    >
                        <MessageSquare className="w-3 h-3" />
                        {showNotes ? 'Nascondi note' : 'Aggiungi nota'}
                    </button>

                    {showNotes && (
                        <div style={{ marginTop: '8px' }}>
                            <textarea
                                value={notes}
                                onChange={e => setNotes(e.target.value)}
                                placeholder="Note sulla chiamata..."
                                rows={2}
                                style={{
                                    width: '100%', resize: 'none',
                                    padding: '8px 10px', borderRadius: '8px',
                                    fontSize: '12px',
                                    background: 'var(--color-surface-100)',
                                    border: '1px solid var(--color-surface-300)',
                                    color: 'var(--color-surface-900)',
                                    outline: 'none', fontFamily: 'inherit',
                                }}
                            />
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
