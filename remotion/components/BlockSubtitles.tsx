import React, { useMemo } from 'react';
import { spring, useCurrentFrame, useVideoConfig } from 'remotion';

interface BlockSubtitlesProps {
    words: { word: string; startMs: number; endMs: number; emoji?: string; isImpact?: boolean }[];
    wordsPerBlock?: number;
    yPosition?: number;
    subStyle?: 'tiktok' | 'impact' | 'karaoke' | 'cyber-scanline';
}

/**
 * BlockSubtitles — Sottotitoli dinamici multiformato
 */
export const BlockSubtitles: React.FC<BlockSubtitlesProps> = ({ 
    words, 
    wordsPerBlock = 3,
    yPosition = 420,
    subStyle = 'impact',
}) => {
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();
    const currentMs = (frame / fps) * 1000;

    const blocks = useMemo(() => {
        const result: typeof words[] = [];
        for (let i = 0; i < words.length; i += wordsPerBlock) {
            result.push(words.slice(i, i + wordsPerBlock));
        }
        return result;
    }, [words, wordsPerBlock]);

    const activeBlockIndex = useMemo(() => {
        for (let i = blocks.length - 1; i >= 0; i--) {
            const block = blocks[i];
            if (block.length > 0 && currentMs >= block[0].startMs) {
                const blockEnd = block[block.length - 1].endMs;
                if (currentMs <= blockEnd + 400) return i; // 400ms grace
            }
        }
        return -1;
    }, [blocks, currentMs]);

    if (activeBlockIndex < 0) return null;

    const activeBlock = blocks[activeBlockIndex];
    const blockStartMs = activeBlock[0].startMs;
    const blockStartFrame = Math.floor((blockStartMs / 1000) * fps);

    const blockProgress = spring({
        fps, frame: frame - blockStartFrame, config: { damping: 14, mass: 0.6, stiffness: 180 },
    });
    const bounceY = spring({
        fps, frame: frame - blockStartFrame, config: { damping: 8, mass: 0.4, stiffness: 250 }, from: 40, to: 0,
    });

    return (
        <div style={{
            position: 'absolute', bottom: yPosition, left: 0, right: 0,
            display: 'flex', justifyContent: 'center', alignItems: 'center', flexWrap: 'wrap',
            gap: subStyle === 'tiktok' ? 6 : 12,
            padding: '0 40px',
            transform: `translateY(${bounceY}px) scale(${0.85 + blockProgress * 0.15})`,
            opacity: blockProgress,
        }}>
            {activeBlock.map((wordData, i) => {
                const wordFrame = blockStartFrame + (i * 2);                
                const wordScale = spring({
                    fps, frame: frame - wordFrame, config: { damping: 12, mass: 0.5, stiffness: 200 }, from: 0.3, to: 1,
                });

                const isImpact = wordData.isImpact;
                const isSpoken = currentMs >= wordData.startMs && currentMs <= wordData.endMs + 200;
                const isPast = currentMs >= wordData.startMs;

                // --- STILE IMPACT ---
                if (subStyle === 'impact') {
                    return (
                        <div key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, transform: `scale(${wordScale})${isImpact ? ' rotate(-2deg)' : ''}` }}>
                            {isImpact && wordData.emoji && typeof wordData.emoji === 'string' && (
                                <span style={{ fontSize: 70, filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.5))' }}>{wordData.emoji}</span>
                            )}
                            <span style={{
                                fontFamily: '"Inter", sans-serif', fontSize: isImpact || isSpoken ? 95 : 85,
                                fontWeight: 900, textTransform: 'uppercase', letterSpacing: '-2px',
                                color: isImpact ? '#0B0F19' : (isSpoken ? '#FCD34D' : '#FFFFFF'),
                                backgroundColor: isImpact ? '#EAB308' : 'transparent',
                                padding: isImpact ? '6px 20px 10px' : '0 4px',
                                borderRadius: isImpact ? '6px 16px 4px 18px' : '0',
                                boxShadow: isImpact ? '0 0 40px rgba(234, 179, 8, 0.5), 0 8px 20px rgba(0,0,0,0.4)' : 'none',
                                textShadow: isImpact ? 'none' : '0 4px 20px rgba(0,0,0,0.9), 0 2px 4px rgba(0,0,0,0.8), 2px 2px 0 rgba(0,0,0,0.6)',
                                transition: 'color 0.1s, font-size 0.1s'
                            }}>
                                {wordData.word}
                            </span>
                        </div>
                    );
                }

                // --- STILE TIKTOK ---
                if (subStyle === 'tiktok') {
                    return (
                        <div key={i} style={{ display: 'inline-flex', transform: `scale(${wordScale})` }}>
                            <span style={{
                                fontFamily: '"Roboto", sans-serif', fontSize: 60, fontWeight: 700,
                                color: isSpoken ? '#FFF' : '#E5E5E5',
                                backgroundColor: isSpoken ? 'rgba(0,0,0,0.85)' : 'rgba(0,0,0,0.4)',
                                padding: '4px 12px',
                                borderRadius: '8px',
                                textShadow: '2px 2px 0 #000, -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000',
                                border: isSpoken ? '2px solid rgba(255,255,255,0.2)' : '2px solid transparent',
                                transform: isSpoken ? 'scale(1.1) translateY(-5px)' : 'none',
                                transition: 'all 0.1s'
                            }}>
                                {wordData.word}
                            </span>
                        </div>
                    );
                }

                // --- STILE KARAOKE ---
                if (subStyle === 'karaoke') {
                    return (
                        <div key={i} style={{ display: 'inline-flex', transform: `scale(${wordScale})` }}>
                            <span style={{
                                fontFamily: '"Outfit", "Inter", sans-serif', fontSize: 80, fontWeight: 900,
                                textTransform: 'uppercase', letterSpacing: '-1px',
                                // Grigio semitrasparente finché non viene detto, verde acceso quando detto
                                color: isPast ? '#4ADE80' : 'rgba(255,255,255,0.3)',
                                textShadow: isPast ? '0 0 20px rgba(74, 222, 128, 0.6), 0 4px 10px rgba(0,0,0,0.8)' : '0 2px 4px rgba(0,0,0,0.8)',
                                WebkitTextStroke: isPast ? '1px #22C55E' : '1px rgba(255,255,255,0.5)',
                                transform: isSpoken ? 'scale(1.15) rotate(1deg)' : 'none',
                                transition: 'color 0.1s, transform 0.1s, text-shadow 0.1s'
                            }}>
                                {wordData.word}
                            </span>
                        </div>
                    );
                }
                // --- STILE CYBER SCANLINE (Neon Cyan VHS) ---
                if (subStyle === 'cyber-scanline' as any) {
                    return (
                        <div key={i} style={{ display: 'inline-flex', alignItems: 'center', transform: `scale(${wordScale})` }}>
                            {isImpact ? (
                                <span style={{
                                    fontFamily: '"Outfit", "Inter", sans-serif', 
                                    fontSize: 130, 
                                    fontWeight: 900, 
                                    textTransform: 'uppercase', 
                                    letterSpacing: '-4px',
                                    color: 'transparent',
                                    backgroundImage: 'repeating-linear-gradient(to bottom, #00e5ff 0px, #00e5ff 6px, transparent 6px, transparent 8px)',
                                    WebkitBackgroundClip: 'text',
                                    backgroundClip: 'text',
                                    // Drop shadow per il neon
                                    filter: 'drop-shadow(0 0 15px rgba(0, 229, 255, 0.4)) drop-shadow(0 8px 15px rgba(0,0,0,0.8))',
                                    padding: '0 10px',
                                    lineHeight: 0.9,
                                    transition: 'all 0.1s'
                                }}>
                                    {wordData.word}
                                </span>
                            ) : (
                                <span style={{
                                    fontFamily: '"Inter", sans-serif', 
                                    fontSize: 75, 
                                    fontWeight: 800,
                                    color: '#FFFFFF',
                                    padding: '0 6px',
                                    textShadow: '0 6px 15px rgba(0,0,0,1), 0 2px 5px rgba(0,0,0,0.8)',
                                    opacity: isPast ? 1 : 0.6,
                                    transform: isSpoken ? 'scale(1.05)' : 'none',
                                    transition: 'all 0.1s'
                                }}>
                                    {wordData.word}
                                </span>
                            )}
                        </div>
                    );
                }
            })}
        </div>
    );
};
