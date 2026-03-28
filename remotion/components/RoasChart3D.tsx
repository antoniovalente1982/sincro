import React, { useRef } from 'react';
import { useCurrentFrame, useVideoConfig, spring } from 'remotion';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export const RoasChart3D: React.FC<{ startFrame: number }> = ({ startFrame }) => {
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();

    // The spring controls the physical popup/growth of the chart
    // We start animating when `frame` reaches `startFrame`. If frame < startFrame, it's 0.
    const progress = spring({
        fps,
        frame: frame - startFrame,
        config: { damping: 14, mass: 1, stiffness: 100 },
        from: 0,
        to: 1
    });

    const mesh1 = useRef<THREE.Mesh>(null!);
    const mesh2 = useRef<THREE.Mesh>(null!);
    const mesh3 = useRef<THREE.Mesh>(null!);

    // Rotazione orbitante continua attorno all'asse Y per dare un effetto Premium
    useFrame((state) => {
        if (mesh1.current) mesh1.current.rotation.y = state.clock.elapsedTime * 0.5;
        if (mesh2.current) mesh2.current.rotation.y = state.clock.elapsedTime * 0.5 + 0.1;
        if (mesh3.current) mesh3.current.rotation.y = state.clock.elapsedTime * 0.5 + 0.2;
    });

    // Materiali Pazzeschi: Vetro/Cyberpunk Neon
    const materialGreen = new THREE.MeshStandardMaterial({
        color: '#4ADE80',
        emissive: '#22C55E',
        emissiveIntensity: 0.8,
        roughness: 0.1,
        metalness: 0.8
    });

    const materialYellow = new THREE.MeshStandardMaterial({
        color: '#FACC15',
        emissive: '#EAB308',
        emissiveIntensity: 0.8,
        roughness: 0.1,
        metalness: 0.8
    });

    // Altezze target per le sbarre del "Fatturato" che schizza
    const targetHeight1 = 1.5;
    const targetHeight2 = 2.8;
    const targetHeight3 = 5.0;

    return (
        <group position={[0, -2, 0]}>
            {/* Ambient lighting to make things glow */}
            <ambientLight intensity={0.5} />
            <pointLight position={[10, 10, 10]} intensity={1.5} color="#ffffff" />
            <pointLight position={[-10, 5, -10]} intensity={2.0} color="#EAB308" />

            {/* Barra 1: Bassa */}
            <mesh
                ref={mesh1}
                position={[-2.5, (targetHeight1 * progress) / 2, 0]}
                scale={[1, targetHeight1 * progress + 0.01, 1]}
                material={materialGreen}
            >
                <boxGeometry args={[1, 1, 1]} />
            </mesh>

            {/* Barra 2: Media */}
            <mesh
                ref={mesh2}
                position={[0, (targetHeight2 * progress) / 2, 0]}
                scale={[1, targetHeight2 * progress + 0.01, 1]}
                material={materialGreen}
            >
                <boxGeometry args={[1, 1, 1]} />
            </mesh>

            {/* Barra 3: ROAS Esplosivo */}
            <mesh
                ref={mesh3}
                position={[2.5, (targetHeight3 * progress) / 2, 0]}
                scale={[1.2, targetHeight3 * progress + 0.01, 1.2]}
                material={materialYellow}
            >
                <boxGeometry args={[1, 1, 1]} />
            </mesh>
            
            {/* Basamento/Piedistallo */}
            <mesh position={[0, -0.5, 0]} scale={[8, 0.5, 3]}>
                <boxGeometry args={[1, 1, 1]} />
                <meshStandardMaterial color="#1E293B" metalness={0.9} roughness={0.2} emissive="#000000" />
            </mesh>
        </group>
    );
};
