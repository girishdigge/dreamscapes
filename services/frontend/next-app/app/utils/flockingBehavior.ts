// services/frontend/next-app/app/utils/flockingBehavior.ts
// Flocking behavior system for birds, butterflies, and other entities

import * as THREE from 'three';
import { SpatialHashGrid } from './particlePhysics';

/**
 * Boid (bird-oid) for flocking simulation
 */
export interface Boid {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  acceleration: THREE.Vector3;
  maxSpeed: number;
  maxForce: number;
}

/**
 * Flocking parameters
 */
export interface FlockingParams {
  separationDistance: number; // How close before avoiding
  alignmentDistance: number; // Distance to align with neighbors
  cohesionDistance: number; // Distance to move toward center
  separationWeight: number; // Strength of separation
  alignmentWeight: number; // Strength of alignment
  cohesionWeight: number; // Strength of cohesion
  maxSpeed: number; // Maximum velocity
  maxForce: number; // Maximum steering force
  boundaryRadius?: number; // Keep within boundary
  boundaryCenter?: THREE.Vector3; // Center of boundary
  avoidObstacles?: boolean; // Enable obstacle avoidance
}

/**
 * Flocking system implementing Reynolds' boids algorithm
 */
export class FlockingSystem {
  private boids: Boid[] = [];
  private params: FlockingParams;
  private spatialGrid: SpatialHashGrid;
  private obstacles: Array<{ position: THREE.Vector3; radius: number }> = [];

  constructor(count: number, params: Partial<FlockingParams> = {}) {
    // Default parameters
    this.params = {
      separationDistance: 3.0,
      alignmentDistance: 8.0,
      cohesionDistance: 10.0,
      separationWeight: 1.5,
      alignmentWeight: 1.0,
      cohesionWeight: 1.0,
      maxSpeed: 5.0,
      maxForce: 0.1,
      ...params,
    };

    // Initialize spatial grid for efficient neighbor detection
    this.spatialGrid = new SpatialHashGrid(this.params.cohesionDistance);

    // Initialize boids
    this.initializeBoids(count);
  }

  /**
   * Initialize boids with random positions and velocities
   */
  private initializeBoids(count: number): void {
    const center = this.params.boundaryCenter || new THREE.Vector3(0, 30, 0);
    const radius = this.params.boundaryRadius || 50;

    for (let i = 0; i < count; i++) {
      // Random position within boundary
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * Math.PI;
      const r = Math.random() * radius;

      const position = new THREE.Vector3(
        center.x + r * Math.sin(phi) * Math.cos(theta),
        center.y + r * Math.cos(phi),
        center.z + r * Math.sin(phi) * Math.sin(theta)
      );

      // Random velocity
      const velocity = new THREE.Vector3(
        (Math.random() - 0.5) * this.params.maxSpeed,
        (Math.random() - 0.5) * this.params.maxSpeed * 0.5,
        (Math.random() - 0.5) * this.params.maxSpeed
      );

      this.boids.push({
        position,
        velocity,
        acceleration: new THREE.Vector3(0, 0, 0),
        maxSpeed: this.params.maxSpeed,
        maxForce: this.params.maxForce,
      });
    }
  }

  /**
   * Add obstacle to avoid
   */
  addObstacle(position: THREE.Vector3, radius: number): void {
    this.obstacles.push({ position, radius });
  }

  /**
   * Clear all obstacles
   */
  clearObstacles(): void {
    this.obstacles = [];
  }

