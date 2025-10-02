// utils/initializeEnhancedErrorLoggingAndMonitoring.js
// Initialization script for enhanced error logging and monitoring integration

/**
 * Initialize Enhanced Error Logging and Monitoring System
 * This function sets up comprehensive error logging and monitoring for the MCP Gateway
 */
async function initializeEnhancedErrorLoggingAndMonitoring(config = {}) {
  console.log(
    '🚀 Initializing Enhanced Error Logging and Monitoring System...'
  );

  const components = {};
  const initializationResults = {
    success: false,
    components: {},
    errors: [],
    warnings: [],
  };

  try {
    // 1. Initialize Enhanced Error Logger
    console.log('📝 Initializing Enhanced Error Logger...');
    try {
      const EnhancedErrorLogger = require('./EnhancedErrorLogger');
      components.enhancedErrorLogger = new EnhancedErrorLogger({
        logLevel: config.logLevel || 'info',
        enableMonitoringIntegration: true,
        enableErrorClassification: true,
        alertThresholds: {
          criticalErrorsPerMinute: config.criticalErrorThreshold || 5,
          parsingFailuresPerMinute: config.parsingFailureThreshold || 10,
          providerFailuresPerMinute: config.healthFailureThreshold || 3,
        },
        ...config.enhancedErrorLogger,
      });
      initializationResults.components.enhancedErrorLogger = true;
      console.log('✅ Enhanced Error Logger initialized');
    } catch (error) {
      initializationResults.errors.push(
        `Enhanced Error Logger: ${error.message}`
      );
      console.error(
        '❌ Enhanced Error Logger initialization failed:',
        error.message
      );
    }

    // 2. Initialize Structured Logger
    console.log('📊 Initializing Structured Logger...');
    try {
      const StructuredLogger = require('../monitoring/StructuredLogger');
      components.structuredLogger = new StructuredLogger({
        level: config.logLevel || 'info',
        enablePerformanceLogging: true,
        enableRequestLogging: true,
        enableErrorDetails: true,
        enableErrorContext: true,
        logDirectory: config.logDirectory || 'logs',
        ...config.structuredLogger,
      });
      initializationResults.components.structuredLogger = true;
      console.log('✅ Structured Logger initialized');
    } catch (error) {
      initializationResults.errors.push(`Structured Logger: ${error.message}`);
      console.error(
        '❌ Structured Logger initialization failed:',
        error.message
      );
    }

    // 3. Initialize Error Monitoring Integration
    console.log('🔍 Initializing Error Monitoring Integration...');
    try {
      const ErrorMonitoringIntegration = require('../monitoring/ErrorMonitoringIntegration');
      components.errorMonitoringIntegration = new ErrorMonitoringIntegration({
        enableRealTimeTracking: true,
        enableAlertingIntegration: true,
        enableMetricsIntegration: true,
        criticalErrorThreshold: config.criticalErrorThreshold || 5,
        parsingFailureThreshold: config.parsingFailureThreshold || 10,
        providerFailureThreshold: config.healthFailureThreshold || 3,
        ...config.errorMonitoringIntegration,
      });

      // Initialize with existing components
      await components.errorMonitoringIntegration.initialize({
        enhancedErrorLogger: components.enhancedErrorLogger,
        structuredLogger: components.structuredLogger,
      });

      initializationResults.components.errorMonitoringIntegration = true;
      console.log('✅ Error Monitoring Integration initialized');
    } catch (error) {
      initializationResults.errors.push(
        `Error Monitoring Integration: ${error.message}`
      );
      console.error(
        '❌ Error Monitoring Integration initialization failed:',
        error.message
      );
    }

    // 4. Initialize Enhanced Logging Integration Layer
    console.log('🔗 Initializing Enhanced Logging Integration Layer...');
    try {
      const EnhancedLoggingIntegrationLayer = require('./EnhancedLoggingIntegrationLayer');
      components.enhancedLoggingLayer = new EnhancedLoggingIntegrationLayer({
        enableStructuredLogging: true,
        enableErrorClassification: true,
        enableMonitoringIntegration: true,
        enableAlertingIntegration: true,
        criticalErrorThreshold: config.criticalErrorThreshold || 5,
        parsingFailureThreshold: config.parsingFailureThreshold || 10,
        healthFailureThreshold: config.healthFailureThreshold || 3,
        ...config.enhancedLoggingLayer,
      });

      await components.enhancedLoggingLayer.initialize(components);
      initializationResults.components.enhancedLoggingLayer = true;
      console.log('✅ Enhanced Logging Integration Layer initialized');
    } catch (error) {
      initializationResults.errors.push(
        `Enhanced Logging Integration Layer: ${error.message}`
      );
      console.error(
        '❌ Enhanced Logging Integration Layer initialization failed:',
        error.message
      );
    }

    // 5. Initialize Monitoring Integration Manager
    console.log('📈 Initializing Monitoring Integration Manager...');
    try {
      const MonitoringIntegrationManager = require('./MonitoringIntegrationManager');
      components.monitoringIntegrationManager =
        new MonitoringIntegrationManager({
          enableEnhancedLogging: true,
          enableStructuredLogging: true,
          enableErrorMonitoring: true,
          enablePerformanceMonitoring: true,
          criticalErrorThreshold: config.criticalErrorThreshold || 5,
          parsingFailureThreshold: config.parsingFailureThreshold || 10,
          healthFailureThreshold: config.healthFailureThreshold || 3,
          responseTimeThreshold: config.responseTimeThreshold || 5000,
          healthCheckInterval: config.healthCheckInterval || 30000,
          metricsCollectionInterval: config.metricsCollectionInterval || 60000,
          reportingInterval: config.reportingInterval || 300000,
          ...config.monitoringIntegrationManager,
        });

      await components.monitoringIntegrationManager.initialize(components);
      initializationResults.components.monitoringIntegrationManager = true;
      console.log('✅ Monitoring Integration Manager initialized');
    } catch (error) {
      initializationResults.errors.push(
        `Monitoring Integration Manager: ${error.message}`
      );
      console.error(
        '❌ Monitoring Integration Manager initialization failed:',
        error.message
      );
    }

    // 6. Initialize basic logger fallback
    console.log('📋 Initializing basic logger fallback...');
    try {
      const { logger } = require('./logger');
      components.logger = logger;
      initializationResults.components.logger = true;
      console.log('✅ Basic logger fallback initialized');
    } catch (error) {
      initializationResults.warnings.push(
        `Basic logger fallback: ${error.message}`
      );
      console.warn(
        '⚠️ Basic logger fallback initialization failed:',
        error.message
      );
    }

    // 7. Set up cross-component event handling
    console.log('🔄 Setting up cross-component event handling...');
    try {
      setupCrossComponentEventHandling(components);
      console.log('✅ Cross-component event handling set up');
    } catch (error) {
      initializationResults.warnings.push(
        `Cross-component events: ${error.message}`
      );
      console.warn(
        '⚠️ Cross-component event handling setup failed:',
        error.message
      );
    }

    // 8. Validate integration
    console.log('🔍 Validating integration...');
    const validationResults = await validateIntegration(components);

    if (validationResults.success) {
      console.log('✅ Integration validation passed');
    } else {
      initializationResults.warnings.push('Integration validation had issues');
      console.warn(
        '⚠️ Integration validation had issues:',
        validationResults.issues
      );
    }

    // Determine overall success
    const criticalComponentsInitialized = [
      'enhancedErrorLogger',
      'structuredLogger',
      'enhancedLoggingLayer',
    ].every((component) => initializationResults.components[component]);

    initializationResults.success =
      criticalComponentsInitialized &&
      initializationResults.errors.length === 0;

    if (initializationResults.success) {
      console.log(
        '🎉 Enhanced Error Logging and Monitoring System initialized successfully!'
      );
      console.log(
        '📊 Initialized components:',
        Object.keys(initializationResults.components).filter(
          (k) => initializationResults.components[k]
        )
      );
    } else {
      console.error(
        '❌ Enhanced Error Logging and Monitoring System initialization completed with errors'
      );
      console.error('🚫 Errors:', initializationResults.errors);
    }

    if (initializationResults.warnings.length > 0) {
      console.warn('⚠️ Warnings:', initializationResults.warnings);
    }

    return {
      components,
      results: initializationResults,
    };
  } catch (error) {
    console.error('💥 Critical error during initialization:', error.message);
    initializationResults.success = false;
    initializationResults.errors.push(
      `Critical initialization error: ${error.message}`
    );

    return {
      components,
      results: initializationResults,
    };
  }
}

