// monitoring/MonitoringDashboard.js
// Real-time monitoring dashboard for AI provider performance

const EventEmitter = require('events');
const winston = require('winston');

/**
 * Monitoring Dashboard - Real-time provider performance monitoring and visualization
 */
class MonitoringDashboard extends EventEmitter {
  constructor(config = {}) {
    super();

    this.config = {
      updateInterval: config.updateInterval || 5000, // 5 seconds
      historyRetention: config.historyRetention || 3600000, // 1 hour
      maxDataPoints: config.maxDataPoints || 720, // 1 hour at 5-second intervals
      enableRealTimeUpdates: config.enableRealTimeUpdates !== false,
      enableWebInterface: config.enableWebInterface !== false,
      webPort: config.webPort || 3001,
      ...config,
    };

    // Dashboard data storage
    this.dashboardData = {
      providers: new Map(), // provider -> current metrics
      systemMetrics: {
        cpu: 0,
        memory: 0,
        uptime: 0,
        requestsPerSecond: 0,
        activeConnections: 0,
      },
      alerts: {
        active: [],
        recent: [],
      },
      performance: {
        overall: {
          successRate: 0,
          avgResponseTime: 0,
          totalRequests: 0,
          totalErrors: 0,
        },
        trends: new Map(), // provider -> time series data
      },
    };

    // Time series data for charts
    this.timeSeriesData = new Map(); // provider -> Array<DataPoint>
    this.systemTimeSeriesData = []; // System metrics over time

    // Connected clients for real-time updates
    this.connectedClients = new Set();

    // Update interval
    this.updateInterval = null;

    // Logger setup
    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      transports: [
        new winston.transports.File({
          filename: 'logs/monitoring-dashboard.log',
          maxsize: 5242880, // 5MB
          maxFiles: 3,
        }),
        new winston.transports.Console({
          format: winston.format.simple(),
        }),
      ],
    });

    this.logger.info('MonitoringDashboard initialized', {
      config: this.config,
    });
  }

  /**
   * Start monitoring dashboard
   * @param {Object} dependencies - Required dependencies
   */
  start(dependencies = {}) {
    this.providerManager = dependencies.providerManager;
    this.metricsCollector = dependencies.metricsCollector;
    this.alertingSystem = dependencies.alertingSystem;
    this.healthMonitor = dependencies.healthMonitor;

    // Start periodic updates
    if (this.config.enableRealTimeUpdates) {
      this.startPeriodicUpdates();
    }

    // Setup event listeners
    this.setupEventListeners();

    // Start web interface if enabled
    if (this.config.enableWebInterface) {
      this.startWebInterface();
    }

    this.logger.info('MonitoringDashboard started');
  }

  /**
   * Stop monitoring dashboard
   */
  stop() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }

    if (this.webServer) {
      this.webServer.close();
      this.webServer = null;
    }

    this.connectedClients.clear();
    this.removeAllListeners();

    this.logger.info('MonitoringDashboard stopped');
  }

  /**
   * Start periodic dashboard updates
   * @private
   */
  startPeriodicUpdates() {
    this.updateInterval = setInterval(async () => {
      try {
        await this.updateDashboardData();
        this.broadcastUpdate();
      } catch (error) {
        this.logger.error('Error updating dashboard data', {
          error: error.message,
        });
      }
    }, this.config.updateInterval);
  }

  /**
   * Setup event listeners for real-time updates
   * @private
   */
  setupEventListeners() {
    // Listen to provider manager events
    if (this.providerManager) {
      this.providerManager.on('operationSuccess', (data) => {
        this.updateProviderMetrics(data.provider, {
          success: true,
          responseTime: data.responseTime,
        });
      });

      this.providerManager.on('operationFailure', (data) => {
        this.updateProviderMetrics(data.provider, {
          success: false,
          error: data.error,
        });
      });
    }

    // Listen to alerting system events
    if (this.alertingSystem) {
      this.alertingSystem.on('alertCreated', (alert) => {
        this.addAlert(alert);
        this.broadcastAlert(alert);
      });

      this.alertingSystem.on('alertResolved', (alert) => {
        this.removeAlert(alert.id);
        this.broadcastAlertResolution(alert);
      });
    }

    // Listen to health monitor events
    if (this.healthMonitor) {
      this.healthMonitor.on('healthCheckCompleted', (data) => {
        this.updateProviderHealth(data.provider, data);
      });

      this.healthMonitor.on('healthCheckFailed', (data) => {
        this.updateProviderHealth(data.provider, { ...data, healthy: false });
      });
    }

    // Listen to metrics collector events
    if (this.metricsCollector) {
      this.metricsCollector.on('metricsAggregated', (data) => {
        this.updateProviderTrends(data.provider, data.metrics);
      });
    }
  }

  /**
   * Update dashboard data
   * @private
   */
  async updateDashboardData() {
    // Update provider metrics
    await this.updateProviderData();

    // Update system metrics
    await this.updateSystemMetrics();

    // Update alerts
    await this.updateAlertsData();

    // Update performance overview
    await this.updatePerformanceOverview();

    // Clean up old data
    this.cleanupOldData();
  }

  /**
   * Update provider data
   * @private
   */
  async updateProviderData() {
    if (!this.providerManager) return;

    const providers = this.providerManager.getProviders();

    for (const providerName of providers) {
      try {
        const metrics = this.providerManager.getProviderMetrics(providerName);
        const health = this.providerManager.getProviderHealth(providerName);
        const realtimeMetrics =
          this.metricsCollector?.getRealtimeMetrics?.(providerName);

        const providerData = {
          name: providerName,
          status: health.isHealthy ? 'healthy' : 'unhealthy',
          metrics: {
            requests: metrics.requests || 0,
            successes: metrics.successes || 0,
            failures: metrics.failures || 0,
            successRate: metrics.successRate || 0,
            failureRate: metrics.failureRate || 0,
            avgResponseTime: metrics.avgResponseTime || 0,
            lastResponseTime: metrics.lastResponseTime || 0,
            consecutiveFailures: health.consecutiveFailures || 0,
            rateLimitHits: metrics.rateLimitHits || 0,
            circuitBreakerState: health.circuitBreakerState || 'closed',
            activeRequests: realtimeMetrics?.activeRequests || 0,
            requestsPerMinute: realtimeMetrics?.requestsInLastMinute || 0,
            lastActivity: health.lastActivity || null,
          },
          health: {
            isHealthy: health.isHealthy,
            lastCheck: health.lastCheck,
            uptime: health.uptime || 0,
            connectivity: health.connectivity || 'unknown',
          },
          configuration: {
            priority:
              this.providerManager.getProviderPriority?.(providerName) || 0,
            enabled:
              this.providerManager.isProviderEnabled?.(providerName) || true,
            limits:
              this.providerManager.getProviderLimits?.(providerName) || {},
          },
          timestamp: new Date(),
        };

        this.dashboardData.providers.set(providerName, providerData);

        // Add to time series data
        this.addTimeSeriesDataPoint(providerName, {
          timestamp: new Date(),
          successRate: providerData.metrics.successRate,
          responseTime: providerData.metrics.avgResponseTime,
          activeRequests: providerData.metrics.activeRequests,
          requestsPerMinute: providerData.metrics.requestsPerMinute,
        });
      } catch (error) {
        this.logger.error('Error updating provider data', {
          provider: providerName,
          error: error.message,
        });
      }
    }
  }

  /**
   * Update system metrics
   * @private
   */
  async updateSystemMetrics() {
    try {
      const process = require('process');
      const os = require('os');

      // CPU usage (approximate)
      const cpuUsage = process.cpuUsage();
      const cpuPercent =
        (cpuUsage.user + cpuUsage.system) / 1000000 / os.cpus().length;

      // Memory usage
      const memUsage = process.memoryUsage();
      const totalMem = os.totalmem();
      const memPercent = memUsage.rss / totalMem;

      // System uptime
      const uptime = process.uptime();

      // Request rate (if available)
      const requestsPerSecond = this.calculateRequestsPerSecond();

      this.dashboardData.systemMetrics = {
        cpu: Math.min(cpuPercent, 1), // Cap at 100%
        memory: memPercent,
        uptime: uptime,
        requestsPerSecond: requestsPerSecond,
        activeConnections: this.connectedClients.size,
        memoryUsage: {
          rss: memUsage.rss,
          heapTotal: memUsage.heapTotal,
          heapUsed: memUsage.heapUsed,
          external: memUsage.external,
        },
        loadAverage: os.loadavg(),
        timestamp: new Date(),
      };

      // Add to system time series
      this.systemTimeSeriesData.push({
        timestamp: new Date(),
        cpu: this.dashboardData.systemMetrics.cpu,
        memory: this.dashboardData.systemMetrics.memory,
        requestsPerSecond: requestsPerSecond,
      });

      // Keep only recent data
      if (this.systemTimeSeriesData.length > this.config.maxDataPoints) {
        this.systemTimeSeriesData = this.systemTimeSeriesData.slice(
          -this.config.maxDataPoints
        );
      }
    } catch (error) {
      this.logger.error('Error updating system metrics', {
        error: error.message,
      });
    }
  }

  /**
   * Update alerts data
   * @private
   */
  async updateAlertsData() {
    if (!this.alertingSystem) return;

    try {
      const activeAlerts = this.alertingSystem.getActiveAlerts();
      const recentAlerts = this.alertingSystem.getAlertHistory({
        timeRange: 3600000,
      }); // Last hour

      this.dashboardData.alerts = {
        active: activeAlerts.map((alert) => ({
          id: alert.id,
          severity: alert.severity,
          title: alert.title,
          message: alert.message,
          provider: alert.provider,
          createdAt: alert.createdAt,
          status: alert.status,
          escalationLevel: alert.escalationLevel,
        })),
        recent: recentAlerts.slice(0, 50).map((alert) => ({
          id: alert.id,
          severity: alert.severity,
          title: alert.title,
          provider: alert.provider,
          createdAt: alert.createdAt,
          resolvedAt: alert.resolvedAt,
          status: alert.status,
        })),
      };
    } catch (error) {
      this.logger.error('Error updating alerts data', { error: error.message });
    }
  }

  /**
   * Update performance overview
   * @private
   */
  async updatePerformanceOverview() {
    try {
      let totalRequests = 0;
      let totalSuccesses = 0;
      let totalErrors = 0;
      let totalResponseTime = 0;
      let providerCount = 0;

      for (const providerData of this.dashboardData.providers.values()) {
        totalRequests += providerData.metrics.requests;
        totalSuccesses += providerData.metrics.successes;
        totalErrors += providerData.metrics.failures;
        totalResponseTime += providerData.metrics.avgResponseTime;
        providerCount++;
      }

      this.dashboardData.performance.overall = {
        successRate: totalRequests > 0 ? totalSuccesses / totalRequests : 0,
        avgResponseTime:
          providerCount > 0 ? totalResponseTime / providerCount : 0,
        totalRequests: totalRequests,
        totalErrors: totalErrors,
        activeProviders: Array.from(
          this.dashboardData.providers.values()
        ).filter((p) => p.status === 'healthy').length,
        totalProviders: providerCount,
      };
    } catch (error) {
      this.logger.error('Error updating performance overview', {
        error: error.message,
      });
    }
  }

  /**
   * Add time series data point for provider
   * @private
   */
  addTimeSeriesDataPoint(provider, dataPoint) {
    if (!this.timeSeriesData.has(provider)) {
      this.timeSeriesData.set(provider, []);
    }

    const series = this.timeSeriesData.get(provider);
    series.push(dataPoint);

    // Keep only recent data
    if (series.length > this.config.maxDataPoints) {
      series.splice(0, series.length - this.config.maxDataPoints);
    }
  }

  /**
   * Calculate requests per second
   * @private
   */
  calculateRequestsPerSecond() {
    let totalRequestsLastMinute = 0;

    for (const providerData of this.dashboardData.providers.values()) {
      totalRequestsLastMinute += providerData.metrics.requestsPerMinute || 0;
    }

    return totalRequestsLastMinute / 60; // Convert to per second
  }

  /**
   * Update provider metrics from real-time events
   * @private
   */
  updateProviderMetrics(provider, data) {
    const providerData = this.dashboardData.providers.get(provider);
    if (!providerData) return;

    if (data.success !== undefined) {
      if (data.success) {
        providerData.metrics.successes++;
        providerData.metrics.consecutiveFailures = 0;
      } else {
        providerData.metrics.failures++;
        providerData.metrics.consecutiveFailures++;
      }

      providerData.metrics.requests++;
      providerData.metrics.successRate =
        providerData.metrics.successes / providerData.metrics.requests;
      providerData.metrics.failureRate = 1 - providerData.metrics.successRate;
    }

    if (data.responseTime) {
      providerData.metrics.lastResponseTime = data.responseTime;
      // Update running average
      const totalTime =
        providerData.metrics.avgResponseTime *
          (providerData.metrics.requests - 1) +
        data.responseTime;
      providerData.metrics.avgResponseTime =
        totalTime / providerData.metrics.requests;
    }

    providerData.timestamp = new Date();
  }

  /**
   * Update provider health from health monitor
   * @private
   */
  updateProviderHealth(provider, healthData) {
    const providerData = this.dashboardData.providers.get(provider);
    if (!providerData) return;

    providerData.health.isHealthy = healthData.healthy !== false;
    providerData.health.lastCheck = new Date();
    providerData.status = providerData.health.isHealthy
      ? 'healthy'
      : 'unhealthy';

    if (healthData.connectivity) {
      providerData.health.connectivity = healthData.connectivity;
    }

    providerData.timestamp = new Date();
  }

  /**
   * Update provider trends from metrics collector
   * @private
   */
  updateProviderTrends(provider, metrics) {
    if (!this.dashboardData.performance.trends.has(provider)) {
      this.dashboardData.performance.trends.set(provider, []);
    }

    const trends = this.dashboardData.performance.trends.get(provider);
    trends.push({
      timestamp: new Date(),
      ...metrics,
    });

    // Keep only recent trends
    if (trends.length > this.config.maxDataPoints) {
      trends.splice(0, trends.length - this.config.maxDataPoints);
    }
  }

  /**
   * Add alert to dashboard
   * @private
   */
  addAlert(alert) {
    this.dashboardData.alerts.active.push({
      id: alert.id,
      severity: alert.severity,
      title: alert.title,
      message: alert.message,
      provider: alert.provider,
      createdAt: alert.createdAt,
      status: alert.status,
      escalationLevel: alert.escalationLevel,
    });
  }

  /**
   * Remove alert from dashboard
   * @private
   */
  removeAlert(alertId) {
    this.dashboardData.alerts.active = this.dashboardData.alerts.active.filter(
      (alert) => alert.id !== alertId
    );
  }

  /**
   * Clean up old data
   * @private
   */
  cleanupOldData() {
    const cutoffTime = Date.now() - this.config.historyRetention;

    // Clean up time series data
    for (const [provider, series] of this.timeSeriesData.entries()) {
      const filteredSeries = series.filter(
        (point) => new Date(point.timestamp).getTime() > cutoffTime
      );
      this.timeSeriesData.set(provider, filteredSeries);
    }

    // Clean up system time series data
    this.systemTimeSeriesData = this.systemTimeSeriesData.filter(
      (point) => new Date(point.timestamp).getTime() > cutoffTime
    );
  }

  /**
   * Get current dashboard data
   * @returns {Object} Dashboard data
   */
  getDashboardData() {
    return {
      providers: Object.fromEntries(this.dashboardData.providers),
      systemMetrics: this.dashboardData.systemMetrics,
      alerts: this.dashboardData.alerts,
      performance: {
        ...this.dashboardData.performance,
        trends: Object.fromEntries(this.dashboardData.performance.trends),
      },
      timeSeries: Object.fromEntries(this.timeSeriesData),
      systemTimeSeries: this.systemTimeSeriesData,
      timestamp: new Date(),
    };
  }

  /**
   * Get provider-specific dashboard data
   * @param {string} provider - Provider name
   * @returns {Object} Provider dashboard data
   */
  getProviderDashboardData(provider) {
    const providerData = this.dashboardData.providers.get(provider);
    if (!providerData) {
      throw new Error(`Provider not found: ${provider}`);
    }

    return {
      provider: providerData,
      timeSeries: this.timeSeriesData.get(provider) || [],
      trends: this.dashboardData.performance.trends.get(provider) || [],
      alerts: this.dashboardData.alerts.active.filter(
        (alert) => alert.provider === provider
      ),
      timestamp: new Date(),
    };
  }

  /**
   * Broadcast update to connected clients
   * @private
   */
  broadcastUpdate() {
    if (this.connectedClients.size === 0) return;

    const updateData = {
      type: 'dashboard_update',
      data: this.getDashboardData(),
      timestamp: new Date(),
    };

    this.broadcastToClients(updateData);
  }

  /**
   * Broadcast alert to connected clients
   * @private
   */
  broadcastAlert(alert) {
    const alertData = {
      type: 'alert_created',
      data: alert,
      timestamp: new Date(),
    };

    this.broadcastToClients(alertData);
  }

  /**
   * Broadcast alert resolution to connected clients
   * @private
   */
  broadcastAlertResolution(alert) {
    const alertData = {
      type: 'alert_resolved',
      data: alert,
      timestamp: new Date(),
    };

    this.broadcastToClients(alertData);
  }

  /**
   * Broadcast data to all connected clients
   * @private
   */
  broadcastToClients(data) {
    const message = JSON.stringify(data);

    for (const client of this.connectedClients) {
      try {
        if (client.readyState === 1) {
          // WebSocket.OPEN
          client.send(message);
        } else {
          this.connectedClients.delete(client);
        }
      } catch (error) {
        this.connectedClients.delete(client);
      }
    }
  }

  /**
   * Start web interface for dashboard
   * @private
   */
  startWebInterface() {
    const express = require('express');
    const WebSocket = require('ws');
    const http = require('http');
    const path = require('path');

    const app = express();
    const server = http.createServer(app);
    const wss = new WebSocket.Server({ server });

    // Serve static files
    app.use(express.static(path.join(__dirname, 'dashboard-ui')));

    // API endpoints
    app.get('/api/dashboard', (req, res) => {
      res.json(this.getDashboardData());
    });

    app.get('/api/provider/:provider', (req, res) => {
      try {
        const data = this.getProviderDashboardData(req.params.provider);
        res.json(data);
      } catch (error) {
        res.status(404).json({ error: error.message });
      }
    });

    app.get('/api/alerts', (req, res) => {
      res.json(this.dashboardData.alerts);
    });

    app.get('/api/metrics/export', (req, res) => {
      const timeRange = parseInt(req.query.timeRange) || 3600000; // 1 hour default
      const exportData = {
        timestamp: new Date(),
        timeRange,
        providers: Object.fromEntries(this.dashboardData.providers),
        timeSeries: Object.fromEntries(this.timeSeriesData),
        systemTimeSeries: this.systemTimeSeriesData,
        alerts: this.dashboardData.alerts,
      };
      res.json(exportData);
    });

    // WebSocket connections for real-time updates
    wss.on('connection', (ws) => {
      this.connectedClients.add(ws);

      // Send initial data
      ws.send(
        JSON.stringify({
          type: 'initial_data',
          data: this.getDashboardData(),
          timestamp: new Date(),
        })
      );

      ws.on('close', () => {
        this.connectedClients.delete(ws);
      });

      ws.on('error', (error) => {
        this.logger.error('WebSocket error', { error: error.message });
        this.connectedClients.delete(ws);
      });
    });

    server.listen(this.config.webPort, () => {
      this.logger.info(
        `Monitoring dashboard web interface started on port ${this.config.webPort}`
      );
    });

    this.webServer = server;
  }

  /**
   * Export dashboard data
   * @param {Object} options - Export options
   * @returns {Object} Exported data
   */
  exportDashboardData(options = {}) {
    const timeRange = options.timeRange || 3600000; // 1 hour
    const format = options.format || 'json';

    const exportData = {
      timestamp: new Date(),
      timeRange,
      format,
      dashboard: this.getDashboardData(),
      configuration: this.config,
    };

    return exportData;
  }

  /**
   * Cleanup resources
   */
  destroy() {
    this.stop();
    this.dashboardData.providers.clear();
    this.timeSeriesData.clear();
    this.systemTimeSeriesData.length = 0;
    this.removeAllListeners();
    this.logger.info('MonitoringDashboard destroyed');
  }
}

module.exports = MonitoringDashboard;
