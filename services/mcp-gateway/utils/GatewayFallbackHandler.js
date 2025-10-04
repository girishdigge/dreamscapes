/**
 * Gateway Fallback Handler
 *
 * Provides fallback mechanisms for AI provider failures and ensures
 * the gateway never returns empty or incomplete dream objects.
 */

const { v4: uuidv4 } = require('uuid');
const { logger } = require('./logger');
const { UnifiedValidator, EnhancedContentRepair } = require('../../../shared');
const EnumMapper = require('../../../shared/validators/EnumMapper');
const ParameterValidator = require('../../../shared/validators/ParameterValidator');

class GatewayFallbackHandler {
  constructor(options = {}) {
    this.options = {
      enableFallbackGeneration: options.enableFallbackGeneration !== false,
      enableEmergencyRepair: options.enableEmergencyRepair !== false,
      logFallbacks: options.logFallbacks !== false,
      ...options,
    };

    this.contentRepair = new EnhancedContentRepair({
      enabled: true,
      maxAttempts: 5,
    });

    this.validator = new UnifiedValidator({
      strictMode: false, // Be lenient in fallback scenarios
      logErrors: this.options.logFallbacks,
    });

    this.metrics = {
      totalFallbacks: 0,
      providerFailures: 0,
      invalidDataFallbacks: 0,
      emergencyGenerations: 0,
      successfulFallbacks: 0,
      failedFallbacks: 0,
    };
  }

  /**
   * Handle AI provider failure with fallback generation
   * @param {Error} error - Provider error
   * @param {Object} context - Request context (text, style, options)
   * @returns {Promise<Object>} Fallback dream object
   */
  async handleProviderFailure(error, context) {
    this.metrics.totalFallbacks++;
    this.metrics.providerFailures++;

    if (this.options.logFallbacks) {
      logger.warn('AI provider failed, initiating fallback', {
        error: error.message,
        context: {
          hasText: !!context.text,
          style: context.style,
        },
      });
    }

    try {
      // Generate fallback dream using content repair system
      const fallbackDream = await this.generateFallbackDream(context);

      // Validate fallback dream
      const validation = this.validator.validateDreamObject(fallbackDream);

      if (!validation.valid) {
        logger.warn(
          'Fallback dream validation failed, applying emergency repair',
          {
            errorCount: validation.errorCount,
          }
        );

        // Apply emergency repair
        const repaired = await this.applyEmergencyRepair(
          fallbackDream,
          validation.errors,
          context
        );

        if (repaired.success) {
          this.metrics.successfulFallbacks++;
          return repaired.content.data || repaired.content;
        }
      }

      this.metrics.successfulFallbacks++;
      return fallbackDream;
    } catch (fallbackError) {
      this.metrics.failedFallbacks++;
      logger.error('Fallback generation failed', {
        originalError: error.message,
        fallbackError: fallbackError.message,
      });

      // Return minimal valid dream as last resort
      return this.generateMinimalDream(context);
    }
  }

  /**
   * Handle invalid data with repair and fallback
   * @param {Object} invalidData - Invalid dream data
   * @param {Array} errors - Validation errors
   * @param {Object} context - Request context
   * @returns {Promise<Object>} Repaired or fallback dream object
   */
  async handleInvalidData(invalidData, errors, context) {
    this.metrics.totalFallbacks++;
    this.metrics.invalidDataFallbacks++;

    if (this.options.logFallbacks) {
      logger.warn('Invalid data received, attempting repair', {
        errorCount: errors.length,
        hasStructures: !!invalidData?.structures?.length,
        hasEntities: !!invalidData?.entities?.length,
      });
    }

    try {
      // Attempt to repair invalid data
      const repairResult = await this.contentRepair.repairWithContext(
        { data: invalidData },
        context.text,
        context.style,
        { errors }
      );

      if (repairResult.success) {
        const repairedData = repairResult.content.data || repairResult.content;

        // Validate repaired data
        const validation = this.validator.validateDreamObject(repairedData);

        if (validation.valid || validation.errorCount < errors.length) {
          this.metrics.successfulFallbacks++;
          return repairedData;
        }
      }

      // If repair didn't work, generate fallback
      logger.warn('Repair unsuccessful, generating fallback dream');
      const fallbackDream = await this.generateFallbackDream(context);
      this.metrics.successfulFallbacks++;
      return fallbackDream;
    } catch (error) {
      this.metrics.failedFallbacks++;
      logger.error('Invalid data handling failed', {
        error: error.message,
      });

      // Return minimal valid dream as last resort
      return this.generateMinimalDream(context);
    }
  }

