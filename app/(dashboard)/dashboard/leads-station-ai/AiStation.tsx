'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { ArrowLeft, Bot, Play, RefreshCw, CheckCircle2, XCircle, Trophy } from 'lucide-react'

const OUTCOMES = [
    { key: 'appointment', label: '📅 Appuntamento' },
    { key: 'interested', label: '⭐ Interessato' },
    { key: 'callback', label: '🔄 Richiama' },
    { key: 'no_answer', label: '📵 Non risponde' },
    { key: 'not_interested', label: '❌ Non interessato' },
    { key: 'wrong_number', label: '⚠️ Numero errato' },
]

export default function AiStation({ orgId }: { orgId: string }) {
    const [data, setData] = useState<any>(null)
    const [compare, setCompare] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [busy, setBusy] = useState(false)
    const [simOutcome, setSimOutcome] = useState('appointment')
    const [simResult, setSimResult] = useState<string | null>(null)
    const [cfg, setCfg] = useState({ provider_agent_id: '', phone_number_id: '', daily_call_target: 50, active: false })
    const [prompt, setPrompt] = useState('')
    const [playbook, setPlaybook] = useState('')

    const load = useCallback(async () => {
        setLoading(true)
        const [a, c] = await Promise.all([
            fetch('/api/leads-pool/ai/agent').then(r => r.json()).catch(() => null),
            fetch('/api/leads-pool/ai/compare?days=30').then(r => r.json()).catch(() => null),
        ])
        setData(a)
        setCompare(c)
        if (a?.agent) {
            setCfg({
                provider_agent_id: a.agent.provider_agent_id || '',
                phone_number_id: a.agent.phone_number_id || '',
                daily_call_target: a.agent.daily_call_target || 50,
                active: !!a.agent.active,
            })
            const activeVer = (a.versions || []).find((v: any) => v.status === 'active')
            setPrompt(activeVer?.system_prompt || '')
            setPlaybook(activeVer?.playbook || '')
        }
        setLoading(false)
    }, [])

    useEffect(() => { load() }, [load])

    const post = async (body: any) => {
        setBusy(true)
        try {
            const r = await fetch('/api/leads-pool/ai/agent', {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
            })
            return await r.json()
        } finally { setBusy(false) }
    }

    const setup = async () => { await post({ action: 'setup' }); await load() }
    const saveConfig = async () => { await post({ action: 'update', agent_id: data.agent.id, ...cfg }); await load() }
    const savePrompt = async () => { await post({ action: 'save_version', agent_id: data.agent.id, system_prompt: prompt, playbook }); await load() }
    const activateVersion = async (version_id: string) => { await post({ action: 'activate_version', agent_id: data.agent.id, version_id }); await load() }

    const simulate = async () => {
        setBusy(true); setSimResult(null)
        try {
            const r = await fetch('/api/leads-pool/ai/simulate', {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ outcome: simOutcome }),
            })
            const j = await r.json()
            setSimResult(r.ok ? `✅ Simulato: ${j.outcome}${j.result?.closerId ? ' → assegnato a un closer umano' : ''}` : `⚠️ ${j.error}`)
            await load()
        } finally { setBusy(false) }
    }

    if (loading) return <div style={{ padding: 48, textAlign: 'center', color: 'var(--color-surface-400)' }}>Caricamento…</div>

    const agent = data?.agent
    const checklist = data?.checklist || {}
    const versions = data?.versions || []

    const CheckRow = ({ ok, label, hint }: { ok: boolean; label: string; hint?: string }) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, padding: '6px 0' }}>
            {ok ? <CheckCircle2 className="w-4 h-4" style={{ color: '#22c55e' }} /> : <XCircle className="w-4 h-4" style={{ color: '#ef4444' }} />}
            <span style={{ color: 'var(--color-surface-800)' }}>{label}</span>
            {!ok && hint && <span style={{ fontSize: 11, color: 'var(--color-surface-400)' }}>— {hint}</span>}
        </div>
    )

    return (
        <div style={{ minHeight: '100vh' }}>
            <div className="flex items-center justify-between mb-6">
                <div>
                    <Link href="/dashboard/leads-station" style={{ fontSize: 12, color: 'var(--color-surface-500)', display: 'flex', alignItems: 'center', gap: 4, marginBottom: 6 }}>
                        <ArrowLeft className="w-3 h-3" /> Stazione Leads (umani)
                    </Link>
                    <h1 className="text-2xl font-bold flex items-center gap-2" style={{ color: 'var(--color-surface-900)' }}>
                        <Bot className="w-6 h-6" style={{ color: '#a855f7' }} /> Stazione Leads AI
                    </h1>
                    <p className="text-sm mt-0.5" style={{ color: 'var(--color-surface-500)' }}>
                        Setter agentici — area riservata. Gli appuntamenti presi dall'AI vanno ai closer umani.
                    </p>
                </div>
                <button onClick={load} disabled={busy} className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm"
                    style={{ background: 'var(--color-surface-100)', border: '1px solid var(--color-surface-200)', color: 'var(--color-surface-600)' }}>
                    <RefreshCw className={`w-4 h-4 ${busy ? 'animate-spin' : ''}`} /> Aggiorna
                </button>
            </div>

            {!agent ? (
                <div className="glass-card" style={{ padding: 48, borderRadius: 20, textAlign: 'center', border: '1px dashed var(--color-surface-300)' }}>
                    <div style={{ fontSize: '3rem', marginBottom: 12 }}>🤖</div>
                    <h3 className="font-bold mb-2" style={{ color: 'var(--color-surface-800)' }}>Nessun agente AI</h3>
                    <p className="text-sm mb-4" style={{ color: 'var(--color-surface-500)', maxWidth: 420, margin: '0 auto 16px' }}>
                        Crea il setter virtuale AI. Verrà registrato come membro del <strong>Team AI</strong>, attingerà allo
                        stesso pool degli umani e passerà gli appuntamenti ai closer umani in round-robin.
                    </p>
                    <button onClick={setup} disabled={busy}
                        style={{ padding: '12px 24px', borderRadius: 12, background: 'linear-gradient(135deg,#a855f7,#7c3aed)', color: 'white', border: 'none', fontWeight: 700, cursor: 'pointer' }}>
                        🤖 Crea Agente Setter AI
                    </button>
                </div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, alignItems: 'start' }}>

                    {/* Setup + config */}
                    <div className="glass-card" style={{ padding: 20, borderRadius: 16, border: '1px solid var(--color-surface-200)' }}>
                        <h3 className="text-sm font-bold mb-3" style={{ color: 'var(--color-surface-800)' }}>⚙️ Setup & Configurazione</h3>
                        <CheckRow ok={checklist.agent_created} label="Agente creato" />
                        <CheckRow ok={checklist.convai_key} label="API key ElevenLabs Conversational AI" hint="aggiungi ELEVENLABS_CONVAI_API_KEY" />
                        <CheckRow ok={checklist.provider_agent_id} label="Agent ID ElevenLabs" hint="incollalo qui sotto" />
                        <CheckRow ok={checklist.phone_number} label="Numero telefonico (Twilio→ElevenLabs)" hint="incolla l'ID numero" />
                        <CheckRow ok={checklist.active} label="Agente attivo" />

                        <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
                            <label style={{ fontSize: 12, color: 'var(--color-surface-600)' }}>
                                ElevenLabs Agent ID
                                <input value={cfg.provider_agent_id} onChange={e => setCfg({ ...cfg, provider_agent_id: e.target.value })}
                                    placeholder="agent_..." style={inp} />
                            </label>
                            <label style={{ fontSize: 12, color: 'var(--color-surface-600)' }}>
                                Phone Number ID
                                <input value={cfg.phone_number_id} onChange={e => setCfg({ ...cfg, phone_number_id: e.target.value })}
                                    placeholder="phnum_..." style={inp} />
                            </label>
                            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                                <label style={{ fontSize: 12, color: 'var(--color-surface-600)', flex: 1 }}>
                                    Chiamate/giorno
                                    <input type="number" value={cfg.daily_call_target} onChange={e => setCfg({ ...cfg, daily_call_target: Number(e.target.value) })} style={inp} />
                                </label>
                                <label style={{ fontSize: 13, color: 'var(--color-surface-700)', display: 'flex', alignItems: 'center', gap: 8, marginTop: 18 }}>
                                    <input type="checkbox" checked={cfg.active} onChange={e => setCfg({ ...cfg, active: e.target.checked })} />
                                    Attivo
                                </label>
                            </div>
                            <button onClick={saveConfig} disabled={busy}
                                style={{ padding: '10px', borderRadius: 10, background: '#a855f7', color: 'white', border: 'none', fontWeight: 600, cursor: 'pointer' }}>
                                Salva configurazione
                            </button>
                        </div>
                    </div>

                    {/* Simula + Confronto */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                        <div className="glass-card" style={{ padding: 20, borderRadius: 16, border: '1px solid var(--color-surface-200)' }}>
                            <h3 className="text-sm font-bold mb-1" style={{ color: 'var(--color-surface-800)' }}>🧪 Simula una chiamata (test)</h3>
                            <p style={{ fontSize: 11, color: 'var(--color-surface-400)', marginBottom: 10 }}>
                                Prova il flusso completo su un lead reale, senza telefonare davvero.
                            </p>
                            <div style={{ display: 'flex', gap: 8 }}>
                                <select value={simOutcome} onChange={e => setSimOutcome(e.target.value)} style={{ ...inp, flex: 1, marginTop: 0 }}>
                                    {OUTCOMES.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
                                </select>
                                <button onClick={simulate} disabled={busy}
                                    style={{ padding: '8px 16px', borderRadius: 10, background: '#22c55e', color: 'white', border: 'none', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <Play className="w-4 h-4" /> Simula
                                </button>
                            </div>
                            {simResult && <div style={{ marginTop: 10, fontSize: 12, color: 'var(--color-surface-700)' }}>{simResult}</div>}
                        </div>

                        {compare && (
                            <div className="glass-card" style={{ padding: 20, borderRadius: 16, border: '1px solid var(--color-surface-200)' }}>
                                <h3 className="text-sm font-bold mb-3" style={{ color: 'var(--color-surface-800)', display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <Trophy className="w-4 h-4" style={{ color: '#f59e0b' }} /> Human vs AI — ultimi {compare.days}gg
                                </h3>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                                    {(['human', 'ai'] as const).map(t => {
                                        const s = compare[t]
                                        return (
                                            <div key={t} style={{ padding: 14, borderRadius: 12, background: t === 'ai' ? 'rgba(168,85,247,0.06)' : 'var(--color-surface-100)', border: `1px solid ${t === 'ai' ? 'rgba(168,85,247,0.2)' : 'var(--color-surface-200)'}` }}>
                                                <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8, color: t === 'ai' ? '#a855f7' : 'var(--color-surface-700)' }}>
                                                    {t === 'ai' ? '🤖 Team AI' : '👥 Team Human'}
                                                </div>
                                                <Metric label="Lavorati" value={s.worked} />
                                                <Metric label="Appuntamenti" value={s.appointments} strong />
                                                <Metric label="Book rate" value={`${s.book_rate}%`} strong />
                                                {t === 'ai' && <Metric label="€/appuntamento" value={s.cost_per_appointment_eur != null ? `€${s.cost_per_appointment_eur}` : '—'} />}
                                                <Metric label="Freschezza lead" value={s.avg_lead_freshness_hours != null ? `${s.avg_lead_freshness_hours}h` : '—'} muted />
                                            </div>
                                        )
                                    })}
                                </div>
                                <p style={{ fontSize: 10, color: 'var(--color-surface-400)', marginTop: 8 }}>
                                    La "freschezza lead" serve a controllare l'equità: se i due valori divergono molto, un team riceve lead più freschi.
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Prompt + versioni (full width) */}
                    <div className="glass-card" style={{ padding: 20, borderRadius: 16, border: '1px solid var(--color-surface-200)', gridColumn: '1 / -1' }}>
                        <h3 className="text-sm font-bold mb-3" style={{ color: 'var(--color-surface-800)' }}>🧠 Script & Auto-miglioramento</h3>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                            <div>
                                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-surface-600)' }}>System prompt (parte fissa)</label>
                                <textarea value={prompt} onChange={e => setPrompt(e.target.value)} rows={7} style={{ ...inp, fontFamily: 'inherit' }} />
                                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-surface-600)' }}>Playbook (lezioni apprese)</label>
                                <textarea value={playbook} onChange={e => setPlaybook(e.target.value)} rows={5} style={{ ...inp, fontFamily: 'inherit' }} />
                                <button onClick={savePrompt} disabled={busy}
                                    style={{ marginTop: 8, padding: '8px 16px', borderRadius: 10, background: '#a855f7', color: 'white', border: 'none', fontWeight: 600, cursor: 'pointer' }}>
                                    Salva come nuova versione attiva
                                </button>
                            </div>
                            <div>
                                <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-surface-600)', marginBottom: 8 }}>Versioni</p>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 320, overflowY: 'auto' }}>
                                    {versions.map((v: any) => (
                                        <div key={v.id} style={{ padding: 12, borderRadius: 10, border: '1px solid var(--color-surface-200)', background: v.status === 'active' ? 'rgba(34,197,94,0.05)' : v.status === 'candidate' ? 'rgba(245,158,11,0.05)' : 'var(--color-surface-50)' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <span style={{ fontSize: 12, fontWeight: 700 }}>v{v.version_no}
                                                    <span style={{ marginLeft: 8, fontSize: 10, padding: '1px 6px', borderRadius: 6, background: v.status === 'active' ? 'rgba(34,197,94,0.15)' : v.status === 'candidate' ? 'rgba(245,158,11,0.15)' : 'var(--color-surface-200)', color: v.status === 'active' ? '#22c55e' : v.status === 'candidate' ? '#f59e0b' : 'var(--color-surface-500)' }}>{v.status}</span>
                                                </span>
                                                {v.status === 'candidate' && (
                                                    <button onClick={() => activateVersion(v.id)} disabled={busy}
                                                        style={{ fontSize: 11, padding: '4px 10px', borderRadius: 8, background: '#22c55e', color: 'white', border: 'none', cursor: 'pointer' }}>
                                                        Attiva
                                                    </button>
                                                )}
                                            </div>
                                            {v.metrics?.book_rate != null && <div style={{ fontSize: 11, color: 'var(--color-surface-500)', marginTop: 4 }}>Book rate: {v.metrics.book_rate}% · {v.metrics.calls || 0} chiamate</div>}
                                            {v.notes && <div style={{ fontSize: 11, color: 'var(--color-surface-500)', marginTop: 4, fontStyle: 'italic' }}>{v.notes}</div>}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

const inp: React.CSSProperties = {
    width: '100%', marginTop: 4, padding: '8px 10px', borderRadius: 8, fontSize: 13,
    background: 'var(--color-surface-100)', border: '1px solid var(--color-surface-300)',
    color: 'var(--color-surface-900)', outline: 'none',
}

function Metric({ label, value, strong, muted }: { label: string; value: any; strong?: boolean; muted?: boolean }) {
    return (
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '2px 0' }}>
            <span style={{ color: 'var(--color-surface-500)' }}>{label}</span>
            <span style={{ fontWeight: strong ? 800 : 500, color: muted ? 'var(--color-surface-400)' : 'var(--color-surface-900)' }}>{value}</span>
        </div>
    )
}
