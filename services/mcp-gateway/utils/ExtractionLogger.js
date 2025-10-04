/**
 * Extraction Logger
 *
 * Provides comprehensive structured logging for the extraction pipeline
 * with request context, log level controls, and response truncation.
 */

const { logger } = require('./logger');
const { v4: uuidv4 } = require('uuid');

class ExtractionLogger {
  constructor(options = {}) {
    this.options = {
      enableLogging: options.enableLogging !== false,
      logLevel: options.logLevel || process.env.LOG_LEVEL || 'info',
      maxResponseLength: options.maxResponseLength || 500,
      includeStackTraces: options.includeStackTraces !== false,
      ...options,
    };

    // Log level hierarchy
    this.logLevels = {
      debug: 0,
      info: 1,
      warn: 2,
      error: 3,
    };

    this.currentLogLevel = this.logLevels[this.options.logLevel] || 1;
  }

  /**
   * Check if a log level should be logged
   * @param {string} level - Log level to check
   * @returns {boolean} True if should log
   */
  shouldLog(level) {
    if (!this.options.enableLogging) {
      return false;
    }
    return this.logLevels[level] >= this.currentLogLevel;
  }

  /**
   * Create request context for logging
   * @param {Object} options - Context options
   * @returns {Object} Request context
   */
  createRequestContext(options = {}) {
    return {
      requestId: options.requestId || uuidv4(),
      provider: options.provider || 'unknown',
      operation: options.operation || 'unknown',
      timestamp: new Date().toISOString(),
      ...options,
    };
  }

  /**
   * Truncate response for logging
   * @param {*} response - Response to truncate
   * @param {number} maxLength - Maximum length
   * @returns {string} Truncated response
   */
  truncateResponse(response, maxLength = null) {
    const max = maxLength || this.options.maxResponseLength;

    if (!response) {
      return 'null';
    }

    let responseStr;
    if (typeof response === 'string') {
      responseStr = response;
    } else if (typeof response === 'object') {
      try {
        responseStr = JSON.stringify(response);
      } catch (e) {
        responseStr = String(response);
      }
    } else {
      responseStr = String(response);
    }

    if (responseStr.length > max) {
      return (
        responseStr.substring(0, max) +
        `... [truncated, total length: ${responseStr.length}]`
      );
    }

    return responseStr;
  }

  /**
   * Log extraction start
   * @param {Object} context - Request context
   * @param {*} response - Response being extracted
   */
  logExtractionStart(context, response) {
    if (!this.shouldLog('info')) return;

    logger.info('Starting content extraction', {
      ...context,
      responseType: typeof response,
      hasResponse: !!response,
      responseIsObject: response && typeof response === 'object',
      responseIsArray: Array.isArray(response),
      responseIsString: typeof response === 'string',
    });
  }

  /**
   * Log extraction pattern attempt
   * @param {Object} context - Request context
   * @param {string} pattern - Pattern name
   * @param {string} description - Pattern description
   * @param {boolean} success - Success status
   * @param {string} reason - Reason for success/failure
   */
  logPatternAttempt(context, pattern, description, success, reason) {
    const level = success ? 'info' : 'debug';
    if (!this.shouldLog(level)) return;

    logger[level](`Extraction pattern ${success ? 'succeeded' : 'failed'}`, {
      ...context,
      pattern,
      description,
      success,
      reason,
    });
  }

  /**
   * Log extraction success
   * @param {Object} context - Request context
   * @param {string} successfulPattern - Pattern that succeeded
   * @param {Object} extractedData - Extracted data
   */
  logExtractionSuccess(context, successfulPattern, extractedData) {
    if (!this.shouldLog('info')) return;

    logger.info('Content extraction succeeded', {
      ...context,
      successfulPattern,
      hasId: !!extractedData?.id,
      hasStructures: !!extractedData?.structures,
      hasEntities: !!extractedData?.entities,
      structureCount: Array.isArray(extractedData?.structures)
        ? extractedData.structures.length
        : 0,
      entityCount: Array.isArray(extractedData?.entities)
        ? extractedData.entities.length
        : 0,
    });
  }

