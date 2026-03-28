
import { AbsoluteFill, useVideoConfig, useCurrentFrame, spring, Audio } from 'remotion';
import React, { useMemo } from 'react';
import { ThreeCanvas } from '@remotion/three';
import { RoasChart3D } from './components/RoasChart3D';

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
    avatarVideoUrl?: string | null;
}

import { Video } from 'remotion';

export const SincroVideoTemplate: React.FC<SincroVideoProps> = ({ headline, audioBase64, words, avatarVideoUrl }) => {
    const { fps, height, width, durationInFrames } = useVideoConfig();
    const frame = useCurrentFrame();

    // Convert current frame to milliseconds
    const currentMs = (frame / fps) * 1000;

    // Sfondo a zoom lento ciclico (B-Roll temporaneo se non c'è avatar)
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
    
    // Testo Spring (Ora usato SOLO per l'Impact Word)
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

    // Capire se renderizzare un grafico 3D al posto dell'emoji
    const show3DChart = activeWordData?.isImpact && /fatturat|risultat|crescit|soldi|roas|metod/i.test(activeWordData.word);

    // Variabili Dinamiche di Stile per agevolare Leggibilità
    const scaleValue = activeWordData?.isImpact ? wordSpring : 1; 
    const rotateValue = activeWordData?.isImpact ? '-2deg' : '0deg';
    const highlightBoxShadow = activeWordData?.isImpact ? '0 0 50px rgba(234, 179, 8, 0.4)' : 'none';
    const highlightBackground = activeWordData?.isImpact ? '#EAB308' : 'transparent';
    const textColor = activeWordData?.isImpact ? '#0B0F19' : '#FFFFFF';
    const textBorderRadius = activeWordData?.isImpact ? '4px 18px 5px 22px' : '0px'; // Effetto pennellata evidenziatore
    
    // Safe Zone (dove si posizionano i sottotitoli in modo da non coprire la faccia)
    const subtitlesYOffset = height / 1.6;

    return (
        <AbsoluteFill style={{ backgroundColor: '#0B0F19', color: 'white', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
            {/* Audio Sincronizzato (Voice) */}
            {audioBase64 && (
                <Audio src={`data:audio/mp3;base64,${audioBase64}`} />
            )}

            {/* Sfondo Livello 0: O video personale MP4, O Sfondo cinematico scuro */}
            {avatarVideoUrl ? (
                <AbsoluteFill>
                    <Video src={avatarVideoUrl} style={{ objectFit: 'cover', width: '100%', height: '100%' }} />
                    <AbsoluteFill style={{ backgroundColor: 'rgba(0,0,0,0.2)' }} /> {/* Overlay per leggibilità del testo */}
                </AbsoluteFill>
            ) : (
                <AbsoluteFill
                    style={{
                        backgroundColor: '#1E293B',
                        transform: `scale(${backgroundScale})`,
                        transformOrigin: 'center center',
                        willChange: 'transform',
                        boxShadow: 'inset 0 0 200px rgba(0,0,0,0.8)' // Effetto Vignette
                    }}
                />
            )}

            {/* Progress Bar stile TikTok (Alta) */}
            <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: 12, backgroundColor: 'rgba(255,255,255,0.2)', zIndex: 100 }}>
                <div style={{ width: `${progressPercent}%`, height: '100%', backgroundColor: '#EAB308', boxShadow: '0 0 10px #EAB308' }} />
            </div>

            {/* Livello WebGL: Infografiche 3D (Se esplode) */}
            {show3DChart && activeWordData && (
                <AbsoluteFill style={{ zIndex: 1 }}>
                    <ThreeCanvas width={width} height={height}>
                        <RoasChart3D startFrame={wordStartFrame} />
                    </ThreeCanvas>
                </AbsoluteFill>
            )}

            {/* Modulo Sottotitoli Dinamici e Sicuri (Safe Zone) */}
            {words && words.length > 0 ? (
                activeWordData && (
                    <div style={{
                        position: 'absolute',
                        top: subtitlesYOffset,
                        width: '100%',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        zIndex: 10,
                    }}>
                        
                        {/* Area Emoji Fissa e Non-Sovrapposta (Posizionata sopra il box del testo) */}
                        {!show3DChart && activeWordData.isImpact && activeWordData.emoji && (
                             <div style={{
                                position: 'absolute',
                                top: -170, // Mai toccare il testo!
                                fontSize: 150,
                                transform: `scale(${emojiSpring}) translateY(${-10 + emojiSpring * 10}px)`,
                                zIndex: 11,
                                filter: 'drop-shadow(0px 8px 12px rgba(0,0,0,0.6))'
                            }}>
                                {activeWordData.emoji}
                            </div>
                        )}

                        {/* Box Testo (Evidenziatore Brush) */}
                        <div style={{
                            backgroundColor: highlightBackground,
                            padding: activeWordData.isImpact ? '10px 35px' : '0px 40px',
                            borderRadius: textBorderRadius,
                            boxShadow: highlightBoxShadow,
                            transform: `scale(${scaleValue}) rotate(${rotateValue})`,
                            transition: 'all 0.1s ease-out',
                        }}>
                            <h1
                                style={{
                                    fontFamily: 'Inter, sans-serif',
                                    fontSize: activeWordData.isImpact ? 100 : 85,
                                    fontWeight: '900',
                                    textAlign: 'center',
                                    textTransform: 'uppercase',
                                    color: textColor,
                                    textShadow: activeWordData.isImpact ? 'none' : '0 10px 40px rgba(0,0,0,0.9), 0 2px 5px rgba(0,0,0,0.8)',
                                    margin: 0,
                                    letterSpacing: '-1px'
                                }}
                            >
                                {activeWordData.word.toUpperCase()}
                            </h1>
                        </div>
                    </div>
                )
            ) : (
                // Fallback testuale se manca l'audio
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
                        top: subtitlesYOffset,
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
