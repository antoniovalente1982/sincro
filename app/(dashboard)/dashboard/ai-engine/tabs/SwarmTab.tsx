'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Users, Bot, Zap, Plus, Settings, Terminal, Send, CheckCircle2 } from 'lucide-react'

export default function SwarmTab({ orgId }: { orgId: string }) {
  const [agents, setAgents] = useState<any[]>([])
  const [models, setModels] = useState<any[]>([])
  const [logs, setLogs] = useState<any[]>([])
  const [objective, setObjective] = useState('')
  const [targetAgent, setTargetAgent] = useState('CEO')
  const [sending, setSending] = useState(false)
  
  useEffect(() => {
    if (!orgId) return
    const fetchSwarm = async () => {
      const supabase = createClient()
      
      const { data: modelsData } = await supabase
        .from('ai_llm_models')
        .select('*')
        .order('input_cost_per_m', { ascending: true })
      
      if (modelsData) setModels(modelsData)

      const { data: agentsData } = await supabase
        .from('ai_agents')
        .select(`
          *,
          ai_llm_models (name, provider)
        `)
        .eq('organization_id', orgId)
      
      if (agentsData) setAgents(agentsData)

      const { data: logsData } = await supabase
        .from('ai_realtime_logs')
        .select('*, ai_agents!agent_id(name, role)')
        .eq('organization_id', orgId)
        .order('created_at', { ascending: false })
        .limit(20)

      if (logsData) setLogs(logsData)
    }
    
    fetchSwarm()
    const interval = setInterval(fetchSwarm, 5000) // Poll every 5s for realtime logs
    return () => clearInterval(interval)
  }, [orgId])

  const sendObjective = async () => {
    if (!objective.trim()) return
    setSending(true)
    const supabase = createClient()
    
    // Default to CEO, but if they specified someone else, we target them
    const agent = targetAgent === 'CEO' 
      ? agents.find(a => a.role === 'boss') 
      : agents.find(a => a.id === targetAgent)

    if (agent) {
      await supabase.from('ai_agents').update({ current_objective: objective }).eq('id', agent.id)
      // Log human intervention
      await supabase.from('ai_realtime_logs').insert({
        organization_id: orgId,
        action: 'human_directive',
        message: `Direttiva Umana: ${objective}`,
        target_agent_id: agent.id
      })
      setObjective('')
    }
    setSending(false)
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white mb-2">Team Swarm (CEO & Operativi)</h2>
          <p className="text-sm" style={{ color: 'var(--color-surface-400)' }}>
            Gestisci la whitelist dei modelli LLM ei tuoi agenti specializzati
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* --- Agents List & CEO Directives --- */}
        <div className="lg:col-span-2 space-y-6">

          {/* CEO Directives */}
          <div className="glass-card p-5" style={{ background: 'linear-gradient(135deg, rgba(168,85,247,0.05), rgba(99,102,241,0.05))', border: '1px solid rgba(168,85,247,0.2)' }}>
            <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-3">
              🎯 Assegna Direttiva / Nuovo Test
            </h3>
            <div className="flex gap-2">
              <input 
                type="text"
                placeholder="Es. 'Ottimizza i costi dell'angolo Status del 15% entro 2 giorni' oppure 'Crea landing B'"
                value={objective}
                onChange={e => setObjective(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && sendObjective()}
                className="flex-1 bg-[#18181b] border border-zinc-800 rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
              />
              <button 
                onClick={sendObjective}
                disabled={sending || !objective}
                className="btn-primary px-4 py-2 flex items-center gap-2 disabled:opacity-50"
              >
                <Send className="w-4 h-4" /> Invia
              </button>
            </div>
          </div>
          <div className="glass-card p-5">
            <div className="flex items-center justify-between mb-4">
               <h3 className="text-lg font-bold text-white flex items-center gap-2">
                 <Users className="w-5 h-5 text-indigo-400" />
                 Elenco Agenti
               </h3>
               <button className="btn-primary py-1.5 px-3 text-xs flex items-center gap-2">
                 <Plus className="w-3 h-3" /> Crea Agente
               </button>
            </div>
            
            {agents.length === 0 ? (
              <div className="text-center py-10" style={{ color: 'var(--color-surface-500)' }}>
                Nessun agente configurato per questa organizzazione.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {agents.map(agent => (
                  <div key={agent.id} className="p-4 rounded-xl" style={{ background: 'var(--color-surface-50)', border: '1px solid var(--color-surface-200)' }}>
                    <div className="flex justify-between items-start mb-2">
                      <div className="font-bold text-white">{agent.name}</div>
                      <div className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full" style={{ background: 'rgba(99,102,241,0.1)', color: '#818cf8'}}>
                        {agent.role}
                      </div>
                    </div>
                    <div className="text-xs mb-3" style={{ color: 'var(--color-surface-400)' }}>
                      Status: <span className={agent.status === 'working' ? 'text-emerald-400' : 'text-amber-400'}>{agent.status}</span>
                    </div>
                    {agent.ai_llm_models && (
                      <div className="text-[10px] flex items-center gap-1.5" style={{ color: 'var(--color-surface-500)' }}>
                        <Bot className="w-3 h-3" /> Modello: {agent.ai_llm_models.name}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* --- Realtime Log Terminal --- */}
          <div className="glass-card p-5 bg-[#09090b]">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Terminal className="w-4 h-4 text-emerald-400" />
                Live Swarm Terminal
              </h3>
              <div className="flex items-center gap-1.5 text-[10px] text-zinc-500 font-mono">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                POLLING ACTIVE
              </div>
            </div>
            
            <div className="space-y-3 font-mono text-[11px] h-64 overflow-y-auto pr-2 custom-scrollbar">
              {logs.length === 0 ? (
                <div className="text-zinc-600 italic">Nessun log operativo presente. The swarm is sleeping.</div>
              ) : (
                logs.map(log => (
                  <div key={log.id} className="pb-3 border-b border-zinc-800/50 flex gap-3">
                    <span className="text-zinc-500 whitespace-nowrap">
                      {new Date(log.created_at).toLocaleTimeString([], { hour12: false })}
                    </span>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`font-bold ${log.action === 'error' ? 'text-red-400' : 'text-indigo-400'}`}>
                          [{log.ai_agents?.name || 'SYSTEM'}]
                        </span>
                        <span className="text-emerald-300">→ {log.action.toUpperCase()}</span>
                      </div>
                      <div className="text-zinc-300 ml-1 leading-relaxed">
                        {log.message}
                      </div>
                      {log.tokens_used > 0 && (
                        <div className="text-amber-500/70 ml-1 mt-1 flex items-center gap-1">
                          <Zap className="w-3 h-3" />
                          {log.tokens_used} tokens usati (~${log.cost_incurred})
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* --- LLM Router Whitelist --- */}
        <div className="space-y-4">
          <div className="glass-card p-5">
            <h3 className="text-lg font-bold text-white flex items-center gap-2 mb-4">
              <Zap className="w-5 h-5 text-amber-400" />
              LLM Router (Whitelist)
            </h3>
            
            {models.length === 0 ? (
               <div className="text-sm py-4" style={{ color: 'var(--color-surface-500)' }}>
                 In attesa di migrazione database...
               </div>
            ) : (
              <div className="space-y-3">
                {models.map(model => (
                  <div key={model.id} className="flex flex-col gap-1 p-3 rounded-xl" style={{ background: 'var(--color-surface-50)', border: '1px solid var(--color-surface-200)' }}>
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-sm text-white">{model.name}</span>
                      {model.is_active ? (
                        <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                      ) : (
                        <span className="w-2 h-2 rounded-full bg-red-400"></span>
                      )}
                    </div>
                    <div className="text-[10px]" style={{ color: 'var(--color-surface-400)' }}>
                      Cost M-In: ${model.input_cost_per_m} | M-Out: ${model.output_cost_per_m}
                    </div>
                  </div>
                ))}
              </div>
            )}
            
            <div className="mt-4 pt-4 border-t" style={{ borderColor: 'var(--color-surface-200)' }}>
              <button className="text-xs text-indigo-400 flex items-center gap-1 hover:text-indigo-300">
                <Settings className="w-3 h-3" /> Configura Limiti di Spesa
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
