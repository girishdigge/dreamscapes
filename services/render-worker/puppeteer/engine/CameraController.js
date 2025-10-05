/**
 * CameraController - Cinematic camera control and shot management
 * Implements orbital, flythrough, establish, close-up, and pull-back shots
 */

class CameraController {
  constructor(camera, scene = null) {
    this.camera = camera;
    this.scene = scene;
    this.shots = [];
    this.currentShotIndex = -1;
    this.defaultDistance = 100;
    this.defaultTarget = { x: 0, y: 0, z: 0 };
    this.useDefaultOrbital = false;

    // Store initial camera position for reference
    this.initialPosition = {
      x: camera.position.x,
      y: camera.position.y,
      z: camera.position.z,
    };
  }

  /**
   * Set up camera shot sequence
   * @param {Array} shots - Array of shot specifications
   */
  setupShots(shots) {
    if (!shots || shots.length === 0) {
      console.log('No cinematography specified, using default orbital view');
      this.useDefaultOrbital = true;
      this.shots = [];
      this.currentShotIndex = -1;
      return;
    }

    this.shots = shots;
    this.currentShotIndex = -1;
    this.useDefaultOrbital = false;

    // Sort shots by startTime to ensure proper ordering
    this.shots.sort((a, b) => (a.startTime || 0) - (b.startTime || 0));

    console.log(`CameraController: ${this.shots.length} shots configured`);
  }

  /**
   * Update camera position for current time
   * @param {number} time - Current time in seconds
   */
  update(time) {
    // If no cinematography specified, use default orbital view
    if (this.useDefaultOrbital) {
      this._applyDefaultOrbital(time);
      return;
    }

    // If no shots configured, do nothing
    if (!this.shots || this.shots.length === 0) {
      return;
    }

    // Find the current shot based on time
    const currentShot = this._getCurrentShot(time);

    if (!currentShot) {
      // No active shot, use default position
      this._applyDefaultOrbital(time);
      return;
    }

    // Calculate local time within the shot
    const shotStartTime = currentShot.startTime || 0;
    const shotDuration = currentShot.duration || 10;
    const localTime = time - shotStartTime;
    const progress = Math.min(1.0, localTime / shotDuration);

    // Apply the appropriate shot type
    this._applyShot(currentShot, progress, time);
  }

  /**
   * Get the current shot for the given time
   * @private
   * @param {number} time - Current time in seconds
   * @returns {Object|null} Current shot or null
   */
  _getCurrentShot(time) {
    for (let i = 0; i < this.shots.length; i++) {
      const shot = this.shots[i];
      const startTime = shot.startTime || 0;
      const duration = shot.duration || 10;
      const endTime = startTime + duration;

      if (time >= startTime && time < endTime) {
        return shot;
      }
    }
    return null;
  }

  /**
   * Apply the appropriate shot based on type
   * @private
   * @param {Object} shot - Shot specification
   * @param {number} progress - Progress through shot (0-1)
   * @param {number} time - Current time in seconds
   */
  _applyShot(shot, progress, time) {
    const shotType = shot.type || 'orbital';

    switch (shotType) {
      case 'orbital':
        this.applyOrbitalShot(time, shot);
        break;
      case 'flythrough':
        this.applyFlythroughShot(progress, shot);
        break;
      case 'establish':
        this.applyEstablishShot(progress, shot);
        break;
      case 'close_up':
        this.applyCloseUpShot(progress, shot);
        break;
      case 'pull_back':
        this.applyPullBackShot(progress, shot);
        break;
      default:
        console.warn(`Unknown shot type: ${shotType}, using orbital`);
        this.applyOrbitalShot(time, shot);
    }
  }

  /**
   * Apply default orbital camera movement
   * @private
   * @param {number} time - Current time in seconds
   */
  _applyDefaultOrbital(time) {
    const angle = time * 0.2; // Slow rotation
    const distance = this.defaultDistance;

    this.camera.position.x = Math.cos(angle) * distance;
    this.camera.position.z = Math.sin(angle) * distance;
    this.camera.position.y = distance * 0.5;

    this.lookAt(this.defaultTarget);
  }

