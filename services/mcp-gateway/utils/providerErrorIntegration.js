// utils/providerErrorIntegration.js
// Integration layer for provider services to use enhanced error logging

const ErrorLoggingMiddleware = require('../middleware/errorLoggingMiddleware');

/**
 * Provider Error Integration - Connects provider services with enhanced error logging
 * Provides easy-to-use methods for providers to log errors with full context
 */
class ProviderErrorIntegration {
  constructor(config = {}) {
    this.config = {
      enableEnhancedLogging: config.enableEnhancedLogging !== false,
      enableContextTracking: config.enableContextTracking !== false,
      enableResponseAnalysis: config.enableResponseAnalysis !== false,
      ...config,
    };

    // Initialize error logging middleware
    this.errorLoggingMiddleware = new ErrorLoggingMiddleware(this.config);

    // Request context tracking
    this.requestContexts = new Map(); // requestId -> context
    this.providerStates = new Map(); // providerName -> state

    console.log('ProviderErrorIntegration initialized');
  }

  /**
   * Initialize with monitoring components
   * @param {Object} components - Monitoring components
   */
  initialize(components = {}) {
    this.errorLoggingMiddleware.initialize(components);
    console.log(
      'ProviderErrorIntegration initialized with monitoring components'
    );
  }

  /**
   * Start request tracking
   * @param {string} requestId - Request ID
   * @param {string} providerName - Provider name
   * @param {string} operation - Operation name
   * @param {Object} requestData - Request data
   * @returns {Object} Request context
   */
  startRequestTracking(requestId, providerName, operation, requestData = {}) {
    const context = {
      requestId,
      providerName,
      operation,
      requestData: this.sanitizeRequestData(requestData),
      startTime: Date.now(),
      attemptNumber: 1,
      maxAttempts: requestData.maxAttempts || 3,
      errors: [],
      responseHistory: [],
    };

    this.requestContexts.set(requestId, context);
    return context;
  }

  /**
   * Update request context with attempt information
   * @param {string} requestId - Request ID
   * @param {number} attemptNumber - Current attempt number
   * @param {Object} additionalContext - Additional context
   */
  updateRequestContext(requestId, attemptNumber, additionalContext = {}) {
    const context = this.requestContexts.get(requestId);
    if (context) {
      context.attemptNumber = attemptNumber;
      Object.assign(context, additionalContext);
    }
  }

  /**
   * Log response parsing error with full context
   * @param {string} requestId - Request ID
   * @param {Error} error - The parsing error
   * @param {string} providerName - Provider name
   * @param {any} originalResponse - Original response that failed to parse
   * @param {Object} additionalContext - Additional context
   */
  logResponseParsingError(
    requestId,
    error,
    providerName,
    originalResponse,
    additionalContext = {}
  ) {
    const context = this.requestContexts.get(requestId) || {};

    const enhancedContext = {
      ...context,
      ...additionalContext,
      requestId,
      responseTime: Date.now() - (context.startTime || Date.now()),
      parsingAttempts: context.parsingAttempts || 1,
      lastAttemptMethod: additionalContext.attemptMethod || 'unknown',
      failedMethods: context.failedMethods || [],
    };

    // Track error in context
    if (context.errors) {
      context.errors.push({
        type: 'response_parsing',
        error: error.message,
        timestamp: Date.now(),
        provider: providerName,
      });
    }

    // Track response in history
    if (context.responseHistory && originalResponse) {
      context.responseHistory.push({
        response: this.createResponseSample(originalResponse),
        timestamp: Date.now(),
        parseAttempt: context.parsingAttempts || 1,
      });
    }

    this.errorLoggingMiddleware.logResponseParsingError(
      error,
      providerName,
      originalResponse,
      enhancedContext
    );

    console.error(`Response parsing error for ${providerName}:`, {
      requestId,
      error: error.message,
      attemptNumber: context.attemptNumber || 1,
      responseType: typeof originalResponse,
    });
  }

  /**
   * Log provider method error with full context
   * @param {string} requestId - Request ID
   * @param {Error} error - The method error
   * @param {string} providerName - Provider name
   * @param {string} methodName - Missing method name
   * @param {Object} additionalContext - Additional context
   */
  logProviderMethodError(
    requestId,
    error,
    providerName,
    methodName,
    additionalContext = {}
  ) {
    const context = this.requestContexts.get(requestId) || {};

    const enhancedContext = {
      ...context,
      ...additionalContext,
      requestId,
      responseTime: Date.now() - (context.startTime || Date.now()),
      isRegistered: this.isProviderRegistered(providerName),
      isHealthy: this.isProviderHealthy(providerName),
      availableMethods: this.getProviderMethods(providerName),
      missingMethods: [methodName],
    };

    // Track error in context
    if (context.errors) {
      context.errors.push({
        type: 'provider_method',
        error: error.message,
        method: methodName,
        timestamp: Date.now(),
        provider: providerName,
      });
    }

    this.errorLoggingMiddleware.logProviderMethodError(
      error,
      providerName,
      methodName,
      enhancedContext
    );

    console.error(`Provider method error for ${providerName}.${methodName}:`, {
      requestId,
      error: error.message,
      methodName,
      isRegistered: enhancedContext.isRegistered,
    });
  }

