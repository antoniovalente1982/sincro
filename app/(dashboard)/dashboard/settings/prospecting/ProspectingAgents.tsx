'use client'

import { useState, useEffect } from 'react'
import {
    Shield, Plus, Copy, Trash2, X, Eye, EyeOff, ToggleLeft, ToggleRight,
    TrendingUp, DollarSign, Users, CheckCircle, Loader2, ExternalLink, Code
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface Agent {
    id: string
    name: string
    email: string
    api_key: string
    status: string
    commission_type: string
    commission_value: number
    total_submitted: number
    total_qualified: number
    total_converted: number
    total_revenue: number
    created_at: string
}

export default function ProspectingAgents() {
    const [agents, setAgents] = useState<Agent[]>([])
    const [loading, setLoading] = useState(true)
    const [showCreate, setShowCreate] = useState(false)
    const [newAgent, setNewAgent] = useState({ name: '', email: '', commission_type: 'none', commission_value: 0 })
    const [creating, setCreating] = useState(false)
    const [visibleKeys, setVisibleKeys] = useState<Set<string>>(new Set())
    const [copied, setCopied] = useState<string | null>(null)
    const supabase = createClient()

    useEffect(() => { loadAgents() }, [])

    const loadAgents = async () => {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const { data: member } = await supabase
            .from('organization_members')
            .select('organization_id')
            .eq('user_id', user.id)
            .single()

        if (!member) return

        const { data } = await supabase
            .from('prospecting_agents')
            .select('*')
            .eq('organization_id', member.organization_id)
            .order('created_at', { ascending: false })

        setAgents(data || [])
        setLoading(false)
    }

    const createAgent = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!newAgent.name) return
        setCreating(true)

        const { data: { user } } = await supabase.auth.getUser()
        if (!user) { setCreating(false); return }

        const { data: member } = await supabase
            .from('organization_members')
            .select('organization_id')
            .eq('user_id', user.id)
            .single()

        if (!member) { setCreating(false); return }

        // Generate secure API key
        const apiKey = `sp_${crypto.randomUUID().replace(/-/g, '')}`

        const { data, error } = await supabase
            .from('prospecting_agents')
            .insert({
                organization_id: member.organization_id,
                name: newAgent.name,
                email: newAgent.email || null,
                api_key: apiKey,
                commission_type: newAgent.commission_type,
                commission_value: newAgent.commission_value,
            })
            .select()
            .single()

        if (data) {
            setAgents(prev => [data, ...prev])
            setShowCreate(false)
            setNewAgent({ name: '', email: '', commission_type: 'none', commission_value: 0 })
            // Auto-show key for new agent
            setVisibleKeys(prev => new Set([...prev, data.id]))
        }
        setCreating(false)
    }

    const toggleStatus = async (agent: Agent) => {
        const newStatus = agent.status === 'active' ? 'paused' : 'active'
        await supabase.from('prospecting_agents').update({ status: newStatus, updated_at: new Date().toISOString() }).eq('id', agent.id)
        setAgents(prev => prev.map(a => a.id === agent.id ? { ...a, status: newStatus } : a))
    }

    const deleteAgent = async (id: string) => {
        if (!confirm('Revocare questo agente? Non potrà più inviare lead.')) return
        await supabase.from('prospecting_agents').update({ status: 'revoked', updated_at: new Date().toISOString() }).eq('id', id)
        setAgents(prev => prev.map(a => a.id === id ? { ...a, status: 'revoked' } : a))
    }

    const copyToClipboard = (text: string, id: string) => {
        navigator.clipboard.writeText(text)
        setCopied(id)
        setTimeout(() => setCopied(null), 2000)
    }

    const baseUrl = typeof window !== 'undefined' ? window.location.origin : ''
    const formatCurrency = (v: number) => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(v)

    return (
        <div className="space-y-6 animate-fade-in max-w-4xl">
            <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-white flex items-center gap-3">
                        <Shield className="w-6 h-6" style={{ color: '#a855f7' }} />
                        Agenti Prospecting
                    </h1>
                    <p className="text-sm mt-1" style={{ color: 'var(--color-surface-600)' }}>
                        Agenti esterni che portano lead via API. Nessun accesso al sistema.
                    </p>
                </div>
                <button onClick={() => setShowCreate(true)} className="btn-primary">
                    <Plus className="w-4 h-4" /> Nuovo Agente
                </button>
            </div>

            {/* API Docs Card */}
            <div className="glass-card p-5" style={{ borderColor: 'rgba(168, 85, 247, 0.15)' }}>
                <div className="flex items-center gap-2 mb-3">
                    <Code className="w-4 h-4" style={{ color: '#a855f7' }} />
                    <h3 className="text-sm font-bold text-white">API per Agenti</h3>
                </div>
                <div className="space-y-2 text-xs" style={{ color: 'var(--color-surface-500)' }}>
                    <div className="p-3 rounded-lg font-mono" style={{ background: 'var(--color-surface-100)', border: '1px solid var(--color-surface-200)' }}>
                        <span style={{ color: '#22c55e' }}>POST</span> <span className="text-white">{baseUrl}/api/prospecting/submit</span>
                    </div>
                    <pre className="p-3 rounded-lg overflow-x-auto" style={{ background: 'var(--color-surface-100)', border: '1px solid var(--color-surface-200)', color: 'var(--color-surface-400)' }}>
{`Headers: { "X-API-Key": "sp_xxx...", "Content-Type": "application/json" }
Body:    { "name": "Mario Rossi", "email": "m@r.it", "phone": "+39...", "notes": "...", "source": "linkedin" }`}</pre>
                    <div className="p-3 rounded-lg font-mono" style={{ background: 'var(--color-surface-100)', border: '1px solid var(--color-surface-200)' }}>
                        <span style={{ color: '#3b82f6' }}>GET</span> <span className="text-white">{baseUrl}/api/prospecting/stats</span> <span style={{ color: 'var(--color-surface-600)' }}>← agente vede i propri numeri</span>
                    </div>
                </div>
            </div>

            {/* Stats Summary */}
            {agents.filter(a => a.status !== 'revoked').length > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                        { label: 'Agenti Attivi', value: agents.filter(a => a.status === 'active').length, icon: Users, color: '#22c55e' },
                        { label: 'Lead Totali', value: agents.reduce((s, a) => s + a.total_submitted, 0), icon: TrendingUp, color: '#3b82f6' },
                        { label: 'Convertiti', value: agents.reduce((s, a) => s + a.total_converted, 0), icon: CheckCircle, color: '#a855f7' },
                        { label: 'Revenue', value: formatCurrency(agents.reduce((s, a) => s + Number(a.total_revenue), 0)), icon: DollarSign, color: '#f59e0b' },
                    ].map(stat => (
                        <div key={stat.label} className="glass-card p-4">
                            <div className="flex items-center gap-2 mb-1">
                                <stat.icon className="w-3.5 h-3.5" style={{ color: stat.color }} />
                                <span className="text-[10px] uppercase font-semibold" style={{ color: 'var(--color-surface-600)' }}>{stat.label}</span>
                            </div>
                            <div className="text-lg font-bold text-white">{stat.value}</div>
                        </div>
                    ))}
                </div>
            )}

            {/* Agent List */}
            {loading ? (
                <div className="glass-card p-8 text-center">
                    <div className="w-6 h-6 border-2 border-white/20 border-t-white/60 rounded-full animate-spin mx-auto" />
                </div>
            ) : agents.length === 0 ? (
                <div className="glass-card p-8 text-center">
                    <Shield className="w-10 h-10 mx-auto mb-3" style={{ color: 'var(--color-surface-400)' }} />
                    <div className="text-sm font-semibold text-white mb-1">Nessun agente</div>
                    <div className="text-xs" style={{ color: 'var(--color-surface-500)' }}>Crea il primo agente per ricevere lead da prospecting esterno.</div>
                </div>
            ) : (
                <div className="space-y-3">
                    {agents.map(agent => (
                        <div key={agent.id} className="glass-card p-5" style={{ opacity: agent.status === 'revoked' ? 0.4 : 1 }}>
                            <div className="flex items-start justify-between gap-4 mb-3">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm font-bold text-white">{agent.name}</span>
                                        <span className="badge" style={{
                                            background: agent.status === 'active' ? 'rgba(34, 197, 94, 0.1)' : agent.status === 'paused' ? 'rgba(245, 158, 11, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                                            color: agent.status === 'active' ? '#22c55e' : agent.status === 'paused' ? '#f59e0b' : '#ef4444',
                                            border: `1px solid ${agent.status === 'active' ? 'rgba(34, 197, 94, 0.2)' : agent.status === 'paused' ? 'rgba(245, 158, 11, 0.2)' : 'rgba(239, 68, 68, 0.2)'}`,
                                        }}>
                                            {agent.status === 'active' ? 'Attivo' : agent.status === 'paused' ? 'Pausa' : 'Revocato'}
                                        </span>
                                    </div>
                                    {agent.email && <div className="text-xs mt-0.5" style={{ color: 'var(--color-surface-500)' }}>{agent.email}</div>}
                                </div>
                                {agent.status !== 'revoked' && (
                                    <div className="flex items-center gap-1">
                                        <button onClick={() => toggleStatus(agent)} className="p-1.5 rounded-lg hover:bg-white/5" title={agent.status === 'active' ? 'Pausa' : 'Attiva'}>
                                            {agent.status === 'active' ? <ToggleRight className="w-4 h-4" style={{ color: '#22c55e' }} /> : <ToggleLeft className="w-4 h-4" style={{ color: '#f59e0b' }} />}
                                        </button>
                                        <button onClick={() => deleteAgent(agent.id)} className="p-1.5 rounded-lg hover:bg-white/5" title="Revoca">
                                            <Trash2 className="w-4 h-4" style={{ color: '#ef4444' }} />
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* API Key */}
                            <div className="flex items-center gap-2 p-2.5 rounded-lg mb-3" style={{ background: 'var(--color-surface-100)', border: '1px solid var(--color-surface-200)' }}>
                                <code className="text-xs flex-1 font-mono" style={{ color: 'var(--color-surface-400)' }}>
                                    {visibleKeys.has(agent.id) ? agent.api_key : '•'.repeat(40)}
                                </code>
                                <button onClick={() => setVisibleKeys(prev => {
                                    const next = new Set(prev)
                                    next.has(agent.id) ? next.delete(agent.id) : next.add(agent.id)
                                    return next
                                })} className="p-1 rounded hover:bg-white/5">
                                    {visibleKeys.has(agent.id) ? <EyeOff className="w-3.5 h-3.5" style={{ color: 'var(--color-surface-500)' }} /> : <Eye className="w-3.5 h-3.5" style={{ color: 'var(--color-surface-500)' }} />}
                                </button>
                                <button onClick={() => copyToClipboard(agent.api_key, agent.id)} className="p-1 rounded hover:bg-white/5">
                                    {copied === agent.id ? <CheckCircle className="w-3.5 h-3.5" style={{ color: '#22c55e' }} /> : <Copy className="w-3.5 h-3.5" style={{ color: 'var(--color-surface-500)' }} />}
                                </button>
                            </div>

                            {/* Stats */}
                            <div className="grid grid-cols-4 gap-3">
                                {[
                                    { label: 'Inviati', value: agent.total_submitted, color: '#3b82f6' },
                                    { label: 'Qualificati', value: agent.total_qualified, color: '#22c55e' },
                                    { label: 'Convertiti', value: agent.total_converted, color: '#a855f7' },
                                    { label: 'Revenue', value: formatCurrency(Number(agent.total_revenue)), color: '#f59e0b' },
                                ].map(s => (
                                    <div key={s.label} className="text-center">
                                        <div className="text-[10px] uppercase" style={{ color: 'var(--color-surface-600)' }}>{s.label}</div>
                                        <div className="text-sm font-bold" style={{ color: s.color }}>{s.value}</div>
                                    </div>
                                ))}
                            </div>

                            {agent.commission_type !== 'none' && (
                                <div className="mt-2 text-[11px] text-center" style={{ color: 'var(--color-surface-500)' }}>
                                    Commissione: {formatCurrency(agent.commission_value)} / {agent.commission_type === 'per_lead' ? 'lead' : agent.commission_type === 'per_qualified' ? 'qualificato' : 'vendita'}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* Create Modal */}
            {showCreate && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in" onClick={() => setShowCreate(false)}>
                    <div className="w-full max-w-md glass-card p-6 m-4" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-lg font-bold text-white">Nuovo Agente</h2>
                            <button onClick={() => setShowCreate(false)} className="p-2 rounded-xl hover:bg-white/5"><X className="w-5 h-5" style={{ color: 'var(--color-surface-500)' }} /></button>
                        </div>
                        <form onSubmit={createAgent} className="space-y-4">
                            <div>
                                <label className="label">Nome Agente *</label>
                                <input className="input" value={newAgent.name} onChange={e => setNewAgent(p => ({ ...p, name: e.target.value }))} placeholder="Es: Marco SDR, OpenClow Bot" required />
                            </div>
                            <div>
                                <label className="label">Email (opzionale)</label>
                                <input type="email" className="input" value={newAgent.email} onChange={e => setNewAgent(p => ({ ...p, email: e.target.value }))} placeholder="agente@email.com" />
                            </div>
                            <div>
                                <label className="label">Tipo Commissione</label>
                                <select className="input" value={newAgent.commission_type} onChange={e => setNewAgent(p => ({ ...p, commission_type: e.target.value }))}>
                                    <option value="none">Nessuna</option>
                                    <option value="per_lead">Per Lead</option>
                                    <option value="per_qualified">Per Qualificato</option>
                                    <option value="per_sale">Per Vendita</option>
                                </select>
                            </div>
                            {newAgent.commission_type !== 'none' && (
                                <div>
                                    <label className="label">Importo Commissione (€)</label>
                                    <input type="number" step="0.01" className="input" value={newAgent.commission_value} onChange={e => setNewAgent(p => ({ ...p, commission_value: parseFloat(e.target.value) || 0 }))} />
                                </div>
                            )}
                            <div className="flex gap-3 pt-2">
                                <button type="button" onClick={() => setShowCreate(false)} className="btn-secondary flex-1">Annulla</button>
                                <button type="submit" className="btn-primary flex-1" disabled={creating || !newAgent.name}>
                                    {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Plus className="w-4 h-4" /> Crea Agente</>}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}
