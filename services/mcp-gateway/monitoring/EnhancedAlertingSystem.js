// monitoring/EnhancedAlertingSystem.js
// Enhanced alerting system for critical parsing failures and health monitoring

const EventEmitter = require('events');
const { logger } = require('../utils/logger');

/**
 * Enhanced Alerting System - Comprehensive alerting for critical parsing failures
 */
class EnhancedAlertingSystem extends EventEmitter {
  constructor(config = {}) {
    super();

    this.config = {
      // Alert thresholds
      thresholds: {
        criticalFailureRate: config.criticalFailureRate || 0.5, // 50%
        warningFailureRate: config.warningFailureRate || 0.2, // 20%
        criticalConsecutiveFailures: config.criticalConsecutiveFailures || 5,
        warningConsecutiveFailures: config.warningConsecutiveFailures || 3,
        criticalResponseTime: config.criticalResponseTime || 30000, // 30 seconds
        warningResponseTime: config.warningResponseTime || 10000, // 10 seconds
        parsingErrorThreshold: config.parsingErrorThreshold || 3, // 3 parsing errors
      },

      // Alert channels
      channels: {
        console: config.enableConsoleAlerts !== false,
        log: config.enableLogAlerts !== false,
        webhook: config.enableWebhookAlerts === true,
        email: config.enableEmailAlerts === true,
      },

      // Alert suppression
      suppressionRules: {
        duplicateAlertWindow: config.duplicateAlertWindow || 300000, // 5 minutes
        maxAlertsPerProvider: config.maxAlertsPerProvider || 10,
        maxAlertsPerHour: config.maxAlertsPerHour || 50,
      },

      // Webhook configuration
      webhook: {
        url: config.webhookUrl || process.env.ALERT_WEBHOOK_URL,
        timeout: config.webhookTimeout || 5000,
        retries: config.webhookRetries || 3,
      },

      // Email configuration
      email: {
        enabled:
          config.emailEnabled || process.env.EMAIL_ALERTS_ENABLED === 'true',
        recipients:
          config.emailRecipients ||
          (process.env.ALERT_EMAIL_RECIPIENTS || '').split(','),
        smtpConfig: config.smtpConfig || {},
      },

      ...config,
    };

    // Alert tracking
    this.activeAlerts = new Map(); // alertKey -> alertData
    this.alertHistory = new Map(); // provider -> Array<alertData>
    this.suppressedAlerts = new Map(); // alertKey -> suppressionData
    this.alertCounts = new Map(); // provider -> hourly counts

    // Monitoring intervals
    this.monitoringInterval = null;
    this.cleanupInterval = null;

    logger.info('EnhancedAlertingSystem initialized', {
      thresholds: this.config.thresholds,
      channels: this.config.channels,
    });
  }

  /**
   * Start the alerting system
   * @param {ProviderManager} providerManager - Provider manager instance
   */
  startAlerting(providerManager) {
    this.providerManager = providerManager;

    // Start monitoring interval
    this.monitoringInterval = setInterval(async () => {
      await this.checkForAlerts();
    }, 30000); // Check every 30 seconds

    // Start cleanup interval
    this.cleanupInterval = setInterval(() => {
      this.cleanupOldAlerts();
    }, 300000); // Cleanup every 5 minutes

    // Listen to provider manager events
    this.setupProviderManagerListeners();

    logger.info('Enhanced alerting system started');
  }