  /**
   * Log provider operation error with full context
   * @param {string} requestId - Request ID
   * @param {Error} error - The operation error
   * @param {string} providerName - Provider name
   * @param {string} operation - Operation name
   * @param {Object} requestData - Request data
   * @param {Object} additionalContext - Additional context
   */
  logProviderOperationError(
    requestId,
    error,
    providerName,
    operation,
    requestData = {},
    additionalContext = {}
  ) {
    const context = this.requestContexts.get(requestId) || {};

    const enhancedContext = {
      ...context,
      ...additionalContext,
      requestId,
      responseTime: Date.now() - (context.startTime || Date.now()),
      relatedFailures: this.getRelatedFailures(providerName, operation),
      consecutiveFailures: this.getConsecutiveFailures(providerName),
      lastSuccessTime: this.getLastSuccessTime(providerName),
      lastFailureTime: Date.now(),
    };

    // Track error in context
    if (context.errors) {
      context.errors.push({
        type: 'provider_operation',
        error: error.message,
        operation,
        timestamp: Date.now(),
        provider: providerName,
      });
    }

    // Update provider state
    this.updateProviderState(providerName, {
      lastFailure: Date.now(),
      consecutiveFailures: (this.getConsecutiveFailures(providerName) || 0) + 1,
      lastError: error.message,
    });

    this.errorLoggingMiddleware.logProviderOperationError(
      error,
      providerName,
      operation,
      requestData,
      enhancedContext
    );

    console.error(
      `Provider operation error for ${providerName}.${operation}:`,
      {
        requestId,
        error: error.message,
        operation,
        attemptNumber: context.attemptNumber || 1,
        consecutiveFailures: enhancedContext.consecutiveFailures,
      }
    );
  }

  /**
   * Log successful provider operation (for context tracking)
   * @param {string} requestId - Request ID
   * @param {string} providerName - Provider name
   * @param {string} operation - Operation name
   * @param {Object} result - Operation result
   */
  logProviderSuccess(requestId, providerName, operation, result = {}) {
    const context = this.requestContexts.get(requestId);
    if (context) {
      context.success = true;
      context.completedAt = Date.now();
      context.responseTime = Date.now() - context.startTime;
    }

    // Update provider state
    this.updateProviderState(providerName, {
      lastSuccess: Date.now(),
      consecutiveFailures: 0,
      lastError: null,
    });

    console.log(
      `Provider operation succeeded for ${providerName}.${operation}:`,
      {
        requestId,
        operation,
        responseTime: context?.responseTime || 0,
        attemptNumber: context?.attemptNumber || 1,
      }
    );
  }

  /**
   * End request tracking
   * @param {string} requestId - Request ID
   * @returns {Object} Final request context
   */
  endRequestTracking(requestId) {
    const context = this.requestContexts.get(requestId);
    if (context) {
      context.endTime = Date.now();
      context.totalTime = context.endTime - context.startTime;

      // Clean up after some time to prevent memory leaks
      setTimeout(() => {
        this.requestContexts.delete(requestId);
      }, 300000); // 5 minutes
    }

    return context;
  }

  /**
   * Get request context
   * @param {string} requestId - Request ID
   * @returns {Object} Request context
   */
  getRequestContext(requestId) {
    return this.requestContexts.get(requestId);
  }

  /**
   * Check if provider is registered
   * @private
   */
  isProviderRegistered(providerName) {
    // This would typically check with ProviderManager
    return this.providerStates.has(providerName);
  }

  /**
   * Check if provider is healthy
   * @private
   */
  isProviderHealthy(providerName) {
    const state = this.providerStates.get(providerName);
    return state ? (state.consecutiveFailures || 0) < 3 : true;
  }

  /**
   * Get provider methods (mock implementation)
   * @private
   */
  getProviderMethods(providerName) {
    // This would typically introspect the provider service
    const commonMethods = ['generateDream', 'testConnection', 'getConfig'];
    const providerSpecificMethods = {
      cerebras: ['generateDreamStream', 'batchGenerateDreams'],
      openai: ['patchDream', 'enrichStyle'],
    };

    return [...commonMethods, ...(providerSpecificMethods[providerName] || [])];
  }

  /**
   * Get related failures count
   * @private
   */
  getRelatedFailures(providerName, operation) {
    const state = this.providerStates.get(providerName);
    return state?.relatedFailures?.[operation] || 0;
  }

  /**
   * Get consecutive failures count
   * @private
   */
  getConsecutiveFailures(providerName) {
    const state = this.providerStates.get(providerName);
    return state?.consecutiveFailures || 0;
  }

  /**
   * Get last success time
   * @private
   */
  getLastSuccessTime(providerName) {
    const state = this.providerStates.get(providerName);
    return state?.lastSuccess || null;
  }

