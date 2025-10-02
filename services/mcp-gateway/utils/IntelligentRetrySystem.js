// utils/IntelligentRetrySystem.js
// Intelligent retry and fallback logic with exponential backoff and provider switching

const EventEmitter = require('events');

/**
 * Intelligent Retry System
 * Implements sophisticated retry logic with exponential backoff, provider switching,
 * and circuit breaker integration for robust error recovery
 */
class IntelligentRetrySystem extends EventEmitter {
  constructor(config = {}) {
    super();

    this.config = {
      // Exponential backoff configuration
      baseDelay: config.baseDelay || 1000, // 1 second base delay
      maxDelay: config.maxDelay || 30000, // 30 seconds max delay
      backoffMultiplier: config.backoffMultiplier || 2,
      jitterEnabled: config.jitterEnabled !== false,
      jitterFactor: config.jitterFactor || 0.1,

      // Retry configuration
      maxRetryAttempts: config.maxRetryAttempts || 3,
      maxProviderRetries: config.maxProviderRetries || 2,
      retryableErrorTypes: config.retryableErrorTypes || [
        'network_error',
        'timeout',
        'rate_limit',
        'provider_error',
        'response_parsing',
        'unknown',
      ],

      // Provider switching configuration
      enableProviderSwitching: config.enableProviderSwitching !== false,
      preserveContext: config.preserveContext !== false,
      switchOnFirstFailure: config.switchOnFirstFailure || false,
      maxProviderSwitches: config.maxProviderSwitches || 3,

      // Circuit breaker integration
      enableCircuitBreaker: config.enableCircuitBreaker !== false,
      circuitBreakerThreshold: config.circuitBreakerThreshold || 5,
      circuitBreakerTimeout: config.circuitBreakerTimeout || 60000,

      // Context preservation
      contextFields: config.contextFields || [
        'model',
        'temperature',
        'maxTokens',
        'streaming',
        'userId',
        'sessionId',
        'requestId',
      ],

      // Failure tracking
      trackFailureHistory: config.trackFailureHistory !== false,
      failureHistorySize: config.failureHistorySize || 100,

      ...config,
    };

    // Failure tracking
    this.failureHistory = new Map(); // provider -> failure history
    this.providerSwitchHistory = new Map(); // request -> switch history
    this.contextPreservationCache = new Map(); // request -> preserved context

    // Statistics
    this.statistics = {
      totalRetries: 0,
      successfulRetries: 0,
      failedRetries: 0,
      providerSwitches: 0,
      contextPreservations: 0,
      circuitBreakerActivations: 0,
      averageRetryTime: 0,
      retryTimeHistory: [],
    };

    console.log('IntelligentRetrySystem initialized with config:', this.config);
  }

  /**
   * Execute operation with intelligent retry and fallback logic
   * @param {Function} operation - Operation to execute
   * @param {Array} providers - Available providers
   * @param {Object} options - Execution options
   * @returns {Promise<any>} Operation result
   */
  async executeWithIntelligentRetry(operation, providers, options = {}) {
    const startTime = Date.now();
    const requestId = options.requestId || this.generateRequestId();
    const originalContext = this.preserveContext(options.context || {});

    let lastError = null;
    let totalAttempts = 0;
    let providerSwitches = 0;
    let currentProviderIndex = 0;

    // Initialize context preservation
    this.contextPreservationCache.set(requestId, originalContext);

    // Initialize provider switch history
    this.providerSwitchHistory.set(requestId, {
      switches: [],
      totalSwitches: 0,
      startTime: startTime,
    });

    try {
      // Main retry loop across providers
      while (
        currentProviderIndex < providers.length &&
        providerSwitches <= this.config.maxProviderSwitches
      ) {
        const currentProvider = providers[currentProviderIndex];
        const providerName = currentProvider.name || currentProvider;

        // Check circuit breaker status
        if (
          this.config.enableCircuitBreaker &&
          !this.canExecuteWithProvider(providerName)
        ) {
          console.log(
            `Circuit breaker open for ${providerName}, switching to next provider`
          );
          currentProviderIndex++;
          providerSwitches++;
          continue;
        }

        // Retry with current provider
        const providerResult = await this.retryWithProvider(
          operation,
          currentProvider,
          providerName,
          {
            ...options,
            requestId,
            originalContext,
            totalAttempts,
            providerSwitches,
          }
        );

        if (providerResult.success) {
          // Success - update statistics and return
          this.updateSuccessStatistics(
            requestId,
            startTime,
            totalAttempts + providerResult.attempts
          );
          return providerResult.result;
        }

        // Provider failed - update tracking and consider switching
        lastError = providerResult.error;
        totalAttempts += providerResult.attempts;

        // Record provider failure
        this.recordProviderFailure(providerName, providerResult.error, {
          requestId,
          totalAttempts,
          providerSwitches,
        });

        // Determine if we should switch providers
        const shouldSwitch = this.shouldSwitchProvider(
          providerResult.error,
          providerName,
          providerSwitches,
          totalAttempts
        );

        if (shouldSwitch && currentProviderIndex < providers.length - 1) {
          // Switch to next provider
          const switchReason = this.determineSwitchReason(providerResult.error);
          await this.switchProvider(
            requestId,
            providerName,
            providers[currentProviderIndex + 1],
            switchReason
          );

          currentProviderIndex++;
          providerSwitches++;

          // Add delay between provider switches for stability
          if (providerSwitches > 1) {
            const switchDelay =
              this.calculateProviderSwitchDelay(providerSwitches);
            await this.sleep(switchDelay);
          }
        } else {
          // No more providers to try or switching disabled
          break;
        }
      }

      // All providers failed
      this.updateFailureStatistics(
        requestId,
        startTime,
        totalAttempts,
        lastError
      );
      throw new Error(
        `All providers failed after ${totalAttempts} attempts and ${providerSwitches} provider switches. Last error: ${
          lastError?.message || 'Unknown error'
        }`
      );
    } finally {
      // Cleanup
      this.contextPreservationCache.delete(requestId);
      this.providerSwitchHistory.delete(requestId);
    }
  }

