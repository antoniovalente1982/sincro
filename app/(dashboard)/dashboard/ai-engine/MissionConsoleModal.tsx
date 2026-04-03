'use client'

import React, { useState, useEffect } from 'react'
import { X, Save, Shield, Settings2, PlayCircle, BookOpen, Activity, AlertTriangle, Zap, Cpu } from 'lucide-react'

const LLM_MODELS = [
  { id: 'google/gemini-2.5-flash', label: 'Gemini 2.5 Flash', desc: 'Veloce, economico, ottimo per decisioni rapide', color: '#4285f4' },
  { id: 'google/gemini-2.5-pro', label: 'Gemini 2.5 Pro', desc: 'Ragionamento avanzato, analisi strategica profonda', color: '#0f9d58' },
  { id: 'anthropic/claude-sonnet-4', label: 'Claude Sonnet 4', desc: 'Analisi sfumata, eccellente per brief creativi', color: '#d97757' },
  { id: 'openai/gpt-4o', label: 'GPT-4o', desc: 'Polivalente, buon equilibrio velocità/qualità', color: '#10a37f' },
  { id: 'meta-llama/llama-4-maverick', label: 'Llama 4 Maverick', desc: 'Open source, sperimentale, costo zero', color: '#6366f1' },
]

interface MissionConsoleModalProps {
  isOpen: boolean;
  onClose: () => void;
  orgId: string | null;
  initialObjectives: any;
  initialExecutionMode: string;
  initialAutopilotActive: boolean;
  initialLlmModel?: string;
  onSaved: () => void;
}

