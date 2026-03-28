
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

export interface VisualAsset {
    type: 'b-roll' | 'newspaper';
    query: string;
    startMs: number;
    endMs: number;
}

export interface SincroVideoProps {
    headline: string;
    audioBase64?: string | null;
    words?: WordTiming[];
    avatarVideoUrl?: string | null;  /* LEVEL 50: Speaker Scontornato */
    visualAssets?: VisualAsset[];    /* Timeline multi-asset */
    iosMessageText?: string | null;  /* LEVEL 100: Pop-up Bolla iMessage in alto a sx */
    enableMoneyVFX?: boolean;        /* MONEY: Toggle pioggia di soldi */
}

import { Video } from 'remotion';
import { DynamicCard3D } from './components/DynamicCard3D';
import { IOSMessageBubble } from './components/IOSMessageBubble';
import { FallingMoney } from './components/FallingMoney';
import { FakeNewspaper } from './components/FakeNewspaper';

export const SincroVideoTemplate: React.FC<SincroVideoProps> = ({ 
    headline, 
    audioBase64, 
    words, 
    avatarVideoUrl, 
    visualAssets = [], 
    iosMessageText,
    enableMoneyVFX = true
}) => {
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
        from: isZoomed ? 1.05 : 1.15,
        to: isZoomed ? 1.15 : 1.05,
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
    
    // Trova il primo momento "Impact" per innescare i widget Messaggi
    const firstImpactIndex = useMemo(() => {
        if (!words) return -1;
        return words.findIndex(w => w.isImpact);
    }, [words]);
    
    const impactStartFrame = firstImpactIndex >= 0 ? (words![firstImpactIndex].startMs / 1000) * fps : -1;

    // Cerca esattamente la parola soldi/fatturato/roas per lanciare la pioggia
    const moneyImpactIndex = useMemo(() => {
        if (!words) return -1;
        return words.findIndex(w => /sol|soldi|fatturat|guadagn|roas|boom/i.test(w.word));
    }, [words]);

    const moneyStartFrame = moneyImpactIndex >= 0 ? (words![moneyImpactIndex].startMs / 1000) * fps : -1;

    // GOD MODE: Earthquake Effect (Camera Shake)
    // Se la parola attuale è ad alto impatto, shakeriamo brutalmente per i primi 8 frames
    const isEarthquake = activeWordData?.isImpact && (frame - wordStartFrame) < 8;
    
    const shakeX = isEarthquake ? (Math.sin(frame * 123.456) * 20) : 0;
    const shakeY = isEarthquake ? (Math.cos(frame * 654.321) * 20) : 0;
    const shakeRotate = isEarthquake ? (Math.sin(frame * 987.654) * 1.5) : 0;
    
    // Scale slightly so borders don't show during shake
    const earthquakeTransform = isEarthquake 
        ? `scale(1.05) translate3d(${shakeX}px, ${shakeY}px, 0) rotate(${shakeRotate}deg)` 
        : 'scale(1)';

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
    const show3DChart = activeWordData?.isImpact && /fatturat|risultat|crescit|roas|metod/i.test(activeWordData.word);

    // Variabili Dinamiche di Stile per agevolare Leggibilità
    const scaleValue = activeWordData?.isImpact ? wordSpring : 1; 
    const rotateValue = activeWordData?.isImpact ? '-2deg' : '0deg';
    const highlightBoxShadow = activeWordData?.isImpact ? '0 0 50px rgba(234, 179, 8, 0.4)' : 'none';
    const highlightBackground = activeWordData?.isImpact ? '#EAB308' : 'transparent';
    const textColor = activeWordData?.isImpact ? '#0B0F19' : '#FFFFFF';
    const textBorderRadius = activeWordData?.isImpact ? '4px 18px 5px 22px' : '0px'; 
    
    // Safe Zone per sottotitoli (Se c'è avatar scendono, se no centro)
    const subtitlesYOffset = avatarVideoUrl ? height / 1.5 : height / 2.2;

    return (
        <AbsoluteFill style={{ backgroundColor: '#000000', color: 'white', overflow: 'hidden' }}>
            <div style={{ width: '100%', height: '100%', transform: earthquakeTransform, transformOrigin: 'center center' }}>
                
                {/* Audio Sincronizzato */}
                {audioBase64 && (
                    <Audio src={`data:audio/mp3;base64,${audioBase64}`} />
                )}

                {/* Z-INDEX 0: BACKGROUND CINEMATICO (Studio, Led, Ambiente fisso) */}
                <AbsoluteFill style={{ zIndex: 0 }}>
                     <AbsoluteFill
                            style={{
                                backgroundColor: '#0B0F19',
                                transform: `scale(${backgroundScale})`,
                                transformOrigin: 'center center',
                                boxShadow: 'inset 0 0 200px rgba(0,0,0,0.9)'
                            }}
                    />
                </AbsoluteFill>

                {/* Z-INDEX 10: PARTICLES & MONEY RAIN & WEBGL EFFETTI */}
                <AbsoluteFill style={{ zIndex: 10 }}>
                    {show3DChart && activeWordData && (
                        <ThreeCanvas width={width} height={height}>
                            <RoasChart3D startFrame={wordStartFrame} />
                        </ThreeCanvas>
                    )}
                    {/* Trigger The Money Rain! */}
                    {enableMoneyVFX && moneyStartFrame !== -1 && (
                         <FallingMoney startFrame={moneyStartFrame} />
                    )}
                </AbsoluteFill>

                {/* Z-INDEX 20: MIDGROUND CARDS (Grafiche, Ragazze, Calciatori che passano "dietro" allo speaker) */}
                <AbsoluteFill style={{ zIndex: 20 }}>
                    {visualAssets.filter(a => a.type === 'b-roll').map((asset, i) => (
                        <DynamicCard3D 
                            key={`broll-${i}`}
                            startFrame={Math.ceil((asset.startMs / 1000) * fps)} 
                            endFrame={Math.ceil((asset.endMs / 1000) * fps)}
                            imageUrl={asset.query.includes('http') ? asset.query : `https://loremflickr.com/600/800/${encodeURIComponent(asset.query)}?lock=${i}`} 
                            rotationOffset={-12 + (i % 2 === 0 ? 5 : -5)} 
                        />
                    ))}
                </AbsoluteFill>

                {/* Z-INDEX 50: FOREGROUND SPEAKER (Avatar isolato o Schermo Intero) */}
                <AbsoluteFill style={{ zIndex: 50, pointerEvents: 'none' }}>
                    {avatarVideoUrl && (
                         <AbsoluteFill>
                             <Video src={avatarVideoUrl} style={{ objectFit: 'cover', width: '100%', height: '100%' }} />
                             <AbsoluteFill style={{ backgroundColor: 'rgba(0,0,0,0.15)' }} /> {/* Overlay leggero */}
                         </AbsoluteFill>
                    )}
                </AbsoluteFill>

                {/* Z-INDEX 100: TYPOGRAPHY, GIORNALI FAKE, BOLLA IOS, PROGRESS BAR */}
                <AbsoluteFill style={{ zIndex: 100, pointerEvents: 'none', alignItems: 'center' }}>
                    
                    {/* Progress Bar stile TikTok */}
                    <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: 12, backgroundColor: 'rgba(255,255,255,0.2)' }}>
                        <div style={{ width: `${progressPercent}%`, height: '100%', backgroundColor: '#EAB308', boxShadow: '0 0 10px #EAB308' }} />
                    </div>

                    {/* Bolla iMessage finta che spawna quando trova impactWord */}
                    {impactStartFrame !== -1 && iosMessageText && (
                        // Lo facciamo partire 5 frame prima del botto, per dare dinamismo
                        <IOSMessageBubble startFrame={impactStartFrame - 5} text={iosMessageText} />
                    )}

                    {/* Finto Articolo Forbes Breaking News Multipli */}
                    {visualAssets.filter(a => a.type === 'newspaper').map((asset, i) => (
                        <FakeNewspaper 
                            key={`news-${i}`}
                            startFrame={Math.ceil((asset.startMs / 1000) * fps)} 
                            endFrame={Math.ceil((asset.endMs / 1000) * fps)}
                            headline={asset.query} 
                        />
                    ))}

                    {/* Modulo Sottotitoli Sicuri */}
                    {words && words.length > 0 ? (
                        activeWordData && (
                            <div style={{
                                position: 'absolute',
                                top: subtitlesYOffset,
                                width: '100%',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                            }}>
                                
                                {/* Area Emoji */}
                                {!show3DChart && activeWordData.isImpact && activeWordData.emoji && (
                                    <div style={{
                                        position: 'absolute',
                                        top: -160,
                                        fontSize: 150,
                                        transform: `scale(${emojiSpring}) translateY(${-10 + emojiSpring * 10}px)`,
                                        filter: 'drop-shadow(0px 8px 12px rgba(0,0,0,0.6))'
                                    }}>
                                        {activeWordData.emoji}
                                    </div>
                                )}

                                {/* Box Testo */}
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
                                padding: '0 40px',
                                position: 'absolute',
                                top: subtitlesYOffset,
                            }}
                        >
                            {headline}
                        </h1>
                    )}

                    {/* Watermark Metodo Sincro */}
                    <div style={{ position: 'absolute', bottom: 100, fontSize: 35, fontWeight: 'bold', letterSpacing: 6, opacity: 0.5 }}>
                        METODO SINCRO
                    </div>

                </AbsoluteFill>
            </div>
        </AbsoluteFill>
    );
};
