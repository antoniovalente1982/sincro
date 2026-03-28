import React, { useMemo } from 'react';
import { interpolate, random, useCurrentFrame, useVideoConfig } from 'remotion';

export const FallingMoney: React.FC<{ startFrame: number, durationFrames?: number }> = ({ startFrame, durationFrames = 90 }) => {
    const frame = useCurrentFrame();
    const { fps, width, height } = useVideoConfig();

    // Generiamo in memoria fissa 35 "banconote" casuali
    const banknotes = useMemo(() => {
        const particles = [];
        for (let i = 0; i < 35; i++) {
            particles.push({
                xStart: random(`x-${i}`) * width,           // Posizione orizzontale di partenza (0 a Width)
                yOffset: random(`y-${i}`) * height,         // Sfalsamento d'ingresso verticale (scendono in momenti diversi)
                speed: 1 + random(`speed-${i}`) * 2,        // Velocità di gravità
                rotateZ: random(`rot-${i}`) * 360,          // Rotazione di base su se stessa 
                rotateDir: random(`dir-${i}`) > 0.5 ? 1 : -1, // Rotazione oraria o antioraria
                scale: 0.5 + random(`scale-${i}`) * 0.8,    // Mix di banconote vicine e lontane (Profondità)
            });
        }
        return particles;
    }, [width, height]);

    // Non montare nulla se siamo prima dell'innesco o se i frame sono invalidi
    if (isNaN(startFrame) || frame < startFrame) return null;
    
    // Fermiamo l'effetto dopo X secondi se lo desideriamo
    if (frame > startFrame + durationFrames) return null;

    const currentLocalFrame = Math.max(0, frame - startFrame);

    return (
        <div style={{ position: 'absolute', width: '100%', height: '100%', overflow: 'hidden', zIndex: 10 }}>
            {banknotes.map((note, index) => {
                
                // Progressione della caduta nel tempo
                const yPos = interpolate(
                    currentLocalFrame,
                    [0, 60], // In 60 frame (2 secondi)
                    [-200 - note.yOffset, height + 200], // Dal cielo fino in basso
                    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } // Finito il tragitto sparisce giù
                ) * note.speed; // Moltiplicatore gravità individuale

                // Sfarfallio 3D mentre cade (Rotazione Y per farlo sembrare aria)
                const flap = interpolate(
                    currentLocalFrame, 
                    [0, 30], 
                    [0, 360 * note.rotateDir], 
                    { extrapolateRight: 'extend' } // Gira finchè non scompare
                );

                return (
                    <div
                        key={index}
                        style={{
                            position: 'absolute',
                            left: note.xStart,
                            top: yPos,
                            transform: `scale(${note.scale}) rotateZ(${note.rotateZ + flap}deg) rotateY(${flap}deg)`,
                            transformOrigin: 'center center',
                            boxShadow: '0 10px 20px rgba(0,0,0,0.5)',
                            
                            // Stile Banconota 100$ minimalista
                            width: 150,
                            height: 70,
                            backgroundColor: '#409951',
                            border: '4px solid #fff',
                            borderRadius: '5px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            opacity: 0.9
                        }}
                    >
                         {/* Watermark fake del dollaro */}
                        <div style={{
                            width: 40,
                            height: 40,
                            borderRadius: '50%',
                            border: '2px solid rgba(255,255,255,0.5)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'rgba(255,255,255,0.7)',
                            fontWeight: 'bold',
                            fontFamily: 'serif',
                            fontSize: 24
                        }}>
                            $
                        </div>
                    </div>
                );
            })}
        </div>
    );
};
