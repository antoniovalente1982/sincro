import { useCurrentFrame, useVideoConfig, interpolate } from 'remotion';
import React from 'react';

interface FilmBurnProps {
    startFrame: number;
    endFrame: number;
    color?: string;
    speed?: 'slow' | 'medium' | 'fast';
    direction?: 'left-to-right' | 'right-to-left' | 'center-out' | 'edges-in';
}

/**
 * FilmBurn — Transizione "bruciatura pellicola" stile analog.
 * Simula la bruciatura/melting della pellicola cinematografica.
 * Perfetto come transizione tra segmenti di clip.
 */
export const FilmBurn: React.FC<FilmBurnProps> = ({
    startFrame,
    endFrame,
    color = '#FF6B00',
    speed = 'medium',
    direction = 'center-out',
}) => {
    const frame = useCurrentFrame();

    if (frame < startFrame || frame > endFrame) return null;

    const totalFrames = endFrame - startFrame;
    const elapsed = frame - startFrame;
    const progress = elapsed / totalFrames;

    // Speed affects animation curve
    const speedMap = { slow: 0.6, medium: 1, fast: 1.5 };
    const curve = Math.min(1, progress * speedMap[speed]);

    // Burn expansion
    const burnSize = interpolate(curve, [0, 0.4, 0.6, 1], [0, 100, 100, 20]);
    const burnOpacity = interpolate(curve, [0, 0.2, 0.5, 0.8, 1], [0, 0.7, 1, 0.8, 0]);

    // White flash at peak
    const flashOpacity = interpolate(curve, [0.35, 0.45, 0.55, 0.65], [0, 0.4, 0.4, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

    // Melt distortion
    const meltY = interpolate(curve, [0, 0.5, 1], [0, -15, 5]);

    // Direction-based positioning
    const getGradient = () => {
        switch (direction) {
            case 'left-to-right':
                return `linear-gradient(90deg, ${color}${Math.round(burnOpacity * 255).toString(16).padStart(2, '0')} ${burnSize * 0.5}%, transparent ${burnSize}%)`;
            case 'right-to-left':
                return `linear-gradient(270deg, ${color}${Math.round(burnOpacity * 255).toString(16).padStart(2, '0')} ${burnSize * 0.5}%, transparent ${burnSize}%)`;
            case 'edges-in':
                return `radial-gradient(ellipse ${100 - burnSize * 0.8}% ${100 - burnSize * 0.7}% at 50% 50%, transparent 30%, ${color}${Math.round(burnOpacity * 200).toString(16).padStart(2, '0')} 100%)`;
            case 'center-out':
            default:
                return `radial-gradient(ellipse ${burnSize}% ${burnSize * 0.8}% at 50% 50%, ${color}${Math.round(burnOpacity * 255).toString(16).padStart(2, '0')} 0%, ${color}${Math.round(burnOpacity * 0.5 * 255).toString(16).padStart(2, '0')} 40%, transparent 70%)`;
        }
    };

    return (
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
            {/* Main burn */}
            <div
                style={{
                    position: 'absolute',
                    inset: '-5%',
                    background: getGradient(),
                    mixBlendMode: 'screen',
                    transform: `translateY(${meltY}px)`,
                }}
            />

            {/* Secondary warm halo */}
            <div
                style={{
                    position: 'absolute',
                    inset: 0,
                    background: `radial-gradient(circle at 50% 50%, rgba(255,200,100,${burnOpacity * 0.15}), transparent 60%)`,
                    filter: 'blur(30px)',
                    mixBlendMode: 'screen',
                }}
            />

            {/* White flash */}
            <div
                style={{
                    position: 'absolute',
                    inset: 0,
                    backgroundColor: `rgba(255,255,255,${flashOpacity})`,
                    mixBlendMode: 'overlay',
                }}
            />

            {/* Burn edge texture — irregular edges */}
            <div
                style={{
                    position: 'absolute',
                    inset: 0,
                    backgroundImage: `
                        radial-gradient(ellipse ${burnSize * 1.2}% ${burnSize}% at ${50 + Math.sin(elapsed * 0.2) * 5}% ${50 + Math.cos(elapsed * 0.15) * 5}%, 
                        transparent 30%, 
                        rgba(180,80,0,${burnOpacity * 0.3}) 50%, 
                        transparent 60%)
                    `,
                    mixBlendMode: 'screen',
                }}
            />

            {/* Sprocket hole simulation (film edge) */}
            {curve > 0.3 && curve < 0.7 && (
                <div
                    style={{
                        position: 'absolute',
                        top: 0,
                        bottom: 0,
                        left: 0,
                        width: '5%',
                        backgroundImage: `repeating-linear-gradient(
                            0deg,
                            transparent,
                            transparent 30px,
                            rgba(0,0,0,${burnOpacity * 0.4}) 30px,
                            rgba(0,0,0,${burnOpacity * 0.4}) 50px,
                            transparent 50px,
                            transparent 80px
                        )`,
                        opacity: burnOpacity * 0.5,
                    }}
                />
            )}
        </div>
    );
};
