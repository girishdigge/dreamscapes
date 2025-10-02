// routes/monitoring.js
// Enhanced monitoring endpoints with response processing metrics and alerting

const express = require('express');
const { logger } = require('../utils/logger');
const { asyncHandler } = require('../utils/errorHandler');

const router = express.Router();

/**
 * Comprehensive monitoring dashboard endpoint
 * Provides all monitoring data in a single response
 */
router.get(
  '/dashboard',
  asyncHandler(async (req, res) => {
    logger.debug('Monitoring dashboard requested');

    const providerManager = req.app.locals.providerManager;
    const startTime = Date.now();

    const dashboard = {
      timestamp: new Date().toISOString(),
      responseTime: 0,
      system: {
        service: 'dreamscapes-mcp-gateway',
        version: '1.0.0',
        environment: process.env.NODE_ENV || 'development',
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        nodeVersion: process.version,
        platform: process.platform,
      },
      providers: {
        summary: {
          total: 0,
          healthy: 0,
          unhealthy: 0,
          enabled: 0,
          disabled: 0,
        },
        details: {},
      },
      metrics: {
        requests: {
          total: 0,
          successful: 0,
          failed: 0,
          successRate: 0,
        },
        performance: {
          averageResponseTime: 0,
          fastestProvider: null,
          slowestProvider: null,
          mostReliableProvider: null,
        },
        errors: {
          parsingErrors: 0,
          timeoutErrors: 0,
          connectionErrors: 0,
          unknownErrors: 0,
        },
      },
      alerts: {
        critical: 0,
        warning: 0,
        info: 0,
        recent: [],
      },
      monitoring: {
        healthMonitorActive: false,
        metricsCollectorActive: false,
        alertingSystemActive: false,
        lastHealthCheck: null,
        lastMetricsCollection: null,
      },
    };

    if (providerManager) {
      try {
        // Get provider health information
        if (typeof providerManager.getProviderHealth === 'function') {
          const providerHealth = providerManager.getProviderHealth();
          dashboard.providers.summary =
            providerHealth.summary || dashboard.providers.summary;
          dashboard.providers.details = providerHealth.providers || {};
        }

        // Get provider metrics
        if (typeof providerManager.getProviderMetrics === 'function') {
          const providerMetrics = providerManager.getProviderMetrics();

          let totalRequests = 0;
          let totalSuccesses = 0;
          let totalFailures = 0;
          let totalResponseTime = 0;
          let providerCount = 0;
          const providerPerformance = [];

          Object.entries(providerMetrics).forEach(([providerName, metrics]) => {
            totalRequests += metrics.requests || 0;
            totalSuccesses += metrics.successes || 0;
            totalFailures += metrics.failures || 0;
            totalResponseTime += metrics.avgResponseTime || 0;
            providerCount++;

            providerPerformance.push({
              name: providerName,
              successRate: metrics.successRate || 0,
              avgResponseTime: metrics.avgResponseTime || 0,
              requests: metrics.requests || 0,
            });
          });

          dashboard.metrics.requests.total = totalRequests;
          dashboard.metrics.requests.successful = totalSuccesses;
          dashboard.metrics.requests.failed = totalFailures;
          dashboard.metrics.requests.successRate =
            totalRequests > 0 ? totalSuccesses / totalRequests : 0;
          dashboard.metrics.performance.averageResponseTime =
            providerCount > 0 ? totalResponseTime / providerCount : 0;

          // Determine performance leaders
          if (providerPerformance.length > 0) {
            const sortedBySpeed = [...providerPerformance].sort(
              (a, b) => a.avgResponseTime - b.avgResponseTime
            );
            const sortedByReliability = [...providerPerformance].sort(
              (a, b) => b.successRate - a.successRate
            );

            dashboard.metrics.performance.fastestProvider =
              sortedBySpeed[0]?.name;
            dashboard.metrics.performance.slowestProvider =
              sortedBySpeed[sortedBySpeed.length - 1]?.name;
            dashboard.metrics.performance.mostReliableProvider =
              sortedByReliability[0]?.name;
          }
        }

        // Get enhanced metrics from MetricsCollector if available
        if (providerManager.metricsCollector) {
          dashboard.monitoring.metricsCollectorActive = true;

          try {
            const metricsReport =
              providerManager.metricsCollector.getMetricsReport(null, {
                timeRange: '1h',
                includeRealtime: true,
              });

            // Process error types from detailed metrics
            Object.values(metricsReport.providers || {}).forEach(
              (providerData) => {
                const errorTypes = providerData.aggregated?.errorTypes || {};
                Object.entries(errorTypes).forEach(([errorType, count]) => {
                  if (
                    errorType.includes('parsing') ||
                    errorType.includes('format')
                  ) {
                    dashboard.metrics.errors.parsingErrors += count;
                  } else if (errorType.includes('timeout')) {
                    dashboard.metrics.errors.timeoutErrors += count;
                  } else if (errorType.includes('connection')) {
                    dashboard.metrics.errors.connectionErrors += count;
                  } else {
                    dashboard.metrics.errors.unknownErrors += count;
                  }
                });
              }
            );

            dashboard.monitoring.lastMetricsCollection =
              new Date().toISOString();
          } catch (metricsError) {
            logger.warn(
              'Failed to get detailed metrics:',
              metricsError.message
            );
          }
        }

        // Get health monitor status
        if (providerManager.healthMonitor) {
          dashboard.monitoring.healthMonitorActive = true;
          dashboard.monitoring.lastHealthCheck = new Date().toISOString();
        }

        // Get alerting system status
        if (providerManager.alertingSystem) {
          dashboard.monitoring.alertingSystemActive = true;
        }

        // Generate alerts based on current status
        Object.entries(dashboard.providers.details).forEach(
          ([providerName, health]) => {
            const failureRate = 1 - (health.metrics?.successRate || 0);
            const consecutiveFailures = health.consecutiveFailures || 0;

            if (failureRate >= 0.5 || consecutiveFailures >= 5) {
              dashboard.alerts.critical++;
              dashboard.alerts.recent.push({
                type: 'critical',
                provider: providerName,
                message:
                  failureRate >= 0.5
                    ? `High failure rate: ${(failureRate * 100).toFixed(1)}%`
                    : `Consecutive failures: ${consecutiveFailures}`,
                timestamp: new Date().toISOString(),
              });
            } else if (failureRate >= 0.2 || consecutiveFailures >= 3) {
              dashboard.alerts.warning++;
              dashboard.alerts.recent.push({
                type: 'warning',
                provider: providerName,
                message:
                  failureRate >= 0.2
                    ? `Elevated failure rate: ${(failureRate * 100).toFixed(
                        1
                      )}%`
                    : `Multiple failures: ${consecutiveFailures}`,
                timestamp: new Date().toISOString(),
              });
            }
          }
        );

        logger.debug('Monitoring dashboard data compiled successfully', {
          totalProviders: dashboard.providers.summary.total,
          totalRequests: dashboard.metrics.requests.total,
          criticalAlerts: dashboard.alerts.critical,
        });
      } catch (error) {
        logger.error('Failed to compile monitoring dashboard:', error);
        dashboard.error = {
          message: 'Failed to compile monitoring data',
          details: error.message,
        };
      }
    } else {
      logger.warn('ProviderManager not available for monitoring dashboard');
      dashboard.error = {
        message: 'ProviderManager not available',
        details: 'Monitoring data is not accessible',
      };
    }

    dashboard.responseTime = Date.now() - startTime;

    res.json(dashboard);
  })
);

