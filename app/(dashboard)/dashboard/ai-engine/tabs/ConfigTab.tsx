'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import {
  Settings2, Shield, Zap, Save, Loader2, Search, Check,
  ChevronDown, Play, Brain, DollarSign, Target, Users,
  RefreshCw, AlertTriangle, X, Cpu
} from 'lucide-react'

interface Props {
  data: any
  orgId: string
  onSaved: () => void
}

interface ORModel {
  id: string
  name: string
  description: string
  context_length: number
  pricing: { prompt: string; completion: string }
  architecture: string
}

export default function ConfigTab({ data, orgId, onSaved }: Props) {
  const { objectives, execution_mode, autopilot_active, llm_model } = data

  // Form state
  const [mode, setMode] = useState(execution_mode || 'dry_run')
  const [autopilot, setAutopilot] = useState(autopilot_active || false)
  const [selectedModel, setSelectedModel] = useState(llm_model || 'google/gemini-2.5-flash')
  const [weeklyBudget, setWeeklyBudget] = useState(objectives?.weekly_spend_budget || 50)
  const [targetCac, setTargetCac] = useState(objectives?.target_cac || 50)
  const [targetCpl, setTargetCpl] = useState(objectives?.target_cpl || 20)
  const [targetRoas, setTargetRoas] = useState(objectives?.target_roas || 3)
  const [weeklyLeads, setWeeklyLeads] = useState(objectives?.weekly_leads_target || 20)
  const [weeklyAppts, setWeeklyAppts] = useState(objectives?.weekly_appts_target || 8)
  const [weeklyShowups, setWeeklyShowups] = useState(objectives?.weekly_showups_target || 5)
  const [weeklySales, setWeeklySales] = useState(objectives?.weekly_sales_target || 2)
  const [saving, setSaving] = useState(false)
  const [cronRunning, setCronRunning] = useState<string | null>(null)

  const handleSave = async () => {
    setSaving(true)
    try {
      await fetch('/api/mission-control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orgId,
          execution_mode: mode,
          autopilot_active: autopilot,
          llm_model: selectedModel,
          objectives: {
            weekly_spend_budget: weeklyBudget,
            target_cac: targetCac,
            target_cpl: targetCpl,
            target_roas: targetRoas,
            weekly_leads_target: weeklyLeads,
            weekly_appts_target: weeklyAppts,
            weekly_showups_target: weeklyShowups,
            weekly_sales_target: weeklySales,
          },
        }),
      })
      onSaved()
    } catch { }
    setSaving(false)
  }

  const handleForceCron = async (cron: string) => {
    setCronRunning(cron)
    try {
      await fetch('/api/mission-control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orgId, force_cron: cron }),
      })
    } catch { }
    setCronRunning(null)
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <Settings2 className="w-5 h-5" style={{ color: '#818cf8' }} />
        <h2 className="text-lg font-bold text-white">Configurazione Agente</h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* LEFT COLUMN */}
        <div className="space-y-5">
          {/* LLM Model Selector */}
          <div className="glass-card p-5">
            <div className="flex items-center gap-2 mb-4">
              <Brain className="w-4 h-4" style={{ color: '#a855f7' }} />
              <h3 className="text-sm font-bold text-white">Modello LLM</h3>
            </div>
            <ModelSelector value={selectedModel} onChange={setSelectedModel} />
          </div>

          {/* Execution Mode */}
          <div className="glass-card p-5">
            <div className="flex items-center gap-2 mb-4">
              <Shield className="w-4 h-4" style={{ color: '#f59e0b' }} />
              <h3 className="text-sm font-bold text-white">Modalità Esecuzione</h3>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => setMode('dry_run')}
                className="p-4 rounded-xl text-left transition-all"
                style={{
                  background: mode === 'dry_run' ? 'rgba(245,158,11,0.1)' : 'var(--color-surface-100)',
                  border: `2px solid ${mode === 'dry_run' ? '#f59e0b' : 'var(--color-surface-200)'}`,
                }}>
                <div className="text-sm font-bold text-white mb-1">🧪 Dry Run</div>
                <div className="text-[11px]" style={{ color: 'var(--color-surface-500)' }}>
                  Simula senza toccare Meta
                </div>
              </button>
              <button onClick={() => setMode('live')}
                className="p-4 rounded-xl text-left transition-all"
                style={{
                  background: mode === 'live' ? 'rgba(34,197,94,0.1)' : 'var(--color-surface-100)',
                  border: `2px solid ${mode === 'live' ? '#22c55e' : 'var(--color-surface-200)'}`,
                }}>
                <div className="text-sm font-bold text-white mb-1">🟢 Live</div>
                <div className="text-[11px]" style={{ color: 'var(--color-surface-500)' }}>
                  Azioni reali su Meta Ads
                </div>
              </button>
            </div>
            <div className="mt-4 flex items-center justify-between p-3 rounded-xl" style={{
              background: 'var(--color-surface-100)', border: '1px solid var(--color-surface-200)'
            }}>
              <div>
                <div className="text-sm font-bold text-white">Autopilot</div>
                <div className="text-[11px]" style={{ color: 'var(--color-surface-500)' }}>Ciclo automatico ogni 4h</div>
              </div>
              <button onClick={() => setAutopilot(!autopilot)}
                className="w-12 h-7 rounded-full transition-all relative"
                style={{
                  background: autopilot ? '#22c55e' : 'var(--color-surface-300)',
                  boxShadow: autopilot ? '0 0 12px rgba(34,197,94,0.3)' : 'none'
                }}>
                <div className="w-5 h-5 bg-white rounded-full absolute top-1 transition-all"
                  style={{ left: autopilot ? '26px' : '3px' }} />
              </button>
            </div>
          </div>

          {/* Force Cron */}
          <div className="glass-card p-5">
            <div className="flex items-center gap-2 mb-3">
              <Zap className="w-4 h-4" style={{ color: '#ef4444' }} />
              <h3 className="text-sm font-bold text-white">Operazioni Manuali</h3>
            </div>
            <div className="flex items-center gap-2 mb-4 p-2 rounded-lg text-[11px]" style={{
              background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.15)', color: '#f59e0b'
            }}>
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              Se il modo è "Live", le azioni sono REALI su Meta Ads
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                { id: 'agent-loop', label: 'Agent Loop', desc: 'Ciclo completo', icon: Brain, color: '#a855f7' },
                { id: 'daily-snapshot', label: 'Daily Snapshot', desc: 'Foto giornaliera', icon: RefreshCw, color: '#3b82f6' },
                { id: 'weekly-review', label: 'Weekly Review', desc: 'Analisi strategica', icon: Target, color: '#22c55e' },
                { id: 'ads-global-monitor', label: 'Ads Sync', desc: 'Sincronizza Meta', icon: RefreshCw, color: '#f59e0b' },
              ].map(cron => (
                <button key={cron.id} onClick={() => handleForceCron(cron.id)}
                  disabled={cronRunning !== null}
                  className="p-3 rounded-xl text-left transition-all hover:scale-[1.02] disabled:opacity-50"
                  style={{ background: 'var(--color-surface-100)', border: '1px solid var(--color-surface-200)' }}>
                  <div className="flex items-center gap-2 mb-1">
                    {cronRunning === cron.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" style={{ color: cron.color }} />
                    ) : (
                      <cron.icon className="w-4 h-4" style={{ color: cron.color }} />
                    )}
                    <span className="text-xs font-bold text-white">{cron.label}</span>
                  </div>
                  <span className="text-[10px]" style={{ color: 'var(--color-surface-500)' }}>{cron.desc}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN — Objectives */}
        <div className="space-y-5">
          <div className="glass-card p-5">
            <div className="flex items-center gap-2 mb-4">
              <DollarSign className="w-4 h-4" style={{ color: '#22c55e' }} />
              <h3 className="text-sm font-bold text-white">Financial Targets</h3>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <FieldInput label="Budget Settimanale (€)" value={weeklyBudget} onChange={setWeeklyBudget} />
              <FieldInput label="Target CAC (€)" value={targetCac} onChange={setTargetCac} />
              <FieldInput label="Target CPL (€)" value={targetCpl} onChange={setTargetCpl} />
              <FieldInput label="Target ROAS (x)" value={targetRoas} onChange={setTargetRoas} step={0.1} />
            </div>
          </div>

          <div className="glass-card p-5">
            <div className="flex items-center gap-2 mb-4">
              <Users className="w-4 h-4" style={{ color: '#3b82f6' }} />
              <h3 className="text-sm font-bold text-white">Volume Targets</h3>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <FieldInput label="Lead / Settimana" value={weeklyLeads} onChange={setWeeklyLeads} />
              <FieldInput label="Appuntamenti / Settimana" value={weeklyAppts} onChange={setWeeklyAppts} />
              <FieldInput label="Show-up / Settimana" value={weeklyShowups} onChange={setWeeklyShowups} />
              <FieldInput label="Vendite / Settimana" value={weeklySales} onChange={setWeeklySales} />
            </div>
          </div>

          {/* Save Button */}
          <button onClick={handleSave} disabled={saving}
            className="w-full py-3.5 rounded-xl text-sm font-bold text-white flex items-center justify-center gap-2 transition-all hover:scale-[1.01] disabled:opacity-60"
            style={{
              background: 'linear-gradient(135deg, #a855f7, #6366f1)',
              boxShadow: '0 4px 20px rgba(168,85,247,0.3)',
            }}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saving ? 'Salvando...' : 'Salva Configurazione'}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ═══ MODEL SELECTOR ═══ */