/**
 * Set up cross-component event handling
 * @param {Object} components - Initialized components
 */
function setupCrossComponentEventHandling(components) {
  // Enhanced Logging Layer events
  if (components.enhancedLoggingLayer) {
    components.enhancedLoggingLayer.on('responseParsingError', (data) => {
      console.log(
        `🔍 Cross-component: Response parsing error - ${data.providerName}`
      );

      // Forward to monitoring integration manager
      if (components.monitoringIntegrationManager) {
        components.monitoringIntegrationManager.emit(
          'responseParsingError',
          data
        );
      }
    });

    components.enhancedLoggingLayer.on('providerMethodError', (data) => {
      console.error(
        `🚨 Cross-component: Provider method error - ${data.providerName}.${data.methodName}`
      );

      // Forward to monitoring integration manager
      if (components.monitoringIntegrationManager) {
        components.monitoringIntegrationManager.emit(
          'providerMethodError',
          data
        );
      }
    });

    components.enhancedLoggingLayer.on('providerOperationError', (data) => {
      console.log(
        `⚠️ Cross-component: Provider operation error - ${data.providerName}.${data.operation}`
      );

      // Forward to monitoring integration manager
      if (components.monitoringIntegrationManager) {
        components.monitoringIntegrationManager.emit(
          'providerOperationError',
          data
        );
      }
    });
  }

  // Error Monitoring Integration events
  if (components.errorMonitoringIntegration) {
    components.errorMonitoringIntegration.on('alert', (data) => {
      console.error(`🚨 Cross-component: Alert - ${data.type}`);

      // Forward to monitoring integration manager
      if (components.monitoringIntegrationManager) {
        components.monitoringIntegrationManager.emit('alert', data);
      }
    });
  }

  // Monitoring Integration Manager events
  if (components.monitoringIntegrationManager) {
    components.monitoringIntegrationManager.on('alert', (data) => {
      console.error(
        `🚨 System Alert [${data.severity}]: ${data.type}`,
        data.data
      );
    });

    components.monitoringIntegrationManager.on('monitoringReport', (report) => {
      console.log('📊 Monitoring Report Generated:', {
        timestamp: report.timestamp,
        providerCount: Object.keys(report.providerHealth?.providers || {})
          .length,
        overallHealth: report.providerHealth?.summary,
      });
    });
  }
}

