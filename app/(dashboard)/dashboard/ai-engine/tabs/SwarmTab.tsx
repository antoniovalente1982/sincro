'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Users, Bot, Zap, Plus, Settings } from 'lucide-react'

export default function SwarmTab({ orgId }: { orgId: string }) {
  const [agents, setAgents] = useState<any[]>([])
  const [models, setModels] = useState<any[]>([])
  
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
    }
    
    fetchSwarm()
  }, [orgId])

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
        
        {/* --- Agents List --- */}
        <div className="lg:col-span-2 space-y-4">
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