  /**
   * Retry operation with a specific provider
   * @private
   */
  async retryWithProvider(operation, providerInfo, providerName, options) {
    const maxRetries =
      providerInfo.maxRetries || this.config.maxProviderRetries;
    const providerInstance = providerInfo.provider;
    let attempts = 0;
    let lastError = null;

    while (attempts < maxRetries) {
      attempts++;
      const attemptStartTime = Date.now();

      try {
        // Get preserved context for this attempt
        const enhancedContext = this.getEnhancedContext(options.requestId, {
          provider: providerName,
          attempt: attempts,
          maxAttempts: maxRetries,
          totalAttempts: options.totalAttempts + attempts,
          providerSwitches: options.providerSwitches,
          previousError: lastError,
        });

        console.log(
          `Attempting operation with ${providerName} (attempt ${attempts}/${maxRetries})`
        );

        // Execute operation with enhanced context
        const result = await this.executeWithTimeout(
          () => operation(providerInstance, providerName, enhancedContext),
          this.calculateOperationTimeout(providerName, attempts)
        );

        // Success
        console.log(
          `Operation succeeded with ${providerName} on attempt ${attempts}`
        );
        this.statistics.totalRetries++;
        this.statistics.successfulRetries++;

        return {
          success: true,
          result: result,
          attempts: attempts,
          provider: providerName,
        };
      } catch (error) {
        lastError = error;
        const responseTime = Date.now() - attemptStartTime;

        console.error(
          `Operation failed with ${providerName} (attempt ${attempts}/${maxRetries}):`,
          error.message
        );

        // Classify error to determine retry strategy
        const errorClassification = this.classifyError(error, {
          provider: providerName,
          attempt: attempts,
          responseTime: responseTime,
          requestId: options.requestId,
        });

        // Check if error is retryable
        if (!this.isRetryableError(errorClassification, attempts, maxRetries)) {
          console.log(
            `Error not retryable for ${providerName}:`,
            errorClassification.type
          );
          break;
        }

        // Calculate backoff delay
        const backoffDelay = this.calculateExponentialBackoff(
          attempts,
          errorClassification.type,
          providerName
        );

        console.log(
          `Retrying ${providerName} in ${backoffDelay}ms (attempt ${
            attempts + 1
          }/${maxRetries})`
        );

        // Wait before retry
        await this.sleep(backoffDelay);
      }
    }

    // All retries failed for this provider
    this.statistics.totalRetries++;
    this.statistics.failedRetries++;

    return {
      success: false,
      error: lastError,
      attempts: attempts,
      provider: providerName,
    };
  }

