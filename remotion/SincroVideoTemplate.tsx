
import { AbsoluteFill, useVideoConfig, useCurrentFrame, spring, Audio, staticFile, interpolate } from 'remotion';
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
    type: 'b-roll' | 'newspaper' | 'giant-text' | 'cta' | 'swipe-card' | 'emoji-reaction' | 'counter'
        | 'vfx-glitch' | 'vfx-glow' | 'vfx-color-grading' | 'vfx-lens-flare' | 'vfx-particles'
        | 'vfx-camera-shake' | 'vfx-cinematic-bars' | 'vfx-chromatic' | 'vfx-speed-ramp' | 'vfx-3d-transform'
        | 'vfx-film-grain' | 'vfx-light-leak' | 'vfx-film-burn' | 'vfx-ken-burns' | 'vfx-motion-sticker';
    query: string;
    url?: string;
    startMs: number;
    endMs: number;
    variant?: string;
    position?: string;
    imageUrl?: string;
    scale?: number;
    xOffset?: number;
    yOffset?: number;
    inAnim?: 'none' | 'fade-in' | 'slide-up' | 'zoom-in' | 'bounce';
    outAnim?: 'none' | 'fade-out' | 'slide-right' | 'zoom-out';
    idleAnim?: 'none' | 'float' | 'pulse' | 'wiggle';
    layerOrder?: 'front' | 'back';
    // Props extra per nuovi componenti
    line2?: string;
    highlightWord?: string;
    textStyle?: string;
    color?: string;
    toValue?: number;
    emojis?: string[];
    intensity?: string;
    // VFX Props
    vfxPreset?: string;
    vfxIntensity?: number;
    vfxSpeed?: number;
    vfxAngle?: number;
    vfxDensity?: string;
    vfxDirection?: string;
    vfxType?: string;
    vfxBarSize?: number;
    vfxAnimation?: string;
    vfxAnimated?: boolean;
    vfxColor2?: string;
    vfxRotateX?: number;
    vfxRotateY?: number;
    vfxRotateZ?: number;
    vfxPerspective?: number;
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
    subtitleStyle?: 'tiktok' | 'impact' | 'karaoke' | 'hormozi' | 'neon-word' | 'minimal-word' | 'cyber-scanline' | 'none';
    customBackgroundUrl?: string;
    enable3DParallax?: boolean;
    enableAutoBackgroundRemoval?: string | boolean;
    lightKeyAngle?: number;
    lightKeyIntensity?: number;
    lightKeyColor?: string;
    lightFillIntensity?: number;
    lightFillColor?: string;
    lightRimIntensity?: number;
    lightRimColor?: string;
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
// ★★★ AFTER EFFECTS VFX 6.0 ★★★
import { GlitchEffect } from './components/GlitchEffect';
import { GlowBloom } from './components/GlowBloom';
import { ColorGrading } from './components/ColorGrading';
import { LensFlare } from './components/LensFlare';
import { ParticleSystem } from './components/ParticleSystem';
import { CameraShake } from './components/CameraShakeVFX';
import { CinematicBars } from './components/CinematicBarsVFX';
import { ChromaticAberration } from './components/ChromaticAberration';
import { SpeedRamp } from './components/SpeedRamp';
import { Transform3D } from './components/Transform3D';
// ★★★ LEONARDO STYLE UPGRADE 7.0 ★★★
import { KineticSubtitles } from './components/KineticSubtitles';
import { FilmGrain } from './components/FilmGrain';
import { LightLeak } from './components/LightLeak';
import { FilmBurn } from './components/FilmBurn';
import { MotionSticker } from './components/MotionSticker';
import { KenBurns } from './components/KenBurns';

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
    customBackgroundUrl,
    enable3DParallax = false,
    enableAutoBackgroundRemoval = 'green',
    lightKeyAngle = 45,
    lightKeyIntensity = 0.8,
    lightKeyColor = '#ffffff',
    lightFillIntensity = 0.4,
    lightFillColor = '#a855f7',
    lightRimIntensity = 0.6,
    lightRimColor = '#06b6d4',
}) => {
    const { fps, durationInFrames } = useVideoConfig();
    const width = 1080;
    const height = 1920;
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

        const getTransformStyle = (asset: any): React.CSSProperties => {
        const scaleConfig = asset.scale !== undefined ? asset.scale : 1;
        const xOffset = asset.xOffset || 0;
        const yOffset = asset.yOffset || 0;
        
        let finalOpacity = 1;
        let finalScale = scaleConfig;
        let finalX = xOffset;
        let finalY = yOffset;
        let finalRotate = 0;

        const startFrame = Math.round((asset.startMs / 1000) * fps);
        const endFrame = Math.round((asset.endMs / 1000) * fps);

        if (asset.inAnim === 'fade-in') {
            finalOpacity = interpolate(frame, [startFrame, startFrame + 15], [0, 1], { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' });
        } else if (asset.inAnim === 'slide-up') {
            finalY = interpolate(frame, [startFrame, startFrame + 15], [yOffset + 500, yOffset], { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' });
            finalOpacity = interpolate(frame, [startFrame, startFrame + 5], [0, 1], { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' });
        } else if (asset.inAnim === 'zoom-in') {
            finalScale = interpolate(frame, [startFrame, startFrame + 15], [0, scaleConfig], { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' });
        } else if (asset.inAnim === 'bounce') {
            const bounceSpring = spring({ frame: frame - startFrame, fps, config: { damping: 10, mass: 0.5, stiffness: 100 } });
            finalScale = scaleConfig * bounceSpring;
        }

        if (asset.idleAnim === 'float') {
            finalY += Math.sin(frame / 15) * 30;
        } else if (asset.idleAnim === 'pulse') {
            finalScale += Math.sin(frame / 10) * 0.05;
        } else if (asset.idleAnim === 'wiggle') {
            finalRotate = Math.sin(frame / 5) * 5;
        }

        if (asset.outAnim === 'fade-out') {
            const outOp = interpolate(frame, [endFrame - 15, endFrame], [1, 0], { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' });
            finalOpacity = Math.min(finalOpacity, outOp);
        } else if (asset.outAnim === 'slide-right') {
            const outX = interpolate(frame, [endFrame - 15, endFrame], [finalX, finalX + 1080], { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' });
            finalX = outX;
        } else if (asset.outAnim === 'zoom-out') {
            const outScale = interpolate(frame, [endFrame - 15, endFrame], [finalScale, 0], { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' });
            finalScale = outScale;
        }

        return {
            width: '100%', height: '100%', position: 'absolute' as const,
            opacity: finalOpacity,
            transform: `translate(${finalX}px, ${finalY}px) scale(${finalScale}) rotate(${finalRotate}deg)`,
            transformOrigin: 'center center'
        };
    };

    // ═══ RENDER CONTENT ═══
    const videoContent = (
        <AbsoluteFill style={{ backgroundColor: '#000000', color: 'white', overflow: 'hidden' }}>
            {/* INJECT SVG CHROMA KEY FILTER */}
            <svg width="0" height="0" style={{ position: 'absolute', pointerEvents: 'none' }}>
                <defs>
                    <filter id="chroma-key" colorInterpolationFilters="sRGB">
                        {/* 
                            Matrix for Green Screen Removal in 1 step. 
                            If Green is the only active channel, A becomes negative.
                            If it's white, Yellow (R+G) or Cyan (G+B) the other channels offset the negative G and A remains > 1.
                        */}
                        <feColorMatrix
                            type="matrix"
                            values="
                                1 0 0 0 0
                                0 1 0 0 0
                                0 0 1 0 0
                                12 -12 12 0 1" 
                        />
                    </filter>
                </defs>
            </svg>

            <div style={{ width: '100%', height: '100%', transform: earthquakeTransform, transformOrigin: 'center center' }}>
                {/* Audio */}
                {audioBase64 && audioBase64.length > 0 && (
                    <Audio 
                        src={audioBase64.startsWith('blob:') || audioBase64.startsWith('http') || audioBase64.startsWith('data:') 
                             ? audioBase64 
                             : `data:audio/mpeg;base64,${audioBase64}`} 
                        volume={1}
                        pauseWhenBuffering
                    />
                )}

                {/* ═══ ENGINE 3D PARALLAX ═══ */}
                <AbsoluteFill 
                    style={{ 
                        perspective: enable3DParallax ? '1500px' : 'none',
                        transformStyle: 'preserve-3d',
                    }}
                >
                    {/* ═══ Z-0: SFONDO CINEMATICO ═══ */}
                    {customBackgroundUrl ? (
                        <AbsoluteFill style={{ 
                            zIndex: 0, 
                            transform: enable3DParallax ? 'translateZ(-300px) scale(1.4)' : 'none',
                        }}>
                            <img src={customBackgroundUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        </AbsoluteFill>
                    ) : (
                        <AbsoluteFill style={{ 
                            zIndex: 0,
                            transform: enable3DParallax ? 'translateZ(-300px) scale(1.4)' : 'none',
                        }}>
                            <CinematicBackground mood={backgroundMood} />
                        </AbsoluteFill>
                    )}

                    {/* ═══ Z-10: PARTICLES & WEBGL ═══ */}
                    <AbsoluteFill style={{ 
                        zIndex: 10,
                        transform: enable3DParallax ? 'translateZ(-100px) scale(1.1)' : 'none',
                    }}>
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
                    <AbsoluteFill style={{ 
                        zIndex: 15,
                        transform: enable3DParallax ? 'translateZ(0px)' : 'none',
                    }}>
                        {emojiAssets.map((asset, i) => (
                            <div key={`emoji-wrap-${i}`} style={getTransformStyle(asset)}>
                                <EmojiReaction
                                    startFrame={Math.ceil((asset.startMs / 1000) * fps)}
                                    endFrame={Math.ceil((asset.endMs / 1000) * fps)}
                                    emojis={asset.emojis || ['🔥', '❤️', '💪', '⚡', '🏆']}
                                    intensity={(asset.intensity as any) || 'medium'}
                                />
                            </div>
                        ))}
                    </AbsoluteFill>

                    {/* ═══ Z-40: ASSET BACKGROUND ═══ */}
                    <AbsoluteFill style={{ 
                        zIndex: 40,
                        transform: enable3DParallax ? 'translateZ(50px)' : 'none',
                    }}>
                       {visualAssets.filter(a => a.layerOrder === 'back').map((asset, i) => (
                           <div key={'back-'+i} style={getTransformStyle(asset)}>
                               {asset.type === 'giant-text' && <GiantImpactText line1={asset.query} line2={asset.line2} highlightWord={asset.highlightWord} textStyle={(asset.textStyle as any) || 'impact'} highlightColor={asset.color || '#EAB308'} startFrame={Math.ceil((asset.startMs/1000)*fps)} endFrame={Math.ceil((asset.endMs/1000)*fps)} />}
                               {asset.type === 'newspaper' && <FakeNewspaper headline={asset.query} endFrame={Math.ceil((asset.endMs/1000)*fps)} startFrame={Math.ceil((asset.startMs/1000)*fps)} />}
                               {asset.type === 'b-roll' && <DynamicCard3D imageUrl={asset.url || asset.imageUrl || ((asset.query || '').includes('http') ? asset.query : fallbackImages[i % fallbackImages.length])} startFrame={Math.ceil((asset.startMs/1000)*fps)} endFrame={Math.ceil((asset.endMs/1000)*fps)} variant={asset.variant as any || 'slide-right'} position={asset.position as any || 'center'} />}
                           </div>
                       ))}
                    </AbsoluteFill>

                    {/* ═══ Z-50: AVATAR SPEAKER (VIRTUAL LIGHTING STUDIO) ═══ */}
                    <AbsoluteFill style={{ 
                        zIndex: 50, 
                        pointerEvents: 'none',
                        transform: enable3DParallax ? 'translateZ(150px) scale(0.95)' : 'none',
                        transformStyle: 'preserve-3d', // Per eventuale tilt
                    }}>
                        {avatarVideoUrl && (
                             <AbsoluteFill style={{
                                 // OPTIMIZATION: Disabilitiamo l'ombra se il chroma key è attivo, altrimenti il browser crasha/si freeza
                                 filter: (enableAutoBackgroundRemoval === 'green' || enableAutoBackgroundRemoval === true) 
                                    ? `opacity(${Math.min(1, lightRimIntensity + 0.3)})`
                                    : `drop-shadow(0px -10px 40px ${lightRimColor}) drop-shadow(0px 10px 80px ${lightRimColor}) opacity(${Math.min(1, lightRimIntensity + 0.3)})`,
                                 mixBlendMode: enableAutoBackgroundRemoval === 'white' ? 'multiply' : 'normal',
                             }}>
                                 <Video 
                                    src={avatarVideoUrl} 
                                    crossOrigin="anonymous"
                                    muted={true}
                                    style={{ 
                                        objectFit: 'cover', 
                                        width: '100%', 
                                        height: '100%', 
                                        // Aggiungiamo brightness basato sull'intensità delle luci per il 'buio totale'
                                        filter: `${(enableAutoBackgroundRemoval === 'green' || enableAutoBackgroundRemoval === true) ? 'url(#chroma-key) ' : ''}brightness(${Math.max(0.1, Math.max(lightKeyIntensity, lightFillIntensity, lightRimIntensity))})`,
                                    }} 
                                    onError={(e) => console.warn('Avatar video failed to load:', e)}
                                 />

                                 {/* Key Light (Luce Principale ☀️) */}
                                 <div style={{
                                     position: 'absolute', inset: 0,
                                     background: `linear-gradient(${lightKeyAngle}deg, ${lightKeyColor} 0%, transparent 60%)`,
                                     mixBlendMode: 'overlay',
                                     opacity: lightKeyIntensity,
                                     pointerEvents: 'none'
                                 }} />

                                 {/* Fill Light (Luce di Riempimento 🌓) */}
                                 <div style={{
                                     position: 'absolute', inset: 0,
                                     background: `linear-gradient(${(lightKeyAngle + 180) % 360}deg, ${lightFillColor} 0%, transparent 70%)`,
                                     mixBlendMode: 'soft-light',
                                     opacity: lightFillIntensity,
                                     pointerEvents: 'none'
                                 }} />
                             </AbsoluteFill>
                        )}
                    </AbsoluteFill>
                </AbsoluteFill>

                {/* ═══ Z-100: COUNTER ANIMATION ═══ */}
                <AbsoluteFill style={{ zIndex: 100, pointerEvents: 'none' }}>
                    {counterAssets.map((asset, i) => (
                        <div key={`counter-wrap-${i}`} style={getTransformStyle(asset)}>
                            <CounterAnimation
                                startFrame={Math.ceil((asset.startMs / 1000) * fps)}
                                endFrame={Math.ceil((asset.endMs / 1000) * fps)}
                                toValue={asset.toValue || 15000}
                                prefix={asset.query?.includes('€') ? '€' : ''}
                                color={asset.color || '#22C55E'}
                            />
                        </div>
                    ))}
                </AbsoluteFill>

                {/* ═══ Z-200: CARDS, NEWSPAPER, SWIPE CARDS ═══ */}
                <AbsoluteFill style={{ zIndex: 200, pointerEvents: 'none' }}>
                    {/* B-Roll Cards */}
                    {brollAssets.filter(a => a.layerOrder !== 'back').map((asset, i) => {
                        const imgUrl = asset.url || asset.imageUrl 
                            || ((asset.query || '').includes('http') ? asset.query : fallbackImages[i % fallbackImages.length]);
                        return (
                            <div key={`broll-wrap-${i}`} style={getTransformStyle(asset)}>
                                <DynamicCard3D 
                                    startFrame={Math.ceil((asset.startMs / 1000) * fps)} 
                                    endFrame={Math.ceil((asset.endMs / 1000) * fps)}
                                    imageUrl={imgUrl} 
                                    variant={(asset.variant as any) || (['slide-right', 'slide-left', 'scale-up', 'rotate-in'][i % 4])}
                                    position={(asset.position as any) || (['top-right', 'top-left', 'center', 'bottom-right'][i % 4])}
                                    rotationOffset={-12 + (i % 2 === 0 ? 5 : -5)} 
                                />
                            </div>
                        );
                    })}

                    {/* Newspaper */}
                    {newspaperAssets.filter(a => a.layerOrder !== 'back').map((asset, i) => (
                        <div key={`news-wrap-${i}`} style={getTransformStyle(asset)}>
                            <FakeNewspaper 
                                startFrame={Math.ceil((asset.startMs / 1000) * fps)} 
                                endFrame={Math.ceil((asset.endMs / 1000) * fps)}
                                headline={asset.query} 
                            />
                        </div>
                    ))}

                    {/* Swipe Cards */}
                    {swipeCardAssets.filter(a => a.layerOrder !== 'back').map((asset, i) => (
                        <div key={`swipe-wrap-${i}`} style={getTransformStyle(asset)}>
                            <SwipeCard
                                startFrame={Math.ceil((asset.startMs / 1000) * fps)}
                                endFrame={Math.ceil((asset.endMs / 1000) * fps)}
                                title={asset.query}
                                subtitle={asset.line2}
                                thumbnailUrl={asset.url || asset.imageUrl}
                            />
                        </div>
                    ))}
                </AbsoluteFill>

                {/* ═══ Z-250: GIANT IMPACT TEXT ═══ */}
                <AbsoluteFill style={{ zIndex: 250, pointerEvents: 'none' }}>
                    {giantTextAssets.filter(a => a.layerOrder !== 'back').map((asset, i) => (
                        <div key={`giant-wrap-${i}`} style={getTransformStyle(asset)}>
                            <GiantImpactText
                                startFrame={Math.ceil((asset.startMs / 1000) * fps)}
                                endFrame={Math.ceil((asset.endMs / 1000) * fps)}
                                line1={asset.query}
                                line2={asset.line2}
                                highlightWord={asset.highlightWord}
                                textStyle={(asset.textStyle as any) || 'impact'}
                                highlightColor={asset.color || '#EAB308'}
                            />
                        </div>
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

                    {/* Subtitles — Old Block or New Kinetic */}
                    {subtitleStyle !== 'none' && (
                        words && words.length > 0 ? (
                            // Kinetic styles use word-by-word, legacy styles use block
                            subtitleStyle === 'hormozi' || subtitleStyle === 'neon-word' || subtitleStyle === 'minimal-word' ? (
                                <KineticSubtitles
                                    words={words}
                                    yPosition={avatarVideoUrl ? 350 : 500}
                                    style={subtitleStyle === 'hormozi' ? 'hormozi' : subtitleStyle === 'neon-word' ? 'neon' : 'minimal'}
                                />
                            ) : (
                                <BlockSubtitles
                                    words={words}
                                    wordsPerBlock={3}
                                    yPosition={avatarVideoUrl ? 350 : 500}
                                    subStyle={subtitleStyle as 'tiktok' | 'impact' | 'karaoke' | 'cyber-scanline'}
                                />
                            )
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
                        )
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
                    {ctaAssets.filter(a => a.layerOrder !== 'back').map((asset, i) => (
                        <div key={`cta-wrap-${i}`} style={getTransformStyle(asset)}>
                            <CTAButton
                                startFrame={Math.ceil((asset.startMs / 1000) * fps)}
                                endFrame={Math.ceil((asset.endMs / 1000) * fps)}
                                text={asset.query || 'Scopri di più'}
                                color={asset.color || '#ef4444'}
                            />
                        </div>
                    ))}
                    {/* CTA automatico negli ultimi 3 secondi se nessun CTA è definito */}
                    {ctaAssets.length === 0 && durationInFrames > fps * 5 && (
                        <CTAButton
                            startFrame={durationInFrames - Math.ceil(fps * 3)}
                            text="Scopri di più"
                        />
                    )}
                </AbsoluteFill>

                {/* ═══ Z-500: AFTER EFFECTS VFX LAYER ═══ */}
                <AbsoluteFill style={{ zIndex: 500, pointerEvents: 'none' }}>
                    {visualAssets.filter(a => a.type.startsWith('vfx-')).map((asset, i) => {
                        const sf = Math.ceil((asset.startMs / 1000) * fps);
                        const ef = Math.ceil((asset.endMs / 1000) * fps);

                        switch (asset.type) {
                            case 'vfx-glitch':
                                return <GlitchEffect key={`vfx-${i}`} startFrame={sf} endFrame={ef} intensity={(asset.vfxDensity as any) || 'medium'} color={asset.color || '#ff0040'} variant={(asset.vfxType as any) || 'digital'} />;
                            case 'vfx-glow':
                                return <GlowBloom key={`vfx-${i}`} startFrame={sf} endFrame={ef} color={asset.color || '#a855f7'} intensity={(asset.vfxDensity as any) || 'medium'} position={(asset.position as any) || 'center'} animated={asset.vfxAnimated !== false} />;
                            case 'vfx-color-grading':
                                return <ColorGrading key={`vfx-${i}`} startFrame={sf} endFrame={ef} preset={(asset.vfxPreset as any) || 'teal-orange'} intensity={asset.vfxIntensity ?? 0.8} />;
                            case 'vfx-lens-flare':
                                return <LensFlare key={`vfx-${i}`} startFrame={sf} endFrame={ef} color={asset.color || '#FFD700'} angle={asset.vfxAngle ?? 30} speed={(asset.vfxType as any) || 'medium'} size={(asset.vfxDensity as any) || 'medium'} />;
                            case 'vfx-particles':
                                return <ParticleSystem key={`vfx-${i}`} startFrame={sf} endFrame={ef} type={(asset.vfxType as any) || 'sparks'} color={asset.color || '#FFD700'} density={(asset.vfxDensity as any) || 'medium'} direction={(asset.vfxDirection as any) || 'up'} speed={asset.vfxSpeed ?? 1} />;
                            case 'vfx-cinematic-bars':
                                return <CinematicBars key={`vfx-${i}`} startFrame={sf} endFrame={ef} barSize={asset.vfxBarSize ?? 12} color={asset.color || '#000000'} animation={(asset.vfxAnimation as any) || 'slide'} />;
                            case 'vfx-chromatic':
                                return <ChromaticAberration key={`vfx-${i}`} startFrame={sf} endFrame={ef} intensity={(asset.vfxDensity as any) || 'medium'} animated={asset.vfxAnimated !== false} color1={asset.color || '#ff0040'} color2={asset.vfxColor2 || '#00d4ff'} />;
                            case 'vfx-speed-ramp':
                                return <SpeedRamp key={`vfx-${i}`} startFrame={sf} endFrame={ef} type={(asset.vfxType as any) || 'slow-motion'} intensity={asset.vfxIntensity ?? 0.5} />;
                            // ═══ LEONARDO STYLE VFX ═══
                            case 'vfx-film-grain':
                                return <FilmGrain key={`vfx-${i}`} startFrame={sf} endFrame={ef} intensity={(asset.vfxDensity as any) || 'subtle'} color={(asset.vfxType as any) || 'neutral'} />;
                            case 'vfx-light-leak':
                                return <LightLeak key={`vfx-${i}`} startFrame={sf} endFrame={ef} color={(asset.vfxType as any) || 'warm'} position={(asset.position as any) || 'left'} intensity={(asset.vfxDensity as any) || 'medium'} />;
                            case 'vfx-film-burn':
                                return <FilmBurn key={`vfx-${i}`} startFrame={sf} endFrame={ef} color={asset.color || '#FF6B00'} speed={(asset.vfxType as any) || 'medium'} direction={(asset.vfxDirection as any) || 'center-out'} />;
                            case 'vfx-motion-sticker':
                                return <MotionSticker key={`vfx-${i}`} startFrame={sf} endFrame={ef} type={(asset.vfxType as any) || 'arrow-point'} color={asset.color || '#EAB308'} size={asset.vfxIntensity ? asset.vfxIntensity * 100 : 100} posX={asset.xOffset ?? 50} posY={asset.yOffset ?? 50} rotation={asset.vfxAngle ?? 0} />;
                            default:
                                return null;
                        }
                    })}
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
