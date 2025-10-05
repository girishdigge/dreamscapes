/**
 * Path Generator
 * Generates motion paths for different animation types
 */

class PathGenerator {
  constructor() {
    this.defaultDuration = 30; // seconds
  }

  /**
   * Generate aerial path with Bezier curves
   * @param {Object} config - Path configuration
   * @param {Object} entity - Entity information
   * @param {number} duration - Animation duration in seconds
   * @returns {Object} - Path data
   */
  generateAerialPath(config, entity, duration = this.defaultDuration) {
    const { speed = 1.0, altitude = [20, 50], banking = true } = config;

    // Generate waypoints for Bezier curve
    const numWaypoints = Math.max(4, Math.floor(duration / 5));
    const waypoints = [];

    const minAlt = altitude[0];
    const maxAlt = altitude[1];
    const avgAlt = (minAlt + maxAlt) / 2;

    for (let i = 0; i < numWaypoints; i++) {
      const t = i / (numWaypoints - 1);
      const angle = t * Math.PI * 2;

      // Create smooth 3D path
      const x = Math.cos(angle) * 40 + (Math.random() - 0.5) * 20;
      const z = Math.sin(angle) * 40 + (Math.random() - 0.5) * 20;
      const y = avgAlt + (Math.sin(t * Math.PI * 4) * (maxAlt - minAlt)) / 4;

      waypoints.push({ x, y, z });
    }

    return {
      type: 'bezier',
      waypoints,
      speed: speed,
      duration,
      banking,
      smooth: true,
      loop: true,
    };
  }

  /**
   * Generate ground path with terrain following
   * @param {Object} config - Path configuration
   * @param {Object} entity - Entity information
   * @param {number} duration - Animation duration in seconds
   * @returns {Object} - Path data
   */
  generateGroundPath(config, entity, duration = this.defaultDuration) {
    const { speed = 1.0, bobbing = true, bobbingAmplitude = 0.5 } = config;

    // Generate ground-based waypoints
    const numWaypoints = Math.max(4, Math.floor(duration / 4));
    const waypoints = [];

    for (let i = 0; i < numWaypoints; i++) {
      const t = i / (numWaypoints - 1);
      const angle = t * Math.PI * 2;

      // Ground path (y = 0 or terrain height)
      const x = Math.cos(angle) * 30 + (Math.random() - 0.5) * 10;
      const z = Math.sin(angle) * 30 + (Math.random() - 0.5) * 10;
      const y = 0; // Ground level

      waypoints.push({ x, y, z });
    }

    return {
      type: 'ground',
      waypoints,
      speed: speed,
      duration,
      bobbing,
      bobbingAmplitude,
      terrainFollow: true,
      loop: true,
    };
  }

  /**
   * Generate water surface path
   * @param {Object} config - Path configuration
   * @param {Object} entity - Entity information
   * @param {number} duration - Animation duration in seconds
   * @returns {Object} - Path data
   */
  generateWaterPath(config, entity, duration = this.defaultDuration) {
    const {
      speed = 1.0,
      bobbing = true,
      bobbingAmplitude = 0.5,
      bobbingFrequency = 0.3,
    } = config;

    // Generate water surface waypoints
    const numWaypoints = Math.max(4, Math.floor(duration / 5));
    const waypoints = [];

    const waterLevel = 0; // Water surface at y = 0

    for (let i = 0; i < numWaypoints; i++) {
      const t = i / (numWaypoints - 1);

      // Gentle curved path on water
      const x = t * 60 - 30 + Math.sin(t * Math.PI * 2) * 15;
      const z = Math.cos(t * Math.PI * 3) * 20;
      const y = waterLevel;

      waypoints.push({ x, y, z });
    }

    return {
      type: 'water',
      waypoints,
      speed: speed,
      duration,
      bobbing,
      bobbingAmplitude,
      bobbingFrequency,
      waterSurface: true,
      loop: true,
    };
  }

  /**
   * Generate circular/orbital path
   * @param {Object} config - Path configuration
   * @param {Object} entity - Entity information
   * @param {Object} target - Target to orbit around
   * @param {number} duration - Animation duration in seconds
   * @returns {Object} - Path data
   */
  generateCircularPath(
    config,
    entity,
    target = { x: 0, y: 0, z: 0 },
    duration = this.defaultDuration
  ) {
    const {
      speed = 1.0,
      radius = 30,
      axis = 'y',
      clockwise = true,
      elliptical = false,
    } = config;

    // Generate circular waypoints
    const numWaypoints = 32; // Smooth circle
    const waypoints = [];

    const radiusX = elliptical ? radius * 1.5 : radius;
    const radiusZ = radius;

    for (let i = 0; i < numWaypoints; i++) {
      const t = i / numWaypoints;
      const angle = t * Math.PI * 2 * (clockwise ? 1 : -1);

      let x, y, z;

      if (axis === 'y') {
        // Orbit around Y axis (horizontal circle)
        x = target.x + Math.cos(angle) * radiusX;
        y = target.y;
        z = target.z + Math.sin(angle) * radiusZ;
      } else if (axis === 'x') {
        // Orbit around X axis (vertical circle)
        x = target.x;
        y = target.y + Math.cos(angle) * radius;
        z = target.z + Math.sin(angle) * radius;
      } else if (axis === 'z') {
        // Orbit around Z axis (vertical circle)
        x = target.x + Math.cos(angle) * radius;
        y = target.y + Math.sin(angle) * radius;
        z = target.z;
      }

      waypoints.push({ x, y, z });
    }

    return {
      type: 'circular',
      waypoints,
      speed: speed,
      duration,
      radius,
      axis,
      target,
      loop: true,
      smooth: true,
    };
  }

