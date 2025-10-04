// services/express/middleware/validation.js
const {
  UnifiedValidator,
  validationMonitor,
  utils,
} = require('@dreamscapes/shared');

// Initialize unified validator instance
const unifiedValidator = new UnifiedValidator({
  strictMode: true,
  logErrors: true,
});

// Dream JSON schema (kept for backward compatibility with AJV-based code)
const dreamSchema = {
  type: 'object',
  required: ['id', 'title', 'style'],
  properties: {
    id: {
      type: 'string',
      minLength: 1,
    },
    title: {
      type: 'string',
      minLength: 1,
      maxLength: 500,
    },
    style: {
      type: 'string',
      enum: ['ethereal', 'cyberpunk', 'surreal', 'fantasy', 'nightmare'],
    },
    seed: {
      type: 'integer',
      minimum: 0,
    },
    environment: {
      type: 'object',
      properties: {
        preset: {
          type: 'string',
          enum: ['dawn', 'dusk', 'night', 'void', 'underwater'],
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
      maxItems: 20,
      items: {
        type: 'object',
        required: ['id', 'template', 'pos'],
        properties: {
          id: {
            type: 'string',
            minLength: 1,
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
            ],
          },
          pos: {
            type: 'array',
            items: { type: 'number' },
            minItems: 3,
            maxItems: 3,
          },
          scale: {
            type: 'number',
            minimum: 0.1,
            maximum: 10,
          },
          rotation: {
            type: 'array',
            items: { type: 'number' },
            minItems: 3,
            maxItems: 3,
          },
          features: {
            type: 'array',
            items: { type: 'string' },
          },
        },
      },
    },
    entities: {
      type: 'array',
      maxItems: 10,
      items: {
        type: 'object',
        required: ['id', 'type'],
        properties: {
          id: {
            type: 'string',
            minLength: 1,
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
            ],
          },
          count: {
            type: 'integer',
            minimum: 1,
            maximum: 200,
          },
          params: {
            type: 'object',
            properties: {
              speed: { type: 'number', minimum: 0.1, maximum: 10 },
              glow: { type: 'number', minimum: 0, maximum: 1 },
              size: { type: 'number', minimum: 0.1, maximum: 5 },
              color: { type: 'string', pattern: '^#[0-9a-fA-F]{6}' },
            },
          },
        },
      },
    },
    cinematography: {
      type: 'object',
      required: ['durationSec', 'shots'],
      properties: {
        durationSec: {
          type: 'number',
          minimum: 10,
          maximum: 300,
        },
        shots: {
          type: 'array',
          minItems: 1,
          maxItems: 10,
          items: {
            type: 'object',
            required: ['type', 'duration'],
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
                ],
              },
              target: { type: 'string' },
              duration: {
                type: 'number',
                minimum: 2,
                maximum: 60,
              },
              startPos: {
                type: 'array',
                items: { type: 'number' },
                minItems: 3,
                maxItems: 3,
              },
              endPos: {
                type: 'array',
                items: { type: 'number' },
                minItems: 3,
                maxItems: 3,
              },
            },
          },
        },
      },
    },
    render: {
      type: 'object',
      properties: {
        res: {
          type: 'array',
          items: { type: 'integer', minimum: 240, maximum: 4320 },
          minItems: 2,
          maxItems: 2,
        },
        fps: {
          type: 'integer',
          enum: [24, 30, 60],
        },
        quality: {
          type: 'string',
          enum: ['draft', 'medium', 'high'],
        },
      },
    },
    assumptions: {
      type: 'array',
      items: { type: 'string' },
    },
    metadata: {
      type: 'object',
    },
    created: {
      type: 'string',
      format: 'date-time',
    },
    modified: {
      type: 'string',
      format: 'date-time',
    },
  },
};

// Legacy AJV support (kept for backward compatibility with existing code)
const Ajv = require('ajv');
const ajv = new Ajv({
  allErrors: true,
  removeAdditional: false,
  useDefaults: true,
  coerceTypes: true,
});

// Add custom format for date-time
ajv.addFormat('date-time', {
  type: 'string',
  validate: (dateTimeString) => {
    return !isNaN(Date.parse(dateTimeString));
  },
});

const validateDreamSchema = ajv.compile(dreamSchema);

