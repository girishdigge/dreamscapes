// services/frontend/next-app/app/components/EnhancedStructures.tsx
// @ts-nocheck
'use client';

import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { DreamStructure } from '../types/dream';

interface EnhancedStructuresProps {
  structures?: DreamStructure[];
  style?: string;
}

export default function EnhancedStructures({
  structures = [],
  style = 'ethereal',
}: EnhancedStructuresProps) {
  return (
    <group>
      {structures.map((structure, index) => (
        <StructureRenderer
          key={structure.id || index}
          structure={structure}
          style={style}
        />
      ))}
    </group>
  );
}

function StructureRenderer({
  structure,
  style,
}: {
  structure: DreamStructure;
  style: string;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const meshRef = useRef<THREE.Mesh>(null);

  const {
    type,
    pos = [0, 0, 0],
    scale = 1,
    rotation = [0, 0, 0],
    features = [],
    material = {},
    animation,
  } = structure;

  // Animation
  useFrame((state) => {
    if (!groupRef.current) return;

    const time = state.clock.elapsedTime;

    // Handle rotation animation
    if (animation?.type === 'rotate' || features.includes('rotating')) {
      const speed = animation?.speed || 0.5;
      groupRef.current.rotation.y = time * speed;
    }

    // Handle orbit animation
    if (animation?.type === 'orbit') {
      const speed = animation.speed || 0.3;
      const amplitude = animation.amplitude || 40;
      const angle = time * speed;
      groupRef.current.position.x = Math.cos(angle) * amplitude;
      groupRef.current.position.z = Math.sin(angle) * amplitude;
    }

    // Handle pulsating
    if (features.includes('pulsating')) {
      const pulseScale = 1 + Math.sin(time * 2) * 0.1;
      groupRef.current.scale.setScalar(scale * pulseScale);
    }
  });

  // Get material properties
  const materialProps = useMemo(() => {
    const props: any = {
      color: material.color || getStyleColor(style),
      metalness: material.metalness ?? 0.3,
      roughness: material.roughness ?? 0.7,
    };

    if (material.emissiveIntensity || features.includes('emissive')) {
      props.emissive = material.emissive || material.color || '#ffffff';
      props.emissiveIntensity = material.emissiveIntensity || 0.5;
    }

    if (material.opacity !== undefined || features.includes('transparent')) {
      props.transparent = true;
      props.opacity = material.opacity ?? 0.7;
    }

    if (material.transmission !== undefined) {
      props.transmission = material.transmission;
      props.thickness = 0.5;
      props.ior = 1.5;
    }

    return props;
  }, [material, features, style]);

  // Render appropriate geometry based on type
  const geometry = useMemo(() => {
    switch (type) {
      case 'star':
        return <icosahedronGeometry args={[1, 2]} />;

      case 'planet':
        return <sphereGeometry args={[1, 32, 32]} />;

      case 'crystal':
      case 'crystal_tower':
      case 'crystal_spire':
        return <octahedronGeometry args={[1, 0]} />;

      case 'galaxy':
        return <torusGeometry args={[1, 0.3, 16, 100]} />;

      case 'energy_nexus':
        return <dodecahedronGeometry args={[1, 0]} />;

      case 'organic_tree':
      case 'data_tree_1':
      case 'data_tree_2':
        return <coneGeometry args={[0.5, 2, 8]} />;

      case 'floating_platform':
        return <cylinderGeometry args={[1, 1, 0.2, 32]} />;

      case 'floating_library':
      case 'library':
        return <boxGeometry args={[2, 1.5, 1.5]} />;

      case 'portal_arch':
        return <torusGeometry args={[1, 0.2, 16, 32, Math.PI]} />;

      case 'twisted_house':
        return <boxGeometry args={[1, 1.5, 1]} />;

      case 'infinite_staircase':
        return <boxGeometry args={[0.5, 0.1, 1]} />;

      case 'floating_island':
        return (
          <sphereGeometry args={[1, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
        );

      default:
        return <boxGeometry args={[1, 1, 1]} />;
    }
  }, [type]);

  return (
    <group ref={groupRef} position={pos} rotation={rotation} scale={scale}>
      <mesh ref={meshRef} castShadow receiveShadow>
        {geometry}
        <meshStandardMaterial {...materialProps} />
      </mesh>

      {/* Add glow effect for glowing edges */}
      {features.includes('glowing_edges') && (
        <mesh scale={1.05}>
          {geometry}
          <meshBasicMaterial
            color={material.color || getStyleColor(style)}
            transparent
            opacity={0.3}
            side={THREE.BackSide}
          />
        </mesh>
      )}
    </group>
  );
}

function getStyleColor(style: string): string {
  switch (style) {
    case 'cyberpunk':
      return '#00FF41';
    case 'ethereal':
      return '#FFD700';
    case 'fantasy':
      return '#4488FF';
    case 'surreal':
      return '#FFB6D9';
    default:
      return '#FFFFFF';
  }
}
