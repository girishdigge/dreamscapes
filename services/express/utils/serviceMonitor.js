// services/express/utils/serviceMonitor.js
const fetch = require('node-fetch');
const { logger } = require('./logger');
const { dreamProcessingLogger } = require('./dreamProcessingLogger');

/**
 * Service Health Monitoring and Status Reporting System
 *
 * This module provides comprehensive monitoring for:
 * - MCP Gateway connectivity and response times
 * - AI service availability and performance
 * - Fallback usage rates and error patterns
 * - Service health metrics and alerting
 */
class ServiceMonitor {
  constructor() {
    this.metrics = {
      mcpGateway: {
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        averageResponseTime: 0,
        lastHealthCheck: null,
        lastError: null,
        consecutiveFailures: 0,
        uptime: 0,
        downtime: 0,
        lastStatusChange: Date.now(),
        currentStatus: 'unknown',
      },
      aiServices: {
        openai: {
          totalRequests: 0,
          successfulRequests: 0,
          failedRequests: 0,
          averageResponseTime: 0,
          lastUsed: null,
          lastError: null,
          rateLimitHits: 0,
        },
        cerebras: {
          totalRequests: 0,
          successfulRequests: 0,
          failedRequests: 0,
          averageResponseTime: 0,
          lastUsed: null,
          lastError: null,
          rateLimitHits: 0,
        },
      },
      fallbackUsage: {
        totalFallbacks: 0,
        fallbackReasons: {},
        fallbackTypes: {
          local_fallback: 0,
          safe_fallback: 0,
          emergency_fallback: 0,
          ai_repaired: 0,
        },
        fallbackRate: 0,
        lastFallback: null,
      },
      errorPatterns: {
        networkErrors: 0,
        timeoutErrors: 0,
        validationErrors: 0,
        parsingErrors: 0,
        httpErrors: {},
        errorsByHour: {},
        commonErrorMessages: {},
      },
      performance: {
        averageProcessingTime: 0,
        slowRequests: 0, // > 10 seconds
        verySlowRequests: 0, // > 30 seconds
        fastRequests: 0, // < 5 seconds
        totalProcessingTime: 0,
        totalRequests: 0,
      },
    };

    this.healthCheckInterval = null;
    this.metricsResetInterval = null;
    this.alertThresholds = {
      mcpGatewayFailureRate: 0.5, // 50% failure rate
      consecutiveFailures: 5,
      averageResponseTime: 10000, // 10 seconds
      fallbackRate: 0.3, // 30% fallback rate
      errorRate: 0.2, // 20% error rate
    };

    this.startMonitoring();
  }

  /**
   * Start continuous monitoring
   */
  startMonitoring() {
    // Health check every 30 seconds
    this.healthCheckInterval = setInterval(() => {
      this.performHealthCheck();
    }, 30000);

    // Reset hourly metrics every hour
    this.metricsResetInterval = setInterval(() => {
      this.resetHourlyMetrics();
    }, 3600000); // 1 hour

    logger.info('Service monitoring started', {
      healthCheckInterval: '30s',
      metricsResetInterval: '1h',
      alertThresholds: this.alertThresholds,
    });
  }

  /**
   * Stop monitoring
   */
  stopMonitoring() {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
    if (this.metricsResetInterval) {
      clearInterval(this.metricsResetInterval);
      this.metricsResetInterval = null;
    }
    logger.info('Service monitoring stopped');
  }

  /**
   * Perform comprehensive health check
   */
  async performHealthCheck() {
    const startTime = Date.now();

    try {
      await this.checkMCPGatewayHealth();
      await this.analyzeErrorPatterns();
      await this.calculatePerformanceMetrics();
      this.checkAlertConditions();

      const checkDuration = Date.now() - startTime;
      logger.debug('Health check completed', {
        duration: `${checkDuration}ms`,
        mcpStatus: this.metrics.mcpGateway.currentStatus,
        fallbackRate: this.metrics.fallbackUsage.fallbackRate,
        errorRate: this.getErrorRate(),
      });
    } catch (error) {
      logger.error('Health check failed', {
        error: error.message,
        duration: `${Date.now() - startTime}ms`,
      });
    }
  }

