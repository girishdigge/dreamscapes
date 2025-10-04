// utils/CircuitBreaker.js
// Circuit breaker pattern implementation for cache operations

const { logger } = require('./Logger');

/**
 * Circuit Breaker States
 */
const STATES = {
  CLOSED: 'CLOSED', // Normal operation
  OPEN: 'OPEN', // Failing fast, blocking requests
  HALF_OPEN: 'HALF_OPEN', // Testing if service has recovered
};

/**
 * CircuitBreaker - Implements circuit breaker pattern for cache operations
 *
 * Features:
 * - Automatic failure detection and recovery
 * - Configurable failure thresholds and timeouts
 * - Fallback mechanism support
 * - Comprehensive monitoring and statistics
 */
class CircuitBreaker {
  constructor(options = {}) {
    this.options = {
      // Failure threshold before opening circuit
      failureThreshold: options.failureThreshold || 5,

      // Success threshold to close circuit from half-open
      successThreshold: options.successThreshold || 2,

      // Time to wait before attempting recovery (ms)
      resetTimeout: options.resetTimeout || 30000,

      // Monitoring window for failure rate calculation (ms)
      monitoringPeriod: options.monitoringPeriod || 60000,

      // Timeout for individual operations (ms)
      operationTimeout: options.operationTimeout || 10000,

      // Name for logging and identification
      name: options.name || 'CircuitBreaker',

      // Custom error filter function
      errorFilter: options.errorFilter || this._defaultErrorFilter,

      // Fallback function when circuit is open
      fallback: options.fallback || null,

      ...options,
    };

    // Circuit state
    this.state = STATES.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = null;
    this.nextAttemptTime = null;

    // Statistics
    this.stats = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      timeouts: 0,
      circuitOpenCount: 0,
      fallbackExecutions: 0,
      averageResponseTime: 0,
      lastResetTime: Date.now(),
    };

    // Monitoring
    this.recentFailures = [];
    this.recentSuccesses = [];
    this.responseTimeHistory = [];

