/**
 * Shot Sequencer
 * Plans and sequences camera shots for cinematic storytelling
 */

class ShotSequencer {
  constructor() {
    this.defaultDuration = 30; // seconds
    this.minShotDuration = 2; // minimum shot length
    this.maxShotDuration = 8; // maximum shot length
  }

  /**
   * Generate shot sequence for a scene
   * @param {Object} sceneData - Scene data with entities, events, motion
   * @param {number} duration - Scene duration in seconds
   * @returns {Object} - Shot sequence
   */
  generateSequence(sceneData, duration = this.defaultDuration) {
    const sequence = {
      duration,
      shots: [],
      acts: this.defineActs(duration),
    };

    // Analyze scene characteristics
    const characteristics = this.analyzeScene(sceneData);

    // Generate shots based on scene type
    if (characteristics.isStatic) {
      sequence.shots = this.generateStaticSequence(
        sceneData,
        duration,
        characteristics
      );
    } else if (characteristics.hasHighAction) {
      sequence.shots = this.generateActionSequence(
        sceneData,
        duration,
        characteristics
      );
    } else {
      sequence.shots = this.generateStandardSequence(
        sceneData,
        duration,
        characteristics
      );
    }

    // Ensure shots fill the duration
    sequence.shots = this.normalizeShotDurations(sequence.shots, duration);

    // Add transitions
    sequence.shots = this.addTransitions(sequence.shots);

    return sequence;
  }

  /**
   * Define three-act structure
   * @param {number} duration - Total duration
   * @returns {Object} - Act definitions
   */
  defineActs(duration) {
    return {
      act1: {
        start: 0,
        end: duration * 0.25,
        description: 'Establishment',
        style: 'wide, slow',
      },
      act2: {
        start: duration * 0.25,
        end: duration * 0.75,
        description: 'Action',
        style: 'dynamic, varied',
      },
      act3: {
        start: duration * 0.75,
        end: duration,
        description: 'Resolution',
        style: 'pull back, reveal',
      },
    };
  }

  /**
   * Analyze scene characteristics
   * @param {Object} sceneData - Scene data
   * @returns {Object} - Scene characteristics
   */
  analyzeScene(sceneData) {
    const hasMotion = sceneData.animations && sceneData.animations.length > 0;
    const hasEvents = sceneData.events && sceneData.events.length > 0;
    const entityCount = sceneData.entities ? sceneData.entities.length : 0;
    const hasHighIntensity = sceneData.verbs?.some(
      (v) => v.intensity === 'high'
    );

    return {
      isStatic: !hasMotion && !hasEvents,
      hasHighAction: hasHighIntensity || hasEvents,
      hasMotion,
      hasEvents,
      entityCount,
      complexity: entityCount > 3 ? 'complex' : 'simple',
    };
  }

  /**
   * Generate sequence for static scenes
   * @param {Object} sceneData - Scene data
   * @param {number} duration - Duration
   * @param {Object} characteristics - Scene characteristics
   * @returns {Array} - Array of shots
   */
  generateStaticSequence(sceneData, duration, characteristics) {
    const shots = [];

    // Establishing shot
    shots.push({
      type: 'establishing',
      startTime: 0,
      duration: duration * 0.4,
      distance: 100,
      angle: 'wide',
      target: this.getSceneCenter(sceneData),
      movement: 'slow_orbit',
    });

    // Detail shots
    if (sceneData.entities && sceneData.entities.length > 0) {
      shots.push({
        type: 'close_up',
        startTime: duration * 0.4,
        duration: duration * 0.3,
        distance: 15,
        target: sceneData.entities[0],
        movement: 'slow_push',
      });
    }

    // Final reveal
    shots.push({
      type: 'pull_back',
      startTime: duration * 0.7,
      duration: duration * 0.3,
      startDistance: 15,
      endDistance: 120,
      target: this.getSceneCenter(sceneData),
      movement: 'smooth_pull',
    });

    return shots;
  }

  /**
   * Generate sequence for action scenes
   * @param {Object} sceneData - Scene data
   * @param {number} duration - Duration
   * @param {Object} characteristics - Scene characteristics
   * @returns {Array} - Array of shots
   */
  generateActionSequence(sceneData, duration, characteristics) {
    const shots = [];

    // Quick establishing shot
    shots.push({
      type: 'establishing',
      startTime: 0,
      duration: Math.min(4, duration * 0.15),
      distance: 80,
      angle: 'wide',
      target: this.getSceneCenter(sceneData),
      movement: 'static',
    });

    let currentTime =
      shots[shots.length - 1].startTime + shots[shots.length - 1].duration;

    // Action shots
    const actionDuration = duration * 0.7;
    const numActionShots = Math.floor(actionDuration / 3);

    for (let i = 0; i < numActionShots; i++) {
      const shotDuration = 3;

      if (i % 2 === 0) {
        // Tracking shot
        shots.push({
          type: 'tracking',
          startTime: currentTime,
          duration: shotDuration,
          target: sceneData.entities?.[0],
          distance: 25,
          mode: 'follow',
          movement: 'dynamic',
        });
      } else {
        // Close-up on action
        shots.push({
          type: 'close_up',
          startTime: currentTime,
          duration: shotDuration,
          target: sceneData.entities?.[i % sceneData.entities.length],
          distance: 12,
          movement: 'shake',
        });
      }

      currentTime += shotDuration;
    }

    // Final reveal
    shots.push({
      type: 'pull_back',
      startTime: currentTime,
      duration: duration - currentTime,
      startDistance: 20,
      endDistance: 100,
      target: this.getSceneCenter(sceneData),
      movement: 'smooth_pull',
    });

    return shots;
  }

