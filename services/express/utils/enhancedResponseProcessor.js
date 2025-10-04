// services/express/utils/enhancedResponseProcessor.js
const { logger } = require('./logger');
const { UnifiedValidator } = require('@dreamscapes/shared');
const { createFallbackDream } = require('./fallbackGenerator');
const { v4: uuidv4 } = require('uuid');

/**
 * Enhanced Response Processor
 *
 * Provides final validation, render-specific validation, and comprehensive
 * debug information generation for dream responses before sending to frontend.
 */
class EnhancedResponseProcessor {
  constructor() {
    this.validator = new UnifiedValidator({
      strictMode: true,
      logErrors: true,
    });
    this.processingHistory = new Map();
  }

  /**
   * Process and validate dream response with comprehensive checks
   * @param {Object} dreamData - Dream object to process
   * @param {Object} originalRequest - Original request context
   * @param {Object} options - Processing options
   * @returns {Object} Processed response with validation and debug info
   */
  async processAndValidate(dreamData, originalRequest = {}, options = {}) {
    const startTime = Date.now();
    const requestId = originalRequest.requestId || uuidv4();

    logger.info('Enhanced response processing started', {
      requestId,
      dreamId: dreamData?.id,
      hasOriginalRequest: !!originalRequest,
    });

    const processingSteps = [];
    let currentDream = dreamData;
    let repairApplied = false;

    try {
      // Step 1: Final validation before sending to frontend
      processingSteps.push({
        step: 'final_validation',
        timestamp: new Date().toISOString(),
        startTime: Date.now(),
      });

      const validationResult = await this.performFinalValidation(
        currentDream,
        requestId
      );

      processingSteps[processingSteps.length - 1].duration =
        Date.now() - processingSteps[processingSteps.length - 1].startTime;
      processingSteps[processingSteps.length - 1].result = {
        valid: validationResult.valid,
        errorCount: validationResult.errorCount,
      };

      // Step 2: Apply repair if validation failed
      if (!validationResult.valid) {
        logger.warn('Final validation failed, applying repair', {
          requestId,
          dreamId: currentDream?.id,
          errorCount: validationResult.errorCount,
          errors: validationResult.errors.slice(0, 5),
        });

        processingSteps.push({
          step: 'content_repair',
          timestamp: new Date().toISOString(),
          startTime: Date.now(),
        });

        const repairResult = await this.applyFinalRepair(
          currentDream,
          originalRequest,
          validationResult
        );

        currentDream = repairResult.dream;
        repairApplied = true;

        processingSteps[processingSteps.length - 1].duration =
          Date.now() - processingSteps[processingSteps.length - 1].startTime;
        processingSteps[processingSteps.length - 1].result = {
          repairApplied: true,
          strategiesUsed: repairResult.strategies,
        };

        // Re-validate after repair
        const postRepairValidation = await this.performFinalValidation(
          currentDream,
          requestId
        );

        if (!postRepairValidation.valid) {
          logger.error('Dream still invalid after repair, using fallback', {
            requestId,
            dreamId: currentDream?.id,
            remainingErrors: postRepairValidation.errorCount,
          });

          // Create fallback dream as last resort
          currentDream = createFallbackDream(
            originalRequest.text || 'Emergency dream scene',
            originalRequest.style || 'ethereal',
            { requestId }
          );
          repairApplied = true;
        }
      }

      // Step 3: Render-specific validation
      processingSteps.push({
        step: 'render_validation',
        timestamp: new Date().toISOString(),
        startTime: Date.now(),
      });

      const renderValidation = await this.validateForRendering(
        currentDream,
        requestId
      );

      processingSteps[processingSteps.length - 1].duration =
        Date.now() - processingSteps[processingSteps.length - 1].startTime;
      processingSteps[processingSteps.length - 1].result = {
        renderable: renderValidation.renderable,
        issues: renderValidation.issues.length,
      };

      // Step 4: Generate debug information
      processingSteps.push({
        step: 'debug_generation',
        timestamp: new Date().toISOString(),
        startTime: Date.now(),
      });

      const debugInfo = this.generateDebugInformation(
        currentDream,
        processingSteps,
        originalRequest
      );

      processingSteps[processingSteps.length - 1].duration =
        Date.now() - processingSteps[processingSteps.length - 1].startTime;

      // Step 5: Create renderable response
      const response = this.createRenderableResponse(
        currentDream,
        {
          validationResult,
          renderValidation,
          debugInfo,
          repairApplied,
          processingSteps,
        },
        originalRequest
      );

      const totalTime = Date.now() - startTime;

      logger.info('Enhanced response processing completed', {
        requestId,
        dreamId: currentDream.id,
        totalTime: `${totalTime}ms`,
        repairApplied,
        renderable: renderValidation.renderable,
        stepsCompleted: processingSteps.length,
      });

      // Store processing history
      this.processingHistory.set(requestId, {
        dreamId: currentDream.id,
        processingSteps,
        totalTime,
        timestamp: new Date().toISOString(),
      });

      return response;
    } catch (error) {
      logger.error('Enhanced response processing failed', {
        requestId,
        error: error.message,
        stack: error.stack,
        dreamId: currentDream?.id,
      });

      // Return error response with debug info
      return this.createErrorResponse(error, originalRequest, processingSteps);
    }
  }

