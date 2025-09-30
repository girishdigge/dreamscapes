// config/validation.js
// Enhanced validation and quality assurance configuration

module.exports = {
  // Quality thresholds and scoring
  quality: {
    minConfidenceScore: parseFloat(process.env.MIN_CONFIDENCE_SCORE) || 0.7,
    maxRepairAttempts: parseInt(process.env.MAX_REPAIR_ATTEMPTS) || 3,

    // Quality score thresholds for different quality levels
    thresholds: {
      draft: 0.5,
      standard: 0.7,
      high: 0.8,
      cinematic: 0.9,
    },

    // Required fields for different content types
    requiredFields: {
      dreamResponse: ['success', 'data', 'metadata'],
      dreamData: ['id', 'title', 'description', 'scenes'],
      sceneData: ['id', 'title', 'style'],
      cinematography: ['durationSec', 'shots'],
    },

    // Content quality checks configuration
    contentChecks: {
      titleRelevance: {
        enabled: true,
        weight: 0.15,
        minScore: 0.3,
      },
      descriptionQuality: {
        enabled: true,
        weight: 0.2,
        minLength: 50,
        preferredLength: 150,
      },
      sceneConsistency: {
        enabled: true,
        weight: 0.25,
        minScenes: 1,
        maxScenes: 10,
        minObjectsPerScene: 1,
      },
      cinematographyQuality: {
        enabled: true,
        weight: 0.2,
        minShots: 1,
        minShotDuration: 2,
        maxShotDuration: 30,
      },
      technicalValidity: {
        enabled: true,
        weight: 0.2,
        requiredMetadata: [
          'source',
          'model',
          'processingTime',
          'quality',
          'tokens',
        ],
      },
    },
  },

  // Validation rules for different content types
  validationRules: {
    dreamResponse: {
      // Structure validation
      structure: {
        requireSuccess: true,
        requireData: true,
        requireMetadata: true,
      },

      // Content validation
      content: {
        titleMaxLength: 200,
        titleMinLength: 5,
        descriptionMaxLength: 2000,
        descriptionMinLength: 20,
        maxScenes: 10,
        minScenes: 1,
      },

      // Metadata validation
      metadata: {
        requiredFields: [
          'source',
          'model',
          'processingTime',
          'quality',
          'tokens',
          'confidence',
        ],
        confidenceRange: [0, 1],
        qualityValues: ['draft', 'standard', 'high', 'cinematic'],
        maxProcessingTime: 300000, // 5 minutes in milliseconds
      },
    },

    sceneData: {
      // 3D scene specific validation
      structure: {
        maxStructures: 10,
        maxEntities: 5,
        requiredCinematography: true,
      },

      // Style validation
      styles: ['ethereal', 'cyberpunk', 'surreal', 'fantasy', 'nightmare'],

      // Environment validation
      environment: {
        presets: ['dawn', 'dusk', 'night', 'void', 'underwater'],
        fogRange: [0, 1],
        ambientLightRange: [0, 2],
      },

      // Structure templates
      structureTemplates: [
        'floating_library',
        'crystal_tower',
        'twisted_house',
        'portal_arch',
        'floating_island',
        'infinite_staircase',
      ],

      // Entity types
      entityTypes: [
        'book_swarm',
        'floating_orbs',
        'particle_stream',
        'shadow_figures',
        'light_butterflies',
        'memory_fragments',
      ],
    },

    videoParameters: {
      resolution: {
        minWidth: 480,
        maxWidth: 4096,
        minHeight: 270,
        maxHeight: 2160,
        commonRatios: ['16:9', '4:3', '21:9'],
      },

      frameRate: {
        validValues: [24, 30, 60],
        default: 30,
      },

      duration: {
        min: 5,
        max: 300,
        default: 30,
      },

      quality: {
        validValues: ['draft', 'standard', 'high', 'cinematic'],
        default: 'standard',
      },
    },
  },

  // Content repair configuration
  repair: {
    enabled: process.env.AUTO_REPAIR_ENABLED !== 'false',
    maxAttempts: parseInt(process.env.MAX_REPAIR_ATTEMPTS) || 3,

    // Repair strategies in order of preference
    strategies: [
      'fixJsonStructure',
      'fillMissingFields',
      'enhanceDescriptions',
      'validateObjects',
      'repairCinematography',
      'normalizeMetadata',
    ],

    // Auto-repair rules
    autoRepair: {
      // Automatically fix common JSON issues
      jsonStructure: true,

      // Fill missing required fields with defaults
      missingFields: true,

      // Enhance short descriptions
      shortDescriptions: {
        enabled: true,
        minLength: 20,
        enhanceBelow: 50,
      },

      // Fix invalid enum values
      enumValues: true,

      // Normalize numeric ranges
      numericRanges: true,

      // Fix array length issues
      arrayLengths: true,
    },

    // Default values for missing fields
    defaults: {
      confidence: 0.5,
      quality: 'standard',
      processingTime: 0,
      cacheHit: false,
      style: 'ethereal',
      duration: 30,
      fps: 30,
    },
  },

  // Error classification
  errorTypes: {
    SCHEMA_VALIDATION: 'schema_validation',
    CONTENT_QUALITY: 'content_quality',
    MISSING_FIELD: 'missing_field',
    INVALID_VALUE: 'invalid_value',
    STRUCTURE_ERROR: 'structure_error',
    TYPE_MISMATCH: 'type_mismatch',
    RANGE_ERROR: 'range_error',
    FORMAT_ERROR: 'format_error',
    CONSISTENCY_ERROR: 'consistency_error',
    COMPLETENESS_ERROR: 'completeness_error',
  },

  // Warning types
  warningTypes: {
    LOW_QUALITY: 'low_quality',
    MISSING_OPTIONAL: 'missing_optional',
    SUBOPTIMAL_VALUE: 'suboptimal_value',
    CONSISTENCY_WARNING: 'consistency_warning',
    PERFORMANCE_WARNING: 'performance_warning',
  },

  // Logging configuration
  logging: {
    level: process.env.VALIDATION_LOG_LEVEL || 'info',
    logValidationResults: process.env.LOG_VALIDATION_RESULTS !== 'false',
    logRepairAttempts: process.env.LOG_REPAIR_ATTEMPTS !== 'false',
    logQualityScores: process.env.LOG_QUALITY_SCORES !== 'false',
  },
};
