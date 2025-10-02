// utils/ErrorHandler.js
// Enhanced error handling and classification

const ErrorTypes = {
  PROVIDER_UNAVAILABLE: 'provider_unavailable',
  RATE_LIMIT_EXCEEDED: 'rate_limit_exceeded',
  INVALID_RESPONSE: 'invalid_response',
  VALIDATION_FAILED: 'validation_failed',
  TIMEOUT: 'timeout',
  AUTHENTICATION: 'authentication',
  QUOTA_EXCEEDED: 'quota_exceeded',
  NETWORK_ERROR: 'network_error',
  SERVER_ERROR: 'server_error',
  CLIENT_ERROR: 'client_error',
  PARSING_ERROR: 'parsing_error',
  CONFIGURATION_ERROR: 'configuration_error',
  RESOURCE_EXHAUSTED: 'resource_exhausted',
  SERVICE_DEGRADED: 'service_degraded',
  CIRCUIT_BREAKER_OPEN: 'circuit_breaker_open',
  FALLBACK_FAILED: 'fallback_failed',
  STREAMING_ERROR: 'streaming_error',
  TOKEN_LIMIT_EXCEEDED: 'token_limit_exceeded',
  MODEL_UNAVAILABLE: 'model_unavailable',
  CONTENT_FILTER: 'content_filter',
  UNKNOWN: 'unknown',
};

const ErrorSeverity = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical',
};

const ErrorCategory = {
  TRANSIENT: 'transient', // Temporary errors that may resolve
  PERMANENT: 'permanent', // Errors that won't resolve without intervention
  CONFIGURATION: 'configuration', // Configuration-related errors
  CAPACITY: 'capacity', // Resource/capacity related errors
  EXTERNAL: 'external', // External service errors
};

class EnhancedError extends Error {
  constructor(
    message,
    type,
    provider = null,
    originalError = null,
    context = {}
  ) {
    super(message);
    this.name = 'EnhancedError';
    this.type = type;
    this.provider = provider;
    this.originalError = originalError;
    this.timestamp = new Date();
    this.severity = this.determineSeverity(type);
    this.category = this.determineCategory(type);
    this.retryable = this.determineRetryability(type);
    this.context = {
      requestId: context.requestId,
      operation: context.operation,
      model: context.model,
      attempt: context.attempt || 1,
      ...context,
    };
    this.errorId = this.generateErrorId();
  }

  determineSeverity(type) {
    const severityMap = {
      [ErrorTypes.PROVIDER_UNAVAILABLE]: ErrorSeverity.HIGH,
      [ErrorTypes.RATE_LIMIT_EXCEEDED]: ErrorSeverity.MEDIUM,
      [ErrorTypes.INVALID_RESPONSE]: ErrorSeverity.MEDIUM,
      [ErrorTypes.VALIDATION_FAILED]: ErrorSeverity.MEDIUM,
      [ErrorTypes.TIMEOUT]: ErrorSeverity.MEDIUM,
      [ErrorTypes.AUTHENTICATION]: ErrorSeverity.HIGH,
      [ErrorTypes.QUOTA_EXCEEDED]: ErrorSeverity.HIGH,
      [ErrorTypes.NETWORK_ERROR]: ErrorSeverity.MEDIUM,
      [ErrorTypes.SERVER_ERROR]: ErrorSeverity.HIGH,
      [ErrorTypes.CLIENT_ERROR]: ErrorSeverity.LOW,
      [ErrorTypes.PARSING_ERROR]: ErrorSeverity.MEDIUM,
      [ErrorTypes.CONFIGURATION_ERROR]: ErrorSeverity.HIGH,
      [ErrorTypes.RESOURCE_EXHAUSTED]: ErrorSeverity.HIGH,
      [ErrorTypes.SERVICE_DEGRADED]: ErrorSeverity.MEDIUM,
      [ErrorTypes.CIRCUIT_BREAKER_OPEN]: ErrorSeverity.HIGH,
      [ErrorTypes.FALLBACK_FAILED]: ErrorSeverity.CRITICAL,
      [ErrorTypes.STREAMING_ERROR]: ErrorSeverity.MEDIUM,
      [ErrorTypes.TOKEN_LIMIT_EXCEEDED]: ErrorSeverity.LOW,
      [ErrorTypes.MODEL_UNAVAILABLE]: ErrorSeverity.HIGH,
      [ErrorTypes.CONTENT_FILTER]: ErrorSeverity.LOW,
      [ErrorTypes.UNKNOWN]: ErrorSeverity.MEDIUM,
    };
    return severityMap[type] || ErrorSeverity.MEDIUM;
  }

