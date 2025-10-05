/**
 * Unified Dream Schema
 *
 * Single source of truth for dream object structure across all services.
 * Provides comprehensive validation rules and field specifications.
 */

class DreamSchema {
  /**
   * Get the complete dream schema definition
   */
  static getSchema() {
    return {
      id: {
        type: 'string',
        required: true,
        description: 'Unique identifier for the dream (UUID format)',
        pattern:
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
      },
      title: {
        type: 'string',
        required: true,
        description: 'Human-readable title of the dream',
        minLength: 1,
        maxLength: 200,
      },
      style: {
        type: 'string',
        required: true,
        description: 'Visual style of the dream',
        enum: [
          'ethereal',
          'cyberpunk',
          'surreal',
          'fantasy',
          'nightmare',
          'nature',
          'abstract',
        ],
      },
      structures: {
        type: 'array',
        required: true,
        description: '3D scene structures (buildings, platforms, objects)',
        minItems: 1,
        maxItems: 10,
        itemSchema: this.getStructureSchema(),
      },
      entities: {
        type: 'array',
        required: true,
        description: 'Interactive entities (particles, creatures, effects)',
        minItems: 1,
        maxItems: 5,
        itemSchema: this.getEntitySchema(),
      },
      cinematography: {
        type: 'object',
        required: true,
        description: 'Camera movement and shot configuration',
        schema: this.getCinematographySchema(),
      },
      environment: {
        type: 'object',
        required: true,
        description: 'Environmental settings (lighting, fog, sky)',
        schema: this.getEnvironmentSchema(),
      },
      render: {
        type: 'object',
        required: true,
        description: 'Rendering configuration',
        schema: this.getRenderSchema(),
      },
      metadata: {
        type: 'object',
        required: false,
        description: 'System metadata and processing information',
        schema: this.getMetadataSchema(),
      },
      created: {
        type: 'string',
        required: true,
        description: 'ISO date string of creation time',
        pattern: /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?$/,
      },
      source: {
        type: 'string',
        required: true,
        description: 'Source service that generated the dream',
        enum: ['cerebras', 'openai', 'mock', 'mcp-gateway', 'express'],
      },
    };
  }

  /**
   * Get structure schema definition
   */
  static getStructureSchema() {
    return {
      id: {
        type: 'string',
        required: true,
        description: 'Unique identifier for the structure',
      },
      type: {
        type: 'string',
        required: true,
        description: 'Descriptive type of structure matching prompt content',
        minLength: 2,
        maxLength: 100,
        pattern: /^[a-zA-Z0-9_-]+$/,
        allowLegacyEnums: true,
        legacyEnums: [
          'floating_platform',
          'crystal_spire',
          'organic_tree',
          'geometric_form',
          'floating_library',
          'crystal_tower',
          'twisted_house',
          'portal_arch',
          'floating_island',
          'infinite_staircase',
          'abstract_sculpture',
          'energy_nexus',
        ],
      },
      pos: {
        type: 'array',
        required: true,
        description: 'Position in 3D space [x, y, z]',
        minItems: 3,
        maxItems: 3,
        itemType: 'number',
      },
      rotation: {
        type: 'array',
        required: false,
        description: 'Rotation in radians [rx, ry, rz]',
        minItems: 3,
        maxItems: 3,
        itemType: 'number',
        default: [0, 0, 0],
      },
      scale: {
        type: ['number', 'array'],
        required: false,
        description: 'Scale factor (number) or per-axis scale [sx, sy, sz]',
        min: 0.1,
        max: 10,
        default: 1,
      },
      features: {
        type: 'array',
        required: false,
        description: 'Visual features and effects',
        itemType: 'string',
        enum: [
          'glowing_edges',
          'particle_effects',
          'animated_textures',
          'reflective_surface',
          'transparent',
          'emissive',
          'pulsating',
          'rotating',
        ],
        default: [],
      },
    };
  }

