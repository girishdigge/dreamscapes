/**
 * Unified Validator
 *
 * Provides consistent validation across all services with detailed error reporting.
 * Uses DreamSchema as the single source of truth for validation rules.
 */

const DreamSchema = require('../schemas/DreamSchema');

class UnifiedValidator {
  constructor(options = {}) {
    this.options = {
      strictMode: options.strictMode !== false, // Default to strict
      allowPartial: options.allowPartial || false, // Allow partial validation
      logErrors: options.logErrors !== false, // Default to logging
      ...options,
    };
  }

  /**
   * Validate a complete dream object
   * @param {Object} dream - Dream object to validate
   * @param {Object} options - Validation options
   * @returns {Object} Validation result with detailed errors
   */
  validateDreamObject(dream, options = {}) {
    const startTime = Date.now();
    const validationOptions = { ...this.options, ...options };

    // Basic null/undefined check
    if (!dream || typeof dream !== 'object') {
      return this.createValidationResult(
        false,
        [
          {
            field: 'dream',
            error: 'INVALID_DREAM_OBJECT',
            message: 'Dream must be a valid object',
            expected: 'object',
            received: typeof dream,
            severity: 'critical',
          },
        ],
        startTime
      );
    }

    // Perform full schema validation
    const schemaResult = DreamSchema.validate(dream, validationOptions);

    // Add additional context-aware validations
    const contextErrors = this.performContextValidation(dream);

    const allErrors = [...schemaResult.errors, ...contextErrors];

    // Add source context to all errors for better debugging
    allErrors.forEach((error) => {
      if (!error.context) {
        error.context = {
          source: dream.source || 'unknown',
          dreamId: dream.id || 'unknown',
          generatedAt:
            dream.created || dream.metadata?.generatedAt || 'unknown',
        };
      }
    });

    // Categorize errors by severity
    const categorizedErrors = this.categorizeErrors(allErrors);

    // Log errors if enabled
    if (validationOptions.logErrors && allErrors.length > 0) {
      this.logValidationErrors(dream, allErrors);
    }

    return this.createValidationResult(
      allErrors.length === 0,
      allErrors,
      startTime,
      categorizedErrors
    );
  }

  /**
   * Validate structures array
   * @param {Array} structures - Structures to validate
   * @returns {Object} Validation result
   */
  validateStructures(structures) {
    const startTime = Date.now();

    if (!structures) {
      return this.createValidationResult(
        false,
        [
          {
            field: 'structures',
            error: 'MISSING_STRUCTURES',
            message: 'Structures array is required',
            severity: 'critical',
          },
        ],
        startTime
      );
    }

    const result = DreamSchema.validateStructures(structures);

    // Additional structure-specific validations including type format checking
    const additionalErrors = this.validateStructureReferences(structures);

    // Validate type strings for each structure
    structures.forEach((structure, index) => {
      if (structure.type) {
        const typeValidation = this.validateTypeString(
          structure.type,
          `structures[${index}].type`
        );
        if (!typeValidation.valid) {
          additionalErrors.push(...typeValidation.errors);
        }
      }
    });

    const allErrors = [...result.errors, ...additionalErrors];

    return this.createValidationResult(
      allErrors.length === 0,
      allErrors,
      startTime
    );
  }

  /**
   * Validate entities array
   * @param {Array} entities - Entities to validate
   * @returns {Object} Validation result
   */
  validateEntities(entities) {
    const startTime = Date.now();

    if (!entities) {
      return this.createValidationResult(
        false,
        [
          {
            field: 'entities',
            error: 'MISSING_ENTITIES',
            message: 'Entities array is required',
            severity: 'critical',
          },
        ],
        startTime
      );
    }

    const result = DreamSchema.validateEntities(entities);

    // Additional entity-specific validations including type format checking
    const additionalErrors = this.validateEntityParameters(entities);

    // Validate type strings for each entity
    entities.forEach((entity, index) => {
      if (entity.type) {
        const typeValidation = this.validateTypeString(
          entity.type,
          `entities[${index}].type`
        );
        if (!typeValidation.valid) {
          additionalErrors.push(...typeValidation.errors);
        }
      }
    });

    const allErrors = [...result.errors, ...additionalErrors];

    return this.createValidationResult(
      allErrors.length === 0,
      allErrors,
      startTime
    );
  }

