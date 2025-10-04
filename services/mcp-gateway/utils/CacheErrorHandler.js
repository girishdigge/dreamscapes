// utils/CacheErrorHandler.js
// Enhanced error handling and recovery mechanisms for cache operations

const { logger } = require('./Logger');

/**
 * Cache Error Types
 */
const CACHE_ERROR_TYPES = {
  CONNECTION_FAILED: 'CONNECTION_FAILED',
  OPERATION_TIMEOUT: 'OPERATION_TIMEOUT',
  AUTHENTICATION_FAILED: 'AUTHENTICATION_FAILED',
  MEMORY_LIMIT_EXCEEDED: 'MEMORY_LIMIT_EXCEEDED',
  NETWORK_ERROR: 'NETWORK_ERROR',
  SERIALIZATION_ERROR: 'SERIALIZATION_ERROR',
  CIRCUIT_BREAKER_OPEN: 'CIRCUIT_BREAKER_OPEN',
  FALLBACK_FAILED: 'FALLBACK_FAILED',
  CONFIGURATION_ERROR: 'CONFIGURATION_ERROR',
  UNKNOWN_ERROR: 'UNKNOWN_ERROR',
};

/**
 * Cache Error Severity Levels
 */
const ERROR_SEVERITY = {
  LOW: 'LOW', // Recoverable, minimal impact
  MEDIUM: 'MEDIUM', // Degraded performance, fallback available
  HIGH: 'HIGH', // Service disruption, immediate attention needed
  CRITICAL: 'CRITICAL', // Complete failure, system-wide impact
};

/**
 * Recovery Strategies
 */
const RECOVERY_STRATEGIES = {
  RETRY: 'RETRY',
  FALLBACK: 'FALLBACK',
  CIRCUIT_BREAKER: 'CIRCUIT_BREAKER',
  GRACEFUL_DEGRADATION: 'GRACEFUL_DEGRADATION',
  FAIL_FAST: 'FAIL_FAST',
  IGNORE: 'IGNORE',
};

/**
 * CacheError - Enhanced error class for cache operations
 */
class CacheError extends Error {
  constructor(message, type = CACHE_ERROR_TYPES.UNKNOWN_ERROR, options = {}) {
    super(message);
    this.name = 'CacheError';
    this.type = type;
    this.severity = options.severity || ERROR_SEVERITY.MEDIUM;
    this.recoverable = options.recoverable !== false;
    this.retryable = options.retryable !== false;
    this.operation = options.operation || 'unknown';
    this.key = options.key || null;
    this.timestamp = Date.now();
    this.originalError = options.originalError || null;
    this.context = options.context || {};

    // Capture stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, CacheError);
    }
  }

  /**
   * Create error from existing error
   */
  static fromError(error, type, options = {}) {
    const cacheError = new CacheError(
      error.message || 'Unknown cache error',
      type,
      {
        ...options,
        originalError: error,
      }
    );

    // Preserve original stack trace if available
    if (error.stack) {
      cacheError.stack = error.stack;
    }

    return cacheError;
  }

  /**
   * Get error details for logging
   */
  getDetails() {
    return {
      type: this.type,
      severity: this.severity,
      operation: this.operation,
      key: this.key,
      recoverable: this.recoverable,
      retryable: this.retryable,
      timestamp: this.timestamp,
      context: this.context,
      originalError: this.originalError
        ? {
            name: this.originalError.name,
            message: this.originalError.message,
            code: this.originalError.code,
          }
        : null,
    };
  }
}

/**
 * CacheErrorHandler - Comprehensive error handling and recovery system
 */
