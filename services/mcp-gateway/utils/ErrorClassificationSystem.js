// utils/ErrorClassificationSystem.js
// Comprehensive error classification and recovery strategy system

/**
 * Error Classification System
 * Categorizes errors, assesses severity, and determines recovery strategies
 */
class ErrorClassificationSystem {
  constructor(config = {}) {
    this.config = {
      // Classification thresholds
      criticalErrorThreshold: config.criticalErrorThreshold || 5,
      highSeverityResponseTime: config.highSeverityResponseTime || 10000,
      mediumSeverityResponseTime: config.mediumSeverityResponseTime || 5000,

      // Recovery strategy preferences
      maxRetryAttempts: config.maxRetryAttempts || 3,
      exponentialBackoffBase: config.exponentialBackoffBase || 1000,
      circuitBreakerThreshold: config.circuitBreakerThreshold || 5,

      // Provider switching preferences
      enableProviderSwitching: config.enableProviderSwitching !== false,
      enableFallbackGeneration: config.enableFallbackGeneration !== false,

      ...config,
    };

    // Error pattern registry
    this.errorPatterns = new Map();
    this.severityRules = new Map();
    this.recoveryStrategies = new Map();

    // Initialize default patterns and rules
    this.initializeDefaultPatterns();
    this.initializeDefaultSeverityRules();
    this.initializeDefaultRecoveryStrategies();

    console.log(
      'ErrorClassificationSystem initialized with config:',
      this.config
    );
  }

  /**
   * Classify an error and determine recovery strategy
   * @param {Error} error - The error to classify
   * @param {Object} context - Additional context about the error
   * @returns {Object} Classification result with recovery strategy
   */
  classifyError(error, context = {}) {
    const startTime = Date.now();

    try {
      // Extract error information
      const errorInfo = this.extractErrorInfo(error, context);

      // Determine error type
      const errorType = this.determineErrorType(errorInfo);

      // Assess severity
      const severity = this.assessSeverity(errorInfo, errorType, context);

      // Determine if error is recoverable
      const recoverable = this.isRecoverable(errorInfo, errorType, severity);

      // Determine if error is retryable
      const retryable = this.isRetryable(errorInfo, errorType, context);

      // Generate recovery strategy
      const recoveryStrategy = this.generateRecoveryStrategy(
        errorType,
        severity,
        recoverable,
        retryable,
        context
      );

      // Create classification result
      const classification = {
        // Basic classification
        type: errorType,
        severity: severity,
        recoverable: recoverable,
        retryable: retryable,

        // Error details
        errorInfo: errorInfo,

        // Recovery strategy
        recoveryStrategy: recoveryStrategy,

        // Metadata
        classificationTime: Date.now() - startTime,
        timestamp: new Date(),
        context: this.sanitizeContext(context),
      };

      // Log classification for monitoring
      this.logClassification(classification);

      return classification;
    } catch (classificationError) {
      console.error('Error during error classification:', classificationError);

      // Return fallback classification
      return this.createFallbackClassification(error, context);
    }
  }

  /**
   * Extract structured information from error
   * @private
   */
  extractErrorInfo(error, context) {
    return {
      // Basic error properties
      message: error.message || 'Unknown error',
      name: error.name || 'Error',
      code: error.code || null,
      status: error.status || error.statusCode || null,
      stack: error.stack || null,

      // Provider context
      provider: context.provider || error.provider || null,
      operation: context.operation || error.operation || null,

      // Request context
      requestId: context.requestId || null,
      responseTime: context.responseTime || null,
      attemptNumber: context.attemptNumber || 1,

      // Response context
      responseData: context.responseData || error.responseData || null,
      responseHeaders: context.responseHeaders || error.responseHeaders || null,

      // Network context
      isNetworkError: this.isNetworkError(error),
      isTimeoutError: this.isTimeoutError(error),
      isRateLimitError: this.isRateLimitError(error),

      // Parsing context
      isParsingError: this.isParsingError(error),
      originalResponse: context.originalResponse || null,
    };
  }

