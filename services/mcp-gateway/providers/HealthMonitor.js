// providers/HealthMonitor.js
// Advanced health monitoring and metrics collection system

const EventEmitter = require('events');

/**
 * Health Monitor - Advanced provider health monitoring and metrics collection
 */
class HealthMonitor extends EventEmitter {
  constructor(config = {}) {
    super();

    this.config = {
      healthCheckInterval: config.healthCheckInterval || 30000, // 30 seconds
      metricsRetentionPeriod: config.metricsRetentionPeriod || 3600000, // 1 hour
      alertThresholds: {
        failureRate: config.alertThresholds?.failureRate || 0.1, // 10%
        responseTime: config.alertThresholds?.responseTime || 10000, // 10 seconds
        consecutiveFailures: config.alertThresholds?.consecutiveFailures || 5,
      },
      ...config,
    };

    // Health data storage
    this.healthData = new Map(); // provider_name -> health_info
    this.metricsHistory = new Map(); // provider_name -> metrics_array
    this.alerts = new Map(); // provider_name -> alert_info

    // Monitoring state
    this.isMonitoring = false;
    this.monitoringInterval = null;
    this.lastCleanup = Date.now();

    console.log('HealthMonitor initialized with config:', this.config);
  }

  /**
   * Initialize health monitoring for a provider
   * @param {string} providerName - Provider name
   * @param {Object} provider - Provider instance
   */
  initializeProvider(providerName, provider) {
    if (!provider || typeof provider.testConnection !== 'function') {
      throw new Error(
        `Invalid provider for health monitoring: ${providerName}`
      );
    }

    // Initialize health data
    this.healthData.set(providerName, {
      provider,
      isHealthy: true,
      lastCheck: null,
      consecutiveFailures: 0,
      consecutiveSuccesses: 0,
      lastError: null,
      checkCount: 0,
      uptime: 0,
      downtime: 0,
      lastStatusChange: Date.now(),
    });

    // Initialize metrics history
    this.metricsHistory.set(providerName, []);

    // Initialize alert state
    this.alerts.set(providerName, {
      active: false,
      lastAlert: null,
      alertCount: 0,
      suppressedUntil: null,
    });

    console.log(`Health monitoring initialized for provider: ${providerName}`);
    this.emit('providerInitialized', { provider: providerName });
  }

  /**
   * Remove provider from monitoring
   * @param {string} providerName - Provider name
   */
  removeProvider(providerName) {
    this.healthData.delete(providerName);
    this.metricsHistory.delete(providerName);
    this.alerts.delete(providerName);

    console.log(`Provider removed from health monitoring: ${providerName}`);
    this.emit('providerRemoved', { provider: providerName });
  }

  /**
   * Start health monitoring
   */
  startMonitoring() {
    if (this.isMonitoring) {
      console.log('Health monitoring is already running');
      return;
    }

    this.isMonitoring = true;
    this.monitoringInterval = setInterval(() => {
      this.performHealthChecks();
    }, this.config.healthCheckInterval);

    console.log(
      `Health monitoring started (interval: ${this.config.healthCheckInterval}ms)`
    );
    this.emit('monitoringStarted');
  }

  /**
   * Stop health monitoring
   */
  stopMonitoring() {
    if (!this.isMonitoring) {
      console.log('Health monitoring is not running');
      return;
    }

    this.isMonitoring = false;
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    console.log('Health monitoring stopped');
    this.emit('monitoringStopped');
  }

  /**
   * Perform health checks on all providers
   * @private
   */
  async performHealthChecks() {
    const providers = Array.from(this.healthData.keys());
    const checkPromises = providers.map((providerName) =>
      this.checkProviderHealth(providerName).catch((error) => {
        console.error(`Health check error for ${providerName}:`, error.message);
      })
    );

    await Promise.allSettled(checkPromises);

    // Cleanup old metrics
    this.cleanupOldMetrics();
  }

