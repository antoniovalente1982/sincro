'use client'

import { useState } from 'react'
import {
    Paintbrush, ArrowLeft, Sparkles, Send, Loader2, Copy, CheckCircle,
    Image as ImageIcon, Video, LayoutGrid, Square, Smartphone, Monitor,
    ChevronRight, Brain, Zap, Target, MessageSquare, RefreshCw, FileText,
    ChevronDown, Plus, Trash2, Eye, Play
} from 'lucide-react'
import Link from 'next/link'
import dynamic from 'next/dynamic'

const VideoPlayerClient = dynamic(() => import('../video-preview/VideoPlayerClient'), {
    ssr: false,
    loading: () => (
        <div className="w-full flex flex-col items-center justify-center p-12 glass-card">
            <Loader2 className="w-8 h-8 animate-spin text-yellow-500 mb-4" />
            <div className="text-sm text-surface-400">Inizializzazione Motore Video 3D in corso...</div>
        </div>
    )
})

interface Brief {
    id: string; brief_data: any; generated_copies: any[]
    generated_assets: any[]; status: string
    performance_score?: number; feedback?: string; created_at: string
}

interface Campaign {
    id: string; campaign_name?: string; status?: string
}

interface Props {
    briefs: Brief[]
    campaigns: Campaign[]
}

const TONES = [
    { value: 'professionale', label: 'Professionale', emoji: '🎯', desc: 'Chiaro, autorevole, basato su dati' },
    { value: 'amichevole', label: 'Amichevole', emoji: '😊', desc: 'Caldo, diretto, conversazionale' },
    { value: 'urgente', label: 'Urgente', emoji: '⚡', desc: 'Senso di urgenza, FOMO, scarsità' },
    { value: 'esclusivo', label: 'Esclusivo', emoji: '💎', desc: 'Lusso, esclusività, premium' },
    { value: 'provocatorio', label: 'Provocatorio', emoji: '🔥', desc: 'Sfidante, disruptive, bold' },
]

const PLATFORMS = [
    { value: 'facebook', label: 'Facebook', icon: '📘' },
    { value: 'instagram', label: 'Instagram', icon: '📸' },
    { value: 'google', label: 'Google Ads', icon: '🔍' },
    { value: 'tiktok', label: 'TikTok', icon: '🎵' },
]

const FORMATS = [
    { value: 'immagine', label: 'Immagine Singola', icon: Square },
    { value: 'carousel', label: 'Carousel', icon: LayoutGrid },
    { value: 'video', label: 'Video', icon: Video },
    { value: 'stories', label: 'Stories', icon: Smartphone },
]

