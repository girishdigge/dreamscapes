// utils/EnhancedLoggingIntegrationLayer.js
// Comprehensive logging integration layer for enhanced error tracking and monitoring

const EventEmitter = require('events');

/**
 * Enhanced Logging Integration Layer - Centralized logging coordination
 * Integrates all logging components for comprehensive error tracking and monitoring
 */
class EnhancedLoggingIntegrationLayer extends EventEmitter {
  constructor(config = {}) {
    super();

    this.config = {
      // Integration settings
      enableStructuredLogging: config.enableStructuredLogging !== false,
      enableErrorClassification: config.enableErrorClassification !== false,
      enableMonitoringIntegration: config.enableMonitoringIntegration !== false,
      enableAlertingIntegration: config.enableAlertingIntegration !== false,

      // Logging levels and filtering
      logLevel: config.logLevel || 'info',
      errorLogLevel: config.errorLogLevel || 'error',
      enableDebugLogging: config.enableDebugLogging || false,

      // Provider context tracking
      enableProviderContextTracking:
        config.enableProviderContextTracking !== false,
      enableResponseStructureAnalysis:
        config.enableResponseStructureAnalysis !== false,
      enablePerformanceTracking: config.enablePerformanceTracking !== false,

      // Alert and monitoring thresholds
      criticalErrorThreshold: config.criticalErrorThreshold || 5,
      parsingFailureThreshold: config.parsingFailureThreshold || 10,
      healthFailureThreshold: config.healthFailureThreshold || 3,

      ...config,
    };

    // Logging components
    this.enhancedErrorLogger = null;
    this.structuredLogger = null;
    this.errorMonitoringIntegration = null;
    this.logger = null; // Basic logger fallback

    // Tracking state
    this.requestTracking = new Map(); // request_id -> tracking_data
    this.providerContexts = new Map(); // provider_name -> context_data
    this.errorPatterns = new Map(); // error_pattern -> occurrence_data
    this.performanceMetrics = new Map(); // operation_type -> performance_data

    // Integration status
    this.integrationStatus = {
      enhancedErrorLogger: false,
      structuredLogger: false,
      errorMonitoringIntegration: false,
      basicLogger: false,
    };

    console.log('EnhancedLoggingIntegrationLayer initialized with config:', {
      enableStructuredLogging: this.config.enableStructuredLogging,
      enableErrorClassification: this.config.enableErrorClassification,
      enableMonitoringIntegration: this.config.enableMonitoringIntegration,
    });
  }