  /**
   * Check MCP Gateway health and connectivity
   */
  async checkMCPGatewayHealth() {
    const mcpUrl = process.env.MCP_GATEWAY_URL || 'http://mcp-gateway:8080';
    const startTime = Date.now();

    try {
      const response = await fetch(`${mcpUrl}/health`, {
        method: 'GET',
        timeout: 5000,
        headers: {
          Accept: 'application/json',
          'User-Agent': 'Dreamscapes-Express-Monitor/1.0.0',
        },
      });

      const responseTime = Date.now() - startTime;
      const isHealthy = response.ok;

      // Update metrics
      this.updateMCPGatewayMetrics(isHealthy, responseTime, null);

      if (isHealthy) {
        try {
          const healthData = await response.json();
          logger.debug('MCP Gateway health check successful', {
            responseTime: `${responseTime}ms`,
            status: response.status,
            mcpVersion: healthData.version,
            mcpUptime: healthData.uptime,
          });
        } catch (parseError) {
          logger.warn('MCP Gateway health response parsing failed', {
            responseTime: `${responseTime}ms`,
            status: response.status,
            parseError: parseError.message,
          });
        }
      } else {
        const errorText = await response
          .text()
          .catch(() => 'Unable to read error');
        logger.warn('MCP Gateway health check failed', {
          responseTime: `${responseTime}ms`,
          status: response.status,
          error: errorText,
        });
      }
    } catch (error) {
      const responseTime = Date.now() - startTime;
      this.updateMCPGatewayMetrics(false, responseTime, error);

      logger.error('MCP Gateway health check error', {
        error: error.message,
        responseTime: `${responseTime}ms`,
        errorType: error.name,
        code: error.code,
      });
    }
  }

  /**
   * Update MCP Gateway metrics
   */
  updateMCPGatewayMetrics(isHealthy, responseTime, error) {
    const mcp = this.metrics.mcpGateway;
    const now = Date.now();

    mcp.totalRequests++;

    if (isHealthy) {
      mcp.successfulRequests++;
      mcp.consecutiveFailures = 0;

      if (mcp.currentStatus !== 'healthy') {
        mcp.currentStatus = 'healthy';
        mcp.lastStatusChange = now;
        logger.info('MCP Gateway status changed to healthy', {
          previousDowntime:
            mcp.currentStatus === 'unhealthy' ? now - mcp.lastStatusChange : 0,
        });
      }
    } else {
      mcp.failedRequests++;
      mcp.consecutiveFailures++;
      mcp.lastError = {
        timestamp: now,
        error: error?.message || 'HTTP error',
        responseTime,
      };

      if (mcp.currentStatus !== 'unhealthy') {
        mcp.currentStatus = 'unhealthy';
        mcp.lastStatusChange = now;
        logger.warn('MCP Gateway status changed to unhealthy', {
          consecutiveFailures: mcp.consecutiveFailures,
          lastError: error?.message,
        });
      }
    }

    // Update average response time
    mcp.averageResponseTime = this.calculateMovingAverage(
      mcp.averageResponseTime,
      responseTime,
      mcp.totalRequests
    );

    mcp.lastHealthCheck = now;
  }

  /**
   * Record MCP Gateway request metrics
   */
  recordMCPRequest(success, responseTime, source, error = null) {
    const mcp = this.metrics.mcpGateway;
    mcp.totalRequests++;

    if (success) {
      mcp.successfulRequests++;
      mcp.consecutiveFailures = 0;
    } else {
      mcp.failedRequests++;
      mcp.consecutiveFailures++;
      if (error) {
        mcp.lastError = {
          timestamp: Date.now(),
          error: error.message,
          responseTime,
        };
      }
    }

    mcp.averageResponseTime = this.calculateMovingAverage(
      mcp.averageResponseTime,
      responseTime,
      mcp.totalRequests
    );

    // Record AI service usage
    if (source && this.metrics.aiServices[source]) {
      const aiService = this.metrics.aiServices[source];
      aiService.totalRequests++;
      aiService.lastUsed = Date.now();

      if (success) {
        aiService.successfulRequests++;
      } else {
        aiService.failedRequests++;
        if (error) {
          aiService.lastError = {
            timestamp: Date.now(),
            error: error.message,
          };
        }
      }

      aiService.averageResponseTime = this.calculateMovingAverage(
        aiService.averageResponseTime,
        responseTime,
        aiService.totalRequests
      );
    }
  }

