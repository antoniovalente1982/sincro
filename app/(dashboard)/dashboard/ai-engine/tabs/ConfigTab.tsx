'use client'

import { useState, useEffect } from 'react'
import {
  Settings2, Shield, Zap, Save, Loader2, Brain, DollarSign, Target, Users,
  RefreshCw, AlertTriangle, Cpu
} from 'lucide-react'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface Props {
  data: any
  orgId: string
  onSaved: () => void
}

export default function ConfigTab({ data, orgId, onSaved }: Props) {
  const { objectives, execution_mode, autopilot_active, llm_model } = data

  // Form state — use ?? to preserve falsy values
  const [mode, setMode] = useState(execution_mode ?? 'dry_run')
  const [selectedModel, setSelectedModel] = useState(llm_model ?? 'xiaomi/mimo-v2-pro')
  const [autopilot, setAutopilot] = useState(autopilot_active ?? false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [cronRunning, setCronRunning] = useState<string | null>(null)

  // North Star Base Inputs
  const [baseFatturato, setBaseFatturato] = useState(objectives?.base_fatturato ?? 50000)
  const [basePrezzo, setBasePrezzo] = useState(objectives?.base_prezzo ?? 2250)
  const [baseLeadToAppt, setBaseLeadToAppt] = useState(objectives?.base_lead_to_appt ?? 40)
  const [baseApptToShowup, setBaseApptToShowup] = useState(objectives?.base_appt_to_showup ?? 60)
  const [baseShowupToSale, setBaseShowupToSale] = useState(objectives?.base_showup_to_sale ?? 20)
  const [baseCacTarget, setBaseCacTarget] = useState(objectives?.base_cac_target ?? 300)
  const [baseCpl, setBaseCpl] = useState(objectives?.base_cpl ?? 15)

  const [isInitialized, setIsInitialized] = useState(false)

  // Sync basic state only on initial mount or when data becomes available
  useEffect(() => {
    if (data && !isInitialized) {
      setMode(execution_mode ?? 'dry_run')
      setSelectedModel(llm_model ?? 'xiaomi/mimo-v2-pro')
      setAutopilot(autopilot_active ?? false)

      setBaseFatturato(objectives?.base_fatturato ?? 50000)
      setBasePrezzo(objectives?.base_prezzo ?? 2250)
      setBaseLeadToAppt(objectives?.base_lead_to_appt ?? 40)
      setBaseApptToShowup(objectives?.base_appt_to_showup ?? 60)
      setBaseShowupToSale(objectives?.base_showup_to_sale ?? 20)
      setBaseCacTarget(objectives?.base_cac_target ?? 300)
      setBaseCpl(objectives?.base_cpl ?? 15)
      
      setIsInitialized(true)
    }
  }, [data, isInitialized, execution_mode, llm_model, autopilot_active, objectives])

  // Derive all variables dynamically (Flow: Lead -> Appt -> ShowUp -> Vendita)
  const clientiMensili = basePrezzo > 0 ? Math.ceil(baseFatturato / basePrezzo) : 0
  const showupsMensili = baseShowupToSale > 0 ? Math.ceil(clientiMensili / (baseShowupToSale / 100)) : 0
  const apptMensili = baseApptToShowup > 0 ? Math.ceil(showupsMensili / (baseApptToShowup / 100)) : 0
  const leadMensili = baseLeadToAppt > 0 ? Math.ceil(apptMensili / (baseLeadToAppt / 100)) : 0

  const weeklySales = Math.ceil(clientiMensili / 4)
  const weeklyShowups = Math.ceil(showupsMensili / 4)
  const weeklyAppts = Math.ceil(apptMensili / 4)
  const weeklyLeads = Math.ceil(leadMensili / 4)

  const budgetMensile = baseCacTarget * clientiMensili
  const weeklyBudget = budgetMensile / 4
  const expectedCac = clientiMensili > 0 ? Math.round((baseCpl * leadMensili) / clientiMensili) : 0
  const spesaEffettiva = baseCpl * leadMensili
  const targetRoas = spesaEffettiva > 0 ? +(baseFatturato / spesaEffettiva).toFixed(2) : 0

  // Hermes Connection Status & Logs
  const [hermesStatus, setHermesStatus] = useState<'checking' | 'online' | 'offline'>('checking')
  const [hermesLogs, setHermesLogs] = useState<string[]>([])

  // OpenRouter Dynamic Models
  const [openRouterModels, setOpenRouterModels] = useState<{id: string, name: string}[]>([])

  useEffect(() => {
    fetch('https://openrouter.ai/api/v1/models')
      .then(res => res.json())
      .then(data => {
        if (data && data.data) {
          const sortedModels = data.data.sort((a: any, b: any) => a.name.localeCompare(b.name))
          setOpenRouterModels(sortedModels)
        }
      })
      .catch(console.error)
  }, [])

  useEffect(() => {
    const checkHermes = async () => {
      try {
        const res = await fetch('/api/hermes/status')
        setHermesStatus(res.ok ? 'online' : 'offline')
        if (res.ok) {
          const logsRes = await fetch('/api/hermes/logs')
          if (logsRes.ok) {
            const logsData = await logsRes.json()
            setHermesLogs(logsData.logs || [])
          }
        }
      } catch {
        setHermesStatus('offline')
      }
    }
    checkHermes()
    // Check every 30 seconds
    const interval = setInterval(checkHermes, 30000)
    return () => clearInterval(interval)
  }, [])

  const handleSave = async () => {
    setSaving(true)
    setSaveError(null)
    setSaved(false)
    try {
      const res = await fetch('/api/mission-control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'set_mission_params',
          org_id: orgId,
          execution_mode: mode,
          autopilot_active: autopilot,
          llm_model: selectedModel,
          objectives: {
            base_fatturato: baseFatturato,
            base_prezzo: basePrezzo,
            base_lead_to_appt: baseLeadToAppt,
            base_appt_to_showup: baseApptToShowup,
            base_showup_to_sale: baseShowupToSale,
            base_cac_target: baseCacTarget,
            base_cpl: baseCpl,
            weekly_spend_budget: weeklyBudget,
            target_cac: baseCacTarget,
            target_cpl: baseCpl,
            target_roas: targetRoas,
            weekly_leads_target: weeklyLeads,
            weekly_appointments_target: weeklyAppts,
            weekly_showup_target: weeklyShowups,
            weekly_sales_target: weeklySales,
          },
        }),
      })
      if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: 'Errore sconosciuto' }))
        throw new Error(errData.error || `HTTP ${res.status}`)
      }
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
      onSaved()
    } catch (err: any) {
      console.error('Save failed:', err)
      setSaveError(err.message || 'Errore nel salvataggio')
      setTimeout(() => setSaveError(null), 5000)
    }
    setSaving(false)
  }

  const handleForceCron = async (cron: string) => {
    setCronRunning(cron)
    try {
      const res = await fetch('/api/mission-control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'force_cron', org_id: orgId, cron_name: cron }),
      })
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        console.error(`Cron ${cron} failed:`, errData)
      }
    } catch (err) {
      console.error(`Cron ${cron} error:`, err)
    }
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
          {/* LLM Model Selection */}
          <div className="glass-card p-5 border-[1px] border-purple-500/20">
            <div className="flex items-center gap-2 mb-4">
              <Brain className="w-4 h-4" style={{ color: '#a855f7' }} />
              <h3 className="text-sm font-bold text-white">Modello LLM (Routing VPS)</h3>
            </div>
            <div className="relative">
              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                className="w-full bg-black/40 border border-white/5 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-purple-500/50 appearance-none transition-colors cursor-pointer"
              >
                {!openRouterModels.length ? (
                  <>
                    <option value="xiaomi/mimo-v2-pro">MiMo V2 Pro (Ragionamento)</option>
                    <option value="google/gemini-2.5-flash">Gemini 2.5 Flash (Veloce)</option>
                    <option value="google/gemini-2.5-pro">Gemini 2.5 Pro (Avanzato)</option>
                    <option value="anthropic/claude-3.7-sonnet">Claude 3.7 Sonnet (Ottimizzato)</option>
                    <option value="meta-llama/llama-3.3-70b-instruct">Llama 3.3 70B (Open-Source)</option>
                  </>
                ) : (
                  <>
                    {/* Keep current active model if it is not in the list for some reason */}
                    {!openRouterModels.find((m: any) => m.id === selectedModel) && selectedModel && (
                      <option value={selectedModel}>{selectedModel}</option>
                    )}
                    {openRouterModels.map((m: any) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </>
                )}
              </select>
              <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-500">
                ▼
              </div>
            </div>
            <p className="text-[10px] text-gray-400 mt-3 italic">
              Il nodo Hermes sulla tua VPS utilizzerà questa API tramite OpenRouter.
            </p>
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
              Se il modo è &quot;Live&quot;, le azioni sono REALI su Meta Ads
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
          {/* North Star Bases */}
          <div className="glass-card p-5 border-[1px] border-blue-500/20">
            <div className="flex items-center gap-2 mb-2">
               <Target className="w-4 h-4" style={{ color: '#3b82f6' }} />
               <h3 className="text-sm font-bold text-white">North Star Base Objectives</h3>
            </div>
            <div className="mb-4 p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
               <p className="text-[11px] text-blue-200/80 leading-relaxed italic">
                 <strong className="text-blue-400">Nota Strategica:</strong> Questi parametri rappresentano la Baseline minima accettabile. L'obiettivo primario di tutti gli agenti (Hermes e Andromeda) è sfruttare il Continuous Learning e l'autoapprendimento per <strong>battere questi obiettivi</strong> il prima possibile (es. abbattere il CAC, alzare i tassi di conversione).
               </p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <FieldInput label="Fatturato Mensile (€)" value={baseFatturato} onChange={setBaseFatturato} />
              <FieldInput label="Ticket Medio (€)" value={basePrezzo} onChange={setBasePrezzo} />
              <FieldInput label="Target CAC (€)" value={baseCacTarget} onChange={setBaseCacTarget} />
              <FieldInput label="CPL Stimato (€)" value={baseCpl} onChange={setBaseCpl} />
            </div>
            <div className="mt-4 pt-4 border-t border-white/5">
               <h4 className="text-[10px] uppercase text-gray-500 mb-3 font-semibold">Tassi di Conversione (%)</h4>
               <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                 <FieldInput label="Lead ➔ Appuntamento Preso" value={baseLeadToAppt} onChange={setBaseLeadToAppt} />
                 <FieldInput label="Appuntamento ➔ Show-Up" value={baseApptToShowup} onChange={setBaseApptToShowup} />
                 <FieldInput label="Show-Up ➔ Vendita Chiusa" value={baseShowupToSale} onChange={setBaseShowupToSale} />
               </div>
            </div>
          </div>

          {/* Derived Targets (Read-only) */}
          <div className="glass-card p-5">
            <div className="flex items-center gap-2 mb-4">
               <DollarSign className="w-4 h-4" style={{ color: '#22c55e' }} />
               <h3 className="text-sm font-bold text-white">Financial Targets (Auto-Generated)</h3>
            </div>
            <div className="grid grid-cols-2 gap-4 mb-4">
               <ReadOnlyField label="Budget Mensile" value={`€ ${budgetMensile.toLocaleString('it-IT')}`} />
               <ReadOnlyField label="Budget Settimanale" value={`€ ${weeklyBudget.toLocaleString('it-IT')}`} />
               <ReadOnlyField label="Cac Reale (Stimato)" value={`€ ${expectedCac.toLocaleString('it-IT')}`} />
               <ReadOnlyField label="ROAS Stimato" value={`${targetRoas}x`} />
            </div>
            
            <div className="flex items-center gap-2 mb-4 pt-4 border-t border-white/5">
              <Users className="w-4 h-4" style={{ color: '#f59e0b' }} />
              <h3 className="text-sm font-bold text-white">Volume Targets (Weekly)</h3>
            </div>
            <div className="grid grid-cols-2 gap-4">
               <ReadOnlyField label="Lead da Generare" value={weeklyLeads.toLocaleString('it-IT')} />
               <ReadOnlyField label="Appuntamenti Fissati" value={weeklyAppts.toLocaleString('it-IT')} />
               <ReadOnlyField label="Appuntamenti (Show-up)" value={weeklyShowups.toLocaleString('it-IT')} />
               <ReadOnlyField label="Vendite Chiuse" value={weeklySales.toLocaleString('it-IT')} />
            </div>
          </div>

          {/* Save Button */}
          <button onClick={handleSave} disabled={saving}
            className="w-full py-3.5 rounded-xl text-sm font-bold text-white flex items-center justify-center gap-2 transition-all hover:scale-[1.01] disabled:opacity-60"
            style={{
              background: saved ? 'linear-gradient(135deg, #22c55e, #16a34a)' : saveError ? 'linear-gradient(135deg, #ef4444, #dc2626)' : 'linear-gradient(135deg, #a855f7, #6366f1)',
              boxShadow: saved ? '0 4px 20px rgba(34,197,94,0.3)' : saveError ? '0 4px 20px rgba(239,68,68,0.3)' : '0 4px 20px rgba(168,85,247,0.3)',
            }}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saving ? 'Salvando...' : saved ? '✅ Salvato!' : saveError ? `❌ ${saveError}` : '💾 Salva Configurazione'}
          </button>
        </div>
      </div>

      {/* Hermes Realtime Console */}
      <div className="glass-card p-6 flex flex-col h-[350px] mb-8 mt-8 border-[1px] border-green-500/20">
          <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${hermesStatus === 'online' ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
                  <h2 className="text-sm font-bold text-white flex items-center gap-2">
                      <Cpu className="w-4 h-4 text-green-400"/> Hermes Live Engine Console
                  </h2>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded" style={{
                      background: 'rgba(34, 197, 94, 0.1)', color: '#22c55e', border: '1px solid rgba(34, 197, 94, 0.3)'
                  }}>
                      live feed VPS
                  </span>
              </div>
          </div>
          
          <div className="flex-1 bg-black rounded-xl p-4 font-mono text-[10px] sm:text-xs overflow-y-auto" style={{ border: '1px solid var(--color-surface-200)' }}>
              <div className="text-green-500/70 mb-2">Hermes Node: connection {hermesStatus === 'online' ? 'established' : 'failed'}.</div>
              {hermesStatus === 'online' && <div className="text-green-500/70 mb-4">System ready... awaiting tasks from Vercel CRON.</div>}
              
              {hermesLogs.map((logLine, idx) => (
                  <div key={idx} className="text-white mt-1">
                      {logLine.includes('[Orchestrator]') ? (
                          <><span className="text-blue-400">[{new Date().toLocaleTimeString('it-IT')}] </span><span className="text-purple-400">[Orchestrator] </span>{logLine.replace('[Orchestrator]', '')}</>
                      ) : logLine.includes('[MediaBuyer]') ? (
                          <><span className="text-blue-400">[{new Date().toLocaleTimeString('it-IT')}] </span><span className="text-yellow-400">[MediaBuyer] </span>{logLine.replace('[MediaBuyer]', '')}</>
                      ) : logLine.includes('[System]') ? (
                          <><span className="text-blue-400">[{new Date().toLocaleTimeString('it-IT')}] </span><span className="text-gray-400">[System] </span>{logLine.replace('[System]', '')}</>
                      ) : (
                          <><span className="text-blue-400">[{new Date().toLocaleTimeString('it-IT')}] </span><span className="text-green-400">[Out] </span>{logLine}</>
                      )}
                  </div>
              ))}
              
              {hermesLogs.length === 0 && hermesStatus === 'online' && (
                  <div className="text-gray-500 italic mt-4">Nessun log recente ricevuto dal nodo. In attesa di elaborazioni...</div>
              )}

              {hermesStatus === 'offline' && (
                  <div className="mt-4 text-red-500">
                      <span className="text-blue-400">[{new Date().toLocaleTimeString('it-IT')}] </span>
                      Connection lost: No response from Hermes API. (La VPS è irraggiungibile)
                  </div>
              )}
              <div className="animate-pulse mt-1 text-gray-500">_</div>
          </div>
      </div>

    </div>
  )
}

