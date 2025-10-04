/**
 * MCP Gateway Validator
 *
 * Wrapper class that integrates shared UnifiedValidator into MCP Gateway service.
 * Provides consistent validation with proper metrics recording to shared ValidationMonitor.
 */

const {
  DreamSchema,
  UnifiedValidator,
  validationMonitor,
} = require('../../../shared');
const { logger } = require('../utils/logger');

class MCPGatewayValidator {
  constructor(options = {}) {
    this.options = {
      strictMode: options.strictMode !== false,
      logErrors: options.logErrors !== false,
      serviceName: 'mcp-gateway',
      ...options,
    };

    // Initialize shared UnifiedValidator
    this.validator = new UnifiedValidator({
      strictMode: this.options.strictMode,
      logErrors: this.options.logErrors,
    });

    this.metrics = {
      totalValidations: 0,
      successfulValidations: 0,
      failedValidations: 0,
      renderabilityChecks: 0,
      renderableCount: 0,
    };
  }

  /**
   * Validate provider response using shared UnifiedValidator
   * @param {Object} dreamData - Dream object to validate
   * @param {string} provider - Provider name (cerebras, openai, etc.)
   * @param {Object} options - Additional validation options
   * @returns {Object} Validation result
   */
  validateProviderResponse(dreamData, provider, options = {}) {
    const startTime = Date.now();
    this.metrics.totalValidations++;

    try {
      // Use shared UnifiedValidator for validation
      const validationResult = this.validator.validateDreamObject(
        dreamData,
        options
      );

      const validationTime = Date.now() - startTime;

      // Record metrics to shared ValidationMonitor
      validationMonitor.recordValidation(
        this.options.serviceName,
        validationResult,
        {
          provider,
          dreamId: dreamData?.id,
          operation: options.operation || 'validateProviderResponse',
          ...options.context,
        }
      );

      // Update local metrics
      if (validationResult.valid) {
        this.metrics.successfulValidations++;
      } else {
        this.metrics.failedValidations++;
      }

      // Log validation results
      if (this.options.logErrors && !validationResult.valid) {
        logger.warn('Provider response validation failed', {
          provider,
          errorCount: validationResult.errorCount,
          criticalCount: validationResult.criticalCount || 0,
          warningCount: validationResult.warningCount || 0,
          validationTime,
          errors: validationResult.errors.slice(0, 5), // Log first 5 errors
        });
      } else if (this.options.logErrors) {
        logger.debug('Provider response validation passed', {
          provider,
          validationTime,
          dreamId: dreamData?.id,
        });
      }

      return {
        ...validationResult,
        validationTime,
        provider,
      };
    } catch (error) {
      this.metrics.failedValidations++;

      logger.error('Validation error in MCPGatewayValidator', {
        provider,
        error: error.message,
        stack: error.stack,
      });

      const errorResult = {
        valid: false,
        errors: [
          {
            field: 'validation_system',
            error: 'VALIDATION_SYSTEM_ERROR',
            message: `Validation system error: ${error.message}`,
            severity: 'critical',
          },
        ],
        errorCount: 1,
        validationTime: Date.now() - startTime,
        provider,
      };

      // Record error to shared ValidationMonitor
      validationMonitor.recordValidation(
        this.options.serviceName,
        errorResult,
        {
          provider,
          dreamId: dreamData?.id,
          operation: options.operation || 'validateProviderResponse',
          error: error.message,
        }
      );

      return errorResult;
    }
  }

  /**
   * Check if dream is renderable using shared validator
   * @param {Object} dreamData - Dream object to check
   * @returns {Object} Renderability check result
   */
  checkRenderability(dreamData) {
    const startTime = Date.now();
    this.metrics.renderabilityChecks++;

    try {
      // Use shared UnifiedValidator's renderability check
      const renderCheck = this.validator.isRenderable(dreamData);

      const validationTime = Date.now() - startTime;

      if (renderCheck.renderable) {
        this.metrics.renderableCount++;
      }

      // Log renderability check results
      if (this.options.logErrors && !renderCheck.renderable) {
        logger.warn('Dream is not renderable', {
          errorCount: renderCheck.errorCount,
          errors: renderCheck.errors.slice(0, 5),
          validationTime,
          dreamId: dreamData?.id,
        });
      } else if (this.options.logErrors) {
        logger.debug('Dream is renderable', {
          validationTime,
          dreamId: dreamData?.id,
        });
      }

      return {
        ...renderCheck,
        validationTime,
      };
    } catch (error) {
      logger.error('Renderability check error', {
        error: error.message,
        stack: error.stack,
      });

      return {
        renderable: false,
        errors: [
          {
            field: 'validation_system',
            message: `Renderability check failed: ${error.message}`,
            severity: 'critical',
          },
        ],
        errorCount: 1,
        validationTime: Date.now() - startTime,
      };
    }
  }

