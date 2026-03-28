import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';

/**
 * CounterAnimation — Contatore numerico animato stile slot machine.
 * Es: €0 → €15.000 con incremento progressivo.
 */
export const CounterAnimation: React.FC<{
    startFrame: number;
    endFrame?: number;
    fromValue?: number;
    toValue: number;
    prefix?: string;
    suffix?: string;
    color?: string;
    fontSize?: number;
    duration?: number; // in frames
    yPosition?: number;
}> = ({
    startFrame,
    endFrame,
    fromValue = 0,
    toValue,
    prefix = '€',
    suffix = '',
    color = '#22C55E',
    fontSize = 72,
    duration = 45, // ~1.5 secondi a 30fps
    yPosition = 45,
}) => {
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();

    if (frame < startFrame) return null;
    if (endFrame && frame > endFrame + fps) return null;

    // Entrata
    const progressIn = spring({
        fps,
        frame: frame - startFrame,
        config: { damping: 14, mass: 0.6, stiffness: 130 },
    });

    // Uscita
    const progressOut = endFrame ? spring({
        fps,
        frame: frame - endFrame,
        config: { damping: 14, stiffness: 100 },
    }) : 0;

    const progress = Math.max(0, progressIn - progressOut);

    // Conta progressiva (easeOutQuart per effetto "slot machine che rallenta")
    const countProgress = Math.min(1, (frame - startFrame) / duration);
    const eased = 1 - Math.pow(1 - countProgress, 4);
    const currentValue = Math.round(fromValue + (toValue - fromValue) * eased);

    // Formattazione numeri con punto separatore migliaia
    const formattedValue = currentValue.toLocaleString('it-IT');

    // Glow pulsante quando ha raggiunto il valore finale
    const isComplete = countProgress >= 1;
    const glowPulse = isComplete ? Math.sin((frame - startFrame) * 0.12) * 0.5 + 0.5 : 0;

    // Scala che "rimbalza" al completamento
    const completeScale = isComplete ? 1 + Math.sin((frame - startFrame - duration) * 0.3) * 0.03 : 1;

    return (
        <div style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: `${yPosition}%`,
            transform: `scale(${progress * completeScale}) translateY(${(1 - progress) * 60}px)`,
            opacity: progress,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 8,
        }}>
            {/* Label */}
            <span style={{
                fontSize: 16,
                fontWeight: 700,
                fontFamily: 'Inter, sans-serif',
                color: 'rgba(255,255,255,0.5)',
                textTransform: 'uppercase',
                letterSpacing: 4,
            }}>
                Fatturato Generato
            </span>

            {/* Valore principale */}
            <div style={{
                fontSize,
                fontWeight: 900,
                fontFamily: "'Inter', 'Bebas Neue', sans-serif",
                color,
                letterSpacing: '-2px',
                textShadow: `
                    0 0 ${20 + glowPulse * 30}px ${color}${isComplete ? '80' : '30'},
                    0 4px 16px rgba(0,0,0,0.6)
                `,
                display: 'flex',
                alignItems: 'baseline',
                gap: 4,
            }}>
                <span style={{ fontSize: fontSize * 0.6, opacity: 0.7 }}>{prefix}</span>
                {formattedValue}
                {suffix && <span style={{ fontSize: fontSize * 0.5, opacity: 0.6 }}>{suffix}</span>}
            </div>

            {/* Progress bar sotto */}
            <div style={{
                width: 200,
                height: 4,
                borderRadius: 2,
                backgroundColor: 'rgba(255,255,255,0.1)',
                overflow: 'hidden',
                marginTop: 4,
            }}>
                <div style={{
                    width: `${eased * 100}%`,
                    height: '100%',
                    background: `linear-gradient(90deg, ${color}, ${color}cc)`,
                    borderRadius: 2,
                    boxShadow: `0 0 8px ${color}60`,
                }} />
            </div>
        </div>
    );
};
