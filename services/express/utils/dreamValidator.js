// services/express/utils/dreamValidator.js
const { UnifiedValidator, utils } = require('@dreamscapes/shared');
const logger = require('./logger').logger;

// Initialize unified validator
const unifiedValidator = new UnifiedValidator({
  strictMode: false, // Less strict for utility validation
  logErrors: true,
});

// Legacy AJV support for backward compatibility
const Ajv = require('ajv');
const addFormats = require('ajv-formats');
const ajv = new Ajv({
  allErrors: true,
  removeAdditional: false,
  useDefaults: true,
  coerceTypes: true,
  strict: false,
});
addFormats(ajv);

// Comprehensive dream validation schema
const dreamValidationSchema = {
  type: 'object',
  required: ['id', 'title', 'style'],
  additionalProperties: true,
  properties: {
    id: {
      type: 'string',
      minLength: 1,
      maxLength: 100,
      pattern: '^[a-zA-Z0-9_-]+$',
    },
    title: {
      type: 'string',
      minLength: 1,
      maxLength: 200,
    },
    style: {
      type: 'string',
      enum: ['ethereal', 'cyberpunk', 'surreal', 'fantasy', 'nightmare'],
    },
    seed: {
      type: 'integer',
      minimum: 0,
      maximum: 999999999,
    },
    environment: {
      type: 'object',
      additionalProperties: false,
      properties: {
        preset: {
          type: 'string',
          enum: ['dawn', 'dusk', 'night', 'void', 'underwater', 'space'],
        },
        fog: {
          type: 'number',
          minimum: 0,
          maximum: 1,
        },
        skyColor: {
          type: 'string',
          pattern: '^#[0-9a-fA-F]{6}$',
        },
        ambientLight: {
          type: 'number',
          minimum: 0,
          maximum: 3,
        },
      },
    },
    structures: {
      type: 'array',
      maxItems: 50,
      items: {
        type: 'object',
        required: ['id', 'template', 'pos'],
        additionalProperties: false,
        properties: {
          id: {
            type: 'string',
            minLength: 1,
            maxLength: 50,
          },
          template: {
            type: 'string',
            enum: [
              'floating_library',
              'crystal_tower',
              'twisted_house',
              'portal_arch',
              'floating_island',
              'infinite_staircase',
              'dream_cathedral',
              'memory_maze',
              'time_spiral',
            ],
          },
          pos: {
            type: 'array',
            items: {
              type: 'number',
              minimum: -1000,
              maximum: 1000,
            },
            minItems: 3,
            maxItems: 3,
          },
          scale: {
            type: 'number',
            minimum: 0.01,
            maximum: 100,
          },
          rotation: {
            type: 'array',
            items: {
              type: 'number',
              minimum: -Math.PI * 2,
              maximum: Math.PI * 2,
            },
            minItems: 3,
            maxItems: 3,
          },
          features: {
            type: 'array',
            items: { type: 'string' },
            maxItems: 20,
          },
        },
      },
    },
    entities: {
      type: 'array',
      maxItems: 20,
      items: {
        type: 'object',
        required: ['id', 'type'],
        additionalProperties: false,
        properties: {
          id: {
            type: 'string',
            minLength: 1,
            maxLength: 50,
          },
          type: {
            type: 'string',
            enum: [
              'book_swarm',
              'floating_orbs',
              'particle_stream',
              'shadow_figures',
              'light_butterflies',
              'memory_fragments',
              'dream_wisps',
              'time_echoes',
              'emotion_clouds',
            ],
          },
          count: {
            type: 'integer',
            minimum: 1,
            maximum: 1000,
          },
          params: {
            type: 'object',
            additionalProperties: false,
            properties: {
              speed: {
                type: 'number',
                minimum: 0.01,
                maximum: 50,
              },
              glow: {
                type: 'number',
                minimum: 0,
                maximum: 2,
              },
              size: {
                type: 'number',
                minimum: 0.01,
                maximum: 100,
              },
              color: {
                type: 'string',
                pattern: '^#[0-9a-fA-F]{6}$',
              },
              opacity: {
                type: 'number',
                minimum: 0,
                maximum: 1,
              },
            },
          },
        },
      },
    },
    cinematography: {
      type: 'object',
      required: ['durationSec', 'shots'],
      additionalProperties: false,
      properties: {
        durationSec: {
          type: 'number',
          minimum: 5,
          maximum: 600,
        },
        shots: {
          type: 'array',
          minItems: 1,
          maxItems: 20,
          items: {
            type: 'object',
            required: ['type', 'duration'],
            additionalProperties: false,
            properties: {
              type: {
                type: 'string',
                enum: [
                  'establish',
                  'flythrough',
                  'orbit',
                  'close_up',
                  'pull_back',
                  'dolly_zoom',
                  'spiral',
                  'tracking',
                  'whip_pan',
                  'reveal',
                ],
              },
              target: {
                type: 'string',
                maxLength: 50,
              },
              duration: {
                type: 'number',
                minimum: 1,
                maximum: 120,
              },
              startPos: {
                type: 'array',
                items: {
                  type: 'number',
                  minimum: -1000,
                  maximum: 1000,
                },
                minItems: 3,
                maxItems: 3,
              },
              endPos: {
                type: 'array',
                items: {
                  type: 'number',
                  minimum: -1000,
                  maximum: 1000,
                },
                minItems: 3,
                maxItems: 3,
              },
              fov: {
                type: 'number',
                minimum: 10,
                maximum: 170,
              },
            },
          },
        },
      },
    },
    render: {
      type: 'object',
      additionalProperties: false,
      properties: {
        res: {
          type: 'array',
          items: {
            type: 'integer',
            minimum: 240,
            maximum: 8192,
          },
          minItems: 2,
          maxItems: 2,
        },
        fps: {
          type: 'integer',
          enum: [12, 24, 30, 48, 60, 120],
        },
        quality: {
          type: 'string',
          enum: ['draft', 'low', 'medium', 'high', 'ultra'],
        },
      },
    },
    assumptions: {
      type: 'array',
      items: {
        type: 'string',
        maxLength: 1000,
      },
      maxItems: 100,
    },
    metadata: {
      type: 'object',
      properties: {
        generatedAt: { type: 'string', format: 'date-time' },
        source: { type: 'string' },
        version: { type: 'string' },
        originalText: { type: 'string' },
        processingTime: { type: 'number' },
      },
    },
    created: { type: 'string', format: 'date-time' },
    modified: { type: 'string', format: 'date-time' },
    originalText: { type: 'string' },
    source: { type: 'string' },
    patchHistory: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          editText: { type: 'string' },
          appliedAt: { type: 'string', format: 'date-time' },
          source: { type: 'string' },
          processingTime: { type: 'number' },
        },
      },
    },
  },
};