function FieldInput({ label, value, onChange, step }: {
  label: string; value: number; onChange: (v: number) => void; step?: number
}) {
  const [displayValue, setDisplayValue] = useState(String(value))
  
  // Sync display when external value changes
  useEffect(() => {
    setDisplayValue(String(value))
  }, [value])

  return (
    <div>
      <label className="text-[10px] uppercase tracking-wider font-semibold block mb-1.5" style={{ color: 'var(--color-surface-500)' }}>
        {label}
      </label>
      <input
        type="text"
        inputMode="decimal"
        value={displayValue}
        onFocus={e => e.target.select()}
        onChange={e => {
          const raw = e.target.value
          // Allow empty, digits, and decimal point only
          if (raw === '' || /^[0-9]*\.?[0-9]*$/.test(raw)) {
            setDisplayValue(raw)
            const num = parseFloat(raw)
            if (!isNaN(num)) onChange(num)
          }
        }}
        onBlur={() => {
          // On blur, ensure we have a valid number displayed
          const num = parseFloat(displayValue)
          if (isNaN(num) || displayValue === '') {
            setDisplayValue('0')
            onChange(0)
          } else {
            setDisplayValue(String(num)) // Remove trailing dots etc.
          }
        }}
        className="w-full px-3 py-2.5 rounded-lg text-sm font-bold text-white bg-transparent outline-none transition-all focus:shadow-[0_0_15px_rgba(168,85,247,0.1)]"
        style={{
          background: 'var(--color-surface-100)',
          border: '1px solid var(--color-surface-300)',
        }}
      />
    </div>
  )
}

function ReadOnlyField({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <label className="text-[10px] uppercase tracking-wider font-semibold block mb-1.5" style={{ color: 'var(--color-surface-500)' }}>
        {label}
      </label>
      <div className="w-full px-3 py-2.5 rounded-lg text-sm font-bold text-white outline-none"
        style={{
          background: 'var(--color-surface-100)',
          border: '1px solid var(--color-surface-300)',
        }}>
        {value}
      </div>
    </div>
  )
}
