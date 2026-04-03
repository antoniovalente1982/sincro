'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import {
  Palette, Image as ImageIcon, Video, Eye, DollarSign, Target,
  TrendingUp, Play, Pause, ExternalLink, Loader2, Film
} from 'lucide-react'

interface AdCreative {
  id: string
  campaign_name: string
  ad_name?: string
  status: string
  spend: number
  impressions: number
  clicks: number
  ctr: number
  leads_count: number
  cpl: number
  link_clicks: number
  link_click_ctr: number
  thumbnail_url?: string
  creative_type?: string // image | video
}

interface Props { orgId: string }

export default function CreativesTab({ orgId }: Props) {
  const [ads, setAds] = useState<AdCreative[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'active' | 'paused'>('active')
  const [sort, setSort] = useState<'spend' | 'cpl' | 'ctr' | 'leads'>('spend')

  useEffect(() => {
    const fetchAds = async () => {
      setLoading(true)
      try {
        const supabase = createClient()
        const { data: { session } } = await supabase.auth.getSession()
        // Fetch ads from the meta insights endpoint (live)
        const now = new Date()
        const since = new Date(now.getFullYear(), now.getMonth(), 1)
        const formatD = (d: Date) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
        
        const res = await fetch(`/api/meta/insights?since=${formatD(since)}&until=${formatD(now)}&_t=${Date.now()}`, {
          headers: { 
            Authorization: `Bearer ${session?.access_token}`,
            'Cache-Control': 'no-cache'
          },
        })
        const data = await res.json()
        if (data.success && data.campaigns) {
          setAds(data.campaigns.map((c: any) => ({
            id: c.id,
            campaign_name: c.campaign_name || 'Unnamed',
            status: c.status || 'UNKNOWN',
            spend: Number(c.spend) || 0,
            impressions: Number(c.impressions) || 0,
            clicks: Number(c.clicks) || 0,
            ctr: Number(c.ctr) || 0,
            leads_count: Number(c.leads_count) || 0,
            cpl: Number(c.cpl) || 0,
            link_clicks: Number(c.link_clicks) || 0,
            link_click_ctr: Number(c.link_click_ctr) || 0,
          })))
        }
      } catch {}
      setLoading(false)
    }
    fetchAds()
  }, [orgId])

  const filtered = ads
    .filter(a => filter === 'all' ? true : filter === 'active' ? a.status === 'ACTIVE' : a.status === 'PAUSED')
    .sort((a, b) => {
      switch (sort) {
        case 'cpl': return (a.cpl || 999) - (b.cpl || 999)
        case 'ctr': return (b.ctr || 0) - (a.ctr || 0)
        case 'leads': return (b.leads_count || 0) - (a.leads_count || 0)
        default: return (b.spend || 0) - (a.spend || 0)
      }
    })

  const totalSpend = filtered.reduce((s, a) => s + a.spend, 0)
  const totalLeads = filtered.reduce((s, a) => s + a.leads_count, 0)
  const avgCPL = totalLeads > 0 ? totalSpend / totalLeads : 0

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <Palette className="w-5 h-5" style={{ color: '#14b8a6' }} />
          <div>
            <h2 className="text-lg font-bold text-white">Creativi & Ads</h2>
            <p className="text-[11px]" style={{ color: 'var(--color-surface-500)' }}>
              {filtered.length} campagne • €{totalSpend.toFixed(0)} spesi • {totalLeads} lead • CPL medio €{avgCPL.toFixed(1)}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Link href="/dashboard/ai-engine/creative-studio"
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all hover:scale-105"
            style={{ background: 'rgba(168,85,247,0.1)', border: '1px solid rgba(168,85,247,0.25)', color: '#c084fc' }}>
            <Palette className="w-3.5 h-3.5" /> Creative Studio
          </Link>
          <Link href="/dashboard/ai-engine/video-editor"
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all hover:scale-105"
            style={{ background: 'rgba(20,184,166,0.1)', border: '1px solid rgba(20,184,166,0.25)', color: '#14b8a6' }}>
            <Film className="w-3.5 h-3.5" /> Video Editor
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="flex p-1 rounded-xl gap-1" style={{ background: 'var(--color-surface-100)', border: '1px solid var(--color-surface-200)' }}>
          {(['active', 'paused', 'all'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className="px-3 py-1.5 text-[11px] font-bold rounded-lg transition-all"
              style={{
                background: filter === f ? 'rgba(168,85,247,0.15)' : 'transparent',
                color: filter === f ? '#c084fc' : 'var(--color-surface-500)',
              }}>
              {f === 'active' ? '🟢 Attive' : f === 'paused' ? '⏸ In Pausa' : '📋 Tutte'}
            </button>
          ))}
        </div>
        <div className="flex p-1 rounded-xl gap-1" style={{ background: 'var(--color-surface-100)', border: '1px solid var(--color-surface-200)' }}>
          {([
            { key: 'spend', label: '💰 Spesa' },
            { key: 'cpl', label: '📊 CPL' },
            { key: 'ctr', label: '📈 CTR' },
            { key: 'leads', label: '👥 Lead' },
          ] as const).map(s => (
            <button key={s.key} onClick={() => setSort(s.key)}
              className="px-3 py-1.5 text-[11px] font-bold rounded-lg transition-all"
              style={{
                background: sort === s.key ? 'rgba(20,184,166,0.15)' : 'transparent',
                color: sort === s.key ? '#14b8a6' : 'var(--color-surface-500)',
              }}>
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Cards Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin" style={{ color: '#a855f7' }} />
        </div>
      ) : filtered.length === 0 ? (
        <div className="glass-card text-center py-16">
          <Palette className="w-10 h-10 mx-auto mb-3" style={{ color: 'var(--color-surface-400)' }} />
          <h3 className="font-bold text-white mb-1">Nessuna campagna trovata</h3>
          <p className="text-xs" style={{ color: 'var(--color-surface-500)' }}>Cambia i filtri o synca i dati da Meta.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(ad => {
            const cplColor = ad.cpl > 0 && ad.cpl < 10 ? '#22c55e' : ad.cpl > 0 && ad.cpl < 25 ? '#f59e0b' : ad.cpl > 0 ? '#ef4444' : 'var(--color-surface-500)'
            return (
              <div key={ad.id} className="glass-card overflow-hidden transition-all hover:scale-[1.01] hover:border-white/10 group">
                {/* Creative preview area */}
                <div className="h-32 flex items-center justify-center relative" style={{
                  background: 'linear-gradient(135deg, rgba(99,102,241,0.08), rgba(168,85,247,0.06))',
                }}>
                  {ad.thumbnail_url ? (
                    <img src={ad.thumbnail_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="flex flex-col items-center gap-2">
                      <ImageIcon className="w-8 h-8" style={{ color: 'var(--color-surface-400)' }} />
                      <span className="text-[10px] font-mono" style={{ color: 'var(--color-surface-500)' }}>CAMPAIGN</span>
                    </div>
                  )}
                  {/* Status badge */}
                  <div className="absolute top-3 right-3">
                    <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full backdrop-blur-sm" style={{
                      background: ad.status === 'ACTIVE' ? 'rgba(34,197,94,0.2)' : 'rgba(245,158,11,0.2)',
                      color: ad.status === 'ACTIVE' ? '#22c55e' : '#f59e0b',
                      border: `1px solid ${ad.status === 'ACTIVE' ? 'rgba(34,197,94,0.3)' : 'rgba(245,158,11,0.3)'}`,
                    }}>
                      {ad.status === 'ACTIVE' ? <Play className="w-2.5 h-2.5" /> : <Pause className="w-2.5 h-2.5" />}
                      {ad.status === 'ACTIVE' ? 'LIVE' : 'PAUSED'}
                    </span>
                  </div>
                </div>

                {/* Info */}
                <div className="p-4">
                  <h4 className="text-sm font-bold text-white truncate mb-3">{ad.campaign_name}</h4>
                  <div className="grid grid-cols-3 gap-3">
                    <MetricCell label="Spesa" value={`€${ad.spend.toFixed(0)}`} icon={DollarSign} color="#818cf8" />
                    <MetricCell label="CPL" value={ad.cpl > 0 ? `€${ad.cpl.toFixed(1)}` : '—'} icon={Target} color={cplColor} />
                    <MetricCell label="Lead" value={String(ad.leads_count)} icon={TrendingUp} color="#3b82f6" />
                  </div>
                  <div className="grid grid-cols-3 gap-3 mt-2">
                    <MetricCell label="Click" value={String(ad.clicks)} icon={Eye} color="var(--color-surface-500)" />
                    <MetricCell label="CTR" value={`${ad.ctr.toFixed(2)}%`} icon={TrendingUp} color="#22c55e" />
                    <MetricCell label="Link Click" value={String(ad.link_clicks)} icon={ExternalLink} color="#14b8a6" />
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function MetricCell({ label, value, icon: Icon, color }: { label: string; value: string; icon: any; color: string }) {
  return (
    <div>
      <div className="text-[9px] uppercase tracking-wider font-semibold mb-0.5" style={{ color: 'var(--color-surface-600)' }}>{label}</div>
      <div className="text-xs font-bold" style={{ color }}>{value}</div>
    </div>
  )
}
