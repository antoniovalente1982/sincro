'use client'

import { useState, useEffect, useRef } from 'react'
import { ArrowRight, ArrowLeft, Brain, Shield, Target, Flame, Zap, CheckCircle, AlertTriangle, XCircle, ChevronRight, Activity } from 'lucide-react'

/* ─────────────── QUIZ DATA ─────────────── */

interface Question {
    id: number
    area: 'fiducia' | 'pressione' | 'motivazione' | 'blocchi'
    text: string
}

const QUESTIONS: Question[] = [
    // AREA 1 — FIDUCIA IN SÉ
    { id: 1, area: 'fiducia', text: 'Tuo figlio si lamenta di non essere abbastanza bravo rispetto ai suoi compagni?' },
    { id: 2, area: 'fiducia', text: 'Si confronta costantemente con gli altri sentendosi inferiore?' },
    { id: 3, area: 'fiducia', text: 'Dopo un errore in partita o in gara, fatica a recuperare mentalmente?' },
    // AREA 2 — GESTIONE DELLA PRESSIONE
    { id: 4, area: 'pressione', text: 'In allenamento rende bene ma in partita o in gara "sparisce"?' },
    { id: 5, area: 'pressione', text: 'Prima di una competizione importante mostra ansia, nervosismo o disturbi fisici?' },
    { id: 6, area: 'pressione', text: 'Ha paura di sbagliare di fronte all\'allenatore, ai genitori o al pubblico?' },
    // AREA 3 — MOTIVAZIONE E RESILIENZA
    { id: 7, area: 'motivazione', text: 'Ha perso entusiasmo per lo sport che prima amava?' },
    { id: 8, area: 'motivazione', text: 'Dopo una sconfitta o un periodo difficile fatica a ripartire?' },
    { id: 9, area: 'motivazione', text: 'Parla di voler smettere o di non voler più andare agli allenamenti?' },
    // AREA 4 — BLOCCHI SPECIFICI
    { id: 10, area: 'blocchi', text: 'Ha avuto un infortunio e da allora non è più lo stesso a livello mentale?' },
    { id: 11, area: 'blocchi', text: 'Ha cambiato squadra, ruolo o livello e non si è adattato?' },
    { id: 12, area: 'blocchi', text: 'Il rapporto con l\'allenatore è diventato problematico o fonte di stress?' },
]

const AREA_META = {
    fiducia: { label: 'Fiducia in Sé', icon: Shield, color: '#818cf8', gradient: 'linear-gradient(135deg, #6366f1, #818cf8)' },
    pressione: { label: 'Gestione della Pressione', icon: Target, color: '#f472b6', gradient: 'linear-gradient(135deg, #ec4899, #f472b6)' },
    motivazione: { label: 'Motivazione e Resilienza', icon: Flame, color: '#fb923c', gradient: 'linear-gradient(135deg, #f97316, #fb923c)' },
    blocchi: { label: 'Blocchi Specifici', icon: Zap, color: '#f87171', gradient: 'linear-gradient(135deg, #ef4444, #f87171)' },
}

const ANSWER_OPTIONS = [
    { value: 0, label: 'Mai', emoji: '✅' },
    { value: 1, label: 'A volte', emoji: '⚠️' },
    { value: 2, label: 'Spesso', emoji: '🔴' },
]

/* ─────────────── COMPONENT ─────────────── */

