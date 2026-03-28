import React from 'react';
import { Img, spring, useCurrentFrame, useVideoConfig } from 'remotion';

type CardVariant = 'slide-right' | 'slide-left' | 'scale-up' | 'rotate-in';
type CardPosition = 'top-right' | 'top-left' | 'center' | 'bottom-right';

/**
 * DynamicCard3D — Card PIP sovrapposta allo speaker con varianti di animazione.
 * Supporta 4 animazioni d'ingresso e 4 posizioni.
 */
export const DynamicCard3D: React.FC<{ 
    startFrame: number; 
    endFrame?: number; 
    imageUrl: string; 
    rotationOffset?: number;
    variant?: CardVariant;
    position?: CardPosition;
}> = ({ 
    startFrame, 
    endFrame, 
    imageUrl, 
    rotationOffset = -12,
    variant = 'slide-right',
    position = 'top-right',
}) => {
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();

    if (isNaN(startFrame) || frame < startFrame || (endFrame && frame > endFrame + fps)) return null;

    // Animazione di Entrata
    const progressIn = spring({
        fps,
        frame: Math.max(0, frame - startFrame),
        config: { damping: 14, mass: 0.8, stiffness: 120 },
        from: 0,
        to: 1,
    });

    // Animazione di Uscita
    const progressOut = endFrame ? spring({
        fps,
        frame: Math.max(0, frame - endFrame),
        config: { damping: 14, mass: 0.8, stiffness: 120 },
        from: 0,
        to: 1,
    }) : 0;

    const progress = Math.max(0, progressIn - progressOut);

    // Float leggero durante la permanenza
    const floatY = Math.sin((frame - startFrame) * 0.08) * 5;

    // Posizionamento in base alla prop `position`
    const positionStyles: Record<CardPosition, React.CSSProperties> = {
        'top-right': { right: 40, top: 160, width: 340, height: 440 },
        'top-left': { left: 40, top: 160, width: 340, height: 440 },
        'center': { left: '50%', top: 120, width: 500, height: 600, marginLeft: -250 },
        'bottom-right': { right: 30, bottom: 500, width: 260, height: 340 },
    };

    // Transform in base alla variant
    const getTransform = (): string => {
        const base = `translateY(${floatY}px) scale(${0.85 + progress * 0.15})`;
        switch (variant) {
            case 'slide-right':
                return `perspective(1200px) translateX(${500 - progress * 500}px) ${base} rotateY(${rotationOffset * progress}deg)`;
            case 'slide-left':
                return `perspective(1200px) translateX(${-500 + progress * 500}px) ${base} rotateY(${-rotationOffset * progress}deg)`;
            case 'scale-up':
                return `${base} scale(${progress})`;
            case 'rotate-in':
                return `perspective(1200px) ${base} rotateZ(${(1 - progress) * 25}deg) rotateY(${(1 - progress) * 30}deg)`;
            default:
                return base;
        }
    };

    // Colore bordo per varietà
    const borderColors: Record<CardVariant, string> = {
        'slide-right': 'rgba(139, 92, 246, 0.6)',   // viola
        'slide-left': 'rgba(234, 179, 8, 0.6)',      // giallo
        'scale-up': 'rgba(236, 72, 153, 0.6)',       // rosa
        'rotate-in': 'rgba(34, 197, 94, 0.6)',       // verde
    };

    const glowColors: Record<CardVariant, string> = {
        'slide-right': 'rgba(139, 92, 246, 0.5)',
        'slide-left': 'rgba(234, 179, 8, 0.5)',
        'scale-up': 'rgba(236, 72, 153, 0.5)',
        'rotate-in': 'rgba(34, 197, 94, 0.5)',
    };

    const pos = positionStyles[position];
    const borderColor = borderColors[variant];
    const glowColor = glowColors[variant];

    return (
        <div style={{
            position: 'absolute',
            ...pos,
            transform: getTransform(),
            transformOrigin: 'center center',
            opacity: progress,
            boxShadow: `
                0 0 40px ${glowColor},
                0 20px 60px rgba(0, 0, 0, 0.8),
                inset 0 0 0 2px ${borderColor}
            `,
            borderRadius: 20,
            overflow: 'hidden',
            border: `3px solid ${borderColor}`,
        }}>
            <Img 
                src={imageUrl} 
                style={{ 
                    width: '100%', 
                    height: '100%', 
                    objectFit: 'cover',
                    transform: `scale(${1 + (progress * 0.06)})`,
                }} 
            />
            {/* Label in fondo */}
            <div style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                padding: '24px 16px 14px',
                background: 'linear-gradient(transparent, rgba(0,0,0,0.85))',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
            }}>
                <div style={{
                    width: 8, height: 8,
                    borderRadius: '50%',
                    backgroundColor: '#22c55e',
                    boxShadow: '0 0 8px #22c55e',
                }} />
                <span style={{
                    color: 'white',
                    fontSize: 18,
                    fontWeight: 800,
                    fontFamily: 'Inter, sans-serif',
                    textShadow: '0 2px 8px rgba(0,0,0,0.8)',
                    letterSpacing: '-0.5px',
                }}>
                    METODO SINCRO
                </span>
            </div>
        </div>
    );
};
