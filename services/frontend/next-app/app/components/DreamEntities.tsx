// services/frontend/next-app/app/components/DreamEntities.tsx
'use client';

import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { DreamEntity } from '../types/dream';

interface DreamEntitiesProps {
  entities?: DreamEntity[];
  style?: string;
  isPlaying: boolean;
  currentTime: number;
}

export default function DreamEntities({
  entities = [],
  style = 'ethereal',
  isPlaying,
  currentTime,
}: DreamEntitiesProps) {
  return (
    <group>
      {entities.map((entity, index) => (
        <EntityTemplate
          key={entity.id || index}
          entity={entity}
          style={style}
          isPlaying={isPlaying}
          currentTime={currentTime}
        />
      ))}
    </group>
  );
}

interface EntityTemplateProps {
  entity: DreamEntity;
  style: string;
  isPlaying: boolean;
  currentTime: number;
}

function EntityTemplate({ entity, style }: EntityTemplateProps) {
  const instancedMeshRef = useRef<THREE.InstancedMesh>(null);
  const { type, count = 10, params = {} } = entity;

  const { speed = 1.0, glow = 0.5, size = 1.0, color = '#ffffff' } = params;

  // Create instanced positions and data for performance
  const instanceData = useMemo(() => {
    const positions = [];
    const velocities = [];
    const phases = [];

    for (let i = 0; i < count; i++) {
      // Random starting positions
      positions.push({
        x: (Math.random() - 0.5) * 100,
        y: Math.random() * 50 + 10,
        z: (Math.random() - 0.5) * 100,
      });

      // Random velocities
      velocities.push({
        x: (Math.random() - 0.5) * speed * 2,
        y: (Math.random() - 0.5) * speed,
        z: (Math.random() - 0.5) * speed * 2,
      });

      // Random phase offsets for animation
      phases.push(Math.random() * Math.PI * 2);
    }

    return { positions, velocities, phases };
  }, [count, speed]);

  // Animation loop
  useFrame((state) => {
    if (!instancedMeshRef.current) return;

    const time = state.clock.getElapsedTime();
    const dummy = new THREE.Object3D();

    // Update each instance
    for (let i = 0; i < count; i++) {
      const pos = instanceData.positions[i];
      const phase = instanceData.phases[i];

      // Different movement patterns based on entity type
      let x, y, z;

      switch (type) {
        case 'book_swarm':
          // Books fly in formation, occasionally spelling words
          x = pos.x + Math.sin(time * speed + phase) * 20;
          y = pos.y + Math.cos(time * speed * 0.7 + phase) * 10;
          z = pos.z + Math.sin(time * speed * 0.5 + phase) * 15;

          // Spell "DREAM" formation occasionally
          if (Math.sin(time * 0.3) > 0.8) {
            const letterSpacing = 15;
            const letterIndex = i % 5; // D-R-E-A-M
            x = (letterIndex - 2) * letterSpacing;
            y = 30 + Math.sin(time * 2 + i * 0.5) * 3;
          }
          break;

        case 'floating_orbs':
          // Smooth orbital motion
          const radius = 30 + i * 2;
          const orbitalSpeed = speed * 0.5;
          x = Math.cos(time * orbitalSpeed + phase) * radius;
          y = pos.y + Math.sin(time * orbitalSpeed * 2 + phase) * 5;
          z = Math.sin(time * orbitalSpeed + phase) * radius;
          break;

        case 'particle_stream':
          // Flowing stream effect
          x = pos.x;
          y = pos.y + speed * 10 * Math.sin(time + i * 0.1);
          z = pos.z + Math.sin(time * speed + i * 0.1) * 5;
          break;

        case 'light_butterflies':
          // Erratic butterfly-like movement
          x =
            pos.x +
            Math.sin(time * speed * 2 + phase) * 8 +
            Math.cos(time * speed * 3 + phase) * 15;
          y = pos.y + Math.sin(time * speed * 4 + phase) * 12;
          z =
            pos.z +
            Math.cos(time * speed * 2 + phase) * 8 +
            Math.sin(time * speed * 3 + phase) * 15;
          break;

        default:
          // Default floating motion
          x = pos.x + Math.sin(time * speed + phase) * 10;
          y = pos.y + Math.cos(time * speed * 0.7 + phase) * 5;
          z = pos.z + Math.sin(time * speed * 0.5 + phase) * 10;
          break;
      }

      // Set position and rotation
      dummy.position.set(x, y, z);
      dummy.rotation.set(
        time * speed * 0.5 + phase,
        time * speed * 0.7 + phase,
        time * speed * 0.3 + phase
      );
      dummy.scale.setScalar(size * (0.8 + Math.sin(time * 2 + phase) * 0.2));

      dummy.updateMatrix();
      instancedMeshRef.current.setMatrixAt(i, dummy.matrix);
    }

    instancedMeshRef.current.instanceMatrix.needsUpdate = true;
  });

  // Get geometry based on entity type
  const getGeometry = () => {
    switch (type) {
      case 'book_swarm':
        return <boxGeometry args={[1.5, 0.3, 1]} />;
      case 'floating_orbs':
        return <sphereGeometry args={[0.8, 8, 8]} />;
      case 'particle_stream':
        return <sphereGeometry args={[0.3, 6, 6]} />;
      case 'light_butterflies':
        return <planeGeometry args={[2, 1]} />;
      default:
        return <sphereGeometry args={[1, 8, 8]} />;
    }
  };

  // Get material based on style and entity type
  const getMaterial = () => {
    const baseColor = new THREE.Color(color);
    const emissiveIntensity = glow;

    const materialProps = {
      color: baseColor,
      emissive: baseColor,
      emissiveIntensity: emissiveIntensity,
      transparent: true,
      opacity: 0.8,
    };

    switch (style) {
      case 'ethereal':
        return (
          <meshStandardMaterial
            {...materialProps}
            opacity={0.7}
            roughness={0.3}
            metalness={0.1}
          />
        );
      case 'cyberpunk':
        return (
          <meshStandardMaterial
            {...materialProps}
            emissiveIntensity={emissiveIntensity * 1.5}
            roughness={0.1}
            metalness={0.9}
          />
        );
      case 'nightmare':
        return (
          <meshStandardMaterial
            {...materialProps}
            color={new THREE.Color('#800020')}
            emissive={new THREE.Color('#2c1810')}
            emissiveIntensity={emissiveIntensity * 0.8}
            roughness={0.8}
            metalness={0.2}
          />
        );
      case 'fantasy':
        return (
          <meshStandardMaterial
            {...materialProps}
            emissiveIntensity={emissiveIntensity * 1.2}
            roughness={0.4}
            metalness={0.3}
          />
        );
      case 'surreal':
        return (
          <meshStandardMaterial
            {...materialProps}
            color={new THREE.Color('#ff0080')}
            emissive={new THREE.Color('#9d4edd')}
            emissiveIntensity={emissiveIntensity * 1.3}
            roughness={0.2}
            metalness={0.7}
          />
        );
      default:
        return <meshStandardMaterial {...materialProps} />;
    }
  };

  // Standard instanced rendering for better performance
  return (
    <instancedMesh ref={instancedMeshRef} args={[undefined, undefined, count]}>
      {getGeometry()}
      {getMaterial()}
    </instancedMesh>
  );
}
