import React from 'react';
import { Img, spring, useCurrentFrame, useVideoConfig } from 'remotion';

/**
 * SwipeCard — Card che entra dal basso con swipe-up.
 * Contiene miniatura, titolo articolo e freccia arancione.
 * Stile Instagram Story / OFMCosta.
 */
export const SwipeCard: React.FC<{
    startFrame: number;
    endFrame?: number;
    title: string;
    subtitle?: string;
    thumbnailUrl?: string;
    accentColor?: string;
}> = ({
    startFrame,
    endFrame,
    title,
    subtitle,
    thumbnailUrl,
    accentColor = '#F97316',
}) => {
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();

    if (isNaN(startFrame) || frame < startFrame) return null;
    if (endFrame && frame > endFrame + fps) return null;

    // Swipe-up con spring
    const progressIn = spring({
        fps,
        frame: Math.max(0, frame - startFrame),
        config: { damping: 15, mass: 0.6, stiffness: 140 },
    });

    const progressOut = endFrame ? spring({
        fps,
        frame: Math.max(0, frame - endFrame),
        config: { damping: 14, stiffness: 100 },
    }) : 0;

    const progress = Math.max(0, progressIn - progressOut);
    const translateY = (1 - progress) * 400; // Entra dal basso

    // Freccia bounce
    const arrowBounce = Math.sin((frame - startFrame) * 0.15) * 4;

    return (
        <div style={{
            position: 'absolute',
            left: '50%',
            top: '20%',
            transform: `translateX(-50%) translateY(${translateY}px)`,
            opacity: progress,
            width: '85%',
            maxWidth: 480,
        }}>
            <div style={{
                background: 'linear-gradient(145deg, rgba(30,30,30,0.95) 0%, rgba(20,20,20,0.98) 100%)',
                borderRadius: 20,
                overflow: 'hidden',
                border: `2px solid ${accentColor}40`,
                boxShadow: `
                    0 20px 60px rgba(0,0,0,0.7),
                    0 0 30px ${accentColor}15,
                    inset 0 1px 0 rgba(255,255,255,0.08)
                `,
            }}>
                {/* Header con thumbnail */}
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '16px 20px',
                    borderBottom: '1px solid rgba(255,255,255,0.06)',
                }}>
                    {thumbnailUrl && (
                        <Img
                            src={thumbnailUrl}
                            style={{
                                width: 48,
                                height: 48,
                                borderRadius: 12,
                                objectFit: 'cover',
                                border: `2px solid ${accentColor}50`,
                            }}
                        />
                    )}
                    {!thumbnailUrl && (
                        <div style={{
                            width: 48, height: 48, borderRadius: 12,
                            background: `linear-gradient(135deg, ${accentColor}40, ${accentColor}20)`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 22,
                        }}>
                            📰
                        </div>
                    )}
                    <div style={{ flex: 1 }}>
                        <div style={{
                            color: accentColor,
                            fontSize: 11,
                            fontWeight: 700,
                            fontFamily: 'Inter, sans-serif',
                            textTransform: 'uppercase',
                            letterSpacing: 2,
                        }}>
                            Breaking News
                        </div>
                        <div style={{
                            color: 'rgba(255,255,255,0.4)',
                            fontSize: 10,
                            fontFamily: 'Inter, sans-serif',
                            marginTop: 2,
                        }}>
                            Metodo Sincro • Aggiornamento
                        </div>
                    </div>
                    {/* Freccia arancione animata */}
                    <div style={{
                        width: 36, height: 36,
                        borderRadius: '50%',
                        backgroundColor: accentColor,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        transform: `translateX(${arrowBounce}px)`,
                        boxShadow: `0 0 15px ${accentColor}60`,
                    }}>
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                            <path d="M3 8H13M13 8L9 4M13 8L9 12" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                    </div>
                </div>

                {/* Body con titolo */}
                <div style={{ padding: '20px 20px 24px' }}>
                    <div style={{
                        color: 'white',
                        fontSize: 26,
                        fontWeight: 800,
                        fontFamily: "'Inter', sans-serif",
                        lineHeight: 1.25,
                        letterSpacing: '-0.5px',
                    }}>
                        {title}
                    </div>
                    {subtitle && (
                        <div style={{
                            color: 'rgba(255,255,255,0.5)',
                            fontSize: 14,
                            fontFamily: 'Inter, sans-serif',
                            marginTop: 10,
                            lineHeight: 1.4,
                        }}>
                            {subtitle}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
