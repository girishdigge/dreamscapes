// monitoring/ErrorMonitoringIntegration.js
// Integration system for error tracking and alerting with existing monitoring infrastructure

const EventEmitter = require('events');

/**
 * Error Monitoring Integration - Bridges error logging with monitoring systems
 * Provides real-time error tracking, alerting, and integration with existing monitoring
 */
class ErrorMonitoringIntegration extends EventEmitter {
  constructor(config = {}) {
    super();

    this.config = {
      // Integration settings
      enableRealTimeTracking: config.enableRealTimeTracking !== false,
      enableAlertingIntegration: config.enableAlertingIntegration !== false,
      enableMetricsIntegration: config.enableMetricsIntegration !== false,

      // Alert thresholds
      criticalErrorThreshold: config.criticalErrorThreshold || 5, // per minute
      parsingFailureThreshold: config.parsingFailureThreshold || 10, // per minute
      providerFailureThreshold: config.providerFailureThreshold || 15, // per minute

      // Monitoring intervals
      trackingInterval: config.trackingInterval || 30000, // 30 seconds
      reportingInterval: config.reportingInterval || 300000, // 5 minutes

      // Alert suppression
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
    };

    // Integration components
    this.enhancedErrorLogger = null;
    this.metricsCollector = null;
    this.alertingSystem = null;
    this.healthMonitor = null;
    this.structuredLogger = null;

    // Monitoring intervals
    this.trackingInterval = null;
    this.reportingInterval = null;

    console.log('ErrorMonitoringIntegration initialized with config:', {
      enableRealTimeTracking: this.config.enableRealTimeTracking,
      enableAlertingIntegration: this.config.enableAlertingIntegration,
      enableMetricsIntegration: this.config.enableMetricsIntegration,
    });
  }