    logger.debug('CircuitBreaker initialized', {
      name: this.options.name,
      config: this.options,
    });
  }

  /**
   * Execute an operation with circuit breaker protection
   */
  async execute(operation, ...args) {
    this.stats.totalRequests++;

    // Check if circuit is open
    if (this._isCircuitOpen()) {
      return this._handleOpenCircuit(operation, ...args);
    }

    const startTime = Date.now();

    try {
      // Execute operation with timeout
      const result = await this._executeWithTimeout(operation, ...args);

      // Record success
      this._recordSuccess(Date.now() - startTime);

      return result;
    } catch (error) {
      // Record failure
      this._recordFailure(error, Date.now() - startTime);

      // Re-throw error for caller to handle
      throw error;
    }
  }

  /**
   * Execute operation with timeout protection
   */
  async _executeWithTimeout(operation, ...args) {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        this.stats.timeouts++;
        reject(
          new Error(
            `Operation timeout after ${this.options.operationTimeout}ms`
          )
        );
      }, this.options.operationTimeout);

      Promise.resolve(operation(...args))
        .then((result) => {
          clearTimeout(timeoutId);
          resolve(result);
        })
        .catch((error) => {
          clearTimeout(timeoutId);
          reject(error);
        });
    });
  }

  /**
   * Handle requests when circuit is open
   */
  async _handleOpenCircuit(operation, ...args) {
    this.stats.circuitOpenCount++;

    // Check if we should attempt recovery
    if (this._shouldAttemptRecovery()) {
      this.state = STATES.HALF_OPEN;
      this.successCount = 0;

      logger.info('Circuit breaker attempting recovery', {
        name: this.options.name,
        state: this.state,
      });

      try {
        const result = await this._executeWithTimeout(operation, ...args);
        this._recordSuccess(0); // Don't count response time during recovery
        return result;
      } catch (error) {
        this._recordFailure(error, 0);
        throw error;
      }
    }

    // Circuit is open, use fallback if available
    if (this.options.fallback) {
      this.stats.fallbackExecutions++;
      logger.debug('Executing fallback due to open circuit', {
        name: this.options.name,
      });

      try {
        return await this.options.fallback(...args);
      } catch (fallbackError) {
        logger.error('Fallback execution failed', {
          name: this.options.name,
          error: fallbackError.message,
        });
        throw fallbackError;
      }
    }

    // No fallback available, throw circuit open error
    throw new Error(
      `Circuit breaker is OPEN for ${this.options.name} - operation blocked`
    );
  }

  /**
   * Record successful operation
   */
  _recordSuccess(responseTime) {
    this.stats.successfulRequests++;
    this._updateResponseTime(responseTime);

    const now = Date.now();
    this.recentSuccesses.push(now);
    this._cleanupOldEntries(this.recentSuccesses, now);

    if (this.state === STATES.HALF_OPEN) {
      this.successCount++;

      if (this.successCount >= this.options.successThreshold) {
        this._closeCircuit();
      }
    } else if (this.state === STATES.CLOSED) {
      // Reset failure count on successful operation
      this.failureCount = Math.max(0, this.failureCount - 1);
    }

    logger.debug('Operation succeeded', {
      name: this.options.name,
      state: this.state,
      responseTime,
      successCount: this.successCount,
    });
  }

  /**
   * Record failed operation
   */
  _recordFailure(error, responseTime) {
    this.stats.failedRequests++;
    this._updateResponseTime(responseTime);

    // Check if this error should count towards circuit breaker
    if (!this.options.errorFilter(error)) {
      logger.debug('Error filtered out, not counting towards circuit breaker', {
        name: this.options.name,
        error: error.message,
      });
      return;
    }

    const now = Date.now();
    this.recentFailures.push(now);
    this._cleanupOldEntries(this.recentFailures, now);

    this.failureCount++;
    this.lastFailureTime = now;

    logger.warn('Operation failed', {
      name: this.options.name,
      state: this.state,
      error: error.message,
      failureCount: this.failureCount,
      threshold: this.options.failureThreshold,
    });

    // Check if we should open the circuit
    if (
      this.state === STATES.CLOSED &&
      this.failureCount >= this.options.failureThreshold
    ) {
      this._openCircuit();
    } else if (this.state === STATES.HALF_OPEN) {
      // Any failure in half-open state reopens the circuit
      this._openCircuit();
    }
  }

  /**
   * Open the circuit breaker
   */
  _openCircuit() {
    this.state = STATES.OPEN;
    this.nextAttemptTime = Date.now() + this.options.resetTimeout;

    logger.warn('Circuit breaker opened', {
      name: this.options.name,
      failureCount: this.failureCount,
      nextAttemptTime: new Date(this.nextAttemptTime).toISOString(),
    });
  }

  /**
   * Close the circuit breaker
   */
  _closeCircuit() {
    this.state = STATES.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    this.nextAttemptTime = null;

    logger.info('Circuit breaker closed', {
      name: this.options.name,
      state: this.state,
    });
  }

  /**
   * Check if circuit is open
   */
  _isCircuitOpen() {
    return this.state === STATES.OPEN;
  }

  /**
   * Check if we should attempt recovery
   */
  _shouldAttemptRecovery() {
    if (this.state !== STATES.OPEN) {
      return false;
    }

    return Date.now() >= this.nextAttemptTime;
  }

  /**
   * Update response time statistics
   */
  _updateResponseTime(responseTime) {
    this.responseTimeHistory.push(responseTime);

    // Keep only recent response times (last 100 operations)
    if (this.responseTimeHistory.length > 100) {
      this.responseTimeHistory.shift();
    }

    // Calculate average response time
    if (this.responseTimeHistory.length > 0) {
      this.stats.averageResponseTime =
        this.responseTimeHistory.reduce((sum, time) => sum + time, 0) /
        this.responseTimeHistory.length;
    }
  }

  /**
   * Clean up old entries from monitoring arrays
   */
  _cleanupOldEntries(array, currentTime) {
    const cutoffTime = currentTime - this.options.monitoringPeriod;

    while (array.length > 0 && array[0] < cutoffTime) {
      array.shift();
    }
  }

  /**
   * Default error filter - counts all errors
   */
  _defaultErrorFilter(error) {
    // Don't count certain types of errors (e.g., validation errors)
    if (error.name === 'ValidationError' || error.name === 'TypeError') {
      return false;
    }

    return true;
  }

  /**
   * Get current circuit breaker status
   */
  getStatus() {
    const now = Date.now();
    this._cleanupOldEntries(this.recentFailures, now);
    this._cleanupOldEntries(this.recentSuccesses, now);

    return {
      name: this.options.name,
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      lastFailureTime: this.lastFailureTime,
      nextAttemptTime: this.nextAttemptTime,
      recentFailureRate: this._calculateRecentFailureRate(),
      stats: { ...this.stats },
      config: {
        failureThreshold: this.options.failureThreshold,
        successThreshold: this.options.successThreshold,
        resetTimeout: this.options.resetTimeout,
        operationTimeout: this.options.operationTimeout,
      },
    };
  }

  /**
   * Calculate recent failure rate
   */
  _calculateRecentFailureRate() {
    const totalRecent =
      this.recentFailures.length + this.recentSuccesses.length;

    if (totalRecent === 0) {
      return 0;
    }

    return (this.recentFailures.length / totalRecent) * 100;
  }

  /**
   * Reset circuit breaker statistics
   */
  reset() {
    this.state = STATES.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = null;
    this.nextAttemptTime = null;

    this.stats = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      timeouts: 0,
      circuitOpenCount: 0,
      fallbackExecutions: 0,
      averageResponseTime: 0,
      lastResetTime: Date.now(),
    };

    this.recentFailures = [];
    this.recentSuccesses = [];
    this.responseTimeHistory = [];

    logger.info('Circuit breaker reset', {
      name: this.options.name,
    });
  }

  /**
   * Force circuit state (for testing)
   */
  forceState(state) {
    if (!Object.values(STATES).includes(state)) {
      throw new Error(`Invalid circuit breaker state: ${state}`);
    }

    this.state = state;

    if (state === STATES.OPEN) {
      this.nextAttemptTime = Date.now() + this.options.resetTimeout;
    }

    logger.debug('Circuit breaker state forced', {
      name: this.options.name,
      state: this.state,
    });
  }
}

