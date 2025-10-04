// middleware/monitoringMiddleware.js
// Express middleware for comprehensive monitoring integration

const MonitoringIntegration = require('../monitoring/MonitoringIntegration');
const StructuredLogger = require('../monitoring/StructuredLogger');

/**
 * Monitoring Middleware - Integrates monitoring into Express application
 */
class MonitoringMiddleware {
  constructor(config = {}) {
    this.config = {
      enableRequestTracking: config.enableRequestTracking !== false,
      enablePerformanceTracking: config.enablePerformanceTracking !== false,
      enableErrorTracking: config.enableErrorTracking !== false,
      enableHealthEndpoints: config.enableHealthEndpoints !== false,
      enableMetricsEndpoints: config.enableMetricsEndpoints !== false,

      // Monitoring integration config
      monitoring: config.monitoring || {},

      // Structured logging config
      logging: config.logging || {},

      // Endpoint configurations
      healthEndpoint: config.healthEndpoint || '/monitoring/health',
      metricsEndpoint: config.metricsEndpoint || '/monitoring/metrics',
      alertsEndpoint: config.alertsEndpoint || '/monitoring/alerts',
      dashboardEndpoint: config.dashboardEndpoint || '/monitoring/dashboard',

      ...config,
    };

    // Initialize components
    this.monitoringIntegration = null;
    this.structuredLogger = null;
    this.isInitialized = false;

    console.log('MonitoringMiddleware initialized', { config: this.config });
  }

  /**
   * Initialize monitoring components
   * @param {Object} dependencies - Required dependencies
   */
  async initialize(dependencies = {}) {
    if (this.isInitialized) {
      console.warn('MonitoringMiddleware already initialized');
      return;
    }

    try {
      // Initialize structured logger
      this.structuredLogger = new StructuredLogger(this.config.logging);

      // Initialize monitoring integration
      this.monitoringIntegration = new MonitoringIntegration(
        this.config.monitoring
      );
      await this.monitoringIntegration.initialize(dependencies);

      this.isInitialized = true;
      this.structuredLogger.info('MonitoringMiddleware fully initialized');
    } catch (error) {
      console.error(
        'Failed to initialize MonitoringMiddleware:',
        error.message
      );
      throw error;
    }
  }

  /**
   * Get request tracking middleware
   * @returns {Function} Express middleware
   */
  getRequestTrackingMiddleware() {
    if (!this.config.enableRequestTracking) {
      return (req, res, next) => next();
    }

    return (req, res, next) => {
      if (!this.structuredLogger) {
        return next();
      }

      // Start request tracking
      const requestId = this.structuredLogger.startRequest(req);
      req.requestId = requestId;

      // Track request start time
      req.startTime = Date.now();

      // Override res.end to capture response
      const originalEnd = res.end;
      res.end = (...args) => {
        // End request tracking
        this.structuredLogger.endRequest(requestId, res, {
          requestId,
          duration: Date.now() - req.startTime,
        });

        // Call original end
        originalEnd.apply(res, args);
      };

      next();
    };
  }

  /**
   * Get performance tracking middleware
   * @returns {Function} Express middleware
   */
  getPerformanceTrackingMiddleware() {
    if (!this.config.enablePerformanceTracking) {
      return (req, res, next) => next();
    }

    return (req, res, next) => {
      if (!this.structuredLogger) {
        return next();
      }

      const startTime = Date.now();

      // Override res.end to capture performance
      const originalEnd = res.end;
      res.end = (...args) => {
        const duration = Date.now() - startTime;

        // Track performance
        this.structuredLogger.trackPerformance('http_request', duration, {
          method: req.method,
          path: req.path,
          statusCode: res.statusCode,
          success: res.statusCode < 400,
        });

        // Call original end
        originalEnd.apply(res, args);
      };

      next();
    };
  }

  /**
   * Get error tracking middleware
   * @returns {Function} Express middleware
   */
  getErrorTrackingMiddleware() {
    if (!this.config.enableErrorTracking) {
      return (err, req, res, next) => next(err);
    }

    return (err, req, res, next) => {
      if (!this.structuredLogger) {
        return next(err);
      }

      // Log error with context
      this.structuredLogger.error(
        'Request error occurred',
        err,
        {
          requestId: req.requestId,
          method: req.method,
          url: req.url,
          statusCode: res.statusCode,
          userAgent: req.get('User-Agent'),
          ip: req.ip,
        },
        {
          request: {
            method: req.method,
            url: req.url,
            headers: req.headers,
            query: req.query,
            body: req.body,
          },
          response: {
            statusCode: res.statusCode,
            headers: res.getHeaders(),
          },
        }
      );

      next(err);
    };
  }

