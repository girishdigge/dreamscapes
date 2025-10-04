// monitoring/MonitoringIntegration.js
// Comprehensive monitoring integration for MCP Gateway

const winston = require('winston');
const MetricsCollector = require('./MetricsCollector');
const AlertingSystem = require('./AlertingSystem');
const HealthMonitor = require('./HealthMonitor');
const MonitoringDashboard = require('./MonitoringDashboard');
const AsyncMetricsTracker = require('./AsyncMetricsTracker');

/**
 * Monitoring Integration - Orchestrates all monitoring components
 */
class MonitoringIntegration {
  constructor(config = {}) {
    this.config = {
      enableMetrics: config.enableMetrics !== false,
      enableAlerting: config.enableAlerting !== false,
      enableHealthMonitoring: config.enableHealthMonitoring !== false,
      enableDashboard: config.enableDashboard !== false,
      enableAsyncMetrics: config.enableAsyncMetrics !== false,

      // Component configurations
      metrics: config.metrics || {},
      alerting: config.alerting || {},
      health: config.health || {},
      dashboard: config.dashboard || {},
      asyncMetrics: config.asyncMetrics || {},

      // Integration settings
      autoStart: config.autoStart !== false,
      gracefulShutdown: config.gracefulShutdown !== false,

      ...config,
    };

    // Component instances
    this.metricsCollector = null;
    this.alertingSystem = null;
    this.healthMonitor = null;
    this.monitoringDashboard = null;
    this.asyncMetricsTracker = null;

    // State tracking
    this.isInitialized = false;
    this.isStarted = false;
    this.providerManager = null;

    // Logger setup
    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
      ),
      transports: [
        new winston.transports.File({
          filename: 'logs/monitoring-integration.log',
          maxsize: 10485760, // 10MB
          maxFiles: 5,
        }),
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
          ),
        }),
      ],
    });

    this.logger.info('MonitoringIntegration initialized', {
      config: this.config,
    });
  }

  /**
   * Initialize all monitoring components
   * @param {Object} dependencies - Required dependencies
   */
  async initialize(dependencies = {}) {
    if (this.isInitialized) {
      this.logger.warn('MonitoringIntegration already initialized');
      return;
    }

    try {
      this.providerManager = dependencies.providerManager;

      // Initialize MetricsCollector
      if (this.config.enableMetrics) {
        this.metricsCollector = new MetricsCollector(this.config.metrics);
        this.logger.info('MetricsCollector initialized');
      }

      // Initialize AlertingSystem
      if (this.config.enableAlerting) {
        this.alertingSystem = new AlertingSystem(this.config.alerting);
        this.logger.info('AlertingSystem initialized');
      }

      // Initialize HealthMonitor
      if (this.config.enableHealthMonitoring) {
        this.healthMonitor = new HealthMonitor(this.config.health);
        this.logger.info('HealthMonitor initialized');
      }

      // Initialize MonitoringDashboard
      if (this.config.enableDashboard) {
        this.monitoringDashboard = new MonitoringDashboard(
          this.config.dashboard
        );
        this.logger.info('MonitoringDashboard initialized');
      }

      // Initialize AsyncMetricsTracker
      if (this.config.enableAsyncMetrics) {
        this.asyncMetricsTracker = new AsyncMetricsTracker(
          this.config.asyncMetrics
        );
        this.logger.info('AsyncMetricsTracker initialized');
      }

      // Setup component integrations
      this.setupComponentIntegrations();

      this.isInitialized = true;
      this.logger.info('MonitoringIntegration fully initialized');

      // Auto-start if configured
      if (this.config.autoStart) {
        await this.start();
      }
    } catch (error) {
      this.logger.error('Failed to initialize MonitoringIntegration', {
        error: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }

  /**
   * Start all monitoring components
   */
  async start() {
    if (!this.isInitialized) {
      throw new Error(
        'MonitoringIntegration must be initialized before starting'
      );
    }

    if (this.isStarted) {
      this.logger.warn('MonitoringIntegration already started');
      return;
    }

    try {
      // Start MetricsCollector
      if (this.metricsCollector && this.providerManager) {
        this.metricsCollector.startCollection(this.providerManager);
        this.logger.info('MetricsCollector started');
      }

      // Start HealthMonitor
      if (this.healthMonitor && this.providerManager) {
        this.healthMonitor.startMonitoring(this.providerManager);
        this.logger.info('HealthMonitor started');
      }

      // Start MonitoringDashboard
      if (this.monitoringDashboard) {
        this.monitoringDashboard.start({
          providerManager: this.providerManager,
          metricsCollector: this.metricsCollector,
          alertingSystem: this.alertingSystem,
          healthMonitor: this.healthMonitor,
          asyncMetricsTracker: this.asyncMetricsTracker,
        });
        this.logger.info('MonitoringDashboard started');
      }

      // AsyncMetricsTracker starts automatically on initialization
      if (this.asyncMetricsTracker) {
        this.logger.info('AsyncMetricsTracker active');
      }

      this.isStarted = true;
      this.logger.info('MonitoringIntegration fully started');
    } catch (error) {
      this.logger.error('Failed to start MonitoringIntegration', {
        error: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }

  /**
   * Stop all monitoring components
   */
  async stop() {
    if (!this.isStarted) {
      this.logger.warn('MonitoringIntegration not started');
      return;
    }

    try {
      // Stop components in reverse order
      if (this.monitoringDashboard) {
        this.monitoringDashboard.stop();
        this.logger.info('MonitoringDashboard stopped');
      }

      if (this.healthMonitor) {
        this.healthMonitor.stopMonitoring();
        this.logger.info('HealthMonitor stopped');
      }

      if (this.metricsCollector) {
        this.metricsCollector.stopCollection();
        this.logger.info('MetricsCollector stopped');
      }

      if (this.asyncMetricsTracker) {
        this.asyncMetricsTracker.stopAggregation();
        this.logger.info('AsyncMetricsTracker stopped');
      }

      this.isStarted = false;
      this.logger.info('MonitoringIntegration stopped');
    } catch (error) {
      this.logger.error('Error stopping MonitoringIntegration', {
        error: error.message,
      });
    }
  }

  /**
   * Setup integrations between components
   * @private
   */
  setupComponentIntegrations() {
    // Connect HealthMonitor to AlertingSystem
    if (this.healthMonitor && this.alertingSystem) {
      this.healthMonitor.on('alert', async (alertData) => {
        try {
          await this.alertingSystem.evaluateMetrics(alertData.provider, {
            isHealthy: alertData.type !== 'connectivity_failure',
            consecutiveFailures: alertData.data?.consecutiveFailures || 0,
            errorRate: alertData.data?.errorRate || 0,
            avgResponseTime: alertData.data?.avgResponseTime || 0,
            circuitBreakerState:
              alertData.data?.circuitBreakerState || 'closed',
            queueLength: alertData.data?.queueLength || 0,
            memoryUsage: this.getSystemMemoryUsage(),
            cpuUsage: this.getSystemCpuUsage(),
          });
        } catch (error) {
          this.logger.error('Error processing health monitor alert', {
            error: error.message,
            alertData,
          });
        }
      });

      this.logger.debug('HealthMonitor connected to AlertingSystem');
    }

    // Connect MetricsCollector to AlertingSystem
    if (this.metricsCollector && this.alertingSystem) {
      this.metricsCollector.on('metricsAggregated', async (data) => {
        try {
          await this.alertingSystem.evaluateMetrics(data.provider, {
            errorRate: data.metrics.failureRate || 0,
            avgResponseTime: data.metrics.avgResponseTime || 0,
            isHealthy: (data.metrics.successRate || 0) > 0.8,
            consecutiveFailures: 0, // This would come from provider manager
            circuitBreakerState: 'closed', // This would come from provider manager
            queueLength: 0, // This would come from provider manager
            memoryUsage: this.getSystemMemoryUsage(),
            cpuUsage: this.getSystemCpuUsage(),
          });
        } catch (error) {
          this.logger.error('Error processing metrics for alerting', {
            error: error.message,
            provider: data.provider,
          });
        }
      });

      this.logger.debug('MetricsCollector connected to AlertingSystem');
    }

    // Setup cross-component event forwarding
    this.setupEventForwarding();
  }

  /**
   * Setup event forwarding between components
   * @private
   */
  setupEventForwarding() {
    // Forward alerting events to dashboard
    if (this.alertingSystem && this.monitoringDashboard) {
      this.alertingSystem.on('alertCreated', (alert) => {
        this.monitoringDashboard.emit('alert', {
          type: 'alert_created',
          data: alert,
          timestamp: new Date(),
        });
      });

      this.alertingSystem.on('alertResolved', (alert) => {
        this.monitoringDashboard.emit('alert', {
          type: 'alert_resolved',
          data: alert,
          timestamp: new Date(),
        });
      });
    }

    // Forward health events to dashboard
    if (this.healthMonitor && this.monitoringDashboard) {
      this.healthMonitor.on('healthCheckCompleted', (data) => {
        this.monitoringDashboard.emit('healthUpdate', data);
      });

      this.healthMonitor.on('healthCheckFailed', (data) => {
        this.monitoringDashboard.emit('healthUpdate', {
          ...data,
          healthy: false,
        });
      });
    }

    // Forward metrics events to dashboard
    if (this.metricsCollector && this.monitoringDashboard) {
      this.metricsCollector.on('realtimeMetricsUpdated', (data) => {
        this.monitoringDashboard.emit('metricsUpdate', data);
      });
    }
  }

  /**
   * Record request start across all monitoring components
   * @param {string} provider - Provider name
   * @param {Object} requestData - Request metadata
   * @returns {string} Request ID for tracking
   */
  recordRequestStart(provider, requestData = {}) {
    let requestId = null;

    if (this.metricsCollector) {
      requestId = this.metricsCollector.recordRequestStart(
        provider,
        requestData
      );
    }

    return (
      requestId ||
      `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    );
  }

  /**
   * Record request completion across all monitoring components
   * @param {string} requestId - Request ID
   * @param {Object} result - Request result
   */
  recordRequestEnd(requestId, result = {}) {
    if (this.metricsCollector) {
      this.metricsCollector.recordRequestEnd(requestId, result);
    }
  }

  /**
   * Get comprehensive monitoring status
   * @returns {Object} Monitoring status
   */
  getMonitoringStatus() {
    return {
      initialized: this.isInitialized,
      started: this.isStarted,
      components: {
        metricsCollector: {
          enabled: this.config.enableMetrics,
          active: !!this.metricsCollector && this.isStarted,
        },
        alertingSystem: {
          enabled: this.config.enableAlerting,
          active: !!this.alertingSystem,
          activeAlerts: this.alertingSystem?.getActiveAlerts()?.length || 0,
        },
        healthMonitor: {
          enabled: this.config.enableHealthMonitoring,
          active: !!this.healthMonitor && this.isStarted,
        },
        monitoringDashboard: {
          enabled: this.config.enableDashboard,
          active: !!this.monitoringDashboard && this.isStarted,
          webPort: this.config.dashboard?.webPort || 3001,
        },
        asyncMetricsTracker: {
          enabled: this.config.enableAsyncMetrics,
          active: !!this.asyncMetricsTracker,
        },
      },
      timestamp: new Date(),
    };
  }

  /**
   * Get comprehensive metrics report
   * @param {Object} options - Report options
   * @returns {Object} Metrics report
   */
  getMetricsReport(options = {}) {
    const report = {
      timestamp: new Date(),
      monitoring: this.getMonitoringStatus(),
    };

    if (this.metricsCollector) {
      report.metrics = this.metricsCollector.getMetricsReport(null, options);
    }

    if (this.alertingSystem) {
      report.alerts = {
        active: this.alertingSystem.getActiveAlerts(),
        statistics: this.alertingSystem.getAlertStatistics(),
      };
    }

    if (this.healthMonitor) {
      report.health = this.healthMonitor.getHealthReport();
    }

    if (this.monitoringDashboard) {
      report.dashboard = this.monitoringDashboard.getDashboardData();
    }

    if (this.asyncMetricsTracker) {
      report.asyncMetrics = {
        realtime: this.asyncMetricsTracker.getRealtimeMetrics(),
        aggregated: this.asyncMetricsTracker.getAggregatedMetrics(
          options.timeRange || 3600000
        ),
      };
    }

    return report;
  }

  /**
   * Get provider-specific monitoring data
   * @param {string} provider - Provider name
   * @returns {Object} Provider monitoring data
   */
  getProviderMonitoringData(provider) {
    const data = {
      provider,
      timestamp: new Date(),
    };

    if (this.metricsCollector) {
      data.metrics = this.metricsCollector.getMetricsReport(provider);
    }

    if (this.alertingSystem) {
      data.alerts = this.alertingSystem.getActiveAlerts({ provider });
    }

    if (this.healthMonitor) {
      const healthReport = this.healthMonitor.getHealthReport();
      data.health = healthReport.providers[provider] || null;
    }

    if (this.monitoringDashboard) {
      try {
        data.dashboard =
          this.monitoringDashboard.getProviderDashboardData(provider);
      } catch (error) {
        data.dashboard = null;
      }
    }

    return data;
  }

  /**
   * Export all monitoring data
   * @param {Object} options - Export options
   * @returns {Object} Exported monitoring data
   */
  exportMonitoringData(options = {}) {
    const exportData = {
      timestamp: new Date(),
      timeRange: options.timeRange || '24h',
      format: options.format || 'json',
      monitoring: this.getMonitoringStatus(),
    };

    if (this.metricsCollector) {
      exportData.metrics = this.metricsCollector.exportMetrics(options);
    }

    if (this.alertingSystem) {
      exportData.alerts = this.alertingSystem.exportAlerts(options);
    }

    if (this.monitoringDashboard) {
      exportData.dashboard =
        this.monitoringDashboard.exportDashboardData(options);
    }

    return exportData;
  }

  /**
   * Get system memory usage
   * @private
   */
  getSystemMemoryUsage() {
    try {
      const memUsage = process.memoryUsage();
      const os = require('os');
      return memUsage.rss / os.totalmem();
    } catch (error) {
      return 0;
    }
  }

  /**
   * Get system CPU usage (approximate)
   * @private
   */
  getSystemCpuUsage() {
    try {
      const cpuUsage = process.cpuUsage();
      const os = require('os');
      return (cpuUsage.user + cpuUsage.system) / 1000000 / os.cpus().length;
    } catch (error) {
      return 0;
    }
  }

  /**
   * Setup graceful shutdown
   */
  setupGracefulShutdown() {
    if (!this.config.gracefulShutdown) return;

    const shutdown = async (signal) => {
      this.logger.info(
        `${signal} received, shutting down monitoring gracefully`
      );
      try {
        await this.stop();
        this.logger.info('Monitoring shutdown completed');
      } catch (error) {
        this.logger.error('Error during monitoring shutdown', {
          error: error.message,
        });
      }
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  }

  /**
   * Cleanup all resources
   */
  async destroy() {
    try {
      await this.stop();

      if (this.monitoringDashboard) {
        this.monitoringDashboard.destroy();
      }

      if (this.healthMonitor) {
        this.healthMonitor.destroy();
      }

      if (this.metricsCollector) {
        this.metricsCollector.destroy();
      }

      if (this.alertingSystem) {
        this.alertingSystem.destroy();
      }

      if (this.asyncMetricsTracker) {
        this.asyncMetricsTracker.destroy();
      }

      this.isInitialized = false;
      this.isStarted = false;

      this.logger.info('MonitoringIntegration destroyed');
    } catch (error) {
      this.logger.error('Error destroying MonitoringIntegration', {
        error: error.message,
      });
    }
  }
}

module.exports = MonitoringIntegration;
