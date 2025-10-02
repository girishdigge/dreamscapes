// utils/MonitoringIntegrationManager.js
// Comprehensive monitoring integration manager for enhanced error logging and monitoring

const EventEmitter = require('events');

/**
 * Monitoring Integration Manager - Coordinates all monitoring and logging components
 * Provides centralized monitoring integration for the MCP Gateway service
 */
class MonitoringIntegrationManager extends EventEmitter {
  constructor(config = {}) {
    super();

    this.config = {
      // Integration settings
      enableEnhancedLogging: config.enableEnhancedLogging !== false,
      enableStructuredLogging: config.enableStructuredLogging !== false,
      enableErrorMonitoring: config.enableErrorMonitoring !== false,
      enablePerformanceMonitoring: config.enablePerformanceMonitoring !== false,

      // Alert thresholds
      criticalErrorThreshold: config.criticalErrorThreshold || 5,
      parsingFailureThreshold: config.parsingFailureThreshold || 10,
      healthFailureThreshold: config.healthFailureThreshold || 3,
      responseTimeThreshold: config.responseTimeThreshold || 5000,

      // Monitoring intervals
      healthCheckInterval: config.healthCheckInterval || 30000,
      metricsCollectionInterval: config.metricsCollectionInterval || 60000,
      reportingInterval: config.reportingInterval || 300000,

      ...config,
    };

    // Component instances
    this.enhancedLoggingLayer = null;
    this.enhancedErrorLogger = null;
    this.structuredLogger = null;
    this.errorMonitoringIntegration = null;
    this.providerManager = null;

    // Integration state
    this.isInitialized = false;
    this.integrationStatus = {
      enhancedLoggingLayer: false,
      enhancedErrorLogger: false,
      structuredLogger: false,
      errorMonitoringIntegration: false,
      providerManager: false,
    };

    // Monitoring intervals
    this.monitoringIntervals = new Map();

    console.log('MonitoringIntegrationManager initialized with config:', {
      enableEnhancedLogging: this.config.enableEnhancedLogging,
      enableStructuredLogging: this.config.enableStructuredLogging,
      enableErrorMonitoring: this.config.enableErrorMonitoring,
    });
  }

  /**
   * Initialize monitoring integration with all components
   * @param {Object} components - Component instances
   */
  async initialize(components = {}) {
    try {
      console.log('Initializing MonitoringIntegrationManager...');

      // Initialize Enhanced Logging Integration Layer
      if (this.config.enableEnhancedLogging) {
        await this.initializeEnhancedLoggingLayer(components);
      }

      // Initialize individual components
      await this.initializeComponents(components);

      // Set up provider manager integration
      if (components.providerManager) {
        await this.integrateWithProviderManager(components.providerManager);
      }

      // Start monitoring processes
      this.startMonitoringProcesses();

      this.isInitialized = true;
      console.log('MonitoringIntegrationManager initialized successfully');
      this.emit('initialized', this.integrationStatus);
    } catch (error) {
      console.error(
        'Failed to initialize MonitoringIntegrationManager:',
        error.message
      );
      throw error;
    }
  }

  /**
   * Initialize Enhanced Logging Integration Layer
   * @private
   */
  async initializeEnhancedLoggingLayer(components) {
    try {
      const EnhancedLoggingIntegrationLayer = require('./EnhancedLoggingIntegrationLayer');

      this.enhancedLoggingLayer = new EnhancedLoggingIntegrationLayer({
        enableStructuredLogging: this.config.enableStructuredLogging,
        enableErrorClassification: true,
        enableMonitoringIntegration: this.config.enableErrorMonitoring,
        enableAlertingIntegration: true,
        criticalErrorThreshold: this.config.criticalErrorThreshold,
        parsingFailureThreshold: this.config.parsingFailureThreshold,
        healthFailureThreshold: this.config.healthFailureThreshold,
      });

      await this.enhancedLoggingLayer.initialize(components);
      this.integrationStatus.enhancedLoggingLayer = true;

      // Set up event listeners
      this.enhancedLoggingLayer.on('responseParsingError', (data) => {
        this.handleResponseParsingError(data);
      });

      this.enhancedLoggingLayer.on('providerMethodError', (data) => {
        this.handleProviderMethodError(data);
      });

      this.enhancedLoggingLayer.on('providerOperationError', (data) => {
        this.handleProviderOperationError(data);
      });

      this.enhancedLoggingLayer.on('providerHealthError', (data) => {
        this.handleProviderHealthError(data);
      });

      console.log('Enhanced Logging Integration Layer initialized');
    } catch (error) {
      console.error(
        'Failed to initialize Enhanced Logging Integration Layer:',
        error.message
      );
      // Continue without enhanced logging layer
    }
  }