/**
 * Real-time metrics endpoint
 * Provides current real-time metrics
 */
router.get(
  '/realtime',
  asyncHandler(async (req, res) => {
    logger.debug('Real-time metrics requested');

    const providerManager = req.app.locals.providerManager;
    const startTime = Date.now();

    const realtimeData = {
      timestamp: new Date().toISOString(),
      responseTime: 0,
      providers: {},
      summary: {
        activeRequests: 0,
        requestsInLastMinute: 0,
        successesInLastMinute: 0,
        failuresInLastMinute: 0,
        avgResponseTimeLastMinute: 0,
      },
    };

    if (providerManager && providerManager.metricsCollector) {
      try {
        const metricsReport = providerManager.metricsCollector.getMetricsReport(
          null,
          {
            timeRange: '5m',
            includeRealtime: true,
            includeBaseline: false,
          }
        );

        Object.entries(metricsReport.providers || {}).forEach(
          ([providerName, providerData]) => {
            const realtime = providerData.realtime || {};

            realtimeData.providers[providerName] = {
              activeRequests: realtime.activeRequests || 0,
              requestsInLastMinute: realtime.requestsInLastMinute || 0,
              successesInLastMinute: realtime.successesInLastMinute || 0,
              failuresInLastMinute: realtime.failuresInLastMinute || 0,
              avgResponseTimeLastMinute:
                realtime.avgResponseTimeLastMinute || 0,
              lastActivity: realtime.lastActivity,
            };

            // Add to summary
            realtimeData.summary.activeRequests += realtime.activeRequests || 0;
            realtimeData.summary.requestsInLastMinute +=
              realtime.requestsInLastMinute || 0;
            realtimeData.summary.successesInLastMinute +=
              realtime.successesInLastMinute || 0;
            realtimeData.summary.failuresInLastMinute +=
              realtime.failuresInLastMinute || 0;
          }
        );

        // Calculate average response time
        const providerCount = Object.keys(realtimeData.providers).length;
        if (providerCount > 0) {
          const totalResponseTime = Object.values(
            realtimeData.providers
          ).reduce(
            (sum, provider) => sum + (provider.avgResponseTimeLastMinute || 0),
            0
          );
          realtimeData.summary.avgResponseTimeLastMinute =
            totalResponseTime / providerCount;
        }

        logger.debug('Real-time metrics compiled successfully', {
          activeRequests: realtimeData.summary.activeRequests,
          requestsInLastMinute: realtimeData.summary.requestsInLastMinute,
        });
      } catch (error) {
        logger.error('Failed to get real-time metrics:', error);
        realtimeData.error = {
          message: 'Failed to retrieve real-time metrics',
          details: error.message,
        };
      }
    } else {
      logger.warn('MetricsCollector not available for real-time metrics');
      realtimeData.error = {
        message: 'MetricsCollector not available',
        details: 'Real-time metrics are not being collected',
      };
    }

    realtimeData.responseTime = Date.now() - startTime;

    res.json(realtimeData);
  })
);

