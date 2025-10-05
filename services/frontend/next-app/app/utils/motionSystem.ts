// services/frontend/next-app/app/utils/motionSystem.ts
// Enhanced motion system for structures with physics-based movement

import * as THREE from 'three';

/**
 * Elliptical orbit calculator
 */
export class EllipticalOrbit {
  private semiMajorAxis: number;
  private semiMinorAxis: number;
  private center: THREE.Vector3;
  private speed: number;
  private tilt: number;
  private rotation: number;

  constructor(
    center: [number, number, number],
    radiusX: number,
    radiusZ: number,
    speed: number = 1.0,
    tilt: number = 0,
    rotation: number = 0
  ) {
    this.center = new THREE.Vector3(...center);
    this.semiMajorAxis = Math.max(radiusX, radiusZ);
    this.semiMinorAxis = Math.min(radiusX, radiusZ);
    this.speed = speed;
    this.tilt = tilt;
    this.rotation = rotation;
  }

  /**
   * Get position on elliptical orbit at time t
   */
  getPosition(time: number): THREE.Vector3 {
    const angle = time * this.speed;

    // Calculate position on ellipse
    const x = this.semiMajorAxis * Math.cos(angle);
    const z = this.semiMinorAxis * Math.sin(angle);

    // Create position vector
    const position = new THREE.Vector3(x, 0, z);

    // Apply rotation around Y axis
    if (this.rotation !== 0) {
      position.applyAxisAngle(new THREE.Vector3(0, 1, 0), this.rotation);
    }

    // Apply tilt
    if (this.tilt !== 0) {
      position.applyAxisAngle(new THREE.Vector3(1, 0, 0), this.tilt);
    }

    // Add center offset
    position.add(this.center);

    return position;
  }

  /**
   * Get velocity (tangent) at time t for banking calculation
   */
  getVelocity(time: number): THREE.Vector3 {
    const angle = time * this.speed;
    const delta = 0.01;

    const p1 = this.getPosition(time);
    const p2 = this.getPosition(time + delta);

    return p2.sub(p1).normalize();
  }

  /**
   * Get banking angle based on velocity and orbit curvature
   */
  getBankingAngle(time: number, bankingFactor: number = 1.0): number {
    const angle = time * this.speed;

    // Calculate curvature at this point
    const eccentricity = Math.sqrt(
      1 -
        (this.semiMinorAxis * this.semiMinorAxis) /
          (this.semiMajorAxis * this.semiMajorAxis)
    );

    // Banking is proportional to speed and curvature
    const curvature = eccentricity * Math.abs(Math.sin(angle));
    return curvature * this.speed * bankingFactor * 0.3;
  }
}

/**
 * Multi-axis rotation with momentum
 */
export class RotationMomentum {
  private angularVelocity: THREE.Vector3;
  private angularAcceleration: THREE.Vector3;
  private damping: number;
  private maxSpeed: number;

  constructor(damping: number = 0.98, maxSpeed: number = 2.0) {
    this.angularVelocity = new THREE.Vector3(0, 0, 0);
    this.angularAcceleration = new THREE.Vector3(0, 0, 0);
    this.damping = damping;
    this.maxSpeed = maxSpeed;
  }

  /**
   * Apply torque to rotation
   */
  applyTorque(torque: THREE.Vector3): void {
    this.angularAcceleration.add(torque);
  }

  /**
   * Update rotation with momentum
   */
  update(delta: number): THREE.Euler {
    // Apply acceleration
    this.angularVelocity.add(
      this.angularAcceleration.clone().multiplyScalar(delta)
    );

    // Apply damping
    this.angularVelocity.multiplyScalar(this.damping);

    // Clamp to max speed
    if (this.angularVelocity.length() > this.maxSpeed) {
      this.angularVelocity.normalize().multiplyScalar(this.maxSpeed);
    }

    // Reset acceleration
    this.angularAcceleration.set(0, 0, 0);

    // Return rotation delta
    return new THREE.Euler(
      this.angularVelocity.x * delta,
      this.angularVelocity.y * delta,
      this.angularVelocity.z * delta
    );
  }

  /**
   * Set angular velocity directly
   */
  setVelocity(velocity: THREE.Vector3): void {
    this.angularVelocity.copy(velocity);
  }

  /**
   * Get current angular velocity
   */
  getVelocity(): THREE.Vector3 {
    return this.angularVelocity.clone();
  }
}

/**
 * Enhanced float motion with multiple sine waves
 */
export class FloatMotion {
  private amplitudes: number[];
  private frequencies: number[];
  private phases: number[];
  private axes: ('x' | 'y' | 'z')[];

