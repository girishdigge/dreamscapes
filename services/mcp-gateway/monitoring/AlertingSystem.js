// monitoring/AlertingSystem.js
// Comprehensive alerting system for AI provider monitoring

const EventEmitter = require('events');
const winston = require('winston');
const { ErrorTypes, ErrorSeverity } = require('../utils/ErrorHandler');

/**
 * Alerting System - Manages alerts, notifications, and escalation policies
 */
class AlertingSystem extends EventEmitter {
  constructor(config = {}) {
    super();

    this.config = {
      // Alert thresholds
      thresholds: {
        errorRate: config.errorRate || 0.1, // 10%
        responseTime: config.responseTime || 10000, // 10 seconds
        consecutiveFailures: config.consecutiveFailures || 5,
        providerDowntime: config.providerDowntime || 300000, // 5 minutes
        queueLength: config.queueLength || 100,
        memoryUsage: config.memoryUsage || 0.85, // 85%
        cpuUsage: config.cpuUsage || 0.8, // 80%
        ...config.thresholds,
      },

      // Alert intervals (prevent spam)
      alertIntervals: {
        low: config.lowAlertInterval || 300000, // 5 minutes
        medium: config.mediumAlertInterval || 180000, // 3 minutes
        high: config.highAlertInterval || 60000, // 1 minute
        critical: config.criticalAlertInterval || 30000, // 30 seconds
        ...config.alertIntervals,
      },

      // Notification channels
      notifications: {
        console: config.enableConsole !== false,
        email: config.enableEmail || false,
        slack: config.enableSlack || false,
        webhook: config.enableWebhook || false,
        ...config.notifications,
      },

      // Escalation settings
      escalation: {
        enabled: config.enableEscalation !== false,
        escalationDelay: config.escalationDelay || 900000, // 15 minutes
        maxEscalationLevel: config.maxEscalationLevel || 3,
        ...config.escalation,
      },

      // Alert retention
      retentionPeriod: config.retentionPeriod || 2592000000, // 30 days
      maxAlertsInMemory: config.maxAlertsInMemory || 10000,

      ...config,
    };

    // Alert storage and tracking
    this.activeAlerts = new Map(); // alertId -> Alert
    this.alertHistory = []; // Historical alerts
    this.alertCounts = new Map(); // alertType -> count
    this.lastAlertTimes = new Map(); // alertType:provider -> timestamp
    this.escalatedAlerts = new Map(); // alertId -> escalation info
    this.suppressedAlerts = new Set(); // Suppressed alert types

    // Alert rules and conditions
    this.alertRules = new Map(); // ruleName -> AlertRule
    this.alertConditions = new Map(); // conditionName -> AlertCondition

    // Notification handlers
    this.notificationHandlers = new Map();

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
          filename: 'logs/alerting-system.log',
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

    this.setupDefaultAlertRules();
    this.setupNotificationHandlers();

    this.logger.info('AlertingSystem initialized', { config: this.config });
  }