  /**
   * Initialize individual components
   * @private
   */
  async initializeComponents(components) {
    // Initialize Enhanced Error Logger
    if (components.enhancedErrorLogger) {
      this.enhancedErrorLogger = components.enhancedErrorLogger;
      this.integrationStatus.enhancedErrorLogger = true;
      console.log('Enhanced Error Logger integrated');
    }

    // Initialize Structured Logger
    if (components.structuredLogger) {
      this.structuredLogger = components.structuredLogger;
      this.integrationStatus.structuredLogger = true;
      console.log('Structured Logger integrated');
    }

    // Initialize Error Monitoring Integration
    if (components.errorMonitoringIntegration) {
      this.errorMonitoringIntegration = components.errorMonitoringIntegration;
      this.integrationStatus.errorMonitoringIntegration = true;
      console.log('Error Monitoring Integration integrated');
    }
  }

  /**
   * Integrate with Provider Manager
   * @private
   */
  async integrateWithProviderManager(providerManager) {
    try {
      this.providerManager = providerManager;
      this.integrationStatus.providerManager = true;

      // Wrap provider manager methods with enhanced logging
      this.wrapProviderManagerMethods();

      // Set up provider manager event listeners
      this.setupProviderManagerEventListeners();

      console.log('Provider Manager integration completed');
    } catch (error) {
      console.error(
        'Failed to integrate with Provider Manager:',
        error.message
      );
      throw error;
    }
  }

  /**
   * Wrap provider manager methods with enhanced logging
   * @private
   */
  wrapProviderManagerMethods() {
    if (!this.providerManager) return;

    // Wrap executeWithFallback method
    const originalExecuteWithFallback =
      this.providerManager.executeWithFallback.bind(this.providerManager);
    this.providerManager.executeWithFallback = async (
      operation,
      providers,
      options
    ) => {
      const requestId = this.generateRequestId();
      const startTime = Date.now();

      // Log operation start
      this.logOperationStart(requestId, 'executeWithFallback', {
        providers: providers
          ? providers.map((p) => (typeof p === 'string' ? p : p.name))
          : 'auto',
        options,
      });

      try {
        const result = await originalExecuteWithFallback(operation, providers, {
          ...options,
          requestId,
        });

        const responseTime = Date.now() - startTime;
        this.logOperationSuccess(requestId, 'executeWithFallback', {
          responseTime,
          result: typeof result,
        });

        return result;
      } catch (error) {
        const responseTime = Date.now() - startTime;
        this.logOperationError(requestId, 'executeWithFallback', error, {
          responseTime,
          providers: providers
            ? providers.map((p) => (typeof p === 'string' ? p : p.name))
            : 'auto',
          options,
        });
        throw error;
      }
    };

    // Wrap selectProvider method
    const originalSelectProvider = this.providerManager.selectProvider.bind(
      this.providerManager
    );
    this.providerManager.selectProvider = async (requirements) => {
      const requestId = this.generateRequestId();
      const startTime = Date.now();

      this.logOperationStart(requestId, 'selectProvider', { requirements });

      try {
        const result = await originalSelectProvider(requirements);
        const responseTime = Date.now() - startTime;

        this.logOperationSuccess(requestId, 'selectProvider', {
          responseTime,
          selectedProvider: result.name,
          score: result.score,
        });

        return result;
      } catch (error) {
        const responseTime = Date.now() - startTime;
        this.logOperationError(requestId, 'selectProvider', error, {
          responseTime,
          requirements,
        });
        throw error;
      }
    };

    // Wrap healthCheck method
    const originalHealthCheck = this.providerManager.healthCheck.bind(
      this.providerManager
    );
    this.providerManager.healthCheck = async (providerName) => {
      const requestId = this.generateRequestId();
      const startTime = Date.now();

      this.logOperationStart(requestId, 'healthCheck', { providerName });

      try {
        const result = await originalHealthCheck(providerName);
        const responseTime = Date.now() - startTime;

        this.logOperationSuccess(requestId, 'healthCheck', {
          responseTime,
          providerName,
          healthStatus: providerName
            ? result.isHealthy
            : Object.keys(result).length,
        });

        return result;
      } catch (error) {
        const responseTime = Date.now() - startTime;

        // Log health check error with enhanced logging
        if (this.enhancedLoggingLayer) {
          this.enhancedLoggingLayer.logProviderHealthError(
            error,
            providerName || 'all',
            {
              requestId,
              responseTime,
              healthCheckType: providerName ? 'single' : 'all',
            }
          );
        }

        this.logOperationError(requestId, 'healthCheck', error, {
          responseTime,
          providerName,
        });
        throw error;
      }
    };

    console.log('Provider Manager methods wrapped with enhanced logging');
  }

