// utils/enhanced-logging-integration.js
// Integration script for enhanced error logging and monitoring

const EnhancedLoggingIntegration = require('./EnhancedLoggingIntegration');
const { logger } = require('./logger');

/**
 * Initialize and configure enhanced logging integration
 * @param {Object} app - Express application instance
 * @param {Object} config - Configuration options
 * @returns {Promise<EnhancedLoggingIntegration>} Initialized logging integration
 */
async function initializeEnhancedLogging(app, config = {}) {
  logger.info('Initializing enhanced logging integration...');

  try {
    // Create enhanced logging integration instance
    const loggingIntegration = new EnhancedLoggingIntegration({
      // Error logging configuration
      enableErrorLogging: config.enableErrorLogging !== false,
      enableStructuredLogging: config.enableStructuredLogging !== false,
      enablePerformanceLogging: config.enablePerformanceLogging !== false,
      enableRequestLogging: config.enableRequestLogging !== false,
      enableAIRequestLogging: config.enableAIRequestLogging !== false,

      // Logging levels and targets
      logLevel: config.logLevel || process.env.LOG_LEVEL || 'info',
      enableConsoleLogging: config.enableConsoleLogging !== false,
      enableFileLogging: config.enableFileLogging !== false,
      enableRemoteLogging: config.enableRemoteLogging === true,

      // Performance thresholds
      slowRequestThreshold: config.slowRequestThreshold || 5000,
      verySlowRequestThreshold: config.verySlowRequestThreshold || 10000,
      slowAIRequestThreshold: config.slowAIRequestThreshold || 15000,
      verySlowAIRequestThreshold: config.verySlowAIRequestThreshold || 30000,

      // Request tracking configuration
      enableFullRequestLogging: config.enableFullRequestLogging === true,
      enableResponseLogging: config.enableResponseLogging !== false,
      maxRequestBodySize: config.maxRequestBodySize || 1024,
      maxResponseBodySize: config.maxResponseBodySize || 2048,
      sensitiveFields: config.sensitiveFields || [
        'password',
        'token',
        'key',
        'secret',
        'authorization',
      ],

      // AI request tracking configuration
      enablePromptLogging: config.enablePromptLogging === true,
      maxPromptSize: config.maxPromptSize || 500,
      maxResponseSize: config.maxResponseSize || 1000,
      trackTokenUsage: config.trackTokenUsage !== false,

      // Error logging specific configuration
      errorLogging: {
        enableEnhancedLogging: config.enableEnhancedErrorLogging !== false,
        enableStructuredLogging: config.enableStructuredErrorLogging !== false,
        enableErrorMonitoring: config.enableErrorMonitoring !== false,

        // Error categorization
        errorCategories: {
          parsing: [
            'substring is not a function',
            'cannot read property',
            'unexpected token',
            'json parse error',
            'invalid json',
            'malformed response',
          ],
          network: [
            'timeout',
            'connection',
            'econnrefused',
            'enotfound',
            'network error',
            'socket hang up',
          ],
          authentication: [
            'unauthorized',
            'forbidden',
            'invalid token',
            'api key',
            'authentication failed',
            'access denied',
          ],
          rateLimit: [
            'rate limit',
            'too many requests',
            '429',
            'quota exceeded',
            'throttled',
          ],
          server: [
            'internal server error',
            '500',
            '502',
            '503',
            'service unavailable',
            'bad gateway',
          ],
          validation: [
            'validation error',
            'invalid input',
            'missing required',
            'bad request',
            '400',
          ],
        },

        // Alert thresholds
        criticalErrorRate: config.criticalErrorRate || 0.1, // 10%
        warningErrorRate: config.warningErrorRate || 0.05, // 5%
        consecutiveErrors: config.consecutiveErrors || 5,
        errorBurstThreshold: config.errorBurstThreshold || 10,

        // Enhanced logging system configuration
        enhancedLogging: {
          enableRealTimeAnalysis: config.enableRealTimeAnalysis !== false,
          enableErrorCategorization: config.enableErrorCategorization !== false,
          enableAlertGeneration: config.enableAlertGeneration !== false,
          retentionPeriod: config.errorRetentionPeriod || 86400000, // 24 hours
        },
      },

      // Structured logging configuration
      structuredLogging: {
        level: config.logLevel || 'info',
        enableConsole: config.enableConsoleLogging !== false,
        enableFile: config.enableFileLogging !== false,
        enableErrorTracking: config.enableErrorTracking !== false,
        format: config.logFormat || 'json',
        maxFileSize: config.maxLogFileSize || 10485760, // 10MB
        maxFiles: config.maxLogFiles || 5,
      },

      ...config,
    });

    // Initialize the logging integration
    await loggingIntegration.initialize({
      app,
      providerManager: app.locals.providerManager,
      monitoringSystem: app.locals.monitoringSystem,
    });

    // Attach to app for global access
    app.locals.loggingIntegration = loggingIntegration;

    // Setup cleanup interval
    const cleanupInterval = setInterval(() => {
      loggingIntegration.cleanup();
    }, 300000); // 5 minutes

    // Cleanup on app termination
    const cleanup = () => {
      clearInterval(cleanupInterval);
      loggingIntegration.destroy();
    };

    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);
    process.on('exit', cleanup);

    logger.info('Enhanced logging integration initialized successfully', {
      enableErrorLogging: loggingIntegration.config.enableErrorLogging,
      enableStructuredLogging:
        loggingIntegration.config.enableStructuredLogging,
      enablePerformanceLogging:
        loggingIntegration.config.enablePerformanceLogging,
      enableRequestLogging: loggingIntegration.config.enableRequestLogging,
      enableAIRequestLogging: loggingIntegration.config.enableAIRequestLogging,
    });

    return loggingIntegration;
  } catch (error) {
    logger.error('Failed to initialize enhanced logging integration:', error);
    throw error;
  }
}