  /**
   * Setup default alert rules
   * @private
   */
  setupDefaultAlertRules() {
    // High error rate alert
    this.addAlertRule('high_error_rate', {
      condition: (metrics) =>
        metrics.errorRate > this.config.thresholds.errorRate,
      severity: ErrorSeverity.HIGH,
      message: (metrics) =>
        `High error rate detected: ${(metrics.errorRate * 100).toFixed(1)}%`,
      cooldown: this.config.alertIntervals.high,
    });

    // Slow response time alert
    this.addAlertRule('slow_response_time', {
      condition: (metrics) =>
        metrics.avgResponseTime > this.config.thresholds.responseTime,
      severity: ErrorSeverity.MEDIUM,
      message: (metrics) => `Slow response time: ${metrics.avgResponseTime}ms`,
      cooldown: this.config.alertIntervals.medium,
    });

    // Provider unavailable alert
    this.addAlertRule('provider_unavailable', {
      condition: (metrics) =>
        !metrics.isHealthy &&
        metrics.consecutiveFailures >=
          this.config.thresholds.consecutiveFailures,
      severity: ErrorSeverity.CRITICAL,
      message: (metrics) =>
        `Provider unavailable: ${metrics.consecutiveFailures} consecutive failures`,
      cooldown: this.config.alertIntervals.critical,
    });

    // Circuit breaker open alert
    this.addAlertRule('circuit_breaker_open', {
      condition: (metrics) => metrics.circuitBreakerState === 'open',
      severity: ErrorSeverity.HIGH,
      message: () => 'Circuit breaker is open',
      cooldown: this.config.alertIntervals.high,
    });

    // Queue length alert
    this.addAlertRule('high_queue_length', {
      condition: (metrics) =>
        metrics.queueLength > this.config.thresholds.queueLength,
      severity: ErrorSeverity.MEDIUM,
      message: (metrics) =>
        `High queue length: ${metrics.queueLength} requests`,
      cooldown: this.config.alertIntervals.medium,
    });

    // Resource usage alerts
    this.addAlertRule('high_memory_usage', {
      condition: (metrics) =>
        metrics.memoryUsage > this.config.thresholds.memoryUsage,
      severity: ErrorSeverity.HIGH,
      message: (metrics) =>
        `High memory usage: ${(metrics.memoryUsage * 100).toFixed(1)}%`,
      cooldown: this.config.alertIntervals.high,
    });

    this.addAlertRule('high_cpu_usage', {
      condition: (metrics) =>
        metrics.cpuUsage > this.config.thresholds.cpuUsage,
      severity: ErrorSeverity.HIGH,
      message: (metrics) =>
        `High CPU usage: ${(metrics.cpuUsage * 100).toFixed(1)}%`,
      cooldown: this.config.alertIntervals.high,
    });
  }

  /**
   * Setup notification handlers
   * @private
   */
  setupNotificationHandlers() {
    // Console notification handler
    this.notificationHandlers.set('console', async (alert) => {
      const emoji = this.getSeverityEmoji(alert.severity);
      const message = `${emoji} ALERT [${alert.severity.toUpperCase()}] ${
        alert.title
      }: ${alert.message}`;

      switch (alert.severity) {
        case ErrorSeverity.CRITICAL:
          console.error(message);
          break;
        case ErrorSeverity.HIGH:
          console.warn(message);
          break;
        default:
          console.log(message);
      }
    });

    // Email notification handler (placeholder)
    this.notificationHandlers.set('email', async (alert) => {
      // This would integrate with an email service
      this.logger.info('Email notification would be sent', { alert: alert.id });
    });

    // Slack notification handler (placeholder)
    this.notificationHandlers.set('slack', async (alert) => {
      // This would integrate with Slack API
      this.logger.info('Slack notification would be sent', { alert: alert.id });
    });

    // Webhook notification handler (placeholder)
    this.notificationHandlers.set('webhook', async (alert) => {
      // This would send HTTP POST to configured webhook
      this.logger.info('Webhook notification would be sent', {
        alert: alert.id,
      });
    });
  }

  /**
   * Add custom alert rule
   * @param {string} name - Rule name
   * @param {Object} rule - Alert rule configuration
   */
  addAlertRule(name, rule) {
    this.alertRules.set(name, {
      name,
      condition: rule.condition,
      severity: rule.severity || ErrorSeverity.MEDIUM,
      message: rule.message || (() => `Alert: ${name}`),
      cooldown: rule.cooldown || this.config.alertIntervals.medium,
      enabled: rule.enabled !== false,
      tags: rule.tags || [],
      escalationLevel: rule.escalationLevel || 1,
      ...rule,
    });

    this.logger.debug('Alert rule added', { name, rule });
  }

  /**
   * Remove alert rule
   * @param {string} name - Rule name
   */
  removeAlertRule(name) {
    this.alertRules.delete(name);
    this.logger.debug('Alert rule removed', { name });
  }