  /**
   * Get entity schema definition
   */
  static getEntitySchema() {
    return {
      id: {
        type: 'string',
        required: true,
        description: 'Unique identifier for the entity',
      },
      type: {
        type: 'string',
        required: true,
        description: 'Descriptive type of entity matching prompt content',
        minLength: 2,
        maxLength: 100,
        pattern: /^[a-zA-Z0-9_-]+$/,
        allowLegacyEnums: true,
        legacyEnums: [
          'floating_orbs',
          'particle_swarm',
          'energy_beings',
          'geometric_shapes',
          'book_swarm',
          'particle_stream',
          'shadow_figures',
          'light_butterflies',
          'memory_fragments',
          'crystal_shards',
        ],
      },
      count: {
        type: 'number',
        required: true,
        description: 'Number of entity instances',
        min: 1,
        max: 100,
        default: 10,
      },
      params: {
        type: 'object',
        required: true,
        description: 'Entity parameters',
        schema: {
          speed: {
            type: 'number',
            required: false,
            description: 'Movement speed',
            min: 0,
            max: 10,
            default: 1,
          },
          glow: {
            type: 'number',
            required: false,
            description: 'Glow intensity',
            min: 0,
            max: 1,
            default: 0.5,
          },
          size: {
            type: 'number',
            required: false,
            description: 'Entity size',
            min: 0.1,
            max: 5,
            default: 1,
          },
          color: {
            type: 'string',
            required: false,
            description: 'Entity color (hex format)',
            pattern: /^#[0-9a-fA-F]{6}$/,
            default: '#ffffff',
          },
        },
      },
    };
  }

  /**
   * Get cinematography schema definition
   */
  static getCinematographySchema() {
    return {
      durationSec: {
        type: 'number',
        required: true,
        description: 'Total duration in seconds',
        min: 10,
        max: 120,
        default: 30,
      },
      shots: {
        type: 'array',
        required: true,
        description: 'Camera shots sequence',
        minItems: 1,
        maxItems: 10,
        itemSchema: {
          type: {
            type: 'string',
            required: true,
            description: 'Shot type',
            enum: [
              'establish',
              'flythrough',
              'orbit',
              'zoom',
              'close_up',
              'pull_back',
            ],
          },
          target: {
            type: 'string',
            required: false,
            description: 'ID of structure or entity to focus on',
          },
          duration: {
            type: 'number',
            required: true,
            description: 'Shot duration in seconds',
            min: 2,
            max: 30,
          },
          startPos: {
            type: 'array',
            required: false,
            description: 'Starting camera position [x, y, z]',
            minItems: 3,
            maxItems: 3,
            itemType: 'number',
          },
          endPos: {
            type: 'array',
            required: false,
            description: 'Ending camera position [x, y, z]',
            minItems: 3,
            maxItems: 3,
            itemType: 'number',
          },
        },
      },
    };
  }

  /**
   * Get environment schema definition
   */
  static getEnvironmentSchema() {
    return {
      preset: {
        type: 'string',
        required: true,
        description: 'Environment preset',
        enum: [
          'dawn',
          'dusk',
          'night',
          'space',
          'underwater',
          'void',
          'golden_hour',
        ],
        default: 'dusk',
      },
      fog: {
        type: 'number',
        required: false,
        description: 'Fog density',
        min: 0,
        max: 1,
        default: 0.3,
      },
      skyColor: {
        type: 'string',
        required: false,
        description: 'Sky color (hex format)',
        pattern: /^#[0-9a-fA-F]{6}$/,
        default: '#87CEEB',
      },
      ambientLight: {
        type: 'number',
        required: false,
        description: 'Ambient light intensity',
        min: 0,
        max: 2,
        default: 0.5,
      },
    };
  }

  /**
   * Get render configuration schema definition
   */
  static getRenderSchema() {
    return {
      res: {
        type: 'array',
        required: true,
        description: 'Resolution [width, height]',
        minItems: 2,
        maxItems: 2,
        itemType: 'number',
        default: [1920, 1080],
      },
      fps: {
        type: 'number',
        required: true,
        description: 'Frames per second',
        enum: [24, 30, 60],
        default: 30,
      },
      quality: {
        type: 'string',
        required: true,
        description: 'Render quality',
        enum: ['low', 'medium', 'high', 'ultra', 'draft'],
        default: 'medium',
      },
    };
  }

