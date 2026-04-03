'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Activity, Target, Zap, Shield, TrendingUp, AlertTriangle, Settings2 } from 'lucide-react'
import MissionConsoleModal from './MissionConsoleModal'

// Mapped from MissionControl
interface MissionData {
  objectives: any
  execution_mode: string
  autopilot_active: boolean
  weekly_totals: any
  progress: any
  kpi: any
  angle_scores: any[]
  strategy_log: any[]
  week_label: string
}

export default function AgentHUD() {
  const [orgId, setOrgId] = useState<string | null>(null)
  const [data, setData] = useState<MissionData | null>(null)
  const [loading, setLoading] = useState(true)
  const [showConsole, setShowConsole] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data: authData }) => {
      if (!authData?.user) return
      const { data: member } = await supabase
        .from('organization_members')
        .select('organization_id')
        .eq('user_id', authData.user.id)
        .single()
      if (member?.organization_id) setOrgId(member.organization_id)
    })
  }, [])

  const fetchData = useCallback(async () => {
    if (!orgId) return
    try {
      const res = await fetch(`/api/mission-control?orgId=${orgId}`)
      const json = await res.json()
      setData(json)
    } catch { }
    setLoading(false)
  }, [orgId])

  useEffect(() => { fetchData() }, [fetchData])
  useEffect(() => {
    const t = setInterval(fetchData, 60000) // refresh every 1 minute for HUD
    return () => clearInterval(t)
  }, [fetchData])

  if (loading) {
    return (
      <div className="h-full w-full flex flex-col items-center justify-center bg-[#0a0a1a]/80 backdrop-blur-md">
        <Activity className="w-8 h-8 text-[#a855f7] animate-pulse mb-4" />
        <div className="text-xs font-mono text-[#a855f7] tracking-widest animate-pulse">INITIALIZING HUD...</div>
      </div>
    )
  }

  if (!data) return null;

  const { kpi, angle_scores, strategy_log, weekly_totals, progress, execution_mode } = data

  return (
    <div className="flex flex-col h-full w-full bg-[#0a0a1a]/60 backdrop-blur-2xl overflow-y-auto" style={{
      scrollbarWidth: 'none'
    }}>
      {/* ── STATUS BAR ── */}
      <div className="p-5 border-b border-white/5 flex items-center justify-between sticky top-0 bg-[#0a0a1a]/95 backdrop-blur z-10">
        <div className="flex items-center gap-3">
          <Shield className="w-5 h-5 text-indigo-400" />
          <span className="text-sm font-bold text-white tracking-wider">SYSTEM STATUS</span>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => setShowConsole(true)} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs font-bold text-gray-300 transition-colors border border-white/10">
            <Settings2 className="w-3.5 h-3.5" /> CONSOLE
          </button>
          <div className="flex items-center gap-2">
            <span className="relative flex h-3 w-3">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${execution_mode === 'live' ? 'bg-emerald-400' : 'bg-amber-400'}`}></span>
              <span className={`relative inline-flex rounded-full h-3 w-3 ${execution_mode === 'live' ? 'bg-emerald-500' : 'bg-amber-500'}`}></span>
            </span>
            <span className={`text-xs font-mono font-bold ${execution_mode === 'live' ? 'text-emerald-400' : 'text-amber-400'}`}>
              {execution_mode.toUpperCase()}
            </span>
          </div>
        </div>
      </div>

      <div className="p-5 space-y-6">
        {/* ── CORE METRICS HUD ── */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Target className="w-4 h-4 text-indigo-400" />
            <h3 className="text-xs font-mono text-indigo-400 tracking-wider">CORE METRICS (WEEK)</h3>
          </div>
          
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white/[0.02] border border-white/10 rounded-xl p-3">
              <div className="text-[10px] uppercase tracking-wider text-gray-400 mb-1">Budget Spent</div>
              <div className="flex items-end gap-2">
                <div className="text-xl font-bold text-white tracking-tight">€{weekly_totals.spend?.toFixed(0) || 0}</div>
                <div className="text-[10px] text-gray-500 pb-1 mb-0.5">/ €{data.objectives?.weekly_spend_budget}</div>
              </div>
              <div className="w-full bg-black/40 h-1 mt-2 rounded-full overflow-hidden">
                <div className="bg-indigo-500 h-full" style={{ width: `${Math.min(progress.spend_pct || 0, 100)}%` }} />
              </div>
            </div>

            <div className="bg-white/[0.02] border border-white/10 rounded-xl p-3">
              <div className="text-[10px] uppercase tracking-wider text-gray-400 mb-1">Actual CAC</div>
              <div className="flex items-end gap-2">
                <div className={`text-xl font-bold tracking-tight ${(kpi.cac || 0) <= (data.objectives?.target_cac || 500) ? 'text-emerald-400' : 'text-rose-400'}`}>
                  €{kpi.cac?.toFixed(0) || 0}
                </div>
              </div>
              <div className="text-[10px] text-gray-500 mt-1">Target: €{data.objectives?.target_cac}</div>
            </div>

            <div className="bg-white/[0.02] border border-white/10 rounded-xl p-3">
              <div className="text-[10px] uppercase tracking-wider text-gray-400 mb-1">Leads Gen</div>
              <div className="text-xl font-bold text-white tracking-tight">{weekly_totals.leads || 0}</div>
            </div>

            <div className="bg-white/[0.02] border border-white/10 rounded-xl p-3">
              <div className="text-[10px] uppercase tracking-wider text-gray-400 mb-1">Sales</div>
              <div className="text-xl font-bold text-emerald-400 tracking-tight">{weekly_totals.sales || 0}</div>
            </div>
          </div>
        </div>

        {/* ── ACTIVE ANGLES RADAR ── */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Zap className="w-4 h-4 text-amber-400" />
            <h3 className="text-xs font-mono text-amber-400 tracking-wider">ANGLE RADAR</h3>
          </div>

          <div className="space-y-2">
            {angle_scores.slice(0, 4).map(s => {
              const scoreColor = s.score > 0.3 ? 'text-emerald-400' : s.score > -0.1 ? 'text-amber-400' : 'text-rose-400'
              const barColor = s.score > 0.3 ? 'bg-emerald-500' : s.score > -0.1 ? 'bg-amber-500' : 'bg-rose-500'
              
              return (
                <div key={s.angle} className="bg-white/[0.02] border border-white/5 rounded-lg p-3 hover:bg-white/[0.04] transition-colors">
                  <div className="flex justify-between items-center mb-2">
                    <div className="text-[11px] font-bold text-white">{s.angle.toUpperCase()}</div>
                    <div className={`text-[10px] font-mono ${scoreColor}`}>
                      {s.score > 0 ? '+' : ''}{s.score.toFixed(2)}
                    </div>
                  </div>
                  <div className="flex justify-between text-[10px] text-gray-400 mb-2">
                    <span>CAC: €{s.avg_cac?.toFixed(0) || '-'}</span>
                    <span>Action: {s.recommended_action.toUpperCase()}</span>
                  </div>
                  <div className="w-full bg-black/40 h-1 rounded-full overflow-hidden flex">
                    <div className="w-1/2 flex justify-end pr-[1px]">
                      {s.score < 0 && <div className={`${barColor} h-full`} style={{ width: `${Math.min(Math.abs(s.score) * 100, 100)}%` }} />}
                    </div>
                    <div className="w-[1px] bg-white/20 h-full" />
                    <div className="w-1/2 flex justify-start pl-[1px]">
                      {s.score > 0 && <div className={`${barColor} h-full`} style={{ width: `${Math.min(s.score * 100, 100)}%` }} />}
                    </div>
                  </div>
                </div>
              )
            })}
            {angle_scores.length === 0 && (
              <div className="text-xs text-gray-500 p-4 border border-white/5 bg-white/[0.01] rounded-lg text-center font-mono">
                Awaiting intelligence cycle...
              </div>
            )}
          </div>
        </div>

        {/* ── AGENT ACTION LOG ── */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="w-4 h-4 text-purple-400" />
            <h3 className="text-xs font-mono text-purple-400 tracking-wider">STRATEGY LOG</h3>
          </div>

          <div className="space-y-2 relative before:absolute before:inset-0 before:ml-2 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:w-0.5 before:bg-gradient-to-b before:from-purple-500/20 before:to-transparent">
            {strategy_log.slice(0, 4).map(entry => {
              const hyp = entry.hypothesis || {}
              return (
                <div key={entry.id} className="relative flex items-center justify-between pl-6 py-2">
                  <div className={`absolute left-0 w-2 h-2 rounded-full ${entry.outcome === 'improved' ? 'bg-emerald-500 shadow-[0_0_8px_#10b981]' : entry.outcome === 'worsened' ? 'bg-rose-500' : 'bg-amber-500 animate-pulse'}`} />
                  <div>
                    <div className="text-[10px] font-mono text-gray-500 mb-0.5">{entry.cycle_type.toUpperCase()}</div>
                    <div className="text-[11px] text-white">
                      {hyp.action} su <span className="font-bold text-indigo-300">{hyp.angle?.toUpperCase()}</span>
                    </div>
                  </div>
                  {entry.delta_cpl && (
                    <div className={`text-[10px] font-mono ${entry.delta_cpl < 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {entry.delta_cpl < 0 ? '' : '+'}CPL €{entry.delta_cpl.toFixed(1)}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

      </div>
      
      <MissionConsoleModal 
        isOpen={showConsole} 
        onClose={() => setShowConsole(false)} 
        orgId={orgId}
        initialObjectives={data.objectives}
        initialExecutionMode={data.execution_mode}
        initialAutopilotActive={data.autopilot_active}
        onSaved={() => fetchData()}
      />
    </div>
  )
}
