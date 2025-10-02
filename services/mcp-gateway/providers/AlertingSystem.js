// providers/AlertingSystem.js
// Automated provider status reporting and alerting system

const EventEmitter = require('events');

/**
 * Alerting System - Automated alerts and status reporting for provider monitoring
 */
class AlertingSystem extends EventEmitter {
  constructor(config = {}) {
    super();

    this.config = {
      alertChannels: config.alertChannels || ['console', 'log'],
      alertThresholds: {
        failureRate: config.alertThresholds?.failureRate || 0.1, // 10%
        responseTime: config.alertThresholds?.responseTime || 10000, // 10 seconds
        consecutiveFailures: config.alertThresholds?.consecutiveFailures || 5,
        errorRate: config.alertThresholds?.errorRate || 0.05, // 5%
        ...config.alertThresholds,
      },
      suppressionRules: {
        duplicateWindow: config.suppressionRules?.duplicateWindow || 300000, // 5 minutes
        maxAlertsPerHour: config.suppressionRules?.maxAlertsPerHour || 10,
        escalationDelay: config.suppressionRules?.escalationDelay || 900000, // 15 minutes
        ...config.suppressionRules,
      },
      reportingSchedule: {
        healthReport: config.reportingSchedule?.healthReport || 3600000, // 1 hour
        performanceReport:
          config.reportingSchedule?.performanceReport || 86400000, // 24 hours
        summaryReport: config.reportingSchedule?.summaryReport || 604800000, // 1 week
        ...config.reportingSchedule,
      },
      ...config,
    };

    // Alert state management
    this.activeAlerts = new Map(); // alert_id -> alert_data
    this.alertHistory = new Map(); // provider_name -> alert_array
    this.suppressedAlerts = new Map(); // alert_type -> suppression_data
    this.escalatedAlerts = new Set(); // alert_ids that have been escalated

    // Reporting state
    this.reportingIntervals = new Map(); // report_type -> interval_id
    this.lastReports = new Map(); // report_type -> timestamp

    // Alert channels
    this.alertChannels = new Map(); // channel_name -> channel_handler
    this.initializeDefaultChannels();

    console.log('AlertingSystem initialized with config:', this.config);
  }

  /**
   * Initialize default alert channels
   * @private
   */
  initializeDefaultChannels() {
    // Console channel
    this.alertChannels.set('console', {
      name: 'console',
      enabled: true,
      handler: this.consoleAlertHandler.bind(this),
    });

    // Log file channel
    this.alertChannels.set('log', {
      name: 'log',
      enabled: true,
      handler: this.logAlertHandler.bind(this),
    });
  }

  /**
   * Start automated reporting
   * @param {ProviderManager} providerManager - Provider manager instance
   * @param {HealthMonitor} healthMonitor - Health monitor instance
   * @param {MetricsCollector} metricsCollector - Metrics collector instance
   */
  startReporting(providerManager, healthMonitor, metricsCollector) {
    this.providerManager = providerManager;
    this.healthMonitor = healthMonitor;
    this.metricsCollector = metricsCollector;

    // Setup event listeners
    this.setupEventListeners();

    // Start scheduled reporting
    this.startScheduledReporting();

    console.log('AlertingSystem reporting started');
  }

  /**
   * Stop automated reporting
   */
  stopReporting() {
    // Clear all reporting intervals
    for (const [reportType, intervalId] of this.reportingIntervals) {
      clearInterval(intervalId);
    }
    this.reportingIntervals.clear();

    console.log('AlertingSystem reporting stopped');
  }

  /**
   * Setup event listeners for real-time alerting
   * @private
   */
  setupEventListeners() {
    if (this.healthMonitor) {
      this.healthMonitor.on('alert', (alert) => {
        this.processAlert(alert);
      });

      this.healthMonitor.on('healthCheckFailed', (data) => {
        this.evaluateHealthAlert(data);
      });
    }

    if (this.metricsCollector) {
      this.metricsCollector.on('realtimeMetricsUpdated', (data) => {
        this.evaluatePerformanceAlert(data);
      });
    }

    if (this.providerManager) {
      this.providerManager.on('allProvidersFailed', (data) => {
        this.triggerCriticalAlert('all_providers_failed', {
          message: 'All providers have failed',
          severity: 'critical',
          data,
        });
      });

      this.providerManager.on('operationFailure', (data) => {
        this.evaluateOperationFailureAlert(data);
      });
    }
  }