  /**
   * Get metadata schema definition
   */
  static getMetadataSchema() {
    return {
      generatedAt: {
        type: 'string',
        required: false,
        description: 'ISO date string of generation time',
      },
      processingTime: {
        type: 'number',
        required: false,
        description: 'Processing time in milliseconds',
      },
      source: {
        type: 'string',
        required: false,
        description: 'AI provider source',
      },
      version: {
        type: 'string',
        required: false,
        description: 'Schema version',
        default: '1.0.0',
      },
      originalText: {
        type: 'string',
        required: false,
        description: 'Original user prompt',
      },
      requestedStyle: {
        type: 'string',
        required: false,
        description: 'User-requested style',
      },
      repairInfo: {
        type: 'object',
        required: false,
        description: 'Content repair information',
        schema: {
          applied: {
            type: 'array',
            required: false,
            description: 'List of repair strategies applied',
            itemType: 'string',
          },
          processingTime: {
            type: 'number',
            required: false,
            description: 'Repair processing time in milliseconds',
          },
          originalErrorCount: {
            type: 'number',
            required: false,
            description: 'Number of errors before repair',
          },
          remainingErrorCount: {
            type: 'number',
            required: false,
            description: 'Number of errors after repair',
          },
        },
      },
    };
  }

  /**
   * Validate a complete dream object
   * @param {Object} dream - Dream object to validate
   * @param {Object} options - Validation options
   * @returns {Object} Validation result with errors array
   */
  static validate(dream, options = {}) {
    const errors = [];
    const schema = this.getSchema();

    // Validate top-level fields
    for (const [fieldName, fieldDef] of Object.entries(schema)) {
      const fieldErrors = this.validateField(
        dream,
        fieldName,
        fieldDef,
        options
      );
      errors.push(...fieldErrors);
    }

    return {
      valid: errors.length === 0,
      errors,
      errorCount: errors.length,
    };
  }

  /**
   * Validate a single field against its schema definition
   */
  static validateField(obj, fieldName, fieldDef, options = {}) {
    const errors = [];
    const value = obj?.[fieldName];
    const path = options.path ? `${options.path}.${fieldName}` : fieldName;

    // Check required fields
    if (fieldDef.required && (value === undefined || value === null)) {
      errors.push({
        field: path,
        error: 'MISSING_REQUIRED_FIELD',
        message: `Required field '${path}' is missing`,
        expected: fieldDef.type,
        received: typeof value,
      });
      return errors;
    }

    // Skip validation if field is optional and not present
    if (!fieldDef.required && (value === undefined || value === null)) {
      return errors;
    }

    // Validate type
    const typeErrors = this.validateType(value, fieldDef, path);
    errors.push(...typeErrors);

    // If type validation failed, skip further validation
    if (typeErrors.length > 0) {
      return errors;
    }

    // Validate specific field types
    // Determine the actual type to validate based on the value
    const actualType = Array.isArray(value) ? 'array' : typeof value;

    if (actualType === 'array') {
      const arrayErrors = this.validateArray(value, fieldDef, path);
      errors.push(...arrayErrors);
    } else if (actualType === 'object') {
      const objectErrors = this.validateObject(value, fieldDef, path);
      errors.push(...objectErrors);
    } else if (actualType === 'string') {
      const stringErrors = this.validateString(value, fieldDef, path);
      errors.push(...stringErrors);
    } else if (actualType === 'number') {
      const numberErrors = this.validateNumber(value, fieldDef, path);
      errors.push(...numberErrors);
    }

    return errors;
  }

  /**
   * Validate type of a value
   */
  static validateType(value, fieldDef, path) {
    const errors = [];
    const actualType = Array.isArray(value) ? 'array' : typeof value;
    const expectedTypes = Array.isArray(fieldDef.type)
      ? fieldDef.type
      : [fieldDef.type];

    if (!expectedTypes.includes(actualType)) {
      errors.push({
        field: path,
        error: 'INVALID_TYPE',
        message: `Field '${path}' has invalid type`,
        expected: expectedTypes.join(' or '),
        received: actualType,
      });
    }

    return errors;
  }

