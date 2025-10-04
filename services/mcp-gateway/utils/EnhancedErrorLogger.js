// utils/EnhancedErrorLogger.js
// Enhanced error logging system with provider context and response structure analysis

const winston = require('winston');
const path = require('path');
const fs = require('fs');

// Import TestCleanupManager for proper resource cleanup
let TestCleanupManager;
try {
  const testCleanup = require('../tests/utils/testCleanup');
  TestCleanupManager = testCleanup.testCleanupManager;
} catch (error) {
  // TestCleanupManager not available (not in test environment)
  TestCleanupManager = null;
}

/**
 * Enhanced Error Logger - Comprehensive error logging with detailed context
 * Specifically designed for AI provider response parsing failures and monitoring integration
 */
class EnhancedErrorLogger {
  constructor(config = {}) {
    this.config = {
      // Logging configuration
      logLevel: config.logLevel || 'info',
      enableConsole: config.enableConsole !== false,
      enableFile: config.enableFile !== false,
      logDirectory: config.logDirectory || 'logs',

      // File rotation settings
      maxFileSize: config.maxFileSize || 10485760, // 10MB
      maxFiles: config.maxFiles || 5,

      // Error context settings
      includeResponseStructure: config.includeResponseStructure !== false,
      includeProviderContext: config.includeProviderContext !== false,
      includeStackTrace: config.includeStackTrace !== false,
      maxResponseSampleSize: config.maxResponseSampleSize || 2048, // 2KB

      // Monitoring integration
      enableMonitoringIntegration: config.enableMonitoringIntegration !== false,
      alertThresholds: {
        criticalErrorsPerMinute: config.criticalErrorsPerMinute || 5,
        parsingFailuresPerMinute: config.parsingFailuresPerMinute || 10,
        providerFailuresPerMinute: config.providerFailuresPerMinute || 15,
        ...config.alertThresholds,
      },

      // Error classification
      enableErrorClassification: config.enableErrorClassification !== false,
      enableErrorAggregation: config.enableErrorAggregation !== false,

      ...config,
    };

    // Error tracking for monitoring
    this.errorCounts = new Map(); // error_type -> count
    this.providerErrors = new Map(); // provider_name -> error_data
    this.parsingFailures = new Map(); // provider_name -> parsing_failure_data
    this.recentErrors = []; // Array of recent errors for analysis
    this.maxRecentErrors = 1000;

    // Time-based error tracking for alerting
    this.errorTimestamps = new Map(); // error_type -> Array<timestamp>
    this.alertSuppressionMap = new Map(); // alert_type -> last_sent_timestamp

    // Initialize logging system
    this.initializeLogger();

    // Start monitoring integration if enabled and not in test environment
    if (
      this.config.enableMonitoringIntegration &&
      process.env.NODE_ENV !== 'test' &&
      process.env.DISABLE_MONITORING !== 'true' &&
      process.env.ENABLE_MONITORING_INTEGRATION !== 'false'
    ) {
      this.startMonitoringIntegration();
    }

    // Register with TestCleanupManager if in test environment
    if (TestCleanupManager && process.env.NODE_ENV === 'test') {
      TestCleanupManager.registerResource(
        this,
        'destroy',
        'EnhancedErrorLogger.constructor'
      );
    }

    console.log('EnhancedErrorLogger initialized with config:', {
      logLevel: this.config.logLevel,
      enableFile: this.config.enableFile,
      enableMonitoringIntegration: this.config.enableMonitoringIntegration,
      logDirectory: this.config.logDirectory,
      testCleanupRegistered: !!(
        TestCleanupManager && process.env.NODE_ENV === 'test'
      ),
    });
  }

  /**
   * Initialize Winston logger with enhanced configuration
   * @private
   */
  initializeLogger() {
    // Ensure log directory exists
    if (this.config.enableFile && !fs.existsSync(this.config.logDirectory)) {
      fs.mkdirSync(this.config.logDirectory, { recursive: true });
    }

    const transports = [];

    // Console transport with enhanced formatting
    if (this.config.enableConsole) {
      transports.push(
        new winston.transports.Console({
          level: this.config.logLevel,
          format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.colorize(),
            winston.format.printf(({ timestamp, level, message, ...meta }) => {
              const metaStr =
                Object.keys(meta).length > 0
                  ? `\n${JSON.stringify(meta, null, 2)}`
                  : '';
              return `${timestamp} [${level}] [EnhancedErrorLogger]: ${message}${metaStr}`;
            })
          ),
        })
      );
    }

    // File transports for different error types
    if (this.config.enableFile) {
      // General error log
      transports.push(
        new winston.transports.File({
          filename: path.join(this.config.logDirectory, 'enhanced-errors.log'),
          level: 'error',
          maxsize: this.config.maxFileSize,
          maxFiles: this.config.maxFiles,
          format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.errors({ stack: true }),
            winston.format.json()
          ),
        })
      );

