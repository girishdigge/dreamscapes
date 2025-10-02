// utils/ErrorLoggingIntegration.js
// Integration layer for enhanced error logging with existing monitoring systems

const EnhancedErrorLoggingSystem = require('./EnhancedErrorLoggingSystem');
const StructuredLogger = require('../monitoring/StructuredLogger');
const { logger } = require('./logger');

/**
 * Error Logging Integration - Coordinates error logging across all systems
 */
class ErrorLoggingIntegration {
  constructor(config = {}) {
    this.config = {
      enableEnhancedLogging: config.enableEnhancedLogging !== false,
      enableStructuredLogging: config.enableStructuredLogging !== false,
      enableErrorMonitoring: config.enableErrorMonitoring !== false,

      // Error categorization
      errorCategories: {
        parsing: [
          'substring is not a function',
          'cannot read property',
          'unexpected token',
        ],
        network: ['timeout', 'connection', 'econnrefused', 'enotfound'],
        authentication: [
          'unauthorized',
          'forbidden',
          'invalid token',
          'api key',
        ],
        rateLimit: ['rate limit', 'too many requests', '429'],
        server: ['internal server error', '500', '502', '503'],
        validation: ['validation error', 'invalid input', 'missing required'],
      },

      // Alert thresholds
      alertThresholds: {
        criticalErrorRate: config.criticalErrorRate || 0.1, // 10%
        warningErrorRate: config.warningErrorRate || 0.05, // 5%
        consecutiveErrors: config.consecutiveErrors || 5,
        errorBurstThreshold: config.errorBurstThreshold || 10, // 10 errors in 1 minute
      },

      ...config,
    };

    // Initialize components
    this.enhancedErrorLogger = null;
    this.structuredLogger = null;
    this.errorStats = new Map(); // provider -> error statistics
    this.recentErrors = []; // Recent error history
    this.alertHistory = new Map(); // Alert suppression tracking

    this.isInitialized = false;

    logger.info('ErrorLoggingIntegration initialized', { config: this.config });
  }

  /**
   * Initialize the error logging integration
   * @param {Object} dependencies - Required dependencies
   */
  async initialize(dependencies = {}) {
    if (this.isInitialized) {
      logger.warn('ErrorLoggingIntegration already initialized');
      return;
    }

    try {
      // Initialize Enhanced Error Logging System
      if (this.config.enableEnhancedLogging) {
        this.enhancedErrorLogger = new EnhancedErrorLoggingSystem({
          enableRealTimeAnalysis: true,
          enableErrorCategorization: true,
          enableAlertGeneration: true,
          retentionPeriod: 86400000, // 24 hours
          ...this.config.enhancedLogging,
        });

        await this.enhancedErrorLogger.initialize();
        logger.info('Enhanced error logging system initialized');
      }

      // Initialize Structured Logger
      if (this.config.enableStructuredLogging) {
        this.structuredLogger = new StructuredLogger({
          level: 'info',
          enableConsole: true,
          enableFile: true,
          enableErrorTracking: true,
          ...this.config.structuredLogging,
        });

        logger.info('Structured logger initialized');
      }

      // Setup error event listeners
      this.setupErrorEventListeners(dependencies);

      this.isInitialized = true;
      logger.info('ErrorLoggingIntegration fully initialized');
    } catch (error) {
      logger.error('Failed to initialize ErrorLoggingIntegration:', error);
      throw error;
    }
  }

  /**
   * Setup error event listeners for various components
   * @private
   */
  setupErrorEventListeners(dependencies) {
    const { providerManager, monitoringSystem, app } = dependencies;

    // Listen to ProviderManager errors
    if (providerManager) {
      providerManager.on('operationFailure', (data) => {
        this.logProviderError(data);
      });

      providerManager.on('allProvidersFailed', (data) => {
        this.logCriticalSystemError('all_providers_failed', data);
      });
    }

    // Listen to Express app errors
    if (app) {
      app.on('error', (error) => {
        this.logApplicationError(error);
      });
    }

    // Setup global error handlers
    process.on('uncaughtException', (error) => {
      this.logCriticalSystemError('uncaught_exception', {
        error: error.message,
        stack: error.stack,
      });
    });

    process.on('unhandledRejection', (reason, promise) => {
      this.logCriticalSystemError('unhandled_rejection', { reason, promise });
    });
  }

