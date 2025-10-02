// utils/initializeEnhancedErrorLogging.js
// Initialization script for enhanced error logging and monitoring integration

const ErrorLoggingMiddleware = require('../middleware/errorLoggingMiddleware');
const ProviderErrorIntegration = require('./providerErrorIntegration');
const EnhancedErrorLoggingIntegration = require('./EnhancedErrorLoggingIntegration');

/**
 * Initialize Enhanced Error Logging System
 * Integrates all error logging components with the main application
 */
async function initializeEnhancedErrorLogging(app, config = {}) {
  try {
    console.log('Initializing enhanced error logging system...');

    // Configuration with defaults
    const errorLoggingConfig = {
      // Enhanced error logging configuration
      enableEnhancedLogging: config.enableEnhancedLogging !== false,
      enableMonitoringIntegration: config.enableMonitoringIntegration !== false,
      enableAlertingIntegration: config.enableAlertingIntegration !== false,

      // Logging configuration
      logLevel: config.logLevel || process.env.LOG_LEVEL || 'info',
      logDirectory: config.logDirectory || process.env.LOG_DIRECTORY || 'logs',
      enableConsole: config.enableConsole !== false,
      enableFile: config.enableFile !== false,

      // File rotation settings
      maxFileSize: config.maxFileSize || 10485760, // 10MB
      maxFiles: config.maxFiles || 5,

      // Error context settings
      includeResponseStructure: config.includeResponseStructure !== false,
      includeProviderContext: config.includeProviderContext !== false,
      includeStackTrace: config.includeStackTrace !== false,
      maxResponseSampleSize: config.maxResponseSampleSize || 2048, // 2KB

      // Alert thresholds
      alertThresholds: {
        criticalErrorsPerMinute:
          config.criticalErrorsPerMinute ||
          parseInt(process.env.CRITICAL_ERRORS_PER_MINUTE) ||
          5,
        parsingFailuresPerMinute:
          config.parsingFailuresPerMinute ||
          parseInt(process.env.PARSING_FAILURES_PER_MINUTE) ||
          10,
        providerFailuresPerMinute:
          config.providerFailuresPerMinute ||
          parseInt(process.env.PROVIDER_FAILURES_PER_MINUTE) ||
          15,
        ...config.alertThresholds,
      },

      // Monitoring intervals
      trackingInterval:
        config.trackingInterval ||
        parseInt(process.env.ERROR_TRACKING_INTERVAL) ||
        30000, // 30 seconds
      reportingInterval:
        config.reportingInterval ||
        parseInt(process.env.ERROR_REPORTING_INTERVAL) ||
        300000, // 5 minutes
      alertSuppressionWindow:
        config.alertSuppressionWindow ||
        parseInt(process.env.ALERT_SUPPRESSION_WINDOW) ||
        300000, // 5 minutes

      ...config,
    };

    // Initialize Enhanced Error Logging Integration
    const enhancedErrorLoggingIntegration = new EnhancedErrorLoggingIntegration(
      errorLoggingConfig
    );

    // Initialize Error Logging Middleware
    const errorLoggingMiddleware = new ErrorLoggingMiddleware(
      errorLoggingConfig
    );

    // Initialize Provider Error Integration
    const providerErrorIntegration = new ProviderErrorIntegration(
      errorLoggingConfig
    );

    // Collect monitoring components from the app
    const monitoringComponents = {
      metricsCollector: app.metricsCollector || null,
      alertingSystem: app.alertingSystem || null,
      healthMonitor: app.healthMonitor || null,
      structuredLogger: app.structuredLogger || null,
    };

    console.log('Monitoring components collected:', {
      metricsCollector: !!monitoringComponents.metricsCollector,
      alertingSystem: !!monitoringComponents.alertingSystem,
      healthMonitor: !!monitoringComponents.healthMonitor,
      structuredLogger: !!monitoringComponents.structuredLogger,
    });

    // Initialize all components with monitoring integration
    await enhancedErrorLoggingIntegration.initialize(monitoringComponents);
    await errorLoggingMiddleware.initialize(monitoringComponents);
    await providerErrorIntegration.initialize(monitoringComponents);

    // Attach components to app for global access
    app.enhancedErrorLoggingIntegration = enhancedErrorLoggingIntegration;
    app.errorLoggingMiddleware = errorLoggingMiddleware;
    app.providerErrorIntegration = providerErrorIntegration;

    // For backward compatibility, also attach as errorLoggingIntegration
    app.errorLoggingIntegration = errorLoggingMiddleware;

    // Apply error logging middleware to the app
    app.use(errorLoggingMiddleware.middleware());

    // Add error monitoring routes
    const errorMonitoringRoutes = require('../routes/errorMonitoring');
    app.use('/error-monitoring', errorMonitoringRoutes);

    // Create helper functions for easy access
    app.logResponseParsingError = (
      error,
      providerName,
      originalResponse,
      context = {}
    ) => {
      const requestId =
        context.requestId ||
        `auto_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      providerErrorIntegration.logResponseParsingError(
        requestId,
        error,
        providerName,
        originalResponse,
        context
      );
    };

    app.logProviderMethodError = (
      error,
      providerName,
      methodName,
      context = {}
    ) => {
      const requestId =
        context.requestId ||
        `auto_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      providerErrorIntegration.logProviderMethodError(
        requestId,
        error,
        providerName,
        methodName,
        context
      );
    };

    app.logProviderOperationError = (
      error,
      providerName,
      operation,
      requestData = {},
      context = {}
    ) => {
      const requestId =
        context.requestId ||
        `auto_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      providerErrorIntegration.logProviderOperationError(
        requestId,
        error,
        providerName,
        operation,
        requestData,
        context
      );
    };

    app.logProviderSuccess = (
      providerName,
      operation,
      result = {},
      context = {}
    ) => {
      const requestId =
        context.requestId ||
        `auto_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      providerErrorIntegration.logProviderSuccess(
        requestId,
        providerName,
        operation,
        result
      );
    };

    app.startRequestTracking = (providerName, operation, requestData = {}) => {
      const requestId = `req_${Date.now()}_${Math.random()
        .toString(36)
        .substr(2, 9)}`;
      return providerErrorIntegration.startRequestTracking(
        requestId,
        providerName,
        operation,
        requestData
      );
    };

    app.endRequestTracking = (requestId) => {
      return providerErrorIntegration.endRequestTracking(requestId);
    };

    // Set up periodic cleanup
    const cleanupInterval = setInterval(() => {
      try {
        providerErrorIntegration.cleanupOldContexts();
      } catch (error) {
        console.error('Error during periodic cleanup:', error.message);
      }
    }, 600000); // 10 minutes

    // Store cleanup interval for later cleanup
    app.errorLoggingCleanupInterval = cleanupInterval;

    // Set up graceful shutdown
    const originalClose = app.close;
    app.close = function (...args) {
      console.log('Shutting down enhanced error logging system...');

      // Clear cleanup interval
      if (app.errorLoggingCleanupInterval) {
        clearInterval(app.errorLoggingCleanupInterval);
      }

      // Destroy components
      if (enhancedErrorLoggingIntegration) {
        enhancedErrorLoggingIntegration.destroy();
      }
      if (errorLoggingMiddleware) {
        errorLoggingMiddleware.destroy();
      }
      if (providerErrorIntegration) {
        providerErrorIntegration.destroy();
      }

      // Call original close if it exists
      if (originalClose) {
        return originalClose.apply(this, args);
      }
    };

    console.log('Enhanced error logging system initialized successfully');

    // Return initialization summary
    return {
      success: true,
      components: {
        enhancedErrorLoggingIntegration: !!enhancedErrorLoggingIntegration,
        errorLoggingMiddleware: !!errorLoggingMiddleware,
        providerErrorIntegration: !!providerErrorIntegration,
      },
      configuration: errorLoggingConfig,
      monitoringComponents: {
        metricsCollector: !!monitoringComponents.metricsCollector,
        alertingSystem: !!monitoringComponents.alertingSystem,
        healthMonitor: !!monitoringComponents.healthMonitor,
        structuredLogger: !!monitoringComponents.structuredLogger,
      },
      routes: {
        errorMonitoring: '/error-monitoring',
      },
      helperFunctions: [
        'logResponseParsingError',
        'logProviderMethodError',
        'logProviderOperationError',
        'logProviderSuccess',
        'startRequestTracking',
        'endRequestTracking',
      ],
    };
  } catch (error) {
    console.error(
      'Failed to initialize enhanced error logging system:',
      error.message
    );
    throw error;
  }
}