  /**
   * Get AI request tracking middleware
   * @returns {Object} AI tracking functions
   */
  getAITrackingMiddleware() {
    return {
      startAIRequest: (provider, operation, requestData = {}) => {
        if (!this.structuredLogger) return null;
        return this.structuredLogger.startAIRequest(
          provider,
          operation,
          requestData
        );
      },

      endAIRequest: (requestId, result = {}) => {
        if (!this.structuredLogger) return;
        this.structuredLogger.endAIRequest(requestId, result);
      },

      recordRequestStart: (provider, requestData = {}) => {
        if (!this.monitoringIntegration) return null;

        // Also record in async metrics tracker
        if (this.monitoringIntegration.asyncMetricsTracker) {
          this.monitoringIntegration.asyncMetricsTracker.recordRequest(
            provider
          );
        }

        return this.monitoringIntegration.recordRequestStart(
          provider,
          requestData
        );
      },

      recordRequestEnd: (requestId, result = {}) => {
        if (!this.monitoringIntegration) return;
        this.monitoringIntegration.recordRequestEnd(requestId, result);
      },

      // Async metrics tracking functions
      recordPromiseDetection: (location, provider, context = {}) => {
        if (this.monitoringIntegration?.asyncMetricsTracker) {
          this.monitoringIntegration.asyncMetricsTracker.recordPromiseDetection(
            location,
            provider,
            context
          );
        }
      },

      recordExtraction: (provider, success, error = null) => {
        if (this.monitoringIntegration?.asyncMetricsTracker) {
          this.monitoringIntegration.asyncMetricsTracker.recordExtraction(
            provider,
            success,
            error
          );
        }
      },

      record502Error: (provider, reason, context = {}) => {
        if (this.monitoringIntegration?.asyncMetricsTracker) {
          this.monitoringIntegration.asyncMetricsTracker.record502Error(
            provider,
            reason,
            context
          );
        }
      },

      recordFallbackUsage: (
        provider,
        reason,
        fallbackType = 'local_generation'
      ) => {
        if (this.monitoringIntegration?.asyncMetricsTracker) {
          this.monitoringIntegration.asyncMetricsTracker.recordFallbackUsage(
            provider,
            reason,
            fallbackType
          );
        }
      },
    };
  }