function ModelSelector({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  const [models, setModels] = useState<ORModel[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const dropdownRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetch('/api/openrouter/models')
      .then(r => r.json())
      .then(d => { setModels(d.models || []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  useEffect(() => {
    if (open) setTimeout(() => searchRef.current?.focus(), 100)
  }, [open])

  const filtered = useMemo(() => {
    if (!search.trim()) return models.slice(0, 80)
    const q = search.toLowerCase()
    return models.filter(m =>
      m.id.toLowerCase().includes(q) || m.name.toLowerCase().includes(q)
    ).slice(0, 60)
  }, [models, search])

  const selectedObj = models.find(m => m.id === value)

  const formatPrice = (p: string) => {
    const n = parseFloat(p)
    if (isNaN(n) || n === 0) return 'Free'
    if (n < 0.001) return `$${(n * 1000000).toFixed(2)}/1M`
    return `$${n.toFixed(4)}/1K`
  }

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Trigger */}
      <button onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between gap-3 p-3.5 rounded-xl text-left transition-all"
        style={{
          background: 'var(--color-surface-100)',
          border: `1px solid ${open ? 'rgba(168,85,247,0.4)' : 'var(--color-surface-300)'}`,
          boxShadow: open ? '0 0 20px rgba(168,85,247,0.1)' : 'none',
        }}>
        <div className="flex items-center gap-3 min-w-0">
          <Cpu className="w-4 h-4 shrink-0" style={{ color: '#a855f7' }} />
          <div className="min-w-0">
            <div className="text-sm font-semibold text-white truncate">{selectedObj?.name || value}</div>
            <div className="text-[10px] font-mono truncate" style={{ color: 'var(--color-surface-500)' }}>{value}</div>
          </div>
        </div>
        <ChevronDown className={`w-4 h-4 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
          style={{ color: 'var(--color-surface-500)' }} />
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute z-50 top-full left-0 right-0 mt-2 rounded-xl overflow-hidden shadow-2xl animate-fade-in"
          style={{ background: 'var(--color-surface-100)', border: '1px solid var(--color-surface-300)', maxHeight: '400px' }}>
          {/* Search bar */}
          <div className="p-3" style={{ borderBottom: '1px solid var(--color-surface-200)' }}>
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: 'var(--color-surface-50)', border: '1px solid var(--color-surface-200)' }}>
              <Search className="w-4 h-4 shrink-0" style={{ color: 'var(--color-surface-500)' }} />
              <input
                ref={searchRef}
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Cerca modello..."
                className="bg-transparent outline-none text-sm text-white placeholder-gray-500 w-full"
              />
              {search && (
                <button onClick={() => setSearch('')}><X className="w-3.5 h-3.5" style={{ color: 'var(--color-surface-500)' }} /></button>
              )}
            </div>
            <div className="text-[10px] mt-2 px-1" style={{ color: 'var(--color-surface-600)' }}>
              {loading ? 'Caricamento modelli...' : `${filtered.length} modelli${search ? ' trovati' : ' disponibili'}`}
            </div>
          </div>

          {/* Models list */}
          <div className="overflow-y-auto" style={{ maxHeight: '300px', scrollbarWidth: 'thin' }}>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-5 h-5 animate-spin" style={{ color: '#a855f7' }} />
              </div>
            ) : filtered.length === 0 ? (
              <div className="py-8 text-center text-xs" style={{ color: 'var(--color-surface-500)' }}>Nessun modello trovato</div>
            ) : (
              filtered.map(m => {
                const isSelected = m.id === value
                return (
                  <button key={m.id}
                    onClick={() => { onChange(m.id); setOpen(false); setSearch('') }}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-white/[0.04]"
                    style={{
                      background: isSelected ? 'rgba(168,85,247,0.08)' : 'transparent',
                      borderBottom: '1px solid var(--color-surface-200)',
                    }}>
                    {isSelected ? (
                      <Check className="w-4 h-4 shrink-0" style={{ color: '#a855f7' }} />
                    ) : (
                      <div className="w-4 h-4 shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-white truncate">{m.name}</div>
                      <div className="text-[10px] font-mono truncate" style={{ color: 'var(--color-surface-500)' }}>{m.id}</div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-[10px] font-mono" style={{ color: '#22c55e' }}>{formatPrice(m.pricing.prompt)}</div>
                      <div className="text-[9px]" style={{ color: 'var(--color-surface-600)' }}>
                        {m.context_length > 0 ? `${(m.context_length / 1000).toFixed(0)}K ctx` : ''}
                      </div>
                    </div>
                  </button>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function FieldInput({ label, value, onChange, step }: {
  label: string; value: number; onChange: (v: number) => void; step?: number
}) {
  return (
    <div>
      <label className="text-[10px] uppercase tracking-wider font-semibold block mb-1.5" style={{ color: 'var(--color-surface-500)' }}>
        {label}
      </label>
      <input
        type="number"
        value={value}
        step={step || 1}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full px-3 py-2.5 rounded-lg text-sm font-bold text-white bg-transparent outline-none transition-all focus:shadow-[0_0_15px_rgba(168,85,247,0.1)]"
        style={{
          background: 'var(--color-surface-100)',
          border: '1px solid var(--color-surface-300)',
        }}
      />
    </div>
  )
}