/**
 * Performance analytics endpoint
 * Provides detailed performance analysis
 */
router.get(
  '/performance',
  asyncHandler(async (req, res) => {
    logger.debug('Performance analytics requested');

    const { timeRange = '1h' } = req.query;
    const providerManager = req.app.locals.providerManager;
    const startTime = Date.now();

    const performanceData = {
      timestamp: new Date().toISOString(),
      timeRange,
      responseTime: 0,
      analysis: {
        trends: {},
        benchmarks: {},
        recommendations: [],
      },
      providers: {},
      summary: {
        totalRequests: 0,
        averageResponseTime: 0,
        successRate: 0,
        performanceScore: 0,
      },
    };

    if (providerManager && providerManager.metricsCollector) {
      try {
        const metricsReport = providerManager.metricsCollector.getMetricsReport(
          null,
          {
            timeRange,
            includeRealtime: true,
            includeBaseline: true,
          }
        );

        let totalRequests = 0;
        let totalSuccesses = 0;
        let totalResponseTime = 0;
        let providerCount = 0;

        Object.entries(metricsReport.providers || {}).forEach(
          ([providerName, providerData]) => {
            const aggregated = providerData.aggregated || {};
            const baseline = providerData.baseline || {};

            totalRequests += aggregated.requests || 0;
            totalSuccesses += aggregated.successes || 0;
            totalResponseTime += aggregated.avgResponseTime || 0;
            providerCount++;

            // Calculate performance trends
            const currentSuccessRate = aggregated.successRate || 0;
            const baselineSuccessRate = baseline.avgSuccessRate || 0;
            const currentResponseTime = aggregated.avgResponseTime || 0;
            const baselineResponseTime = baseline.avgResponseTime || 0;

            const successRateTrend =
              baselineSuccessRate > 0
                ? ((currentSuccessRate - baselineSuccessRate) /
                    baselineSuccessRate) *
                  100
                : 0;
            const responseTimeTrend =
              baselineResponseTime > 0
                ? ((currentResponseTime - baselineResponseTime) /
                    baselineResponseTime) *
                  100
                : 0;

            performanceData.providers[providerName] = {
              current: {
                requests: aggregated.requests || 0,
                successRate: currentSuccessRate,
                avgResponseTime: currentResponseTime,
                healthScore: aggregated.healthScore || 0,
              },
              baseline: {
                successRate: baselineSuccessRate,
                avgResponseTime: baselineResponseTime,
                sampleCount: baseline.sampleCount || 0,
              },
              trends: {
                successRateChange: successRateTrend,
                responseTimeChange: responseTimeTrend,
                trend:
                  Math.abs(successRateTrend) > 5 ||
                  Math.abs(responseTimeTrend) > 20
                    ? successRateTrend < -5 || responseTimeTrend > 20
                      ? 'degrading'
                      : 'improving'
                    : 'stable',
              },
            };

            // Generate recommendations
            if (currentSuccessRate < 0.8) {
              performanceData.analysis.recommendations.push({
                type: 'reliability',
                provider: providerName,
                message: `${providerName} has low success rate (${(
                  currentSuccessRate * 100
                ).toFixed(1)}%)`,
                priority: 'high',
              });
            }

            if (currentResponseTime > 10000) {
              performanceData.analysis.recommendations.push({
                type: 'performance',
                provider: providerName,
                message: `${providerName} has high response time (${currentResponseTime}ms)`,
                priority: 'medium',
              });
            }

            if (responseTimeTrend > 50) {
              performanceData.analysis.recommendations.push({
                type: 'trend',
                provider: providerName,
                message: `${providerName} response time is increasing significantly`,
                priority: 'medium',
              });
            }
          }
        );

        // Calculate summary metrics
        performanceData.summary.totalRequests = totalRequests;
        performanceData.summary.averageResponseTime =
          providerCount > 0 ? totalResponseTime / providerCount : 0;
        performanceData.summary.successRate =
          totalRequests > 0 ? totalSuccesses / totalRequests : 0;

        // Calculate overall performance score (0-100)
        const responseTimeScore = Math.max(
          0,
          100 - performanceData.summary.averageResponseTime / 100
        );
        const successRateScore = performanceData.summary.successRate * 100;
        performanceData.summary.performanceScore =
          (responseTimeScore + successRateScore) / 2;

        logger.debug('Performance analytics compiled successfully', {
          totalRequests,
          performanceScore: performanceData.summary.performanceScore,
          recommendationCount: performanceData.analysis.recommendations.length,
        });
      } catch (error) {
        logger.error('Failed to get performance analytics:', error);
        performanceData.error = {
          message: 'Failed to retrieve performance analytics',
          details: error.message,
        };
      }
    } else {
      logger.warn('MetricsCollector not available for performance analytics');
      performanceData.error = {
        message: 'MetricsCollector not available',
        details: 'Performance analytics are not available',
      };
    }

    performanceData.responseTime = Date.now() - startTime;

    res.json(performanceData);
  })
);

