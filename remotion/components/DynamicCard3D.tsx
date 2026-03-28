import React from 'react';
import { Img, spring, useCurrentFrame, useVideoConfig } from 'remotion';

/**
 * DynamicCard3D — Card PIP sovrapposta allo speaker.
 * Entra da destra con tilt 3D e glow cinematico.
 * Posizionata in alto-destra per non coprire il volto.
 */
export const DynamicCard3D: React.FC<{ 
    startFrame: number; 
    endFrame?: number; 
    imageUrl: string; 
    rotationOffset?: number;
}> = ({ startFrame, endFrame, imageUrl, rotationOffset = -12 }) => {
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();

    // Non mostrare fuori dal range temporale
    if (frame < startFrame || (endFrame && frame > endFrame + fps)) return null;

    // Animazione di Entrata (Slide & Tilt da destra)
    const progressIn = spring({
        fps,
        frame: frame - startFrame,
        config: { damping: 14, mass: 0.8, stiffness: 120 },
        from: 0,
        to: 1,
    });

    // Animazione di Uscita
    const progressOut = endFrame ? spring({
        fps,
        frame: frame - endFrame,
        config: { damping: 14, mass: 0.8, stiffness: 120 },
        from: 0,
        to: 1,
    }) : 0;

    const progress = Math.max(0, progressIn - progressOut);

    // Effetto "float" leggero durante la permanenza
    const floatY = Math.sin((frame - startFrame) * 0.08) * 6;

    return (
        <div style={{
            position: 'absolute',
            /* Posizionata in alto a destra — non copre il volto dello speaker */
            right: 40,
            top: 180,
            width: 360,
            height: 480,
            /* Slide-in da destra + Tilt 3D + Float */
            transform: `
                perspective(1200px) 
                translateX(${600 - (progress * 600)}px) 
                translateY(${floatY}px)
                rotateY(${rotationOffset * progress}deg)
                scale(${0.8 + progress * 0.2})
            `,
            transformOrigin: 'center center',
            opacity: progress,
            /* Glow neon viola cinematico */
            boxShadow: `
                0 0 40px rgba(139, 92, 246, ${0.6 * progress}),
                0 20px 60px rgba(0, 0, 0, ${0.8 * progress}),
                inset 0 0 0 3px rgba(139, 92, 246, ${0.4 * progress})
            `,
            borderRadius: 24,
            overflow: 'hidden',
            /* Bordo luminoso */
            border: `3px solid rgba(139, 92, 246, ${0.6 * progress})`,
        }}>
            <Img 
                src={imageUrl} 
                style={{ 
                    width: '100%', 
                    height: '100%', 
                    objectFit: 'cover',
                    /* Parallax interno */
                    transform: `scale(${1 + (progress * 0.08)})`,
                }} 
            />
            {/* Label dinamica in fondo alla card */}
            <div style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                padding: '20px 16px 16px',
                background: 'linear-gradient(transparent, rgba(0,0,0,0.85))',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
            }}>
                <div style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    backgroundColor: '#22c55e',
                    boxShadow: '0 0 8px #22c55e',
                }} />
                <span style={{
                    color: 'white',
                    fontSize: 20,
                    fontWeight: 800,
                    fontFamily: 'Inter, sans-serif',
                    textShadow: '0 2px 8px rgba(0,0,0,0.8)',
                    letterSpacing: '-0.5px',
                }}>
                    METODO SINCRO
                </span>
            </div>
        </div>
    );
};
