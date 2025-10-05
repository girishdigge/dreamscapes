// services/frontend/next-app/app/components/DreamStructures.tsx
// @ts-nocheck - R3F types don't include PBR properties (clearcoat, transmission, etc.)
'use client';

import { useRef, useMemo, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { DreamStructure } from '../types/dream';
import { getMaterialPreset } from '../utils/materialPresets';
import { getEasingFunction } from '../utils/animationEasing';
import {
  EllipticalOrbit,
  RotationMomentum,
  FloatMotion,
  SpiralMotion,
} from '../utils/motionSystem';

// Note: React Three Fiber's TypeScript definitions don't yet include all PBR properties
// (clearcoat, transmission, ior, etc.) that exist in Three.js MeshStandardMaterial.
// These properties work correctly at runtime but cause TypeScript errors.

// LOD distance thresholds
const LOD_DISTANCES = {
  high: 0, // 0-50 units from camera
  medium: 50, // 50-100 units from camera
  low: 100, // 100+ units from camera
};

interface DreamStructuresProps {
  structures?: DreamStructure[];
  style?: string;
}

export default function DreamStructures({
  structures = [],
  style = 'ethereal',
}: DreamStructuresProps) {
  // Create a map of structures for attachment lookups
  const structureRefs = useRef<Map<string, THREE.Group>>(new Map());

  return (
    <group>
      {structures.map((structure, index) => (
        <StructureRenderer
          key={structure.id || index}
          structure={structure}
          style={style}
          structureRefs={structureRefs}
          allStructures={structures}
        />
      ))}
    </group>
  );
}

interface StructureRendererProps {
  structure: DreamStructure;
  style: string;
  structureRefs: React.MutableRefObject<Map<string, THREE.Group>>;
  allStructures: DreamStructure[];
}

function StructureRenderer({
  structure,
  style,
  structureRefs,
  allStructures,
}: StructureRendererProps) {
  const groupRef = useRef<THREE.Group>(null);
  const startTimeRef = useRef<number>(Date.now() / 1000);
  const { camera } = useThree();

  // Track LOD level based on distance from camera
  const [lodLevel, setLodLevel] = useState<'high' | 'medium' | 'low'>('high');

  const {
    id,
    type,
    pos = [0, 0, 0],
    scale = 1,
    rotation = [0, 0, 0],
    features = [],
    material = {},
    motion,
    animation,
  } = structure;

  // Check if this structure should attach to another
  const attachTo = motion?.attachTo;

  // Initialize enhanced motion systems
  const motionSystems = useMemo(() => {
    const systems: {
      orbit?: EllipticalOrbit;
      spiral?: SpiralMotion;
      float?: FloatMotion;
      rotationMomentum?: RotationMomentum;
    } = {};

    if (motion) {
      // Elliptical orbit motion
      if (motion.type === 'orbit' && motion.radius) {
        const radiusX = Array.isArray(motion.radius)
          ? motion.radius[0]
          : motion.radius;
        const radiusZ = Array.isArray(motion.radius)
          ? motion.radius[1] || radiusX
          : radiusX;
        const center: [number, number, number] = motion.center || [0, 0, 0];
        const speed = motion.speed || 0.5;
        const tilt = motion.tilt || 0;
        const rotationOffset = motion.rotationOffset || 0;

        systems.orbit = new EllipticalOrbit(
          center,
          radiusX,
          radiusZ,
          speed,
          tilt,
          rotationOffset
        );
      }

      // Spiral motion (orbit with height variation)
      if (motion.type === 'spiral' && motion.radius) {
        const radiusX = Array.isArray(motion.radius)
          ? motion.radius[0]
          : motion.radius;
        const radiusZ = Array.isArray(motion.radius)
          ? motion.radius[1] || radiusX
          : radiusX;
        const center: [number, number, number] = motion.center || [0, 0, 0];
        const speed = motion.speed || 0.5;
        const heightAmplitude = motion.heightAmplitude || 10;
        const heightFrequency = motion.heightFrequency || 1.0;

        systems.spiral = new SpiralMotion(
          center,
          radiusX,
          radiusZ,
          speed,
          heightAmplitude,
          heightFrequency
        );
      }

      // Enhanced float motion with multiple sine waves
      if (motion.type === 'float' || (!motion.type && style === 'ethereal')) {
        systems.float = new FloatMotion([
          { amplitude: 0.3, frequency: 0.5, axis: 'y', phase: 0 },
          { amplitude: 0.15, frequency: 0.7, axis: 'y', phase: Math.PI / 4 },
          { amplitude: 0.1, frequency: 0.3, axis: 'x', phase: 0 },
          { amplitude: 0.1, frequency: 0.4, axis: 'z', phase: Math.PI / 2 },
        ]);
      }

      // Multi-axis rotation with momentum
      if (motion.type === 'rotate' || motion.rotation) {
        const damping = motion.damping || 0.98;
        const maxSpeed = motion.maxRotationSpeed || 2.0;
        systems.rotationMomentum = new RotationMomentum(damping, maxSpeed);

        // Set initial angular velocity if specified
        if (motion.angularVelocity) {
          const vel = new THREE.Vector3(...motion.angularVelocity);
          systems.rotationMomentum.setVelocity(vel);
        } else if (motion.rotation) {
          // Convert rotation speed to angular velocity
          const vel = new THREE.Vector3(
            motion.rotation[0] || 0,
            motion.rotation[1] || 0,
            motion.rotation[2] || 0
          );
          systems.rotationMomentum.setVelocity(vel);
        }
      }
    }

    return systems;
  }, [motion, style]);

  // Register this structure in the refs map
  useMemo(() => {
    if (id && groupRef.current) {
      structureRefs.current.set(id, groupRef.current);
    }
  }, [id, structureRefs]);

  // Handle animations and motion
  useFrame((state) => {
    if (!groupRef.current) return;

    const time = state.clock.getElapsedTime();
    const elapsed = time - startTimeRef.current;

    // Calculate LOD level based on distance from camera
    const distance = camera.position.distanceTo(groupRef.current.position);
    let newLodLevel: 'high' | 'medium' | 'low' = 'high';

    if (distance > LOD_DISTANCES.low) {
      newLodLevel = 'low';
    } else if (distance > LOD_DISTANCES.medium) {
      newLodLevel = 'medium';
    }

    if (newLodLevel !== lodLevel) {
      setLodLevel(newLodLevel);
    }

    // Handle attachment to parent structure
    if (attachTo) {
      const parentRef = structureRefs.current.get(attachTo);
      if (parentRef) {
        // Copy parent's world position
        const parentWorldPos = new THREE.Vector3();
        parentRef.getWorldPosition(parentWorldPos);
        groupRef.current.position.copy(parentWorldPos);

        // Add offset if specified
        if (motion?.offset) {
          groupRef.current.position.add(new THREE.Vector3(...motion.offset));
        } else {
          groupRef.current.position.add(new THREE.Vector3(...pos));
        }
      }
    }

    // Handle motion animations with enhanced systems
    if (motion && !attachTo) {
      // Elliptical orbit with banking
      if (motionSystems.orbit) {
        const newPosition = motionSystems.orbit.getPosition(time);
        groupRef.current.position.copy(newPosition);

        // Apply banking to rotation
        if (motion.banking !== false) {
          const bankingAngle = motionSystems.orbit.getBankingAngle(
            time,
            motion.bankingFactor || 1.0
          );
          groupRef.current.rotation.z = bankingAngle;

          // Face direction of movement
          const velocity = motionSystems.orbit.getVelocity(time);
          const angle = Math.atan2(velocity.x, velocity.z);
          groupRef.current.rotation.y = angle;
        }
      }
      // Spiral motion
      else if (motionSystems.spiral) {
        const newPosition = motionSystems.spiral.getPosition(time);
        groupRef.current.position.copy(newPosition);

        // Apply banking
        if (motion.banking !== false) {
          const bankingAngle = motionSystems.spiral.getBankingAngle(
            time,
            motion.bankingFactor || 1.0
          );
          groupRef.current.rotation.z = bankingAngle;
        }
      }
      // Enhanced float motion
      else if (motionSystems.float) {
        const offset = motionSystems.float.getOffset(time);
        groupRef.current.position.set(
          pos[0] + offset.x,
          pos[1] + offset.y,
          pos[2] + offset.z
        );
      }
      // Legacy motion types
      else {
        switch (motion.type) {
          case 'move_to':
            if (motion.to && motion.duration) {
              const progress = Math.min(elapsed / motion.duration, 1);
              const easedProgress = applyEasing(
                progress,
                motion.easing || 'linear'
              );
              const start = new THREE.Vector3(...pos);
              const end = new THREE.Vector3(...motion.to);
              groupRef.current.position.lerpVectors(start, end, easedProgress);
            }
            break;

          case 'move_along':
            if (motion.path && motion.path.length > 1 && motion.duration) {
              const progress = Math.min(elapsed / motion.duration, 1);
              const easedProgress = applyEasing(
                progress,
                motion.easing || 'linear'
              );
              const pathIndex = Math.floor(
                easedProgress * (motion.path.length - 1)
              );
              const nextIndex = Math.min(pathIndex + 1, motion.path.length - 1);
              const localProgress =
                (easedProgress * (motion.path.length - 1)) % 1;

              const currentPoint = motion.path[pathIndex];
              const nextPoint = motion.path[nextIndex];

              if (currentPoint && nextPoint) {
                const current = new THREE.Vector3(
                  currentPoint[0],
                  currentPoint[1],
                  currentPoint[2]
                );
                const next = new THREE.Vector3(
                  nextPoint[0],
                  nextPoint[1],
                  nextPoint[2]
                );
                groupRef.current.position.lerpVectors(
                  current,
                  next,
                  localProgress
                );
              }
            }
            break;
        }
      }

      // Handle multi-axis rotation with momentum
      if (motionSystems.rotationMomentum) {
        const rotationDelta = motionSystems.rotationMomentum.update(
          state.clock.getDelta()
        );
        groupRef.current.rotation.x += rotationDelta.x;
        groupRef.current.rotation.y += rotationDelta.y;
        groupRef.current.rotation.z += rotationDelta.z;

        // Apply torque if specified
        if (motion.torque) {
          const torque = new THREE.Vector3(...motion.torque);
          motionSystems.rotationMomentum.applyTorque(torque);
        }
      }
    }

    // Handle scale animation
    if (
      animation?.type === 'scale' &&
      animation.from !== undefined &&
      animation.to !== undefined
    ) {
      const progress = Math.min(elapsed / (animation.duration || 1), 1);
      const easedProgress = applyEasing(progress, animation.easing || 'linear');
      const currentScale =
        animation.from + (animation.to - animation.from) * easedProgress;
      groupRef.current.scale.setScalar(currentScale);
    }

    // Style-based ambient animations (only if no motion defined)
    if (!motion && !animation) {
      switch (style) {
        case 'ethereal':
          groupRef.current.position.y =
            pos[1] + Math.sin(time * 0.5 + pos[0]) * 0.3;
          groupRef.current.rotation.y =
            rotation[1] + Math.sin(time * 0.2) * 0.05;
          break;
        case 'surreal':
          groupRef.current.rotation.x =
            rotation[0] + Math.sin(time * 0.7) * 0.1;
          groupRef.current.rotation.z =
            rotation[2] + Math.cos(time * 0.5) * 0.1;
          break;
      }
    }
  });

  // Create material based on structure specification with enhanced PBR properties
  const createMaterial = useMemo(() => {
    // Apply material preset if specified
    const presetMaterial = material.type
      ? getMaterialPreset(material.type)
      : {};
    const mergedMaterial = { ...presetMaterial, ...material };

    const {
      color = '#888888',
      emissive,
      emissiveIntensity = 0,
      metalness = 0.5,
      roughness = 0.5,
      opacity = 1,
      transmission = 0,
      clearcoat = 0,
      clearcoatRoughness = 0,
      envMapIntensity = 1.0,
      ior = 1.5,
      thickness = 0.5,
      attenuationColor,
      attenuationDistance,
      sheen = 0,
      sheenRoughness = 0.5,
      sheenColor,
      specularIntensity = 1.0,
      specularColor,
    } = mergedMaterial;

    const isTransparent =
      opacity < 1 || transmission > 0 || features.includes('transparent');

    const materialProps: any = {
      color: new THREE.Color(color),
      metalness,
      roughness,
      transparent: isTransparent,
      opacity,
      envMapIntensity,
    };

    // Enhanced PBR properties (using any to bypass R3F type limitations)
    if (transmission > 0) {
      (materialProps as any).transmission = transmission;
      (materialProps as any).ior = ior;
      (materialProps as any).thickness = thickness;
      if (attenuationColor) {
        (materialProps as any).attenuationColor = new THREE.Color(
          attenuationColor
        );
      }
      if (attenuationDistance !== undefined) {
        (materialProps as any).attenuationDistance = attenuationDistance;
      }
    }

    if (clearcoat > 0) {
      (materialProps as any).clearcoat = clearcoat;
      (materialProps as any).clearcoatRoughness = clearcoatRoughness;
    }

    if (sheen > 0) {
      (materialProps as any).sheen = sheen;
      (materialProps as any).sheenRoughness = sheenRoughness;
      if (sheenColor) {
        (materialProps as any).sheenColor = new THREE.Color(sheenColor);
      }
    }

    if (specularIntensity !== 1.0) {
      (materialProps as any).specularIntensity = specularIntensity;
    }

    if (specularColor) {
      (materialProps as any).specularColor = new THREE.Color(specularColor);
    }

    // Emissive properties
    if (emissive) {
      materialProps.emissive = new THREE.Color(emissive);
      materialProps.emissiveIntensity = emissiveIntensity;
    }

    if (features.includes('emissive') && !emissive) {
      materialProps.emissive = new THREE.Color(color);
      materialProps.emissiveIntensity = emissiveIntensity || 1.0;
    }

    if (features.includes('glow')) {
      materialProps.emissiveIntensity = Math.max(
        materialProps.emissiveIntensity || 0,
        0.5
      );
    }

    return <meshStandardMaterial {...materialProps} />;
  }, [material, features]);

  // Geometry detail levels based on LOD
  const geometryDetail = {
    low: {
      sphere: [1, 16, 16],
      cylinder: [1, 1, 1, 16],
      cone: [1, 1, 16],
      torus: [1, 0.4, 8, 50],
      plane: [1, 1, 32, 32],
    },
    medium: {
      sphere: [1, 32, 32],
      cylinder: [1, 1, 1, 32],
      cone: [1, 1, 32],
      torus: [1, 0.4, 16, 100],
      plane: [1, 1, 64, 64],
    },
    high: {
      sphere: [1, 64, 64],
      cylinder: [1, 1, 1, 64],
      cone: [1, 1, 64],
      torus: [1, 0.4, 32, 200],
      plane: [1, 1, 128, 128],
    },
  };

  // Use LOD level for geometry detail
  const detail = geometryDetail[lodLevel];

  // Render geometry based on type
  const renderGeometry = () => {
    const scaleValue = typeof scale === 'number' ? scale : 1;
    const scaleArray: [number, number, number] = Array.isArray(scale)
      ? [scale[0] || 1, scale[1] || 1, scale[2] || 1]
      : [scaleValue, scaleValue, scaleValue];

    switch (type) {
      case 'sphere':
        return (
          <mesh castShadow receiveShadow scale={scaleArray}>
            <sphereGeometry args={detail.sphere as [number, number, number]} />
            {createMaterial}
          </mesh>
        );

      case 'box':
        return (
          <mesh castShadow receiveShadow scale={scaleArray}>
            <boxGeometry args={[1, 1, 1]} />
            {createMaterial}
          </mesh>
        );

      case 'cylinder':
        return (
          <mesh castShadow receiveShadow scale={scaleArray}>
            <cylinderGeometry
              args={detail.cylinder as [number, number, number, number]}
            />
            {createMaterial}
          </mesh>
        );

      case 'cone':
        return (
          <mesh castShadow receiveShadow scale={scaleArray}>
            <coneGeometry args={detail.cone as [number, number, number]} />
            {createMaterial}
          </mesh>
        );

      case 'plane':
        return (
          <mesh
            receiveShadow
            rotation={[-Math.PI / 2, 0, 0]}
            scale={scaleArray}
          >
            <planeGeometry
              args={detail.plane as [number, number, number, number]}
            />
            {createMaterial}
          </mesh>
        );

      case 'torus':
        return (
          <mesh castShadow receiveShadow scale={scaleArray}>
            <torusGeometry
              args={detail.torus as [number, number, number, number]}
            />
            {createMaterial}
          </mesh>
        );

      // Complex template structures with LOD support
      case 'ship':
        return <ShipStructure scale={scaleValue} lodLevel={lodLevel} />;

      case 'star':
        return (
          <StarStructure
            color={material.color}
            emissiveIntensity={material.emissiveIntensity}
            scale={scaleValue}
            lodLevel={lodLevel}
          />
        );

      case 'volcano':
        return <VolcanoStructure scale={scaleValue} lodLevel={lodLevel} />;

      case 'house':
      case 'organic_house':
        return <HouseStructure scale={scaleValue} lodLevel={lodLevel} />;

      case 'floating_library':
      case 'library':
        return <LibraryStructure scale={scaleValue} lodLevel={lodLevel} />;

      default:
        // Default fallback
        return (
          <mesh castShadow receiveShadow scale={scaleArray}>
            <boxGeometry args={[1, 1, 1]} />
            {createMaterial}
          </mesh>
        );
    }
  };

  return (
    <group
      ref={groupRef}
      position={attachTo ? [0, 0, 0] : pos}
      rotation={rotation}
      name={id}
    >
      {renderGeometry()}
    </group>
  );
}

// Easing functions - now using enhanced easing system (imported at top of file)
function applyEasing(
  t: number,
  easing: string | [number, number, number, number]
): number {
  const easingFn = getEasingFunction(easing);
  return easingFn(t);
}

// Complex structure templates
function ShipStructure({
  scale = 1,
  lodLevel = 'high',
}: {
  scale?: number;
  lodLevel?: 'high' | 'medium' | 'low';
}) {
  // Generate procedural windows based on LOD level
  const windows = useMemo(() => {
    const windowPositions: Array<{
      pos: [number, number, number];
      side: 'front' | 'back';
    }> = [];
    const hullLength = 40;

    // Reduce window count based on LOD
    const windowCount =
      lodLevel === 'high' ? 15 : lodLevel === 'medium' ? 8 : 4;
    const spacing = hullLength / (windowCount + 1);

    for (let i = 0; i < windowCount; i++) {
      const x = -hullLength / 2 + spacing * (i + 1);
      windowPositions.push({ pos: [x, 4, 3.85], side: 'front' });
      windowPositions.push({ pos: [x, 4, -3.85], side: 'back' });

      // Upper deck windows (every other position, only for high/medium LOD)
      if (i % 2 === 0 && lodLevel !== 'low') {
        windowPositions.push({ pos: [x, 8, 3.3], side: 'front' });
        windowPositions.push({ pos: [x, 8, -3.3], side: 'back' });
      }
    }

    return windowPositions;
  }, [lodLevel]);

  return (
    <group scale={scale}>
      {/* Lower Hull - Dark steel with enhanced metal properties */}
      <mesh position={[0, -2, 0]} castShadow>
        <boxGeometry args={[40, 8, 8]} />
        <PBRMaterial
          color='#1a1a1a'
          metalness={1.0}
          roughness={0.3}
          envMapIntensity={1.2}
          clearcoat={0.3}
          clearcoatRoughness={0.4}
        />
      </mesh>

      {/* Upper Hull - Black with enhanced metal */}
      <mesh position={[0, 3, 0]} castShadow>
        <boxGeometry args={[40, 6, 7.5]} />
        <PBRMaterial
          color='#0a0a0a'
          metalness={1.0}
          roughness={0.4}
          envMapIntensity={1.0}
          clearcoat={0.2}
          clearcoatRoughness={0.5}
        />
      </mesh>

      {/* White stripe - painted metal */}
      <mesh position={[0, 5, 3.8]}>
        <boxGeometry args={[40, 1, 0.1]} />
        <meshStandardMaterial
          color='#FFFFFF'
          metalness={0.1}
          roughness={0.4}
          clearcoat={0.5}
          clearcoatRoughness={0.2}
        />
      </mesh>
      <mesh position={[0, 5, -3.8]}>
        <boxGeometry args={[40, 1, 0.1]} />
        <meshStandardMaterial
          color='#FFFFFF'
          metalness={0.1}
          roughness={0.4}
          clearcoat={0.5}
          clearcoatRoughness={0.2}
        />
      </mesh>

      {/* Main Deck - Wooden with realistic wood properties */}
      <mesh position={[0, 6.5, 0]} castShadow>
        <boxGeometry args={[38, 0.5, 7]} />
        <meshStandardMaterial
          color='#D2B48C'
          metalness={0.0}
          roughness={0.85}
          envMapIntensity={0.3}
        />
      </mesh>

      {/* Promenade Deck - lighter wood */}
      <mesh position={[0, 9, 0]} castShadow>
        <boxGeometry args={[35, 0.3, 6.5]} />
        <meshStandardMaterial
          color='#F5F5DC'
          metalness={0.0}
          roughness={0.8}
          envMapIntensity={0.3}
        />
      </mesh>

      {/* Superstructure - White painted metal */}
      <mesh position={[5, 11, 0]} castShadow>
        <boxGeometry args={[20, 4, 6]} />
        <meshStandardMaterial
          color='#FAFAFA'
          metalness={0.1}
          roughness={0.5}
          clearcoat={0.4}
          clearcoatRoughness={0.3}
          envMapIntensity={0.6}
        />
      </mesh>

      {/* Bridge/Wheelhouse - glossy white */}
      <mesh position={[12, 13.5, 0]} castShadow>
        <boxGeometry args={[6, 3, 5]} />
        <meshStandardMaterial
          color='#FFFFFF'
          metalness={0.1}
          roughness={0.3}
          clearcoat={0.6}
          clearcoatRoughness={0.2}
          envMapIntensity={0.8}
        />
      </mesh>

      {/* Funnel 1 - Buff/Yellow painted metal with black top */}
      <mesh position={[-3, 16, -1.5]} castShadow>
        <cylinderGeometry args={[1.8, 2, 10, 32]} />
        <meshStandardMaterial
          color='#E8B04B'
          metalness={0.3}
          roughness={0.4}
          clearcoat={0.5}
          clearcoatRoughness={0.3}
          envMapIntensity={0.7}
        />
      </mesh>
      <mesh position={[-3, 20.5, -1.5]}>
        <cylinderGeometry args={[1.8, 1.8, 1, 32]} />
        <meshStandardMaterial
          color='#0a0a0a'
          metalness={0.8}
          roughness={0.5}
          envMapIntensity={0.8}
        />
      </mesh>

      {/* Funnel 2 */}
      <mesh position={[-3, 16, 1.5]} castShadow>
        <cylinderGeometry args={[1.8, 2, 10, 32]} />
        <meshStandardMaterial
          color='#E8B04B'
          metalness={0.3}
          roughness={0.4}
          clearcoat={0.5}
          clearcoatRoughness={0.3}
          envMapIntensity={0.7}
        />
      </mesh>
      <mesh position={[-3, 20.5, 1.5]}>
        <cylinderGeometry args={[1.8, 1.8, 1, 32]} />
        <meshStandardMaterial
          color='#0a0a0a'
          metalness={0.8}
          roughness={0.5}
          envMapIntensity={0.8}
        />
      </mesh>

      {/* Masts - wood with higher detail */}
      <mesh position={[15, 18, 0]} castShadow>
        <cylinderGeometry args={[0.3, 0.3, 12, 16]} />
        <meshStandardMaterial
          color='#8B7355'
          metalness={0.0}
          roughness={0.8}
          envMapIntensity={0.2}
        />
      </mesh>
      <mesh position={[-15, 15, 0]} castShadow>
        <cylinderGeometry args={[0.3, 0.3, 10, 16]} />
        <meshStandardMaterial
          color='#8B7355'
          metalness={0.0}
          roughness={0.8}
          envMapIntensity={0.2}
        />
      </mesh>

      {/* Bow - Pointed front, dark steel with higher detail */}
      <mesh position={[-20, 2, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <coneGeometry args={[5, 10, 8]} />
        <meshStandardMaterial
          color='#1a1a1a'
          metalness={1.0}
          roughness={0.3}
          envMapIntensity={1.2}
          clearcoat={0.3}
          clearcoatRoughness={0.4}
        />
      </mesh>

      {/* Stern - Flat back, dark steel */}
      <mesh position={[20, 2, 0]} castShadow>
        <boxGeometry args={[2, 10, 8]} />
        <meshStandardMaterial
          color='#1a1a1a'
          metalness={1.0}
          roughness={0.3}
          envMapIntensity={1.2}
          clearcoat={0.3}
          clearcoatRoughness={0.4}
        />
      </mesh>

      {/* Portholes - Procedurally generated glass windows with glow */}
      {windows.map((window, i) => (
        <mesh key={`port-${i}`} position={window.pos}>
          <circleGeometry args={[0.3, 32]} />
          <meshStandardMaterial
            color='#87CEEB'
            emissive='#87CEEB'
            emissiveIntensity={0.5}
            metalness={0.0}
            roughness={0.0}
            transmission={0.3}
            ior={1.5}
            envMapIntensity={1.0}
          />
        </mesh>
      ))}

      {/* Window frames - add detail (high LOD only) */}
      {lodLevel === 'high' &&
        windows.map((window, i) => (
          <mesh key={`frame-${i}`} position={window.pos}>
            <ringGeometry args={[0.3, 0.35, 32]} />
            <meshStandardMaterial
              color='#1a1a1a'
              metalness={1.0}
              roughness={0.4}
              envMapIntensity={0.8}
            />
          </mesh>
        ))}

      {/* Lifeboats - painted wood/fiberglass (high and medium LOD) */}
      {lodLevel !== 'low' &&
        [-10, -5, 0, 5, 10].map((x) => (
          <group key={`lifeboat-${x}`}>
            <mesh position={[x, 10, 4]} rotation={[0, 0, 0.2]}>
              <boxGeometry args={[4, 1, 1.5]} />
              <meshStandardMaterial
                color='#FFFFFF'
                metalness={0.0}
                roughness={0.5}
                clearcoat={0.4}
                clearcoatRoughness={0.3}
                envMapIntensity={0.5}
              />
            </mesh>
            <mesh position={[x, 10, -4]} rotation={[0, 0, -0.2]}>
              <boxGeometry args={[4, 1, 1.5]} />
              <meshStandardMaterial
                color='#FFFFFF'
                metalness={0.0}
                roughness={0.5}
                clearcoat={0.4}
                clearcoatRoughness={0.3}
                envMapIntensity={0.5}
              />
            </mesh>
          </group>
        ))}

      {/* Anchor - weathered metal (high and medium LOD) */}
      {lodLevel !== 'low' && (
        <mesh position={[-19, -1, 2]} rotation={[0, 0, 0]}>
          <torusGeometry args={[0.8, 0.3, 16, 32]} />
          <meshStandardMaterial
            color='#2F4F4F'
            metalness={1.0}
            roughness={0.7}
            envMapIntensity={0.8}
          />
        </mesh>
      )}

      {/* Hull panel lines - add surface detail (high LOD only) */}
      {lodLevel === 'high' &&
        [...Array(8)].map((_, i) => (
          <mesh key={`panel-h-${i}`} position={[-15 + i * 5, 0, 4.05]}>
            <boxGeometry args={[0.1, 12, 0.05]} />
            <meshStandardMaterial
              color='#0a0a0a'
              metalness={1.0}
              roughness={0.6}
            />
          </mesh>
        ))}

      {/* Horizontal panel lines (high LOD only) */}
      {lodLevel === 'high' &&
        [...Array(3)].map((_, i) => (
          <mesh key={`panel-v-${i}`} position={[0, -4 + i * 4, 4.05]}>
            <boxGeometry args={[40, 0.1, 0.05]} />
            <meshStandardMaterial
              color='#0a0a0a'
              metalness={1.0}
              roughness={0.6}
            />
          </mesh>
        ))}

      {/* Deck railings - add detail (high and medium LOD) */}
      {lodLevel !== 'low' &&
        [6.8, 9.2].map((y) => (
          <group key={`railing-${y}`}>
            <mesh position={[0, y, 3.6]}>
              <boxGeometry args={[38, 0.1, 0.1]} />
              <meshStandardMaterial
                color='#FFFFFF'
                metalness={0.8}
                roughness={0.3}
                envMapIntensity={1.0}
              />
            </mesh>
            <mesh position={[0, y, -3.6]}>
              <boxGeometry args={[38, 0.1, 0.1]} />
              <meshStandardMaterial
                color='#FFFFFF'
                metalness={0.8}
                roughness={0.3}
                envMapIntensity={1.0}
              />
            </mesh>
          </group>
        ))}

      {/* Navigation lights (high LOD only) */}
      {lodLevel === 'high' && (
        <>
          {/* Port light (red) */}
          <mesh position={[-20, 8, 4]}>
            <sphereGeometry args={[0.3, 16, 16]} />
            <meshStandardMaterial
              color='#FF0000'
              emissive='#FF0000'
              emissiveIntensity={2.0}
              metalness={0.0}
              roughness={0.1}
            />
          </mesh>

          {/* Starboard light (green) */}
          <mesh position={[-20, 8, -4]}>
            <sphereGeometry args={[0.3, 16, 16]} />
            <meshStandardMaterial
              color='#00FF00'
              emissive='#00FF00'
              emissiveIntensity={2.0}
              metalness={0.0}
              roughness={0.1}
            />
          </mesh>

          {/* Mast lights (white) */}
          <mesh position={[15, 24, 0]}>
            <sphereGeometry args={[0.4, 16, 16]} />
            <meshStandardMaterial
              color='#FFFFFF'
              emissive='#FFFFFF'
              emissiveIntensity={2.5}
              metalness={0.0}
              roughness={0.1}
            />
          </mesh>
        </>
      )}

      {/* Funnel smoke (high and medium LOD) */}
      {lodLevel !== 'low' && (
        <>
          <mesh position={[-3, 23, -1.5]}>
            <sphereGeometry
              args={[
                2,
                lodLevel === 'high' ? 16 : 8,
                lodLevel === 'high' ? 16 : 8,
              ]}
            />
            <meshBasicMaterial color='#696969' transparent opacity={0.2} />
          </mesh>
          <mesh position={[-3, 23, 1.5]}>
            <sphereGeometry
              args={[
                2,
                lodLevel === 'high' ? 16 : 8,
                lodLevel === 'high' ? 16 : 8,
              ]}
            />
            <meshBasicMaterial color='#696969' transparent opacity={0.2} />
          </mesh>
        </>
      )}
    </group>
  );
}

function StarStructure({
  color = '#FFD700',
  emissiveIntensity = 2.0,
  scale = 1,
  lodLevel = 'high',
}: {
  color?: string;
  emissiveIntensity?: number;
  scale?: number;
  lodLevel?: 'high' | 'medium' | 'low';
}) {
  // Adjust geometry detail based on LOD
  const coreSegments =
    lodLevel === 'high' ? 64 : lodLevel === 'medium' ? 32 : 16;
  const innerSegments =
    lodLevel === 'high' ? 48 : lodLevel === 'medium' ? 24 : 16;
  const outerSegments =
    lodLevel === 'high' ? 32 : lodLevel === 'medium' ? 16 : 8;

  return (
    <group scale={scale}>
      {/* Core - glowing plasma with LOD-based detail */}
      <mesh>
        <sphereGeometry args={[1, coreSegments, coreSegments]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={emissiveIntensity}
          metalness={0.0}
          roughness={0.1}
          envMapIntensity={0.5}
        />
      </mesh>

      {/* Inner glow (high and medium LOD) */}
      {lodLevel !== 'low' && (
        <mesh>
          <sphereGeometry args={[1.3, innerSegments, innerSegments]} />
          <meshBasicMaterial
            color={color}
            transparent
            opacity={0.4}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
      )}

      {/* Outer glow (high LOD only) */}
      {lodLevel === 'high' && (
        <mesh>
          <sphereGeometry args={[1.6, outerSegments, outerSegments]} />
          <meshBasicMaterial
            color={color}
            transparent
            opacity={0.2}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
      )}

      {/* Corona effect (high LOD only) */}
      {lodLevel === 'high' && (
        <mesh>
          <sphereGeometry args={[2.0, 16, 16]} />
          <meshBasicMaterial
            color={color}
            transparent
            opacity={0.1}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
      )}

      {/* Solar flares (high LOD only) */}
      {lodLevel === 'high' &&
        [...Array(8)].map((_, i) => {
          const angle = (i / 8) * Math.PI * 2;
          return (
            <mesh
              key={`flare-${i}`}
              position={[Math.cos(angle) * 1.2, Math.sin(angle) * 1.2, 0]}
              rotation={[0, 0, angle]}
            >
              <coneGeometry args={[0.2, 0.8, 8]} />
              <meshBasicMaterial
                color={color}
                transparent
                opacity={0.6}
                blending={THREE.AdditiveBlending}
              />
            </mesh>
          );
        })}
    </group>
  );
}

function VolcanoStructure({
  scale = 1,
  lodLevel = 'high',
}: {
  scale?: number;
  lodLevel?: 'high' | 'medium' | 'low';
}) {
  // Generate procedural lava flows based on LOD
  const lavaFlows = useMemo(() => {
    const flows: Array<{
      position: [number, number, number];
      rotation: [number, number, number];
      scale: [number, number, number];
    }> = [];

    // Reduce lava flow count based on LOD
    const flowCount = lodLevel === 'high' ? 6 : lodLevel === 'medium' ? 3 : 0;

    for (let i = 0; i < flowCount; i++) {
      const angle = (i / flowCount) * Math.PI * 2;
      const distance = 8 + Math.random() * 4;

      flows.push({
        position: [
          Math.cos(angle) * distance,
          10 - Math.random() * 8,
          Math.sin(angle) * distance,
        ],
        rotation: [0, angle, Math.PI / 6 + Math.random() * 0.3],
        scale: [2 + Math.random(), 8 + Math.random() * 4, 0.5],
      });
    }

    return flows;
  }, [lodLevel]);

  // Adjust geometry detail based on LOD
  const segments = lodLevel === 'high' ? 64 : lodLevel === 'medium' ? 32 : 16;

  return (
    <group scale={scale}>
      {/* Cone - rough stone with LOD-based detail */}
      <mesh castShadow>
        <coneGeometry args={[20, 30, segments]} />
        <meshStandardMaterial
          color='#8B4513'
          roughness={0.95}
          metalness={0.0}
          envMapIntensity={0.1}
        />
      </mesh>

      {/* Crater - dark rock */}
      <mesh position={[0, 15, 0]}>
        <cylinderGeometry args={[8, 6, 4, segments]} />
        <meshStandardMaterial
          color='#2F4F4F'
          metalness={0.0}
          roughness={0.9}
          envMapIntensity={0.2}
        />
      </mesh>

      {/* Lava glow - emissive molten rock */}
      <mesh position={[0, 14, 0]}>
        <cylinderGeometry args={[6, 5, 2, segments]} />
        <meshStandardMaterial
          color='#FF4500'
          emissive='#FF4500'
          emissiveIntensity={1.5}
          metalness={0.0}
          roughness={0.3}
        />
      </mesh>

      {/* Procedural lava flows down the sides */}
      {lavaFlows.map((flow, i) => (
        <mesh
          key={`lava-${i}`}
          position={flow.position}
          rotation={flow.rotation}
          scale={flow.scale}
        >
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial
            color='#FF4500'
            emissive='#FF6347'
            emissiveIntensity={0.8 + Math.random() * 0.4}
            metalness={0.0}
            roughness={0.4}
          />
        </mesh>
      ))}

      {/* Rock outcroppings for detail (high and medium LOD) */}
      {lodLevel !== 'low' &&
        [...Array(lodLevel === 'high' ? 8 : 4)].map((_, i) => {
          const angle = (i / (lodLevel === 'high' ? 8 : 4)) * Math.PI * 2;
          const distance = 15 + Math.random() * 3;
          return (
            <mesh
              key={`rock-${i}`}
              position={[
                Math.cos(angle) * distance,
                5 + Math.random() * 10,
                Math.sin(angle) * distance,
              ]}
              rotation={[
                Math.random() * 0.5,
                Math.random() * Math.PI,
                Math.random() * 0.5,
              ]}
              scale={[1 + Math.random(), 1 + Math.random(), 1 + Math.random()]}
            >
              <boxGeometry args={[2, 2, 2]} />
              <meshStandardMaterial
                color='#654321'
                metalness={0.0}
                roughness={0.95}
                envMapIntensity={0.1}
              />
            </mesh>
          );
        })}

      {/* Smoke/steam (high and medium LOD) */}
      {lodLevel !== 'low' && (
        <>
          <mesh position={[0, 20, 0]}>
            <sphereGeometry
              args={[
                10,
                lodLevel === 'high' ? 16 : 8,
                lodLevel === 'high' ? 16 : 8,
              ]}
            />
            <meshBasicMaterial color='#696969' transparent opacity={0.3} />
          </mesh>
          {/* Additional smoke plumes (high LOD only) */}
          {lodLevel === 'high' && (
            <>
              <mesh position={[3, 22, 2]}>
                <sphereGeometry args={[6, 12, 12]} />
                <meshBasicMaterial color='#808080' transparent opacity={0.2} />
              </mesh>
              <mesh position={[-2, 24, -1]}>
                <sphereGeometry args={[8, 12, 12]} />
                <meshBasicMaterial color='#A9A9A9' transparent opacity={0.15} />
              </mesh>
            </>
          )}
        </>
      )}

      {/* Lava glow at base (high LOD only) */}
      {lodLevel === 'high' &&
        [...Array(4)].map((_, i) => {
          const angle = (i / 4) * Math.PI * 2;
          return (
            <mesh
              key={`glow-${i}`}
              position={[Math.cos(angle) * 18, -12, Math.sin(angle) * 18]}
            >
              <sphereGeometry args={[3, 16, 16]} />
              <meshStandardMaterial
                color='#FF4500'
                emissive='#FF6347'
                emissiveIntensity={0.5}
                transparent
                opacity={0.6}
              />
            </mesh>
          );
        })}
    </group>
  );
}

function HouseStructure({
  scale = 1,
  lodLevel = 'high',
}: {
  scale?: number;
  lodLevel?: 'high' | 'medium' | 'low';
}) {
  // Adjust geometry detail based on LOD
  const roofSegments = lodLevel === 'high' ? 8 : lodLevel === 'medium' ? 4 : 4;

  return (
    <group scale={scale}>
      {/* Base - wood/stone */}
      <mesh position={[0, 5, 0]} castShadow>
        <boxGeometry args={[12, 10, 12]} />
        <meshStandardMaterial
          color='#8B7355'
          roughness={0.8}
          metalness={0.0}
          envMapIntensity={0.3}
        />
      </mesh>

      {/* Roof - ceramic tiles with LOD-based detail */}
      <mesh position={[0, 11, 0]} rotation={[0, Math.PI / 4, 0]} castShadow>
        <coneGeometry args={[10, 6, roofSegments]} />
        <meshStandardMaterial
          color='#8B0000'
          metalness={0.0}
          roughness={0.3}
          clearcoat={0.6}
          clearcoatRoughness={0.2}
          envMapIntensity={0.5}
        />
      </mesh>

      {/* Door - wood */}
      <mesh position={[0, 2, 6.1]}>
        <boxGeometry args={[3, 6, 0.2]} />
        <meshStandardMaterial
          color='#654321'
          metalness={0.0}
          roughness={0.85}
          envMapIntensity={0.2}
        />
      </mesh>

      {/* Windows - glass with glow */}
      <mesh position={[-4, 6, 6.1]}>
        <boxGeometry args={[2, 2, 0.2]} />
        <meshStandardMaterial
          color='#87CEEB'
          emissive='#87CEEB'
          emissiveIntensity={0.3}
          metalness={0.0}
          roughness={0.0}
          transmission={0.5}
          ior={1.5}
          envMapIntensity={1.0}
        />
      </mesh>
      <mesh position={[4, 6, 6.1]}>
        <boxGeometry args={[2, 2, 0.2]} />
        <meshStandardMaterial
          color='#87CEEB'
          emissive='#87CEEB'
          emissiveIntensity={0.3}
          metalness={0.0}
          roughness={0.0}
          transmission={0.5}
          ior={1.5}
          envMapIntensity={1.0}
        />
      </mesh>

      {/* Tree branches (for organic house) - wood (high and medium LOD) */}
      {lodLevel !== 'low' &&
        [...Array(lodLevel === 'high' ? 6 : 3)].map((_, i) => (
          <mesh
            key={i}
            position={[
              Math.cos((i * Math.PI * 2) / (lodLevel === 'high' ? 6 : 3)) * 8,
              8 + i * 1.5,
              Math.sin((i * Math.PI * 2) / (lodLevel === 'high' ? 6 : 3)) * 8,
            ]}
            rotation={[
              0,
              (i * Math.PI * 2) / (lodLevel === 'high' ? 6 : 3),
              Math.PI / 6,
            ]}
          >
            <cylinderGeometry args={[0.3, 0.5, 6]} />
            <meshStandardMaterial
              color='#8B7355'
              metalness={0.0}
              roughness={0.9}
              envMapIntensity={0.2}
            />
          </mesh>
        ))}

      {/* Chimney (high LOD only) */}
      {lodLevel === 'high' && (
        <>
          <mesh position={[4, 12, 4]}>
            <boxGeometry args={[1.5, 4, 1.5]} />
            <meshStandardMaterial
              color='#8B4513'
              metalness={0.0}
              roughness={0.9}
              envMapIntensity={0.2}
            />
          </mesh>
          {/* Chimney smoke */}
          <mesh position={[4, 15, 4]}>
            <sphereGeometry args={[1.5, 12, 12]} />
            <meshBasicMaterial color='#D3D3D3' transparent opacity={0.3} />
          </mesh>
        </>
      )}

      {/* Garden fence (high LOD only) */}
      {lodLevel === 'high' &&
        [...Array(12)].map((_, i) => {
          const angle = (i / 12) * Math.PI * 2;
          return (
            <mesh
              key={`fence-${i}`}
              position={[Math.cos(angle) * 10, 1, Math.sin(angle) * 10]}
              rotation={[0, angle, 0]}
            >
              <boxGeometry args={[0.2, 2, 0.2]} />
              <meshStandardMaterial
                color='#FFFFFF'
                metalness={0.0}
                roughness={0.7}
              />
            </mesh>
          );
        })}
    </group>
  );
}

function LibraryStructure({
  scale = 1,
  lodLevel = 'high',
}: {
  scale?: number;
  lodLevel?: 'high' | 'medium' | 'low';
}) {
  // Generate procedural book variations based on LOD
  const books = useMemo(() => {
    const bookData: Array<{
      position: [number, number, number];
      rotation: [number, number, number];
      size: [number, number, number];
      hue: number;
    }> = [];

    // Reduce book count based on LOD
    const bookCount = lodLevel === 'high' ? 20 : lodLevel === 'medium' ? 10 : 5;

    for (let i = 0; i < bookCount; i++) {
      const angle = (i / bookCount) * Math.PI * 2;
      const radius = 15 + Math.random() * 10;
      const height = -5 + i * 2;

      bookData.push({
        position: [
          Math.cos(angle) * radius + (Math.random() - 0.5) * 5,
          height,
          Math.sin(angle) * radius + (Math.random() - 0.5) * 5,
        ],
        rotation: [
          Math.random() * 0.5,
          Math.random() * Math.PI,
          Math.random() * 0.5,
        ],
        size: [
          1.5 + Math.random() * 1,
          2 + Math.random() * 2,
          0.2 + Math.random() * 0.2,
        ],
        hue: 30 + Math.random() * 60,
      });
    }

    return bookData;
  }, [lodLevel]);

  return (
    <group scale={scale}>
      {/* Main building - glass structure */}
      <mesh castShadow>
        <boxGeometry args={[20, 15, 12]} />
        <meshStandardMaterial
          color='#4a5568'
          transparent
          opacity={1.0}
          metalness={0.0}
          roughness={0.0}
          transmission={0.7}
          ior={1.5}
          thickness={0.5}
          envMapIntensity={1.2}
          clearcoat={1.0}
          clearcoatRoughness={0.0}
        />
      </mesh>

      {/* Floating books with procedural variations */}
      {books.map((book, i) => (
        <group key={i}>
          <mesh position={book.position} rotation={book.rotation}>
            <boxGeometry args={book.size} />
            <meshStandardMaterial
              color={`hsl(${book.hue}, 70%, 60%)`}
              emissive={`hsl(${book.hue}, 70%, 40%)`}
              emissiveIntensity={0.4}
              metalness={0.0}
              roughness={0.6}
              envMapIntensity={0.4}
            />
          </mesh>
          {/* Book spine detail */}
          <mesh
            position={[book.position[0], book.position[1], book.position[2]]}
            rotation={book.rotation}
          >
            <boxGeometry
              args={[
                book.size[0] * 0.95,
                book.size[1] * 0.1,
                book.size[2] * 1.1,
              ]}
            />
            <meshStandardMaterial
              color={`hsl(${book.hue - 10}, 60%, 40%)`}
              metalness={0.0}
              roughness={0.7}
            />
          </mesh>
        </group>
      ))}

      {/* Magical aura */}
      <mesh>
        <sphereGeometry args={[25, 16, 16]} />
        <meshBasicMaterial
          color='#ffd27a'
          transparent
          opacity={0.1}
          side={THREE.BackSide}
        />
      </mesh>

      {/* Pillars - stone/marble */}
      {[-8, 8].map((x) =>
        [-4, 4].map((z) => (
          <mesh key={`${x}-${z}`} position={[x, -2, z]} castShadow>
            <cylinderGeometry args={[0.8, 0.8, 14, 16]} />
            <meshStandardMaterial
              color='#696969'
              metalness={0.0}
              roughness={0.4}
              envMapIntensity={0.4}
              clearcoat={0.2}
              clearcoatRoughness={0.3}
            />
          </mesh>
        ))
      )}
    </group>
  );
}