/**
 * Validate integration between components
 * @param {Object} components - Initialized components
 * @returns {Object} Validation results
 */
async function validateIntegration(components) {
  const validationResults = {
    success: true,
    issues: [],
    tests: [],
  };

  try {
    // Test 1: Enhanced Error Logger functionality
    if (components.enhancedErrorLogger) {
      try {
        const testError = new Error('Test error for validation');
        components.enhancedErrorLogger.logResponseParsingError(
          testError,
          'test-provider',
          { test: 'response' },
          { validation: true }
        );
        validationResults.tests.push(
          'Enhanced Error Logger: ✅ Response parsing error logging'
        );
      } catch (error) {
        validationResults.issues.push(
          `Enhanced Error Logger test failed: ${error.message}`
        );
        validationResults.success = false;
      }
    }

    // Test 2: Structured Logger functionality
    if (components.structuredLogger) {
      try {
        components.structuredLogger.info('Validation test', {
          type: 'validation',
          component: 'structured_logger',
        });
        validationResults.tests.push('Structured Logger: ✅ Info logging');
      } catch (error) {
        validationResults.issues.push(
          `Structured Logger test failed: ${error.message}`
        );
        validationResults.success = false;
      }
    }

    // Test 3: Enhanced Logging Integration Layer functionality
    if (components.enhancedLoggingLayer) {
      try {
        const testError = new Error('Test integration error');
        components.enhancedLoggingLayer.logProviderMethodError(
          testError,
          'test-provider',
          'testMethod',
          { validation: true }
        );
        validationResults.tests.push(
          'Enhanced Logging Integration Layer: ✅ Provider method error logging'
        );
      } catch (error) {
        validationResults.issues.push(
          `Enhanced Logging Integration Layer test failed: ${error.message}`
        );
        validationResults.success = false;
      }
    }

    // Test 4: Cross-component communication
    if (
      components.enhancedLoggingLayer &&
      components.monitoringIntegrationManager
    ) {
      try {
        let eventReceived = false;

        components.monitoringIntegrationManager.once(
          'responseParsingError',
          () => {
            eventReceived = true;
          }
        );

        components.enhancedLoggingLayer.emit('responseParsingError', {
          providerName: 'test-provider',
          error: 'test error',
          validation: true,
        });

        // Give a moment for event propagation
        await new Promise((resolve) => setTimeout(resolve, 100));

        if (eventReceived) {
          validationResults.tests.push(
            'Cross-component communication: ✅ Event propagation'
          );
        } else {
          validationResults.issues.push(
            'Cross-component communication: Event propagation failed'
          );
          validationResults.success = false;
        }
      } catch (error) {
        validationResults.issues.push(
          `Cross-component communication test failed: ${error.message}`
        );
        validationResults.success = false;
      }
    }

    // Test 5: Component integration status
    const expectedComponents = [
      'enhancedErrorLogger',
      'structuredLogger',
      'enhancedLoggingLayer',
    ];

    const missingComponents = expectedComponents.filter(
      (component) => !components[component]
    );
    if (missingComponents.length > 0) {
      validationResults.issues.push(
        `Missing critical components: ${missingComponents.join(', ')}`
      );
      validationResults.success = false;
    } else {
      validationResults.tests.push(
        'Component integration: ✅ All critical components present'
      );
    }
  } catch (error) {
    validationResults.issues.push(`Validation error: ${error.message}`);
    validationResults.success = false;
  }

  return validationResults;
}

