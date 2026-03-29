import { useCurrentFrame, useVideoConfig, interpolate, spring } from 'remotion';
import React from 'react';

interface CinematicBarsProps {
    startFrame: number;
    endFrame: number;
    barSize?: number; // percentage of screen height (0-25)
    color?: string;
    animation?: 'slide' | 'fade' | 'instant';
}

export const CinematicBars: React.FC<CinematicBarsProps> = ({
    startFrame,
    endFrame,
    barSize = 12,
    color = '#000000',
    animation = 'slide',
}) => {
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();

    if (frame < startFrame || frame > endFrame) return null;

    const clampedBarSize = Math.min(25, Math.max(2, barSize));

    let barHeight: number;

    switch (animation) {
        case 'slide': {
            const inProgress = spring({
                frame: frame - startFrame,
                fps,
                config: { damping: 15, mass: 0.8, stiffness: 80 },
            });
            const outProgress = frame > endFrame - 20 
                ? interpolate(frame, [endFrame - 20, endFrame], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
                : 1;
            barHeight = clampedBarSize * inProgress * outProgress;
            break;
        }
        case 'fade': {
            barHeight = clampedBarSize;
            break;
        }
        case 'instant':
        default: {
            barHeight = clampedBarSize;
            break;
        }
    }

    const opacity = animation === 'fade'
        ? interpolate(
            frame,
            [startFrame, startFrame + 15, endFrame - 15, endFrame],
            [0, 1, 1, 0],
            { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
        )
        : 1;

    return (
        <>
            {/* Top bar */}
            <div
                style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    height: `${barHeight}%`,
                    backgroundColor: color,
                    opacity,
                    pointerEvents: 'none',
                    zIndex: 999,
                }}
            />
            {/* Bottom bar */}
            <div
                style={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    height: `${barHeight}%`,
                    backgroundColor: color,
                    opacity,
                    pointerEvents: 'none',
                    zIndex: 999,
                }}
            />
            {/* Subtle inner shadow for depth */}
            <div
                style={{
                    position: 'absolute',
                    top: `${barHeight}%`,
                    left: 0,
                    right: 0,
                    height: '3%',
                    background: `linear-gradient(180deg, rgba(0,0,0,0.3), transparent)`,
                    opacity: opacity * 0.5,
                    pointerEvents: 'none',
                    zIndex: 999,
                }}
            />
            <div
                style={{
                    position: 'absolute',
                    bottom: `${barHeight}%`,
                    left: 0,
                    right: 0,
                    height: '3%',
                    background: `linear-gradient(0deg, rgba(0,0,0,0.3), transparent)`,
                    opacity: opacity * 0.5,
                    pointerEvents: 'none',
                    zIndex: 999,
                }}
            />
        </>
    );
};