  determineCategory(type) {
    const categoryMap = {
      [ErrorTypes.PROVIDER_UNAVAILABLE]: ErrorCategory.TRANSIENT,
      [ErrorTypes.RATE_LIMIT_EXCEEDED]: ErrorCategory.CAPACITY,
      [ErrorTypes.INVALID_RESPONSE]: ErrorCategory.EXTERNAL,
      [ErrorTypes.VALIDATION_FAILED]: ErrorCategory.PERMANENT,
      [ErrorTypes.TIMEOUT]: ErrorCategory.TRANSIENT,
      [ErrorTypes.AUTHENTICATION]: ErrorCategory.CONFIGURATION,
      [ErrorTypes.QUOTA_EXCEEDED]: ErrorCategory.CAPACITY,
      [ErrorTypes.NETWORK_ERROR]: ErrorCategory.TRANSIENT,
      [ErrorTypes.SERVER_ERROR]: ErrorCategory.EXTERNAL,
      [ErrorTypes.CLIENT_ERROR]: ErrorCategory.PERMANENT,
      [ErrorTypes.PARSING_ERROR]: ErrorCategory.PERMANENT,
      [ErrorTypes.CONFIGURATION_ERROR]: ErrorCategory.CONFIGURATION,
      [ErrorTypes.RESOURCE_EXHAUSTED]: ErrorCategory.CAPACITY,
      [ErrorTypes.SERVICE_DEGRADED]: ErrorCategory.EXTERNAL,
      [ErrorTypes.CIRCUIT_BREAKER_OPEN]: ErrorCategory.TRANSIENT,
      [ErrorTypes.FALLBACK_FAILED]: ErrorCategory.PERMANENT,
      [ErrorTypes.STREAMING_ERROR]: ErrorCategory.TRANSIENT,
      [ErrorTypes.TOKEN_LIMIT_EXCEEDED]: ErrorCategory.PERMANENT,
      [ErrorTypes.MODEL_UNAVAILABLE]: ErrorCategory.EXTERNAL,
      [ErrorTypes.CONTENT_FILTER]: ErrorCategory.PERMANENT,
      [ErrorTypes.UNKNOWN]: ErrorCategory.EXTERNAL,
    };
    return categoryMap[type] || ErrorCategory.EXTERNAL;
  }

  determineRetryability(type) {
    const retryableTypes = [
      ErrorTypes.PROVIDER_UNAVAILABLE,
      ErrorTypes.RATE_LIMIT_EXCEEDED,
      ErrorTypes.TIMEOUT,
      ErrorTypes.NETWORK_ERROR,
      ErrorTypes.SERVER_ERROR,
      ErrorTypes.SERVICE_DEGRADED,
      ErrorTypes.STREAMING_ERROR,
      ErrorTypes.RESOURCE_EXHAUSTED,
    ];
    return retryableTypes.includes(type);
  }