  /**
   * Initialize integration with monitoring components
   * @param {Object} components - Monitoring components
   */
  initialize(components = {}) {
    try {
      // Initialize Enhanced Error Logger
      if (components.enhancedErrorLogger) {
        this.enhancedErrorLogger = components.enhancedErrorLogger;
        console.log('Enhanced Error Logger integrated');
      } else {
        // Create new instance if not provided
        const EnhancedErrorLogger = require('../utils/EnhancedErrorLogger');
        this.enhancedErrorLogger = new EnhancedErrorLogger({
          enableMonitoringIntegration: true,
          alertThresholds: {
            criticalErrorsPerMinute: this.config.criticalErrorThreshold,
            parsingFailuresPerMinute: this.config.parsingFailureThreshold,
            providerFailuresPerMinute: this.config.providerFailureThreshold,
          },
        });
        console.log('Enhanced Error Logger created and integrated');
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

      // Initialize Health Monitor
      if (components.healthMonitor) {
        this.healthMonitor = components.healthMonitor;
        console.log('Health Monitor integrated');
      }

      // Initialize Structured Logger
      if (components.structuredLogger) {
        this.structuredLogger = components.structuredLogger;
        console.log('Structured Logger integrated');
      }

      // Start monitoring if enabled
      if (this.config.enableRealTimeTracking) {
        this.startRealTimeTracking();
      }

      console.log('Error monitoring integration initialized successfully');
    } catch (error) {
      console.error(
        'Failed to initialize error monitoring integration:',
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

    console.log('Real-time error tracking started', {
      trackingInterval: this.config.trackingInterval,
      reportingInterval: this.config.reportingInterval,
    });
  }

  /**
   * Stop real-time error tracking
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
   * Log response parsing error with monitoring integration
   * @param {Error} error - The parsing error
   * @param {string} providerName - Provider name
   * @param {any} originalResponse - Original response
   * @param {Object} context - Additional context
   */
  logResponseParsingError(error, providerName, originalResponse, context = {}) {
    // Log with enhanced error logger
    if (this.enhancedErrorLogger) {
      this.enhancedErrorLogger.logResponseParsingError(
        error,
        providerName,
        originalResponse,
        context
      );
    }

    // Track for real-time monitoring
    this.trackError('response_parsing', {
      providerName,
      error: error.message,
      severity: 'high',
      timestamp: Date.now(),
      context,
    });

    // Integrate with metrics collector
    if (this.metricsCollector && context.requestId) {
      this.metricsCollector.recordRequestEnd(context.requestId, {
        success: false,
        error: error.message,
        errorType: 'response_parsing',
      });
    }

    // Log with structured logger
    if (this.structuredLogger) {
      this.structuredLogger.error('Response parsing failed', error, {
        providerName,
        errorType: 'response_parsing',
        responseStructure: this.analyzeResponseStructure(originalResponse),
        context,
      });
    }

    // Check for alert conditions
    this.checkParsingFailureAlerts(providerName, error);

    // Emit event for other systems
    this.emit('responseParsingError', {
      providerName,
      error: error.message,
      originalResponse,
      context,
      timestamp: Date.now(),
    });
  }

  /**
   * Log provider method error with monitoring integration
   * @param {Error} error - The method error
   * @param {string} providerName - Provider name
   * @param {string} methodName - Missing method name
   * @param {Object} context - Additional context
   */
  logProviderMethodError(error, providerName, methodName, context = {}) {
    // Log with enhanced error logger
    if (this.enhancedErrorLogger) {
      this.enhancedErrorLogger.logProviderMethodError(
        error,
        providerName,
        methodName,
        context
      );
    }

    // Track for real-time monitoring
    this.trackError('provider_method', {
      providerName,
      methodName,
      error: error.message,
      severity: 'critical',
      timestamp: Date.now(),
      context,
    });

    // Log with structured logger
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

    // Emit event for other systems
    this.emit('providerMethodError', {
      providerName,
      methodName,
      error: error.message,
      context,
      timestamp: Date.now(),
    });
  }

  /**
   * Log provider operation error with monitoring integration
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
    // Classify error severity
    const severity = this.classifyErrorSeverity(error, providerName, operation);

    // Log with enhanced error logger
    if (this.enhancedErrorLogger) {
      this.enhancedErrorLogger.logProviderOperationError(
        error,
        providerName,
        operation,
        requestData,
        {
          ...context,
          severity,
        }
      );
    }

    // Track for real-time monitoring
    this.trackError('provider_operation', {
      providerName,
      operation,
      error: error.message,
      severity,
      timestamp: Date.now(),
      context,
    });

    // Integrate with metrics collector
    if (this.metricsCollector && context.requestId) {
      this.metricsCollector.recordRequestEnd(context.requestId, {
        success: false,
        error: error.message,
        errorType: 'provider_operation',
        errorSeverity: severity,
      });
    }

    // Log with structured logger
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

    // Check for alert conditions
    if (severity === 'critical' || severity === 'high') {
      this.checkProviderFailureAlerts(providerName, error, severity);
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

    // Emit event for other systems
    this.emit('providerOperationError', {
      providerName,
      operation,
      error: error.message,
      severity,
      requestData,
      context,
      timestamp: Date.now(),
    });
  }

  /**
   * Log error classification with monitoring integration
   * @param {Object} classification - Error classification result
   * @param {Object} context - Additional context
   */
  logErrorClassification(classification, context = {}) {
    // Log with enhanced error logger
    if (this.enhancedErrorLogger) {
      this.enhancedErrorLogger.logErrorClassification(classification, context);
    }

    // Log with structured logger
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
        recoveryStrategy: classification.recoveryStrategy,
        context,
      });
    }

    // Track classification patterns
    this.trackErrorClassification(classification);

    // Emit event for other systems
    this.emit('errorClassified', {
      classification,
      context,
      timestamp: Date.now(),
    });
  }

