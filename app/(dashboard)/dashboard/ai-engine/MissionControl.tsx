'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

// ═══════════════════════════════════════════════════════════════
// 🧠 MISSION CONTROL — The Evolutionary Mind Dashboard
// ═══════════════════════════════════════════════════════════════

interface MissionData {
  objectives: any
  execution_mode: string
  autopilot_active: boolean
  weekly_totals: {
    spend: number; leads: number; appointments: number
    showups: number; sales: number; revenue: number
  }
  progress: {
    leads_pct: number | null; appointments_pct: number | null
    showups_pct: number | null; sales_pct: number | null; spend_pct: number | null
  }
  kpi: {
    cpl: number | null; cac: number | null; roas: number | null
    lead_to_appt_rate: number | null; close_rate: number | null
  }
  sparklines: { cpl: any[]; cac: any[]; leads: any[] }
  angle_scores: AngleScore[]
  strategy_log: StrategyLogEntry[]
  week_label: string
}

interface AngleScore {
  angle: string; score: number; score_trend: string
  avg_cpl: number | null; avg_cac: number | null; avg_ctr: number | null
  total_leads: number; total_appointments: number; total_sales: number
  total_spend: number; active_ads: number
  recommended_action: string; action_reason: string
  best_pocket_id: number | null; best_template_id: number | null
}

interface StrategyLogEntry {
  id: string; cycle_type: string; hypothesis: any; outcome: string
  kept: boolean; delta_cpl: number | null; delta_cac: number | null
  created_at: string; evaluated_at: string | null
}

