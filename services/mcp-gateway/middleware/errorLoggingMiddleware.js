// middleware/errorLoggingMiddleware.js
// Middleware to integrate enhanced error logging with existing monitoring systems

const EnhancedErrorLoggingIntegration = require('../utils/EnhancedErrorLoggingIntegration');

/**
 * Error Logging Middleware - Integrates enhanced error logging with Express middleware
 * Provides comprehensive error tracking and monitoring integration
 */
class ErrorLoggingMiddleware {
  constructor(config = {}) {
    this.config = {
      // Enhanced error logging configuration
      enableEnhancedLogging: config.enableEnhancedLogging !== false,
      enableMonitoringIntegration: config.enableMonitoringIntegration !== false,
      enableAlertingIntegration: config.enableAlertingIntegration !== false,

      // Logging configuration
      logLevel: config.logLevel || 'info',
      logDirectory: config.logDirectory || 'logs',
      enableConsole: config.enableConsole !== false,
      enableFile: config.enableFile !== false,

      // Alert thresholds
      alertThresholds: {
        criticalErrorsPerMinute: config.criticalErrorsPerMinute || 5,
        parsingFailuresPerMinute: config.parsingFailuresPerMinute || 10,
        providerFailuresPerMinute: config.providerFailuresPerMinute || 15,
        ...config.alertThresholds,
      },

      // Monitoring intervals
      trackingInterval: config.trackingInterval || 30000, // 30 seconds
      reportingInterval: config.reportingInterval || 300000, // 5 minutes

      ...config,
    };

    // Initialize enhanced error logging integration
    this.errorLoggingIntegration = new EnhancedErrorLoggingIntegration(
      this.config
    );

    // Monitoring components (will be injected)
    this.monitoringComponents = {
      metricsCollector: null,
      alertingSystem: null,
      healthMonitor: null,
      structuredLogger: null,
    };

    console.log('ErrorLoggingMiddleware initialized');
  }

  /**
   * Initialize with monitoring components
   * @param {Object} components - Monitoring components
   */
  initialize(components = {}) {
    try {
      // Store monitoring components
      this.monitoringComponents = {
        metricsCollector: components.metricsCollector,
        alertingSystem: components.alertingSystem,
        healthMonitor: components.healthMonitor,
        structuredLogger: components.structuredLogger,
      };

      // Initialize enhanced error logging integration
      this.errorLoggingIntegration.initialize(this.monitoringComponents);

      console.log(
        'ErrorLoggingMiddleware initialized with monitoring components'
      );
    } catch (error) {
      console.error(
        'Failed to initialize ErrorLoggingMiddleware:',
        error.message
      );
      throw error;
    }
  }

  /**
   * Express middleware for error logging
   * @returns {Function} Express middleware function
   */
  middleware() {
    return (error, req, res, next) => {
      try {
        // Extract context from request
        const context = {
          requestId: req.id || req.headers['x-request-id'],
          method: req.method,
          url: req.url,
          userAgent: req.get('User-Agent'),
          ip: req.ip || req.connection?.remoteAddress,
          timestamp: Date.now(),
          body: req.body,
          query: req.query,
          params: req.params,
        };

        // Determine error type and provider from request context
        const { errorType, providerName, operation } = this.extractErrorContext(
          error,
          req
        );

        // Log error based on type
        switch (errorType) {
          case 'response_parsing':
            this.errorLoggingIntegration.logResponseParsingError(
              error,
              providerName,
              req.aiResponse || null,
              context
            );
            break;

          case 'provider_method':
            this.errorLoggingIntegration.logProviderMethodError(
              error,
              providerName,
              operation,
              context
            );
            break;

          case 'provider_operation':
            this.errorLoggingIntegration.logProviderOperationError(
              error,
              providerName,
              operation,
              req.body || {},
              context
            );
            break;

          default:
            // Generic error logging
            this.errorLoggingIntegration.logProviderOperationError(
              error,
              providerName || 'unknown',
              operation || 'unknown',
              req.body || {},
              context
            );
            break;
        }

        // Continue with normal error handling
        next(error);
      } catch (loggingError) {
        console.error(
          'Error in error logging middleware:',
          loggingError.message
        );
        // Don't let logging errors break the request flow
        next(error);
      }
    };
  }

