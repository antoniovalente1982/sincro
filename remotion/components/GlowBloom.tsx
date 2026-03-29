import { useCurrentFrame, useVideoConfig, interpolate } from 'remotion';
import React from 'react';

interface GlowBloomProps {
    startFrame: number;
    endFrame: number;
    color?: string;
    intensity?: 'soft' | 'medium' | 'intense';
    position?: 'center' | 'top' | 'bottom' | 'edges';
    animated?: boolean;
}

export const GlowBloom: React.FC<GlowBloomProps> = ({
    startFrame,
    endFrame,
    color = '#a855f7',
    intensity = 'medium',
    position = 'center',
    animated = true,
}) => {
    const frame = useCurrentFrame();

    if (frame < startFrame || frame > endFrame) return null;

    const intensityMap = { soft: 0.15, medium: 0.3, intense: 0.5 };
    const power = intensityMap[intensity];

    const opacity = interpolate(
        frame,
        [startFrame, startFrame + 15, endFrame - 15, endFrame],
        [0, power, power, 0],
        { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
    );

    // Pulsating animation
    const pulse = animated ? Math.sin((frame - startFrame) * 0.08) * 0.15 + 1 : 1;
    const drift = animated ? Math.sin((frame - startFrame) * 0.03) * 30 : 0;

    // Position configs
    const posConfig: Record<string, React.CSSProperties> = {
        center: {
            background: `radial-gradient(ellipse 80% 60% at ${50 + drift * 0.2}% 50%, ${color}${Math.round(opacity * 255).toString(16).padStart(2, '0')}, transparent 70%)`,
        },
        top: {
            background: `radial-gradient(ellipse 120% 50% at 50% ${-10 + drift * 0.1}%, ${color}${Math.round(opacity * 255).toString(16).padStart(2, '0')}, transparent 60%)`,
        },
        bottom: {
            background: `radial-gradient(ellipse 120% 50% at 50% ${110 + drift * 0.1}%, ${color}${Math.round(opacity * 255).toString(16).padStart(2, '0')}, transparent 60%)`,
        },
        edges: {
            background: `
                radial-gradient(ellipse 50% 80% at 0% 50%, ${color}${Math.round(opacity * 0.7 * 255).toString(16).padStart(2, '0')}, transparent 50%),
                radial-gradient(ellipse 50% 80% at 100% 50%, ${color}${Math.round(opacity * 0.7 * 255).toString(16).padStart(2, '0')}, transparent 50%)
            `,
        },
    };

    return (
        <div
            style={{
                position: 'absolute',
                inset: 0,
                pointerEvents: 'none',
                mixBlendMode: 'screen',
                ...posConfig[position],
                transform: `scale(${pulse})`,
                transformOrigin: 'center center',
            }}
        >
            {/* Extra bloom ring */}
            <div
                style={{
                    position: 'absolute',
                    inset: '-20%',
                    background: `radial-gradient(circle at 50% 50%, transparent 30%, ${color}08, transparent 70%)`,
                    filter: 'blur(40px)',
                    transform: `scale(${1 + Math.sin((frame - startFrame) * 0.05) * 0.1})`,
                }}
            />

            {/* Light streaks */}
            {intensity === 'intense' && (
                <>
                    <div
                        style={{
                            position: 'absolute',
                            top: '40%',
                            left: '10%',
                            right: '10%',
                            height: '20%',
                            background: `linear-gradient(90deg, transparent, ${color}15, transparent)`,
                            filter: 'blur(20px)',
                            transform: `rotate(${5 + Math.sin((frame - startFrame) * 0.02) * 3}deg)`,
                        }}
                    />
                    <div
                        style={{
                            position: 'absolute',
                            top: '35%',
                            left: '5%',
                            right: '5%',
                            height: '30%',
                            background: `linear-gradient(90deg, transparent, ${color}10, transparent)`,
                            filter: 'blur(30px)',
                            transform: `rotate(${-3 + Math.sin((frame - startFrame) * 0.04) * 2}deg)`,
                        }}
                    />
                </>
            )}
        </div>
    );
};