/**
 * Integrate with Provider Manager
 * @param {Object} components - Initialized components
 * @param {Object} providerManager - Provider Manager instance
 */
async function integrateWithProviderManager(components, providerManager) {
  console.log('🔗 Integrating with Provider Manager...');

  try {
    // Integrate with Monitoring Integration Manager
    if (components.monitoringIntegrationManager) {
      await components.monitoringIntegrationManager.initialize({
        ...components,
        providerManager,
      });
      console.log(
        '✅ Provider Manager integrated with Monitoring Integration Manager'
      );
    }

    // Set up provider manager error logging
    if (components.enhancedLoggingLayer) {
      // Wrap provider manager methods to add enhanced logging
      wrapProviderManagerWithEnhancedLogging(
        providerManager,
        components.enhancedLoggingLayer
      );
      console.log('✅ Provider Manager wrapped with enhanced logging');
    }

    console.log('🎉 Provider Manager integration completed successfully');
    return true;
  } catch (error) {
    console.error('❌ Provider Manager integration failed:', error.message);
    return false;
  }
}

/**
 * Wrap Provider Manager with enhanced logging
 * @param {Object} providerManager - Provider Manager instance
 * @param {Object} enhancedLoggingLayer - Enhanced Logging Integration Layer
 */
function wrapProviderManagerWithEnhancedLogging(
  providerManager,
  enhancedLoggingLayer
) {
  // Store original methods
  const originalMethods = {
    executeWithFallback:
      providerManager.executeWithFallback.bind(providerManager),
    selectProvider: providerManager.selectProvider.bind(providerManager),
    healthCheck: providerManager.healthCheck.bind(providerManager),
    getProviderHealth: providerManager.getProviderHealth.bind(providerManager),
  };

  // Wrap executeWithFallback
  providerManager.executeWithFallback = async function (
    operation,
    providers,
    options = {}
  ) {
    try {
      return await originalMethods.executeWithFallback(
        operation,
        providers,
        options
      );
    } catch (error) {
      // Enhanced logging for execution errors
      enhancedLoggingLayer.logProviderOperationError(
        error,
        'unknown',
        'executeWithFallback',
        { providers, options },
        {
          requestId: options.requestId,
          context: options.context,
        }
      );
      throw error;
    }
  };

  // Wrap getProviderHealth
  providerManager.getProviderHealth = function (providerName) {
    try {
      return originalMethods.getProviderHealth(providerName);
    } catch (error) {
      // Enhanced logging for health method errors
      enhancedLoggingLayer.logProviderMethodError(
        error,
        providerName || 'unknown',
        'getProviderHealth',
        {
          methodType: 'health_check',
          expectedReturn: 'health_status_object',
        }
      );
      throw error;
    }
  };

  // Wrap healthCheck
  providerManager.healthCheck = async function (providerName) {
    try {
      return await originalMethods.healthCheck(providerName);
    } catch (error) {
      // Enhanced logging for health check errors
      enhancedLoggingLayer.logProviderHealthError(
        error,
        providerName || 'all',
        {
          healthCheckType: providerName ? 'single' : 'all',
          methodName: 'healthCheck',
        }
      );
      throw error;
    }
  };
}

/**
 * Create logging middleware for Express applications
 * @param {Object} components - Initialized components
 * @returns {Function} Express middleware
 */
function createLoggingMiddleware(components) {
  return (req, res, next) => {
    const requestId = `req_${Date.now()}_${Math.random()
      .toString(36)
      .substr(2, 9)}`;
    req.requestId = requestId;

    // Start request logging
    if (components.structuredLogger) {
      const startRequestId = components.structuredLogger.startRequest(req);
      req.loggingRequestId = startRequestId;
    }

    // Override res.end to capture response
    const originalEnd = res.end;
    res.end = function (chunk, encoding) {
      // End request logging
      if (components.structuredLogger && req.loggingRequestId) {
        components.structuredLogger.endRequest(req.loggingRequestId, res);
      }

      // Log request completion
      if (components.enhancedLoggingLayer) {
        const responseTime = Date.now() - req.startTime;
        if (res.statusCode >= 400) {
          const error = new Error(
            `HTTP ${res.statusCode}: ${res.statusMessage}`
          );
          components.enhancedLoggingLayer.logProviderOperationError(
            error,
            'http',
            req.method,
            {
              url: req.url,
              headers: req.headers,
            },
            {
              requestId,
              responseTime,
              statusCode: res.statusCode,
            }
          );
        }
      }

      originalEnd.call(res, chunk, encoding);
    };

    req.startTime = Date.now();
    next();
  };
}

module.exports = {
  initializeEnhancedErrorLoggingAndMonitoring,
  integrateWithProviderManager,
  createLoggingMiddleware,
  setupCrossComponentEventHandling,
  validateIntegration,
};
