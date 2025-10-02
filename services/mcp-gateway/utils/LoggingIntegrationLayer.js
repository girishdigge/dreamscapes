// utils/LoggingIntegrationLayer.js
// Integration layer that connects enhanced error logging with existing systems

/**
 * Logging Integration Layer - Connects enhanced error logging with existing systems
 * Provides seamless integration without breaking existing functionality
 */
class LoggingIntegrationLayer {
  constructor(config = {}) {
    this.config = {
      enableEnhancedLogging: config.enableEnhancedLogging !== false,
      enableMonitoringIntegration: config.enableMonitoringIntegration !== false,
      enableStructuredLogging: config.enableStructuredLogging !== false,

      // Fallback to existing logging if enhanced logging fails
      enableFallbackLogging: config.enableFallbackLogging !== false,

      ...config,
    };

    // Logging components
    this.enhancedErrorLogger = null;
    this.errorMonitoringIntegration = null;
    this.structuredLogger = null;
    this.fallbackLogger = null;

    // Integration state
    this.isInitialized = false;
    this.initializationError = null;

    console.log('LoggingIntegrationLayer initialized with config:', {
      enableEnhancedLogging: this.config.enableEnhancedLogging,
      enableMonitoringIntegration: this.config.enableMonitoringIntegration,
      enableStructuredLogging: this.config.enableStructuredLogging,
    });
  }

  /**
   * Initialize logging integration
   * @param {Object} components - Existing logging components
   */
  async initialize(components = {}) {
    try {
      // Initialize Enhanced Error Logger
      if (this.config.enableEnhancedLogging) {
        try {
          const EnhancedErrorLogger = require('./EnhancedErrorLogger');
          this.enhancedErrorLogger =
            components.enhancedErrorLogger ||
            new EnhancedErrorLogger({
              enableMonitoringIntegration:
                this.config.enableMonitoringIntegration,
              logDirectory: components.logDirectory || 'logs',
              alertThresholds: components.alertThresholds || {},
            });
          console.log('Enhanced Error Logger initialized');
        } catch (error) {
          console.error(
            'Failed to initialize Enhanced Error Logger:',
            error.message
          );
          if (!this.config.enableFallbackLogging) {
            throw error;
          }
        }
      }

      // Initialize Error Monitoring Integration
      if (this.config.enableMonitoringIntegration) {
        try {
          const ErrorMonitoringIntegration = require('../monitoring/ErrorMonitoringIntegration');
          this.errorMonitoringIntegration =
            components.errorMonitoringIntegration ||
            new ErrorMonitoringIntegration({
              enableRealTimeTracking: true,
              enableAlertingIntegration: true,
              enableMetricsIntegration: true,
            });

          // Initialize with available components
          await this.errorMonitoringIntegration.initialize({
            enhancedErrorLogger: this.enhancedErrorLogger,
            metricsCollector: components.metricsCollector,
            alertingSystem: components.alertingSystem,
            healthMonitor: components.healthMonitor,
            structuredLogger: components.structuredLogger,
          });

          console.log('Error Monitoring Integration initialized');
        } catch (error) {
          console.error(
            'Failed to initialize Error Monitoring Integration:',
            error.message
          );
          if (!this.config.enableFallbackLogging) {
            throw error;
          }
        }
      }

      // Initialize Structured Logger
      if (this.config.enableStructuredLogging) {
        try {
          const StructuredLogger = require('../monitoring/StructuredLogger');
          this.structuredLogger =
            components.structuredLogger ||
            new StructuredLogger({
              enableConsole: true,
              enableFile: true,
              logDirectory: components.logDirectory || 'logs',
            });
          console.log('Structured Logger initialized');
        } catch (error) {
          console.error(
            'Failed to initialize Structured Logger:',
            error.message
          );
          if (!this.config.enableFallbackLogging) {
            throw error;
          }
        }
      }

      // Initialize fallback logger
      if (this.config.enableFallbackLogging) {
        try {
          const { logger } = require('./logger');
          this.fallbackLogger = logger;
          console.log('Fallback logger initialized');
        } catch (error) {
          console.error('Failed to initialize fallback logger:', error.message);
        }
      }

      this.isInitialized = true;
      console.log('Logging Integration Layer initialized successfully');
    } catch (error) {
      this.initializationError = error;
      console.error(
        'Failed to initialize Logging Integration Layer:',
        error.message
      );

      if (!this.config.enableFallbackLogging) {
        throw error;
      }

      // Continue with fallback logging only
      this.isInitialized = true;
      console.log('Continuing with fallback logging only');
    }
  }

