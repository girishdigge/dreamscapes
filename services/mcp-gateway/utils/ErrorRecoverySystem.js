// utils/ErrorRecoverySystem.js
// Advanced error recovery and fallback system

const EventEmitter = require('events');
const { ErrorHandler, ErrorTypes, ErrorSeverity } = require('./ErrorHandler');

/**
 * Error Recovery System - Manages error recovery strategies and fallback mechanisms
 */
class ErrorRecoverySystem extends EventEmitter {
  constructor(config = {}) {
    super();

    this.config = {
      maxRecoveryAttempts: config.maxRecoveryAttempts || 3,
      recoveryTimeout: config.recoveryTimeout || 30000, // 30 seconds
      enableAutoRecovery: config.enableAutoRecovery !== false,
      enableFallbackChain: config.enableFallbackChain !== false,
      circuitBreakerThreshold: config.circuitBreakerThreshold || 5,
      circuitBreakerTimeout: config.circuitBreakerTimeout || 60000, // 1 minute
      ...config,
    };

    // Recovery state tracking
    this.recoveryAttempts = new Map(); // errorId -> attempt count
    this.circuitBreakers = new Map(); // provider -> circuit breaker state
    this.recoveryHistory = new Map(); // provider -> recovery history
    this.fallbackChains = new Map(); // operation -> fallback chain

    // Recovery metrics
    this.metrics = {
      totalRecoveries: 0,
      successfulRecoveries: 0,
      failedRecoveries: 0,
      averageRecoveryTime: 0,
      recoveryByType: {},
      recoveryByProvider: {},
    };

    console.log('ErrorRecoverySystem initialized with config:', this.config);
  }

  /**
   * Attempt to recover from an error
   * @param {EnhancedError} error - The error to recover from
   * @param {Object} context - Recovery context
   * @returns {Promise<Object>} Recovery result
   */
  async attemptRecovery(error, context = {}) {
    const startTime = Date.now();
    const recoveryId = `recovery_${error.errorId}_${Date.now()}`;

    try {
      // Check if we've exceeded max recovery attempts for this error
      const attemptCount = this.recoveryAttempts.get(error.errorId) || 0;
      if (attemptCount >= this.config.maxRecoveryAttempts) {
        throw new Error(
          `Max recovery attempts exceeded for error ${error.errorId}`
        );
      }

      // Increment attempt count
      this.recoveryAttempts.set(error.errorId, attemptCount + 1);

      // Create recovery strategy
      const strategy = ErrorHandler.createRecoveryStrategy(error);

      // Execute recovery with timeout
      const recoveryResult = await Promise.race([
        this.executeRecoveryWithFallback(strategy, context),
        this.createTimeoutPromise(this.config.recoveryTimeout),
      ]);

      // Update metrics
      this.updateRecoveryMetrics(error, recoveryResult, Date.now() - startTime);

      // Record successful recovery
      this.recordRecoveryAttempt(error.provider, {
        recoveryId,
        errorType: error.type,
        success: recoveryResult.success,
        duration: Date.now() - startTime,
        strategy: strategy.actions.map((a) => a.type),
        timestamp: new Date(),
      });

      // Clean up attempt count on success
      if (recoveryResult.success) {
        this.recoveryAttempts.delete(error.errorId);
      }

      this.emit('recoveryCompleted', {
        recoveryId,
        error,
        result: recoveryResult,
        duration: Date.now() - startTime,
      });

      return recoveryResult;
    } catch (recoveryError) {
      const duration = Date.now() - startTime;

      // Update failure metrics
      this.metrics.failedRecoveries++;
      this.updateRecoveryTypeMetrics(error.type, false);

      // Record failed recovery
      this.recordRecoveryAttempt(error.provider, {
        recoveryId,
        errorType: error.type,
        success: false,
        duration,
        error: recoveryError.message,
        timestamp: new Date(),
      });

      this.emit('recoveryFailed', {
        recoveryId,
        error,
        recoveryError,
        duration,
      });

      throw recoveryError;
    }
  }

