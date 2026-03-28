import React, { useMemo } from 'react';
import { interpolate, random, useCurrentFrame, useVideoConfig } from 'remotion';

/**
 * CinematicBackground — Sfondo dark con gradient pulsante e particelle flottanti.
 * Sostituisce lo sfondo nero piatto per dare profondità e mood da studio.
 */
export const CinematicBackground: React.FC<{
    mood?: 'warm-studio' | 'cold-blue' | 'purple-haze';
}> = ({ mood = 'warm-studio' }) => {
    const frame = useCurrentFrame();
    const { fps, width, height } = useVideoConfig();
    const currentMs = (frame / fps) * 1000;

    // Colori per mood
    const colors = {
        'warm-studio': {
            center: 'rgba(60, 30, 10, 0.6)',
            mid: 'rgba(30, 15, 5, 0.8)',
            edge: '#0a0502',
            particle: '#c9891020',
            glow: 'rgba(200, 130, 50, 0.08)',
        },
        'cold-blue': {
            center: 'rgba(10, 20, 60, 0.6)',
            mid: 'rgba(5, 10, 40, 0.8)',
            edge: '#020510',
            particle: '#4080ff15',
            glow: 'rgba(60, 120, 220, 0.08)',
        },
        'purple-haze': {
            center: 'rgba(40, 10, 60, 0.6)',
            mid: 'rgba(20, 5, 40, 0.8)',
            edge: '#0a0215',
            particle: '#a050ff15',
            glow: 'rgba(140, 60, 200, 0.08)',
        },
    };

    const c = colors[mood];

    // Pulsazione lenta del gradient (respira ogni 4 secondi)
    const breathe = Math.sin(currentMs / 4000 * Math.PI) * 0.5 + 0.5;
    const gradientSize = 50 + breathe * 20; // da 50% a 70%

    // Posizione del punto luce che si muove lentamente
    const lightX = 50 + Math.sin(currentMs / 6000 * Math.PI) * 15;
    const lightY = 35 + Math.cos(currentMs / 8000 * Math.PI) * 10;

    // Particelle flottanti
    const particles = useMemo(() => {
        const pts = [];
        for (let i = 0; i < 25; i++) {
            pts.push({
                x: random(`px-${i}`) * width,
                y: random(`py-${i}`) * height,
                size: 2 + random(`ps-${i}`) * 4,
                speed: 0.2 + random(`psp-${i}`) * 0.5,
                opacity: 0.15 + random(`po-${i}`) * 0.25,
                phase: random(`pp-${i}`) * Math.PI * 2,
            });
        }
        return pts;
    }, [width, height]);

    // Bokeh lights (cerchi sfuocati grandi)
    const bokehLights = useMemo(() => {
        const lights = [];
        for (let i = 0; i < 6; i++) {
            lights.push({
                x: random(`bx-${i}`) * width,
                y: random(`by-${i}`) * height,
                size: 80 + random(`bs-${i}`) * 200,
                opacity: 0.03 + random(`bo-${i}`) * 0.05,
                speedX: (random(`bsx-${i}`) - 0.5) * 0.3,
                speedY: (random(`bsy-${i}`) - 0.5) * 0.2,
            });
        }
        return lights;
    }, [width, height]);

    return (
        <div style={{
            position: 'absolute',
            width: '100%',
            height: '100%',
            overflow: 'hidden',
        }}>
            {/* Base gradient scuro */}
            <div style={{
                position: 'absolute',
                inset: 0,
                background: `
                    radial-gradient(ellipse ${gradientSize}% ${gradientSize}% at ${lightX}% ${lightY}%, 
                        ${c.center} 0%, 
                        ${c.mid} 40%, 
                        ${c.edge} 100%)
                `,
            }} />

            {/* Glow ambientale */}
            <div style={{
                position: 'absolute',
                inset: 0,
                background: `
                    radial-gradient(circle at 80% 20%, ${c.glow} 0%, transparent 50%),
                    radial-gradient(circle at 20% 80%, ${c.glow} 0%, transparent 50%)
                `,
                opacity: 0.5 + breathe * 0.5,
            }} />

            {/* Bokeh Lights */}
            {bokehLights.map((light, i) => {
                const x = light.x + Math.sin(currentMs / 5000 + i) * 30 * light.speedX;
                const y = light.y + Math.cos(currentMs / 7000 + i) * 20 * light.speedY;
                
                return (
                    <div
                        key={`bokeh-${i}`}
                        style={{
                            position: 'absolute',
                            left: x,
                            top: y,
                            width: light.size,
                            height: light.size,
                            borderRadius: '50%',
                            background: `radial-gradient(circle, ${c.glow} 0%, transparent 70%)`,
                            opacity: light.opacity * (0.7 + breathe * 0.3),
                            filter: 'blur(20px)',
                        }}
                    />
                );
            })}

            {/* Particelle flottanti (polvere in controluce) */}
            {particles.map((p, i) => {
                // Le particelle salgono lentamente e oscillano
                const yPos = (p.y - (currentMs * p.speed * 0.05) % (height + 50) + height) % height;
                const xPos = p.x + Math.sin(currentMs / 2000 + p.phase) * 15;
                const particleOpacity = p.opacity * (0.5 + Math.sin(currentMs / 1500 + p.phase) * 0.5);

                return (
                    <div
                        key={`particle-${i}`}
                        style={{
                            position: 'absolute',
                            left: xPos,
                            top: yPos,
                            width: p.size,
                            height: p.size,
                            borderRadius: '50%',
                            backgroundColor: c.particle,
                            opacity: particleOpacity,
                            boxShadow: `0 0 ${p.size * 2}px ${c.particle}`,
                        }}
                    />
                );
            })}

            {/* Vignette scura ai bordi */}
            <div style={{
                position: 'absolute',
                inset: 0,
                boxShadow: 'inset 0 0 250px rgba(0,0,0,0.85)',
                pointerEvents: 'none',
            }} />
        </div>
    );
};
