
import { AbsoluteFill, useVideoConfig, useCurrentFrame, spring, Audio, Sequence } from 'remotion';
import React, { useMemo } from 'react';

export interface WordTiming {
    word: string;
    startMs: number;
    endMs: number;
    emoji?: string;
    isImpact?: boolean;
}

export interface SincroVideoProps {
    headline: string;
    audioBase64?: string | null;
    words?: WordTiming[];
}

export const SincroVideoTemplate: React.FC<SincroVideoProps> = ({ headline, audioBase64, words }) => {
    const { fps, height, width, durationInFrames } = useVideoConfig();
    const frame = useCurrentFrame();

    // Convert current frame to milliseconds
    const currentMs = (frame / fps) * 1000;

    // Sfondo a zoom lento ciclico (B-Roll temporaneo)
    const zoomCycleMs = 3000;
    const isZoomed = Math.floor(currentMs / zoomCycleMs) % 2 === 1;
    const backgroundScale = spring({
        fps,
        frame: frame % (fps * 3), 
        config: { damping: 100 },
        from: isZoomed ? 1 : 1.1,
        to: isZoomed ? 1.1 : 1,
    });

    // Trova l'oggetto parola attualmente in riproduzione
    const activeWordIndex = useMemo(() => {
        if (!words || words.length === 0) return -1;
        return words.findIndex((w, i) => {
            const nextStart = i < words.length - 1 ? words[i+1].startMs : w.endMs + 500;
            return currentMs >= w.startMs && currentMs < nextStart;
        });
    }, [currentMs, words]);

    const activeWordData = activeWordIndex >= 0 && words ? words[activeWordIndex] : null;

    // Start timing for the current word's spring
    const wordStartFrame = activeWordIndex >= 0 && words ? (words[activeWordIndex].startMs / 1000) * fps : 0;
    
    // Testo Spring
    const wordSpring = spring({
        fps,
        frame: frame - wordStartFrame,
        config: { damping: 12, mass: 0.5, stiffness: 200 },
        from: 0.5,
        to: 1
    });

    // Emoji Spring (molto più esagerata per stile 3D Popup)
    const emojiSpring = spring({
        fps,
        frame: frame - wordStartFrame,
        config: { damping: 10, mass: 1, stiffness: 150 },
        from: 0,
        to: 1
    });

    // Progress bar calculations
    const progressPercent = Math.min(100, Math.max(0, (frame / durationInFrames) * 100));

    return (
        <AbsoluteFill style={{ backgroundColor: '#0B0F19', color: 'white', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
            {/* Audio Sincronizzato (Voice) */}
            {audioBase64 && (
                <Audio src={`data:audio/mp3;base64,${audioBase64}`} />
            )}

            {/* Sfondo Cinematico - Placeholder per B-Roll MP4 */}
            <AbsoluteFill
                style={{
                    backgroundColor: '#1E293B',
                    transform: `scale(${backgroundScale})`,
                    transformOrigin: 'center center',
                    willChange: 'transform',
                    boxShadow: 'inset 0 0 200px rgba(0,0,0,0.8)' // Effetto Vignette per far risaltare il testo
                }}
            />

            {/* Progress Bar stile TikTok (Alta) */}
            <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: 12, backgroundColor: 'rgba(255,255,255,0.2)', zIndex: 100 }}>
                <div style={{ width: `${progressPercent}%`, height: '100%', backgroundColor: '#EAB308', boxShadow: '0 0 10px #EAB308' }} />
            </div>

            {/* Sottotitoli Dinamici (Stile Hormozi) */}
            {words && words.length > 0 ? (
                activeWordData && (
                    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center' }}>
                        
                        {/* Se la parola ha una Emoji (VFX generato da OpenAI) */}
                        {activeWordData.emoji && (
                            <div style={{
                                position: 'absolute',
                                fontSize: 350,
                                opacity: 0.3,
                                transform: `scale(${emojiSpring}) translateY(${-100 + emojiSpring * 20}px)`,
                                filter: 'blur(4px)', // Effetto Profondità 3D dietro il testo
                                zIndex: 1,
                            }}>
                                {activeWordData.emoji}
                            </div>
                        )}

                        <h1
                            style={{
                                fontFamily: 'Inter, sans-serif',
                                fontSize: activeWordData.isImpact ? 110 : 90,
                                fontWeight: '900',
                                textAlign: 'center',
                                textTransform: 'uppercase',
                                color: activeWordData.isImpact ? '#EF4444' : '#EAB308',
                                textShadow: '0 10px 40px rgba(0,0,0,0.9), 0 2px 5px rgba(0,0,0,0.8)',
                                zIndex: 10,
                                padding: '0 40px',
                                position: 'absolute',
                                top: height / 2.5,
                                transform: `scale(${wordSpring}) rotate(${activeWordData.isImpact ? '-3deg' : '0deg'})`,
                            }}
                        >
                            {activeWordData.word.toUpperCase()}
                        </h1>
                    </AbsoluteFill>
                )
            ) : (
                // Fallback testuale
                <h1
                    style={{
                        fontFamily: 'Inter, sans-serif',
                        fontSize: 80,
                        fontWeight: '900',
                        textAlign: 'center',
                        textTransform: 'uppercase',
                        color: '#EAB308',
                        textShadow: '0 10px 30px rgba(0,0,0,0.8)',
                        zIndex: 10,
                        padding: '0 40px',
                        position: 'absolute',
                        top: height / 4,
                    }}
                >
                    {headline}
                </h1>
            )}

            {/* Watermark Metodo Sincro */}
            <div style={{ position: 'absolute', bottom: 100, fontSize: 35, fontWeight: 'bold', letterSpacing: 6, opacity: 0.6 }}>
                METODO SINCRO
            </div>
        </AbsoluteFill>
    );
};