  /**
   * Execute recovery strategy with fallback chain
   * @private
   */
  async executeRecoveryWithFallback(strategy, context) {
    let lastError = null;

    // Try primary recovery strategy
    try {
      const result = await ErrorHandler.executeRecoveryStrategy(strategy, {
        ...context,
        eventEmitter: this,
      });

      if (result.success) {
        return result;
      }

      lastError = new Error('Primary recovery strategy failed');
    } catch (error) {
      lastError = error;
    }

    // If primary strategy failed and fallback is enabled, try fallback chain
    if (this.config.enableFallbackChain && context.operation) {
      try {
        const fallbackResult = await this.executeFallbackChain(
          context.operation,
          context
        );
        if (fallbackResult.success) {
          return {
            ...fallbackResult,
            fallbackUsed: true,
            primaryError: lastError.message,
          };
        }
      } catch (fallbackError) {
        lastError = fallbackError;
      }
    }

    // If all recovery attempts failed, try emergency recovery
    try {
      const emergencyResult = await this.executeEmergencyRecovery(context);
      return {
        ...emergencyResult,
        emergencyRecovery: true,
        primaryError: lastError.message,
      };
    } catch (emergencyError) {
      throw new Error(
        `All recovery attempts failed: ${lastError.message}, Emergency: ${emergencyError.message}`
      );
    }
  }

  /**
   * Execute fallback chain for an operation
   * @private
   */
  async executeFallbackChain(operation, context) {
    const fallbackChain = this.fallbackChains.get(operation) || [];

    if (fallbackChain.length === 0) {
      throw new Error(`No fallback chain defined for operation: ${operation}`);
    }

    for (let i = 0; i < fallbackChain.length; i++) {
      const fallback = fallbackChain[i];

      try {
        // Check if fallback provider is available
        if (
          fallback.type === 'provider' &&
          this.isCircuitBreakerOpen(fallback.provider)
        ) {
          continue; // Skip if circuit breaker is open
        }

        const result = await this.executeFallbackAction(fallback, context);

        if (result.success) {
          return {
            success: true,
            fallbackUsed: fallback,
            fallbackIndex: i,
            result: result.data,
          };
        }
      } catch (fallbackError) {
        // Log fallback failure but continue to next fallback
        console.warn(
          `Fallback ${i} failed for operation ${operation}:`,
          fallbackError.message
        );

        // If this was a provider fallback, consider opening circuit breaker
        if (fallback.type === 'provider') {
          this.recordProviderFailure(fallback.provider);
        }
      }
    }

    throw new Error('All fallback options exhausted');
  }

  /**
   * Execute a specific fallback action
   * @private
   */
  async executeFallbackAction(fallback, context) {
    switch (fallback.type) {
      case 'provider':
        return await this.executeProviderFallback(fallback, context);

      case 'cache':
        return await this.executeCacheFallback(fallback, context);

      case 'simplified':
        return await this.executeSimplifiedFallback(fallback, context);

      case 'static':
        return await this.executeStaticFallback(fallback, context);

      default:
        throw new Error(`Unknown fallback type: ${fallback.type}`);
    }
  }

  /**
   * Execute provider fallback
   * @private
   */
  async executeProviderFallback(fallback, context) {
    if (!context.providerManager) {
      throw new Error('Provider manager not available for provider fallback');
    }

    // Check if fallback provider is healthy
    const providerHealth = context.providerManager.getProviderHealth(
      fallback.provider
    );
    if (!providerHealth.isHealthy) {
      throw new Error(`Fallback provider ${fallback.provider} is not healthy`);
    }

    // Execute request with fallback provider
    const result = await context.providerManager.executeWithProvider(
      fallback.provider,
      context.operation,
      context.params
    );

    return {
      success: true,
      data: result,
      provider: fallback.provider,
    };
  }

  /**
   * Execute cache fallback
   * @private
   */
  async executeCacheFallback(fallback, context) {
    if (!context.cacheManager) {
      throw new Error('Cache manager not available for cache fallback');
    }

    const cacheKey = this.generateCacheKey(context.operation, context.params);
    const cachedResult = await context.cacheManager.get(cacheKey);

    if (!cachedResult) {
      throw new Error('No cached result available');
    }

    return {
      success: true,
      data: cachedResult,
      fromCache: true,
      cacheAge: Date.now() - cachedResult.timestamp,
    };
  }

  /**
   * Execute simplified fallback
   * @private
   */
  async executeSimplifiedFallback(fallback, context) {
    // Create simplified version of the request
    const simplifiedParams = this.simplifyRequestParams(
      context.params,
      fallback.level || 1
    );

    if (!context.providerManager) {
      throw new Error('Provider manager not available for simplified fallback');
    }

    const result = await context.providerManager.executeWithBestProvider(
      context.operation,
      simplifiedParams
    );

    return {
      success: true,
      data: result,
      simplified: true,
      simplificationLevel: fallback.level || 1,
    };
  }

  /**
   * Execute static fallback
   * @private
   */
  async executeStaticFallback(fallback, context) {
    return {
      success: true,
      data: fallback.response || {
        message: 'Service temporarily unavailable. Please try again later.',
        fallback: true,
      },
      static: true,
    };
  }

