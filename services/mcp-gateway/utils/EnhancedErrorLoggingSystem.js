// utils/EnhancedErrorLoggingSystem.js
// Comprehensive error logging system with detailed provider context and monitoring integration

const winston = require('winston');
const path = require('path');
const fs = require('fs');
const EventEmitter = require('events');

/**
 * Enhanced Error Logging System - Comprehensive error logging with detailed context
 * Integrates with existing monitoring infrastructure and provides structured logging
 */
class EnhancedErrorLoggingSystem extends EventEmitter {
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
      enableRealTimeAlerts: config.enableRealTimeAlerts !== false,

      // Alert thresholds
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
    this.errorTracking = {
      recentErrors: new Map(), // error_type -> Array<timestamp>
      providerErrors: new Map(), // provider_name -> error_data
      parsingFailures: new Map(), // provider_name -> parsing_failure_data
      alertHistory: new Map(), // alert_type -> Array<timestamp>
      suppressedAlerts: new Map(), // alert_key -> timestamp
      errorPatterns: new Map(), // pattern -> count
      responseStructures: new Map(), // provider -> structure_analysis
    };

    // Time-based error tracking for alerting
    this.errorTimestamps = new Map(); // error_type -> Array<timestamp>
    this.alertSuppressionMap = new Map(); // alert_type -> last_sent_timestamp
    this.recentErrors = []; // Array of recent errors for analysis
    this.maxRecentErrors = 1000;

    // Integration components
    this.enhancedErrorLogger = null;
    this.structuredLogger = null;
    this.metricsCollector = null;
    this.alertingSystem = null;

    // Initialize logging system
    this.initializeLogger();

    // Start monitoring integration if enabled
    if (this.config.enableMonitoringIntegration) {
      this.startMonitoringIntegration();
    }