  /**
   * Log provider-specific errors
   * @param {Object} errorData - Error data from provider
   */
  logProviderError(errorData) {
    const {
      provider,
      error,
      errorType,
      errorSeverity,
      responseTime,
      attempts,
      requestId,
    } = errorData;

    // Categorize the error
    const category = this.categorizeError(error);

    // Enhanced error data
    const enhancedErrorData = {
      timestamp: new Date(),
      provider,
      error,
      errorType,
      errorSeverity,
      category,
      responseTime,
      attempts,
      requestId,
      context: {
        isParsingError: this.isParsingError(error),
        isNetworkError: this.isNetworkError(error),
        isAuthError: this.isAuthenticationError(error),
        isRateLimitError: this.isRateLimitError(error),
      },
    };

    // Log through enhanced error logger
    if (this.enhancedErrorLogger) {
      this.enhancedErrorLogger.logError(enhancedErrorData);
    }

    // Log through structured logger
    if (this.structuredLogger) {
      this.structuredLogger.error(
        'Provider operation failed',
        enhancedErrorData
      );
    }

    // Update error statistics
    this.updateErrorStatistics(provider, enhancedErrorData);

    // Check for alert conditions
    this.checkAlertConditions(provider, enhancedErrorData);

    // Add to recent errors for analysis
    this.recentErrors.push(enhancedErrorData);
    if (this.recentErrors.length > 1000) {
      this.recentErrors = this.recentErrors.slice(-1000); // Keep last 1000 errors
    }

    logger.error('Provider error logged', {
      provider,
      category,
      errorType,
      errorSeverity,
      isParsingError: enhancedErrorData.context.isParsingError,
    });
  }

  /**
   * Log critical system errors
   * @param {string} errorType - Type of critical error
   * @param {Object} errorData - Error details
   */
  logCriticalSystemError(errorType, errorData) {
    const criticalError = {
      timestamp: new Date(),
      type: 'critical_system_error',
      errorType,
      severity: 'critical',
      data: errorData,
      systemState: {
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        activeHandles: process._getActiveHandles().length,
        activeRequests: process._getActiveRequests().length,
      },
    };

    // Log through all available loggers
    if (this.enhancedErrorLogger) {
      this.enhancedErrorLogger.logCriticalError(criticalError);
    }

    if (this.structuredLogger) {
      this.structuredLogger.error('Critical system error', criticalError);
    }

    // Always log to console for critical errors
    console.error(
      '🚨 CRITICAL SYSTEM ERROR:',
      JSON.stringify(criticalError, null, 2)
    );

    logger.error('Critical system error logged', {
      errorType,
      severity: 'critical',
    });
  }

  /**
   * Log application-level errors
   * @param {Error} error - Application error
   */
  logApplicationError(error) {
    const appError = {
      timestamp: new Date(),
      type: 'application_error',
      message: error.message,
      stack: error.stack,
      name: error.name,
      code: error.code,
      category: this.categorizeError(error.message),
    };

    if (this.enhancedErrorLogger) {
      this.enhancedErrorLogger.logError(appError);
    }

    if (this.structuredLogger) {
      this.structuredLogger.error('Application error', appError);
    }

    logger.error('Application error logged', {
      message: error.message,
      category: appError.category,
    });
  }

  /**
   * Categorize error based on message content
   * @private
   */
  categorizeError(errorMessage) {
    if (!errorMessage || typeof errorMessage !== 'string') {
      return 'unknown';
    }

    const message = errorMessage.toLowerCase();

    for (const [category, keywords] of Object.entries(
      this.config.errorCategories
    )) {
      if (keywords.some((keyword) => message.includes(keyword))) {
        return category;
      }
    }

    return 'unknown';
  }

  /**
   * Check if error is a parsing error
   * @private
   */
  isParsingError(errorMessage) {
    if (!errorMessage) return false;
    const message = errorMessage.toLowerCase();
    return (
      message.includes('substring is not a function') ||
      message.includes('cannot read property') ||
      message.includes('unexpected token') ||
      message.includes('json') ||
      message.includes('parse')
    );
  }

  /**
   * Check if error is a network error
   * @private
   */
  isNetworkError(errorMessage) {
    if (!errorMessage) return false;
    const message = errorMessage.toLowerCase();
    return (
      message.includes('timeout') ||
      message.includes('connection') ||
      message.includes('econnrefused') ||
      message.includes('enotfound') ||
      message.includes('network')
    );
  }