  /**
   * Calculate exponential backoff delay with jitter
   * @private
   */
  calculateExponentialBackoff(attempt, errorType, providerName) {
    // Base delay calculation
    let delay =
      this.config.baseDelay *
      Math.pow(this.config.backoffMultiplier, attempt - 1);

    // Apply error-type specific adjustments
    const errorTypeMultipliers = {
      rate_limit: 2.0, // Longer delays for rate limits
      timeout: 1.5, // Moderate delays for timeouts
      network_error: 1.2, // Slight increase for network errors
      provider_error: 1.0, // Standard delay for provider errors
      response_parsing: 0.8, // Shorter delays for parsing errors
    };

    const multiplier = errorTypeMultipliers[errorType] || 1.0;
    delay *= multiplier;

    // Apply jitter to prevent thundering herd
    if (this.config.jitterEnabled) {
      const jitter = delay * this.config.jitterFactor * (Math.random() - 0.5);
      delay += jitter;
    }

    // Apply provider-specific adjustments based on failure history
    const providerMultiplier = this.getProviderBackoffMultiplier(providerName);
    delay *= providerMultiplier;

    // Ensure delay is within bounds
    return Math.min(
      Math.max(delay, this.config.baseDelay),
      this.config.maxDelay
    );
  }

  /**
   * Get provider-specific backoff multiplier based on failure history
   * @private
   */
  getProviderBackoffMultiplier(providerName) {
    const history = this.failureHistory.get(providerName);
    if (!history || history.length === 0) {
      return 1.0;
    }

    // Calculate recent failure rate
    const recentFailures = history.slice(-10); // Last 10 failures
    const recentFailureRate = recentFailures.length / 10;

    // Increase backoff for providers with high recent failure rates
    if (recentFailureRate > 0.7) {
      return 2.0;
    } else if (recentFailureRate > 0.5) {
      return 1.5;
    } else if (recentFailureRate > 0.3) {
      return 1.2;
    }

    return 1.0;
  }

  /**
   * Calculate provider switch delay
   * @private
   */
  calculateProviderSwitchDelay(switchCount) {
    // Increase delay with each switch to prevent rapid switching
    const baseDelay = 500; // 500ms base delay
    return Math.min(baseDelay * Math.pow(1.5, switchCount - 1), 5000); // Max 5 seconds
  }

  /**
   * Calculate operation timeout based on provider and attempt
   * @private
   */
  calculateOperationTimeout(providerName, attempt) {
    const baseTimeout = 30000; // 30 seconds base timeout
    const attemptMultiplier = 1 + (attempt - 1) * 0.5; // Increase timeout with attempts

    // Provider-specific timeout adjustments
    const providerMultipliers = {
      cerebras: 1.2,
      openai: 1.0,
      anthropic: 1.1,
    };

    const providerMultiplier =
      providerMultipliers[providerName.toLowerCase()] || 1.0;

    return Math.min(
      baseTimeout * attemptMultiplier * providerMultiplier,
      120000
    ); // Max 2 minutes
  }

  /**
   * Determine if we should switch providers
   * @private
   */
  shouldSwitchProvider(error, providerName, currentSwitches, totalAttempts) {
    if (!this.config.enableProviderSwitching) {
      return false;
    }

    if (currentSwitches >= this.config.maxProviderSwitches) {
      return false;
    }

    // Classify error to determine switch strategy
    const errorClassification = this.classifyError(error, {
      provider: providerName,
    });

    // Always switch for critical errors
    if (errorClassification.severity === 'critical') {
      return true;
    }

    // Switch for non-retryable errors
    if (!errorClassification.retryable) {
      return true;
    }

    // Switch for provider-specific errors
    const providerSpecificErrors = [
      'authentication',
      'configuration',
      'provider_method',
      'rate_limit',
    ];

    if (providerSpecificErrors.includes(errorClassification.type)) {
      return true;
    }

    // Switch for errors that are likely to benefit from different providers
    const switchBeneficialErrors = [
      'network_error',
      'timeout',
      'provider_error',
      'unknown',
    ];

    if (switchBeneficialErrors.includes(errorClassification.type)) {
      // Switch after exhausting retries with current provider
      return true;
    }

    // Switch based on failure history
    const failureHistory = this.failureHistory.get(providerName) || [];
    const recentFailures = failureHistory.slice(-5); // Last 5 failures

    if (recentFailures.length >= 3) {
      const recentFailureRate =
        recentFailures.filter(
          (f) => Date.now() - f.timestamp < 300000 // Within last 5 minutes
        ).length / 5;

      if (recentFailureRate > 0.6) {
        return true;
      }
    }

    // Switch on first failure if configured
    if (this.config.switchOnFirstFailure && totalAttempts === 1) {
      return true;
    }

    return false;
  }

