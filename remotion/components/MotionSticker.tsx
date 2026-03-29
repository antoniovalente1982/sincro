import { useCurrentFrame, useVideoConfig, interpolate, spring } from 'remotion';
import React from 'react';

interface MotionStickerProps {
    startFrame: number;
    endFrame: number;
    type: 'arrow-point' | 'circle-highlight' | 'underline' | 'cross-out' | 'bracket' | 'star-burst' | 'checkmark' | 'exclamation';
    color?: string;
    size?: number; // 50-200% scale
    posX?: number; // percentage 0-100
    posY?: number; // percentage 0-100
    rotation?: number; // degrees
    animated?: boolean;
    lineWidth?: number;
}

/**
 * MotionSticker — Mini-widget animati stile motion graphics.
 * Frecce, cerchi, sottolineature e highlight come nei video di Leonardo.
 * Si disegnano in tempo reale con effetto "pencil draw".
 */
export const MotionSticker: React.FC<MotionStickerProps> = ({
    startFrame,
    endFrame,
    type,
    color = '#EAB308',
    size = 100,
    posX = 50,
    posY = 50,
    rotation = 0,
    animated = true,
    lineWidth = 5,
}) => {
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();

    if (frame < startFrame || frame > endFrame) return null;

    const elapsed = frame - startFrame;
    const totalFrames = endFrame - startFrame;

    // Draw progress (pencil effect)
    const drawProgress = spring({
        fps,
        frame: elapsed,
        config: { damping: 15, mass: 0.8, stiffness: 80 },
    });

    // Fade out
    const opacity = interpolate(
        frame,
        [startFrame, startFrame + 5, endFrame - 8, endFrame],
        [0, 1, 1, 0],
        { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
    );

    // Idle animation
    const wobble = animated ? Math.sin(elapsed * 0.1) * 2 : 0;
    const breathe = animated ? 1 + Math.sin(elapsed * 0.08) * 0.03 : 1;

    const scale = (size / 100) * breathe;
    const stickerWidth = 200;
    const stickerHeight = 200;

    const dashLength = 600; // total path length approximation
    const dashOffset = dashLength * (1 - drawProgress);

    const commonSvgStyle: React.CSSProperties = {
        position: 'absolute',
        left: `${posX}%`,
        top: `${posY}%`,
        width: stickerWidth,
        height: stickerHeight,
        transform: `translate(-50%, -50%) scale(${scale}) rotate(${rotation + wobble}deg)`,
        opacity,
        pointerEvents: 'none',
        overflow: 'visible',
    };

    const strokeStyle = {
        stroke: color,
        strokeWidth: lineWidth,
        fill: 'none',
        strokeLinecap: 'round' as const,
        strokeLinejoin: 'round' as const,
        strokeDasharray: dashLength,
        strokeDashoffset: dashOffset,
        filter: `drop-shadow(0 0 8px ${color}60)`,
    };

    const renderSticker = () => {
        switch (type) {
            case 'arrow-point':
                return (
                    <svg viewBox="0 0 200 200" style={commonSvgStyle}>
                        {/* Curved arrow pointing right-down */}
                        <path d="M 30 60 Q 80 30, 140 80 L 130 60 M 140 80 L 120 90" {...strokeStyle} />
                    </svg>
                );

            case 'circle-highlight':
                return (
                    <svg viewBox="0 0 200 200" style={commonSvgStyle}>
                        {/* Hand-drawn circle (slight imperfections) */}
                        <ellipse cx="100" cy="100" rx="75" ry="65"
                            {...strokeStyle}
                            transform="rotate(-5, 100, 100)"
                        />
                        {/* Second pass for hand-drawn feel */}
                        <ellipse cx="100" cy="100" rx="72" ry="68"
                            {...strokeStyle}
                            strokeWidth={lineWidth * 0.6}
                            opacity={0.4}
                            transform="rotate(3, 100, 100)"
                        />
                    </svg>
                );

            case 'underline':
                return (
                    <svg viewBox="0 0 200 200" style={commonSvgStyle}>
                        {/* Wavy underline */}
                        <path d="M 15 110 Q 50 95, 100 110 Q 150 125, 185 108" {...strokeStyle} />
                        {/* Small accent tick */}
                        <path d="M 185 108 L 178 100" {...strokeStyle} strokeWidth={lineWidth * 0.8} />
                    </svg>
                );

            case 'cross-out':
                return (
                    <svg viewBox="0 0 200 200" style={commonSvgStyle}>
                        {/* X marks */}
                        <path d="M 35 50 L 165 150" {...strokeStyle} />
                        <path d="M 165 50 L 35 150"
                            {...strokeStyle}
                            strokeDashoffset={dashLength * (1 - Math.min(1, drawProgress * 1.5 - 0.5))}
                        />
                    </svg>
                );

            case 'bracket':
                return (
                    <svg viewBox="0 0 200 200" style={commonSvgStyle}>
                        {/* Curly bracket left */}
                        <path d="M 60 30 Q 30 30, 30 100 Q 30 170, 60 170" {...strokeStyle} />
                        {/* Curly bracket right */}
                        <path d="M 140 30 Q 170 30, 170 100 Q 170 170, 140 170"
                            {...strokeStyle}
                            strokeDashoffset={dashLength * (1 - Math.min(1, drawProgress * 1.3 - 0.3))}
                        />
                    </svg>
                );

            case 'star-burst':
                return (
                    <svg viewBox="0 0 200 200" style={commonSvgStyle}>
                        {/* 6-point star burst */}
                        {[0, 60, 120, 180, 240, 300].map((angle, i) => {
                            const rad = (angle * Math.PI) / 180;
                            const x1 = 100 + Math.cos(rad) * 25;
                            const y1 = 100 + Math.sin(rad) * 25;
                            const x2 = 100 + Math.cos(rad) * 70;
                            const y2 = 100 + Math.sin(rad) * 70;
                            return (
                                <line key={i} x1={x1} y1={y1} x2={x2} y2={y2}
                                    {...strokeStyle}
                                    strokeDashoffset={dashLength * (1 - Math.min(1, drawProgress * 2 - i * 0.2))}
                                />
                            );
                        })}
                    </svg>
                );

            case 'checkmark':
                return (
                    <svg viewBox="0 0 200 200" style={commonSvgStyle}>
                        <path d="M 40 110 L 80 145 L 160 55" {...strokeStyle} />
                    </svg>
                );

            case 'exclamation':
                return (
                    <svg viewBox="0 0 200 200" style={commonSvgStyle}>
                        {/* Exclamation line */}
                        <path d="M 100 35 L 100 120" {...strokeStyle} strokeWidth={lineWidth * 1.5} />
                        {/* Dot */}
                        <circle cx="100" cy="152" r={lineWidth * 1.5}
                            fill={color}
                            opacity={Math.min(1, drawProgress * 2 - 0.5)}
                            filter={`drop-shadow(0 0 6px ${color}60)`}
                        />
                    </svg>
                );

            default:
                return null;
        }
    };

    return renderSticker();
};