  /**
   * Determine the primary error type
   * @private
   */
  determineErrorType(errorInfo) {
    // Check for response parsing errors (primary concern from requirements)
    if (
      errorInfo.isParsingError ||
      errorInfo.message.includes('substring is not a function') ||
      errorInfo.message.includes('Cannot read property') ||
      errorInfo.message.includes('Cannot read properties')
    ) {
      return 'response_parsing';
    }

    // Check for provider method errors
    if (
      errorInfo.message.includes('is not a function') ||
      errorInfo.message.includes('getProviderHealth')
    ) {
      return 'provider_method';
    }

    // Check for network errors
    if (errorInfo.isNetworkError) {
      return 'network_error';
    }

    // Check for timeout errors
    if (errorInfo.isTimeoutError) {
      return 'timeout';
    }

    // Check for rate limiting
    if (errorInfo.isRateLimitError) {
      return 'rate_limit';
    }

    // Check for authentication errors
    if (errorInfo.status === 401 || errorInfo.status === 403) {
      return 'authentication';
    }

    // Check for provider service errors
    if (errorInfo.status >= 500 && errorInfo.status < 600) {
      return 'provider_error';
    }

    // Check for validation errors
    if (errorInfo.status === 400 || errorInfo.name === 'ValidationError') {
      return 'validation';
    }

    // Check for configuration errors
    if (
      errorInfo.message.includes('configuration') ||
      errorInfo.message.includes('config') ||
      errorInfo.message.includes('API key')
    ) {
      return 'configuration';
    }

    // Default to unknown
    return 'unknown';
  }

  /**
   * Assess error severity
   * @private
   */
  assessSeverity(errorInfo, errorType, context) {
    // Critical severity conditions
    if (this.isCriticalError(errorInfo, errorType, context)) {
      return 'critical';
    }

    // High severity conditions
    if (this.isHighSeverityError(errorInfo, errorType, context)) {
      return 'high';
    }

    // Medium severity conditions
    if (this.isMediumSeverityError(errorInfo, errorType, context)) {
      return 'medium';
    }

    // Default to low severity
    return 'low';
  }

  /**
   * Check if error is critical severity
   * @private
   */
  isCriticalError(errorInfo, errorType, context) {
    // System-breaking errors
    if (
      errorType === 'provider_method' &&
      errorInfo.message.includes('getProviderHealth')
    ) {
      return true;
    }

    // All providers failing
    if (context.allProvidersFailed) {
      return true;
    }

    // Consecutive failures exceeding threshold
    if (context.consecutiveFailures >= this.config.criticalErrorThreshold) {
      return true;
    }

    // Configuration errors that prevent operation
    if (
      errorType === 'configuration' &&
      (errorInfo.message.includes('API key') ||
        errorInfo.message.includes('required'))
    ) {
      return true;
    }

    return false;
  }

  /**
   * Check if error is high severity
   * @private
   */
  isHighSeverityError(errorInfo, errorType, context) {
    // Response parsing errors affecting core functionality
    if (errorType === 'response_parsing') {
      return true;
    }

    // Provider errors with high response times
    if (
      errorType === 'provider_error' &&
      errorInfo.responseTime > this.config.highSeverityResponseTime
    ) {
      return true;
    }

    // Authentication failures
    if (errorType === 'authentication') {
      return true;
    }

    // Multiple consecutive failures
    if (context.consecutiveFailures >= 3) {
      return true;
    }

    return false;
  }

  /**
   * Check if error is medium severity
   * @private
   */
  isMediumSeverityError(errorInfo, errorType, context) {
    // Network errors
    if (errorType === 'network_error') {
      return true;
    }

    // Timeout errors
    if (errorType === 'timeout') {
      return true;
    }

    // Rate limiting
    if (errorType === 'rate_limit') {
      return true;
    }

    // Provider errors (default to medium severity)
    if (errorType === 'provider_error') {
      return true;
    }

    return false;
  }

  /**
   * Determine if error is recoverable
   * @private
   */
  isRecoverable(errorInfo, errorType, severity) {
    // Non-recoverable error types
    const nonRecoverableTypes = ['configuration', 'authentication'];
    if (nonRecoverableTypes.includes(errorType)) {
      return false;
    }

    // Provider method errors are not recoverable through normal means
    if (errorType === 'provider_method') {
      return false;
    }

    // Critical parsing errors may not be recoverable
    if (errorType === 'response_parsing' && severity === 'critical') {
      return false;
    }

    // Most other errors are potentially recoverable
    return true;
  }