  /**
   * Setup monitoring endpoints
   * @param {Object} app - Express application
   */
  setupMonitoringEndpoints(app) {
    if (
      !this.config.enableHealthEndpoints &&
      !this.config.enableMetricsEndpoints
    ) {
      return;
    }

    // Health endpoint
    if (this.config.enableHealthEndpoints) {
      app.get(this.config.healthEndpoint, (req, res) => {
        try {
          const healthData = {
            service: 'mcp-gateway',
            status: 'healthy',
            timestamp: new Date().toISOString(),
            monitoring:
              this.monitoringIntegration?.getMonitoringStatus() || null,
            uptime: process.uptime(),
            memory: process.memoryUsage(),
            version: process.env.npm_package_version || '1.0.0',
          };

          res.json(healthData);
        } catch (error) {
          res.status(500).json({
            service: 'mcp-gateway',
            status: 'unhealthy',
            error: error.message,
            timestamp: new Date().toISOString(),
          });
        }
      });
    }

    // Metrics endpoint
    if (this.config.enableMetricsEndpoints) {
      app.get(this.config.metricsEndpoint, (req, res) => {
        try {
          const timeRange = req.query.timeRange || '1h';
          const provider = req.query.provider || null;

          let metricsData;

          if (provider) {
            metricsData =
              this.monitoringIntegration?.getProviderMonitoringData(provider);
          } else {
            metricsData = this.monitoringIntegration?.getMetricsReport({
              timeRange,
            });
          }

          // Add logging statistics
          if (this.structuredLogger) {
            metricsData.logging = {
              performance: this.structuredLogger.getPerformanceStats(),
              errors: this.structuredLogger.getErrorStats(),
              activeRequests: this.structuredLogger.getActiveRequests().length,
            };
          }

          res.json({
            success: true,
            data: metricsData,
            timestamp: new Date().toISOString(),
          });
        } catch (error) {
          res.status(500).json({
            success: false,
            error: error.message,
            timestamp: new Date().toISOString(),
          });
        }
      });

      // Alerts endpoint
      app.get(this.config.alertsEndpoint, (req, res) => {
        try {
          const alertingSystem = this.monitoringIntegration?.alertingSystem;

          if (!alertingSystem) {
            return res.status(503).json({
              success: false,
              error: 'Alerting system not available',
            });
          }

          const filters = {
            provider: req.query.provider,
            severity: req.query.severity,
            status: req.query.status,
          };

          const alertsData = {
            active: alertingSystem.getActiveAlerts(filters),
            statistics: alertingSystem.getAlertStatistics(),
            history: alertingSystem.getAlertHistory({
              timeRange: parseInt(req.query.timeRange) || 86400000, // 24 hours
              ...filters,
            }),
          };

          res.json({
            success: true,
            data: alertsData,
            timestamp: new Date().toISOString(),
          });
        } catch (error) {
          res.status(500).json({
            success: false,
            error: error.message,
            timestamp: new Date().toISOString(),
          });
        }
      });

      // Dashboard data endpoint
      app.get(this.config.dashboardEndpoint, (req, res) => {
        try {
          const dashboard = this.monitoringIntegration?.monitoringDashboard;

          if (!dashboard) {
            return res.status(503).json({
              success: false,
              error: 'Monitoring dashboard not available',
            });
          }

          const provider = req.query.provider;
          let dashboardData;

          if (provider) {
            dashboardData = dashboard.getProviderDashboardData(provider);
          } else {
            dashboardData = dashboard.getDashboardData();
          }

          res.json({
            success: true,
            data: dashboardData,
            timestamp: new Date().toISOString(),
          });
        } catch (error) {
          res.status(500).json({
            success: false,
            error: error.message,
            timestamp: new Date().toISOString(),
          });
        }
      });

      // Export endpoint
      app.get('/monitoring/export', (req, res) => {
        try {
          const format = req.query.format || 'json';
          const timeRange = req.query.timeRange || '24h';

          const exportData = this.monitoringIntegration?.exportMonitoringData({
            format,
            timeRange,
          });

          // Add logging export
          if (this.structuredLogger) {
            exportData.logging = this.structuredLogger.exportLogs({
              timeRange: this.parseTimeRange(timeRange),
            });
          }

          if (format === 'json') {
            res.json(exportData);
          } else {
            res.status(400).json({
              success: false,
              error: 'Unsupported export format',
              supportedFormats: ['json'],
            });
          }
        } catch (error) {
          res.status(500).json({
            success: false,
            error: error.message,
            timestamp: new Date().toISOString(),
          });
        }
      });

      // Async metrics endpoint
      app.get('/monitoring/async-metrics', (req, res) => {
        try {
          const asyncTracker = this.monitoringIntegration?.asyncMetricsTracker;

          if (!asyncTracker) {
            return res.status(503).json({
              success: false,
              error: 'Async metrics tracker not available',
            });
          }

          const timeRange = parseInt(req.query.timeRange) || 3600000; // 1 hour default
          const provider = req.query.provider;

          let metricsData;
          if (provider) {
            metricsData = asyncTracker.getProviderMetrics(provider, timeRange);
          } else {
            metricsData = {
              realtime: asyncTracker.getRealtimeMetrics(),
              aggregated: asyncTracker.getAggregatedMetrics(timeRange),
            };
          }

          res.json({
            success: true,
            data: metricsData,
            timestamp: new Date().toISOString(),
          });
        } catch (error) {
          res.status(500).json({
            success: false,
            error: error.message,
            timestamp: new Date().toISOString(),
          });
        }
      });

      // Async metrics time series endpoint
      app.get('/monitoring/async-metrics/timeseries', (req, res) => {
        try {
          const asyncTracker = this.monitoringIntegration?.asyncMetricsTracker;

          if (!asyncTracker) {
            return res.status(503).json({
              success: false,
              error: 'Async metrics tracker not available',
            });
          }

          const metric = req.query.metric || 'extractionSuccessRate';
          const timeRange = parseInt(req.query.timeRange) || 3600000;

          const validMetrics = [
            'promiseDetections',
            'extractionSuccessRate',
            'error502Rate',
            'fallbackUsageRate',
          ];

          if (!validMetrics.includes(metric)) {
            return res.status(400).json({
              success: false,
              error: 'Invalid metric',
              validMetrics,
            });
          }

          const timeSeries = asyncTracker.getTimeSeries(metric, timeRange);

          res.json({
            success: true,
            data: {
              metric,
              timeRange,
              timeSeries,
            },
            timestamp: new Date().toISOString(),
          });
        } catch (error) {
          res.status(500).json({
            success: false,
            error: error.message,
            timestamp: new Date().toISOString(),
          });
        }
      });
    }

    console.log('Monitoring endpoints setup completed', {
      healthEndpoint: this.config.healthEndpoint,
      metricsEndpoint: this.config.metricsEndpoint,
      alertsEndpoint: this.config.alertsEndpoint,
      dashboardEndpoint: this.config.dashboardEndpoint,
    });
  }