  /**
   * Determine reason for provider switch
   * @private
   */
  determineSwitchReason(error) {
    const errorClassification = this.classifyError(error);

    const reasonMap = {
      authentication: 'authentication_failure',
      configuration: 'configuration_error',
      provider_method: 'missing_method',
      rate_limit: 'rate_limit_exceeded',
      timeout: 'timeout_exceeded',
      network_error: 'network_failure',
      provider_error: 'provider_unavailable',
      response_parsing: 'response_format_error',
    };

    return reasonMap[errorClassification.type] || 'general_failure';
  }

  /**
   * Switch to next provider with context preservation
   * @private
   */
  async switchProvider(requestId, fromProvider, toProvider, reason) {
    const switchTime = Date.now();
    const toProviderName = toProvider.name || toProvider;

    console.log(
      `Switching provider: ${fromProvider} -> ${toProviderName} (reason: ${reason})`
    );

    // Record provider switch
    const switchHistory = this.providerSwitchHistory.get(requestId);
    if (switchHistory) {
      switchHistory.switches.push({
        from: fromProvider,
        to: toProviderName,
        reason: reason,
        timestamp: switchTime,
      });
      switchHistory.totalSwitches++;
    }

    // Update statistics
    this.statistics.providerSwitches++;

    // Emit switch event
    this.emit('providerSwitch', {
      requestId,
      from: fromProvider,
      to: toProviderName,
      reason,
      timestamp: switchTime,
    });

    // Preserve context for new provider
    if (this.config.preserveContext) {
      const preservedContext = this.contextPreservationCache.get(requestId);
      if (preservedContext) {
        preservedContext.switchHistory = switchHistory.switches;
        preservedContext.previousProvider = fromProvider;
        preservedContext.switchReason = reason;
        this.statistics.contextPreservations++;
      }
    }
  }

  /**
   * Preserve context for provider switching
   * @private
   */
  preserveContext(originalContext) {
    const preserved = {};

    // Preserve configured context fields
    for (const field of this.config.contextFields) {
      if (originalContext.hasOwnProperty(field)) {
        preserved[field] = originalContext[field];
      }
    }

    // Add preservation metadata
    preserved._preserved = true;
    preserved._preservationTime = Date.now();

    return preserved;
  }

  /**
   * Get enhanced context with preservation and metadata
   * @private
   */
  getEnhancedContext(requestId, metadata) {
    const preservedContext = this.contextPreservationCache.get(requestId) || {};

    return {
      ...preservedContext,
      ...metadata,
      _enhanced: true,
      _enhancementTime: Date.now(),
    };
  }

  /**
   * Check if provider can execute (circuit breaker integration)
   * @private
   */
  canExecuteWithProvider(providerName) {
    if (!this.config.enableCircuitBreaker) {
      return true;
    }

    const failureHistory = this.failureHistory.get(providerName) || [];
    const recentFailures = failureHistory.filter(
      (f) => Date.now() - f.timestamp < this.config.circuitBreakerTimeout
    );

    if (recentFailures.length >= this.config.circuitBreakerThreshold) {
      this.statistics.circuitBreakerActivations++;
      return false;
    }

    return true;
  }

  /**
   * Record provider failure for tracking
   * @private
   */
  recordProviderFailure(providerName, error, context) {
    if (!this.config.trackFailureHistory) {
      return;
    }

    if (!this.failureHistory.has(providerName)) {
      this.failureHistory.set(providerName, []);
    }

    const history = this.failureHistory.get(providerName);
    const errorClassification = this.classifyError(error, context);

    history.push({
      timestamp: Date.now(),
      error: error.message,
      errorType: errorClassification.type,
      severity: errorClassification.severity,
      context: context,
    });

    // Limit history size
    if (history.length > this.config.failureHistorySize) {
      history.splice(0, history.length - this.config.failureHistorySize);
    }
  }

  /**
   * Classify error using error classification system
   * @private
   */
  classifyError(error, context = {}) {
    try {
      // Try to use existing error classification system
      const ErrorClassificationSystem = require('./ErrorClassificationSystem');
      const classifier = new ErrorClassificationSystem();
      return classifier.classifyError(error, context);
    } catch (classificationError) {
      // Fallback to simple classification
      return this.simpleErrorClassification(error, context);
    }
  }

