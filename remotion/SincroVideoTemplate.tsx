import { AbsoluteFill, useVideoConfig, useCurrentFrame, interpolate, spring } from 'remotion';
import React from 'react';

export const SincroVideoTemplate: React.FC<{ headline: string }> = ({ headline }) => {
    const { fps, width, height } = useVideoConfig();
    const frame = useCurrentFrame();

    // Esempio: "Zoom Pattern Interrupt" attivato ogni 3 secondi (90 frame a 30fps)
    const isZoomed = Math.floor(frame / (fps * 3)) % 2 === 1;
    const scale = spring({
        fps,
        frame: frame % (fps * 3), // Reset dell'animazione ogni 3 secondi
        config: { damping: 100 },
        from: isZoomed ? 1 : 1.1,
        to: isZoomed ? 1.1 : 1, // Cambia di un +10% la scala
    });

    return (
        <AbsoluteFill style={{ backgroundColor: '#0B0F19', color: 'white', alignItems: 'center', justifyContent: 'center' }}>
            {/* Sfondo/Avatar Simmulato (che useremo con HeyGen MP4) */}
            <AbsoluteFill
                style={{
                    backgroundColor: '#1E293B',
                    transform: `scale(${scale})`, // Effetto zoom continuo o a scatti
                    transformOrigin: 'center center',
                    willChange: 'transform'
                }}
            >
                {/* 
                  Qui in futuro inseriremo <Video src={heyGenAvatarUrl} /> 
                  così lo scale verrà applicato direttamente al video reale.
                */}
            </AbsoluteFill>

            {/* Sottotitoli Dinamici (Stile Hormozi) simulati */}
            <h1
                style={{
                    fontFamily: 'Inter, sans-serif',
                    fontSize: 80,
                    fontWeight: '900',
                    textAlign: 'center',
                    textTransform: 'uppercase',
                    color: '#EAB308', /* Giallo fluo */
                    textShadow: '0 10px 30px rgba(0,0,0,0.8)',
                    zIndex: 10,
                    padding: '0 40px',
                    position: 'absolute',
                    top: height / 4,
                }}
            >
                {headline}
            </h1>

            {/* Banner Metodo Sincro */}
            <div style={{ position: 'absolute', bottom: 100, fontSize: 40, fontWeight: 'bold', letterSpacing: 4 }}>
                METODO SINCRO
            </div>
        </AbsoluteFill>
    );
};