  /**
   * Apply orbital shot (circle around target)
   * @param {number} time - Current time in seconds
   * @param {Object} params - Shot parameters
   */
  applyOrbitalShot(time, params) {
    const target = this._resolveTarget(params.target);
    const distance = params.distance || 50;
    const speed = params.speed || 1.0;
    const height = params.height || distance * 0.5;

    // Calculate angle based on time and speed
    const angle = time * speed * 0.5;

    // Position camera in circular orbit
    this.camera.position.x = target.x + Math.cos(angle) * distance;
    this.camera.position.z = target.z + Math.sin(angle) * distance;
    this.camera.position.y = target.y + height;

    // Look at target
    this.lookAt(target);
  }

  /**
   * Apply flythrough shot (move along path)
   * @param {number} progress - Progress through shot (0-1)
   * @param {Object} params - Shot parameters
   */
  applyFlythroughShot(progress, params) {
    const target = this._resolveTarget(params.target);

    // Define path points (can be customized via params.path)
    const path = params.path || [
      { x: -100, y: 50, z: -100 },
      { x: 0, y: 30, z: 0 },
      { x: 100, y: 50, z: 100 },
    ];

    // Find current segment based on progress
    const totalSegments = path.length - 1;
    const segmentProgress = progress * totalSegments;
    const segmentIndex = Math.floor(segmentProgress);
    const localProgress = segmentProgress - segmentIndex;

    // Get start and end points for current segment
    const startPoint = path[Math.min(segmentIndex, path.length - 1)];
    const endPoint = path[Math.min(segmentIndex + 1, path.length - 1)];

    // Interpolate position with easing
    const easedProgress = this._easeInOutCubic(localProgress);
    const position = this.interpolatePosition(
      startPoint,
      endPoint,
      easedProgress
    );

    // Set camera position
    this.camera.position.set(position.x, position.y, position.z);

    // Look at target
    this.lookAt(target);
  }

  /**
   * Apply establish shot (static wide view)
   * @param {number} progress - Progress through shot (0-1)
   * @param {Object} params - Shot parameters
   */
  applyEstablishShot(progress, params) {
    const target = this._resolveTarget(params.target);
    const distance = params.distance || 150;
    const angle = params.angle || 0.785; // 45 degrees default
    const height = params.height || distance * 0.6;

    // Static wide angle position
    this.camera.position.x = target.x + Math.cos(angle) * distance;
    this.camera.position.z = target.z + Math.sin(angle) * distance;
    this.camera.position.y = target.y + height;

    // Look at target
    this.lookAt(target);
  }

  /**
   * Apply close-up shot (focus on object)
   * @param {number} progress - Progress through shot (0-1)
   * @param {Object} params - Shot parameters
   */
  applyCloseUpShot(progress, params) {
    const target = this._resolveTarget(params.target);
    const distance = params.distance || 15;
    const angle = params.angle || 0;
    const heightOffset = params.heightOffset || 5;

    // Close position near target
    this.camera.position.x = target.x + Math.cos(angle) * distance;
    this.camera.position.z = target.z + Math.sin(angle) * distance;
    this.camera.position.y = target.y + heightOffset;

    // Look at target
    this.lookAt(target);
  }

  /**
   * Apply pull-back shot (zoom out reveal)
   * @param {number} progress - Progress through shot (0-1)
   * @param {Object} params - Shot parameters
   */
  applyPullBackShot(progress, params) {
    const target = this._resolveTarget(params.target);
    const startDistance = params.startDistance || 10;
    const endDistance = params.endDistance || 100;
    const angle = params.angle || 0.785;

    // Interpolate distance with easing
    const easedProgress = this._easeOutCubic(progress);
    const distance =
      startDistance + (endDistance - startDistance) * easedProgress;
    const height = distance * 0.5;

    // Position camera at interpolated distance
    this.camera.position.x = target.x + Math.cos(angle) * distance;
    this.camera.position.z = target.z + Math.sin(angle) * distance;
    this.camera.position.y = target.y + height;

    // Look at target
    this.lookAt(target);
  }