  /**
   * Perform final validation before sending to frontend
   * Ensures all required fields for 3D rendering are present
   */
  async performFinalValidation(dream, requestId) {
    logger.debug('Performing final validation', {
      requestId,
      dreamId: dream?.id,
    });

    // Use unified validator for comprehensive validation
    const validation = this.validator.validateDreamObject(dream);

    // Additional checks for frontend requirements
    const frontendErrors = [];

    // Check for empty arrays (critical for rendering)
    if (!dream.structures || dream.structures.length === 0) {
      frontendErrors.push({
        field: 'structures',
        error: 'EMPTY_STRUCTURES_ARRAY',
        message: 'Dream must have at least one structure for 3D rendering',
        severity: 'critical',
      });
    }

    if (!dream.entities || dream.entities.length === 0) {
      frontendErrors.push({
        field: 'entities',
        error: 'EMPTY_ENTITIES_ARRAY',
        message: 'Dream must have at least one entity for 3D rendering',
        severity: 'critical',
      });
    }

    // Check cinematography has shots
    if (
      !dream.cinematography ||
      !dream.cinematography.shots ||
      dream.cinematography.shots.length === 0
    ) {
      frontendErrors.push({
        field: 'cinematography.shots',
        error: 'NO_CAMERA_SHOTS',
        message: 'Cinematography must have at least one shot',
        severity: 'critical',
      });
    }

    // Check environment exists
    if (!dream.environment || typeof dream.environment !== 'object') {
      frontendErrors.push({
        field: 'environment',
        error: 'MISSING_ENVIRONMENT',
        message: 'Environment configuration is required for rendering',
        severity: 'critical',
      });
    }

    // Check render config exists
    if (!dream.render || typeof dream.render !== 'object') {
      frontendErrors.push({
        field: 'render',
        error: 'MISSING_RENDER_CONFIG',
        message: 'Render configuration is required',
        severity: 'critical',
      });
    }

    const allErrors = [...validation.errors, ...frontendErrors];

    logger.debug('Final validation completed', {
      requestId,
      dreamId: dream?.id,
      valid: allErrors.length === 0,
      errorCount: allErrors.length,
      criticalErrors: allErrors.filter((e) => e.severity === 'critical').length,
    });

    return {
      valid: allErrors.length === 0,
      errors: allErrors,
      errorCount: allErrors.length,
      validation,
    };
  }