  /**
   * Check health of a specific provider
   * @param {string} providerName - Provider name
   * @returns {Promise<Object>} Health check result
   */
  async checkProviderHealth(providerName) {
    const healthInfo = this.healthData.get(providerName);
    if (!healthInfo) {
      throw new Error(
        `Provider not found in health monitoring: ${providerName}`
      );
    }

    const startTime = Date.now();
    let isHealthy = false;
    let error = null;

    try {
      // Perform health check
      await healthInfo.provider.testConnection();
      isHealthy = true;

      // Update consecutive counters
      healthInfo.consecutiveFailures = 0;
      healthInfo.consecutiveSuccesses++;
    } catch (checkError) {
      isHealthy = false;
      error = checkError.message;

      // Update consecutive counters
      healthInfo.consecutiveFailures++;
      healthInfo.consecutiveSuccesses = 0;
      healthInfo.lastError = error;
    }

    const responseTime = Date.now() - startTime;
    const now = Date.now();

    // Update health info
    const wasHealthy = healthInfo.isHealthy;
    healthInfo.isHealthy = isHealthy;
    healthInfo.lastCheck = new Date(now);
    healthInfo.lastResponseTime = responseTime;
    healthInfo.checkCount++;

    // Track uptime/downtime
    if (wasHealthy !== isHealthy) {
      const timeSinceLastChange = now - healthInfo.lastStatusChange;
      if (wasHealthy) {
        healthInfo.uptime += timeSinceLastChange;
      } else {
        healthInfo.downtime += timeSinceLastChange;
      }
      healthInfo.lastStatusChange = now;
    }

    // Record metrics
    this.recordMetrics(providerName, {
      timestamp: now,
      isHealthy,
      responseTime,
      error,
      consecutiveFailures: healthInfo.consecutiveFailures,
      consecutiveSuccesses: healthInfo.consecutiveSuccesses,
    });

    // Check for alerts
    this.checkAlerts(providerName, healthInfo, responseTime);

    const result = {
      provider: providerName,
      isHealthy,
      responseTime,
      error,
      timestamp: new Date(now),
    };

    // Emit events
    if (isHealthy) {
      this.emit('healthCheckPassed', result);
    } else {
      this.emit('healthCheckFailed', result);
    }

    if (wasHealthy !== isHealthy) {
      this.emit('healthStatusChanged', {
        provider: providerName,
        isHealthy,
        previousStatus: wasHealthy,
      });
    }

    return result;
  }

  /**
   * Record operation metrics
   * @param {string} providerName - Provider name
   * @param {boolean} success - Operation success
   * @param {number} responseTime - Response time in ms
   * @param {Object} metadata - Additional metadata
   */
  recordOperationMetrics(providerName, success, responseTime, metadata = {}) {
    const now = Date.now();

    this.recordMetrics(providerName, {
      timestamp: now,
      type: 'operation',
      success,
      responseTime,
      ...metadata,
    });

    // Update health info if available
    const healthInfo = this.healthData.get(providerName);
    if (healthInfo) {
      if (success) {
        healthInfo.consecutiveFailures = 0;
      } else {
        healthInfo.consecutiveFailures++;
        healthInfo.lastError = metadata.error || 'Operation failed';
      }
    }

    this.emit('operationRecorded', {
      provider: providerName,
      success,
      responseTime,
      metadata,
    });
  }

  /**
   * Record metrics data
   * @private
   */
  recordMetrics(providerName, metrics) {
    const history = this.metricsHistory.get(providerName);
    if (!history) return;

    history.push(metrics);

    // Limit history size (keep last 1000 entries)
    if (history.length > 1000) {
      history.splice(0, history.length - 1000);
    }
  }