  /**
   * Initialize logging integration with all components
   * @param {Object} components - Logging components
   */
  async initialize(components = {}) {
    try {
      // Initialize Enhanced Error Logger
      if (components.enhancedErrorLogger) {
        this.enhancedErrorLogger = components.enhancedErrorLogger;
        this.integrationStatus.enhancedErrorLogger = true;
        console.log('Enhanced Error Logger integrated');
      } else if (this.config.enableErrorClassification) {
        // Create new instance if not provided
        const EnhancedErrorLogger = require('./EnhancedErrorLogger');
        this.enhancedErrorLogger = new EnhancedErrorLogger({
          enableMonitoringIntegration: this.config.enableMonitoringIntegration,
          alertThresholds: {
            criticalErrorsPerMinute: this.config.criticalErrorThreshold,
            parsingFailuresPerMinute: this.config.parsingFailureThreshold,
            providerFailuresPerMinute: this.config.healthFailureThreshold,
          },
        });
        this.integrationStatus.enhancedErrorLogger = true;
        console.log('Enhanced Error Logger created and integrated');
      }

      // Initialize Structured Logger
      if (components.structuredLogger) {
        this.structuredLogger = components.structuredLogger;
        this.integrationStatus.structuredLogger = true;
        console.log('Structured Logger integrated');
      } else if (this.config.enableStructuredLogging) {
        const StructuredLogger = require('../monitoring/StructuredLogger');
        this.structuredLogger = new StructuredLogger({
          level: this.config.logLevel,
          enablePerformanceLogging: this.config.enablePerformanceTracking,
          enableRequestLogging: true,
          enableErrorDetails: true,
          enableErrorContext: true,
        });
        this.integrationStatus.structuredLogger = true;
        console.log('Structured Logger created and integrated');
      }

      // Initialize Error Monitoring Integration
      if (components.errorMonitoringIntegration) {
        this.errorMonitoringIntegration = components.errorMonitoringIntegration;
        this.integrationStatus.errorMonitoringIntegration = true;
        console.log('Error Monitoring Integration integrated');
      } else if (this.config.enableMonitoringIntegration) {
        const ErrorMonitoringIntegration = require('../monitoring/ErrorMonitoringIntegration');
        this.errorMonitoringIntegration = new ErrorMonitoringIntegration({
          enableRealTimeTracking: true,
          enableAlertingIntegration: this.config.enableAlertingIntegration,
          criticalErrorThreshold: this.config.criticalErrorThreshold,
          parsingFailureThreshold: this.config.parsingFailureThreshold,
          providerFailureThreshold: this.config.healthFailureThreshold,
        });

        // Initialize with existing components
        await this.errorMonitoringIntegration.initialize({
          enhancedErrorLogger: this.enhancedErrorLogger,
          structuredLogger: this.structuredLogger,
        });

        this.integrationStatus.errorMonitoringIntegration = true;
        console.log('Error Monitoring Integration created and integrated');
      }

      // Initialize basic logger fallback
      if (components.logger) {
        this.logger = components.logger;
        this.integrationStatus.basicLogger = true;
        console.log('Basic Logger integrated');
      } else {
        const { logger } = require('./logger');
        this.logger = logger;
        this.integrationStatus.basicLogger = true;
        console.log('Basic Logger fallback integrated');
      }

      // Set up event listeners for cross-component communication
      this.setupEventListeners();

      console.log(
        'Enhanced Logging Integration Layer initialized successfully'
      );
      this.emit('initialized', this.integrationStatus);
    } catch (error) {
      console.error(
        'Failed to initialize Enhanced Logging Integration Layer:',
        error.message
      );
      throw error;
    }
  }

  /**
   * Set up event listeners for cross-component communication
   * @private
   */
  setupEventListeners() {
    // Listen to error monitoring events
    if (this.errorMonitoringIntegration) {
      this.errorMonitoringIntegration.on('responseParsingError', (data) => {
        this.handleResponseParsingError(data);
      });

      this.errorMonitoringIntegration.on('providerMethodError', (data) => {
        this.handleProviderMethodError(data);
      });

      this.errorMonitoringIntegration.on('providerOperationError', (data) => {
        this.handleProviderOperationError(data);
      });

      this.errorMonitoringIntegration.on('alert', (data) => {
        this.handleAlert(data);
      });
    }
  }

  /**
   * Log response parsing error with comprehensive integration
   * @param {Error} error - The parsing error
   * @param {string} providerName - Provider name
   * @param {any} originalResponse - Original response
   * @param {Object} context - Additional context
   */
  logResponseParsingError(error, providerName, originalResponse, context = {}) {
    const requestId = context.requestId || this.generateRequestId();
    const timestamp = Date.now();

    // Enhanced context with request tracking
    const enhancedContext = {
      ...context,
      requestId,
      timestamp,
      integrationLayer: true,
      loggingComponents: this.getActiveComponents(),
    };

    // Track request for correlation
    this.trackRequest(requestId, {
      type: 'response_parsing_error',
      providerName,
      timestamp,
      error: error.message,
      context: enhancedContext,
    });

    // Log with Enhanced Error Logger
    if (this.enhancedErrorLogger) {
      this.enhancedErrorLogger.logResponseParsingError(
        error,
        providerName,
        originalResponse,
        enhancedContext
      );
    }

    // Log with Error Monitoring Integration
    if (this.errorMonitoringIntegration) {
      this.errorMonitoringIntegration.logResponseParsingError(
        error,
        providerName,
        originalResponse,
        enhancedContext
      );
    }

    // Log with Structured Logger
    if (this.structuredLogger) {
      this.structuredLogger.error(
        'Response parsing failed',
        error,
        {
          providerName,
          errorType: 'response_parsing',
          responseStructure: this.analyzeResponseStructure(originalResponse),
          parsingAttempts: enhancedContext.parsingAttempts || 1,
          requestId,
        },
        enhancedContext
      );
    }

    // Fallback to basic logger
    if (this.logger) {
      this.logger.error('Response parsing error', {
        providerName,
        error: error.message,
        requestId,
        responseType: typeof originalResponse,
        context: enhancedContext,
      });
    }

    // Track error patterns
    this.trackErrorPattern('response_parsing', {
      providerName,
      errorMessage: error.message,
      responseType: typeof originalResponse,
      timestamp,
    });

    // Update provider context
    this.updateProviderContext(providerName, {
      lastParsingError: timestamp,
      parsingErrorCount:
        (this.getProviderContext(providerName)?.parsingErrorCount || 0) + 1,
      lastErrorMessage: error.message,
    });

    // Emit event for other systems
    this.emit('responseParsingError', {
      requestId,
      providerName,
      error: error.message,
      originalResponse,
      context: enhancedContext,
      timestamp,
    });
  }

