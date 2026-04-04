'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  Brain, LayoutDashboard, MessageSquare, Activity, Palette, Settings2,
  Shield, Zap, TrendingUp, DollarSign, Users, Target, Play, Pause,
  Loader2
} from 'lucide-react'
import DashboardTab from './tabs/DashboardTab'
import ChatTab from './tabs/ChatTab'
import ActivityTab from './tabs/ActivityTab'
import CreativesTab from './tabs/CreativesTab'
import ConfigTab from './tabs/ConfigTab'

interface MissionData {
  objectives: any
  execution_mode: string
  autopilot_active: boolean
  llm_model: string
  weekly_totals: any
  progress: any
  kpi: any
  angle_scores: any[]
  strategy_log: any[]
  sparklines: any
  week_label: string
}

const TABS = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, shortLabel: 'Dashboard' },
  { id: 'chat', label: 'Chat AI', icon: MessageSquare, shortLabel: 'Chat' },
  { id: 'activity', label: 'Activity Log', icon: Activity, shortLabel: 'Activity' },
  { id: 'creatives', label: 'Creativi', icon: Palette, shortLabel: 'Creativi' },
  { id: 'config', label: 'Configurazione', icon: Settings2, shortLabel: 'Config' },
] as const

type TabId = typeof TABS[number]['id']

export default function CommandCenter() {
  const [activeTab, setActiveTab] = useState<TabId>('dashboard')
  const [orgId, setOrgId] = useState<string | null>(null)
  const [data, setData] = useState<MissionData | null>(null)
  const [loading, setLoading] = useState(true)

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
    const t = setInterval(fetchData, 60000)
    return () => clearInterval(t)
  }, [fetchData])

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-4">
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{
          background: 'linear-gradient(135deg, #a855f7, #6366f1)',
          boxShadow: '0 0 40px rgba(168,85,247,0.3)'
        }}>
          <Brain className="w-8 h-8 text-white animate-pulse" />
        </div>
        <div className="text-sm font-mono text-[#a855f7] tracking-widest animate-pulse">
          INITIALIZING COMMAND CENTER...
        </div>
      </div>
    )
  }

  if (!data) return null;
  const { kpi, weekly_totals, execution_mode, autopilot_active, llm_model } = data
  const modelShort = (llm_model && llm_model !== 'null' ? llm_model : 'Hermes VPS Orchestrator').split('/').pop() || ''

  return (
    <div className="space-y-0 animate-fade-in">
      {/* ═══ STATUS BAR ═══ */}
      <div className="glass-card mb-5" style={{
        background: 'linear-gradient(135deg, rgba(168,85,247,0.06), rgba(99,102,241,0.04))',
        border: '1px solid rgba(168,85,247,0.15)',
      }}>
        <div className="px-5 py-4 flex items-center justify-between flex-wrap gap-4">
          {/* Left: identity */}
          <div className="flex items-center gap-4">
            <div className="w-11 h-11 rounded-xl flex items-center justify-center" style={{
              background: 'linear-gradient(135deg, #a855f7, #6366f1)',
              boxShadow: '0 0 20px rgba(168,85,247,0.25)'
            }}>
              <Brain className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white tracking-tight">AdPilotik Command Center</h1>
              <div className="flex items-center gap-3 text-[11px] font-mono">
                <span className="flex items-center gap-1.5">
                  <span className="relative flex h-2 w-2">
                    <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${execution_mode === 'live' ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                    <span className={`relative inline-flex rounded-full h-2 w-2 ${execution_mode === 'live' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                  </span>
                  <span className={execution_mode === 'live' ? 'text-emerald-400' : 'text-amber-400'}>
                    {execution_mode === 'live' ? 'LIVE' : 'DRY RUN'}
                  </span>
                </span>
                <span style={{ color: 'var(--color-surface-500)' }}>·</span>
                <span style={{ color: 'var(--color-surface-500)' }}>{modelShort}</span>
                {autopilot_active && (
                  <>
                    <span style={{ color: 'var(--color-surface-500)' }}>·</span>
                    <span className="text-indigo-400">AUTOPILOT ON</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Right: quick KPIs */}
          <div className="flex items-center gap-6">
            <QuickKPI icon={DollarSign} label="Budget" value={`€${weekly_totals.spend?.toFixed(0) || '0'}`} sub={`/ €${data.objectives?.weekly_spend_budget || '—'}`} color="#818cf8" />
            <QuickKPI icon={Target} label="CAC" value={`€${kpi.cac?.toFixed(0) || '—'}`} sub={`target €${data.objectives?.target_cac || '—'}`} color={(kpi.cac || 999) <= (data.objectives?.target_cac || 500) ? '#22c55e' : '#ef4444'} />
            <QuickKPI icon={Users} label="Lead" value={String(weekly_totals.leads || 0)} sub="questa settimana" color="#3b82f6" />
            <QuickKPI icon={Zap} label="Sales" value={String(weekly_totals.sales || 0)} sub="questa settimana" color="#22c55e" />
          </div>
        </div>
      </div>

      {/* ═══ TAB NAVIGATION ═══ */}
      <div className="flex gap-1 mb-5 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
        {TABS.map(tab => {
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold transition-all whitespace-nowrap"
              style={{
                background: isActive ? 'rgba(168,85,247,0.12)' : 'transparent',
                color: isActive ? '#c084fc' : 'var(--color-surface-500)',
                border: isActive ? '1px solid rgba(168,85,247,0.25)' : '1px solid transparent',
                boxShadow: isActive ? '0 0 20px rgba(168,85,247,0.08)' : 'none',
              }}
            >
              <tab.icon className="w-4 h-4" />
              <span className="hidden md:inline">{tab.label}</span>
              <span className="md:hidden">{tab.shortLabel}</span>
            </button>
          )
        })}
      </div>

      {/* ═══ TAB CONTENT ═══ */}
      <div className="min-h-[60vh]">
        {activeTab === 'dashboard' && <DashboardTab data={data} orgId={orgId} />}
        {activeTab === 'chat' && <ChatTab llmModel={llm_model} />}
        {activeTab === 'activity' && <ActivityTab orgId={orgId!} />}
        {activeTab === 'creatives' && <CreativesTab orgId={orgId!} />}
        {activeTab === 'config' && <ConfigTab data={data} orgId={orgId!} onSaved={fetchData} />}
      </div>
    </div>
  )
}

function QuickKPI({ icon: Icon, label, value, sub, color }: {
  icon: any; label: string; value: string; sub: string; color: string
}) {
  return (
    <div className="hidden lg:flex items-center gap-3">
      <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${color}15` }}>
        <Icon className="w-4 h-4" style={{ color }} />
      </div>
      <div>
        <div className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: 'var(--color-surface-500)' }}>{label}</div>
        <div className="text-sm font-bold" style={{ color }}>{value} <span className="text-[10px] font-normal" style={{ color: 'var(--color-surface-600)' }}>{sub}</span></div>
      </div>
    </div>
  )
}
