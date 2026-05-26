'use client'

import { useState, useEffect } from 'react'
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

// FLOW: intro → quiz → loading → report (GRATIS)
// Dati raccolti SOLO quando richiedono la consulenza gratuita

export default function RadarQuiz() {
    const [phase, setPhase] = useState<'intro' | 'quiz' | 'loading' | 'report'>('intro')
    const [currentQ, setCurrentQ] = useState(0)
    const [answers, setAnswers] = useState<Record<number, number>>({})
    const [partnerId, setPartnerId] = useState<string | null>(null)

    // Consultation form state (shown in report CTA)
    const [showConsultaForm, setShowConsultaForm] = useState(false)
    const [parentName, setParentName] = useState('')
    const [parentEmail, setParentEmail] = useState('')
    const [parentPhone, setParentPhone] = useState('')
    const [childName, setChildName] = useState('')
    const [childSport, setChildSport] = useState('')
    const [consultaSubmitting, setConsultaSubmitting] = useState(false)
    const [consultaRequested, setConsultaRequested] = useState(false)
    const [loadStep, setLoadStep] = useState(0)

    // Grab partner ID from URL
    useEffect(() => {
        if (typeof window !== 'undefined') {
            const params = new URLSearchParams(window.location.search)
            setPartnerId(params.get('p'))
        }
    }, [])

    // Loading phase step animation
    useEffect(() => {
        if (phase !== 'loading') { setLoadStep(0); return }
        const t1 = setTimeout(() => setLoadStep(1), 800)
        const t2 = setTimeout(() => setLoadStep(2), 1600)
        return () => { clearTimeout(t1); clearTimeout(t2) }
    }, [phase])

    /* ── Scoring ── */
    function calcAreaScore(area: string, ans: Record<number, number> = answers) {
        const areaQuestions = QUESTIONS.filter(q => q.area === area)
        const total = areaQuestions.reduce((sum, q) => sum + (ans[q.id] ?? 0), 0)
        const max = areaQuestions.length * 2
        return Math.round(((max - total) / max) * 100)
    }

    function calcOverall(ans: Record<number, number> = answers) {
        const areas = Object.keys(AREA_META)
        return Math.round(areas.reduce((sum, a) => sum + calcAreaScore(a, ans), 0) / areas.length)
    }

    function getScoreLevel(score: number) {
        if (score >= 75) return { label: 'Buono', color: '#22c55e', icon: CheckCircle, description: 'Nessun segnale critico in quest\'area.' }
        if (score >= 50) return { label: 'Attenzione', color: '#f59e0b', icon: AlertTriangle, description: 'Ci sono segnali che meritano attenzione.' }
        return { label: 'Critico', color: '#ef4444', icon: XCircle, description: 'Area critica — un intervento mirato potrebbe fare la differenza.' }
    }

    function getOverallVerdict() {
        const score = calcOverall()
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
            .map(area => ({ area, score: calcAreaScore(area), meta: AREA_META[area] }))
            .filter(a => a.score < 50)
            .sort((a, b) => a.score - b.score)
    }

    /* ── Consultation request (from report CTA form) ── */
    async function handleConsultaSubmit() {
        if (!parentName || !parentEmail || !parentPhone) return
        setConsultaSubmitting(true)
        const scores = {
            fiducia: calcAreaScore('fiducia'),
            pressione: calcAreaScore('pressione'),
            motivazione: calcAreaScore('motivazione'),
            blocchi: calcAreaScore('blocchi'),
            overall: calcOverall(),
        }
        try {
            // 1. Save radar submission (quiz data + contact)
            const radarRes = await fetch('/api/radar/submit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    child_name: childName || 'Non specificato',
                    child_sport: childSport,
                    parent_name: parentName,
                    parent_email: parentEmail,
                    parent_phone: parentPhone,
                    partner_id: partnerId,
                    answers, scores,
                }),
            })
            const radarData = await radarRes.json().catch(() => ({}))

            // 2. Create lead in CRM
            await fetch('/api/radar/consulenza', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    parent_name: parentName,
                    parent_email: parentEmail,
                    parent_phone: parentPhone,
                    child_name: childName,
                    child_sport: childSport,
                    partner_id: partnerId,
                    scores,
                    radar_submission_id: radarData.id || null,
                }),
            })
            setConsultaRequested(true)
        } catch (e) { console.error('Consulenza submit error:', e) }
        setConsultaSubmitting(false)
    }

    /* ── Answer a question and auto-advance ── */
    function answerQuestion(value: number) {
        const qId = QUESTIONS[currentQ].id
        const updatedAnswers = { ...answers, [qId]: value }
        setAnswers(updatedAnswers)
        if (currentQ < QUESTIONS.length - 1) {
            setTimeout(() => setCurrentQ(prev => prev + 1), 300)
        } else {
            // Last question → show report directly (no data gate)
            setTimeout(() => {
                setPhase('loading')
                setTimeout(() => setPhase('report'), 2500)
            }, 400)
        }
    }

    /* ─────────────── RENDERS ─────────────── */

    // Progress messages that change as user advances through the quiz
    const PROGRESS_MESSAGES = [
        'Stiamo iniziando a costruire il profilo...',
        'Analisi dell\'autostima in corso...',
        'Raccolta dati sulla fiducia...',
        'Area fiducia completata ✓ Passiamo alla pressione...',
        'Analisi della gestione dello stress...',
        'Valutazione della pressione agonistica...',
        'Area pressione completata ✓ Quasi a metà!',
        'Analisi della motivazione in corso...',
        'Valutazione della resilienza...',
        'Area motivazione completata ✓ Manca poco al report!',
        'Ultima area: blocchi specifici...',
        'Ultime risposte per completare il tuo report!',
    ]

    const GLOBAL_STYLES = `
        @keyframes fadeInUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes pulse-glow { 0%, 100% { box-shadow: 0 0 20px rgba(99, 102, 241, 0.15); } 50% { box-shadow: 0 0 40px rgba(99, 102, 241, 0.3); } }
        @keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
        @keyframes checkIn { from { opacity: 0; transform: scale(0.5); } to { opacity: 1; transform: scale(1); } }
        input:focus, textarea:focus { border-color: #6366f1 !important; box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.15); }
    `

    // ── INTRO ──
    if (phase === 'intro') {
        return (
            <div className="min-h-[100dvh] flex items-center justify-center px-5 py-10" style={{ background: '#09090b' }}>
                <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at top, rgba(99, 102, 241, 0.12), transparent 60%)' }} />
                <div className="absolute top-10 left-1/2 -translate-x-1/2 w-[600px] h-[300px] rounded-full opacity-10 blur-[120px]" style={{ background: 'linear-gradient(135deg, #6366f1, #ec4899)' }} />

                <div className="relative w-full max-w-xl text-center" style={{ animation: 'fadeInUp 0.7s ease-out' }}>
                    {/* Logo */}
                    <div className="inline-flex items-center gap-2.5 mb-6">
                        <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', boxShadow: '0 0 40px rgba(99, 102, 241, 0.3)' }}>
                            <Brain className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                        </div>
                        <span className="text-lg sm:text-xl font-black text-white tracking-tight">METODO SINCRO</span>
                    </div>

                    {/* Lead magnet badge */}
                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-[11px] sm:text-xs font-bold mb-6 sm:mb-8" style={{ background: 'rgba(99, 102, 241, 0.1)', color: '#818cf8', border: '1px solid rgba(99, 102, 241, 0.2)', animation: 'pulse-glow 3s ease-in-out infinite' }}>
                        📊 Ricevi il tuo Report Personalizzato — Gratuito
                    </div>

                    {/* Main headline */}
                    <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-white leading-[1.1] tracking-tight mb-4 sm:mb-5">
                        Tuo figlio rende in allenamento ma{' '}
                        <span style={{ background: 'linear-gradient(135deg, #ef4444, #f97316)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                            in gara si spegne
                        </span>
                        ?
                    </h1>

                    <p className="text-base sm:text-lg md:text-xl leading-relaxed max-w-lg mx-auto mb-3 sm:mb-4 px-2" style={{ color: '#a1a1aa' }}>
                        Rispondi a <strong className="text-white">12 domande</strong> e ricevi subito il{' '}
                        <strong className="text-white">Profilo Mentale Sportivo</strong> del tuo ragazzo — con le aree di forza e i blocchi nascosti.
                    </p>

                    <p className="text-xs sm:text-sm leading-relaxed max-w-md mx-auto mb-8 sm:mb-10 px-2" style={{ color: '#71717a' }}>
                        Il report analizza 4 aree chiave: fiducia, gestione della pressione, motivazione e blocchi specifici. Risultato istantaneo.
                    </p>

                    {/* What you get preview */}
                    <div className="grid grid-cols-2 gap-3 max-w-sm mx-auto mb-8">
                        {[
                            { icon: '🎯', text: 'Profilo su 4 aree' },
                            { icon: '📊', text: 'Punteggi dettagliati' },
                            { icon: '🔴', text: 'Aree critiche evidenziate' },
                            { icon: '✅', text: 'Consiglio personalizzato' },
                        ].map(item => (
                            <div key={item.text} className="flex items-center gap-2 px-3 py-2 rounded-xl text-left" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                                <span className="text-base">{item.icon}</span>
                                <span className="text-[11px] sm:text-xs font-medium text-white/70">{item.text}</span>
                            </div>
                        ))}
                    </div>

                    {/* CTA */}
                    <button
                        onClick={() => setPhase('quiz')}
                        className="inline-flex items-center gap-2.5 text-base sm:text-lg font-bold px-8 sm:px-10 py-4 sm:py-5 rounded-2xl text-white transition-all hover:translate-y-[-3px] cursor-pointer active:scale-[0.98]"
                        style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', boxShadow: '0 0 60px rgba(99, 102, 241, 0.35)' }}
                    >
                        Crea il Mio Report Gratuito <ArrowRight className="w-5 h-5" />
                    </button>

                    <p className="text-[11px] mt-3" style={{ color: '#52525b' }}>⏱️ Solo 3 minuti · Nessun impegno · Risultato immediato</p>

                    {/* Trust */}
                    <div className="flex items-center justify-center gap-4 sm:gap-6 mt-6 sm:mt-8 flex-wrap">
                        <div className="flex items-center gap-1.5 text-xs sm:text-sm" style={{ color: '#52525b' }}>
                            <Shield className="w-3.5 h-3.5 sm:w-4 sm:h-4" style={{ color: '#22c55e' }} /> 100% gratuito
                        </div>
                        <div className="flex items-center gap-1.5 text-xs sm:text-sm" style={{ color: '#52525b' }}>
                            <Activity className="w-3.5 h-3.5 sm:w-4 sm:h-4" style={{ color: '#818cf8' }} /> Basato su +500 giovani atleti
                        </div>
                    </div>
                </div>

                <style>{GLOBAL_STYLES}</style>
            </div>
        )
    }

    // ── QUIZ ──
    if (phase === 'quiz') {
        const q = QUESTIONS[currentQ]
        const areaMeta = AREA_META[q.area]
        const AreaIcon = areaMeta.icon
        const progress = ((currentQ + 1) / QUESTIONS.length) * 100
        const completedAreas = currentQ >= 9 ? 3 : currentQ >= 6 ? 2 : currentQ >= 3 ? 1 : 0
        const totalAreas = 4

        return (
            <div className="min-h-[100dvh] flex items-center justify-center px-5 py-8" style={{ background: '#09090b' }}>
                <div className="absolute inset-0" style={{ background: `radial-gradient(ellipse at top, ${areaMeta.color}12, transparent 60%)` }} />

                <div className="relative w-full max-w-lg" key={currentQ} style={{ animation: 'fadeInUp 0.4s ease-out' }}>
                    {/* Report progress header */}
                    <div className="mb-5 sm:mb-7">
                        {/* Top: logo + step counter */}
                        <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                                <Brain className="w-4 h-4" style={{ color: '#818cf8' }} />
                                <span className="text-xs font-bold" style={{ color: '#818cf8' }}>IL TUO REPORT</span>
                            </div>
                            <span className="text-xs font-bold" style={{ color: '#71717a' }}>Domanda {currentQ + 1} di {QUESTIONS.length}</span>
                        </div>
                        {/* Main progress bar */}
                        <div className="h-2 rounded-full overflow-hidden mb-2" style={{ background: '#1f1f23' }}>
                            <div className="h-full rounded-full transition-all duration-500" style={{
                                width: `${progress}%`,
                                background: 'linear-gradient(90deg, #6366f1, #8b5cf6, #a855f7)',
                                backgroundSize: '200% 100%',
                                animation: 'shimmer 2s linear infinite',
                            }} />
                        </div>
                        {/* Progress message */}
                        <div className="flex items-center justify-between">
                            <p className="text-[11px] sm:text-xs font-medium" style={{ color: '#52525b' }}>
                                {PROGRESS_MESSAGES[currentQ]}
                            </p>
                            <span className="text-[11px] font-bold" style={{ color: '#818cf8' }}>
                                {Math.round(progress)}% del report
                            </span>
                        </div>
                    </div>

                    {/* Area completion indicators */}
                    <div className="flex items-center gap-2 mb-5">
                        {(Object.keys(AREA_META) as (keyof typeof AREA_META)[]).map((area, i) => {
                            const meta = AREA_META[area]
                            const AreaI = meta.icon
                            const isComplete = i < completedAreas
                            const isCurrent = i === completedAreas
                            return (
                                <div key={area} className="flex-1 flex items-center gap-1.5 px-2 py-1.5 rounded-lg transition-all" style={{
                                    background: isComplete ? `${meta.color}15` : isCurrent ? `${meta.color}08` : 'rgba(255,255,255,0.02)',
                                    border: `1px solid ${isComplete ? `${meta.color}30` : isCurrent ? `${meta.color}15` : 'rgba(255,255,255,0.04)'}`,
                                }}>
                                    {isComplete ? (
                                        <CheckCircle className="w-3 h-3 flex-shrink-0" style={{ color: meta.color, animation: 'checkIn 0.3s ease-out' }} />
                                    ) : (
                                        <AreaI className="w-3 h-3 flex-shrink-0" style={{ color: isCurrent ? meta.color : '#3f3f46' }} />
                                    )}
                                    <span className="text-[9px] sm:text-[10px] font-bold truncate" style={{ color: isComplete ? meta.color : isCurrent ? '#a1a1aa' : '#3f3f46' }}>
                                        {meta.label.split(' ')[0]}
                                    </span>
                                </div>
                            )
                        })}
                    </div>

                    {/* Area badge */}
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[11px] sm:text-xs font-bold mb-4 sm:mb-5" style={{ background: `${areaMeta.color}12`, color: areaMeta.color, border: `1px solid ${areaMeta.color}25` }}>
                        <AreaIcon className="w-3.5 h-3.5" />
                        Area {completedAreas + 1}/{totalAreas}: {areaMeta.label}
                    </div>

                    {/* Question */}
                    <h2 className="text-xl sm:text-2xl md:text-3xl font-black text-white leading-tight mb-2 sm:mb-3">
                        {q.text}
                    </h2>
                    <p className="text-xs sm:text-sm mb-6 sm:mb-8" style={{ color: '#52525b' }}>
                        Rispondi pensando agli ultimi 2-3 mesi
                    </p>

                    {/* Answer buttons */}
                    <div className="space-y-2.5 sm:space-y-3">
                        {ANSWER_OPTIONS.map(opt => {
                            const isSelected = answers[q.id] === opt.value
                            return (
                                <button
                                    key={opt.value}
                                    onClick={() => answerQuestion(opt.value)}
                                    className="w-full p-4 sm:p-5 rounded-xl sm:rounded-2xl text-left flex items-center gap-3 sm:gap-4 transition-all cursor-pointer group active:scale-[0.98]"
                                    style={{
                                        background: isSelected ? `${areaMeta.color}15` : 'rgba(15, 15, 19, 0.6)',
                                        border: `1px solid ${isSelected ? `${areaMeta.color}40` : 'rgba(99, 102, 241, 0.08)'}`,
                                        backdropFilter: 'blur(10px)',
                                    }}
                                >
                                    <span className="text-xl sm:text-2xl">{opt.emoji}</span>
                                    <span className="text-sm sm:text-base font-bold text-white flex-1">{opt.label}</span>
                                    <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5 opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: areaMeta.color }} />
                                </button>
                            )
                        })}
                    </div>

                    {/* Back button */}
                    {currentQ > 0 && (
                        <button
                            onClick={() => setCurrentQ(prev => prev - 1)}
                            className="mt-5 sm:mt-6 flex items-center gap-2 text-xs sm:text-sm font-medium transition-all cursor-pointer"
                            style={{ color: '#52525b' }}
                        >
                            <ArrowLeft className="w-4 h-4" /> Domanda precedente
                        </button>
                    )}

                    {/* Bottom reminder */}
                    <div className="mt-6 sm:mt-8 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl" style={{ background: 'rgba(99, 102, 241, 0.05)', border: '1px solid rgba(99, 102, 241, 0.1)' }}>
                        <Activity className="w-3.5 h-3.5" style={{ color: '#818cf8' }} />
                        <span className="text-[10px] sm:text-[11px] font-medium" style={{ color: '#71717a' }}>
                            {currentQ < 6
                                ? '📊 Ogni risposta migliora la precisione del tuo report personalizzato'
                                : currentQ < 10
                                    ? '🔍 Stiamo costruendo il profilo — mancano poche domande!'
                                    : '🎯 Ultime domande! Il tuo report è quasi pronto'
                            }
                        </span>
                    </div>
                </div>

                <style>{GLOBAL_STYLES}
                    {`button:hover { transform: translateY(-2px); }`}
                </style>
            </div>
        )
    }


    // ── LOADING ──
    if (phase === 'loading') {
        const loadingSteps = [
            { icon: '🔍', text: 'Analisi delle risposte in corso...' },
            { icon: '🧠', text: 'Calcolo del profilo mentale...' },
            { icon: '📊', text: 'Generazione del report personalizzato...' },
        ]

        return (
            <div className="min-h-[100dvh] flex items-center justify-center px-5 py-8" style={{ background: '#09090b' }}>
                <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at center, rgba(99, 102, 241, 0.08), transparent 60%)' }} />
                <div className="relative text-center max-w-sm" style={{ animation: 'fadeInUp 0.5s ease-out' }}>
                    <div className="w-20 h-20 sm:w-24 sm:h-24 mx-auto mb-6 sm:mb-8 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(99, 102, 241, 0.1)', border: '1px solid rgba(99, 102, 241, 0.2)', animation: 'pulse-glow 2s ease-in-out infinite' }}>
                        <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full animate-spin" style={{ borderWidth: '3px', borderStyle: 'solid', borderColor: 'rgba(99, 102, 241, 0.2)', borderTopColor: '#6366f1' }} />
                    </div>

                    <h2 className="text-xl sm:text-2xl font-black text-white mb-2">Stiamo creando il tuo Report</h2>
                    <p className="text-xs sm:text-sm mb-8" style={{ color: '#71717a' }}>Il Profilo Mentale Sportivo personalizzato è quasi pronto</p>

                    {/* Step indicators */}
                    <div className="space-y-3 text-left">
                        {loadingSteps.map((step, i) => (
                            <div key={i} className="flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-500" style={{
                                background: i <= loadStep ? 'rgba(99, 102, 241, 0.06)' : 'transparent',
                                border: `1px solid ${i <= loadStep ? 'rgba(99, 102, 241, 0.15)' : 'rgba(255,255,255,0.04)'}`,
                                opacity: i <= loadStep ? 1 : 0.3,
                            }}>
                                <span className="text-base">{i < loadStep ? '✅' : step.icon}</span>
                                <span className="text-xs sm:text-sm font-medium" style={{ color: i <= loadStep ? '#e4e4e7' : '#52525b' }}>{step.text}</span>
                            </div>
                        ))}
                    </div>
                </div>
                <style>{GLOBAL_STYLES}</style>
            </div>
        )
    }

    // ── REPORT ──
    const verdict = getOverallVerdict()
    const criticalAreas = getCriticalAreas()

    return (
        <div className="min-h-[100dvh] px-4 py-8 sm:px-6 sm:py-10 md:p-8" style={{ background: '#09090b' }}>
            <div className="absolute inset-0" style={{ background: `radial-gradient(ellipse at top, ${verdict.color}08, transparent 60%)` }} />

            <div className="relative max-w-2xl mx-auto" style={{ animation: 'fadeInUp 0.6s ease-out' }}>
                {/* Header */}
                <div className="text-center mb-8 sm:mb-10">
                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full mb-4 sm:mb-5" style={{ background: 'rgba(99, 102, 241, 0.1)', border: '1px solid rgba(99, 102, 241, 0.2)' }}>
                        <Brain className="w-4 h-4 sm:w-5 sm:h-5" style={{ color: '#818cf8' }} />
                        <span className="text-xs sm:text-sm font-bold" style={{ color: '#818cf8' }}>IL TUO REPORT PERSONALIZZATO</span>
                    </div>
                    <h1 className="text-2xl sm:text-3xl md:text-4xl font-black text-white mb-2 sm:mb-3">
                        Profilo Mentale Sportivo
                    </h1>
                    <p className="text-sm sm:text-base" style={{ color: '#71717a' }}>
                        Ecco cosa abbiamo scoperto analizzando le tue risposte
                    </p>
                </div>

                {/* Overall Score Card */}
                <div className="rounded-2xl p-5 sm:p-8 mb-5 sm:mb-8" style={{
                    background: 'rgba(15, 15, 19, 0.8)',
                    backdropFilter: 'blur(20px)',
                    border: `1px solid ${verdict.color}30`,
                    boxShadow: `0 0 60px ${verdict.color}08`,
                }}>
                    <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 sm:gap-6 text-center sm:text-left">
                        <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ background: `${verdict.color}12`, border: `1px solid ${verdict.color}30` }}>
                            <span className="text-2xl sm:text-3xl font-black" style={{ color: verdict.color }}>{calcOverall()}%</span>
                        </div>
                        <div>
                            <h2 className="text-lg sm:text-xl font-black text-white mb-1 sm:mb-2">{verdict.title}</h2>
                            <p className="text-xs sm:text-sm leading-relaxed" style={{ color: '#a1a1aa' }}>{verdict.text}</p>
                        </div>
                    </div>
                </div>

                {/* Area Scores */}
                <div className="rounded-2xl p-5 sm:p-8 mb-5 sm:mb-8" style={{
                    background: 'rgba(15, 15, 19, 0.6)',
                    backdropFilter: 'blur(20px)',
                    border: '1px solid rgba(99, 102, 241, 0.08)',
                }}>
                    <h3 className="text-base sm:text-lg font-bold text-white mb-5 sm:mb-6">Dettaglio per Area</h3>
                    <div className="space-y-5 sm:space-y-6">
                        {(Object.keys(AREA_META) as (keyof typeof AREA_META)[]).map(area => {
                            const score = calcAreaScore(area)
                            const level = getScoreLevel(score)
                            const meta = AREA_META[area]
                            const Icon = meta.icon

                            return (
                                <div key={area}>
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="flex items-center gap-2">
                                            <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4" style={{ color: meta.color }} />
                                            <span className="text-xs sm:text-sm font-bold text-white">{meta.label}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px] sm:text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: `${level.color}15`, color: level.color, border: `1px solid ${level.color}30` }}>
                                                {level.label}
                                            </span>
                                            <span className="text-xs sm:text-sm font-black" style={{ color: level.color }}>{score}%</span>
                                        </div>
                                    </div>
                                    <div className="h-2.5 sm:h-3 rounded-full overflow-hidden" style={{ background: '#1f1f23' }}>
                                        <div className="h-full rounded-full transition-all duration-1000" style={{ width: `${score}%`, background: meta.gradient }} />
                                    </div>
                                    <p className="text-[10px] sm:text-xs mt-1.5" style={{ color: '#52525b' }}>{level.description}</p>
                                </div>
                            )
                        })}
                    </div>
                </div>

                {/* Critical Areas Callout */}
                {criticalAreas.length > 0 && (
                    <div className="rounded-2xl p-5 sm:p-8 mb-5 sm:mb-8" style={{
                        background: 'rgba(239, 68, 68, 0.05)',
                        border: '1px solid rgba(239, 68, 68, 0.15)',
                    }}>
                        <div className="flex items-center gap-2 mb-3 sm:mb-4">
                            <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5" style={{ color: '#ef4444' }} />
                            <h3 className="text-base sm:text-lg font-bold" style={{ color: '#ef4444' }}>
                                {criticalAreas.length === 1 ? 'Area critica identificata' : 'Aree critiche identificate'}
                            </h3>
                        </div>
                        <div className="space-y-2 sm:space-y-3">
                            {criticalAreas.map(({ area, score, meta }) => (
                                <div key={area} className="flex items-center gap-3 p-2.5 sm:p-3 rounded-xl" style={{ background: 'rgba(239, 68, 68, 0.08)' }}>
                                    <meta.icon className="w-4 h-4" style={{ color: meta.color }} />
                                    <span className="text-xs sm:text-sm font-bold text-white flex-1">{meta.label}</span>
                                    <span className="text-xs sm:text-sm font-black" style={{ color: '#ef4444' }}>{score}%</span>
                                </div>
                            ))}
                        </div>
                        <p className="text-xs sm:text-sm mt-3 sm:mt-4 leading-relaxed" style={{ color: '#a1a1aa' }}>
                            Questi segnali indicano la presenza di un <strong className="text-white">freno invisibile</strong> che
                            sta impedendo al tuo ragazzo di esprimere il suo potenziale. Più tempo passa, più il freno si radica.
                        </p>
                    </div>
                )}

                {/* CTA */}
                {consultaRequested ? (
                    <div className="rounded-2xl p-6 sm:p-8 text-center" style={{
                        background: 'rgba(34, 197, 94, 0.06)',
                        border: '1px solid rgba(34, 197, 94, 0.2)',
                        boxShadow: '0 0 60px rgba(34, 197, 94, 0.08)',
                    }}>
                        <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full mx-auto mb-4 flex items-center justify-center" style={{ background: 'rgba(34, 197, 94, 0.12)', border: '2px solid rgba(34, 197, 94, 0.3)' }}>
                            <CheckCircle className="w-8 h-8 sm:w-10 sm:h-10" style={{ color: '#22c55e' }} />
                        </div>
                        <h3 className="text-xl sm:text-2xl font-black text-white mb-2">
                            Richiesta inviata! ✨
                        </h3>
                        <p className="text-xs sm:text-sm leading-relaxed px-2" style={{ color: '#a1a1aa' }}>
                            Ti contatteremo al più presto per fissare la consulenza gratuita.
                            <br />Riceverai una conferma a <strong className="text-white">{parentEmail}</strong>.
                        </p>
                    </div>
                ) : showConsultaForm ? (
                    /* ── FORM CONTATTO (come i funnel) ── */
                    <div className="rounded-2xl p-5 sm:p-8" style={{
                        background: 'rgba(34, 197, 94, 0.04)',
                        border: '1px solid rgba(34, 197, 94, 0.15)',
                        boxShadow: '0 0 60px rgba(34, 197, 94, 0.05)',
                    }}>
                        <div className="text-center mb-5 sm:mb-6">
                            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] sm:text-xs font-bold mb-3" style={{ background: 'rgba(34, 197, 94, 0.1)', color: '#22c55e', border: '1px solid rgba(34, 197, 94, 0.2)' }}>
                                ✅ GRATUITA · Senza impegno
                            </div>
                            <h3 className="text-lg sm:text-xl font-black text-white mb-1">
                                Richiedi la Consulenza Gratuita
                            </h3>
                            <p className="text-xs" style={{ color: '#71717a' }}>Compila il form — ti contatteremo noi.</p>
                        </div>

                        <div className="space-y-3 sm:space-y-4">
                            <div>
                                <label className="block text-xs font-semibold mb-1" style={{ color: '#a1a1aa' }}>Il tuo nome *</label>
                                <input type="text" value={parentName} onChange={e => setParentName(e.target.value)}
                                    placeholder="Es. Anna Rossi" autoFocus
                                    className="w-full px-4 py-3 rounded-xl text-white text-sm outline-none transition-all"
                                    style={{ background: '#18181b', border: '1px solid #27272a' }} />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold mb-1" style={{ color: '#a1a1aa' }}>Email *</label>
                                <input type="email" value={parentEmail} onChange={e => setParentEmail(e.target.value)}
                                    placeholder="Per conferma e comunicazioni"
                                    className="w-full px-4 py-3 rounded-xl text-white text-sm outline-none transition-all"
                                    style={{ background: '#18181b', border: '1px solid #27272a' }} />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold mb-1" style={{ color: '#a1a1aa' }}>Telefono *</label>
                                <input type="tel" value={parentPhone} onChange={e => setParentPhone(e.target.value)}
                                    placeholder="+39 xxx xxx xxxx"
                                    className="w-full px-4 py-3 rounded-xl text-white text-sm outline-none transition-all"
                                    style={{ background: '#18181b', border: '1px solid #27272a' }} />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-semibold mb-1" style={{ color: '#a1a1aa' }}>Nome ragazzo/a</label>
                                    <input type="text" value={childName} onChange={e => setChildName(e.target.value)}
                                        placeholder="Es. Marco"
                                        className="w-full px-4 py-3 rounded-xl text-white text-sm outline-none transition-all"
                                        style={{ background: '#18181b', border: '1px solid #27272a' }} />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold mb-1" style={{ color: '#a1a1aa' }}>Sport</label>
                                    <input type="text" value={childSport} onChange={e => setChildSport(e.target.value)}
                                        placeholder="Es. Calcio"
                                        className="w-full px-4 py-3 rounded-xl text-white text-sm outline-none transition-all"
                                        style={{ background: '#18181b', border: '1px solid #27272a' }} />
                                </div>
                            </div>

                            <button
                                onClick={handleConsultaSubmit}
                                disabled={!parentName || !parentEmail || !parentPhone || consultaSubmitting}
                                className="w-full py-3.5 sm:py-4 rounded-xl font-bold text-white text-sm sm:text-base flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-[0.98]"
                                style={{
                                    background: 'linear-gradient(135deg, #22c55e, #16a34a)',
                                    boxShadow: '0 0 30px rgba(34, 197, 94, 0.3)',
                                    opacity: (!parentName || !parentEmail || !parentPhone || consultaSubmitting) ? 0.5 : 1,
                                }}
                            >
                                {consultaSubmitting
                                    ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    : <><ArrowRight className="w-4 h-4" /> Invia Richiesta</>
                                }
                            </button>

                            <p className="text-center text-[10px]" style={{ color: '#3f3f46' }}>
                                🔒 I tuoi dati sono al sicuro e non saranno mai condivisi.
                            </p>
                        </div>
                    </div>
                ) : (
                    /* ── CTA BUTTON ── */
                    <div className="rounded-2xl p-6 sm:p-8 text-center" style={{
                        background: 'rgba(34, 197, 94, 0.04)',
                        border: '1px solid rgba(34, 197, 94, 0.15)',
                        boxShadow: '0 0 60px rgba(34, 197, 94, 0.05)',
                    }}>
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] sm:text-xs font-bold mb-4" style={{ background: 'rgba(34, 197, 94, 0.1)', color: '#22c55e', border: '1px solid rgba(34, 197, 94, 0.2)' }}>
                            ✅ GRATUITA · Senza impegno
                        </div>
                        <h3 className="text-xl sm:text-2xl font-black text-white mb-2 sm:mb-3">
                            Vuoi capire se e come possiamo aiutarlo?
                        </h3>
                        <p className="text-xs sm:text-sm leading-relaxed mb-5 sm:mb-6 px-2" style={{ color: '#a1a1aa' }}>
                            Richiedi una <strong className="text-white">consulenza gratuita</strong> con un nostro professionista.
                            Analizziamo insieme la situazione e capiamo se il Metodo Sincro può fare la differenza.
                            <br /><span style={{ color: '#71717a' }}>Nessun costo, nessun impegno — solo chiarezza.</span>
                        </p>
                        <button
                            onClick={() => setShowConsultaForm(true)}
                            className="inline-flex items-center gap-2 sm:gap-3 text-sm sm:text-lg font-bold px-6 sm:px-10 py-4 sm:py-5 rounded-2xl text-white transition-all hover:translate-y-[-3px] active:scale-[0.98] cursor-pointer"
                            style={{ background: 'linear-gradient(135deg, #22c55e, #16a34a)', boxShadow: '0 0 50px rgba(34, 197, 94, 0.3)' }}
                        >
                            <ArrowRight className="w-5 h-5" /> Richiedi la Consulenza Gratuita
                        </button>
                        <p className="text-[10px] sm:text-xs mt-3 sm:mt-4" style={{ color: '#52525b' }}>
                            100% gratuita · Senza impegno
                        </p>
                    </div>
                )}

                {/* Footer */}
                <div className="text-center mt-8 sm:mt-10">
                    <div className="flex items-center justify-center gap-2 mb-2">
                        <Brain className="w-4 h-4" style={{ color: '#818cf8' }} />
                        <span className="text-xs sm:text-sm font-bold" style={{ color: '#52525b' }}>Metodo Sincro</span>
                    </div>
                    <p className="text-[10px] sm:text-xs" style={{ color: '#3f3f46' }}>
                        Il freno invisibile si toglie. Non con le parole — con un metodo.
                    </p>
                </div>
            </div>

            <style>{GLOBAL_STYLES}</style>
        </div>
    )
}
