// tests/monitoring/monitoring-validation.test.js
// Monitoring and alerting validation tests

const MonitoringMiddleware = require('../../middleware/monitoringMiddleware');
const HealthMonitor = require('../../providers/HealthMonitor');
const MetricsCollector = require('../../providers/MetricsCollector');
const AlertingSystem = require('../../providers/AlertingSystem');
const { MockProviderRegistry } = require('../mocks/MockProviders');

describe('Monitoring and Alerting Validation', () => {
  let monitoringMiddleware;
  let healthMonitor;
  let metricsCollector;
  let alertingSystem;
  let mockProviderRegistry;

  beforeAll(async () => {
    // Initialize monitoring components
    const config = {
      enableRequestTracking: true,
      enablePerformanceTracking: true,
      enableErrorTracking: true,
      enableHealthEndpoints: true,
      enableMetricsEndpoints: true,

      monitoring: {
        enableMetrics: true,
        enableAlerting: true,
        enableHealthMonitoring: true,
        enableDashboard: false, // Disable for testing

        metrics: {
          collectionInterval: 1000, // 1 second for testing
          aggregationInterval: 2000, // 2 seconds for testing
          enableRealTimeMetrics: false, // Disable for testing to prevent hanging
        },

        alerting: {
          thresholds: {
            errorRate: 0.1, // 10%
            responseTime: 5000, // 5 seconds
            consecutiveFailures: 3,
          },
          notifications: {
            console: true,
            email: false,
            slack: false,
          },
        },

        health: {
          healthCheckInterval: 1000, // 1 second for testing
          detailedCheckInterval: 2000, // 2 seconds for testing
        },
      },

      logging: {
        level: 'info',
        enableConsole: true,
        enableFile: false,
        enablePerformanceLogging: true,
        enableRequestLogging: true,
        performanceThreshold: 1000,
      },
    };

    monitoringMiddleware = new MonitoringMiddleware(config);
    healthMonitor = new HealthMonitor(config.monitoring.health);
    metricsCollector = new MetricsCollector(config.monitoring.metrics);
    alertingSystem = new AlertingSystem(config.monitoring.alerting);

    // Create mock provider registry
    mockProviderRegistry = new MockProviderRegistry();
    mockProviderRegistry.createDefaultProviders();

    // Initialize providers in metrics collector and health monitor
    const providers = mockProviderRegistry.getAll();
    providers.forEach((provider) => {
      metricsCollector.initializeProvider(provider.name);
      healthMonitor.initializeProvider(provider.name, provider);
    });

    // Initialize monitoring system
    await monitoringMiddleware.initialize();
  });

  beforeEach(() => {
    // Reset metrics between tests to avoid accumulation
    if (metricsCollector) {
      metricsCollector.reset();
      // Re-initialize providers after reset
      const providers = mockProviderRegistry.getAll();
      providers.forEach((provider) => {
        metricsCollector.initializeProvider(provider.name);
      });
    }
  });

  afterAll(async () => {
    if (monitoringMiddleware) {
      await monitoringMiddleware.destroy();
    }
    if (healthMonitor) {
      healthMonitor.stopMonitoring();
    }
    if (metricsCollector) {
      metricsCollector.stopAggregation();
      metricsCollector.shutdown(); // Use shutdown method instead of destroy
    }
    if (alertingSystem) {
      await alertingSystem.stop();
    }
  });

  describe('Health Monitoring Validation', () => {
    test('should detect healthy providers correctly', async () => {
      const providers = mockProviderRegistry.getAll();

      for (const provider of providers) {
        provider.setHealthy(true);
        await healthMonitor.checkProviderHealth(provider.name);

        const health = healthMonitor.getProviderHealth(provider.name);
        expect(health.status).toBe('healthy');
        expect(health.lastCheck).toBeTruthy();
        expect(typeof health.latency).toBe('number');
        expect(health.latency).toBeGreaterThan(0);
      }
    });

    test('should detect unhealthy providers correctly', async () => {
      const providers = mockProviderRegistry.getAll();

      for (const provider of providers) {
        provider.setHealthy(false);
        await healthMonitor.checkProviderHealth(provider.name);

        const health = healthMonitor.getProviderHealth(provider.name);
        expect(health.status).toBe('unhealthy');
        expect(health.error).toBeTruthy();
        expect(health.lastCheck).toBeTruthy();
      }

      // Reset providers
      providers.forEach((provider) => provider.setHealthy(true));
    });

    test('should provide overall system health status', async () => {
      const providers = mockProviderRegistry.getAll();

      // All healthy
      providers.forEach((provider) => provider.setHealthy(true));
      await healthMonitor.checkAllProviders(providers);

      let overallHealth = healthMonitor.getOverallHealth();
      expect(overallHealth.status).toBe('healthy');
      expect(overallHealth.healthyProviders).toBe(providers.length);
      expect(overallHealth.unhealthyProviders).toBe(0);

      // Some unhealthy
      providers[0].setHealthy(false);
      await healthMonitor.checkProviderHealth(providers[0].name);

      overallHealth = healthMonitor.getOverallHealth();
      expect(overallHealth.status).toBe('degraded');
      expect(overallHealth.healthyProviders).toBe(providers.length - 1);
      expect(overallHealth.unhealthyProviders).toBe(1);

      // All unhealthy
      providers.forEach((provider) => provider.setHealthy(false));
      await healthMonitor.checkAllProviders(providers);

      overallHealth = healthMonitor.getOverallHealth();
      expect(overallHealth.status).toBe('unhealthy');
      expect(overallHealth.healthyProviders).toBe(0);
      expect(overallHealth.unhealthyProviders).toBe(providers.length);

      // Reset providers
      providers.forEach((provider) => provider.setHealthy(true));
    });

    test('should track health history', async () => {
      const provider = mockProviderRegistry.get('cerebras');

      // Create health history
      provider.setHealthy(true);
      await healthMonitor.checkProviderHealth('cerebras');
      await new Promise((resolve) => setTimeout(resolve, 100));

      provider.setHealthy(false);
      await healthMonitor.checkProviderHealth('cerebras');
      await new Promise((resolve) => setTimeout(resolve, 100));

      provider.setHealthy(true);
      await healthMonitor.checkProviderHealth('cerebras');

      const history = healthMonitor.getHealthHistory('cerebras');
      expect(history.length).toBeGreaterThan(2);

      const statuses = history.map((h) => h.status);
      expect(statuses).toContain('healthy');
      expect(statuses).toContain('unhealthy');
    });

    test('should detect health trends', async () => {
      const provider = mockProviderRegistry.get('openai');

      // Create declining health trend
      const healthChecks = [true, true, false, false, false];

      for (const isHealthy of healthChecks) {
        provider.setHealthy(isHealthy);
        await healthMonitor.checkProviderHealth('openai');
        await new Promise((resolve) => setTimeout(resolve, 50));
      }

      const trends = healthMonitor.getHealthTrends('openai');
      expect(trends.trend).toBe('declining');
      expect(trends.recentFailures).toBeGreaterThan(0);
      expect(trends.uptime).toBeLessThan(1.0);
    });
  });

  describe('Metrics Collection Validation', () => {
    test('should collect request metrics correctly', async () => {
      const provider = 'cerebras';
      const operation = 'generateDream';

      // Record successful requests
      for (let i = 0; i < 5; i++) {
        metricsCollector.recordRequest(provider, {
          operation,
          responseTime: 100 + i * 10,
          success: true,
          tokens: { input: 50, output: 100, total: 150 },
        });
      }

      // Record failed requests
      for (let i = 0; i < 2; i++) {
        metricsCollector.recordRequest(provider, {
          operation,
          responseTime: 200,
          success: false,
          error: 'Test error',
        });
      }

      const metrics = metricsCollector.getProviderMetrics(provider);

      expect(metrics.totalRequests).toBe(7);
      expect(metrics.successfulRequests).toBe(5);
      expect(metrics.failedRequests).toBe(2);
      expect(metrics.successRate).toBeCloseTo(5 / 7, 2);
      expect(metrics.errorRate).toBeCloseTo(2 / 7, 2);
      expect(metrics.averageResponseTime).toBeGreaterThan(0);
      expect(metrics.totalTokens).toBe(5 * 150); // Only successful requests have tokens
    });

    test('should aggregate metrics across providers', async () => {
      const providers = ['cerebras', 'openai', 'llama'];

      providers.forEach((provider, index) => {
        for (let i = 0; i < (index + 1) * 3; i++) {
          metricsCollector.recordRequest(provider, {
            operation: 'generateDream',
            responseTime: 100,
            success: true,
            tokens: { input: 50, output: 100, total: 150 },
          });
        }
      });

      const aggregatedMetrics = metricsCollector.getAggregatedMetrics();

      expect(aggregatedMetrics.totalRequests).toBe(18); // 3 + 6 + 9
      expect(aggregatedMetrics.successfulRequests).toBe(18);
      expect(aggregatedMetrics.failedRequests).toBe(0);
      expect(aggregatedMetrics.successRate).toBe(1.0);
      expect(aggregatedMetrics.providers).toHaveLength(3);
    });

    test('should calculate performance percentiles', async () => {
      const provider = 'cerebras';
      const responseTimes = [50, 100, 150, 200, 250, 300, 350, 400, 450, 500];

      responseTimes.forEach((responseTime) => {
        metricsCollector.recordRequest(provider, {
          operation: 'generateDream',
          responseTime,
          success: true,
        });
      });

      const percentiles = metricsCollector.getResponseTimePercentiles(provider);

      expect(percentiles.p50).toBeCloseTo(275, 0); // Median
      expect(percentiles.p90).toBeCloseTo(455, 0); // 90th percentile
      expect(percentiles.p95).toBeCloseTo(477.5, 0); // 95th percentile
      expect(percentiles.p99).toBeCloseTo(495.5, 0); // 99th percentile
    });

    test('should track metrics over time windows', async () => {
      const provider = 'openai';

      // Record metrics with timestamps
      const now = Date.now();
      const timeWindows = [
        { offset: -3600000, requests: 10 }, // 1 hour ago
        { offset: -1800000, requests: 15 }, // 30 minutes ago
        { offset: -900000, requests: 20 }, // 15 minutes ago
        { offset: 0, requests: 25 }, // Now
      ];

      timeWindows.forEach((window) => {
        for (let i = 0; i < window.requests; i++) {
          metricsCollector.recordRequest(provider, {
            operation: 'generateDream',
            responseTime: 100,
            success: true,
            timestamp: now + window.offset,
          });
        }
      });

      const timeSeriesMetrics = metricsCollector.getTimeSeriesMetrics(
        provider,
        {
          startTime: now - 3600000,
          endTime: now,
          interval: 900000, // 15-minute intervals
        }
      );

      expect(timeSeriesMetrics.length).toBe(4);
      expect(timeSeriesMetrics[0].requests).toBe(10);
      expect(timeSeriesMetrics[3].requests).toBe(25);
    });
  });

  describe('Alerting System Validation', () => {
    test('should trigger error rate alerts', async () => {
      const alerts = [];
      alertingSystem.on('alert', (alert) => alerts.push(alert));

      const provider = 'cerebras';

      // Generate high error rate
      for (let i = 0; i < 10; i++) {
        metricsCollector.recordRequest(provider, {
          operation: 'generateDream',
          responseTime: 100,
          success: i < 3, // 70% failure rate
        });
      }

      // Check for alerts
      await alertingSystem.checkErrorRateAlerts(
        metricsCollector.getProviderMetrics(provider),
        provider
      );

      const errorRateAlerts = alerts.filter(
        (alert) => alert.type === 'error_rate'
      );
      expect(errorRateAlerts.length).toBeGreaterThan(0);
      expect(errorRateAlerts[0].provider).toBe(provider);
      expect(errorRateAlerts[0].severity).toBe('critical');
    });

    test('should trigger response time alerts', async () => {
      const alerts = [];
      alertingSystem.on('alert', (alert) => alerts.push(alert));

      const provider = 'cerebras';

      // Generate slow responses
      for (let i = 0; i < 5; i++) {
        metricsCollector.recordRequest(provider, {
          operation: 'generateDream',
          responseTime: 6000, // Exceeds 5000ms threshold
          success: true,
        });
      }

      try {
        const metrics = metricsCollector.getProviderMetrics(provider);
        console.log('Provider metrics:', metrics);

        await alertingSystem.checkResponseTimeAlerts(metrics, provider);
      } catch (error) {
        console.error('Error in response time alert test:', error.message);
        throw error;
      }

      const responseTimeAlerts = alerts.filter(
        (alert) => alert.type === 'response_time'
      );
      expect(responseTimeAlerts.length).toBeGreaterThan(0);
      expect(responseTimeAlerts[0].provider).toBe(provider);
    });

    test('should trigger consecutive failure alerts', async () => {
      const alerts = [];
      alertingSystem.on('alert', (alert) => alerts.push(alert));

      const provider = 'llama';

      // Generate consecutive failures
      for (let i = 0; i < 5; i++) {
        metricsCollector.recordRequest(provider, {
          operation: 'generateDream',
          responseTime: 100,
          success: false,
          error: 'Consecutive failure test',
        });
      }

      await alertingSystem.checkConsecutiveFailureAlerts(provider);

      const consecutiveFailureAlerts = alerts.filter(
        (alert) => alert.type === 'consecutive_failures'
      );
      expect(consecutiveFailureAlerts.length).toBeGreaterThan(0);
      expect(consecutiveFailureAlerts[0].provider).toBe(provider);
    });

    test('should manage alert suppression and recovery', async () => {
      const alerts = [];
      alertingSystem.on('alert', (alert) => alerts.push(alert));

      const provider = 'cerebras';

      // Trigger initial alert
      for (let i = 0; i < 10; i++) {
        metricsCollector.recordRequest(provider, {
          operation: 'generateDream',
          responseTime: 100,
          success: false,
        });
      }

      await alertingSystem.checkErrorRateAlerts(
        metricsCollector.getProviderMetrics(provider),
        provider
      );
      const initialAlertCount = alerts.length;

      // Trigger same condition again (should be suppressed)
      await alertingSystem.checkErrorRateAlerts(
        metricsCollector.getProviderMetrics(provider),
        provider
      );
      expect(alerts.length).toBe(initialAlertCount); // No new alerts

      // Recover (generate successful requests)
      for (let i = 0; i < 20; i++) {
        metricsCollector.recordRequest(provider, {
          operation: 'generateDream',
          responseTime: 100,
          success: true,
        });
      }

      await alertingSystem.checkErrorRateAlerts(
        metricsCollector.getProviderMetrics(provider),
        provider
      );

      // Should have recovery alert
      const recoveryAlerts = alerts.filter(
        (alert) => alert.type === 'recovery'
      );
      expect(recoveryAlerts.length).toBeGreaterThan(0);
    });

    test('should categorize alert severity correctly', async () => {
      const testCases = [
        { errorRate: 0.05, expectedSeverity: 'low' },
        { errorRate: 0.15, expectedSeverity: 'medium' },
        { errorRate: 0.5, expectedSeverity: 'high' },
        { errorRate: 0.9, expectedSeverity: 'critical' },
      ];

      for (const testCase of testCases) {
        const severity = alertingSystem.calculateAlertSeverity('error_rate', {
          errorRate: testCase.errorRate,
        });

        expect(severity).toBe(testCase.expectedSeverity);
      }
    });
  });

  describe('Monitoring Dashboard Validation', () => {
    test('should provide comprehensive system overview', async () => {
      // Generate some activity
      const providers = mockProviderRegistry.getAll();

      providers.forEach((provider, index) => {
        for (let i = 0; i < 10; i++) {
          metricsCollector.recordRequest(provider.name, {
            operation: 'generateDream',
            responseTime: 100 + index * 50,
            success: Math.random() > 0.1, // 90% success rate
            tokens: { input: 50, output: 100, total: 150 },
          });
        }
      });

      const dashboardData = monitoringMiddleware.getDashboardData();

      expect(dashboardData).toHaveProperty('system');
      expect(dashboardData).toHaveProperty('providers');
      expect(dashboardData).toHaveProperty('metrics');
      expect(dashboardData).toHaveProperty('alerts');
      expect(dashboardData).toHaveProperty('health');

      expect(dashboardData.system.uptime).toBeGreaterThan(0);
      expect(dashboardData.providers.length).toBe(providers.length);
      expect(dashboardData.metrics.totalRequests).toBeGreaterThan(0);
    });

    test('should provide real-time metrics updates', async () => {
      const initialData = monitoringMiddleware.getDashboardData();
      const initialRequests = initialData.metrics.totalRequests;

      // Generate more activity
      metricsCollector.recordRequest('cerebras', {
        operation: 'generateDream',
        responseTime: 100,
        success: true,
      });

      const updatedData = monitoringMiddleware.getDashboardData();
      const updatedRequests = updatedData.metrics.totalRequests;

      expect(updatedRequests).toBeGreaterThan(initialRequests);
    });

    test('should provide historical data for charts', async () => {
      const provider = 'cerebras';
      const now = Date.now();

      // Generate historical data
      for (let i = 0; i < 24; i++) {
        metricsCollector.recordRequest(provider, {
          operation: 'generateDream',
          responseTime: 100 + Math.random() * 100,
          success: Math.random() > 0.1,
          timestamp: now - (24 - i) * 3600000, // Hourly data for 24 hours
        });
      }

      const chartData = monitoringMiddleware.getChartData({
        provider,
        metric: 'responseTime',
        timeRange: '24h',
        interval: '1h',
      });

      expect(chartData.labels).toHaveLength(24);
      expect(chartData.data).toHaveLength(24);
      expect(chartData.data.every((point) => typeof point === 'number')).toBe(
        true
      );
    });
  });

  describe('Performance Monitoring Validation', () => {
    test('should track system resource usage', async () => {
      const resourceMetrics = monitoringMiddleware.getResourceMetrics();

      expect(resourceMetrics).toHaveProperty('memory');
      expect(resourceMetrics).toHaveProperty('cpu');
      expect(resourceMetrics).toHaveProperty('uptime');

      expect(typeof resourceMetrics.memory.used).toBe('number');
      expect(typeof resourceMetrics.memory.total).toBe('number');
      expect(typeof resourceMetrics.cpu.usage).toBe('number');
      expect(typeof resourceMetrics.uptime).toBe('number');

      expect(resourceMetrics.memory.used).toBeGreaterThan(0);
      expect(resourceMetrics.memory.total).toBeGreaterThan(
        resourceMetrics.memory.used
      );
      expect(resourceMetrics.uptime).toBeGreaterThan(0);
    });

    test('should detect performance bottlenecks', async () => {
      const provider = 'openai';

      // Generate performance data with bottleneck
      const responseTimes = [];
      for (let i = 0; i < 100; i++) {
        const responseTime = i < 80 ? 100 : 5000; // 20% slow requests
        responseTimes.push(responseTime);

        metricsCollector.recordRequest(provider, {
          operation: 'generateDream',
          responseTime,
          success: true,
        });
      }

      const bottlenecks = monitoringMiddleware.detectBottlenecks(provider);

      expect(bottlenecks.length).toBeGreaterThan(0);
      expect(bottlenecks.some((b) => b.type === 'response_time_variance')).toBe(
        true
      );
    });

    test('should provide performance recommendations', async () => {
      const providers = mockProviderRegistry.getAll();

      // Generate varied performance data
      providers.forEach((provider, index) => {
        const performanceProfile = {
          responseTime: 100 + index * 200, // Increasing response times
          successRate: 1 - index * 0.1, // Decreasing success rates
          requestCount: 100 - index * 20, // Decreasing request counts
        };

        for (let i = 0; i < performanceProfile.requestCount; i++) {
          metricsCollector.recordRequest(provider.name, {
            operation: 'generateDream',
            responseTime: performanceProfile.responseTime,
            success: Math.random() < performanceProfile.successRate,
          });
        }
      });

      const recommendations =
        monitoringMiddleware.getPerformanceRecommendations();

      expect(recommendations.length).toBeGreaterThan(0);
      expect(
        recommendations.every((r) => r.type && r.description && r.priority)
      ).toBe(true);
    });
  });

  describe('Monitoring Integration Validation', () => {
    test('should integrate with external monitoring systems', async () => {
      // Mock external monitoring system
      const externalMetrics = [];
      const mockExternalSystem = {
        sendMetric: (metric) => externalMetrics.push(metric),
      };

      monitoringMiddleware.addExternalMonitoring(mockExternalSystem);

      // Generate activity
      metricsCollector.recordRequest('cerebras', {
        operation: 'generateDream',
        responseTime: 150,
        success: true,
      });

      // Trigger external metric sending
      await monitoringMiddleware.sendExternalMetrics();

      expect(externalMetrics.length).toBeGreaterThan(0);
      expect(externalMetrics[0]).toHaveProperty('timestamp');
      expect(externalMetrics[0]).toHaveProperty('metrics');
    });

    test('should handle monitoring system failures gracefully', async () => {
      // Simulate monitoring system failure
      const originalRecordRequest = metricsCollector.recordRequest;
      metricsCollector.recordRequest = () => {
        throw new Error('Monitoring system failure');
      };

      // Should not crash the main system
      expect(() => {
        monitoringMiddleware.recordRequest('test-provider', {
          operation: 'test',
          responseTime: 100,
          success: true,
        });
      }).not.toThrow();

      // Restore original method
      metricsCollector.recordRequest = originalRecordRequest;
    });

    test('should maintain monitoring data consistency', async () => {
      const provider = 'cerebras';
      const requestCount = 50;

      // Record requests concurrently
      const promises = [];
      for (let i = 0; i < requestCount; i++) {
        promises.push(
          Promise.resolve().then(() => {
            metricsCollector.recordRequest(provider, {
              operation: 'generateDream',
              responseTime: 100,
              success: true,
            });
          })
        );
      }

      await Promise.all(promises);

      const metrics = metricsCollector.getProviderMetrics(provider);
      expect(metrics.totalRequests).toBe(requestCount);
      expect(metrics.successfulRequests).toBe(requestCount);
      expect(metrics.failedRequests).toBe(0);
    });
  });
});