  /**
   * Log extraction failure with comprehensive details
   * @param {Object} context - Request context
   * @param {*} response - Response that failed extraction
   * @param {Array} attemptedPatterns - Patterns that were attempted
   */
  logExtractionFailure(context, response, attemptedPatterns = []) {
    if (!this.shouldLog('error')) return;

    const failureDetails = {
      ...context,
      responseType: typeof response,
      totalAttempts: attemptedPatterns.length,
      attemptedPatterns: attemptedPatterns.map((a) => ({
        pattern: a.pattern,
        description: a.description,
        reason: a.reason,
      })),
    };

    // Add response structure details if it's an object
    if (response && typeof response === 'object') {
      failureDetails.topLevelKeys = Object.keys(response);
      failureDetails.keyCount = failureDetails.topLevelKeys.length;
      failureDetails.hasCommonFields = {
        data: 'data' in response,
        content: 'content' in response,
        id: 'id' in response,
        structures: 'structures' in response,
        entities: 'entities' in response,
        choices: 'choices' in response,
        message: 'message' in response,
        text: 'text' in response,
        output: 'output' in response,
        result: 'result' in response,
      };
    }

    // Add truncated response sample
    failureDetails.responseSample = this.truncateResponse(response);

    logger.error('All extraction patterns failed', failureDetails);
  }

  /**
   * Log validation start
   * @param {Object} context - Request context
   * @param {Object} dreamData - Data being validated
   */
  logValidationStart(context, dreamData) {
    if (!this.shouldLog('debug')) return;

    logger.debug('Starting validation', {
      ...context,
      hasId: !!dreamData?.id,
      hasStructures: !!dreamData?.structures,
      hasEntities: !!dreamData?.entities,
      hasCinematography: !!dreamData?.cinematography,
      hasEnvironment: !!dreamData?.environment,
      hasRender: !!dreamData?.render,
    });
  }

  /**
   * Log validation result
   * @param {Object} context - Request context
   * @param {Object} validationResult - Validation result
   */
  logValidationResult(context, validationResult) {
    const level = validationResult.valid ? 'info' : 'warn';
    if (!this.shouldLog(level)) return;

    const logData = {
      ...context,
      valid: validationResult.valid,
      errorCount: validationResult.errorCount || 0,
      warningCount: validationResult.warningCount || 0,
      validationTime: validationResult.validationTime || 0,
    };

    // Add error details if validation failed
    if (!validationResult.valid && validationResult.errors) {
      logData.errors = validationResult.errors.slice(0, 5).map((e) => ({
        field: e.field,
        error: e.error,
        message: e.message,
        severity: e.severity,
      }));
    }

    logger[level]('Validation completed', logData);
  }

  /**
   * Log repair start
   * @param {Object} context - Request context
   * @param {Array} errors - Validation errors to repair
   */
  logRepairStart(context, errors) {
    if (!this.shouldLog('info')) return;

    logger.info('Starting content repair', {
      ...context,
      errorCount: errors.length,
      errorTypes: [...new Set(errors.map((e) => e.error))],
    });
  }

  /**
   * Log repair result
   * @param {Object} context - Request context
   * @param {Object} repairResult - Repair result
   */
  logRepairResult(context, repairResult) {
    const level = repairResult.success ? 'info' : 'error';
    if (!this.shouldLog(level)) return;

    logger[level]('Content repair completed', {
      ...context,
      success: repairResult.success,
      strategiesApplied: repairResult.appliedStrategies || [],
      strategiesCount: repairResult.appliedStrategies?.length || 0,
      remainingErrors: repairResult.errors?.length || 0,
      processingTime: repairResult.processingTime || 0,
      attempts: repairResult.attempts || 0,
    });
  }

  /**
   * Log transformation start
   * @param {Object} context - Request context
   * @param {*} response - Response being transformed
   */
  logTransformationStart(context, response) {
    if (!this.shouldLog('info')) return;

    logger.info('Starting response transformation', {
      ...context,
      responseType: typeof response,
      hasResponse: !!response,
    });
  }

  /**
   * Log transformation success
   * @param {Object} context - Request context
   * @param {Object} transformedData - Transformed data
   * @param {number} transformationTime - Time taken
   */
  logTransformationSuccess(context, transformedData, transformationTime) {
    if (!this.shouldLog('info')) return;

    logger.info('Response transformation completed', {
      ...context,
      transformationTime,
      validationPassed: transformedData.metadata?.validationPassed,
      repairApplied: transformedData.metadata?.repairApplied,
      structureCount: transformedData.data?.structures?.length || 0,
      entityCount: transformedData.data?.entities?.length || 0,
      errorCount: transformedData.metadata?.errorCount || 0,
      warningCount: transformedData.metadata?.warningCount || 0,
    });
  }