  /**
   * Log provider method error with comprehensive integration
   * @param {Error} error - The method error
   * @param {string} providerName - Provider name
   * @param {string} methodName - Missing method name
   * @param {Object} context - Additional context
   */
  logProviderMethodError(error, providerName, methodName, context = {}) {
    const requestId = context.requestId || this.generateRequestId();
    const timestamp = Date.now();

    // Enhanced context
    const enhancedContext = {
      ...context,
      requestId,
      timestamp,
      integrationLayer: true,
      severity: 'critical', // Method errors are always critical
      loggingComponents: this.getActiveComponents(),
    };

    // Track request
    this.trackRequest(requestId, {
      type: 'provider_method_error',
      providerName,
      methodName,
      timestamp,
      error: error.message,
      context: enhancedContext,
    });

    // Log with Enhanced Error Logger
    if (this.enhancedErrorLogger) {
      this.enhancedErrorLogger.logProviderMethodError(
        error,
        providerName,
        methodName,
        enhancedContext
      );
    }

    // Log with Error Monitoring Integration
    if (this.errorMonitoringIntegration) {
      this.errorMonitoringIntegration.logProviderMethodError(
        error,
        providerName,
        methodName,
        enhancedContext
      );
    }

    // Log with Structured Logger
    if (this.structuredLogger) {
      this.structuredLogger.error(
        'Provider method error',
        error,
        {
          providerName,
          methodName,
          errorType: 'provider_method',
          severity: 'critical',
          requestId,
        },
        enhancedContext
      );
    }

    // Fallback to basic logger
    if (this.logger) {
      this.logger.error('Provider method error', {
        providerName,
        methodName,
        error: error.message,
        requestId,
        severity: 'critical',
        context: enhancedContext,
      });
    }

    // Track error patterns
    this.trackErrorPattern('provider_method', {
      providerName,
      methodName,
      errorMessage: error.message,
      timestamp,
    });

    // Update provider context with critical error
    this.updateProviderContext(providerName, {
      lastCriticalError: timestamp,
      criticalErrorCount:
        (this.getProviderContext(providerName)?.criticalErrorCount || 0) + 1,
      lastErrorMessage: error.message,
      missingMethods: [
        ...(this.getProviderContext(providerName)?.missingMethods || []),
        methodName,
      ],
    });

    // Emit critical error event
    this.emit('providerMethodError', {
      requestId,
      providerName,
      methodName,
      error: error.message,
      context: enhancedContext,
      timestamp,
      severity: 'critical',
    });
  }

