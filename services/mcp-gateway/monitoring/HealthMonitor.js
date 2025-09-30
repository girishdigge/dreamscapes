// monitoring/HealthMonitor.js
// Enhanced health monitoring system for AI providers

const EventEmitter = require('events');
const winston = require('winston');

/**
 * Health Monitor - Comprehensive provider health monitoring and alerting
 */
class HealthMonitor extends EventEmitter {
  constructor(config = {}) {
    super();

    this.config = {
      healthCheckInterval: config.healthCheckInterval || 30000, // 30 seconds
      detailedCheckInterval: config.detailedCheckInterval || 300000, // 5 minutes
      alertThresholds: {
        consecutiveFailures: config.consecutiveFailures || 3,
        responseTimeThreshold: config.responseTimeThreshold || 10000, // 10 seconds
        successRateThreshold: config.successRateThreshold || 0.8, // 80%
        errorRateThreshold: config.errorRateThreshold || 0.2, // 20%
      },
      retentionPeriod: config.retentionPeriod || 86400000, // 24 hours
      ...config,
    };

    // Health check history
    this.healthHistory = new Map(); // provider_name -> Array<HealthCheckResult>
    this.alertHistory = new Map(); // provider_name -> Array<Alert>
    this.lastAlerts = new Map(); // provider_name -> timestamp of last alert

    // Monitoring intervals
    this.basicHealthInterval = null;
    this.detailedHealthInterval = null;

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
          filename: 'logs/health-monitor.log',
          maxsize: 10485760, // 10MB
          maxFiles: 5,
        }),
        new winston.transports.Console({
          format: winston.format.simple(),
        }),
      ],
    });

    this.logger.info('HealthMonitor initialized', { config: this.config });
  }

  /**
   * Start health monitoring for all providers
   * @param {ProviderManager} providerManager - Provider manager instance
   */
  startMonitoring(providerManager) {
    this.providerManager = providerManager;

    // Start basic health checks
    this.basicHealthInterval = setInterval(async () => {
      await this.performBasicHealthChecks();
    }, this.config.healthCheckInterval);

    // Start detailed health checks
    this.detailedHealthInterval = setInterval(async () => {
      await this.performDetailedHealthChecks();
    }, this.config.detailedCheckInterval);

    // Listen to provider manager events
    this.setupProviderManagerListeners();

    this.logger.info('Health monitoring started', {
      basicInterval: this.config.healthCheckInterval,
      detailedInterval: this.config.detailedCheckInterval,
    });
  }

  /**
   * Stop health monitoring
   */
  stopMonitoring() {
    if (this.basicHealthInterval) {
      clearInterval(this.basicHealthInterval);
      this.basicHealthInterval = null;
    }

    if (this.detailedHealthInterval) {
      clearInterval(this.detailedHealthInterval);
      this.detailedHealthInterval = null;
    }

    this.logger.info('Health monitoring stopped');
  }

  /**
   * Perform basic health checks on all providers
   * @private
   */
  async performBasicHealthChecks() {
    if (!this.providerManager) return;

    const providers = Array.from(this.providerManager.providers.keys());
    const checkPromises = providers.map(async (providerName) => {
      try {
        const startTime = Date.now();
        const result = await this.performProviderHealthCheck(providerName);
        const responseTime = Date.now() - startTime;

        this.recordHealthCheck(providerName, {
          type: 'basic',
          success: true,
          responseTime,
          timestamp: new Date(),
          details: result,
        });

        this.emit('healthCheckCompleted', {
          provider: providerName,
          success: true,
          responseTime,
          type: 'basic',
        });
      } catch (error) {
        const responseTime = Date.now() - startTime;

        this.recordHealthCheck(providerName, {
          type: 'basic',
          success: false,
          responseTime,
          timestamp: new Date(),
          error: error.message,
          details: null,
        });

        this.emit('healthCheckFailed', {
          provider: providerName,
          error: error.message,
          responseTime,
          type: 'basic',
        });

        await this.evaluateAlerts(providerName);
      }
    });

    await Promise.allSettled(checkPromises);
  }

  /**
   * Perform detailed health checks with comprehensive metrics
   * @private
   */
  async performDetailedHealthChecks() {
    if (!this.providerManager) return;

    const providers = Array.from(this.providerManager.providers.keys());

    for (const providerName of providers) {
      try {
        const detailedResult = await this.performDetailedProviderCheck(
          providerName
        );

        this.recordHealthCheck(providerName, {
          type: 'detailed',
          success: true,
          timestamp: new Date(),
          details: detailedResult,
        });

        this.emit('detailedHealthCheckCompleted', {
          provider: providerName,
          result: detailedResult,
        });

        // Evaluate performance-based alerts
        await this.evaluatePerformanceAlerts(providerName, detailedResult);
      } catch (error) {
        this.recordHealthCheck(providerName, {
          type: 'detailed',
          success: false,
          timestamp: new Date(),
          error: error.message,
        });

        this.logger.error('Detailed health check failed', {
          provider: providerName,
          error: error.message,
        });
      }
    }
  }

  /**
   * Perform health check on specific provider
   * @private
   */
  async performProviderHealthCheck(providerName) {
    const provider = this.providerManager.providers.get(providerName);
    if (!provider) {
      throw new Error(`Provider not found: ${providerName}`);
    }

    // Test basic connectivity
    if (typeof provider.testConnection === 'function') {
      await provider.testConnection();
    }

    // Test with minimal request if available
    if (typeof provider.healthCheck === 'function') {
      return await provider.healthCheck();
    }

    return { status: 'healthy', method: 'basic' };
  }

  /**
   * Perform detailed provider check with comprehensive metrics
   * @private
   */
  async performDetailedProviderCheck(providerName) {
    const provider = this.providerManager.providers.get(providerName);
    const metrics = this.providerManager.getProviderMetrics(providerName);

    if (!provider) {
      throw new Error(`Provider not found: ${providerName}`);
    }

    const result = {
      provider: providerName,
      timestamp: new Date(),
      connectivity: null,
      performance: null,
      capacity: null,
      errors: [],
    };

    // Test connectivity with timeout
    try {
      const connectivityStart = Date.now();
      await this.testProviderConnectivity(provider);
      result.connectivity = {
        status: 'healthy',
        responseTime: Date.now() - connectivityStart,
      };
    } catch (error) {
      result.connectivity = {
        status: 'unhealthy',
        error: error.message,
      };
      result.errors.push(`Connectivity: ${error.message}`);
    }

    // Analyze performance metrics
    result.performance = {
      avgResponseTime: metrics.avgResponseTime,
      successRate: metrics.successRate,
      failureRate: metrics.failureRate,
      totalRequests: metrics.requests,
      recentActivity: this.analyzeRecentActivity(providerName),
    };

    // Check capacity and limits
    result.capacity = await this.checkProviderCapacity(providerName);

    return result;
  }

  /**
   * Test provider connectivity with various methods
   * @private
   */
  async testProviderConnectivity(provider) {
    // Try multiple connectivity tests
    const tests = [];

    // Basic connection test
    if (typeof provider.testConnection === 'function') {
      tests.push(provider.testConnection());
    }

    // Minimal API call test
    if (typeof provider.ping === 'function') {
      tests.push(provider.ping());
    }

    // If no specific tests available, try a minimal request
    if (tests.length === 0 && typeof provider.generateDream === 'function') {
      tests.push(
        provider.generateDream('test', {
          maxTokens: 1,
          timeout: 5000,
          healthCheck: true,
        })
      );
    }

    if (tests.length === 0) {
      throw new Error('No connectivity tests available for provider');
    }

    // Execute tests with timeout
    const results = await Promise.allSettled(
      tests.map((test) => this.withTimeout(test, 10000))
    );

    // Check if any test succeeded
    const hasSuccess = results.some((result) => result.status === 'fulfilled');
    if (!hasSuccess) {
      const errors = results
        .filter((r) => r.status === 'rejected')
        .map((r) => r.reason.message);
      throw new Error(`All connectivity tests failed: ${errors.join(', ')}`);
    }
  }

  /**
   * Check provider capacity and resource usage
   * @private
   */
  async checkProviderCapacity(providerName) {
    const config = this.providerManager.providerConfigs.get(providerName);
    const metrics = this.providerManager.getProviderMetrics(providerName);

    if (!config || !metrics) {
      return {
        status: 'unknown',
        reason: 'No configuration or metrics available',
      };
    }

    const capacity = {
      requestsPerMinute: {
        limit: config.limits?.requestsPerMinute || 0,
        current: this.calculateCurrentRPM(providerName),
        utilization: 0,
      },
      tokensPerMinute: {
        limit: config.limits?.tokensPerMinute || 0,
        current: this.calculateCurrentTPM(providerName),
        utilization: 0,
      },
      concurrent: {
        limit: config.limits?.maxConcurrent || 0,
        current: this.getCurrentConcurrentRequests(providerName),
        utilization: 0,
      },
    };

    // Calculate utilization percentages
    if (capacity.requestsPerMinute.limit > 0) {
      capacity.requestsPerMinute.utilization =
        capacity.requestsPerMinute.current / capacity.requestsPerMinute.limit;
    }

    if (capacity.tokensPerMinute.limit > 0) {
      capacity.tokensPerMinute.utilization =
        capacity.tokensPerMinute.current / capacity.tokensPerMinute.limit;
    }

    if (capacity.concurrent.limit > 0) {
      capacity.concurrent.utilization =
        capacity.concurrent.current / capacity.concurrent.limit;
    }

    return capacity;
  }

  /**
   * Analyze recent activity patterns
   * @private
   */
  analyzeRecentActivity(providerName) {
    const history = this.healthHistory.get(providerName) || [];
    const recentHistory = history.filter(
      (h) => Date.now() - h.timestamp.getTime() < 3600000 // Last hour
    );

    if (recentHistory.length === 0) {
      return { status: 'no_data', period: 'last_hour' };
    }

    const successful = recentHistory.filter((h) => h.success).length;
    const failed = recentHistory.length - successful;
    const avgResponseTime =
      recentHistory
        .filter((h) => h.responseTime)
        .reduce((sum, h) => sum + h.responseTime, 0) / recentHistory.length;

    return {
      status: 'active',
      period: 'last_hour',
      totalChecks: recentHistory.length,
      successful,
      failed,
      successRate: successful / recentHistory.length,
      avgResponseTime: avgResponseTime || 0,
      trend: this.calculateTrend(recentHistory),
    };
  }

  /**
   * Calculate performance trend
   * @private
   */
  calculateTrend(history) {
    if (history.length < 2) return 'stable';

    const midpoint = Math.floor(history.length / 2);
    const firstHalf = history.slice(0, midpoint);
    const secondHalf = history.slice(midpoint);

    const firstHalfSuccess =
      firstHalf.filter((h) => h.success).length / firstHalf.length;
    const secondHalfSuccess =
      secondHalf.filter((h) => h.success).length / secondHalf.length;

    const difference = secondHalfSuccess - firstHalfSuccess;

    if (difference > 0.1) return 'improving';
    if (difference < -0.1) return 'degrading';
    return 'stable';
  }

  /**
   * Record health check result
   * @private
   */
  recordHealthCheck(providerName, result) {
    if (!this.healthHistory.has(providerName)) {
      this.healthHistory.set(providerName, []);
    }

    const history = this.healthHistory.get(providerName);
    history.push(result);

    // Maintain retention period
    const cutoffTime = Date.now() - this.config.retentionPeriod;
    const filteredHistory = history.filter(
      (h) => h.timestamp.getTime() > cutoffTime
    );
    this.healthHistory.set(providerName, filteredHistory);

    this.logger.debug('Health check recorded', {
      provider: providerName,
      success: result.success,
      type: result.type,
      responseTime: result.responseTime,
    });
  }

  /**
   * Evaluate and trigger alerts based on health check results
   * @private
   */
  async evaluateAlerts(providerName) {
    const metrics = this.providerManager.getProviderMetrics(providerName);
    const health = this.providerManager.healthStatus.get(providerName);
    const history = this.healthHistory.get(providerName) || [];

    const alerts = [];

    // Check consecutive failures
    if (
      health?.consecutiveFailures >=
      this.config.alertThresholds.consecutiveFailures
    ) {
      alerts.push({
        type: 'consecutive_failures',
        severity: 'high',
        message: `Provider ${providerName} has ${health.consecutiveFailures} consecutive failures`,
        data: { consecutiveFailures: health.consecutiveFailures },
      });
    }

    // Check success rate
    if (
      metrics?.successRate < this.config.alertThresholds.successRateThreshold
    ) {
      alerts.push({
        type: 'low_success_rate',
        severity: 'medium',
        message: `Provider ${providerName} success rate is ${(
          metrics.successRate * 100
        ).toFixed(1)}%`,
        data: { successRate: metrics.successRate },
      });
    }

    // Check response time
    if (
      metrics?.avgResponseTime >
      this.config.alertThresholds.responseTimeThreshold
    ) {
      alerts.push({
        type: 'high_response_time',
        severity: 'medium',
        message: `Provider ${providerName} average response time is ${metrics.avgResponseTime}ms`,
        data: { avgResponseTime: metrics.avgResponseTime },
      });
    }

    // Check error rate
    if (metrics?.failureRate > this.config.alertThresholds.errorRateThreshold) {
      alerts.push({
        type: 'high_error_rate',
        severity: 'high',
        message: `Provider ${providerName} error rate is ${(
          metrics.failureRate * 100
        ).toFixed(1)}%`,
        data: { errorRate: metrics.failureRate },
      });
    }

    // Trigger alerts
    for (const alert of alerts) {
      await this.triggerAlert(providerName, alert);
    }
  }

  /**
   * Evaluate performance-based alerts
   * @private
   */
  async evaluatePerformanceAlerts(providerName, detailedResult) {
    const alerts = [];

    // Check connectivity issues
    if (detailedResult.connectivity?.status === 'unhealthy') {
      alerts.push({
        type: 'connectivity_failure',
        severity: 'high',
        message: `Provider ${providerName} connectivity check failed: ${detailedResult.connectivity.error}`,
        data: detailedResult.connectivity,
      });
    }

    // Check capacity utilization
    if (detailedResult.capacity) {
      const { requestsPerMinute, tokensPerMinute, concurrent } =
        detailedResult.capacity;

      if (requestsPerMinute.utilization > 0.9) {
        alerts.push({
          type: 'high_request_utilization',
          severity: 'medium',
          message: `Provider ${providerName} request utilization is ${(
            requestsPerMinute.utilization * 100
          ).toFixed(1)}%`,
          data: { utilization: requestsPerMinute.utilization },
        });
      }

      if (tokensPerMinute.utilization > 0.9) {
        alerts.push({
          type: 'high_token_utilization',
          severity: 'medium',
          message: `Provider ${providerName} token utilization is ${(
            tokensPerMinute.utilization * 100
          ).toFixed(1)}%`,
          data: { utilization: tokensPerMinute.utilization },
        });
      }

      if (concurrent.utilization > 0.9) {
        alerts.push({
          type: 'high_concurrent_utilization',
          severity: 'high',
          message: `Provider ${providerName} concurrent request utilization is ${(
            concurrent.utilization * 100
          ).toFixed(1)}%`,
          data: { utilization: concurrent.utilization },
        });
      }
    }

    // Check performance trends
    if (detailedResult.performance?.recentActivity?.trend === 'degrading') {
      alerts.push({
        type: 'performance_degradation',
        severity: 'medium',
        message: `Provider ${providerName} performance is degrading`,
        data: detailedResult.performance.recentActivity,
      });
    }

    // Trigger alerts
    for (const alert of alerts) {
      await this.triggerAlert(providerName, alert);
    }
  }

  /**
   * Trigger alert with rate limiting
   * @private
   */
  async triggerAlert(providerName, alert) {
    const alertKey = `${providerName}:${alert.type}`;
    const lastAlert = this.lastAlerts.get(alertKey);
    const now = Date.now();

    // Rate limiting: don't send same alert type more than once per 5 minutes
    if (lastAlert && now - lastAlert < 300000) {
      return;
    }

    this.lastAlerts.set(alertKey, now);

    // Record alert
    if (!this.alertHistory.has(providerName)) {
      this.alertHistory.set(providerName, []);
    }

    const alertRecord = {
      ...alert,
      timestamp: new Date(),
      provider: providerName,
    };

    this.alertHistory.get(providerName).push(alertRecord);

    // Log alert
    this.logger.warn('Alert triggered', alertRecord);

    // Emit alert event
    this.emit('alert', alertRecord);

    // Send notifications based on severity
    await this.sendAlertNotification(alertRecord);
  }

  /**
   * Send alert notification
   * @private
   */
  async sendAlertNotification(alert) {
    // This can be extended to send notifications via email, Slack, etc.
    console.warn(
      `🚨 ALERT [${alert.severity.toUpperCase()}]: ${alert.message}`
    );

    // Emit notification event for external handlers
    this.emit('notification', {
      type: 'alert',
      severity: alert.severity,
      message: alert.message,
      provider: alert.provider,
      timestamp: alert.timestamp,
      data: alert.data,
    });
  }

  /**
   * Setup provider manager event listeners
   * @private
   */
  setupProviderManagerListeners() {
    if (!this.providerManager) return;

    this.providerManager.on('operationSuccess', (data) => {
      this.logger.debug('Provider operation succeeded', data);
    });

    this.providerManager.on('operationFailure', (data) => {
      this.logger.warn('Provider operation failed', data);
    });

    this.providerManager.on('allProvidersFailed', (data) => {
      this.logger.error('All providers failed', data);

      // Trigger critical alert
      this.emit('alert', {
        type: 'all_providers_failed',
        severity: 'critical',
        message: 'All providers have failed',
        timestamp: new Date(),
        data,
      });
    });
  }

  /**
   * Get health status report for all providers
   */
  getHealthReport() {
    const report = {
      timestamp: new Date(),
      providers: {},
      summary: {
        total: 0,
        healthy: 0,
        unhealthy: 0,
        unknown: 0,
      },
    };

    for (const providerName of Array.from(
      this.providerManager.providers.keys()
    )) {
      const metrics = this.providerManager.getProviderMetrics(providerName);
      const history = this.healthHistory.get(providerName) || [];
      const recentHistory = history.filter(
        (h) => Date.now() - h.timestamp.getTime() < 3600000 // Last hour
      );

      const providerReport = {
        name: providerName,
        status: metrics.isHealthy ? 'healthy' : 'unhealthy',
        metrics: {
          successRate: metrics.successRate,
          avgResponseTime: metrics.avgResponseTime,
          totalRequests: metrics.requests,
          consecutiveFailures: metrics.consecutiveFailures,
        },
        recentActivity: {
          checksInLastHour: recentHistory.length,
          successfulChecks: recentHistory.filter((h) => h.success).length,
          failedChecks: recentHistory.filter((h) => !h.success).length,
        },
        lastHealthCheck: metrics.lastHealthCheck,
        alerts: this.getRecentAlerts(providerName),
      };

      report.providers[providerName] = providerReport;
      report.summary.total++;

      if (providerReport.status === 'healthy') {
        report.summary.healthy++;
      } else if (providerReport.status === 'unhealthy') {
        report.summary.unhealthy++;
      } else {
        report.summary.unknown++;
      }
    }

    return report;
  }

  /**
   * Get recent alerts for a provider
   * @private
   */
  getRecentAlerts(providerName, hours = 24) {
    const alerts = this.alertHistory.get(providerName) || [];
    const cutoffTime = Date.now() - hours * 3600000;

    return alerts.filter((alert) => alert.timestamp.getTime() > cutoffTime);
  }

  /**
   * Calculate current requests per minute
   * @private
   */
  calculateCurrentRPM(providerName) {
    const history = this.healthHistory.get(providerName) || [];
    const oneMinuteAgo = Date.now() - 60000;

    return history.filter(
      (h) => h.timestamp.getTime() > oneMinuteAgo && h.success
    ).length;
  }

  /**
   * Calculate current tokens per minute (estimated)
   * @private
   */
  calculateCurrentTPM(providerName) {
    // This would need to be implemented based on actual token usage tracking
    // For now, return 0 as placeholder
    return 0;
  }

  /**
   * Get current concurrent requests
   * @private
   */
  getCurrentConcurrentRequests(providerName) {
    // This would need to be tracked in real-time
    // For now, return 0 as placeholder
    return 0;
  }

  /**
   * Execute operation with timeout
   * @private
   */
  withTimeout(promise, timeoutMs) {
    return Promise.race([
      promise,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Operation timed out')), timeoutMs)
      ),
    ]);
  }

  /**
   * Cleanup resources
   */
  destroy() {
    this.stopMonitoring();
    this.healthHistory.clear();
    this.alertHistory.clear();
    this.lastAlerts.clear();
    this.removeAllListeners();
    this.logger.info('HealthMonitor destroyed');
  }
}

module.exports = HealthMonitor;
