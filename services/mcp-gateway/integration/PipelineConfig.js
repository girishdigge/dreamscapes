/**
 * PipelineConfig - Configuration management for CreativeDreamPipeline
 * Provides presets and validation for pipeline configuration
 */

class PipelineConfig {
  /**
   * Default configuration
   */
  static get DEFAULT() {
    return {
      enableMotion: true,
      enableEvents: true,
      enableCamera: true,
      enableSemantics: true,
      backwardCompatible: false,
      duration: 10,
      cacheEnabled: true,
      maxCacheSize: 100,
    };
  }

  /**
   * Minimal configuration (fastest processing)
   */
  static get MINIMAL() {
    return {
      enableMotion: false,
      enableEvents: false,
      enableCamera: false,
      enableSemantics: true,
      backwardCompatible: true,
      duration: 10,
      cacheEnabled: true,
      maxCacheSize: 50,
    };
  }

  /**
   * Full creative configuration (all features enabled)
   */
  static get FULL_CREATIVE() {
    return {
      enableMotion: true,
      enableEvents: true,
      enableCamera: true,
      enableSemantics: true,
      backwardCompatible: false,
      duration: 15,
      cacheEnabled: true,
      maxCacheSize: 100,
      motionConfig: {
        enableIdleAnimations: true,
        pathSmoothing: true,
      },
      eventConfig: {
        enableCollisions: true,
        enablePhysics: true,
      },
      cameraConfig: {
        enable3ActStructure: true,
        enableCompositionRules: true,
      },
    };
  }

  /**
   * Performance-optimized configuration
   */
  static get PERFORMANCE() {
    return {
      enableMotion: true,
      enableEvents: false,
      enableCamera: true,
      enableSemantics: true,
      backwardCompatible: false,
      duration: 10,
      cacheEnabled: true,
      maxCacheSize: 200,
      motionConfig: {
        enableIdleAnimations: false,
        pathSmoothing: false,
      },
    };
  }

  /**
   * Validate configuration object
   */
  static validate(config) {
    const errors = [];

    if (config.duration !== undefined) {
      if (typeof config.duration !== 'number' || config.duration <= 0) {
        errors.push('duration must be a positive number');
      }
    }

    if (config.maxCacheSize !== undefined) {
      if (typeof config.maxCacheSize !== 'number' || config.maxCacheSize < 0) {
        errors.push('maxCacheSize must be a non-negative number');
      }
    }

    const booleanFields = [
      'enableMotion',
      'enableEvents',
      'enableCamera',
      'enableSemantics',
      'backwardCompatible',
      'cacheEnabled',
    ];

    for (const field of booleanFields) {
      if (config[field] !== undefined && typeof config[field] !== 'boolean') {
        errors.push(`${field} must be a boolean`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Merge configurations with defaults
   */
  static merge(userConfig = {}, baseConfig = PipelineConfig.DEFAULT) {
    return {
      ...baseConfig,
      ...userConfig,
      motionConfig: {
        ...(baseConfig.motionConfig || {}),
        ...(userConfig.motionConfig || {}),
      },
      eventConfig: {
        ...(baseConfig.eventConfig || {}),
        ...(userConfig.eventConfig || {}),
      },
      cameraConfig: {
        ...(baseConfig.cameraConfig || {}),
        ...(userConfig.cameraConfig || {}),
      },
    };
  }

  /**
   * Get configuration preset by name
   */
  static getPreset(name) {
    const presets = {
      default: PipelineConfig.DEFAULT,
      minimal: PipelineConfig.MINIMAL,
      full: PipelineConfig.FULL_CREATIVE,
      performance: PipelineConfig.PERFORMANCE,
    };

    return presets[name.toLowerCase()] || null;
  }
}

module.exports = PipelineConfig;