  /**
   * Execute emergency recovery
   * @private
   */
  async executeEmergencyRecovery(context) {
    // Try to return a minimal response that keeps the system functional
    const emergencyResponse = {
      success: true,
      data: {
        message: 'Emergency response: Service is experiencing issues',
        emergency: true,
        timestamp: new Date(),
        retryAfter: 60000, // Suggest retry after 1 minute
      },
      emergency: true,
    };

    // Log emergency recovery
    console.error('Emergency recovery activated:', {
      operation: context.operation,
      timestamp: new Date(),
    });

    this.emit('emergencyRecovery', {
      operation: context.operation,
      context,
      timestamp: new Date(),
    });

    return emergencyResponse;
  }

  /**
   * Set up fallback chain for an operation
   * @param {string} operation - Operation name
   * @param {Array} fallbackChain - Array of fallback configurations
   */
  setupFallbackChain(operation, fallbackChain) {
    this.fallbackChains.set(operation, fallbackChain);
    console.log(
      `Fallback chain configured for operation: ${operation}`,
      fallbackChain
    );
  }

  /**
   * Check if circuit breaker is open for a provider
   * @private
   */
  isCircuitBreakerOpen(provider) {
    const circuitBreaker = this.circuitBreakers.get(provider);
    if (!circuitBreaker) return false;

    if (circuitBreaker.state === 'open') {
      // Check if timeout has passed
      if (
        Date.now() - circuitBreaker.openedAt >
        this.config.circuitBreakerTimeout
      ) {
        // Move to half-open state
        circuitBreaker.state = 'half-open';
        circuitBreaker.halfOpenAt = Date.now();
        return false;
      }
      return true;
    }

    return false;
  }

  /**
   * Record provider failure for circuit breaker
   * @private
   */
  recordProviderFailure(provider) {
    if (!this.circuitBreakers.has(provider)) {
      this.circuitBreakers.set(provider, {
        state: 'closed',
        failureCount: 0,
        lastFailure: null,
        openedAt: null,
        halfOpenAt: null,
      });
    }

    const circuitBreaker = this.circuitBreakers.get(provider);
    circuitBreaker.failureCount++;
    circuitBreaker.lastFailure = Date.now();

    // Open circuit breaker if threshold exceeded
    if (circuitBreaker.failureCount >= this.config.circuitBreakerThreshold) {
      circuitBreaker.state = 'open';
      circuitBreaker.openedAt = Date.now();

      this.emit('circuitBreakerOpened', {
        provider,
        failureCount: circuitBreaker.failureCount,
        timestamp: new Date(),
      });

      console.warn(`Circuit breaker opened for provider: ${provider}`);
    }
  }

  /**
   * Record successful provider operation
   * @param {string} provider - Provider name
   */
  recordProviderSuccess(provider) {
    const circuitBreaker = this.circuitBreakers.get(provider);
    if (circuitBreaker) {
      if (circuitBreaker.state === 'half-open') {
        // Close circuit breaker on success in half-open state
        circuitBreaker.state = 'closed';
        circuitBreaker.failureCount = 0;
        circuitBreaker.openedAt = null;
        circuitBreaker.halfOpenAt = null;

        this.emit('circuitBreakerClosed', {
          provider,
          timestamp: new Date(),
        });

        console.log(`Circuit breaker closed for provider: ${provider}`);
      } else if (circuitBreaker.state === 'closed') {
        // Reset failure count on success
        circuitBreaker.failureCount = Math.max(
          0,
          circuitBreaker.failureCount - 1
        );
      }
    }
  }

  /**
   * Generate cache key for operation and parameters
   * @private
   */
  generateCacheKey(operation, params) {
    const keyData = {
      operation,
      params: this.normalizeParams(params),
    };
    return `fallback_${Buffer.from(JSON.stringify(keyData)).toString(
      'base64'
    )}`;
  }

  /**
   * Normalize parameters for consistent cache keys
   * @private
   */
  normalizeParams(params) {
    if (!params || typeof params !== 'object') return params;

    // Remove volatile parameters that shouldn't affect caching
    const normalized = { ...params };
    delete normalized.timestamp;
    delete normalized.requestId;
    delete normalized.attempt;

    return normalized;
  }

  /**
   * Simplify request parameters for fallback
   * @private
   */
  simplifyRequestParams(params, level = 1) {
    if (!params || typeof params !== 'object') return params;

    const simplified = { ...params };

    switch (level) {
      case 1:
        // Level 1: Reduce complexity slightly
        if (simplified.maxTokens)
          simplified.maxTokens = Math.min(simplified.maxTokens, 1000);
        if (simplified.temperature)
          simplified.temperature = Math.min(simplified.temperature, 0.7);
        break;

      case 2:
        // Level 2: More aggressive simplification
        if (simplified.maxTokens)
          simplified.maxTokens = Math.min(simplified.maxTokens, 500);
        if (simplified.temperature) simplified.temperature = 0.5;
        if (simplified.topP) simplified.topP = 0.8;
        break;

      case 3:
        // Level 3: Minimal complexity
        simplified.maxTokens = 200;
        simplified.temperature = 0.3;
        simplified.topP = 0.7;
        delete simplified.streaming;
        break;
    }

    return simplified;
  }

