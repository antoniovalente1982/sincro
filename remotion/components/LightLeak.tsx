import { useCurrentFrame, useVideoConfig, interpolate } from 'remotion';
import React from 'react';

interface LightLeakProps {
    startFrame: number;
    endFrame: number;
    color?: 'warm' | 'teal' | 'purple' | 'golden' | 'custom';
    customColor?: string;
    position?: 'left' | 'right' | 'top' | 'center' | 'random';
    intensity?: 'soft' | 'medium' | 'bright';
    animated?: boolean;
}

/**
 * LightLeak — Sovrapposizione di luce stile pellicola analogica.
 * Usato tra i segmenti per transizioni organiche e per aggiungere calore.
 */
export const LightLeak: React.FC<LightLeakProps> = ({
    startFrame,
    endFrame,
    color = 'warm',
    customColor,
    position = 'left',
    intensity = 'medium',
    animated = true,
}) => {
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();

    if (frame < startFrame || frame > endFrame) return null;

    const intensityMap = { soft: 0.15, medium: 0.3, bright: 0.5 };
    const power = intensityMap[intensity];

    const colorMap: Record<string, string[]> = {
        warm: ['#FF6B00', '#FF9500', '#FFD700'],
        teal: ['#00CED1', '#20B2AA', '#008B8B'],
        purple: ['#9B59B6', '#8E44AD', '#E056A0'],
        golden: ['#FFD700', '#FFA500', '#FF8C00'],
        custom: [customColor || '#FF6B00', customColor || '#FF9500', customColor || '#FFD700'],
    };

    const colors = colorMap[color] || colorMap.warm;
    const totalFrames = endFrame - startFrame;
    const elapsed = frame - startFrame;

    // Swell in and out
    const envelope = interpolate(
        frame,
        [startFrame, startFrame + totalFrames * 0.3, endFrame - totalFrames * 0.3, endFrame],
        [0, 1, 1, 0],
        { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
    );

    // Position offsets
    const posMap: Record<string, { x: string; y: string }> = {
        left: { x: '-10%', y: '30%' },
        right: { x: '80%', y: '40%' },
        top: { x: '40%', y: '-10%' },
        center: { x: '40%', y: '40%' },
        random: {
            x: `${30 + Math.sin(elapsed * 0.02) * 30}%`,
            y: `${30 + Math.cos(elapsed * 0.015) * 20}%`,
        },
    };

    const pos = posMap[position] || posMap.left;

    // Animated movement
    const driftX = animated ? Math.sin(elapsed * 0.03) * 10 : 0;
    const driftY = animated ? Math.cos(elapsed * 0.025) * 8 : 0;
    const breathe = animated ? 1 + Math.sin(elapsed * 0.05) * 0.15 : 1;

    return (
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
            {/* Primary light blob */}
            <div
                style={{
                    position: 'absolute',
                    left: pos.x,
                    top: pos.y,
                    width: '80%',
                    height: '60%',
                    background: `radial-gradient(ellipse 100% 80% at 50% 50%, ${colors[0]}${Math.round(power * envelope * 255).toString(16).padStart(2, '0')}, ${colors[1]}${Math.round(power * 0.5 * envelope * 255).toString(16).padStart(2, '0')}, transparent 70%)`,
                    filter: `blur(${60 + Math.sin(elapsed * 0.04) * 20}px)`,
                    transform: `translate(${driftX}%, ${driftY}%) scale(${breathe})`,
                    mixBlendMode: 'screen',
                }}
            />

            {/* Secondary smaller blob */}
            <div
                style={{
                    position: 'absolute',
                    left: `calc(${pos.x} + 20%)`,
                    top: `calc(${pos.y} + 15%)`,
                    width: '40%',
                    height: '35%',
                    background: `radial-gradient(circle, ${colors[2]}${Math.round(power * 0.6 * envelope * 255).toString(16).padStart(2, '0')}, transparent 60%)`,
                    filter: 'blur(40px)',
                    transform: `translate(${-driftX * 0.5}%, ${-driftY * 0.5}%) scale(${breathe * 0.9})`,
                    mixBlendMode: 'screen',
                }}
            />

            {/* Horizontal light streak */}
            <div
                style={{
                    position: 'absolute',
                    left: pos.x,
                    top: `calc(${pos.y} + 10%)`,
                    width: '120%',
                    height: '15%',
                    background: `linear-gradient(90deg, transparent, ${colors[0]}${Math.round(power * 0.3 * envelope * 255).toString(16).padStart(2, '0')}, ${colors[1]}${Math.round(power * 0.2 * envelope * 255).toString(16).padStart(2, '0')}, transparent)`,
                    filter: 'blur(25px)',
                    transform: `rotate(${5 + Math.sin(elapsed * 0.02) * 3}deg)`,
                    mixBlendMode: 'screen',
                }}
            />
        </div>
    );
};
