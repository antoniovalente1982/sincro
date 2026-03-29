import { useCurrentFrame, useVideoConfig, interpolate } from 'remotion';
import React from 'react';

interface SpeedRampProps {
    startFrame: number;
    endFrame: number;
    type?: 'slow-motion' | 'fast-forward' | 'freeze' | 'pulse';
    intensity?: number; // 0.1 (very slow) to 4.0 (very fast)
}

export const SpeedRamp: React.FC<SpeedRampProps> = ({
    startFrame,
    endFrame,
    type = 'slow-motion',
    intensity = 0.5,
}) => {
    const frame = useCurrentFrame();

    if (frame < startFrame || frame > endFrame) return null;

    const elapsed = frame - startFrame;
    const totalFrames = endFrame - startFrame;

    const opacity = interpolate(
        frame,
        [startFrame, startFrame + 5, endFrame - 5, endFrame],
        [0, 1, 1, 0],
        { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
    );

    // Visual indicators for speed changes (since we can't actually change playback speed in Remotion overlay)
    let motionBlurAmount = 0;
    let radialBlurAmount = 0;
    let overlayColor = 'transparent';
    let timeText = '';

    switch (type) {
        case 'slow-motion':
            motionBlurAmount = 2;
            overlayColor = 'rgba(0,100,255,0.06)';
            timeText = `${intensity}x`;
            break;
        case 'fast-forward':
            motionBlurAmount = 8 * intensity;
            radialBlurAmount = 2;
            overlayColor = 'rgba(255,100,0,0.06)';
            timeText = `${intensity}x`;
            break;
        case 'freeze':
            overlayColor = 'rgba(200,220,255,0.1)';
            timeText = '⏸';
            break;
        case 'pulse':
            const pulsePhase = Math.sin(elapsed * 0.15);
            motionBlurAmount = Math.abs(pulsePhase) * 6;
            overlayColor = pulsePhase > 0 ? 'rgba(255,100,0,0.04)' : 'rgba(0,100,255,0.04)';
            timeText = pulsePhase > 0 ? '▶▶' : '▶';
            break;
    }

    return (
        <div
            style={{
                position: 'absolute',
                inset: 0,
                pointerEvents: 'none',
                opacity,
            }}
        >
            {/* Motion blur simulation */}
            {motionBlurAmount > 0 && (
                <div
                    style={{
                        position: 'absolute',
                        inset: 0,
                        backdropFilter: `blur(${motionBlurAmount}px)`,
                        WebkitBackdropFilter: `blur(${motionBlurAmount}px)`,
                    }}
                />
            )}

            {/* Radial zoom blur for fast-forward */}
            {radialBlurAmount > 0 && (
                <div
                    style={{
                        position: 'absolute',
                        inset: 0,
                        background: 'radial-gradient(circle at 50% 50%, transparent 60%, rgba(0,0,0,0.15) 100%)',
                    }}
                />
            )}

            {/* Color tint overlay */}
            <div
                style={{
                    position: 'absolute',
                    inset: 0,
                    backgroundColor: overlayColor,
                }}
            />

            {/* Freeze frame scanlines */}
            {type === 'freeze' && (
                <div
                    style={{
                        position: 'absolute',
                        inset: 0,
                        backgroundImage: `repeating-linear-gradient(
                            0deg, transparent, transparent 3px, rgba(255,255,255,0.03) 3px, rgba(255,255,255,0.03) 4px
                        )`,
                    }}
                />
            )}

            {/* Speed indicator badge */}
            <div
                style={{
                    position: 'absolute',
                    top: 60,
                    right: 40,
                    background: 'rgba(0,0,0,0.6)',
                    backdropFilter: 'blur(12px)',
                    padding: '12px 24px',
                    borderRadius: 12,
                    border: '1px solid rgba(255,255,255,0.15)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                }}
            >
                <div
                    style={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        backgroundColor: type === 'freeze' ? '#60A5FA' : type === 'slow-motion' ? '#818CF8' : '#F97316',
                        boxShadow: `0 0 8px ${type === 'freeze' ? '#60A5FA' : type === 'slow-motion' ? '#818CF8' : '#F97316'}`,
                    }}
                />
                <span
                    style={{
                        fontFamily: 'Inter, monospace',
                        fontSize: 24,
                        fontWeight: 700,
                        color: 'white',
                        letterSpacing: 2,
                    }}
                >
                    {timeText}
                </span>
            </div>
        </div>
    );
};
