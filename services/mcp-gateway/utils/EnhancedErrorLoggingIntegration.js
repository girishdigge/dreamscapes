// utils/EnhancedErrorLoggingIntegration.js
// Enhanced error logging integration system for comprehensive monitoring

const EventEmitter = require('events');
const winston = require('winston');
const path = require('path');
const fs = require('fs');

/**
 * Enhanced Error Logging Integration - Comprehensive error logging with monitoring integration
 * Addresses requirements 4.1, 4.2, 4.3, 4.4, 4.5 for detailed error logging and monitoring
 */
class EnhancedErrorLoggingIntegration extends EventEmitter {
  constructor(config = {}) {
    super();

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
      enableAlertingIntegration: config.enableAlertingIntegration !== false,
      enableMetricsIntegration: config.enableMetricsIntegration !== false,

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
      alertSuppressionWindow: config.alertSuppressionWindow || 300000, // 5 minutes

      ...config,
    };

    // Error tracking state
    this.errorTracking = {
      recentErrors: new Map(), // error_type -> Array<timestamp>
      providerErrors: new Map(), // provider_name -> error_data
      parsingFailures: new Map(), // provider_name -> failure_data
      alertHistory: new Map(), // alert_type -> Array<timestamp>
      suppressedAlerts: new Map(), // alert_key -> timestamp
      errorPatterns: new Map(), // pattern -> count
      responseStructures: new Map(), // structure_type -> count
    };

    // Integration components
    this.logger = null;
    this.metricsCollector = null;
    this.alertingSystem = null;
    this.healthMonitor = null;
    this.structuredLogger = null;

    // Monitoring intervals
    this.trackingInterval = null;
    this.reportingInterval = null;

    // Error classification patterns
    this.errorPatterns = {
      RESPONSE_PARSING: /substring is not a function|cannot read propert/i,
      MISSING_METHOD: /is not a function/i,
      UNDEFINED_ACCESS: /cannot read propert|undefined/i,
      TIMEOUT: /timeout|timed out/i,
      RATE_LIMIT: /rate limit|too many requests/i,
      AUTHENTICATION: /authentication|unauthorized|invalid.*key/i,
      NETWORK: /network|connection|econnrefused/i,
      JSON_PARSE: /unexpected token|invalid json/i,
    };