  /**
   * Log response parsing error with full integration
   * @param {Error} error - The parsing error
   * @param {string} providerName - Provider name
   * @param {any} originalResponse - Original response that failed
   * @param {Object} context - Additional context
   */
  logResponseParsingError(error, providerName, originalResponse, context = {}) {
    const enhancedContext = {
      ...context,
      timestamp: Date.now(),
      errorType: 'response_parsing',
      severity: 'high',
    };

    try {
      // Primary: Error Monitoring Integration (includes Enhanced Error Logger)
      if (this.errorMonitoringIntegration) {
        this.errorMonitoringIntegration.logResponseParsingError(
          error,
          providerName,
          originalResponse,
          enhancedContext
        );
        return; // Success, no need for fallback
      }

      // Secondary: Enhanced Error Logger directly
      if (this.enhancedErrorLogger) {
        this.enhancedErrorLogger.logResponseParsingError(
          error,
          providerName,
          originalResponse,
          enhancedContext
        );
        return; // Success, no need for fallback
      }

      // Tertiary: Structured Logger
      if (this.structuredLogger) {
        this.structuredLogger.error('Response parsing failed', error, {
          providerName,
          errorType: 'response_parsing',
          responseStructure: this.analyzeResponseStructure(originalResponse),
          context: enhancedContext,
        });
        return; // Success, no need for fallback
      }

      // Fallback: Basic logger
      this.logWithFallback('error', 'Response parsing failed', {
        error: error.message,
        providerName,
        errorType: 'response_parsing',
        context: enhancedContext,
      });
    } catch (loggingError) {
      console.error(
        'Error in response parsing error logging:',
        loggingError.message
      );
      this.logWithFallback(
        'error',
        'Response parsing failed (logging error occurred)',
        {
          originalError: error.message,
          loggingError: loggingError.message,
          providerName,
        }
      );
    }
  }

  /**
   * Log provider method error with full integration
   * @param {Error} error - The method error
   * @param {string} providerName - Provider name
   * @param {string} methodName - Missing method name
   * @param {Object} context - Additional context
   */
  logProviderMethodError(error, providerName, methodName, context = {}) {
    const enhancedContext = {
      ...context,
      timestamp: Date.now(),
      errorType: 'provider_method',
      severity: 'critical',
    };

    try {
      // Primary: Error Monitoring Integration
      if (this.errorMonitoringIntegration) {
        this.errorMonitoringIntegration.logProviderMethodError(
          error,
          providerName,
          methodName,
          enhancedContext
        );
        return;
      }

      // Secondary: Enhanced Error Logger directly
      if (this.enhancedErrorLogger) {
        this.enhancedErrorLogger.logProviderMethodError(
          error,
          providerName,
          methodName,
          enhancedContext
        );
        return;
      }

      // Tertiary: Structured Logger
      if (this.structuredLogger) {
        this.structuredLogger.error('Provider method error', error, {
          providerName,
          methodName,
          errorType: 'provider_method',
          severity: 'critical',
          context: enhancedContext,
        });
        return;
      }

      // Fallback: Basic logger
      this.logWithFallback('error', 'Provider method error', {
        error: error.message,
        providerName,
        methodName,
        errorType: 'provider_method',
        severity: 'critical',
        context: enhancedContext,
      });
    } catch (loggingError) {
      console.error(
        'Error in provider method error logging:',
        loggingError.message
      );
      this.logWithFallback(
        'error',
        'Provider method error (logging error occurred)',
        {
          originalError: error.message,
          loggingError: loggingError.message,
          providerName,
          methodName,
        }
      );
    }
  }