  /**
   * Log provider operation error with comprehensive integration
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
    const requestId = context.requestId || this.generateRequestId();
    const timestamp = Date.now();
    const severity = this.classifyErrorSeverity(error, providerName, operation);

    // Enhanced context
    const enhancedContext = {
      ...context,
      requestId,
      timestamp,
      severity,
      integrationLayer: true,
      loggingComponents: this.getActiveComponents(),
    };

    // Track request
    this.trackRequest(requestId, {
      type: 'provider_operation_error',
      providerName,
      operation,
      timestamp,
      error: error.message,
      severity,
      context: enhancedContext,
    });

    // Log with Enhanced Error Logger
    if (this.enhancedErrorLogger) {
      this.enhancedErrorLogger.logProviderOperationError(
        error,
        providerName,
        operation,
        requestData,
        enhancedContext
      );
    }

    // Log with Error Monitoring Integration
    if (this.errorMonitoringIntegration) {
      this.errorMonitoringIntegration.logProviderOperationError(
        error,
        providerName,
        operation,
        requestData,
        enhancedContext
      );
    }

    // Log with Structured Logger
    if (this.structuredLogger) {
      this.structuredLogger.error(
        'Provider operation failed',
        error,
        {
          providerName,
          operation,
          errorType: 'provider_operation',
          severity,
          requestData: this.sanitizeRequestData(requestData),
          requestId,
        },
        enhancedContext
      );
    }

    // Fallback to basic logger
    if (this.logger) {
      this.logger.error('Provider operation error', {
        providerName,
        operation,
        error: error.message,
        severity,
        requestId,
        context: enhancedContext,
      });
    }

    // Track error patterns
    this.trackErrorPattern('provider_operation', {
      providerName,
      operation,
      errorMessage: error.message,
      severity,
      timestamp,
    });

    // Update provider context
    this.updateProviderContext(providerName, {
      lastOperationError: timestamp,
      operationErrorCount:
        (this.getProviderContext(providerName)?.operationErrorCount || 0) + 1,
      lastErrorMessage: error.message,
      failedOperations: [
        ...(this.getProviderContext(providerName)?.failedOperations || []),
        operation,
      ],
    });

    // Track performance impact
    if (context.responseTime) {
      this.trackPerformanceMetric(operation, {
        success: false,
        responseTime: context.responseTime,
        providerName,
        error: error.message,
        timestamp,
      });
    }

    // Emit event
    this.emit('providerOperationError', {
      requestId,
      providerName,
      operation,
      error: error.message,
      severity,
      requestData,
      context: enhancedContext,
      timestamp,
    });
  }

  /**
   * Log provider health error with comprehensive integration
   * @param {Error} error - The health error
   * @param {string} providerName - Provider name
   * @param {Object} healthContext - Health check context
   */
  logProviderHealthError(error, providerName, healthContext = {}) {
    const requestId = this.generateRequestId();
    const timestamp = Date.now();

    // Enhanced context
    const enhancedContext = {
      ...healthContext,
      requestId,
      timestamp,
      integrationLayer: true,
      errorType: 'provider_health',
      loggingComponents: this.getActiveComponents(),
    };

    // Track request
    this.trackRequest(requestId, {
      type: 'provider_health_error',
      providerName,
      timestamp,
      error: error.message,
      context: enhancedContext,
    });

    // Log with Enhanced Error Logger
    if (this.enhancedErrorLogger) {
      this.enhancedErrorLogger.logProviderHealthError(
        error,
        providerName,
        enhancedContext
      );
    }

    // Log with Structured Logger
    if (this.structuredLogger) {
      this.structuredLogger.error(
        'Provider health check failed',
        error,
        {
          providerName,
          errorType: 'provider_health',
          consecutiveFailures: healthContext.consecutiveFailures || 0,
          lastSuccessfulCheck: healthContext.lastSuccessfulCheck,
          requestId,
        },
        enhancedContext
      );
    }

    // Fallback to basic logger
    if (this.logger) {
      this.logger.error('Provider health error', {
        providerName,
        error: error.message,
        consecutiveFailures: healthContext.consecutiveFailures || 0,
        requestId,
        context: enhancedContext,
      });
    }

    // Track error patterns
    this.trackErrorPattern('provider_health', {
      providerName,
      errorMessage: error.message,
      consecutiveFailures: healthContext.consecutiveFailures || 0,
      timestamp,
    });

    // Update provider context
    this.updateProviderContext(providerName, {
      lastHealthError: timestamp,
      healthErrorCount:
        (this.getProviderContext(providerName)?.healthErrorCount || 0) + 1,
      consecutiveHealthFailures: healthContext.consecutiveFailures || 0,
      lastErrorMessage: error.message,
    });

    // Emit event
    this.emit('providerHealthError', {
      requestId,
      providerName,
      error: error.message,
      healthContext,
      context: enhancedContext,
      timestamp,
    });
  }