  /**
   * Check for alert conditions
   * @private
   */
  checkAlerts(providerName, healthInfo, responseTime) {
    const alertInfo = this.alerts.get(providerName);
    if (!alertInfo) return;

    const now = Date.now();
    const thresholds = this.config.alertThresholds;

    // Skip if alerts are suppressed
    if (alertInfo.suppressedUntil && now < alertInfo.suppressedUntil) {
      return;
    }

    let shouldAlert = false;
    let alertType = null;
    let alertMessage = null;

    // Check consecutive failures
    if (healthInfo.consecutiveFailures >= thresholds.consecutiveFailures) {
      shouldAlert = true;
      alertType = 'consecutive_failures';
      alertMessage = `Provider has ${healthInfo.consecutiveFailures} consecutive failures`;
    }

    // Check response time
    else if (responseTime > thresholds.responseTime) {
      shouldAlert = true;
      alertType = 'slow_response';
      alertMessage = `Provider response time (${responseTime}ms) exceeds threshold (${thresholds.responseTime}ms)`;
    }

    // Check failure rate (last 10 checks)
    else {
      const recentMetrics = this.getRecentMetrics(providerName, 10);
      if (recentMetrics.length >= 5) {
        const failures = recentMetrics.filter(
          (m) => m.isHealthy === false
        ).length;
        const failureRate = failures / recentMetrics.length;

        if (failureRate >= thresholds.failureRate) {
          shouldAlert = true;
          alertType = 'high_failure_rate';
          alertMessage = `Provider failure rate (${(failureRate * 100).toFixed(
            1
          )}%) exceeds threshold (${(thresholds.failureRate * 100).toFixed(
            1
          )}%)`;
        }
      }
    }

    if (shouldAlert && !alertInfo.active) {
      // Trigger alert
      alertInfo.active = true;
      alertInfo.lastAlert = now;
      alertInfo.alertCount++;

      const alert = {
        provider: providerName,
        type: alertType,
        message: alertMessage,
        timestamp: new Date(now),
        consecutiveFailures: healthInfo.consecutiveFailures,
        responseTime,
      };

      console.warn(`ALERT: ${alertMessage} (Provider: ${providerName})`);
      this.emit('alert', alert);
    } else if (!shouldAlert && alertInfo.active) {
      // Clear alert
      alertInfo.active = false;

      const recovery = {
        provider: providerName,
        message: `Provider has recovered`,
        timestamp: new Date(now),
        downDuration: now - alertInfo.lastAlert,
      };

      console.log(`RECOVERY: Provider ${providerName} has recovered`);
      this.emit('recovery', recovery);
    }
  }

  /**
   * Get recent metrics for a provider
   * @param {string} providerName - Provider name
   * @param {number} count - Number of recent metrics to retrieve
   * @returns {Array} Recent metrics
   */
  getRecentMetrics(providerName, count = 10) {
    const history = this.metricsHistory.get(providerName);
    if (!history) return [];

    return history.slice(-count);
  }

  /**
   * Get provider health status
   * @param {string} providerName - Provider name (optional)
   * @returns {Object} Health status
   */
  getHealthStatus(providerName = null) {
    if (providerName) {
      const healthInfo = this.healthData.get(providerName);
      const alertInfo = this.alerts.get(providerName);

      if (!healthInfo) {
        throw new Error(`Provider not found: ${providerName}`);
      }

      return {
        provider: providerName,
        isHealthy: healthInfo.isHealthy,
        lastCheck: healthInfo.lastCheck,
        consecutiveFailures: healthInfo.consecutiveFailures,
        consecutiveSuccesses: healthInfo.consecutiveSuccesses,
        lastError: healthInfo.lastError,
        checkCount: healthInfo.checkCount,
        uptime: healthInfo.uptime,
        downtime: healthInfo.downtime,
        alertActive: alertInfo?.active || false,
        alertCount: alertInfo?.alertCount || 0,
      };
    }

    // Return all provider statuses
    const allStatuses = {};
    for (const name of this.healthData.keys()) {
      allStatuses[name] = this.getHealthStatus(name);
    }
    return allStatuses;
  }

  /**
   * Get provider metrics summary
   * @param {string} providerName - Provider name
   * @param {number} timeWindow - Time window in ms (default: 1 hour)
   * @returns {Object} Metrics summary
   */
  getMetricsSummary(providerName, timeWindow = 3600000) {
    const history = this.metricsHistory.get(providerName);
    if (!history) {
      throw new Error(`Provider not found: ${providerName}`);
    }

    const cutoff = Date.now() - timeWindow;
    const recentMetrics = history.filter((m) => m.timestamp >= cutoff);

    if (recentMetrics.length === 0) {
      return {
        provider: providerName,
        timeWindow,
        totalChecks: 0,
        successCount: 0,
        failureCount: 0,
        successRate: 0,
        failureRate: 0,
        avgResponseTime: 0,
        minResponseTime: 0,
        maxResponseTime: 0,
      };
    }

    const healthChecks = recentMetrics.filter((m) => m.type !== 'operation');
    const operations = recentMetrics.filter((m) => m.type === 'operation');

    const successCount = healthChecks.filter((m) => m.isHealthy).length;
    const failureCount = healthChecks.filter((m) => !m.isHealthy).length;
    const totalChecks = healthChecks.length;

    const responseTimes = recentMetrics
      .filter((m) => typeof m.responseTime === 'number')
      .map((m) => m.responseTime);

    const avgResponseTime =
      responseTimes.length > 0
        ? responseTimes.reduce((sum, time) => sum + time, 0) /
          responseTimes.length
        : 0;

    const minResponseTime =
      responseTimes.length > 0 ? Math.min(...responseTimes) : 0;
    const maxResponseTime =
      responseTimes.length > 0 ? Math.max(...responseTimes) : 0;

    return {
      provider: providerName,
      timeWindow,
      totalChecks,
      successCount,
      failureCount,
      successRate: totalChecks > 0 ? successCount / totalChecks : 0,
      failureRate: totalChecks > 0 ? failureCount / totalChecks : 0,
      avgResponseTime: Math.round(avgResponseTime),
      minResponseTime,
      maxResponseTime,
      operationCount: operations.length,
      operationSuccesses: operations.filter((m) => m.success).length,
      operationFailures: operations.filter((m) => !m.success).length,
    };
  }