  /**
   * Start scheduled reporting intervals
   * @private
   */
  startScheduledReporting() {
    // Health report
    if (this.config.reportingSchedule.healthReport > 0) {
      const healthInterval = setInterval(async () => {
        await this.generateHealthReport();
      }, this.config.reportingSchedule.healthReport);

      this.reportingIntervals.set('health', healthInterval);
    }

    // Performance report
    if (this.config.reportingSchedule.performanceReport > 0) {
      const performanceInterval = setInterval(async () => {
        await this.generatePerformanceReport();
      }, this.config.reportingSchedule.performanceReport);

      this.reportingIntervals.set('performance', performanceInterval);
    }

    // Summary report
    if (this.config.reportingSchedule.summaryReport > 0) {
      const summaryInterval = setInterval(async () => {
        await this.generateSummaryReport();
      }, this.config.reportingSchedule.summaryReport);

      this.reportingIntervals.set('summary', summaryInterval);
    }
  }

  /**
   * Process incoming alert
   * @param {Object} alert - Alert data
   */
  async processAlert(alert) {
    const alertId = this.generateAlertId(alert);

    // Check if alert should be suppressed
    if (this.shouldSuppressAlert(alert, alertId)) {
      console.log(`Alert suppressed: ${alertId}`);
      return;
    }

    // Record alert
    this.recordAlert(alert, alertId);

    // Send alert through configured channels
    await this.sendAlert(alert, alertId);

    // Check for escalation
    await this.checkEscalation(alert, alertId);

    this.emit('alert', alert);
    this.emit('alertProcessed', { alert, alertId });
  }

  /**
   * Evaluate health-based alerts
   * @private
   */
  async evaluateHealthAlert(data) {
    const { provider, error, responseTime } = data;

    // Get current metrics
    const metrics = this.providerManager?.getProviderMetrics(provider);
    if (!metrics) return;

    const alerts = [];

    // Check consecutive failures
    if (
      metrics.consecutiveFailures >=
      this.config.alertThresholds.consecutiveFailures
    ) {
      alerts.push({
        type: 'consecutive_failures',
        severity: 'high',
        provider,
        message: `Provider ${provider} has ${metrics.consecutiveFailures} consecutive failures`,
        data: { consecutiveFailures: metrics.consecutiveFailures, error },
      });
    }

    // Check response time
    if (responseTime > this.config.alertThresholds.responseTime) {
      alerts.push({
        type: 'slow_response',
        severity: 'medium',
        provider,
        message: `Provider ${provider} response time is ${responseTime}ms`,
        data: {
          responseTime,
          threshold: this.config.alertThresholds.responseTime,
        },
      });
    }

    // Process alerts
    for (const alert of alerts) {
      await this.processAlert(alert);
    }
  }

  /**
   * Evaluate performance-based alerts
   * @private
   */
  async evaluatePerformanceAlert(data) {
    const { provider, metrics } = data;

    if (!metrics) return;

    const alerts = [];

    // Check failure rate
    const failureRate =
      metrics.failuresInLastMinute / Math.max(1, metrics.requestsInLastMinute);
    if (failureRate > this.config.alertThresholds.failureRate) {
      alerts.push({
        type: 'high_failure_rate',
        severity: 'high',
        provider,
        message: `Provider ${provider} failure rate is ${(
          failureRate * 100
        ).toFixed(1)}%`,
        data: {
          failureRate,
          threshold: this.config.alertThresholds.failureRate,
        },
      });
    }

    // Check average response time
    if (
      metrics.avgResponseTimeLastMinute >
      this.config.alertThresholds.responseTime
    ) {
      alerts.push({
        type: 'high_avg_response_time',
        severity: 'medium',
        provider,
        message: `Provider ${provider} average response time is ${metrics.avgResponseTimeLastMinute.toFixed(
          0
        )}ms`,
        data: {
          avgResponseTime: metrics.avgResponseTimeLastMinute,
          threshold: this.config.alertThresholds.responseTime,
        },
      });
    }

    // Process alerts
    for (const alert of alerts) {
      await this.processAlert(alert);
    }
  }

