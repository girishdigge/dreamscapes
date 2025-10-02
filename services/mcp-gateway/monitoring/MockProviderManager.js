// monitoring/MockProviderManager.js
// Mock Provider Manager for testing monitoring system

const EventEmitter = require('events');

/**
 * Mock Provider Manager - For testing monitoring system
 */
class MockProviderManager extends EventEmitter {
  constructor() {
    super();

    this.providers = new Map([
      ['cerebras', { name: 'cerebras', enabled: true }],
      ['openai', { name: 'openai', enabled: true }],
      ['llama', { name: 'llama', enabled: false }],
    ]);

    this.providerConfigs = new Map([
      [
        'cerebras',
        {
          limits: {
            requestsPerMinute: 100,
            tokensPerMinute: 50000,
            maxConcurrent: 10,
          },
        },
      ],
      [
        'openai',
        {
          limits: {
            requestsPerMinute: 60,
            tokensPerMinute: 40000,
            maxConcurrent: 5,
          },
        },
      ],
    ]);

    this.healthStatus = new Map([
      [
        'cerebras',
        {
          isHealthy: true,
          consecutiveFailures: 0,
          lastCheck: new Date(),
          circuitBreakerState: 'closed',
          uptime: 3600000,
          connectivity: 'healthy',
          lastActivity: new Date(),
        },
      ],
      [
        'openai',
        {
          isHealthy: true,
          consecutiveFailures: 0,
          lastCheck: new Date(),
          circuitBreakerState: 'closed',
          uptime: 3600000,
          connectivity: 'healthy',
          lastActivity: new Date(),
        },
      ],
    ]);

    this.metrics = new Map([
      [
        'cerebras',
        {
          requests: 150,
          successes: 145,
          failures: 5,
          successRate: 0.967,
          failureRate: 0.033,
          avgResponseTime: 2500,
          lastResponseTime: 2200,
          rateLimitHits: 2,
          circuitBreakerTrips: 0,
          lastHealthCheck: new Date(),
        },
      ],
      [
        'openai',
        {
          requests: 89,
          successes: 87,
          failures: 2,
          successRate: 0.978,
          failureRate: 0.022,
          avgResponseTime: 3200,
          lastResponseTime: 2800,
          rateLimitHits: 0,
          circuitBreakerTrips: 0,
          lastHealthCheck: new Date(),
        },
      ],
    ]);

    console.log('MockProviderManager initialized');
  }

  getProviders() {
    return Array.from(this.providers.keys());
  }

  getProviderMetrics(providerName) {
    return (
      this.metrics.get(providerName) || {
        requests: 0,
        successes: 0,
        failures: 0,
        successRate: 0,
        failureRate: 0,
        avgResponseTime: 0,
        lastResponseTime: 0,
        rateLimitHits: 0,
        circuitBreakerTrips: 0,
        lastHealthCheck: null,
      }
    );
  }

  getProviderHealth(providerName) {
    return (
      this.healthStatus.get(providerName) || {
        isHealthy: false,
        consecutiveFailures: 0,
        lastCheck: null,
        circuitBreakerState: 'unknown',
        uptime: 0,
        connectivity: 'unknown',
        lastActivity: null,
      }
    );
  }

  getProviderPriority(providerName) {
    const priorities = {
      cerebras: 1,
      openai: 2,
      llama: 3,
    };
    return priorities[providerName] || 0;
  }

  isProviderEnabled(providerName) {
    const provider = this.providers.get(providerName);
    return provider ? provider.enabled : false;
  }

  getProviderLimits(providerName) {
    const config = this.providerConfigs.get(providerName);
    return config ? config.limits : {};
  }

  // Simulate provider operations for testing
  simulateSuccess(providerName) {
    const metrics = this.getProviderMetrics(providerName);
    metrics.requests++;
    metrics.successes++;
    metrics.successRate = metrics.successes / metrics.requests;
    metrics.failureRate = 1 - metrics.successRate;
    metrics.lastResponseTime = Math.random() * 5000 + 1000; // 1-6 seconds
    metrics.avgResponseTime =
      (metrics.avgResponseTime + metrics.lastResponseTime) / 2;

    const health = this.getProviderHealth(providerName);
    health.consecutiveFailures = 0;
    health.isHealthy = true;
    health.lastCheck = new Date();
    health.lastActivity = new Date();

    this.emit('operationSuccess', {
      provider: providerName,
      responseTime: metrics.lastResponseTime,
      timestamp: new Date(),
    });
  }

  simulateFailure(providerName, errorType = 'timeout') {
    const metrics = this.getProviderMetrics(providerName);
    metrics.requests++;
    metrics.failures++;
    metrics.successRate = metrics.successes / metrics.requests;
    metrics.failureRate = 1 - metrics.successRate;

    const health = this.getProviderHealth(providerName);
    health.consecutiveFailures++;
    health.isHealthy = health.consecutiveFailures < 3;
    health.lastCheck = new Date();

    if (health.consecutiveFailures >= 5) {
      health.circuitBreakerState = 'open';
    }

    this.emit('operationFailure', {
      provider: providerName,
      error: errorType,
      consecutiveFailures: health.consecutiveFailures,
      timestamp: new Date(),
    });

    // Check if all providers failed
    const allProvidersFailed = Array.from(this.healthStatus.values()).every(
      (h) => !h.isHealthy
    );

    if (allProvidersFailed) {
      this.emit('allProvidersFailed', {
        timestamp: new Date(),
        providers: this.getProviders(),
      });
    }
  }

  // Simulate various scenarios for testing
  startSimulation() {
    // Simulate regular operations
    setInterval(() => {
      const providers = this.getProviders().filter((p) =>
        this.isProviderEnabled(p)
      );
      const provider = providers[Math.floor(Math.random() * providers.length)];

      if (Math.random() > 0.1) {
        // 90% success rate
        this.simulateSuccess(provider);
      } else {
        const errorTypes = [
          'timeout',
          'rate_limit',
          'server_error',
          'network_error',
        ];
        const errorType =
          errorTypes[Math.floor(Math.random() * errorTypes.length)];
        this.simulateFailure(provider, errorType);
      }
    }, 2000); // Every 2 seconds

    console.log('MockProviderManager simulation started');
  }

  stopSimulation() {
    // In a real implementation, this would clear intervals
    console.log('MockProviderManager simulation stopped');
  }
}

module.exports = MockProviderManager;
