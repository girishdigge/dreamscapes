/**
 * Composition Engine
 * Implements cinematic composition rules and framing
 */

class CompositionEngine {
  constructor() {
    this.goldenRatio = 1.618;
  }

  /**
   * Apply composition rules to camera
   * @param {Object} camera - Camera state
   * @param {Array} subjects - Subjects in frame
   * @param {Object} options - Composition options
   * @returns {Object} - Adjusted camera state
   */
  applyComposition(camera, subjects, options = {}) {
    const { rule = 'thirds', balance = true, negativeSpace = true } = options;

    let adjustedCamera = { ...camera };

    // Apply primary composition rule
    switch (rule) {
      case 'thirds':
        adjustedCamera = this.applyRuleOfThirds(adjustedCamera, subjects);
        break;

      case 'golden':
        adjustedCamera = this.applyGoldenRatio(adjustedCamera, subjects);
        break;

      case 'center':
        adjustedCamera = this.applyCenterComposition(adjustedCamera, subjects);
        break;

      case 'symmetry':
        adjustedCamera = this.applySymmetry(adjustedCamera, subjects);
        break;
    }

    // Apply balance if requested
    if (balance) {
      adjustedCamera = this.balanceFrame(adjustedCamera, subjects);
    }

    // Manage negative space
    if (negativeSpace) {
      adjustedCamera = this.manageNegativeSpace(adjustedCamera, subjects);
    }

    return adjustedCamera;
  }

  /**
   * Apply rule of thirds
   * @param {Object} camera - Camera state
   * @param {Array} subjects - Subjects in frame
   * @returns {Object} - Adjusted camera
   */
  applyRuleOfThirds(camera, subjects) {
    if (subjects.length === 0) return camera;

    const primarySubject = subjects[0];
    const subjectPos = primarySubject.position || { x: 0, y: 0, z: 0 };

    // Position subject at intersection of thirds
    // Left third, upper third is often most pleasing
    const frameWidth = 100; // Arbitrary frame units
    const frameHeight = 60;

    const thirdX = frameWidth / 3;
    const thirdY = frameHeight / 3;

    // Adjust camera to place subject at left-upper third
    const offset = {
      x: -thirdX,
      y: thirdY,
    };

    return {
      ...camera,
      lookAt: {
        x: subjectPos.x + offset.x,
        y: subjectPos.y + offset.y,
        z: subjectPos.z,
      },
      composition: 'rule_of_thirds',
    };
  }

  /**
   * Apply golden ratio composition
   * @param {Object} camera - Camera state
   * @param {Array} subjects - Subjects in frame
   * @returns {Object} - Adjusted camera
   */
  applyGoldenRatio(camera, subjects) {
    if (subjects.length === 0) return camera;

    const primarySubject = subjects[0];
    const subjectPos = primarySubject.position || { x: 0, y: 0, z: 0 };

    // Position at golden ratio point
    const frameWidth = 100;
    const goldenX = frameWidth / this.goldenRatio;

    return {
      ...camera,
      lookAt: {
        x: subjectPos.x - (frameWidth / 2 - goldenX),
        y: subjectPos.y,
        z: subjectPos.z,
      },
      composition: 'golden_ratio',
    };
  }

  /**
   * Apply center composition
   * @param {Object} camera - Camera state
   * @param {Array} subjects - Subjects in frame
   * @returns {Object} - Adjusted camera
   */
  applyCenterComposition(camera, subjects) {
    if (subjects.length === 0) return camera;

    const primarySubject = subjects[0];
    const subjectPos = primarySubject.position || { x: 0, y: 0, z: 0 };

    return {
      ...camera,
      lookAt: subjectPos,
      composition: 'center',
    };
  }

  /**
   * Apply symmetrical composition
   * @param {Object} camera - Camera state
   * @param {Array} subjects - Subjects in frame
   * @returns {Object} - Adjusted camera
   */
  applySymmetry(camera, subjects) {
    if (subjects.length < 2) {
      return this.applyCenterComposition(camera, subjects);
    }

    // Calculate center point between subjects
    const positions = subjects.map((s) => s.position || { x: 0, y: 0, z: 0 });
    const center = {
      x: positions.reduce((sum, p) => sum + p.x, 0) / positions.length,
      y: positions.reduce((sum, p) => sum + p.y, 0) / positions.length,
      z: positions.reduce((sum, p) => sum + p.z, 0) / positions.length,
    };

    return {
      ...camera,
      lookAt: center,
      composition: 'symmetry',
    };
  }