  /**
   * Evaluate operation failure alerts
   * @private
   */
  async evaluateOperationFailureAlert(data) {
    const { provider, error, attempts } = data;

    // Only alert on final failures after all retries
    if (attempts >= 3) {
      await this.processAlert({
        type: 'operation_failure',
        severity: 'medium',
        provider,
        message: `Provider ${provider} operation failed after ${attempts} attempts: ${error}`,
        data: { error, attempts },
      });
    }
  }

  /**
   * Trigger critical alert
   * @param {string} type - Alert type
   * @param {Object} alertData - Alert data
   */
  async triggerCriticalAlert(type, alertData) {
    const alert = {
      type,
      severity: 'critical',
      timestamp: new Date(),
      ...alertData,
    };

    await this.processAlert(alert);
  }

  /**
   * Generate alert ID
   * @private
   */
  generateAlertId(alert) {
    const components = [
      alert.provider || 'system',
      alert.type,
      alert.severity,
      Date.now(),
    ];
    return components.join('_');
  }

  /**
   * Check if alert should be suppressed
   * @private
   */
  shouldSuppressAlert(alert, alertId) {
    const suppressionKey = `${alert.provider || 'system'}:${alert.type}`;
    const suppression = this.suppressedAlerts.get(suppressionKey);

    if (!suppression) return false;

    const now = Date.now();

    // Check duplicate window
    if (
      now - suppression.lastAlert <
      this.config.suppressionRules.duplicateWindow
    ) {
      suppression.suppressedCount++;
      return true;
    }

    // Check max alerts per hour
    const oneHourAgo = now - 3600000;
    const recentAlerts = suppression.recentAlerts.filter(
      (timestamp) => timestamp > oneHourAgo
    );

    if (recentAlerts.length >= this.config.suppressionRules.maxAlertsPerHour) {
      suppression.suppressedCount++;
      return true;
    }

    return false;
  }

  /**
   * Record alert in history
   * @private
   */
  recordAlert(alert, alertId) {
    const provider = alert.provider || 'system';

    if (!this.alertHistory.has(provider)) {
      this.alertHistory.set(provider, []);
    }

    const alertRecord = {
      id: alertId,
      timestamp: new Date(),
      ...alert,
    };

    this.alertHistory.get(provider).push(alertRecord);
    this.activeAlerts.set(alertId, alertRecord);

    // Update suppression tracking
    const suppressionKey = `${provider}:${alert.type}`;
    if (!this.suppressedAlerts.has(suppressionKey)) {
      this.suppressedAlerts.set(suppressionKey, {
        lastAlert: 0,
        suppressedCount: 0,
        recentAlerts: [],
      });
    }

    const suppression = this.suppressedAlerts.get(suppressionKey);
    suppression.lastAlert = Date.now();
    suppression.recentAlerts.push(Date.now());

    // Keep only last hour of alerts
    const oneHourAgo = Date.now() - 3600000;
    suppression.recentAlerts = suppression.recentAlerts.filter(
      (timestamp) => timestamp > oneHourAgo
    );

    console.log(`Alert recorded: ${alertId} for provider ${provider}`);
  }

  /**
   * Send alert through configured channels
   * @private
   */
  async sendAlert(alert, alertId) {
    const enabledChannels = Array.from(this.alertChannels.values()).filter(
      (channel) => channel.enabled
    );

    const sendPromises = enabledChannels.map(async (channel) => {
      try {
        await channel.handler(alert, alertId);
      } catch (error) {
        console.error(
          `Failed to send alert through ${channel.name}:`,
          error.message
        );
      }
    });

    await Promise.allSettled(sendPromises);
  }

  /**
   * Check for alert escalation
   * @private
   */
  async checkEscalation(alert, alertId) {
    if (alert.severity !== 'critical' && !this.escalatedAlerts.has(alertId)) {
      // Check if this should be escalated based on frequency or duration
      const provider = alert.provider || 'system';
      const recentAlerts = this.getRecentAlerts(provider, 1); // Last hour

      const sameTypeAlerts = recentAlerts.filter((a) => a.type === alert.type);

      if (sameTypeAlerts.length >= 5) {
        // 5 of same type in an hour
        this.escalatedAlerts.add(alertId);

        await this.processAlert({
          ...alert,
          type: `escalated_${alert.type}`,
          severity: 'critical',
          message: `ESCALATED: ${alert.message} (${sameTypeAlerts.length} occurrences in last hour)`,
          originalAlert: alertId,
        });
      }
    }
  }

