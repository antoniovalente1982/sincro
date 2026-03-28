
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
    variant?: string;
    position?: string;
    imageUrl?: string; // URL immagine generata da Nano Banana
}

export interface SincroVideoProps {
    headline: string;
    audioBase64?: string | null;
    words?: WordTiming[];
    avatarVideoUrl?: string | null;
    visualAssets?: VisualAsset[];
    iosMessageText?: string | null;
    enableMoneyVFX?: boolean;
    backgroundMood?: 'warm-studio' | 'cold-blue' | 'purple-haze';
}

import { Video } from 'remotion';
import { DynamicCard3D } from './components/DynamicCard3D';
import { IOSMessageBubble } from './components/IOSMessageBubble';
import { FallingMoney } from './components/FallingMoney';
import { FakeNewspaper } from './components/FakeNewspaper';
import { BlockSubtitles } from './components/BlockSubtitles';
import { CinematicBackground } from './components/CinematicBackground';

export const SincroVideoTemplate: React.FC<SincroVideoProps> = ({ 
    headline, 
    audioBase64, 
    words, 
    avatarVideoUrl, 
    visualAssets = [], 
    iosMessageText,
    enableMoneyVFX = true,
    backgroundMood = 'warm-studio',
}) => {
    const { fps, height, width, durationInFrames } = useVideoConfig();
    const frame = useCurrentFrame();
    const currentMs = (frame / fps) * 1000;

    // Trova la parola attiva per gli effetti "Earthquake"
    const activeWordIndex = useMemo(() => {
        if (!words || words.length === 0) return -1;
        return words.findIndex((w, i) => {
            const nextStart = i < words.length - 1 ? words[i+1].startMs : w.endMs + 500;
            return currentMs >= w.startMs && currentMs < nextStart;
        });
    }, [currentMs, words]);

    const activeWordData = activeWordIndex >= 0 && words ? words[activeWordIndex] : null;
    const wordStartFrame = activeWordIndex >= 0 && words ? (words[activeWordIndex].startMs / 1000) * fps : 0;
    
    // Primo impact per iMessage
    const firstImpactIndex = useMemo(() => {
        if (!words) return -1;
        return words.findIndex(w => w.isImpact);
    }, [words]);
    const impactStartFrame = firstImpactIndex >= 0 ? (words![firstImpactIndex].startMs / 1000) * fps : -1;

    // Money trigger
    const moneyImpactIndex = useMemo(() => {
        if (!words) return -1;
        return words.findIndex(w => /sol|soldi|fatturat|guadagn|roas|boom|euro/i.test(w.word));
    }, [words]);
    const moneyStartFrame = moneyImpactIndex >= 0 ? (words![moneyImpactIndex].startMs / 1000) * fps : -1;

    // EARTHQUAKE (Camera Shake) su parole impact
    const isEarthquake = activeWordData?.isImpact && (frame - wordStartFrame) < 8;
    const shakeX = isEarthquake ? (Math.sin(frame * 123.456) * 15) : 0;
    const shakeY = isEarthquake ? (Math.cos(frame * 654.321) * 15) : 0;
    const shakeRotate = isEarthquake ? (Math.sin(frame * 987.654) * 1.2) : 0;
    const earthquakeTransform = isEarthquake 
        ? `scale(1.04) translate3d(${shakeX}px, ${shakeY}px, 0) rotate(${shakeRotate}deg)` 
        : 'scale(1)';

    // 3D Chart trigger
    const show3DChart = activeWordData?.isImpact && /fatturat|risultat|crescit|roas|metod/i.test(activeWordData.word);

    // Progress bar
    const progressPercent = Math.min(100, Math.max(0, (frame / durationInFrames) * 100));

    // Immagini fallback per b-roll
    const fallbackImages = [
        '/images/calciatori/Matteo Brunori (Sampdoria).png',
        '/images/calciatori/Patrick Cutrone (Monza).png',
        '/images/calciatori/Barbara Bonansea (Juventus).png',
        '/images/calciatori/Francesca Durante (Lazio).png',
    ];

    return (
        <AbsoluteFill style={{ backgroundColor: '#000000', color: 'white', overflow: 'hidden' }}>
            <div style={{ width: '100%', height: '100%', transform: earthquakeTransform, transformOrigin: 'center center' }}>
                
                {/* Audio */}
                {audioBase64 && (
                    <Audio src={`data:audio/mp3;base64,${audioBase64}`} volume={avatarVideoUrl ? 0 : 1} />
                )}

                {/* ═══ Z-0: SFONDO CINEMATICO ═══ */}
                <AbsoluteFill style={{ zIndex: 0 }}>
                    <CinematicBackground mood={backgroundMood} />
                </AbsoluteFill>

                {/* ═══ Z-10: PARTICLES & WEBGL ═══ */}
                <AbsoluteFill style={{ zIndex: 10 }}>
                    {show3DChart && activeWordData && (
                        <ThreeCanvas width={width} height={height}>
                            <RoasChart3D startFrame={wordStartFrame} />
                        </ThreeCanvas>
                    )}
                    {enableMoneyVFX && moneyStartFrame !== -1 && (
                         <FallingMoney startFrame={moneyStartFrame} />
                    )}
                </AbsoluteFill>

                {/* ═══ Z-50: AVATAR SPEAKER ═══ */}
                <AbsoluteFill style={{ zIndex: 50, pointerEvents: 'none' }}>
                    {avatarVideoUrl && (
                         <AbsoluteFill>
                             <Video 
                                src={avatarVideoUrl} 
                                style={{ objectFit: 'cover', width: '100%', height: '100%' }} 
                             />
                         </AbsoluteFill>
                    )}
                </AbsoluteFill>

                {/* ═══ Z-200: CARDS & NEWSPAPER (OVERLAY SOPRA SPEAKER) ═══ */}
                <AbsoluteFill style={{ zIndex: 200, pointerEvents: 'none' }}>
                    {/* B-Roll Cards con varianti */}
                    {visualAssets.filter(a => a.type === 'b-roll').map((asset, i) => {
                        const imgUrl = asset.imageUrl 
                            || (asset.query.includes('http') ? asset.query : fallbackImages[i % fallbackImages.length]);
                        
                        return (
                            <DynamicCard3D 
                                key={`broll-${i}`}
                                startFrame={Math.ceil((asset.startMs / 1000) * fps)} 
                                endFrame={Math.ceil((asset.endMs / 1000) * fps)}
                                imageUrl={imgUrl} 
                                variant={(asset.variant as any) || (['slide-right', 'slide-left', 'scale-up', 'rotate-in'][i % 4])}
                                position={(asset.position as any) || (['top-right', 'top-left', 'center', 'bottom-right'][i % 4])}
                                rotationOffset={-12 + (i % 2 === 0 ? 5 : -5)} 
                            />
                        );
                    })}

                    {/* Newspaper */}
                    {visualAssets.filter(a => a.type === 'newspaper').map((asset, i) => (
                        <FakeNewspaper 
                            key={`news-${i}`}
                            startFrame={Math.ceil((asset.startMs / 1000) * fps)} 
                            endFrame={Math.ceil((asset.endMs / 1000) * fps)}
                            headline={asset.query} 
                        />
                    ))}
                </AbsoluteFill>

                {/* ═══ Z-300: TYPOGRAPHY, BOLLA IOS, PROGRESS BAR ═══ */}
                <AbsoluteFill style={{ zIndex: 300, pointerEvents: 'none', alignItems: 'center' }}>
                    
                    {/* Progress Bar TikTok */}
                    <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: 10, backgroundColor: 'rgba(255,255,255,0.15)' }}>
                        <div style={{ 
                            width: `${progressPercent}%`, 
                            height: '100%', 
                            background: 'linear-gradient(90deg, #EAB308, #F59E0B)',
                            boxShadow: '0 0 12px rgba(234, 179, 8, 0.6)',
                        }} />
                    </div>

                    {/* Bolla iMessage */}
                    {impactStartFrame !== -1 && iosMessageText && (
                        <IOSMessageBubble startFrame={impactStartFrame - 5} text={iosMessageText} />
                    )}

                    {/* ★★★ BLOCK SUBTITLES (Nuovo!) ★★★ */}
                    {words && words.length > 0 ? (
                        <BlockSubtitles 
                            words={words} 
                            wordsPerBlock={3}
                            yPosition={avatarVideoUrl ? 350 : 500}
                        />
                    ) : (
                        <h1 style={{
                            fontFamily: 'Inter, sans-serif',
                            fontSize: 80,
                            fontWeight: 900,
                            textAlign: 'center',
                            textTransform: 'uppercase',
                            color: '#EAB308',
                            textShadow: '0 10px 30px rgba(0,0,0,0.8)',
                            padding: '0 40px',
                            position: 'absolute',
                            bottom: 500,
                        }}>
                            {headline}
                        </h1>
                    )}

                    {/* Watermark */}
                    <div style={{ 
                        position: 'absolute', 
                        bottom: 80, 
                        fontSize: 28, 
                        fontWeight: 800, 
                        letterSpacing: 8, 
                        opacity: 0.35,
                        fontFamily: 'Inter, sans-serif',
                    }}>
                        METODO SINCRO
                    </div>
                </AbsoluteFill>
            </div>
        </AbsoluteFill>
    );
};