  /**
   * Balance frame composition
   * @param {Object} camera - Camera state
   * @param {Array} subjects - Subjects in frame
   * @returns {Object} - Balanced camera
   */
  balanceFrame(camera, subjects) {
    if (subjects.length <= 1) return camera;

    // Calculate visual weight distribution
    const weights = subjects.map((s) => ({
      position: s.position || { x: 0, y: 0, z: 0 },
      weight: s.size || 1,
    }));

    // Calculate center of mass
    const totalWeight = weights.reduce((sum, w) => sum + w.weight, 0);
    const centerOfMass = {
      x:
        weights.reduce((sum, w) => sum + w.position.x * w.weight, 0) /
        totalWeight,
      y:
        weights.reduce((sum, w) => sum + w.position.y * w.weight, 0) /
        totalWeight,
      z:
        weights.reduce((sum, w) => sum + w.position.z * w.weight, 0) /
        totalWeight,
    };

    // Adjust camera to balance around center of mass
    return {
      ...camera,
      lookAt: centerOfMass,
      balanced: true,
    };
  }

  /**
   * Manage negative space
   * @param {Object} camera - Camera state
   * @param {Array} subjects - Subjects in frame
   * @returns {Object} - Adjusted camera
   */
  manageNegativeSpace(camera, subjects) {
    if (subjects.length === 0) return camera;
    if (!camera.lookAt) return camera;

    // Calculate subject bounds
    const positions = subjects.map((s) => s.position || { x: 0, y: 0, z: 0 });
    const bounds = {
      minX: Math.min(...positions.map((p) => p.x)),
      maxX: Math.max(...positions.map((p) => p.x)),
      minY: Math.min(...positions.map((p) => p.y)),
      maxY: Math.max(...positions.map((p) => p.y)),
    };

    const subjectWidth = bounds.maxX - bounds.minX;
    const subjectHeight = bounds.maxY - bounds.minY;

    // Ensure adequate negative space (breathing room)
    const minNegativeSpace = 1.3; // 30% extra space
    const currentDistance = this.calculateDistance(
      camera.position,
      camera.lookAt
    );
    const requiredDistance =
      Math.max(subjectWidth, subjectHeight) * minNegativeSpace;

    if (currentDistance < requiredDistance) {
      // Move camera back to create more negative space
      if (!camera.position) return camera;

      const direction = this.normalizeVector({
        x: camera.position.x - camera.lookAt.x,
        y: camera.position.y - camera.lookAt.y,
        z: camera.position.z - camera.lookAt.z,
      });

      return {
        ...camera,
        position: {
          x: camera.lookAt.x + direction.x * requiredDistance,
          y: camera.lookAt.y + direction.y * requiredDistance,
          z: camera.lookAt.z + direction.z * requiredDistance,
        },
        negativeSpace: true,
      };
    }

    return camera;
  }

  /**
   * Adjust framing based on action speed
   * @param {Object} camera - Camera state
   * @param {number} actionSpeed - Speed of action (0-1)
   * @returns {Object} - Adjusted camera
   */
  adjustForActionSpeed(camera, actionSpeed) {
    // Fast action = tighter framing
    // Slow action = wider framing

    const baseDistance = this.calculateDistance(camera.position, camera.lookAt);
    const speedFactor = 1 - actionSpeed * 0.3; // Up to 30% closer for fast action

    const direction = this.normalizeVector({
      x: camera.position.x - camera.lookAt.x,
      y: camera.position.y - camera.lookAt.y,
      z: camera.position.z - camera.lookAt.z,
    });

    const newDistance = baseDistance * speedFactor;

    return {
      ...camera,
      position: {
        x: camera.lookAt.x + direction.x * newDistance,
        y: camera.lookAt.y + direction.y * newDistance,
        z: camera.lookAt.z + direction.z * newDistance,
      },
      actionSpeed,
    };
  }

  /**
   * Calculate distance between two points
   * @param {Object} pos1 - First position
   * @param {Object} pos2 - Second position
   * @returns {number} - Distance
   */
  calculateDistance(pos1, pos2) {
    if (!pos1 || !pos2) return 0;
    const dx = pos2.x - pos1.x;
    const dy = pos2.y - pos1.y;
    const dz = pos2.z - pos1.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
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
   * Get composition recommendations
   * @param {Array} subjects - Subjects in scene
   * @param {Object} sceneType - Scene type info
   * @returns {Object} - Composition recommendations
   */
  getRecommendations(subjects, sceneType) {
    const recommendations = {
      rule: 'thirds',
      balance: true,
      negativeSpace: true,
      reasoning: [],
    };

    if (subjects.length === 1) {
      recommendations.rule = 'thirds';
      recommendations.reasoning.push(
        'Single subject: rule of thirds for visual interest'
      );
    } else if (subjects.length === 2) {
      recommendations.rule = 'symmetry';
      recommendations.reasoning.push('Two subjects: symmetrical composition');
    } else {
      recommendations.rule = 'golden';
      recommendations.reasoning.push(
        'Multiple subjects: golden ratio for harmony'
      );
    }

    if (sceneType.isAction) {
      recommendations.negativeSpace = false;
      recommendations.reasoning.push(
        'Action scene: tighter framing for intensity'
      );
    }

    if (sceneType.isDramatic) {
      recommendations.rule = 'center';
      recommendations.reasoning.push(
        'Dramatic scene: center composition for impact'
      );
    }

    return recommendations;
  }
}

module.exports = CompositionEngine;
