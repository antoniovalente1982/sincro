import React, { useMemo } from 'react';
import { spring, useCurrentFrame, useVideoConfig } from 'remotion';

interface BlockSubtitlesProps {
    words: { word: string; startMs: number; endMs: number; emoji?: string; isImpact?: boolean }[];
    wordsPerBlock?: number;
    yPosition?: number; // Distanza dal fondo
}

/**
 * BlockSubtitles — Sottotitoli stile TikTok/Hormozi a blocchi di 2-3 parole.
 * Le parole normali sono bianche con text-shadow pesante.
 * Le parole "impact" hanno sfondo giallo #EAB308, testo nero, rotazione -2deg.
 */
export const BlockSubtitles: React.FC<BlockSubtitlesProps> = ({ 
    words, 
    wordsPerBlock = 3,
    yPosition = 420,
}) => {
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();
    const currentMs = (frame / fps) * 1000;

    // Raggruppa le parole in blocchi di N
    const blocks = useMemo(() => {
        const result: typeof words[] = [];
        for (let i = 0; i < words.length; i += wordsPerBlock) {
            result.push(words.slice(i, i + wordsPerBlock));
        }
        return result;
    }, [words, wordsPerBlock]);

    // Trova il blocco attivo in base al tempo corrente
    const activeBlockIndex = useMemo(() => {
        for (let i = blocks.length - 1; i >= 0; i--) {
            const block = blocks[i];
            if (block.length > 0 && currentMs >= block[0].startMs) {
                // Controlla che non siamo troppo oltre la fine del blocco
                const blockEnd = block[block.length - 1].endMs;
                if (currentMs <= blockEnd + 300) { // 300ms di grazia
                    return i;
                }
            }
        }
        return -1;
    }, [blocks, currentMs]);

    if (activeBlockIndex < 0) return null;

    const activeBlock = blocks[activeBlockIndex];
    const blockStartMs = activeBlock[0].startMs;
    const blockStartFrame = Math.floor((blockStartMs / 1000) * fps);

    // Spring di entrata del blocco
    const blockProgress = spring({
        fps,
        frame: frame - blockStartFrame,
        config: { damping: 14, mass: 0.6, stiffness: 180 },
        from: 0,
        to: 1,
    });

    // Leggero bounce verticale
    const bounceY = spring({
        fps,
        frame: frame - blockStartFrame,
        config: { damping: 8, mass: 0.4, stiffness: 250 },
        from: 40,
        to: 0,
    });

    return (
        <div style={{
            position: 'absolute',
            bottom: yPosition,
            left: 0,
            right: 0,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 12,
            padding: '0 40px',
            transform: `translateY(${bounceY}px) scale(${0.85 + blockProgress * 0.15})`,
            opacity: blockProgress,
        }}>
            {activeBlock.map((wordData, i) => {
                // Ogni parola nel blocco ha un leggero delay di entrata
                const wordDelay = i * 2; // 2 frame di delay per parola
                const wordFrame = blockStartFrame + wordDelay;
                
                const wordScale = spring({
                    fps,
                    frame: frame - wordFrame,
                    config: { damping: 12, mass: 0.5, stiffness: 200 },
                    from: 0.3,
                    to: 1,
                });

                const isImpact = wordData.isImpact;

                return (
                    <div
                        key={`${activeBlockIndex}-${i}`}
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 8,
                            transform: `scale(${wordScale})${isImpact ? ' rotate(-2deg)' : ''}`,
                            transformOrigin: 'center center',
                        }}
                    >
                        {/* Emoji prima della parola impact */}
                        {isImpact && wordData.emoji && (
                            <span style={{
                                fontSize: 70,
                                filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.5))',
                                lineHeight: 1,
                            }}>
                                {wordData.emoji}
                            </span>
                        )}
                        
                        {/* La parola */}
                        <span style={{
                            fontFamily: '"Inter", sans-serif',
                            fontSize: isImpact ? 95 : 85,
                            fontWeight: 900,
                            textTransform: 'uppercase',
                            letterSpacing: '-2px',
                            lineHeight: 1.1,
                            // Impact: sfondo giallo, testo nero
                            // Normale: testo bianco con ombra pesante
                            color: isImpact ? '#0B0F19' : '#FFFFFF',
                            backgroundColor: isImpact ? '#EAB308' : 'transparent',
                            padding: isImpact ? '6px 20px 10px' : '0 4px',
                            borderRadius: isImpact ? '6px 16px 4px 18px' : '0',
                            boxShadow: isImpact 
                                ? '0 0 40px rgba(234, 179, 8, 0.5), 0 8px 20px rgba(0,0,0,0.4)' 
                                : 'none',
                            textShadow: isImpact 
                                ? 'none' 
                                : '0 4px 20px rgba(0,0,0,0.9), 0 2px 4px rgba(0,0,0,0.8), 2px 2px 0 rgba(0,0,0,0.6)',
                        }}>
                            {wordData.word.toUpperCase()}
                        </span>
                    </div>
                );
            })}
        </div>
    );
};