  /**
   * Set up provider manager event listeners
   * @private
   */
  setupProviderManagerEventListeners() {
    if (!this.providerManager) return;

    // Listen to provider events
    this.providerManager.on('providerRegistered', (data) => {
      this.logProviderEvent('registered', data);
    });

    this.providerManager.on('providerUnregistered', (data) => {
      this.logProviderEvent('unregistered', data);
    });

    this.providerManager.on('providerSelected', (data) => {
      this.logProviderEvent('selected', data);
    });

    this.providerManager.on('operationSuccess', (data) => {
      this.logProviderEvent('operationSuccess', data);
    });

    this.providerManager.on('operationFailure', (data) => {
      this.logProviderEvent('operationFailure', data);

      // Enhanced logging for operation failures
      if (this.enhancedLoggingLayer && data.error) {
        const error = new Error(data.error);
        this.enhancedLoggingLayer.logProviderOperationError(
          error,
          data.provider,
          'unknown',
          {},
          {
            requestId: data.requestId,
            responseTime: data.responseTime,
            attempts: data.attempts,
            providerRetries: data.providerRetries,
            errorType: data.errorType,
            errorSeverity: data.errorSeverity,
          }
        );
      }
    });

    this.providerManager.on('healthCheckPassed', (data) => {
      this.logProviderEvent('healthCheckPassed', data);
    });

    this.providerManager.on('healthCheckFailed', (data) => {
      this.logProviderEvent('healthCheckFailed', data);

      // Enhanced logging for health check failures
      if (this.enhancedLoggingLayer && data.error) {
        const error = new Error(data.error);
        this.enhancedLoggingLayer.logProviderHealthError(error, data.provider, {
          healthCheckType: 'automatic',
          responseTime: data.responseTime,
        });
      }
    });

    this.providerManager.on('allProvidersFailed', (data) => {
      this.logProviderEvent('allProvidersFailed', data);

      // Critical alert for all providers failing
      this.sendCriticalAlert('all_providers_failed', {
        attempts: data.attempts,
        totalTime: data.totalTime,
        lastError: data.lastError,
        failureReport: data.failureReport,
      });
    });

    console.log('Provider Manager event listeners set up');
  }

