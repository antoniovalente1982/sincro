import React from 'react';
import { spring, useCurrentFrame, useVideoConfig } from 'remotion';

/**
 * FakeNewspaper — Breaking News sovrapposta allo speaker.
 * Entra dal basso con rotazione, stile Forbes/Corriere.
 * Si posiziona in centro-sinistra con tilt cinematico.
 */
export const FakeNewspaper: React.FC<{ 
    startFrame: number; 
    endFrame?: number; 
    headline: string;
}> = ({ startFrame, endFrame, headline }) => {
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();

    if (isNaN(startFrame) || frame < startFrame || (endFrame && frame > endFrame + fps)) return null;

    // Slide up + tilt (Entrata)
    const progressIn = spring({
        fps,
        frame: Math.max(0, frame - startFrame),
        config: { damping: 15, mass: 0.8, stiffness: 110 },
        from: 0,
        to: 1,
    });

    // Animazione di Uscita
    const progressOut = endFrame ? spring({
        fps,
        frame: Math.max(0, frame - endFrame),
        config: { damping: 15, mass: 0.8, stiffness: 110 },
        from: 0,
        to: 1,
    }) : 0;

    const progress = Math.max(0, progressIn - progressOut);

    // Float leggero durante la permanenza
    const floatY = Math.sin((frame - startFrame) * 0.06) * 4;

    return (
        <div style={{
            position: 'absolute',
            left: 40,
            top: 200,
            width: 580,
            /* Slide dal basso + Rotazione cinematica */
            transform: `
                translateY(${800 - (progress * 800) + floatY}px) 
                rotate(${2.5 * progress}deg) 
                scale(${0.85 + progress * 0.15})
            `,
            transformOrigin: 'bottom left',
            opacity: progress,
            /* Newspaper-style design */
            backgroundColor: '#faf8f5',
            backgroundImage: `repeating-linear-gradient(transparent, transparent 18px, rgba(0,0,0,0.03) 18px, rgba(0,0,0,0.03) 19px)`,
            boxShadow: `
                0 30px 60px rgba(0,0,0,0.7),
                0 0 0 1px rgba(0,0,0,0.1),
                inset 0 1px 0 rgba(255,255,255,0.8)
            `,
            padding: 30,
            borderRadius: 8,
            overflow: 'hidden',
        }}>
            {/* Banda rossa Breaking News */}
            <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: 6,
                background: 'linear-gradient(90deg, #dc2626, #ef4444, #dc2626)',
            }} />

            {/* Header / Testata */}
            <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                marginBottom: 20, 
                marginTop: 10,
                borderBottom: '2px solid #e5e5e5', 
                paddingBottom: 12,
            }}>
                <div style={{ 
                    backgroundColor: '#dc2626', 
                    color: 'white', 
                    padding: '6px 16px', 
                    fontWeight: 900, 
                    fontSize: 18, 
                    borderRadius: 4,
                    fontFamily: 'Inter, sans-serif',
                    letterSpacing: 1,
                    textTransform: 'uppercase',
                }}>
                    ⚡ BREAKING NEWS
                </div>
                <div style={{ 
                    marginLeft: 'auto', 
                    color: '#999', 
                    fontSize: 16, 
                    fontFamily: 'Inter, monospace',
                    fontWeight: 600,
                }}>
                    OGGI
                </div>
            </div>

            {/* Headlines */}
            <h2 style={{
                fontFamily: '"Times New Roman", Georgia, serif',
                fontSize: 46,
                fontWeight: 900,
                color: '#111',
                lineHeight: 1.15,
                margin: 0,
                letterSpacing: '-1.5px',
            }}>
                {headline}
            </h2>

            {/* Sottotesto finto */}
            <p style={{
                fontFamily: 'Inter, sans-serif',
                fontSize: 16,
                color: '#666',
                marginTop: 14,
                lineHeight: 1.5,
            }}>
                La notizia sta facendo il giro del web. Migliaia di commenti sui social in poche ore...
            </p>

        {/* Red accent bar & Read More Arrow */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 18 }}>
            <div style={{ height: 4, width: 80, backgroundColor: '#dc2626', borderRadius: 2 }} />
            
            {/* Freccia Arancione Cliccabile/Animata */}
            <div style={{
                display: 'flex', alignItems: 'center', gap: 6,
                color: '#f97316', fontWeight: 800, fontSize: 16,
                transform: `translateX(${Math.sin((frame - startFrame) * 0.3) * 5}px)`,
                textTransform: 'uppercase', letterSpacing: 1
            }}>
                <span style={{ fontSize: 12 }}>Leggi l'articolo</span>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12h14"></path>
                    <path d="M12 5l7 7-7 7"></path>
                </svg>
            </div>
        </div>
    </div>
  );
};
