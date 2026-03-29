import { useCurrentFrame, interpolate } from 'remotion';
import React from 'react';

interface ChromaticAberrationProps {
    startFrame: number;
    endFrame: number;
    intensity?: 'subtle' | 'medium' | 'heavy';
    animated?: boolean;
    color1?: string;
    color2?: string;
}

export const ChromaticAberration: React.FC<ChromaticAberrationProps> = ({
    startFrame,
    endFrame,
    intensity = 'medium',
    animated = true,
    color1 = '#ff0040',
    color2 = '#00d4ff',
}) => {
    const frame = useCurrentFrame();

    if (frame < startFrame || frame > endFrame) return null;

    const intensityMap = { subtle: 3, medium: 8, heavy: 16 };
    const offset = intensityMap[intensity];

    const opacity = interpolate(
        frame,
        [startFrame, startFrame + 10, endFrame - 10, endFrame],
        [0, 0.6, 0.6, 0],
        { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
    );

    const elapsed = frame - startFrame;
    // Animated sway
    const shiftX = animated ? Math.sin(elapsed * 0.08) * offset : offset;
    const shiftY = animated ? Math.cos(elapsed * 0.06) * (offset * 0.3) : 0;

    return (
        <div
            style={{
                position: 'absolute',
                inset: 0,
                pointerEvents: 'none',
                opacity,
            }}
        >
            {/* Red/Magenta channel shift */}
            <div
                style={{
                    position: 'absolute',
                    inset: 0,
                    background: `linear-gradient(135deg, ${color1}08, transparent 40%, transparent 60%, ${color1}06)`,
                    transform: `translate(${shiftX}px, ${shiftY}px)`,
                    mixBlendMode: 'screen',
                }}
            />
            {/* Cyan/Blue channel shift (opposite direction) */}
            <div
                style={{
                    position: 'absolute',
                    inset: 0,
                    background: `linear-gradient(315deg, ${color2}08, transparent 40%, transparent 60%, ${color2}06)`,
                    transform: `translate(${-shiftX}px, ${-shiftY}px)`,
                    mixBlendMode: 'screen',
                }}
            />
            {/* Edge fringing */}
            <div
                style={{
                    position: 'absolute',
                    inset: 0,
                    boxShadow: `
                        inset ${shiftX * 0.5}px 0 ${offset}px ${color1}15,
                        inset ${-shiftX * 0.5}px 0 ${offset}px ${color2}15
                    `,
                }}
            />
            {/* Central subtle split line */}
            {intensity === 'heavy' && (
                <>
                    <div
                        style={{
                            position: 'absolute',
                            top: 0,
                            bottom: 0,
                            left: '50%',
                            width: 1,
                            background: `linear-gradient(180deg, transparent, ${color1}20, transparent)`,
                            transform: `translateX(${shiftX * 2}px)`,
                        }}
                    />
                    <div
                        style={{
                            position: 'absolute',
                            top: 0,
                            bottom: 0,
                            left: '50%',
                            width: 1,
                            background: `linear-gradient(180deg, transparent, ${color2}20, transparent)`,
                            transform: `translateX(${-shiftX * 2}px)`,
                        }}
                    />
                </>
            )}
        </div>
    );
};