  generateErrorId() {
    return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  toJSON() {
    return {
      errorId: this.errorId,
      name: this.name,
      message: this.message,
      type: this.type,
      severity: this.severity,
      category: this.category,
      retryable: this.retryable,
      provider: this.provider,
      timestamp: this.timestamp,
      context: this.context,
      stack: this.stack,
      originalError: this.originalError
        ? {
            name: this.originalError.name,
            message: this.originalError.message,
            code: this.originalError.code,
            status:
              this.originalError.status || this.originalError.response?.status,
          }
        : null,
    };
  }
}

class ErrorHandler {
  static classifyError(error, provider = null, context = {}) {
    // Handle EnhancedError instances
    if (error instanceof EnhancedError) {
      return error;
    }

    let errorType = ErrorTypes.UNKNOWN;
    let message = error.message || 'Unknown error occurred';

    // Network and connection errors
    if (
      error.code === 'ECONNREFUSED' ||
      error.code === 'ENOTFOUND' ||
      error.code === 'ECONNRESET'
    ) {
      errorType = ErrorTypes.NETWORK_ERROR;
      message = `Network connection failed: ${error.code}`;
    } else if (
      error.code === 'ECONNABORTED' ||
      error.message?.includes('timeout')
    ) {
      errorType = ErrorTypes.TIMEOUT;
      message = 'Request timeout exceeded';
    }

    // HTTP status code errors
    else if (error.response?.status) {
      const status = error.response.status;

      if (status === 401 || status === 403) {
        errorType = ErrorTypes.AUTHENTICATION;
        message = `Authentication failed (${status})`;
      } else if (status === 429) {
        errorType = ErrorTypes.RATE_LIMIT_EXCEEDED;
        message = 'Rate limit exceeded';
      } else if (status === 404) {
        errorType = ErrorTypes.MODEL_UNAVAILABLE;
        message = 'Model or endpoint not found';
      } else if (status >= 400 && status < 500) {
        errorType = ErrorTypes.CLIENT_ERROR;
        message = `Client error (${status}): ${
          error.response.data?.message || error.message
        }`;
      } else if (status >= 500) {
        errorType = ErrorTypes.SERVER_ERROR;
        message = `Server error (${status}): ${
          error.response.data?.message || error.message
        }`;
      }
    }

    // Provider-specific errors
    else if (error.message?.includes('circuit breaker')) {
      errorType = ErrorTypes.CIRCUIT_BREAKER_OPEN;
      message = 'Circuit breaker is open';
    } else if (
      error.message?.includes('quota') ||
      error.message?.includes('limit exceeded')
    ) {
      errorType = ErrorTypes.QUOTA_EXCEEDED;
      message = 'API quota or limit exceeded';
    } else if (
      error.message?.includes('token') &&
      error.message?.includes('limit')
    ) {
      errorType = ErrorTypes.TOKEN_LIMIT_EXCEEDED;
      message = 'Token limit exceeded for request';
    } else if (
      error.message?.includes('content') &&
      error.message?.includes('filter')
    ) {
      errorType = ErrorTypes.CONTENT_FILTER;
      message = 'Content filtered by provider';
    } else if (
      error.message?.includes('stream') ||
      error.message?.includes('streaming')
    ) {
      errorType = ErrorTypes.STREAMING_ERROR;
      message = 'Streaming connection error';
    }

    // Validation and parsing errors
    else if (
      error.name === 'ValidationError' ||
      error.message?.includes('validation')
    ) {
      errorType = ErrorTypes.VALIDATION_FAILED;
      message = `Validation failed: ${error.message}`;
    } else if (
      error.name === 'SyntaxError' ||
      error.message?.includes('parse') ||
      error.message?.includes('JSON')
    ) {
      errorType = ErrorTypes.PARSING_ERROR;
      message = `Response parsing failed: ${error.message}`;
    }

    // Configuration errors
    else if (
      error.message?.includes('config') ||
      error.message?.includes('configuration')
    ) {
      errorType = ErrorTypes.CONFIGURATION_ERROR;
      message = `Configuration error: ${error.message}`;
    }

    // Resource exhaustion
    else if (
      error.message?.includes('resource') ||
      error.message?.includes('capacity')
    ) {
      errorType = ErrorTypes.RESOURCE_EXHAUSTED;
      message = `Resource exhausted: ${error.message}`;
    }

    return new EnhancedError(message, errorType, provider, error, context);
  }

  static shouldRetry(error) {
    if (error instanceof EnhancedError) {
      return error.retryable;
    }

    const retryableTypes = [
      ErrorTypes.TIMEOUT,
      ErrorTypes.RATE_LIMIT_EXCEEDED,
      ErrorTypes.PROVIDER_UNAVAILABLE,
      ErrorTypes.NETWORK_ERROR,
      ErrorTypes.SERVER_ERROR,
      ErrorTypes.SERVICE_DEGRADED,
      ErrorTypes.STREAMING_ERROR,
      ErrorTypes.RESOURCE_EXHAUSTED,
    ];
    return retryableTypes.includes(error.type);
  }