class CacheErrorHandler {
  constructor(options = {}) {
    this.options = {
      // Retry configuration
      maxRetries: options.maxRetries || 3,
      retryDelay: options.retryDelay || 1000,
      retryBackoffMultiplier: options.retryBackoffMultiplier || 2,

      // Circuit breaker integration
      circuitBreaker: options.circuitBreaker || null,

      // Fallback configuration
      fallbackClient: options.fallbackClient || null,
      enableFallback: options.enableFallback !== false,

      // Error reporting
      errorReporter: options.errorReporter || null,
      enableErrorReporting: options.enableErrorReporting !== false,

      // Recovery strategies
      defaultRecoveryStrategy:
        options.defaultRecoveryStrategy || RECOVERY_STRATEGIES.FALLBACK,

      ...options,
    };

    // Error statistics
    this.stats = {
      totalErrors: 0,
      errorsByType: {},
      errorsBySeverity: {},
      recoveryAttempts: 0,
      successfulRecoveries: 0,
      failedRecoveries: 0,
      fallbackUsage: 0,
      lastErrorTime: null,
    };

    // Error classification rules
    this.errorClassificationRules = new Map([
      // Connection errors
      [
        /ECONNREFUSED|ENOTFOUND|EHOSTUNREACH/,
        {
          type: CACHE_ERROR_TYPES.CONNECTION_FAILED,
          severity: ERROR_SEVERITY.HIGH,
          recoverable: true,
          retryable: true,
          strategy: RECOVERY_STRATEGIES.FALLBACK,
        },
      ],

      // Timeout errors
      [
        /timeout|ETIMEDOUT/,
        {
          type: CACHE_ERROR_TYPES.OPERATION_TIMEOUT,
          severity: ERROR_SEVERITY.MEDIUM,
          recoverable: true,
          retryable: true,
          strategy: RECOVERY_STRATEGIES.RETRY,
        },
      ],

      // Authentication errors
      [
        /NOAUTH|AUTH|authentication/,
        {
          type: CACHE_ERROR_TYPES.AUTHENTICATION_FAILED,
          severity: ERROR_SEVERITY.HIGH,
          recoverable: false,
          retryable: false,
          strategy: RECOVERY_STRATEGIES.FAIL_FAST,
        },
      ],

      // Memory errors
      [
        /OOM|out of memory|memory limit/,
        {
          type: CACHE_ERROR_TYPES.MEMORY_LIMIT_EXCEEDED,
          severity: ERROR_SEVERITY.CRITICAL,
          recoverable: true,
          retryable: false,
          strategy: RECOVERY_STRATEGIES.GRACEFUL_DEGRADATION,
        },
      ],

      // Network errors
      [
        /network|ENETDOWN|ENETUNREACH/,
        {
          type: CACHE_ERROR_TYPES.NETWORK_ERROR,
          severity: ERROR_SEVERITY.HIGH,
          recoverable: true,
          retryable: true,
          strategy: RECOVERY_STRATEGIES.CIRCUIT_BREAKER,
        },
      ],

      // Serialization errors
      [
        /JSON|serialize|parse/,
        {
          type: CACHE_ERROR_TYPES.SERIALIZATION_ERROR,
          severity: ERROR_SEVERITY.LOW,
          recoverable: true,
          retryable: false,
          strategy: RECOVERY_STRATEGIES.IGNORE,
        },
      ],

      // Circuit breaker errors
      [
        /circuit.*breaker.*open|circuit.*open/i,
        {
          type: CACHE_ERROR_TYPES.CIRCUIT_BREAKER_OPEN,
          severity: ERROR_SEVERITY.MEDIUM,
          recoverable: true,
          retryable: false,
          strategy: RECOVERY_STRATEGIES.FALLBACK,
        },
      ],
    ]);

    logger.debug('CacheErrorHandler initialized', {
      config: this.options,
    });
  }

  /**
   * Handle cache operation error with recovery
   */
  async handleError(error, operation, key = null, context = {}) {
    const cacheError = this._classifyError(error, operation, key, context);

    // Update statistics
    this._updateStats(cacheError);

    // Log error
    this._logError(cacheError);

    // Report error if enabled
    if (this.options.enableErrorReporting && this.options.errorReporter) {
      try {
        await this.options.errorReporter.report(cacheError);
      } catch (reportError) {
        logger.warn('Failed to report cache error', {
          error: reportError.message,
        });
      }
    }

    // Attempt recovery
    return await this._attemptRecovery(cacheError);
  }

  /**
   * Classify error and determine recovery strategy
   */
  _classifyError(error, operation, key, context) {
    let classification = {
      type: CACHE_ERROR_TYPES.UNKNOWN_ERROR,
      severity: ERROR_SEVERITY.MEDIUM,
      recoverable: true,
      retryable: true,
      strategy: this.options.defaultRecoveryStrategy,
    };

    // Check error message against classification rules
    const errorMessage = error.message || error.toString();

    for (const [pattern, config] of this.errorClassificationRules) {
      if (pattern.test(errorMessage)) {
        classification = { ...classification, ...config };
        break;
      }
    }

    // Check error code if available
    if (error.code) {
      switch (error.code) {
        case 'ECONNREFUSED':
        case 'ENOTFOUND':
          classification.type = CACHE_ERROR_TYPES.CONNECTION_FAILED;
          classification.severity = ERROR_SEVERITY.HIGH;
          break;
        case 'ETIMEDOUT':
          classification.type = CACHE_ERROR_TYPES.OPERATION_TIMEOUT;
          classification.severity = ERROR_SEVERITY.MEDIUM;
          break;
      }
    }

    return CacheError.fromError(error, classification.type, {
      severity: classification.severity,
      recoverable: classification.recoverable,
      retryable: classification.retryable,
      operation,
      key,
      context: {
        ...context,
        recoveryStrategy: classification.strategy,
      },
    });
  }

