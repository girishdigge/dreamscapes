// services/frontend/next-app/app/components/DreamEntities.tsx
'use client';

import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { DreamEntity } from '../types/dream';
import { ParticlePhysicsSystem, Force } from '../utils/particlePhysics';
import { FlockingSystem, ButterflyFlocking } from '../utils/flockingBehavior';

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
        <EntityRenderer
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

interface EntityRendererProps {
  entity: DreamEntity;
  style: string;
  isPlaying: boolean;
  currentTime: number;
}

function EntityRenderer({
  entity,
  style,
  isPlaying,
  currentTime,
}: EntityRendererProps) {
  const groupRef = useRef<THREE.Group>(null);
  const instancedMeshRef = useRef<THREE.InstancedMesh>(null);
  const { type, count = 10, params = {}, motion } = entity;

  const {
    speed = 1.0,
    glow = 0.5,
    size = 1.0,
    color = '#ffffff',
    lifetime = 3.0,
    spread = 360,
    direction = [0, 1, 0],
    gravity = 0,
    wind,
    drag = 0.1,
    attraction,
    repulsion,
  } = params;

  // Initialize physics system for particle types
  const physicsSystem = useMemo(() => {
    if (
      type === 'particle_emitter' ||
      type === 'particle_stream' ||
      type === 'ash_cloud'
    ) {
      const system = new ParticlePhysicsSystem(count, lifetime);

      // Add forces based on parameters
      const forces: Force[] = [];

      // Gravity
      if (gravity !== 0) {
        forces.push({ type: 'gravity', strength: gravity });
      }

      // Wind
      if (wind) {
        forces.push({
          type: 'wind',
          strength: Array.isArray(wind)
            ? Math.sqrt(wind[0] ** 2 + wind[1] ** 2 + wind[2] ** 2)
            : wind,
          direction: Array.isArray(wind)
            ? new THREE.Vector3(...wind).normalize()
            : new THREE.Vector3(1, 0, 0),
        });
      }

      // Drag
      if (drag > 0) {
        forces.push({ type: 'drag', strength: drag });
      }

      // Attraction
      if (attraction) {
        forces.push({
          type: 'attraction',
          strength: attraction.strength || 10,
          position: new THREE.Vector3(...(attraction.position || [0, 0, 0])),
          radius: attraction.radius,
        });
      }

      // Repulsion
      if (repulsion) {
        forces.push({
          type: 'repulsion',
          strength: repulsion.strength || 10,
          position: new THREE.Vector3(...(repulsion.position || [0, 0, 0])),
          radius: repulsion.radius,
        });
      }

      // Add all forces to system
      forces.forEach((force) => system.addForce(force));

      // Add ground collision plane if gravity is enabled
      if (gravity !== 0) {
        system.addCollisionPlane(new THREE.Vector3(0, 1, 0), 0);
      }

      // Initialize particle positions and velocities
      for (let i = 0; i < count; i++) {
        const particle = system.getParticle(i);
        if (particle) {
          // Set initial position
          if (motion?.attachTo && motion.offset) {
            particle.position.set(...motion.offset);
          } else {
            particle.position.set(
              (Math.random() - 0.5) * 10,
              Math.random() * 5,
              (Math.random() - 0.5) * 10
            );
          }

          // Set initial velocity based on direction and spread
          const spreadRad = (spread * Math.PI) / 180;
          const theta = (Math.random() - 0.5) * spreadRad;
          const phi = Math.random() * Math.PI * 2;

          const dir = new THREE.Vector3(...direction).normalize();
          const perpendicular = new THREE.Vector3(1, 0, 0);
          if (Math.abs(dir.x) > 0.9) perpendicular.set(0, 1, 0);

          const right = new THREE.Vector3()
            .crossVectors(dir, perpendicular)
            .normalize();
          const up = new THREE.Vector3().crossVectors(right, dir).normalize();

          const velocity = dir
            .clone()
            .multiplyScalar(Math.cos(theta))
            .add(right.clone().multiplyScalar(Math.sin(theta) * Math.cos(phi)))
            .add(up.clone().multiplyScalar(Math.sin(theta) * Math.sin(phi)))
            .multiplyScalar(speed);

          particle.velocity.copy(velocity);
        }
      }

      return system;
    }
    return null;
  }, [
    type,
    count,
    lifetime,
    gravity,
    wind,
    drag,
    attraction,
    repulsion,
    spread,
    direction,
    speed,
    motion,
  ]);

  // Initialize flocking system for birds and butterflies
  const flockingSystem = useMemo(() => {
    if (type === 'flock' || type === 'seagull') {
      const center = motion?.center
        ? new THREE.Vector3(...motion.center)
        : new THREE.Vector3(0, 30, 0);
      const radius = motion?.radius || 60;

      return new FlockingSystem(count, {
        separationDistance: 4.0,
        alignmentDistance: 10.0,
        cohesionDistance: 15.0,
        separationWeight: 1.5,
        alignmentWeight: 1.2,
        cohesionWeight: 1.0,
        maxSpeed: speed * 5,
        maxForce: 0.1,
        boundaryRadius: radius,
        boundaryCenter: center,
      });
    } else if (type === 'butterfly') {
      const center = motion?.offset
        ? new THREE.Vector3(...motion.offset)
        : new THREE.Vector3(0, 5, 0);
      const radius = motion?.radius || 10;

      return new ButterflyFlocking(count, {
        separationDistance: 2.0,
        alignmentDistance: 5.0,
        cohesionDistance: 7.0,
        separationWeight: 2.0,
        alignmentWeight: 0.5,
        cohesionWeight: 0.8,
        maxSpeed: speed * 3,
        maxForce: 0.15,
        boundaryRadius: radius,
        boundaryCenter: center,
      });
    }
    return null;
  }, [type, count, speed, motion]);

  // Create instanced data
  const instanceData = useMemo(() => {
    const positions: THREE.Vector3[] = [];
    const velocities: THREE.Vector3[] = [];
    const phases: number[] = [];
    const lifetimes: number[] = [];

    for (let i = 0; i < count; i++) {
      // Initialize positions based on motion type
      if (motion?.type === 'flow_between' && motion.targets) {
        // Start between two targets
        const t = i / count;
        positions.push(new THREE.Vector3(-100 + t * 200, 0, 0));
      } else if (motion?.attachTo) {
        // Start at attachment point
        const offset = motion.offset || [0, 0, 0];
        positions.push(new THREE.Vector3(...offset));
      } else {
        // Random starting position
        positions.push(
          new THREE.Vector3(
            (Math.random() - 0.5) * 50,
            Math.random() * 30 + 10,
            (Math.random() - 0.5) * 50
          )
        );
      }

      // Initialize velocities
      const spreadRad = (spread * Math.PI) / 180;
      const angle = Math.random() * spreadRad - spreadRad / 2;
      const dirVec = new THREE.Vector3(...direction).normalize();
      velocities.push(
        new THREE.Vector3(
          dirVec.x * speed + (Math.random() - 0.5) * speed * 0.5,
          dirVec.y * speed + (Math.random() - 0.5) * speed * 0.5,
          dirVec.z * speed + (Math.random() - 0.5) * speed * 0.5
        )
      );

      phases.push(Math.random() * Math.PI * 2);
      lifetimes.push(Math.random() * lifetime);
    }

    return { positions, velocities, phases, lifetimes };
  }, [count, speed, spread, direction, lifetime, motion]);

  // Animation loop
  useFrame((state, delta) => {
    if (!instancedMeshRef.current || !isPlaying) return;

    const time = state.clock.getElapsedTime();
    const dummy = new THREE.Object3D();

    // Update physics system if available
    if (physicsSystem) {
      physicsSystem.update(delta);
    }

    // Update flocking system if available
    if (flockingSystem) {
      flockingSystem.update(delta);
    }

    for (let i = 0; i < count; i++) {
      let x, y, z;

      // Use physics system for particle types
      if (physicsSystem) {
        const particle = physicsSystem.getParticle(i);
        if (particle) {
          x = particle.position.x;
          y = particle.position.y;
          z = particle.position.z;

          // Reset particle if it's too old or out of bounds
          if (particle.age > lifetime || Math.abs(y) > 200) {
            particle.age = 0;
            if (motion?.attachTo && motion.offset) {
              particle.position.set(...motion.offset);
            } else {
              particle.position.set(
                (Math.random() - 0.5) * 10,
                Math.random() * 5,
                (Math.random() - 0.5) * 10
              );
            }

            // Reset velocity
            const spreadRad = (spread * Math.PI) / 180;
            const theta = (Math.random() - 0.5) * spreadRad;
            const phi = Math.random() * Math.PI * 2;

            const dir = new THREE.Vector3(...direction).normalize();
            const perpendicular = new THREE.Vector3(1, 0, 0);
            if (Math.abs(dir.x) > 0.9) perpendicular.set(0, 1, 0);

            const right = new THREE.Vector3()
              .crossVectors(dir, perpendicular)
              .normalize();
            const up = new THREE.Vector3().crossVectors(right, dir).normalize();

            const velocity = dir
              .clone()
              .multiplyScalar(Math.cos(theta))
              .add(
                right.clone().multiplyScalar(Math.sin(theta) * Math.cos(phi))
              )
              .add(up.clone().multiplyScalar(Math.sin(theta) * Math.sin(phi)))
              .multiplyScalar(speed);

            particle.velocity.copy(velocity);
          }
        }
      } else {
        // Legacy animation for non-physics entities
        const pos = instanceData.positions[i];
        const vel = instanceData.velocities[i];
        const phase = instanceData.phases[i];
        let life = instanceData.lifetimes[i];

        // Update lifetime
        life += delta;
        if (life > lifetime) {
          life = 0;
          // Reset position
          if (motion?.attachTo) {
            const offset = motion.offset || [0, 0, 0];
            pos.set(...offset);
          }
        }
        instanceData.lifetimes[i] = life;

        switch (type) {
          case 'particle_emitter':
            // Smoke/steam rising effect
            x = pos.x + Math.sin(time * 2 + phase) * 2;
            y = pos.y + vel.y * life * 2;
            z = pos.z + Math.cos(time * 2 + phase) * 2;
            break;

          case 'particle_stream':
            // Energy stream between objects
            if (motion?.type === 'flow_between') {
              const flowProgress = (time * speed + i * 0.1) % 1;
              x = -100 + flowProgress * 200;
              y = Math.sin(flowProgress * Math.PI * 4) * 5;
              z = Math.cos(flowProgress * Math.PI * 2) * 3;
            } else {
              x = pos.x + vel.x * delta * 10;
              y = pos.y + vel.y * delta * 10;
              z = pos.z + vel.z * delta * 10;
            }
            break;

          case 'flock':
          case 'seagull':
            // Use flocking system if available, otherwise fall back to circular pattern
            if (flockingSystem) {
              const boid = flockingSystem.getBoid(i);
              if (boid) {
                x = boid.position.x;
                y = boid.position.y;
                z = boid.position.z;
              }
            } else {
              // Fallback: circular flight pattern
              const birdRadius = motion?.radius || 60;
              const birdAngle = (time * speed * 0.3 + i * 0.5) % (Math.PI * 2);
              const birdHeight = 30 + Math.sin(time * 2 + i) * 5;
              x = Math.cos(birdAngle) * birdRadius;
              y = birdHeight;
              z = Math.sin(birdAngle) * birdRadius;
            }
            break;

          case 'book_swarm':
            // Swirling books
            if (motion?.type === 'swarm') {
              const radius = motion.radius || 25;
              const angle = (time * speed * 0.5 + i * 0.3) % (Math.PI * 2);
              const heightOffset = Math.sin(time + i) * 8;
              x = (motion.offset?.[0] || 0) + Math.cos(angle) * radius;
              y = (motion.offset?.[1] || 15) + heightOffset;
              z = (motion.offset?.[2] || 0) + Math.sin(angle) * radius;
            } else {
              x = pos.x + Math.sin(time * speed + phase) * 15;
              y = pos.y + Math.cos(time * speed * 0.7 + phase) * 8;
              z = pos.z + Math.sin(time * speed * 0.5 + phase) * 12;
            }
            break;

          case 'butterfly':
            // Use flocking system if available, otherwise fall back to erratic flight
            if (flockingSystem) {
              const boid = flockingSystem.getBoid(i);
              if (boid) {
                x = boid.position.x;
                y = boid.position.y;
                z = boid.position.z;
              }
            } else {
              // Fallback: erratic butterfly flight
              if (motion?.type === 'wander') {
                const wanderRadius = motion.radius || 6;
                x =
                  (motion.offset?.[0] || 0) +
                  Math.sin(time * speed * 3 + phase) * wanderRadius;
                y =
                  (motion.offset?.[1] || 5) +
                  Math.sin(time * speed * 4 + phase) * wanderRadius * 0.5;
                z =
                  (motion.offset?.[2] || 0) +
                  Math.cos(time * speed * 3 + phase) * wanderRadius;
              } else {
                x = pos.x + Math.sin(time * speed * 3 + phase) * 8;
                y = pos.y + Math.sin(time * speed * 4 + phase) * 6;
                z = pos.z + Math.cos(time * speed * 3 + phase) * 8;
              }
            }
            break;

          case 'ash_cloud':
            // Slow drifting ash
            x = pos.x + Math.sin(time * 0.3 + phase) * 15;
            y = pos.y + speed * time * 0.5;
            z = pos.z + Math.cos(time * 0.3 + phase) * 15;
            break;

          default:
            // Default floating motion
            x = pos.x + Math.sin(time * speed + phase) * 10;
            y = pos.y + Math.cos(time * speed * 0.7 + phase) * 5;
            z = pos.z + Math.sin(time * speed * 0.5 + phase) * 10;
            break;
        }
      }

      // Set transform (with fallback values)
      dummy.position.set(x ?? 0, y ?? 0, z ?? 0);

      // Get phase and life for rotation/scale calculations
      const phase = physicsSystem
        ? (i / count) * Math.PI * 2
        : instanceData.phases[i];
      const life = physicsSystem
        ? physicsSystem.getParticle(i)?.age || 0
        : instanceData.lifetimes[i];

      // Rotation based on type
      if (type === 'book_swarm') {
        dummy.rotation.set(
          time * speed * 0.5 + phase,
          time * speed * 0.7 + phase,
          time * speed * 0.3 + phase
        );
      } else if (type === 'butterfly') {
        dummy.rotation.set(
          0,
          time * speed * 2 + phase,
          Math.sin(time * 4 + phase) * 0.3
        );
      } else if (type === 'flock' || type === 'seagull') {
        // Point in direction of movement
        let vel: THREE.Vector3;
        if (flockingSystem) {
          const boid = flockingSystem.getBoid(i);
          vel = boid?.velocity || new THREE.Vector3(0, 0, 1);
        } else if (physicsSystem) {
          vel =
            physicsSystem.getParticle(i)?.velocity ||
            new THREE.Vector3(0, 0, 1);
        } else {
          vel = instanceData.velocities[i];
        }
        dummy.rotation.set(0, Math.atan2(vel.x, vel.z), 0);
      }

      // Scale with fade based on lifetime
      const lifeFade =
        Math.min(life / (lifetime * 0.2), 1) *
        (1 - Math.max(0, (life - lifetime * 0.8) / (lifetime * 0.2)));
      dummy.scale.setScalar(size * lifeFade);

      dummy.updateMatrix();
      instancedMeshRef.current.setMatrixAt(i, dummy.matrix);
    }

    instancedMeshRef.current.instanceMatrix.needsUpdate = true;
  });

  // Get geometry based on entity type
  const getGeometry = () => {
    switch (type) {
      case 'particle_emitter':
      case 'particle_stream':
        return <sphereGeometry args={[0.4, 8, 8]} />;

      case 'book_swarm':
        return <boxGeometry args={[1.5, 2, 0.3]} />;

      case 'flock':
      case 'seagull':
        // Simple bird shape
        return <coneGeometry args={[0.5, 1.5, 4]} />;

      case 'butterfly':
        // Butterfly wings
        return <planeGeometry args={[1.5, 0.8]} />;

      case 'ash_cloud':
        return <sphereGeometry args={[3, 8, 8]} />;

      default:
        return <sphereGeometry args={[0.5, 8, 8]} />;
    }
  };

  // Get material based on type and style
  const getMaterial = () => {
    const baseColor = new THREE.Color(color);
    const emissiveIntensity = glow;

    const materialProps: any = {
      color: baseColor,
      transparent: true,
      opacity: 0.8,
    };

    // Add emissive for glowing effects
    if (glow > 0) {
      materialProps.emissive = baseColor;
      materialProps.emissiveIntensity = emissiveIntensity;
    }

    // Special materials for specific types
    if (type === 'particle_stream' || type === 'particle_emitter') {
      materialProps.blending = THREE.AdditiveBlending;
      materialProps.opacity = 0.6;
    }

    if (type === 'ash_cloud') {
      materialProps.opacity = 0.3;
      materialProps.color = new THREE.Color('#2B2B2B');
    }

    if (type === 'book_swarm') {
      materialProps.opacity = 0.9;
      materialProps.metalness = 0.2;
      materialProps.roughness = 0.8;
    }

    if (type === 'butterfly') {
      materialProps.side = THREE.DoubleSide;
      materialProps.opacity = 0.7;
    }

    if (type === 'flock' || type === 'seagull') {
      materialProps.color = new THREE.Color('#FFFFFF');
      materialProps.opacity = 1.0;
    }

    return <meshStandardMaterial {...materialProps} />;
  };

  return (
    <group ref={groupRef}>
      <instancedMesh
        ref={instancedMeshRef}
        args={[undefined, undefined, count]}
      >
        {getGeometry()}
        {getMaterial()}
      </instancedMesh>
    </group>
  );
}
