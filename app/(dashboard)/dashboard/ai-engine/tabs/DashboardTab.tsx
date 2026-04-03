'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import {
  TrendingUp, Target, Zap, Shield, DollarSign, Users, Eye,
  ArrowRight, BarChart3, Brain, Sparkles
} from 'lucide-react'
import PerformanceChart from '../PerformanceChart'

interface Props {
  data: any
  orgId: string | null
}

export default function DashboardTab({ data, orgId }: Props) {
  const { kpi, weekly_totals, progress, angle_scores, strategy_log, objectives } = data

  return (
    <div className="space-y-6 animate-fade-in">

      {/* ── KPI CARDS ROW ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard
          label="Budget Speso"
          value={`€${weekly_totals.spend?.toFixed(0) || '0'}`}
          sub={`/ €${objectives?.weekly_spend_budget || '—'} settimanali`}
          pct={progress.spend_pct}
          icon={DollarSign}
          color="#818cf8"
        />
        <KPICard
          label="CAC Attuale"
          value={kpi.cac ? `€${kpi.cac.toFixed(0)}` : '—'}
          sub={`Target: €${objectives?.target_cac || '—'}`}
          icon={Target}
          color={(kpi.cac || 999) <= (objectives?.target_cac || 500) ? '#22c55e' : '#ef4444'}
        />
        <KPICard
          label="Lead Generati"
          value={String(weekly_totals.leads || 0)}
          sub={`Target: ${objectives?.weekly_leads_target || '—'}`}
          pct={progress.leads_pct}
          icon={Users}
          color="#3b82f6"
        />
        <KPICard
          label="Vendite"
          value={String(weekly_totals.sales || 0)}
          sub={`Target: ${objectives?.weekly_sales_target || '—'}`}
          pct={progress.sales_pct}
          icon={Zap}
          color="#22c55e"
        />
      </div>

      {/* ── MIDDLE: CHART + AGENT DECISIONS ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Performance Chart */}
        <div>
          {orgId && <PerformanceChart orgId={orgId} />}
        </div>

        {/* Agent Recent Decisions */}
        <div className="glass-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Brain className="w-4 h-4" style={{ color: '#a855f7' }} />
            <h3 className="text-sm font-bold text-white">Ultime Decisioni Agente</h3>
          </div>
          <div className="space-y-3">
            {strategy_log.length === 0 && (
              <div className="text-xs text-center py-8" style={{ color: 'var(--color-surface-500)' }}>
                <Brain className="w-8 h-8 mx-auto mb-3 opacity-30" />
                L'agente non ha ancora preso decisioni.<br />
                Attiva il ciclo dalla tab Config.
              </div>
            )}
            {strategy_log.slice(0, 6).map((entry: any) => {
              const hyp = entry.hypothesis || {}
              const outcomeColor = entry.outcome === 'improved' ? '#22c55e' : entry.outcome === 'worsened' ? '#ef4444' : '#f59e0b'
              return (
                <div key={entry.id} className="flex items-start gap-3 p-3 rounded-xl transition-colors hover:bg-white/[0.03]"
                  style={{ background: 'var(--color-surface-100)', border: '1px solid var(--color-surface-200)' }}>
                  <div className="w-2 h-2 rounded-full mt-1.5 shrink-0" style={{
                    backgroundColor: outcomeColor,
                    boxShadow: entry.outcome === 'improved' ? '0 0 8px #22c55e' : 'none'
                  }} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-[10px] font-mono font-bold uppercase" style={{ color: '#a855f7' }}>
                        {entry.cycle_type || 'agent_loop'}
                      </span>
                      {entry.outcome && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{
                          background: `${outcomeColor}15`, color: outcomeColor
                        }}>
                          {entry.outcome.toUpperCase()}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-white">
                      {hyp.action || 'Analisi'}{' '}
                      {hyp.angle && <span className="font-bold" style={{ color: '#818cf8' }}>{hyp.angle.toUpperCase()}</span>}
                    </div>
                    {entry.delta_cpl !== null && entry.delta_cpl !== undefined && (
                      <div className="text-[10px] font-mono mt-1" style={{ color: entry.delta_cpl < 0 ? '#22c55e' : '#ef4444' }}>
                        CPL {entry.delta_cpl < 0 ? '' : '+'}{entry.delta_cpl.toFixed(1)}€
                      </div>
                    )}
                  </div>
                  <div className="text-[10px] shrink-0" style={{ color: 'var(--color-surface-600)' }}>
                    {new Date(entry.created_at).toLocaleDateString('it-IT', { day: '2-digit', month: 'short' })}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* ── ANGLE RADAR ── */}
      <div className="glass-card p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4" style={{ color: '#f59e0b' }} />
            <h3 className="text-sm font-bold text-white">Angle Radar — Performance per Angolo Creativo</h3>
          </div>
          <span className="text-[10px] font-mono" style={{ color: 'var(--color-surface-500)' }}>
            {angle_scores.length} angoli tracciati
          </span>
        </div>
        {angle_scores.length === 0 ? (
          <div className="text-xs text-center py-8" style={{ color: 'var(--color-surface-500)' }}>
            Nessun angolo rilevato. L'agente li analizzerà al prossimo ciclo.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {angle_scores.map((s: any) => {
              const scoreColor = s.score > 0.3 ? '#22c55e' : s.score > -0.1 ? '#f59e0b' : '#ef4444'
              return (
                <div key={s.angle} className="p-4 rounded-xl transition-all hover:scale-[1.02]"
                  style={{ background: 'var(--color-surface-100)', border: `1px solid ${scoreColor}20` }}>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs font-bold text-white">{s.angle.toUpperCase()}</span>
                    <span className="text-xs font-mono font-bold" style={{ color: scoreColor }}>
                      {s.score > 0 ? '+' : ''}{s.score.toFixed(2)}
                    </span>
                  </div>
                  {/* Score bar */}
                  <div className="w-full h-1.5 rounded-full overflow-hidden flex mb-3" style={{ background: 'var(--color-surface-200)' }}>
                    <div className="w-1/2 flex justify-end">
                      {s.score < 0 && <div className="h-full rounded-l-full" style={{ width: `${Math.min(Math.abs(s.score) * 100, 100)}%`, background: scoreColor }} />}
                    </div>
                    <div className="w-[2px] h-full" style={{ background: 'var(--color-surface-400)' }} />
                    <div className="w-1/2">
                      {s.score > 0 && <div className="h-full rounded-r-full" style={{ width: `${Math.min(s.score * 100, 100)}%`, background: scoreColor }} />}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[10px]">
                    <div>
                      <div style={{ color: 'var(--color-surface-500)' }}>CAC</div>
                      <div className="font-bold text-white">€{s.avg_cac?.toFixed(0) || '—'}</div>
                    </div>
                    <div>
                      <div style={{ color: 'var(--color-surface-500)' }}>Lead</div>
                      <div className="font-bold text-white">{s.total_leads || 0}</div>
                    </div>
                  </div>
                  <div className="mt-2 text-[10px] font-bold px-2 py-0.5 rounded-full text-center" style={{
                    background: `${scoreColor}10`, color: scoreColor, border: `1px solid ${scoreColor}20`
                  }}>
                    {s.recommended_action?.toUpperCase() || 'HOLD'}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── QUICK LINKS ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { href: '/dashboard/crm', label: 'CRM Pipeline', icon: Users, color: '#3b82f6' },
          { href: '/dashboard/funnels', label: 'Funnel', icon: Target, color: '#22c55e' },
          { href: '/dashboard/ads', label: 'Ads Dashboard', icon: BarChart3, color: '#f59e0b' },
          { href: '/dashboard/ai-engine/creative-studio', label: 'Creative Studio', icon: Sparkles, color: '#a855f7' },
        ].map(link => (
          <Link key={link.href} href={link.href}
            className="glass-card p-4 flex items-center gap-3 transition-all hover:scale-[1.02] hover:border-white/10 group">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: `${link.color}15` }}>
              <link.icon className="w-4 h-4" style={{ color: link.color }} />
            </div>
            <span className="text-sm font-semibold text-white flex-1">{link.label}</span>
            <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-60 transition-opacity" style={{ color: 'var(--color-surface-500)' }} />
          </Link>
        ))}
      </div>
    </div>
  )
}

function KPICard({ label, value, sub, pct, icon: Icon, color }: {
  label: string; value: string; sub: string; pct?: number | null; icon: any; color: string
}) {
  return (
    <div className="glass-card p-4" style={{ borderTop: `2px solid ${color}` }}>
      <div className="flex items-center gap-2 mb-2">
        <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `${color}12` }}>
          <Icon className="w-3.5 h-3.5" style={{ color }} />
        </div>
        <span className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: 'var(--color-surface-500)' }}>{label}</span>
      </div>
      <div className="text-2xl font-bold tracking-tight" style={{ color }}>{value}</div>
      <div className="text-[11px] mt-1" style={{ color: 'var(--color-surface-600)' }}>{sub}</div>
      {pct !== undefined && pct !== null && (
        <div className="mt-2 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--color-surface-200)' }}>
          <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(pct, 100)}%`, background: color }} />
        </div>
      )}
    </div>
  )
}
