// services/express/utils/dreamProcessingLogger.js
const { logger } = require('./logger');

/**
 * Comprehensive logging system for dream processing workflow
 * Provides structured logging for different stages of dream processing,
 * performance metrics, and error context logging with stack traces
 */
class DreamProcessingLogger {
  constructor() {
    this.activeRequests = new Map(); // Track active requests for performance metrics
  }

  /**
   * Log the start of dream processing
   * @param {string} requestId - Unique request identifier
   * @param {string} text - Dream text input
   * @param {string} style - Dream style
   * @param {object} options - Additional options
   */
  logProcessingStart(requestId, text, style, options = {}) {
    const startTime = Date.now();
    const processingContext = {
      requestId,
      stage: 'processing_start',
      textLength: text.length,
      textPreview: text.slice(0, 100) + (text.length > 100 ? '...' : ''),
      style,
      options,
      timestamp: new Date().toISOString(),
      startTime,
    };

    // Store context for performance tracking
    this.activeRequests.set(requestId, processingContext);

    logger.info('Dream processing started', processingContext);
    return processingContext;
  }

  /**
   * Log cache check operation
   * @param {string} requestId - Request identifier
   * @param {string} cacheKey - Cache key used
   * @param {boolean} hit - Whether cache hit occurred
   * @param {number} cacheSize - Current cache size
   */
  logCacheCheck(requestId, cacheKey, hit, cacheSize = null) {
    const context = this.activeRequests.get(requestId);
    const logData = {
      requestId,
      stage: 'cache_check',
      cacheKey: cacheKey.slice(0, 50) + '...', // Truncate for readability
      hit,
      cacheSize,
      elapsedTime: context ? `${Date.now() - context.startTime}ms` : 'unknown',
    };

    if (hit) {
      logger.info('Cache hit - returning cached dream', logData);
    } else {
      logger.info('Cache miss - proceeding with generation', logData);
    }
  }

  /**
   * Log MCP Gateway call initiation
   * @param {string} requestId - Request identifier
   * @param {string} url - MCP Gateway URL
   * @param {object} payload - Request payload
   * @param {object} retryConfig - Retry configuration
   */
  logMCPCallStart(requestId, url, payload, retryConfig = {}) {
    const context = this.activeRequests.get(requestId);
    const logData = {
      requestId,
      stage: 'mcp_call_start',
      url,
      payloadSize: JSON.stringify(payload).length,
      textLength: payload.text?.length,
      style: payload.style,
      maxRetries: retryConfig.maxRetries,
      timeout: retryConfig.timeout,
      elapsedTime: context ? `${Date.now() - context.startTime}ms` : 'unknown',
    };

    logger.info('MCP Gateway call initiated', logData);
  }

  /**
   * Log MCP Gateway retry attempt
   * @param {string} requestId - Request identifier
   * @param {number} attempt - Current attempt number
   * @param {number} maxRetries - Maximum retry attempts
   * @param {number} delay - Delay before this attempt
   * @param {string} reason - Reason for retry
   */
  logMCPRetryAttempt(requestId, attempt, maxRetries, delay, reason) {
    const context = this.activeRequests.get(requestId);
    const logData = {
      requestId,
      stage: 'mcp_retry_attempt',
      attempt,
      maxRetries,
      delay: `${delay}ms`,
      reason,
      elapsedTime: context ? `${Date.now() - context.startTime}ms` : 'unknown',
    };

    logger.warn('MCP Gateway retry attempt', logData);
  }

  /**
   * Log successful MCP Gateway response
   * @param {string} requestId - Request identifier
   * @param {object} response - HTTP response object
   * @param {number} responseTime - Response time in milliseconds
   * @param {object} parsedData - Parsed response data
   */
  logMCPSuccess(requestId, response, responseTime, parsedData) {
    const context = this.activeRequests.get(requestId);
    const logData = {
      requestId,
      stage: 'mcp_success',
      httpStatus: response.status,
      responseTime: `${responseTime}ms`,
      contentType: response.headers?.get('content-type'),
      contentLength: response.headers?.get('content-length'),
      dreamId: parsedData?.dreamJson?.id,
      source: parsedData?.source,
      hasValidation: !!parsedData?.validation,
      validationPassed: parsedData?.validation?.valid,
      structureCount: parsedData?.dreamJson?.structures?.length || 0,
      entityCount: parsedData?.dreamJson?.entities?.length || 0,
      elapsedTime: context ? `${Date.now() - context.startTime}ms` : 'unknown',
    };

    logger.info('MCP Gateway response successful', logData);
  }