  /**
   * Handle response parsing error event
   * @private
   */
  handleResponseParsingError(data) {
    // Additional processing for response parsing errors
    console.log(
      `🔍 Response parsing error detected: ${data.providerName} - ${data.error}`
    );

    // Update error patterns for analysis
    this.trackErrorPattern('response_parsing_event', {
      providerName: data.providerName,
      timestamp: data.timestamp,
    });
  }

  /**
   * Handle provider method error event
   * @private
   */
  handleProviderMethodError(data) {
    // Additional processing for method errors
    console.error(
      `🚨 Critical provider method error: ${data.providerName}.${data.methodName} - ${data.error}`
    );

    // Track critical error patterns
    this.trackErrorPattern('provider_method_event', {
      providerName: data.providerName,
      methodName: data.methodName,
      timestamp: data.timestamp,
    });
  }

  /**
   * Handle provider operation error event
   * @private
   */
  handleProviderOperationError(data) {
    // Additional processing for operation errors
    console.log(
      `⚠️ Provider operation error: ${data.providerName}.${data.operation} - ${data.error}`
    );

    // Track operation error patterns
    this.trackErrorPattern('provider_operation_event', {
      providerName: data.providerName,
      operation: data.operation,
      severity: data.severity,
      timestamp: data.timestamp,
    });
  }

  /**
   * Handle alert event
   * @private
   */
  handleAlert(data) {
    // Additional processing for alerts
    console.error(`🚨 ALERT: ${data.type} - ${JSON.stringify(data.data)}`);

    // Log alert with all available loggers
    if (this.structuredLogger) {
      this.structuredLogger.error('Alert triggered', null, {
        alertType: data.type,
        alertData: data.data,
        timestamp: data.timestamp,
      });
    }

    if (this.logger) {
      this.logger.error('Alert triggered', {
        alertType: data.type,
        alertData: data.data,
        timestamp: data.timestamp,
      });
    }
  }

  /**
   * Track request for correlation
   * @private
   */
  trackRequest(requestId, data) {
    this.requestTracking.set(requestId, {
      ...data,
      tracked: Date.now(),
    });

    // Clean up old requests (keep last 1000)
    if (this.requestTracking.size > 1000) {
      const oldestKey = this.requestTracking.keys().next().value;
      this.requestTracking.delete(oldestKey);
    }
  }

  /**
   * Track error patterns for analysis
   * @private
   */
  trackErrorPattern(pattern, data) {
    if (!this.errorPatterns.has(pattern)) {
      this.errorPatterns.set(pattern, {
        count: 0,
        firstOccurrence: Date.now(),
        lastOccurrence: null,
        occurrences: [],
      });
    }

    const patternData = this.errorPatterns.get(pattern);
    patternData.count++;
    patternData.lastOccurrence = Date.now();
    patternData.occurrences.push(data);

    // Keep only recent occurrences (last 100)
    if (patternData.occurrences.length > 100) {
      patternData.occurrences = patternData.occurrences.slice(-100);
    }
  }

  /**
   * Track performance metrics
   * @private
   */
  trackPerformanceMetric(operation, data) {
    if (!this.performanceMetrics.has(operation)) {
      this.performanceMetrics.set(operation, {
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        totalResponseTime: 0,
        averageResponseTime: 0,
        metrics: [],
      });
    }

    const metrics = this.performanceMetrics.get(operation);
    metrics.totalRequests++;

    if (data.success) {
      metrics.successfulRequests++;
    } else {
      metrics.failedRequests++;
    }

    if (data.responseTime) {
      metrics.totalResponseTime += data.responseTime;
      metrics.averageResponseTime =
        metrics.totalResponseTime / metrics.totalRequests;
    }

    metrics.metrics.push(data);

    // Keep only recent metrics (last 1000)
    if (metrics.metrics.length > 1000) {
      metrics.metrics = metrics.metrics.slice(-1000);
    }
  }

