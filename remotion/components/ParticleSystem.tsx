import { useCurrentFrame, useVideoConfig, interpolate } from 'remotion';
import React, { useMemo } from 'react';

interface ParticleSystemProps {
    startFrame: number;
    endFrame: number;
    type?: 'sparks' | 'bokeh' | 'snow' | 'smoke' | 'fire' | 'dust' | 'stars';
    color?: string;
    density?: 'low' | 'medium' | 'high';
    direction?: 'up' | 'down' | 'left' | 'right' | 'scatter';
    speed?: number; // 0.5 - 3.0
}

interface Particle {
    x: number;
    y: number;
    size: number;
    speed: number;
    delay: number;
    angle: number;
    opacity: number;
    rotation: number;
    wobble: number;
}

export const ParticleSystem: React.FC<ParticleSystemProps> = ({
    startFrame,
    endFrame,
    type = 'sparks',
    color = '#FFD700',
    density = 'medium',
    direction = 'up',
    speed = 1.0,
}) => {
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();

    if (frame < startFrame || frame > endFrame) return null;

    const densityMap = { low: 20, medium: 45, high: 80 };
    const count = densityMap[density];

    const opacity = interpolate(
        frame,
        [startFrame, startFrame + 15, endFrame - 15, endFrame],
        [0, 1, 1, 0],
        { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
    );

    // Generate stable particles
    const particles = useMemo<Particle[]>(() => {
        const seededRand = (seed: number) => {
            const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
            return x - Math.floor(x);
        };
        return Array.from({ length: count }, (_, i) => ({
            x: seededRand(i * 1.1) * 100,
            y: seededRand(i * 2.3) * 100,
            size: 2 + seededRand(i * 3.7) * (type === 'bokeh' ? 30 : type === 'snow' ? 12 : type === 'smoke' ? 60 : 8),
            speed: (0.5 + seededRand(i * 5.1) * 1.5) * speed,
            delay: seededRand(i * 7.2) * 60,
            angle: seededRand(i * 9.4) * 360,
            opacity: 0.3 + seededRand(i * 11.6) * 0.7,
            rotation: seededRand(i * 13.8) * 360,
            wobble: seededRand(i * 15.3) * 3,
        }));
    }, [count, type, speed]);

    const elapsed = frame - startFrame;

    // Type-specific rendering
    const renderParticle = (p: Particle, i: number) => {
        if (elapsed < p.delay) return null;
        const t = (elapsed - p.delay) * p.speed * 0.03;
        const cycle = t % 1;

        let px = p.x;
        let py = p.y;

        // Movement based on direction
        switch (direction) {
            case 'up': py = ((p.y - t * 100) % 120 + 120) % 120 - 10; px += Math.sin(t * p.wobble) * 5; break;
            case 'down': py = ((p.y + t * 100) % 120 + 120) % 120 - 10; px += Math.sin(t * p.wobble) * 5; break;
            case 'left': px = ((p.x - t * 100) % 120 + 120) % 120 - 10; py += Math.sin(t * p.wobble) * 3; break;
            case 'right': px = ((p.x + t * 100) % 120 + 120) % 120 - 10; py += Math.sin(t * p.wobble) * 3; break;
            case 'scatter':
                px = p.x + Math.cos(p.angle * Math.PI / 180) * t * 30;
                py = p.y + Math.sin(p.angle * Math.PI / 180) * t * 30;
                break;
        }

        // Particle fade based on life
        const lifeOpacity = type === 'smoke' ? interpolate(cycle, [0, 0.3, 1], [0, 0.5, 0]) : p.opacity;
        const lifeScale = type === 'smoke' ? interpolate(cycle, [0, 0.5, 1], [0.3, 1, 1.5]) : 1;

        const baseStyle: React.CSSProperties = {
            position: 'absolute',
            left: `${px}%`,
            top: `${py}%`,
            transform: `translate(-50%, -50%) rotate(${p.rotation + elapsed * (type === 'snow' ? 1 : 0)}deg) scale(${lifeScale})`,
            opacity: lifeOpacity,
            pointerEvents: 'none',
        };

        switch (type) {
            case 'sparks':
                return (
                    <div key={i} style={{
                        ...baseStyle,
                        width: p.size,
                        height: p.size,
                        borderRadius: '50%',
                        background: `radial-gradient(circle, ${color}, ${color}80, transparent)`,
                        boxShadow: `0 0 ${p.size * 2}px ${color}80`,
                    }} />
                );
            case 'bokeh':
                return (
                    <div key={i} style={{
                        ...baseStyle,
                        width: p.size,
                        height: p.size,
                        borderRadius: '50%',
                        border: `1.5px solid ${color}40`,
                        background: `radial-gradient(circle, ${color}15, transparent 70%)`,
                        filter: `blur(${p.size * 0.15}px)`,
                    }} />
                );
            case 'snow':
                return (
                    <div key={i} style={{
                        ...baseStyle,
                        width: p.size,
                        height: p.size,
                        borderRadius: '50%',
                        background: 'radial-gradient(circle, rgba(255,255,255,0.9), rgba(255,255,255,0.3), transparent)',
                        filter: `blur(${p.size * 0.1}px)`,
                    }} />
                );
            case 'smoke':
                return (
                    <div key={i} style={{
                        ...baseStyle,
                        width: p.size,
                        height: p.size,
                        borderRadius: '50%',
                        background: `radial-gradient(circle, rgba(200,200,200,0.15), rgba(150,150,150,0.05), transparent)`,
                        filter: `blur(${p.size * 0.3}px)`,
                    }} />
                );
            case 'fire':
                const fireColors = ['#FF4500', '#FF6600', '#FFD700', '#FF8C00'];
                const fireColor = fireColors[i % fireColors.length];
                return (
                    <div key={i} style={{
                        ...baseStyle,
                        width: p.size * 1.5,
                        height: p.size * 2,
                        borderRadius: '50% 50% 50% 50% / 60% 60% 40% 40%',
                        background: `radial-gradient(ellipse, ${fireColor}80, ${fireColor}30, transparent)`,
                        filter: `blur(${p.size * 0.2}px)`,
                        mixBlendMode: 'screen',
                    }} />
                );
            case 'dust':
                return (
                    <div key={i} style={{
                        ...baseStyle,
                        width: p.size,
                        height: p.size,
                        borderRadius: '50%',
                        background: `rgba(255,248,220,${0.2 + p.opacity * 0.3})`,
                        filter: `blur(${p.size * 0.2}px)`,
                    }} />
                );
            case 'stars':
                const twinkle = Math.sin((elapsed + p.delay) * 0.1 * p.speed) * 0.5 + 0.5;
                return (
                    <div key={i} style={{
                        ...baseStyle,
                        width: p.size,
                        height: p.size,
                        opacity: lifeOpacity * twinkle,
                    }}>
                        {/* 4-point star shape via two rotated rectangles */}
                        <div style={{
                            position: 'absolute',
                            inset: '30% 45%',
                            background: color,
                            borderRadius: 1,
                            boxShadow: `0 0 ${p.size}px ${color}60`,
                        }} />
                        <div style={{
                            position: 'absolute',
                            inset: '45% 30%',
                            background: color,
                            borderRadius: 1,
                            boxShadow: `0 0 ${p.size}px ${color}60`,
                        }} />
                    </div>
                );
            default:
                return null;
        }
    };

    return (
        <div
            style={{
                position: 'absolute',
                inset: 0,
                pointerEvents: 'none',
                opacity,
                overflow: 'hidden',
            }}
        >
            {particles.map((p, i) => renderParticle(p, i))}
        </div>
    );
};