  /**
   * Apply final repair if validation fails
   * Uses original request context to generate missing content
   */
  async applyFinalRepair(dream, originalRequest, validationResult) {
    logger.info('Applying final repair', {
      dreamId: dream?.id,
      errorCount: validationResult.errorCount,
      hasOriginalRequest: !!originalRequest,
    });

    const strategies = [];
    let repairedDream = { ...dream };

    // Ensure basic required fields
    if (!repairedDream.id) {
      repairedDream.id = uuidv4();
      strategies.push('generated_id');
    }

    if (!repairedDream.title) {
      repairedDream.title = originalRequest.text
        ? originalRequest.text.substring(0, 50)
        : 'Generated Dream';
      strategies.push('generated_title');
    }

    if (!repairedDream.style) {
      repairedDream.style = originalRequest.style || 'ethereal';
      strategies.push('default_style');
    }

    // Repair structures if missing or empty
    if (!repairedDream.structures || repairedDream.structures.length === 0) {
      repairedDream.structures = this.generateDefaultStructures(
        originalRequest.style || repairedDream.style
      );
      strategies.push('generated_structures');
    }

    // Repair entities if missing or empty
    if (!repairedDream.entities || repairedDream.entities.length === 0) {
      repairedDream.entities = this.generateDefaultEntities(
        originalRequest.style || repairedDream.style
      );
      strategies.push('generated_entities');
    }

    // Repair cinematography if missing
    if (
      !repairedDream.cinematography ||
      !repairedDream.cinematography.shots ||
      repairedDream.cinematography.shots.length === 0
    ) {
      repairedDream.cinematography = this.generateDefaultCinematography(
        repairedDream.structures
      );
      strategies.push('generated_cinematography');
    }

    // Repair environment if missing
    if (!repairedDream.environment) {
      repairedDream.environment = this.generateDefaultEnvironment(
        originalRequest.style || repairedDream.style
      );
      strategies.push('generated_environment');
    }

    // Repair render config if missing
    if (!repairedDream.render) {
      repairedDream.render = this.generateDefaultRenderConfig();
      strategies.push('generated_render_config');
    }

    // Ensure timestamps
    if (!repairedDream.created) {
      repairedDream.created = new Date().toISOString();
      strategies.push('generated_created_timestamp');
    }

    if (!repairedDream.source) {
      repairedDream.source = 'express-repair';
      strategies.push('set_source');
    }

    logger.info('Final repair completed', {
      dreamId: repairedDream.id,
      strategiesApplied: strategies.length,
      strategies,
    });

    return {
      dream: repairedDream,
      strategies,
    };
  }