  /**
   * Log provider operation error with full integration
   * @param {Error} error - The operation error
   * @param {string} providerName - Provider name
   * @param {string} operation - Operation name
   * @param {Object} requestData - Request data
   * @param {Object} context - Additional context
   */
  logProviderOperationError(
    error,
    providerName,
    operation,
    requestData = {},
    context = {}
  ) {
    const severity = this.classifyErrorSeverity(error, providerName, operation);
    const enhancedContext = {
      ...context,
      timestamp: Date.now(),
      errorType: 'provider_operation',
      severity,
    };

    try {
      // Primary: Error Monitoring Integration
      if (this.errorMonitoringIntegration) {
        this.errorMonitoringIntegration.logProviderOperationError(
          error,
          providerName,
          operation,
          requestData,
          enhancedContext
        );
        return;
      }

      // Secondary: Enhanced Error Logger directly
      if (this.enhancedErrorLogger) {
        this.enhancedErrorLogger.logProviderOperationError(
          error,
          providerName,
          operation,
          requestData,
          enhancedContext
        );
        return;
      }

      // Tertiary: Structured Logger
      if (this.structuredLogger) {
        this.structuredLogger.error('Provider operation failed', error, {
          providerName,
          operation,
          errorType: 'provider_operation',
          severity,
          requestData: this.sanitizeRequestData(requestData),
          context: enhancedContext,
        });
        return;
      }

      // Fallback: Basic logger
      this.logWithFallback('error', 'Provider operation failed', {
        error: error.message,
        providerName,
        operation,
        errorType: 'provider_operation',
        severity,
        context: enhancedContext,
      });
    } catch (loggingError) {
      console.error(
        'Error in provider operation error logging:',
        loggingError.message
      );
      this.logWithFallback(
        'error',
        'Provider operation failed (logging error occurred)',
        {
          originalError: error.message,
          loggingError: loggingError.message,
          providerName,
          operation,
        }
      );
    }
  }

  /**
   * Log error classification with full integration
   * @param {Object} classification - Error classification result
   * @param {Object} context - Additional context
   */
  logErrorClassification(classification, context = {}) {
    try {
      // Primary: Error Monitoring Integration
      if (this.errorMonitoringIntegration) {
        this.errorMonitoringIntegration.logErrorClassification(
          classification,
          context
        );
        return;
      }

      // Secondary: Enhanced Error Logger directly
      if (this.enhancedErrorLogger) {
        this.enhancedErrorLogger.logErrorClassification(
          classification,
          context
        );
        return;
      }

      // Tertiary: Structured Logger
      if (this.structuredLogger) {
        this.structuredLogger.info('Error classified', {
          classification: {
            type: classification.type,
            severity: classification.severity,
            recoverable: classification.recoverable,
            retryable: classification.retryable,
          },
          provider: classification.errorInfo.provider,
          operation: classification.errorInfo.operation,
          context,
        });
        return;
      }

      // Fallback: Basic logger
      this.logWithFallback('info', 'Error classified', {
        type: classification.type,
        severity: classification.severity,
        provider: classification.errorInfo.provider,
        operation: classification.errorInfo.operation,
      });
    } catch (loggingError) {
      console.error(
        'Error in error classification logging:',
        loggingError.message
      );
      this.logWithFallback(
        'info',
        'Error classification (logging error occurred)',
        {
          classificationType: classification.type,
          loggingError: loggingError.message,
        }
      );
    }
  }

  /**
   * Log general error with context
   * @param {string} level - Log level
   * @param {string} message - Log message
   * @param {Error} error - Error object (optional)
   * @param {Object} context - Additional context
   */
  logError(level, message, error = null, context = {}) {
    try {
      // Use structured logger if available
      if (this.structuredLogger) {
        this.structuredLogger[level](message, error, context);
        return;
      }

      // Fallback to basic logging
      this.logWithFallback(level, message, {
        error: error ? error.message : null,
        context,
      });
    } catch (loggingError) {
      console.error('Error in general error logging:', loggingError.message);
      this.logWithFallback('error', 'Logging error occurred', {
        originalMessage: message,
        loggingError: loggingError.message,
      });
    }
  }

