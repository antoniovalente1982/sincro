
import { AbsoluteFill, useVideoConfig, useCurrentFrame, spring, Audio, staticFile } from 'remotion';
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
    type: 'b-roll' | 'newspaper' | 'giant-text' | 'cta' | 'swipe-card' | 'emoji-reaction' | 'counter';
    query: string;
    startMs: number;
    endMs: number;
    variant?: string;
    position?: string;
    imageUrl?: string;
    // Props extra per nuovi componenti
    line2?: string;
    highlightWord?: string;
    textStyle?: string;
    color?: string;
    toValue?: number;
    emojis?: string[];
    intensity?: string;
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
    enableZoomPulse?: boolean;
    subtitleStyle?: 'tiktok' | 'impact' | 'karaoke';
}

import { Video } from 'remotion';
import { DynamicCard3D } from './components/DynamicCard3D';
import { IOSMessageBubble } from './components/IOSMessageBubble';
import { FallingMoney } from './components/FallingMoney';
import { FakeNewspaper } from './components/FakeNewspaper';
import { BlockSubtitles } from './components/BlockSubtitles';
import { CinematicBackground } from './components/CinematicBackground';
// ★★★ NUOVI COMPONENTI VFX 5.0 ★★★
import { GiantImpactText } from './components/GiantImpactText';
import { CTAButton } from './components/CTAButton';
import { SwipeCard } from './components/SwipeCard';
import { EmojiReaction } from './components/EmojiReaction';
import { ZoomPulse } from './components/ZoomPulse';
import { CounterAnimation } from './components/CounterAnimation';