  /**
   * Console alert handler
   * @private
   */
  async consoleAlertHandler(alert, alertId) {
    const timestamp = new Date().toISOString();
    const severityIcon = this.getSeverityIcon(alert.severity);

    console.warn(
      `${severityIcon} [${timestamp}] ALERT ${alertId}: ${alert.message}`
    );

    if (alert.data) {
      console.warn(`   Data:`, JSON.stringify(alert.data, null, 2));
    }
  }

  /**
   * Log file alert handler
   * @private
   */
  async logAlertHandler(alert, alertId) {
    // This would write to a log file
    // For now, just use console.log with structured format
    console.log(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'ALERT',
        alertId,
        severity: alert.severity,
        type: alert.type,
        provider: alert.provider,
        message: alert.message,
        data: alert.data,
      })
    );
  }

  /**
   * Get severity icon
   * @private
   */
  getSeverityIcon(severity) {
    const icons = {
      low: '🟡',
      medium: '🟠',
      high: '🔴',
      critical: '🚨',
    };
    return icons[severity] || '⚠️';
  }

  /**
   * Generate health report
   * @private
   */
  async generateHealthReport() {
    if (!this.healthMonitor) return;

    try {
      const healthReport = this.healthMonitor.getHealthReport();

      const report = {
        type: 'health_report',
        timestamp: new Date(),
        summary: healthReport.summary,
        providers: Object.entries(healthReport.providers).map(
          ([name, data]) => ({
            name,
            status: data.status,
            successRate: (data.metrics.successRate * 100).toFixed(1) + '%',
            avgResponseTime: data.metrics.avgResponseTime.toFixed(0) + 'ms',
            consecutiveFailures: data.metrics.consecutiveFailures,
            recentAlerts: data.alerts.length,
          })
        ),
      };

      await this.sendReport(report);
      this.lastReports.set('health', Date.now());
    } catch (error) {
      console.error('Failed to generate health report:', error.message);
    }
  }

  /**
   * Generate performance report
   * @private
   */
  async generatePerformanceReport() {
    if (!this.metricsCollector) return;

    try {
      const metricsReport = this.metricsCollector.getMetricsReport(null, {
        timeRange: '24h',
        includeRealtime: true,
        includeBaseline: true,
      });

      const report = {
        type: 'performance_report',
        timestamp: new Date(),
        timeRange: '24h',
        summary: metricsReport.summary,
        providers: Object.entries(metricsReport.providers).map(
          ([name, data]) => ({
            name,
            requests: data.aggregated?.requests || 0,
            successRate:
              ((data.aggregated?.successRate || 0) * 100).toFixed(1) + '%',
            avgResponseTime:
              (data.aggregated?.avgResponseTime || 0).toFixed(0) + 'ms',
            p95ResponseTime:
              (data.aggregated?.p95ResponseTime || 0).toFixed(0) + 'ms',
            healthScore: data.aggregated?.healthScore || 0,
            activeRequests: data.realtime?.activeRequests || 0,
          })
        ),
      };

      await this.sendReport(report);
      this.lastReports.set('performance', Date.now());
    } catch (error) {
      console.error('Failed to generate performance report:', error.message);
    }
  }

  /**
   * Generate summary report
   * @private
   */
  async generateSummaryReport() {
    try {
      const now = new Date();
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      const report = {
        type: 'summary_report',
        timestamp: now,
        period: 'weekly',
        summary: {
          totalAlerts: this.getTotalAlertsInPeriod(weekAgo, now),
          criticalAlerts: this.getCriticalAlertsInPeriod(weekAgo, now),
          mostProblematicProvider: this.getMostProblematicProvider(
            weekAgo,
            now
          ),
          systemUptime: this.calculateSystemUptime(weekAgo, now),
        },
        providers: this.getProviderSummaries(weekAgo, now),
      };

      await this.sendReport(report);
      this.lastReports.set('summary', Date.now());
    } catch (error) {
      console.error('Failed to generate summary report:', error.message);
    }
  }

  /**
   * Send report through configured channels
   * @private
   */
  async sendReport(report) {
    console.log(
      `📊 ${report.type.toUpperCase()} - ${report.timestamp.toISOString()}`
    );
    console.log(JSON.stringify(report, null, 2));

    this.emit('reportGenerated', report);
  }

  /**
   * Get recent alerts for provider
   * @private
   */
  getRecentAlerts(provider, hours = 24) {
    const alerts = this.alertHistory.get(provider) || [];
    const cutoffTime = Date.now() - hours * 3600000;

    return alerts.filter((alert) => alert.timestamp.getTime() > cutoffTime);
  }

  /**
   * Get total alerts in period
   * @private
   */
  getTotalAlertsInPeriod(startTime, endTime) {
    let total = 0;
    for (const alerts of this.alertHistory.values()) {
      total += alerts.filter(
        (alert) => alert.timestamp >= startTime && alert.timestamp <= endTime
      ).length;
    }
    return total;
  }

  /**
   * Get critical alerts in period
   * @private
   */
  getCriticalAlertsInPeriod(startTime, endTime) {
    let total = 0;
    for (const alerts of this.alertHistory.values()) {
      total += alerts.filter(
        (alert) =>
          alert.severity === 'critical' &&
          alert.timestamp >= startTime &&
          alert.timestamp <= endTime
      ).length;
    }
    return total;
  }

  /**
   * Get most problematic provider
   * @private
   */
  getMostProblematicProvider(startTime, endTime) {
    const providerAlertCounts = new Map();

    for (const [provider, alerts] of this.alertHistory) {
      const periodAlerts = alerts.filter(
        (alert) => alert.timestamp >= startTime && alert.timestamp <= endTime
      );
      providerAlertCounts.set(provider, periodAlerts.length);
    }

    let maxAlerts = 0;
    let mostProblematic = null;

    for (const [provider, count] of providerAlertCounts) {
      if (count > maxAlerts) {
        maxAlerts = count;
        mostProblematic = provider;
      }
    }

    return { provider: mostProblematic, alertCount: maxAlerts };
  }

  /**
   * Calculate system uptime
   * @private
   */
  calculateSystemUptime(startTime, endTime) {
    // This is a simplified calculation
    // In a real implementation, you'd track actual downtime periods
    const totalPeriod = endTime.getTime() - startTime.getTime();
    const criticalAlerts = this.getCriticalAlertsInPeriod(startTime, endTime);

    // Assume each critical alert represents 5 minutes of downtime
    const estimatedDowntime = criticalAlerts * 5 * 60 * 1000; // 5 minutes in ms
    const uptime = Math.max(0, totalPeriod - estimatedDowntime);

    return ((uptime / totalPeriod) * 100).toFixed(2) + '%';
  }

  /**
   * Get provider summaries for period
   * @private
   */
  getProviderSummaries(startTime, endTime) {
    const summaries = [];

    for (const [provider, alerts] of this.alertHistory) {
      const periodAlerts = alerts.filter(
        (alert) => alert.timestamp >= startTime && alert.timestamp <= endTime
      );

      const alertTypes = {};
      periodAlerts.forEach((alert) => {
        alertTypes[alert.type] = (alertTypes[alert.type] || 0) + 1;
      });

      summaries.push({
        provider,
        totalAlerts: periodAlerts.length,
        criticalAlerts: periodAlerts.filter((a) => a.severity === 'critical')
          .length,
        alertTypes,
        trend: this.calculateAlertTrend(provider, startTime, endTime),
      });
    }

    return summaries.sort((a, b) => b.totalAlerts - a.totalAlerts);
  }

  /**
   * Calculate alert trend for provider
   * @private
   */
  calculateAlertTrend(provider, startTime, endTime) {
    const alerts = this.alertHistory.get(provider) || [];
    const periodAlerts = alerts.filter(
      (alert) => alert.timestamp >= startTime && alert.timestamp <= endTime
    );

    if (periodAlerts.length < 2) return 'stable';

    const midpoint = new Date((startTime.getTime() + endTime.getTime()) / 2);
    const firstHalf = periodAlerts.filter(
      (alert) => alert.timestamp < midpoint
    );
    const secondHalf = periodAlerts.filter(
      (alert) => alert.timestamp >= midpoint
    );

    if (secondHalf.length > firstHalf.length * 1.5) return 'increasing';
    if (firstHalf.length > secondHalf.length * 1.5) return 'decreasing';
    return 'stable';
  }

  /**
   * Add custom alert channel
   * @param {string} name - Channel name
   * @param {Function} handler - Alert handler function
   * @param {Object} options - Channel options
   */
  addAlertChannel(name, handler, options = {}) {
    this.alertChannels.set(name, {
      name,
      enabled: options.enabled !== false,
      handler,
      ...options,
    });

    console.log(`Alert channel added: ${name}`);
  }

  /**
   * Remove alert channel
   * @param {string} name - Channel name
   */
  removeAlertChannel(name) {
    this.alertChannels.delete(name);
    console.log(`Alert channel removed: ${name}`);
  }

  /**
   * Enable/disable alert channel
   * @param {string} name - Channel name
   * @param {boolean} enabled - Enable state
   */
  setChannelEnabled(name, enabled) {
    const channel = this.alertChannels.get(name);
    if (channel) {
      channel.enabled = enabled;
      console.log(`Alert channel ${name} ${enabled ? 'enabled' : 'disabled'}`);
    }
  }

  /**
   * Get alert statistics
   * @param {Object} options - Query options
   * @returns {Object} Alert statistics
   */
  getAlertStatistics(options = {}) {
    const timeRange = options.timeRange || '24h';
    const provider = options.provider;

    const timeRangeMs = this.parseTimeRange(timeRange);
    const cutoffTime = new Date(Date.now() - timeRangeMs);

    let allAlerts = [];

    if (provider) {
      allAlerts = this.alertHistory.get(provider) || [];
    } else {
      for (const alerts of this.alertHistory.values()) {
        allAlerts = allAlerts.concat(alerts);
      }
    }

    const periodAlerts = allAlerts.filter(
      (alert) => alert.timestamp >= cutoffTime
    );

    const stats = {
      timeRange,
      provider: provider || 'all',
      total: periodAlerts.length,
      bySeverity: {},
      byType: {},
      byProvider: {},
      trend: 'stable',
    };

    // Count by severity
    periodAlerts.forEach((alert) => {
      stats.bySeverity[alert.severity] =
        (stats.bySeverity[alert.severity] || 0) + 1;
      stats.byType[alert.type] = (stats.byType[alert.type] || 0) + 1;

      if (!provider) {
        const alertProvider = alert.provider || 'system';
        stats.byProvider[alertProvider] =
          (stats.byProvider[alertProvider] || 0) + 1;
      }
    });

    return stats;
  }

  /**
   * Parse time range string to milliseconds
   * @private
   */
  parseTimeRange(timeRange) {
    const units = {
      m: 60000, // minutes
      h: 3600000, // hours
      d: 86400000, // days
      w: 604800000, // weeks
    };

    const match = timeRange.match(/^(\d+)([mhdw])$/);
    if (!match) return 86400000; // Default to 1 day

    const [, amount, unit] = match;
    return parseInt(amount) * (units[unit] || 86400000);
  }

  /**
   * Stop the alerting system (alias for stopReporting)
   */
  async stop() {
    this.stopReporting();
  }

  /**
   * Check error rate alerts for a provider
   * @param {Object} metrics - Provider metrics
   * @param {string} provider - Provider name
   */
  async checkErrorRateAlerts(metrics, provider) {
    if (!metrics || typeof metrics.errorRate !== 'number') {
      return;
    }

    if (metrics.errorRate > this.config.alertThresholds.errorRate) {
      await this.processAlert({
        type: 'error_rate',
        severity: this.calculateAlertSeverity('error_rate', {
          errorRate: metrics.errorRate,
        }),
        provider,
        message: `High error rate detected: ${(metrics.errorRate * 100).toFixed(
          1
        )}%`,
        data: {
          errorRate: metrics.errorRate,
          threshold: this.config.alertThresholds.errorRate,
          totalRequests: metrics.totalRequests,
          failedRequests: metrics.failedRequests,
        },
      });
    }
  }

  /**
   * Check response time alerts for a provider
   * @param {Object} metrics - Provider metrics
   * @param {string} provider - Provider name
   */
  async checkResponseTimeAlerts(metrics, provider) {
    if (!metrics || typeof metrics.averageResponseTime !== 'number') {
      console.log(
        'checkResponseTimeAlerts: Invalid metrics or averageResponseTime',
        { metrics, provider }
      );
      return;
    }

    console.log('checkResponseTimeAlerts: Checking', {
      provider,
      averageResponseTime: metrics.averageResponseTime,
      threshold: this.config.alertThresholds.responseTime,
      shouldAlert:
        metrics.averageResponseTime > this.config.alertThresholds.responseTime,
    });

    if (
      metrics.averageResponseTime > this.config.alertThresholds.responseTime
    ) {
      await this.processAlert({
        type: 'response_time',
        severity: this.calculateAlertSeverity('response_time', {
          responseTime: metrics.averageResponseTime,
        }),
        provider,
        message: `High response time detected: ${metrics.averageResponseTime.toFixed(
          0
        )}ms`,
        data: {
          averageResponseTime: metrics.averageResponseTime,
          threshold: this.config.alertThresholds.responseTime,
          totalRequests: metrics.totalRequests,
        },
      });
    }
  }

  /**
   * Check consecutive failure alerts for a provider
   * @param {string} provider - Provider name
   */
  async checkConsecutiveFailureAlerts(provider) {
    // Get recent alerts for this provider to check for consecutive failures
    const recentAlerts = this.getRecentAlerts(provider, 1); // Last hour
    const failureAlerts = recentAlerts.filter(
      (alert) =>
        alert.type === 'operation_failure' ||
        alert.type === 'health_check_failed'
    );

    if (
      failureAlerts.length >= this.config.alertThresholds.consecutiveFailures
    ) {
      await this.processAlert({
        type: 'consecutive_failures',
        severity: 'high',
        provider,
        message: `${failureAlerts.length} consecutive failures detected`,
        data: {
          consecutiveFailures: failureAlerts.length,
          threshold: this.config.alertThresholds.consecutiveFailures,
          recentFailures: failureAlerts.slice(-5), // Last 5 failures
        },
      });
    }
  }

  /**
   * Calculate alert severity based on type and data
   * @param {string} alertType - Type of alert
   * @param {Object} data - Alert data
   * @returns {string} Severity level
   */
  calculateAlertSeverity(alertType, data) {
    switch (alertType) {
      case 'error_rate':
        if (data.errorRate > 0.5) return 'critical';
        if (data.errorRate > 0.25) return 'high';
        if (data.errorRate > 0.1) return 'medium';
        return 'low';

      case 'response_time':
        if (data.responseTime > 30000) return 'critical'; // 30 seconds
        if (data.responseTime > 15000) return 'high'; // 15 seconds
        if (data.responseTime > 10000) return 'medium'; // 10 seconds
        return 'low';

      case 'consecutive_failures':
        if (data.consecutiveFailures > 10) return 'critical';
        if (data.consecutiveFailures > 5) return 'high';
        return 'medium';

      default:
        return 'medium';
    }
  }

  /**
   * Get active alerts with optional filtering
   * @param {Object} filters - Filter options
   * @returns {Array} Active alerts
   */
  getActiveAlerts(filters = {}) {
    let alerts = Array.from(this.activeAlerts.values());

    if (filters.provider) {
      alerts = alerts.filter((alert) => alert.provider === filters.provider);
    }

    if (filters.severity) {
      alerts = alerts.filter((alert) => alert.severity === filters.severity);
    }

    if (filters.status) {
      alerts = alerts.filter((alert) => alert.status === filters.status);
    }

    return alerts.sort((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * Get alert history with optional filtering
   * @param {Object} options - Query options
   * @returns {Array} Alert history
   */
  getAlertHistory(options = {}) {
    const timeRange = options.timeRange || 86400000; // 24 hours default
    const cutoffTime = Date.now() - timeRange;

    let allAlerts = [];

    if (options.provider) {
      const providerAlerts = this.alertHistory.get(options.provider) || [];
      allAlerts = providerAlerts.filter(
        (alert) => alert.timestamp.getTime() > cutoffTime
      );
    } else {
      for (const alerts of this.alertHistory.values()) {
        const filteredAlerts = alerts.filter(
          (alert) => alert.timestamp.getTime() > cutoffTime
        );
        allAlerts = allAlerts.concat(filteredAlerts);
      }
    }

    if (options.severity) {
      allAlerts = allAlerts.filter(
        (alert) => alert.severity === options.severity
      );
    }

    if (options.status) {
      allAlerts = allAlerts.filter((alert) => alert.status === options.status);
    }

    return allAlerts.sort((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * Cleanup resources
   */
  destroy() {
    this.stopReporting();
    this.activeAlerts.clear();
    this.alertHistory.clear();
    this.suppressedAlerts.clear();
    this.escalatedAlerts.clear();
    this.alertChannels.clear();
    this.removeAllListeners();
    console.log('AlertingSystem destroyed');
  }
}

module.exports = AlertingSystem;
