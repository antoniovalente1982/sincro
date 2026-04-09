'use client'

import { CheckCircle2, Video, Calendar, ShieldCheck, TrendingUp, Users, ArrowRight, Play, Star } from 'lucide-react'
import Link from 'next/link'

export default function ThankYouPage() {
    return (
        <div className="min-h-screen bg-[#050505] text-white selection:bg-blue-500/30 overflow-hidden relative">
            {/* Background elements */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-4xl h-[500px] bg-blue-500/10 blur-[120px] pointer-events-none rounded-full" />
            
            {/* Header/Nav minimalista */}
            <nav className="w-full border-b border-white/5 bg-black/50 backdrop-blur-md sticky top-0 z-50">
                <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-center">
                    <span className="text-xl font-bold tracking-tight text-white/90">
                        METODO<span className="text-blue-500">SINCRO</span>
                    </span>
                </div>
            </nav>

            <main className="max-w-4xl mx-auto px-4 py-16 relative z-10">
                
                {/* HERO CONFIRMATION */}
                <div className="text-center animate-in fade-in slide-in-from-bottom-8 duration-700 mb-16">
                    <div className="inline-flex items-center justify-center w-20 h-20 bg-green-500/10 border border-green-500/20 rounded-full mb-6 relative">
                        <div className="absolute inset-0 bg-green-500/20 blur-xl rounded-full" />
                        <CheckCircle2 className="w-10 h-10 text-green-400 relative z-10" />
                    </div>
                    
                    <h1 className="text-4xl md:text-5xl font-bold text-white mb-4 tracking-tight leading-tight">
                        Sei ufficialmente dentro. <br />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-500">
                            La tua chiamata è confermata.
                        </span>
                    </h1>
                    <p className="text-lg text-neutral-400 max-w-2xl mx-auto leading-relaxed">
                        Hai fatto il primo passo per trasformare i tuoi risultati. Riceverai a breve un'email con il riepilogo e il link per accedere alla videochiamata. Ma nel frattempo, <span className="text-white font-medium">leggi attentamente qui sotto.</span>
                    </p>
                </div>

                {/* THE 3 10s: STRAIGHT LINE PERSUASION SECTION */}
                
                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-12 duration-1000 delay-200">
                    
                    {/* Trust in the Company & Service */}
                    <div className="bg-[#111] border border-white/5 rounded-3xl p-8 md:p-10 relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 blur-[80px] rounded-full group-hover:bg-indigo-500/10 transition-colors" />
                        
                        <div className="flex flex-col md:flex-row gap-8 items-start relative z-10">
                            <div className="w-16 h-16 bg-blue-500/10 border border-blue-500/20 rounded-2xl flex items-center justify-center flex-shrink-0">
                                <TrendingUp className="w-8 h-8 text-blue-400" />
                            </div>
                            <div>
                                <h2 className="text-2xl font-semibold mb-3">Cosa succederà in questa chiamata?</h2>
                                <p className="text-neutral-400 leading-relaxed mb-4">
                                    Questa non è una "chiacchierata di vendita" standard. È una vera e propria <strong>Consulenza Strategica</strong>. Analizzeremo a raggi x la tua attuale situazione, i colli di bottiglia del tuo marketing e i processi di vendita.
                                </p>
                                <p className="text-neutral-400 leading-relaxed">
                                    Uscirai da questa sessione di 45 minuti con una mappa chiara su come scalare le tue conversioni con il <strong>Metodo Sincro</strong>, un sistema collaudato che ha già aiutato centinaia di imprenditori a stabilizzare i loro profitti.
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Trust in the Consultant (Closer) */}
                    <div className="bg-[#111] border border-white/5 rounded-3xl p-8 md:p-10 relative overflow-hidden group">
                        <div className="absolute bottom-0 left-0 w-64 h-64 bg-green-500/5 blur-[80px] rounded-full group-hover:bg-green-500/10 transition-colors" />
                        
                        <div className="flex flex-col md:flex-row gap-8 items-start relative z-10">
                            <div className="w-16 h-16 bg-green-500/10 border border-green-500/20 rounded-2xl flex items-center justify-center flex-shrink-0">
                                <ShieldCheck className="w-8 h-8 text-green-400" />
                            </div>
                            <div>
                                <h2 className="text-2xl font-semibold mb-3">Con chi parlerai</h2>
                                <p className="text-neutral-400 leading-relaxed mb-4">
                                    I nostri High-Ticket Closer e Advisor non sono operatori di un call center. Sono professionisti d'élite, rigorosamente formati sulle nostre metodologie. Non giudicano, non fanno pressioni. <strong>Ascoltano.</strong>
                                </p>
                                <p className="text-neutral-400 leading-relaxed">
                                    Verrai affidato all'esperto più adatto al tuo settore. Il loro unico obiettivo in questa prima chiamata è capire se e come possiamo realmente portarti il risultato che desideri. Se non fossimo il fit giusto, te lo diremo onestamente.
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Trust in the Social Proof */}
                    <div className="bg-gradient-to-br from-[#151515] to-[#0A0A0A] border border-white/5 rounded-3xl p-8 md:p-10 relative overflow-hidden">
                        <div className="flex flex-col md:flex-row justify-between items-center gap-8 relative z-10">
                            <div className="flex-1">
                                <div className="flex items-center gap-2 mb-3">
                                    {[1, 2, 3, 4, 5].map(i => (
                                        <Star key={i} className="w-5 h-5 fill-yellow-500 text-yellow-500" />
                                    ))}
                                </div>
                                <h2 className="text-2xl font-semibold mb-2">Non fidarti solo delle nostre parole.</h2>
                                <p className="text-neutral-400">
                                    Oltre <strong className="text-white">350+ aziende e professionisti</strong> hanno già trasformato i loro processi di acquisizione e vendita affidandosi a Sincro. Sarai il prossimo caso studio?
                                </p>
                            </div>
                            <div className="flex items-center justify-center p-6 bg-white/5 border border-white/10 rounded-2xl flex-shrink-0">
                                <div className="text-center">
                                    <div className="text-4xl font-bold text-white mb-1">98%</div>
                                    <div className="text-xs text-neutral-400 font-medium tracking-wider uppercase">Tasso di Successo</div>
                                </div>
                            </div>
                        </div>
                    </div>

                </div>

                {/* PREPARATION INSTRUCTIONS */}
                <div className="mt-16 pt-16 border-t border-white/5 text-center px-4 animate-in fade-in duration-1000 delay-500">
                    <h3 className="text-xl font-semibold mb-8">Come prepararsi al meglio per la chiamata:</h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-3xl mx-auto">
                        <div className="bg-white/5 border border-white/5 rounded-2xl p-6 relative">
                            <div className="absolute -top-3 -left-3 w-8 h-8 rounded-full bg-blue-500 text-white font-bold flex items-center justify-center border-4 border-[#050505]">1</div>
                            <Users className="w-6 h-6 text-blue-400 mb-3 mx-auto" />
                            <h4 className="font-medium text-white mb-2">Ambiente Silenzioso</h4>
                            <p className="text-sm text-neutral-400">Collegati da una postazione tranquilla dal computer, non dall'auto in corsa.</p>
                        </div>
                        
                        <div className="bg-white/5 border border-white/5 rounded-2xl p-6 relative">
                            <div className="absolute -top-3 -left-3 w-8 h-8 rounded-full bg-blue-500 text-white font-bold flex items-center justify-center border-4 border-[#050505]">2</div>
                            <Video className="w-6 h-6 text-blue-400 mb-3 mx-auto" />
                            <h4 className="font-medium text-white mb-2">Webcam Accesa</h4>
                            <p className="text-sm text-neutral-400">Per garantire la massima connessione umana ed efficacia, ti chiediamo la webcam attiva.</p>
                        </div>

                        <div className="bg-white/5 border border-white/5 rounded-2xl p-6 relative">
                            <div className="absolute -top-3 -left-3 w-8 h-8 rounded-full bg-blue-500 text-white font-bold flex items-center justify-center border-4 border-[#050505]">3</div>
                            <Calendar className="w-6 h-6 text-blue-400 mb-3 mx-auto" />
                            <h4 className="font-medium text-white mb-2">Sii Puntuale</h4>
                            <p className="text-sm text-neutral-400">Il tempo dei nostri Advisor è limitato e sacro. Ti preghiamo di rispettare l'orario.</p>
                        </div>
                    </div>
                </div>

                {/* FINAL CTA TO MAIN SITE OR RESOURCES */}
                <div className="mt-16 text-center pb-8 animate-in fade-in duration-1000 delay-700">
                    <p className="text-neutral-500 mb-6">Non vedi l'ora di iniziare? Nell'attesa puoi scoprire di più su di noi.</p>
                    <Link 
                        href="https://metodosincro.com" 
                        target="_blank"
                        className="inline-flex items-center gap-2 text-blue-400 font-medium hover:text-blue-300 transition-colors"
                    >
                        Torna al sito principale <ArrowRight className="w-4 h-4" />
                    </Link>
                </div>

            </main>
        </div>
    )
}