/**
 * Integration helper for provider services
 * Provides easy integration for existing provider services
 */
function integrateWithProviderService(app, providerService, providerName) {
  if (!app.providerErrorIntegration) {
    console.warn(
      `Provider error integration not available for ${providerName}`
    );
    return providerService;
  }

  // Wrap provider methods with error logging
  const originalMethods = {};
  const methodsToWrap = [
    'generateDream',
    'generateDreamStream',
    'patchDream',
    'enrichStyle',
    'testConnection',
  ];

  methodsToWrap.forEach((methodName) => {
    if (typeof providerService[methodName] === 'function') {
      originalMethods[methodName] = providerService[methodName];

      providerService[methodName] = async function (...args) {
        const requestId = `${providerName}_${methodName}_${Date.now()}_${Math.random()
          .toString(36)
          .substr(2, 9)}`;

        // Start request tracking
        const context = app.providerErrorIntegration.startRequestTracking(
          requestId,
          providerName,
          methodName,
          { args: args.length }
        );

        try {
          const result = await originalMethods[methodName].apply(this, args);

          // Log success
          app.providerErrorIntegration.logProviderSuccess(
            requestId,
            providerName,
            methodName,
            { success: true }
          );

          return result;
        } catch (error) {
          // Determine error type and log appropriately
          if (error.message.includes('substring is not a function')) {
            app.providerErrorIntegration.logResponseParsingError(
              requestId,
              error,
              providerName,
              args[0], // Assume first arg might be response
              { methodName, args: args.length }
            );
          } else if (error.message.includes('is not a function')) {
            app.providerErrorIntegration.logProviderMethodError(
              requestId,
              error,
              providerName,
              methodName,
              { args: args.length }
            );
          } else {
            app.providerErrorIntegration.logProviderOperationError(
              requestId,
              error,
              providerName,
              methodName,
              { args: args.length },
              { methodName }
            );
          }

          throw error;
        } finally {
          // End request tracking
          app.providerErrorIntegration.endRequestTracking(requestId);
        }
      };
    }
  });

  console.log(`Integrated error logging with ${providerName} provider service`);
  return providerService;
}