  /**
   * Check if error is an authentication error
   * @private
   */
  isAuthenticationError(errorMessage) {
    if (!errorMessage) return false;
    const message = errorMessage.toLowerCase();
    return (
      message.includes('unauthorized') ||
      message.includes('forbidden') ||
      message.includes('invalid token') ||
      message.includes('api key') ||
      message.includes('authentication')
    );
  }

  /**
   * Check if error is a rate limit error
   * @private
   */
  isRateLimitError(errorMessage) {
    if (!errorMessage) return false;
    const message = errorMessage.toLowerCase();
    return (
      message.includes('rate limit') ||
      message.includes('too many requests') ||
      message.includes('429')
    );
  }

  /**
   * Update error statistics for a provider
   * @private
   */
  updateErrorStatistics(provider, errorData) {
    if (!this.errorStats.has(provider)) {
      this.errorStats.set(provider, {
        totalErrors: 0,
        errorsByCategory: {},
        errorsByType: {},
        consecutiveErrors: 0,
        lastError: null,
        errorRate: 0,
        recentErrors: [],
      });
    }

    const stats = this.errorStats.get(provider);
    stats.totalErrors++;
    stats.consecutiveErrors++;
    stats.lastError = errorData;

    // Update category counts
    const category = errorData.category || 'unknown';
    stats.errorsByCategory[category] =
      (stats.errorsByCategory[category] || 0) + 1;

    // Update type counts
    const type = errorData.errorType || 'unknown';
    stats.errorsByType[type] = (stats.errorsByType[type] || 0) + 1;

    // Update recent errors (last hour)
    const oneHourAgo = Date.now() - 3600000;
    stats.recentErrors = stats.recentErrors.filter(
      (e) => e.timestamp > oneHourAgo
    );
    stats.recentErrors.push({
      timestamp: Date.now(),
      category,
      type,
      severity: errorData.errorSeverity,
    });

    // Calculate error rate (errors per hour)
    stats.errorRate = stats.recentErrors.length;
  }

  /**
   * Check for alert conditions and trigger alerts
   * @private
   */
  checkAlertConditions(provider, errorData) {
    const stats = this.errorStats.get(provider);
    if (!stats) return;

    const alerts = [];

    // Check consecutive errors
    if (
      stats.consecutiveErrors >= this.config.alertThresholds.consecutiveErrors
    ) {
      alerts.push({
        type: 'consecutive_errors',
        severity: 'critical',
        provider,
        message: `Provider ${provider} has ${stats.consecutiveErrors} consecutive errors`,
        data: {
          consecutiveErrors: stats.consecutiveErrors,
          lastError: errorData,
        },
      });
    }

    // Check error rate
    if (stats.errorRate >= this.config.alertThresholds.criticalErrorRate * 60) {
      // Convert to per hour
      alerts.push({
        type: 'high_error_rate',
        severity: 'critical',
        provider,
        message: `Provider ${provider} has high error rate: ${stats.errorRate} errors/hour`,
        data: {
          errorRate: stats.errorRate,
          threshold: this.config.alertThresholds.criticalErrorRate * 60,
        },
      });
    } else if (
      stats.errorRate >=
      this.config.alertThresholds.warningErrorRate * 60
    ) {
      alerts.push({
        type: 'elevated_error_rate',
        severity: 'warning',
        provider,
        message: `Provider ${provider} has elevated error rate: ${stats.errorRate} errors/hour`,
        data: {
          errorRate: stats.errorRate,
          threshold: this.config.alertThresholds.warningErrorRate * 60,
        },
      });
    }

    // Check for parsing error bursts
    const recentParsingErrors = stats.recentErrors.filter(
      (e) => e.category === 'parsing' && Date.now() - e.timestamp < 60000 // Last minute
    );

    if (recentParsingErrors.length >= 3) {
      alerts.push({
        type: 'parsing_error_burst',
        severity: 'critical',
        provider,
        message: `Provider ${provider} has ${recentParsingErrors.length} parsing errors in the last minute`,
        data: {
          parsingErrors: recentParsingErrors.length,
          timeWindow: '1 minute',
        },
      });
    }

    // Trigger alerts
    alerts.forEach((alert) => this.triggerAlert(alert));
  }