  /**
   * Log with fallback logger
   * @private
   */
  logWithFallback(level, message, data = {}) {
    try {
      if (this.fallbackLogger) {
        this.fallbackLogger[level](message, data);
      } else {
        // Ultimate fallback to console
        const timestamp = new Date().toISOString();
        const logMessage = `[${timestamp}] [${level.toUpperCase()}] ${message}`;

        if (Object.keys(data).length > 0) {
          console[level === 'error' ? 'error' : 'log'](logMessage, data);
        } else {
          console[level === 'error' ? 'error' : 'log'](logMessage);
        }
      }
    } catch (fallbackError) {
      // Ultimate fallback - just console.error
      console.error('All logging failed:', {
        originalMessage: message,
        originalData: data,
        fallbackError: fallbackError.message,
      });
    }
  }

  /**
   * Classify error severity
   * @private
   */
  classifyErrorSeverity(error, providerName, operation) {
    const message = error.message.toLowerCase();

    // Critical errors
    if (
      message.includes('is not a function') &&
      message.includes('getProviderHealth')
    ) {
      return 'critical';
    }

    // High severity errors
    if (message.includes('substring is not a function')) {
      return 'high';
    }
    if (
      message.includes('cannot read property') ||
      message.includes('cannot read properties')
    ) {
      return 'high';
    }
    if (
      message.includes('authentication') ||
      message.includes('unauthorized')
    ) {
      return 'high';
    }

    // Medium severity errors
    if (message.includes('timeout')) {
      return 'medium';
    }
    if (message.includes('rate limit')) {
      return 'medium';
    }
    if (message.includes('connection')) {
      return 'medium';
    }

    return 'low';
  }

  /**
   * Analyze response structure for logging
   * @private
   */
  analyzeResponseStructure(response) {
    if (!response) return { type: 'null' };

    if (typeof response === 'string') {
      return {
        type: 'string',
        length: response.length,
        hasContent: response.trim().length > 0,
      };
    }

    if (typeof response === 'object') {
      return {
        type: 'object',
        isArray: Array.isArray(response),
        keys: Object.keys(response),
        hasChoices: response.hasOwnProperty('choices'),
        hasContent: response.hasOwnProperty('content'),
      };
    }

    return { type: typeof response };
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

    return sanitized;
  }

  /**
   * Create wrapper for existing response parser
   * @param {Object} responseParser - Existing response parser instance
   * @returns {Object} Wrapped response parser with enhanced logging
   */
  wrapResponseParser(responseParser) {
    const self = this;

    return {
      ...responseParser,

      parseProviderResponse: function (response, providerName, operationType) {
        try {
          const result = responseParser.parseProviderResponse(
            response,
            providerName,
            operationType
          );

          // Log successful parsing
          if (result.success) {
            self.logError('debug', 'Response parsing successful', null, {
              providerName,
              operationType,
              contentLength: result.content ? result.content.length : 0,
              extractionMethod: result.metadata?.extractionMethod,
            });
          } else {
            // Log parsing failure
            const error = new Error(
              result.error?.message || 'Response parsing failed'
            );
            self.logResponseParsingError(error, providerName, response, {
              operationType,
              extractionMethod: result.metadata?.extractionMethod,
              originalFormat: result.metadata?.originalFormat,
            });
          }

          return result;
        } catch (error) {
          // Log parsing exception
          self.logResponseParsingError(error, providerName, response, {
            operationType,
            exceptionType: 'parsing_exception',
          });
          throw error;
        }
      },
    };
  }

