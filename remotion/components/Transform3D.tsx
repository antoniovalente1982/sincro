import { useCurrentFrame, interpolate } from 'remotion';
import React from 'react';

interface Transform3DProps {
    startFrame: number;
    endFrame: number;
    rotateX?: number;  // degrees
    rotateY?: number;
    rotateZ?: number;
    perspective?: number;
    animation?: 'static' | 'orbit' | 'flip' | 'tilt-rock';
    speed?: number;
    children?: React.ReactNode;
}

export const Transform3D: React.FC<Transform3DProps> = ({
    startFrame,
    endFrame,
    rotateX = 0,
    rotateY = 0,
    rotateZ = 0,
    perspective = 1200,
    animation = 'orbit',
    speed = 1,
    children,
}) => {
    const frame = useCurrentFrame();

    if (frame < startFrame || frame > endFrame) {
        return <div style={{ position: 'absolute', inset: 0 }}>{children}</div>;
    }

    const elapsed = frame - startFrame;

    const opacity = interpolate(
        frame,
        [startFrame, startFrame + 10, endFrame - 10, endFrame],
        [0, 1, 1, 0],
        { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
    );

    let rx = rotateX;
    let ry = rotateY;
    let rz = rotateZ;

    switch (animation) {
        case 'orbit': {
            rx = rotateX + Math.sin(elapsed * 0.02 * speed) * 15;
            ry = rotateY + Math.cos(elapsed * 0.015 * speed) * 20;
            rz = rotateZ + Math.sin(elapsed * 0.01 * speed) * 3;
            break;
        }
        case 'flip': {
            const flipProgress = interpolate(
                elapsed,
                [0, 30 / speed, 60 / speed],
                [0, 180, 360],
                { extrapolateRight: 'clamp' }
            );
            ry = rotateY + flipProgress;
            break;
        }
        case 'tilt-rock': {
            rx = rotateX + Math.sin(elapsed * 0.04 * speed) * 8;
            ry = rotateY + Math.cos(elapsed * 0.03 * speed) * 5;
            break;
        }
        case 'static':
        default:
            break;
    }

    return (
        <div
            style={{
                position: 'absolute',
                inset: 0,
                perspective,
                perspectiveOrigin: '50% 50%',
                opacity,
            }}
        >
            <div
                style={{
                    position: 'absolute',
                    inset: 0,
                    transform: `rotateX(${rx}deg) rotateY(${ry}deg) rotateZ(${rz}deg)`,
                    transformStyle: 'preserve-3d',
                    transformOrigin: 'center center',
                    backfaceVisibility: 'hidden',
                }}
            >
                {children}
            </div>

            {/* Reflection/shadow for 3D depth */}
            <div
                style={{
                    position: 'absolute',
                    bottom: 0,
                    left: '10%',
                    right: '10%',
                    height: '30%',
                    background: 'linear-gradient(180deg, transparent, rgba(0,0,0,0.15))',
                    transform: `rotateX(${rx * 0.3}deg) scaleY(0.3)`,
                    transformOrigin: 'bottom center',
                    filter: 'blur(20px)',
                    opacity: 0.4,
                    pointerEvents: 'none',
                }}
            />
        </div>
    );
};