  /**
   * Attempt error recovery based on strategy
   */
  async _attemptRecovery(cacheError) {
    this.stats.recoveryAttempts++;

    const strategy =
      cacheError.context.recoveryStrategy ||
      this.options.defaultRecoveryStrategy;

    try {
      switch (strategy) {
        case RECOVERY_STRATEGIES.RETRY:
          return await this._retryOperation(cacheError);

        case RECOVERY_STRATEGIES.FALLBACK:
          return await this._useFallback(cacheError);

        case RECOVERY_STRATEGIES.CIRCUIT_BREAKER:
          return await this._handleCircuitBreaker(cacheError);

        case RECOVERY_STRATEGIES.GRACEFUL_DEGRADATION:
          return await this._gracefulDegradation(cacheError);

        case RECOVERY_STRATEGIES.IGNORE:
          return this._ignoreError(cacheError);

        case RECOVERY_STRATEGIES.FAIL_FAST:
        default:
          throw cacheError;
      }
    } catch (recoveryError) {
      this.stats.failedRecoveries++;

      // If recovery fails, try fallback as last resort
      if (
        strategy !== RECOVERY_STRATEGIES.FALLBACK &&
        this.options.enableFallback
      ) {
        try {
          return await this._useFallback(cacheError);
        } catch (fallbackError) {
          // Both recovery and fallback failed
          throw new CacheError(
            `Recovery failed: ${recoveryError.message}. Fallback failed: ${fallbackError.message}`,
            CACHE_ERROR_TYPES.FALLBACK_FAILED,
            {
              severity: ERROR_SEVERITY.CRITICAL,
              recoverable: false,
              retryable: false,
              operation: cacheError.operation,
              key: cacheError.key,
              originalError: cacheError,
            }
          );
        }
      }

      throw recoveryError;
    }
  }

  /**
   * Retry operation with exponential backoff
   */
  async _retryOperation(cacheError) {
    if (!cacheError.retryable) {
      throw cacheError;
    }

    let lastError = cacheError;

    for (let attempt = 1; attempt <= this.options.maxRetries; attempt++) {
      try {
        // Wait before retry (exponential backoff)
        if (attempt > 1) {
          const delay =
            this.options.retryDelay *
            Math.pow(this.options.retryBackoffMultiplier, attempt - 2);
          await this._delay(delay);
        }

        logger.debug('Retrying cache operation', {
          operation: cacheError.operation,
          attempt,
          maxRetries: this.options.maxRetries,
        });

        // Note: Actual retry logic would need to be implemented by the caller
        // This is a framework for retry handling
        throw new Error(
          'Retry operation not implemented - should be handled by caller'
        );
      } catch (error) {
        lastError = error;

        if (attempt === this.options.maxRetries) {
          logger.error('All retry attempts failed', {
            operation: cacheError.operation,
            attempts: attempt,
            finalError: error.message,
          });
        }
      }
    }

    throw lastError;
  }

  /**
   * Use fallback client
   */
  async _useFallback(cacheError) {
    if (!this.options.fallbackClient) {
      throw new CacheError(
        'Fallback requested but no fallback client available',
        CACHE_ERROR_TYPES.FALLBACK_FAILED,
        {
          severity: ERROR_SEVERITY.HIGH,
          recoverable: false,
          operation: cacheError.operation,
          key: cacheError.key,
        }
      );
    }

    this.stats.fallbackUsage++;

    logger.info('Using fallback client for cache operation', {
      operation: cacheError.operation,
      key: cacheError.key,
      originalError: cacheError.type,
    });

    // Return fallback indicator - actual fallback logic handled by caller
    return {
      useFallback: true,
      fallbackClient: this.options.fallbackClient,
      originalError: cacheError,
    };
  }

  /**
   * Handle circuit breaker integration
   */
  async _handleCircuitBreaker(cacheError) {
    if (this.options.circuitBreaker) {
      // Circuit breaker will handle the error and determine next action
      logger.debug('Delegating error handling to circuit breaker', {
        operation: cacheError.operation,
        errorType: cacheError.type,
      });
    }

    // If no circuit breaker, fall back to default strategy
    return await this._useFallback(cacheError);
  }

  /**
   * Graceful degradation - return safe default values
   */
  async _gracefulDegradation(cacheError) {
    logger.warn('Applying graceful degradation for cache error', {
      operation: cacheError.operation,
      key: cacheError.key,
      errorType: cacheError.type,
    });

    // Return safe defaults based on operation type
    switch (cacheError.operation) {
      case 'get':
        return null; // Cache miss
      case 'set':
      case 'setEx':
        return false; // Set failed
      case 'del':
        return 0; // Nothing deleted
      case 'exists':
        return 0; // Doesn't exist
      case 'ping':
        return 'DEGRADED'; // Service degraded
      default:
        return null;
    }
  }