  /**
   * Evaluate metrics against alert rules
   * @param {string} provider - Provider name
   * @param {Object} metrics - Provider metrics
   */
  async evaluateMetrics(provider, metrics) {
    const evaluationResults = [];

    for (const [ruleName, rule] of this.alertRules.entries()) {
      if (!rule.enabled) continue;

      try {
        const shouldAlert = rule.condition(metrics);

        if (shouldAlert) {
          const alertKey = `${ruleName}:${provider}`;

          // Check cooldown period
          if (this.isInCooldown(alertKey, rule.cooldown)) {
            continue;
          }

          // Create alert
          const alert = await this.createAlert({
            rule: ruleName,
            provider,
            severity: rule.severity,
            title: `${ruleName.replace(/_/g, ' ').toUpperCase()}`,
            message:
              typeof rule.message === 'function'
                ? rule.message(metrics)
                : rule.message,
            metrics,
            tags: rule.tags,
            escalationLevel: rule.escalationLevel,
          });

          evaluationResults.push({
            rule: ruleName,
            triggered: true,
            alert: alert.id,
          });

          // Update last alert time
          this.lastAlertTimes.set(alertKey, Date.now());
        } else {
          evaluationResults.push({
            rule: ruleName,
            triggered: false,
          });
        }
      } catch (error) {
        this.logger.error('Error evaluating alert rule', {
          rule: ruleName,
          provider,
          error: error.message,
        });
      }
    }

    return evaluationResults;
  }

  /**
   * Create new alert
   * @param {Object} alertData - Alert data
   * @returns {Object} Created alert
   */
  async createAlert(alertData) {
    const alert = {
      id: this.generateAlertId(),
      rule: alertData.rule,
      provider: alertData.provider,
      severity: alertData.severity,
      title: alertData.title,
      message: alertData.message,
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
      acknowledgedAt: null,
      resolvedAt: null,
      escalationLevel: alertData.escalationLevel || 1,
      escalatedAt: null,
      tags: alertData.tags || [],
      metrics: alertData.metrics,
      notificationsSent: [],
      context: {
        hostname: require('os').hostname(),
        service: 'mcp-gateway',
        version: process.env.npm_package_version || '1.0.0',
      },
    };

    // Store alert
    this.activeAlerts.set(alert.id, alert);
    this.alertHistory.push({ ...alert });

    // Update alert counts
    const countKey = `${alert.rule}:${alert.provider}`;
    this.alertCounts.set(countKey, (this.alertCounts.get(countKey) || 0) + 1);

    // Send notifications
    await this.sendNotifications(alert);

    // Schedule escalation if enabled
    if (this.config.escalation.enabled) {
      this.scheduleEscalation(alert);
    }

    // Emit alert event
    this.emit('alertCreated', alert);

    this.logger.warn('Alert created', {
      id: alert.id,
      rule: alert.rule,
      provider: alert.provider,
      severity: alert.severity,
      message: alert.message,
    });

    // Cleanup old alerts
    this.cleanupOldAlerts();

    return alert;
  }

  /**
   * Send notifications for alert
   * @private
   */
  async sendNotifications(alert) {
    const notifications = [];

    for (const [channel, enabled] of Object.entries(
      this.config.notifications
    )) {
      if (!enabled) continue;

      const handler = this.notificationHandlers.get(channel);
      if (!handler) {
        this.logger.warn('No handler found for notification channel', {
          channel,
        });
        continue;
      }

      try {
        await handler(alert);
        notifications.push({
          channel,
          sentAt: new Date(),
          success: true,
        });
      } catch (error) {
        notifications.push({
          channel,
          sentAt: new Date(),
          success: false,
          error: error.message,
        });

        this.logger.error('Failed to send notification', {
          channel,
          alertId: alert.id,
          error: error.message,
        });
      }
    }

    alert.notificationsSent = notifications;
    alert.updatedAt = new Date();
  }

