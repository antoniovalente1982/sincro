import { AbsoluteFill, useVideoConfig, useCurrentFrame, spring, Audio } from 'remotion';
import React, { useMemo } from 'react';

export interface WordTiming {
    word: string;
    startMs: number;
    endMs: number;
}

export interface SincroVideoProps {
    headline: string;
    audioBase64?: string | null;
    words?: WordTiming[];
}

export const SincroVideoTemplate: React.FC<SincroVideoProps> = ({ headline, audioBase64, words }) => {
    const { fps, height, width } = useVideoConfig();
    const frame = useCurrentFrame();

    // Convert current frame to milliseconds
    const currentMs = (frame / fps) * 1000;

    // Esempio: "Zoom Pattern Interrupt" attivato ogni 3 secondi (90 frame a 30fps)
    const zoomCycleMs = 3000;
    const isZoomed = Math.floor(currentMs / zoomCycleMs) % 2 === 1;
    const scale = spring({
        fps,
        frame: frame % (fps * 3), // Reset dell'animazione ogni 3 secondi
        config: { damping: 100 },
        from: isZoomed ? 1 : 1.1,
        to: isZoomed ? 1.1 : 1, // Cambia di un +10% la scala
    });

    // Trova la parola attualmente pronunciata
    const activeWordIndex = useMemo(() => {
        if (!words || words.length === 0) return -1;
        // Extend bounds slightly so words don't flicker off between tiny gaps
        return words.findIndex((w, i) => {
            const nextStart = i < words.length - 1 ? words[i+1].startMs : w.endMs + 500;
            return currentMs >= w.startMs && currentMs < nextStart;
        });
    }, [currentMs, words]);

    const activeWord = activeWordIndex >= 0 && words ? words[activeWordIndex].word : null;

    // Trigger grafici basati su parole chiave
    const isAlertWord = activeWord ? /potenziale|rischio|soldi|attenzione/i.test(activeWord) : false;

    // Animazione di "scatto" per ogni nuova parola
    // Start timing for the current word is words[activeWordIndex].startMs
    const wordStartFrame = activeWordIndex >= 0 && words ? (words[activeWordIndex].startMs / 1000) * fps : 0;
    const wordSpring = spring({
        fps,
        frame: frame - wordStartFrame,
        config: { damping: 12, mass: 0.5, stiffness: 200 },
        from: 0.5,
        to: 1
    });

    return (
        <AbsoluteFill style={{ backgroundColor: '#0B0F19', color: 'white', alignItems: 'center', justifyContent: 'center' }}>
            {/* Audio Sincronizzato */}
            {audioBase64 && (
                <Audio src={`data:audio/mp3;base64,${audioBase64}`} />
            )}

            {/* Sfondo/Avatar Simmulato */}
            <AbsoluteFill
                style={{
                    backgroundColor: '#1E293B',
                    transform: `scale(${scale})`, // Effetto zoom continuo o a scatti
                    transformOrigin: 'center center',
                    willChange: 'transform'
                }}
            />

            {/* Sottotitoli Dinamici (Stile Hormozi) */}
            {words && words.length > 0 ? (
                activeWord && (
                    <h1
                        style={{
                            fontFamily: 'Inter, sans-serif',
                            fontSize: isAlertWord ? 110 : 90,
                            fontWeight: '900',
                            textAlign: 'center',
                            textTransform: 'uppercase',
                            color: isAlertWord ? '#EF4444' : '#EAB308', /* Rosso per alert, giallo normale */
                            textShadow: '0 10px 30px rgba(0,0,0,0.8)',
                            zIndex: 10,
                            padding: '0 40px',
                            position: 'absolute',
                            top: height / 3,
                            transform: `scale(${wordSpring}) rotate(${isAlertWord ? '-3deg' : '0deg'})`,
                        }}
                    >
                        {activeWord.toUpperCase()}
                    </h1>
                )
            ) : (
                // Fallback testuale se non ci sono timings (es. prima della generazione)
                <h1
                    style={{
                        fontFamily: 'Inter, sans-serif',
                        fontSize: 80,
                        fontWeight: '900',
                        textAlign: 'center',
                        textTransform: 'uppercase',
                        color: '#EAB308',
                        textShadow: '0 10px 30px rgba(0,0,0,0.8)',
                        zIndex: 10,
                        padding: '0 40px',
                        position: 'absolute',
                        top: height / 4,
                    }}
                >
                    {headline}
                </h1>
            )}

            {/* Banner Metodo Sincro */}
            <div style={{ position: 'absolute', bottom: 100, fontSize: 40, fontWeight: 'bold', letterSpacing: 4 }}>
                METODO SINCRO
            </div>
        </AbsoluteFill>
    );
};