  /**
   * Validate cinematography configuration
   * @param {Object} cinematography - Cinematography to validate
   * @returns {Object} Validation result
   */
  validateCinematography(cinematography) {
    const startTime = Date.now();

    if (!cinematography) {
      return this.createValidationResult(
        false,
        [
          {
            field: 'cinematography',
            error: 'MISSING_CINEMATOGRAPHY',
            message: 'Cinematography configuration is required',
            severity: 'critical',
          },
        ],
        startTime
      );
    }

    const result = DreamSchema.validateCinematography(cinematography);

    // Additional cinematography-specific validations
    const additionalErrors = this.validateCinematographyLogic(cinematography);
    const allErrors = [...result.errors, ...additionalErrors];

    return this.createValidationResult(
      allErrors.length === 0,
      allErrors,
      startTime
    );
  }

  /**
   * Validate environment configuration
   * @param {Object} environment - Environment to validate
   * @returns {Object} Validation result
   */
  validateEnvironment(environment) {
    const startTime = Date.now();

    if (!environment) {
      return this.createValidationResult(
        false,
        [
          {
            field: 'environment',
            error: 'MISSING_ENVIRONMENT',
            message: 'Environment configuration is required',
            severity: 'critical',
          },
        ],
        startTime
      );
    }

    const result = DreamSchema.validateEnvironment(environment);

    return this.createValidationResult(
      result.errors.length === 0,
      result.errors,
      startTime
    );
  }

  /**
   * Validate render configuration
   * @param {Object} render - Render config to validate
   * @returns {Object} Validation result
   */
  validateRenderConfig(render) {
    const startTime = Date.now();

    if (!render) {
      return this.createValidationResult(
        false,
        [
          {
            field: 'render',
            error: 'MISSING_RENDER_CONFIG',
            message: 'Render configuration is required',
            severity: 'critical',
          },
        ],
        startTime
      );
    }

    const result = DreamSchema.validateRenderConfig(render);

    return this.createValidationResult(
      result.errors.length === 0,
      result.errors,
      startTime
    );
  }

  /**
   * Perform context-aware validation
   * Validates relationships and logical consistency between fields
   */
  performContextValidation(dream) {
    const errors = [];

    // Validate cinematography targets reference existing structures/entities
    if (dream.cinematography && dream.cinematography.shots) {
      const structureIds = new Set((dream.structures || []).map((s) => s.id));
      const entityIds = new Set((dream.entities || []).map((e) => e.id));

      dream.cinematography.shots.forEach((shot, index) => {
        if (shot.target) {
          if (!structureIds.has(shot.target) && !entityIds.has(shot.target)) {
            errors.push({
              field: `cinematography.shots[${index}].target`,
              error: 'INVALID_TARGET_REFERENCE',
              message: `Shot target '${shot.target}' does not reference any existing structure or entity`,
              expected: 'Valid structure or entity ID',
              received: shot.target,
              severity: 'warning',
            });
          }
        }
      });
    }

    // Validate total shot duration matches cinematography duration
    if (
      dream.cinematography &&
      dream.cinematography.shots &&
      dream.cinematography.durationSec
    ) {
      const totalShotDuration = dream.cinematography.shots.reduce(
        (sum, shot) => sum + (shot.duration || 0),
        0
      );
      const tolerance = 1; // Allow 1 second tolerance

      if (
        Math.abs(totalShotDuration - dream.cinematography.durationSec) >
        tolerance
      ) {
        errors.push({
          field: 'cinematography',
          error: 'DURATION_MISMATCH',
          message: `Total shot duration (${totalShotDuration}s) does not match cinematography duration (${dream.cinematography.durationSec}s)`,
          expected: dream.cinematography.durationSec,
          received: totalShotDuration,
          severity: 'warning',
        });
      }
    }

    // Validate structure IDs are unique
    if (dream.structures && dream.structures.length > 0) {
      const structureIds = dream.structures.map((s) => s.id);
      const duplicates = structureIds.filter(
        (id, index) => structureIds.indexOf(id) !== index
      );
      if (duplicates.length > 0) {
        errors.push({
          field: 'structures',
          error: 'DUPLICATE_IDS',
          message: `Duplicate structure IDs found: ${duplicates.join(', ')}`,
          severity: 'error',
        });
      }
    }

    // Validate entity IDs are unique
    if (dream.entities && dream.entities.length > 0) {
      const entityIds = dream.entities.map((e) => e.id);
      const duplicates = entityIds.filter(
        (id, index) => entityIds.indexOf(id) !== index
      );
      if (duplicates.length > 0) {
        errors.push({
          field: 'entities',
          error: 'DUPLICATE_IDS',
          message: `Duplicate entity IDs found: ${duplicates.join(', ')}`,
          severity: 'error',
        });
      }
    }

    return errors;
  }