/**
 * Create AI request tracking middleware
 * @param {EnhancedLoggingIntegration} loggingIntegration - Logging integration instance
 * @returns {Object} AI tracking methods
 */
function createAIRequestTracking(loggingIntegration) {
  return {
    /**
     * Start AI request tracking
     * @param {string} provider - AI provider name
     * @param {string} operation - Operation type
     * @param {Object} requestData - Request parameters
     * @returns {string} AI request ID
     */
    startAIRequest: (provider, operation, requestData = {}) => {
      return loggingIntegration.startAIRequestLogging(
        provider,
        operation,
        requestData
      );
    },

    /**
     * End AI request tracking
     * @param {string} aiRequestId - AI request ID
     * @param {Object} result - Request result
     */
    endAIRequest: (aiRequestId, result = {}) => {
      loggingIntegration.endAIRequestLogging(aiRequestId, result);
    },

    /**
     * Log AI request error
     * @param {string} aiRequestId - AI request ID
     * @param {Error} error - Error object
     */
    logAIRequestError: (aiRequestId, error) => {
      loggingIntegration.endAIRequestLogging(aiRequestId, {
        success: false,
        error: error.message,
      });
    },
  };
}

/**
 * Create performance monitoring middleware
 * @param {EnhancedLoggingIntegration} loggingIntegration - Logging integration instance
 * @returns {Function} Express middleware
 */
function createPerformanceMiddleware(loggingIntegration) {
  return (req, res, next) => {
    // Performance monitoring is handled automatically by the logging integration
    // This middleware can be used for additional performance tracking if needed

    const startTime = Date.now();

    // Override res.end to capture additional performance metrics
    const originalEnd = res.end;
    res.end = function (...args) {
      const duration = Date.now() - startTime;

      // Log slow requests
      if (duration > 10000) {
        // 10 seconds
        logger.warn('Very slow request detected', {
          method: req.method,
          url: req.url,
          duration,
          statusCode: res.statusCode,
        });
      }

      originalEnd.apply(this, args);
    };

    next();
  };
}

/**
 * Create error handling middleware
 * @param {EnhancedLoggingIntegration} loggingIntegration - Logging integration instance
 * @returns {Function} Express error middleware
 */
function createErrorHandlingMiddleware(loggingIntegration) {
  return (error, req, res, next) => {
    // Log the error through the enhanced logging system
    loggingIntegration.logError(error, {
      requestId: req.requestId,
      method: req.method,
      url: req.url,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
    });

    // Continue with normal error handling
    next(error);
  };
}

/**
 * Get logging integration status
 * @param {EnhancedLoggingIntegration} loggingIntegration - Logging integration instance
 * @returns {Object} Status information
 */
function getLoggingStatus(loggingIntegration) {
  if (!loggingIntegration) {
    return {
      initialized: false,
      error: 'Logging integration not available',
    };
  }

  try {
    const report = loggingIntegration.getLoggingReport();

    return {
      initialized: loggingIntegration.isInitialized,
      configuration: report.configuration,
      statistics: report.statistics,
      performance: {
        trackedEndpoints: report.performance.summary.totalEndpoints,
        totalRequests: report.performance.summary.totalRequests,
        avgResponseTime: Math.round(report.performance.summary.avgResponseTime),
      },
      errors: report.errors
        ? {
            totalErrors: report.errors.summary.totalErrors,
            recentErrors: report.errors.summary.recentErrors,
            errorsByCategory: report.errors.summary.errorsByCategory,
          }
        : null,
    };
  } catch (error) {
    return {
      initialized: false,
      error: `Failed to get logging status: ${error.message}`,
    };
  }
}

/**
 * Configure logging for specific environment
 * @param {string} environment - Environment name (development, production, test)
 * @returns {Object} Environment-specific configuration
 */
function getEnvironmentConfig(environment = 'development') {
  const baseConfig = {
    enableErrorLogging: true,
    enableStructuredLogging: true,
    enablePerformanceLogging: true,
    enableRequestLogging: true,
    enableAIRequestLogging: true,
  };

  switch (environment) {
    case 'production':
      return {
        ...baseConfig,
        logLevel: 'warn',
        enableConsoleLogging: false,
        enableFileLogging: true,
        enableRemoteLogging: true,
        enableFullRequestLogging: false,
        enablePromptLogging: false,
        maxRequestBodySize: 512,
        maxPromptSize: 200,
        maxResponseSize: 500,
      };

    case 'development':
      return {
        ...baseConfig,
        logLevel: 'debug',
        enableConsoleLogging: true,
        enableFileLogging: true,
        enableRemoteLogging: false,
        enableFullRequestLogging: true,
        enablePromptLogging: true,
        maxRequestBodySize: 2048,
        maxPromptSize: 1000,
        maxResponseSize: 2000,
      };

    case 'test':
      return {
        ...baseConfig,
        logLevel: 'error',
        enableConsoleLogging: false,
        enableFileLogging: false,
        enableRemoteLogging: false,
        enableFullRequestLogging: false,
        enablePromptLogging: false,
      };

    default:
      return baseConfig;
  }
}

module.exports = {
  initializeEnhancedLogging,
  createAIRequestTracking,
  createPerformanceMiddleware,
  createErrorHandlingMiddleware,
  getLoggingStatus,
  getEnvironmentConfig,
};