  /**
   * Start monitoring processes
   * @private
   */
  startMonitoringProcesses() {
    // Start health monitoring
    if (this.config.healthCheckInterval > 0) {
      const healthInterval = setInterval(() => {
        this.performHealthMonitoring();
      }, this.config.healthCheckInterval);

      this.monitoringIntervals.set('health', healthInterval);
      console.log(
        `Health monitoring started (interval: ${this.config.healthCheckInterval}ms)`
      );
    }

    // Start metrics collection
    if (this.config.metricsCollectionInterval > 0) {
      const metricsInterval = setInterval(() => {
        this.performMetricsCollection();
      }, this.config.metricsCollectionInterval);

      this.monitoringIntervals.set('metrics', metricsInterval);
      console.log(
        `Metrics collection started (interval: ${this.config.metricsCollectionInterval}ms)`
      );
    }

    // Start reporting
    if (this.config.reportingInterval > 0) {
      const reportingInterval = setInterval(() => {
        this.performReporting();
      }, this.config.reportingInterval);

      this.monitoringIntervals.set('reporting', reportingInterval);
      console.log(
        `Reporting started (interval: ${this.config.reportingInterval}ms)`
      );
    }
  }

  /**
   * Perform health monitoring
   * @private
   */
  async performHealthMonitoring() {
    try {
      if (!this.providerManager) return;

      const healthResults = await this.providerManager.healthCheck();

      // Analyze health results
      const healthSummary = this.analyzeHealthResults(healthResults);

      // Log health summary
      if (this.structuredLogger) {
        this.structuredLogger.info('Health monitoring report', {
          type: 'health_monitoring',
          summary: healthSummary,
          timestamp: new Date().toISOString(),
        });
      }

      // Check for health alerts
      this.checkHealthAlerts(healthSummary);
    } catch (error) {
      console.error('Health monitoring error:', error.message);

      if (this.enhancedLoggingLayer) {
        this.enhancedLoggingLayer.logMonitoringIntegrationError(
          error,
          'health_monitoring',
          {
            monitoringType: 'health',
            integrationStatus: this.integrationStatus,
          }
        );
      }
    }
  }

  /**
   * Perform metrics collection
   * @private
   */
  async performMetricsCollection() {
    try {
      if (!this.providerManager) return;

      const metrics = this.providerManager.getProviderMetrics();

      // Analyze metrics
      const metricsAnalysis = this.analyzeMetrics(metrics);

      // Log metrics summary
      if (this.structuredLogger) {
        this.structuredLogger.info('Metrics collection report', {
          type: 'metrics_collection',
          analysis: metricsAnalysis,
          timestamp: new Date().toISOString(),
        });
      }

      // Check for performance alerts
      this.checkPerformanceAlerts(metricsAnalysis);
    } catch (error) {
      console.error('Metrics collection error:', error.message);

      if (this.enhancedLoggingLayer) {
        this.enhancedLoggingLayer.logMonitoringIntegrationError(
          error,
          'metrics_collection',
          {
            monitoringType: 'metrics',
            integrationStatus: this.integrationStatus,
          }
        );
      }
    }
  }

  /**
   * Perform reporting
   * @private
   */
  async performReporting() {
    try {
      const report = await this.generateComprehensiveReport();

      // Log comprehensive report
      if (this.structuredLogger) {
        this.structuredLogger.info('Comprehensive monitoring report', {
          type: 'comprehensive_report',
          report,
          timestamp: new Date().toISOString(),
        });
      }

      // Emit report event
      this.emit('monitoringReport', report);
    } catch (error) {
      console.error('Reporting error:', error.message);

      if (this.enhancedLoggingLayer) {
        this.enhancedLoggingLayer.logMonitoringIntegrationError(
          error,
          'reporting',
          {
            monitoringType: 'reporting',
            integrationStatus: this.integrationStatus,
          }
        );
      }
    }
  }

  /**
   * Handle response parsing error
   * @private
   */
  handleResponseParsingError(data) {
    console.log(
      `🔍 Response parsing error handled: ${data.providerName} - ${data.error}`
    );
    this.emit('responseParsingError', data);
  }

  /**
   * Handle provider method error
   * @private
   */
  handleProviderMethodError(data) {
    console.error(
      `🚨 Provider method error handled: ${data.providerName}.${data.methodName} - ${data.error}`
    );
    this.emit('providerMethodError', data);
  }

  /**
   * Handle provider operation error
   * @private
   */
  handleProviderOperationError(data) {
    console.log(
      `⚠️ Provider operation error handled: ${data.providerName}.${data.operation} - ${data.error}`
    );
    this.emit('providerOperationError', data);
  }