      // Response parsing failures log
      transports.push(
        new winston.transports.File({
          filename: path.join(this.config.logDirectory, 'parsing-failures.log'),
          level: 'error',
          maxsize: this.config.maxFileSize,
          maxFiles: this.config.maxFiles,
          format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.errors({ stack: true }),
            winston.format.json()
          ),
        })
      );

      // Provider errors log
      transports.push(
        new winston.transports.File({
          filename: path.join(this.config.logDirectory, 'provider-errors.log'),
          level: 'error',
          maxsize: this.config.maxFileSize,
          maxFiles: this.config.maxFiles,
          format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.errors({ stack: true }),
            winston.format.json()
          ),
        })
      );

      // Critical errors log
      transports.push(
        new winston.transports.File({
          filename: path.join(this.config.logDirectory, 'critical-errors.log'),
          level: 'error',
          maxsize: this.config.maxFileSize,
          maxFiles: this.config.maxFiles,
          format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.errors({ stack: true }),
            winston.format.json()
          ),
        })
      );
    }

    this.logger = winston.createLogger({
      level: this.config.logLevel,
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
      ),
      transports,
      exitOnError: false,
    });
  }

  /**
   * Log response parsing error with detailed context
   * @param {Error} error - The parsing error
   * @param {string} providerName - Name of the provider
   * @param {any} originalResponse - Original response that failed to parse
   * @param {Object} context - Additional context
   */
  logResponseParsingError(error, providerName, originalResponse, context = {}) {
    const errorData = this.buildEnhancedErrorData(error, {
      errorType: 'response_parsing',
      providerName,
      originalResponse,
      ...context,
    });

    // Add response structure analysis
    if (this.config.includeResponseStructure && originalResponse) {
      errorData.responseAnalysis =
        this.analyzeResponseStructure(originalResponse);
    }

    // Add parsing attempt details
    errorData.parsingAttempts = this.extractParsingAttempts(error, context);

    this.logger.error('Response parsing failed', errorData);

    // Track parsing failures for monitoring
    this.trackParsingFailure(providerName, errorData);

    // Check for alert conditions
    this.checkParsingFailureAlerts(providerName, errorData);
  }

  /**
   * Log provider method error (e.g., missing getProviderHealth method)
   * @param {Error} error - The method error
   * @param {string} providerName - Name of the provider
   * @param {string} methodName - Name of the missing method
   * @param {Object} context - Additional context
   */
  logProviderMethodError(error, providerName, methodName, context = {}) {
    const errorData = this.buildEnhancedErrorData(error, {
      errorType: 'provider_method',
      providerName,
      methodName,
      severity: 'critical', // Method errors are typically critical
      ...context,
    });

    // Add provider state analysis
    errorData.providerState = this.analyzeProviderState(providerName, context);

    this.logger.error('Provider method error', errorData);

    // Track provider errors for monitoring
    this.trackProviderError(providerName, errorData);

    // Check for critical alert conditions
    this.checkCriticalErrorAlerts(providerName, errorData);
  }

  /**
   * Log provider operation error with comprehensive context
   * @param {Error} error - The operation error
   * @param {string} providerName - Name of the provider
   * @param {string} operation - Operation that failed
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
    const errorData = this.buildEnhancedErrorData(error, {
      errorType: 'provider_operation',
      providerName,
      operation,
      requestData: this.sanitizeRequestData(requestData),
      ...context,
    });

    // Add operation-specific analysis
    errorData.operationAnalysis = this.analyzeOperationFailure(
      operation,
      error,
      context
    );

    // Classify error severity
    errorData.severity = this.classifyErrorSeverity(
      error,
      providerName,
      operation
    );

    this.logger.error('Provider operation failed', errorData);

    // Track provider errors for monitoring
    this.trackProviderError(providerName, errorData);

    // Check for alert conditions based on severity
    if (errorData.severity === 'critical' || errorData.severity === 'high') {
      this.checkProviderFailureAlerts(providerName, errorData);
    }
  }

  /**
   * Log error classification results
   * @param {Object} classification - Error classification result
   * @param {Object} context - Additional context
   */
  logErrorClassification(classification, context = {}) {
    const logData = {
      type: 'error_classification',
      classification: {
        errorType: classification.type,
        severity: classification.severity,
        recoverable: classification.recoverable,
        retryable: classification.retryable,
        classificationTime: classification.classificationTime,
      },
      errorInfo: {
        provider: classification.errorInfo.provider,
        operation: classification.errorInfo.operation,
        message: classification.errorInfo.message,
        name: classification.errorInfo.name,
      },
      recoveryStrategy: {
        actionsCount: classification.recoveryStrategy.actions.length,
        priority: classification.recoveryStrategy.priority,
        estimatedRecoveryTime:
          classification.recoveryStrategy.estimatedRecoveryTime,
        fallbackOptionsCount:
          classification.recoveryStrategy.fallbackOptions.length,
      },
      timestamp: new Date().toISOString(),
      ...context,
    };

    this.logger.info('Error classified', logData);

    // Track classification patterns for analysis
    this.trackErrorClassification(classification);
  }

  /**
   * Build enhanced error data with comprehensive context
   * @private
   */
  buildEnhancedErrorData(error, context = {}) {
    const errorData = {
      // Basic error information
      errorMessage: error.message || 'Unknown error',
      errorName: error.name || 'Error',
      errorCode: error.code || null,
      errorStatus: error.status || error.statusCode || null,

      // Provider context
      providerName: context.providerName || null,
      operation: context.operation || null,

      // Error classification
      errorType: context.errorType || 'unknown',
      severity:
        context.severity ||
        this.classifyErrorSeverity(
          error,
          context.providerName,
          context.operation
        ),

      // Timing information
      timestamp: new Date().toISOString(),
      responseTime: context.responseTime || null,

      // Request context
      requestId: context.requestId || null,
      attemptNumber: context.attemptNumber || 1,
      maxAttempts: context.maxAttempts || null,

      // System context
      systemInfo: {
        hostname: require('os').hostname(),
        pid: process.pid,
        memory: process.memoryUsage(),
        uptime: process.uptime(),
      },
    };

    // Add stack trace if enabled
    if (this.config.includeStackTrace && error.stack) {
      errorData.stackTrace = error.stack;
    }

    // Add provider context if enabled
    if (this.config.includeProviderContext && context.providerName) {
      errorData.providerContext = this.buildProviderContext(
        context.providerName,
        context
      );
    }

    // Add response sample if available
    if (context.originalResponse && this.config.includeResponseStructure) {
      errorData.responseSample = this.createResponseSample(
        context.originalResponse
      );
    }

    // Add additional context
    if (context.metadata) {
      errorData.metadata = context.metadata;
    }

    return errorData;
  }

  /**
   * Analyze response structure for debugging
   * @private
   */
  analyzeResponseStructure(response) {
    if (!response) {
      return { type: 'null', analysis: 'Response is null or undefined' };
    }

    const analysis = {
      type: typeof response,
      isArray: Array.isArray(response),
      length: null,
      keys: null,
      hasContent: false,
      hasChoices: false,
      structure: null,
    };

    if (typeof response === 'string') {
      analysis.length = response.length;
      analysis.hasContent = response.trim().length > 0;
      analysis.structure =
        response.length > 100 ? 'long_string' : 'short_string';
    } else if (typeof response === 'object' && response !== null) {
      analysis.keys = Object.keys(response);
      analysis.hasContent = analysis.keys.includes('content');
      analysis.hasChoices = analysis.keys.includes('choices');

      // Analyze nested structure
      if (response.choices && Array.isArray(response.choices)) {
        analysis.choicesCount = response.choices.length;
        if (response.choices.length > 0) {
          analysis.firstChoiceKeys = Object.keys(response.choices[0]);
        }
      }

      analysis.structure = this.determineObjectStructure(response);
    }

    return analysis;
  }

  /**
   * Determine object structure type
   * @private
   */
  determineObjectStructure(obj) {
    if (obj.choices && Array.isArray(obj.choices)) {
      return 'api_response';
    }
    if (obj.content && typeof obj.content === 'string') {
      return 'content_object';
    }
    if (obj.message && obj.message.content) {
      return 'message_object';
    }
    if (obj.data) {
      return 'data_object';
    }
    return 'unknown_object';
  }

  /**
   * Extract parsing attempt details from error and context
   * @private
   */
  extractParsingAttempts(error, context) {
    const attempts = {
      totalAttempts: context.parsingAttempts || 1,
      failedMethods: [],
      lastAttemptMethod: context.lastAttemptMethod || 'unknown',
      errorLocation: null,
    };

    // Extract error location from stack trace
    if (error.stack) {
      const stackLines = error.stack.split('\n');
      const relevantLine = stackLines.find(
        (line) =>
          line.includes('parseProviderResponse') ||
          line.includes('extractContent') ||
          line.includes('substring')
      );
      if (relevantLine) {
        attempts.errorLocation = relevantLine.trim();
      }
    }

    // Extract failed methods from context
    if (context.failedMethods && Array.isArray(context.failedMethods)) {
      attempts.failedMethods = context.failedMethods;
    }

    return attempts;
  }

  /**
   * Analyze provider state for context
   * @private
   */
  analyzeProviderState(providerName, context) {
    return {
      providerName,
      isRegistered: context.isRegistered !== false,
      isHealthy: context.isHealthy !== false,
      lastHealthCheck: context.lastHealthCheck || null,
      consecutiveFailures: context.consecutiveFailures || 0,
      availableMethods: context.availableMethods || [],
      missingMethods: context.missingMethods || [],
    };
  }

  /**
   * Analyze operation failure patterns
   * @private
   */
  analyzeOperationFailure(operation, error, context) {
    return {
      operation,
      errorPattern: this.identifyErrorPattern(error),
      isRetryable: this.isRetryableError(error),
      suggestedAction: this.suggestRecoveryAction(error, operation),
      relatedFailures: context.relatedFailures || 0,
      timeToFailure: context.responseTime || null,
    };
  }

  /**
   * Identify error pattern for analysis
   * @private
   */
  identifyErrorPattern(error) {
    const message = error.message.toLowerCase();

    if (message.includes('substring is not a function')) {
      return 'string_method_on_object';
    }
    if (
      message.includes('cannot read property') ||
      message.includes('cannot read properties')
    ) {
      return 'undefined_property_access';
    }
    if (message.includes('is not a function')) {
      return 'missing_method';
    }
    if (message.includes('timeout')) {
      return 'timeout';
    }
    if (message.includes('rate limit')) {
      return 'rate_limit';
    }
    if (message.includes('authentication')) {
      return 'authentication';
    }

    return 'unknown_pattern';
  }

  /**
   * Check if error is retryable
   * @private
   */
  isRetryableError(error) {
    const nonRetryablePatterns = [
      'is not a function',
      'cannot read property',
      'cannot read properties',
      'authentication',
      'unauthorized',
    ];

    const message = error.message.toLowerCase();
    return !nonRetryablePatterns.some((pattern) => message.includes(pattern));
  }

  /**
   * Suggest recovery action based on error
   * @private
   */
  suggestRecoveryAction(error, operation) {
    const message = error.message.toLowerCase();

    if (message.includes('substring is not a function')) {
      return 'implement_enhanced_response_parsing';
    }
    if (message.includes('is not a function')) {
      return 'implement_missing_method';
    }
    if (message.includes('timeout')) {
      return 'retry_with_backoff';
    }
    if (message.includes('rate limit')) {
      return 'wait_and_retry';
    }

    return 'generic_retry';
  }

  /**
   * Classify error severity
   * @private
   */
  classifyErrorSeverity(error, providerName, operation) {
    const message = error.message.toLowerCase();

    // Critical errors that break core functionality
    if (
      message.includes('is not a function') &&
      message.includes('getProviderHealth')
    ) {
      return 'critical';
    }
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
    if (message.includes('timeout')) {
      return 'medium';
    }
    if (message.includes('rate limit')) {
      return 'medium';
    }

    return 'low';
  }

  /**
   * Build provider context for logging
   * @private
   */
  buildProviderContext(providerName, context) {
    return {
      name: providerName,
      isHealthy: context.isHealthy,
      consecutiveFailures: context.consecutiveFailures || 0,
      lastSuccessTime: context.lastSuccessTime || null,
      lastFailureTime: context.lastFailureTime || null,
      totalRequests: context.totalRequests || 0,
      successRate: context.successRate || null,
      avgResponseTime: context.avgResponseTime || null,
    };
  }

  /**
   * Create response sample for logging (truncated for security)
   * @private
   */
  createResponseSample(response) {
    if (!response) return null;

    let sample;
    if (typeof response === 'string') {
      sample =
        response.length > this.config.maxResponseSampleSize
          ? response.substring(0, this.config.maxResponseSampleSize) +
            '... [TRUNCATED]'
          : response;
    } else if (typeof response === 'object') {
      try {
        const jsonStr = JSON.stringify(response, null, 2);
        sample =
          jsonStr.length > this.config.maxResponseSampleSize
            ? jsonStr.substring(0, this.config.maxResponseSampleSize) +
              '... [TRUNCATED]'
            : jsonStr;
      } catch (error) {
        sample = '[OBJECT - JSON.stringify failed]';
      }
    } else {
      sample = String(response);
    }

    return {
      type: typeof response,
      sample,
      originalLength: typeof response === 'string' ? response.length : null,
      truncated:
        (typeof response === 'string'
          ? response.length
          : JSON.stringify(response).length) >
        this.config.maxResponseSampleSize,
    };
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

    // Truncate large fields
    if (sanitized.prompt && sanitized.prompt.length > 500) {
      sanitized.prompt = sanitized.prompt.substring(0, 500) + '... [TRUNCATED]';
    }

    return sanitized;
  }

  /**
   * Track parsing failure for monitoring
   * @private
   */
  trackParsingFailure(providerName, errorData) {
    if (!this.parsingFailures.has(providerName)) {
      this.parsingFailures.set(providerName, {
        count: 0,
        firstFailure: Date.now(),
        lastFailure: null,
        patterns: new Map(),
      });
    }

    const failures = this.parsingFailures.get(providerName);
    failures.count++;
    failures.lastFailure = Date.now();

    // Track error patterns
    const pattern = this.identifyErrorPattern({
      message: errorData.errorMessage,
    });
    failures.patterns.set(pattern, (failures.patterns.get(pattern) || 0) + 1);

    // Add to recent errors for analysis
    this.addToRecentErrors(errorData);

    // Track timestamp for alerting
    this.trackErrorTimestamp('parsing_failure', Date.now());
  }

  /**
   * Track provider error for monitoring
   * @private
   */
  trackProviderError(providerName, errorData) {
    if (!this.providerErrors.has(providerName)) {
      this.providerErrors.set(providerName, {
        count: 0,
        firstError: Date.now(),
        lastError: null,
        errorTypes: new Map(),
        severityCount: new Map(),
      });
    }

    const errors = this.providerErrors.get(providerName);
    errors.count++;
    errors.lastError = Date.now();

    // Track error types and severity
    errors.errorTypes.set(
      errorData.errorType,
      (errors.errorTypes.get(errorData.errorType) || 0) + 1
    );
    errors.severityCount.set(
      errorData.severity,
      (errors.severityCount.get(errorData.severity) || 0) + 1
    );

    // Add to recent errors for analysis
    this.addToRecentErrors(errorData);

    // Track timestamp for alerting
    this.trackErrorTimestamp(
      `provider_error_${errorData.severity}`,
      Date.now()
    );
  }

  /**
   * Track error classification patterns
   * @private
   */
  trackErrorClassification(classification) {
    const key = `${classification.type}_${classification.severity}`;
    this.errorCounts.set(key, (this.errorCounts.get(key) || 0) + 1);
  }

  /**
   * Add error to recent errors list
   * @private
   */
  addToRecentErrors(errorData) {
    this.recentErrors.push({
      timestamp: Date.now(),
      ...errorData,
    });

    // Keep only recent errors
    if (this.recentErrors.length > this.maxRecentErrors) {
      this.recentErrors = this.recentErrors.slice(-this.maxRecentErrors);
    }
  }

  /**
   * Track error timestamp for alerting
   * @private
   */
  trackErrorTimestamp(errorType, timestamp) {
    if (!this.errorTimestamps.has(errorType)) {
      this.errorTimestamps.set(errorType, []);
    }

    const timestamps = this.errorTimestamps.get(errorType);
    timestamps.push(timestamp);

    // Keep only last hour of timestamps
    const oneHourAgo = Date.now() - 3600000;
    this.errorTimestamps.set(
      errorType,
      timestamps.filter((ts) => ts > oneHourAgo)
    );
  }

  /**
   * Check for parsing failure alerts
   * @private
   */
  checkParsingFailureAlerts(providerName, errorData) {
    const recentFailures = this.getRecentErrorCount('parsing_failure', 60000); // Last minute

    if (
      recentFailures >= this.config.alertThresholds.parsingFailuresPerMinute
    ) {
      this.sendAlert('parsing_failures_threshold', {
        providerName,
        failureCount: recentFailures,
        threshold: this.config.alertThresholds.parsingFailuresPerMinute,
        errorData,
      });
    }
  }

  /**
   * Check for critical error alerts
   * @private
   */
  checkCriticalErrorAlerts(providerName, errorData) {
    const recentCritical = this.getRecentErrorCount(
      'provider_error_critical',
      60000
    ); // Last minute

    if (recentCritical >= this.config.alertThresholds.criticalErrorsPerMinute) {
      this.sendAlert('critical_errors_threshold', {
        providerName,
        errorCount: recentCritical,
        threshold: this.config.alertThresholds.criticalErrorsPerMinute,
        errorData,
      });
    }
  }

  /**
   * Check for provider failure alerts
   * @private
   */
  checkProviderFailureAlerts(providerName, errorData) {
    const recentFailures = this.getRecentErrorCount(
      `provider_error_${errorData.severity}`,
      60000
    );

    if (
      recentFailures >= this.config.alertThresholds.providerFailuresPerMinute
    ) {
      this.sendAlert('provider_failures_threshold', {
        providerName,
        failureCount: recentFailures,
        severity: errorData.severity,
        threshold: this.config.alertThresholds.providerFailuresPerMinute,
        errorData,
      });
    }
  }

  /**
   * Get recent error count for specific type
   * @private
   */
  getRecentErrorCount(errorType, timeWindowMs) {
    const timestamps = this.errorTimestamps.get(errorType) || [];
    const cutoff = Date.now() - timeWindowMs;
    return timestamps.filter((ts) => ts > cutoff).length;
  }

  /**
   * Log provider health monitoring error with detailed context
   * @param {Error} error - The health monitoring error
   * @param {string} providerName - Provider name
   * @param {Object} healthContext - Health check context
   */
  logProviderHealthError(error, providerName, healthContext = {}) {
    const errorData = this.buildEnhancedErrorData(error, {
      errorType: 'provider_health',
      providerName,
      severity: 'medium',
      ...healthContext,
    });

    // Add health-specific analysis
    errorData.healthAnalysis = {
      consecutiveFailures: healthContext.consecutiveFailures || 0,
      lastSuccessfulCheck: healthContext.lastSuccessfulCheck || null,
      healthCheckDuration: healthContext.healthCheckDuration || null,
      expectedResponse: healthContext.expectedResponse || null,
      actualResponse: healthContext.actualResponse || null,
    };

    this.logger.error('Provider health check failed', errorData);

    // Track health errors for monitoring
    this.trackProviderError(providerName, errorData);

    // Check for health failure alerts
    this.checkHealthFailureAlerts(providerName, errorData);
  }

  /**
   * Log monitoring integration error with system context
   * @param {Error} error - The monitoring error
   * @param {string} component - Monitoring component name
   * @param {Object} context - Additional context
   */
  logMonitoringIntegrationError(error, component, context = {}) {
    const errorData = this.buildEnhancedErrorData(error, {
      errorType: 'monitoring_integration',
      component,
      severity: 'high',
      ...context,
    });

    // Add monitoring-specific analysis
    errorData.monitoringAnalysis = {
      component,
      integrationStatus: context.integrationStatus || 'unknown',
      lastSuccessfulOperation: context.lastSuccessfulOperation || null,
      affectedMetrics: context.affectedMetrics || [],
      systemImpact: context.systemImpact || 'unknown',
    };

    this.logger.error('Monitoring integration error', errorData);

    // Track monitoring errors
    this.trackError('monitoring_integration', {
      component,
      error: error.message,
      severity: 'high',
      timestamp: Date.now(),
      context,
    });

    // Send immediate alert for monitoring failures
    this.sendAlert('monitoring_integration_failure', {
      component,
      error: error.message,
      severity: 'high',
      context,
    });
  }

  /**
   * Check for health failure alerts
   * @private
   */
  checkHealthFailureAlerts(providerName, errorData) {
    const recentHealthFailures = this.getRecentErrorCount(
      'provider_health',
      300000
    ); // Last 5 minutes

    if (recentHealthFailures >= 3) {
      // 3 health failures in 5 minutes
      this.sendAlert('provider_health_degraded', {
        providerName,
        failureCount: recentHealthFailures,
        consecutiveFailures: errorData.healthAnalysis?.consecutiveFailures || 0,
        errorData,
      });
    }
  }

  /**
   * Send alert (can be extended to integrate with external alerting systems)
   * @private
   */
  sendAlert(alertType, alertData) {
    // Check alert suppression
    const suppressionKey = `${alertType}_${alertData.providerName}`;
    const lastSent = this.alertSuppressionMap.get(suppressionKey);
    const suppressionWindow = 300000; // 5 minutes

    if (lastSent && Date.now() - lastSent < suppressionWindow) {
      return; // Suppress duplicate alerts
    }

    this.alertSuppressionMap.set(suppressionKey, Date.now());

    // Log alert
    this.logger.error('ALERT: ' + alertType, {
      alertType,
      alertData,
      timestamp: new Date().toISOString(),
      suppressionKey,
    });

    // Here you could integrate with external alerting systems
    // e.g., Slack, PagerDuty, email, etc.
    console.error(`🚨 ALERT [${alertType}]:`, alertData);
  }

  /**
   * Start monitoring integration
   * @private
   */
  startMonitoringIntegration() {
    // Start periodic monitoring tasks
    this.monitoringInterval = setInterval(() => {
      this.performMonitoringTasks();
    }, 60000); // Every minute

    // Register interval with TestCleanupManager if available (test environment)
    if (TestCleanupManager && process.env.NODE_ENV === 'test') {
      TestCleanupManager.trackInterval(
        this.monitoringInterval,
        'EnhancedErrorLogger.startMonitoringIntegration'
      );

      // Register this instance for cleanup
      TestCleanupManager.registerResource(
        this,
        'destroy',
        'EnhancedErrorLogger'
      );

      // Register cleanup callback
      TestCleanupManager.registerCleanupCallback(() => {
        if (this.monitoringInterval) {
          clearInterval(this.monitoringInterval);
          this.monitoringInterval = null;
        }
      });
    }

    console.log('Monitoring integration started', {
      intervalId: this.monitoringInterval,
      testCleanupRegistered: !!(
        TestCleanupManager && process.env.NODE_ENV === 'test'
      ),
    });
  }

  /**
   * Perform periodic monitoring tasks
   * @private
   */
  performMonitoringTasks() {
    try {
      // Clean up old timestamps
      this.cleanupOldTimestamps();

      // Generate monitoring report
      const report = this.generateMonitoringReport();

      // Log monitoring summary
      this.logger.info('Monitoring report', report);
    } catch (error) {
      console.error('Error in monitoring tasks:', error.message);
    }
  }

  /**
   * Clean up old timestamps
   * @private
   */
  cleanupOldTimestamps() {
    const oneHourAgo = Date.now() - 3600000;

    for (const [errorType, timestamps] of this.errorTimestamps.entries()) {
      const filtered = timestamps.filter((ts) => ts > oneHourAgo);
      this.errorTimestamps.set(errorType, filtered);
    }
  }

  /**
   * Generate monitoring report
   */
  generateMonitoringReport() {
    const now = Date.now();
    const oneHourAgo = now - 3600000;

    // Recent errors summary
    const recentErrors = this.recentErrors.filter(
      (error) => error.timestamp > oneHourAgo
    );

    // Error type breakdown
    const errorTypeBreakdown = new Map();
    const severityBreakdown = new Map();
    const providerBreakdown = new Map();

    recentErrors.forEach((error) => {
      // Error type
      errorTypeBreakdown.set(
        error.errorType,
        (errorTypeBreakdown.get(error.errorType) || 0) + 1
      );

      // Severity
      severityBreakdown.set(
        error.severity,
        (severityBreakdown.get(error.severity) || 0) + 1
      );

      // Provider
      if (error.providerName) {
        providerBreakdown.set(
          error.providerName,
          (providerBreakdown.get(error.providerName) || 0) + 1
        );
      }
    });

    return {
      timestamp: new Date().toISOString(),
      timeWindow: '1 hour',
      summary: {
        totalErrors: recentErrors.length,
        uniqueErrorTypes: errorTypeBreakdown.size,
        affectedProviders: providerBreakdown.size,
      },
      breakdown: {
        byErrorType: Object.fromEntries(errorTypeBreakdown),
        bySeverity: Object.fromEntries(severityBreakdown),
        byProvider: Object.fromEntries(providerBreakdown),
      },
      alertThresholds: this.config.alertThresholds,
      recentAlertsSuppressed: this.alertSuppressionMap.size,
    };
  }

  /**
   * Get error statistics
   */
  getErrorStatistics(timeWindowMs = 3600000) {
    // Default 1 hour
    const cutoff = Date.now() - timeWindowMs;
    const recentErrors = this.recentErrors.filter(
      (error) => error.timestamp > cutoff
    );

    return {
      totalErrors: recentErrors.length,
      parsingFailures: this.getTotalParsingFailures(),
      providerErrors: this.getTotalProviderErrors(),
      errorsByType: this.getErrorsByType(recentErrors),
      errorsBySeverity: this.getErrorsBySeverity(recentErrors),
      errorsByProvider: this.getErrorsByProvider(recentErrors),
      topErrorPatterns: this.getTopErrorPatterns(recentErrors),
      timeWindow: timeWindowMs,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Get total parsing failures across all providers
   * @private
   */
  getTotalParsingFailures() {
    let total = 0;
    for (const failures of this.parsingFailures.values()) {
      total += failures.count;
    }
    return total;
  }

  /**
   * Get total provider errors across all providers
   * @private
   */
  getTotalProviderErrors() {
    let total = 0;
    for (const errors of this.providerErrors.values()) {
      total += errors.count;
    }
    return total;
  }

  /**
   * Get errors by type
   * @private
   */
  getErrorsByType(errors) {
    const breakdown = new Map();
    errors.forEach((error) => {
      breakdown.set(error.errorType, (breakdown.get(error.errorType) || 0) + 1);
    });
    return Object.fromEntries(breakdown);
  }

  /**
   * Get errors by severity
   * @private
   */
  getErrorsBySeverity(errors) {
    const breakdown = new Map();
    errors.forEach((error) => {
      breakdown.set(error.severity, (breakdown.get(error.severity) || 0) + 1);
    });
    return Object.fromEntries(breakdown);
  }

  /**
   * Get errors by provider
   * @private
   */
  getErrorsByProvider(errors) {
    const breakdown = new Map();
    errors.forEach((error) => {
      if (error.providerName) {
        breakdown.set(
          error.providerName,
          (breakdown.get(error.providerName) || 0) + 1
        );
      }
    });
    return Object.fromEntries(breakdown);
  }

  /**
   * Get top error patterns
   * @private
   */
  getTopErrorPatterns(errors) {
    const patterns = new Map();
    errors.forEach((error) => {
      const pattern = this.identifyErrorPattern({
        message: error.errorMessage,
      });
      patterns.set(pattern, (patterns.get(pattern) || 0) + 1);
    });

    return Array.from(patterns.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([pattern, count]) => ({ pattern, count }));
  }

  /**
   * Export error data for analysis
   */
  exportErrorData(options = {}) {
    const timeWindow = options.timeWindow || 3600000; // 1 hour
    const includeStackTraces = options.includeStackTraces || false;
    const includeResponseSamples = options.includeResponseSamples || false;

    const cutoff = Date.now() - timeWindow;
    const recentErrors = this.recentErrors.filter(
      (error) => error.timestamp > cutoff
    );

    const exportData = {
      timestamp: new Date().toISOString(),
      timeWindow,
      totalErrors: recentErrors.length,
      errors: recentErrors.map((error) => {
        const exported = {
          timestamp: new Date(error.timestamp).toISOString(),
          errorType: error.errorType,
          severity: error.severity,
          providerName: error.providerName,
          operation: error.operation,
          errorMessage: error.errorMessage,
          errorName: error.errorName,
        };

        if (includeStackTraces && error.stackTrace) {
          exported.stackTrace = error.stackTrace;
        }

        if (includeResponseSamples && error.responseSample) {
          exported.responseSample = error.responseSample;
        }

        return exported;
      }),
      statistics: this.getErrorStatistics(timeWindow),
      parsingFailures: Object.fromEntries(this.parsingFailures),
      providerErrors: Object.fromEntries(this.providerErrors),
    };

    return exportData;
  }

  /**
   * Export comprehensive error logs for external monitoring systems
   * @param {Object} options - Export options
   * @returns {Object} Comprehensive error data
   */
  exportErrorLogs(options = {}) {
    const timeRange = options.timeRange || 3600000; // 1 hour default
    const cutoffTime = Date.now() - timeRange;
    const includeStackTraces = options.includeStackTraces || false;
    const includeResponseSamples = options.includeResponseSamples || false;

    return {
      exportTimestamp: new Date().toISOString(),
      timeRange: timeRange,
      configuration: {
        logLevel: this.config.logLevel,
        enableMonitoringIntegration: this.config.enableMonitoringIntegration,
        alertThresholds: this.config.alertThresholds,
        maxResponseSampleSize: this.config.maxResponseSampleSize,
      },
      errorSummary: this.generateMonitoringReport(),
      recentErrors: this.recentErrors
        .filter((error) => error.timestamp > cutoffTime)
        .map((error) => ({
          ...error,
          stackTrace: includeStackTraces ? error.stackTrace : undefined,
          responseSample: includeResponseSamples
            ? error.responseSample
            : undefined,
        })),
      providerHealthStatus: this.getProviderHealthStatus(),
      alertHistory: this.getAlertHistory(timeRange),
      systemMetrics: {
        hostname: require('os').hostname(),
        pid: process.pid,
        memory: process.memoryUsage(),
        uptime: process.uptime(),
        nodeVersion: process.version,
      },
    };
  }

  /**
   * Get provider health status for monitoring integration
   * @returns {Object} Provider health status
   */
  getProviderHealthStatus() {
    const healthStatus = {};

    for (const [
      providerName,
      errorData,
    ] of this.errorTracking.providerErrors.entries()) {
      const recentErrors = this.getRecentProviderErrors(providerName, 300000); // Last 5 minutes
      const totalErrors = errorData.count;
      const lastError = errorData.lastError;
      const errorRate = recentErrors / 5; // Errors per minute

      healthStatus[providerName] = {
        isHealthy: recentErrors === 0,
        recentErrorCount: recentErrors,
        totalErrorCount: totalErrors,
        errorRate: errorRate,
        lastErrorTime: lastError ? new Date(lastError).toISOString() : null,
        consecutiveFailures: this.getConsecutiveFailures(providerName),
        errorTypes: Object.fromEntries(errorData.errorTypes),
        severityBreakdown: Object.fromEntries(errorData.severities),
        healthScore: this.calculateHealthScore(
          providerName,
          recentErrors,
          totalErrors
        ),
      };
    }

    return healthStatus;
  }

  /**
   * Get alert history for monitoring integration
   * @param {number} timeRange - Time range in milliseconds
   * @returns {Array} Alert history
   */
  getAlertHistory(timeRange = 3600000) {
    const cutoffTime = Date.now() - timeRange;
    const alertHistory = [];

    for (const [
      alertType,
      timestamps,
    ] of this.errorTracking.alertHistory.entries()) {
      const recentAlerts = timestamps.filter((ts) => ts > cutoffTime);
      if (recentAlerts.length > 0) {
        alertHistory.push({
          alertType,
          count: recentAlerts.length,
          timestamps: recentAlerts.map((ts) => new Date(ts).toISOString()),
          firstAlert: new Date(Math.min(...recentAlerts)).toISOString(),
          lastAlert: new Date(Math.max(...recentAlerts)).toISOString(),
        });
      }
    }

    return alertHistory.sort(
      (a, b) => new Date(b.lastAlert) - new Date(a.lastAlert)
    );
  }

  /**
   * Calculate health score for a provider
   * @param {string} providerName - Provider name
   * @param {number} recentErrors - Recent error count
   * @param {number} totalErrors - Total error count
   * @returns {number} Health score (0-100)
   * @private
   */
  calculateHealthScore(providerName, recentErrors, totalErrors) {
    // Base score starts at 100
    let score = 100;

    // Deduct points for recent errors (more weight)
    score -= recentErrors * 10;

    // Deduct points for total errors (less weight)
    score -= Math.min(totalErrors * 0.5, 30);

    // Check for consecutive failures
    const consecutiveFailures = this.getConsecutiveFailures(providerName);
    score -= consecutiveFailures * 5;

    // Check for parsing failures specifically
    const parsingFailures =
      this.errorTracking.parsingFailures.get(providerName);
    if (parsingFailures && parsingFailures.count > 0) {
      score -= Math.min(parsingFailures.count * 2, 20);
    }

    // Ensure score is between 0 and 100
    return Math.max(0, Math.min(100, Math.round(score)));
  }

  /**
   * Get consecutive failures for a provider
   * @param {string} providerName - Provider name
   * @returns {number} Consecutive failure count
   * @private
   */
  getConsecutiveFailures(providerName) {
    const providerData = this.errorTracking.providerErrors.get(providerName);
    if (!providerData) return 0;

    // This is a simplified implementation
    // In a real system, you'd track consecutive failures more precisely
    const recentErrors = this.getRecentProviderErrors(providerName, 600000); // Last 10 minutes
    return Math.min(recentErrors, 10); // Cap at 10 for calculation purposes
  }

  /**
   * Log structured error with enhanced context for monitoring integration
   * @param {string} errorType - Type of error
   * @param {Error} error - Error object
   * @param {Object} context - Enhanced context
   */
  logStructuredError(errorType, error, context = {}) {
    const structuredData = {
      errorType,
      errorMessage: error.message,
      errorName: error.name,
      errorCode: error.code,
      timestamp: new Date().toISOString(),

      // Provider context
      providerName: context.providerName,
      operation: context.operation,

      // Request context
      requestId: context.requestId,
      attemptNumber: context.attemptNumber || 1,

      // Response context
      responseStructure: context.responseStructure,
      responseSample: context.responseSample,

      // System context
      systemInfo: {
        hostname: require('os').hostname(),
        pid: process.pid,
        memory: process.memoryUsage(),
        uptime: process.uptime(),
      },

      // Monitoring metadata
      severity: this.classifyErrorSeverity(
        error,
        context.providerName,
        context.operation
      ),
      recoverable: this.isRecoverableError(error),
      alertable: this.shouldAlert(errorType, context.providerName),
    };

    // Add stack trace if enabled
    if (this.config.includeStackTrace && error.stack) {
      structuredData.stackTrace = error.stack;
    }

    // Log with appropriate level based on severity
    const logLevel =
      structuredData.severity === 'critical'
        ? 'error'
        : structuredData.severity === 'high'
        ? 'error'
        : structuredData.severity === 'medium'
        ? 'warn'
        : 'info';

    this.logger[logLevel]('Structured error logged', structuredData);

    // Track for monitoring
    this.trackError(errorType, {
      ...context,
      error: error.message,
      severity: structuredData.severity,
      timestamp: Date.now(),
    });

    // Check for immediate alerts
    if (structuredData.alertable) {
      this.checkImmediateAlerts(errorType, structuredData);
    }
  }

  /**
   * Check if error should trigger immediate alert
   * @param {string} errorType - Error type
   * @param {Object} errorData - Error data
   * @private
   */
  checkImmediateAlerts(errorType, errorData) {
    // Critical errors always alert immediately
    if (errorData.severity === 'critical') {
      this.sendAlert(`critical_${errorType}`, {
        ...errorData,
        immediate: true,
      });
      return;
    }

    // Check threshold-based alerts
    const recentCount = this.getRecentErrorCount(errorType, 60000); // Last minute
    const threshold = this.getAlertThreshold(errorType);

    if (recentCount >= threshold) {
      this.sendAlert(`threshold_${errorType}`, {
        ...errorData,
        recentCount,
        threshold,
      });
    }
  }

  /**
   * Get alert threshold for error type
   * @param {string} errorType - Error type
   * @returns {number} Alert threshold
   * @private
   */
  getAlertThreshold(errorType) {
    switch (errorType) {
      case 'response_parsing':
        return this.config.alertThresholds.parsingFailuresPerMinute;
      case 'provider_method':
        return this.config.alertThresholds.criticalErrorsPerMinute;
      case 'provider_operation':
        return this.config.alertThresholds.providerFailuresPerMinute;
      default:
        return 5; // Default threshold
    }
  }

  /**
   * Check if error should trigger alerts
   * @param {string} errorType - Error type
   * @param {string} providerName - Provider name
   * @returns {boolean} Should alert
   * @private
   */
  shouldAlert(errorType, providerName) {
    // Always alert for critical error types
    const criticalTypes = ['provider_method', 'response_parsing'];
    if (criticalTypes.includes(errorType)) {
      return true;
    }

    // Alert for provider operations if error rate is high
    if (errorType === 'provider_operation' && providerName) {
      const recentErrors = this.getRecentProviderErrors(providerName, 300000); // Last 5 minutes
      return recentErrors >= 3; // Alert if 3+ errors in 5 minutes
    }

    return false;
  }

  /**
   * Check if error is recoverable
   * @param {Error} error - Error object
   * @returns {boolean} Is recoverable
   * @private
   */
  isRecoverableError(error) {
    const message = error.message.toLowerCase();

    // Non-recoverable errors
    const nonRecoverablePatterns = [
      'is not a function',
      'cannot read property',
      'cannot read properties',
      'authentication',
      'unauthorized',
      'invalid api key',
    ];

    return !nonRecoverablePatterns.some((pattern) => message.includes(pattern));
  }

  /**
   * Cleanup resources
   */
  destroy() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    // Clear tracking data
    this.errorCounts.clear();
    this.providerErrors.clear();
    this.parsingFailures.clear();
    this.recentErrors.length = 0;
    this.errorTimestamps.clear();
    this.alertSuppressionMap.clear();

    // Close logger
    if (this.logger) {
      this.logger.close();
    }

    console.log('EnhancedErrorLogger destroyed');
  }
}

module.exports = EnhancedErrorLogger;