  /**
   * Validate dream for 3D rendering requirements
   * Checks structure positions, entity parameters, camera settings
   */
  async validateForRendering(dream, requestId) {
    logger.debug('Validating for rendering', {
      requestId,
      dreamId: dream?.id,
    });

    const issues = [];
    const warnings = [];

    // Check if dream is renderable (has minimum required data)
    const renderableCheck = this.validator.isRenderable(dream);

    if (!renderableCheck.renderable) {
      issues.push(...renderableCheck.errors);
    }

    // Validate structure positions are within reasonable bounds
    if (dream.structures) {
      dream.structures.forEach((structure, index) => {
        if (structure.pos) {
          const [x, y, z] = structure.pos;

          // Check for NaN or Infinity
          if (!isFinite(x) || !isFinite(y) || !isFinite(z)) {
            issues.push({
              field: `structures[${index}].pos`,
              message: `Structure position contains invalid values: [${x}, ${y}, ${z}]`,
              severity: 'critical',
            });
          }

          // Check for extreme positions
          if (Math.abs(x) > 1000 || Math.abs(y) > 1000 || Math.abs(z) > 1000) {
            warnings.push({
              field: `structures[${index}].pos`,
              message: `Structure position is very far from origin: [${x}, ${y}, ${z}]`,
              severity: 'warning',
            });
          }
        } else {
          issues.push({
            field: `structures[${index}].pos`,
            message: 'Structure missing position array',
            severity: 'critical',
          });
        }

        // Validate scale
        if (structure.scale !== undefined) {
          const scale = Array.isArray(structure.scale)
            ? structure.scale[0]
            : structure.scale;
          if (!isFinite(scale) || scale <= 0) {
            issues.push({
              field: `structures[${index}].scale`,
              message: `Invalid scale value: ${scale}`,
              severity: 'critical',
            });
          }
        }
      });
    }

    // Validate entity parameters
    if (dream.entities) {
      dream.entities.forEach((entity, index) => {
        if (!entity.params || typeof entity.params !== 'object') {
          issues.push({
            field: `entities[${index}].params`,
            message: 'Entity missing params object',
            severity: 'critical',
          });
        } else {
          // Check for valid numeric parameters
          ['speed', 'glow', 'size'].forEach((param) => {
            if (
              entity.params[param] !== undefined &&
              !isFinite(entity.params[param])
            ) {
              issues.push({
                field: `entities[${index}].params.${param}`,
                message: `Invalid ${param} value: ${entity.params[param]}`,
                severity: 'critical',
              });
            }
          });
        }

        // Check entity count
        if (!entity.count || entity.count < 1) {
          issues.push({
            field: `entities[${index}].count`,
            message: 'Entity count must be at least 1',
            severity: 'critical',
          });
        }
      });
    }

    // Validate cinematography shots
    if (dream.cinematography && dream.cinematography.shots) {
      dream.cinematography.shots.forEach((shot, index) => {
        // Validate duration
        if (!shot.duration || shot.duration < 1) {
          issues.push({
            field: `cinematography.shots[${index}].duration`,
            message: 'Shot duration must be at least 1 second',
            severity: 'critical',
          });
        }

        // Validate positions if present
        if (shot.startPos) {
          if (!Array.isArray(shot.startPos) || shot.startPos.length !== 3) {
            issues.push({
              field: `cinematography.shots[${index}].startPos`,
              message: 'Start position must be array of 3 numbers',
              severity: 'critical',
            });
          } else if (!shot.startPos.every(isFinite)) {
            issues.push({
              field: `cinematography.shots[${index}].startPos`,
              message: 'Start position contains invalid values',
              severity: 'critical',
            });
          }
        }

        if (shot.endPos) {
          if (!Array.isArray(shot.endPos) || shot.endPos.length !== 3) {
            issues.push({
              field: `cinematography.shots[${index}].endPos`,
              message: 'End position must be array of 3 numbers',
              severity: 'critical',
            });
          } else if (!shot.endPos.every(isFinite)) {
            issues.push({
              field: `cinematography.shots[${index}].endPos`,
              message: 'End position contains invalid values',
              severity: 'critical',
            });
          }
        }

        // Validate target references
        if (shot.target) {
          const structureIds = dream.structures.map((s) => s.id);
          const entityIds = dream.entities.map((e) => e.id);

          if (
            !structureIds.includes(shot.target) &&
            !entityIds.includes(shot.target)
          ) {
            warnings.push({
              field: `cinematography.shots[${index}].target`,
              message: `Shot target '${shot.target}' does not reference existing structure or entity`,
              severity: 'warning',
            });
          }
        }
      });
    }

    // Validate render configuration
    if (dream.render) {
      if (dream.render.res) {
        if (!Array.isArray(dream.render.res) || dream.render.res.length !== 2) {
          issues.push({
            field: 'render.res',
            message: 'Resolution must be array of 2 numbers [width, height]',
            severity: 'critical',
          });
        } else if (
          !dream.render.res.every((v) => Number.isInteger(v) && v > 0)
        ) {
          issues.push({
            field: 'render.res',
            message: 'Resolution values must be positive integers',
            severity: 'critical',
          });
        }
      }

      if (
        dream.render.fps &&
        (!Number.isInteger(dream.render.fps) || dream.render.fps < 1)
      ) {
        issues.push({
          field: 'render.fps',
          message: 'FPS must be a positive integer',
          severity: 'critical',
        });
      }
    }

    const renderable = issues.length === 0;

    logger.debug('Render validation completed', {
      requestId,
      dreamId: dream?.id,
      renderable,
      issueCount: issues.length,
      warningCount: warnings.length,
    });

    return {
      renderable,
      issues,
      warnings,
      issueCount: issues.length,
      warningCount: warnings.length,
    };
  }