  /**
   * Update flocking simulation
   */
  update(delta: number): void {
    // Rebuild spatial grid
    this.spatialGrid.clear();
    for (let i = 0; i < this.boids.length; i++) {
      this.spatialGrid.insert(i, this.boids[i].position);
    }

    // Update each boid
    for (let i = 0; i < this.boids.length; i++) {
      const boid = this.boids[i];

      // Reset acceleration
      boid.acceleration.set(0, 0, 0);

      // Get nearby boids
      const nearbyIndices = this.spatialGrid.getNearby(
        boid.position,
        this.params.cohesionDistance
      );
      const neighbors = nearbyIndices
        .filter((idx) => idx !== i)
        .map((idx) => this.boids[idx]);

      // Apply flocking rules
      const separation = this.calculateSeparation(boid, neighbors);
      const alignment = this.calculateAlignment(boid, neighbors);
      const cohesion = this.calculateCohesion(boid, neighbors);

      // Weight the forces
      separation.multiplyScalar(this.params.separationWeight);
      alignment.multiplyScalar(this.params.alignmentWeight);
      cohesion.multiplyScalar(this.params.cohesionWeight);

      // Apply forces
      this.applyForce(boid, separation);
      this.applyForce(boid, alignment);
      this.applyForce(boid, cohesion);

      // Boundary containment
      if (this.params.boundaryRadius && this.params.boundaryCenter) {
        const boundary = this.calculateBoundary(boid);
        this.applyForce(boid, boundary);
      }

      // Obstacle avoidance
      if (this.params.avoidObstacles && this.obstacles.length > 0) {
        const avoidance = this.calculateObstacleAvoidance(boid);
        this.applyForce(boid, avoidance);
      }

      // Update velocity and position
      boid.velocity.add(boid.acceleration.clone().multiplyScalar(delta));

      // Limit speed
      if (boid.velocity.length() > boid.maxSpeed) {
        boid.velocity.normalize().multiplyScalar(boid.maxSpeed);
      }

      boid.position.add(boid.velocity.clone().multiplyScalar(delta));
    }
  }

  /**
   * Separation: steer to avoid crowding local flockmates
   */
  private calculateSeparation(boid: Boid, neighbors: Boid[]): THREE.Vector3 {
    const steer = new THREE.Vector3(0, 0, 0);
    let count = 0;

    for (const other of neighbors) {
      const distance = boid.position.distanceTo(other.position);

      if (distance > 0 && distance < this.params.separationDistance) {
        // Calculate vector pointing away from neighbor
        const diff = boid.position.clone().sub(other.position);
        diff.normalize();
        diff.divideScalar(distance); // Weight by distance
        steer.add(diff);
        count++;
      }
    }

    if (count > 0) {
      steer.divideScalar(count);

      // Implement Reynolds: Steering = Desired - Velocity
      if (steer.length() > 0) {
        steer.normalize();
        steer.multiplyScalar(boid.maxSpeed);
        steer.sub(boid.velocity);
        steer.clampLength(0, boid.maxForce);
      }
    }

    return steer;
  }

  /**
   * Alignment: steer towards the average heading of local flockmates
   */
  private calculateAlignment(boid: Boid, neighbors: Boid[]): THREE.Vector3 {
    const sum = new THREE.Vector3(0, 0, 0);
    let count = 0;

    for (const other of neighbors) {
      const distance = boid.position.distanceTo(other.position);

      if (distance > 0 && distance < this.params.alignmentDistance) {
        sum.add(other.velocity);
        count++;
      }
    }

    if (count > 0) {
      sum.divideScalar(count);
      sum.normalize();
      sum.multiplyScalar(boid.maxSpeed);

      // Steering = Desired - Velocity
      const steer = sum.sub(boid.velocity);
      steer.clampLength(0, boid.maxForce);
      return steer;
    }

    return new THREE.Vector3(0, 0, 0);
  }

  /**
   * Cohesion: steer to move toward the average position of local flockmates
   */
  private calculateCohesion(boid: Boid, neighbors: Boid[]): THREE.Vector3 {
    const sum = new THREE.Vector3(0, 0, 0);
    let count = 0;

    for (const other of neighbors) {
      const distance = boid.position.distanceTo(other.position);

      if (distance > 0 && distance < this.params.cohesionDistance) {
        sum.add(other.position);
        count++;
      }
    }

    if (count > 0) {
      sum.divideScalar(count);
      return this.seek(boid, sum);
    }

    return new THREE.Vector3(0, 0, 0);
  }

  /**
   * Seek: steer towards a target
   */
  private seek(boid: Boid, target: THREE.Vector3): THREE.Vector3 {
    const desired = target.clone().sub(boid.position);
    desired.normalize();
    desired.multiplyScalar(boid.maxSpeed);

    // Steering = Desired - Velocity
    const steer = desired.sub(boid.velocity);
    steer.clampLength(0, boid.maxForce);
    return steer;
  }

