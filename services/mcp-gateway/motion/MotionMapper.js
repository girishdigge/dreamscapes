/**
 * Motion Mapper
 * Maps verbs to animated behaviors and generates motion paths
 */

const VerbDictionary = require('./VerbDictionary');
const PathGenerator = require('./PathGenerator');

class MotionMapper {
  constructor() {
    this.verbDictionary = new VerbDictionary();
    this.pathGenerator = new PathGenerator();
  }

  /**
   * Map verb to animation
   * @param {string} verb - Verb to map
   * @param {Object} entity - Entity information
   * @param {Object} options - Additional options
   * @returns {Object} - Animation configuration
   */
  mapVerbToAnimation(verb, entity, options = {}) {
    const { target = null, duration = 30 } = options;

    // Get verb configuration
    const verbConfig = this.verbDictionary.getVerb(verb);

    if (!verbConfig) {
      // Unknown verb - return default animation
      return this.getDefaultAnimation(entity);
    }

    // Generate animation based on verb type
    switch (verbConfig.type) {
      case 'path':
        return this.generatePathAnimation(verbConfig, entity, target, duration);

      case 'orbit':
        return this.generateOrbitAnimation(
          verbConfig,
          entity,
          target,
          duration
        );

      case 'rotate':
        return this.generateRotationAnimation(verbConfig, entity, duration);

      case 'event':
        return this.generateEventAnimation(verbConfig, entity, duration);

      case 'idle':
        return this.generateIdleAnimation(verbConfig, entity);

      default:
        return this.getDefaultAnimation(entity);
    }
  }

  /**
   * Generate path-based animation
   * @param {Object} verbConfig - Verb configuration
   * @param {Object} entity - Entity information
   * @param {Object} target - Target object (optional)
   * @param {number} duration - Animation duration
   * @returns {Object} - Animation configuration
   */
  generatePathAnimation(verbConfig, entity, target, duration) {
    const { pattern } = verbConfig;

    let path;

    switch (pattern) {
      case 'aerial':
        path = this.pathGenerator.generateAerialPath(
          verbConfig,
          entity,
          duration
        );
        break;

      case 'ground':
        path = this.pathGenerator.generateGroundPath(
          verbConfig,
          entity,
          duration
        );
        break;

      case 'water':
        path = this.pathGenerator.generateWaterPath(
          verbConfig,
          entity,
          duration
        );
        break;

      case 'vertical':
        path = this.pathGenerator.generateVerticalPath(
          verbConfig,
          entity,
          duration
        );
        break;

      case 'follow':
        path = this.pathGenerator.generateFollowPath(
          verbConfig,
          entity,
          target,
          duration
        );
        break;

      case 'flee':
        // Flee is like follow but away from target
        path = this.pathGenerator.generateFollowPath(
          { ...verbConfig, distance: -verbConfig.distance },
          entity,
          target,
          duration
        );
        break;

      default:
        path = this.pathGenerator.generateAerialPath(
          verbConfig,
          entity,
          duration
        );
    }

    return {
      type: 'path',
      verb: verbConfig.baseVerb,
      pattern: pattern,
      path,
      ...verbConfig,
    };
  }

  /**
   * Generate orbit/circular animation
   * @param {Object} verbConfig - Verb configuration
   * @param {Object} entity - Entity information
   * @param {Object} target - Target to orbit around
   * @param {number} duration - Animation duration
   * @returns {Object} - Animation configuration
   */
  generateOrbitAnimation(verbConfig, entity, target, duration) {
    const { pattern } = verbConfig;

    // Default target if none provided
    const orbitTarget = target || { x: 0, y: 0, z: 0 };

    let path;

    if (pattern === 'spiral') {
      path = this.pathGenerator.generateSpiralPath(
        verbConfig,
        entity,
        orbitTarget,
        duration
      );
    } else {
      path = this.pathGenerator.generateCircularPath(
        verbConfig,
        entity,
        orbitTarget,
        duration
      );
    }

    return {
      type: 'orbit',
      verb: verbConfig.baseVerb,
      pattern: pattern,
      path,
      ...verbConfig,
    };
  }

