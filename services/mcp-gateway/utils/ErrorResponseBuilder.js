/**
 * Error Response Builder
 *
 * Builds consistent error responses for the MCP Gateway /parse endpoint.
 * Ensures all error responses match the shared validation error format.
 */

const { logger } = require('./logger');

class ErrorResponseBuilder {
  constructor(options = {}) {
    this.options = {
      includeStackTrace: options.includeStackTrace || false,
      includeResponseSample: options.includeResponseSample !== false,
      maxSampleLength: options.maxSampleLength || 500,
      ...options,
    };
  }

  /**
   * Build extraction error response
   * @param {string} provider - Provider name
   * @param {*} response - Response that failed extraction
   * @param {Array} attemptedPatterns - Patterns that were attempted
   * @param {string} errorId - Unique error ID
   * @returns {Object} Error response
   */
  buildExtractionErrorResponse(
    provider,
    response,
    attemptedPatterns = [],
    errorId = null
  ) {
    const id = errorId || this.generateErrorId();

    const errorResponse = {
      success: false,
      error: 'Response extraction failed',
      errorId: id,
      details: {
        provider,
        message: 'Could not extract dream data from provider response',
        errorType: 'EXTRACTION_FAILURE',
        attemptedPatterns: attemptedPatterns.map((p) => ({
          pattern: p.pattern || p,
          success: p.success || false,
          error: p.error || null,
        })),
        responseType: typeof response,
        topLevelKeys:
          response && typeof response === 'object' ? Object.keys(response) : [],
        timestamp: new Date().toISOString(),
      },
    };

    // Add response sample if enabled
    if (this.options.includeResponseSample && response) {
      errorResponse.details.responseSample = this.getSampleResponse(response);
    }

    // Log extraction error
    logger.error('Extraction error response built', {
      errorId: id,
      provider,
      patternsAttempted: attemptedPatterns.length,
      responseType: typeof response,
    });

    return errorResponse;
  }

  /**
   * Build empty response error response
   * @param {string} provider - Provider name
   * @param {*} response - Empty response
   * @param {string} errorId - Unique error ID
   * @returns {Object} Error response
   */
  buildEmptyResponseError(provider, response, errorId = null) {
    const id = errorId || this.generateErrorId();

    const errorResponse = {
      success: false,
      error: 'Empty response from provider',
      errorId: id,
      details: {
        provider,
        message: `Provider returned empty response (null, undefined, or empty object)`,
        errorType: 'EMPTY_RESPONSE',
        responseType: typeof response,
        isNull: response === null,
        isUndefined: response === undefined,
        isEmpty:
          response &&
          typeof response === 'object' &&
          Object.keys(response).length === 0,
        suggestion:
          'Check provider configuration, API key validity, and service status',
        timestamp: new Date().toISOString(),
      },
    };

    // Log empty response error separately from extraction failures
    logger.error('Empty response error (not extraction failure)', {
      errorId: id,
      provider,
      responseType: typeof response,
      isNull: response === null,
      isUndefined: response === undefined,
    });

    return errorResponse;
  }

  /**
   * Build validation error response (using shared format)
   * @param {Object} validationResult - Validation result from UnifiedValidator
   * @param {string} provider - Provider name
   * @param {string} errorId - Unique error ID
   * @returns {Object} Error response
   */
  buildValidationErrorResponse(
    validationResult,
    provider = 'unknown',
    errorId = null
  ) {
    const id = errorId || this.generateErrorId();

    const errorResponse = {
      success: false,
      error: 'Response validation failed',
      errorId: id,
      details: {
        provider,
        message: 'Extracted dream data failed validation',
        errorType: 'VALIDATION_FAILURE',
        timestamp: new Date().toISOString(),
      },
      validationErrors: validationResult.errors || [],
      errorCount:
        validationResult.errorCount || validationResult.errors?.length || 0,
    };

    // Add categorized errors if available
    if (validationResult.categorized) {
      errorResponse.categorizedErrors = {
        critical: validationResult.categorized.critical || [],
        error: validationResult.categorized.error || [],
        warning: validationResult.categorized.warning || [],
      };
      errorResponse.criticalCount =
        validationResult.categorized.critical?.length || 0;
      errorResponse.warningCount =
        validationResult.categorized.warning?.length || 0;
    }

    // Log validation error
    logger.error('Validation error response built', {
      errorId: id,
      provider,
      errorCount: errorResponse.errorCount,
      criticalCount: errorResponse.criticalCount || 0,
    });

    return errorResponse;
  }

  /**
   * Build success response with warnings (for repaired responses)
   * @param {Object} data - Dream data
   * @param {Array} warnings - Warnings from repair process
   * @param {Object} repairMetadata - Metadata about repair
   * @param {string} provider - Provider name
   * @returns {Object} Success response with warnings
   */
  buildSuccessWithWarningsResponse(
    data,
    warnings = [],
    repairMetadata = {},
    provider = 'unknown'
  ) {
    const errorId = this.generateErrorId();

    const response = {
      success: true,
      data,
      warnings,
      metadata: {
        provider,
        repairApplied: true,
        warningCount: warnings.length,
        errorId,
        timestamp: new Date().toISOString(),
        ...repairMetadata,
      },
    };

    // Log success with warnings
    logger.info('Success response with warnings built', {
      errorId,
      provider,
      warningCount: warnings.length,
      repairStrategies: repairMetadata.strategiesApplied?.length || 0,
    });

    return response;
  }

  /**
   * Build success response
   * @param {Object} data - Dream data
   * @param {Object} metadata - Response metadata
   * @returns {Object} Success response
   */
  buildSuccessResponse(data, metadata = {}) {
    return {
      success: true,
      data,
      metadata: {
        timestamp: new Date().toISOString(),
        ...metadata,
      },
    };
  }

  /**
   * Build generic error response
   * @param {string} errorMessage - Error message
   * @param {Object} details - Additional error details
   * @param {string} errorId - Unique error ID
   * @returns {Object} Error response
   */
  buildGenericErrorResponse(errorMessage, details = {}, errorId = null) {
    const id = errorId || this.generateErrorId();

    return {
      success: false,
      error: errorMessage,
      errorId: id,
      details: {
        ...details,
        timestamp: new Date().toISOString(),
      },
    };
  }

  /**
   * Generate unique error ID
   * @returns {string} Error ID
   */
  generateErrorId() {
    return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get sample of response for error logging
   * @param {*} response - Response to sample
   * @returns {string} Sample string
   */
  getSampleResponse(response) {
    try {
      if (typeof response === 'string') {
        return (
          response.substring(0, this.options.maxSampleLength) +
          (response.length > this.options.maxSampleLength
            ? '...[truncated]'
            : '')
        );
      }

      if (response && typeof response === 'object') {
        const jsonString = JSON.stringify(response);
        return (
          jsonString.substring(0, this.options.maxSampleLength) +
          (jsonString.length > this.options.maxSampleLength
            ? '...[truncated]'
            : '')
        );
      }

      return String(response);
    } catch (error) {
      return '[Could not stringify response]';
    }
  }

  /**
   * Extract attempted patterns from content extractor metrics
   * @param {Object} extractionMetrics - Metrics from EnhancedContentExtractor
   * @returns {Array} Attempted patterns
   */
  extractAttemptedPatterns(extractionMetrics) {
    if (!extractionMetrics || !extractionMetrics.attempts) {
      return [];
    }

    return extractionMetrics.attempts.map((attempt) => ({
      pattern: attempt.pattern,
      success: attempt.success,
      error: attempt.error || null,
      timestamp: attempt.timestamp,
    }));
  }
}

module.exports = ErrorResponseBuilder;
