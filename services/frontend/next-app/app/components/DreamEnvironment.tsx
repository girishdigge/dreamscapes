// services/frontend/next-app/app/components/DreamEnvironment.tsx
'use client';

import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { DreamEnvironment as DreamEnvironmentType } from '../types/dream';

interface DreamEnvironmentProps {
  environment?: DreamEnvironmentType;
  style?: string;
}

export default function DreamEnvironment({
  environment = {},
  style = 'ethereal',
}: DreamEnvironmentProps) {
  const groundRef = useRef<THREE.Mesh>(null);
  const skyRef = useRef<THREE.Mesh>(null);
  const cloudsRef = useRef<THREE.Group>(null);

  const { preset = 'dusk', skyColor = '#a6d8ff' } = environment;

  // Animate elements based on style
  useFrame((state) => {
    const time = state.clock.getElapsedTime();

    // Animate clouds if they exist
    if (cloudsRef.current) {
      cloudsRef.current.rotation.y = time * 0.01;
      cloudsRef.current.position.y = Math.sin(time * 0.5) * 2;
    }

    // Animate ground based on style
    if (groundRef.current && style === 'surreal') {
      groundRef.current.position.y = Math.sin(time * 0.3) * 0.5;
    }
  });

  // Style-specific materials
  const getGroundMaterial = () => {
    switch (style) {
      case 'cyberpunk':
        return (
          <meshStandardMaterial
            color='#001122'
            emissive='#003366'
            emissiveIntensity={0.2}
            roughness={0.1}
            metalness={0.8}
          />
        );
      case 'nightmare':
        return (
          <meshStandardMaterial
            color='#0a0a0a'
            emissive='#330000'
            emissiveIntensity={0.1}
            roughness={0.9}
            metalness={0.1}
          />
        );
      case 'fantasy':
        return (
          <meshStandardMaterial
            color='#2d4a2d'
            emissive='#1a3d1a'
            emissiveIntensity={0.1}
            roughness={0.7}
            metalness={0.2}
          />
        );
      case 'surreal':
        return (
          <meshStandardMaterial
            color='#4a2d4a'
            emissive='#2d1a2d'
            emissiveIntensity={0.1}
            roughness={0.5}
            metalness={0.3}
          />
        );
      default: // ethereal
        return (
          <meshStandardMaterial
            color='#1a2b3d'
            emissive='#0f1419'
            emissiveIntensity={0.05}
            roughness={0.8}
            metalness={0.1}
            transparent
            opacity={0.8}
          />
        );
    }
  };

  const getSkyMaterial = () => {
    const color = new THREE.Color(skyColor);

    switch (style) {
      case 'cyberpunk':
        return <meshBasicMaterial color='#001133' side={THREE.BackSide} />;
      case 'nightmare':
        return <meshBasicMaterial color='#1a0d1a' side={THREE.BackSide} />;
      case 'fantasy':
        return <meshBasicMaterial color='#4a2d1a' side={THREE.BackSide} />;
      case 'surreal':
        return <meshBasicMaterial color='#2d1a4a' side={THREE.BackSide} />;
      default: // ethereal
        return <meshBasicMaterial color={color} side={THREE.BackSide} />;
    }
  };

  return (
    <group>
      {/* Sky Dome */}
      <mesh ref={skyRef} position={[0, 0, 0]}>
        <sphereGeometry args={[500, 32, 32]} />
        {getSkyMaterial()}
      </mesh>

      {/* Ground Plane */}
      {preset !== 'void' && (
        <mesh
          ref={groundRef}
          position={[0, -10, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <planeGeometry args={[1000, 1000]} />
          {getGroundMaterial()}
        </mesh>
      )}

      {/* Floating Clouds for ethereal/fantasy styles */}
      {(style === 'ethereal' || style === 'fantasy') && (
        <group ref={cloudsRef} position={[0, 50, -100]}>
          {[...Array(8)].map((_, i) => (
            <mesh
              key={i}
              position={[
                (Math.random() - 0.5) * 200,
                (Math.random() - 0.5) * 20,
                (Math.random() - 0.5) * 200,
              ]}
              scale={[2 + Math.random() * 3, 1, 2 + Math.random() * 3]}
            >
              <sphereGeometry args={[10, 8, 6]} />
              <meshStandardMaterial
                color='#ffffff'
                transparent
                opacity={0.3}
                emissive='#ffffff'
                emissiveIntensity={0.1}
              />
            </mesh>
          ))}
        </group>
      )}

      {/* Cyberpunk Grid Floor */}
      {style === 'cyberpunk' && (
        <group position={[0, -9.5, 0]}>
          <lineSegments>
            <edgesGeometry
              args={[new THREE.PlaneGeometry(1000, 1000, 50, 50)]}
            />
            <lineBasicMaterial color='#00ffff' transparent opacity={0.3} />
          </lineSegments>
        </group>
      )}

      {/* Nightmare Shadows */}
      {style === 'nightmare' && (
        <group>
          {[...Array(12)].map((_, i) => (
            <mesh
              key={i}
              position={[
                (Math.random() - 0.5) * 100,
                Math.random() * 30,
                (Math.random() - 0.5) * 100,
              ]}
              rotation={[0, Math.random() * Math.PI, 0]}
            >
              <planeGeometry
                args={[5 + Math.random() * 10, 15 + Math.random() * 20]}
              />
              <meshBasicMaterial
                color='#000000'
                transparent
                opacity={0.7}
                side={THREE.DoubleSide}
              />
            </mesh>
          ))}
        </group>
      )}

      {/* Surreal Floating Geometric Shapes */}
      {style === 'surreal' && (
        <group>
          {[...Array(6)].map((_, i) => {
            const shapes = ['box', 'sphere', 'cylinder'];
            const shape = shapes[i % shapes.length];

            return (
              <mesh
                key={i}
                position={[
                  (Math.random() - 0.5) * 150,
                  Math.random() * 80 + 20,
                  (Math.random() - 0.5) * 150,
                ]}
                rotation={[
                  Math.random() * Math.PI,
                  Math.random() * Math.PI,
                  Math.random() * Math.PI,
                ]}
                scale={[
                  1 + Math.random() * 2,
                  1 + Math.random() * 2,
                  1 + Math.random() * 2,
                ]}
              >
                {shape === 'box' && <boxGeometry args={[5, 5, 5]} />}
                {shape === 'sphere' && <sphereGeometry args={[3, 8, 8]} />}
                {shape === 'cylinder' && <cylinderGeometry args={[2, 4, 8]} />}
                <meshStandardMaterial
                  color={['#ff0080', '#80ff00', '#0080ff'][i % 3]}
                  emissive={['#ff0080', '#80ff00', '#0080ff'][i % 3]}
                  emissiveIntensity={0.3}
                  transparent
                  opacity={0.7}
                />
              </mesh>
            );
          })}
        </group>
      )}

      {/* Fantasy Magical Lights */}
      {style === 'fantasy' && (
        <group>
          {[...Array(15)].map((_, i) => (
            <mesh
              key={i}
              position={[
                (Math.random() - 0.5) * 200,
                Math.random() * 50 + 10,
                (Math.random() - 0.5) * 200,
              ]}
            >
              <sphereGeometry args={[0.5, 8, 8]} />
              <meshBasicMaterial
                color={['#ffd700', '#ff6b4a', '#9d4edd'][i % 3]}
                transparent
                opacity={0.8}
              />
              <pointLight
                color={['#ffd700', '#ff6b4a', '#9d4edd'][i % 3]}
                intensity={0.5}
                distance={20}
              />
            </mesh>
          ))}
        </group>
      )}
    </group>
  );
}