  /**
   * Generate comprehensive validation report using shared validator
   * @param {Object} dreamData - Dream object to validate
   * @returns {Object} Detailed validation report
   */
  generateReport(dreamData) {
    try {
      // Use shared UnifiedValidator's report generation
      const report = this.validator.generateValidationReport(dreamData);

      // Log report generation
      if (this.options.logErrors) {
        logger.info('Validation report generated', {
          dreamId: report.dreamId,
          isValid: report.summary.isValid,
          totalErrors: report.summary.totalErrors,
          criticalErrors: report.summary.criticalErrors,
          sectionsWithErrors: report.summary.sectionsWithErrors,
        });
      }

      return report;
    } catch (error) {
      logger.error('Report generation error', {
        error: error.message,
        stack: error.stack,
      });

      return {
        timestamp: new Date().toISOString(),
        dreamId: dreamData?.id || 'unknown',
        error: `Report generation failed: ${error.message}`,
        overallValidation: {
          valid: false,
          errors: [
            {
              field: 'validation_system',
              error: 'REPORT_GENERATION_ERROR',
              message: error.message,
              severity: 'critical',
            },
          ],
          errorCount: 1,
        },
      };
    }
  }

  /**
   * Validate structures array using shared validator
   * @param {Array} structures - Structures to validate
   * @returns {Object} Validation result
   */
  validateStructures(structures) {
    try {
      return this.validator.validateStructures(structures);
    } catch (error) {
      logger.error('Structures validation error', {
        error: error.message,
      });

      return {
        valid: false,
        errors: [
          {
            field: 'structures',
            error: 'VALIDATION_ERROR',
            message: error.message,
            severity: 'critical',
          },
        ],
        errorCount: 1,
      };
    }
  }

  /**
   * Validate entities array using shared validator
   * @param {Array} entities - Entities to validate
   * @returns {Object} Validation result
   */
  validateEntities(entities) {
    try {
      return this.validator.validateEntities(entities);
    } catch (error) {
      logger.error('Entities validation error', {
        error: error.message,
      });

      return {
        valid: false,
        errors: [
          {
            field: 'entities',
            error: 'VALIDATION_ERROR',
            message: error.message,
            severity: 'critical',
          },
        ],
        errorCount: 1,
      };
    }
  }

  /**
   * Validate cinematography configuration using shared validator
   * @param {Object} cinematography - Cinematography to validate
   * @returns {Object} Validation result
   */
  validateCinematography(cinematography) {
    try {
      return this.validator.validateCinematography(cinematography);
    } catch (error) {
      logger.error('Cinematography validation error', {
        error: error.message,
      });

      return {
        valid: false,
        errors: [
          {
            field: 'cinematography',
            error: 'VALIDATION_ERROR',
            message: error.message,
            severity: 'critical',
          },
        ],
        errorCount: 1,
      };
    }
  }

  /**
   * Validate environment configuration using shared validator
   * @param {Object} environment - Environment to validate
   * @returns {Object} Validation result
   */
  validateEnvironment(environment) {
    try {
      return this.validator.validateEnvironment(environment);
    } catch (error) {
      logger.error('Environment validation error', {
        error: error.message,
      });

      return {
        valid: false,
        errors: [
          {
            field: 'environment',
            error: 'VALIDATION_ERROR',
            message: error.message,
            severity: 'critical',
          },
        ],
        errorCount: 1,
      };
    }
  }

  /**
   * Validate render configuration using shared validator
   * @param {Object} render - Render config to validate
   * @returns {Object} Validation result
   */
  validateRenderConfig(render) {
    try {
      return this.validator.validateRenderConfig(render);
    } catch (error) {
      logger.error('Render config validation error', {
        error: error.message,
      });

      return {
        valid: false,
        errors: [
          {
            field: 'render',
            error: 'VALIDATION_ERROR',
            message: error.message,
            severity: 'critical',
          },
        ],
        errorCount: 1,
      };
    }
  }

  /**
   * Validate for specific use case using shared validator
   * @param {Object} dreamData - Dream object to validate
   * @param {string} useCase - Use case identifier (api-response, database-storage, cache)
   * @returns {Object} Validation result
   */
  validateForUseCase(dreamData, useCase) {
    try {
      return this.validator.validateForUseCase(dreamData, useCase);
    } catch (error) {
      logger.error('Use case validation error', {
        useCase,
        error: error.message,
      });

      return {
        valid: false,
        errors: [
          {
            field: 'validation_system',
            error: 'VALIDATION_ERROR',
            message: error.message,
            severity: 'critical',
          },
        ],
        errorCount: 1,
      };
    }
  }

  /**
   * Get validation metrics
   * @returns {Object} Metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      successRate:
        this.metrics.totalValidations > 0
          ? (this.metrics.successfulValidations /
              this.metrics.totalValidations) *
            100
          : 0,
      renderableRate:
        this.metrics.renderabilityChecks > 0
          ? (this.metrics.renderableCount / this.metrics.renderabilityChecks) *
            100
          : 0,
    };
  }

  /**
   * Reset metrics
   */
  resetMetrics() {
    this.metrics = {
      totalValidations: 0,
      successfulValidations: 0,
      failedValidations: 0,
      renderabilityChecks: 0,
      renderableCount: 0,
    };
  }

  /**
   * Get shared ValidationMonitor instance
   * @returns {Object} ValidationMonitor instance
   */
  getValidationMonitor() {
    return validationMonitor;
  }

  /**
   * Get shared DreamSchema
   * @returns {Object} DreamSchema
   */
  getDreamSchema() {
    return DreamSchema;
  }
}

module.exports = MCPGatewayValidator;
