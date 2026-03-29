import { useCurrentFrame, useVideoConfig, interpolate } from 'remotion';
import React, { useMemo } from 'react';

interface FilmGrainProps {
    startFrame: number;
    endFrame: number;
    intensity?: 'subtle' | 'medium' | 'heavy';
    color?: 'warm' | 'cool' | 'neutral';
    animated?: boolean;
}

/**
 * FilmGrain — Texture organica tipo pellicola analogica.
 * Elimina il look "digitale piatto" e aggiunge calore/vita al video.
 */
export const FilmGrain: React.FC<FilmGrainProps> = ({
    startFrame,
    endFrame,
    intensity = 'subtle',
    color = 'neutral',
    animated = true,
}) => {
    const frame = useCurrentFrame();

    if (frame < startFrame || frame > endFrame) return null;

    const intensityMap = { subtle: 0.03, medium: 0.06, heavy: 0.1 };
    const power = intensityMap[intensity];

    const opacity = interpolate(
        frame,
        [startFrame, startFrame + 10, endFrame - 10, endFrame],
        [0, power, power, 0],
        { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
    );

    // Color tint based on film type
    const tintColor = color === 'warm' ? 'rgba(255,220,180,0.04)' 
                     : color === 'cool' ? 'rgba(180,200,255,0.04)' 
                     : 'transparent';

    // Animated grain position offset
    const offsetX = animated ? (frame * 17.3) % 256 : 0;
    const offsetY = animated ? (frame * 31.7) % 256 : 0;

    return (
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', opacity }}>
            {/* Grain noise layer */}
            <div
                style={{
                    position: 'absolute',
                    inset: '-10%',
                    backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
                    backgroundSize: '256px 256px',
                    backgroundPosition: `${offsetX}px ${offsetY}px`,
                    mixBlendMode: 'overlay',
                }}
            />

            {/* Subtle vignette for film look */}
            <div
                style={{
                    position: 'absolute',
                    inset: 0,
                    background: 'radial-gradient(ellipse 75% 65% at 50% 50%, transparent 50%, rgba(0,0,0,0.25) 100%)',
                    opacity: power * 5,
                }}
            />

            {/* Color tint */}
            {color !== 'neutral' && (
                <div
                    style={{
                        position: 'absolute',
                        inset: 0,
                        backgroundColor: tintColor,
                    }}
                />
            )}

            {/* Horizontal scan variation (film weave simulation) */}
            <div
                style={{
                    position: 'absolute',
                    inset: 0,
                    backgroundImage: `repeating-linear-gradient(
                        0deg,
                        transparent,
                        transparent 3px,
                        rgba(0,0,0,${power * 0.3}) 3px,
                        rgba(0,0,0,${power * 0.3}) 4px
                    )`,
                    opacity: 0.5,
                }}
            />
        </div>
    );
};