  /**
   * Generate spiral path
   * @param {Object} config - Path configuration
   * @param {Object} entity - Entity information
   * @param {Object} target - Target center point
   * @param {number} duration - Animation duration in seconds
   * @returns {Object} - Path data
   */
  generateSpiralPath(
    config,
    entity,
    target = { x: 0, y: 0, z: 0 },
    duration = this.defaultDuration
  ) {
    const { speed = 1.0, radius = 35, axis = 'y', spiralIn = true } = config;

    // Generate spiral waypoints
    const numWaypoints = 64;
    const waypoints = [];

    for (let i = 0; i < numWaypoints; i++) {
      const t = i / numWaypoints;
      const angle = t * Math.PI * 4; // 2 full rotations

      // Radius changes over time
      const currentRadius = spiralIn
        ? radius * (1 - t * 0.8) // Spiral inward
        : radius * (0.2 + t * 0.8); // Spiral outward

      let x, y, z;

      if (axis === 'y') {
        x = target.x + Math.cos(angle) * currentRadius;
        y = target.y + (spiralIn ? t * 20 : -t * 20); // Vertical movement
        z = target.z + Math.sin(angle) * currentRadius;
      } else {
        x = target.x + Math.cos(angle) * currentRadius;
        y = target.y;
        z = target.z + Math.sin(angle) * currentRadius;
      }

      waypoints.push({ x, y, z });
    }

    return {
      type: 'spiral',
      waypoints,
      speed: speed,
      duration,
      radius,
      spiralIn,
      loop: false,
    };
  }

  /**
   * Generate vertical path (rising/falling)
   * @param {Object} config - Path configuration
   * @param {Object} entity - Entity information
   * @param {number} duration - Animation duration in seconds
   * @returns {Object} - Path data
   */
  generateVerticalPath(config, entity, duration = this.defaultDuration) {
    const {
      speed = 1.0,
      direction = 'up',
      gravity = false,
      acceleration = 1.0,
    } = config;

    const startY = direction === 'up' ? 0 : 50;
    const endY = direction === 'up' ? 50 : 0;

    const waypoints = [
      { x: 0, y: startY, z: 0 },
      { x: 0, y: endY, z: 0 },
    ];

    return {
      type: 'vertical',
      waypoints,
      speed: speed,
      duration,
      direction,
      gravity,
      acceleration,
      loop: false,
    };
  }

  /**
   * Generate follow path (chasing/following)
   * @param {Object} config - Path configuration
   * @param {Object} entity - Entity information
   * @param {Object} target - Target to follow
   * @param {number} duration - Animation duration in seconds
   * @returns {Object} - Path data
   */
  generateFollowPath(config, entity, target, duration = this.defaultDuration) {
    const { speed = 1.0, distance = 10 } = config;

    return {
      type: 'follow',
      speed: speed,
      duration,
      target,
      followDistance: distance,
      dynamic: true,
      smooth: true,
    };
  }

  /**
   * Generate idle animation
   * @param {Object} config - Animation configuration
   * @param {Object} entity - Entity information
   * @returns {Object} - Animation data
   */
  generateIdleAnimation(config, entity) {
    const { pattern, amplitude = 1.0, frequency = 0.5, axis = 'y' } = config;

    return {
      type: 'idle',
      pattern,
      amplitude,
      frequency,
      axis,
      continuous: true,
    };
  }

  /**
   * Smooth path with Bezier interpolation
   * @param {Array} waypoints - Array of waypoints
   * @param {number} smoothness - Smoothness factor (0-1)
   * @returns {Array} - Smoothed waypoints
   */
  smoothPath(waypoints, smoothness = 0.5) {
    if (waypoints.length < 3) {
      return waypoints;
    }

    const smoothed = [waypoints[0]];

    for (let i = 1; i < waypoints.length - 1; i++) {
      const prev = waypoints[i - 1];
      const curr = waypoints[i];
      const next = waypoints[i + 1];

      // Catmull-Rom interpolation for smoothness
      const smoothX = curr.x + (next.x - prev.x) * smoothness * 0.1;
      const smoothY = curr.y + (next.y - prev.y) * smoothness * 0.1;
      const smoothZ = curr.z + (next.z - prev.z) * smoothness * 0.1;

      smoothed.push({ x: smoothX, y: smoothY, z: smoothZ });
    }

    smoothed.push(waypoints[waypoints.length - 1]);

    return smoothed;
  }

  /**
   * Calculate path length
   * @param {Array} waypoints - Array of waypoints
   * @returns {number} - Total path length
   */
  calculatePathLength(waypoints) {
    let length = 0;

    for (let i = 1; i < waypoints.length; i++) {
      const prev = waypoints[i - 1];
      const curr = waypoints[i];

      const dx = curr.x - prev.x;
      const dy = curr.y - prev.y;
      const dz = curr.z - prev.z;

      length += Math.sqrt(dx * dx + dy * dy + dz * dz);
    }

    return length;
  }
}

module.exports = PathGenerator;
