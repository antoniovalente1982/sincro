import Link from 'next/link'
import { ArrowRight, Zap, Brain, Target, BarChart3, Shield, Users, Rocket, Globe, Send, CheckCircle } from 'lucide-react'

export default function HomePage() {
    return (
        <div className="min-h-screen" style={{ background: '#09090b' }}>
            {/* Nav */}
            <nav className="fixed top-0 left-0 right-0 z-50" style={{ background: 'rgba(9, 9, 11, 0.8)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(99, 102, 241, 0.08)' }}>
                <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
                            <Rocket className="w-4 h-4 text-white" />
                        </div>
                        <span className="text-lg font-black text-white tracking-tight">ADPILOTIK</span>
                    </div>
                    <div className="flex items-center gap-3">
                        <Link href="/login" className="text-sm font-bold px-5 py-2.5 rounded-xl text-white transition-all hover:translate-y-[-2px]" style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', boxShadow: '0 0 30px rgba(99, 102, 241, 0.3)' }}>
                            Accedi
                        </Link>
                    </div>
                </div>
            </nav>

            {/* Hero */}
            <section className="relative pt-32 pb-20 px-6 overflow-hidden">
                <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at top, rgba(99, 102, 241, 0.15), transparent 60%)' }} />
                <div className="absolute top-20 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] rounded-full opacity-10 blur-[180px]" style={{ background: 'linear-gradient(135deg, #6366f1, #ec4899)' }} />

                <div className="relative max-w-4xl mx-auto text-center">
                    <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold mb-8" style={{ background: 'rgba(99, 102, 241, 0.1)', color: '#818cf8', border: '1px solid rgba(99, 102, 241, 0.2)' }}>
                        <Zap className="w-3.5 h-3.5" />
                        La prima piattaforma AI che vende per te
                    </div>

                    <h1 className="text-5xl md:text-7xl font-black text-white leading-[1.1] tracking-tight mb-8">
                        Le tue ads.{' '}
                        <span style={{ background: 'linear-gradient(135deg, #6366f1, #ec4899)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                            Più smart.
                        </span>
                        <br />
                        Più veloci. Automatiche.
                    </h1>

                    <p className="text-lg md:text-xl leading-relaxed max-w-2xl mx-auto mb-10" style={{ color: '#71717a' }}>
                        ADPILOTIK cattura lead dai tuoi funnel, li qualifica con AI scoring,
                        e insegna a Meta <strong className="text-white">chi sono i clienti che comprano</strong> —
                        non solo quelli che cliccano.
                    </p>

                    <div className="flex items-center justify-center gap-4 flex-wrap">
                        <Link href="/login" className="inline-flex items-center gap-2 text-base font-bold px-8 py-4 rounded-2xl text-white transition-all hover:translate-y-[-3px]" style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', boxShadow: '0 0 50px rgba(99, 102, 241, 0.35)' }}>
                            Accedi alla Piattaforma <ArrowRight className="w-5 h-5" />
                        </Link>
                        <span className="text-sm" style={{ color: '#52525b' }}>Accesso riservato al team</span>
                    </div>
                </div>
            </section>

            {/* Stats */}
            <section className="py-16 px-6" style={{ borderTop: '1px solid rgba(99, 102, 241, 0.06)', borderBottom: '1px solid rgba(99, 102, 241, 0.06)' }}>
                <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
                    {[
                        { value: '-40%', label: 'Costo per Lead', color: '#22c55e' },
                        { value: '+3x', label: 'ROAS medio', color: '#6366f1' },
                        { value: '24h', label: 'Setup completo', color: '#f59e0b' },
                        { value: '100%', label: 'Server-side tracking', color: '#ec4899' },
                    ].map(s => (
                        <div key={s.label}>
                            <div className="text-3xl md:text-4xl font-black mb-2" style={{ color: s.color }}>{s.value}</div>
                            <div className="text-sm" style={{ color: '#71717a' }}>{s.label}</div>
                        </div>
                    ))}
                </div>
            </section>

            {/* Features */}
            <section className="py-24 px-6">
                <div className="max-w-6xl mx-auto">
                    <div className="text-center mb-16">
                        <h2 className="text-3xl md:text-5xl font-black text-white mb-4">
                            Il CRM che insegna a Meta{' '}
                            <span style={{ color: '#6366f1' }}>chi comprare</span>
                        </h2>
                        <p className="text-base max-w-xl mx-auto" style={{ color: '#71717a' }}>
                            Non ottimizzare per i click. Ottimizza per le vendite. ADPILOTIK connette ogni azione del tuo team di vendita a Meta.
                        </p>
                    </div>

                    <div className="grid md:grid-cols-3 gap-6">
                        {[
                            {
                                icon: Globe, color: '#8b5cf6', title: 'Funnel Landing Pages',
                                desc: 'Crea pagine di cattura lead premium in 30 secondi. UTM tracking, Meta Pixel e CAPI integrati. Il lead entra direttamente nel CRM.'
                            },
                            {
                                icon: Brain, color: '#ec4899', title: 'AI Lead Scoring',
                                desc: "Ogni lead riceve un punteggio intelligente: 🔥 Hot, ⚡ Warm, 🧊 Cold. L'AI analizza completezza dati, fonte, velocità e valore per prioritizzare."
                            },
                            {
                                icon: Target, color: '#22c55e', title: 'CRM → Meta CAPI',
                                desc: 'Quando il setter qualifica un lead o il closer chiude, Meta riceve l\'evento server-side. Così ottimizza per trovare persone simili a chi COMPRA.'
                            },
                            {
                                icon: BarChart3, color: '#f59e0b', title: 'AI Smart Dashboard',
                                desc: 'Conversion rate, bottleneck detection, revenue forecast. Il dashboard ti dice cosa sta funzionando e dove intervenire.'
                            },
                            {
                                icon: Users, color: '#3b82f6', title: 'Team Setter/Closer',
                                desc: 'Pipeline CRM completo con ruoli setter e closer. Assegna lead, traccia le attività, misura le performance del team.'
                            },
                            {
                                icon: Shield, color: '#6366f1', title: 'Server-Side Tracking',
                                desc: 'Niente più blocco dei cookie. CAPI invia gli eventi direttamente dal server a Meta, con dati hashati SHA256 per la privacy.'
                            },
                        ].map((f) => (
                            <div key={f.title} className="group p-6 rounded-2xl transition-all duration-300 hover:translate-y-[-4px]" style={{
                                background: 'rgba(15, 15, 19, 0.6)',
                                border: '1px solid rgba(99, 102, 241, 0.08)',
                                backdropFilter: 'blur(10px)',
                            }}>
                                <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-4" style={{ background: `${f.color}12`, border: `1px solid ${f.color}25` }}>
                                    <f.icon className="w-6 h-6" style={{ color: f.color }} />
                                </div>
                                <h3 className="text-lg font-bold text-white mb-2">{f.title}</h3>
                                <p className="text-sm leading-relaxed" style={{ color: '#71717a' }}>{f.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* How it Works */}
            <section className="py-24 px-6" style={{ background: 'rgba(99, 102, 241, 0.03)', borderTop: '1px solid rgba(99, 102, 241, 0.06)' }}>
                <div className="max-w-4xl mx-auto">
                    <div className="text-center mb-16">
                        <h2 className="text-3xl md:text-4xl font-black text-white mb-4">Come funziona</h2>
                        <p className="text-base" style={{ color: '#71717a' }}>Da zero a vendite in 4 passi</p>
                    </div>

                    <div className="space-y-8">
                        {[
                            { step: '01', title: 'Crea un Funnel', desc: 'Scegli il titolo, il colore, la CTA. In 30 secondi hai una landing page professionale.' },
                            { step: '02', title: 'Lancia le Ads', desc: 'Usa il link del funnel come URL di destinazione nelle tue campagne Meta o Google.' },
                            { step: '03', title: 'Gestisci nel CRM', desc: "Lead arrivano automaticamente. L'AI li classifica. I setter qualificano. I closer vendono." },
                            { step: '04', title: 'Meta Impara', desc: 'Ogni azione nel CRM invia un evento CAPI. Meta ottimizza per trovare persone simili a chi compra.' },
                        ].map((s) => (
                            <div key={s.step} className="flex gap-6 items-start group">
                                <div className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 text-lg font-black transition-all group-hover:scale-110" style={{
                                    background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.1), rgba(139, 92, 246, 0.1))',
                                    border: '1px solid rgba(99, 102, 241, 0.2)',
                                    color: '#818cf8',
                                }}>
                                    {s.step}
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold text-white mb-1">{s.title}</h3>
                                    <p className="text-sm" style={{ color: '#71717a' }}>{s.desc}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* CTA */}
            <section className="py-24 px-6 text-center relative overflow-hidden">
                <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at bottom, rgba(99, 102, 241, 0.12), transparent 60%)' }} />
                <div className="relative max-w-2xl mx-auto">
                    <h2 className="text-3xl md:text-5xl font-black text-white mb-6">
                        La piattaforma AI di Metodo Sincro
                    </h2>
                    <p className="text-base mb-10" style={{ color: '#71717a' }}>
                        Accesso riservato al team autorizzato.
                    </p>
                    <Link href="/login" className="inline-flex items-center gap-2 text-lg font-bold px-10 py-5 rounded-2xl text-white transition-all hover:translate-y-[-3px]" style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', boxShadow: '0 0 60px rgba(99, 102, 241, 0.4)' }}>
                        <Rocket className="w-5 h-5" /> Accedi
                    </Link>
                </div>
            </section>

            {/* Footer */}
            <footer className="py-8 px-6 text-center" style={{ borderTop: '1px solid rgba(99, 102, 241, 0.06)' }}>
                <div className="flex items-center justify-center gap-2 mb-2">
                    <div className="w-6 h-6 rounded-md flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
                        <Rocket className="w-3 h-3 text-white" />
                    </div>
                    <span className="text-sm font-bold text-white">ADPILOTIK</span>
                </div>
                <p className="text-xs" style={{ color: '#3f3f46' }}>
                    © 2026 ADPILOTIK. Your ads. Smarter. Faster. Automatic.
                </p>
            </footer>

            <style>{`
                @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(20px); }
                    to { opacity: 1; transform: translateY(0); }
                }
            `}</style>
        </div>
    )
}