  /**
   * Log MCP Gateway failure with comprehensive error context
   * @param {string} requestId - Request identifier
   * @param {Error} error - Error object
   * @param {number} responseTime - Response time in milliseconds
   * @param {number} totalAttempts - Total attempts made
   * @param {string} circuitBreakerState - Circuit breaker state
   */
  logMCPFailure(
    requestId,
    error,
    responseTime,
    totalAttempts,
    circuitBreakerState
  ) {
    const context = this.activeRequests.get(requestId);
    const logData = {
      requestId,
      stage: 'mcp_failure',
      errorName: error.name,
      errorMessage: error.message,
      errorCategory: error.category || 'unknown',
      errorCode: error.code,
      httpStatus: error.status,
      responseTime: `${responseTime}ms`,
      totalAttempts,
      retriesExhausted: error.retriesExhausted,
      circuitBreakerState,
      shouldRetry: error.shouldRetry,
      stack: error.stack,
      elapsedTime: context ? `${Date.now() - context.startTime}ms` : 'unknown',
    };

    logger.error('MCP Gateway call failed', logData);
  }

  /**
   * Log response parsing stage
   * @param {string} requestId - Request identifier
   * @param {object} response - HTTP response object
   * @param {string} rawResponse - Raw response text
   * @param {boolean} success - Whether parsing succeeded
   * @param {Error} error - Parsing error if any
   */
  logResponseParsing(requestId, response, rawResponse, success, error = null) {
    const context = this.activeRequests.get(requestId);
    const logData = {
      requestId,
      stage: 'response_parsing',
      success,
      contentType: response?.headers?.get('content-type'),
      responseSize: rawResponse?.length || 0,
      responsePreview:
        rawResponse?.slice(0, 200) + (rawResponse?.length > 200 ? '...' : ''),
      elapsedTime: context ? `${Date.now() - context.startTime}ms` : 'unknown',
    };

    if (error) {
      logData.errorName = error.name;
      logData.errorMessage = error.message;
      logData.stack = error.stack;
      logger.error('Response parsing failed', logData);
    } else {
      logger.info('Response parsing successful', logData);
    }
  }

  /**
   * Log dream validation stage
   * @param {string} requestId - Request identifier
   * @param {object} dreamJson - Dream data to validate
   * @param {object} validation - Validation results
   * @param {string} source - Source of the dream data
   */
  logDreamValidation(requestId, dreamJson, validation, source) {
    const context = this.activeRequests.get(requestId);
    const logData = {
      requestId,
      stage: 'dream_validation',
      dreamId: dreamJson?.id,
      source,
      validationPassed: validation.valid,
      errorCount: validation.errors?.length || 0,
      errors: validation.errors?.slice(0, 3), // First 3 errors for brevity
      structureCount: dreamJson?.structures?.length || 0,
      entityCount: dreamJson?.entities?.length || 0,
      elapsedTime: context ? `${Date.now() - context.startTime}ms` : 'unknown',
    };

    if (validation.valid) {
      logger.info('Dream validation passed', logData);
    } else {
      logger.warn('Dream validation failed', logData);
    }
  }

  /**
   * Log dream repair attempt
   * @param {string} requestId - Request identifier
   * @param {object} originalDream - Original dream data
   * @param {array} errors - Validation errors to repair
   * @param {object} repairedDream - Repaired dream data
   * @param {boolean} success - Whether repair succeeded
   */
  logDreamRepair(requestId, originalDream, errors, repairedDream, success) {
    const context = this.activeRequests.get(requestId);
    const logData = {
      requestId,
      stage: 'dream_repair',
      originalDreamId: originalDream?.id,
      repairedDreamId: repairedDream?.id,
      originalErrorCount: errors?.length || 0,
      repairSuccess: success,
      repairActions:
        repairedDream?.assumptions?.filter((a) => a.includes('repaired')) || [],
      elapsedTime: context ? `${Date.now() - context.startTime}ms` : 'unknown',
    };

    if (success) {
      logger.info('Dream repair successful', logData);
    } else {
      logger.error('Dream repair failed', logData);
    }
  }

  /**
   * Log fallback generation
   * @param {string} requestId - Request identifier
   * @param {string} reason - Reason for fallback
   * @param {string} fallbackType - Type of fallback used
   * @param {object} fallbackDream - Generated fallback dream
   */
  logFallbackGeneration(requestId, reason, fallbackType, fallbackDream) {
    const context = this.activeRequests.get(requestId);
    const logData = {
      requestId,
      stage: 'fallback_generation',
      reason,
      fallbackType,
      dreamId: fallbackDream?.id,
      structureCount: fallbackDream?.structures?.length || 0,
      entityCount: fallbackDream?.entities?.length || 0,
      elapsedTime: context ? `${Date.now() - context.startTime}ms` : 'unknown',
    };

    logger.warn('Using fallback dream generation', logData);
  }

  /**
   * Log cache storage operation
   * @param {string} requestId - Request identifier
   * @param {string} cacheKey - Cache key used
   * @param {object} dreamData - Dream data being cached
   * @param {boolean} success - Whether caching succeeded
   */
  logCacheStorage(requestId, cacheKey, dreamData, success) {
    const context = this.activeRequests.get(requestId);
    const logData = {
      requestId,
      stage: 'cache_storage',
      cacheKey: cacheKey.slice(0, 50) + '...',
      dreamId: dreamData?.id,
      success,
      dataSize: JSON.stringify(dreamData).length,
      elapsedTime: context ? `${Date.now() - context.startTime}ms` : 'unknown',
    };

    if (success) {
      logger.info('Dream cached successfully', logData);
    } else {
      logger.error('Dream caching failed', logData);
    }
  }

