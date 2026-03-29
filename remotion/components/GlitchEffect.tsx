import { useCurrentFrame, useVideoConfig, interpolate } from 'remotion';
import React, { useMemo } from 'react';

interface GlitchEffectProps {
    startFrame: number;
    endFrame: number;
    intensity?: 'low' | 'medium' | 'high';
    color?: string;
    variant?: 'digital' | 'vhs' | 'rgb-split';
}

export const GlitchEffect: React.FC<GlitchEffectProps> = ({
    startFrame,
    endFrame,
    intensity = 'medium',
    color = '#ff0040',
    variant = 'digital',
}) => {
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();

    if (frame < startFrame || frame > endFrame) return null;

    const progress = (frame - startFrame) / (endFrame - startFrame);
    const intensityMap = { low: 0.4, medium: 0.7, high: 1.0 };
    const power = intensityMap[intensity];

    // Pseudo-random based on frame
    const rand = (seed: number) => {
        const x = Math.sin(seed * 12.9898 + frame * 78.233) * 43758.5453;
        return x - Math.floor(x);
    };

    // Glitch triggers — not every frame
    const glitchActive = rand(frame * 0.3) > 0.6;
    const sliceCount = Math.floor(3 + rand(frame * 0.7) * 8 * power);

    // RGB Split offset
    const rgbOffset = glitchActive ? (4 + rand(frame) * 20) * power : 0;

    // Scan lines
    const scanLineOpacity = variant === 'vhs' ? 0.15 : 0.08;

    // Entrance/exit opacity
    const opacity = interpolate(
        frame,
        [startFrame, startFrame + 8, endFrame - 8, endFrame],
        [0, 1, 1, 0],
        { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
    );

    // Generate glitch slices
    const slices = useMemo(() => {
        if (!glitchActive) return [];
        return Array.from({ length: sliceCount }, (_, i) => {
            const y = rand(i * 13.7 + frame * 0.5) * 100;
            const h = 1 + rand(i * 7.3 + frame * 0.3) * 8;
            const xShift = (rand(i * 3.1 + frame * 0.9) - 0.5) * 80 * power;
            return { y, h, xShift };
        });
    }, [frame, glitchActive, sliceCount, power]);

    return (
        <div
            style={{
                position: 'absolute',
                inset: 0,
                overflow: 'hidden',
                opacity,
                pointerEvents: 'none',
                mixBlendMode: 'screen',
            }}
        >
            {/* RGB Split Layer */}
            {variant !== 'vhs' && rgbOffset > 0 && (
                <>
                    <div
                        style={{
                            position: 'absolute',
                            inset: 0,
                            background: `linear-gradient(${rand(frame) * 360}deg, ${color}15 0%, transparent 50%)`,
                            transform: `translateX(${rgbOffset}px)`,
                            mixBlendMode: 'screen',
                        }}
                    />
                    <div
                        style={{
                            position: 'absolute',
                            inset: 0,
                            background: `linear-gradient(${rand(frame + 100) * 360}deg, #00ff4015 0%, transparent 50%)`,
                            transform: `translateX(-${rgbOffset}px)`,
                            mixBlendMode: 'screen',
                        }}
                    />
                </>
            )}

            {/* Scan Lines */}
            <div
                style={{
                    position: 'absolute',
                    inset: 0,
                    backgroundImage: `repeating-linear-gradient(
                        0deg,
                        transparent,
                        transparent 2px,
                        rgba(0,0,0,${scanLineOpacity}) 2px,
                        rgba(0,0,0,${scanLineOpacity}) 4px
                    )`,
                    animation: variant === 'vhs' ? undefined : undefined,
                }}
            />

            {/* Glitch Slices */}
            {slices.map((slice, i) => (
                <div
                    key={i}
                    style={{
                        position: 'absolute',
                        left: 0,
                        right: 0,
                        top: `${slice.y}%`,
                        height: `${slice.h}%`,
                        background: `linear-gradient(90deg, ${color}20, transparent 30%, transparent 70%, #00ffff20)`,
                        transform: `translateX(${slice.xShift}px)`,
                        mixBlendMode: 'screen',
                    }}
                />
            ))}

            {/* Noise Overlay */}
            {glitchActive && (
                <div
                    style={{
                        position: 'absolute',
                        inset: 0,
                        background: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
                        opacity: 0.06 * power,
                        mixBlendMode: 'overlay',
                    }}
                />
            )}

            {/* VHS Tracking bar */}
            {variant === 'vhs' && (
                <div
                    style={{
                        position: 'absolute',
                        left: 0,
                        right: 0,
                        top: `${((frame * 2.3) % 120) - 10}%`,
                        height: '8%',
                        background: 'linear-gradient(180deg, transparent, rgba(255,255,255,0.08), transparent)',
                    }}
                />
            )}

            {/* Flash frame (rare) */}
            {rand(frame * 0.1) > 0.95 && (
                <div
                    style={{
                        position: 'absolute',
                        inset: 0,
                        backgroundColor: 'rgba(255,255,255,0.08)',
                    }}
                />
            )}
        </div>
    );
};