  /**
   * Simple error classification fallback
   * @private
   */
  simpleErrorClassification(error, context) {
    let type = 'unknown';
    let severity = 'medium';
    let retryable = true;

    // Basic error type detection
    if (error.message.includes('substring is not a function')) {
      type = 'response_parsing';
      severity = 'high';
    } else if (error.message.includes('is not a function')) {
      type = 'provider_method';
      severity = 'critical';
      retryable = false;
    } else if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
      type = 'network_error';
      severity = 'medium';
    } else if (error.message.toLowerCase().includes('timeout')) {
      type = 'timeout';
      severity = 'medium';
    } else if (error.status === 429) {
      type = 'rate_limit';
      severity = 'medium';
    } else if (error.status >= 500) {
      type = 'provider_error';
      severity = 'medium';
    } else if (error.status === 401 || error.status === 403) {
      type = 'authentication';
      severity = 'high';
      retryable = false;
    }

    return {
      type,
      severity,
      retryable,
      recoverable: retryable,
    };
  }

  /**
   * Check if error is retryable
   * @private
   */
  isRetryableError(errorClassification, currentAttempt, maxAttempts) {
    // Check if error type is retryable
    if (!this.config.retryableErrorTypes.includes(errorClassification.type)) {
      return false;
    }

    // Check if we've exceeded max attempts
    if (currentAttempt >= maxAttempts) {
      return false;
    }

    // Check error classification
    return errorClassification.retryable;
  }

  /**
   * Execute operation with timeout
   * @private
   */
  async executeWithTimeout(operation, timeoutMs) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Operation timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      operation()
        .then((result) => {
          clearTimeout(timer);
          resolve(result);
        })
        .catch((error) => {
          clearTimeout(timer);
          reject(error);
        });
    });
  }

  /**
   * Sleep for specified duration
   * @private
   */
  async sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Generate unique request ID
   * @private
   */
  generateRequestId() {
    return `retry_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Update success statistics
   * @private
   */
  updateSuccessStatistics(requestId, startTime, totalAttempts) {
    const totalTime = Date.now() - startTime;
    this.statistics.retryTimeHistory.push(totalTime);

    // Calculate average retry time
    if (this.statistics.retryTimeHistory.length > 100) {
      this.statistics.retryTimeHistory =
        this.statistics.retryTimeHistory.slice(-100);
    }

    this.statistics.averageRetryTime =
      this.statistics.retryTimeHistory.reduce((sum, time) => sum + time, 0) /
      this.statistics.retryTimeHistory.length;

    this.emit('operationSuccess', {
      requestId,
      totalTime,
      totalAttempts,
      averageRetryTime: this.statistics.averageRetryTime,
    });
  }

  /**
   * Update failure statistics
   * @private
   */
  updateFailureStatistics(requestId, startTime, totalAttempts, lastError) {
    const totalTime = Date.now() - startTime;

    this.emit('operationFailure', {
      requestId,
      totalTime,
      totalAttempts,
      lastError: lastError?.message,
      statistics: this.getStatistics(),
    });
  }

  /**
   * Get retry system statistics
   * @returns {Object} Statistics
   */
  getStatistics() {
    return {
      ...this.statistics,
      failureHistorySize: Array.from(this.failureHistory.values()).reduce(
        (sum, history) => sum + history.length,
        0
      ),
      activeRequests: this.contextPreservationCache.size,
      configuration: this.config,
    };
  }

  /**
   * Get failure history for a provider
   * @param {string} providerName - Provider name
   * @returns {Array} Failure history
   */
  getProviderFailureHistory(providerName) {
    return this.failureHistory.get(providerName) || [];
  }

  /**
   * Clear failure history for a provider
   * @param {string} providerName - Provider name
   */
  clearProviderFailureHistory(providerName) {
    this.failureHistory.delete(providerName);
  }

  /**
   * Reset all statistics and history
   */
  reset() {
    this.failureHistory.clear();
    this.providerSwitchHistory.clear();
    this.contextPreservationCache.clear();

    this.statistics = {
      totalRetries: 0,
      successfulRetries: 0,
      failedRetries: 0,
      providerSwitches: 0,
      contextPreservations: 0,
      circuitBreakerActivations: 0,
      averageRetryTime: 0,
      retryTimeHistory: [],
    };

    this.emit('systemReset');
  }

  /**
   * Update configuration
   * @param {Object} newConfig - New configuration
   */
  updateConfiguration(newConfig) {
    Object.assign(this.config, newConfig);
    this.emit('configurationUpdated', this.config);
  }
}

module.exports = IntelligentRetrySystem;