  /**
   * Get system-wide monitoring statistics
   * @returns {Object} System statistics
   */
  getSystemStats() {
    const totalProviders = this.healthData.size;
    const healthyProviders = Array.from(this.healthData.values()).filter(
      (info) => info.isHealthy
    ).length;
    const activeAlerts = Array.from(this.alerts.values()).filter(
      (alert) => alert.active
    ).length;

    const totalChecks = Array.from(this.healthData.values()).reduce(
      (sum, info) => sum + info.checkCount,
      0
    );

    return {
      totalProviders,
      healthyProviders,
      unhealthyProviders: totalProviders - healthyProviders,
      activeAlerts,
      totalHealthChecks: totalChecks,
      isMonitoring: this.isMonitoring,
      monitoringInterval: this.config.healthCheckInterval,
      lastCleanup: new Date(this.lastCleanup),
    };
  }

  /**
   * Suppress alerts for a provider
   * @param {string} providerName - Provider name
   * @param {number} duration - Suppression duration in ms
   */
  suppressAlerts(providerName, duration = 300000) {
    // 5 minutes default
    const alertInfo = this.alerts.get(providerName);
    if (!alertInfo) {
      throw new Error(`Provider not found: ${providerName}`);
    }

    alertInfo.suppressedUntil = Date.now() + duration;
    console.log(`Alerts suppressed for ${providerName} for ${duration}ms`);
    this.emit('alertsSuppressed', { provider: providerName, duration });
  }

  /**
   * Clear alert suppression for a provider
   * @param {string} providerName - Provider name
   */
  clearAlertSuppression(providerName) {
    const alertInfo = this.alerts.get(providerName);
    if (!alertInfo) {
      throw new Error(`Provider not found: ${providerName}`);
    }

    alertInfo.suppressedUntil = null;
    console.log(`Alert suppression cleared for ${providerName}`);
    this.emit('alertSuppressionCleared', { provider: providerName });
  }

  /**
   * Clean up old metrics data
   * @private
   */
  cleanupOldMetrics() {
    const now = Date.now();
    const cutoff = now - this.config.metricsRetentionPeriod;

    for (const [providerName, history] of this.metricsHistory) {
      const originalLength = history.length;
      const filtered = history.filter((metric) => metric.timestamp >= cutoff);

      if (filtered.length !== originalLength) {
        this.metricsHistory.set(providerName, filtered);
        console.log(
          `Cleaned up ${
            originalLength - filtered.length
          } old metrics for ${providerName}`
        );
      }
    }

    this.lastCleanup = now;
  }

  /**
   * Export metrics data
   * @param {string} providerName - Provider name (optional)
   * @param {string} format - Export format ('json' or 'csv')
   * @returns {string} Exported data
   */
  exportMetrics(providerName = null, format = 'json') {
    const data = {};

    if (providerName) {
      const history = this.metricsHistory.get(providerName);
      if (!history) {
        throw new Error(`Provider not found: ${providerName}`);
      }
      data[providerName] = history;
    } else {
      for (const [name, history] of this.metricsHistory) {
        data[name] = history;
      }
    }

    if (format === 'json') {
      return JSON.stringify(data, null, 2);
    } else if (format === 'csv') {
      // Simple CSV export
      let csv =
        'Provider,Timestamp,Type,IsHealthy,Success,ResponseTime,Error\n';

      for (const [name, history] of Object.entries(data)) {
        for (const metric of history) {
          csv += `${name},${new Date(metric.timestamp).toISOString()},${
            metric.type || 'health'
          },${metric.isHealthy || ''},${metric.success || ''},${
            metric.responseTime || ''
          },${metric.error || ''}\n`;
        }
      }

      return csv;
    } else {
      throw new Error(`Unsupported export format: ${format}`);
    }
  }

