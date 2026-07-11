'use client'

import { useEffect, useState, useCallback } from 'react'

type TrackDist = { human: number; ai: number; duel: number; copilot: number }
type ActorStats = {
  total_actions: number
  deals_won: number
  conversion_rate: number
  positive_rate: number
  total_score: number
  messages_sent: number
  calls_made: number
}
type LeaderboardData = {
  period_days: number
  ai: ActorStats
  human: ActorStats
  winner: 'ai' | 'human' | 'tie'
  track_distribution: TrackDist
  total_leads: number
  ai_assigned: number
}

const PERIOD_OPTIONS = [
  { label: '7 giorni', value: 7 },
  { label: '30 giorni', value: 30 },
  { label: '90 giorni', value: 90 },
]

const TRACK_LABELS: Record<string, { label: string; emoji: string; color: string }> = {
  human: { label: 'Umano', emoji: '👤', color: '#3b82f6' },
  ai: { label: 'AI Solo', emoji: '🤖', color: '#a855f7' },
  duel: { label: 'Duel', emoji: '⚔️', color: '#ef4444' },
  copilot: { label: 'Co-Pilot', emoji: '🤝', color: '#22c55e' },
}

const MODE_INFO = [
  {
    key: 'human',
    emoji: '👤',
    title: 'Human Only',
    desc: 'Il commerciale gestisce il lead dall\'inizio alla fine. Pieno controllo umano.',
    color: '#3b82f6',
    bg: 'rgba(59,130,246,0.08)',
    border: 'rgba(59,130,246,0.25)',
  },
  {
    key: 'ai_first',
    emoji: '🤖',
    title: 'AI First',
    desc: 'L\'AI tenta la chiusura autonomamente. Il commerciale subentra solo se l\'AI fallisce.',
    color: '#a855f7',
    bg: 'rgba(168,85,247,0.08)',
    border: 'rgba(168,85,247,0.25)',
  },
  {
    key: 'copilot',
    emoji: '🤝',
    title: 'Co-Pilot',
    desc: 'AI e umano cooperano. L\'AI suggerisce in tempo reale mentre il commerciale agisce.',
    color: '#22c55e',
    bg: 'rgba(34,197,94,0.08)',
    border: 'rgba(34,197,94,0.25)',
  },
  {
    key: 'duel',
    emoji: '⚔️',
    title: 'Duel',
    desc: 'AI e umano lavorano lo stesso lead in parallelo. Vince chi converte.',
    color: '#ef4444',
    bg: 'rgba(239,68,68,0.08)',
    border: 'rgba(239,68,68,0.25)',
  },
]

function StatCard({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div style={{
      background: 'var(--color-surface-50)',
      border: '1px solid var(--color-surface-200)',
      borderRadius: 12,
      padding: '16px 20px',
    }}>
      <div style={{ fontSize: 11, color: 'var(--color-surface-500)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 800, color: color || 'var(--color-surface-900)', lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: 'var(--color-surface-400)', marginTop: 4 }}>{sub}</div>}
    </div>
  )
}

function ProgressBar({ value, total, color }: { value: number; total: number; color: string }) {
  const pct = total > 0 ? Math.min(100, Math.round((value / total) * 100)) : 0
  return (
    <div style={{ height: 6, background: 'var(--color-surface-200)', borderRadius: 99, overflow: 'hidden' }}>
      <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 99, transition: 'width 0.8s ease' }} />
    </div>
  )
}

function VsBar({ aiVal, humanVal, label }: { aiVal: number; humanVal: number; label: string }) {
  const total = (aiVal || 0) + (humanVal || 0)
  const aiPct = total > 0 ? Math.round((aiVal / total) * 100) : 50
  const humanPct = 100 - aiPct

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: '#a855f7' }}>🤖 {aiVal}</span>
        <span style={{ fontSize: 11, color: 'var(--color-surface-500)' }}>{label}</span>
        <span style={{ fontSize: 12, fontWeight: 700, color: '#3b82f6' }}>{humanVal} 👤</span>
      </div>
      <div style={{ height: 8, borderRadius: 99, display: 'flex', overflow: 'hidden', gap: 1 }}>
        <div style={{ width: `${aiPct}%`, background: '#a855f7', transition: 'width 0.8s ease' }} />
        <div style={{ flex: 1, background: '#3b82f6', transition: 'width 0.8s ease' }} />
      </div>
    </div>
  )
}

