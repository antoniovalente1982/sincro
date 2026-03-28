import React, { useMemo } from 'react';
import { random, spring, useCurrentFrame, useVideoConfig } from 'remotion';

/**
 * EmojiReaction — Emoji che esplodono dal basso come reazioni live TikTok.
 * Simula le reazioni in diretta per creare FOMO e social proof.
 */
export const EmojiReaction: React.FC<{
    startFrame: number;
    endFrame?: number;
    emojis?: string[];
    intensity?: 'low' | 'medium' | 'high';
}> = ({
    startFrame,
    endFrame,
    emojis = ['🔥', '❤️', '💪', '⚡', '🏆', '💰', '🚀', '👑'],
    intensity = 'medium',
}) => {
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();
    const width = 1080;
    const height = 1920;
    
    if (isNaN(startFrame) || frame < startFrame) return null;
    if (endFrame && frame > endFrame + fps * 0.5) return null;

    const intensityCount = { low: 8, medium: 15, high: 25 };
    // Fallback sicuro se l'AI manda una stringa o valori sballati
    const count = intensityCount[intensity as keyof typeof intensityCount] || 15;
    const safeEmojis = Array.isArray(emojis) && emojis.length > 0 ? emojis : ['🔥', '❤️', '💪', '⚡', '🏆'];

    // Genera le particelle emoji
    const particles = useMemo(() => {
        const pts = [];
        for (let i = 0; i < count; i++) {
            // Estrae emoji in modo sicuro forzando a stringa, previene React Object child exception
            const selectedRaw = safeEmojis[Math.floor(random(`emoji-${i}`) * safeEmojis.length)];
            const safeStringEmoji = typeof selectedRaw === 'string' ? selectedRaw : (selectedRaw ? String(selectedRaw) : '🔥');

            pts.push({
                emoji: safeStringEmoji,
                x: 50 + random(`ex-${i}`) * (width - 100), // Posizione X casuale
                delay: random(`ed-${i}`) * 20, // Delay in frames
                speed: 3 + random(`es-${i}`) * 4, // Velocità salita
                wobble: random(`ew-${i}`) * 2 - 1, // Oscillazione laterale
                size: 28 + random(`esz-${i}`) * 24, // Dimensione
                rotation: random(`er-${i}`) * 360, // Rotazione iniziale
            });
        }
        return pts;
    }, [count, safeEmojis, width]);

    // Fade in globale
    const globalProgress = spring({
        fps,
        frame: Math.max(0, frame - startFrame),
        config: { damping: 20, stiffness: 80 },
    });

    return (
        <div style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            opacity: globalProgress,
            overflow: 'hidden',
        }}>
            {particles.map((p, i) => {
                const localFrame = frame - startFrame - p.delay;
                if (localFrame < 0) return null;

                // Salgono dal basso
                const yPos = height + 50 - localFrame * p.speed * 3;
                // Oscillano lateralmente
                const xOffset = Math.sin(localFrame * 0.1 * p.wobble) * 30;
                // Fade out quando salgono troppo
                const opacity = Math.max(0, Math.min(1, (height - 100 - (height - yPos)) / 300));
                // Scala con spring iniziale
                const scale = localFrame < 10 ? spring({
                    fps, frame: localFrame,
                    config: { damping: 8, stiffness: 200 },
                }) : 1;

                if (yPos < -60) return null; // Fuori schermo

                return (
                    <div
                        key={`emoji-${i}`}
                        style={{
                            position: 'absolute',
                            left: p.x + xOffset,
                            top: yPos,
                            fontSize: p.size,
                            transform: `scale(${scale}) rotate(${p.rotation + localFrame * 2}deg)`,
                            opacity: opacity * 0.85,
                            filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))',
                            willChange: 'transform',
                        }}
                    >
                        {p.emoji}
                    </div>
                );
            })}
        </div>
    );
};