    this.initializeLogger();
    console.log('EnhancedErrorLoggingIntegration initialized');
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
              return `${timestamp} [${level}] [ErrorLogging]: ${message}${metaStr}`;
            })
          ),
        })
      );
    }

    // File transports for different error types
    if (this.config.enableFile) {
      // Enhanced error log with detailed context
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
            winston.format.json(),
            winston.format((info) => {
              return info.errorType === 'response_parsing' ? info : false;
            })()
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
            winston.format.json(),
            winston.format((info) => {
              return info.providerName ? info : false;
            })()
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
            winston.format.json(),
            winston.format((info) => {
              return info.severity === 'critical' ? info : false;
            })()
          ),
        })
      );

      // Monitoring integration log
      transports.push(
        new winston.transports.File({
          filename: path.join(
            this.config.logDirectory,
            'monitoring-integration.log'
          ),
          level: 'info',
          maxsize: this.config.maxFileSize,
          maxFiles: this.config.maxFiles,
          format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.json(),
            winston.format((info) => {
              return info.type === 'monitoring' ? info : false;
            })()
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
   * Initialize integration with monitoring components
   * @param {Object} components - Monitoring components
   */
  initialize(components = {}) {
    try {
      // Initialize monitoring components
      this.metricsCollector = components.metricsCollector;
      this.alertingSystem = components.alertingSystem;
      this.healthMonitor = components.healthMonitor;
      this.structuredLogger = components.structuredLogger;

      // Start real-time tracking if enabled
      if (this.config.enableMonitoringIntegration) {
        this.startRealTimeTracking();
      }

      console.log(
        'Enhanced error logging integration initialized successfully'
      );
    } catch (error) {
      console.error(
        'Failed to initialize error logging integration:',
        error.message
      );
      throw error;
    }
  }

  /**
   * Start real-time error tracking
   */
  startRealTimeTracking() {
    // Start tracking interval
    this.trackingInterval = setInterval(() => {
      this.performTrackingTasks();
    }, this.config.trackingInterval);

    // Start reporting interval
    this.reportingInterval = setInterval(() => {
      this.performReportingTasks();
    }, this.config.reportingInterval);

    console.log('Real-time error tracking started');
  }

  /**
   * Log response parsing error with detailed context and monitoring integration
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
      severity: 'high',
      ...context,
    });

    // Add response structure analysis
    if (this.config.includeResponseStructure && originalResponse) {
      errorData.responseAnalysis =
        this.analyzeResponseStructure(originalResponse);
      this.trackResponseStructure(errorData.responseAnalysis.structure);
    }

    // Add parsing attempt details
    errorData.parsingAttempts = this.extractParsingAttempts(error, context);

    // Enhanced logging with detailed context
    this.logger.error(
      'Response parsing failed with detailed analysis',
      errorData
    );

    // Track parsing failures for monitoring
    this.trackParsingFailure(providerName, errorData);

    // Integrate with structured logger
    if (this.structuredLogger) {
      this.structuredLogger.error('Response parsing failed', error, {
        providerName,
        errorType: 'response_parsing',
        responseStructure: errorData.responseAnalysis,
        context,
      });
    }

    // Check for alert conditions
    this.checkParsingFailureAlerts(providerName, errorData);

    // Emit event for other monitoring systems
    this.emit('responseParsingError', {
      providerName,
      error: error.message,
      originalResponse,
      context,
      timestamp: Date.now(),
    });

    // Integrate with metrics collector
    if (this.metricsCollector) {
      this.metricsCollector.recordError('response_parsing', {
        provider: providerName,
        severity: 'high',
        pattern: this.identifyErrorPattern(error.message),
      });
    }
  }

  /**
   * Log provider method error with comprehensive monitoring integration
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
      severity: 'critical',
      ...context,
    });

    // Add provider state analysis
    errorData.providerState = this.analyzeProviderState(providerName, context);

    // Enhanced logging with critical severity
    this.logger.error('Provider method error - CRITICAL', errorData);

    // Track provider errors for monitoring
    this.trackProviderError(providerName, errorData);

    // Integrate with structured logger
    if (this.structuredLogger) {
      this.structuredLogger.error('Provider method error', error, {
        providerName,
        methodName,
        errorType: 'provider_method',
        severity: 'critical',
        context,
      });
    }

    // Immediate critical alert
    this.sendCriticalAlert('provider_method_missing', {
      providerName,
      methodName,
      error: error.message,
      context,
    });

    // Update health monitor if available
    if (this.healthMonitor) {
      this.healthMonitor.recordProviderError(providerName, {
        type: 'method_error',
        severity: 'critical',
        method: methodName,
        error: error.message,
      });
    }

    // Emit event for other monitoring systems
    this.emit('providerMethodError', {
      providerName,
      methodName,
      error: error.message,
      context,
      timestamp: Date.now(),
    });

    // Integrate with metrics collector
    if (this.metricsCollector) {
      this.metricsCollector.recordError('provider_method', {
        provider: providerName,
        method: methodName,
        severity: 'critical',
      });
    }
  }

  /**
   * Log provider operation error with detailed monitoring integration
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

    const errorData = this.buildEnhancedErrorData(error, {
      errorType: 'provider_operation',
      providerName,
      operation,
      requestData: this.sanitizeRequestData(requestData),
      severity,
      ...context,
    });

    // Add operation-specific analysis
    errorData.operationAnalysis = this.analyzeOperationFailure(
      operation,
      error,
      context
    );

    // Enhanced logging with operation context
    this.logger.error('Provider operation failed with analysis', errorData);

    // Track provider errors for monitoring
    this.trackProviderError(providerName, errorData);

    // Integrate with structured logger
    if (this.structuredLogger) {
      this.structuredLogger.error('Provider operation failed', error, {
        providerName,
        operation,
        errorType: 'provider_operation',
        severity,
        requestData: this.sanitizeRequestData(requestData),
        context,
      });
    }

    // Check for alert conditions based on severity
    if (severity === 'critical' || severity === 'high') {
      this.checkProviderFailureAlerts(providerName, errorData);
    }

    // Update health monitor
    if (this.healthMonitor) {
      this.healthMonitor.recordProviderError(providerName, {
        type: 'operation_error',
        severity,
        operation,
        error: error.message,
      });
    }

    // Emit event for other monitoring systems
    this.emit('providerOperationError', {
      providerName,
      operation,
      error: error.message,
      severity,
      requestData,
      context,
      timestamp: Date.now(),
    });

    // Integrate with metrics collector
    if (this.metricsCollector) {
      this.metricsCollector.recordError('provider_operation', {
        provider: providerName,
        operation,
        severity,
        pattern: this.identifyErrorPattern(error.message),
      });
    }
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
      pattern: this.identifyErrorPattern(error.message),

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
      errorPattern: this.identifyErrorPattern(error.message),
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
  identifyErrorPattern(message) {
    const lowerMessage = message.toLowerCase();

    for (const [pattern, regex] of Object.entries(this.errorPatterns)) {
      if (regex.test(lowerMessage)) {
        return pattern;
      }
    }

    return 'UNKNOWN_PATTERN';
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
    if (!this.errorTracking.parsingFailures.has(providerName)) {
      this.errorTracking.parsingFailures.set(providerName, {
        count: 0,
        firstFailure: Date.now(),
        lastFailure: null,
        patterns: new Map(),
      });
    }

    const failures = this.errorTracking.parsingFailures.get(providerName);
    failures.count++;
    failures.lastFailure = Date.now();

    // Track error patterns
    const pattern = errorData.pattern;
    failures.patterns.set(pattern, (failures.patterns.get(pattern) || 0) + 1);

    // Track timestamp for alerting
    this.trackErrorTimestamp('parsing_failure', Date.now());
  }

  /**
   * Track provider error for monitoring
   * @private
   */
  trackProviderError(providerName, errorData) {
    if (!this.errorTracking.providerErrors.has(providerName)) {
      this.errorTracking.providerErrors.set(providerName, {
        count: 0,
        firstError: Date.now(),
        lastError: null,
        errorTypes: new Map(),
        severityCount: new Map(),
      });
    }

    const errors = this.errorTracking.providerErrors.get(providerName);
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

    // Track timestamp for alerting
    this.trackErrorTimestamp(
      `provider_error_${errorData.severity}`,
      Date.now()
    );
  }

  /**
   * Track response structure patterns
   * @private
   */
  trackResponseStructure(structure) {
    this.errorTracking.responseStructures.set(
      structure,
      (this.errorTracking.responseStructures.get(structure) || 0) + 1
    );
  }

  /**
   * Track error timestamp for alerting
   * @private
   */
  trackErrorTimestamp(errorType, timestamp) {
    if (!this.errorTracking.recentErrors.has(errorType)) {
      this.errorTracking.recentErrors.set(errorType, []);
    }

    const timestamps = this.errorTracking.recentErrors.get(errorType);
    timestamps.push(timestamp);

    // Keep only last hour of timestamps
    const oneHourAgo = Date.now() - 3600000;
    this.errorTracking.recentErrors.set(
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
   * Send critical alert immediately
   * @private
   */
  sendCriticalAlert(alertType, alertData) {
    const alertKey = `${alertType}_${alertData.providerName}`;

    // Critical alerts bypass normal suppression for first occurrence
    if (!this.errorTracking.suppressedAlerts.has(alertKey)) {
      this.sendAlert(alertType, {
        ...alertData,
        severity: 'critical',
        immediate: true,
      });
    }
  }

  /**
   * Send alert with suppression logic
   * @private
   */
  sendAlert(alertType, alertData) {
    const alertKey = `${alertType}_${alertData.providerName || 'global'}`;
    const now = Date.now();
    const lastSent = this.errorTracking.suppressedAlerts.get(alertKey);

    // Check suppression window (except for immediate critical alerts)
    if (
      !alertData.immediate &&
      lastSent &&
      now - lastSent < this.config.alertSuppressionWindow
    ) {
      return; // Suppress duplicate alert
    }

    this.errorTracking.suppressedAlerts.set(alertKey, now);

    // Track alert history
    if (!this.errorTracking.alertHistory.has(alertType)) {
      this.errorTracking.alertHistory.set(alertType, []);
    }
    this.errorTracking.alertHistory.get(alertType).push(now);

    // Send to alerting system if available
    if (this.alertingSystem) {
      this.alertingSystem.sendAlert(alertType, alertData);
    }

    // Enhanced logging for alerts
    this.logger.error(`ALERT: ${alertType}`, {
      type: 'monitoring',
      alertType,
      alertData,
      alertKey,
      timestamp: new Date().toISOString(),
    });

    // Console alert for immediate visibility
    console.error(`🚨 ALERT [${alertType}]:`, alertData);

    // Emit alert event
    this.emit('alert', {
      type: alertType,
      data: alertData,
      timestamp: now,
    });
  }

  /**
   * Get recent error count for specific type
   * @private
   */
  getRecentErrorCount(errorType, timeWindowMs) {
    const timestamps = this.errorTracking.recentErrors.get(errorType) || [];
    const cutoff = Date.now() - timeWindowMs;
    return timestamps.filter((ts) => ts > cutoff).length;
  }

  /**
   * Perform tracking tasks
   * @private
   */
  performTrackingTasks() {
    try {
      // Clean up old timestamps
      this.cleanupOldTimestamps();

      // Check for alert conditions
      this.checkAlertConditions();

      // Update health monitor with error data
      this.updateHealthMonitorWithErrors();
    } catch (error) {
      console.error('Error in tracking tasks:', error.message);
    }
  }

  /**
   * Perform reporting tasks
   * @private
   */
  performReportingTasks() {
    try {
      // Generate error monitoring report
      const report = this.generateErrorMonitoringReport();

      // Log report
      this.logger.info('Error monitoring report', {
        type: 'monitoring',
        report,
      });

      // Send to metrics collector
      if (this.metricsCollector) {
        this.metricsCollector.recordCustomMetric(
          'error_monitoring_report',
          report
        );
      }

      // Emit report event
      this.emit('monitoringReport', report);
    } catch (error) {
      console.error('Error in reporting tasks:', error.message);
    }
  }

  /**
   * Check alert conditions
   * @private
   */
  checkAlertConditions() {
    // Check critical error threshold
    const criticalErrors = this.getRecentErrorCount(
      'provider_error_critical',
      60000
    );
    if (criticalErrors >= this.config.alertThresholds.criticalErrorsPerMinute) {
      this.sendAlert('critical_errors_threshold', {
        errorCount: criticalErrors,
        threshold: this.config.alertThresholds.criticalErrorsPerMinute,
        timeWindow: '1 minute',
      });
    }

    // Check parsing failure threshold
    const parsingFailures = this.getRecentErrorCount('parsing_failure', 60000);
    if (
      parsingFailures >= this.config.alertThresholds.parsingFailuresPerMinute
    ) {
      this.sendAlert('parsing_failures_threshold', {
        failureCount: parsingFailures,
        threshold: this.config.alertThresholds.parsingFailuresPerMinute,
        timeWindow: '1 minute',
      });
    }
  }

  /**
   * Update health monitor with error data
   * @private
   */
  updateHealthMonitorWithErrors() {
    if (!this.healthMonitor) return;

    // Update provider health based on recent errors
    for (const [
      providerName,
      errorData,
    ] of this.errorTracking.providerErrors.entries()) {
      const recentErrors = this.getRecentProviderErrors(providerName, 300000); // Last 5 minutes

      if (recentErrors > 0) {
        this.healthMonitor.recordProviderError(providerName, {
          type: 'monitoring_integration',
          recentErrorCount: recentErrors,
          totalErrors: errorData.count,
          lastError: errorData.lastError,
        });
      }
    }
  }

  /**
   * Get recent provider errors
   * @private
   */
  getRecentProviderErrors(providerName, timeWindowMs) {
    const providerData = this.errorTracking.providerErrors.get(providerName);
    if (!providerData) return 0;

    const cutoff = Date.now() - timeWindowMs;
    let recentCount = 0;

    // Count errors from all types for this provider
    for (const [
      errorType,
      timestamps,
    ] of this.errorTracking.recentErrors.entries()) {
      recentCount += timestamps.filter((ts) => ts > cutoff).length;
    }

    return recentCount;
  }

  /**
   * Clean up old timestamps
   * @private
   */
  cleanupOldTimestamps() {
    const oneHourAgo = Date.now() - 3600000; // 1 hour

    // Clean up recent errors
    for (const [
      errorType,
      timestamps,
    ] of this.errorTracking.recentErrors.entries()) {
      const filtered = timestamps.filter((ts) => ts > oneHourAgo);
      this.errorTracking.recentErrors.set(errorType, filtered);
    }

    // Clean up alert history
    for (const [
      alertType,
      timestamps,
    ] of this.errorTracking.alertHistory.entries()) {
      const filtered = timestamps.filter((ts) => ts > oneHourAgo);
      this.errorTracking.alertHistory.set(alertType, filtered);
    }

    // Clean up suppressed alerts
    const suppressionCutoff = Date.now() - this.config.alertSuppressionWindow;
    for (const [
      alertKey,
      timestamp,
    ] of this.errorTracking.suppressedAlerts.entries()) {
      if (timestamp < suppressionCutoff) {
        this.errorTracking.suppressedAlerts.delete(alertKey);
      }
    }
  }

  /**
   * Generate comprehensive error monitoring report
   */
  generateErrorMonitoringReport() {
    const now = Date.now();
    const oneHourAgo = now - 3600000;

    // Calculate recent error counts
    const recentErrorCounts = new Map();
    for (const [
      errorType,
      timestamps,
    ] of this.errorTracking.recentErrors.entries()) {
      const recentCount = timestamps.filter((ts) => ts > oneHourAgo).length;
      if (recentCount > 0) {
        recentErrorCounts.set(errorType, recentCount);
      }
    }

    // Provider error summary
    const providerErrorSummary = new Map();
    for (const [
      providerName,
      errorData,
    ] of this.errorTracking.providerErrors.entries()) {
      const recentErrors = this.getRecentProviderErrors(providerName, 3600000);
      if (recentErrors > 0) {
        providerErrorSummary.set(providerName, {
          recentErrors,
          totalErrors: errorData.count,
          lastError: new Date(errorData.lastError).toISOString(),
          errorTypes: Object.fromEntries(errorData.errorTypes),
          severities: Object.fromEntries(errorData.severityCount),
        });
      }
    }

    // Parsing failure summary
    const parsingFailureSummary = new Map();
    for (const [
      providerName,
      failureData,
    ] of this.errorTracking.parsingFailures.entries()) {
      if (failureData.lastFailure > oneHourAgo) {
        parsingFailureSummary.set(providerName, {
          totalFailures: failureData.count,
          lastFailure: new Date(failureData.lastFailure).toISOString(),
          patterns: Object.fromEntries(failureData.patterns),
        });
      }
    }

    return {
      timestamp: new Date().toISOString(),
      timeWindow: '1 hour',
      summary: {
        totalErrorTypes: recentErrorCounts.size,
        totalRecentErrors: Array.from(recentErrorCounts.values()).reduce(
          (sum, count) => sum + count,
          0
        ),
        affectedProviders: providerErrorSummary.size,
        providersWithParsingFailures: parsingFailureSummary.size,
      },
      errorsByType: Object.fromEntries(recentErrorCounts),
      providerErrors: Object.fromEntries(providerErrorSummary),
      parsingFailures: Object.fromEntries(parsingFailureSummary),
      responseStructures: Object.fromEntries(
        this.errorTracking.responseStructures
      ),
      alertsSent: this.getRecentAlertCount(3600000),
      thresholds: {
        critical: this.config.alertThresholds.criticalErrorsPerMinute,
        parsingFailures: this.config.alertThresholds.parsingFailuresPerMinute,
        providerFailures: this.config.alertThresholds.providerFailuresPerMinute,
      },
    };
  }

  /**
   * Get recent alert count
   * @private
   */
  getRecentAlertCount(timeWindowMs) {
    const cutoff = Date.now() - timeWindowMs;
    let totalAlerts = 0;

    for (const timestamps of this.errorTracking.alertHistory.values()) {
      totalAlerts += timestamps.filter((ts) => ts > cutoff).length;
    }

    return totalAlerts;
  }

  /**
   * Get error statistics
   */
  getErrorStatistics(timeWindowMs = 3600000) {
    const cutoff = Date.now() - timeWindowMs;

    // Recent error counts by type
    const errorsByType = new Map();
    for (const [
      errorType,
      timestamps,
    ] of this.errorTracking.recentErrors.entries()) {
      const recentCount = timestamps.filter((ts) => ts > cutoff).length;
      if (recentCount > 0) {
        errorsByType.set(errorType, recentCount);
      }
    }

    // Provider error statistics
    const providerStats = new Map();
    for (const [
      providerName,
      errorData,
    ] of this.errorTracking.providerErrors.entries()) {
      const recentErrors = this.getRecentProviderErrors(
        providerName,
        timeWindowMs
      );
      if (recentErrors > 0) {
        providerStats.set(providerName, {
          recentErrors,
          totalErrors: errorData.count,
          errorRate: recentErrors / (timeWindowMs / 60000), // errors per minute
          lastError: errorData.lastError,
        });
      }
    }

    return {
      timeWindow: timeWindowMs,
      errorsByType: Object.fromEntries(errorsByType),
      providerStats: Object.fromEntries(providerStats),
      totalRecentErrors: Array.from(errorsByType.values()).reduce(
        (sum, count) => sum + count,
        0
      ),
      affectedProviders: providerStats.size,
    };
  }

  /**
   * Stop real-time tracking
   */
  stopRealTimeTracking() {
    if (this.trackingInterval) {
      clearInterval(this.trackingInterval);
      this.trackingInterval = null;
    }

    if (this.reportingInterval) {
      clearInterval(this.reportingInterval);
      this.reportingInterval = null;
    }

    console.log('Real-time error tracking stopped');
  }

  /**
   * Cleanup resources
   */
  destroy() {
    this.stopRealTimeTracking();

    // Clear tracking data
    this.errorTracking.recentErrors.clear();
    this.errorTracking.providerErrors.clear();
    this.errorTracking.parsingFailures.clear();
    this.errorTracking.alertHistory.clear();
    this.errorTracking.suppressedAlerts.clear();
    this.errorTracking.errorPatterns.clear();
    this.errorTracking.responseStructures.clear();

    if (this.logger) {
      // Properly close logger with fallback cleanup
      if (typeof this.logger.close === 'function') {
        this.logger.close();
      } else if (this.logger.transports) {
        // Fallback: close individual transports
        this.logger.transports.forEach((transport) => {
          if (transport.close && typeof transport.close === 'function') {
            transport.close();
          }
        });
      }
    }

    console.log('EnhancedErrorLoggingIntegration destroyed');
  }
}

module.exports = EnhancedErrorLoggingIntegration;