  /**
   * Generate rotation animation
   * @param {Object} verbConfig - Verb configuration
   * @param {Object} entity - Entity information
   * @param {number} duration - Animation duration
   * @returns {Object} - Animation configuration
   */
  generateRotationAnimation(verbConfig, entity, duration) {
    return {
      type: 'rotate',
      verb: verbConfig.baseVerb,
      axis: verbConfig.axis || 'y',
      speed: verbConfig.speed || 1.0,
      continuous: verbConfig.continuous !== false,
      duration,
      ...verbConfig,
    };
  }

  /**
   * Generate event animation
   * @param {Object} verbConfig - Verb configuration
   * @param {Object} entity - Entity information
   * @param {number} duration - Animation duration
   * @returns {Object} - Animation configuration
   */
  generateEventAnimation(verbConfig, entity, duration) {
    // Calculate event timing
    let eventTime;

    switch (verbConfig.timing) {
      case 'start':
        eventTime = 0;
        break;
      case 'mid':
        eventTime = duration / 2;
        break;
      case 'end':
        eventTime = duration - 2;
        break;
      default:
        eventTime = duration / 2;
    }

    return {
      type: 'event',
      verb: verbConfig.baseVerb,
      event: verbConfig.event,
      eventTime,
      duration: verbConfig.duration || 2.0,
      intensity: verbConfig.intensity || 1.0,
      particles: verbConfig.particles || false,
      particleCount: verbConfig.particleCount || 0,
      direction: verbConfig.direction,
      ...verbConfig,
    };
  }

  /**
   * Generate idle animation
   * @param {Object} verbConfig - Verb configuration
   * @param {Object} entity - Entity information
   * @returns {Object} - Animation configuration
   */
  generateIdleAnimation(verbConfig, entity) {
    const animation = this.pathGenerator.generateIdleAnimation(
      verbConfig,
      entity
    );

    return {
      type: 'idle',
      verb: verbConfig.baseVerb,
      ...animation,
      ...verbConfig,
    };
  }

  /**
   * Get default animation for entity
   * @param {Object} entity - Entity information
   * @returns {Object} - Default animation configuration
   */
  getDefaultAnimation(entity) {
    const defaultConfig = this.verbDictionary.getDefaultAnimation(entity.type);

    if (defaultConfig) {
      return this.generateIdleAnimation(defaultConfig, entity);
    }

    // Fallback to basic floating
    return {
      type: 'idle',
      verb: 'floating',
      pattern: 'float',
      amplitude: 1.5,
      frequency: 0.4,
      axis: 'y',
      continuous: true,
    };
  }

  /**
   * Map multiple verbs for an entity
   * @param {Array} verbs - Array of verbs
   * @param {Object} entity - Entity information
   * @param {Object} options - Additional options
   * @returns {Array} - Array of animation configurations
   */
  mapMultipleVerbs(verbs, entity, options = {}) {
    return verbs.map((verb) => this.mapVerbToAnimation(verb, entity, options));
  }

  /**
   * Get animation for static entity
   * @param {Object} entity - Entity information
   * @returns {Object} - Idle animation configuration
   */
  getStaticAnimation(entity) {
    return this.getDefaultAnimation(entity);
  }

  /**
   * Check if verb is supported
   * @param {string} verb - Verb to check
   * @returns {boolean} - True if supported
   */
  isVerbSupported(verb) {
    return this.verbDictionary.hasVerb(verb);
  }

  /**
   * Get verb suggestions for unknown verb
   * @param {string} verb - Unknown verb
   * @returns {Array} - Array of similar verbs
   */
  suggestVerbs(verb) {
    // Simple similarity check based on first letters
    const verbLower = verb.toLowerCase();
    const allVerbs = Object.keys(this.verbDictionary.verbs);

    return allVerbs
      .filter((v) => v.startsWith(verbLower.charAt(0)))
      .slice(0, 5);
  }

  /**
   * Get all supported verbs
   * @returns {Array} - Array of all verb names
   */
  getAllVerbs() {
    return Object.keys(this.verbDictionary.verbs);
  }

  /**
   * Get verbs by category
   * @param {string} category - Category name (aerial, ground, water, etc.)
   * @returns {Array} - Array of verbs in category
   */
  getVerbsByCategory(category) {
    return this.verbDictionary.getVerbsByPattern(category);
  }
}

module.exports = MotionMapper;