// Compile the schema
const validateDreamStructure = ajv.compile(dreamValidationSchema);

/**
 * Comprehensive dream validation using unified validator
 * @param {Object} dreamData - Dream object to validate
 * @param {Object} options - Validation options
 * @returns {Object} Validation result
 */
function validateDream(dreamData, options = {}) {
  const {
    strict = false,
    requireMetadata = false,
    checkReferences = true,
    validateTiming = true,
  } = options;

  // Basic structure validation
  if (!dreamData || typeof dreamData !== 'object') {
    return {
      valid: false,
      errors: ['Dream data must be a valid object'],
      warnings: [],
      suggestions: [],
      stats: {},
    };
  }

  // Use unified validator for comprehensive validation
  const validationResult = unifiedValidator.validateDreamObject(dreamData, {
    strictMode: strict,
  });

  const result = {
    valid: validationResult.valid,
    errors: validationResult.errors.map(
      (error) => error.message || `${error.field}: ${error.error}`
    ),
    warnings: [],
    suggestions: [],
    stats: {},
  };

  // Add warnings from validation
  if (validationResult.categorized) {
    result.warnings = validationResult.categorized.warning.map(
      (warn) => warn.message || `${warn.field}: ${warn.error}`
    );
  }

  // Additional semantic validations for backward compatibility
  if (dreamData.cinematography && validateTiming) {
    const timingValidation = validateCinematographyTiming(
      dreamData.cinematography
    );
    if (!timingValidation.valid) {
      result.warnings.push(...timingValidation.warnings);
      if (strict) {
        result.valid = false;
        result.errors.push(...timingValidation.errors);
      }
    }
  }

  // Reference validation
  if (
    checkReferences &&
    dreamData.cinematography &&
    dreamData.structures &&
    dreamData.entities
  ) {
    const refValidation = validateReferences(dreamData);
    result.warnings.push(...refValidation.warnings);
    result.suggestions.push(...refValidation.suggestions);
  }

  // Content validation
  const contentValidation = validateContent(dreamData);
  result.warnings.push(...contentValidation.warnings);
  result.suggestions.push(...contentValidation.suggestions);

  // Performance validation
  const perfValidation = validatePerformance(dreamData);
  result.warnings.push(...perfValidation.warnings);
  result.suggestions.push(...perfValidation.suggestions);

  // Generate statistics
  result.stats = generateDreamStats(dreamData);

  // Metadata validation
  if (requireMetadata && !dreamData.metadata) {
    result.warnings.push('Dream metadata is missing');
    result.suggestions.push('Add metadata for better tracking and debugging');
  }

  return result;
}

/**
 * Validate cinematography timing consistency
 */
function validateCinematographyTiming(cinematography) {
  const result = { valid: true, errors: [], warnings: [] };

  if (!cinematography.shots || !Array.isArray(cinematography.shots)) {
    result.valid = false;
    result.errors.push('Cinematography must have shots array');
    return result;
  }

  const totalShotDuration = cinematography.shots.reduce(
    (sum, shot) => sum + (shot.duration || 0),
    0
  );

  const declaredDuration = cinematography.durationSec;
  const timeDiff = Math.abs(totalShotDuration - declaredDuration);

  if (timeDiff > 2) {
    result.warnings.push(
      `Shot durations (${totalShotDuration}s) don't match declared duration (${declaredDuration}s)`
    );
  }

  // Check for very short or long shots
  cinematography.shots.forEach((shot, index) => {
    if (shot.duration < 1) {
      result.warnings.push(
        `Shot ${index + 1} is very short (${shot.duration}s)`
      );
    }
    if (shot.duration > 60) {
      result.warnings.push(
        `Shot ${index + 1} is very long (${shot.duration}s)`
      );
    }
  });

  return result;
}