  /**
   * Ignore error and return safe default
   */
  _ignoreError(cacheError) {
    logger.debug('Ignoring cache error', {
      operation: cacheError.operation,
      errorType: cacheError.type,
    });

    return this._gracefulDegradation(cacheError);
  }

  /**
   * Update error statistics
   */
  _updateStats(cacheError) {
    this.stats.totalErrors++;
    this.stats.lastErrorTime = Date.now();

    // Count by type
    this.stats.errorsByType[cacheError.type] =
      (this.stats.errorsByType[cacheError.type] || 0) + 1;

    // Count by severity
    this.stats.errorsBySeverity[cacheError.severity] =
      (this.stats.errorsBySeverity[cacheError.severity] || 0) + 1;
  }

  /**
   * Log error with appropriate level
   */
  _logError(cacheError) {
    const logData = {
      ...cacheError.getDetails(),
      message: cacheError.message,
    };

    switch (cacheError.severity) {
      case ERROR_SEVERITY.CRITICAL:
        logger.error('Critical cache error', logData);
        break;
      case ERROR_SEVERITY.HIGH:
        logger.error('High severity cache error', logData);
        break;
      case ERROR_SEVERITY.MEDIUM:
        logger.warn('Medium severity cache error', logData);
        break;
      case ERROR_SEVERITY.LOW:
      default:
        logger.debug('Low severity cache error', logData);
        break;
    }
  }

  /**
   * Create test scenarios for various cache failure modes
   */
  createTestScenarios() {
    return {
      connectionFailure: {
        error: new Error('ECONNREFUSED'),
        expectedType: CACHE_ERROR_TYPES.CONNECTION_FAILED,
        expectedSeverity: ERROR_SEVERITY.HIGH,
        expectedStrategy: RECOVERY_STRATEGIES.FALLBACK,
      },

      operationTimeout: {
        error: new Error('Operation timeout after 5000ms'),
        expectedType: CACHE_ERROR_TYPES.OPERATION_TIMEOUT,
        expectedSeverity: ERROR_SEVERITY.MEDIUM,
        expectedStrategy: RECOVERY_STRATEGIES.RETRY,
      },

      authenticationFailure: {
        error: new Error('NOAUTH Authentication required'),
        expectedType: CACHE_ERROR_TYPES.AUTHENTICATION_FAILED,
        expectedSeverity: ERROR_SEVERITY.HIGH,
        expectedStrategy: RECOVERY_STRATEGIES.FAIL_FAST,
      },

      memoryLimit: {
        error: new Error(
          'OOM command not allowed when used memory > maxmemory'
        ),
        expectedType: CACHE_ERROR_TYPES.MEMORY_LIMIT_EXCEEDED,
        expectedSeverity: ERROR_SEVERITY.CRITICAL,
        expectedStrategy: RECOVERY_STRATEGIES.GRACEFUL_DEGRADATION,
      },

      serializationError: {
        error: new Error('JSON.parse: unexpected character'),
        expectedType: CACHE_ERROR_TYPES.SERIALIZATION_ERROR,
        expectedSeverity: ERROR_SEVERITY.LOW,
        expectedStrategy: RECOVERY_STRATEGIES.IGNORE,
      },

      circuitBreakerOpen: {
        error: new Error('Circuit breaker is OPEN - operation blocked'),
        expectedType: CACHE_ERROR_TYPES.CIRCUIT_BREAKER_OPEN,
        expectedSeverity: ERROR_SEVERITY.MEDIUM,
        expectedStrategy: RECOVERY_STRATEGIES.FALLBACK,
      },
    };
  }

  /**
   * Get error handling statistics
   */
  getStats() {
    return {
      ...this.stats,
      recoverySuccessRate:
        this.stats.recoveryAttempts > 0
          ? (this.stats.successfulRecoveries / this.stats.recoveryAttempts) *
            100
          : 0,
      errorRate: this.stats.totalErrors,
      fallbackUsageRate: this.stats.fallbackUsage,
    };
  }

  /**
   * Reset statistics
   */
  resetStats() {
    this.stats = {
      totalErrors: 0,
      errorsByType: {},
      errorsBySeverity: {},
      recoveryAttempts: 0,
      successfulRecoveries: 0,
      failedRecoveries: 0,
      fallbackUsage: 0,
      lastErrorTime: null,
    };
  }

  /**
   * Utility method for delays
   */
  _delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

module.exports = {
  CacheError,
  CacheErrorHandler,
  CACHE_ERROR_TYPES,
  ERROR_SEVERITY,
  RECOVERY_STRATEGIES,
};
