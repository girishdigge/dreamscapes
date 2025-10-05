/**
 * AnimationController - Object animation and particle system updates
 * Handles orbit, float, pulse, rotate animations and particle physics
 */

class AnimationController {
  constructor() {
    this.animations = new Map();
  }

  /**
   * Register an animation for an object
   * @param {string} objectId - Object identifier
   * @param {Object} animationSpec - Animation specification
   */
  addAnimation(objectId, animationSpec) {
    this.animations.set(objectId, animationSpec);
  }

  /**
   * Remove animation for an object
   * @param {string} objectId - Object identifier
   */
  removeAnimation(objectId) {
    this.animations.delete(objectId);
  }

  /**
   * Update all animations for current time
   * @param {number} time - Current time in seconds
   * @param {Map} renderObjects - Map of object IDs to render objects
   */
  update(time, renderObjects) {
    // Process all registered animations
    for (const [objectId, animSpec] of this.animations) {
      const renderObj = renderObjects.get(objectId);
      if (!renderObj || !renderObj.mesh) continue;

      const mesh = renderObj.mesh;
      const animType = animSpec.type;
      const params = {
        speed: animSpec.speed || 1.0,
        amplitude: animSpec.amplitude || 1.0,
        axis: animSpec.axis || 'y',
        ...animSpec,
      };

      // Apply animation based on type
      switch (animType) {
        case 'orbit':
          this.applyOrbitAnimation(mesh, time, params);
          break;
        case 'float':
          this.applyFloatAnimation(mesh, time, params);
          break;
        case 'pulse':
          this.applyPulseAnimation(mesh, time, params);
          break;
        case 'rotate':
          this.applyRotateAnimation(mesh, time, params);
          break;
        default:
          console.warn(`Unknown animation type: ${animType}`);
      }
    }

    // Update particle systems
    for (const [objectId, renderObj] of renderObjects) {
      if (renderObj.type === 'entity' && renderObj.particleSystem) {
        this.updateParticleSystem(
          renderObj.particleSystem,
          time,
          renderObj.entity
        );
      }
    }
  }

  /**
   * Apply orbit animation (circular motion around center)
   * @param {THREE.Object3D} object - Object to animate
   * @param {number} time - Current time
   * @param {Object} params - Animation parameters
   */
  applyOrbitAnimation(object, time, params) {
    const speed = params.speed || 1.0;
    const radius = params.amplitude || 10.0;
    const angle = time * speed;

    // Store original position if not already stored
    if (!object.userData.originalPosition) {
      object.userData.originalPosition = {
        x: object.position.x,
        y: object.position.y,
        z: object.position.z,
      };
    }

    const center = object.userData.originalPosition;

    // Circular motion in XZ plane
    object.position.x = center.x + Math.cos(angle) * radius;
    object.position.z = center.z + Math.sin(angle) * radius;
    object.position.y = center.y;
  }

  /**
   * Apply float animation (sine wave vertical movement)
   * @param {THREE.Object3D} object - Object to animate
   * @param {number} time - Current time
   * @param {Object} params - Animation parameters
   */
  applyFloatAnimation(object, time, params) {
    const speed = params.speed || 1.0;
    const amplitude = params.amplitude || 2.0;

    // Store original position if not already stored
    if (!object.userData.originalPosition) {
      object.userData.originalPosition = {
        x: object.position.x,
        y: object.position.y,
        z: object.position.z,
      };
    }

    const center = object.userData.originalPosition;

    // Sine wave vertical movement
    const offset = Math.sin(time * speed) * amplitude;
    object.position.y = center.y + offset;
  }

  /**
   * Apply pulse animation (scale in/out rhythmically)
   * @param {THREE.Object3D} object - Object to animate
   * @param {number} time - Current time
   * @param {Object} params - Animation parameters
   */
  applyPulseAnimation(object, time, params) {
    const speed = params.speed || 1.0;
    const amplitude = params.amplitude || 0.2;

    // Store original scale if not already stored
    if (!object.userData.originalScale) {
      object.userData.originalScale = {
        x: object.scale.x,
        y: object.scale.y,
        z: object.scale.z,
      };
    }

    const baseScale = object.userData.originalScale;

    // Rhythmic scale pulsing
    const scaleFactor = 1.0 + Math.sin(time * speed) * amplitude;
    object.scale.x = baseScale.x * scaleFactor;
    object.scale.y = baseScale.y * scaleFactor;
    object.scale.z = baseScale.z * scaleFactor;
  }