export default function ArenaPage() {
  const [data, setData] = useState<LeaderboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState(30)
  const [activeMode, setActiveMode] = useState<string | null>(null)
  const [configLoading, setConfigLoading] = useState(false)
  const [configMsg, setConfigMsg] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/crm/leaderboard?days=${period}`)
      if (res.ok) setData(await res.json())
    } catch {}
    setLoading(false)
  }, [period])

  useEffect(() => { load() }, [load])

  // Auto-refresh ogni 30s
  useEffect(() => {
    const t = setInterval(load, 30000)
    return () => clearInterval(t)
  }, [load])

  const totalActions = (data?.ai.total_actions || 0) + (data?.human.total_actions || 0)

  const winnerBadge = () => {
    if (!data) return null
    if (data.winner === 'ai') return { text: '🤖 AI sta vincendo', color: '#a855f7', bg: 'rgba(168,85,247,0.1)' }
    if (data.winner === 'human') return { text: '👤 Umani stanno vincendo', color: '#3b82f6', bg: 'rgba(59,130,246,0.1)' }
    return { text: '🤝 Pareggio', color: '#22c55e', bg: 'rgba(34,197,94,0.1)' }
  }
  const badge = winnerBadge()

  return (
    <div style={{ maxWidth: 1200 }}>
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 800, color: 'var(--color-surface-900)', margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
              ⚔️ Arena AI vs Human
            </h1>
            <p style={{ fontSize: 14, color: 'var(--color-surface-500)', marginTop: 6, marginBottom: 0 }}>
              Performance comparative in tempo reale — Chi sta convertendo di più?
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {PERIOD_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => setPeriod(opt.value)}
                style={{
                  padding: '6px 14px',
                  borderRadius: 8,
                  border: '1px solid',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                  background: period === opt.value ? 'var(--color-surface-900)' : 'transparent',
                  color: period === opt.value ? 'var(--color-surface-50)' : 'var(--color-surface-600)',
                  borderColor: period === opt.value ? 'var(--color-surface-900)' : 'var(--color-surface-300)',
                }}
              >
                {opt.label}
              </button>
            ))}
            <button
              onClick={load}
              style={{
                padding: '6px 14px', borderRadius: 8, border: '1px solid var(--color-surface-300)',
                fontSize: 12, fontWeight: 600, cursor: 'pointer',
                background: 'transparent', color: 'var(--color-surface-600)',
              }}
            >
              ↻ Refresh
            </button>
          </div>
        </div>

        {/* Winner badge */}
        {badge && !loading && (
          <div style={{
            marginTop: 16, display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '8px 16px', borderRadius: 99,
            background: badge.bg, border: `1px solid ${badge.color}30`,
          }}>
            <span style={{ fontWeight: 800, fontSize: 14, color: badge.color }}>{badge.text}</span>
            <span style={{ fontSize: 12, color: 'var(--color-surface-500)' }}>negli ultimi {period} giorni</span>
          </div>
        )}
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}>
          <div style={{ fontSize: 14, color: 'var(--color-surface-500)' }}>Caricamento arena...</div>
        </div>
      ) : data ? (
        <>
          {/* KPI overview */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 24 }}>
            <StatCard label="Lead Totali" value={data.total_leads} sub={`${data.ai_assigned} assegnati ad AI`} />
            <StatCard label="Azioni AI" value={data.ai.total_actions} color="#a855f7" />
            <StatCard label="Azioni Umani" value={data.human.total_actions} color="#3b82f6" />
            <StatCard label="Deal AI" value={data.ai.deals_won} sub={`${data.ai.conversion_rate}% conv.`} color="#a855f7" />
            <StatCard label="Deal Umani" value={data.human.deals_won} sub={`${data.human.conversion_rate}% conv.`} color="#3b82f6" />
            <StatCard label="Score AI" value={data.ai.total_score} color="#a855f7" />
            <StatCard label="Score Umani" value={data.human.total_score} color="#3b82f6" />
          </div>

          {/* Battle panel */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
            {/* AI card */}
            <div style={{
              background: 'rgba(168,85,247,0.05)', border: '1px solid rgba(168,85,247,0.25)',
              borderRadius: 16, padding: 24,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
                <span style={{ fontSize: 28 }}>🤖</span>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 18, color: '#a855f7' }}>AI Engine</div>
                  <div style={{ fontSize: 11, color: 'var(--color-surface-500)' }}>Agente automatico</div>
                </div>
                {data.winner === 'ai' && (
                  <div style={{ marginLeft: 'auto', background: '#a855f7', color: '#fff', borderRadius: 99, padding: '3px 10px', fontSize: 11, fontWeight: 700 }}>
                    👑 LEADER
                  </div>
                )}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {[
                  { label: 'Azioni', value: data.ai.total_actions },
                  { label: 'Deal Vinti', value: data.ai.deals_won },
                  { label: 'Conv. Rate', value: `${data.ai.conversion_rate}%` },
                  { label: 'Score', value: data.ai.total_score },
                  { label: 'Messaggi', value: data.ai.messages_sent },
                  { label: 'Positività', value: `${data.ai.positive_rate}%` },
                ].map(s => (
                  <div key={s.label} style={{ padding: '10px 12px', background: 'rgba(168,85,247,0.08)', borderRadius: 8 }}>
                    <div style={{ fontSize: 10, color: 'rgba(168,85,247,0.7)', fontWeight: 600, textTransform: 'uppercase' }}>{s.label}</div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: '#a855f7' }}>{s.value}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Human card */}
            <div style={{
              background: 'rgba(59,130,246,0.05)', border: '1px solid rgba(59,130,246,0.25)',
              borderRadius: 16, padding: 24,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
                <span style={{ fontSize: 28 }}>👤</span>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 18, color: '#3b82f6' }}>Team Umano</div>
                  <div style={{ fontSize: 11, color: 'var(--color-surface-500)' }}>Commerciali & Closer</div>
                </div>
                {data.winner === 'human' && (
                  <div style={{ marginLeft: 'auto', background: '#3b82f6', color: '#fff', borderRadius: 99, padding: '3px 10px', fontSize: 11, fontWeight: 700 }}>
                    👑 LEADER
                  </div>
                )}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {[
                  { label: 'Azioni', value: data.human.total_actions },
                  { label: 'Deal Vinti', value: data.human.deals_won },
                  { label: 'Conv. Rate', value: `${data.human.conversion_rate}%` },
                  { label: 'Score', value: data.human.total_score },
                  { label: 'Messaggi', value: data.human.messages_sent },
                  { label: 'Positività', value: `${data.human.positive_rate}%` },
                ].map(s => (
                  <div key={s.label} style={{ padding: '10px 12px', background: 'rgba(59,130,246,0.08)', borderRadius: 8 }}>
                    <div style={{ fontSize: 10, color: 'rgba(59,130,246,0.7)', fontWeight: 600, textTransform: 'uppercase' }}>{s.label}</div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: '#3b82f6' }}>{s.value}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* VS Bars */}
          <div style={{
            background: 'var(--color-surface-50)', border: '1px solid var(--color-surface-200)',
            borderRadius: 16, padding: 24, marginBottom: 24
          }}>
            <h3 style={{ margin: '0 0 20px', fontSize: 14, fontWeight: 700, color: 'var(--color-surface-700)' }}>
              📊 Confronto Metrico
            </h3>
            <VsBar aiVal={data.ai.deals_won} humanVal={data.human.deals_won} label="Deal Vinti" />
            <VsBar aiVal={data.ai.total_actions} humanVal={data.human.total_actions} label="Azioni Totali" />
            <VsBar aiVal={data.ai.messages_sent} humanVal={data.human.messages_sent} label="Messaggi Inviati" />
            <VsBar aiVal={data.ai.total_score} humanVal={data.human.total_score} label="Score Totale" />
          </div>

          {/* Track Distribution */}
          <div style={{
            background: 'var(--color-surface-50)', border: '1px solid var(--color-surface-200)',
            borderRadius: 16, padding: 24, marginBottom: 32
          }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 14, fontWeight: 700, color: 'var(--color-surface-700)' }}>
              🎯 Distribuzione Lead per Modalità
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
              {Object.entries(TRACK_LABELS).map(([key, cfg]) => (
                <div key={key} style={{
                  padding: '14px 16px', borderRadius: 10,
                  background: `${cfg.color}10`, border: `1px solid ${cfg.color}30`,
                  textAlign: 'center'
                }}>
                  <div style={{ fontSize: 24 }}>{cfg.emoji}</div>
                  <div style={{ fontWeight: 800, fontSize: 22, color: cfg.color, marginTop: 4 }}>
                    {data.track_distribution[key as keyof TrackDist] || 0}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--color-surface-500)', marginTop: 2 }}>{cfg.label}</div>
                  <div style={{ marginTop: 8 }}>
                    <ProgressBar
                      value={data.track_distribution[key as keyof TrackDist] || 0}
                      total={data.total_leads}
                      color={cfg.color}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      ) : (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--color-surface-500)' }}>
          Nessun dato disponibile
        </div>
      )}

      {/* Modalità Configuration */}
      <div style={{
        background: 'var(--color-surface-50)', border: '1px solid var(--color-surface-200)',
        borderRadius: 16, padding: 28
      }}>
        <h3 style={{ margin: '0 0 8px', fontSize: 16, fontWeight: 800, color: 'var(--color-surface-900)' }}>
          ⚙️ Configura Modalità CRM
        </h3>
        <p style={{ margin: '0 0 20px', fontSize: 13, color: 'var(--color-surface-500)' }}>
          Scegli come AI e team umano collaborano o competono sui nuovi lead
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
          {MODE_INFO.map(mode => (
            <button
              key={mode.key}
              onClick={() => setActiveMode(activeMode === mode.key ? null : mode.key)}
              style={{
                padding: 20, borderRadius: 12, border: `2px solid`,
                borderColor: activeMode === mode.key ? mode.color : mode.border,
                background: activeMode === mode.key ? mode.bg : 'transparent',
                cursor: 'pointer', textAlign: 'left', transition: 'all 0.2s',
                transform: activeMode === mode.key ? 'scale(1.02)' : 'scale(1)',
              }}
            >
              <div style={{ fontSize: 26, marginBottom: 8 }}>{mode.emoji}</div>
              <div style={{ fontWeight: 800, fontSize: 14, color: mode.color, marginBottom: 6 }}>{mode.title}</div>
              <div style={{ fontSize: 12, color: 'var(--color-surface-500)', lineHeight: 1.5 }}>{mode.desc}</div>
            </button>
          ))}
        </div>
        {activeMode && (
          <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
            <button
              onClick={async () => {
                setConfigLoading(true)
                setConfigMsg('')
                try {
                  const res = await fetch('/api/crm/ai-track', {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ pipeline_mode: activeMode })
                  })
                  setConfigMsg(res.ok ? '✅ Modalità aggiornata per i nuovi lead' : '❌ Errore nel salvataggio')
                } catch { setConfigMsg('❌ Errore di rete') }
                setConfigLoading(false)
              }}
              disabled={configLoading}
              style={{
                padding: '10px 24px', borderRadius: 10, border: 'none',
                background: 'var(--color-surface-900)', color: '#fff',
                fontWeight: 700, fontSize: 14, cursor: 'pointer',
              }}
            >
              {configLoading ? 'Salvando...' : `Applica: ${MODE_INFO.find(m => m.key === activeMode)?.title}`}
            </button>
            {configMsg && <span style={{ fontSize: 13, color: 'var(--color-surface-600)' }}>{configMsg}</span>}
          </div>
        )}
      </div>
    </div>
  )
}
