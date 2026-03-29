import { useCurrentFrame, useVideoConfig, interpolate } from 'remotion';
import React from 'react';

interface LensFlareProps {
    startFrame: number;
    endFrame: number;
    color?: string;
    angle?: number; // degrees
    speed?: 'slow' | 'medium' | 'fast';
    size?: 'small' | 'medium' | 'large';
}

export const LensFlare: React.FC<LensFlareProps> = ({
    startFrame,
    endFrame,
    color = '#FFD700',
    angle = 30,
    speed = 'medium',
    size = 'medium',
}) => {
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();

    if (frame < startFrame || frame > endFrame) return null;

    const speedMap = { slow: 0.008, medium: 0.015, fast: 0.025 };
    const sizeMap = { small: 200, medium: 400, large: 600 };
    const velocity = speedMap[speed];
    const flareSize = sizeMap[size];

    const progress = (frame - startFrame) * velocity;
    
    // Flare moves across the screen
    const flareX = interpolate(progress, [0, 1], [-20, 120]);
    const flareY = 30 + Math.sin(progress * Math.PI) * 20;

    const opacity = interpolate(
        frame,
        [startFrame, startFrame + 10, endFrame - 10, endFrame],
        [0, 0.8, 0.8, 0],
        { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
    );

    // Brightness pulse
    const pulse = 0.8 + Math.sin((frame - startFrame) * 0.15) * 0.2;

    // Secondary flares (ghost reflections)
    const ghosts = [
        { offsetX: -15, offsetY: 8, size: flareSize * 0.3, opacity: 0.3 },
        { offsetX: -25, offsetY: 15, size: flareSize * 0.15, opacity: 0.2 },
        { offsetX: 10, offsetY: -5, size: flareSize * 0.5, opacity: 0.15 },
        { offsetX: 20, offsetY: -12, size: flareSize * 0.12, opacity: 0.25 },
    ];

    // Parse color for variations
    const hexToRgb = (hex: string) => {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return { r, g, b };
    };
    const rgb = hexToRgb(color);

    return (
        <div
            style={{
                position: 'absolute',
                inset: 0,
                pointerEvents: 'none',
                opacity,
                overflow: 'hidden',
            }}
        >
            {/* Main flare */}
            <div
                style={{
                    position: 'absolute',
                    left: `${flareX}%`,
                    top: `${flareY}%`,
                    width: flareSize,
                    height: flareSize,
                    borderRadius: '50%',
                    background: `radial-gradient(circle, rgba(255,255,255,0.9) 0%, ${color}80 20%, ${color}40 40%, transparent 70%)`,
                    filter: `blur(${flareSize * 0.05}px)`,
                    transform: `translate(-50%, -50%) scale(${pulse})`,
                    mixBlendMode: 'screen',
                }}
            />

            {/* Anamorphic streak */}
            <div
                style={{
                    position: 'absolute',
                    left: `${flareX}%`,
                    top: `${flareY}%`,
                    width: flareSize * 4,
                    height: flareSize * 0.08,
                    background: `linear-gradient(90deg, transparent, ${color}30, rgba(255,255,255,0.4), ${color}30, transparent)`,
                    transform: `translate(-50%, -50%) rotate(${angle}deg)`,
                    filter: 'blur(4px)',
                    mixBlendMode: 'screen',
                }}
            />

            {/* Secondary anamorphic streak (perpendicular) */}
            <div
                style={{
                    position: 'absolute',
                    left: `${flareX}%`,
                    top: `${flareY}%`,
                    width: flareSize * 2,
                    height: flareSize * 0.04,
                    background: `linear-gradient(90deg, transparent, rgba(${rgb.r},${rgb.g},${rgb.b},0.15), transparent)`,
                    transform: `translate(-50%, -50%) rotate(${angle + 90}deg)`,
                    filter: 'blur(3px)',
                    mixBlendMode: 'screen',
                }}
            />

            {/* Ghost flares */}
            {ghosts.map((ghost, i) => (
                <div
                    key={i}
                    style={{
                        position: 'absolute',
                        left: `${flareX + ghost.offsetX}%`,
                        top: `${flareY + ghost.offsetY}%`,
                        width: ghost.size,
                        height: ghost.size,
                        borderRadius: '50%',
                        background: `radial-gradient(circle, rgba(${rgb.r},${rgb.g},${rgb.b},${ghost.opacity}) 0%, transparent 70%)`,
                        transform: 'translate(-50%, -50%)',
                        mixBlendMode: 'screen',
                        filter: `blur(${ghost.size * 0.1}px)`,
                    }}
                />
            ))}

            {/* Iris hexagons */}
            {[0, 1, 2].map(i => {
                const hexX = flareX + (i - 1) * 8;
                const hexY = flareY + (i - 1) * 4;
                const hexSize = flareSize * (0.06 + i * 0.02);
                return (
                    <div
                        key={`hex-${i}`}
                        style={{
                            position: 'absolute',
                            left: `${hexX}%`,
                            top: `${hexY}%`,
                            width: hexSize,
                            height: hexSize,
                            borderRadius: '50%',
                            border: `1px solid rgba(${rgb.r},${rgb.g},${rgb.b},0.15)`,
                            transform: 'translate(-50%, -50%)',
                            mixBlendMode: 'screen',
                        }}
                    />
                );
            })}
        </div>
    );
};