    console.log('EnhancedErrorLoggingSystem initialized with config:', {
      logLevel: this.config.logLevel,
      enableFile: this.config.enableFile,
      enableMonitoringIntegration: this.config.enableMonitoringIntegration,
      logDirectory: this.config.logDirectory,
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
              return `${timestamp} [${level}] [EnhancedErrorLogging]: ${message}${metaStr}`;
            })
          ),
        })
      );
    }

    // File transports for different error types
    if (this.config.enableFile) {
      // General error log with detailed context
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

      // Provider errors log with detailed context
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

      // Structured monitoring log
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
   * Initialize integration with monitoring components
   * @param {Object} components - Monitoring components
   */
  initializeIntegration(components = {}) {
    try {
      // Initialize Enhanced Error Logger
      if (components.enhancedErrorLogger) {
        this.enhancedErrorLogger = components.enhancedErrorLogger;
        console.log('Enhanced Error Logger integrated');
      }

      // Initialize Structured Logger
      if (components.structuredLogger) {
        this.structuredLogger = components.structuredLogger;
        console.log('Structured Logger integrated');
      }

      // Initialize Metrics Collector
      if (components.metricsCollector) {
        this.metricsCollector = components.metricsCollector;
        console.log('Metrics Collector integrated');
      }

      // Initialize Alerting System
      if (components.alertingSystem) {
        this.alertingSystem = components.alertingSystem;
        console.log('Alerting System integrated');
      }

      console.log(
        'Enhanced error logging integration initialized successfully'
      );
    } catch (error) {
      console.error(
        'Failed to initialize enhanced error logging integration:',
        error.message
      );
      throw error;
    }
  }

  /**
   * Log response parsing error with comprehensive context
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
      this.trackResponseStructure(providerName, errorData.responseAnalysis);
    }

    // Add parsing attempt details
    errorData.parsingAttempts = this.extractParsingAttempts(error, context);

    // Add provider-specific context
    if (this.config.includeProviderContext) {
      errorData.providerContext = this.buildProviderContext(
        providerName,
        context
      );
    }

    this.logger.error('Response parsing failed', errorData);

    // Track parsing failures for monitoring
    this.trackParsingFailure(providerName, errorData);

    // Integrate with existing monitoring systems
    this.integrateWithMonitoringSystems('response_parsing', errorData);

    // Check for alert conditions
    this.checkParsingFailureAlerts(providerName, errorData);

    // Emit event for real-time monitoring
    this.emit('responseParsingError', {
      providerName,
      error: error.message,
      originalResponse,
      context,
      timestamp: Date.now(),
    });
  }

  /**
   * Log provider method error with comprehensive context
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

    // Add method availability analysis
    errorData.methodAnalysis = this.analyzeMethodAvailability(
      providerName,
      methodName,
      context
    );

    this.logger.error('Provider method error', errorData);

    // Track provider errors for monitoring
    this.trackProviderError(providerName, errorData);

    // Integrate with existing monitoring systems
    this.integrateWithMonitoringSystems('provider_method', errorData);

    // Check for critical alert conditions
    this.checkCriticalErrorAlerts(providerName, errorData);

    // Emit event for real-time monitoring
    this.emit('providerMethodError', {
      providerName,
      methodName,
      error: error.message,
      context,
      timestamp: Date.now(),
    });
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

    // Integrate with existing monitoring systems
    this.integrateWithMonitoringSystems('provider_operation', errorData);

    // Check for alert conditions based on severity
    if (errorData.severity === 'critical' || errorData.severity === 'high') {
      this.checkProviderFailureAlerts(providerName, errorData);
    }

    // Emit event for real-time monitoring
    this.emit('providerOperationError', {
      providerName,
      operation,
      error: error.message,
      severity: errorData.severity,
      requestData,
      context,
      timestamp: Date.now(),
    });
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
        nodeVersion: process.version,
      },

      // Enhanced monitoring context
      monitoringContext: {
        errorPattern: this.identifyErrorPattern(error),
        isRetryable: this.isRetryableError(error),
        suggestedAction: this.suggestRecoveryAction(error, context.operation),
        relatedFailures: context.relatedFailures || 0,
      },
    };

    // Add stack trace if enabled
    if (this.config.includeStackTrace && error.stack) {
      errorData.stackTrace = error.stack;
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
      detectedFormat: null,
    };

    if (typeof response === 'string') {
      analysis.length = response.length;
      analysis.hasContent = response.trim().length > 0;
      analysis.structure =
        response.length > 100 ? 'long_string' : 'short_string';
      analysis.detectedFormat = this.detectStringFormat(response);
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
      analysis.detectedFormat = this.detectObjectFormat(response);
    }

    return analysis;
  }

  /**
   * Detect string format (JSON, plain text, etc.)
   * @private
   */
  detectStringFormat(str) {
    const trimmed = str.trim();

    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      try {
        JSON.parse(trimmed);
        return 'json_object';
      } catch {
        return 'json_like_string';
      }
    }

    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      try {
        JSON.parse(trimmed);
        return 'json_array';
      } catch {
        return 'array_like_string';
      }
    }

    return 'plain_text';
  }

  /**
   * Detect object format (API response, content object, etc.)
   * @private
   */
  detectObjectFormat(obj) {
    if (obj.choices && Array.isArray(obj.choices)) {
      return 'openai_chat_completion';
    }
    if (obj.content && typeof obj.content === 'string') {
      return 'content_object';
    }
    if (obj.message && obj.message.content) {
      return 'message_object';
    }
    if (obj.data) {
      return 'data_wrapper';
    }
    if (obj.output) {
      return 'output_object';
    }
    return 'unknown_object';
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
      parsingStrategy: context.parsingStrategy || 'default',
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
      providerVersion: context.providerVersion || null,
      configurationStatus: context.configurationStatus || 'unknown',
    };
  }

  /**
   * Analyze method availability
   * @private
   */
  analyzeMethodAvailability(providerName, methodName, context) {
    return {
      methodName,
      expectedMethods: context.expectedMethods || [],
      actualMethods: context.actualMethods || [],
      missingMethods: context.missingMethods || [],
      methodImplementationStatus:
        context.methodImplementationStatus || 'unknown',
      suggestedImplementation: this.suggestMethodImplementation(methodName),
    };
  }

  /**
   * Suggest method implementation
   * @private
   */
  suggestMethodImplementation(methodName) {
    const implementations = {
      getProviderHealth:
        'Implement health check method that returns provider status',
      generateDream:
        'Implement dream generation method with proper response handling',
      testConnection:
        'Implement connection test method for provider validation',
    };

    return (
      implementations[methodName] || `Implement missing method: ${methodName}`
    );
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
      operationComplexity: this.assessOperationComplexity(operation),
      failureFrequency: this.getOperationFailureFrequency(operation),
    };
  }

  /**
   * Assess operation complexity
   * @private
   */
  assessOperationComplexity(operation) {
    const complexOperations = ['generateDream', 'patchDream', 'enrichStyle'];
    const simpleOperations = ['testConnection', 'getProviderHealth'];

    if (complexOperations.includes(operation)) return 'high';
    if (simpleOperations.includes(operation)) return 'low';
    return 'medium';
  }

  /**
   * Get operation failure frequency
   * @private
   */
  getOperationFailureFrequency(operation) {
    const recentErrors = this.recentErrors.filter(
      (error) =>
        error.operation === operation && error.timestamp > Date.now() - 3600000 // Last hour
    );

    return {
      lastHour: recentErrors.length,
      averagePerHour: recentErrors.length, // Simplified calculation
      trend: recentErrors.length > 5 ? 'increasing' : 'stable',
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
      configuration: {
        hasApiKey: !!context.apiKey,
        model: context.model || null,
        endpoint: context.endpoint || null,
      },
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
        responseStructures: new Map(),
      });
    }

    const failures = this.errorTracking.parsingFailures.get(providerName);
    failures.count++;
    failures.lastFailure = Date.now();

    // Track error patterns
    const pattern = this.identifyErrorPattern({
      message: errorData.errorMessage,
    });
    failures.patterns.set(pattern, (failures.patterns.get(pattern) || 0) + 1);

    // Track response structures
    if (errorData.responseAnalysis) {
      const structureKey =
        errorData.responseAnalysis.detectedFormat || 'unknown';
      failures.responseStructures.set(
        structureKey,
        (failures.responseStructures.get(structureKey) || 0) + 1
      );
    }

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
    if (!this.errorTracking.providerErrors.has(providerName)) {
      this.errorTracking.providerErrors.set(providerName, {
        count: 0,
        firstError: Date.now(),
        lastError: null,
        errorTypes: new Map(),
        severityCount: new Map(),
        operations: new Map(),
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

    // Track operations
    if (errorData.operation) {
      errors.operations.set(
        errorData.operation,
        (errors.operations.get(errorData.operation) || 0) + 1
      );
    }

    // Add to recent errors for analysis
    this.addToRecentErrors(errorData);

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
  trackResponseStructure(providerName, responseAnalysis) {
    if (!this.errorTracking.responseStructures.has(providerName)) {
      this.errorTracking.responseStructures.set(providerName, new Map());
    }

    const structures = this.errorTracking.responseStructures.get(providerName);
    const structureKey = responseAnalysis.detectedFormat || 'unknown';
    structures.set(structureKey, (structures.get(structureKey) || 0) + 1);
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
   * Integrate with existing monitoring systems
   * @private
   */
  integrateWithMonitoringSystems(errorType, errorData) {
    // Log to structured logger if available
    if (this.structuredLogger) {
      this.structuredLogger.error(
        `Enhanced error logging: ${errorType}`,
        null,
        {
          errorType,
          errorData,
          timestamp: new Date().toISOString(),
        }
      );
    }

    // Send to metrics collector if available
    if (this.metricsCollector) {
      this.metricsCollector.recordCustomMetric(`error_${errorType}`, {
        count: 1,
        severity: errorData.severity,
        provider: errorData.providerName,
        timestamp: Date.now(),
      });
    }

    // Log monitoring integration event
    this.logger.info('Monitoring integration', {
      type: 'monitoring',
      errorType,
      provider: errorData.providerName,
      severity: errorData.severity,
      integratedSystems: {
        structuredLogger: !!this.structuredLogger,
        metricsCollector: !!this.metricsCollector,
        alertingSystem: !!this.alertingSystem,
      },
      timestamp: new Date().toISOString(),
    });
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
   * Send alert with integration to existing alerting systems
   * @private
   */
  sendAlert(alertType, alertData) {
    const alertKey = `${alertType}_${alertData.providerName}`;
    const now = Date.now();
    const lastSent = this.alertSuppressionMap.get(alertKey);
    const suppressionWindow = 300000; // 5 minutes

    if (lastSent && now - lastSent < suppressionWindow) {
      return; // Suppress duplicate alerts
    }

    this.alertSuppressionMap.set(alertKey, now);

    // Track alert history
    if (!this.errorTracking.alertHistory.has(alertType)) {
      this.errorTracking.alertHistory.set(alertType, []);
    }
    this.errorTracking.alertHistory.get(alertType).push(now);

    // Send to alerting system if available
    if (this.alertingSystem) {
      this.alertingSystem.sendAlert(alertType, alertData);
    }

    // Log alert with enhanced context
    this.logger.error(`ALERT: ${alertType}`, {
      alertType,
      alertData,
      alertKey,
      suppressionWindow,
      timestamp: new Date().toISOString(),
      monitoringIntegration: {
        alertingSystemAvailable: !!this.alertingSystem,
        structuredLoggerAvailable: !!this.structuredLogger,
        metricsCollectorAvailable: !!this.metricsCollector,
      },
    });

    // Console alert for immediate visibility
    console.error(`🚨 ENHANCED ALERT [${alertType}]:`, alertData);

    // Emit alert event for real-time monitoring
    this.emit('alert', {
      type: alertType,
      data: alertData,
      timestamp: now,
    });
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

    console.log('Enhanced error logging monitoring integration started');
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
      this.logger.info('Enhanced error monitoring report', {
        type: 'monitoring',
        report,
        timestamp: new Date().toISOString(),
      });

      // Emit monitoring report event
      this.emit('monitoringReport', report);
    } catch (error) {
      console.error('Error in enhanced monitoring tasks:', error.message);
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

    // Clean up recent errors
    this.recentErrors = this.recentErrors.filter(
      (error) => error.timestamp > oneHourAgo
    );
  }

  /**
   * Generate comprehensive monitoring report
   */
  generateMonitoringReport() {
    const now = Date.now();
    const oneHourAgo = now - 3600000;

    // Recent error counts by type
    const recentErrorCounts = new Map();
    for (const [errorType, timestamps] of this.errorTimestamps.entries()) {
      const recentCount = timestamps.filter((ts) => ts > oneHourAgo).length;
      if (recentCount > 0) {
        recentErrorCounts.set(errorType, recentCount);
      }
    }

    // Provider error summary with enhanced details
    const providerErrorSummary = new Map();
    for (const [
      providerName,
      errorData,
    ] of this.errorTracking.providerErrors.entries()) {
      if (errorData.lastError > oneHourAgo) {
        providerErrorSummary.set(providerName, {
          totalErrors: errorData.count,
          lastError: new Date(errorData.lastError).toISOString(),
          errorTypes: Object.fromEntries(errorData.errorTypes),
          severities: Object.fromEntries(errorData.severityCount),
          operations: Object.fromEntries(errorData.operations),
        });
      }
    }

    // Parsing failure summary with response structure analysis
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
          responseStructures: Object.fromEntries(
            failureData.responseStructures
          ),
        });
      }
    }

    // Response structure analysis
    const responseStructureAnalysis = new Map();
    for (const [
      providerName,
      structures,
    ] of this.errorTracking.responseStructures.entries()) {
      responseStructureAnalysis.set(
        providerName,
        Object.fromEntries(structures)
      );
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
      responseStructureAnalysis: Object.fromEntries(responseStructureAnalysis),
      alertsSent: this.getRecentAlertCount(3600000),
      thresholds: this.config.alertThresholds,
      integrationStatus: {
        enhancedErrorLogger: !!this.enhancedErrorLogger,
        structuredLogger: !!this.structuredLogger,
        metricsCollector: !!this.metricsCollector,
        alertingSystem: !!this.alertingSystem,
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
   * Export comprehensive error data for external systems
   */
  exportErrorData(options = {}) {
    const timeRange = options.timeRange || 3600000; // 1 hour default
    const cutoffTime = Date.now() - timeRange;

    return {
      timestamp: new Date().toISOString(),
      timeRange,
      configuration: this.config,
      errorTracking: {
        recentErrors: this.recentErrors.filter(
          (error) => error.timestamp > cutoffTime
        ),
        providerErrors: Object.fromEntries(
          Array.from(this.errorTracking.providerErrors.entries()).map(
            ([name, data]) => [
              name,
              {
                ...data,
                errorTypes: Object.fromEntries(data.errorTypes),
                severityCount: Object.fromEntries(data.severityCount),
                operations: Object.fromEntries(data.operations),
              },
            ]
          )
        ),
        parsingFailures: Object.fromEntries(
          Array.from(this.errorTracking.parsingFailures.entries()).map(
            ([name, data]) => [
              name,
              {
                ...data,
                patterns: Object.fromEntries(data.patterns),
                responseStructures: Object.fromEntries(data.responseStructures),
              },
            ]
          )
        ),
        responseStructures: Object.fromEntries(
          Array.from(this.errorTracking.responseStructures.entries()).map(
            ([name, structures]) => [name, Object.fromEntries(structures)]
          )
        ),
      },
      alertHistory: Object.fromEntries(
        Array.from(this.errorTracking.alertHistory.entries()).map(
          ([type, timestamps]) => [
            type,
            timestamps.filter((ts) => ts > cutoffTime),
          ]
        )
      ),
      integrationStatus: {
        enhancedErrorLogger: !!this.enhancedErrorLogger,
        structuredLogger: !!this.structuredLogger,
        metricsCollector: !!this.metricsCollector,
        alertingSystem: !!this.alertingSystem,
      },
    };
  }

  /**
   * Cleanup resources and stop monitoring
   */
  destroy() {
    // Stop monitoring integration
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    // Clear tracking data
    this.errorTracking.recentErrors.clear();
    this.errorTracking.providerErrors.clear();
    this.errorTracking.parsingFailures.clear();
    this.errorTracking.alertHistory.clear();
    this.errorTracking.suppressedAlerts.clear();
    this.errorTracking.errorPatterns.clear();
    this.errorTracking.responseStructures.clear();

    this.errorTimestamps.clear();
    this.alertSuppressionMap.clear();
    this.recentErrors.length = 0;

    // Close logger
    if (this.logger) {
      this.logger.close();
    }

    console.log('EnhancedErrorLoggingSystem destroyed');
  }
}

module.exports = EnhancedErrorLoggingSystem;