export const SincroVideoTemplate: React.FC<SincroVideoProps> = ({ 
    headline, 
    audioBase64, 
    words, 
    avatarVideoUrl, 
    visualAssets = [], 
    iosMessageText,
    enableMoneyVFX = true,
    backgroundMood = 'warm-studio',
    enableZoomPulse = true,
    subtitleStyle = 'impact',
}) => {
    const { fps, height, width, durationInFrames } = useVideoConfig();
    const frame = useCurrentFrame();
    const currentMs = (frame / fps) * 1000;

    // Trova la parola attiva
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
    const impactStartFrame = useMemo(() => {
        if (!words) return -1;
        const idx = words.findIndex(w => w.isImpact);
        return idx >= 0 ? (words[idx].startMs / 1000) * fps : -1;
    }, [words, fps]);

    // Money trigger
    const moneyStartFrame = useMemo(() => {
        if (!words) return -1;
        const idx = words.findIndex(w => /sol|soldi|fatturat|guadagn|roas|boom|euro/i.test(w.word));
        return idx >= 0 ? (words[idx].startMs / 1000) * fps : -1;
    }, [words, fps]);

    // ZoomPulse trigger frames (su parole isImpact)
    const zoomTriggerFrames = useMemo(() => {
        if (!words) return [];
        return words
            .filter(w => w.isImpact)
            .map(w => Math.round((w.startMs / 1000) * fps));
    }, [words, fps]);

    // EARTHQUAKE
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

    // Immagini fallback
    const fallbackImages = [
        staticFile('images/calciatori/Matteo Brunori (Sampdoria).png'),
        staticFile('images/calciatori/Patrick Cutrone (Monza).png'),
        staticFile('images/calciatori/Barbara Bonansea (Juventus).png'),
        staticFile('images/calciatori/Francesca Durante (Lazio).png'),
    ];

    // ═══ FILTRI ASSET BY TYPE ═══
    const brollAssets = visualAssets.filter(a => a.type === 'b-roll');
    const newspaperAssets = visualAssets.filter(a => a.type === 'newspaper');
    const giantTextAssets = visualAssets.filter(a => a.type === 'giant-text');
    const ctaAssets = visualAssets.filter(a => a.type === 'cta');
    const swipeCardAssets = visualAssets.filter(a => a.type === 'swipe-card');
    const emojiAssets = visualAssets.filter(a => a.type === 'emoji-reaction');
    const counterAssets = visualAssets.filter(a => a.type === 'counter');

    // ═══ RENDER CONTENT ═══
    const videoContent = (
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

                {/* ═══ Z-15: EMOJI REACTIONS ═══ */}
                <AbsoluteFill style={{ zIndex: 15 }}>
                    {emojiAssets.map((asset, i) => (
                        <EmojiReaction
                            key={`emoji-${i}`}
                            startFrame={Math.ceil((asset.startMs / 1000) * fps)}
                            endFrame={Math.ceil((asset.endMs / 1000) * fps)}
                            emojis={asset.emojis || ['🔥', '❤️', '💪', '⚡', '🏆']}
                            intensity={(asset.intensity as any) || 'medium'}
                        />
                    ))}
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

                {/* ═══ Z-100: COUNTER ANIMATION ═══ */}
                <AbsoluteFill style={{ zIndex: 100, pointerEvents: 'none' }}>
                    {counterAssets.map((asset, i) => (
                        <CounterAnimation
                            key={`counter-${i}`}
                            startFrame={Math.ceil((asset.startMs / 1000) * fps)}
                            endFrame={Math.ceil((asset.endMs / 1000) * fps)}
                            toValue={asset.toValue || 15000}
                            prefix={asset.query?.includes('€') ? '€' : ''}
                            color={asset.color || '#22C55E'}
                        />
                    ))}
                </AbsoluteFill>

                {/* ═══ Z-200: CARDS, NEWSPAPER, SWIPE CARDS ═══ */}
                <AbsoluteFill style={{ zIndex: 200, pointerEvents: 'none' }}>
                    {/* B-Roll Cards */}
                    {brollAssets.map((asset, i) => {
                        const imgUrl = asset.imageUrl 
                            || ((asset.query || '').includes('http') ? asset.query : fallbackImages[i % fallbackImages.length]);
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
                    {newspaperAssets.map((asset, i) => (
                        <FakeNewspaper 
                            key={`news-${i}`}
                            startFrame={Math.ceil((asset.startMs / 1000) * fps)} 
                            endFrame={Math.ceil((asset.endMs / 1000) * fps)}
                            headline={asset.query} 
                        />
                    ))}

                    {/* Swipe Cards */}
                    {swipeCardAssets.map((asset, i) => (
                        <SwipeCard
                            key={`swipe-${i}`}
                            startFrame={Math.ceil((asset.startMs / 1000) * fps)}
                            endFrame={Math.ceil((asset.endMs / 1000) * fps)}
                            title={asset.query}
                            subtitle={asset.line2}
                            thumbnailUrl={asset.imageUrl}
                        />
                    ))}
                </AbsoluteFill>

                {/* ═══ Z-250: GIANT IMPACT TEXT ═══ */}
                <AbsoluteFill style={{ zIndex: 250, pointerEvents: 'none' }}>
                    {giantTextAssets.map((asset, i) => (
                        <GiantImpactText
                            key={`giant-${i}`}
                            startFrame={Math.ceil((asset.startMs / 1000) * fps)}
                            endFrame={Math.ceil((asset.endMs / 1000) * fps)}
                            line1={asset.query}
                            line2={asset.line2}
                            highlightWord={asset.highlightWord}
                            textStyle={(asset.textStyle as any) || 'impact'}
                            highlightColor={asset.color || '#EAB308'}
                        />
                    ))}
                </AbsoluteFill>

                {/* ═══ Z-300: TYPOGRAPHY, BOLLA IOS, SUBTITLES ═══ */}
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

                    {/* Block Subtitles */}
                    {words && words.length > 0 ? (
                        <BlockSubtitles 
                            words={words} 
                            wordsPerBlock={3}
                            yPosition={avatarVideoUrl ? 350 : 500}
                            subStyle={subtitleStyle}
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

                {/* ═══ Z-400: CTA BUTTON (più in alto di tutto) ═══ */}
                <AbsoluteFill style={{ zIndex: 400, pointerEvents: 'none' }}>
                    {ctaAssets.map((asset, i) => (
                        <CTAButton
                            key={`cta-${i}`}
                            startFrame={Math.ceil((asset.startMs / 1000) * fps)}
                            endFrame={Math.ceil((asset.endMs / 1000) * fps)}
                            text={asset.query || 'Scopri di più'}
                            color={asset.color || '#ef4444'}
                        />
                    ))}
                    {/* CTA automatico negli ultimi 3 secondi se nessun CTA è definito */}
                    {ctaAssets.length === 0 && durationInFrames > fps * 5 && (
                        <CTAButton
                            startFrame={durationInFrames - Math.ceil(fps * 3)}
                            text="Scopri di più"
                        />
                    )}
                </AbsoluteFill>
            </div>
        </AbsoluteFill>
    );

    // Wrappa con ZoomPulse se abilitato
    if (enableZoomPulse && zoomTriggerFrames.length > 0) {
        return (
            <ZoomPulse triggerFrames={zoomTriggerFrames} intensity={1.12}>
                {videoContent}
            </ZoomPulse>
        );
    }

    return videoContent;
};
