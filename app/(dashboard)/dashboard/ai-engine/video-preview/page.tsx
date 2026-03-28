"use client"

import dynamic from 'next/dynamic';
import { useState } from 'react';

// Import the player dynamically to disable SSR and prevent hydration issues on Vercel
const VideoPlayerClient = dynamic(() => import('./VideoPlayerClient'), { ssr: false });

export default function VideoPreviewPage() {
    const [headline, setHeadline] = useState("Sblocca il tuo vero potenziale con il Metodo Sincro. Stai ancora aspettando o agisci?");
    const [audioBase64, setAudioBase64] = useState<string | null>(null);
    const [words, setWords] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleGenerate = async () => {
        if (!headline.trim()) return;
        
        // Verifica Cache Locale
        const cacheKey = `sincro_tts_cache_${headline.trim()}`;
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
            try {
                const parsed = JSON.parse(cached);
                setAudioBase64(parsed.audioBase64);
                setWords(parsed.words);
                return;
            } catch (e) {
                console.warn('Cache invalida, rigenero audio.');
            }
        }

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
                // Salva in cache
                localStorage.setItem(cacheKey, JSON.stringify({
                    audioBase64: data.audioBase64,
                    words: data.words
                }));
            } else {
                setError(data.error || "Errore sconosciuto da ElevenLabs");
            }
        } catch (err) {
            setError("Si è verificato un errore di rete");
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex flex-col md:flex-row gap-12 w-full max-w-6xl mx-auto items-start p-8">
            <div className="w-full max-w-md text-left self-start text-zinc-300">
                <h1 className="text-2xl font-bold text-white mb-2">Video Rendering Preview (Beta)</h1>
                <p className="text-sm">
                    Questo è il player in tempo reale di <strong>Remotion</strong>. Digita il tuo copione o la tua Ad qui sotto e l'AI genererà la voce con ElevenLabs, sincronizzando matematicamente le parole in stile Hormozi.
                </p>

                <div className="mt-8 flex flex-col gap-3">
                    <label className="text-xs uppercase tracking-widest font-bold text-zinc-500">Script dell'Ad</label>
                    <textarea 
                        rows={4}
                        value={headline} 
                        onChange={(e) => setHeadline(e.target.value)} 
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-white font-mono text-sm focus:border-purple-500 outline-none transition-colors"
                        placeholder="Es. Questo è il segreto numero 1 per scalare il tuo business..."
                    />
                    
                    <button 
                        onClick={handleGenerate}
                        disabled={loading || !headline.trim()}
                        className="btn-primary mt-2 flex justify-center items-center gap-2 py-3"
                        style={{ background: 'rgba(168, 85, 247, 0.15)', border: '1px solid rgba(168, 85, 247, 0.4)', color: '#a855f7' }}
                    >
                        {loading ? 'Generazione & Sync in corso...' : '🎙️ Genera Audio & Sincronizza'}
                    </button>

                    {error && (
                        <div className="text-xs text-red-400 mt-2 bg-red-500/10 p-2 rounded border border-red-500/20">
                            {error}
                        </div>
                    )}
                </div>
            </div>

            <div className="w-full max-w-sm min-h-[600px] flex items-center justify-center rounded-xl overflow-hidden shadow-2xl shadow-green-900/20 bg-black/50 border border-zinc-800 shrink-0 relative">
                <VideoPlayerClient headline={headline} audioBase64={audioBase64} words={words} />
                
                {(!words || words.length === 0) && !loading && (
                    <div className="absolute inset-0 bg-black/80 flex items-center justify-center pointer-events-none z-20">
                        <div className="text-center p-4">
                            <div className="text-zinc-500 text-sm font-semibold mb-2">Editor Pronto</div>
                            <div className="text-xs text-zinc-600">Scrivi lo script e clicca su "Genera" per popolare la timeline video con audio e sottotitoli.</div>
                        </div>
                    </div>
                )}
            </div>
            
        </div>
    );
}