  constructor(
    waves: Array<{
      amplitude: number;
      frequency: number;
      phase?: number;
      axis: 'x' | 'y' | 'z';
    }>
  ) {
    this.amplitudes = waves.map((w) => w.amplitude);
    this.frequencies = waves.map((w) => w.frequency);
    this.phases = waves.map((w) => w.phase || 0);
    this.axes = waves.map((w) => w.axis);
  }

  /**
   * Get offset at time t
   */
  getOffset(time: number): THREE.Vector3 {
    const offset = new THREE.Vector3(0, 0, 0);

    for (let i = 0; i < this.amplitudes.length; i++) {
      const value =
        this.amplitudes[i] *
        Math.sin(time * this.frequencies[i] + this.phases[i]);

      switch (this.axes[i]) {
        case 'x':
          offset.x += value;
          break;
        case 'y':
          offset.y += value;
          break;
        case 'z':
          offset.z += value;
          break;
      }
    }

    return offset;
  }
}

/**
 * Spiral motion (orbit with changing height)
 */
export class SpiralMotion {
  private orbit: EllipticalOrbit;
  private heightAmplitude: number;
  private heightFrequency: number;
  private heightPhase: number;

  constructor(
    center: [number, number, number],
    radiusX: number,
    radiusZ: number,
    speed: number,
    heightAmplitude: number,
    heightFrequency: number = 1.0,
    heightPhase: number = 0
  ) {
    this.orbit = new EllipticalOrbit(center, radiusX, radiusZ, speed);
    this.heightAmplitude = heightAmplitude;
    this.heightFrequency = heightFrequency;
    this.heightPhase = heightPhase;
  }

  /**
   * Get position on spiral at time t
   */
  getPosition(time: number): THREE.Vector3 {
    const position = this.orbit.getPosition(time);

    // Add height variation
    const heightOffset =
      this.heightAmplitude *
      Math.sin(time * this.heightFrequency + this.heightPhase);
    position.y += heightOffset;

    return position;
  }

  /**
   * Get banking angle
   */
  getBankingAngle(time: number, bankingFactor: number = 1.0): number {
    return this.orbit.getBankingAngle(time, bankingFactor);
  }
}

/**
 * Pendulum motion
 */
export class PendulumMotion {
  private pivot: THREE.Vector3;
  private length: number;
  private amplitude: number;
  private frequency: number;
  private phase: number;
  private axis: THREE.Vector3;

  constructor(
    pivot: [number, number, number],
    length: number,
    amplitude: number,
    frequency: number = 1.0,
    phase: number = 0,
    axis: [number, number, number] = [1, 0, 0]
  ) {
    this.pivot = new THREE.Vector3(...pivot);
    this.length = length;
    this.amplitude = amplitude;
    this.frequency = frequency;
    this.phase = phase;
    this.axis = new THREE.Vector3(...axis).normalize();
  }

  /**
   * Get position at time t
   */
  getPosition(time: number): THREE.Vector3 {
    const angle = this.amplitude * Math.sin(time * this.frequency + this.phase);

    // Calculate position based on pendulum angle
    const perpendicular = new THREE.Vector3(0, -1, 0);
    if (Math.abs(this.axis.y) > 0.99) {
      perpendicular.set(1, 0, 0);
    }

    const swingAxis = new THREE.Vector3()
      .crossVectors(this.axis, perpendicular)
      .normalize();

    const position = new THREE.Vector3(0, -this.length, 0);
    position.applyAxisAngle(swingAxis, angle);
    position.add(this.pivot);

    return position;
  }

  /**
   * Get rotation for the swinging object
   */
  getRotation(time: number): number {
    return this.amplitude * Math.sin(time * this.frequency + this.phase);
  }
}

/**
 * Figure-8 motion pattern
 */
export class Figure8Motion {
  private center: THREE.Vector3;
  private scale: number;
  private speed: number;
  private tilt: number;

  constructor(
    center: [number, number, number],
    scale: number = 10,
    speed: number = 1.0,
    tilt: number = 0
  ) {
    this.center = new THREE.Vector3(...center);
    this.scale = scale;
    this.speed = speed;
    this.tilt = tilt;
  }

  /**
   * Get position on figure-8 at time t
   */
  getPosition(time: number): THREE.Vector3 {
    const t = time * this.speed;

    // Lemniscate of Bernoulli parametric equations
    const a = this.scale;
    const denominator = 1 + Math.sin(t) * Math.sin(t);

    const x = (a * Math.cos(t)) / denominator;
    const z = (a * Math.sin(t) * Math.cos(t)) / denominator;

    const position = new THREE.Vector3(x, 0, z);

    // Apply tilt
    if (this.tilt !== 0) {
      position.applyAxisAngle(new THREE.Vector3(1, 0, 0), this.tilt);
    }

    position.add(this.center);

    return position;
  }
}