  /**
   * Check health for all providers
   * @param {Array} providers - Array of provider objects
   */
  async checkAllProviders(providers) {
    const checkPromises = providers.map(async (provider) => {
      try {
        await this.checkProviderHealth(provider.name);
      } catch (error) {
        console.warn(
          `Health check failed for ${provider.name}:`,
          error.message
        );
      }
    });

    await Promise.allSettled(checkPromises);
  }

  /**
   * Get overall system health status
   * @returns {Object} Overall health status
   */
  getOverallHealth() {
    const providers = Array.from(this.healthData.keys());
    let healthyCount = 0;
    let unhealthyCount = 0;

    for (const providerName of providers) {
      const healthInfo = this.healthData.get(providerName);
      if (healthInfo && healthInfo.isHealthy) {
        healthyCount++;
      } else {
        unhealthyCount++;
      }
    }

    let status = 'healthy';
    if (unhealthyCount === providers.length) {
      status = 'unhealthy';
    } else if (unhealthyCount > 0) {
      status = 'degraded';
    }

    return {
      status,
      healthyProviders: healthyCount,
      unhealthyProviders: unhealthyCount,
      totalProviders: providers.length,
      timestamp: new Date(),
    };
  }

  /**
   * Get provider health status
   * @param {string} providerName - Provider name
   * @returns {Object} Provider health status
   */
  getProviderHealth(providerName) {
    const healthInfo = this.healthData.get(providerName);
    if (!healthInfo) {
      throw new Error(`Provider not found: ${providerName}`);
    }

    return {
      status: healthInfo.isHealthy ? 'healthy' : 'unhealthy',
      lastCheck: healthInfo.lastCheck,
      latency: Math.max(0, healthInfo.lastResponseTime || 0),
      error: healthInfo.lastError,
      consecutiveFailures: healthInfo.consecutiveFailures,
      uptime: healthInfo.uptime,
    };
  }

  /**
   * Get health history for a provider
   * @param {string} providerName - Provider name
   * @param {number} limit - Maximum number of history entries
   * @returns {Array} Health history
   */
  getHealthHistory(providerName, limit = 100) {
    const history = this.metricsHistory.get(providerName);
    if (!history) {
      throw new Error(`Provider not found: ${providerName}`);
    }

    return history.slice(-limit).map((entry) => ({
      timestamp: new Date(entry.timestamp),
      status: entry.isHealthy ? 'healthy' : 'unhealthy',
      responseTime: entry.responseTime,
      error: entry.error,
    }));
  }

  /**
   * Get health trends for a provider
   * @param {string} providerName - Provider name
   * @returns {Object} Health trends
   */
  getHealthTrends(providerName) {
    const history = this.getHealthHistory(providerName, 50); // Last 50 checks

    if (history.length === 0) {
      return {
        trend: 'stable',
        recentFailures: 0,
        uptime: 1.0,
      };
    }

    const recentFailures = history.filter(
      (h) => h.status === 'unhealthy'
    ).length;
    const uptime = (history.length - recentFailures) / history.length;

    // Determine trend based on recent history
    const recentHistory = history.slice(-10); // Last 10 checks
    const recentFailureCount = recentHistory.filter(
      (h) => h.status === 'unhealthy'
    ).length;

    let trend = 'stable';
    if (recentFailureCount >= 3) {
      // More sensitive threshold
      trend = 'declining';
    } else if (recentFailureCount === 0 && recentFailures > 0) {
      trend = 'improving';
    }

    return {
      trend,
      recentFailures,
      uptime,
    };
  }

  /**
   * Cleanup resources
   */
  destroy() {
    this.stopMonitoring();
    this.healthData.clear();
    this.metricsHistory.clear();
    this.alerts.clear();
    this.removeAllListeners();
    console.log('HealthMonitor destroyed');
  }
}

module.exports = HealthMonitor;
