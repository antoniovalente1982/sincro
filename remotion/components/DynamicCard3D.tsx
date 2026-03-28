import React from 'react';
import { Img, spring, useCurrentFrame, useVideoConfig } from 'remotion';

// Questo componente si piazza al centro-destra (o sinistra) dietro lo speaker.
export const DynamicCard3D: React.FC<{ startFrame: number, imageUrl: string, rotationOffset?: number }> = ({ startFrame, imageUrl, rotationOffset = -15 }) => {
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();

    // Animazione di "Slide & Tilt"
    const progress = spring({
        fps,
        frame: frame - startFrame,
        config: { damping: 14, mass: 1, stiffness: 100 },
        from: 0,
        to: 1,
    });

    if (frame < startFrame) return null;

    return (
        <div style={{
            position: 'absolute',
            zIndex: 20, /* Sta DIETRO allo Z=50 (Foreground speaker) */
            right: 150, 
            top: 300,
            /* Anima l'ingresso da destra (fuori schermo) e inclina verso la camera */
            transform: `perspective(1200px) translateX(${1500 - (progress * 1500)}px) rotateY(${rotationOffset * progress}deg)`,
            transformOrigin: 'left center',
            /* Glow dinamico */
            boxShadow: `0px 50px 100px rgba(100, 0, 255, ${0.4 * progress})`,
            borderRadius: '40px',
            overflow: 'hidden',
        }}>
            {/* L'immagine dentro la card finta */ }
            <Img 
                src={imageUrl} 
                style={{ 
                    width: 600, 
                    height: 800, 
                    objectFit: 'cover',
                    /* Effetto di scala interno per farla sembrare un video in parallasse */
                    transform: `scale(${1 + (progress * 0.1)})`
                }} 
            />
        </div>
    );
};