  /**
   * Parse time range string to milliseconds
   * @param {string} timeRange - Time range string
   * @returns {number} Milliseconds
   * @private
   */
  parseTimeRange(timeRange) {
    const units = {
      m: 60000, // minutes
      h: 3600000, // hours
      d: 86400000, // days
    };

    const match = timeRange.match(/^(\d+)([mhd])$/);
    if (!match) return 3600000; // Default to 1 hour

    const [, amount, unit] = match;
    return parseInt(amount) * (units[unit] || 3600000);
  }

  /**
   * Get comprehensive middleware setup
   * @returns {Object} Middleware functions
   */
  getMiddleware() {
    return {
      requestTracking: this.getRequestTrackingMiddleware(),
      performanceTracking: this.getPerformanceTrackingMiddleware(),
      errorTracking: this.getErrorTrackingMiddleware(),
      aiTracking: this.getAITrackingMiddleware(),
    };
  }

  /**
   * Setup all monitoring middleware and endpoints
   * @param {Object} app - Express application
   * @param {Object} dependencies - Dependencies for monitoring
   */
  async setup(app, dependencies = {}) {
    // Initialize if not already done
    if (!this.isInitialized) {
      await this.initialize(dependencies);
    }

    // Setup middleware
    const middleware = this.getMiddleware();

    // Apply request tracking middleware
    if (this.config.enableRequestTracking) {
      app.use(middleware.requestTracking);
    }

    // Apply performance tracking middleware
    if (this.config.enablePerformanceTracking) {
      app.use(middleware.performanceTracking);
    }

    // Setup monitoring endpoints
    this.setupMonitoringEndpoints(app);

    // Apply error tracking middleware (should be last)
    if (this.config.enableErrorTracking) {
      app.use(middleware.errorTracking);
    }

    // Store AI tracking functions on app for use in routes
    app.aiTracking = middleware.aiTracking;

    console.log('MonitoringMiddleware setup completed');
  }

  /**
   * Record a request for monitoring (delegates to monitoring integration)
   * @param {string} provider - Provider name
   * @param {Object} requestData - Request data
   */
  recordRequest(provider, requestData) {
    try {
      if (
        this.monitoringIntegration &&
        this.monitoringIntegration.metricsCollector
      ) {
        this.monitoringIntegration.metricsCollector.recordRequest(
          provider,
          requestData
        );
      }
    } catch (error) {
      // Fail gracefully - monitoring failures shouldn't crash the main system
      console.warn('Failed to record request metric:', error.message);
    }
  }

  /**
   * Get dashboard data
   * @returns {Object} Dashboard data
   */
  getDashboardData() {
    if (
      !this.monitoringIntegration ||
      !this.monitoringIntegration.monitoringDashboard
    ) {
      return {
        system: { uptime: process.uptime() },
        providers: [],
        metrics: { totalRequests: 0 },
        alerts: [],
        health: { status: 'unknown' },
      };
    }

    return this.monitoringIntegration.monitoringDashboard.getDashboardData();
  }

