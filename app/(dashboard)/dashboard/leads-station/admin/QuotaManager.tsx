'use client'

import { useState } from 'react'
import { Save, Plus, Trash2, User, Globe } from 'lucide-react'

interface Rule {
    id?: string
    user_id?: string | null
    profile?: any
    max_leads_per_day: number
    batch_size: number
    cooldown_minutes: number
    require_feedback_before_next: boolean
    min_feedback_pct: number
    allowed_hours_start: string
    allowed_hours_end: string
    allowed_days: number[]
}

interface Props {
    orgId: string
    initialRules: Rule[]
    closers: { user_id: string; role: string; profile: any }[]
    onUpdate: () => void
}

const DEFAULT_RULE: Omit<Rule, 'id'> = {
    user_id: null,
    max_leads_per_day: 50,
    batch_size: 5,
    cooldown_minutes: 0,
    require_feedback_before_next: true,
    min_feedback_pct: 100,
    allowed_hours_start: '08:00',
    allowed_hours_end: '21:00',
    allowed_days: [1, 2, 3, 4, 5, 6],
}

const DAY_LABELS = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom']

export default function QuotaManager({ orgId, initialRules, closers, onUpdate }: Props) {
    const [rules, setRules] = useState<Rule[]>(initialRules.length > 0 ? initialRules : [{ ...DEFAULT_RULE }])
    const [isSaving, setIsSaving] = useState<string | null>(null)
    const [savedIds, setSavedIds] = useState<Set<string>>(new Set())
    const [showAddRule, setShowAddRule] = useState(false)
    const [selectedUser, setSelectedUser] = useState<string>('')

    const updateRule = (index: number, field: keyof Rule, value: any) => {
        setRules(prev => prev.map((r, i) => i === index ? { ...r, [field]: value } : r))
    }

    const toggleDay = (index: number, day: number) => {
        setRules(prev => prev.map((r, i) => {
            if (i !== index) return r
            const days = r.allowed_days.includes(day)
                ? r.allowed_days.filter(d => d !== day)
                : [...r.allowed_days, day].sort()
            return { ...r, allowed_days: days }
        }))
    }

    const saveRule = async (index: number) => {
        const rule = rules[index]
        setIsSaving(`${index}`)
        try {
            const res = await fetch('/api/leads-pool/admin/rules', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(rule),
            })
            if (res.ok) {
                const data = await res.json()
                setRules(prev => prev.map((r, i) => i === index ? { ...r, ...data.rule } : r))
                setSavedIds(prev => new Set([...prev, `${index}`]))
                setTimeout(() => setSavedIds(prev => { const s = new Set(prev); s.delete(`${index}`); return s }), 2000)
                onUpdate()
            }
        } finally {
            setIsSaving(null)
        }
    }

    const deleteRule = async (index: number) => {
        const rule = rules[index]
        if (!rule.id) {
            setRules(prev => prev.filter((_, i) => i !== index))
            return
        }
        if (!confirm('Eliminare questa regola?')) return
        await fetch(`/api/leads-pool/admin/rules?id=${rule.id}`, { method: 'DELETE' })
        setRules(prev => prev.filter((_, i) => i !== index))
        onUpdate()
    }

    const addRuleForUser = () => {
        if (!selectedUser && rules.some(r => !r.user_id)) return // Default already exists
        const closer = closers.find(c => c.user_id === selectedUser)
        setRules(prev => [...prev, {
            ...DEFAULT_RULE,
            user_id: selectedUser || null,
            profile: closer?.profile || null,
        }])
        setShowAddRule(false)
        setSelectedUser('')
    }

    const closersWithoutRule = closers.filter(c =>
        !rules.some(r => r.user_id === c.user_id)
    )

    return (
        <div>
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-bold" style={{ color: 'var(--color-surface-700)' }}>
                    Quote & Regole di Distribuzione
                </h2>
                <button
                    onClick={() => setShowAddRule(true)}
                    style={{
                        display: 'flex', alignItems: 'center', gap: '6px',
                        padding: '7px 14px', borderRadius: '10px', fontSize: '12px', fontWeight: '600',
                        background: 'var(--color-surface-100)',
                        border: '1px solid var(--color-surface-300)',
                        color: 'var(--color-surface-600)',
                        cursor: 'pointer',
                    }}
                >
                    <Plus className="w-3 h-3" /> Aggiungi regola
                </button>
            </div>

            {showAddRule && (
                <div style={{
                    marginBottom: '16px', padding: '14px 16px',
                    borderRadius: '12px', background: 'var(--color-surface-100)',
                    border: '1px solid var(--color-surface-200)',
                    display: 'flex', gap: '10px', alignItems: 'center',
                }}>
                    <Globe className="w-4 h-4" style={{ color: '#a855f7', flexShrink: 0 }} />
                    <select
                        value={selectedUser}
                        onChange={e => setSelectedUser(e.target.value)}
                        style={{
                            flex: 1, padding: '6px 10px', borderRadius: '8px', fontSize: '12px',
                            background: 'var(--color-surface-0)',
                            border: '1px solid var(--color-surface-300)',
                            color: 'var(--color-surface-900)',
                        }}
                    >
                        <option value="">⚙️ Regola default (tutta l'organizzazione)</option>
                        {closersWithoutRule.map(c => (
                            <option key={c.user_id} value={c.user_id}>
                                👤 {c.profile?.full_name || c.user_id}
                            </option>
                        ))}
                    </select>
                    <button
                        onClick={addRuleForUser}
                        style={{
                            padding: '6px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: '600',
                            background: '#a855f7', color: 'white', border: 'none', cursor: 'pointer',
                        }}
                    >
                        Crea
                    </button>
                    <button
                        onClick={() => setShowAddRule(false)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-surface-500)', fontSize: '18px' }}
                    >
                        ×
                    </button>
                </div>
            )}

            {rules.map((rule, index) => (
                <div key={index} style={{
                    marginBottom: '16px',
                    padding: '20px',
                    borderRadius: '16px',
                    border: `1px solid ${rule.user_id ? 'var(--color-surface-200)' : 'rgba(168,85,247,0.3)'}`,
                    background: rule.user_id ? 'var(--color-surface-50)' : 'rgba(168,85,247,0.03)',
                }}>
                    {/* Rule header */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            {rule.user_id
                                ? <User className="w-4 h-4" style={{ color: '#3b82f6' }} />
                                : <Globe className="w-4 h-4" style={{ color: '#a855f7' }} />
                            }
                            <span className="font-semibold text-sm" style={{ color: 'var(--color-surface-900)' }}>
                                {rule.user_id
                                    ? (rule.profile?.full_name || 'Venditore specifico')
                                    : '⚙️ Regola Default (tutta l\'organizzazione)'
                                }
                            </span>
                        </div>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            {savedIds.has(`${index}`) && (
                                <span style={{ fontSize: '11px', color: '#22c55e', fontWeight: '600' }}>✅ Salvato</span>
                            )}
                            <button
                                onClick={() => deleteRule(index)}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-surface-400)' }}
                                title="Elimina regola"
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </div>
                    </div>

                    {/* Fields grid */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '14px' }}>
                        {/* Max leads/day */}
                        <div>
                            <label style={{ fontSize: '11px', fontWeight: '600', color: 'var(--color-surface-500)', display: 'block', marginBottom: '4px' }}>
                                Max leads/giorno
                            </label>
                            <input
                                type="number" min={1} max={500}
                                value={rule.max_leads_per_day}
                                onChange={e => updateRule(index, 'max_leads_per_day', parseInt(e.target.value) || 50)}
                                style={{ ...inputStyle }}
                            />
                        </div>
                        {/* Batch size */}
                        <div>
                            <label style={{ fontSize: '11px', fontWeight: '600', color: 'var(--color-surface-500)', display: 'block', marginBottom: '4px' }}>
                                Leads per spin
                            </label>
                            <input
                                type="number" min={1} max={20}
                                value={rule.batch_size}
                                onChange={e => updateRule(index, 'batch_size', parseInt(e.target.value) || 5)}
                                style={{ ...inputStyle }}
                            />
                        </div>
                        {/* Cooldown */}
                        <div>
                            <label style={{ fontSize: '11px', fontWeight: '600', color: 'var(--color-surface-500)', display: 'block', marginBottom: '4px' }}>
                                Cooldown (minuti)
                            </label>
                            <input
                                type="number" min={0} max={480}
                                value={rule.cooldown_minutes}
                                onChange={e => updateRule(index, 'cooldown_minutes', parseInt(e.target.value) || 0)}
                                style={{ ...inputStyle }}
                            />
                        </div>
                        {/* Hours start */}
                        <div>
                            <label style={{ fontSize: '11px', fontWeight: '600', color: 'var(--color-surface-500)', display: 'block', marginBottom: '4px' }}>
                                Ora inizio
                            </label>
                            <input
                                type="time"
                                value={rule.allowed_hours_start}
                                onChange={e => updateRule(index, 'allowed_hours_start', e.target.value)}
                                style={{ ...inputStyle }}
                            />
                        </div>
                        {/* Hours end */}
                        <div>
                            <label style={{ fontSize: '11px', fontWeight: '600', color: 'var(--color-surface-500)', display: 'block', marginBottom: '4px' }}>
                                Ora fine
                            </label>
                            <input
                                type="time"
                                value={rule.allowed_hours_end}
                                onChange={e => updateRule(index, 'allowed_hours_end', e.target.value)}
                                style={{ ...inputStyle }}
                            />
                        </div>
                        {/* Min feedback pct */}
                        <div>
                            <label style={{ fontSize: '11px', fontWeight: '600', color: 'var(--color-surface-500)', display: 'block', marginBottom: '4px' }}>
                                Min. feedback % richiesto
                            </label>
                            <input
                                type="number" min={0} max={100}
                                value={rule.min_feedback_pct}
                                onChange={e => updateRule(index, 'min_feedback_pct', parseInt(e.target.value) || 60)}
                                style={{ ...inputStyle }}
                            />
                        </div>
                    </div>

                    {/* Days selector */}
                    <div style={{ marginBottom: '14px' }}>
                        <label style={{ fontSize: '11px', fontWeight: '600', color: 'var(--color-surface-500)', display: 'block', marginBottom: '6px' }}>
                            Giorni permessi
                        </label>
                        <div style={{ display: 'flex', gap: '6px' }}>
                            {DAY_LABELS.map((day, di) => {
                                const dayNum = di + 1
                                const active = rule.allowed_days.includes(dayNum)
                                return (
                                    <button
                                        key={di}
                                        onClick={() => toggleDay(index, dayNum)}
                                        style={{
                                            width: '36px', height: '36px', borderRadius: '8px',
                                            fontSize: '11px', fontWeight: '600',
                                            border: `1px solid ${active ? '#a855f7' : 'var(--color-surface-300)'}`,
                                            background: active ? 'rgba(168,85,247,0.15)' : 'transparent',
                                            color: active ? '#a855f7' : 'var(--color-surface-500)',
                                            cursor: 'pointer', transition: 'all 0.15s',
                                        }}
                                    >
                                        {day}
                                    </button>
                                )
                            })}
                        </div>
                    </div>

                    {/* Feedback toggle */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
                        <button
                            onClick={() => updateRule(index, 'require_feedback_before_next', !rule.require_feedback_before_next)}
                            style={{
                                width: '40px', height: '22px', borderRadius: '11px',
                                background: rule.require_feedback_before_next ? '#a855f7' : 'var(--color-surface-300)',
                                border: 'none', cursor: 'pointer', position: 'relative',
                                transition: 'background 0.2s',
                            }}
                        >
                            <div style={{
                                position: 'absolute', top: '3px',
                                left: rule.require_feedback_before_next ? '20px' : '3px',
                                width: '16px', height: '16px', borderRadius: '50%',
                                background: 'white', transition: 'left 0.2s',
                                boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                            }} />
                        </button>
                        <span style={{ fontSize: '12px', color: 'var(--color-surface-600)' }}>
                            Richiedi feedback obbligatorio prima del prossimo spin
                        </span>
                    </div>

                    {/* Save button */}
                    <button
                        onClick={() => saveRule(index)}
                        disabled={isSaving === `${index}`}
                        style={{
                            display: 'flex', alignItems: 'center', gap: '6px',
                            padding: '8px 18px', borderRadius: '10px',
                            fontSize: '12px', fontWeight: '600',
                            background: 'linear-gradient(135deg, #a855f7, #7c3aed)',
                            color: 'white', border: 'none',
                            cursor: isSaving === `${index}` ? 'not-allowed' : 'pointer',
                            opacity: isSaving === `${index}` ? 0.7 : 1,
                        }}
                    >
                        <Save className="w-3 h-3" />
                        {isSaving === `${index}` ? 'Salvataggio...' : 'Salva Regola'}
                    </button>
                </div>
            ))}
        </div>
    )
}

const inputStyle: React.CSSProperties = {
    width: '100%', padding: '8px 10px', borderRadius: '8px', fontSize: '13px',
    background: 'var(--color-surface-100)',
    border: '1px solid var(--color-surface-300)',
    color: 'var(--color-surface-900)',
    outline: 'none', fontFamily: 'inherit',
    boxSizing: 'border-box',
}