  /**
   * Validate structure references and relationships
   */
  validateStructureReferences(structures) {
    const errors = [];

    structures.forEach((structure, index) => {
      // Validate position values are reasonable
      if (structure.pos) {
        structure.pos.forEach((coord, coordIndex) => {
          if (Math.abs(coord) > 1000) {
            errors.push({
              field: `structures[${index}].pos[${coordIndex}]`,
              error: 'UNREASONABLE_POSITION',
              message: `Position coordinate ${coord} is unusually large`,
              expected: 'Value between -1000 and 1000',
              received: coord,
              severity: 'warning',
            });
          }
        });
      }

      // Validate scale is reasonable
      if (
        typeof structure.scale === 'number' &&
        (structure.scale < 0.01 || structure.scale > 100)
      ) {
        errors.push({
          field: `structures[${index}].scale`,
          error: 'UNREASONABLE_SCALE',
          message: `Scale value ${structure.scale} is outside reasonable range`,
          expected: 'Value between 0.01 and 100',
          received: structure.scale,
          severity: 'warning',
        });
      }
    });

    return errors;
  }

  /**
   * Validate entity parameters
   */
  validateEntityParameters(entities) {
    const errors = [];

    entities.forEach((entity, index) => {
      // Validate count is reasonable
      if (entity.count && entity.count > 1000) {
        errors.push({
          field: `entities[${index}].count`,
          error: 'EXCESSIVE_ENTITY_COUNT',
          message: `Entity count ${entity.count} may cause performance issues`,
          expected: 'Value <= 1000',
          received: entity.count,
          severity: 'warning',
        });
      }

      // Validate params exist
      if (!entity.params || typeof entity.params !== 'object') {
        errors.push({
          field: `entities[${index}].params`,
          error: 'MISSING_ENTITY_PARAMS',
          message: 'Entity params object is required',
          severity: 'error',
        });
      }
    });

    return errors;
  }

  /**
   * Validate type string format for flexible types
   * Checks format requirements: length (2-100 chars) and pattern (alphanumeric with _- only)
   * @param {string} typeValue - Type string to validate
   * @param {string} fieldPath - Field path for error reporting
   * @returns {Object} Validation result with errors array
   */
  validateTypeString(typeValue, fieldPath) {
    const errors = [];

    // Check if type is a string
    if (typeof typeValue !== 'string') {
      errors.push({
        field: fieldPath,
        error: 'INVALID_TYPE_FORMAT',
        message: `Type must be a string`,
        expected: 'string',
        received: typeof typeValue,
        severity: 'error',
      });
      return { valid: false, errors };
    }

    // Get legacy enum values from DreamSchema
    const isStructureType = fieldPath.includes('structures');
    const isEntityType = fieldPath.includes('entities');

    let legacyEnums = [];
    if (isStructureType) {
      const structureSchema = DreamSchema.getStructureSchema();
      legacyEnums = structureSchema.type.legacyEnums || [];
    } else if (isEntityType) {
      const entitySchema = DreamSchema.getEntitySchema();
      legacyEnums = entitySchema.type.legacyEnums || [];
    }

    // If it's a legacy enum value, it's always valid (backward compatibility)
    if (legacyEnums.includes(typeValue)) {
      return { valid: true, errors: [], isLegacy: true };
    }

    // Validate length constraints (2-100 characters)
    if (typeValue.length < 2) {
      errors.push({
        field: fieldPath,
        error: 'TYPE_TOO_SHORT',
        message: `Type '${typeValue}' must be at least 2 characters long`,
        expected: 'Length >= 2',
        received: typeValue.length,
        severity: 'error',
        hint: 'Type strings must be descriptive (minimum 2 characters)',
      });
    }

    if (typeValue.length > 100) {
      errors.push({
        field: fieldPath,
        error: 'TYPE_TOO_LONG',
        message: `Type '${typeValue}' must be at most 100 characters long`,
        expected: 'Length <= 100',
        received: typeValue.length,
        severity: 'error',
        hint: 'Consider using a shorter, more concise type name',
      });
    }

    // Validate pattern (alphanumeric with underscores and hyphens only)
    const validPattern = /^[a-zA-Z0-9_-]+$/;
    if (!validPattern.test(typeValue)) {
      // Find invalid characters for better error message
      const invalidChars = typeValue
        .split('')
        .filter((char) => !/[a-zA-Z0-9_-]/.test(char))
        .filter((char, index, self) => self.indexOf(char) === index) // unique
        .join(', ');

      errors.push({
        field: fieldPath,
        error: 'INVALID_TYPE_FORMAT',
        message: `Type '${typeValue}' contains invalid characters. Only alphanumeric characters, underscores (_), and hyphens (-) are allowed`,
        expected: 'Pattern: /^[a-zA-Z0-9_-]+$/',
        received: typeValue,
        invalidCharacters: invalidChars,
        severity: 'error',
        hint: 'Replace spaces with underscores or hyphens, remove special characters',
        repairSuggestion: typeValue.replace(/[^a-zA-Z0-9_-]/g, '_'),
      });
    }

    return {
      valid: errors.length === 0,
      errors,
      isLegacy: false,
    };
  }

