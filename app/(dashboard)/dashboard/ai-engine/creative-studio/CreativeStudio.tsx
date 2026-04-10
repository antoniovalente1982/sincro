'use client'

import { useState } from 'react'
import {
    Paintbrush, ArrowLeft, Sparkles, Send, Loader2, Copy, CheckCircle,
    Image as ImageIcon, Video, LayoutGrid, Square, Smartphone, Monitor,
    ChevronRight, Brain, Zap, Target, MessageSquare, RefreshCw, FileText,
    ChevronDown, Plus, Trash2, Eye, Play
} from 'lucide-react'
import HowItWorks from '@/components/HowItWorks'
import Link from 'next/link'


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
]

export default function CreativeStudio({ briefs: initialBriefs, campaigns }: Props) {
    const [briefs, setBriefs] = useState(initialBriefs)
    const [view, setView] = useState<'list' | 'create' | 'detail'>('list')
    const [selectedBrief, setSelectedBrief] = useState<Brief | null>(null)
    const [generating, setGenerating] = useState(false)
    const [copiedIdx, setCopiedIdx] = useState<number | null>(null)
    const [showAllBriefs, setShowAllBriefs] = useState(false)

    const INITIAL_VISIBLE = 5

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
                            Genera copy e brief per le tue ads con l'AI — headline, body e CTA pronti all'uso per i brief
                        </p>
                    </div>
                    <div className="flex gap-2">
                        <HowItWorks compact steps={[
                            { emoji: '✍️', title: 'Crea un Brief', description: 'Descrivi il prodotto, il target e il tono. L\'AI genera headline, body text e CTA ottimizzati per le ads.' },
                            { emoji: '🤖', title: 'Generazione AI', description: 'L\'intelligenza artificiale produce multiple variazioni di copy, ognuna con angolo comunicativo diverso.' },
                            { emoji: '📋', title: 'Review & Export', description: 'Rivedi i copy generati, seleziona i migliori e copiali con un click per usarli nelle tue campagne ads.' },
                            { emoji: '🎨', title: 'Creative Pipeline', description: 'Il pipeline automatico genera immagini AI (Nano Banana / Higgsfield) basate sui brief creativi approvati.' },
                            { emoji: '📊', title: 'Top Creative & Headline', description: 'Analizza le performance reali delle creative: quale headline e quale immagine generano più lead al minor costo.' },
                        ]} footer="Gli step si trovano nella sezione Creative Studio: Funnel Routing Engine → Top Creative → Creative Pipeline → Brief Studio." />
                        <button onClick={() => setView('create')} className="btn-primary">
                            <Plus className="w-4 h-4" /> Nuovo Brief
                        </button>
                    </div>
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
                    <>
                    <div className="space-y-3">
                        {(showAllBriefs ? briefs : briefs.slice(0, INITIAL_VISIBLE)).map(brief => (
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
                    {briefs.length > INITIAL_VISIBLE && !showAllBriefs && (
                        <button
                            onClick={() => setShowAllBriefs(true)}
                            className="w-full mt-4 py-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all hover:scale-[1.01]"
                            style={{ background: 'var(--color-surface-100)', border: '1px solid var(--color-surface-200)', color: 'var(--color-surface-500)' }}
                        >
                            <ChevronDown className="w-3.5 h-3.5" />
                            Mostra altri {briefs.length - INITIAL_VISIBLE} brief
                        </button>
                    )}
                    {showAllBriefs && briefs.length > INITIAL_VISIBLE && (
                        <button
                            onClick={() => setShowAllBriefs(false)}
                            className="w-full mt-4 py-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all hover:scale-[1.01]"
                            style={{ background: 'var(--color-surface-100)', border: '1px solid var(--color-surface-200)', color: 'var(--color-surface-500)' }}
                        >
                            Comprimi lista
                        </button>
                    )}
                    </>
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
                                🔜 Prossimamente: integrazione con <strong>Nano Banana</strong> per le immagini.
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

                <div className="glass-card p-6 flex flex-col items-center justify-center text-center mt-8 py-12" style={{ border: '1px dashed var(--color-surface-300)' }}>
                    <ImageIcon className="w-10 h-10 mb-3" style={{ color: 'var(--color-surface-500)' }} />
                    <h3 className="text-sm font-bold text-white">Formato Grafico: {bd.format}</h3>
                    <p className="text-xs max-w-sm mt-1 mx-auto" style={{ color: 'var(--color-surface-500)' }}>
                        Integrazione con generatore di immagini attualmente in manutenzione.
                    </p>
                </div>
            </div>
        )
    }

    return null
}