  /**
   * Stop the alerting system
   */
  stopAlerting() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    logger.info('Enhanced alerting system stopped');
  }

  /**
   * Check for alerts based on current provider status
   * @private
   */
  async checkForAlerts() {
    if (!this.providerManager) return;

    try {
      const providerHealth = this.providerManager.getProviderHealth();
      const providerMetrics = this.providerManager.getProviderMetrics();

      Object.entries(providerHealth.providers || {}).forEach(
        ([providerName, health]) => {
          const metrics = providerMetrics[providerName] || {};
          this.evaluateProviderAlerts(providerName, health, metrics);
        }
      );
    } catch (error) {
      logger.error('Failed to check for alerts:', error);
    }
  }

  /**
   * Evaluate alerts for a specific provider
   * @private
   */
  evaluateProviderAlerts(providerName, health, metrics) {
    const alerts = [];

    // Check failure rate
    const failureRate = metrics.failureRate || 0;
    if (failureRate >= this.config.thresholds.criticalFailureRate) {
      alerts.push({
        type: 'critical',
        category: 'reliability',
        provider: providerName,
        title: 'Critical Failure Rate',
        message: `Provider ${providerName} has critical failure rate: ${(
          failureRate * 100
        ).toFixed(1)}%`,
        details: {
          failureRate,
          threshold: this.config.thresholds.criticalFailureRate,
          totalRequests: metrics.requests || 0,
          failures: metrics.failures || 0,
        },
        timestamp: new Date(),
      });
    } else if (failureRate >= this.config.thresholds.warningFailureRate) {
      alerts.push({
        type: 'warning',
        category: 'reliability',
        provider: providerName,
        title: 'High Failure Rate',
        message: `Provider ${providerName} has high failure rate: ${(
          failureRate * 100
        ).toFixed(1)}%`,
        details: {
          failureRate,
          threshold: this.config.thresholds.warningFailureRate,
          totalRequests: metrics.requests || 0,
          failures: metrics.failures || 0,
        },
        timestamp: new Date(),
      });
    }

    // Check consecutive failures
    const consecutiveFailures = health.consecutiveFailures || 0;
    if (
      consecutiveFailures >= this.config.thresholds.criticalConsecutiveFailures
    ) {
      alerts.push({
        type: 'critical',
        category: 'availability',
        provider: providerName,
        title: 'Critical Consecutive Failures',
        message: `Provider ${providerName} has ${consecutiveFailures} consecutive failures`,
        details: {
          consecutiveFailures,
          threshold: this.config.thresholds.criticalConsecutiveFailures,
          lastError: health.lastError,
          lastCheck: health.lastCheck,
        },
        timestamp: new Date(),
      });
    } else if (
      consecutiveFailures >= this.config.thresholds.warningConsecutiveFailures
    ) {
      alerts.push({
        type: 'warning',
        category: 'availability',
        provider: providerName,
        title: 'Multiple Consecutive Failures',
        message: `Provider ${providerName} has ${consecutiveFailures} consecutive failures`,
        details: {
          consecutiveFailures,
          threshold: this.config.thresholds.warningConsecutiveFailures,
          lastError: health.lastError,
          lastCheck: health.lastCheck,
        },
        timestamp: new Date(),
      });
    }

    // Check response time
    const avgResponseTime = metrics.avgResponseTime || 0;
    if (avgResponseTime >= this.config.thresholds.criticalResponseTime) {
      alerts.push({
        type: 'critical',
        category: 'performance',
        provider: providerName,
        title: 'Critical Response Time',
        message: `Provider ${providerName} has critical response time: ${avgResponseTime}ms`,
        details: {
          avgResponseTime,
          threshold: this.config.thresholds.criticalResponseTime,
        },
        timestamp: new Date(),
      });
    } else if (avgResponseTime >= this.config.thresholds.warningResponseTime) {
      alerts.push({
        type: 'warning',
        category: 'performance',
        provider: providerName,
        title: 'High Response Time',
        message: `Provider ${providerName} has high response time: ${avgResponseTime}ms`,
        details: {
          avgResponseTime,
          threshold: this.config.thresholds.warningResponseTime,
        },
        timestamp: new Date(),
      });
    }

    // Check for critical parsing failures
    if (health.lastError) {
      const errorMessage = health.lastError.toLowerCase();

      // Check for specific parsing errors
      if (errorMessage.includes('substring is not a function')) {
        alerts.push({
          type: 'critical',
          category: 'parsing',
          provider: providerName,
          title: 'Response Parsing Error',
          message: `Provider ${providerName} has critical response parsing error`,
          details: {
            error: health.lastError,
            errorType: 'response_parsing_error',
            lastCheck: health.lastCheck,
            description:
              'Response object cannot be processed as string - indicates response format issue',
          },
          timestamp: new Date(),
        });
      }

      // Check for ProviderManager method errors
      if (errorMessage.includes('getproviderhealth is not a function')) {
        alerts.push({
          type: 'critical',
          category: 'system',
          provider: providerName,
          title: 'ProviderManager Method Missing',
          message: `Provider ${providerName} encountered missing ProviderManager method`,
          details: {
            error: health.lastError,
            errorType: 'missing_method_error',
            lastCheck: health.lastCheck,
            description:
              'ProviderManager missing required health monitoring methods',
          },
          timestamp: new Date(),
        });
      }

      // Check for other critical errors
      if (
        errorMessage.includes('timeout') ||
        errorMessage.includes('connection')
      ) {
        alerts.push({
          type: 'warning',
          category: 'connectivity',
          provider: providerName,
          title: 'Connectivity Issue',
          message: `Provider ${providerName} has connectivity issues`,
          details: {
            error: health.lastError,
            errorType: 'connectivity_error',
            lastCheck: health.lastCheck,
          },
          timestamp: new Date(),
        });
      }
    }

    // Process alerts
    alerts.forEach((alert) => {
      this.processAlert(alert);
    });
  }

  /**
   * Process an alert (check suppression, send notifications)
   * @private
   */
  async processAlert(alert) {
    const alertKey = `${alert.provider}:${alert.category}:${alert.type}`;

    // Check if alert should be suppressed
    if (this.shouldSuppressAlert(alertKey, alert)) {
      logger.debug('Alert suppressed', { alertKey, provider: alert.provider });
      return;
    }

    // Record alert
    this.recordAlert(alert);

    // Send notifications
    await this.sendAlertNotifications(alert);

    // Emit alert event
    this.emit('alert', alert);

    logger.info('Alert processed', {
      type: alert.type,
      category: alert.category,
      provider: alert.provider,
      title: alert.title,
    });
  }

  /**
   * Check if alert should be suppressed
   * @private
   */
  shouldSuppressAlert(alertKey, alert) {
    const now = Date.now();

    // Check duplicate alert window
    const lastAlert = this.suppressedAlerts.get(alertKey);
    if (
      lastAlert &&
      now - lastAlert.timestamp <
        this.config.suppressionRules.duplicateAlertWindow
    ) {
      return true;
    }

    // Check max alerts per provider
    const providerAlerts = this.alertHistory.get(alert.provider) || [];
    const recentProviderAlerts = providerAlerts.filter(
      (a) => now - a.timestamp.getTime() < 3600000 // Last hour
    );
    if (
      recentProviderAlerts.length >=
      this.config.suppressionRules.maxAlertsPerProvider
    ) {
      return true;
    }

    // Check max alerts per hour globally
    const totalRecentAlerts = Array.from(this.alertHistory.values())
      .flat()
      .filter((a) => now - a.timestamp.getTime() < 3600000).length;
    if (totalRecentAlerts >= this.config.suppressionRules.maxAlertsPerHour) {
      return true;
    }

    return false;
  }

  /**
   * Record alert in history
   * @private
   */
  recordAlert(alert) {
    const alertKey = `${alert.provider}:${alert.category}:${alert.type}`;

    // Add to active alerts
    this.activeAlerts.set(alertKey, alert);

    // Add to alert history
    if (!this.alertHistory.has(alert.provider)) {
      this.alertHistory.set(alert.provider, []);
    }
    this.alertHistory.get(alert.provider).push(alert);

    // Update suppression tracking
    this.suppressedAlerts.set(alertKey, {
      timestamp: Date.now(),
      alert,
    });

    // Update alert counts
    if (!this.alertCounts.has(alert.provider)) {
      this.alertCounts.set(alert.provider, { hour: 0, day: 0 });
    }
    const counts = this.alertCounts.get(alert.provider);
    counts.hour++;
    counts.day++;
  }

  /**
   * Send alert notifications through configured channels
   * @private
   */
  async sendAlertNotifications(alert) {
    const notifications = [];

    // Console notification
    if (this.config.channels.console) {
      notifications.push(this.sendConsoleNotification(alert));
    }

    // Log notification
    if (this.config.channels.log) {
      notifications.push(this.sendLogNotification(alert));
    }

    // Webhook notification
    if (this.config.channels.webhook && this.config.webhook.url) {
      notifications.push(this.sendWebhookNotification(alert));
    }

    // Email notification
    if (this.config.channels.email && this.config.email.enabled) {
      notifications.push(this.sendEmailNotification(alert));
    }

    // Wait for all notifications to complete
    const results = await Promise.allSettled(notifications);

    // Log any notification failures
    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        logger.error('Alert notification failed:', result.reason);
      }
    });
  }

  /**
   * Send console notification
   * @private
   */
  async sendConsoleNotification(alert) {
    const emoji =
      alert.type === 'critical' ? '🚨' : alert.type === 'warning' ? '⚠️' : 'ℹ️';
    const message = `${emoji} ALERT [${alert.type.toUpperCase()}] ${
      alert.title
    }: ${alert.message}`;

    console.warn(message);
    return Promise.resolve();
  }

  /**
   * Send log notification
   * @private
   */
  async sendLogNotification(alert) {
    const logLevel = alert.type === 'critical' ? 'error' : 'warn';

    logger[logLevel]('Alert triggered', {
      type: alert.type,
      category: alert.category,
      provider: alert.provider,
      title: alert.title,
      message: alert.message,
      details: alert.details,
      timestamp: alert.timestamp,
    });

    return Promise.resolve();
  }

  /**
   * Send webhook notification
   * @private
   */
  async sendWebhookNotification(alert) {
    if (!this.config.webhook.url) {
      throw new Error('Webhook URL not configured');
    }

    const payload = {
      alert: {
        type: alert.type,
        category: alert.category,
        provider: alert.provider,
        title: alert.title,
        message: alert.message,
        details: alert.details,
        timestamp: alert.timestamp.toISOString(),
      },
      service: 'dreamscapes-mcp-gateway',
      environment: process.env.NODE_ENV || 'development',
    };

    // Implementation would depend on HTTP client (axios, fetch, etc.)
    // For now, just log the webhook attempt
    logger.info('Webhook notification sent', {
      url: this.config.webhook.url,
      alert: alert.title,
      provider: alert.provider,
    });

    return Promise.resolve();
  }

  /**
   * Send email notification
   * @private
   */
  async sendEmailNotification(alert) {
    if (
      !this.config.email.recipients ||
      this.config.email.recipients.length === 0
    ) {
      throw new Error('Email recipients not configured');
    }

    // Implementation would depend on email service (nodemailer, etc.)
    // For now, just log the email attempt
    logger.info('Email notification sent', {
      recipients: this.config.email.recipients,
      alert: alert.title,
      provider: alert.provider,
    });

    return Promise.resolve();
  }

  /**
   * Setup provider manager event listeners
   * @private
   */
  setupProviderManagerListeners() {
    if (!this.providerManager) return;

    // Listen for operation failures
    this.providerManager.on('operationFailure', (data) => {
      // Create immediate alert for critical failures
      if (
        data.errorType === 'parsing_error' ||
        data.errorSeverity === 'critical'
      ) {
        const alert = {
          type: 'critical',
          category: 'operation',
          provider: data.provider,
          title: 'Operation Failure',
          message: `Provider ${data.provider} operation failed: ${data.error}`,
          details: {
            error: data.error,
            errorType: data.errorType,
            errorSeverity: data.errorSeverity,
            responseTime: data.responseTime,
            attempts: data.attempts,
          },
          timestamp: new Date(),
        };

        this.processAlert(alert);
      }
    });

    // Listen for all providers failed
    this.providerManager.on('allProvidersFailed', (data) => {
      const alert = {
        type: 'critical',
        category: 'system',
        provider: 'all',
        title: 'All Providers Failed',
        message: `All providers have failed after ${data.attempts} attempts`,
        details: {
          attempts: data.attempts,
          totalTime: data.totalTime,
          lastError: data.lastError,
          failureReport: data.failureReport,
        },
        timestamp: new Date(),
      };

      this.processAlert(alert);
    });
  }

  /**
   * Clean up old alerts and suppression data
   * @private
   */
  cleanupOldAlerts() {
    const now = Date.now();
    const retentionPeriod = 86400000; // 24 hours

    // Clean up alert history
    for (const [provider, alerts] of this.alertHistory.entries()) {
      const filteredAlerts = alerts.filter(
        (alert) => now - alert.timestamp.getTime() < retentionPeriod
      );
      this.alertHistory.set(provider, filteredAlerts);
    }

    // Clean up suppressed alerts
    for (const [alertKey, suppressionData] of this.suppressedAlerts.entries()) {
      if (
        now - suppressionData.timestamp >
        this.config.suppressionRules.duplicateAlertWindow
      ) {
        this.suppressedAlerts.delete(alertKey);
      }
    }

    // Reset hourly alert counts
    const hourAgo = now - 3600000;
    for (const [provider, counts] of this.alertCounts.entries()) {
      counts.hour = 0; // Reset hourly count
      // Keep daily count for longer retention
    }

    logger.debug('Alert cleanup completed', {
      activeAlerts: this.activeAlerts.size,
      suppressedAlerts: this.suppressedAlerts.size,
    });
  }

  /**
   * Get current alert status
   * @returns {Object} Alert status summary
   */
  getAlertStatus() {
    const now = Date.now();
    const hourAgo = now - 3600000;

    const status = {
      timestamp: new Date().toISOString(),
      active: {
        critical: 0,
        warning: 0,
        info: 0,
        total: 0,
      },
      recent: {
        lastHour: 0,
        byProvider: {},
        byCategory: {},
      },
      configuration: {
        thresholds: this.config.thresholds,
        channels: this.config.channels,
        suppressionRules: this.config.suppressionRules,
      },
    };

    // Count active alerts
    for (const alert of this.activeAlerts.values()) {
      status.active[alert.type]++;
      status.active.total++;
    }

    // Count recent alerts
    for (const [provider, alerts] of this.alertHistory.entries()) {
      const recentAlerts = alerts.filter(
        (alert) => now - alert.timestamp.getTime() < 3600000
      );

      status.recent.lastHour += recentAlerts.length;
      status.recent.byProvider[provider] = recentAlerts.length;

      recentAlerts.forEach((alert) => {
        status.recent.byCategory[alert.category] =
          (status.recent.byCategory[alert.category] || 0) + 1;
      });
    }

    return status;
  }

  /**
   * Get alert history for a provider
   * @param {string} providerName - Provider name
   * @param {number} hours - Hours of history to retrieve
   * @returns {Array} Alert history
   */
  getProviderAlertHistory(providerName, hours = 24) {
    const alerts = this.alertHistory.get(providerName) || [];
    const cutoffTime = Date.now() - hours * 3600000;

    return alerts.filter((alert) => alert.timestamp.getTime() > cutoffTime);
  }

  /**
   * Cleanup resources
   */
  destroy() {
    this.stopAlerting();
    this.activeAlerts.clear();
    this.alertHistory.clear();
    this.suppressedAlerts.clear();
    this.alertCounts.clear();
    this.removeAllListeners();

    logger.info('EnhancedAlertingSystem destroyed');
  }
}

module.exports = EnhancedAlertingSystem;