  /**
   * Record recovery attempt
   * @private
   */
  recordRecoveryAttempt(provider, attempt) {
    if (!this.recoveryHistory.has(provider)) {
      this.recoveryHistory.set(provider, []);
    }

    const history = this.recoveryHistory.get(provider);
    history.push(attempt);

    // Keep only last 100 attempts
    if (history.length > 100) {
      history.splice(0, history.length - 100);
    }
  }

  /**
   * Update recovery metrics
   * @private
   */
  updateRecoveryMetrics(error, result, duration) {
    this.metrics.totalRecoveries++;

    if (result.success) {
      this.metrics.successfulRecoveries++;
    } else {
      this.metrics.failedRecoveries++;
    }

    // Update average recovery time
    const totalTime =
      this.metrics.averageRecoveryTime * (this.metrics.totalRecoveries - 1) +
      duration;
    this.metrics.averageRecoveryTime = totalTime / this.metrics.totalRecoveries;

    // Update type-specific metrics
    this.updateRecoveryTypeMetrics(error.type, result.success);

    // Update provider-specific metrics
    if (error.provider) {
      this.updateRecoveryProviderMetrics(error.provider, result.success);
    }
  }

  /**
   * Update recovery metrics by error type
   * @private
   */
  updateRecoveryTypeMetrics(errorType, success) {
    if (!this.metrics.recoveryByType[errorType]) {
      this.metrics.recoveryByType[errorType] = {
        total: 0,
        successful: 0,
        failed: 0,
        successRate: 0,
      };
    }

    const typeMetrics = this.metrics.recoveryByType[errorType];
    typeMetrics.total++;

    if (success) {
      typeMetrics.successful++;
    } else {
      typeMetrics.failed++;
    }

    typeMetrics.successRate = typeMetrics.successful / typeMetrics.total;
  }

  /**
   * Update recovery metrics by provider
   * @private
   */
  updateRecoveryProviderMetrics(provider, success) {
    if (!this.metrics.recoveryByProvider[provider]) {
      this.metrics.recoveryByProvider[provider] = {
        total: 0,
        successful: 0,
        failed: 0,
        successRate: 0,
      };
    }

    const providerMetrics = this.metrics.recoveryByProvider[provider];
    providerMetrics.total++;

    if (success) {
      providerMetrics.successful++;
    } else {
      providerMetrics.failed++;
    }

    providerMetrics.successRate =
      providerMetrics.successful / providerMetrics.total;
  }

  /**
   * Create timeout promise
   * @private
   */
  createTimeoutPromise(timeout) {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Recovery timeout after ${timeout}ms`));
      }, timeout);
    });
  }

  /**
   * Get recovery statistics
   * @returns {Object} Recovery statistics
   */
  getRecoveryStatistics() {
    return {
      ...this.metrics,
      circuitBreakers: Object.fromEntries(
        Array.from(this.circuitBreakers.entries()).map(([provider, cb]) => [
          provider,
          {
            state: cb.state,
            failureCount: cb.failureCount,
            lastFailure: cb.lastFailure,
            openedAt: cb.openedAt,
          },
        ])
      ),
      activeRecoveries: this.recoveryAttempts.size,
      fallbackChains: Array.from(this.fallbackChains.keys()),
    };
  }

  /**
   * Reset circuit breaker for a provider
   * @param {string} provider - Provider name
   */
  resetCircuitBreaker(provider) {
    if (this.circuitBreakers.has(provider)) {
      const circuitBreaker = this.circuitBreakers.get(provider);
      circuitBreaker.state = 'closed';
      circuitBreaker.failureCount = 0;
      circuitBreaker.openedAt = null;
      circuitBreaker.halfOpenAt = null;

      console.log(`Circuit breaker manually reset for provider: ${provider}`);

      this.emit('circuitBreakerReset', {
        provider,
        timestamp: new Date(),
      });
    }
  }

  /**
   * Cleanup resources
   */
  destroy() {
    this.recoveryAttempts.clear();
    this.circuitBreakers.clear();
    this.recoveryHistory.clear();
    this.fallbackChains.clear();
    this.removeAllListeners();
    console.log('ErrorRecoverySystem destroyed');
  }
}

module.exports = ErrorRecoverySystem;