  /**
   * Generate standard sequence
   * @param {Object} sceneData - Scene data
   * @param {number} duration - Duration
   * @param {Object} characteristics - Scene characteristics
   * @returns {Array} - Array of shots
   */
  generateStandardSequence(sceneData, duration, characteristics) {
    const shots = [];

    // Act 1: Establishing
    shots.push({
      type: 'establishing',
      startTime: 0,
      duration: duration * 0.25,
      distance: 90,
      angle: 'wide',
      target: this.getSceneCenter(sceneData),
      movement: 'slow_orbit',
    });

    // Act 2: Action/Motion
    const act2Start = duration * 0.25;
    const act2Duration = duration * 0.5;

    if (sceneData.animations && sceneData.animations.length > 0) {
      // Tracking shot
      shots.push({
        type: 'tracking',
        startTime: act2Start,
        duration: act2Duration * 0.6,
        target: sceneData.entities?.[0],
        distance: 30,
        mode: 'follow',
        movement: 'smooth',
      });

      // Close-up
      shots.push({
        type: 'close_up',
        startTime: act2Start + act2Duration * 0.6,
        duration: act2Duration * 0.4,
        target: sceneData.entities?.[0],
        distance: 15,
        movement: 'static',
      });
    } else {
      // Slow pan
      shots.push({
        type: 'pan',
        startTime: act2Start,
        duration: act2Duration,
        distance: 50,
        target: this.getSceneCenter(sceneData),
        movement: 'slow_pan',
      });
    }

    // Act 3: Resolution
    shots.push({
      type: 'pull_back',
      startTime: duration * 0.75,
      duration: duration * 0.25,
      startDistance: 30,
      endDistance: 110,
      target: this.getSceneCenter(sceneData),
      movement: 'smooth_pull',
    });

    return shots;
  }

  /**
   * Normalize shot durations to fill total duration
   * @param {Array} shots - Array of shots
   * @param {number} duration - Total duration
   * @returns {Array} - Normalized shots
   */
  normalizeShotDurations(shots, duration) {
    if (shots.length === 0) return shots;

    const totalShotDuration = shots.reduce(
      (sum, shot) => sum + shot.duration,
      0
    );

    if (Math.abs(totalShotDuration - duration) < 0.1) {
      return shots; // Already correct
    }

    // Scale all durations proportionally
    const scale = duration / totalShotDuration;

    let currentTime = 0;
    return shots.map((shot) => {
      const scaledDuration = shot.duration * scale;
      const normalizedShot = {
        ...shot,
        startTime: currentTime,
        duration: scaledDuration,
      };
      currentTime += scaledDuration;
      return normalizedShot;
    });
  }

  /**
   * Add transitions between shots
   * @param {Array} shots - Array of shots
   * @returns {Array} - Shots with transitions
   */
  addTransitions(shots) {
    return shots.map((shot, index) => {
      if (index === shots.length - 1) {
        return { ...shot, transition: 'none' };
      }

      const nextShot = shots[index + 1];

      // Determine transition type
      let transition = 'cut';

      if (shot.type === 'establishing' && nextShot.type === 'tracking') {
        transition = 'smooth';
      } else if (shot.type === 'tracking' && nextShot.type === 'close_up') {
        transition = 'cut';
      } else if (shot.type === 'close_up' && nextShot.type === 'pull_back') {
        transition = 'smooth';
      } else if (
        shot.movement === 'dynamic' &&
        nextShot.movement === 'static'
      ) {
        transition = 'ease_out';
      }

      return {
        ...shot,
        transition,
        transitionDuration: transition === 'smooth' ? 0.5 : 0,
      };
    });
  }

  /**
   * Get scene center point
   * @param {Object} sceneData - Scene data
   * @returns {Object} - Center position
   */
  getSceneCenter(sceneData) {
    if (!sceneData.entities || sceneData.entities.length === 0) {
      return { x: 0, y: 0, z: 0 };
    }

    // Calculate average position of all entities
    // For now, return origin
    return { x: 0, y: 0, z: 0 };
  }

  /**
   * Get shot at specific time
   * @param {Object} sequence - Shot sequence
   * @param {number} time - Time in seconds
   * @returns {Object|null} - Active shot or null
   */
  getShotAtTime(sequence, time) {
    return (
      sequence.shots.find(
        (shot) =>
          time >= shot.startTime && time < shot.startTime + shot.duration
      ) || null
    );
  }

  /**
   * Get sequence statistics
   * @param {Object} sequence - Shot sequence
   * @returns {Object} - Statistics
   */
  getStatistics(sequence) {
    const shotTypes = {};

    sequence.shots.forEach((shot) => {
      shotTypes[shot.type] = (shotTypes[shot.type] || 0) + 1;
    });

    return {
      totalShots: sequence.shots.length,
      duration: sequence.duration,
      shotTypes,
      averageShotLength: sequence.duration / sequence.shots.length,
      acts: sequence.acts,
    };
  }
}

module.exports = ShotSequencer;