  /**
   * Record fallback usage
   */
  recordFallbackUsage(reason, fallbackType) {
    const fallback = this.metrics.fallbackUsage;
    fallback.totalFallbacks++;
    fallback.lastFallback = Date.now();

    // Track fallback reasons
    if (!fallback.fallbackReasons[reason]) {
      fallback.fallbackReasons[reason] = 0;
    }
    fallback.fallbackReasons[reason]++;

    // Track fallback types
    if (fallback.fallbackTypes[fallbackType] !== undefined) {
      fallback.fallbackTypes[fallbackType]++;
    }

    // Calculate fallback rate
    const totalRequests = this.metrics.performance.totalRequests;
    fallback.fallbackRate =
      totalRequests > 0 ? fallback.totalFallbacks / totalRequests : 0;

    logger.info('Fallback usage recorded', {
      reason,
      fallbackType,
      totalFallbacks: fallback.totalFallbacks,
      fallbackRate: fallback.fallbackRate.toFixed(3),
    });
  }

  /**
   * Record error pattern
   */
  recordError(errorType, errorMessage, httpStatus = null) {
    const errors = this.metrics.errorPatterns;
    const hour = new Date().getHours();

    // Track error types
    switch (errorType) {
      case 'network':
        errors.networkErrors++;
        break;
      case 'timeout':
        errors.timeoutErrors++;
        break;
      case 'validation':
        errors.validationErrors++;
        break;
      case 'parsing':
        errors.parsingErrors++;
        break;
    }

    // Track HTTP errors
    if (httpStatus) {
      if (!errors.httpErrors[httpStatus]) {
        errors.httpErrors[httpStatus] = 0;
      }
      errors.httpErrors[httpStatus]++;
    }

    // Track errors by hour
    if (!errors.errorsByHour[hour]) {
      errors.errorsByHour[hour] = 0;
    }
    errors.errorsByHour[hour]++;

    // Track common error messages
    const messageKey = errorMessage.slice(0, 100); // Truncate for grouping
    if (!errors.commonErrorMessages[messageKey]) {
      errors.commonErrorMessages[messageKey] = 0;
    }
    errors.commonErrorMessages[messageKey]++;
  }

  /**
   * Record performance metrics
   */
  recordPerformance(processingTime) {
    const perf = this.metrics.performance;
    perf.totalRequests++;
    perf.totalProcessingTime += processingTime;

    // Categorize request speed
    if (processingTime > 30000) {
      perf.verySlowRequests++;
    } else if (processingTime > 10000) {
      perf.slowRequests++;
    } else if (processingTime < 5000) {
      perf.fastRequests++;
    }

    // Update average
    perf.averageProcessingTime = perf.totalProcessingTime / perf.totalRequests;
  }

  /**
   * Analyze error patterns and trends
   */
  async analyzeErrorPatterns() {
    const errors = this.metrics.errorPatterns;
    const totalErrors =
      errors.networkErrors +
      errors.timeoutErrors +
      errors.validationErrors +
      errors.parsingErrors;

    if (totalErrors > 0) {
      const errorRate = this.getErrorRate();

      if (errorRate > this.alertThresholds.errorRate) {
        logger.warn('High error rate detected', {
          errorRate: errorRate.toFixed(3),
          threshold: this.alertThresholds.errorRate,
          networkErrors: errors.networkErrors,
          timeoutErrors: errors.timeoutErrors,
          validationErrors: errors.validationErrors,
          parsingErrors: errors.parsingErrors,
        });
      }

      // Analyze error trends
      const currentHour = new Date().getHours();
      const currentHourErrors = errors.errorsByHour[currentHour] || 0;

      if (currentHourErrors > 10) {
        // More than 10 errors in current hour
        logger.warn('High error count in current hour', {
          hour: currentHour,
          errorCount: currentHourErrors,
          totalErrors,
        });
      }
    }
  }