  /**
   * Handle provider health error
   * @private
   */
  handleProviderHealthError(data) {
    console.log(
      `🏥 Provider health error handled: ${data.providerName} - ${data.error}`
    );
    this.emit('providerHealthError', data);
  }

  /**
   * Log operation start
   * @private
   */
  logOperationStart(requestId, operation, context) {
    if (this.structuredLogger) {
      this.structuredLogger.info('Operation started', {
        type: 'operation_start',
        requestId,
        operation,
        context,
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Log operation success
   * @private
   */
  logOperationSuccess(requestId, operation, context) {
    if (this.structuredLogger) {
      this.structuredLogger.info('Operation completed successfully', {
        type: 'operation_success',
        requestId,
        operation,
        context,
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Log operation error
   * @private
   */
  logOperationError(requestId, operation, error, context) {
    if (this.structuredLogger) {
      this.structuredLogger.error('Operation failed', error, {
        type: 'operation_error',
        requestId,
        operation,
        context,
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Log provider event
   * @private
   */
  logProviderEvent(eventType, data) {
    if (this.structuredLogger) {
      this.structuredLogger.info(`Provider event: ${eventType}`, {
        type: 'provider_event',
        eventType,
        data,
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Analyze health results
   * @private
   */
  analyzeHealthResults(healthResults) {
    const summary = {
      total: 0,
      healthy: 0,
      unhealthy: 0,
      errors: [],
    };

    for (const [providerName, health] of Object.entries(healthResults)) {
      summary.total++;
      if (health.isHealthy) {
        summary.healthy++;
      } else {
        summary.unhealthy++;
        summary.errors.push({
          provider: providerName,
          error: health.error,
        });
      }
    }

    return summary;
  }

  /**
   * Analyze metrics
   * @private
   */
  analyzeMetrics(metrics) {
    const analysis = {
      totalProviders: 0,
      totalRequests: 0,
      totalSuccesses: 0,
      totalFailures: 0,
      overallSuccessRate: 0,
      slowProviders: [],
      highErrorProviders: [],
    };

    for (const [providerName, providerMetrics] of Object.entries(metrics)) {
      analysis.totalProviders++;
      analysis.totalRequests += providerMetrics.requests || 0;
      analysis.totalSuccesses += providerMetrics.successes || 0;
      analysis.totalFailures += providerMetrics.failures || 0;

      // Check for slow providers
      if (providerMetrics.avgResponseTime > this.config.responseTimeThreshold) {
        analysis.slowProviders.push({
          provider: providerName,
          avgResponseTime: providerMetrics.avgResponseTime,
        });
      }

      // Check for high error rate providers
      if (providerMetrics.failureRate > 0.1) {
        // 10% failure rate
        analysis.highErrorProviders.push({
          provider: providerName,
          failureRate: providerMetrics.failureRate,
        });
      }
    }

    analysis.overallSuccessRate =
      analysis.totalRequests > 0
        ? analysis.totalSuccesses / analysis.totalRequests
        : 0;

    return analysis;
  }

  /**
   * Check health alerts
   * @private
   */
  checkHealthAlerts(healthSummary) {
    // Alert if too many providers are unhealthy
    if (healthSummary.unhealthy >= this.config.healthFailureThreshold) {
      this.sendAlert('multiple_providers_unhealthy', {
        unhealthyCount: healthSummary.unhealthy,
        totalCount: healthSummary.total,
        errors: healthSummary.errors,
      });
    }

    // Alert if all providers are unhealthy
    if (healthSummary.total > 0 && healthSummary.healthy === 0) {
      this.sendCriticalAlert('all_providers_unhealthy', {
        totalCount: healthSummary.total,
        errors: healthSummary.errors,
      });
    }
  }

  /**
   * Check performance alerts
   * @private
   */
  checkPerformanceAlerts(metricsAnalysis) {
    // Alert for low overall success rate
    if (metricsAnalysis.overallSuccessRate < 0.8) {
      // 80% success rate threshold
      this.sendAlert('low_success_rate', {
        successRate: metricsAnalysis.overallSuccessRate,
        totalRequests: metricsAnalysis.totalRequests,
        totalFailures: metricsAnalysis.totalFailures,
      });
    }

    // Alert for slow providers
    if (metricsAnalysis.slowProviders.length > 0) {
      this.sendAlert('slow_providers_detected', {
        slowProviders: metricsAnalysis.slowProviders,
        threshold: this.config.responseTimeThreshold,
      });
    }

    // Alert for high error rate providers
    if (metricsAnalysis.highErrorProviders.length > 0) {
      this.sendAlert('high_error_rate_providers', {
        highErrorProviders: metricsAnalysis.highErrorProviders,
      });
    }
  }

  /**
   * Send alert
   * @private
   */
  sendAlert(alertType, alertData) {
    console.warn(`⚠️ ALERT: ${alertType}`, alertData);

    if (this.structuredLogger) {
      this.structuredLogger.warn(`Alert: ${alertType}`, null, {
        type: 'alert',
        alertType,
        alertData,
        timestamp: new Date().toISOString(),
      });
    }

    this.emit('alert', {
      type: alertType,
      data: alertData,
      severity: 'warning',
      timestamp: Date.now(),
    });
  }

  /**
   * Send critical alert
   * @private
   */
  sendCriticalAlert(alertType, alertData) {
    console.error(`🚨 CRITICAL ALERT: ${alertType}`, alertData);

    if (this.structuredLogger) {
      this.structuredLogger.error(`Critical Alert: ${alertType}`, null, {
        type: 'critical_alert',
        alertType,
        alertData,
        timestamp: new Date().toISOString(),
      });
    }

    this.emit('alert', {
      type: alertType,
      data: alertData,
      severity: 'critical',
      timestamp: Date.now(),
    });
  }

  /**
   * Generate comprehensive report
   */
  async generateComprehensiveReport() {
    const report = {
      timestamp: new Date().toISOString(),
      integrationStatus: this.integrationStatus,
      isInitialized: this.isInitialized,
    };

    try {
      // Provider health information
      if (this.providerManager) {
        report.providerHealth = this.providerManager.getProviderHealth();
        report.providerMetrics = this.providerManager.getProviderMetrics();
      }

      // Enhanced logging statistics
      if (this.enhancedLoggingLayer) {
        report.loggingStatistics =
          this.enhancedLoggingLayer.getLoggingStatistics();
      }

      // Error monitoring statistics
      if (this.errorMonitoringIntegration) {
        report.errorMonitoringReport =
          this.errorMonitoringIntegration.generateErrorMonitoringReport();
      }

      // Performance analysis
      report.performanceAnalysis = this.analyzeMetrics(
        report.providerMetrics || {}
      );
    } catch (error) {
      report.error = error.message;
      console.error('Error generating comprehensive report:', error.message);
    }

    return report;
  }

  /**
   * Generate unique request ID
   * @private
   */
  generateRequestId() {
    return `monitor_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Stop monitoring processes
   */
  stopMonitoring() {
    // Clear all intervals
    for (const [name, interval] of this.monitoringIntervals.entries()) {
      clearInterval(interval);
      console.log(`${name} monitoring stopped`);
    }
    this.monitoringIntervals.clear();

    // Stop enhanced logging layer
    if (this.enhancedLoggingLayer) {
      this.enhancedLoggingLayer.destroy();
    }

    console.log('All monitoring processes stopped');
  }

  /**
   * Get monitoring status
   */
  getMonitoringStatus() {
    return {
      isInitialized: this.isInitialized,
      integrationStatus: this.integrationStatus,
      activeIntervals: Array.from(this.monitoringIntervals.keys()),
      config: this.config,
    };
  }

  /**
   * Cleanup resources
   */
  destroy() {
    this.stopMonitoring();
    this.removeAllListeners();

    console.log('MonitoringIntegrationManager destroyed');
  }
}

module.exports = MonitoringIntegrationManager;
