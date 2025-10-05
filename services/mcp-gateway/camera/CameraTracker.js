/**
 * Camera Tracker
 * Implements smooth camera tracking and motion prediction
 */

class CameraTracker {
  constructor() {
    this.smoothingFactor = 0.1; // Lower = smoother
    this.predictionTime = 0.5; // Seconds ahead to predict
  }

  /**
   * Track entity with smooth following
   * @param {Object} camera - Current camera state
   * @param {Object} entity - Entity to track
   * @param {Object} motion - Entity motion data
   * @param {number} deltaTime - Time since last update
   * @param {Object} options - Tracking options
   * @returns {Object} - Updated camera state
   */
  trackEntity(camera, entity, motion, deltaTime, options = {}) {
    const {
      distance = 30,
      height = 10,
      mode = 'follow',
      smoothing = this.smoothingFactor,
      predict = true,
    } = options;

    // Get entity position (current or predicted)
    const entityPos = predict
      ? this.predictPosition(entity, motion, this.predictionTime)
      : entity.position || { x: 0, y: 0, z: 0 };

    // Calculate target camera position based on mode
    let targetPos;

    switch (mode) {
      case 'follow':
        targetPos = this.calculateFollowPosition(
          entityPos,
          motion,
          distance,
          height
        );
        break;

      case 'orbit':
        targetPos = this.calculateOrbitPosition(
          entityPos,
          camera,
          distance,
          deltaTime
        );
        break;

      case 'side':
        targetPos = this.calculateSidePosition(
          entityPos,
          motion,
          distance,
          height
        );
        break;

      case 'front':
        targetPos = this.calculateFrontPosition(
          entityPos,
          motion,
          distance,
          height
        );
        break;

      default:
        targetPos = this.calculateFollowPosition(
          entityPos,
          motion,
          distance,
          height
        );
    }

    // Smooth interpolation to target
    const newCameraPos = this.smoothInterpolate(
      camera.position,
      targetPos,
      smoothing
    );

    // Calculate look-at point (slightly ahead of entity)
    const lookAtPos = predict
      ? this.predictPosition(entity, motion, this.predictionTime * 2)
      : entityPos;

    return {
      position: newCameraPos,
      lookAt: lookAtPos,
      target: entity,
    };
  }

  /**
   * Predict entity position based on velocity
   * @param {Object} entity - Entity data
   * @param {Object} motion - Motion data
   * @param {number} time - Time ahead to predict
   * @returns {Object} - Predicted position
   */
  predictPosition(entity, motion, time) {
    const currentPos = entity.position || { x: 0, y: 0, z: 0 };

    if (!motion || !motion.velocity) {
      return currentPos;
    }

    const velocity = motion.velocity;

    return {
      x: currentPos.x + velocity.x * time,
      y: currentPos.y + velocity.y * time,
      z: currentPos.z + velocity.z * time,
    };
  }

  /**
   * Calculate follow position (behind entity)
   * @param {Object} entityPos - Entity position
   * @param {Object} motion - Motion data
   * @param {number} distance - Follow distance
   * @param {number} height - Height offset
   * @returns {Object} - Camera position
   */
  calculateFollowPosition(entityPos, motion, distance, height) {
    // Get direction entity is moving
    const direction = motion?.velocity
      ? this.normalizeVector(motion.velocity)
      : { x: 0, y: 0, z: 1 };

    // Position camera behind entity
    return {
      x: entityPos.x - direction.x * distance,
      y: entityPos.y + height,
      z: entityPos.z - direction.z * distance,
    };
  }

  /**
   * Calculate orbit position (circular around entity)
   * @param {Object} entityPos - Entity position
   * @param {Object} camera - Current camera state
   * @param {number} distance - Orbit distance
   * @param {number} deltaTime - Time delta
   * @returns {Object} - Camera position
   */
  calculateOrbitPosition(entityPos, camera, distance, deltaTime) {
    // Calculate current angle
    const dx = camera.position.x - entityPos.x;
    const dz = camera.position.z - entityPos.z;
    let angle = Math.atan2(dz, dx);

    // Increment angle for orbit
    const orbitSpeed = 0.2; // radians per second
    angle += orbitSpeed * deltaTime;

    return {
      x: entityPos.x + Math.cos(angle) * distance,
      y: entityPos.y + distance * 0.3,
      z: entityPos.z + Math.sin(angle) * distance,
    };
  }

  /**
   * Calculate side position (beside entity)
   * @param {Object} entityPos - Entity position
   * @param {Object} motion - Motion data
   * @param {number} distance - Side distance
   * @param {number} height - Height offset
   * @returns {Object} - Camera position
   */
  calculateSidePosition(entityPos, motion, distance, height) {
    const direction = motion?.velocity
      ? this.normalizeVector(motion.velocity)
      : { x: 0, y: 0, z: 1 };

    // Calculate perpendicular vector (to the right)
    const perpendicular = {
      x: -direction.z,
      y: 0,
      z: direction.x,
    };

    return {
      x: entityPos.x + perpendicular.x * distance,
      y: entityPos.y + height,
      z: entityPos.z + perpendicular.z * distance,
    };
  }