  /**
   * Determine if error is retryable
   * @private
   */
  isRetryable(errorInfo, errorType, context) {
    // Non-retryable error types
    const nonRetryableTypes = [
      'configuration',
      'authentication',
      'validation',
      'provider_method',
    ];
    if (nonRetryableTypes.includes(errorType)) {
      return false;
    }

    // Check if max attempts exceeded
    if (context.attemptNumber >= this.config.maxRetryAttempts) {
      return false;
    }

    // Rate limit errors are retryable with backoff
    if (errorType === 'rate_limit') {
      return true;
    }

    // Network and timeout errors are retryable
    if (['network_error', 'timeout'].includes(errorType)) {
      return true;
    }

    // Provider errors are retryable
    if (errorType === 'provider_error') {
      return true;
    }

    // Response parsing errors may be retryable with different provider
    if (errorType === 'response_parsing') {
      return true;
    }

    // Unknown errors are retryable by default
    if (errorType === 'unknown') {
      return true;
    }

    return false;
  }

  /**
   * Generate recovery strategy based on classification
   * @private
   */
  generateRecoveryStrategy(
    errorType,
    severity,
    recoverable,
    retryable,
    context
  ) {
    const strategy = {
      actions: [],
      priority: this.getStrategyPriority(severity),
      estimatedRecoveryTime: this.estimateRecoveryTime(errorType, severity),
      fallbackOptions: [],
    };

    // Add immediate actions based on error type
    switch (errorType) {
      case 'response_parsing':
        strategy.actions.push({
          type: 'enhance_parsing',
          description:
            'Apply enhanced response parsing with multiple strategies',
          timeout: 5000,
        });

        if (this.config.enableProviderSwitching) {
          strategy.actions.push({
            type: 'switch_provider',
            description: 'Switch to alternative provider',
            timeout: 10000,
          });
        }
        break;

      case 'provider_method':
        strategy.actions.push({
          type: 'implement_method',
          description: 'Implement missing provider method',
          timeout: 1000,
        });
        break;

      case 'network_error':
      case 'timeout':
        if (retryable) {
          strategy.actions.push({
            type: 'exponential_backoff_retry',
            description: 'Retry with exponential backoff',
            timeout: this.calculateBackoffTime(context.attemptNumber || 1),
            maxAttempts: this.config.maxRetryAttempts,
          });
        }
        break;

      case 'rate_limit':
        strategy.actions.push({
          type: 'rate_limit_backoff',
          description: 'Wait for rate limit reset',
          timeout: this.extractRateLimitTimeout(context) || 60000,
        });
        break;

      case 'provider_error':
        if (this.config.enableProviderSwitching) {
          strategy.actions.push({
            type: 'switch_provider',
            description: 'Switch to healthy provider',
            timeout: 5000,
          });
        }

        if (retryable) {
          strategy.actions.push({
            type: 'retry_with_backoff',
            description: 'Retry with current provider after backoff',
            timeout: this.calculateBackoffTime(context.attemptNumber || 1),
          });
        }
        break;

      case 'authentication':
        strategy.actions.push({
          type: 'refresh_credentials',
          description: 'Attempt to refresh authentication credentials',
          timeout: 5000,
        });
        break;

      case 'configuration':
        strategy.actions.push({
          type: 'validate_config',
          description: 'Validate and repair configuration',
          timeout: 2000,
        });
        break;

      default:
        if (retryable) {
          strategy.actions.push({
            type: 'generic_retry',
            description: 'Generic retry with backoff',
            timeout: this.calculateBackoffTime(context.attemptNumber || 1),
          });
        }
    }

    // Add fallback options based on severity
    if (severity === 'critical' || severity === 'high') {
      if (this.config.enableProviderSwitching) {
        strategy.fallbackOptions.push({
          type: 'provider_fallback',
          description: 'Use alternative provider',
          priority: 1,
        });
      }

      if (this.config.enableFallbackGeneration) {
        strategy.fallbackOptions.push({
          type: 'local_fallback',
          description: 'Use local fallback generation',
          priority: 2,
        });
      }
    }

    // Add circuit breaker action for repeated failures
    if (context.consecutiveFailures >= this.config.circuitBreakerThreshold) {
      strategy.actions.unshift({
        type: 'circuit_breaker',
        description: 'Activate circuit breaker for provider',
        timeout: 1000,
      });
    }

    return strategy;
  }