  /**
   * Update provider state
   * @private
   */
  updateProviderState(providerName, updates) {
    if (!this.providerStates.has(providerName)) {
      this.providerStates.set(providerName, {
        consecutiveFailures: 0,
        lastSuccess: null,
        lastFailure: null,
        lastError: null,
        relatedFailures: {},
      });
    }

    const state = this.providerStates.get(providerName);
    Object.assign(state, updates);
  }

  /**
   * Sanitize request data for logging
   * @private
   */
  sanitizeRequestData(requestData) {
    if (!requestData || typeof requestData !== 'object') return requestData;

    const sanitized = { ...requestData };

    // Remove sensitive fields
    const sensitiveFields = [
      'apiKey',
      'token',
      'authorization',
      'password',
      'secret',
    ];
    sensitiveFields.forEach((field) => {
      if (sanitized[field]) {
        sanitized[field] = '[REDACTED]';
      }
    });

    // Truncate large fields
    if (sanitized.prompt && sanitized.prompt.length > 500) {
      sanitized.prompt = sanitized.prompt.substring(0, 500) + '... [TRUNCATED]';
    }

    return sanitized;
  }

  /**
   * Create response sample for logging
   * @private
   */
  createResponseSample(response) {
    if (!response) return null;

    const maxSampleSize = 1024; // 1KB
    let sample;

    if (typeof response === 'string') {
      sample =
        response.length > maxSampleSize
          ? response.substring(0, maxSampleSize) + '... [TRUNCATED]'
          : response;
    } else if (typeof response === 'object') {
      try {
        const jsonStr = JSON.stringify(response, null, 2);
        sample =
          jsonStr.length > maxSampleSize
            ? jsonStr.substring(0, maxSampleSize) + '... [TRUNCATED]'
            : jsonStr;
      } catch (error) {
        sample = '[OBJECT - JSON.stringify failed]';
      }
    } else {
      sample = String(response);
    }

    return {
      type: typeof response,
      sample,
      originalLength: typeof response === 'string' ? response.length : null,
      truncated:
        (typeof response === 'string'
          ? response.length
          : JSON.stringify(response).length) > maxSampleSize,
    };
  }

  /**
   * Get error statistics
   * @param {number} timeWindowMs - Time window in milliseconds
   * @returns {Object} Error statistics
   */
  getErrorStatistics(timeWindowMs = 3600000) {
    return this.errorLoggingMiddleware.getErrorStatistics(timeWindowMs);
  }

  /**
   * Generate monitoring report
   * @returns {Object} Monitoring report
   */
  generateMonitoringReport() {
    const baseReport = this.errorLoggingMiddleware.generateMonitoringReport();

    // Add provider integration specific data
    const providerStates = {};
    for (const [providerName, state] of this.providerStates.entries()) {
      providerStates[providerName] = {
        consecutiveFailures: state.consecutiveFailures,
        lastSuccess: state.lastSuccess
          ? new Date(state.lastSuccess).toISOString()
          : null,
        lastFailure: state.lastFailure
          ? new Date(state.lastFailure).toISOString()
          : null,
        lastError: state.lastError,
        isHealthy: (state.consecutiveFailures || 0) < 3,
      };
    }

    return {
      ...baseReport,
      providerIntegration: {
        activeRequests: this.requestContexts.size,
        trackedProviders: this.providerStates.size,
        providerStates,
      },
    };
  }

  /**
   * Get active requests summary
   * @returns {Object} Active requests summary
   */
  getActiveRequestsSummary() {
    const summary = {
      totalActive: this.requestContexts.size,
      byProvider: {},
      byOperation: {},
      oldestRequest: null,
      averageAge: 0,
    };

    const now = Date.now();
    let totalAge = 0;
    let oldestTime = now;

    for (const [requestId, context] of this.requestContexts.entries()) {
      const age = now - context.startTime;
      totalAge += age;

      if (context.startTime < oldestTime) {
        oldestTime = context.startTime;
        summary.oldestRequest = {
          requestId,
          age,
          provider: context.providerName,
          operation: context.operation,
        };
      }

      // Count by provider
      summary.byProvider[context.providerName] =
        (summary.byProvider[context.providerName] || 0) + 1;

      // Count by operation
      summary.byOperation[context.operation] =
        (summary.byOperation[context.operation] || 0) + 1;
    }

    if (summary.totalActive > 0) {
      summary.averageAge = totalAge / summary.totalActive;
    }

    return summary;
  }

  /**
   * Cleanup old request contexts
   */
  cleanupOldContexts() {
    const cutoff = Date.now() - 3600000; // 1 hour
    let cleaned = 0;

    for (const [requestId, context] of this.requestContexts.entries()) {
      if (context.startTime < cutoff) {
        this.requestContexts.delete(requestId);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      console.log(`Cleaned up ${cleaned} old request contexts`);
    }
  }

  /**
   * Cleanup resources
   */
  destroy() {
    this.requestContexts.clear();
    this.providerStates.clear();

    if (this.errorLoggingMiddleware) {
      this.errorLoggingMiddleware.destroy();
    }

    console.log('ProviderErrorIntegration destroyed');
  }
}

module.exports = ProviderErrorIntegration;