  /**
   * Log transformation failure
   * @param {Object} context - Request context
   * @param {Error} error - Error that occurred
   * @param {number} transformationTime - Time taken
   */
  logTransformationFailure(context, error, transformationTime) {
    if (!this.shouldLog('error')) return;

    const errorData = {
      ...context,
      error: error.message,
      transformationTime,
    };

    if (this.options.includeStackTraces) {
      errorData.stack = error.stack;
    }

    logger.error('Response transformation failed', errorData);
  }

  /**
   * Log response structure inspection
   * @param {Object} context - Request context
   * @param {Object} inspection - Inspection result
   */
  logStructureInspection(context, inspection) {
    if (!this.shouldLog('debug')) return;

    logger.debug('Response structure inspection', {
      ...context,
      responseType: inspection.responseType,
      topLevelKeys: inspection.topLevelKeys,
      keyCount: inspection.topLevelKeys?.length || 0,
      hasCommonFields: inspection.hasCommonFields,
      detectedFormat: inspection.detectedFormat,
    });
  }

  /**
   * Log nested structure details
   * @param {Object} context - Request context
   * @param {Object} nestedStructure - Nested structure
   */
  logNestedStructure(context, nestedStructure) {
    if (!this.shouldLog('debug')) return;

    logger.debug('Response nested structure', {
      ...context,
      structure: nestedStructure,
    });
  }

  /**
   * Log response sample
   * @param {Object} context - Request context
   * @param {*} response - Response to sample
   */
  logResponseSample(context, response) {
    if (!this.shouldLog('debug')) return;

    logger.debug('Response sample', {
      ...context,
      sample: this.truncateResponse(response),
    });
  }

  /**
   * Log extraction metrics
   * @param {Object} context - Request context
   * @param {Object} metrics - Extraction metrics
   */
  logExtractionMetrics(context, metrics) {
    if (!this.shouldLog('info')) return;

    logger.info('Extraction metrics', {
      ...context,
      totalExtractions: metrics.totalExtractions,
      successfulExtractions: metrics.successfulExtractions,
      failedExtractions: metrics.failedExtractions,
      successRate: metrics.successRate,
      failureRate: metrics.failureRate,
      lastSuccessfulPattern: metrics.lastSuccessfulPattern,
    });
  }

  /**
   * Log error with context
   * @param {Object} context - Request context
   * @param {string} message - Error message
   * @param {Error} error - Error object
   */
  logError(context, message, error) {
    if (!this.shouldLog('error')) return;

    const errorData = {
      ...context,
      message,
      error: error.message,
    };

    if (this.options.includeStackTraces) {
      errorData.stack = error.stack;
    }

    logger.error(message, errorData);
  }

  /**
   * Log warning with context
   * @param {Object} context - Request context
   * @param {string} message - Warning message
   * @param {Object} data - Additional data
   */
  logWarning(context, message, data = {}) {
    if (!this.shouldLog('warn')) return;

    logger.warn(message, {
      ...context,
      ...data,
    });
  }

  /**
   * Log info with context
   * @param {Object} context - Request context
   * @param {string} message - Info message
   * @param {Object} data - Additional data
   */
  logInfo(context, message, data = {}) {
    if (!this.shouldLog('info')) return;

    logger.info(message, {
      ...context,
      ...data,
    });
  }

  /**
   * Log debug with context
   * @param {Object} context - Request context
   * @param {string} message - Debug message
   * @param {Object} data - Additional data
   */
  logDebug(context, message, data = {}) {
    if (!this.shouldLog('debug')) return;

    logger.debug(message, {
      ...context,
      ...data,
    });
  }

  /**
   * Set log level
   * @param {string} level - New log level
   */
  setLogLevel(level) {
    if (this.logLevels[level] !== undefined) {
      this.options.logLevel = level;
      this.currentLogLevel = this.logLevels[level];
    }
  }

  /**
   * Get current log level
   * @returns {string} Current log level
   */
  getLogLevel() {
    return this.options.logLevel;
  }
}

module.exports = ExtractionLogger;