export default function MissionControl() {
  const [orgId, setOrgId] = useState<string | null>(null)
  const [data, setData] = useState<MissionData | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'overview' | 'angles' | 'log' | 'settings'>('overview')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [weeklyBrief, setWeeklyBrief] = useState<string | null>(null)
  const [briefLoading, setBriefLoading] = useState(false)
  const [overrideAngle, setOverrideAngle] = useState<string | null>(null)
  const [savingSettings, setSavingSettings] = useState(false)
  const [editedObjectives, setEditedObjectives] = useState<any>(null)
  const [toastMsg, setToastMsg] = useState<string | null>(null)

  // Resolve orgId from Supabase session
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
    setLoading(true)
    try {
      const res = await fetch(`/api/mission-control?orgId=${orgId}`)
      const json = await res.json()
      setData(json)
      setEditedObjectives(json.objectives)
    } catch { }
    setLoading(false)
  }, [orgId])

  useEffect(() => { fetchData() }, [fetchData])

  // Auto-refresh every 5 min
  useEffect(() => {
    const t = setInterval(fetchData, 5 * 60 * 1000)
    return () => clearInterval(t)
  }, [fetchData])

  const showToast = (msg: string) => {
    setToastMsg(msg)
    setTimeout(() => setToastMsg(null), 3000)
  }

  const handleGetBrief = async () => {
    if (!orgId) return
    setBriefLoading(true)
    try {
      const res = await fetch('/api/mission-control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'get_weekly_brief', org_id: orgId }),
      })
      const json = await res.json()
      setWeeklyBrief(json.brief || null)
    } catch { }
    setBriefLoading(false)
  }

  const handleSaveObjectives = async () => {
    if (!orgId || !editedObjectives) return
    setSavingSettings(true)
    try {
      await fetch('/api/mission-control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'set_objectives', org_id: orgId, objectives: editedObjectives }),
      })
      setSettingsOpen(false)
      showToast('✅ Obiettivi salvati')
      fetchData()
    } catch { }
    setSavingSettings(false)
  }

  const handleToggleMode = async () => {
    if (!orgId || !data) return
    const newMode = data.execution_mode === 'live' ? 'dry_run' : 'live'
    await fetch('/api/mission-control', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'set_execution_mode', org_id: orgId, mode: newMode }),
    })
    showToast(newMode === 'live' ? '🟢 Modalità LIVE attivata' : '🟡 Modalità DRY RUN attivata')
    fetchData()
  }

  const handleOverrideAction = async (angle: string, newAction: string) => {
    if (!orgId) return
    await fetch('/api/mission-control', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'override_angle_action',
        org_id: orgId,
        angle,
        new_action: newAction,
        reason: 'Override manuale dal Mission Control',
      }),
    })
    setOverrideAngle(null)
    showToast(`✅ Override ${angle}: ${newAction}`)
    fetchData()
  }

  if (loading) {
    return (
      <div style={styles.loadingContainer}>
        <div style={styles.loadingPulse}>
          <div style={styles.loadingBrain}>🧠</div>
          <p style={styles.loadingText}>Calcolo stato mente evolutiva...</p>
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div style={styles.errorContainer}>
        <p>Errore nel caricamento dei dati Mission Control</p>
        <button onClick={fetchData} style={styles.btnPrimary}>Riprova</button>
      </div>
    )
  }

  const { objectives, progress, kpi, weekly_totals, angle_scores, strategy_log, week_label, execution_mode } = data

  return (
    <div style={styles.root}>
      {/* Toast */}
      {toastMsg && (
        <div style={styles.toast}>{toastMsg}</div>
      )}

      {/* Header */}
      <div style={styles.header}>
        <div style={styles.headerLeft}>
          <span style={styles.brainIcon}>🧠</span>
          <div>
            <h1 style={styles.headerTitle}>Mission Control</h1>
            <p style={styles.headerSubtitle}>Mente Evolutiva — {week_label}</p>
          </div>
        </div>
        <div style={styles.headerRight}>
          <button
            onClick={handleToggleMode}
            style={{
              ...styles.modeToggle,
              background: execution_mode === 'live' ? 'rgba(16,185,129,0.15)' : 'rgba(251,191,36,0.15)',
              borderColor: execution_mode === 'live' ? '#10b981' : '#fbbf24',
              color: execution_mode === 'live' ? '#10b981' : '#fbbf24',
            }}
          >
            {execution_mode === 'live' ? '🟢 LIVE' : '🟡 DRY RUN'}
          </button>
          <button onClick={() => setSettingsOpen(true)} style={styles.btnSettings}>
            ⚙️ Obiettivi
          </button>
          <button onClick={fetchData} style={styles.btnRefresh}>
            ↺
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={styles.tabBar}>
        {[
          { id: 'overview', label: '📊 Overview' },
          { id: 'angles', label: '🎯 Angoli' },
          { id: 'log', label: '📔 Diario' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            style={{
              ...styles.tab,
              ...(activeTab === tab.id ? styles.tabActive : {}),
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── OVERVIEW TAB ─────────────────────────────── */}
      {activeTab === 'overview' && (
        <div style={styles.tabContent}>

          {/* Weekly brief button */}
          <div style={styles.briefRow}>
            <button onClick={handleGetBrief} disabled={briefLoading} style={styles.btnBrief}>
              {briefLoading ? '⏳ Generando...' : '🤖 Brief Strategico Settimanale'}
            </button>
          </div>

          {weeklyBrief && (
            <div style={styles.briefCard}>
              <div style={styles.briefHeader}>📋 Brief settimana {week_label}</div>
              <p style={styles.briefText}>{weeklyBrief}</p>
            </div>
          )}

          {/* Progress Cards */}
          <div style={styles.section}>
            <h2 style={styles.sectionTitle}>🎯 Progress Obiettivi — {week_label}</h2>
            <div style={styles.cardsGrid5}>
              <ProgressCard
                label="Lead"
                current={weekly_totals.leads}
                target={objectives?.weekly_leads_target}
                pct={progress.leads_pct}
                icon="📥"
                color="#6366f1"
              />
              <ProgressCard
                label="Appuntamenti"
                current={weekly_totals.appointments}
                target={objectives?.weekly_appointments_target}
                pct={progress.appointments_pct}
                icon="📅"
                color="#8b5cf6"
              />
              <ProgressCard
                label="Show-up"
                current={weekly_totals.showups}
                target={objectives?.weekly_showup_target}
                pct={progress.showups_pct}
                icon="✅"
                color="#06b6d4"
              />
              <ProgressCard
                label="Vendite"
                current={weekly_totals.sales}
                target={objectives?.weekly_sales_target}
                pct={progress.sales_pct}
                icon="💰"
                color="#10b981"
              />
              <ProgressCard
                label="Budget"
                current={weekly_totals.spend}
                target={objectives?.weekly_spend_budget}
                pct={progress.spend_pct}
                icon="💳"
                color="#f59e0b"
                currency
              />
            </div>
          </div>

          {/* KPI Row */}
          <div style={styles.section}>
            <h2 style={styles.sectionTitle}>📈 KPI Reali vs Target</h2>
            <div style={styles.kpiGrid}>
              <KPICard
                label="CPL"
                value={kpi.cpl ? `€${kpi.cpl.toFixed(2)}` : 'n/d'}
                target={`Target: €${objectives?.target_cpl || 20}`}
                good={kpi.cpl !== null && kpi.cpl <= (objectives?.target_cpl || 20)}
              />
              <KPICard
                label="CAC Reale"
                value={kpi.cac ? `€${kpi.cac.toFixed(0)}` : 'n/d'}
                target={`Target: €${objectives?.target_cac || 1500}`}
                good={kpi.cac !== null && kpi.cac <= (objectives?.target_cac || 1500)}
                highlight
              />
              <KPICard
                label="ROAS"
                value={kpi.roas ? `${kpi.roas.toFixed(2)}x` : 'n/d'}
                target={`Target: ${objectives?.target_roas || 3}x`}
                good={kpi.roas !== null && kpi.roas >= (objectives?.target_roas || 3)}
              />
              <KPICard
                label="Lead→Appt"
                value={kpi.lead_to_appt_rate ? `${(kpi.lead_to_appt_rate * 100).toFixed(1)}%` : 'n/d'}
                target={`Target: ${((objectives?.target_lead_to_appt_rate || 0.4) * 100).toFixed(0)}%`}
                good={kpi.lead_to_appt_rate !== null && kpi.lead_to_appt_rate >= (objectives?.target_lead_to_appt_rate || 0.4)}
              />
              <KPICard
                label="Close Rate"
                value={kpi.close_rate ? `${(kpi.close_rate * 100).toFixed(1)}%` : 'n/d'}
                target={`Target: ${((objectives?.target_close_rate || 0.35) * 100).toFixed(0)}%`}
                good={kpi.close_rate !== null && kpi.close_rate >= (objectives?.target_close_rate || 0.35)}
              />
            </div>
          </div>

          {/* Funnel Visualization */}
          <div style={styles.section}>
            <h2 style={styles.sectionTitle}>🔽 Funnel Settimanale</h2>
            <FunnelViz totals={weekly_totals} />
          </div>
        </div>
      )}

      {/* ── ANGLES TAB ────────────────────────────────── */}
      {activeTab === 'angles' && (
        <div style={styles.tabContent}>
          <h2 style={styles.sectionTitle}>🎯 Intelligenza Angoli — Score Evolutivo</h2>
          <p style={styles.sectionSubtitle}>Score da -1.0 (critico) a +1.0 (eccellente). Aggiornato ogni 60 minuti.</p>

          <div style={styles.anglesGrid}>
            {angle_scores.map(s => (
              <AngleCard
                key={s.angle}
                score={s}
                onOverride={(action: string) => handleOverrideAction(s.angle, action)}
                overrideOpen={overrideAngle === s.angle}
                onToggleOverride={() => setOverrideAngle(overrideAngle === s.angle ? null : s.angle)}
              />
            ))}
            {angle_scores.length === 0 && (
              <div style={styles.emptyState}>
                <p>🔍 Nessun angolo ancora valutato.</p>
                <p>Il sistema inizierà a raccogliere dati al prossimo ciclo Intelligence Engine.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── LOG TAB ───────────────────────────────────── */}
      {activeTab === 'log' && (
        <div style={styles.tabContent}>
          <h2 style={styles.sectionTitle}>📔 Diario Strategico — Ipotesi & Outcome</h2>
          <p style={styles.sectionSubtitle}>Ogni ipotesi viene valutata dopo 3+ giorni dal Ratchet Evaluator (ore 23:00).</p>

          <div style={styles.logList}>
            {strategy_log.map(entry => (
              <LogEntry key={entry.id} entry={entry} />
            ))}
            {strategy_log.length === 0 && (
              <div style={styles.emptyState}>
                <p>📋 Il diario strategico è vuoto.</p>
                <p>Verrà popolato automaticamente al prossimo ciclo Intelligence Engine.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── SETTINGS MODAL ────────────────────────────── */}
      {settingsOpen && editedObjectives && (
        <div style={styles.modalOverlay} onClick={() => setSettingsOpen(false)}>
          <div style={styles.modal} onClick={e => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h3 style={styles.modalTitle}>⚙️ Obiettivi & Configurazione</h3>
              <button onClick={() => setSettingsOpen(false)} style={styles.modalClose}>×</button>
            </div>
            <div style={styles.modalBody}>

              <div style={styles.settingsSection}>
                <h4 style={styles.settingsSectionTitle}>🎯 Obiettivi Settimanali</h4>
                <div style={styles.settingsGrid}>
                  <SettingsInput label="Lead target" value={editedObjectives.weekly_leads_target} onChange={v => setEditedObjectives({ ...editedObjectives, weekly_leads_target: Number(v) })} type="number" />
                  <SettingsInput label="Appuntamenti target" value={editedObjectives.weekly_appointments_target} onChange={v => setEditedObjectives({ ...editedObjectives, weekly_appointments_target: Number(v) })} type="number" />
                  <SettingsInput label="Show-up target" value={editedObjectives.weekly_showup_target} onChange={v => setEditedObjectives({ ...editedObjectives, weekly_showup_target: Number(v) })} type="number" />
                  <SettingsInput label="Vendite target" value={editedObjectives.weekly_sales_target} onChange={v => setEditedObjectives({ ...editedObjectives, weekly_sales_target: Number(v) })} type="number" />
                  <SettingsInput label="Budget settimanale (€)" value={editedObjectives.weekly_spend_budget} onChange={v => setEditedObjectives({ ...editedObjectives, weekly_spend_budget: Number(v) })} type="number" />
                </div>
              </div>

              <div style={styles.settingsSection}>
                <h4 style={styles.settingsSectionTitle}>📊 KPI Target</h4>
                <div style={styles.settingsGrid}>
                  <SettingsInput label="CPL target (€)" value={editedObjectives.target_cpl} onChange={v => setEditedObjectives({ ...editedObjectives, target_cpl: Number(v) })} type="number" />
                  <SettingsInput label="CAC target (€)" value={editedObjectives.target_cac} onChange={v => setEditedObjectives({ ...editedObjectives, target_cac: Number(v) })} type="number" />
                  <SettingsInput label="ROAS target" value={editedObjectives.target_roas} onChange={v => setEditedObjectives({ ...editedObjectives, target_roas: Number(v) })} type="number" step="0.1" />
                  <SettingsInput label="Lead→Appt rate (%)" value={Math.round((editedObjectives.target_lead_to_appt_rate || 0.4) * 100)} onChange={v => setEditedObjectives({ ...editedObjectives, target_lead_to_appt_rate: Number(v) / 100 })} type="number" />
                  <SettingsInput label="Close rate (%)" value={Math.round((editedObjectives.target_close_rate || 0.35) * 100)} onChange={v => setEditedObjectives({ ...editedObjectives, target_close_rate: Number(v) / 100 })} type="number" />
                </div>
              </div>

              <div style={styles.settingsSection}>
                <h4 style={styles.settingsSectionTitle}>🎛️ Ottimizza per</h4>
                <div style={styles.optimizeGrid}>
                  {['cac', 'cpl', 'roas', 'volume'].map(opt => (
                    <button
                      key={opt}
                      onClick={() => setEditedObjectives({ ...editedObjectives, optimize_for: opt })}
                      style={{
                        ...styles.optimizeBtn,
                        background: editedObjectives.optimize_for === opt ? 'rgba(99,102,241,0.3)' : 'rgba(255,255,255,0.05)',
                        borderColor: editedObjectives.optimize_for === opt ? '#6366f1' : 'rgba(255,255,255,0.1)',
                      }}
                    >
                      {opt.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>

              <div style={styles.settingsSection}>
                <h4 style={styles.settingsSectionTitle}>📝 Note Strategiche</h4>
                <textarea
                  style={styles.textarea}
                  value={editedObjectives.strategic_notes || ''}
                  onChange={e => setEditedObjectives({ ...editedObjectives, strategic_notes: e.target.value })}
                  placeholder="es: Stiamo testando l'angolo STATUS in aprile. Non toccare EMOTIONAL."
                  rows={3}
                />
              </div>
            </div>
            <div style={styles.modalFooter}>
              <button onClick={() => setSettingsOpen(false)} style={styles.btnCancel}>Annulla</button>
              <button onClick={handleSaveObjectives} disabled={savingSettings} style={styles.btnPrimary}>
                {savingSettings ? '⏳ Salvando...' : '💾 Salva Obiettivi'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// SUB-COMPONENTS
// ═══════════════════════════════════════════════════════════════

function ProgressCard({ label, current, target, pct, icon, color, currency = false }: any) {
  const safeVal = pct ?? 0
  const capped = Math.min(safeVal, 100)
  const good = safeVal >= 80
  const warn = safeVal >= 50 && safeVal < 80
  const barColor = good ? '#10b981' : warn ? '#f59e0b' : '#ef4444'

  return (
    <div style={{ ...styles.progressCard, borderColor: `${color}33` }}>
      <div style={styles.progressCardHeader}>
        <span style={styles.progressIcon}>{icon}</span>
        <span style={{ ...styles.progressLabel, color }}>{label}</span>
      </div>
      <div style={styles.progressValues}>
        <span style={styles.progressCurrent}>
          {currency ? `€${(current || 0).toFixed(0)}` : current || 0}
        </span>
        <span style={styles.progressTarget}>
          / {currency ? `€${target || 0}` : target || 0}
        </span>
      </div>
      <div style={styles.progressBarBg}>
        <div style={{ ...styles.progressBarFill, width: `${capped}%`, background: barColor }} />
      </div>
      <div style={{ ...styles.progressPct, color: barColor }}>
        {pct !== null ? `${safeVal}%` : 'n/d'}
      </div>
    </div>
  )
}

function KPICard({ label, value, target, good, highlight = false }: any) {
  return (
    <div style={{
      ...styles.kpiCard,
      borderColor: good ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)',
      background: highlight ? 'rgba(99,102,241,0.08)' : 'rgba(255,255,255,0.03)',
    }}>
      <div style={styles.kpiLabel}>{label}</div>
      <div style={{ ...styles.kpiValue, color: good ? '#10b981' : '#ef4444' }}>{value}</div>
      <div style={styles.kpiTarget}>{target}</div>
      <div style={{ ...styles.kpiStatus, color: good ? '#10b981' : '#ef4444' }}>
        {good ? '✅ In target' : '⚠️ Fuori target'}
      </div>
    </div>
  )
}

function FunnelViz({ totals }: any) {
  const stages = [
    { label: 'Lead', value: totals.leads, color: '#6366f1', width: '100%' },
    { label: 'Appuntamenti', value: totals.appointments, color: '#8b5cf6', width: `${totals.leads > 0 ? Math.round((totals.appointments / totals.leads) * 100) : 0}%` },
    { label: 'Show-up', value: totals.showups, color: '#06b6d4', width: `${totals.leads > 0 ? Math.round((totals.showups / totals.leads) * 100) : 0}%` },
    { label: 'Vendite', value: totals.sales, color: '#10b981', width: `${totals.leads > 0 ? Math.round((totals.sales / totals.leads) * 100) : 0}%` },
  ]

  return (
    <div style={styles.funnelContainer}>
      {stages.map((stage, i) => (
        <div key={stage.label} style={styles.funnelRow}>
          <div style={styles.funnelLabel}>{stage.label}</div>
          <div style={styles.funnelBarBg}>
            <div style={{
              height: '100%',
              width: stage.width,
              background: `linear-gradient(90deg, ${stage.color}cc, ${stage.color}55)`,
              borderRadius: 4,
              transition: 'width 0.6s ease',
              display: 'flex',
              alignItems: 'center',
              paddingLeft: 8,
            }}>
              <span style={{ color: '#fff', fontWeight: 700, fontSize: 13 }}>{stage.value}</span>
            </div>
          </div>
          <div style={{ ...styles.funnelPct, color: stage.color }}>
            {i > 0 && totals.leads > 0 ? `${Math.round((stage.value / totals.leads) * 100)}%` : ''}
          </div>
        </div>
      ))}
    </div>
  )
}

const ACTION_COLORS: Record<string, string> = {
  scale: '#10b981', maintain: '#6366f1', test: '#06b6d4',
  reduce: '#f59e0b', pause: '#ef4444',
}

const ACTION_ICONS: Record<string, string> = {
  scale: '📈', maintain: '✅', test: '🧪', reduce: '📉', pause: '⏸',
}

function AngleCard({ score: s, onOverride, overrideOpen, onToggleOverride }: any) {
  const scoreColor = s.score > 0.3 ? '#10b981' : s.score > -0.1 ? '#f59e0b' : '#ef4444'
  const trendIcon = (s.score_trend as string) === 'rising' ? '↑' : (s.score_trend as string) === 'falling' ? '↓' : '→'
  const trendColor = (s.score_trend as string) === 'rising' ? '#10b981' : (s.score_trend as string) === 'falling' ? '#ef4444' : '#94a3b8'
  const scorePct = Math.round((s.score + 1) * 50)
  const actionColor = ACTION_COLORS[s.recommended_action] || '#6366f1'

  return (
    <div style={{ ...styles.angleCard, borderColor: `${scoreColor}33` }}>
      {/* Header */}
      <div style={styles.angleCardHeader}>
        <div style={styles.angleNameRow}>
          <span style={styles.angleEmoji}>{ACTION_ICONS[s.recommended_action]}</span>
          <span style={styles.angleName}>{s.angle.toUpperCase()}</span>
          <span style={{ ...styles.angleTrend, color: trendColor }}>{trendIcon}</span>
        </div>
        <div style={{ ...styles.angleScore, color: scoreColor }}>
          {s.score > 0 ? '+' : ''}{s.score.toFixed(2)}
        </div>
      </div>

      {/* Score bar */}
      <div style={styles.angleScoreBarBg}>
        <div style={{
          position: 'absolute',
          left: '50%',
          width: `${Math.abs(scorePct - 50)}%`,
          height: '100%',
          background: scoreColor,
          transform: s.score >= 0 ? 'none' : 'translateX(-100%)',
          borderRadius: 4,
          opacity: 0.7,
        }} />
        <div style={styles.angleScoreCenter} />
      </div>

      {/* Metrics */}
      <div style={styles.angleMetrics}>
        <div style={styles.angleMetric}>
          <span style={styles.metricLabel}>CPL</span>
          <span style={styles.metricValue}>{s.avg_cpl ? `€${s.avg_cpl.toFixed(2)}` : 'n/d'}</span>
        </div>
        <div style={styles.angleMetric}>
          <span style={styles.metricLabel}>CAC</span>
          <span style={styles.metricValue}>{s.avg_cac ? `€${s.avg_cac.toFixed(0)}` : 'n/d'}</span>
        </div>
        <div style={styles.angleMetric}>
          <span style={styles.metricLabel}>Lead</span>
          <span style={styles.metricValue}>{s.total_leads}</span>
        </div>
        <div style={styles.angleMetric}>
          <span style={styles.metricLabel}>Appt</span>
          <span style={styles.metricValue}>{s.total_appointments}</span>
        </div>
        <div style={styles.angleMetric}>
          <span style={styles.metricLabel}>Sale</span>
          <span style={styles.metricValue}>{s.total_sales}</span>
        </div>
        <div style={styles.angleMetric}>
          <span style={styles.metricLabel}>Ads</span>
          <span style={styles.metricValue}>{s.active_ads}</span>
        </div>
      </div>

      {/* Recommended Action */}
      <div style={{ ...styles.angleAction, background: `${actionColor}22`, borderColor: `${actionColor}55` }}>
        <span style={{ color: actionColor, fontWeight: 700, fontSize: 12 }}>
          {ACTION_ICONS[s.recommended_action]} {s.recommended_action.toUpperCase()}
        </span>
        <br />
        <span style={{ color: '#94a3b8', fontSize: 11 }}>{s.action_reason}</span>
      </div>

      {/* Override */}
      <button onClick={onToggleOverride} style={styles.overrideBtn}>
        Override manuale
      </button>
      {overrideOpen && (
        <div style={styles.overrideMenu}>
          {['scale', 'maintain', 'test', 'reduce', 'pause'].map(action => (
            <button
              key={action}
              onClick={() => onOverride(action)}
              style={{ ...styles.overrideOption, borderColor: `${ACTION_COLORS[action]}44`, color: ACTION_COLORS[action] }}
            >
              {ACTION_ICONS[action]} {action}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function LogEntry({ entry }: { entry: StrategyLogEntry }) {
  const outcomeColor = entry.outcome === 'improved' ? '#10b981' : entry.outcome === 'worsened' ? '#ef4444' : entry.outcome === 'pending' ? '#f59e0b' : '#94a3b8'
  const outcomeIcon = entry.outcome === 'improved' ? '✅' : entry.outcome === 'worsened' ? '❌' : entry.outcome === 'pending' ? '⏳' : '➖'
  const bg = entry.kept ? 'rgba(16,185,129,0.04)' : entry.outcome === 'worsened' ? 'rgba(239,68,68,0.04)' : 'rgba(255,255,255,0.03)'
  const hyp = entry.hypothesis || {}
  const date = new Date(entry.created_at).toLocaleDateString('it-IT', { day: '2-digit', month: 'short' })
  const typeIcon = { intelligence: '🧠', creative: '🎨', kill: '⚔️', ratchet: '🔄' }[entry.cycle_type] || '📋'

  return (
    <div style={{ ...styles.logEntry, background: bg, borderColor: `${outcomeColor}33` }}>
      <div style={styles.logEntryHeader}>
        <div style={styles.logMeta}>
          <span style={styles.logTypeIcon}>{typeIcon}</span>
          <span style={styles.logCycleType}>{entry.cycle_type.toUpperCase()}</span>
          <span style={styles.logDate}>{date}</span>
        </div>
        <div style={{ ...styles.logOutcome, color: outcomeColor }}>
          {outcomeIcon} {entry.outcome.toUpperCase()}
          {entry.kept && <span style={styles.logKeptBadge}>🔒 baseline</span>}
        </div>
      </div>

      <div style={styles.logHypothesis}>
        {hyp.angle && <span style={styles.logAngle}>{hyp.angle.toUpperCase()}</span>}
        {hyp.action && <span style={styles.logAction}>→ {hyp.action}</span>}
        {hyp.reasoning && <p style={styles.logReasoning}>{hyp.reasoning}</p>}
      </div>

      {entry.delta_cpl !== null && entry.delta_cpl !== undefined && (
        <div style={styles.logDelta}>
          ΔCPL: <span style={{ color: (entry.delta_cpl || 0) < 0 ? '#10b981' : '#ef4444' }}>
            {(entry.delta_cpl || 0) < 0 ? '' : '+'}{((entry.delta_cpl || 0)).toFixed(2)}
          </span>
        </div>
      )}
    </div>
  )
}

function SettingsInput({ label, value, onChange, type = 'text', step }: { label: string; value: any; onChange: (v: string) => void; type?: string; step?: string | number }) {
  return (
    <div style={styles.settingsInputGroup}>
      <label style={styles.settingsLabel}>{label}</label>
      <input
        type={type}
        step={step}
        value={value || ''}
        onChange={e => onChange(e.target.value)}
        style={styles.settingsInput}
      />
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════════════
const styles: Record<string, React.CSSProperties> = {
  root: {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #0a0a1a 0%, #0f0f2e 50%, #0a0a1a 100%)',
    color: '#e2e8f0',
    fontFamily: "'Inter', sans-serif",
    padding: '24px',
  },
  loadingContainer: {
    minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: '#0a0a1a',
  },
  loadingPulse: { textAlign: 'center', animation: 'pulse 2s infinite' },
  loadingBrain: { fontSize: 64, display: 'block', marginBottom: 16 },
  loadingText: { color: '#6366f1', fontSize: 18 },
  errorContainer: { padding: 40, textAlign: 'center' },
  header: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 24, paddingBottom: 20,
    borderBottom: '1px solid rgba(255,255,255,0.08)',
  },
  headerLeft: { display: 'flex', alignItems: 'center', gap: 16 },
  brainIcon: { fontSize: 40 },
  headerTitle: {
    margin: 0, fontSize: 28, fontWeight: 800,
    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
    WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
  },
  headerSubtitle: { margin: 0, color: '#64748b', fontSize: 14 },
  headerRight: { display: 'flex', alignItems: 'center', gap: 12 },
  modeToggle: {
    padding: '6px 16px', borderRadius: 20, border: '1px solid',
    cursor: 'pointer', fontWeight: 700, fontSize: 13, transition: 'all 0.2s',
  },
  btnSettings: {
    padding: '8px 16px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.15)',
    background: 'rgba(255,255,255,0.05)', color: '#e2e8f0', cursor: 'pointer', fontSize: 13,
  },
  btnRefresh: {
    padding: '8px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)',
    background: 'transparent', color: '#64748b', cursor: 'pointer', fontSize: 18,
  },
  tabBar: { display: 'flex', gap: 8, marginBottom: 28 },
  tab: {
    padding: '10px 20px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.08)',
    background: 'transparent', color: '#64748b', cursor: 'pointer', fontSize: 14,
    transition: 'all 0.2s',
  },
  tabActive: {
    background: 'rgba(99,102,241,0.15)', borderColor: 'rgba(99,102,241,0.4)',
    color: '#818cf8',
  },
  tabContent: { maxWidth: 1400 },
  section: { marginBottom: 32 },
  sectionTitle: { fontSize: 18, fontWeight: 700, color: '#c7d2fe', marginBottom: 16, marginTop: 0 },
  sectionSubtitle: { fontSize: 13, color: '#64748b', marginBottom: 20, marginTop: -12 },
  cardsGrid5: {
    display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 16,
  },
  progressCard: {
    background: 'rgba(255,255,255,0.04)', border: '1px solid', borderRadius: 12,
    padding: 20, transition: 'all 0.2s',
  },
  progressCardHeader: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 },
  progressIcon: { fontSize: 20 },
  progressLabel: { fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' },
  progressValues: { display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 10 },
  progressCurrent: { fontSize: 32, fontWeight: 800, color: '#e2e8f0' },
  progressTarget: { fontSize: 14, color: '#64748b' },
  progressBarBg: { height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.08)', marginBottom: 8, overflow: 'hidden' },
  progressBarFill: { height: '100%', borderRadius: 3, transition: 'width 0.8s ease' },
  progressPct: { fontSize: 12, fontWeight: 700 },
  kpiGrid: {
    display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 16,
  },
  kpiCard: {
    border: '1px solid', borderRadius: 12, padding: 20, textAlign: 'center',
    transition: 'all 0.2s',
  },
  kpiLabel: { fontSize: 12, color: '#64748b', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' },
  kpiValue: { fontSize: 26, fontWeight: 800, marginBottom: 4 },
  kpiTarget: { fontSize: 11, color: '#475569', marginBottom: 8 },
  kpiStatus: { fontSize: 11, fontWeight: 600 },
  funnelContainer: { display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 700 },
  funnelRow: { display: 'flex', alignItems: 'center', gap: 12 },
  funnelLabel: { width: 120, fontSize: 13, color: '#94a3b8', textAlign: 'right' },
  funnelBarBg: { flex: 1, height: 36, background: 'rgba(255,255,255,0.05)', borderRadius: 4, overflow: 'hidden' },
  funnelPct: { width: 40, fontSize: 12, fontWeight: 700, textAlign: 'right' },
  anglesGrid: {
    display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 20,
  },
  angleCard: {
    background: 'rgba(255,255,255,0.03)', border: '1px solid', borderRadius: 16,
    padding: 20, position: 'relative',
  },
  angleCardHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  angleNameRow: { display: 'flex', alignItems: 'center', gap: 8 },
  angleEmoji: { fontSize: 20 },
  angleName: { fontSize: 16, fontWeight: 800, color: '#e2e8f0', letterSpacing: '0.05em' },
  angleTrend: { fontSize: 18, fontWeight: 700 },
  angleScore: { fontSize: 28, fontWeight: 900 },
  angleScoreBarBg: {
    position: 'relative', height: 6, background: 'rgba(255,255,255,0.06)',
    borderRadius: 3, overflow: 'visible', marginBottom: 16,
  },
  angleScoreCenter: {
    position: 'absolute', left: '50%', top: -3, width: 2, height: 12,
    background: 'rgba(255,255,255,0.2)', borderRadius: 1,
  },
  angleMetrics: {
    display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 14,
  },
  angleMetric: {
    background: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: '6px 10px',
    display: 'flex', flexDirection: 'column', alignItems: 'center',
  },
  metricLabel: { fontSize: 10, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 2 },
  metricValue: { fontSize: 14, fontWeight: 700, color: '#e2e8f0' },
  angleAction: {
    border: '1px solid', borderRadius: 8, padding: '10px 12px', marginBottom: 10,
  },
  overrideBtn: {
    width: '100%', padding: '8px', border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 6, background: 'transparent', color: '#64748b', cursor: 'pointer', fontSize: 12,
  },
  overrideMenu: {
    display: 'flex', gap: 6, flexWrap: 'wrap' as const, marginTop: 8,
  },
  overrideOption: {
    padding: '6px 12px', borderRadius: 6, border: '1px solid',
    background: 'transparent', cursor: 'pointer', fontSize: 12, fontWeight: 600,
  },
  logList: { display: 'flex', flexDirection: 'column', gap: 12 },
  logEntry: {
    border: '1px solid', borderRadius: 12, padding: 16, transition: 'all 0.2s',
  },
  logEntryHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  logMeta: { display: 'flex', alignItems: 'center', gap: 8 },
  logTypeIcon: { fontSize: 16 },
  logCycleType: { fontSize: 11, color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' },
  logDate: { fontSize: 11, color: '#334155' },
  logOutcome: { fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 },
  logKeptBadge: { fontSize: 10, padding: '2px 6px', borderRadius: 4, background: 'rgba(16,185,129,0.15)', color: '#10b981' },
  logHypothesis: { marginBottom: 8 },
  logAngle: { fontSize: 13, fontWeight: 800, color: '#818cf8', marginRight: 8 },
  logAction: { fontSize: 12, color: '#94a3b8' },
  logReasoning: { margin: '6px 0 0', fontSize: 12, color: '#64748b', lineHeight: 1.5 },
  logDelta: { fontSize: 12, color: '#64748b' },
  emptyState: {
    textAlign: 'center', padding: '48px 24px', color: '#475569',
    background: 'rgba(255,255,255,0.02)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.06)',
  },
  briefRow: { marginBottom: 20 },
  btnBrief: {
    padding: '12px 24px', borderRadius: 10,
    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
    color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer', border: 'none',
    transition: 'all 0.2s',
  },
  briefCard: {
    background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.3)',
    borderRadius: 12, padding: 20, marginBottom: 24,
  },
  briefHeader: { fontSize: 13, color: '#818cf8', fontWeight: 700, marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em' },
  briefText: { fontSize: 14, color: '#cbd5e1', lineHeight: 1.7, margin: 0, whiteSpace: 'pre-wrap' },
  modalOverlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
    backdropFilter: 'blur(4px)', zIndex: 1000,
    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
  },
  modal: {
    background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 20, width: '100%', maxWidth: 680, maxHeight: '90vh',
    overflow: 'hidden', display: 'flex', flexDirection: 'column',
  },
  modalHeader: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '20px 24px', borderBottom: '1px solid rgba(255,255,255,0.08)',
  },
  modalTitle: { margin: 0, fontSize: 20, fontWeight: 700, color: '#e2e8f0' },
  modalClose: {
    background: 'transparent', border: 'none', color: '#64748b',
    fontSize: 24, cursor: 'pointer', lineHeight: 1,
  },
  modalBody: { padding: '24px', overflowY: 'auto', flex: 1 },
  modalFooter: {
    padding: '16px 24px', borderTop: '1px solid rgba(255,255,255,0.08)',
    display: 'flex', justifyContent: 'flex-end', gap: 12,
  },
  settingsSection: { marginBottom: 28 },
  settingsSectionTitle: { fontSize: 14, fontWeight: 700, color: '#818cf8', marginBottom: 16, marginTop: 0 },
  settingsGrid: { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14 },
  settingsInputGroup: { display: 'flex', flexDirection: 'column', gap: 6 },
  settingsLabel: { fontSize: 12, color: '#64748b', fontWeight: 600 },
  settingsInput: {
    padding: '10px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)',
    background: 'rgba(255,255,255,0.05)', color: '#e2e8f0', fontSize: 14,
    outline: 'none',
  },
  optimizeGrid: { display: 'flex', gap: 10, flexWrap: 'wrap' as const },
  optimizeBtn: {
    padding: '8px 20px', borderRadius: 8, border: '1px solid',
    cursor: 'pointer', fontWeight: 700, fontSize: 13, color: '#6366f1', transition: 'all 0.2s',
  },
  textarea: {
    width: '100%', padding: '10px 12px', borderRadius: 8,
    border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)',
    color: '#e2e8f0', fontSize: 13, resize: 'vertical' as const, outline: 'none', boxSizing: 'border-box' as const,
  },
  btnPrimary: {
    padding: '10px 24px', borderRadius: 8, border: 'none',
    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
    color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer',
  },
  btnCancel: {
    padding: '10px 24px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)',
    background: 'transparent', color: '#64748b', fontSize: 14, cursor: 'pointer',
  },
  toast: {
    position: 'fixed', bottom: 24, right: 24, zIndex: 9999,
    background: '#1e293b', border: '1px solid rgba(99,102,241,0.4)',
    borderRadius: 10, padding: '12px 20px', fontSize: 14, color: '#e2e8f0',
    boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
  },
}