export default function RadarQuiz() {
    const [phase, setPhase] = useState<'intro' | 'info' | 'quiz' | 'loading' | 'report'>('intro')
    const [childName, setChildName] = useState('')
    const [childSport, setChildSport] = useState('')
    const [parentName, setParentName] = useState('')
    const [parentEmail, setParentEmail] = useState('')
    const [parentPhone, setParentPhone] = useState('')
    const [currentQ, setCurrentQ] = useState(0)
    const [answers, setAnswers] = useState<Record<number, number>>({})
    const [partnerId, setPartnerId] = useState<string | null>(null)
    const [submitting, setSubmitting] = useState(false)

    // Grab partner ID from URL
    useEffect(() => {
        if (typeof window !== 'undefined') {
            const params = new URLSearchParams(window.location.search)
            setPartnerId(params.get('p'))
        }
    }, [])

    /* ── Scoring ── */
    function getAreaScore(area: string) {
        const areaQuestions = QUESTIONS.filter(q => q.area === area)
        const total = areaQuestions.reduce((sum, q) => sum + (answers[q.id] ?? 0), 0)
        const max = areaQuestions.length * 2
        // Invert: 0 answers = 100% (good), all "spesso" = 0% (bad)
        return Math.round(((max - total) / max) * 100)
    }

    function getOverallScore() {
        const areas = Object.keys(AREA_META) as (keyof typeof AREA_META)[]
        return Math.round(areas.reduce((sum, a) => sum + getAreaScore(a), 0) / areas.length)
    }

    function getScoreLevel(score: number): { label: string; color: string; icon: typeof CheckCircle; description: string } {
        if (score >= 75) return { label: 'Buono', color: '#22c55e', icon: CheckCircle, description: 'Nessun segnale critico in quest\'area.' }
        if (score >= 50) return { label: 'Attenzione', color: '#f59e0b', icon: AlertTriangle, description: 'Ci sono segnali che meritano attenzione.' }
        return { label: 'Critico', color: '#ef4444', icon: XCircle, description: 'Area critica — un intervento mirato potrebbe fare la differenza.' }
    }

    function getOverallVerdict() {
        const score = getOverallScore()
        if (score >= 75) return {
            title: `${childName || 'Tuo figlio'} sembra in buona forma mentale`,
            text: 'Non emergono segnali critici dal test. Se noti comunque qualcosa che ti preoccupa, una sessione di valutazione può darti conferme.',
            color: '#22c55e',
        }
        if (score >= 50) return {
            title: `${childName || 'Tuo figlio'} mostra alcuni segnali di blocco`,
            text: 'Ci sono aree che meritano attenzione. Questi segnali, se non affrontati, tendono a radicarsi nel tempo. Una sessione di valutazione può identificare esattamente cosa sta succedendo.',
            color: '#f59e0b',
        }
        return {
            title: `${childName || 'Tuo figlio'} sta probabilmente vivendo un freno invisibile`,
            text: 'Il profilo mostra segnali importanti in più aree. Il freno invisibile si sta radicando — e più tempo passa, più diventa difficile da rimuovere. Una sessione di valutazione è il primo passo per capire come intervenire.',
            color: '#ef4444',
        }
    }

    function getCriticalAreas() {
        return (Object.keys(AREA_META) as (keyof typeof AREA_META)[])
            .map(area => ({ area, score: getAreaScore(area), meta: AREA_META[area] }))
            .filter(a => a.score < 50)
            .sort((a, b) => a.score - b.score)
    }

    /* ── Submission ── */
    async function handleSubmitQuiz() {
        setSubmitting(true)
        try {
            await fetch('/api/radar/submit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    child_name: childName,
                    child_sport: childSport,
                    parent_name: parentName,
                    parent_email: parentEmail,
                    parent_phone: parentPhone,
                    partner_id: partnerId,
                    answers,
                    scores: {
                        fiducia: getAreaScore('fiducia'),
                        pressione: getAreaScore('pressione'),
                        motivazione: getAreaScore('motivazione'),
                        blocchi: getAreaScore('blocchi'),
                        overall: getOverallScore(),
                    },
                }),
            })
        } catch (e) {
            console.error('Radar submit error:', e)
        }
        setSubmitting(false)
        setPhase('loading')
        setTimeout(() => setPhase('report'), 2500)
    }

    /* ── Answer a question and auto-advance ── */
    function answerQuestion(value: number) {
        const qId = QUESTIONS[currentQ].id
        setAnswers(prev => ({ ...prev, [qId]: value }))
        if (currentQ < QUESTIONS.length - 1) {
            setTimeout(() => setCurrentQ(prev => prev + 1), 300)
        } else {
            // Last question — submit
            setTimeout(() => {
                // We need to set the answer first, then submit
                const updatedAnswers = { ...answers, [qId]: value }
                // Use a ref pattern instead — but for simplicity just call submit
                handleSubmitWithAnswers(updatedAnswers)
            }, 400)
        }
    }

    async function handleSubmitWithAnswers(finalAnswers: Record<number, number>) {
        setSubmitting(true)
        // Calculate scores with final answers
        function calcArea(area: string) {
            const areaQuestions = QUESTIONS.filter(q => q.area === area)
            const total = areaQuestions.reduce((sum, q) => sum + (finalAnswers[q.id] ?? 0), 0)
            const max = areaQuestions.length * 2
            return Math.round(((max - total) / max) * 100)
        }
        const scores = {
            fiducia: calcArea('fiducia'),
            pressione: calcArea('pressione'),
            motivazione: calcArea('motivazione'),
            blocchi: calcArea('blocchi'),
            overall: Math.round((calcArea('fiducia') + calcArea('pressione') + calcArea('motivazione') + calcArea('blocchi')) / 4),
        }
        try {
            await fetch('/api/radar/submit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    child_name: childName, child_sport: childSport,
                    parent_name: parentName, parent_email: parentEmail, parent_phone: parentPhone,
                    partner_id: partnerId, answers: finalAnswers, scores,
                }),
            })
        } catch (e) { console.error('Radar submit error:', e) }
        setSubmitting(false)
        setPhase('loading')
        setTimeout(() => setPhase('report'), 2500)
    }

    /* ─────────────── RENDERS ─────────────── */

    // ── INTRO ──
    if (phase === 'intro') {
        return (
            <div className="min-h-screen flex items-center justify-center p-4" style={{ background: '#09090b' }}>
                <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at top, rgba(99, 102, 241, 0.12), transparent 60%)' }} />
                <div className="absolute top-10 left-1/2 -translate-x-1/2 w-[900px] h-[500px] rounded-full opacity-10 blur-[160px]" style={{ background: 'linear-gradient(135deg, #6366f1, #ec4899)' }} />

                <div className="relative w-full max-w-2xl text-center" style={{ animation: 'fadeInUp 0.7s ease-out' }}>
                    {/* Logo */}
                    <div className="inline-flex items-center gap-3 mb-10">
                        <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', boxShadow: '0 0 40px rgba(99, 102, 241, 0.3)' }}>
                            <Brain className="w-6 h-6 text-white" />
                        </div>
                        <span className="text-xl font-black text-white tracking-tight">RADAR SINCRO</span>
                    </div>

                    {/* Badge */}
                    <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold mb-8" style={{ background: 'rgba(34, 197, 94, 0.1)', color: '#22c55e', border: '1px solid rgba(34, 197, 94, 0.2)' }}>
                        ✅ Test gratuito · 3 minuti · 12 domande
                    </div>

                    {/* Main message */}
                    <h1 className="text-4xl md:text-6xl font-black text-white leading-[1.1] tracking-tight mb-6">
                        Tuo figlio ha un{' '}
                        <span style={{ background: 'linear-gradient(135deg, #ef4444, #f97316)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                            freno invisibile
                        </span>
                        ?
                    </h1>

                    <p className="text-lg md:text-xl leading-relaxed max-w-xl mx-auto mb-4" style={{ color: '#a1a1aa' }}>
                        Scopri in 3 minuti se il tuo giovane atleta ha un blocco mentale
                        che gli impedisce di tirare fuori il suo <strong className="text-white">vero potenziale</strong>.
                    </p>

                    <p className="text-sm leading-relaxed max-w-lg mx-auto mb-10" style={{ color: '#71717a' }}>
                        12 domande rapide. Risultato immediato con il profilo mentale sportivo
                        del tuo ragazzo. Nessun impegno.
                    </p>

                    {/* CTA */}
                    <button
                        onClick={() => setPhase('info')}
                        className="inline-flex items-center gap-3 text-lg font-bold px-10 py-5 rounded-2xl text-white transition-all hover:translate-y-[-3px] cursor-pointer"
                        style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', boxShadow: '0 0 60px rgba(99, 102, 241, 0.35)' }}
                    >
                        Inizia il Test Gratuito <ArrowRight className="w-5 h-5" />
                    </button>

                    {/* Trust */}
                    <div className="flex items-center justify-center gap-6 mt-8 flex-wrap">
                        <div className="flex items-center gap-2 text-sm" style={{ color: '#52525b' }}>
                            <Shield className="w-4 h-4" style={{ color: '#22c55e' }} /> Anonimo e gratuito
                        </div>
                        <div className="flex items-center gap-2 text-sm" style={{ color: '#52525b' }}>
                            <Activity className="w-4 h-4" style={{ color: '#818cf8' }} /> Basato su casi reali
                        </div>
                    </div>
                </div>

                <style>{`
                    @keyframes fadeInUp { from { opacity: 0; transform: translateY(30px); } to { opacity: 1; transform: translateY(0); } }
                `}</style>
            </div>
        )
    }

    // ── INFO COLLECTION ──
    if (phase === 'info') {
        return (
            <div className="min-h-screen flex items-center justify-center p-4" style={{ background: '#09090b' }}>
                <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at top, rgba(99, 102, 241, 0.08), transparent 60%)' }} />

                <div className="relative w-full max-w-md" style={{ animation: 'fadeInUp 0.5s ease-out' }}>
                    {/* Header */}
                    <div className="text-center mb-8">
                        <div className="inline-flex items-center gap-2 mb-4">
                            <Brain className="w-5 h-5" style={{ color: '#818cf8' }} />
                            <span className="text-sm font-bold" style={{ color: '#818cf8' }}>RADAR SINCRO</span>
                        </div>
                        <h2 className="text-2xl font-black text-white mb-2">Prima di iniziare</h2>
                        <p className="text-sm" style={{ color: '#71717a' }}>Ci servono alcune informazioni per personalizzare il report</p>
                    </div>

                    {/* Form */}
                    <div className="rounded-2xl p-8 space-y-5" style={{
                        background: 'rgba(15, 15, 19, 0.8)',
                        backdropFilter: 'blur(20px)',
                        border: '1px solid rgba(99, 102, 241, 0.12)',
                    }}>
                        <div>
                            <label className="block text-sm font-semibold mb-1.5" style={{ color: '#a1a1aa' }}>Nome del ragazzo/a *</label>
                            <input
                                type="text" value={childName} onChange={e => setChildName(e.target.value)}
                                placeholder="Es. Marco" required
                                className="w-full px-4 py-3.5 rounded-xl text-white text-sm outline-none transition-all"
                                style={{ background: '#18181b', border: '1px solid #27272a' }}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold mb-1.5" style={{ color: '#a1a1aa' }}>Sport praticato *</label>
                            <input
                                type="text" value={childSport} onChange={e => setChildSport(e.target.value)}
                                placeholder="Es. Calcio, Nuoto, Tennis..."
                                className="w-full px-4 py-3.5 rounded-xl text-white text-sm outline-none transition-all"
                                style={{ background: '#18181b', border: '1px solid #27272a' }}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold mb-1.5" style={{ color: '#a1a1aa' }}>Il tuo nome *</label>
                            <input
                                type="text" value={parentName} onChange={e => setParentName(e.target.value)}
                                placeholder="Es. Anna Rossi"
                                className="w-full px-4 py-3.5 rounded-xl text-white text-sm outline-none transition-all"
                                style={{ background: '#18181b', border: '1px solid #27272a' }}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold mb-1.5" style={{ color: '#a1a1aa' }}>La tua email *</label>
                            <input
                                type="email" value={parentEmail} onChange={e => setParentEmail(e.target.value)}
                                placeholder="Per ricevere il report completo"
                                className="w-full px-4 py-3.5 rounded-xl text-white text-sm outline-none transition-all"
                                style={{ background: '#18181b', border: '1px solid #27272a' }}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold mb-1.5" style={{ color: '#a1a1aa' }}>Telefono <span className="font-normal" style={{ color: '#52525b' }}>(opzionale)</span></label>
                            <input
                                type="tel" value={parentPhone} onChange={e => setParentPhone(e.target.value)}
                                placeholder="+39 xxx xxx xxxx"
                                className="w-full px-4 py-3.5 rounded-xl text-white text-sm outline-none transition-all"
                                style={{ background: '#18181b', border: '1px solid #27272a' }}
                            />
                        </div>

                        <button
                            onClick={() => { if (childName && parentName && parentEmail) setPhase('quiz') }}
                            disabled={!childName || !parentName || !parentEmail}
                            className="w-full py-4 rounded-xl font-bold text-white text-base flex items-center justify-center gap-2 transition-all cursor-pointer"
                            style={{
                                background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                                boxShadow: '0 0 30px rgba(99, 102, 241, 0.3)',
                                opacity: (!childName || !parentName || !parentEmail) ? 0.5 : 1,
                            }}
                        >
                            Inizia le 12 Domande <ArrowRight className="w-5 h-5" />
                        </button>

                        <p className="text-center text-xs" style={{ color: '#3f3f46' }}>
                            🔒 I tuoi dati sono al sicuro e non saranno mai condivisi.
                        </p>
                    </div>
                </div>

                <style>{`
                    @keyframes fadeInUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
                    input:focus { border-color: #6366f1 !important; box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.15); }
                `}</style>
            </div>
        )
    }

    // ── QUIZ ──
    if (phase === 'quiz') {
        const q = QUESTIONS[currentQ]
        const areaMeta = AREA_META[q.area]
        const AreaIcon = areaMeta.icon
        const progress = ((currentQ + 1) / QUESTIONS.length) * 100

        return (
            <div className="min-h-screen flex items-center justify-center p-4" style={{ background: '#09090b' }}>
                <div className="absolute inset-0" style={{ background: `radial-gradient(ellipse at top, ${areaMeta.color}12, transparent 60%)` }} />

                <div className="relative w-full max-w-lg" key={currentQ} style={{ animation: 'fadeInUp 0.4s ease-out' }}>
                    {/* Progress */}
                    <div className="mb-8">
                        <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                                <Brain className="w-4 h-4" style={{ color: '#818cf8' }} />
                                <span className="text-xs font-bold" style={{ color: '#818cf8' }}>RADAR SINCRO</span>
                            </div>
                            <span className="text-xs font-bold" style={{ color: '#71717a' }}>{currentQ + 1} / {QUESTIONS.length}</span>
                        </div>
                        <div className="h-1.5 rounded-full overflow-hidden" style={{ background: '#1f1f23' }}>
                            <div className="h-full rounded-full transition-all duration-500" style={{ width: `${progress}%`, background: areaMeta.gradient }} />
                        </div>
                    </div>

                    {/* Area badge */}
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold mb-6" style={{ background: `${areaMeta.color}12`, color: areaMeta.color, border: `1px solid ${areaMeta.color}25` }}>
                        <AreaIcon className="w-3.5 h-3.5" />
                        {areaMeta.label}
                    </div>

                    {/* Question */}
                    <h2 className="text-2xl md:text-3xl font-black text-white leading-tight mb-3">
                        {q.text.replace('Tuo figlio', childName || 'Tuo figlio')}
                    </h2>
                    <p className="text-sm mb-10" style={{ color: '#52525b' }}>
                        Rispondi pensando agli ultimi 2-3 mesi
                    </p>

                    {/* Answer buttons */}
                    <div className="space-y-3">
                        {ANSWER_OPTIONS.map(opt => {
                            const isSelected = answers[q.id] === opt.value
                            return (
                                <button
                                    key={opt.value}
                                    onClick={() => answerQuestion(opt.value)}
                                    className="w-full p-5 rounded-2xl text-left flex items-center gap-4 transition-all cursor-pointer group"
                                    style={{
                                        background: isSelected ? `${areaMeta.color}15` : 'rgba(15, 15, 19, 0.6)',
                                        border: `1px solid ${isSelected ? `${areaMeta.color}40` : 'rgba(99, 102, 241, 0.08)'}`,
                                        backdropFilter: 'blur(10px)',
                                    }}
                                >
                                    <span className="text-2xl">{opt.emoji}</span>
                                    <span className="text-base font-bold text-white flex-1">{opt.label}</span>
                                    <ChevronRight className="w-5 h-5 opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: areaMeta.color }} />
                                </button>
                            )
                        })}
                    </div>

                    {/* Back button */}
                    {currentQ > 0 && (
                        <button
                            onClick={() => setCurrentQ(prev => prev - 1)}
                            className="mt-6 flex items-center gap-2 text-sm font-medium transition-all cursor-pointer"
                            style={{ color: '#52525b' }}
                        >
                            <ArrowLeft className="w-4 h-4" /> Domanda precedente
                        </button>
                    )}
                </div>

                <style>{`
                    @keyframes fadeInUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
                    button:hover { transform: translateY(-2px); }
                `}</style>
            </div>
        )
    }

    // ── LOADING ──
    if (phase === 'loading') {
        return (
            <div className="min-h-screen flex items-center justify-center p-4" style={{ background: '#09090b' }}>
                <div className="text-center" style={{ animation: 'fadeInUp 0.5s ease-out' }}>
                    <div className="w-20 h-20 mx-auto mb-8 rounded-full flex items-center justify-center" style={{ background: 'rgba(99, 102, 241, 0.1)', border: '1px solid rgba(99, 102, 241, 0.2)' }}>
                        <div className="w-10 h-10 border-3 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" style={{ borderWidth: '3px' }} />
                    </div>
                    <h2 className="text-2xl font-black text-white mb-3">Stiamo analizzando le risposte</h2>
                    <p className="text-sm" style={{ color: '#71717a' }}>Generazione del profilo mentale sportivo di {childName}...</p>
                </div>
                <style>{`@keyframes fadeInUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }`}</style>
            </div>
        )
    }

    // ── REPORT ──
    const verdict = getOverallVerdict()
    const criticalAreas = getCriticalAreas()

    return (
        <div className="min-h-screen p-4 md:p-8" style={{ background: '#09090b' }}>
            <div className="absolute inset-0" style={{ background: `radial-gradient(ellipse at top, ${verdict.color}08, transparent 60%)` }} />

            <div className="relative max-w-2xl mx-auto" style={{ animation: 'fadeInUp 0.6s ease-out' }}>
                {/* Header */}
                <div className="text-center mb-10">
                    <div className="inline-flex items-center gap-2 mb-4">
                        <Brain className="w-5 h-5" style={{ color: '#818cf8' }} />
                        <span className="text-sm font-bold" style={{ color: '#818cf8' }}>RADAR SINCRO</span>
                    </div>
                    <h1 className="text-3xl md:text-4xl font-black text-white mb-2">
                        Profilo Mentale Sportivo
                    </h1>
                    <p className="text-lg" style={{ color: '#71717a' }}>
                        {childName} · {childSport}
                    </p>
                </div>

                {/* Overall Score Card */}
                <div className="rounded-2xl p-8 mb-8" style={{
                    background: 'rgba(15, 15, 19, 0.8)',
                    backdropFilter: 'blur(20px)',
                    border: `1px solid ${verdict.color}30`,
                    boxShadow: `0 0 60px ${verdict.color}08`,
                }}>
                    <div className="flex items-start gap-6">
                        <div className="w-20 h-20 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ background: `${verdict.color}12`, border: `1px solid ${verdict.color}30` }}>
                            <span className="text-3xl font-black" style={{ color: verdict.color }}>{getOverallScore()}%</span>
                        </div>
                        <div>
                            <h2 className="text-xl font-black text-white mb-2">{verdict.title}</h2>
                            <p className="text-sm leading-relaxed" style={{ color: '#a1a1aa' }}>{verdict.text}</p>
                        </div>
                    </div>
                </div>

                {/* Area Scores */}
                <div className="rounded-2xl p-8 mb-8" style={{
                    background: 'rgba(15, 15, 19, 0.6)',
                    backdropFilter: 'blur(20px)',
                    border: '1px solid rgba(99, 102, 241, 0.08)',
                }}>
                    <h3 className="text-lg font-bold text-white mb-6">Dettaglio per Area</h3>
                    <div className="space-y-6">
                        {(Object.keys(AREA_META) as (keyof typeof AREA_META)[]).map(area => {
                            const score = getAreaScore(area)
                            const level = getScoreLevel(score)
                            const meta = AREA_META[area]
                            const Icon = meta.icon

                            return (
                                <div key={area}>
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="flex items-center gap-2">
                                            <Icon className="w-4 h-4" style={{ color: meta.color }} />
                                            <span className="text-sm font-bold text-white">{meta.label}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: `${level.color}15`, color: level.color, border: `1px solid ${level.color}30` }}>
                                                {level.label}
                                            </span>
                                            <span className="text-sm font-black" style={{ color: level.color }}>{score}%</span>
                                        </div>
                                    </div>
                                    <div className="h-3 rounded-full overflow-hidden" style={{ background: '#1f1f23' }}>
                                        <div
                                            className="h-full rounded-full transition-all duration-1000"
                                            style={{ width: `${score}%`, background: meta.gradient }}
                                        />
                                    </div>
                                    <p className="text-xs mt-1.5" style={{ color: '#52525b' }}>{level.description}</p>
                                </div>
                            )
                        })}
                    </div>
                </div>

                {/* Critical Areas Callout */}
                {criticalAreas.length > 0 && (
                    <div className="rounded-2xl p-8 mb-8" style={{
                        background: 'rgba(239, 68, 68, 0.05)',
                        border: '1px solid rgba(239, 68, 68, 0.15)',
                    }}>
                        <div className="flex items-center gap-2 mb-4">
                            <AlertTriangle className="w-5 h-5" style={{ color: '#ef4444' }} />
                            <h3 className="text-lg font-bold" style={{ color: '#ef4444' }}>
                                {criticalAreas.length === 1 ? 'Area critica identificata' : 'Aree critiche identificate'}
                            </h3>
                        </div>
                        <div className="space-y-3">
                            {criticalAreas.map(({ area, score, meta }) => (
                                <div key={area} className="flex items-center gap-3 p-3 rounded-xl" style={{ background: 'rgba(239, 68, 68, 0.08)' }}>
                                    <meta.icon className="w-4 h-4" style={{ color: meta.color }} />
                                    <span className="text-sm font-bold text-white flex-1">{meta.label}</span>
                                    <span className="text-sm font-black" style={{ color: '#ef4444' }}>{score}%</span>
                                </div>
                            ))}
                        </div>
                        <p className="text-sm mt-4 leading-relaxed" style={{ color: '#a1a1aa' }}>
                            Questi segnali indicano la presenza di un <strong className="text-white">freno invisibile</strong> che
                            sta impedendo a {childName} di esprimere il suo potenziale. Più tempo passa, più il freno si radica.
                        </p>
                    </div>
                )}

                {/* CTA */}
                <div className="rounded-2xl p-8 text-center" style={{
                    background: 'rgba(99, 102, 241, 0.06)',
                    border: '1px solid rgba(99, 102, 241, 0.15)',
                    boxShadow: '0 0 60px rgba(99, 102, 241, 0.05)',
                }}>
                    <h3 className="text-2xl font-black text-white mb-3">
                        Vuoi capire esattamente cosa sta succedendo?
                    </h3>
                    <p className="text-sm leading-relaxed mb-6" style={{ color: '#a1a1aa' }}>
                        Una <strong className="text-white">Sessione di Valutazione</strong> di 45 minuti, uno a uno con {childName},
                        ci permette di identificare il blocco specifico e dirti se e come possiamo aiutarlo.
                    </p>
                    <a
                        href="https://metodosincro.it/consulenza"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-3 text-lg font-bold px-10 py-5 rounded-2xl text-white transition-all hover:translate-y-[-3px]"
                        style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', boxShadow: '0 0 50px rgba(99, 102, 241, 0.35)' }}
                    >
                        Prenota la Sessione di Valutazione <ArrowRight className="w-5 h-5" />
                    </a>
                    <p className="text-xs mt-4" style={{ color: '#52525b' }}>
                        45 minuti · 1 a 1 con il professionista · €150
                    </p>
                </div>

                {/* Footer */}
                <div className="text-center mt-10">
                    <div className="flex items-center justify-center gap-2 mb-2">
                        <Brain className="w-4 h-4" style={{ color: '#818cf8' }} />
                        <span className="text-sm font-bold" style={{ color: '#52525b' }}>Metodo Sincro</span>
                    </div>
                    <p className="text-xs" style={{ color: '#3f3f46' }}>
                        Il freno invisibile si toglie. Non con le parole — con un metodo.
                    </p>
                </div>
            </div>

            <style>{`
                @keyframes fadeInUp { from { opacity: 0; transform: translateY(30px); } to { opacity: 1; transform: translateY(0); } }
            `}</style>
        </div>
    )
}