  /**
   * Acknowledge alert
   * @param {string} alertId - Alert ID
   * @param {string} acknowledgedBy - Who acknowledged the alert
   * @param {string} note - Optional acknowledgment note
   */
  acknowledgeAlert(alertId, acknowledgedBy, note = null) {
    const alert = this.activeAlerts.get(alertId);
    if (!alert) {
      throw new Error(`Alert not found: ${alertId}`);
    }

    if (alert.status === 'acknowledged') {
      return alert; // Already acknowledged
    }

    alert.status = 'acknowledged';
    alert.acknowledgedAt = new Date();
    alert.acknowledgedBy = acknowledgedBy;
    alert.acknowledgmentNote = note;
    alert.updatedAt = new Date();

    this.emit('alertAcknowledged', alert);

    this.logger.info('Alert acknowledged', {
      id: alertId,
      acknowledgedBy,
      note,
    });

    return alert;
  }

  /**
   * Resolve alert
   * @param {string} alertId - Alert ID
   * @param {string} resolvedBy - Who resolved the alert
   * @param {string} resolution - Resolution description
   */
  resolveAlert(alertId, resolvedBy, resolution = null) {
    const alert = this.activeAlerts.get(alertId);
    if (!alert) {
      throw new Error(`Alert not found: ${alertId}`);
    }

    if (alert.status === 'resolved') {
      return alert; // Already resolved
    }

    alert.status = 'resolved';
    alert.resolvedAt = new Date();
    alert.resolvedBy = resolvedBy;
    alert.resolution = resolution;
    alert.updatedAt = new Date();

    // Remove from active alerts
    this.activeAlerts.delete(alertId);

    // Cancel escalation if scheduled
    if (this.escalatedAlerts.has(alertId)) {
      const escalation = this.escalatedAlerts.get(alertId);
      if (escalation.timeoutId) {
        clearTimeout(escalation.timeoutId);
      }
      this.escalatedAlerts.delete(alertId);
    }

    this.emit('alertResolved', alert);

    this.logger.info('Alert resolved', {
      id: alertId,
      resolvedBy,
      resolution,
    });

    return alert;
  }

  /**
   * Schedule alert escalation
   * @private
   */
  scheduleEscalation(alert) {
    if (alert.escalationLevel >= this.config.escalation.maxEscalationLevel) {
      return; // Already at max escalation level
    }

    const timeoutId = setTimeout(async () => {
      await this.escalateAlert(alert.id);
    }, this.config.escalation.escalationDelay);

    this.escalatedAlerts.set(alert.id, {
      timeoutId,
      scheduledAt: new Date(),
      escalationLevel: alert.escalationLevel + 1,
    });
  }

  /**
   * Escalate alert to higher level
   * @private
   */
  async escalateAlert(alertId) {
    const alert = this.activeAlerts.get(alertId);
    if (!alert || alert.status !== 'active') {
      return; // Alert no longer active
    }

    const escalation = this.escalatedAlerts.get(alertId);
    if (!escalation) {
      return; // No escalation scheduled
    }

    // Increase escalation level
    alert.escalationLevel = escalation.escalationLevel;
    alert.escalatedAt = new Date();
    alert.updatedAt = new Date();

    // Increase severity if not already critical
    if (alert.severity !== ErrorSeverity.CRITICAL) {
      const severityLevels = [
        ErrorSeverity.LOW,
        ErrorSeverity.MEDIUM,
        ErrorSeverity.HIGH,
        ErrorSeverity.CRITICAL,
      ];
      const currentIndex = severityLevels.indexOf(alert.severity);
      if (currentIndex < severityLevels.length - 1) {
        alert.severity = severityLevels[currentIndex + 1];
      }
    }

    // Send escalated notifications
    await this.sendNotifications(alert);

    // Schedule next escalation if not at max level
    if (alert.escalationLevel < this.config.escalation.maxEscalationLevel) {
      this.scheduleEscalation(alert);
    }

    this.emit('alertEscalated', alert);

    this.logger.warn('Alert escalated', {
      id: alertId,
      escalationLevel: alert.escalationLevel,
      severity: alert.severity,
    });
  }

