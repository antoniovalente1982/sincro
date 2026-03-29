import { useCurrentFrame, interpolate } from 'remotion';
import React from 'react';

interface ColorGradingProps {
    startFrame: number;
    endFrame: number;
    preset?: 'teal-orange' | 'desaturated' | 'vintage' | 'neon' | 'noir' | 'golden-hour' | 'cyberpunk' | 'cold-blue';
    intensity?: number; // 0.0 - 1.0
}

const PRESETS: Record<string, { filter: string; overlay?: string; blendMode?: string }> = {
    'teal-orange': {
        filter: 'contrast(1.1) saturate(1.3)',
        overlay: 'linear-gradient(180deg, rgba(0,128,128,0.15), rgba(255,140,0,0.12))',
        blendMode: 'color',
    },
    'desaturated': {
        filter: 'saturate(0.4) contrast(1.15) brightness(1.05)',
        overlay: 'linear-gradient(180deg, rgba(180,180,180,0.08), rgba(100,100,100,0.1))',
        blendMode: 'overlay',
    },
    'vintage': {
        filter: 'sepia(0.35) contrast(1.1) brightness(0.95) saturate(0.9)',
        overlay: 'linear-gradient(180deg, rgba(255,220,130,0.12), rgba(60,20,0,0.15))',
        blendMode: 'multiply',
    },
    'neon': {
        filter: 'contrast(1.3) saturate(1.8) brightness(1.05)',
        overlay: 'linear-gradient(135deg, rgba(255,0,128,0.08), rgba(0,255,255,0.08))',
        blendMode: 'screen',
    },
    'noir': {
        filter: 'grayscale(0.85) contrast(1.4) brightness(0.9)',
        overlay: 'linear-gradient(180deg, rgba(0,0,0,0.1), rgba(0,0,0,0.25))',
        blendMode: 'multiply',
    },
    'golden-hour': {
        filter: 'contrast(1.05) saturate(1.2) brightness(1.05)',
        overlay: 'linear-gradient(180deg, rgba(255,180,60,0.2) 0%, rgba(255,100,50,0.12) 100%)',
        blendMode: 'overlay',
    },
    'cyberpunk': {
        filter: 'contrast(1.25) saturate(1.5) hue-rotate(10deg)',
        overlay: 'linear-gradient(135deg, rgba(255,0,100,0.12), rgba(0,200,255,0.12), rgba(150,0,255,0.08))',
        blendMode: 'screen',
    },
    'cold-blue': {
        filter: 'contrast(1.1) saturate(0.8) hue-rotate(-10deg)',
        overlay: 'linear-gradient(180deg, rgba(40,80,160,0.18), rgba(20,40,80,0.15))',
        blendMode: 'overlay',
    },
};

export const ColorGrading: React.FC<ColorGradingProps> = ({
    startFrame,
    endFrame,
    preset = 'teal-orange',
    intensity = 0.8,
}) => {
    const frame = useCurrentFrame();

    if (frame < startFrame || frame > endFrame) return null;

    const config = PRESETS[preset] || PRESETS['teal-orange'];

    const opacity = interpolate(
        frame,
        [startFrame, startFrame + 20, endFrame - 20, endFrame],
        [0, intensity, intensity, 0],
        { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
    );

    return (
        <>
            {/* Filter Layer — applies CSS filter to simulate color grading */}
            <div
                style={{
                    position: 'absolute',
                    inset: 0,
                    pointerEvents: 'none',
                    backdropFilter: config.filter,
                    WebkitBackdropFilter: config.filter,
                    opacity,
                    zIndex: 0,
                }}
            />
            {/* Overlay gradient */}
            {config.overlay && (
                <div
                    style={{
                        position: 'absolute',
                        inset: 0,
                        pointerEvents: 'none',
                        background: config.overlay,
                        mixBlendMode: (config.blendMode as any) || 'overlay',
                        opacity,
                    }}
                />
            )}
            {/* Vignette — classic cinema */}
            <div
                style={{
                    position: 'absolute',
                    inset: 0,
                    pointerEvents: 'none',
                    background: 'radial-gradient(ellipse 70% 60% at 50% 50%, transparent 50%, rgba(0,0,0,0.4) 100%)',
                    opacity: opacity * 0.6,
                }}
            />
        </>
    );
};
