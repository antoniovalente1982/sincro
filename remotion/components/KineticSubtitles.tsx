import React, { useMemo } from 'react';
import { spring, useCurrentFrame, useVideoConfig, interpolate } from 'remotion';

interface KineticSubtitlesProps {
    words: { word: string; startMs: number; endMs: number; emoji?: string; isImpact?: boolean }[];
    yPosition?: number;
    style?: 'hormozi' | 'neon' | 'minimal' | 'glitch';
    highlightColor?: string;
    baseColor?: string;
    fontSize?: number;
}

/**
 * KineticSubtitles — Sottotitoli parola-per-parola stile Leonardo/Hormozi
 * Ogni parola appare singolarmente con animazione "pop up + scale"
 * Le keyword (isImpact) hanno colore highlight e glow aggressivo
 */
export const KineticSubtitles: React.FC<KineticSubtitlesProps> = ({
    words,
    yPosition = 420,
    style = 'hormozi',
    highlightColor = '#EAB308',
    baseColor = '#FFFFFF',
    fontSize = 90,
}) => {
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();
    const currentMs = (frame / fps) * 1000;

    // Find the currently active word
    const activeWordIndex = useMemo(() => {
        for (let i = words.length - 1; i >= 0; i--) {
            if (currentMs >= words[i].startMs && currentMs <= words[i].endMs + 300) {
                return i;
            }
        }
        return -1;
    }, [words, currentMs]);

    if (activeWordIndex < 0) return null;

    const wordData = words[activeWordIndex];
    const wordStartFrame = Math.floor((wordData.startMs / 1000) * fps);
    const wordEndFrame = Math.floor((wordData.endMs / 1000) * fps);
    const isImpact = wordData.isImpact;

    // ═══ ANIMATIONS ═══
    // Pop-in spring
    const popScale = spring({
        fps,
        frame: frame - wordStartFrame,
        config: { damping: 10, mass: 0.4, stiffness: 250 },
        from: 0.3,
        to: 1,
    });

    // Bounce Y
    const popY = spring({
        fps,
        frame: frame - wordStartFrame,
        config: { damping: 8, mass: 0.3, stiffness: 300 },
        from: 60,
        to: 0,
    });

    // Opacity
    const opacity = interpolate(
        frame,
        [wordStartFrame, wordStartFrame + 3, wordEndFrame - 3, wordEndFrame + 8],
        [0, 1, 1, 0],
        { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
    );

    // Impact pulse for keywords
    const impactPulse = isImpact
        ? 1 + Math.sin((frame - wordStartFrame) * 0.3) * 0.04
        : 1;

    // Rotation shake for impact
    const impactRotation = isImpact
        ? Math.sin((frame - wordStartFrame) * 0.5) * 2
        : 0;

    // ═══ STYLE CONFIGS ═══
    const getWordStyle = (): React.CSSProperties => {
        const base: React.CSSProperties = {
            fontFamily: '"Inter", "Helvetica Neue", sans-serif',
            fontWeight: 900,
            textTransform: 'uppercase',
            letterSpacing: '-3px',
            lineHeight: 1,
            transform: `translateY(${popY}px) scale(${popScale * impactPulse}) rotate(${impactRotation}deg)`,
            opacity,
            transformOrigin: 'center center',
        };

        switch (style) {
            case 'hormozi': {
                return {
                    ...base,
                    fontSize: isImpact ? fontSize * 1.25 : fontSize,
                    color: isImpact ? '#0B0F19' : baseColor,
                    backgroundColor: isImpact ? highlightColor : 'transparent',
                    padding: isImpact ? '12px 32px 16px' : '0 8px',
                    borderRadius: isImpact ? '8px 20px 6px 22px' : '0',
                    boxShadow: isImpact
                        ? `0 0 60px ${highlightColor}80, 0 12px 30px rgba(0,0,0,0.5), inset 0 -3px 0 rgba(0,0,0,0.15)`
                        : 'none',
                    textShadow: isImpact
                        ? 'none'
                        : '0 6px 30px rgba(0,0,0,0.95), 0 3px 6px rgba(0,0,0,0.9), 3px 3px 0 rgba(0,0,0,0.7), -1px -1px 0 rgba(0,0,0,0.5)',
                    WebkitTextStroke: isImpact ? 'none' : '1px rgba(0,0,0,0.3)',
                };
            }
            case 'neon': {
                const glowColor = isImpact ? highlightColor : '#00D4FF';
                return {
                    ...base,
                    fontSize: isImpact ? fontSize * 1.15 : fontSize,
                    color: isImpact ? highlightColor : baseColor,
                    textShadow: `
                        0 0 10px ${glowColor}80,
                        0 0 30px ${glowColor}60,
                        0 0 60px ${glowColor}40,
                        0 0 100px ${glowColor}20,
                        0 4px 15px rgba(0,0,0,0.8)
                    `,
                    WebkitTextStroke: `1px ${glowColor}60`,
                };
            }
            case 'minimal': {
                return {
                    ...base,
                    fontSize: isImpact ? fontSize * 1.1 : fontSize * 0.9,
                    fontWeight: isImpact ? 900 : 700,
                    color: isImpact ? highlightColor : baseColor,
                    letterSpacing: '-1px',
                    textShadow: '0 4px 20px rgba(0,0,0,0.8)',
                    // Underline bar for impact words
                };
            }
            case 'glitch': {
                const glitchOffset = isImpact ? Math.sin(frame * 1.5) * 3 : 0;
                return {
                    ...base,
                    fontSize: isImpact ? fontSize * 1.2 : fontSize,
                    color: isImpact ? highlightColor : baseColor,
                    textShadow: `
                        ${glitchOffset}px 0 0 #ff004080,
                        ${-glitchOffset}px 0 0 #00d4ff80,
                        0 4px 20px rgba(0,0,0,0.9)
                    `,
                };
            }
            default:
                return base;
        }
    };

    return (
        <div
            style={{
                position: 'absolute',
                bottom: yPosition,
                left: 0,
                right: 0,
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                padding: '0 60px',
                zIndex: 10,
            }}
        >
            <div style={{ position: 'relative', display: 'inline-flex', flexDirection: 'column', alignItems: 'center' }}>
                {/* Emoji above word for impact */}
                {isImpact && wordData.emoji && (
                    <span
                        style={{
                            fontSize: fontSize * 0.8,
                            filter: 'drop-shadow(0 6px 12px rgba(0,0,0,0.5))',
                            marginBottom: 8,
                            transform: `scale(${popScale}) rotate(${-impactRotation * 2}deg)`,
                            opacity,
                        }}
                    >
                        {wordData.emoji}
                    </span>
                )}

                {/* The Word */}
                <span style={getWordStyle()}>
                    {wordData.word}
                </span>

                {/* Underline bar for minimal style impact */}
                {style === 'minimal' && isImpact && (
                    <div
                        style={{
                            marginTop: 8,
                            height: 6,
                            borderRadius: 3,
                            backgroundColor: highlightColor,
                            boxShadow: `0 0 20px ${highlightColor}80`,
                            width: `${popScale * 100}%`,
                            opacity,
                        }}
                    />
                )}

                {/* Glow ring behind impact word for hormozi style */}
                {style === 'hormozi' && isImpact && (
                    <div
                        style={{
                            position: 'absolute',
                            inset: '-20px',
                            borderRadius: '20px',
                            background: `radial-gradient(ellipse, ${highlightColor}15, transparent 70%)`,
                            filter: 'blur(15px)',
                            zIndex: -1,
                            transform: `scale(${impactPulse * 1.2})`,
                        }}
                    />
                )}
            </div>
        </div>
    );
};
