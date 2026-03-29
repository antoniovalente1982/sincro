import { useCurrentFrame, interpolate } from 'remotion';
import React from 'react';

interface CameraShakeProps {
    startFrame: number;
    endFrame: number;
    intensity?: 'subtle' | 'medium' | 'earthquake';
    type?: 'handheld' | 'impact' | 'vibrate';
    children?: React.ReactNode;
}

export const CameraShake: React.FC<CameraShakeProps> = ({
    startFrame,
    endFrame,
    intensity = 'medium',
    type = 'handheld',
    children,
}) => {
    const frame = useCurrentFrame();

    if (frame < startFrame || frame > endFrame) {
        return <div style={{ position: 'absolute', inset: 0 }}>{children}</div>;
    }

    const intensityMap = { subtle: 4, medium: 12, earthquake: 30 };
    const power = intensityMap[intensity];

    const elapsed = frame - startFrame;
    const totalFrames = endFrame - startFrame;

    // Fade in/out the shake
    const envelope = interpolate(
        frame,
        [startFrame, startFrame + 5, endFrame - 5, endFrame],
        [0, 1, 1, 0],
        { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
    );

    let shakeX = 0;
    let shakeY = 0;
    let shakeRotate = 0;
    let shakeScale = 1;

    switch (type) {
        case 'handheld': {
            // Smooth organic shake using layered sin waves
            shakeX = (
                Math.sin(elapsed * 0.23) * power * 0.6 +
                Math.sin(elapsed * 0.47) * power * 0.3 +
                Math.sin(elapsed * 0.83) * power * 0.1
            ) * envelope;
            shakeY = (
                Math.cos(elapsed * 0.31) * power * 0.5 +
                Math.cos(elapsed * 0.67) * power * 0.3 +
                Math.cos(elapsed * 0.97) * power * 0.2
            ) * envelope;
            shakeRotate = Math.sin(elapsed * 0.19) * (power * 0.08) * envelope;
            break;
        }
        case 'impact': {
            // Sharp initial impact that decays
            const decay = Math.exp(-elapsed * 0.08);
            shakeX = Math.sin(elapsed * 1.5) * power * 1.5 * decay * envelope;
            shakeY = Math.cos(elapsed * 1.7) * power * 1.2 * decay * envelope;
            shakeRotate = Math.sin(elapsed * 2.1) * (power * 0.15) * decay * envelope;
            shakeScale = 1 + Math.sin(elapsed * 3) * 0.02 * decay * envelope;
            break;
        }
        case 'vibrate': {
            // High-frequency vibration
            shakeX = Math.sin(elapsed * 3.7) * power * 0.4 * envelope;
            shakeY = Math.cos(elapsed * 4.1) * power * 0.4 * envelope;
            shakeRotate = Math.sin(elapsed * 5.3) * (power * 0.03) * envelope;
            break;
        }
    }

    return (
        <div
            style={{
                position: 'absolute',
                inset: 0,
                transform: `translate(${shakeX}px, ${shakeY}px) rotate(${shakeRotate}deg) scale(${shakeScale})`,
                transformOrigin: 'center center',
                overflow: 'hidden',
            }}
        >
            {children}
        </div>
    );
};