  /**
   * Smoothly interpolate between two positions
   * @param {Object} start - Start position {x, y, z}
   * @param {Object} end - End position {x, y, z}
   * @param {number} t - Interpolation factor (0-1)
   * @returns {Object} - Interpolated position
   */
  interpolatePosition(start, end, t) {
    // Clamp t to [0, 1]
    t = Math.max(0, Math.min(1, t));

    return {
      x: start.x + (end.x - start.x) * t,
      y: start.y + (end.y - start.y) * t,
      z: start.z + (end.z - start.z) * t,
    };
  }

  /**
   * Point camera at target
   * @param {Array|Object} target - Target position [x,y,z] or {x,y,z}
   */
  lookAt(target) {
    const targetPos = this._resolveTarget(target);

    if (this.camera && this.camera.lookAt) {
      this.camera.lookAt(targetPos.x, targetPos.y, targetPos.z);
    }
  }

  /**
   * Resolve target to a position object
   * @private
   * @param {Array|Object|string} target - Target as array, object, or structure ID
   * @returns {Object} Position {x, y, z}
   */
  _resolveTarget(target) {
    // If no target specified, use default
    if (!target) {
      return this.defaultTarget;
    }

    // If target is an array [x, y, z]
    if (Array.isArray(target)) {
      return {
        x: target[0] || 0,
        y: target[1] || 0,
        z: target[2] || 0,
      };
    }

    // If target is already an object {x, y, z}
    if (typeof target === 'object' && target.x !== undefined) {
      return {
        x: target.x || 0,
        y: target.y || 0,
        z: target.z || 0,
      };
    }

    // If target is a structure ID (string), try to find it in the scene
    if (typeof target === 'string' && this.scene) {
      const object = this.scene.getObjectByName(target);
      if (object) {
        return {
          x: object.position.x,
          y: object.position.y,
          z: object.position.z,
        };
      }
      console.warn(`Target structure "${target}" not found, using default`);
    }

    // Fallback to default target
    return this.defaultTarget;
  }

  /**
   * Ease-in-out cubic easing function
   * @private
   * @param {number} t - Input value (0-1)
   * @returns {number} Eased value (0-1)
   */
  _easeInOutCubic(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  /**
   * Ease-out cubic easing function
   * @private
   * @param {number} t - Input value (0-1)
   * @returns {number} Eased value (0-1)
   */
  _easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
  }

  /**
   * Ease-in cubic easing function
   * @private
   * @param {number} t - Input value (0-1)
   * @returns {number} Eased value (0-1)
   */
  _easeInCubic(t) {
    return t * t * t;
  }

  /**
   * Linear easing (no easing)
   * @private
   * @param {number} t - Input value (0-1)
   * @returns {number} Same value (0-1)
   */
  _linear(t) {
    return t;
  }

  /**
   * Apply easing function based on name
   * @private
   * @param {number} t - Input value (0-1)
   * @param {string} easingType - Easing type name
   * @returns {number} Eased value (0-1)
   */
  _applyEasing(t, easingType) {
    switch (easingType) {
      case 'ease_in':
        return this._easeInCubic(t);
      case 'ease_out':
        return this._easeOutCubic(t);
      case 'ease_in_out':
        return this._easeInOutCubic(t);
      case 'linear':
      default:
        return this._linear(t);
    }
  }

  /**
   * Clear all shots
   */
  clear() {
    this.shots = [];
    this.currentShotIndex = -1;
  }
}

// Export for browser environment
if (typeof window !== 'undefined') {
  window.CameraController = CameraController;
}