  /**
   * Apply rotate animation (spin around own axis)
   * @param {THREE.Object3D} object - Object to animate
   * @param {number} time - Current time
   * @param {Object} params - Animation parameters
   */
  applyRotateAnimation(object, time, params) {
    const speed = params.speed || 1.0;
    const axis = params.axis || 'y';

    // Continuous rotation around specified axis
    const angle = time * speed;

    switch (axis) {
      case 'x':
        object.rotation.x = angle;
        break;
      case 'y':
        object.rotation.y = angle;
        break;
      case 'z':
        object.rotation.z = angle;
        break;
      default:
        object.rotation.y = angle;
    }
  }

  /**
   * Update particle system positions and physics
   * @param {THREE.Points} particleSystem - Particle system to update
   * @param {number} time - Current time
   * @param {Object} entitySpec - Entity specification with params
   */
  updateParticleSystem(particleSystem, time, entitySpec) {
    if (!particleSystem || !particleSystem.geometry) return;

    const positions = particleSystem.geometry.attributes.position;
    if (!positions) return;

    const params = entitySpec.params || {};
    const speed = params.speed || 1.0;
    const maxDistance = params.maxDistance || 100.0;
    const gravity = params.gravity || 0.0;
    const drag = params.drag || 0.0;

    // Initialize velocities if not already done
    if (!particleSystem.userData.velocities) {
      particleSystem.userData.velocities = [];
      for (let i = 0; i < positions.count; i++) {
        particleSystem.userData.velocities.push({
          x: (Math.random() - 0.5) * speed,
          y: (Math.random() - 0.5) * speed,
          z: (Math.random() - 0.5) * speed,
        });
      }
    }

    // Store origin if not already stored
    if (!particleSystem.userData.origin) {
      particleSystem.userData.origin = {
        x: particleSystem.position.x,
        y: particleSystem.position.y,
        z: particleSystem.position.z,
      };
    }

    const velocities = particleSystem.userData.velocities;
    const origin = particleSystem.userData.origin;
    const deltaTime = 0.016; // Approximate frame time for smooth animation

    // Update each particle
    for (let i = 0; i < positions.count; i++) {
      const idx = i * 3;

      // Get current position
      let x = positions.array[idx];
      let y = positions.array[idx + 1];
      let z = positions.array[idx + 2];

      // Apply velocity
      x += velocities[i].x * deltaTime;
      y += velocities[i].y * deltaTime;
      z += velocities[i].z * deltaTime;

      // Apply gravity
      velocities[i].y -= gravity * deltaTime;

      // Apply drag
      if (drag > 0) {
        velocities[i].x *= 1.0 - drag * deltaTime;
        velocities[i].y *= 1.0 - drag * deltaTime;
        velocities[i].z *= 1.0 - drag * deltaTime;
      }

      // Check distance from origin
      const dx = x - origin.x;
      const dy = y - origin.y;
      const dz = z - origin.z;
      const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);

      // Reset particle if it exceeds max distance
      if (distance > maxDistance) {
        x = origin.x + (Math.random() - 0.5) * 2;
        y = origin.y + (Math.random() - 0.5) * 2;
        z = origin.z + (Math.random() - 0.5) * 2;

        // Reset velocity
        velocities[i].x = (Math.random() - 0.5) * speed;
        velocities[i].y = (Math.random() - 0.5) * speed;
        velocities[i].z = (Math.random() - 0.5) * speed;
      }

      // Update position
      positions.array[idx] = x;
      positions.array[idx + 1] = y;
      positions.array[idx + 2] = z;
    }

    // Mark positions as needing update
    positions.needsUpdate = true;
  }

  /**
   * Clear all animations
   */
  clear() {
    this.animations.clear();
  }
}

// Export for browser environment
if (typeof window !== 'undefined') {
  window.AnimationController = AnimationController;
}
