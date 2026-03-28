"use client"

import dynamic from 'next/dynamic';
import { useState } from 'react';
import { Video, Smartphone, Image as ImageIcon, Zap, Upload } from 'lucide-react';

// Import the player dynamically to disable SSR and prevent hydration issues on Vercel
const VideoPlayerClient = dynamic(() => import('./VideoPlayerClient'), { ssr: false });

export default function VideoPreviewPage() {
    const [headline, setHeadline] = useState("Sblocca il tuo vero potenziale con il Metodo Sincro. Stai ancora aspettando o agisci?");
    const [audioBase64, setAudioBase64] = useState<string | null>(null);
    const [words, setWords] = useState<any[]>([]);
    const [visualAssets, setVisualAssets] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // VFX States
    const [messageText, setMessageText] = useState("Sta scrivendo...");
    const [useMoneyRain, setUseMoneyRain] = useState(true);
    const [avatarVideoUrl, setAvatarVideoUrl] = useState("");
    const [backgroundMood, setBackgroundMood] = useState<string>('warm-studio');
    
    // HeyGen Polling State
    const [heygenStatus, setHeygenStatus] = useState<string | null>(null);

    const handleGenerate = async () => {
        if (!headline.trim()) return;
        
        const cacheKey = `sincro_tts_cache_v3_${headline.trim()}`;
        const cached = localStorage.getItem(cacheKey);
        
        let shouldFetch = true;
        if (cached) {
            try {
                const parsed = JSON.parse(cached);
                setAudioBase64(parsed.audioBase64);
                setWords(parsed.words);
                if (parsed.visualAssets) setVisualAssets(parsed.visualAssets);
                shouldFetch = false;
            } catch (e) {
                console.warn('Cache invalida, rigenero audio.');
            }
        }

        if (shouldFetch) {
            setLoading(true);
            setError(null);
            try {
                const res = await fetch('/api/ai-engine/generate-video-audio', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ text: headline })
                });
                const data = await res.json();
                
                if (res.ok && data.audioBase64) {
                    setAudioBase64(data.audioBase64);
                    setWords(data.words);
                    setVisualAssets(data.visualAssets || []);
                    if (data.backgroundMood) setBackgroundMood(data.backgroundMood);

                    localStorage.setItem(cacheKey, JSON.stringify({
                        audioBase64: data.audioBase64,
                        words: data.words,
                        visualAssets: data.visualAssets
                    }));
                } else {
                    setError(data.error || "Errore sconosciuto da ElevenLabs");
                }
            } catch (err) {
                setError("Si è verificato un errore di rete");
            } finally {
                setLoading(false);
            }
        }
    };

    const handleGenerateAvatar = async () => {
        if (!headline.trim()) return;
        setHeygenStatus("Avvio generazione su HeyGen...");
        setError(null);

        try {
            // 1. Invia il job ad HeyGen passando testo e audio
            const res = await fetch('/api/heygen/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: headline, audioBase64: audioBase64 })
            });

            const data = await res.json();
            if (!res.ok || !data.video_id) {
                setError((data.error || "Errore HeyGen") + (data.details ? ` - Dettagli: ${data.details}` : ""));
                setHeygenStatus(null);
                return;
            }

            const videoId = data.video_id;
            setHeygenStatus(`In Rendering 3D... (ID: ${videoId.slice(0, 8)}) - Può richiedere minuti`);

            const checkStatus = async () => {
                try {
                    const statusRes = await fetch(`/api/heygen/status?video_id=${videoId}`);
                    const statusData = await statusRes.json();

                    if (statusData.status === "completed") {
                        setAvatarVideoUrl(statusData.video_url);
                        setHeygenStatus(null);
                    } else if (statusData.status === "failed") {
                        let errDetails = statusData.error ? JSON.stringify(statusData.error) : "";
                        setError(`Ops, la renderizzazione su HeyGen è fallita. ${errDetails}`);
                        setHeygenStatus(null);
                    } else {
                        setTimeout(checkStatus, 10000); // Riprova tra 10s
                    }
                } catch (e) {
                    setError("Interruzione del polling");
                    setHeygenStatus(null);
                }
            };

            setTimeout(checkStatus, 10000);

        } catch(err) {
            setError("HeyGen API non raggiungibile.");
            setHeygenStatus(null);
        }
    };

    return (
        <div className="flex flex-col md:flex-row gap-8 w-full max-w-7xl mx-auto items-start p-8">
            <div className="w-full max-w-lg text-left self-start text-zinc-300">
                <h1 className="text-2xl font-bold text-white mb-2">Editor Video (Hormozi 3.0)</h1>
                <p className="text-sm text-zinc-400 mb-6">
                    L'AI creerà l'audio, calcolerà il tracking visivo e inventerà il <strong>Contesto Grafico Multi-Clip</strong> per i Widget.
                </p>

                <div className="space-y-6">
                    {/* SCRIPT */}
                    <div>
                        <label className="text-xs uppercase tracking-widest font-bold text-zinc-500 mb-2 block">1. Script dell'Ad</label>
                        <textarea 
                            rows={3}
                            value={headline} 
                            onChange={(e) => setHeadline(e.target.value)} 
                            className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-white font-mono text-sm focus:border-purple-500 outline-none transition-colors"
                            placeholder="Es. Sblocca il tuo potenziale..."
                        />
                    </div>

                    <button 
                        onClick={handleGenerate}
                        disabled={loading || !headline.trim()}
                        className="btn-primary w-full flex justify-center items-center gap-2 py-4 shadow-lg tracking-widest uppercase text-xs font-bold"
                        style={{ background: 'linear-gradient(135deg, #a855f7 0%, #7e22ce 100%)' }}
                    >
                        {loading ? 'Generazione Regia AI in corso...' : '1. Genera Audio NLP e Timeline Visiva'}
                    </button>

                    {/* AVATAR AUTOPILOT */}
                    <div className="bg-zinc-900/80 p-5 rounded-xl border border-indigo-900/50 relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 to-cyan-400"></div>
                        <label className="text-xs uppercase tracking-widest font-bold text-indigo-400 mb-2 flex items-center gap-2">
                            <Upload className="w-4 h-4" /> 2. Autopilot Avatar (HeyGen)
                        </label>
                        <p className="text-[11px] text-zinc-400 mb-4 leading-relaxed">
                            Avvia il motore HeyGen API con il tuo clone (ID Ambiente). Impiegherà alcuni minuti per renderizzarlo e caricarlo automaticamente in Player per l'esportazione.
                        </p>
                        
                        <div className="flex gap-2">
                            <input 
                                type="text"
                                value={avatarVideoUrl}
                                onChange={e => setAvatarVideoUrl(e.target.value)}
                                className="w-full bg-black border border-zinc-800 rounded-lg p-3 text-white text-xs opacity-50"
                                placeholder="Auto-completato da HeyGen o URL manuale (Z-Index: 50)"
                            />
                            <button 
                                onClick={handleGenerateAvatar}
                                disabled={heygenStatus !== null}
                                className="bg-indigo-600 hover:bg-indigo-500 transition-colors text-white text-xs font-bold px-4 rounded-lg flex-shrink-0"
                            >
                                Genera Avatar
                            </button>
                        </div>
                        {heygenStatus && (
                            <div className="mt-3 text-xs text-indigo-300 flex items-center gap-2 bg-indigo-900/30 p-2 rounded">
                                <span className="animate-pulse w-2 h-2 rounded-full bg-indigo-400"></span> {heygenStatus}
                            </div>
                        )}
                    </div>

                    {/* HORMOZI VFX INFO */}
                    <div className="bg-zinc-900 overflow-hidden rounded-xl border border-yellow-900/30">
                        <div className="bg-yellow-900/20 p-3 border-b border-yellow-900/40 font-semibold text-yellow-500 text-sm flex items-center gap-2">
                            <Video className="w-4 h-4"/> 3. Status Timeline AI Visiva
                        </div>
                        <div className="p-4 space-y-4">
                            <div className="grid grid-cols-2 gap-3">
                                <label className="flex items-center gap-2 cursor-pointer bg-black/40 p-2 rounded-lg border border-zinc-800">
                                    <input type="checkbox" checked={useMoneyRain} onChange={e => setUseMoneyRain(e.target.checked)} className="rounded accent-green-500" />
                                    <span className="text-xs font-semibold text-white">💸 Pioggia Soldi (Z=10)</span>
                                </label>
                                
                                <div>
                                    <label className="text-xs font-bold text-zinc-300 mb-1 block">📱 Messaggio iMessage</label>
                                    <input 
                                        type="text" value={messageText} onChange={e => setMessageText(e.target.value)}
                                        className="w-full bg-black border border-zinc-800 rounded-lg p-2 text-xs text-white"
                                    />
                                </div>
                            </div>
                            
                            <div>
                                <label className="text-xs font-bold text-zinc-500 mb-2 block uppercase">Grafiche Schedulate dall'AI Array</label>
                                {visualAssets.length === 0 ? (
                                    <span className="text-xs text-zinc-600">Nessun asset generato. Clicca il tasto sopra.</span>
                                ) : (
                                    <div className="space-y-2">
                                        {visualAssets.map((asset, i) => (
                                            <div key={i} className="bg-black/40 border border-zinc-800 p-2 rounded flex justify-between text-xs">
                                                <span className="text-white capitalize">{asset.type}</span>
                                                <span className="text-yellow-500 truncate mx-2 max-w-[150px]">{asset.query}</span>
                                                <span className="text-zinc-500">{asset.startMs}ms - {asset.endMs}ms</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {error && (
                        <div className="text-xs text-red-400 mt-2 bg-red-500/10 p-3 rounded border border-red-500/20">
                            {error}
                        </div>
                    )}
                </div>
            </div>

            <div className="w-full max-w-sm sticky top-8 min-h-[600px] flex items-center justify-center rounded-2xl overflow-hidden shadow-2xl shadow-purple-900/10 bg-black/50 border border-zinc-800 shrink-0 relative">
                <VideoPlayerClient 
                    headline={headline} 
                    audioBase64={audioBase64} 
                    words={words}
                    messageText={messageText}
                    useMoney={useMoneyRain}
                    visualAssets={visualAssets}
                    avatarVideoUrl={avatarVideoUrl}
                    backgroundMood={backgroundMood}
                />
                
                {(!words || words.length === 0) && !loading && (
                    <div className="absolute inset-0 bg-black/80 flex items-center justify-center pointer-events-none z-20">
                        <div className="text-center p-6">
                            <div className="w-12 h-12 bg-purple-900/30 rounded-full flex items-center justify-center mx-auto mb-3">
                                <Zap className="w-6 h-6 text-purple-400" />
                            </div>
                            <div className="text-zinc-300 text-sm font-semibold mb-2">Il Renderizzatore è In Attesa</div>
                            <div className="text-xs text-zinc-500">Compila i dati a sinistra e genera per sbloccare l'ambiente 3D.</div>
                        </div>
                    </div>
                )}
            </div>
            
        </div>
    );
}