  /**
   * Boundary: keep boids within a spherical boundary
   */
  private calculateBoundary(boid: Boid): THREE.Vector3 {
    if (!this.params.boundaryCenter || !this.params.boundaryRadius) {
      return new THREE.Vector3(0, 0, 0);
    }

    const distance = boid.position.distanceTo(this.params.boundaryCenter);
    const threshold = this.params.boundaryRadius * 0.9;

    if (distance > threshold) {
      // Steer back toward center
      const desired = this.params.boundaryCenter.clone().sub(boid.position);
      desired.normalize();

      // Stronger force as we get closer to boundary
      const strength =
        ((distance - threshold) / (this.params.boundaryRadius - threshold)) * 2;
      desired.multiplyScalar(boid.maxSpeed * strength);

      const steer = desired.sub(boid.velocity);
      steer.clampLength(0, boid.maxForce * 2); // Allow stronger boundary force
      return steer;
    }

    return new THREE.Vector3(0, 0, 0);
  }

  /**
   * Obstacle avoidance
   */
  private calculateObstacleAvoidance(boid: Boid): THREE.Vector3 {
    const steer = new THREE.Vector3(0, 0, 0);
    const lookAhead = 5.0; // How far ahead to look

    // Project position ahead
    const ahead = boid.position
      .clone()
      .add(boid.velocity.clone().normalize().multiplyScalar(lookAhead));

    for (const obstacle of this.obstacles) {
      const distance = ahead.distanceTo(obstacle.position);

      if (distance < obstacle.radius + 2) {
        // Calculate avoidance vector
        const avoidance = ahead.clone().sub(obstacle.position);
        avoidance.normalize();
        avoidance.multiplyScalar(boid.maxSpeed);

        // Weight by proximity
        const weight = 1 - distance / (obstacle.radius + 2);
        avoidance.multiplyScalar(weight);

        steer.add(avoidance);
      }
    }

    if (steer.length() > 0) {
      steer.clampLength(0, boid.maxForce * 1.5);
    }

    return steer;
  }

  /**
   * Apply force to boid
   */
  private applyForce(boid: Boid, force: THREE.Vector3): void {
    boid.acceleration.add(force);
  }

  /**
   * Get boid positions for rendering
   */
  getPositions(): THREE.Vector3[] {
    return this.boids.map((b) => b.position.clone());
  }

  /**
   * Get boid velocities for rendering (for orientation)
   */
  getVelocities(): THREE.Vector3[] {
    return this.boids.map((b) => b.velocity.clone());
  }

  /**
   * Get boid at index
   */
  getBoid(index: number): Boid | undefined {
    return this.boids[index];
  }

  /**
   * Get all boids
   */
  getBoids(): Boid[] {
    return this.boids;
  }

  /**
   * Update flocking parameters
   */
  updateParams(params: Partial<FlockingParams>): void {
    this.params = { ...this.params, ...params };

    // Update boid properties
    for (const boid of this.boids) {
      boid.maxSpeed = this.params.maxSpeed;
      boid.maxForce = this.params.maxForce;
    }
  }
}

/**
 * Butterfly-specific flocking with more erratic movement
 */
export class ButterflyFlocking extends FlockingSystem {
  private turbulenceStrength: number;

  constructor(count: number, params: Partial<FlockingParams> = {}) {
    // Butterflies have different default parameters
    const butterflyParams = {
      separationDistance: 2.0,
      alignmentDistance: 5.0,
      cohesionDistance: 7.0,
      separationWeight: 2.0,
      alignmentWeight: 0.5,
      cohesionWeight: 0.8,
      maxSpeed: 3.0,
      maxForce: 0.15,
      ...params,
    };

    super(count, butterflyParams);
    this.turbulenceStrength = 0.5;
  }

  /**
   * Override update to add turbulence
   */
  update(delta: number): void {
    super.update(delta);

    // Add random turbulence for erratic butterfly movement
    for (const boid of this.getBoids()) {
      const turbulence = new THREE.Vector3(
        (Math.random() - 0.5) * this.turbulenceStrength,
        (Math.random() - 0.5) * this.turbulenceStrength * 0.5,
        (Math.random() - 0.5) * this.turbulenceStrength
      );

      boid.velocity.add(turbulence);

      // Limit speed
      if (boid.velocity.length() > boid.maxSpeed) {
        boid.velocity.normalize().multiplyScalar(boid.maxSpeed);
      }
    }
  }

  /**
   * Set turbulence strength
   */
  setTurbulence(strength: number): void {
    this.turbulenceStrength = strength;
  }
}
