/**
 * Physics Event Generator
 * Generates physics-based events with particles and dynamics
 */

class PhysicsEventGenerator {
  constructor() {
    this.gravity = -9.8; // m/s²
  }

  /**
   * Generate explosion event
   * @param {Object} config - Explosion configuration
   * @returns {Object} - Explosion event data
   */
  generateExplosion(config) {
    const {
      position = { x: 0, y: 0, z: 0 },
      intensity = 1.0,
      time = 0,
      entity = null,
    } = config;

    const particleCount = Math.floor(500 * intensity);
    const maxVelocity = 15 * intensity;
    const minVelocity = 5 * intensity;

    return {
      type: 'explosion',
      time,
      position,
      entity,
      duration: 2.0,
      particles: {
        count: particleCount,
        type: 'burst',
        velocity: {
          min: minVelocity,
          max: maxVelocity,
          distribution: 'spherical',
        },
        gravity: this.gravity,
        lifetime: 2.0,
        size: {
          start: 2.0 * intensity,
          end: 0.1,
        },
        color: {
          start: '#ff6600',
          end: '#ff0000',
        },
        opacity: {
          start: 1.0,
          end: 0.0,
        },
        emissive: true,
      },
      effects: {
        flash: true,
        shockwave: true,
        shake: {
          intensity: 0.5 * intensity,
          duration: 0.5,
        },
        sound: 'explosion',
      },
    };
  }

  /**
   * Generate eruption event
   * @param {Object} config - Eruption configuration
   * @returns {Object} - Eruption event data
   */
  generateEruption(config) {
    const {
      position = { x: 0, y: 0, z: 0 },
      intensity = 1.0,
      time = 0,
      entity = null,
      duration = 5.0,
    } = config;

    const particleCount = Math.floor(1000 * intensity);
    const upwardVelocity = 20 * intensity;

    return {
      type: 'eruption',
      time,
      position,
      entity,
      duration,
      particles: {
        count: particleCount,
        type: 'stream',
        velocity: {
          x: 0,
          y: upwardVelocity,
          z: 0,
          spread: 5 * intensity,
        },
        gravity: this.gravity,
        lifetime: 3.0,
        emissionRate: particleCount / duration,
        size: {
          start: 3.0 * intensity,
          end: 0.5,
        },
        color: {
          start: '#ff3300',
          end: '#660000',
        },
        opacity: {
          start: 1.0,
          end: 0.0,
        },
        emissive: true,
        trail: true,
      },
      effects: {
        glow: true,
        heat: true,
        smoke: true,
        sound: 'eruption',
      },
    };
  }

  /**
   * Generate collision event
   * @param {Object} config - Collision configuration
   * @returns {Object} - Collision event data
   */
  generateCollision(config) {
    const {
      position = { x: 0, y: 0, z: 0 },
      intensity = 0.8,
      time = 0,
      entities = [],
      velocity1 = { x: 0, y: 0, z: 0 },
      velocity2 = { x: 0, y: 0, z: 0 },
    } = config;

    const particleCount = Math.floor(200 * intensity);

    // Calculate impact direction
    const impactDir = {
      x: velocity1.x - velocity2.x,
      y: velocity1.y - velocity2.y,
      z: velocity1.z - velocity2.z,
    };

    return {
      type: 'collision',
      time,
      position,
      entities,
      duration: 1.0,
      particles: {
        count: particleCount,
        type: 'burst',
        velocity: {
          min: 3,
          max: 10,
          distribution: 'directional',
          direction: impactDir,
        },
        gravity: this.gravity,
        lifetime: 1.5,
        size: {
          start: 1.5,
          end: 0.1,
        },
        color: {
          start: '#ffffff',
          end: '#888888',
        },
        opacity: {
          start: 1.0,
          end: 0.0,
        },
      },
      effects: {
        impact: true,
        shake: {
          intensity: 0.3 * intensity,
          duration: 0.3,
        },
        sound: 'impact',
      },
      physics: {
        bounce: true,
        friction: 0.8,
      },
    };
  }

  /**
   * Generate burst event
   * @param {Object} config - Burst configuration
   * @returns {Object} - Burst event data
   */
  generateBurst(config) {
    const {
      position = { x: 0, y: 0, z: 0 },
      intensity = 0.9,
      time = 0,
      entity = null,
    } = config;

    const particleCount = Math.floor(300 * intensity);

    return {
      type: 'burst',
      time,
      position,
      entity,
      duration: 1.5,
      particles: {
        count: particleCount,
        type: 'burst',
        velocity: {
          min: 8,
          max: 15,
          distribution: 'spherical',
        },
        gravity: this.gravity * 0.5, // Lighter particles
        lifetime: 2.0,
        size: {
          start: 1.0,
          end: 0.05,
        },
        color: {
          start: '#ffff00',
          end: '#ff8800',
        },
        opacity: {
          start: 1.0,
          end: 0.0,
        },
        emissive: true,
      },
      effects: {
        flash: true,
        glow: true,
        sound: 'burst',
      },
    };
  }

