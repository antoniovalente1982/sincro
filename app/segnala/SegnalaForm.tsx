'use client'

import { useState, useEffect } from 'react'
import { Handshake, Send, CheckCircle, ArrowRight, User, Phone, Mail, Activity as Sport } from 'lucide-react'

export default function SegnalaForm() {
    const [partnerId, setPartnerId] = useState<string | null>(null)
    const [parentName, setParentName] = useState('')
    const [parentPhone, setParentPhone] = useState('')
    const [parentEmail, setParentEmail] = useState('')
    const [childName, setChildName] = useState('')
    const [childSport, setChildSport] = useState('')
    const [notes, setNotes] = useState('')
    const [submitting, setSubmitting] = useState(false)
    const [submitted, setSubmitted] = useState(false)
    const [error, setError] = useState('')

    useEffect(() => {
        if (typeof window !== 'undefined') {
            const params = new URLSearchParams(window.location.search)
            setPartnerId(params.get('p'))
        }
    }, [])

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        if (!parentName || !parentPhone) return
        setSubmitting(true)
        setError('')

        try {
            const res = await fetch('/api/partner/segnala', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    partner_id: partnerId,
                    parent_name: parentName,
                    parent_phone: parentPhone,
                    parent_email: parentEmail,
                    child_name: childName,
                    child_sport: childSport,
                    notes,
                }),
            })

            if (!res.ok) {
                const data = await res.json()
                throw new Error(data.error || 'Errore nell\'invio')
            }

            setSubmitted(true)
        } catch (err: any) {
            setError(err.message)
        } finally {
            setSubmitting(false)
        }
    }

    // ── SUCCESS ──
    if (submitted) {
        return (
            <div className="min-h-screen flex items-center justify-center p-4" style={{ background: '#09090b' }}>
                <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at top, rgba(34, 197, 94, 0.1), transparent 60%)' }} />
                <div className="relative text-center" style={{ animation: 'fadeInUp 0.5s ease-out' }}>
                    <div className="w-20 h-20 rounded-full mx-auto mb-6 flex items-center justify-center" style={{ background: 'rgba(34, 197, 94, 0.12)', border: '2px solid rgba(34, 197, 94, 0.3)' }}>
                        <CheckCircle className="w-10 h-10" style={{ color: '#22c55e' }} />
                    </div>
                    <h1 className="text-3xl font-black text-white mb-3">Contatto Inviato! ✨</h1>
                    <p className="text-base mb-6" style={{ color: '#a1a1aa' }}>
                        Grazie! Il team Metodo Sincro lo contatterà il prima possibile.
                    </p>
                    <p className="text-sm" style={{ color: '#52525b' }}>
                        Puoi chiudere questa pagina o segnalare un altro contatto.
                    </p>
                    <button
                        onClick={() => {
                            setSubmitted(false)
                            setParentName(''); setParentPhone(''); setParentEmail('')
                            setChildName(''); setChildSport(''); setNotes('')
                        }}
                        className="mt-6 inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold transition-all hover:translate-y-[-2px] cursor-pointer"
                        style={{ background: 'rgba(99, 102, 241, 0.1)', color: '#818cf8', border: '1px solid rgba(99, 102, 241, 0.2)' }}
                    >
                        <ArrowRight className="w-4 h-4" /> Segnala un Altro Contatto
                    </button>
                </div>
                <style>{`@keyframes fadeInUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }`}</style>
            </div>
        )
    }

    // ── FORM ──
    return (
        <div className="min-h-screen flex items-center justify-center p-4" style={{ background: '#09090b' }}>
            <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at top, rgba(34, 197, 94, 0.08), transparent 60%)' }} />

            <div className="relative w-full max-w-md" style={{ animation: 'fadeInUp 0.5s ease-out' }}>
                {/* Header */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center gap-2 mb-4">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(34, 197, 94, 0.12)', border: '1px solid rgba(34, 197, 94, 0.25)' }}>
                            <Handshake className="w-5 h-5" style={{ color: '#22c55e' }} />
                        </div>
                    </div>
                    <h1 className="text-2xl font-black text-white mb-2">Segnala un Contatto</h1>
                    <p className="text-sm" style={{ color: '#71717a' }}>
                        {partnerId
                            ? `Stai segnalando come partner: ${partnerId}`
                            : 'Inserisci i dati della famiglia da segnalare'
                        }
                    </p>

                    {!partnerId && (
                        <div className="mt-3 px-3 py-2 rounded-lg text-xs font-medium" style={{ background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b', border: '1px solid rgba(245, 158, 11, 0.2)' }}>
                            ⚠️ Nessun partner ID nel link. Il contatto verrà salvato senza attribuzione.
                        </div>
                    )}
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="rounded-2xl p-8 space-y-4" style={{
                    background: 'rgba(15, 15, 19, 0.8)',
                    backdropFilter: 'blur(20px)',
                    border: '1px solid rgba(34, 197, 94, 0.12)',
                }}>
                    {/* Parent info */}
                    <div>
                        <label className="block text-sm font-semibold mb-1.5" style={{ color: '#a1a1aa' }}>
                            <User className="w-3.5 h-3.5 inline mr-1" />Nome del genitore *
                        </label>
                        <input
                            type="text" value={parentName} onChange={e => setParentName(e.target.value)}
                            placeholder="Es. Marco Bianchi" required
                            className="w-full px-4 py-3.5 rounded-xl text-white text-sm outline-none transition-all"
                            style={{ background: '#18181b', border: '1px solid #27272a' }}
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-semibold mb-1.5" style={{ color: '#a1a1aa' }}>
                            <Phone className="w-3.5 h-3.5 inline mr-1" />Telefono *
                        </label>
                        <input
                            type="tel" value={parentPhone} onChange={e => setParentPhone(e.target.value)}
                            placeholder="+39 xxx xxx xxxx" required
                            className="w-full px-4 py-3.5 rounded-xl text-white text-sm outline-none transition-all"
                            style={{ background: '#18181b', border: '1px solid #27272a' }}
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-semibold mb-1.5" style={{ color: '#a1a1aa' }}>
                            <Mail className="w-3.5 h-3.5 inline mr-1" />Email <span className="font-normal" style={{ color: '#52525b' }}>(opzionale)</span>
                        </label>
                        <input
                            type="email" value={parentEmail} onChange={e => setParentEmail(e.target.value)}
                            placeholder="email@esempio.it"
                            className="w-full px-4 py-3.5 rounded-xl text-white text-sm outline-none transition-all"
                            style={{ background: '#18181b', border: '1px solid #27272a' }}
                        />
                    </div>

                    <div className="h-px" style={{ background: '#1f1f23' }} />

                    {/* Child info */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-sm font-semibold mb-1.5" style={{ color: '#a1a1aa' }}>Nome ragazzo/a</label>
                            <input
                                type="text" value={childName} onChange={e => setChildName(e.target.value)}
                                placeholder="Es. Luca"
                                className="w-full px-4 py-3.5 rounded-xl text-white text-sm outline-none transition-all"
                                style={{ background: '#18181b', border: '1px solid #27272a' }}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold mb-1.5" style={{ color: '#a1a1aa' }}>Sport</label>
                            <input
                                type="text" value={childSport} onChange={e => setChildSport(e.target.value)}
                                placeholder="Es. Calcio"
                                className="w-full px-4 py-3.5 rounded-xl text-white text-sm outline-none transition-all"
                                style={{ background: '#18181b', border: '1px solid #27272a' }}
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-semibold mb-1.5" style={{ color: '#a1a1aa' }}>Note sulla situazione</label>
                        <textarea
                            value={notes} onChange={e => setNotes(e.target.value)}
                            placeholder="Es. Il ragazzo ha perso motivazione dopo un cambio squadra..."
                            rows={3}
                            className="w-full px-4 py-3.5 rounded-xl text-white text-sm outline-none transition-all resize-none"
                            style={{ background: '#18181b', border: '1px solid #27272a' }}
                        />
                    </div>

                    {error && (
                        <div className="p-3 rounded-xl text-sm font-medium" style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                            {error}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={submitting || !parentName || !parentPhone}
                        className="w-full py-4 rounded-xl font-bold text-white text-base flex items-center justify-center gap-2 transition-all cursor-pointer"
                        style={{
                            background: 'linear-gradient(135deg, #22c55e, #16a34a)',
                            boxShadow: '0 0 30px rgba(34, 197, 94, 0.2)',
                            opacity: (submitting || !parentName || !parentPhone) ? 0.5 : 1,
                        }}
                    >
                        {submitting ? (
                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                            <><Send className="w-5 h-5" /> Invia Segnalazione</>
                        )}
                    </button>

                    <p className="text-center text-xs" style={{ color: '#3f3f46' }}>
                        🔒 I dati vengono inviati direttamente al team Metodo Sincro.
                    </p>
                </form>
            </div>

            <style>{`
                @keyframes fadeInUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
                input:focus, textarea:focus { border-color: #22c55e !important; box-shadow: 0 0 0 3px rgba(34, 197, 94, 0.15); }
                button[type="submit"]:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 0 40px rgba(34, 197, 94, 0.3) !important; }
            `}</style>
        </div>
    )
}
