// services/frontend/next-app/app/utils/particlePhysics.ts
// Physics-based particle system with forces and collision detection

import * as THREE from 'three';

/**
 * Particle with physics properties
 */
export interface Particle {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  acceleration: THREE.Vector3;
  mass: number;
  lifetime: number;
  age: number;
  active: boolean;
}

/**
 * Force types for particle systems
 */
export interface Force {
  type: 'gravity' | 'wind' | 'attraction' | 'repulsion' | 'drag' | 'turbulence';
  strength: number;
  position?: THREE.Vector3; // For attraction/repulsion
  direction?: THREE.Vector3; // For wind
  radius?: number; // For attraction/repulsion falloff
}

/**
 * Physics-based particle system
 */
export class ParticlePhysicsSystem {
  private particles: Particle[] = [];
  private forces: Force[] = [];
  private collisionPlanes: Array<{ normal: THREE.Vector3; distance: number }> =
    [];
  private restitution: number = 0.5; // Bounciness

  constructor(particleCount: number, lifetime: number = 3.0) {
    this.initializeParticles(particleCount, lifetime);
  }

  /**
   * Initialize particles
   */
  private initializeParticles(count: number, lifetime: number): void {
    for (let i = 0; i < count; i++) {
      this.particles.push({
        position: new THREE.Vector3(0, 0, 0),
        velocity: new THREE.Vector3(0, 0, 0),
        acceleration: new THREE.Vector3(0, 0, 0),
        mass: 1.0,
        lifetime,
        age: Math.random() * lifetime,
        active: true,
      });
    }
  }

  /**
   * Add a force to the system
   */
  addForce(force: Force): void {
    this.forces.push(force);
  }

  /**
   * Clear all forces
   */
  clearForces(): void {
    this.forces = [];
  }

  /**
   * Add collision plane
   */
  addCollisionPlane(normal: THREE.Vector3, distance: number): void {
    this.collisionPlanes.push({ normal: normal.normalize(), distance });
  }

  /**
   * Update particle physics
   */
  update(delta: number): void {
    for (const particle of this.particles) {
      if (!particle.active) continue;

      // Update age
      particle.age += delta;
      if (particle.age > particle.lifetime) {
        particle.age = 0;
        this.resetParticle(particle);
      }

      // Reset acceleration
      particle.acceleration.set(0, 0, 0);

      // Apply all forces
      for (const force of this.forces) {
        this.applyForce(particle, force);
      }

      // Update velocity and position
      particle.velocity.add(
        particle.acceleration.clone().multiplyScalar(delta)
      );
      particle.position.add(particle.velocity.clone().multiplyScalar(delta));

      // Check collisions
      this.checkCollisions(particle);
    }
  }

  /**
   * Apply a force to a particle
   */
  private applyForce(particle: Particle, force: Force): void {
    const forceVector = new THREE.Vector3();

    switch (force.type) {
      case 'gravity':
        // F = m * g
        forceVector.set(0, -force.strength * particle.mass, 0);
        break;

      case 'wind':
        // Constant directional force
        if (force.direction) {
          forceVector.copy(force.direction).multiplyScalar(force.strength);
        }
        break;

      case 'drag':
        // F = -k * v (opposes velocity)
        forceVector.copy(particle.velocity).multiplyScalar(-force.strength);
        break;

      case 'attraction':
        if (force.position) {
          // F = k * (target - position) / distance^2
          const direction = force.position.clone().sub(particle.position);
          const distance = direction.length();

          if (distance > 0.1) {
            direction.normalize();
            let strength = force.strength / (distance * distance);

            // Apply radius falloff if specified
            if (force.radius && distance > force.radius) {
              strength *= Math.max(
                0,
                1 - (distance - force.radius) / force.radius
              );
            }

            forceVector.copy(direction).multiplyScalar(strength);
          }
        }
        break;

      case 'repulsion':
        if (force.position) {
          // F = -k * (target - position) / distance^2
          const direction = particle.position.clone().sub(force.position);
          const distance = direction.length();

          if (distance > 0.1) {
            direction.normalize();
            let strength = force.strength / (distance * distance);

            // Apply radius falloff if specified
            if (force.radius && distance < force.radius) {
              strength *= 1 - distance / force.radius;
            }

            forceVector.copy(direction).multiplyScalar(strength);
          }
        }
        break;

      case 'turbulence':
        // Random noise force
        forceVector.set(
          (Math.random() - 0.5) * force.strength,
          (Math.random() - 0.5) * force.strength,
          (Math.random() - 0.5) * force.strength
        );
        break;
    }

    // F = ma, so a = F/m
    particle.acceleration.add(forceVector.divideScalar(particle.mass));
  }

  /**
   * Check and resolve collisions with planes
   */
  private checkCollisions(particle: Particle): void {
    for (const plane of this.collisionPlanes) {
      // Calculate distance from plane
      const distance = particle.position.dot(plane.normal) - plane.distance;

      // If particle is below plane
      if (distance < 0) {
        // Move particle to plane surface
        particle.position.add(plane.normal.clone().multiplyScalar(-distance));

        // Reflect velocity
        const velocityDotNormal = particle.velocity.dot(plane.normal);
        if (velocityDotNormal < 0) {
          const reflection = plane.normal
            .clone()
            .multiplyScalar(-velocityDotNormal * (1 + this.restitution));
          particle.velocity.add(reflection);

          // Apply friction
          const tangent = particle.velocity
            .clone()
            .sub(
              plane.normal
                .clone()
                .multiplyScalar(particle.velocity.dot(plane.normal))
            );
          tangent.multiplyScalar(0.9); // Friction coefficient
          particle.velocity.sub(particle.velocity).add(tangent);
        }
      }
    }
  }