  /**
   * Generate comprehensive debug information
   * Shows dream structure details, processing history, validation results
   */
  generateDebugInformation(dream, processingSteps, originalRequest) {
    const debugInfo = {
      dreamId: dream?.id,
      timestamp: new Date().toISOString(),

      // Field counts
      fieldCounts: {
        structures: dream.structures?.length || 0,
        entities: dream.entities?.length || 0,
        cinematographyShots: dream.cinematography?.shots?.length || 0,
        totalEntityCount:
          dream.entities?.reduce((sum, e) => sum + (e.count || 0), 0) || 0,
        hasEnvironment: !!dream.environment,
        hasRenderConfig: !!dream.render,
        hasMetadata: !!dream.metadata,
      },

      // Structure details
      structureDetails:
        dream.structures?.map((s, i) => ({
          index: i,
          id: s.id,
          type: s.type,
          hasPosition: !!s.pos,
          hasRotation: !!s.rotation,
          hasScale: s.scale !== undefined,
          featureCount: s.features?.length || 0,
        })) || [],

      // Entity details
      entityDetails:
        dream.entities?.map((e, i) => ({
          index: i,
          id: e.id,
          type: e.type,
          count: e.count,
          hasParams: !!e.params,
          paramKeys: e.params ? Object.keys(e.params) : [],
        })) || [],

      // Cinematography details
      cinematographyDetails: {
        duration: dream.cinematography?.durationSec,
        shotCount: dream.cinematography?.shots?.length || 0,
        shots:
          dream.cinematography?.shots?.map((s, i) => ({
            index: i,
            type: s.type,
            duration: s.duration,
            hasTarget: !!s.target,
            target: s.target,
            hasStartPos: !!s.startPos,
            hasEndPos: !!s.endPos,
          })) || [],
      },

      // Environment details
      environmentDetails: dream.environment
        ? {
            preset: dream.environment.preset,
            fog: dream.environment.fog,
            hasSkyColor: !!dream.environment.skyColor,
            ambientLight: dream.environment.ambientLight,
          }
        : null,

      // Render config details
      renderDetails: dream.render
        ? {
            resolution: dream.render.res,
            fps: dream.render.fps,
            quality: dream.render.quality,
          }
        : null,

      // Processing history
      processingHistory: processingSteps.map((step) => ({
        step: step.step,
        timestamp: step.timestamp,
        duration: step.duration ? `${step.duration}ms` : 'N/A',
        result: step.result,
      })),

      // Original request context
      originalRequest: originalRequest
        ? {
            text: originalRequest.text?.substring(0, 100),
            style: originalRequest.style,
            requestId: originalRequest.requestId,
          }
        : null,

      // Validation summary
      validationSummary: this.validator.generateValidationReport(dream).summary,
    };

    return debugInfo;
  }

  /**
   * Create final renderable response
   */
  createRenderableResponse(dream, processingInfo, originalRequest) {
    const response = {
      success: true,
      dream: dream,

      // Validation status
      validation: {
        valid: processingInfo.validationResult.valid,
        errorCount: processingInfo.validationResult.errorCount,
        errors: processingInfo.validationResult.errors,
      },

      // Render status
      rendering: {
        renderable: processingInfo.renderValidation.renderable,
        issues: processingInfo.renderValidation.issues,
        warnings: processingInfo.renderValidation.warnings,
      },

      // Processing metadata
      metadata: {
        repairApplied: processingInfo.repairApplied,
        processingSteps: processingInfo.processingSteps.length,
        totalProcessingTime: processingInfo.processingSteps.reduce(
          (sum, step) => sum + (step.duration || 0),
          0
        ),
        timestamp: new Date().toISOString(),
      },

      // Debug information (can be disabled in production)
      debug: processingInfo.debugInfo,
    };

    return response;
  }