/**
 * Alert management endpoint
 * Provides current alerts and alert configuration
 */
router.get(
  '/alerts',
  asyncHandler(async (req, res) => {
    logger.debug('Alert management requested');

    const { severity, provider, limit = 50 } = req.query;
    const providerManager = req.app.locals.providerManager;
    const startTime = Date.now();

    const alertData = {
      timestamp: new Date().toISOString(),
      responseTime: 0,
      filters: { severity, provider, limit: parseInt(limit) },
      alerts: [],
      summary: {
        critical: 0,
        warning: 0,
        info: 0,
        total: 0,
      },
      configuration: {
        thresholds: {
          criticalFailureRate: 0.5,
          warningFailureRate: 0.2,
          criticalConsecutiveFailures: 5,
          warningConsecutiveFailures: 3,
          criticalResponseTime: 30000,
          warningResponseTime: 10000,
        },
        alertingEnabled: false,
      },
    };

    if (providerManager) {
      try {
        // Check if alerting system is available
        if (providerManager.alertingSystem) {
          alertData.configuration.alertingEnabled = true;
        }

        // Get current provider status and generate alerts
        const providerHealth = providerManager.getProviderHealth();
        const providerMetrics = providerManager.getProviderMetrics();

        Object.entries(providerHealth.providers || {}).forEach(
          ([providerName, health]) => {
            // Skip if provider filter is specified and doesn't match
            if (provider && providerName !== provider) return;

            const metrics = providerMetrics[providerName] || {};
            const failureRate = metrics.failureRate || 0;
            const consecutiveFailures = health.consecutiveFailures || 0;
            const avgResponseTime = metrics.avgResponseTime || 0;

            // Generate alerts based on thresholds
            const alerts = [];

            // Failure rate alerts
            if (
              failureRate >=
              alertData.configuration.thresholds.criticalFailureRate
            ) {
              alerts.push({
                type: 'critical',
                category: 'reliability',
                provider: providerName,
                message: `Critical failure rate: ${(failureRate * 100).toFixed(
                  1
                )}%`,
                details: {
                  failureRate,
                  threshold:
                    alertData.configuration.thresholds.criticalFailureRate,
                  totalRequests: metrics.requests || 0,
                  failures: metrics.failures || 0,
                },
                timestamp: new Date().toISOString(),
              });
            } else if (
              failureRate >=
              alertData.configuration.thresholds.warningFailureRate
            ) {
              alerts.push({
                type: 'warning',
                category: 'reliability',
                provider: providerName,
                message: `High failure rate: ${(failureRate * 100).toFixed(
                  1
                )}%`,
                details: {
                  failureRate,
                  threshold:
                    alertData.configuration.thresholds.warningFailureRate,
                  totalRequests: metrics.requests || 0,
                  failures: metrics.failures || 0,
                },
                timestamp: new Date().toISOString(),
              });
            }

            // Consecutive failures alerts
            if (
              consecutiveFailures >=
              alertData.configuration.thresholds.criticalConsecutiveFailures
            ) {
              alerts.push({
                type: 'critical',
                category: 'availability',
                provider: providerName,
                message: `Critical consecutive failures: ${consecutiveFailures}`,
                details: {
                  consecutiveFailures,
                  threshold:
                    alertData.configuration.thresholds
                      .criticalConsecutiveFailures,
                  lastError: health.lastError,
                  lastCheck: health.lastCheck,
                },
                timestamp: new Date().toISOString(),
              });
            } else if (
              consecutiveFailures >=
              alertData.configuration.thresholds.warningConsecutiveFailures
            ) {
              alerts.push({
                type: 'warning',
                category: 'availability',
                provider: providerName,
                message: `Multiple consecutive failures: ${consecutiveFailures}`,
                details: {
                  consecutiveFailures,
                  threshold:
                    alertData.configuration.thresholds
                      .warningConsecutiveFailures,
                  lastError: health.lastError,
                  lastCheck: health.lastCheck,
                },
                timestamp: new Date().toISOString(),
              });
            }

            // Response time alerts
            if (
              avgResponseTime >=
              alertData.configuration.thresholds.criticalResponseTime
            ) {
              alerts.push({
                type: 'critical',
                category: 'performance',
                provider: providerName,
                message: `Critical response time: ${avgResponseTime}ms`,
                details: {
                  avgResponseTime,
                  threshold:
                    alertData.configuration.thresholds.criticalResponseTime,
                },
                timestamp: new Date().toISOString(),
              });
            } else if (
              avgResponseTime >=
              alertData.configuration.thresholds.warningResponseTime
            ) {
              alerts.push({
                type: 'warning',
                category: 'performance',
                provider: providerName,
                message: `High response time: ${avgResponseTime}ms`,
                details: {
                  avgResponseTime,
                  threshold:
                    alertData.configuration.thresholds.warningResponseTime,
                },
                timestamp: new Date().toISOString(),
              });
            }

            // Parsing error alerts
            if (
              health.lastError &&
              health.lastError.includes('substring is not a function')
            ) {
              alerts.push({
                type: 'critical',
                category: 'parsing',
                provider: providerName,
                message: 'Response parsing error detected',
                details: {
                  error: health.lastError,
                  errorType: 'parsing_error',
                  lastCheck: health.lastCheck,
                },
                timestamp: new Date().toISOString(),
              });
            }

            // Filter by severity if specified
            const filteredAlerts = severity
              ? alerts.filter((alert) => alert.type === severity)
              : alerts;

            alertData.alerts.push(...filteredAlerts);

            // Update summary counts
            alerts.forEach((alert) => {
              alertData.summary[alert.type]++;
              alertData.summary.total++;
            });
          }
        );

        // Sort alerts by severity and timestamp
        alertData.alerts.sort((a, b) => {
          const severityOrder = { critical: 3, warning: 2, info: 1 };
          const severityDiff = severityOrder[b.type] - severityOrder[a.type];
          if (severityDiff !== 0) return severityDiff;
          return new Date(b.timestamp) - new Date(a.timestamp);
        });

        // Apply limit
        if (alertData.alerts.length > alertData.filters.limit) {
          alertData.alerts = alertData.alerts.slice(0, alertData.filters.limit);
        }

        logger.debug('Alert data compiled successfully', {
          totalAlerts: alertData.summary.total,
          criticalAlerts: alertData.summary.critical,
          warningAlerts: alertData.summary.warning,
        });
      } catch (error) {
        logger.error('Failed to get alert data:', error);
        alertData.error = {
          message: 'Failed to retrieve alert data',
          details: error.message,
        };
      }
    } else {
      logger.warn('ProviderManager not available for alert management');
      alertData.error = {
        message: 'ProviderManager not available',
        details: 'Alert data is not accessible',
      };
    }

    alertData.responseTime = Date.now() - startTime;

    res.json(alertData);
  })
);

module.exports = router;