  /**
   * Validate cinematography logic and consistency
   */
  validateCinematographyLogic(cinematography) {
    const errors = [];

    if (!cinematography.shots || cinematography.shots.length === 0) {
      errors.push({
        field: 'cinematography.shots',
        error: 'NO_SHOTS_DEFINED',
        message: 'Cinematography must have at least one shot',
        severity: 'critical',
      });
      return errors;
    }

    // Validate shot positions if defined
    cinematography.shots.forEach((shot, index) => {
      if (shot.startPos && shot.endPos) {
        // Check if positions are identical (no movement)
        const identical = shot.startPos.every(
          (val, i) => val === shot.endPos[i]
        );
        if (identical && shot.type === 'flythrough') {
          errors.push({
            field: `cinematography.shots[${index}]`,
            error: 'STATIC_FLYTHROUGH',
            message: 'Flythrough shot has identical start and end positions',
            severity: 'warning',
          });
        }
      }

      // Validate shot duration is reasonable
      if (shot.duration < 1) {
        errors.push({
          field: `cinematography.shots[${index}].duration`,
          error: 'SHOT_TOO_SHORT',
          message: `Shot duration ${shot.duration}s is too short`,
          expected: '>= 1',
          received: shot.duration,
          severity: 'warning',
        });
      }
    });

    return errors;
  }

  /**
   * Categorize errors by severity
   */
  categorizeErrors(errors) {
    return {
      critical: errors.filter((e) => e.severity === 'critical'),
      error: errors.filter((e) => e.severity === 'error' || !e.severity),
      warning: errors.filter((e) => e.severity === 'warning'),
    };
  }

  /**
   * Create standardized validation result
   */
  createValidationResult(valid, errors, startTime, categorized = null) {
    const result = {
      valid,
      errors,
      errorCount: errors.length,
      validationTime: Date.now() - startTime,
    };

    if (categorized) {
      result.categorized = categorized;
      result.criticalCount = categorized.critical.length;
      result.errorCount = categorized.error.length;
      result.warningCount = categorized.warning.length;
    }

    return result;
  }

  /**
   * Generate a comprehensive validation report
   * @param {Object} dream - Dream object to validate
   * @returns {Object} Detailed validation report
   */
  generateValidationReport(dream) {
    const report = {
      timestamp: new Date().toISOString(),
      dreamId: dream?.id || 'unknown',
      overallValidation: this.validateDreamObject(dream),
      sectionValidation: {},
    };

    // Validate each section individually
    if (dream) {
      report.sectionValidation.structures = this.validateStructures(
        dream.structures
      );
      report.sectionValidation.entities = this.validateEntities(dream.entities);
      report.sectionValidation.cinematography = this.validateCinematography(
        dream.cinematography
      );
      report.sectionValidation.environment = this.validateEnvironment(
        dream.environment
      );
      report.sectionValidation.render = this.validateRenderConfig(dream.render);
    }

    // Generate summary
    report.summary = {
      isValid: report.overallValidation.valid,
      totalErrors: report.overallValidation.errorCount,
      criticalErrors: report.overallValidation.criticalCount || 0,
      errors: report.overallValidation.errorCount || 0,
      warnings: report.overallValidation.warningCount || 0,
      sectionsWithErrors: Object.entries(report.sectionValidation)
        .filter(([_, result]) => !result.valid)
        .map(([section]) => section),
    };

    // Add field counts for debugging
    report.fieldCounts = this.getFieldCounts(dream);

    return report;
  }

  /**
   * Get field counts for debugging
   */
  getFieldCounts(dream) {
    if (!dream || typeof dream !== 'object') {
      return null;
    }

    return {
      structures: Array.isArray(dream.structures) ? dream.structures.length : 0,
      entities: Array.isArray(dream.entities) ? dream.entities.length : 0,
      cinematographyShots: dream.cinematography?.shots?.length || 0,
      hasEnvironment: !!dream.environment,
      hasRenderConfig: !!dream.render,
      hasMetadata: !!dream.metadata,
    };
  }