/**
 * Validate references between cinematography, structures, and entities
 */
function validateReferences(dreamData) {
  const result = { warnings: [], suggestions: [] };

  const structureIds = new Set((dreamData.structures || []).map((s) => s.id));
  const entityIds = new Set((dreamData.entities || []).map((e) => e.id));

  dreamData.cinematography.shots.forEach((shot, index) => {
    if (shot.target) {
      if (!structureIds.has(shot.target) && !entityIds.has(shot.target)) {
        result.warnings.push(
          `Shot ${index + 1} targets non-existent object: ${shot.target}`
        );
      }
    }
  });

  // Check for unused structures/entities
  const referencedTargets = new Set(
    dreamData.cinematography.shots
      .map((shot) => shot.target)
      .filter((target) => target)
  );

  structureIds.forEach((id) => {
    if (!referencedTargets.has(id)) {
      result.suggestions.push(
        `Structure '${id}' is not referenced in cinematography`
      );
    }
  });

  return result;
}

/**
 * Validate dream content for common issues
 */
function validateContent(dreamData) {
  const result = { warnings: [], suggestions: [] };

  // Check entity counts
  if (dreamData.entities) {
    const totalEntities = dreamData.entities.reduce(
      (sum, entity) => sum + (entity.count || 0),
      0
    );

    if (totalEntities > 500) {
      result.warnings.push(
        `High entity count (${totalEntities}) may impact performance`
      );
      result.suggestions.push(
        'Consider reducing entity counts or using LOD systems'
      );
    }

    if (totalEntities === 0) {
      result.warnings.push('No entities defined - dream may appear empty');
    }
  }

  // Check structure positioning
  if (dreamData.structures) {
    dreamData.structures.forEach((structure, index) => {
      if (structure.pos) {
        const [x, y, z] = structure.pos;
        const distance = Math.sqrt(x * x + y * y + z * z);

        if (distance > 500) {
          result.warnings.push(
            `Structure ${index + 1} is very far from origin (${distance.toFixed(
              1
            )} units)`
          );
        }

        if (y < -100) {
          result.warnings.push(
            `Structure ${index + 1} is positioned very low (y=${y})`
          );
        }
      }
    });
  }

  return result;
}

/**
 * Validate performance characteristics
 */
function validatePerformance(dreamData) {
  const result = { warnings: [], suggestions: [] };

  // Check render settings
  if (dreamData.render) {
    const { res, fps } = dreamData.render;

    if (res && res[0] * res[1] > 2073600) {
      // > 1080p
      result.warnings.push(
        'High resolution may impact performance on slower devices'
      );
    }

    if (fps && fps > 60) {
      result.warnings.push(
        'High frame rate may not be supported on all devices'
      );
    }
  }

  // Check cinematography complexity
  if (dreamData.cinematography) {
    const { shots, durationSec } = dreamData.cinematography;

    if (shots.length > 10) {
      result.suggestions.push(
        'Many shots detected - consider simplifying for smoother playback'
      );
    }

    if (durationSec > 120) {
      result.suggestions.push(
        'Long duration - consider breaking into shorter sequences'
      );
    }
  }

  return result;
}

/**
 * Generate statistics about the dream (using shared utilities)
 */
function generateDreamStats(dreamData) {
  return utils.generateDreamStats(dreamData);
}

/**
 * Calculate a complexity score for the dream (using shared utilities)
 */
function calculateComplexityScore(dreamData) {
  return utils.calculateComplexityScore(dreamData);
}

/**
 * Get complexity rating from score (using shared utilities)
 */
function getComplexityRating(score) {
  return utils.getComplexityRating(score);
}

/**
 * Format AJV validation errors into readable messages (using shared utilities)
 */
function formatValidationError(error) {
  return utils.formatValidationError(error);
}

/**
 * Quick validation for API endpoints using unified validator
 */
function quickValidate(dreamData) {
  if (!dreamData || typeof dreamData !== 'object') {
    return { valid: false, error: 'Invalid dream data' };
  }

  // Use unified validator for quick validation
  const validationResult = unifiedValidator.validateDreamObject(dreamData, {
    strictMode: false,
    allowPartial: true,
  });

  if (!validationResult.valid) {
    // Return first critical error
    const criticalError = validationResult.errors.find(
      (e) => e.severity === 'critical'
    );
    const firstError = criticalError || validationResult.errors[0];

    return {
      valid: false,
      error: firstError
        ? firstError.message || `${firstError.field}: ${firstError.error}`
        : 'Validation failed',
    };
  }

  return { valid: true };
}

module.exports = {
  validateDream,
  quickValidate,
  dreamValidationSchema,
  validateDreamStructure,
  generateDreamStats,
  calculateComplexityScore,
  getComplexityRating,
  formatValidationError,
  unifiedValidator, // Export unified validator for direct access
};