  /**
   * Calculate performance metrics
   */
  async calculatePerformanceMetrics() {
    const perf = this.metrics.performance;

    if (perf.totalRequests > 0) {
      const slowRequestRate =
        (perf.slowRequests + perf.verySlowRequests) / perf.totalRequests;

      if (slowRequestRate > 0.2) {
        // More than 20% slow requests
        logger.warn('High slow request rate detected', {
          slowRequestRate: slowRequestRate.toFixed(3),
          slowRequests: perf.slowRequests,
          verySlowRequests: perf.verySlowRequests,
          totalRequests: perf.totalRequests,
          averageProcessingTime: `${perf.averageProcessingTime.toFixed(0)}ms`,
        });
      }
    }
  }

  /**
   * Check alert conditions and trigger alerts
   */
  checkAlertConditions() {
    const mcp = this.metrics.mcpGateway;
    const fallback = this.metrics.fallbackUsage;

    // Check MCP Gateway failure rate
    if (mcp.totalRequests > 10) {
      // Only check if we have enough data
      const failureRate = mcp.failedRequests / mcp.totalRequests;
      if (failureRate > this.alertThresholds.mcpGatewayFailureRate) {
        logger.error('MCP Gateway high failure rate alert', {
          failureRate: failureRate.toFixed(3),
          threshold: this.alertThresholds.mcpGatewayFailureRate,
          failedRequests: mcp.failedRequests,
          totalRequests: mcp.totalRequests,
          consecutiveFailures: mcp.consecutiveFailures,
        });
      }
    }

    // Check consecutive failures
    if (mcp.consecutiveFailures >= this.alertThresholds.consecutiveFailures) {
      logger.error('MCP Gateway consecutive failures alert', {
        consecutiveFailures: mcp.consecutiveFailures,
        threshold: this.alertThresholds.consecutiveFailures,
        lastError: mcp.lastError,
      });
    }

    // Check average response time
    if (mcp.averageResponseTime > this.alertThresholds.averageResponseTime) {
      logger.warn('MCP Gateway slow response time alert', {
        averageResponseTime: `${mcp.averageResponseTime.toFixed(0)}ms`,
        threshold: `${this.alertThresholds.averageResponseTime}ms`,
      });
    }

    // Check fallback rate
    if (fallback.fallbackRate > this.alertThresholds.fallbackRate) {
      logger.warn('High fallback usage rate alert', {
        fallbackRate: fallback.fallbackRate.toFixed(3),
        threshold: this.alertThresholds.fallbackRate,
        totalFallbacks: fallback.totalFallbacks,
        topReasons: this.getTopFallbackReasons(3),
      });
    }
  }

  /**
   * Get comprehensive service status
   */
  getServiceStatus() {
    const now = Date.now();
    const mcp = this.metrics.mcpGateway;

    return {
      timestamp: new Date().toISOString(),
      overall: this.getOverallStatus(),
      services: {
        mcpGateway: {
          status: mcp.currentStatus,
          url: process.env.MCP_GATEWAY_URL || 'http://mcp-gateway:8080',
          uptime:
            mcp.currentStatus === 'healthy' ? now - mcp.lastStatusChange : 0,
          downtime:
            mcp.currentStatus === 'unhealthy' ? now - mcp.lastStatusChange : 0,
          responseTime: `${mcp.averageResponseTime.toFixed(0)}ms`,
          successRate:
            mcp.totalRequests > 0
              ? ((mcp.successfulRequests / mcp.totalRequests) * 100).toFixed(
                  1
                ) + '%'
              : 'N/A',
          consecutiveFailures: mcp.consecutiveFailures,
          lastHealthCheck: mcp.lastHealthCheck
            ? new Date(mcp.lastHealthCheck).toISOString()
            : null,
          lastError: mcp.lastError,
        },
        aiServices: this.getAIServicesStatus(),
        fallbackSystem: {
          status: 'operational',
          fallbackRate:
            (this.metrics.fallbackUsage.fallbackRate * 100).toFixed(1) + '%',
          totalFallbacks: this.metrics.fallbackUsage.totalFallbacks,
          lastFallback: this.metrics.fallbackUsage.lastFallback
            ? new Date(this.metrics.fallbackUsage.lastFallback).toISOString()
            : null,
          topReasons: this.getTopFallbackReasons(5),
        },
      },
      performance: {
        averageProcessingTime: `${this.metrics.performance.averageProcessingTime.toFixed(
          0
        )}ms`,
        slowRequestRate:
          this.metrics.performance.totalRequests > 0
            ? (
                ((this.metrics.performance.slowRequests +
                  this.metrics.performance.verySlowRequests) /
                  this.metrics.performance.totalRequests) *
                100
              ).toFixed(1) + '%'
            : 'N/A',
        totalRequests: this.metrics.performance.totalRequests,
        errorRate: (this.getErrorRate() * 100).toFixed(1) + '%',
      },
      alerts: this.getActiveAlerts(),
    };
  }