  static getRetryDelay(attempt, errorType = null, baseDelay = 1000) {
    // Different retry strategies based on error type
    let multiplier = 2;
    let maxDelay = 30000; // 30 seconds

    switch (errorType) {
      case ErrorTypes.RATE_LIMIT_EXCEEDED:
        // Longer delays for rate limiting
        multiplier = 3;
        maxDelay = 60000; // 1 minute
        break;
      case ErrorTypes.TIMEOUT:
        // Shorter delays for timeouts
        multiplier = 1.5;
        maxDelay = 15000; // 15 seconds
        break;
      case ErrorTypes.SERVER_ERROR:
        // Standard exponential backoff
        multiplier = 2;
        maxDelay = 45000; // 45 seconds
        break;
      case ErrorTypes.NETWORK_ERROR:
        // Quick retries for network issues
        multiplier = 1.8;
        maxDelay = 20000; // 20 seconds
        break;
    }

    const delay = Math.min(
      baseDelay * Math.pow(multiplier, attempt - 1),
      maxDelay
    );

    // Add jitter to prevent thundering herd
    const jitter = delay * 0.1 * Math.random();
    return Math.floor(delay + jitter);
  }

  static getMaxRetries(errorType) {
    const maxRetriesMap = {
      [ErrorTypes.RATE_LIMIT_EXCEEDED]: 5,
      [ErrorTypes.TIMEOUT]: 3,
      [ErrorTypes.NETWORK_ERROR]: 4,
      [ErrorTypes.SERVER_ERROR]: 3,
      [ErrorTypes.PROVIDER_UNAVAILABLE]: 2,
      [ErrorTypes.SERVICE_DEGRADED]: 3,
      [ErrorTypes.STREAMING_ERROR]: 2,
      [ErrorTypes.RESOURCE_EXHAUSTED]: 2,
    };
    return maxRetriesMap[errorType] || 2;
  }

  static createRecoveryStrategy(error) {
    if (!(error instanceof EnhancedError)) {
      error = this.classifyError(error);
    }

    const strategy = {
      errorId: error.errorId,
      type: error.type,
      severity: error.severity,
      category: error.category,
      retryable: error.retryable,
      maxRetries: this.getMaxRetries(error.type),
      actions: [],
    };

    // Define recovery actions based on error type
    switch (error.type) {
      case ErrorTypes.PROVIDER_UNAVAILABLE:
        strategy.actions = [
          { type: 'retry', delay: this.getRetryDelay(1, error.type) },
          { type: 'fallback_provider', priority: 'high' },
          { type: 'circuit_breaker', action: 'open' },
        ];
        break;

      case ErrorTypes.RATE_LIMIT_EXCEEDED:
        strategy.actions = [
          { type: 'backoff', delay: this.getRetryDelay(1, error.type) },
          { type: 'queue_request', priority: 'low' },
          { type: 'fallback_provider', priority: 'medium' },
        ];
        break;

      case ErrorTypes.AUTHENTICATION:
        strategy.actions = [
          { type: 'refresh_credentials', priority: 'high' },
          { type: 'fallback_provider', priority: 'high' },
          { type: 'alert', severity: 'high' },
        ];
        break;

      case ErrorTypes.TIMEOUT:
        strategy.actions = [
          { type: 'retry', delay: this.getRetryDelay(1, error.type) },
          { type: 'reduce_timeout', factor: 0.8 },
          { type: 'fallback_provider', priority: 'medium' },
        ];
        break;

      case ErrorTypes.SERVER_ERROR:
        strategy.actions = [
          { type: 'retry', delay: this.getRetryDelay(1, error.type) },
          { type: 'fallback_provider', priority: 'high' },
          { type: 'alert', severity: 'medium' },
        ];
        break;

      case ErrorTypes.VALIDATION_FAILED:
        strategy.actions = [
          { type: 'repair_content', method: 'auto' },
          { type: 'simplify_prompt', level: 1 },
          { type: 'fallback_provider', priority: 'low' },
        ];
        break;

      case ErrorTypes.PARSING_ERROR:
        strategy.actions = [
          { type: 'repair_response', method: 'json_fix' },
          { type: 'retry', delay: this.getRetryDelay(1, error.type) },
          { type: 'fallback_provider', priority: 'medium' },
        ];
        break;

      case ErrorTypes.CIRCUIT_BREAKER_OPEN:
        strategy.actions = [
          { type: 'fallback_provider', priority: 'high' },
          { type: 'wait_circuit_breaker', duration: 30000 },
          { type: 'alert', severity: 'high' },
        ];
        break;

      case ErrorTypes.FALLBACK_FAILED:
        strategy.actions = [
          { type: 'emergency_response', method: 'cached' },
          { type: 'alert', severity: 'critical' },
          { type: 'graceful_degradation', level: 'minimal' },
        ];
        break;

      default:
        strategy.actions = [
          { type: 'retry', delay: this.getRetryDelay(1, error.type) },
          { type: 'fallback_provider', priority: 'medium' },
          { type: 'log_error', level: 'warn' },
        ];
    }

    return strategy;
  }