// Main validation function using unified validator
function validateDream(dreamData, context = {}) {
  if (!dreamData || typeof dreamData !== 'object') {
    const result = {
      valid: false,
      errors: ['Dream data must be an object'],
    };

    // Record validation in monitor
    validationMonitor.recordValidation('express', result, context);

    return result;
  }

  // Use unified validator for comprehensive validation
  const validationResult = unifiedValidator.validateDreamObject(dreamData);

  // Format errors for backward compatibility
  const formattedErrors = validationResult.errors.map((error) => {
    return error.message || `${error.field}: ${error.error}`;
  });

  const result = {
    valid: validationResult.valid,
    errors: formattedErrors,
    details: validationResult.errors,
    errorCount: validationResult.errorCount,
    validationTime: validationResult.validationTime,
  };

  // Record validation in monitor
  validationMonitor.recordValidation('express', validationResult, {
    dreamId: dreamData?.id,
    ...context,
  });

  return result;
}

// Validation middleware for requests
function validateRequest(schema) {
  const validate = ajv.compile(schema);

  return (req, res, next) => {
    const valid = validate(req.body);

    if (!valid) {
      const errors = validate.errors.map((error) => ({
        field: error.instancePath || error.schemaPath,
        message: error.message,
        value: error.data,
      }));

      return res.status(400).json({
        error: 'Validation failed',
        details: errors,
        received: req.body,
      });
    }

    next();
  };
}

// Parse dream request validation schema
const parseDreamRequestSchema = {
  type: 'object',
  required: ['text'],
  properties: {
    text: {
      type: 'string',
      minLength: 10,
      maxLength: 2000,
    },
    style: {
      type: 'string',
      enum: ['ethereal', 'cyberpunk', 'surreal', 'fantasy', 'nightmare'],
      default: 'ethereal',
    },
    options: {
      type: 'object',
      properties: {
        duration: { type: 'number', minimum: 10, maximum: 300 },
        quality: { type: 'string', enum: ['draft', 'medium', 'high'] },
        complexity: { type: 'string', enum: ['simple', 'moderate', 'complex'] },
      },
    },
  },
};

// Patch dream request validation schema
const patchDreamRequestSchema = {
  type: 'object',
  required: ['dreamId', 'editText'],
  properties: {
    dreamId: {
      type: 'string',
      minLength: 1,
    },
    editText: {
      type: 'string',
      minLength: 3,
      maxLength: 500,
    },
    options: {
      type: 'object',
      properties: {
        mode: { type: 'string', enum: ['replace', 'append', 'smart'] },
      },
    },
  },
};

// Export request validation schema
const exportRequestSchema = {
  type: 'object',
  required: ['dreamId'],
  properties: {
    dreamId: {
      type: 'string',
      minLength: 1,
    },
    format: {
      type: 'string',
      enum: ['webm', 'mp4', 'gif'],
      default: 'webm',
    },
    quality: {
      type: 'string',
      enum: ['draft', 'medium', 'high'],
      default: 'medium',
    },
    options: {
      type: 'object',
      properties: {
        serverSide: { type: 'boolean', default: true },
        watermark: { type: 'boolean', default: false },
        compression: { type: 'string', enum: ['none', 'light', 'heavy'] },
      },
    },
  },
};

// Create validation middleware instances
const validateParseDreamRequest = validateRequest(parseDreamRequestSchema);
const validatePatchDreamRequest = validateRequest(patchDreamRequestSchema);
const validateExportRequest = validateRequest(exportRequestSchema);

// Sanitization functions (using shared utilities)
function sanitizeText(text) {
  return utils.sanitizeText(text, 2000);
}

function sanitizeDreamId(dreamId) {
  return utils.sanitizeId(dreamId, 50);
}

// Error formatting helper (using shared utilities)
function formatValidationError(errors) {
  return utils.formatValidationErrors(errors);
}

module.exports = {
  validateDream,
  validateParseDreamRequest,
  validatePatchDreamRequest,
  validateExportRequest,
  sanitizeText,
  sanitizeDreamId,
  formatValidationError,
  dreamSchema,
  unifiedValidator, // Export unified validator for direct access
  validationMonitor, // Export validation monitor for metrics access
};
