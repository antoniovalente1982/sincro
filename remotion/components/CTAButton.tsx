import React from 'react';
import { spring, useCurrentFrame, useVideoConfig } from 'remotion';

/**
 * CTAButton — Bottone rosso pill "Scopri di più >" stile Instagram Ads.
 * Appare dal basso con slide-up + pulse glow continuo.
 */
export const CTAButton: React.FC<{
    startFrame: number;
    endFrame?: number;
    text?: string;
    color?: string;
    yPosition?: number;
}> = ({
    startFrame,
    endFrame,
    text = 'Scopri di più',
    color = '#ef4444',
    yPosition = 88,
}) => {
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();

    if (frame < startFrame) return null;
    if (endFrame && frame > endFrame + fps) return null;

    // Slide-up con spring
    const progressIn = spring({
        fps,
        frame: frame - startFrame,
        config: { damping: 14, mass: 0.7, stiffness: 130 },
    });

    const progressOut = endFrame ? spring({
        fps,
        frame: frame - endFrame,
        config: { damping: 14, stiffness: 100 },
    }) : 0;

    const progress = Math.max(0, progressIn - progressOut);
    const translateY = (1 - progress) * 120;

    // Pulse glow continuo
    const pulse = Math.sin((frame - startFrame) * 0.12) * 0.3 + 0.7;

    // Freccia che si muove
    const arrowX = Math.sin((frame - startFrame) * 0.2) * 5;

    return (
        <div style={{
            position: 'absolute',
            left: '50%',
            top: `${yPosition}%`,
            transform: `translateX(-50%) translateY(${translateY}px)`,
            opacity: progress,
        }}>
            <div style={{
                background: `linear-gradient(135deg, ${color} 0%, ${color}dd 100%)`,
                borderRadius: 50,
                padding: '18px 40px 18px 32px',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                boxShadow: `
                    0 0 ${30 * pulse}px ${color}80,
                    0 8px 30px rgba(0,0,0,0.5),
                    inset 0 1px 0 rgba(255,255,255,0.2)
                `,
                cursor: 'pointer',
                minWidth: 240,
                justifyContent: 'center',
            }}>
                <span style={{
                    color: 'white',
                    fontSize: 22,
                    fontWeight: 800,
                    fontFamily: 'Inter, sans-serif',
                    letterSpacing: '-0.3px',
                    textShadow: '0 2px 4px rgba(0,0,0,0.3)',
                }}>
                    {text}
                </span>
                
                {/* Freccia animata */}
                <div style={{
                    transform: `translateX(${arrowX}px)`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 32,
                    height: 32,
                    borderRadius: '50%',
                    backgroundColor: 'rgba(255,255,255,0.2)',
                }}>
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                        <path d="M3 8H13M13 8L9 4M13 8L9 12" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                </div>
            </div>
        </div>
    );
};