  /**
   * Track error for real-time monitoring
   * @private
   */
  trackError(errorType, errorData) {
    const timestamp = Date.now();

    // Track by error type
    if (!this.errorTracking.recentErrors.has(errorType)) {
      this.errorTracking.recentErrors.set(errorType, []);
    }
    this.errorTracking.recentErrors.get(errorType).push(timestamp);

    // Track by provider
    if (errorData.providerName) {
      if (!this.errorTracking.providerErrors.has(errorData.providerName)) {
        this.errorTracking.providerErrors.set(errorData.providerName, {
          count: 0,
          firstError: timestamp,
          lastError: null,
          errorTypes: new Map(),
          severities: new Map(),
        });
      }

      const providerData = this.errorTracking.providerErrors.get(
        errorData.providerName
      );
      providerData.count++;
      providerData.lastError = timestamp;
      providerData.errorTypes.set(
        errorType,
        (providerData.errorTypes.get(errorType) || 0) + 1
      );
      providerData.severities.set(
        errorData.severity,
        (providerData.severities.get(errorData.severity) || 0) + 1
      );
    }

    // Track parsing failures specifically
    if (errorType === 'response_parsing' && errorData.providerName) {
      if (!this.errorTracking.parsingFailures.has(errorData.providerName)) {
        this.errorTracking.parsingFailures.set(errorData.providerName, {
          count: 0,
          firstFailure: timestamp,
          lastFailure: null,
          patterns: new Map(),
        });
      }

      const failureData = this.errorTracking.parsingFailures.get(
        errorData.providerName
      );
      failureData.count++;
      failureData.lastFailure = timestamp;

      // Track error patterns
      const pattern = this.identifyErrorPattern(errorData.error);
      failureData.patterns.set(
        pattern,
        (failureData.patterns.get(pattern) || 0) + 1
      );
    }

    // Clean up old timestamps
    this.cleanupOldTimestamps();
  }

  /**
   * Track error classification patterns
   * @private
   */
  trackErrorClassification(classification) {
    const classificationKey = `${classification.type}_${classification.severity}`;

    if (!this.errorTracking.recentErrors.has(classificationKey)) {
      this.errorTracking.recentErrors.set(classificationKey, []);
    }

    this.errorTracking.recentErrors.get(classificationKey).push(Date.now());
  }

  /**
   * Check for parsing failure alerts
   * @private
   */
  checkParsingFailureAlerts(providerName, error) {
    const recentFailures = this.getRecentErrorCount('response_parsing', 60000); // Last minute

    if (recentFailures >= this.config.parsingFailureThreshold) {
      this.sendAlert('parsing_failures_threshold', {
        providerName,
        failureCount: recentFailures,
        threshold: this.config.parsingFailureThreshold,
        error: error.message,
        severity: 'high',
      });
    }
  }

