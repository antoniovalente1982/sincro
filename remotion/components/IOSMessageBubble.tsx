import React from 'react';
import { spring, useCurrentFrame, useVideoConfig } from 'remotion';

/**
 * IOSMessageBubble — Bolla iMessage con pulsante ▶️ play animato.
 * Stile OFMCosta / Ariele — "Sta scrivendo..." con play button che pulsa.
 */
export const IOSMessageBubble: React.FC<{ 
    startFrame: number; 
    text: string;
    showPlayButton?: boolean;
    yPosition?: number;
}> = ({ 
    startFrame, 
    text, 
    showPlayButton = true,
    yPosition = 130,
}) => {
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();

    if (frame < startFrame) return null;

    // Entrata pop con effetto molla Apple
    const scale = spring({
        fps,
        frame: frame - startFrame,
        config: { damping: 12, mass: 0.5, stiffness: 180 },
        from: 0,
        to: 1,
    });

    // Play button pulse
    const playPulse = Math.sin((frame - startFrame) * 0.15) * 0.1 + 1;

    // Float leggero
    const floatY = Math.sin((frame - startFrame) * 0.06) * 3;

    return (
        <div style={{
            transform: `scale(${scale}) translateY(${floatY}px)`,
            transformOrigin: 'center top',
            position: 'absolute',
            top: yPosition,
            left: '50%',
            marginLeft: -220,
            filter: 'drop-shadow(0px 12px 30px rgba(0,0,0,0.5))',
            display: 'flex',
            alignItems: 'center',
            gap: 14,
        }}>
            {/* Bolla messaggio */}
            <div style={{
                background: 'linear-gradient(135deg, #00C6FF 0%, #0072FF 100%)',
                color: 'white',
                fontFamily: '-apple-system, BlinkMacSystemFont, "Inter", sans-serif',
                fontSize: 28,
                fontWeight: 600,
                padding: '16px 28px',
                borderRadius: '28px 28px 28px 8px',
                boxShadow: 'inset 0px 2px 8px rgba(255,255,255,0.25), 0 8px 30px rgba(0,114,255,0.3)',
                letterSpacing: '-0.5px',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
            }}>
                {text}
                
                {/* Puntini di digitazione animati */}
                <div style={{ display: 'flex', gap: 4, marginLeft: 4 }}>
                    {[0, 1, 2].map(i => (
                        <div key={i} style={{
                            width: 7, height: 7,
                            borderRadius: '50%',
                            backgroundColor: 'rgba(255,255,255,0.7)',
                            opacity: 0.4 + Math.sin((frame - startFrame) * 0.2 + i * 1.5) * 0.6,
                            transform: `translateY(${Math.sin((frame - startFrame) * 0.2 + i * 1.5) * 3}px)`,
                        }} />
                    ))}
                </div>
            </div>

            {/* Play Button (tipo voice note) */}
            {showPlayButton && (
                <div style={{
                    width: 48, height: 48,
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #22C55E 0%, #16A34A 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transform: `scale(${playPulse})`,
                    boxShadow: '0 0 20px rgba(34,197,94,0.4), 0 4px 12px rgba(0,0,0,0.3)',
                }}>
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                        <path d="M6 4L16 10L6 16V4Z" fill="white" />
                    </svg>
                </div>
            )}
        </div>
    );
};