  /**
   * Validate array field
   */
  static validateArray(value, fieldDef, path) {
    const errors = [];

    // Check min/max items
    if (fieldDef.minItems !== undefined && value.length < fieldDef.minItems) {
      errors.push({
        field: path,
        error: 'ARRAY_TOO_SHORT',
        message: `Array '${path}' must have at least ${fieldDef.minItems} items`,
        expected: `>= ${fieldDef.minItems}`,
        received: value.length,
      });
    }

    if (fieldDef.maxItems !== undefined && value.length > fieldDef.maxItems) {
      errors.push({
        field: path,
        error: 'ARRAY_TOO_LONG',
        message: `Array '${path}' must have at most ${fieldDef.maxItems} items`,
        expected: `<= ${fieldDef.maxItems}`,
        received: value.length,
      });
    }

    // Validate array items
    if (fieldDef.itemSchema) {
      value.forEach((item, index) => {
        const itemPath = `${path}[${index}]`;
        for (const [itemFieldName, itemFieldDef] of Object.entries(
          fieldDef.itemSchema
        )) {
          const itemErrors = this.validateField(
            item,
            itemFieldName,
            itemFieldDef,
            { path: itemPath }
          );
          errors.push(...itemErrors);
        }
      });
    }

    // Validate item type for simple arrays
    if (fieldDef.itemType) {
      value.forEach((item, index) => {
        const itemPath = `${path}[${index}]`;
        const actualType = Array.isArray(item) ? 'array' : typeof item;
        if (actualType !== fieldDef.itemType) {
          errors.push({
            field: itemPath,
            error: 'INVALID_ITEM_TYPE',
            message: `Item at '${itemPath}' has invalid type`,
            expected: fieldDef.itemType,
            received: actualType,
          });
        }
      });
    }

    return errors;
  }

  /**
   * Validate object field
   */
  static validateObject(value, fieldDef, path) {
    const errors = [];

    if (fieldDef.schema) {
      for (const [subFieldName, subFieldDef] of Object.entries(
        fieldDef.schema
      )) {
        const subErrors = this.validateField(value, subFieldName, subFieldDef, {
          path,
        });
        errors.push(...subErrors);
      }
    }

    return errors;
  }

  /**
   * Validate string field
   */
  static validateString(value, fieldDef, path) {
    const errors = [];

    // Check enum values (for fields with strict enums)
    if (fieldDef.enum && !fieldDef.enum.includes(value)) {
      // Find closest valid enum value as repair suggestion
      // Use smart mapping for known fields
      let repairSuggestion = null;

      // Try to use EnumMapper for known mappings first
      try {
        const EnumMapper = require('../validators/EnumMapper');
        if (path === 'source') {
          repairSuggestion = EnumMapper.mapFallbackToSource(value);
        } else if (
          path.includes('cinematography.shots') &&
          path.includes('.type')
        ) {
          repairSuggestion = EnumMapper.mapShotType(value);
        }
      } catch (e) {
        // EnumMapper not available, fall back to distance calculation
      }

      // Fall back to Levenshtein distance if no mapping found
      if (!repairSuggestion || !fieldDef.enum.includes(repairSuggestion)) {
        repairSuggestion = this.findClosestEnumValue(fieldDef.enum, value);
      }

      const error = {
        field: path,
        error: 'INVALID_ENUM_VALUE',
        message: `Field '${path}' must be one of: ${fieldDef.enum.join(', ')}`,
        expected: fieldDef.enum,
        received: value,
      };

      // Add repair suggestion if found
      if (repairSuggestion) {
        error.repairSuggestion = repairSuggestion;
      }

      errors.push(error);
    }

    // For flexible type fields with backward compatibility
    // Check if value is a legacy enum value (always valid)
    if (fieldDef.allowLegacyEnums && fieldDef.legacyEnums) {
      if (fieldDef.legacyEnums.includes(value)) {
        // Legacy enum value - skip pattern and length validation
        return errors;
      }
    }

    // Check pattern
    if (fieldDef.pattern && !fieldDef.pattern.test(value)) {
      const error = {
        field: path,
        error: 'PATTERN_MISMATCH',
        message: `Field '${path}' does not match required pattern (alphanumeric with underscores/hyphens only)`,
        expected: fieldDef.pattern.toString(),
        received: value,
      };

      // For flexible type fields, suggest sanitization
      if (fieldDef.allowLegacyEnums) {
        error.repairSuggestion = value.replace(/[^a-zA-Z0-9_-]/g, '_');
      }

      errors.push(error);
    }

    // Check length
    if (fieldDef.minLength !== undefined && value.length < fieldDef.minLength) {
      errors.push({
        field: path,
        error: 'STRING_TOO_SHORT',
        message: `Field '${path}' must be at least ${fieldDef.minLength} characters`,
        expected: `>= ${fieldDef.minLength}`,
        received: value.length,
      });
    }

    if (fieldDef.maxLength !== undefined && value.length > fieldDef.maxLength) {
      const error = {
        field: path,
        error: 'STRING_TOO_LONG',
        message: `Field '${path}' must be at most ${fieldDef.maxLength} characters`,
        expected: `<= ${fieldDef.maxLength}`,
        received: value.length,
      };

      // For flexible type fields, suggest truncation
      if (fieldDef.allowLegacyEnums) {
        error.repairSuggestion = value.substring(0, fieldDef.maxLength);
      }

      errors.push(error);
    }

    return errors;
  }