  /**
   * Update provider context
   * @private
   */
  updateProviderContext(providerName, updates) {
    if (!this.providerContexts.has(providerName)) {
      this.providerContexts.set(providerName, {
        firstSeen: Date.now(),
        lastUpdated: null,
      });
    }

    const context = this.providerContexts.get(providerName);
    Object.assign(context, updates, { lastUpdated: Date.now() });
  }

  /**
   * Get provider context
   * @private
   */
  getProviderContext(providerName) {
    return this.providerContexts.get(providerName) || null;
  }

  /**
   * Get active logging components
   * @private
   */
  getActiveComponents() {
    return Object.entries(this.integrationStatus)
      .filter(([, active]) => active)
      .map(([component]) => component);
  }

  /**
   * Generate unique request ID
   * @private
   */
  generateRequestId() {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Analyze response structure
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
   * Get comprehensive logging statistics
   */
  getLoggingStatistics(timeWindowMs = 3600000) {
    const cutoff = Date.now() - timeWindowMs;

    // Recent requests
    const recentRequests = Array.from(this.requestTracking.values()).filter(
      (req) => req.timestamp > cutoff
    );

    // Error patterns
    const recentErrorPatterns = new Map();
    for (const [pattern, data] of this.errorPatterns.entries()) {
      const recentOccurrences = data.occurrences.filter(
        (occ) => occ.timestamp > cutoff
      );
      if (recentOccurrences.length > 0) {
        recentErrorPatterns.set(pattern, {
          count: recentOccurrences.length,
          totalCount: data.count,
          firstOccurrence: data.firstOccurrence,
          lastOccurrence: data.lastOccurrence,
          recentOccurrences,
        });
      }
    }

    // Provider contexts
    const providerSummary = new Map();
    for (const [providerName, context] of this.providerContexts.entries()) {
      if (context.lastUpdated > cutoff) {
        providerSummary.set(providerName, {
          ...context,
          recentActivity: true,
        });
      }
    }

    return {
      timestamp: new Date().toISOString(),
      timeWindow: timeWindowMs,
      integrationStatus: this.integrationStatus,
      summary: {
        totalRecentRequests: recentRequests.length,
        totalErrorPatterns: recentErrorPatterns.size,
        activeProviders: providerSummary.size,
        totalTrackedRequests: this.requestTracking.size,
      },
      recentRequests: recentRequests.slice(-50), // Last 50 requests
      errorPatterns: Object.fromEntries(recentErrorPatterns),
      providerContexts: Object.fromEntries(providerSummary),
      performanceMetrics: Object.fromEntries(this.performanceMetrics),
    };
  }

  /**
   * Export logging data for analysis
   */
  exportLoggingData(options = {}) {
    const timeRange = options.timeRange || 3600000; // 1 hour
    const includeRawData = options.includeRawData || false;

    const data = {
      timestamp: new Date().toISOString(),
      timeRange,
      integrationStatus: this.integrationStatus,
      statistics: this.getLoggingStatistics(timeRange),
    };

    if (includeRawData) {
      data.rawData = {
        requestTracking: Object.fromEntries(this.requestTracking),
        errorPatterns: Object.fromEntries(this.errorPatterns),
        providerContexts: Object.fromEntries(this.providerContexts),
        performanceMetrics: Object.fromEntries(this.performanceMetrics),
      };
    }

    return data;
  }

  /**
   * Cleanup resources
   */
  destroy() {
    // Clear tracking data
    this.requestTracking.clear();
    this.providerContexts.clear();
    this.errorPatterns.clear();
    this.performanceMetrics.clear();

    // Remove event listeners
    this.removeAllListeners();

    console.log('EnhancedLoggingIntegrationLayer destroyed');
  }
}

module.exports = EnhancedLoggingIntegrationLayer;