  /**
   * Trigger an alert with suppression logic
   * @private
   */
  triggerAlert(alert) {
    const alertKey = `${alert.provider}:${alert.type}`;
    const now = Date.now();
    const suppressionWindow = 300000; // 5 minutes

    // Check if alert should be suppressed
    const lastAlert = this.alertHistory.get(alertKey);
    if (lastAlert && now - lastAlert < suppressionWindow) {
      return; // Suppress duplicate alert
    }

    // Record alert
    this.alertHistory.set(alertKey, now);

    // Log alert
    logger.warn('Error alert triggered', alert);

    // Send through enhanced error logger if available
    if (this.enhancedErrorLogger) {
      this.enhancedErrorLogger.triggerAlert(alert);
    }

    // Console notification for critical alerts
    if (alert.severity === 'critical') {
      console.warn(`🚨 CRITICAL ALERT: ${alert.message}`);
    }
  }

  /**
   * Get error statistics for a provider
   * @param {string} provider - Provider name
   * @returns {Object} Error statistics
   */
  getProviderErrorStats(provider) {
    return (
      this.errorStats.get(provider) || {
        totalErrors: 0,
        errorsByCategory: {},
        errorsByType: {},
        consecutiveErrors: 0,
        lastError: null,
        errorRate: 0,
        recentErrors: [],
      }
    );
  }

  /**
   * Get comprehensive error report
   * @returns {Object} Error report
   */
  getErrorReport() {
    const report = {
      timestamp: new Date(),
      summary: {
        totalProviders: this.errorStats.size,
        totalErrors: 0,
        errorsByCategory: {},
        errorsByType: {},
        recentErrors: this.recentErrors.length,
      },
      providers: {},
      recentCriticalErrors: [],
    };

    // Aggregate provider statistics
    for (const [provider, stats] of this.errorStats.entries()) {
      report.summary.totalErrors += stats.totalErrors;

      // Aggregate categories
      Object.entries(stats.errorsByCategory).forEach(([category, count]) => {
        report.summary.errorsByCategory[category] =
          (report.summary.errorsByCategory[category] || 0) + count;
      });

      // Aggregate types
      Object.entries(stats.errorsByType).forEach(([type, count]) => {
        report.summary.errorsByType[type] =
          (report.summary.errorsByType[type] || 0) + count;
      });

      report.providers[provider] = { ...stats };
    }

    // Get recent critical errors
    const oneHourAgo = Date.now() - 3600000;
    report.recentCriticalErrors = this.recentErrors
      .filter(
        (error) =>
          error.errorSeverity === 'critical' &&
          error.timestamp.getTime() > oneHourAgo
      )
      .slice(-10); // Last 10 critical errors

    return report;
  }

  /**
   * Reset error statistics for a provider
   * @param {string} provider - Provider name
   */
  resetProviderErrorStats(provider) {
    if (this.errorStats.has(provider)) {
      const stats = this.errorStats.get(provider);
      stats.consecutiveErrors = 0;
      logger.info('Provider error statistics reset', { provider });
    }
  }

  /**
   * Cleanup old error data
   */
  cleanup() {
    const oneHourAgo = Date.now() - 3600000;
    const oneDayAgo = Date.now() - 86400000;

    // Clean recent errors
    this.recentErrors = this.recentErrors.filter(
      (error) => error.timestamp.getTime() > oneDayAgo
    );

    // Clean provider statistics
    for (const [provider, stats] of this.errorStats.entries()) {
      stats.recentErrors = stats.recentErrors.filter(
        (error) => error.timestamp > oneHourAgo
      );
      stats.errorRate = stats.recentErrors.length;
    }

    // Clean alert history
    const fiveMinutesAgo = Date.now() - 300000;
    for (const [alertKey, timestamp] of this.alertHistory.entries()) {
      if (timestamp < fiveMinutesAgo) {
        this.alertHistory.delete(alertKey);
      }
    }

    logger.debug('Error logging integration cleanup completed');
  }

  /**
   * Destroy the integration and cleanup resources
   */
  destroy() {
    if (this.enhancedErrorLogger) {
      this.enhancedErrorLogger.destroy();
    }

    this.errorStats.clear();
    this.recentErrors = [];
    this.alertHistory.clear();
    this.isInitialized = false;

    logger.info('ErrorLoggingIntegration destroyed');
  }
}

module.exports = ErrorLoggingIntegration;