  /**
   * Validate number field
   */
  static validateNumber(value, fieldDef, path) {
    const errors = [];

    // Check enum values
    if (fieldDef.enum && !fieldDef.enum.includes(value)) {
      // For number enums, find closest value
      const repairSuggestion = this.findClosestEnumValue(
        fieldDef.enum.map(String),
        String(value)
      );

      const error = {
        field: path,
        error: 'INVALID_ENUM_VALUE',
        message: `Field '${path}' must be one of: ${fieldDef.enum.join(', ')}`,
        expected: fieldDef.enum,
        received: value,
      };

      // Add repair suggestion if found (convert back to number if needed)
      if (repairSuggestion) {
        const numSuggestion = Number(repairSuggestion);
        error.repairSuggestion = fieldDef.enum.includes(numSuggestion)
          ? numSuggestion
          : repairSuggestion;
      }

      errors.push(error);
    }

    // Check min/max
    if (fieldDef.min !== undefined && value < fieldDef.min) {
      errors.push({
        field: path,
        error: 'NUMBER_TOO_SMALL',
        message: `Field '${path}' must be at least ${fieldDef.min}`,
        expected: `>= ${fieldDef.min}`,
        received: value,
      });
    }

    if (fieldDef.max !== undefined && value > fieldDef.max) {
      errors.push({
        field: path,
        error: 'NUMBER_TOO_LARGE',
        message: `Field '${path}' must be at most ${fieldDef.max}`,
        expected: `<= ${fieldDef.max}`,
        received: value,
      });
    }

    return errors;
  }

  /**
   * Validate structures array
   */
  static validateStructures(structures) {
    if (!Array.isArray(structures)) {
      return {
        valid: false,
        errors: [
          {
            field: 'structures',
            error: 'INVALID_TYPE',
            message: 'Structures must be an array',
            expected: 'array',
            received: typeof structures,
          },
        ],
      };
    }

    const errors = [];
    const structureSchema = this.getStructureSchema();

    structures.forEach((structure, index) => {
      for (const [fieldName, fieldDef] of Object.entries(structureSchema)) {
        const fieldErrors = this.validateField(structure, fieldName, fieldDef, {
          path: `structures[${index}]`,
        });
        errors.push(...fieldErrors);
      }
    });

    return {
      valid: errors.length === 0,
      errors,
      errorCount: errors.length,
    };
  }

  /**
   * Validate entities array
   */
  static validateEntities(entities) {
    if (!Array.isArray(entities)) {
      return {
        valid: false,
        errors: [
          {
            field: 'entities',
            error: 'INVALID_TYPE',
            message: 'Entities must be an array',
            expected: 'array',
            received: typeof entities,
          },
        ],
      };
    }

    const errors = [];
    const entitySchema = this.getEntitySchema();

    entities.forEach((entity, index) => {
      for (const [fieldName, fieldDef] of Object.entries(entitySchema)) {
        const fieldErrors = this.validateField(entity, fieldName, fieldDef, {
          path: `entities[${index}]`,
        });
        errors.push(...fieldErrors);
      }
    });

    return {
      valid: errors.length === 0,
      errors,
      errorCount: errors.length,
    };
  }