  /**
   * Log validation errors with repair suggestions and context
   */
  logValidationErrors(dream, errors) {
    if (errors.length === 0) return;

    // Group errors by type for better reporting
    const enumErrors = errors.filter((e) => e.error === 'INVALID_ENUM_VALUE');
    const otherErrors = errors.filter((e) => e.error !== 'INVALID_ENUM_VALUE');

    // Log enum errors with repair suggestions
    if (enumErrors.length > 0) {
      console.error('[UnifiedValidator] Enum validation failures detected:', {
        dreamId: dream?.id || 'unknown',
        source: dream?.source || 'unknown',
        errorCount: enumErrors.length,
        errors: enumErrors.map((e) => ({
          field: e.field,
          error: e.error,
          message: e.message,
          received: e.received,
          expected: e.expected,
          repairSuggestion: e.repairSuggestion || 'No suggestion available',
          severity: e.severity || 'error',
          actionable: e.repairSuggestion
            ? `Consider using '${e.repairSuggestion}' instead of '${e.received}'`
            : 'Update generator to use valid enum values',
        })),
      });
    }

    // Log other errors
    if (otherErrors.length > 0) {
      console.error('[UnifiedValidator] Validation failed:', {
        dreamId: dream?.id || 'unknown',
        source: dream?.source || 'unknown',
        errorCount: otherErrors.length,
        errors: otherErrors.map((e) => ({
          field: e.field,
          error: e.error,
          message: e.message,
          severity: e.severity || 'error',
          expected: e.expected,
          received: e.received,
        })),
      });
    }

    // Log summary with actionable context
    const criticalErrors = errors.filter((e) => e.severity === 'critical');
    if (criticalErrors.length > 0) {
      console.error(
        '[UnifiedValidator] Critical validation errors require immediate attention:',
        {
          dreamId: dream?.id || 'unknown',
          source: dream?.source || 'unknown',
          criticalCount: criticalErrors.length,
          context: `Service '${
            dream?.source || 'unknown'
          }' generated invalid data`,
          recommendation:
            'Review generator logic and ensure compliance with DreamSchema',
        }
      );
    }
  }

  /**
   * Check if dream is renderable (has minimum required data)
   * @param {Object} dream - Dream object to check
   * @returns {Object} Renderability check result
   */
  isRenderable(dream) {
    const errors = [];

    // Must have at least one structure
    if (!dream.structures || dream.structures.length === 0) {
      errors.push({
        field: 'structures',
        message: 'Dream must have at least one structure to be renderable',
        severity: 'critical',
      });
    }

    // Must have at least one entity
    if (!dream.entities || dream.entities.length === 0) {
      errors.push({
        field: 'entities',
        message: 'Dream must have at least one entity to be renderable',
        severity: 'critical',
      });
    }

    // Must have cinematography with shots
    if (
      !dream.cinematography ||
      !dream.cinematography.shots ||
      dream.cinematography.shots.length === 0
    ) {
      errors.push({
        field: 'cinematography',
        message:
          'Dream must have cinematography with at least one shot to be renderable',
        severity: 'critical',
      });
    }

    // Must have environment
    if (!dream.environment) {
      errors.push({
        field: 'environment',
        message: 'Dream must have environment configuration to be renderable',
        severity: 'critical',
      });
    }

    // Must have render config
    if (!dream.render) {
      errors.push({
        field: 'render',
        message: 'Dream must have render configuration to be renderable',
        severity: 'critical',
      });
    }

    return {
      renderable: errors.length === 0,
      errors,
      errorCount: errors.length,
    };
  }

  /**
   * Validate for specific use case (e.g., API response, database storage)
   * @param {Object} dream - Dream object to validate
   * @param {string} useCase - Use case identifier
   * @returns {Object} Validation result
   */
  validateForUseCase(dream, useCase) {
    const baseValidation = this.validateDreamObject(dream);

    switch (useCase) {
      case 'api-response':
        // API responses must be fully valid and renderable
        const renderCheck = this.isRenderable(dream);
        return {
          ...baseValidation,
          renderable: renderCheck.renderable,
          renderErrors: renderCheck.errors,
          valid: baseValidation.valid && renderCheck.renderable,
        };

      case 'database-storage':
        // Database storage can be more lenient
        return {
          ...baseValidation,
          valid: baseValidation.criticalCount === 0,
        };

      case 'cache':
        // Cached data should be fully valid
        return baseValidation;

      default:
        return baseValidation;
    }
  }
}

module.exports = UnifiedValidator;
