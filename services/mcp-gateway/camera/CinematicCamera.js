/**
 * Cinematic Camera
 * Main class for cinematic camera control
 */

const ShotSequencer = require('./ShotSequencer');
const CameraTracker = require('./CameraTracker');
const CompositionEngine = require('./CompositionEngine');

class CinematicCamera {
  constructor() {
    this.sequencer = new ShotSequencer();
    this.tracker = new CameraTracker();
    this.composer = new CompositionEngine();
  }

  /**
   * Generate complete camera sequence for scene
   * @param {Object} sceneData - Scene data
   * @param {number} duration - Scene duration
   * @returns {Object} - Complete camera sequence
   */
  generateCameraSequence(sceneData, duration = 30) {
    // Generate shot sequence
    const shotSequence = this.sequencer.generateSequence(sceneData, duration);

    // Enrich each shot with camera data
    shotSequence.shots = shotSequence.shots.map((shot) => {
      return this.enrichShot(shot, sceneData);
    });

    return {
      ...shotSequence,
      metadata: {
        generatedAt: new Date().toISOString(),
        sceneType: this.determineSceneType(sceneData),
        totalShots: shotSequence.shots.length,
      },
    };
  }

  /**
   * Enrich shot with detailed camera data
   * @param {Object} shot - Basic shot data
   * @param {Object} sceneData - Scene data
   * @returns {Object} - Enriched shot
   */
  enrichShot(shot, sceneData) {
    const enriched = { ...shot };

    // Add camera position and orientation
    switch (shot.type) {
      case 'establishing':
        enriched.camera = this.generateEstablishingCamera(shot, sceneData);
        break;

      case 'tracking':
        enriched.camera = this.generateTrackingCamera(shot, sceneData);
        break;

      case 'close_up':
        enriched.camera = this.generateCloseUpCamera(shot, sceneData);
        break;

      case 'pull_back':
        enriched.camera = this.generatePullBackCamera(shot, sceneData);
        break;

      case 'pan':
        enriched.camera = this.generatePanCamera(shot, sceneData);
        break;

      default:
        enriched.camera = this.generateDefaultCamera(shot, sceneData);
    }

    // Apply composition rules
    const subjects = this.getSubjectsForShot(shot, sceneData);
    enriched.camera = this.composer.applyComposition(
      enriched.camera,
      subjects,
      { rule: this.getCompositionRule(shot) }
    );

    // Add easing for transitions
    enriched.easing = this.getEasingFunction(shot);

    return enriched;
  }

  /**
   * Generate establishing shot camera
   * @param {Object} shot - Shot data
   * @param {Object} sceneData - Scene data
   * @returns {Object} - Camera state
   */
  generateEstablishingCamera(shot, sceneData) {
    const target = shot.target || { x: 0, y: 0, z: 0 };
    const distance = shot.distance || 100;
    const angle = shot.angle === 'wide' ? 1.2 : 1.0;

    return {
      position: {
        x: target.x,
        y: target.y + distance * 0.4,
        z: target.z + distance * angle,
      },
      lookAt: target,
      fov: 60,
      type: 'establishing',
    };
  }

  /**
   * Generate tracking shot camera
   * @param {Object} shot - Shot data
   * @param {Object} sceneData - Scene data
   * @returns {Object} - Camera state
   */
  generateTrackingCamera(shot, sceneData) {
    const entity = shot.target || sceneData.entities?.[0];
    const entityPos = entity?.position || { x: 0, y: 0, z: 0 };
    const distance = shot.distance || 30;

    // Use tracker to calculate position
    const motion = sceneData.animations?.find((a) => a.entity === entity);

    return {
      position: {
        x: entityPos.x,
        y: entityPos.y + distance * 0.3,
        z: entityPos.z + distance,
      },
      lookAt: entityPos,
      fov: 50,
      type: 'tracking',
      trackingMode: shot.mode || 'follow',
      trackingEntity: entity,
    };
  }

  /**
   * Generate close-up shot camera
   * @param {Object} shot - Shot data
   * @param {Object} sceneData - Scene data
   * @returns {Object} - Camera state
   */
  generateCloseUpCamera(shot, sceneData) {
    const entity = shot.target || sceneData.entities?.[0];
    const entityPos = entity?.position || { x: 0, y: 0, z: 0 };
    const distance = shot.distance || 15;

    return {
      position: {
        x: entityPos.x + distance * 0.5,
        y: entityPos.y + distance * 0.3,
        z: entityPos.z + distance * 0.8,
      },
      lookAt: entityPos,
      fov: 35,
      type: 'close_up',
      depthOfField: {
        enabled: true,
        focusDistance: distance,
        aperture: 2.8,
      },
    };
  }

  /**
   * Generate pull-back shot camera
   * @param {Object} shot - Shot data
   * @param {Object} sceneData - Scene data
   * @returns {Object} - Camera state
   */
  generatePullBackCamera(shot, sceneData) {
    const target = shot.target || { x: 0, y: 0, z: 0 };
    const startDistance = shot.startDistance || 20;
    const endDistance = shot.endDistance || 100;

    return {
      startPosition: {
        x: target.x,
        y: target.y + startDistance * 0.3,
        z: target.z + startDistance,
      },
      endPosition: {
        x: target.x,
        y: target.y + endDistance * 0.4,
        z: target.z + endDistance,
      },
      lookAt: target,
      fov: 50,
      type: 'pull_back',
      animated: true,
    };
  }