  /**
   * Validate cinematography object
   */
  static validateCinematography(cinematography) {
    if (typeof cinematography !== 'object' || cinematography === null) {
      return {
        valid: false,
        errors: [
          {
            field: 'cinematography',
            error: 'INVALID_TYPE',
            message: 'Cinematography must be an object',
            expected: 'object',
            received: typeof cinematography,
          },
        ],
      };
    }

    const errors = [];
    const cinematographySchema = this.getCinematographySchema();

    for (const [fieldName, fieldDef] of Object.entries(cinematographySchema)) {
      const fieldErrors = this.validateField(
        cinematography,
        fieldName,
        fieldDef,
        { path: 'cinematography' }
      );
      errors.push(...fieldErrors);
    }

    return {
      valid: errors.length === 0,
      errors,
      errorCount: errors.length,
    };
  }

  /**
   * Validate environment object
   */
  static validateEnvironment(environment) {
    if (typeof environment !== 'object' || environment === null) {
      return {
        valid: false,
        errors: [
          {
            field: 'environment',
            error: 'INVALID_TYPE',
            message: 'Environment must be an object',
            expected: 'object',
            received: typeof environment,
          },
        ],
      };
    }

    const errors = [];
    const environmentSchema = this.getEnvironmentSchema();

    for (const [fieldName, fieldDef] of Object.entries(environmentSchema)) {
      const fieldErrors = this.validateField(environment, fieldName, fieldDef, {
        path: 'environment',
      });
      errors.push(...fieldErrors);
    }

    return {
      valid: errors.length === 0,
      errors,
      errorCount: errors.length,
    };
  }

  /**
   * Validate render configuration object
   */
  static validateRenderConfig(render) {
    if (typeof render !== 'object' || render === null) {
      return {
        valid: false,
        errors: [
          {
            field: 'render',
            error: 'INVALID_TYPE',
            message: 'Render config must be an object',
            expected: 'object',
            received: typeof render,
          },
        ],
      };
    }

    const errors = [];
    const renderSchema = this.getRenderSchema();

    for (const [fieldName, fieldDef] of Object.entries(renderSchema)) {
      const fieldErrors = this.validateField(render, fieldName, fieldDef, {
        path: 'render',
      });
      errors.push(...fieldErrors);
    }

    return {
      valid: errors.length === 0,
      errors,
      errorCount: errors.length,
    };
  }

  /**
   * Find closest enum value using Levenshtein distance
   * @param {Array} validValues - Array of valid enum values
   * @param {string} invalidValue - Invalid value to find closest match for
   * @returns {string|null} Closest valid enum value
   */
  static findClosestEnumValue(validValues, invalidValue) {
    if (!validValues || validValues.length === 0) {
      return null;
    }

    if (!invalidValue) {
      return validValues[0];
    }

    // Try exact match first (case-insensitive)
    const lowerInvalid = String(invalidValue).toLowerCase();
    const exactMatch = validValues.find(
      (v) => String(v).toLowerCase() === lowerInvalid
    );
    if (exactMatch) {
      return exactMatch;
    }

    // Calculate Levenshtein distance for each valid value
    let closestValue = validValues[0];
    let minDistance = this.levenshteinDistance(
      lowerInvalid,
      String(validValues[0]).toLowerCase()
    );

    for (let i = 1; i < validValues.length; i++) {
      const distance = this.levenshteinDistance(
        lowerInvalid,
        String(validValues[i]).toLowerCase()
      );
      if (distance < minDistance) {
        minDistance = distance;
        closestValue = validValues[i];
      }
    }

    return closestValue;
  }

  /**
   * Calculate Levenshtein distance between two strings
   * @param {string} str1 - First string
   * @param {string} str2 - Second string
   * @returns {number} Edit distance
   */
  static levenshteinDistance(str1, str2) {
    const len1 = str1.length;
    const len2 = str2.length;
    const matrix = [];

    // Initialize matrix
    for (let i = 0; i <= len1; i++) {
      matrix[i] = [i];
    }
    for (let j = 0; j <= len2; j++) {
      matrix[0][j] = j;
    }

    // Fill matrix
    for (let i = 1; i <= len1; i++) {
      for (let j = 1; j <= len2; j++) {
        const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1, // deletion
          matrix[i][j - 1] + 1, // insertion
          matrix[i - 1][j - 1] + cost // substitution
        );
      }
    }

    return matrix[len1][len2];
  }
}

module.exports = DreamSchema;
