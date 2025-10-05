/**
 * Pipeline Configuration
 * Manages configuration and feature toggles
 */

class PipelineConfig {
  constructor() {
    this.defaultConfig = {
      // Feature toggles
      enableSemanticAnalysis: true,
      enableMotionMapping: true,
      enableEventGeneration: true,
      enableCinematicCamera: true,
      enableMetadata: true,
      enableTypeMapping: true,
      enableInteractions: false, // Not yet implemented

      // Backward compatibility
      backwardCompatible: true,
      legacyMode: false,

      // Performance
      cacheResults: true,
      maxProcessingTime: 2000, // ms

      // Quality settings
      pathSmoothness: 0.5,
      collisionDetection: true,
      motionPrediction: true,

      // Camera settings
      defaultDuration: 30,
      minShotDuration: 2,
      maxShotDuration: 8,
      enableCompositionRules: true,

      // Event settings
      minEventSpacing: 2,
      maxEventsPerScene: 10,

      // Logging
      logLevel: 'info',
      logAssumptions: true,
      logEnhancements: true,
    };

    this.config = { ...this.defaultConfig };
  }

  /**
   * Load configuration
   * @param {Object} userConfig - User configuration
   * @returns {Object} - Merged configuration
   */
  load(userConfig = {}) {
    this.config = {
      ...this.defaultConfig,
      ...userConfig,
    };
    return this.config;
  }

  /**
   * Get configuration value
   * @param {string} key - Configuration key
   * @returns {*} - Configuration value
   */
  get(key) {
    return this.config[key];
  }

  /**
   * Set configuration value
   * @param {string} key - Configuration key
   * @param {*} value - Configuration value
   */
  set(key, value) {
    this.config[key] = value;
  }

  /**
   * Get all configuration
   * @returns {Object} - Complete configuration
   */
  getAll() {
    return { ...this.config };
  }

  /**
   * Reset to defaults
   */
  reset() {
    this.config = { ...this.defaultConfig };
  }

  /**
   * Enable all features
   */
  enableAll() {
    this.config.enableSemanticAnalysis = true;
    this.config.enableMotionMapping = true;
    this.config.enableEventGeneration = true;
    this.config.enableCinematicCamera = true;
    this.config.enableMetadata = true;
    this.config.enableTypeMapping = true;
  }

  /**
   * Disable all features (legacy mode)
   */
  disableAll() {
    this.config.enableSemanticAnalysis = false;
    this.config.enableMotionMapping = false;
    this.config.enableEventGeneration = false;
    this.config.enableCinematicCamera = false;
    this.config.enableMetadata = false;
    this.config.enableTypeMapping = false;
    this.config.legacyMode = true;
  }

  /**
   * Validate configuration
   * @returns {Object} - Validation result
   */
  validate() {
    const errors = [];

    if (this.config.maxProcessingTime < 100) {
      errors.push('maxProcessingTime must be at least 100ms');
    }

    if (this.config.minShotDuration > this.config.maxShotDuration) {
      errors.push('minShotDuration cannot be greater than maxShotDuration');
    }

    if (this.config.defaultDuration < 5) {
      errors.push('defaultDuration must be at least 5 seconds');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Export configuration to JSON
   * @returns {string} - JSON string
   */
  exportToJSON() {
    return JSON.stringify(this.config, null, 2);
  }

  /**
   * Import configuration from JSON
   * @param {string} json - JSON string
   */
  importFromJSON(json) {
    try {
      const imported = JSON.parse(json);
      this.load(imported);
    } catch (error) {
      console.error('Failed to import configuration:', error);
    }
  }
}

module.exports = PipelineConfig;