/**
 * Integration helper for ProviderManager
 * Provides integration with the ProviderManager system
 */
function integrateWithProviderManager(app, providerManager) {
  if (!app.providerErrorIntegration || !providerManager) {
    console.warn('Provider error integration or ProviderManager not available');
    return providerManager;
  }

  // Wrap ProviderManager methods with error logging
  const originalExecuteWithFallback = providerManager.executeWithFallback;

  if (originalExecuteWithFallback) {
    providerManager.executeWithFallback = async function (
      operation,
      providerName,
      context = {}
    ) {
      const requestId =
        context.requestId ||
        `pm_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Start request tracking
      const trackingContext = app.providerErrorIntegration.startRequestTracking(
        requestId,
        providerName || 'auto-selected',
        context.operationType || 'unknown',
        context
      );

      try {
        const result = await originalExecuteWithFallback.call(
          this,
          operation,
          providerName,
          {
            ...context,
            requestId,
          }
        );

        // Log success
        app.providerErrorIntegration.logProviderSuccess(
          requestId,
          result.provider || providerName || 'unknown',
          context.operationType || 'unknown',
          result
        );

        return result;
      } catch (error) {
        // Log provider manager error
        app.providerErrorIntegration.logProviderOperationError(
          requestId,
          error,
          providerName || 'unknown',
          context.operationType || 'unknown',
          context,
          {
            providerManager: true,
            fallbackAttempted: true,
          }
        );

        throw error;
      } finally {
        // End request tracking
        app.providerErrorIntegration.endRequestTracking(requestId);
      }
    };
  }

  console.log('Integrated error logging with ProviderManager');
  return providerManager;
}

module.exports = {
  initializeEnhancedErrorLogging,
  integrateWithProviderService,
  integrateWithProviderManager,
};
