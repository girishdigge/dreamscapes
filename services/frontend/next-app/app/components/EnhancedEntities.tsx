// services/frontend/next-app/app/components/EnhancedEntities.tsx
// @ts-nocheck
'use client';

import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { DreamEntity } from '../types/dream';

interface EnhancedEntitiesProps {
  entities?: DreamEntity[];
  style?: string;
  isPlaying?: boolean;
  currentTime?: number;
}

export default function EnhancedEntities({
  entities = [],
  style = 'ethereal',
  isPlaying = true,
  currentTime = 0,
}: EnhancedEntitiesProps) {
  return (
    <group>
      {entities.map((entity, index) => (
        <EntityRenderer
          key={entity.id || index}
          entity={entity}
          style={style}
          isPlaying={isPlaying}
        />
      ))}
    </group>
  );
}

function EntityRenderer({
  entity,
  style,
  isPlaying,
}: {
  entity: DreamEntity;
  style: string;
  isPlaying: boolean;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const particlesRef = useRef<THREE.Points>(null);

  const { type, count = 50, params = {}, motion = {} } = entity;

  // Provide defaults for params
  const speed = params.speed ?? 1.0;
  const glow = params.glow ?? 0.7;
  const size = params.size ?? 1.0;
  const color = params.color || '#FFFFFF';

  // Create particle positions
  const { positions, velocities } = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const velocities = new Float32Array(count * 3);

    const center = motion.center || [0, 0, 0];
    const radius = motion.radius || 20;

    for (let i = 0; i < count; i++) {
      const i3 = i * 3;

      // Random position within sphere
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = Math.random() * radius;

      positions[i3] = center[0] + r * Math.sin(phi) * Math.cos(theta);
      positions[i3 + 1] = center[1] + r * Math.sin(phi) * Math.sin(theta);
      positions[i3 + 2] = center[2] + r * Math.cos(phi);

      // Random velocity
      velocities[i3] = (Math.random() - 0.5) * speed;
      velocities[i3 + 1] = (Math.random() - 0.5) * speed;
      velocities[i3 + 2] = (Math.random() - 0.5) * speed;
    }

    return { positions, velocities };
  }, [count, motion, speed]);

  // Animation
  useFrame((state) => {
    if (!particlesRef.current || !isPlaying) return;

    const time = state.clock.elapsedTime;
    const positions = particlesRef.current.geometry.attributes.position
      .array as Float32Array;

    const center = motion.center || [0, 0, 0];
    const radius = motion.radius || 20;
    const frequency = motion.frequency || 0.5;

    for (let i = 0; i < count; i++) {
      const i3 = i * 3;

      if (motion.type === 'wander') {
        // Wander motion with attraction to center
        const dx = center[0] - positions[i3];
        const dy = center[1] - positions[i3 + 1];
        const dz = center[2] - positions[i3 + 2];
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

        if (dist > radius) {
          // Pull back towards center
          velocities[i3] += dx * 0.001;
          velocities[i3 + 1] += dy * 0.001;
          velocities[i3 + 2] += dz * 0.001;
        }

        // Add some randomness
        velocities[i3] += (Math.random() - 0.5) * 0.01;
        velocities[i3 + 1] += (Math.random() - 0.5) * 0.01;
        velocities[i3 + 2] += (Math.random() - 0.5) * 0.01;

        // Apply velocity with damping
        positions[i3] += velocities[i3] * speed * 0.1;
        positions[i3 + 1] += velocities[i3 + 1] * speed * 0.1;
        positions[i3 + 2] += velocities[i3 + 2] * speed * 0.1;

        velocities[i3] *= 0.98;
        velocities[i3 + 1] *= 0.98;
        velocities[i3 + 2] *= 0.98;
      } else if (motion.type === 'swarm') {
        // Swarm motion - orbit around center
        const angle = time * frequency + i * 0.1;
        const orbitRadius = radius * (0.5 + Math.sin(time + i) * 0.5);
        const height = Math.sin(time * 0.5 + i) * radius * 0.3;

        positions[i3] = center[0] + Math.cos(angle) * orbitRadius;
        positions[i3 + 1] = center[1] + height;
        positions[i3 + 2] = center[2] + Math.sin(angle) * orbitRadius;
      }
    }

    particlesRef.current.geometry.attributes.position.needsUpdate = true;
  });

  // Get particle size based on type
  const particleSize = useMemo(() => {
    switch (type) {
      case 'book_swarm':
        return size * 2;
      case 'floating_orbs':
        return size * 1.5;
      case 'light_butterflies':
        return size * 1.2;
      default:
        return size;
    }
  }, [type, size]);

  return (
    <group ref={groupRef}>
      <points ref={particlesRef}>
        <bufferGeometry>
          <bufferAttribute
            attach='attributes-position'
            count={count}
            array={positions}
            itemSize={3}
          />
        </bufferGeometry>
        <pointsMaterial
          size={particleSize}
          color={color}
          transparent
          opacity={glow}
          sizeAttenuation
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </points>
    </group>
  );
}
