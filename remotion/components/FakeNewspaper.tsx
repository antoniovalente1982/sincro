import React from 'react';
import { spring, useCurrentFrame, useVideoConfig } from 'remotion';

export const FakeNewspaper: React.FC<{ startFrame: number, endFrame?: number, headline: string }> = ({ startFrame, endFrame, headline }) => {
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();

    if (frame < startFrame || (endFrame && frame > endFrame + fps)) return null;

    // Slide up + rotate (Entrata)
    const progressIn = spring({
        fps,
        frame: frame - startFrame,
        config: { damping: 15, mass: 1, stiffness: 100 },
        from: 0,
        to: 1,
    });

    // Animazione di Uscita
    const progressOut = endFrame ? spring({
        fps,
        frame: frame - endFrame,
        config: { damping: 15, mass: 1, stiffness: 100 },
        from: 0,
        to: 1,
    }) : 0;

    // Progresso visivo totale
    const progress = progressIn - progressOut;

    return (
        <div style={{
            position: 'absolute',
            zIndex: 100, /* Davanti a tutto */
            left: 20, 
            top: 150,
            width: 700,
            backgroundColor: '#f9f9f9',
            /* Pattern a linee orizzontali per simulare la stampa di un quotidiano */
            backgroundImage: `repeating-linear-gradient(transparent, transparent 15px, rgba(0,0,0,0.05) 15px, rgba(0,0,0,0.05) 16px)`,
            /* Anima dal basso fuori schermo e ruota */
            transform: `translateY(${1000 - (progress * 1000)}px) rotate(${3 * progress}deg)`,
            transformOrigin: 'bottom left',
            boxShadow: '0px 30px 60px rgba(0,-0,0,0.7)',
            padding: '30px',
            borderRight: '10px solid #cc0000', // Stile "Sole 24 / Breaking"
            borderTopLeftRadius: '5px',
            borderBottomLeftRadius: '5px',
        }}>
            
            {/* Header / Testata del Finto Giornale */}
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 20, borderBottom: '2px solid #ddd', paddingBottom: 10 }}>
                <div style={{ backgroundColor: '#cc0000', color: 'white', padding: '5px 15px', fontWeight: 'bold', fontSize: 20 }}>
                    ECONOMIA & DIGITAL
                </div>
                <div style={{ marginLeft: 'auto', color: '#666', fontSize: 18, fontFamily: 'monospace' }}>
                    Oggi, 12:45
                </div>
            </div>

            {/* Titolo Principale in Font Elegante (Serif) */}
            <h2 style={{
                fontFamily: 'Times New Roman, Georgia, serif',
                fontSize: 55,
                fontWeight: '900',
                color: '#111',
                lineHeight: '1.1',
                margin: 0,
                letterSpacing: '-1px'
            }}>
                {headline}
            </h2>

             {/* Divider estetico */}
             <div style={{ marginTop: 20, height: 4, width: 100, backgroundColor: '#cc0000' }} />
        </div>
    );
};