  /**
   * Create wrapper for existing provider manager
   * @param {Object} providerManager - Existing provider manager instance
   * @returns {Object} Wrapped provider manager with enhanced logging
   */
  wrapProviderManager(providerManager) {
    const self = this;
    const originalGetProviderHealth = providerManager.getProviderHealth;

    return {
      ...providerManager,

      getProviderHealth: function (providerName = null) {
        try {
          if (typeof originalGetProviderHealth === 'function') {
            return originalGetProviderHealth.call(this, providerName);
          } else {
            // Method doesn't exist - log the error
            const error = new Error('getProviderHealth is not a function');
            self.logProviderMethodError(
              error,
              providerName || 'unknown',
              'getProviderHealth',
              {
                availableMethods: Object.getOwnPropertyNames(this).filter(
                  (prop) => typeof this[prop] === 'function'
                ),
                providerManagerType: this.constructor.name,
              }
            );
            throw error;
          }
        } catch (error) {
          // Log method execution error
          self.logProviderMethodError(
            error,
            providerName || 'unknown',
            'getProviderHealth',
            {
              errorType: 'method_execution_error',
            }
          );
          throw error;
        }
      },

      executeWithFallback: async function (operation, providers, options) {
        const requestId = `req_${Date.now()}_${Math.random()
          .toString(36)
          .substr(2, 9)}`;

        try {
          const result = await providerManager.executeWithFallback.call(
            this,
            operation,
            providers,
            {
              ...options,
              requestId,
            }
          );

          // Log successful operation
          self.logError('info', 'Provider operation successful', null, {
            requestId,
            providers: Array.isArray(providers) ? providers : [providers],
            operation: options?.operationType || 'unknown',
          });

          return result;
        } catch (error) {
          // Log operation failure
          self.logProviderOperationError(
            error,
            'multiple',
            options?.operationType || 'unknown',
            {
              providers: Array.isArray(providers) ? providers : [providers],
            },
            {
              requestId,
              allProvidersFailed: true,
            }
          );
          throw error;
        }
      },
    };
  }

  /**
   * Get logging statistics
   */
  getLoggingStatistics() {
    const stats = {
      timestamp: new Date().toISOString(),
      isInitialized: this.isInitialized,
      initializationError: this.initializationError?.message || null,
      components: {
        enhancedErrorLogger: !!this.enhancedErrorLogger,
        errorMonitoringIntegration: !!this.errorMonitoringIntegration,
        structuredLogger: !!this.structuredLogger,
        fallbackLogger: !!this.fallbackLogger,
      },
      configuration: this.config,
    };

    // Get statistics from components if available
    if (this.errorMonitoringIntegration) {
      try {
        stats.errorMonitoringStats =
          this.errorMonitoringIntegration.getErrorStatistics();
      } catch (error) {
        stats.errorMonitoringStatsError = error.message;
      }
    }

    if (this.enhancedErrorLogger) {
      try {
        stats.enhancedErrorLoggerStats =
          this.enhancedErrorLogger.getErrorStatistics();
      } catch (error) {
        stats.enhancedErrorLoggerStatsError = error.message;
      }
    }

    return stats;
  }

  /**
   * Export all logging data
   */
  exportLoggingData(options = {}) {
    const exportData = {
      timestamp: new Date().toISOString(),
      statistics: this.getLoggingStatistics(),
      configuration: this.config,
    };

    // Export from error monitoring integration
    if (this.errorMonitoringIntegration) {
      try {
        exportData.errorMonitoringData =
          this.errorMonitoringIntegration.exportMonitoringData(options);
      } catch (error) {
        exportData.errorMonitoringDataError = error.message;
      }
    }

    // Export from enhanced error logger
    if (this.enhancedErrorLogger) {
      try {
        exportData.enhancedErrorLoggerData =
          this.enhancedErrorLogger.exportErrorData(options);
      } catch (error) {
        exportData.enhancedErrorLoggerDataError = error.message;
      }
    }

    return exportData;
  }

  /**
   * Cleanup resources
   */
  destroy() {
    try {
      if (this.errorMonitoringIntegration) {
        this.errorMonitoringIntegration.destroy();
      }

      if (this.enhancedErrorLogger) {
        this.enhancedErrorLogger.destroy();
      }

      if (this.structuredLogger) {
        this.structuredLogger.destroy();
      }

      console.log('LoggingIntegrationLayer destroyed');
    } catch (error) {
      console.error('Error destroying LoggingIntegrationLayer:', error.message);
    }
  }
}

module.exports = LoggingIntegrationLayer;