  /**
   * Extract error context from request and error
   * @private
   */
  extractErrorContext(error, req) {
    const errorMessage = error.message.toLowerCase();
    let errorType = 'unknown';
    let providerName = 'unknown';
    let operation = 'unknown';

    // Extract provider name from request path or headers
    if (
      req.path.includes('/cerebras') ||
      req.headers['x-provider'] === 'cerebras'
    ) {
      providerName = 'cerebras';
    } else if (
      req.path.includes('/openai') ||
      req.headers['x-provider'] === 'openai'
    ) {
      providerName = 'openai';
    } else if (req.aiProvider) {
      providerName = req.aiProvider;
    }

    // Extract operation from request path or body
    if (req.path.includes('/parse') || req.body?.operation === 'parse') {
      operation = 'generateDream';
    } else if (req.path.includes('/patch') || req.body?.operation === 'patch') {
      operation = 'patchDream';
    } else if (
      req.path.includes('/enrich') ||
      req.body?.operation === 'enrich'
    ) {
      operation = 'enrichStyle';
    } else if (req.path.includes('/health')) {
      operation = 'healthCheck';
    }

    // Determine error type based on error message
    if (errorMessage.includes('substring is not a function')) {
      errorType = 'response_parsing';
    } else if (
      errorMessage.includes('is not a function') &&
      errorMessage.includes('getProviderHealth')
    ) {
      errorType = 'provider_method';
    } else if (errorMessage.includes('is not a function')) {
      errorType = 'provider_method';
    } else if (
      errorMessage.includes('cannot read property') ||
      errorMessage.includes('cannot read properties')
    ) {
      errorType = 'response_parsing';
    } else if (
      errorMessage.includes('timeout') ||
      errorMessage.includes('rate limit')
    ) {
      errorType = 'provider_operation';
    }

    return { errorType, providerName, operation };
  }

  /**
   * Log response parsing error directly
   * @param {Error} error - The parsing error
   * @param {string} providerName - Provider name
   * @param {any} originalResponse - Original response
   * @param {Object} context - Additional context
   */
  logResponseParsingError(error, providerName, originalResponse, context = {}) {
    this.errorLoggingIntegration.logResponseParsingError(
      error,
      providerName,
      originalResponse,
      context
    );
  }

  /**
   * Log provider method error directly
   * @param {Error} error - The method error
   * @param {string} providerName - Provider name
   * @param {string} methodName - Method name
   * @param {Object} context - Additional context
   */
  logProviderMethodError(error, providerName, methodName, context = {}) {
    this.errorLoggingIntegration.logProviderMethodError(
      error,
      providerName,
      methodName,
      context
    );
  }

  /**
   * Log provider operation error directly
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
    this.errorLoggingIntegration.logProviderOperationError(
      error,
      providerName,
      operation,
      requestData,
      context
    );
  }

  /**
   * Get error statistics
   * @param {number} timeWindowMs - Time window in milliseconds
   * @returns {Object} Error statistics
   */
  getErrorStatistics(timeWindowMs = 3600000) {
    return this.errorLoggingIntegration.getErrorStatistics(timeWindowMs);
  }

  /**
   * Generate monitoring report
   * @returns {Object} Monitoring report
   */
  generateMonitoringReport() {
    return this.errorLoggingIntegration.generateErrorMonitoringReport();
  }

  /**
   * Get monitoring components status
   * @returns {Object} Status of monitoring components
   */
  getMonitoringStatus() {
    return {
      errorLoggingIntegration: {
        initialized: !!this.errorLoggingIntegration,
        trackingActive: !!this.errorLoggingIntegration.trackingInterval,
        reportingActive: !!this.errorLoggingIntegration.reportingInterval,
      },
      monitoringComponents: {
        metricsCollector: !!this.monitoringComponents.metricsCollector,
        alertingSystem: !!this.monitoringComponents.alertingSystem,
        healthMonitor: !!this.monitoringComponents.healthMonitor,
        structuredLogger: !!this.monitoringComponents.structuredLogger,
      },
      configuration: {
        enableEnhancedLogging: this.config.enableEnhancedLogging,
        enableMonitoringIntegration: this.config.enableMonitoringIntegration,
        enableAlertingIntegration: this.config.enableAlertingIntegration,
        alertThresholds: this.config.alertThresholds,
      },
    };
  }

  /**
   * Update configuration
   * @param {Object} newConfig - New configuration
   */
  updateConfiguration(newConfig) {
    Object.assign(this.config, newConfig);

    // Update error logging integration configuration
    if (this.errorLoggingIntegration) {
      Object.assign(this.errorLoggingIntegration.config, newConfig);
    }

    console.log('ErrorLoggingMiddleware configuration updated');
  }

  /**
   * Cleanup resources
   */
  destroy() {
    if (this.errorLoggingIntegration) {
      this.errorLoggingIntegration.destroy();
    }

    console.log('ErrorLoggingMiddleware destroyed');
  }
}

module.exports = ErrorLoggingMiddleware;
