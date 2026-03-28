import React from 'react';
import { interpolate, useCurrentFrame, useVideoConfig } from 'remotion';

/**
 * ZoomPulse — Wrappa il contenuto e applica un zoom rapido (punch-in)
 * su parole chiave. Come un camera operator che fa zoom improvviso.
 * 
 * USAGE: Avvolgi l'intero contenuto video con <ZoomPulse> per applicare
 * l'effetto globalmente quando triggerato.
 */
export const ZoomPulse: React.FC<{
    children: React.ReactNode;
    triggerFrames: number[]; // Array di frame in cui triggerare lo zoom
    intensity?: number; // 1.0 = leggero, 1.3 = forte
    duration?: number; // durata in frames
}> = ({
    children,
    triggerFrames = [],
    intensity = 1.12,
    duration = 8,
}) => {
    const frame = useCurrentFrame();

    // Trova il trigger più vicino attivo
    let zoomScale = 1;
    for (const trigger of triggerFrames) {
        const elapsed = frame - trigger;
        if (elapsed >= 0 && elapsed < duration) {
            // Zoom in rapido, zoom out smooth
            const progress = elapsed / duration;
            const eased = Math.sin(progress * Math.PI); // curva 0→1→0
            const currentZoom = 1 + (intensity - 1) * eased;
            zoomScale = Math.max(zoomScale, currentZoom);
        }
    }

    return (
        <div style={{
            width: '100%',
            height: '100%',
            transform: `scale(${zoomScale})`,
            transformOrigin: 'center center',
            willChange: 'transform',
        }}>
            {children}
        </div>
    );
};