  /**
   * Generate a complete fallback dream based on context
   * @param {Object} context - Request context (text, style, options)
   * @returns {Promise<Object>} Generated fallback dream
   */
  async generateFallbackDream(context) {
    this.metrics.emergencyGenerations++;

    const style = context.style || 'ethereal';
    const text = context.text || 'A dreamscape';

    if (this.options.logFallbacks) {
      logger.info('Generating fallback dream', {
        style,
        textLength: text.length,
      });
    }

    // Generate structures based on prompt
    const structures = this.contentRepair.generateStructuresFromPrompt(
      text,
      style,
      2
    );

    // Generate entities based on prompt
    const entities = this.contentRepair.generateEntitiesFromPrompt(
      text,
      style,
      2
    );

    // Generate cinematography
    const cinematography = this.contentRepair.generateCinematographyFromPrompt(
      text,
      style,
      structures
    );

    // Generate environment
    const environment = this.contentRepair.generateEnvironmentFromStyle(style);

    // Generate render config
    const render = this.contentRepair.generateRenderConfigFromStyle(style);

    // Validate and clamp all entity parameters
    const validatedEntities = entities.map((entity) => {
      const validation = ParameterValidator.validateEntityParams(entity);
      if (validation.repairs && validation.repairs.length > 0) {
        if (this.options.logFallbacks) {
          logger.info('Clamped entity parameters in fallback generation', {
            entityId: entity.id,
            repairs: validation.repairs,
          });
        }
      }
      return validation.entity || entity;
    });

    // Ensure all shot types are valid enums
    const validatedCinematography = {
      ...cinematography,
      shots: cinematography.shots.map((shot) => ({
        ...shot,
        type: EnumMapper.mapShotType(shot.type),
      })),
    };

    // Create complete dream object with valid enums
    const dream = {
      id: uuidv4(), // Use UUID instead of custom format
      title: this.generateTitle(text),
      style,
      structures,
      entities: validatedEntities,
      cinematography: validatedCinematography,
      environment,
      render,
      metadata: {
        generatedAt: new Date().toISOString(),
        source: 'fallback',
        originalText: text,
        requestedStyle: style,
        fallbackGeneration: true,
        fallbackReason: 'Provider failure or invalid data',
      },
      created: new Date().toISOString(),
      source: 'mcp-gateway', // Use valid enum value instead of 'mcp-gateway-fallback'
    };

    return dream;
  }

  /**
   * Apply emergency repair to dream object
   * @param {Object} dream - Dream object to repair
   * @param {Array} errors - Validation errors
   * @param {Object} context - Request context
   * @returns {Promise<Object>} Repair result
   */
  async applyEmergencyRepair(dream, errors, context) {
    if (!this.options.enableEmergencyRepair) {
      return {
        success: false,
        content: dream,
        errors,
      };
    }

    try {
      const repairResult = await this.contentRepair.repairWithContext(
        { data: dream },
        context.text,
        context.style,
        {
          errors,
          maxAttempts: 5,
          usePromptContext: true,
        }
      );

      if (this.options.logFallbacks) {
        logger.info('Emergency repair completed', {
          success: repairResult.success,
          strategiesApplied: repairResult.appliedStrategies?.length || 0,
          remainingErrors: repairResult.errors?.length || 0,
        });
      }

      return repairResult;
    } catch (error) {
      logger.error('Emergency repair failed', {
        error: error.message,
      });

      return {
        success: false,
        content: dream,
        errors: [...errors, error.message],
      };
    }
  }