  /**
   * Check if alert is in cooldown period
   * @private
   */
  isInCooldown(alertKey, cooldown) {
    const lastAlertTime = this.lastAlertTimes.get(alertKey);
    if (!lastAlertTime) return false;

    return Date.now() - lastAlertTime < cooldown;
  }

  /**
   * Generate unique alert ID
   * @private
   */
  generateAlertId() {
    return `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get severity emoji for console output
   * @private
   */
  getSeverityEmoji(severity) {
    const emojiMap = {
      [ErrorSeverity.LOW]: '🟡',
      [ErrorSeverity.MEDIUM]: '🟠',
      [ErrorSeverity.HIGH]: '🔴',
      [ErrorSeverity.CRITICAL]: '🚨',
    };
    return emojiMap[severity] || '⚠️';
  }

  /**
   * Cleanup old alerts from memory
   * @private
   */
  cleanupOldAlerts() {
    const cutoffTime = Date.now() - this.config.retentionPeriod;

    // Clean up alert history
    this.alertHistory = this.alertHistory.filter(
      (alert) => new Date(alert.createdAt).getTime() > cutoffTime
    );

    // Limit alerts in memory
    if (this.alertHistory.length > this.config.maxAlertsInMemory) {
      this.alertHistory = this.alertHistory.slice(
        -this.config.maxAlertsInMemory
      );
    }

    // Clean up last alert times
    for (const [key, timestamp] of this.lastAlertTimes.entries()) {
      if (timestamp < cutoffTime) {
        this.lastAlertTimes.delete(key);
      }
    }
  }

  /**
   * Get active alerts
   * @param {Object} filters - Optional filters
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

    if (filters.rule) {
      alerts = alerts.filter((alert) => alert.rule === filters.rule);
    }

    if (filters.status) {
      alerts = alerts.filter((alert) => alert.status === filters.status);
    }

    return alerts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  /**
   * Get alert history
   * @param {Object} filters - Optional filters
   * @returns {Array} Alert history
   */
  getAlertHistory(filters = {}) {
    let alerts = [...this.alertHistory];

    if (filters.provider) {
      alerts = alerts.filter((alert) => alert.provider === filters.provider);
    }

    if (filters.severity) {
      alerts = alerts.filter((alert) => alert.severity === filters.severity);
    }

    if (filters.timeRange) {
      const cutoffTime = Date.now() - filters.timeRange;
      alerts = alerts.filter(
        (alert) => new Date(alert.createdAt).getTime() > cutoffTime
      );
    }

    return alerts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  /**
   * Get alert statistics
   * @returns {Object} Alert statistics
   */
  getAlertStatistics() {
    const stats = {
      active: this.activeAlerts.size,
      total: this.alertHistory.length,
      bySeverity: {},
      byProvider: {},
      byRule: {},
      byStatus: {},
      escalated: 0,
      acknowledged: 0,
      resolved: 0,
    };

    // Count by severity, provider, rule, and status
    for (const alert of this.alertHistory) {
      // By severity
      stats.bySeverity[alert.severity] =
        (stats.bySeverity[alert.severity] || 0) + 1;

      // By provider
      stats.byProvider[alert.provider] =
        (stats.byProvider[alert.provider] || 0) + 1;

      // By rule
      stats.byRule[alert.rule] = (stats.byRule[alert.rule] || 0) + 1;

      // By status
      stats.byStatus[alert.status] = (stats.byStatus[alert.status] || 0) + 1;

      // Count special states
      if (alert.escalationLevel > 1) stats.escalated++;
      if (alert.acknowledgedAt) stats.acknowledged++;
      if (alert.resolvedAt) stats.resolved++;
    }

    return stats;
  }

  /**
   * Suppress alerts for a specific type
   * @param {string} alertType - Alert type to suppress
   * @param {number} duration - Suppression duration in milliseconds
   */
  suppressAlerts(alertType, duration = 3600000) {
    // Default 1 hour
    this.suppressedAlerts.add(alertType);

    setTimeout(() => {
      this.suppressedAlerts.delete(alertType);
      this.logger.info('Alert suppression lifted', { alertType });
    }, duration);

    this.logger.info('Alerts suppressed', { alertType, duration });
  }

  /**
   * Check if alert type is suppressed
   * @param {string} alertType - Alert type
   * @returns {boolean} Whether alerts are suppressed
   */
  isAlertSuppressed(alertType) {
    return this.suppressedAlerts.has(alertType);
  }

  /**
   * Export alert data
   * @param {Object} options - Export options
   * @returns {Object} Exported alert data
   */
  exportAlerts(options = {}) {
    const timeRange = options.timeRange || 86400000; // 24 hours
    const cutoffTime = Date.now() - timeRange;

    const exportData = {
      timestamp: new Date(),
      timeRange,
      activeAlerts: Array.from(this.activeAlerts.values()),
      alertHistory: this.alertHistory.filter(
        (alert) => new Date(alert.createdAt).getTime() > cutoffTime
      ),
      statistics: this.getAlertStatistics(),
      configuration: {
        thresholds: this.config.thresholds,
        alertIntervals: this.config.alertIntervals,
        escalation: this.config.escalation,
      },
    };

    return exportData;
  }

  /**
   * Check consecutive failure alerts for a provider
   * @param {string} provider - Provider name
   */
  async checkConsecutiveFailureAlerts(provider) {
    if (!provider) {
      this.logger.warn('checkConsecutiveFailureAlerts called without provider');
      return;
    }

    // Get recent alerts for this provider to check for consecutive failures
    const recentAlerts = this.getAlertHistory({
      provider,
      timeRange: 3600000, // Last hour
    });

    const failureAlerts = recentAlerts.filter(
      (alert) =>
        alert.rule === 'provider_unavailable' ||
        alert.rule === 'high_error_rate' ||
        alert.title?.toLowerCase().includes('failure')
    );

    const consecutiveFailures = failureAlerts.length;
    const threshold = this.config.thresholds.consecutiveFailures;

    if (consecutiveFailures >= threshold) {
      await this.createAlert({
        rule: 'consecutive_failures',
        provider,
        severity: ErrorSeverity.HIGH,
        title: 'CONSECUTIVE FAILURES',
        message: `${consecutiveFailures} consecutive failures detected for provider ${provider}`,
        metrics: {
          consecutiveFailures,
          threshold,
          recentFailures: failureAlerts.slice(-5), // Last 5 failures
        },
        tags: ['consecutive_failures', 'provider_health'],
        escalationLevel: 2,
      });

      this.logger.warn('Consecutive failure alert triggered', {
        provider,
        consecutiveFailures,
        threshold,
      });
    }
  }

  /**
   * Calculate alert severity based on type and data
   * @param {string} alertType - Type of alert
   * @param {Object} metrics - Alert metrics/data
   * @returns {string} Severity level
   */
  calculateAlertSeverity(alertType, metrics = {}) {
    if (!alertType) {
      return ErrorSeverity.MEDIUM;
    }

    switch (alertType) {
      case 'error_rate':
        const errorRate = metrics.errorRate || 0;
        if (errorRate > 0.5) return ErrorSeverity.CRITICAL; // 50%+
        if (errorRate > 0.25) return ErrorSeverity.HIGH; // 25%+
        if (errorRate > 0.1) return ErrorSeverity.MEDIUM; // 10%+
        return ErrorSeverity.LOW;

      case 'response_time':
        const responseTime =
          metrics.responseTime || metrics.avgResponseTime || 0;
        if (responseTime > 30000) return ErrorSeverity.CRITICAL; // 30+ seconds
        if (responseTime > 15000) return ErrorSeverity.HIGH; // 15+ seconds
        if (responseTime > 10000) return ErrorSeverity.MEDIUM; // 10+ seconds
        return ErrorSeverity.LOW;

      case 'consecutive_failures':
        const failures = metrics.consecutiveFailures || 0;
        if (failures > 10) return ErrorSeverity.CRITICAL;
        if (failures > 5) return ErrorSeverity.HIGH;
        return ErrorSeverity.MEDIUM;

      case 'memory_usage':
        const memoryUsage = metrics.memoryUsage || 0;
        if (memoryUsage > 0.95) return ErrorSeverity.CRITICAL; // 95%+
        if (memoryUsage > 0.85) return ErrorSeverity.HIGH; // 85%+
        if (memoryUsage > 0.75) return ErrorSeverity.MEDIUM; // 75%+
        return ErrorSeverity.LOW;

      case 'cpu_usage':
        const cpuUsage = metrics.cpuUsage || 0;
        if (cpuUsage > 0.9) return ErrorSeverity.CRITICAL; // 90%+
        if (cpuUsage > 0.8) return ErrorSeverity.HIGH; // 80%+
        if (cpuUsage > 0.7) return ErrorSeverity.MEDIUM; // 70%+
        return ErrorSeverity.LOW;

      case 'queue_length':
        const queueLength = metrics.queueLength || 0;
        if (queueLength > 1000) return ErrorSeverity.CRITICAL;
        if (queueLength > 500) return ErrorSeverity.HIGH;
        if (queueLength > 100) return ErrorSeverity.MEDIUM;
        return ErrorSeverity.LOW;

      case 'provider_unavailable':
      case 'circuit_breaker_open':
        return ErrorSeverity.CRITICAL;

      case 'high_error_rate':
      case 'slow_response_time':
        return ErrorSeverity.HIGH;

      default:
        // For unknown alert types, use medium severity as default
        this.logger.debug('Unknown alert type, using medium severity', {
          alertType,
        });
        return ErrorSeverity.MEDIUM;
    }
  }

  /**
   * Stop the alerting system and cleanup resources
   */
  async stop() {
    this.logger.info('Stopping AlertingSystem...');

    // Clear all timeouts and intervals
    for (const escalation of this.escalatedAlerts.values()) {
      if (escalation.timeoutId) {
        clearTimeout(escalation.timeoutId);
      }
    }

    // Resolve all active alerts
    const activeAlertIds = Array.from(this.activeAlerts.keys());
    for (const alertId of activeAlertIds) {
      try {
        this.resolveAlert(alertId, 'system', 'AlertingSystem shutdown');
      } catch (error) {
        this.logger.warn('Failed to resolve alert during shutdown', {
          alertId,
          error: error.message,
        });
      }
    }

    // Clear all data structures
    this.activeAlerts.clear();
    this.alertCounts.clear();
    this.lastAlertTimes.clear();
    this.escalatedAlerts.clear();
    this.suppressedAlerts.clear();

    // Remove all event listeners
    this.removeAllListeners();

    this.logger.info('AlertingSystem stopped successfully');
  }

  /**
   * Cleanup resources
   */
  destroy() {
    // Clear all timeouts
    for (const escalation of this.escalatedAlerts.values()) {
      if (escalation.timeoutId) {
        clearTimeout(escalation.timeoutId);
      }
    }

    this.activeAlerts.clear();
    this.alertHistory.length = 0;
    this.alertCounts.clear();
    this.lastAlertTimes.clear();
    this.escalatedAlerts.clear();
    this.suppressedAlerts.clear();
    this.alertRules.clear();
    this.alertConditions.clear();
    this.notificationHandlers.clear();
    this.removeAllListeners();

    this.logger.info('AlertingSystem destroyed');
  }
}

module.exports = AlertingSystem;
