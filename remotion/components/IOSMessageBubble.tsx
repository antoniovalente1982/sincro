import React from 'react';
import { spring, useCurrentFrame, useVideoConfig } from 'remotion';

export const IOSMessageBubble: React.FC<{ startFrame: number, text: string }> = ({ startFrame, text }) => {
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();

    // Entrata pop con effetto molla tipico Apple
    const scale = spring({
        fps,
        frame: frame - startFrame,
        config: { damping: 12, mass: 0.5, stiffness: 180 },
        from: 0,
        to: 1,
    });

    if (frame < startFrame) return null;

    return (
        <div style={{
            transform: `scale(${scale})`,
            transformOrigin: 'bottom left',
            position: 'absolute',
            zIndex: 100, // Top layer
            /* Ombra base e posizionamento dinamico dall'alto */
            filter: 'drop-shadow(0px 10px 20px rgba(0,0,0,0.5))',
            top: 250, // Fissato in alto a sinistra (o centro/alto) rispetto allo schermo
            left: 100,
        }}>
            <div style={{
                backgroundColor: '#0A7AFF',
                backgroundImage: 'linear-gradient(135deg, #00C6FF 0%, #0072FF 100%)', // iMessage Blu Brillante
                color: 'white',
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
                fontSize: 60,
                fontWeight: '600',
                padding: '30px 50px',
                borderRadius: '50px 50px 50px 10px', // Codino Apple in basso a sinistra
                boxShadow: 'inset 0px 5px 15px rgba(255,255,255,0.3)',
                letterSpacing: '-1px'
            }}>
                {text}
                <div style={{
                        position: 'absolute',
                        bottom: '-10px',
                        left: '-5px',
                        width: '0',
                        height: '0',
                        borderLeft: '20px solid transparent',
                        borderRight: '20px solid transparent',
                        borderTop: '30px solid #0072FF',
                        transform: 'rotate(-45deg)',
                        zIndex: -1, 
                        display: 'none' /* O disabilitato per lasciare solo il border-radius a goccia */
                }}/>
            </div>
            {/* Animazione puntini di sospensione (Digitazione fake) */}
            <div style={{ display: 'flex', marginLeft: 40, marginTop: 10, gap: 15, position: 'absolute', right: 40, top: 40, opacity: 0.8 }}>
                <span style={{ fontSize: 60, lineHeight: '20px', animation: "pulse 1s infinite alternate" }}>.</span>
                <span style={{ fontSize: 60, lineHeight: '20px', animation: "pulse 1s infinite alternate 0.2s" }}>.</span>
                <span style={{ fontSize: 60, lineHeight: '20px', animation: "pulse 1s infinite alternate 0.4s" }}>.</span>
            </div>
        </div>
    );
};
