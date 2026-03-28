import React from 'react';
import { spring, useCurrentFrame, useVideoConfig } from 'remotion';

type GiantTextStyle = 'impact' | 'gradient' | 'outline' | 'neon';

/**
 * GiantImpactText — Testo ENORME che riempie il fondo dello schermo.
 * Stile OFMCosta / Hormozi — 2 righe max, keyword evidenziata in giallo.
 */
export const GiantImpactText: React.FC<{
    startFrame: number;
    endFrame?: number;
    line1: string;
    line2?: string;
    highlightWord?: string;
    highlightColor?: string;
    textColor?: string;
    textStyle?: GiantTextStyle;
    fontSize?: number;
    yPosition?: number;
}> = ({
    startFrame,
    endFrame,
    line1,
    line2,
    highlightWord,
    highlightColor = '#EAB308',
    textColor = '#FFFFFF',
    textStyle = 'impact',
    fontSize = 90,
    yPosition = 70, // percentuale dal top
}) => {
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();
    
    if (frame < startFrame) return null;
    if (endFrame && frame > endFrame + fps * 0.5) return null;

    // Entrata con spring (scale-up + slide-up)
    const progressIn = spring({
        fps,
        frame: frame - startFrame,
        config: { damping: 12, mass: 0.6, stiffness: 150 },
    });

    // Uscita
    const progressOut = endFrame ? spring({
        fps,
        frame: frame - endFrame,
        config: { damping: 14, mass: 0.8, stiffness: 120 },
    }) : 0;

    const progress = Math.max(0, progressIn - progressOut);
    const scale = 0.3 + progress * 0.7;
    const translateY = (1 - progress) * 80;
    const opacity = progress;

    // Micro-bounce continuo
    const bounce = Math.sin((frame - startFrame) * 0.15) * 2;

    // Stili per variante
    const getTextStyles = (): React.CSSProperties => {
        const base: React.CSSProperties = {
            fontFamily: "'Impact', 'Arial Black', 'Bebas Neue', sans-serif",
            fontSize,
            fontWeight: 900,
            lineHeight: 1.05,
            textAlign: 'center',
            textTransform: 'uppercase',
            letterSpacing: '-2px',
        };

        switch (textStyle) {
            case 'impact':
                return {
                    ...base,
                    color: textColor,
                    textShadow: `
                        0 4px 0 rgba(0,0,0,0.4),
                        0 8px 20px rgba(0,0,0,0.6),
                        0 0 60px rgba(0,0,0,0.4)
                    `,
                };
            case 'gradient':
                return {
                    ...base,
                    background: `linear-gradient(180deg, ${textColor} 30%, ${highlightColor} 100%)`,
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.6))',
                };
            case 'outline':
                return {
                    ...base,
                    color: 'transparent',
                    WebkitTextStroke: `3px ${textColor}`,
                    textShadow: `0 0 30px ${highlightColor}40`,
                };
            case 'neon':
                return {
                    ...base,
                    color: highlightColor,
                    textShadow: `
                        0 0 10px ${highlightColor},
                        0 0 30px ${highlightColor}80,
                        0 0 60px ${highlightColor}40,
                        0 4px 20px rgba(0,0,0,0.6)
                    `,
                };
            default:
                return base;
        }
    };

    // Renderizza il testo con highlight sulla keyword
    const renderLine = (text: string) => {
        if (!highlightWord) return text;
        
        const parts = text.split(new RegExp(`(${highlightWord})`, 'gi'));
        return parts.map((part, i) => {
            if (part.toLowerCase() === highlightWord?.toLowerCase()) {
                return (
                    <span key={i} style={{
                        color: highlightColor,
                        display: 'inline-block',
                        transform: `scale(${1 + Math.sin((frame - startFrame) * 0.1) * 0.05})`,
                        textShadow: `0 0 30px ${highlightColor}60`,
                    }}>
                        {part}
                    </span>
                );
            }
            return <span key={i}>{part}</span>;
        });
    };

    return (
        <div style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: `${yPosition}%`,
            transform: `scale(${scale}) translateY(${translateY + bounce}px)`,
            opacity,
            padding: '0 30px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            transformOrigin: 'center bottom',
        }}>
            <div style={getTextStyles()}>
                {renderLine(line1)}
            </div>
            {line2 && (
                <div style={{
                    ...getTextStyles(),
                    marginTop: -5,
                    color: highlightColor,
                }}>
                    {renderLine(line2)}
                </div>
            )}
        </div>
    );
};