export default function CreativeStudio({ briefs: initialBriefs, campaigns }: Props) {
    const [briefs, setBriefs] = useState(initialBriefs)
    const [view, setView] = useState<'list' | 'create' | 'detail'>('list')
    const [selectedBrief, setSelectedBrief] = useState<Brief | null>(null)
    const [generating, setGenerating] = useState(false)
    const [renderingVideo, setRenderingVideo] = useState(false)
    const [copiedIdx, setCopiedIdx] = useState<number | null>(null)
    const [videoFormat, setVideoFormat] = useState<'9:16' | '16:9' | '1:1'>('9:16')

    // Brief form state
    const [product, setProduct] = useState('')
    const [audience, setAudience] = useState('')
    const [tone, setTone] = useState('amichevole')
    const [platform, setPlatform] = useState('facebook')
    const [format, setFormat] = useState('immagine')
    const [extraNotes, setExtraNotes] = useState('')

    const handleGenerate = async () => {
        if (!product.trim()) return
        setGenerating(true)

        try {
            const res = await fetch('/api/ai-engine', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'create_brief',
                    brief_data: { product, audience, tone, platform, format, extra_notes: extraNotes },
                }),
            })
            const data = await res.json()
            if (data.brief) {
                setBriefs(prev => [data.brief, ...prev])
                setSelectedBrief(data.brief)
                setView('detail')
                // Reset form
                setProduct(''); setAudience(''); setExtraNotes('')
            }
        } catch (err) {
            console.error(err)
        }
        setGenerating(false)
    }

    const copyToClipboard = (text: string, idx: number) => {
        navigator.clipboard.writeText(text)
        setCopiedIdx(idx)
        setTimeout(() => setCopiedIdx(null), 2000)
    }

    // === LIST VIEW ===
    if (view === 'list') {
        return (
            <div className="space-y-6 animate-fade-in">
                {/* Header */}
                <div className="flex items-start justify-between flex-wrap gap-4">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <Link href="/dashboard/ai-engine" className="text-xs flex items-center gap-1 hover:underline" style={{ color: 'var(--color-surface-500)' }}>
                                <ArrowLeft className="w-3 h-3" /> AI Engine
                            </Link>
                        </div>
                        <h1 className="text-2xl font-bold text-white flex items-center gap-3">
                            <Paintbrush className="w-7 h-7" style={{ color: '#a855f7' }} />
                            Creative Studio
                        </h1>
                        <p className="text-sm mt-1" style={{ color: 'var(--color-surface-600)' }}>
                            Genera copy e brief per le tue ads con l'AI — headline, body e CTA pronti all'uso
                        </p>
                    </div>
                    <button onClick={() => setView('create')} className="btn-primary">
                        <Plus className="w-4 h-4" /> Nuovo Brief
                    </button>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[
                        { label: 'Brief Creati', value: briefs.length, icon: FileText, color: '#a855f7' },
                        { label: 'Variazioni Generate', value: briefs.reduce((s, b) => s + (b.generated_copies?.length || 0), 0), icon: Sparkles, color: '#f59e0b' },
                        { label: 'Pronti', value: briefs.filter(b => b.status === 'ready').length, icon: CheckCircle, color: '#22c55e' },
                        { label: 'In Draft', value: briefs.filter(b => b.status === 'draft').length, icon: MessageSquare, color: '#3b82f6' },
                    ].map(stat => (
                        <div key={stat.label} className="kpi-card">
                            <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-3" style={{
                                background: `${stat.color}15`, border: `1px solid ${stat.color}30`,
                            }}>
                                <stat.icon className="w-4 h-4" style={{ color: stat.color }} />
                            </div>
                            <div className="text-2xl font-bold text-white">{stat.value}</div>
                            <div className="text-xs mt-1" style={{ color: 'var(--color-surface-500)' }}>{stat.label}</div>
                        </div>
                    ))}
                </div>

                {/* Briefs List */}
                {briefs.length > 0 ? (
                    <div className="space-y-3">
                        {briefs.map(brief => (
                            <div key={brief.id} className="glass-card p-5 cursor-pointer transition-all hover:scale-[1.005] hover:bg-white/[0.02]"
                                onClick={() => { setSelectedBrief(brief); setView('detail') }}>
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0" style={{
                                        background: 'rgba(168, 85, 247, 0.1)', border: '1px solid rgba(168, 85, 247, 0.2)',
                                    }}>
                                        <Sparkles className="w-5 h-5" style={{ color: '#a855f7' }} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="text-sm font-bold text-white truncate">
                                            {brief.brief_data?.product || 'Brief senza nome'}
                                        </div>
                                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                                            {brief.brief_data?.tone && (
                                                <span className="text-[10px] px-2 py-0.5 rounded-full" style={{
                                                    background: 'rgba(168, 85, 247, 0.1)', color: '#a855f7',
                                                    border: '1px solid rgba(168, 85, 247, 0.2)',
                                                }}>{brief.brief_data.tone}</span>
                                            )}
                                            {brief.brief_data?.platform && (
                                                <span className="text-[10px] px-2 py-0.5 rounded-full" style={{
                                                    background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6',
                                                    border: '1px solid rgba(59, 130, 246, 0.2)',
                                                }}>{brief.brief_data.platform}</span>
                                            )}
                                            <span className="text-[10px]" style={{ color: 'var(--color-surface-600)' }}>
                                                {brief.generated_copies?.length || 0} variazioni
                                            </span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3 flex-shrink-0">
                                        <span className="badge" style={{
                                            fontSize: '10px',
                                            background: brief.status === 'ready' ? 'rgba(34, 197, 94, 0.1)' : 'rgba(245, 158, 11, 0.1)',
                                            color: brief.status === 'ready' ? '#22c55e' : '#f59e0b',
                                            border: `1px solid ${brief.status === 'ready' ? 'rgba(34, 197, 94, 0.2)' : 'rgba(245, 158, 11, 0.2)'}`,
                                        }}>{brief.status === 'ready' ? 'Pronto' : brief.status}</span>
                                        <span className="text-[10px]" style={{ color: 'var(--color-surface-600)' }}>
                                            {new Date(brief.created_at).toLocaleDateString('it-IT')}
                                        </span>
                                        <ChevronRight className="w-4 h-4" style={{ color: 'var(--color-surface-500)' }} />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="glass-card p-12 text-center">
                        <div className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center" style={{
                            background: 'rgba(168, 85, 247, 0.1)', border: '1px solid rgba(168, 85, 247, 0.2)',
                        }}>
                            <Paintbrush className="w-8 h-8" style={{ color: '#a855f7' }} />
                        </div>
                        <h2 className="text-lg font-bold text-white mb-2">Nessun brief creativo</h2>
                        <p className="text-sm mb-6 max-w-md mx-auto" style={{ color: 'var(--color-surface-500)' }}>
                            Crea il tuo primo brief e lascia che l'AI generi headline, body e CTA pronti per le tue campagne.
                        </p>
                        <button onClick={() => setView('create')} className="btn-primary">
                            <Sparkles className="w-4 h-4" /> Crea il primo brief
                        </button>
                    </div>
                )}
            </div>
        )
    }

    // === CREATE VIEW ===
    if (view === 'create') {
        return (
            <div className="space-y-6 animate-fade-in max-w-3xl mx-auto">
                {/* Header */}
                <div>
                    <button onClick={() => setView('list')} className="text-xs flex items-center gap-1 mb-2 hover:underline" style={{ color: 'var(--color-surface-500)' }}>
                        <ArrowLeft className="w-3 h-3" /> Torna ai brief
                    </button>
                    <h1 className="text-2xl font-bold text-white flex items-center gap-3">
                        <Sparkles className="w-7 h-7" style={{ color: '#a855f7' }} />
                        Nuovo Brief Creativo
                    </h1>
                    <p className="text-sm mt-1" style={{ color: 'var(--color-surface-600)' }}>
                        Descrivi il tuo prodotto e l'AI genererà copy pronti per le ads
                    </p>
                </div>

                {/* Form */}
                <div className="glass-card p-6 space-y-6">
                    {/* Product */}
                    <div>
                        <label className="label">Prodotto / Servizio *</label>
                        <input
                            type="text" className="input" value={product}
                            onChange={e => setProduct(e.target.value)}
                            placeholder="Es: Corso di Marketing Digitale, Crema Anti-Age Premium, App Fitness..."
                        />
                        <p className="text-[10px] mt-1" style={{ color: 'var(--color-surface-600)' }}>
                            Descrivi brevemente cosa stai promuovendo
                        </p>
                    </div>

                    {/* Audience */}
                    <div>
                        <label className="label">Target Audience</label>
                        <input
                            type="text" className="input" value={audience}
                            onChange={e => setAudience(e.target.value)}
                            placeholder="Es: Imprenditori 25-45, Mamme con bambini 0-5 anni, Professionisti IT..."
                        />
                        <p className="text-[10px] mt-1" style={{ color: 'var(--color-surface-600)' }}>
                            Chi è il tuo cliente ideale? Più specifico = copy più efficace
                        </p>
                    </div>

                    {/* Tone */}
                    <div>
                        <label className="label">Tone of Voice</label>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                            {TONES.map(t => (
                                <button key={t.value} onClick={() => setTone(t.value)}
                                    className="p-3 rounded-xl text-left transition-all" style={{
                                        background: tone === t.value ? 'rgba(168, 85, 247, 0.1)' : 'var(--color-surface-100)',
                                        border: `1px solid ${tone === t.value ? 'rgba(168, 85, 247, 0.4)' : 'var(--color-surface-200)'}`,
                                    }}>
                                    <div className="text-sm font-semibold text-white flex items-center gap-1.5">
                                        <span>{t.emoji}</span> {t.label}
                                    </div>
                                    <div className="text-[10px] mt-0.5" style={{ color: 'var(--color-surface-500)' }}>{t.desc}</div>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Platform */}
                    <div>
                        <label className="label">Piattaforma</label>
                        <div className="flex flex-wrap gap-2">
                            {PLATFORMS.map(p => (
                                <button key={p.value} onClick={() => setPlatform(p.value)}
                                    className="px-4 py-2 rounded-xl text-sm font-medium transition-all flex items-center gap-1.5" style={{
                                        background: platform === p.value ? 'rgba(99, 102, 241, 0.1)' : 'var(--color-surface-100)',
                                        border: `1px solid ${platform === p.value ? 'rgba(99, 102, 241, 0.4)' : 'var(--color-surface-200)'}`,
                                        color: platform === p.value ? '#6366f1' : 'var(--color-surface-700)',
                                    }}>
                                    <span>{p.icon}</span> {p.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Format */}
                    <div>
                        <label className="label">Formato</label>
                        <div className="flex flex-wrap gap-2">
                            {FORMATS.map(f => (
                                <button key={f.value} onClick={() => setFormat(f.value)}
                                    className="px-4 py-2 rounded-xl text-sm font-medium transition-all flex items-center gap-1.5" style={{
                                        background: format === f.value ? 'rgba(245, 158, 11, 0.1)' : 'var(--color-surface-100)',
                                        border: `1px solid ${format === f.value ? 'rgba(245, 158, 11, 0.4)' : 'var(--color-surface-200)'}`,
                                        color: format === f.value ? '#f59e0b' : 'var(--color-surface-700)',
                                    }}>
                                    <f.icon className="w-4 h-4" /> {f.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Extra Notes */}
                    <div>
                        <label className="label">Note Aggiuntive (opzionale)</label>
                        <textarea
                            className="input" rows={3} value={extraNotes}
                            onChange={e => setExtraNotes(e.target.value)}
                            placeholder="Offerte speciali, USP particolari, cose da menzionare o evitare..."
                        />
                    </div>
                </div>

                {/* Generate Button */}
                <button onClick={handleGenerate} className="btn-primary w-full py-3 text-base" disabled={!product.trim() || generating}>
                    {generating ? (
                        <><Loader2 className="w-5 h-5 animate-spin" /> L'AI sta creando le variazioni...</>
                    ) : (
                        <><Brain className="w-5 h-5" /> Genera Copy con AI</>
                    )}
                </button>

                {/* AI Creative Integration Placeholder */}
                <div className="glass-card p-5">
                    <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{
                            background: 'rgba(168, 85, 247, 0.1)', border: '1px solid rgba(168, 85, 247, 0.2)',
                        }}>
                            <ImageIcon className="w-5 h-5" style={{ color: '#a855f7' }} />
                        </div>
                        <div>
                            <div className="text-sm font-bold text-white mb-1">Generazione Creativi Visivi</div>
                            <div className="text-xs" style={{ color: 'var(--color-surface-500)' }}>
                                🔜 Prossimamente: integrazione con <strong>Nano Banana</strong> per immagini e <strong>Veo 3</strong> per video.
                                L'AI genererà automaticamente le creative visive basate sul tuo brief.
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        )
    }

    // === DETAIL VIEW ===
    if (view === 'detail' && selectedBrief) {
        const brief = selectedBrief
        const copies = Array.isArray(brief.generated_copies) ? brief.generated_copies : []
        const bd = brief.brief_data || {}

        return (
            <div className="space-y-6 animate-fade-in">
                {/* Header */}
                <div className="flex items-start justify-between flex-wrap gap-4">
                    <div>
                        <button onClick={() => { setView('list'); setSelectedBrief(null) }}
                            className="text-xs flex items-center gap-1 mb-2 hover:underline" style={{ color: 'var(--color-surface-500)' }}>
                            <ArrowLeft className="w-3 h-3" /> Torna ai brief
                        </button>
                        <h1 className="text-2xl font-bold text-white flex items-center gap-3">
                            <Sparkles className="w-7 h-7" style={{ color: '#a855f7' }} />
                            {bd.product || 'Brief Creativo'}
                        </h1>
                        <p className="text-sm mt-1" style={{ color: 'var(--color-surface-600)' }}>
                            {copies.length} variazioni generate • {new Date(brief.created_at).toLocaleDateString('it-IT', { day: '2-digit', month: 'long', year: 'numeric' })}
                        </p>
                    </div>
                    <button onClick={() => setView('create')} className="btn-primary" style={{
                        background: 'rgba(168, 85, 247, 0.15)', border: '1px solid rgba(168, 85, 247, 0.3)', color: '#a855f7',
                    }}>
                        <Plus className="w-4 h-4" /> Nuovo Brief
                    </button>
                </div>

                {/* Brief Summary */}
                <div className="glass-card p-5">
                    <h3 className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: 'var(--color-surface-500)' }}>Dettagli Brief</h3>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                        {[
                            { label: 'Prodotto', value: bd.product },
                            { label: 'Audience', value: bd.audience || '—' },
                            { label: 'Tone', value: bd.tone },
                            { label: 'Piattaforma', value: bd.platform },
                            { label: 'Formato', value: bd.format },
                        ].map(d => (
                            <div key={d.label} className="p-3 rounded-xl" style={{
                                background: 'var(--color-surface-100)', border: '1px solid var(--color-surface-200)',
                            }}>
                                <div className="text-[10px] uppercase tracking-wider mb-1" style={{ color: 'var(--color-surface-600)' }}>{d.label}</div>
                                <div className="text-xs font-semibold text-white truncate">{d.value || '—'}</div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Generated Copies */}
                <div className="space-y-4">
                    <h2 className="text-base font-bold text-white flex items-center gap-2">
                        <Brain className="w-5 h-5" style={{ color: '#a855f7' }} />
                        Variazioni AI
                    </h2>

                    {copies.map((copy: any, idx: number) => (
                        <div key={idx} className="glass-card p-6 relative overflow-hidden">
                            <div className="absolute top-0 left-0 w-1 h-full" style={{
                                background: idx === 0 ? '#22c55e' : idx === 1 ? '#3b82f6' : '#f59e0b',
                            }} />

                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-2">
                                    <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{
                                        background: idx === 0 ? 'rgba(34, 197, 94, 0.1)' : idx === 1 ? 'rgba(59, 130, 246, 0.1)' : 'rgba(245, 158, 11, 0.1)',
                                        color: idx === 0 ? '#22c55e' : idx === 1 ? '#3b82f6' : '#f59e0b',
                                        border: `1px solid ${idx === 0 ? 'rgba(34, 197, 94, 0.2)' : idx === 1 ? 'rgba(59, 130, 246, 0.2)' : 'rgba(245, 158, 11, 0.2)'}`,
                                    }}>Variante {copy.variant || String.fromCharCode(65 + idx)}</span>
                                    {copy.style_note && (
                                        <span className="text-[10px]" style={{ color: 'var(--color-surface-600)' }}>{copy.style_note}</span>
                                    )}
                                </div>
                                <button onClick={() => {
                                    const full = `${copy.headline}\n\n${copy.body}\n\n${copy.cta}\n\n${copy.link_description || ''}`
                                    copyToClipboard(full, idx)
                                }}
                                    className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg transition-all hover:bg-white/5" style={{
                                        color: copiedIdx === idx ? '#22c55e' : 'var(--color-surface-500)',
                                    }}>
                                    {copiedIdx === idx ? <CheckCircle className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                                    {copiedIdx === idx ? 'Copiato!' : 'Copia tutto'}
                                </button>
                            </div>

                            <div className="space-y-4">
                                {/* Headline */}
                                <div>
                                    <div className="text-[10px] uppercase tracking-wider font-semibold mb-1" style={{ color: 'var(--color-surface-600)' }}>Headline</div>
                                    <div className="text-lg font-bold text-white leading-tight">{copy.headline}</div>
                                </div>

                                {/* Body */}
                                <div>
                                    <div className="text-[10px] uppercase tracking-wider font-semibold mb-1" style={{ color: 'var(--color-surface-600)' }}>Body Text</div>
                                    <div className="text-sm leading-relaxed" style={{ color: 'var(--color-surface-700)' }}>{copy.body}</div>
                                </div>

                                {/* CTA */}
                                <div className="flex items-center gap-4">
                                    <div>
                                        <div className="text-[10px] uppercase tracking-wider font-semibold mb-1" style={{ color: 'var(--color-surface-600)' }}>CTA</div>
                                        <div className="inline-block px-4 py-2 rounded-xl text-sm font-bold" style={{
                                            background: 'rgba(99, 102, 241, 0.15)', color: '#6366f1',
                                            border: '1px solid rgba(99, 102, 241, 0.3)',
                                        }}>{copy.cta}</div>
                                    </div>
                                    {copy.link_description && (
                                        <div className="flex-1">
                                            <div className="text-[10px] uppercase tracking-wider font-semibold mb-1" style={{ color: 'var(--color-surface-600)' }}>Link Description</div>
                                            <div className="text-xs" style={{ color: 'var(--color-surface-500)' }}>{copy.link_description}</div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* AI VIDEO FACTORY: RENDER PREVIEW & CONTROLS */}
                {bd.format === 'video' || bd.format === 'stories' ? (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8">
                        {/* Left: Settings & Generation */}
                        <div className="glass-card p-6" style={{ border: '1px solid rgba(236, 72, 153, 0.3)' }}>
                            <div className="flex items-start gap-4 mb-6">
                                <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0" style={{
                                    background: 'linear-gradient(135deg, rgba(236, 72, 153, 0.15), rgba(168, 85, 247, 0.15))',
                                    border: '1px solid rgba(236, 72, 153, 0.4)',
                                }}>
                                    <Video className="w-6 h-6" style={{ color: '#ec4899' }} />
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold text-white mb-1">AI Video Factory</h3>
                                    <p className="text-sm" style={{ color: 'var(--color-surface-500)' }}>
                                        L'AI ha pre-impostato la scena. Scegli il formato e lancia la produzione.
                                    </p>
                                </div>
                            </div>

                            <div className="space-y-5">
                                {/* Format Selector */}
                                <div>
                                    <label className="label">Formato Video</label>
                                    <div className="flex gap-2">
                                        {[
                                            { id: '9:16', label: 'Reels / TikTok', sub: 'Verticale' },
                                            { id: '16:9', label: 'YouTube / Web', sub: 'Orizzontale' },
                                            { id: '1:1', label: 'Post Feed', sub: 'Quadrato' }
                                        ].map(f => (
                                            <button key={f.id} onClick={() => setVideoFormat(f.id as any)}
                                                className="flex-1 p-3 rounded-xl transition-all border text-left" style={{
                                                    background: videoFormat === f.id ? 'rgba(236, 72, 153, 0.1)' : 'var(--color-surface-100)',
                                                    borderColor: videoFormat === f.id ? 'rgba(236, 72, 153, 0.4)' : 'var(--color-surface-200)',
                                                }}>
                                                <div className="text-sm font-bold text-white">{f.id}</div>
                                                <div className="text-[10px]" style={{ color: videoFormat === f.id ? '#ec4899' : 'var(--color-surface-500)' }}>{f.label}</div>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                
                                {/* Preset AI (Lighting) */}
                                <div>
                                    <label className="label">Mood Regia 3D (Selezionato dall'AI)</label>
                                    <div className="flex items-center gap-3 p-3 rounded-xl" style={{ background: 'var(--color-surface-100)', border: '1px solid var(--color-surface-200)' }}>
                                        <div className="w-3 h-3 rounded-full" style={{ background: '#3b82f6', boxShadow: '0 0 10px #3b82f6' }} />
                                        <div className="flex-1">
                                            <div className="text-sm font-bold text-white uppercase tracking-wider">Neon Space Cyberpunk</div>
                                            <div className="text-[10px]" style={{ color: 'var(--color-surface-500)' }}>KeyLight Blu 1.5 • Fill Neon Pink</div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="mt-8 pt-6 border-t" style={{ borderColor: 'var(--color-surface-200)' }}>
                                 <button onClick={() => {
                                     setRenderingVideo(true);
                                     setTimeout(() => setRenderingVideo(false), 3000);
                                 }} 
                                 className="btn-primary w-full py-3" style={{ background: '#ec4899', color: '#fff', borderColor: '#be185d' }} disabled={renderingVideo}>
                                     {renderingVideo ? (
                                         <><Loader2 className="w-5 h-5 animate-spin" /> Rendering in corso su HeyGen...</>
                                     ) : (
                                         <><Play className="w-5 h-5 fill-current" /> Lancia e Renderizza MP4</>
                                     )}
                                 </button>
                                 <p className="text-[10px] text-center mt-3" style={{ color: 'var(--color-surface-500)' }}>
                                     Il rendering richiede ~2 minuti. Il video finale andrà direttamente nel CRM.
                                 </p>
                            </div>
                        </div>

                        {/* Right: Video Preview */}
                        <div className="glass-card p-6 flex flex-col items-center justify-center relative overflow-hidden h-[500px]" style={{ background: 'var(--color-surface-100)' }}>
                            <div className="absolute top-4 left-4 z-10">
                                <span className="badge" style={{ background: 'rgba(34, 197, 94, 0.15)', color: '#22c55e', border: '1px solid rgba(34, 197, 94, 0.3)' }}>
                                    Real-Time Preview
                                </span>
                            </div>
                            
                            <div className={`w-full max-h-full flex items-center justify-center transition-all duration-500 ${videoFormat === '16:9' ? 'w-full' : 'w-[250px]'}`}>
                                <VideoPlayerClient 
                                    headline={bd.product || "AI Video"}
                                    videoFormat={videoFormat}
                                    words={[
                                        { word: "Questo", startMs: 0, endMs: 500, style: "normal" },
                                        { word: "è", startMs: 500, endMs: 800, style: "normal" },
                                        { word: "un", startMs: 800, endMs: 1200, style: "normal" },
                                        { word: "Video", startMs: 1200, endMs: 2000, style: "highlight" },
                                        { word: "Generato", startMs: 2000, endMs: 2800, style: "normal" },
                                        { word: "dall'AI!", startMs: 2800, endMs: 4000, style: "highlight" }
                                    ]}
                                    subtitleStyle="hormozi"
                                    backgroundMood="dark-neon"
                                    enable3DParallax={true}
                                />
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="glass-card p-6 flex flex-col items-center justify-center text-center mt-8 py-12" style={{ border: '1px dashed var(--color-surface-300)' }}>
                        <ImageIcon className="w-10 h-10 mb-3" style={{ color: 'var(--color-surface-500)' }} />
                        <h3 className="text-sm font-bold text-white">Formato Grafico</h3>
                        <p className="text-xs max-w-sm mt-1 mx-auto" style={{ color: 'var(--color-surface-500)' }}>
                            Il Brief attualmente è impostato per <strong>{bd.format}</strong>. Seleziona "Video" o "Stories" per abilitare l'AI Video Factory.
                        </p>
                    </div>
                )}
            </div>
        )
    }

    return null
}