  /**
   * Log processing completion with comprehensive metrics
   * @param {string} requestId - Request identifier
   * @param {object} finalDream - Final dream data
   * @param {string} source - Final source of dream data
   * @param {boolean} success - Whether processing succeeded overall
   * @param {object} metrics - Additional performance metrics
   */
  logProcessingComplete(requestId, finalDream, source, success, metrics = {}) {
    const context = this.activeRequests.get(requestId);
    const totalTime = context ? Date.now() - context.startTime : 0;

    const logData = {
      requestId,
      stage: 'processing_complete',
      success,
      totalProcessingTime: `${totalTime}ms`,
      dreamId: finalDream?.id,
      dreamTitle: finalDream?.title,
      source,
      structureCount: finalDream?.structures?.length || 0,
      entityCount: finalDream?.entities?.length || 0,
      cached: metrics.cached || false,
      mcpResponseTime: metrics.mcpResponseTime,
      validationTime: metrics.validationTime,
      repairAttempted: metrics.repairAttempted || false,
      fallbackUsed: source.includes('fallback'),
      ...metrics,
    };

    // Performance analysis
    if (totalTime > 30000) {
      // > 30 seconds
      logData.performanceWarning = 'Very slow processing time';
      logger.warn('Dream processing completed (SLOW)', logData);
    } else if (totalTime > 10000) {
      // > 10 seconds
      logData.performanceWarning = 'Slow processing time';
      logger.warn('Dream processing completed (slow)', logData);
    } else if (success) {
      logger.info('Dream processing completed successfully', logData);
    } else {
      logger.error('Dream processing completed with errors', logData);
    }

    // Clean up tracking
    this.activeRequests.delete(requestId);
  }

  /**
   * Log error with comprehensive context
   * @param {string} requestId - Request identifier
   * @param {string} stage - Processing stage where error occurred
   * @param {Error} error - Error object
   * @param {object} additionalContext - Additional context data
   */
  logErrorWithContext(requestId, stage, error, additionalContext = {}) {
    const context = this.activeRequests.get(requestId);
    const logData = {
      requestId,
      stage,
      errorName: error.name,
      errorMessage: error.message,
      errorCode: error.code,
      stack: error.stack,
      elapsedTime: context ? `${Date.now() - context.startTime}ms` : 'unknown',
      ...additionalContext,
    };

    logger.error(`Error in ${stage}`, logData);
  }

  /**
   * Log performance metrics for a specific operation
   * @param {string} requestId - Request identifier
   * @param {string} operation - Operation name
   * @param {number} duration - Operation duration in milliseconds
   * @param {object} metrics - Additional metrics
   */
  logPerformanceMetrics(requestId, operation, duration, metrics = {}) {
    const context = this.activeRequests.get(requestId);
    const logData = {
      requestId,
      operation,
      duration: `${duration}ms`,
      elapsedTime: context ? `${Date.now() - context.startTime}ms` : 'unknown',
      ...metrics,
    };

    if (duration > 5000) {
      // > 5 seconds
      logger.warn(`Slow operation: ${operation}`, logData);
    } else {
      logger.debug(`Performance: ${operation}`, logData);
    }
  }

  /**
   * Get performance summary for active requests
   * @returns {object} Performance summary
   */
  getPerformanceSummary() {
    const activeCount = this.activeRequests.size;
    const now = Date.now();
    const longRunning = [];

    for (const [requestId, context] of this.activeRequests.entries()) {
      const elapsed = now - context.startTime;
      if (elapsed > 30000) {
        // > 30 seconds
        longRunning.push({
          requestId,
          elapsed: `${elapsed}ms`,
          stage: context.stage,
          textLength: context.textLength,
        });
      }
    }

    return {
      activeRequests: activeCount,
      longRunningRequests: longRunning.length,
      longRunningDetails: longRunning,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Clean up stale request tracking (for requests that didn't complete properly)
   * @param {number} maxAge - Maximum age in milliseconds (default: 5 minutes)
   */
  cleanupStaleRequests(maxAge = 300000) {
    const now = Date.now();
    const staleRequests = [];

    for (const [requestId, context] of this.activeRequests.entries()) {
      if (now - context.startTime > maxAge) {
        staleRequests.push(requestId);
      }
    }

    staleRequests.forEach((requestId) => {
      const context = this.activeRequests.get(requestId);
      logger.warn('Cleaning up stale request tracking', {
        requestId,
        age: `${now - context.startTime}ms`,
        stage: context.stage,
      });
      this.activeRequests.delete(requestId);
    });

    return staleRequests.length;
  }
}

// Create singleton instance
const dreamProcessingLogger = new DreamProcessingLogger();

// Start periodic cleanup of stale requests
setInterval(() => {
  dreamProcessingLogger.cleanupStaleRequests();
}, 60000); // Every minute

module.exports = {
  dreamProcessingLogger,
  DreamProcessingLogger,
};