  /**
   * Get AI services status
   */
  getAIServicesStatus() {
    const aiStatus = {};

    for (const [serviceName, service] of Object.entries(
      this.metrics.aiServices
    )) {
      aiStatus[serviceName] = {
        status:
          service.totalRequests > 0
            ? service.failedRequests / service.totalRequests < 0.5
              ? 'healthy'
              : 'degraded'
            : 'unknown',
        totalRequests: service.totalRequests,
        successRate:
          service.totalRequests > 0
            ? (
                (service.successfulRequests / service.totalRequests) *
                100
              ).toFixed(1) + '%'
            : 'N/A',
        averageResponseTime:
          service.totalRequests > 0
            ? `${service.averageResponseTime.toFixed(0)}ms`
            : 'N/A',
        lastUsed: service.lastUsed
          ? new Date(service.lastUsed).toISOString()
          : null,
        lastError: service.lastError,
      };
    }

    return aiStatus;
  }

  /**
   * Get overall system status
   */
  getOverallStatus() {
    const mcp = this.metrics.mcpGateway;
    const errorRate = this.getErrorRate();
    const fallbackRate = this.metrics.fallbackUsage.fallbackRate;

    if (mcp.currentStatus === 'unhealthy' || errorRate > 0.5) {
      return 'unhealthy';
    } else if (
      mcp.consecutiveFailures > 2 ||
      errorRate > 0.2 ||
      fallbackRate > 0.3
    ) {
      return 'degraded';
    } else {
      return 'healthy';
    }
  }

  /**
   * Get active alerts
   */
  getActiveAlerts() {
    const alerts = [];
    const mcp = this.metrics.mcpGateway;
    const fallback = this.metrics.fallbackUsage;

    if (mcp.consecutiveFailures >= this.alertThresholds.consecutiveFailures) {
      alerts.push({
        type: 'error',
        message: `MCP Gateway has ${mcp.consecutiveFailures} consecutive failures`,
        threshold: this.alertThresholds.consecutiveFailures,
      });
    }

    if (mcp.totalRequests > 10) {
      const failureRate = mcp.failedRequests / mcp.totalRequests;
      if (failureRate > this.alertThresholds.mcpGatewayFailureRate) {
        alerts.push({
          type: 'warning',
          message: `MCP Gateway failure rate is ${(failureRate * 100).toFixed(
            1
          )}%`,
          threshold:
            (this.alertThresholds.mcpGatewayFailureRate * 100).toFixed(1) + '%',
        });
      }
    }

    if (fallback.fallbackRate > this.alertThresholds.fallbackRate) {
      alerts.push({
        type: 'warning',
        message: `High fallback usage rate: ${(
          fallback.fallbackRate * 100
        ).toFixed(1)}%`,
        threshold: (this.alertThresholds.fallbackRate * 100).toFixed(1) + '%',
      });
    }

    const errorRate = this.getErrorRate();
    if (errorRate > this.alertThresholds.errorRate) {
      alerts.push({
        type: 'warning',
        message: `High error rate: ${(errorRate * 100).toFixed(1)}%`,
        threshold: (this.alertThresholds.errorRate * 100).toFixed(1) + '%',
      });
    }

    return alerts;
  }