/**
 * CacheCircuitBreaker - Specialized circuit breaker for cache operations
 */
class CacheCircuitBreaker extends CircuitBreaker {
  constructor(options = {}) {
    const cacheOptions = {
      name: 'CacheCircuitBreaker',
      failureThreshold: 3,
      successThreshold: 2,
      resetTimeout: 10000, // 10 seconds for cache operations
      operationTimeout: 5000, // 5 seconds for cache operations
      errorFilter: (error) => {
        // Don't count connection timeouts as circuit breaker failures
        // if they're under a certain threshold
        if (
          error.message.includes('timeout') &&
          error.message.includes('Connection')
        ) {
          return false;
        }

        // Don't count Redis READONLY errors
        if (error.message.includes('READONLY')) {
          return false;
        }

        return true;
      },
      ...options,
    };

    super(cacheOptions);
  }

  /**
   * Execute cache operation with automatic fallback to mock client
   */
  async executeWithFallback(operation, mockOperation, ...args) {
    try {
      return await this.execute(operation, ...args);
    } catch (error) {
      logger.warn('Cache operation failed, using mock fallback', {
        error: error.message,
        state: this.state,
      });

      // Execute mock operation as fallback
      return await mockOperation(...args);
    }
  }
}

module.exports = {
  CircuitBreaker,
  CacheCircuitBreaker,
  STATES,
};