  static async executeRecoveryStrategy(strategy, context = {}) {
    const results = [];

    for (const action of strategy.actions) {
      try {
        const result = await this.executeRecoveryAction(action, context);
        results.push({ action: action.type, success: true, result });

        // If action indicates success, stop executing further actions
        if (result?.success) {
          break;
        }
      } catch (actionError) {
        results.push({
          action: action.type,
          success: false,
          error: actionError.message,
        });
      }
    }

    return {
      strategyId: strategy.errorId,
      executedActions: results,
      success: results.some((r) => r.success),
      timestamp: new Date(),
    };
  }

  static async executeRecoveryAction(action, context) {
    switch (action.type) {
      case 'retry':
        if (action.delay) {
          await new Promise((resolve) => setTimeout(resolve, action.delay));
        }
        return { success: false, message: 'Retry delay completed' };

      case 'fallback_provider':
        // This would be handled by the ProviderManager
        return {
          success: false,
          message: 'Fallback provider selection needed',
        };

      case 'backoff':
        if (action.delay) {
          await new Promise((resolve) => setTimeout(resolve, action.delay));
        }
        return { success: false, message: 'Backoff delay completed' };

      case 'alert':
        // Emit alert event
        if (context.eventEmitter) {
          context.eventEmitter.emit('error_alert', {
            severity: action.severity,
            error: context.error,
            timestamp: new Date(),
          });
        }
        return { success: true, message: 'Alert sent' };

      case 'log_error':
        console.error(
          `[${action.level?.toUpperCase() || 'ERROR'}] Recovery action:`,
          {
            error: context.error?.message,
            context: context.operation,
          }
        );
        return { success: true, message: 'Error logged' };

      default:
        return {
          success: false,
          message: `Unknown action type: ${action.type}`,
        };
    }
  }

  static formatErrorForLogging(error, context = {}) {
    if (!(error instanceof EnhancedError)) {
      error = this.classifyError(error, context.provider, context);
    }

    return {
      errorId: error.errorId,
      timestamp: error.timestamp,
      type: error.type,
      severity: error.severity,
      category: error.category,
      message: error.message,
      provider: error.provider,
      context: error.context,
      retryable: error.retryable,
      originalError: error.originalError
        ? {
            name: error.originalError.name,
            message: error.originalError.message,
            code: error.originalError.code,
            status:
              error.originalError.status ||
              error.originalError.response?.status,
            stack: error.originalError.stack,
          }
        : null,
      stack: error.stack,
    };
  }

  static getErrorStatistics(errors) {
    const stats = {
      total: errors.length,
      byType: {},
      bySeverity: {},
      byCategory: {},
      byProvider: {},
      retryableCount: 0,
      averageOccurrence: 0,
    };

    if (errors.length === 0) return stats;

    errors.forEach((error) => {
      // Count by type
      stats.byType[error.type] = (stats.byType[error.type] || 0) + 1;

      // Count by severity
      stats.bySeverity[error.severity] =
        (stats.bySeverity[error.severity] || 0) + 1;

      // Count by category
      stats.byCategory[error.category] =
        (stats.byCategory[error.category] || 0) + 1;

      // Count by provider
      if (error.provider) {
        stats.byProvider[error.provider] =
          (stats.byProvider[error.provider] || 0) + 1;
      }

      // Count retryable errors
      if (error.retryable) {
        stats.retryableCount++;
      }
    });

    // Calculate average occurrence time
    const timestamps = errors
      .map((e) => new Date(e.timestamp).getTime())
      .sort();
    if (timestamps.length > 1) {
      const timeSpan = timestamps[timestamps.length - 1] - timestamps[0];
      stats.averageOccurrence = timeSpan / (timestamps.length - 1);
    }

    return stats;
  }
}

module.exports = {
  ErrorTypes,
  ErrorSeverity,
  ErrorCategory,
  EnhancedError,
  ErrorHandler,
};