  /**
   * Generate shatter event
   * @param {Object} config - Shatter configuration
   * @returns {Object} - Shatter event data
   */
  generateShatter(config) {
    const {
      position = { x: 0, y: 0, z: 0 },
      intensity = 1.0,
      time = 0,
      entity = null,
    } = config;

    const particleCount = Math.floor(400 * intensity);

    return {
      type: 'shatter',
      time,
      position,
      entity,
      duration: 2.0,
      particles: {
        count: particleCount,
        type: 'fragments',
        velocity: {
          min: 5,
          max: 12,
          distribution: 'spherical',
        },
        gravity: this.gravity,
        lifetime: 3.0,
        size: {
          start: 0.5,
          end: 0.1,
        },
        color: {
          start: '#cccccc',
          end: '#666666',
        },
        opacity: {
          start: 1.0,
          end: 0.0,
        },
        rotation: true,
        angular: {
          min: -5,
          max: 5,
        },
      },
      effects: {
        sound: 'shatter',
      },
      physics: {
        bounce: true,
        friction: 0.6,
      },
    };
  }

  /**
   * Generate transformation event
   * @param {Object} config - Transformation configuration
   * @returns {Object} - Transformation event data
   */
  generateTransformation(config) {
    const {
      entity = null,
      time = 0,
      duration = 2.0,
      transformType = 'scale',
      startValue = 1.0,
      endValue = 2.0,
    } = config;

    return {
      type: 'transformation',
      time,
      entity,
      duration,
      transform: {
        type: transformType,
        start: startValue,
        end: endValue,
        easing: 'ease-in-out',
      },
      particles: {
        count: 100,
        type: 'aura',
        velocity: {
          min: 1,
          max: 3,
          distribution: 'radial',
        },
        lifetime: duration,
        size: {
          start: 0.5,
          end: 0.1,
        },
        color: {
          start: '#00ffff',
          end: '#0088ff',
        },
        opacity: {
          start: 0.8,
          end: 0.0,
        },
        emissive: true,
      },
      effects: {
        glow: true,
        distortion: true,
        sound: 'transform',
      },
    };
  }

  /**
   * Generate particle stream
   * @param {Object} config - Stream configuration
   * @returns {Object} - Particle stream data
   */
  generateParticleStream(config) {
    const {
      position = { x: 0, y: 0, z: 0 },
      direction = { x: 0, y: 1, z: 0 },
      velocity = 10,
      duration = 3.0,
      particleCount = 500,
      time = 0,
    } = config;

    return {
      type: 'particle_stream',
      time,
      position,
      duration,
      particles: {
        count: particleCount,
        type: 'stream',
        velocity: {
          x: direction.x * velocity,
          y: direction.y * velocity,
          z: direction.z * velocity,
          spread: 2,
        },
        gravity: this.gravity,
        lifetime: 2.0,
        emissionRate: particleCount / duration,
        size: {
          start: 1.0,
          end: 0.2,
        },
        color: {
          start: '#ffffff',
          end: '#888888',
        },
        opacity: {
          start: 1.0,
          end: 0.0,
        },
      },
    };
  }

  /**
   * Calculate particle trajectory
   * @param {Object} particle - Particle data
   * @param {number} time - Time elapsed
   * @returns {Object} - Particle position
   */
  calculateParticleTrajectory(particle, time) {
    const { position, velocity, gravity } = particle;

    return {
      x: position.x + velocity.x * time,
      y: position.y + velocity.y * time + 0.5 * gravity * time * time,
      z: position.z + velocity.z * time,
    };
  }

  /**
   * Generate event from verb
   * @param {string} verb - Event verb
   * @param {Object} config - Event configuration
   * @returns {Object} - Event data
   */
  generateEventFromVerb(verb, config) {
    const verbLower = verb.toLowerCase();

    switch (verbLower) {
      case 'exploding':
      case 'explode':
        return this.generateExplosion(config);

      case 'erupting':
      case 'erupt':
        return this.generateEruption(config);

      case 'colliding':
      case 'collide':
        return this.generateCollision(config);

      case 'bursting':
      case 'burst':
        return this.generateBurst(config);

      case 'shattering':
      case 'shatter':
        return this.generateShatter(config);

      default:
        // Generic particle effect
        return this.generateBurst(config);
    }
  }
}

module.exports = PhysicsEventGenerator;