  /**
   * Get error rate
   */
  getErrorRate() {
    const errors = this.metrics.errorPatterns;
    const totalErrors =
      errors.networkErrors +
      errors.timeoutErrors +
      errors.validationErrors +
      errors.parsingErrors;
    const totalRequests = this.metrics.performance.totalRequests;

    return totalRequests > 0 ? totalErrors / totalRequests : 0;
  }

  /**
   * Get top fallback reasons
   */
  getTopFallbackReasons(limit = 5) {
    const reasons = this.metrics.fallbackUsage.fallbackReasons;
    return Object.entries(reasons)
      .sort(([, a], [, b]) => b - a)
      .slice(0, limit)
      .map(([reason, count]) => ({ reason, count }));
  }

  /**
   * Calculate moving average
   */
  calculateMovingAverage(currentAverage, newValue, totalCount) {
    if (totalCount === 1) {
      return newValue;
    }
    return (currentAverage * (totalCount - 1) + newValue) / totalCount;
  }

  /**
   * Reset hourly metrics
   */
  resetHourlyMetrics() {
    const currentHour = new Date().getHours();
    logger.info('Resetting hourly metrics', {
      hour: currentHour,
      errorsThisHour: this.metrics.errorPatterns.errorsByHour[currentHour] || 0,
    });

    // Keep only last 24 hours of error data
    const errors = this.metrics.errorPatterns.errorsByHour;
    const hoursToKeep = 24;
    const oldestHour = (currentHour - hoursToKeep + 24) % 24;

    for (let hour = 0; hour < 24; hour++) {
      if (hour === oldestHour) {
        delete errors[hour];
      }
    }
  }

  /**
   * Get detailed metrics for debugging
   */
  getDetailedMetrics() {
    return {
      timestamp: new Date().toISOString(),
      metrics: this.metrics,
      alertThresholds: this.alertThresholds,
      monitoringStatus: {
        healthCheckInterval: this.healthCheckInterval ? '30s' : 'stopped',
        metricsResetInterval: this.metricsResetInterval ? '1h' : 'stopped',
      },
    };
  }

  /**
   * Reset all metrics (for testing or maintenance)
   */
  resetMetrics() {
    logger.warn('Resetting all service monitoring metrics');

    this.metrics = {
      mcpGateway: {
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        averageResponseTime: 0,
        lastHealthCheck: null,
        lastError: null,
        consecutiveFailures: 0,
        uptime: 0,
        downtime: 0,
        lastStatusChange: Date.now(),
        currentStatus: 'unknown',
      },
      aiServices: {
        openai: {
          totalRequests: 0,
          successfulRequests: 0,
          failedRequests: 0,
          averageResponseTime: 0,
          lastUsed: null,
          lastError: null,
          rateLimitHits: 0,
        },
        cerebras: {
          totalRequests: 0,
          successfulRequests: 0,
          failedRequests: 0,
          averageResponseTime: 0,
          lastUsed: null,
          lastError: null,
          rateLimitHits: 0,
        },
      },
      fallbackUsage: {
        totalFallbacks: 0,
        fallbackReasons: {},
        fallbackTypes: {
          local_fallback: 0,
          safe_fallback: 0,
          emergency_fallback: 0,
          ai_repaired: 0,
        },
        fallbackRate: 0,
        lastFallback: null,
      },
      errorPatterns: {
        networkErrors: 0,
        timeoutErrors: 0,
        validationErrors: 0,
        parsingErrors: 0,
        httpErrors: {},
        errorsByHour: {},
        commonErrorMessages: {},
      },
      performance: {
        averageProcessingTime: 0,
        slowRequests: 0,
        verySlowRequests: 0,
        fastRequests: 0,
        totalProcessingTime: 0,
        totalRequests: 0,
      },
    };
  }
}

// Create singleton instance
const serviceMonitor = new ServiceMonitor();

// Graceful shutdown
process.on('SIGTERM', () => {
  serviceMonitor.stopMonitoring();
});

process.on('SIGINT', () => {
  serviceMonitor.stopMonitoring();
});

module.exports = {
  serviceMonitor,
  ServiceMonitor,
};
