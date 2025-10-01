// services/frontend/next-app/app/components/DreamStructures.tsx
'use client';

import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { DreamStructure } from '../types/dream';

interface DreamStructuresProps {
  structures?: DreamStructure[];
  style?: string;
}

export default function DreamStructures({
  structures = [],
  style = 'ethereal',
}: DreamStructuresProps) {
  return (
    <group>
      {structures.map((structure, index) => (
        <StructureTemplate
          key={structure.id || index}
          structure={structure}
          style={style}
        />
      ))}
    </group>
  );
}

interface StructureTemplateProps {
  structure: DreamStructure;
  style: string;
}

function StructureTemplate({ structure, style }: StructureTemplateProps) {
  const meshRef = useRef<THREE.Group>(null);
  const {
    template,
    pos = [0, 0, 0],
    scale = 1,
    rotation = [0, 0, 0],
    features = [],
  } = structure;

  // Animate structure based on style
  useFrame((state) => {
    if (!meshRef.current) return;

    const time = state.clock.getElapsedTime();

    switch (style) {
      case 'ethereal':
        // Gentle floating motion
        meshRef.current.position.y = pos[1] + Math.sin(time * 0.5 + pos[0]) * 2;
        meshRef.current.rotation.y = rotation[1] + Math.sin(time * 0.2) * 0.1;
        break;
      case 'surreal':
        // Impossible movements
        meshRef.current.rotation.x = rotation[0] + Math.sin(time * 0.7) * 0.3;
        meshRef.current.rotation.z = rotation[2] + Math.cos(time * 0.5) * 0.2;
        meshRef.current.scale.setScalar(
          scale * (1 + Math.sin(time * 0.8) * 0.1)
        );
        break;
      case 'cyberpunk':
        // Subtle digital glitch
        if (Math.random() < 0.01) {
          // 1% chance per frame
          meshRef.current.position.x = pos[0] + (Math.random() - 0.5) * 0.5;
          meshRef.current.position.z = pos[2] + (Math.random() - 0.5) * 0.5;
        }
        break;
      default:
        // Minimal movement for other styles
        meshRef.current.position.y =
          pos[1] + Math.sin(time * 0.3 + pos[0]) * 0.5;
        break;
    }
  });

  // Get material based on style
  const getMaterial = (baseColor = '#888888') => {
    switch (style) {
      case 'ethereal':
        return (
          <meshStandardMaterial
            color={baseColor}
            emissive={baseColor}
            emissiveIntensity={0.2}
            transparent
            opacity={0.8}
            roughness={0.3}
            metalness={0.1}
          />
        );
      case 'cyberpunk':
        return (
          <meshStandardMaterial
            color='#003366'
            emissive='#00ffff'
            emissiveIntensity={0.5}
            roughness={0.1}
            metalness={0.9}
          />
        );
      case 'nightmare':
        return (
          <meshStandardMaterial
            color='#1a0d1a'
            emissive='#660022'
            emissiveIntensity={0.3}
            roughness={0.8}
            metalness={0.2}
          />
        );
      case 'fantasy':
        return (
          <meshStandardMaterial
            color='#8B4513'
            emissive='#FFD700'
            emissiveIntensity={0.2}
            roughness={0.6}
            metalness={0.3}
          />
        );
      case 'surreal':
        return (
          <meshStandardMaterial
            color='#FF1493'
            emissive='#9370DB'
            emissiveIntensity={0.4}
            roughness={0.2}
            metalness={0.7}
          />
        );
      default:
        return <meshStandardMaterial color={baseColor} />;
    }
  };

  const renderStructure = () => {
    switch (template) {
      case 'floating_library':
        return (
          <group>
            {/* Main building */}
            <mesh position={[0, 0, 0]}>
              <boxGeometry args={[20, 15, 12]} />
              {getMaterial('#4a5568')}
            </mesh>

            {/* Floating book shelves */}
            {[...Array(6)].map((_, i) => (
              <mesh
                key={i}
                position={[
                  (Math.random() - 0.5) * 30,
                  5 + i * 3,
                  (Math.random() - 0.5) * 30,
                ]}
                rotation={[0, Math.random() * Math.PI, 0]}
              >
                <boxGeometry args={[8, 2, 1]} />
                {getMaterial('#8B4513')}
              </mesh>
            ))}

            {/* Magical aura */}
            <mesh position={[0, 0, 0]}>
              <sphereGeometry args={[25, 16, 16]} />
              <meshBasicMaterial
                color='#87ceeb'
                transparent
                opacity={0.1}
                side={THREE.BackSide}
              />
            </mesh>

            {/* Infinite stair feature */}
            {features.includes('infinite_stair') && (
              <group>
                {[...Array(20)].map((_, i) => (
                  <mesh
                    key={i}
                    position={[15, i * 1.5 - 10, i * 2]}
                    rotation={[0, Math.PI / 8, 0]}
                  >
                    <boxGeometry args={[3, 0.5, 6]} />
                    {getMaterial('#696969')}
                  </mesh>
                ))}
              </group>
            )}
          </group>
        );

      case 'crystal_tower':
        return (
          <group>
            {/* Main crystal tower */}
            <mesh position={[0, 15, 0]}>
              <cylinderGeometry args={[2, 8, 30, 8]} />
              {getMaterial('#E0E0E0')}
            </mesh>

            {/* Crystal formations */}
            {[...Array(8)].map((_, i) => (
              <mesh
                key={i}
                position={[
                  Math.cos((i * Math.PI) / 4) * 12,
                  5 + Math.random() * 20,
                  Math.sin((i * Math.PI) / 4) * 12,
                ]}
                rotation={[Math.random() * Math.PI, 0, Math.random() * Math.PI]}
              >
                <coneGeometry args={[2, 8, 6]} />
                {getMaterial('#B0E0E6')}
              </mesh>
            ))}
          </group>
        );

      case 'floating_island':
        return (
          <group>
            {/* Island base */}
            <mesh position={[0, 0, 0]}>
              <sphereGeometry
                args={[15, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2]}
              />
              {getMaterial('#228B22')}
            </mesh>

            {/* Trees */}
            {[...Array(8)].map((_, i) => (
              <group
                key={i}
                position={[
                  (Math.random() - 0.5) * 20,
                  2,
                  (Math.random() - 0.5) * 20,
                ]}
              >
                <mesh position={[0, 4, 0]}>
                  <cylinderGeometry args={[0.5, 0.8, 8]} />
                  {getMaterial('#8B4513')}
                </mesh>
                <mesh position={[0, 10, 0]}>
                  <sphereGeometry args={[4, 8, 8]} />
                  {getMaterial('#228B22')}
                </mesh>
              </group>
            ))}
          </group>
        );

      default:
        // Fallback generic structure
        return (
          <mesh position={[0, 5, 0]}>
            <boxGeometry args={[10, 10, 10]} />
            {getMaterial('#888888')}
          </mesh>
        );
    }
  };

  return (
    <group
      ref={meshRef}
      position={pos}
      scale={[scale, scale, scale]}
      rotation={rotation}
    >
      {renderStructure()}
    </group>
  );
}