  /**
   * Create error response with debug information
   */
  createErrorResponse(error, originalRequest, processingSteps) {
    return {
      success: false,
      error: {
        message: error.message,
        type: error.constructor.name,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      },
      metadata: {
        timestamp: new Date().toISOString(),
        processingSteps: processingSteps.length,
        originalRequest: originalRequest
          ? {
              text: originalRequest.text?.substring(0, 100),
              style: originalRequest.style,
            }
          : null,
      },
      debug: {
        processingHistory: processingSteps,
      },
    };
  }

  /**
   * Generate default structures based on style
   */
  generateDefaultStructures(style) {
    const structureTypes = {
      ethereal: 'floating_platform',
      cyberpunk: 'crystal_tower',
      surreal: 'twisted_house',
      fantasy: 'crystal_spire',
      nightmare: 'organic_tree',
    };

    return [
      {
        id: `structure-${uuidv4().substring(0, 8)}`,
        type: structureTypes[style] || 'floating_platform',
        pos: [0, 0, 0],
        rotation: [0, 0, 0],
        scale: 1,
        features: ['glowing_edges'],
      },
    ];
  }

  /**
   * Generate default entities based on style
   */
  generateDefaultEntities(style) {
    const entityTypes = {
      ethereal: 'floating_orbs',
      cyberpunk: 'particle_swarm',
      surreal: 'geometric_shapes',
      fantasy: 'light_butterflies',
      nightmare: 'shadow_figures',
    };

    return [
      {
        id: `entity-${uuidv4().substring(0, 8)}`,
        type: entityTypes[style] || 'floating_orbs',
        count: 10,
        params: {
          speed: 1,
          glow: 0.5,
          size: 1,
          color: '#ffffff',
        },
      },
    ];
  }

  /**
   * Generate default cinematography
   */
  generateDefaultCinematography(structures) {
    const targetId =
      structures && structures.length > 0 ? structures[0].id : null;

    return {
      durationSec: 30,
      shots: [
        {
          type: 'establish',
          target: targetId,
          duration: 10,
          startPos: [0, 5, 10],
          endPos: [0, 5, 10],
        },
        {
          type: 'orbit',
          target: targetId,
          duration: 20,
          startPos: [10, 5, 0],
          endPos: [-10, 5, 0],
        },
      ],
    };
  }

  /**
   * Generate default environment based on style
   */
  generateDefaultEnvironment(style) {
    const presets = {
      ethereal: 'dawn',
      cyberpunk: 'night',
      surreal: 'dusk',
      fantasy: 'golden_hour',
      nightmare: 'void',
    };

    return {
      preset: presets[style] || 'dusk',
      fog: 0.3,
      skyColor: '#87CEEB',
      ambientLight: 0.5,
    };
  }

  /**
   * Generate default render configuration
   */
  generateDefaultRenderConfig() {
    return {
      res: [1920, 1080],
      fps: 30,
      quality: 'medium',
    };
  }

  /**
   * Get processing history for a request
   */
  getProcessingHistory(requestId) {
    return this.processingHistory.get(requestId);
  }

  /**
   * Clear old processing history
   */
  clearOldHistory(maxAge = 3600000) {
    const now = Date.now();
    let cleared = 0;

    for (const [requestId, history] of this.processingHistory.entries()) {
      const age = now - new Date(history.timestamp).getTime();
      if (age > maxAge) {
        this.processingHistory.delete(requestId);
        cleared++;
      }
    }

    logger.info('Cleared old processing history', {
      cleared,
      remaining: this.processingHistory.size,
    });

    return cleared;
  }
}

// Create singleton instance
const enhancedResponseProcessor = new EnhancedResponseProcessor();

module.exports = {
  EnhancedResponseProcessor,
  enhancedResponseProcessor,
};