  /**
   * Generate a minimal valid dream as last resort
   * @param {Object} context - Request context
   * @returns {Object} Minimal valid dream
   */
  generateMinimalDream(context) {
    const style = context.style || 'ethereal';
    const text = context.text || 'A dreamscape';

    logger.warn('Generating minimal dream as last resort', {
      style,
    });

    // Validate entity parameters
    const minimalEntity = {
      id: 'entity_minimal_1',
      type: 'floating_orbs',
      count: 20,
      params: {
        speed: 1,
        glow: 0.5,
        size: 1,
        color: '#B8A9D4',
      },
    };

    const validation = ParameterValidator.validateEntityParams(minimalEntity);
    const validatedEntity = validation.entity || minimalEntity;

    return {
      id: uuidv4(), // Use UUID instead of custom format
      title: this.generateTitle(text),
      style,
      structures: [
        {
          id: 'struct_minimal_1',
          type: 'floating_platform',
          pos: [0, 10, 0],
          rotation: [0, 0, 0],
          scale: 5,
          features: ['glowing_edges'],
        },
      ],
      entities: [validatedEntity],
      cinematography: {
        durationSec: 30,
        shots: [
          {
            type: EnumMapper.mapShotType('establish'), // Ensure valid enum
            target: 'struct_minimal_1',
            duration: 30,
            startPos: [0, 50, 80],
            endPos: [0, 40, 60],
          },
        ],
      },
      environment: {
        preset: 'dusk',
        fog: 0.3,
        skyColor: '#87CEEB',
        ambientLight: 0.5,
      },
      render: {
        res: [1920, 1080],
        fps: 30,
        quality: 'medium',
      },
      metadata: {
        generatedAt: new Date().toISOString(),
        source: 'minimal-fallback',
        originalText: text,
        requestedStyle: style,
        minimalGeneration: true,
        fallbackReason: 'All other generation methods failed',
      },
      created: new Date().toISOString(),
      source: 'mcp-gateway', // Use valid enum value instead of 'mcp-gateway-minimal'
    };
  }

  /**
   * Check if response is valid and complete
   * @param {Object} response - Response to check
   * @returns {Object} Validation result
   */
  isValidResponse(response) {
    if (!response || typeof response !== 'object') {
      return {
        valid: false,
        reason: 'Response is not an object',
      };
    }

    const validation = this.validator.validateDreamObject(response);

    if (!validation.valid) {
      return {
        valid: false,
        reason: 'Validation failed',
        errors: validation.errors,
        errorCount: validation.errorCount,
      };
    }

    // Check for empty arrays
    if (!response.structures || response.structures.length === 0) {
      return {
        valid: false,
        reason: 'No structures present',
      };
    }

    if (!response.entities || response.entities.length === 0) {
      return {
        valid: false,
        reason: 'No entities present',
      };
    }

    return {
      valid: true,
    };
  }

  /**
   * Ensure response is never empty or incomplete
   * @param {Object} response - Response to check and fix
   * @param {Object} context - Request context
   * @returns {Promise<Object>} Complete response
   */
  async ensureCompleteResponse(response, context) {
    const validationResult = this.isValidResponse(response);

    if (validationResult.valid) {
      return response;
    }

    if (this.options.logFallbacks) {
      logger.warn('Response is incomplete, applying fallback', {
        reason: validationResult.reason,
        errorCount: validationResult.errorCount || 0,
      });
    }

    // Try to repair first
    if (response && typeof response === 'object') {
      const repaired = await this.handleInvalidData(
        response,
        validationResult.errors || [],
        context
      );
      return repaired;
    }

    // Generate fallback if repair not possible
    return this.generateFallbackDream(context);
  }

  /**
   * Generate a unique ID (deprecated - use uuidv4() directly)
   * @returns {string} UUID
   * @deprecated Use uuidv4() directly instead
   */
  generateId() {
    return uuidv4();
  }

  /**
   * Generate a title from text
   * @param {string} text - Original text
   * @returns {string} Title
   */
  generateTitle(text) {
    if (!text || typeof text !== 'string') {
      return 'Untitled Dream';
    }

    // Take first 50 characters and clean up
    let title = text.substring(0, 50).trim();

    // Remove incomplete sentences
    const lastPeriod = title.lastIndexOf('.');
    const lastComma = title.lastIndexOf(',');
    const lastSpace = title.lastIndexOf(' ');

    if (lastPeriod > 20) {
      title = title.substring(0, lastPeriod);
    } else if (lastComma > 20) {
      title = title.substring(0, lastComma);
    } else if (lastSpace > 20 && title.length > 40) {
      title = title.substring(0, lastSpace);
    }

    // Add ellipsis if truncated
    if (title.length < text.length && !title.endsWith('.')) {
      title += '...';
    }

    return title || 'Untitled Dream';
  }

  /**
   * Get fallback metrics
   * @returns {Object} Metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      successRate:
        this.metrics.totalFallbacks > 0
          ? (this.metrics.successfulFallbacks / this.metrics.totalFallbacks) *
            100
          : 0,
    };
  }

  /**
   * Reset metrics
   */
  resetMetrics() {
    this.metrics = {
      totalFallbacks: 0,
      providerFailures: 0,
      invalidDataFallbacks: 0,
      emergencyGenerations: 0,
      successfulFallbacks: 0,
      failedFallbacks: 0,
    };
  }
}

module.exports = GatewayFallbackHandler;