  /**
   * Get strategy priority based on severity
   * @private
   */
  getStrategyPriority(severity) {
    const priorities = {
      critical: 1,
      high: 2,
      medium: 3,
      low: 4,
    };
    return priorities[severity] || 4;
  }

  /**
   * Estimate recovery time based on error type and severity
   * @private
   */
  estimateRecoveryTime(errorType, severity) {
    const baseTime = {
      response_parsing: 5000,
      provider_method: 1000,
      network_error: 10000,
      timeout: 15000,
      rate_limit: 60000,
      provider_error: 10000,
      authentication: 5000,
      configuration: 2000,
      unknown: 10000,
    };

    const severityMultiplier = {
      critical: 2,
      high: 1.5,
      medium: 1,
      low: 0.5,
    };

    return (baseTime[errorType] || 10000) * (severityMultiplier[severity] || 1);
  }

  /**
   * Calculate exponential backoff time
   * @private
   */
  calculateBackoffTime(attemptNumber) {
    return Math.min(
      this.config.exponentialBackoffBase * Math.pow(2, attemptNumber - 1),
      30000 // Max 30 seconds
    );
  }

  /**
   * Extract rate limit timeout from context
   * @private
   */
  extractRateLimitTimeout(context) {
    // Try to extract from response headers
    if (context.responseHeaders) {
      const retryAfter =
        context.responseHeaders['retry-after'] ||
        context.responseHeaders['x-ratelimit-reset'];
      if (retryAfter) {
        return parseInt(retryAfter) * 1000; // Convert to milliseconds
      }
    }

    return null;
  }

  /**
   * Check if error is a network error
   * @private
   */
  isNetworkError(error) {
    const networkCodes = [
      'ECONNREFUSED',
      'ENOTFOUND',
      'ECONNRESET',
      'ETIMEDOUT',
    ];
    return (
      networkCodes.includes(error.code) ||
      error.message.toLowerCase().includes('network') ||
      error.message.toLowerCase().includes('connection')
    );
  }

  /**
   * Check if error is a timeout error
   * @private
   */
  isTimeoutError(error) {
    return (
      error.name === 'TimeoutError' ||
      error.code === 'ETIMEDOUT' ||
      error.message.toLowerCase().includes('timeout') ||
      error.message.toLowerCase().includes('timed out')
    );
  }

  /**
   * Check if error is a rate limit error
   * @private
   */
  isRateLimitError(error) {
    return (
      error.status === 429 ||
      error.message.toLowerCase().includes('rate limit') ||
      error.message.toLowerCase().includes('too many requests')
    );
  }

  /**
   * Check if error is a parsing error
   * @private
   */
  isParsingError(error) {
    return (
      error.message.includes('substring is not a function') ||
      error.message.includes('Cannot read property') ||
      error.message.includes('Cannot read properties') ||
      error.message.includes('JSON.parse') ||
      error.message.toLowerCase().includes('parsing') ||
      error.name === 'SyntaxError'
    );
  }

  /**
   * Sanitize context for logging
   * @private
   */
  sanitizeContext(context) {
    const sanitized = { ...context };

    // Remove sensitive information
    delete sanitized.apiKey;
    delete sanitized.credentials;
    delete sanitized.authorization;

    // Truncate large response data
    if (sanitized.responseData && typeof sanitized.responseData === 'string') {
      if (sanitized.responseData.length > 1000) {
        sanitized.responseData =
          sanitized.responseData.substring(0, 1000) + '... [truncated]';
      }
    }

    return sanitized;
  }

  /**
   * Log classification for monitoring
   * @private
   */
  logClassification(classification) {
    console.log('Error classified:', {
      type: classification.type,
      severity: classification.severity,
      recoverable: classification.recoverable,
      retryable: classification.retryable,
      provider: classification.errorInfo.provider,
      operation: classification.errorInfo.operation,
      strategyActions: classification.recoveryStrategy.actions.length,
      fallbackOptions: classification.recoveryStrategy.fallbackOptions.length,
    });
  }