  /**
   * Check for provider failure alerts
   * @private
   */
  checkProviderFailureAlerts(providerName, error, severity) {
    const recentFailures = this.getRecentErrorCount(
      'provider_operation',
      60000
    ); // Last minute

    if (recentFailures >= this.config.providerFailureThreshold) {
      this.sendAlert('provider_failures_threshold', {
        providerName,
        failureCount: recentFailures,
        threshold: this.config.providerFailureThreshold,
        error: error.message,
        severity,
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

    // Log alert
    if (this.structuredLogger) {
      this.structuredLogger.error(`ALERT: ${alertType}`, null, {
        alertType,
        alertData,
        alertKey,
        timestamp: new Date().toISOString(),
      });
    }

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
      if (this.structuredLogger) {
        this.structuredLogger.info('Error monitoring report', report);
      }

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
    const now = Date.now();
    const oneMinuteAgo = now - 60000;

    // Check critical error threshold
    const criticalErrors = this.getRecentErrorCount('provider_method', 60000);
    if (criticalErrors >= this.config.criticalErrorThreshold) {
      this.sendAlert('critical_errors_threshold', {
        errorCount: criticalErrors,
        threshold: this.config.criticalErrorThreshold,
        timeWindow: '1 minute',
      });
    }

    // Check parsing failure threshold
    const parsingFailures = this.getRecentErrorCount('response_parsing', 60000);
    if (parsingFailures >= this.config.parsingFailureThreshold) {
      this.sendAlert('parsing_failures_threshold', {
        failureCount: parsingFailures,
        threshold: this.config.parsingFailureThreshold,
        timeWindow: '1 minute',
      });
    }

    // Check provider failure threshold
    const providerFailures = this.getRecentErrorCount(
      'provider_operation',
      60000
    );
    if (providerFailures >= this.config.providerFailureThreshold) {
      this.sendAlert('provider_failures_threshold', {
        failureCount: providerFailures,
        threshold: this.config.providerFailureThreshold,
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

    // Clean up suppressed alerts (use suppression window)
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
   * Generate error monitoring report
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
          severities: Object.fromEntries(errorData.severities),
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
      alertsSent: this.getRecentAlertCount(3600000),
      thresholds: {
        critical: this.config.criticalErrorThreshold,
        parsingFailures: this.config.parsingFailureThreshold,
        providerFailures: this.config.providerFailureThreshold,
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
   * Identify error pattern
   * @private
   */
  identifyErrorPattern(errorMessage) {
    const message = errorMessage.toLowerCase();

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
          errorTypes: Object.fromEntries(errorData.errorTypes),
          severities: Object.fromEntries(errorData.severities),
        });
      }
    }

    return {
      timestamp: new Date().toISOString(),
      timeWindow: timeWindowMs,
      totalRecentErrors: Array.from(errorsByType.values()).reduce(
        (sum, count) => sum + count,
        0
      ),
      errorsByType: Object.fromEntries(errorsByType),
      providerStatistics: Object.fromEntries(providerStats),
      parsingFailures: Object.fromEntries(this.errorTracking.parsingFailures),
      recentAlerts: this.getRecentAlertCount(timeWindowMs),
      configuration: {
        thresholds: {
          critical: this.config.criticalErrorThreshold,
          parsingFailures: this.config.parsingFailureThreshold,
          providerFailures: this.config.providerFailureThreshold,
        },
        intervals: {
          tracking: this.config.trackingInterval,
          reporting: this.config.reportingInterval,
        },
      },
    };
  }

  /**
   * Export monitoring data
   */
  exportMonitoringData(options = {}) {
    const timeWindow = options.timeWindow || 3600000; // 1 hour
    const includeRawData = options.includeRawData || false;

    const exportData = {
      timestamp: new Date().toISOString(),
      timeWindow,
      statistics: this.getErrorStatistics(timeWindow),
      monitoringReport: this.generateErrorMonitoringReport(),
      configuration: this.config,
    };

    if (includeRawData) {
      exportData.rawData = {
        recentErrors: Object.fromEntries(this.errorTracking.recentErrors),
        providerErrors: Object.fromEntries(this.errorTracking.providerErrors),
        parsingFailures: Object.fromEntries(this.errorTracking.parsingFailures),
        alertHistory: Object.fromEntries(this.errorTracking.alertHistory),
      };
    }

    return exportData;
  }

  /**
   * Cleanup resources
   */
  destroy() {
    // Stop tracking
    this.stopRealTimeTracking();

    // Clear tracking data
    this.errorTracking.recentErrors.clear();
    this.errorTracking.providerErrors.clear();
    this.errorTracking.parsingFailures.clear();
    this.errorTracking.alertHistory.clear();
    this.errorTracking.suppressedAlerts.clear();

    // Remove event listeners
    this.removeAllListeners();

    // Destroy enhanced error logger if we created it
    if (this.enhancedErrorLogger && !this.enhancedErrorLogger.external) {
      this.enhancedErrorLogger.destroy();
    }

    console.log('ErrorMonitoringIntegration destroyed');
  }
}

module.exports = ErrorMonitoringIntegration;
