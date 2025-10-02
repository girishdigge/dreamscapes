// routes/health.js
// Enhanced health check endpoints with ProviderManager integration

const express = require('express');
const { logger } = require('../utils/logger');
const { asyncHandler } = require('../utils/errorHandler');

const router = express.Router();

/**
 * Basic health check endpoint
 * Returns overall service health status
 */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    logger.debug('Basic health check requested');

    const healthData = {
      service: 'dreamscapes-mcp-gateway',
      status: 'healthy',
      version: '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
    };

    res.json(healthData);
  })
);

/**
 * Comprehensive health check with provider status
 * Uses ProviderManager.getProviderHealth() method
 */
router.get(
  '/detailed',
  asyncHandler(async (req, res) => {
    logger.debug('Detailed health check requested');

    const providerManager = req.app.locals.providerManager;
    const startTime = Date.now();

    const healthReport = {
      service: 'dreamscapes-mcp-gateway',
      status: 'healthy',
      timestamp: new Date().toISOString(),
      responseTime: 0,
      providers: {},
      summary: {
        total: 0,
        healthy: 0,
        unhealthy: 0,
        enabled: 0,
        disabled: 0,
      },
      system: {
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        nodeVersion: process.version,
        platform: process.platform,
      },
      monitoring: {
        healthMonitorActive: false,
        metricsCollectorActive: false,
        alertingSystemActive: false,
      },
    };

    // Get provider health information using ProviderManager
    if (
      providerManager &&
      typeof providerManager.getProviderHealth === 'function'
    ) {
      try {
        const providerHealth = providerManager.getProviderHealth();

        healthReport.providers = providerHealth.providers || {};
        healthReport.summary = providerHealth.summary || healthReport.summary;

        // Check if any providers are unhealthy
        if (healthReport.summary.unhealthy > 0) {
          healthReport.status = 'degraded';
        }

        // Add monitoring system status
        if (providerManager.healthMonitor) {
          healthReport.monitoring.healthMonitorActive = true;
        }
        if (providerManager.metricsCollector) {
          healthReport.monitoring.metricsCollectorActive = true;
        }
        if (providerManager.alertingSystem) {
          healthReport.monitoring.alertingSystemActive = true;
        }

        logger.debug('Provider health retrieved successfully', {
          totalProviders: healthReport.summary.total,
          healthyProviders: healthReport.summary.healthy,
        });
      } catch (error) {
        logger.error('Failed to get provider health:', error);
        healthReport.status = 'error';
        healthReport.error = {
          message: 'Failed to retrieve provider health',
          details: error.message,
        };
      }
    } else {
      logger.warn(
        'ProviderManager not available or missing getProviderHealth method'
      );
      healthReport.status = 'degraded';
      healthReport.error = {
        message: 'ProviderManager not available',
        details: 'Provider health monitoring is not functional',
      };
    }

    healthReport.responseTime = Date.now() - startTime;

    // Set appropriate HTTP status code
    const statusCode =
      healthReport.status === 'healthy'
        ? 200
        : healthReport.status === 'degraded'
        ? 206
        : 503;

    res.status(statusCode).json(healthReport);
  })
);

/**
 * Provider-specific health check
 * Checks health of a specific provider
 */