  /**
   * Create fallback classification when classification fails
   * @private
   */
  createFallbackClassification(error, context) {
    return {
      type: 'unknown',
      severity: 'high',
      recoverable: true,
      retryable: true,
      errorInfo: {
        message: error.message || 'Unknown error',
        name: error.name || 'Error',
        provider: context.provider || null,
        operation: context.operation || null,
      },
      recoveryStrategy: {
        actions: [
          {
            type: 'generic_retry',
            description: 'Generic retry with backoff',
            timeout: 5000,
          },
        ],
        priority: 2,
        estimatedRecoveryTime: 10000,
        fallbackOptions: [
          {
            type: 'local_fallback',
            description: 'Use local fallback generation',
            priority: 1,
          },
        ],
      },
      classificationTime: 0,
      timestamp: new Date(),
      context: this.sanitizeContext(context),
      fallbackClassification: true,
    };
  }

  /**
   * Initialize default error patterns
   * @private
   */
  initializeDefaultPatterns() {
    // Response parsing patterns
    this.errorPatterns.set('response_parsing', [
      /substring is not a function/i,
      /Cannot read property.*of undefined/i,
      /Cannot read properties.*of undefined/i,
      /JSON\.parse.*error/i,
      /Unexpected token.*JSON/i,
    ]);

    // Provider method patterns
    this.errorPatterns.set('provider_method', [
      /is not a function/i,
      /getProviderHealth.*not.*function/i,
      /undefined.*method/i,
    ]);

    // Network error patterns
    this.errorPatterns.set('network_error', [
      /ECONNREFUSED/i,
      /ENOTFOUND/i,
      /ECONNRESET/i,
      /network.*error/i,
      /connection.*failed/i,
    ]);
  }

  /**
   * Initialize default severity rules
   * @private
   */
  initializeDefaultSeverityRules() {
    this.severityRules.set('response_parsing', 'high');
    this.severityRules.set('provider_method', 'critical');
    this.severityRules.set('authentication', 'high');
    this.severityRules.set('configuration', 'critical');
    this.severityRules.set('network_error', 'medium');
    this.severityRules.set('timeout', 'medium');
    this.severityRules.set('rate_limit', 'medium');
    this.severityRules.set('provider_error', 'medium');
    this.severityRules.set('validation', 'low');
    this.severityRules.set('unknown', 'low');
  }

  /**
   * Initialize default recovery strategies
   * @private
   */
  initializeDefaultRecoveryStrategies() {
    // Response parsing recovery
    this.recoveryStrategies.set('response_parsing', {
      primaryAction: 'enhance_parsing',
      fallbackAction: 'switch_provider',
      maxAttempts: 2,
    });

    // Provider method recovery
    this.recoveryStrategies.set('provider_method', {
      primaryAction: 'implement_method',
      fallbackAction: 'graceful_degradation',
      maxAttempts: 1,
    });

    // Network error recovery
    this.recoveryStrategies.set('network_error', {
      primaryAction: 'exponential_backoff_retry',
      fallbackAction: 'switch_provider',
      maxAttempts: 3,
    });
  }

  /**
   * Get classification statistics
   * @returns {Object} Classification statistics
   */
  getClassificationStatistics() {
    return {
      errorPatterns: this.errorPatterns.size,
      severityRules: this.severityRules.size,
      recoveryStrategies: this.recoveryStrategies.size,
      config: this.config,
    };
  }

  /**
   * Add custom error pattern
   * @param {string} errorType - Error type
   * @param {RegExp} pattern - Pattern to match
   */
  addErrorPattern(errorType, pattern) {
    if (!this.errorPatterns.has(errorType)) {
      this.errorPatterns.set(errorType, []);
    }
    this.errorPatterns.get(errorType).push(pattern);
  }

  /**
   * Set custom severity rule
   * @param {string} errorType - Error type
   * @param {string} severity - Severity level
   */
  setSeverityRule(errorType, severity) {
    this.severityRules.set(errorType, severity);
  }

  /**
   * Set custom recovery strategy
   * @param {string} errorType - Error type
   * @param {Object} strategy - Recovery strategy configuration
   */
  setRecoveryStrategy(errorType, strategy) {
    this.recoveryStrategies.set(errorType, strategy);
  }
}

module.exports = ErrorClassificationSystem;