export default function MissionConsoleModal({
  isOpen, onClose, orgId,
  initialObjectives, initialExecutionMode, initialAutopilotActive,
  initialLlmModel,
  onSaved
}: MissionConsoleModalProps) {
  const [activeTab, setActiveTab] = useState<'objectives' | 'system' | 'lexicon'>('objectives')
  
  const [objectives, setObjectives] = useState(initialObjectives || {})
  const [executionMode, setExecutionMode] = useState(initialExecutionMode)
  const [autopilotActive, setAutopilotActive] = useState(initialAutopilotActive)
  const [llmModel, setLlmModel] = useState(initialLlmModel || 'google/gemini-2.5-flash')
  
  const [isSaving, setIsSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [executingCron, setExecutingCron] = useState<string | null>(null)
  const [cronResult, setCronResult] = useState<{type: string, message: string} | null>(null)

  useEffect(() => {
    setObjectives(initialObjectives || {})
    setExecutionMode(initialExecutionMode)
    setAutopilotActive(initialAutopilotActive)
    setLlmModel(initialLlmModel || 'google/gemini-2.5-flash')
  }, [isOpen, initialObjectives, initialExecutionMode, initialAutopilotActive, initialLlmModel])

  if (!isOpen) return null

  const handleObjChange = (field: string, value: string | number) => {
    setObjectives((prev: any) => ({ ...prev, [field]: Number(value) }))
  }

  const handleSave = async () => {
    if (!orgId) return
    setIsSaving(true)
    setSaveSuccess(false)
    try {
      await fetch('/api/mission-control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action: 'set_mission_params', 
          org_id: orgId, 
          objectives, 
          execution_mode: executionMode, 
          autopilot_active: autopilotActive,
          llm_model: llmModel,
        })
      })
      
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 3000)
      onSaved()
    } catch (e) {
      console.error(e)
    } finally {
      setIsSaving(false)
    }
  }

  const forceCron = async (cronName: string) => {
    setExecutingCron(cronName)
    setCronResult(null)
    try {
      const res = await fetch('/api/mission-control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'force_cron', org_id: orgId, cron_name: cronName })
      })
      const data = await res.json()
      setCronResult({ type: res.ok ? 'success' : 'error', message: data.message || JSON.stringify(data) })
      onSaved()
    } catch (e: any) {
      setCronResult({ type: 'error', message: e.message })
    } finally {
      setExecutingCron(null)
    }
  }

  const selectedModel = LLM_MODELS.find(m => m.id === llmModel) || LLM_MODELS[0]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      
      <div className="relative w-full max-w-4xl max-h-[90vh] bg-[#0a0a1a]/90 backdrop-blur-xl border border-white/10 rounded-2xl shadow-[0_0_80px_rgba(168,85,247,0.15)] flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between" style={{ background: 'linear-gradient(90deg, rgba(168, 85, 247, 0.05), transparent)' }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #a855f7, #6366f1)' }}>
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white tracking-wide">MISSION CONSOLE</h2>
              <div className="text-[11px] font-mono text-indigo-400">AGENCY COMMAND & CONTROL</div>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-xl transition-colors">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex px-6 border-b border-white/5 bg-black/20">
          {[
            { id: 'objectives', icon: Settings2, label: 'Objectives & Model' },
            { id: 'system', icon: Activity, label: 'System Vitals' },
            { id: 'lexicon', icon: BookOpen, label: 'Data Lexicon' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-5 py-4 border-b-2 transition-all ${activeTab === tab.id ? 'border-[#a855f7] text-white bg-white/5' : 'border-transparent text-gray-500 hover:text-gray-300 hover:bg-white/[0.02]'}`}
            >
              <tab.icon className="w-4 h-4" />
              <span className="text-sm font-bold tracking-wide uppercase">{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Content Area */}
        <div className="p-6 flex-1 overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
          
          {/* TAB 1: OBJECTIVES */}
          {activeTab === 'objectives' && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4">
              
              {/* Autopilot + Model Row */}
              <div className="bg-white/[0.02] border border-white/5 p-5 rounded-xl">
                <h3 className="text-sm font-bold text-white mb-4 uppercase tracking-widest flex items-center gap-2">
                  <Zap className="w-4 h-4 text-amber-400" /> Execution State
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="text-xs text-gray-400 uppercase tracking-widest mb-2 flex">Global Autopilot Engine</label>
                    <div className="flex gap-2">
                      <button onClick={() => setAutopilotActive(true)} className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${autopilotActive ? 'bg-indigo-500 text-white' : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}>ENABLED</button>
                      <button onClick={() => setAutopilotActive(false)} className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${!autopilotActive ? 'bg-rose-500 text-white' : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}>DISABLED</button>
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 uppercase tracking-widest mb-2 flex">Action Mode</label>
                    <div className="flex gap-2">
                      <button onClick={() => setExecutionMode('dry_run')} className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${executionMode === 'dry_run' ? 'bg-amber-500 text-white' : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}>DRY RUN</button>
                      <button onClick={() => setExecutionMode('live')} className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${executionMode === 'live' ? 'bg-emerald-500 text-white' : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}>LIVE</button>
                    </div>
                  </div>
                </div>
              </div>

              {/* ── LLM MODEL SELECTOR ── */}
              <div className="bg-white/[0.02] border border-white/5 p-5 rounded-xl">
                <h3 className="text-sm font-bold text-white mb-4 uppercase tracking-widest flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-cyan-400" /> AI Model (via OpenRouter)
                </h3>
                <div className="grid grid-cols-1 gap-2">
                  {LLM_MODELS.map(model => {
                    const isSelected = llmModel === model.id
                    return (
                      <button
                        key={model.id}
                        onClick={() => setLlmModel(model.id)}
                        className={`w-full flex items-center gap-4 p-3 rounded-xl border transition-all text-left ${
                          isSelected 
                            ? 'border-[#a855f7]/50 bg-[#a855f7]/10 shadow-[0_0_20px_rgba(168,85,247,0.1)]' 
                            : 'border-white/5 bg-white/[0.01] hover:bg-white/[0.04] hover:border-white/10'
                        }`}
                      >
                        <div
                          className={`w-3 h-3 rounded-full shrink-0 transition-all ${isSelected ? 'scale-110' : 'opacity-50'}`}
                          style={{ backgroundColor: model.color, boxShadow: isSelected ? `0 0 12px ${model.color}80` : 'none' }}
                        />
                        <div className="flex-1 min-w-0">
                          <div className={`text-sm font-bold ${isSelected ? 'text-white' : 'text-gray-300'}`}>{model.label}</div>
                          <div className="text-[10px] text-gray-500 truncate">{model.desc}</div>
                        </div>
                        {isSelected && (
                          <div className="text-[10px] font-mono text-[#a855f7] bg-[#a855f7]/10 px-2 py-0.5 rounded-full shrink-0">ACTIVE</div>
                        )}
                      </button>
                    )
                  })}
                </div>
                <div className="mt-3 text-[10px] text-gray-500 font-mono">
                  Modello attivo: <span className="text-cyan-400">{selectedModel.label}</span> — usato dal Loop, dalla Chat e dalla Weekly Review.
                </div>
              </div>

              {/* Economic Targets */}
              <div className="bg-white/[0.02] border border-white/5 p-5 rounded-xl">
                <h3 className="text-sm font-bold text-white mb-4 uppercase tracking-widest">Financial Targets</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase tracking-widest text-gray-400">Weekly Budget (€)</label>
                    <input type="number" value={objectives?.weekly_spend_budget || 0} onChange={e => handleObjChange('weekly_spend_budget', e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white font-mono text-sm focus:border-indigo-500 focus:outline-none" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase tracking-widest text-gray-400">Target CAC (€)</label>
                    <input type="number" value={objectives?.target_cac || 0} onChange={e => handleObjChange('target_cac', e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white font-mono text-sm focus:border-indigo-500 focus:outline-none" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase tracking-widest text-gray-400">Target CPL (€)</label>
                    <input type="number" value={objectives?.target_cpl || 0} onChange={e => handleObjChange('target_cpl', e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white font-mono text-sm focus:border-indigo-500 focus:outline-none" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase tracking-widest text-gray-400">Target ROAS (x)</label>
                    <input type="number" step="0.1" value={objectives?.target_roas || 0} onChange={e => handleObjChange('target_roas', e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white font-mono text-sm focus:border-indigo-500 focus:outline-none" />
                  </div>
                </div>
              </div>

              {/* Volume Targets */}
              <div className="bg-white/[0.02] border border-white/5 p-5 rounded-xl">
                <h3 className="text-sm font-bold text-white mb-4 uppercase tracking-widest">Volume Targets</h3>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                   <div className="space-y-1">
                    <label className="text-[10px] uppercase tracking-widest text-gray-400">Weekly Leads</label>
                    <input type="number" value={objectives?.weekly_leads_target || 0} onChange={e => handleObjChange('weekly_leads_target', e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white font-mono text-sm focus:border-indigo-500 focus:outline-none" />
                  </div>
                   <div className="space-y-1">
                    <label className="text-[10px] uppercase tracking-widest text-gray-400">Weekly Appts</label>
                    <input type="number" value={objectives?.weekly_appointments_target || 0} onChange={e => handleObjChange('weekly_appointments_target', e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white font-mono text-sm focus:border-indigo-500 focus:outline-none" />
                  </div>
                   <div className="space-y-1">
                    <label className="text-[10px] uppercase tracking-widest text-gray-400">Weekly Showups</label>
                    <input type="number" value={objectives?.weekly_showup_target || 0} onChange={e => handleObjChange('weekly_showup_target', e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white font-mono text-sm focus:border-indigo-500 focus:outline-none" />
                  </div>
                   <div className="space-y-1">
                    <label className="text-[10px] uppercase tracking-widest text-gray-400">Weekly Sales</label>
                    <input type="number" value={objectives?.weekly_sales_target || 0} onChange={e => handleObjChange('weekly_sales_target', e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white font-mono text-sm focus:border-indigo-500 focus:outline-none" />
                  </div>
                </div>
              </div>

              {/* Save */}
              <div className="flex justify-end pt-4">
                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="flex items-center gap-2 px-6 py-3 rounded-xl font-bold bg-[#a855f7] hover:bg-white text-white hover:text-[#0a0a1a] transition-all disabled:opacity-50"
                  style={{ boxShadow: '0 0 20px rgba(168,85,247,0.3)' }}
                >
                  {isSaving ? 'Sincronizzazione...' : saveSuccess ? '✅ Parametri Salvati' : 'Salva Parametri Missione'}
                  {!isSaving && !saveSuccess && <Save className="w-4 h-4" />}
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: SYSTEM VITALS */}
          {activeTab === 'system' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
              
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 flex gap-4 mt-2">
                <AlertTriangle className="w-6 h-6 text-amber-500 shrink-0" />
                <p className="text-sm text-amber-100">
                  <strong className="text-amber-400 block mb-1">Area Operativa Manuale</strong>
                  Questi bottoni forzano l'esecuzione immediata dei cron, scavalcando la programmazione di Vercel. Se il modo è &quot;Live&quot;, l'agente <strong>eseguirà azioni reali</strong> su Meta Ads.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* Agent Loop (unified) */}
                <div className="bg-white/[0.02] border border-white/5 p-5 rounded-xl">
                   <div className="flex items-center gap-3 mb-2">
                     <Brain className="w-5 h-5 text-purple-500" />
                     <h3 className="font-bold text-white text-sm">Agent Loop (Unificato)</h3>
                   </div>
                   <p className="text-xs text-gray-400 mb-4 h-12">Il cuore dell'agente: legge dati Meta + CRM, calcola gli score, esegue Kill Guardian + Scaling, formula ipotesi LLM.</p>
                   <button 
                     onClick={() => forceCron('agent-loop')}
                     disabled={executingCron !== null}
                     className="w-full py-2 bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 border border-purple-500/30 rounded-lg text-xs font-bold font-mono tracking-widest transition-all flex items-center justify-center gap-2"
                   >
                     <PlayCircle className="w-4 h-4" /> 
                     {executingCron === 'agent-loop' ? 'EXECUTING...' : 'FORZA INTELLIGENZA'}
                   </button>
                </div>

                {/* Daily Snapshot */}
                <div className="bg-white/[0.02] border border-white/5 p-5 rounded-xl">
                   <div className="flex items-center gap-3 mb-2">
                     <Shield className="w-5 h-5 text-cyan-500" />
                     <h3 className="font-bold text-white text-sm">Daily Snapshot</h3>
                   </div>
                   <p className="text-xs text-gray-400 mb-4 h-12">Salva lo snapshot giornaliero di spesa, lead e funnel CRM. Usato per i trend settimanali e l'HUD.</p>
                   <button 
                     onClick={() => forceCron('daily-snapshot')}
                     disabled={executingCron !== null}
                     className="w-full py-2 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 rounded-lg text-xs font-bold font-mono tracking-widest transition-all flex items-center justify-center gap-2"
                   >
                     <PlayCircle className="w-4 h-4" /> 
                     {executingCron === 'daily-snapshot' ? 'EXECUTING...' : 'FORZA SNAPSHOT'}
                   </button>
                </div>

                {/* Weekly Review */}
                <div className="bg-white/[0.02] border border-white/5 p-5 rounded-xl">
                   <div className="flex items-center gap-3 mb-2">
                     <Zap className="w-5 h-5 text-amber-500" />
                     <h3 className="font-bold text-white text-sm">Weekly Review</h3>
                   </div>
                   <p className="text-xs text-gray-400 mb-4 h-12">Revisione settimanale con North Star Δ, analisi LLM e report strategico Telegram.</p>
                   <button 
                     onClick={() => forceCron('weekly-review')}
                     disabled={executingCron !== null}
                     className="w-full py-2 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-lg text-xs font-bold font-mono tracking-widest transition-all flex items-center justify-center gap-2"
                   >
                     <PlayCircle className="w-4 h-4" /> 
                     {executingCron === 'weekly-review' ? 'EXECUTING...' : 'FORZA REVIEW'}
                   </button>
                </div>

                {/* Ads Monitor */}
                <div className="bg-white/[0.02] border border-white/5 p-5 rounded-xl">
                   <div className="flex items-center gap-3 mb-2">
                     <Activity className="w-5 h-5 text-emerald-500" />
                     <h3 className="font-bold text-white text-sm">Ads Global Monitor</h3>
                   </div>
                   <p className="text-xs text-gray-400 mb-4 h-12">Sincronizza dati ads in tempo reale da Meta: spesa, impression, clic.</p>
                   <button 
                     onClick={() => forceCron('ads-monitor')}
                     disabled={executingCron !== null}
                     className="w-full py-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-lg text-xs font-bold font-mono tracking-widest transition-all flex items-center justify-center gap-2"
                   >
                     <PlayCircle className="w-4 h-4" /> 
                     {executingCron === 'ads-monitor' ? 'EXECUTING...' : 'FORZA SYNC'}
                   </button>
                </div>

              </div>

              {cronResult && (
                <div className={`mt-6 p-4 border rounded-xl text-xs font-mono break-all ${cronResult.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300' : 'bg-rose-500/10 border-rose-500/20 text-rose-300'}`}>
                  {'>'} {cronResult.message}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: DATA LEXICON */}
          {activeTab === 'lexicon' && (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 text-sm">
               <div className="bg-white/[0.02] border border-white/5 rounded-xl p-5 space-y-4">
                 <div>
                   <h4 className="text-white font-bold mb-1">Budget Spent</h4>
                   <p className="text-gray-400">Somma reale spesa estratta via API ufficiale da <strong>Meta Ads</strong> nell&apos;intervallo &quot;ultimi 7 giorni&quot;.</p>
                 </div>
                 <hr className="border-white/5" />
                 <div>
                   <h4 className="text-white font-bold mb-1">Actual CAC (Cost Acquisition Customer)</h4>
                   <p className="text-gray-400">Calcolato: (Totale Budget Speso Ads) / (Vendite nel <strong>CRM locale</strong> marcate come &quot;Vinte&quot;). Convergenza Cross-Channel.</p>
                 </div>
                 <hr className="border-white/5" />
                 <div>
                   <h4 className="text-white font-bold mb-1">Angle Radar (Score -1.0 → +1.0)</h4>
                   <p className="text-gray-400">L&apos;agente rileva l&apos;angolo persuasivo dalla naming convention dell&apos;Ad. Associa metriche Meta + conversioni CRM per generare uno score composito (CPL 25%, CAC 35%, L→A rate 20%, CTR 10%).</p>
                 </div>
                 <hr className="border-white/5" />
                 <div>
                   <h4 className="text-white font-bold mb-1">NorthStar Δ</h4>
                   <p className="text-gray-400">Gap tracking tra la posizione attuale e gli obiettivi NorthStar. Misura budget consumption, CAC vs target, capacità venditori, e pace mensile vendite.</p>
                 </div>
                 <hr className="border-white/5" />
                 <div>
                   <h4 className="text-white font-bold mb-1">Agent Loop (Kill + Scale)</h4>
                   <p className="text-gray-400">Il loop unificato ogni 4h: (1) valuta esperimenti passati, (2) legge Meta+CRM, (3) calcola score, (4) elimina ads con spesa &gt; 3×CPL target e 0 lead, (5) scala budget +20% per angoli con score &gt; 0.45. Tutto in un unico ciclo.</p>
                 </div>
                 <hr className="border-white/5" />
                 <div>
                   <h4 className="text-white font-bold mb-1">Modello LLM</h4>
                   <p className="text-gray-400">Il modello AI usato per generare ipotesi strategiche, weekly review e risposte in chat. Selezionabile per fare A/B testing tra provider diversi (Gemini, Claude, GPT, Llama).</p>
                 </div>
               </div>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}

function Brain(props: any) {
  return <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-brain"><path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z"/><path d="M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z"/><path d="M15 13a4.5 4.5 0 0 1-3-4 4.5 4.5 0 0 1-3 4"/><path d="M17.599 6.5a3 3 0 0 0 .399-1.375"/><path d="M6.003 5.125A3 3 0 0 0 6.401 6.5"/><path d="M3.477 10.896a4 4 0 0 1 .585-.396"/><path d="M19.938 10.5a4 4 0 0 1 .585.396"/><path d="M6 18a4 4 0 0 1-1.967-.516"/><path d="M19.967 17.484A4 4 0 0 1 18 18"/></svg>
}