router.get(
  '/provider/:providerName',
  asyncHandler(async (req, res) => {
    const { providerName } = req.params;
    logger.debug('Provider-specific health check requested', {
      provider: providerName,
    });

    const providerManager = req.app.locals.providerManager;
    const startTime = Date.now();

    if (
      !providerManager ||
      typeof providerManager.getProviderHealth !== 'function'
    ) {
      return res.status(503).json({
        success: false,
        error: 'ProviderManager not available',
        provider: providerName,
        timestamp: new Date().toISOString(),
      });
    }

    try {
      const providerHealth = providerManager.getProviderHealth(providerName);
      const responseTime = Date.now() - startTime;

      if (providerHealth.status === 'unknown') {
        return res.status(404).json({
          success: false,
          error: 'Provider not found',
          provider: providerName,
          timestamp: new Date().toISOString(),
          responseTime,
        });
      }

      const statusCode = providerHealth.isHealthy ? 200 : 503;

      res.status(statusCode).json({
        success: providerHealth.isHealthy,
        provider: providerName,
        health: providerHealth,
        responseTime,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Provider health check failed:', error);
      res.status(500).json({
        success: false,
        error: 'Health check failed',
        provider: providerName,
        details: error.message,
        timestamp: new Date().toISOString(),
        responseTime: Date.now() - startTime,
      });
    }
  })
);

/**
 * Live health check endpoint
 * Performs real-time health checks on providers
 */
router.post(
  '/check',
  asyncHandler(async (req, res) => {
    logger.debug('Live health check requested');

    const { providers } = req.body;
    const providerManager = req.app.locals.providerManager;
    const startTime = Date.now();

    if (!providerManager || typeof providerManager.healthCheck !== 'function') {
      return res.status(503).json({
        success: false,
        error: 'ProviderManager not available',
        timestamp: new Date().toISOString(),
      });
    }

    try {
      // Perform live health checks
      const healthResults = await providerManager.healthCheck(providers);
      const responseTime = Date.now() - startTime;

      // Calculate summary
      const summary = {
        total: Object.keys(healthResults).length,
        healthy: 0,
        unhealthy: 0,
        errors: 0,
      };

      Object.values(healthResults).forEach((result) => {
        if (result.error) {
          summary.errors++;
        } else if (result.isHealthy) {
          summary.healthy++;
        } else {
          summary.unhealthy++;
        }
      });

      const overallHealthy = summary.healthy > 0 && summary.errors === 0;

      res.status(overallHealthy ? 200 : 503).json({
        success: overallHealthy,
        results: healthResults,
        summary,
        responseTime,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Live health check failed:', error);
      res.status(500).json({
        success: false,
        error: 'Health check failed',
        details: error.message,
        responseTime: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      });
    }
  })
);

/**
 * Response processing metrics endpoint
 * Returns metrics about response parsing and processing
 */
router.get(
  '/response-processing',
  asyncHandler(async (req, res) => {
    logger.debug('Response processing metrics requested');

    const providerManager = req.app.locals.providerManager;
    const startTime = Date.now();

    const metrics = {
      timestamp: new Date().toISOString(),
      responseTime: 0,
      processing: {
        totalRequests: 0,
        successfulParsing: 0,
        failedParsing: 0,
        parsingSuccessRate: 0,
        averageProcessingTime: 0,
      },
      providers: {},
      errors: {
        parsingErrors: 0,
        timeoutErrors: 0,
        formatErrors: 0,
        unknownErrors: 0,
      },
      performance: {
        fastestProvider: null,
        slowestProvider: null,
        mostReliableProvider: null,
      },
    };

    if (providerManager && providerManager.metricsCollector) {
      try {
        // Get comprehensive metrics from MetricsCollector
        const metricsReport = providerManager.metricsCollector.getMetricsReport(
          null,
          {
            timeRange: '1h',
            includeRealtime: true,
            includeBaseline: true,
          }
        );

        // Process metrics for response processing information
        let totalRequests = 0;
        let totalSuccesses = 0;
        let totalFailures = 0;
        let totalResponseTime = 0;
        let providerCount = 0;

        const providerPerformance = [];

        Object.entries(metricsReport.providers || {}).forEach(
          ([providerName, providerData]) => {
            const aggregated = providerData.aggregated || {};
            const realtime = providerData.realtime || {};

            totalRequests += aggregated.requests || 0;
            totalSuccesses += aggregated.successes || 0;
            totalFailures += aggregated.failures || 0;
            totalResponseTime += aggregated.avgResponseTime || 0;
            providerCount++;

            // Count error types
            if (aggregated.errorTypes) {
              Object.entries(aggregated.errorTypes).forEach(
                ([errorType, count]) => {
                  if (
                    errorType.includes('parsing') ||
                    errorType.includes('format')
                  ) {
                    metrics.errors.parsingErrors += count;
                  } else if (errorType.includes('timeout')) {
                    metrics.errors.timeoutErrors += count;
                  } else if (errorType.includes('format')) {
                    metrics.errors.formatErrors += count;
                  } else {
                    metrics.errors.unknownErrors += count;
                  }
                }
              );
            }

            metrics.providers[providerName] = {
              requests: aggregated.requests || 0,
              successes: aggregated.successes || 0,
              failures: aggregated.failures || 0,
              successRate: aggregated.successRate || 0,
              avgResponseTime: aggregated.avgResponseTime || 0,
              healthScore: aggregated.healthScore || 0,
              activeRequests: realtime?.activeRequests || 0,
              lastActivity: realtime?.lastActivity,
            };

            providerPerformance.push({
              name: providerName,
              successRate: aggregated.successRate || 0,
              avgResponseTime: aggregated.avgResponseTime || 0,
              healthScore: aggregated.healthScore || 0,
            });
          }
        );

        // Calculate overall metrics
        metrics.processing.totalRequests = totalRequests;
        metrics.processing.successfulParsing = totalSuccesses;
        metrics.processing.failedParsing = totalFailures;
        metrics.processing.parsingSuccessRate =
          totalRequests > 0 ? totalSuccesses / totalRequests : 0;
        metrics.processing.averageProcessingTime =
          providerCount > 0 ? totalResponseTime / providerCount : 0;

        // Determine performance leaders
        if (providerPerformance.length > 0) {
          const sortedBySpeed = [...providerPerformance].sort(
            (a, b) => a.avgResponseTime - b.avgResponseTime
          );
          const sortedByReliability = [...providerPerformance].sort(
            (a, b) => b.successRate - a.successRate
          );

          metrics.performance.fastestProvider = sortedBySpeed[0]?.name;
          metrics.performance.slowestProvider =
            sortedBySpeed[sortedBySpeed.length - 1]?.name;
          metrics.performance.mostReliableProvider =
            sortedByReliability[0]?.name;
        }

        logger.debug('Response processing metrics calculated successfully', {
          totalRequests,
          successRate: metrics.processing.parsingSuccessRate,
        });
      } catch (error) {
        logger.error('Failed to get response processing metrics:', error);
        metrics.error = {
          message: 'Failed to retrieve processing metrics',
          details: error.message,
        };
      }
    } else {
      logger.warn('MetricsCollector not available');
      metrics.error = {
        message: 'MetricsCollector not available',
        details: 'Response processing metrics are not being collected',
      };
    }

    metrics.responseTime = Date.now() - startTime;

    res.json(metrics);
  })
);

/**
 * Critical parsing failures alert endpoint
 * Returns information about critical parsing failures
 */
router.get(
  '/parsing-alerts',
  asyncHandler(async (req, res) => {
    logger.debug('Parsing alerts requested');

    const providerManager = req.app.locals.providerManager;
    const startTime = Date.now();

    const alertData = {
      timestamp: new Date().toISOString(),
      responseTime: 0,
      alerts: [],
      summary: {
        critical: 0,
        warning: 0,
        info: 0,
        total: 0,
      },
      thresholds: {
        criticalFailureRate: 0.5, // 50% failure rate
        warningFailureRate: 0.2, // 20% failure rate
        criticalConsecutiveFailures: 5,
        warningConsecutiveFailures: 3,
      },
    };

    if (providerManager) {
      try {
        // Get provider health and metrics
        const providerHealth = providerManager.getProviderHealth();
        const providerMetrics = providerManager.getProviderMetrics();

        Object.entries(providerHealth.providers || {}).forEach(
          ([providerName, health]) => {
            const metrics = providerMetrics[providerName] || {};
            const failureRate = metrics.failureRate || 0;
            const consecutiveFailures = health.consecutiveFailures || 0;

            // Check for critical parsing failures
            if (failureRate >= alertData.thresholds.criticalFailureRate) {
              alertData.alerts.push({
                type: 'critical',
                provider: providerName,
                message: `Critical failure rate: ${(failureRate * 100).toFixed(
                  1
                )}%`,
                details: {
                  failureRate,
                  totalRequests: metrics.requests || 0,
                  failures: metrics.failures || 0,
                  consecutiveFailures,
                },
                timestamp: new Date().toISOString(),
              });
              alertData.summary.critical++;
            } else if (failureRate >= alertData.thresholds.warningFailureRate) {
              alertData.alerts.push({
                type: 'warning',
                provider: providerName,
                message: `High failure rate: ${(failureRate * 100).toFixed(
                  1
                )}%`,
                details: {
                  failureRate,
                  totalRequests: metrics.requests || 0,
                  failures: metrics.failures || 0,
                  consecutiveFailures,
                },
                timestamp: new Date().toISOString(),
              });
              alertData.summary.warning++;
            }

            // Check for consecutive failures
            if (
              consecutiveFailures >=
              alertData.thresholds.criticalConsecutiveFailures
            ) {
              alertData.alerts.push({
                type: 'critical',
                provider: providerName,
                message: `Critical consecutive failures: ${consecutiveFailures}`,
                details: {
                  consecutiveFailures,
                  lastError: health.lastError,
                  lastCheck: health.lastCheck,
                },
                timestamp: new Date().toISOString(),
              });
              alertData.summary.critical++;
            } else if (
              consecutiveFailures >=
              alertData.thresholds.warningConsecutiveFailures
            ) {
              alertData.alerts.push({
                type: 'warning',
                provider: providerName,
                message: `High consecutive failures: ${consecutiveFailures}`,
                details: {
                  consecutiveFailures,
                  lastError: health.lastError,
                  lastCheck: health.lastCheck,
                },
                timestamp: new Date().toISOString(),
              });
              alertData.summary.warning++;
            }

            // Check for parsing-specific errors
            if (
              health.lastError &&
              health.lastError.includes('substring is not a function')
            ) {
              alertData.alerts.push({
                type: 'critical',
                provider: providerName,
                message: 'Response parsing error detected',
                details: {
                  error: health.lastError,
                  errorType: 'parsing_error',
                  lastCheck: health.lastCheck,
                },
                timestamp: new Date().toISOString(),
              });
              alertData.summary.critical++;
            }
          }
        );

        alertData.summary.total = alertData.alerts.length;

        logger.debug('Parsing alerts calculated', {
          totalAlerts: alertData.summary.total,
          criticalAlerts: alertData.summary.critical,
        });
      } catch (error) {
        logger.error('Failed to get parsing alerts:', error);
        alertData.error = {
          message: 'Failed to retrieve parsing alerts',
          details: error.message,
        };
      }
    } else {
      logger.warn('ProviderManager not available for parsing alerts');
      alertData.error = {
        message: 'ProviderManager not available',
        details: 'Cannot retrieve parsing alert information',
      };
    }

    alertData.responseTime = Date.now() - startTime;

    // Set status code based on alert severity
    const statusCode =
      alertData.summary.critical > 0
        ? 503
        : alertData.summary.warning > 0
        ? 206
        : 200;

    res.status(statusCode).json(alertData);
  })
);

module.exports = router;