  /**
   * Generate pan shot camera
   * @param {Object} shot - Shot data
   * @param {Object} sceneData - Scene data
   * @returns {Object} - Camera state
   */
  generatePanCamera(shot, sceneData) {
    const target = shot.target || { x: 0, y: 0, z: 0 };
    const distance = shot.distance || 50;

    return {
      position: {
        x: target.x - distance,
        y: target.y + distance * 0.3,
        z: target.z,
      },
      endPosition: {
        x: target.x + distance,
        y: target.y + distance * 0.3,
        z: target.z,
      },
      lookAt: target,
      fov: 55,
      type: 'pan',
      animated: true,
    };
  }

  /**
   * Generate default camera
   * @param {Object} shot - Shot data
   * @param {Object} sceneData - Scene data
   * @returns {Object} - Camera state
   */
  generateDefaultCamera(shot, sceneData) {
    return {
      position: { x: 0, y: 50, z: 100 },
      lookAt: { x: 0, y: 0, z: 0 },
      fov: 50,
      type: 'default',
    };
  }

  /**
   * Get subjects for shot
   * @param {Object} shot - Shot data
   * @param {Object} sceneData - Scene data
   * @returns {Array} - Array of subjects
   */
  getSubjectsForShot(shot, sceneData) {
    if (
      shot.target &&
      typeof shot.target === 'object' &&
      shot.target.position
    ) {
      return [shot.target];
    }

    return sceneData.entities || [];
  }

  /**
   * Get composition rule for shot
   * @param {Object} shot - Shot data
   * @returns {string} - Composition rule
   */
  getCompositionRule(shot) {
    switch (shot.type) {
      case 'establishing':
        return 'center';
      case 'tracking':
        return 'thirds';
      case 'close_up':
        return 'golden';
      case 'pull_back':
        return 'center';
      default:
        return 'thirds';
    }
  }

  /**
   * Get easing function for shot
   * @param {Object} shot - Shot data
   * @returns {string} - Easing function name
   */
  getEasingFunction(shot) {
    const easingMap = {
      smooth: 'ease-in-out',
      cut: 'linear',
      ease_out: 'ease-out',
      ease_in: 'ease-in',
    };

    return easingMap[shot.transition] || 'ease-in-out';
  }

  /**
   * Determine scene type
   * @param {Object} sceneData - Scene data
   * @returns {Object} - Scene type info
   */
  determineSceneType(sceneData) {
    const hasMotion = sceneData.animations && sceneData.animations.length > 0;
    const hasEvents = sceneData.events && sceneData.events.length > 0;
    const hasHighIntensity = sceneData.verbs?.some(
      (v) => v.intensity === 'high'
    );

    return {
      isStatic: !hasMotion && !hasEvents,
      isAction: hasHighIntensity || hasEvents,
      isDramatic: hasEvents,
      hasMotion,
      hasEvents,
    };
  }

  /**
   * Get camera at specific time
   * @param {Object} sequence - Camera sequence
   * @param {number} time - Time in seconds
   * @returns {Object|null} - Camera state at time
   */
  getCameraAtTime(sequence, time) {
    const shot = this.sequencer.getShotAtTime(sequence, time);

    if (!shot) return null;

    // If animated shot, interpolate
    if (shot.camera.animated) {
      const shotProgress = (time - shot.startTime) / shot.duration;
      return this.interpolateCamera(shot.camera, shotProgress);
    }

    return shot.camera;
  }

  /**
   * Interpolate camera for animated shots
   * @param {Object} camera - Camera with start/end positions
   * @param {number} progress - Progress (0-1)
   * @returns {Object} - Interpolated camera
   */
  interpolateCamera(camera, progress) {
    if (!camera.endPosition) {
      return camera;
    }

    const eased = this.applyEasing(progress, 'ease-in-out');

    return {
      ...camera,
      position: {
        x:
          camera.position.x +
          (camera.endPosition.x - camera.position.x) * eased,
        y:
          camera.position.y +
          (camera.endPosition.y - camera.position.y) * eased,
        z:
          camera.position.z +
          (camera.endPosition.z - camera.position.z) * eased,
      },
    };
  }

  /**
   * Apply easing function
   * @param {number} t - Progress (0-1)
   * @param {string} easing - Easing function name
   * @returns {number} - Eased value
   */
  applyEasing(t, easing) {
    switch (easing) {
      case 'ease-in':
        return t * t;
      case 'ease-out':
        return t * (2 - t);
      case 'ease-in-out':
        return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
      default:
        return t;
    }
  }

  /**
   * Get sequence statistics
   * @param {Object} sequence - Camera sequence
   * @returns {Object} - Statistics
   */
  getStatistics(sequence) {
    return this.sequencer.getStatistics(sequence);
  }
}

module.exports = CinematicCamera;