  /**
   * Get chart data for monitoring dashboard
   * @param {Object} options - Chart options
   * @returns {Object} Chart data
   */
  getChartData(options = {}) {
    if (
      !this.monitoringIntegration ||
      !this.monitoringIntegration.monitoringDashboard
    ) {
      return {
        labels: [],
        data: [],
      };
    }

    return this.monitoringIntegration.monitoringDashboard.getChartData(options);
  }

  /**
   * Get resource metrics
   * @returns {Object} Resource metrics
   */
  getResourceMetrics() {
    const memoryUsage = process.memoryUsage();

    return {
      memory: {
        used: memoryUsage.heapUsed,
        total: memoryUsage.heapTotal,
        external: memoryUsage.external,
      },
      cpu: {
        usage: process.cpuUsage().user / 1000000, // Convert to seconds
      },
      uptime: process.uptime(),
    };
  }

  /**
   * Detect performance bottlenecks
   * @param {string} provider - Provider name
   * @returns {Array} Detected bottlenecks
   */
  detectBottlenecks(provider) {
    if (
      !this.monitoringIntegration ||
      !this.monitoringIntegration.metricsCollector
    ) {
      return [];
    }

    try {
      const metrics =
        this.monitoringIntegration.metricsCollector.getProviderMetrics(
          provider
        );
      const bottlenecks = [];

      // Check for high response time variance
      if (metrics.averageResponseTime > 1000) {
        bottlenecks.push({
          type: 'response_time_variance',
          severity: 'medium',
          description: `High response time detected: ${metrics.averageResponseTime}ms`,
        });
      }

      return bottlenecks;
    } catch (error) {
      console.warn('Failed to detect bottlenecks:', error.message);
      return [];
    }
  }

  /**
   * Get performance recommendations
   * @returns {Array} Performance recommendations
   */
  getPerformanceRecommendations() {
    const recommendations = [];

    if (
      this.monitoringIntegration &&
      this.monitoringIntegration.metricsCollector
    ) {
      try {
        const aggregatedMetrics =
          this.monitoringIntegration.metricsCollector.getAggregatedMetrics();

        if (aggregatedMetrics.errorRate > 0.1) {
          recommendations.push({
            type: 'error_rate',
            priority: 'high',
            description:
              'High error rate detected. Consider implementing retry logic or checking provider configurations.',
          });
        }

        if (aggregatedMetrics.averageResponseTime > 5000) {
          recommendations.push({
            type: 'response_time',
            priority: 'medium',
            description:
              'High response times detected. Consider implementing request timeouts or load balancing.',
          });
        }
      } catch (error) {
        console.warn(
          'Failed to generate performance recommendations:',
          error.message
        );
      }
    }

    return recommendations;
  }

  /**
   * Add external monitoring system
   * @param {Object} externalSystem - External monitoring system
   */
  addExternalMonitoring(externalSystem) {
    if (!this.externalMonitoringSystems) {
      this.externalMonitoringSystems = [];
    }
    this.externalMonitoringSystems.push(externalSystem);
  }

  /**
   * Send metrics to external monitoring systems
   */
  async sendExternalMetrics() {
    if (
      !this.externalMonitoringSystems ||
      this.externalMonitoringSystems.length === 0
    ) {
      return;
    }

    try {
      const metrics = this.getDashboardData();
      const timestamp = Date.now();

      for (const system of this.externalMonitoringSystems) {
        if (system.sendMetric) {
          await system.sendMetric({
            timestamp,
            metrics,
          });
        }
      }
    } catch (error) {
      console.warn('Failed to send external metrics:', error.message);
    }
  }

  /**
   * Get monitoring status
   * @returns {Object} Monitoring status
   */
  getStatus() {
    return {
      initialized: this.isInitialized,
      components: {
        monitoringIntegration: !!this.monitoringIntegration,
        structuredLogger: !!this.structuredLogger,
      },
      config: this.config,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Cleanup resources
   */
  async destroy() {
    try {
      if (this.monitoringIntegration) {
        await this.monitoringIntegration.destroy();
      }

      if (
        this.structuredLogger &&
        typeof this.structuredLogger.destroy === 'function'
      ) {
        this.structuredLogger.destroy();
      }

      this.isInitialized = false;
      console.log('MonitoringMiddleware destroyed');
    } catch (error) {
      console.error('Error destroying MonitoringMiddleware:', error.message);
    }
  }
}

module.exports = MonitoringMiddleware;