  /**
   * Reset particle to initial state
   */
  private resetParticle(particle: Particle): void {
    particle.position.set(0, 0, 0);
    particle.velocity.set(0, 0, 0);
    particle.acceleration.set(0, 0, 0);
    particle.age = 0;
  }

  /**
   * Get particle positions for rendering
   */
  getPositions(): THREE.Vector3[] {
    return this.particles.map((p) => p.position.clone());
  }

  /**
   * Get particle at index
   */
  getParticle(index: number): Particle | undefined {
    return this.particles[index];
  }

  /**
   * Get all particles
   */
  getParticles(): Particle[] {
    return this.particles;
  }

  /**
   * Set particle initial position
   */
  setParticlePosition(index: number, position: THREE.Vector3): void {
    if (this.particles[index]) {
      this.particles[index].position.copy(position);
    }
  }

  /**
   * Set particle initial velocity
   */
  setParticleVelocity(index: number, velocity: THREE.Vector3): void {
    if (this.particles[index]) {
      this.particles[index].velocity.copy(velocity);
    }
  }

  /**
   * Set restitution (bounciness) for collisions
   */
  setRestitution(value: number): void {
    this.restitution = Math.max(0, Math.min(1, value));
  }
}

/**
 * Particle emitter with physics
 */
export class ParticleEmitter {
  private system: ParticlePhysicsSystem;
  private emissionRate: number;
  private emissionTimer: number = 0;
  private emitterPosition: THREE.Vector3;
  private emissionVelocity: THREE.Vector3;
  private velocityVariation: number;
  private spread: number;

  constructor(
    particleCount: number,
    emissionRate: number,
    position: THREE.Vector3,
    velocity: THREE.Vector3,
    velocityVariation: number = 0.5,
    spread: number = 30,
    lifetime: number = 3.0
  ) {
    this.system = new ParticlePhysicsSystem(particleCount, lifetime);
    this.emissionRate = emissionRate;
    this.emitterPosition = position;
    this.emissionVelocity = velocity;
    this.velocityVariation = velocityVariation;
    this.spread = spread;

    // Initialize particles at emitter
    for (let i = 0; i < particleCount; i++) {
      this.initializeParticle(i);
    }
  }

  /**
   * Initialize a particle at the emitter
   */
  private initializeParticle(index: number): void {
    const particle = this.system.getParticle(index);
    if (!particle) return;

    // Set position at emitter
    particle.position.copy(this.emitterPosition);

    // Set velocity with variation and spread
    const spreadRad = (this.spread * Math.PI) / 180;
    const theta = (Math.random() - 0.5) * spreadRad;
    const phi = Math.random() * Math.PI * 2;

    const direction = new THREE.Vector3(
      Math.sin(theta) * Math.cos(phi),
      Math.cos(theta),
      Math.sin(theta) * Math.sin(phi)
    );

    const speed =
      this.emissionVelocity.length() *
      (1 + (Math.random() - 0.5) * this.velocityVariation);

    particle.velocity.copy(direction.multiplyScalar(speed));
  }

  /**
   * Update emitter
   */
  update(delta: number): void {
    this.system.update(delta);

    // Handle emission
    this.emissionTimer += delta;
    const emissionInterval = 1 / this.emissionRate;

    while (this.emissionTimer >= emissionInterval) {
      this.emissionTimer -= emissionInterval;
      // Emission is handled by particle reset in the system
    }
  }

  /**
   * Get the physics system
   */
  getSystem(): ParticlePhysicsSystem {
    return this.system;
  }

  /**
   * Set emitter position
   */
  setPosition(position: THREE.Vector3): void {
    this.emitterPosition.copy(position);
  }
}

/**
 * Spatial hash grid for efficient neighbor detection
 */
export class SpatialHashGrid {
  private cellSize: number;
  private grid: Map<string, number[]>;

  constructor(cellSize: number = 5) {
    this.cellSize = cellSize;
    this.grid = new Map();
  }

  /**
   * Clear the grid
   */
  clear(): void {
    this.grid.clear();
  }

  /**
   * Get cell key for position
   */
  private getCellKey(position: THREE.Vector3): string {
    const x = Math.floor(position.x / this.cellSize);
    const y = Math.floor(position.y / this.cellSize);
    const z = Math.floor(position.z / this.cellSize);
    return `${x},${y},${z}`;
  }

  /**
   * Insert particle into grid
   */
  insert(index: number, position: THREE.Vector3): void {
    const key = this.getCellKey(position);
    if (!this.grid.has(key)) {
      this.grid.set(key, []);
    }
    this.grid.get(key)!.push(index);
  }

  /**
   * Get nearby particles
   */
  getNearby(position: THREE.Vector3, radius: number): number[] {
    const nearby: number[] = [];
    const cellRadius = Math.ceil(radius / this.cellSize);

    const centerX = Math.floor(position.x / this.cellSize);
    const centerY = Math.floor(position.y / this.cellSize);
    const centerZ = Math.floor(position.z / this.cellSize);

    for (let x = centerX - cellRadius; x <= centerX + cellRadius; x++) {
      for (let y = centerY - cellRadius; y <= centerY + cellRadius; y++) {
        for (let z = centerZ - cellRadius; z <= centerZ + cellRadius; z++) {
          const key = `${x},${y},${z}`;
          const cell = this.grid.get(key);
          if (cell) {
            nearby.push(...cell);
          }
        }
      }
    }

    return nearby;
  }
}
