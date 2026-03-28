"use client"

import dynamic from 'next/dynamic';
import { useState } from 'react';

// Import the player dynamically to disable SSR and prevent hydration issues on Vercel
const VideoPlayerClient = dynamic(() => import('./VideoPlayerClient'), { ssr: false });

export default function VideoPreviewPage() {
    const [headline, setHeadline] = useState("SBLOCCA IL SUO VERO POTENZIALE");

    return (
        <div className="flex flex-col md:flex-row gap-12 w-full max-w-6xl mx-auto items-start p-8">
            <div className="w-full max-w-md text-left self-start text-zinc-300">
                <h1 className="text-2xl font-bold text-white mb-2">Video Rendering Preview (Beta)</h1>
                <p className="text-sm">
                    Questo è il player in tempo reale di <strong>Remotion</strong>. Non stiamo montando un video su un server terzo: il codice sorgente React di questa pagina sta <em>calcolando matematicamente</em> i frame (lo zoom in/out e i pop-up visivi) usando la potenza della tua CPU.
                </p>

                <div className="mt-8 flex flex-col gap-2">
                    <label className="text-xs uppercase tracking-widest font-bold text-zinc-500">Live Headline Edit</label>
                    <input 
                        type="text" 
                        value={headline} 
                        onChange={(e) => setHeadline(e.target.value)} 
                        className="w-full bg-zinc-900 border border-zinc-800 rounded p-3 text-white font-mono"
                    />
                </div>
            </div>

            <div className="w-full max-w-sm min-h-[600px] flex items-center justify-center rounded-xl overflow-hidden shadow-2xl shadow-green-900/20 bg-black/50 border border-zinc-800 shrink-0">
                <VideoPlayerClient headline={headline} />
            </div>
            
        </div>
    );
}
