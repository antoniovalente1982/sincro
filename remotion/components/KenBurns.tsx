import { useCurrentFrame, useVideoConfig, interpolate } from 'remotion';
import React from 'react';

interface KenBurnsProps {
    startFrame: number;
    endFrame: number;
    direction?: 'zoom-in' | 'zoom-out' | 'pan-left' | 'pan-right' | 'pan-up' | 'pan-down' | 'drift';
    intensity?: 'subtle' | 'medium' | 'strong';
    children?: React.ReactNode;
}

/**
 * KenBurns — Micro-animazione costante che elimina la "staticità da anni 90".
 * Applica un lentissimo zoom/pan al contenuto per dare vita al frame.
 * Stile documentario/cinema — il frame non è mai completamente fermo.
 */
export const KenBurns: React.FC<KenBurnsProps> = ({
    startFrame,
    endFrame,
    direction = 'zoom-in',
    intensity = 'subtle',
    children,
}) => {
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();

    if (frame < startFrame || frame > endFrame) {
        return <div style={{ position: 'absolute', inset: 0 }}>{children}</div>;
    }

    const intensityMap = { subtle: 0.04, medium: 0.08, strong: 0.14 };
    const power = intensityMap[intensity];

    const totalFrames = endFrame - startFrame;
    const progress = (frame - startFrame) / totalFrames;

    let scaleX = 1;
    let scaleY = 1;
    let translateX = 0;
    let translateY = 0;

    // Start slightly zoomed in so we have room to move
    const baseScale = 1 + power;

    switch (direction) {
        case 'zoom-in': {
            const z = interpolate(progress, [0, 1], [1, 1 + power]);
            scaleX = z;
            scaleY = z;
            break;
        }
        case 'zoom-out': {
            const z = interpolate(progress, [0, 1], [1 + power, 1]);
            scaleX = z;
            scaleY = z;
            break;
        }
        case 'pan-left': {
            scaleX = baseScale;
            scaleY = baseScale;
            translateX = interpolate(progress, [0, 1], [power * 50, -power * 50]);
            break;
        }
        case 'pan-right': {
            scaleX = baseScale;
            scaleY = baseScale;
            translateX = interpolate(progress, [0, 1], [-power * 50, power * 50]);
            break;
        }
        case 'pan-up': {
            scaleX = baseScale;
            scaleY = baseScale;
            translateY = interpolate(progress, [0, 1], [power * 30, -power * 30]);
            break;
        }
        case 'pan-down': {
            scaleX = baseScale;
            scaleY = baseScale;
            translateY = interpolate(progress, [0, 1], [-power * 30, power * 30]);
            break;
        }
        case 'drift': {
            // Organic floating movement
            const driftProgress = progress * Math.PI * 2;
            scaleX = 1 + Math.sin(driftProgress * 0.5) * power * 0.5 + power * 0.5;
            scaleY = scaleX;
            translateX = Math.sin(driftProgress * 0.7) * power * 25;
            translateY = Math.cos(driftProgress * 0.5) * power * 15;
            break;
        }
    }

    return (
        <div
            style={{
                position: 'absolute',
                inset: 0,
                overflow: 'hidden',
            }}
        >
            <div
                style={{
                    position: 'absolute',
                    inset: '-5%',
                    width: '110%',
                    height: '110%',
                    transform: `scale(${scaleX}, ${scaleY}) translate(${translateX}px, ${translateY}px)`,
                    transformOrigin: 'center center',
                    willChange: 'transform',
                }}
            >
                {children}
            </div>
        </div>
    );
};