  /**
   * Calculate front position (in front of entity)
   * @param {Object} entityPos - Entity position
   * @param {Object} motion - Motion data
   * @param {number} distance - Front distance
   * @param {number} height - Height offset
   * @returns {Object} - Camera position
   */
  calculateFrontPosition(entityPos, motion, distance, height) {
    const direction = motion?.velocity
      ? this.normalizeVector(motion.velocity)
      : { x: 0, y: 0, z: 1 };

    return {
      x: entityPos.x + direction.x * distance,
      y: entityPos.y + height,
      z: entityPos.z + direction.z * distance,
    };
  }

  /**
   * Smooth interpolation between positions
   * @param {Object} current - Current position
   * @param {Object} target - Target position
   * @param {number} factor - Smoothing factor (0-1)
   * @returns {Object} - Interpolated position
   */
  smoothInterpolate(current, target, factor) {
    return {
      x: current.x + (target.x - current.x) * factor,
      y: current.y + (target.y - current.y) * factor,
      z: current.z + (target.z - current.z) * factor,
    };
  }

  /**
   * Normalize vector
   * @param {Object} vector - Vector to normalize
   * @returns {Object} - Normalized vector
   */
  normalizeVector(vector) {
    const length = Math.sqrt(
      vector.x * vector.x + vector.y * vector.y + vector.z * vector.z
    );

    if (length === 0) {
      return { x: 0, y: 0, z: 1 };
    }

    return {
      x: vector.x / length,
      y: vector.y / length,
      z: vector.z / length,
    };
  }

  /**
   * Calculate camera shake
   * @param {Object} camera - Current camera state
   * @param {number} intensity - Shake intensity (0-1)
   * @param {number} time - Current time
   * @returns {Object} - Camera with shake applied
   */
  applyShake(camera, intensity, time) {
    const shakeAmount = intensity * 2;
    const frequency = 20;

    const shake = {
      x: Math.sin(time * frequency) * shakeAmount,
      y: Math.cos(time * frequency * 1.3) * shakeAmount,
      z: Math.sin(time * frequency * 0.8) * shakeAmount,
    };

    return {
      ...camera,
      position: {
        x: camera.position.x + shake.x,
        y: camera.position.y + shake.y,
        z: camera.position.z + shake.z,
      },
    };
  }

  /**
   * Frame multiple subjects
   * @param {Array} entities - Array of entities to frame
   * @param {Object} options - Framing options
   * @returns {Object} - Camera state
   */
  frameMultipleSubjects(entities, options = {}) {
    const { padding = 1.2 } = options;

    if (entities.length === 0) {
      return {
        position: { x: 0, y: 50, z: 100 },
        lookAt: { x: 0, y: 0, z: 0 },
      };
    }

    // Calculate bounding box
    const bounds = this.calculateBounds(entities);

    // Calculate center
    const center = {
      x: (bounds.min.x + bounds.max.x) / 2,
      y: (bounds.min.y + bounds.max.y) / 2,
      z: (bounds.min.z + bounds.max.z) / 2,
    };

    // Calculate size
    const size = {
      x: bounds.max.x - bounds.min.x,
      y: bounds.max.y - bounds.min.y,
      z: bounds.max.z - bounds.min.z,
    };

    // Calculate distance to fit all subjects
    const maxSize = Math.max(size.x, size.y, size.z);
    const distance = maxSize * padding;

    return {
      position: {
        x: center.x,
        y: center.y + distance * 0.5,
        z: center.z + distance,
      },
      lookAt: center,
    };
  }

  /**
   * Calculate bounding box for entities
   * @param {Array} entities - Array of entities
   * @returns {Object} - Bounding box
   */
  calculateBounds(entities) {
    const positions = entities.map((e) => e.position || { x: 0, y: 0, z: 0 });

    return {
      min: {
        x: Math.min(...positions.map((p) => p.x)),
        y: Math.min(...positions.map((p) => p.y)),
        z: Math.min(...positions.map((p) => p.z)),
      },
      max: {
        x: Math.max(...positions.map((p) => p.x)),
        y: Math.max(...positions.map((p) => p.y)),
        z: Math.max(...positions.map((p) => p.z)),
      },
    };
  }

  /**
   * Apply rule of thirds composition
   * @param {Object} camera - Camera state
   * @param {Object} subject - Subject to position
   * @param {string} position - Position ('left', 'right', 'center', 'top', 'bottom')
   * @returns {Object} - Adjusted camera state
   */
  applyRuleOfThirds(camera, subject, position = 'center') {
    const offset = {
      left: { x: -10, y: 0 },
      right: { x: 10, y: 0 },
      top: { x: 0, y: 10 },
      bottom: { x: 0, y: -10 },
      center: { x: 0, y: 0 },
    };

    const adjustment = offset[position] || offset.center;

    return {
      ...camera,
      lookAt: {
        x: subject.position.x + adjustment.x,
        y: subject.position.y + adjustment.y,
        z: subject.position.z,
      },
    };
  }
}

module.exports = CameraTracker;
