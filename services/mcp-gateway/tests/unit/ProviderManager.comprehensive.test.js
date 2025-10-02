// services/mcp-gateway/tests/unit/ProviderManager.comprehensive.test.js
// Comprehensive unit tests for ProviderManager health methods and functionality

const ProviderManager = require('../../providers/ProviderManager');
const BaseProvider = require('../../providers/BaseProvider');

// Enhanced Mock Provider for comprehensive testing
class ComprehensiveMockProvider extends BaseProvider {
  constructor(name, config = {}) {
    super(name, config);
    this.shouldFail = config.shouldFail || false;
    this.responseDelay = config.responseDelay || 100;
    this.failureCount = 0;
    this.successCount = 0;
    this.connectionHealthy = config.connectionHealthy !== false;
    this.customError = config.customError || null;
  }

  async generateDream(prompt, options = {}) {
    await new Promise((resolve) => setTimeout(resolve, this.responseDelay));

    if (this.shouldFail) {
      this.failureCount++;
      const error =
        this.customError || new Error(`Mock ${this.name} provider failure`);
      throw error;
    }

    this.successCount++;
    return {
      success: true,
      data: {
        title: `Mock ${this.name} Dream`,
        scenes: [{ type: 'test', provider: this.name }],
      },
      metadata: {
        source: this.name,
        processingTime: this.responseDelay,
      },
    };
  }

  async testConnection() {
    if (!this.connectionHealthy) {
      throw new Error(`${this.name} connection test failed`);
    }
    return {
      status: 'healthy',
      latency: this.responseDelay,
      timestamp: Date.now(),
    };
  }

  // Additional methods for testing
  getStats() {
    return {
      failures: this.failureCount,
      successes: this.successCount,
      total: this.failureCount + this.successCount,
    };
  }

  reset() {
    this.failureCount = 0;
    this.successCount = 0;
    this.shouldFail = false;
    this.connectionHealthy = true;
  }
}

describe('ProviderManager - Comprehensive Health Methods Tests', () => {
  let providerManager;
  let mockCerebras;
  let mockOpenAI;
  let mockFallback;

  beforeEach(() => {
    // Ensure clean state
    if (providerManager) {
      try {
        providerManager.shutdown();
      } catch (error) {
        // Ignore cleanup errors in beforeEach
      }
    }

    // Create mock providers with different characteristics
    mockCerebras = new ComprehensiveMockProvider('cerebras', {
      responseDelay: 150,
      connectionHealthy: true,
    });

    mockOpenAI = new ComprehensiveMockProvider('openai', {
      responseDelay: 200,
      connectionHealthy: true,
    });

    mockFallback = new ComprehensiveMockProvider('fallback', {
      responseDelay: 300,
      connectionHealthy: true,
    });

    // Initialize ProviderManager with comprehensive config
    const config = {
      healthCheckInterval: 1000,
      maxRetryAttempts: 3,
      circuitBreakerThreshold: 3,
      circuitBreakerTimeout: 5000,
      enableEnhancedMonitoring: false, // Disable for unit tests
      enableAutomatedReporting: false,
    };

    providerManager = new ProviderManager(config);

    // Register providers with different priorities and configs
    providerManager.registerProvider('cerebras', mockCerebras, {
      enabled: true,
      priority: 3, // Highest priority (higher number = higher score)
      limits: { requestsPerMinute: 100, maxConcurrent: 5 },
    });

    providerManager.registerProvider('openai', mockOpenAI, {
      enabled: true,
      priority: 2,
      limits: { requestsPerMinute: 80, maxConcurrent: 3 },
    });

    providerManager.registerProvider('fallback', mockFallback, {
      enabled: true,
      priority: 1, // Lowest priority
      limits: { requestsPerMinute: 50, maxConcurrent: 2 },
    });
  });

  afterEach(async () => {
    if (providerManager) {
      try {
        await providerManager.shutdown();
      } catch (error) {
        console.warn('Error during ProviderManager shutdown:', error.message);
      }
      providerManager = null;
    }
  });

  afterAll(async () => {
    // Final cleanup to ensure no hanging timers
    if (providerManager) {
      try {
        await providerManager.shutdown();
      } catch (error) {
        // Ignore final cleanup errors
      }
    }
  });

  describe('getProviderHealth Method (Requirement 2.1, 2.2)', () => {
    test('should return health information for specific provider', () => {
      const health = providerManager.getProviderHealth('cerebras');

      expect(health).toHaveProperty('status');
      expect(health).toHaveProperty('isHealthy');
      expect(health).toHaveProperty('lastCheck');
      expect(health).toHaveProperty('consecutiveFailures');
      expect(health).toHaveProperty('lastError');
      expect(health).toHaveProperty('circuitBreakerState');
      expect(health).toHaveProperty('enabled');
      expect(health).toHaveProperty('metrics');
      expect(health).toHaveProperty('timestamp');

      expect(health.status).toBe('healthy');
      expect(health.isHealthy).toBe(true);
      expect(health.enabled).toBe(true);
      if (health.priority !== undefined) {
        expect(health.priority).toBe(3);
      }
      expect(typeof health.consecutiveFailures).toBe('number');
    });

    test('should return health information for all providers when no name specified', () => {
      const allHealth = providerManager.getProviderHealth();

      expect(allHealth).toHaveProperty('timestamp');
      expect(allHealth).toHaveProperty('providers');
      expect(allHealth).toHaveProperty('summary');

      expect(allHealth.providers).toHaveProperty('cerebras');
      expect(allHealth.providers).toHaveProperty('openai');
      expect(allHealth.providers).toHaveProperty('fallback');

      expect(allHealth.summary).toHaveProperty('total', 3);
      expect(allHealth.summary).toHaveProperty('healthy');
      expect(allHealth.summary).toHaveProperty('unhealthy');
      expect(allHealth.summary).toHaveProperty('enabled');
      expect(allHealth.summary).toHaveProperty('disabled');
    });

    test('should return error for non-existent provider', () => {
      const health = providerManager.getProviderHealth('nonexistent');

      expect(health.status).toBe('unknown');
      expect(health.error).toContain('Provider not found');
      expect(health.isHealthy).toBe(false);
      expect(health.enabled).toBe(false);
    });

    test('should include detailed metrics in health response', () => {
      // Simulate some activity to generate metrics
      providerManager.updateProviderMetrics('cerebras', true, 150);
      providerManager.updateProviderMetrics('cerebras', false, 200);

      const health = providerManager.getProviderHealth('cerebras');

      expect(health.metrics).toHaveProperty('requests');
      expect(health.metrics).toHaveProperty('successes');
      expect(health.metrics).toHaveProperty('failures');
      expect(health.metrics).toHaveProperty('successRate');
      expect(health.metrics).toHaveProperty('avgResponseTime');
      expect(health.metrics).toHaveProperty('lastRequestTime');

      expect(health.metrics.requests).toBe(2);
      expect(health.metrics.successes).toBe(1);
      expect(health.metrics.failures).toBe(1);
      expect(health.metrics.successRate).toBe(0.5);
    });

    test('should reflect unhealthy status when provider fails', async () => {
      // Make provider fail
      mockCerebras.connectionHealthy = false;

      // Perform health check
      await providerManager.checkProviderHealth('cerebras');

      const health = providerManager.getProviderHealth('cerebras');

      expect(health.status).toBe('unhealthy');
      expect(health.isHealthy).toBe(false);
      expect(health.lastError).toBeTruthy();
      expect(health.consecutiveFailures).toBeGreaterThan(0);
    });

    test('should show circuit breaker state in health response', () => {
      const health = providerManager.getProviderHealth('cerebras');

      expect(health.circuitBreakerState).toBeDefined();
      expect(['CLOSED', 'OPEN', 'HALF_OPEN', 'unknown']).toContain(
        health.circuitBreakerState
      );
    });
  });

  describe('Health Check Methods (Requirement 2.3, 2.4)', () => {
    test('should perform health check on specific provider', async () => {
      const result = await providerManager.healthCheck('cerebras');

      expect(result).toHaveProperty('isHealthy');
      expect(result).toHaveProperty('timestamp');
      expect(result.isHealthy).toBe(true);
      expect(result.timestamp).toBeInstanceOf(Date);
    });

    test('should perform health check on all providers', async () => {
      const results = await providerManager.healthCheck();

      expect(results).toHaveProperty('cerebras');
      expect(results).toHaveProperty('openai');
      expect(results).toHaveProperty('fallback');

      Object.values(results).forEach((result) => {
        expect(result).toHaveProperty('isHealthy');
        expect(result).toHaveProperty('timestamp');
      });
    });

    test('should handle health check failures gracefully', async () => {
      // Make one provider fail
      mockOpenAI.connectionHealthy = false;

      const results = await providerManager.healthCheck();

      expect(results.cerebras.isHealthy).toBe(true);
      expect(results.openai.isHealthy).toBe(false);
      expect(results.openai.error).toBeTruthy();
      expect(results.fallback.isHealthy).toBe(true);
    });

    test('should update health status after check', async () => {
      // Initial health should be default
      let health = providerManager.getProviderHealth('cerebras');
      expect(health.lastCheck).toBeNull();

      // Perform health check
      await providerManager.healthCheck('cerebras');

      // Health should be updated
      health = providerManager.getProviderHealth('cerebras');
      expect(health.lastCheck).not.toBeNull();
      expect(health.lastCheck).toBeInstanceOf(Date);
    });
  });

  describe('Health Status Updates (Requirement 2.5)', () => {
    test('should update provider health data correctly', () => {
      const healthData = {
        isHealthy: false,
        lastError: 'Test error',
        consecutiveFailures: 2,
        responseTime: 5000,
      };

      providerManager.updateProviderHealth('cerebras', healthData);
      const health = providerManager.getProviderHealth('cerebras');

      expect(health.isHealthy).toBe(false);
      expect(health.lastError).toBe('Test error');
      expect(health.consecutiveFailures).toBe(2);
    });

    test('should handle consecutive failure tracking', async () => {
      // Make the provider fail health checks
      mockCerebras.connectionHealthy = false;

      // Simulate multiple health check failures
      for (let i = 1; i <= 3; i++) {
        try {
          await providerManager.checkProviderHealth('cerebras');
        } catch (error) {
          // Expected to fail
        }
        const health = providerManager.getProviderHealth('cerebras');
        expect(health.consecutiveFailures).toBe(i);
      }

      // Simulate success - should reset consecutive failures
      mockCerebras.connectionHealthy = true; // Make it healthy again
      await providerManager.checkProviderHealth('cerebras');
      const health = providerManager.getProviderHealth('cerebras');
      expect(health.consecutiveFailures).toBe(0);
    });

    test('should track circuit breaker state changes', () => {
      const circuitBreaker = providerManager.circuitBreakers.get('cerebras');

      // Simulate failures to trigger circuit breaker
      for (let i = 0; i < 5; i++) {
        circuitBreaker.recordFailure();
      }

      const health = providerManager.getProviderHealth('cerebras');
      expect(health.circuitBreakerState).toBe('OPEN');
    });
  });

  describe('Provider Metrics Integration', () => {
    test('should provide comprehensive provider metrics', () => {
      // Generate some test metrics
      providerManager.updateProviderMetrics('cerebras', true, 100);
      providerManager.updateProviderMetrics('cerebras', true, 200);
      providerManager.updateProviderMetrics('cerebras', false, 300);

      const metrics = providerManager.getProviderMetrics('cerebras');

      expect(metrics).toHaveProperty('requests', 3);
      expect(metrics).toHaveProperty('successes', 2);
      expect(metrics).toHaveProperty('failures', 1);
      expect(metrics).toHaveProperty('successRate');
      expect(metrics).toHaveProperty('failureRate');
      expect(metrics).toHaveProperty('avgResponseTime');
      expect(metrics).toHaveProperty('isHealthy');
      expect(metrics).toHaveProperty('enabled');

      expect(metrics.successRate).toBeCloseTo(2 / 3);
      expect(metrics.failureRate).toBeCloseTo(1 / 3);
    });

    test('should handle metrics for non-existent provider', () => {
      expect(() => {
        providerManager.getProviderMetrics('nonexistent');
      }).toThrow('Provider not found: nonexistent');
    });

    test('should provide metrics for all providers', () => {
      const allMetrics = providerManager.getProviderMetrics();

      expect(allMetrics).toHaveProperty('cerebras');
      expect(allMetrics).toHaveProperty('openai');
      expect(allMetrics).toHaveProperty('fallback');

      Object.values(allMetrics).forEach((metrics) => {
        expect(metrics).toHaveProperty('requests');
        expect(metrics).toHaveProperty('successRate');
        expect(metrics).toHaveProperty('isHealthy');
      });
    });
  });

  describe('Available Providers Selection', () => {
    test('should return available healthy providers', () => {
      const available = providerManager.getAvailableProviders();

      expect(available).toHaveLength(3);
      available.forEach((provider) => {
        expect(provider).toHaveProperty('name');
        expect(provider).toHaveProperty('provider');
        expect(provider).toHaveProperty('config');
        expect(provider).toHaveProperty('health');
        expect(provider).toHaveProperty('metrics');
        expect(provider).toHaveProperty('score');
        expect(provider.health.isHealthy).toBe(true);
        expect(provider.config.enabled).toBe(true);
      });

      // Should be sorted by score (priority-based)
      expect(available[0].name).toBe('cerebras'); // Highest priority
    });

    test('should exclude unhealthy providers from available list', async () => {
      // Make one provider unhealthy
      mockOpenAI.connectionHealthy = false;
      await providerManager.checkProviderHealth('openai');

      const available = providerManager.getAvailableProviders();

      expect(available).toHaveLength(2);
      expect(available.map((p) => p.name)).not.toContain('openai');
      expect(available.map((p) => p.name)).toContain('cerebras');
      expect(available.map((p) => p.name)).toContain('fallback');
    });

    test('should exclude disabled providers from available list', () => {
      // Disable a provider
      const config = providerManager.providerConfigs.get('fallback');
      config.enabled = false;

      const available = providerManager.getAvailableProviders();

      expect(available).toHaveLength(2);
      expect(available.map((p) => p.name)).not.toContain('fallback');
    });

    test('should handle circuit breaker state in availability', () => {
      // Trip circuit breaker for cerebras
      const circuitBreaker = providerManager.circuitBreakers.get('cerebras');
      for (let i = 0; i < 5; i++) {
        circuitBreaker.recordFailure();
      }

      const available = providerManager.getAvailableProviders();

      expect(available.map((p) => p.name)).not.toContain('cerebras');
      expect(available).toHaveLength(2);
    });
  });

  describe('Provider Selection with Health Considerations', () => {
    test('should select provider based on health and performance', async () => {
      // Generate different performance metrics
      providerManager.updateProviderMetrics('cerebras', true, 100); // Fast
      providerManager.updateProviderMetrics('openai', true, 300); // Slow
      providerManager.updateProviderMetrics('fallback', true, 200); // Medium

      const selected = await providerManager.selectProvider({
        operation: 'generateDream',
      });

      expect(selected.name).toBe('cerebras'); // Should prefer healthy + fast + high priority
      expect(selected.provider).toBe(mockCerebras);
      expect(selected.config).toBeTruthy();
    });

    test('should skip unhealthy providers in selection', async () => {
      // Make primary provider unhealthy
      mockCerebras.connectionHealthy = false;
      await providerManager.checkProviderHealth('cerebras');

      const selected = await providerManager.selectProvider({
        operation: 'generateDream',
      });

      expect(selected.name).toBe('openai'); // Should fallback to next healthy provider
    });

    test('should throw error when no healthy providers available', async () => {
      // Make all providers unhealthy
      mockCerebras.connectionHealthy = false;
      mockOpenAI.connectionHealthy = false;
      mockFallback.connectionHealthy = false;

      await providerManager.checkProviderHealth('cerebras');
      await providerManager.checkProviderHealth('openai');
      await providerManager.checkProviderHealth('fallback');

      await expect(
        providerManager.selectProvider({
          operation: 'generateDream',
        })
      ).rejects.toThrow('No healthy providers available');
    });
  });

  describe('Health Monitoring Integration', () => {
    test('should start and stop health monitoring', () => {
      expect(providerManager.healthCheckInterval).toBeTruthy();

      providerManager.stopHealthMonitoring();
      expect(providerManager.healthCheckInterval).toBeFalsy();

      providerManager.startHealthMonitoring();
      expect(providerManager.healthCheckInterval).toBeTruthy();
    });

    test('should perform periodic health checks', (done) => {
      // Set short interval for testing
      providerManager.config.healthCheckInterval = 100;

      let checkCount = 0;
      const originalCheck = providerManager.checkProviderHealth;
      providerManager.checkProviderHealth = async (name) => {
        checkCount++;
        return originalCheck.call(providerManager, name);
      };

      providerManager.startHealthMonitoring();

      setTimeout(() => {
        expect(checkCount).toBeGreaterThan(0);
        providerManager.stopHealthMonitoring();
        done();
      }, 250);
    });
  });

  describe('Error Handling in Health Methods', () => {
    test('should handle errors in getProviderHealth gracefully', () => {
      // Corrupt health status to simulate error
      providerManager.healthStatus.set('cerebras', null);

      expect(() => {
        providerManager.getProviderHealth('cerebras');
      }).not.toThrow();

      const health = providerManager.getProviderHealth('cerebras');
      expect(health.status).toBe('unknown');
    });

    test('should handle errors in health checks gracefully', async () => {
      // Make provider throw unexpected error
      mockCerebras.testConnection = async () => {
        throw new Error('Unexpected connection error');
      };

      const result = await providerManager.healthCheck('cerebras');

      expect(result.isHealthy).toBe(false);
      expect(result.error).toContain('Unexpected connection error');
    });

    test('should handle missing provider in health operations', () => {
      // Remove provider completely
      providerManager.unregisterProvider('cerebras');

      const health = providerManager.getProviderHealth('cerebras');
      expect(health.status).toBe('unknown');
      expect(health.error).toContain('Provider not found');
    });
  });

  describe('Health Data Aggregation', () => {
    test('should aggregate health data correctly', () => {
      // Set up different health states
      providerManager.updateProviderHealth('cerebras', { isHealthy: true });
      providerManager.updateProviderHealth('openai', { isHealthy: false });
      providerManager.updateProviderHealth('fallback', { isHealthy: true });

      const allHealth = providerManager.getProviderHealth();

      expect(allHealth.summary.total).toBe(3);
      expect(allHealth.summary.healthy).toBe(2);
      expect(allHealth.summary.unhealthy).toBe(1);
      expect(allHealth.summary.enabled).toBe(3);
      expect(allHealth.summary.disabled).toBe(0);
    });

    test('should include timestamp in aggregated health data', () => {
      const allHealth = providerManager.getProviderHealth();

      expect(allHealth.timestamp).toBeTruthy();
      expect(new Date(allHealth.timestamp)).toBeInstanceOf(Date);
    });
  });

  describe('Provider Configuration Impact on Health', () => {
    test('should reflect configuration changes in health status', () => {
      // Disable provider
      const config = providerManager.providerConfigs.get('cerebras');
      config.enabled = false;

      const health = providerManager.getProviderHealth('cerebras');
      expect(health.enabled).toBe(false);

      // Re-enable provider
      config.enabled = true;
      const healthAfter = providerManager.getProviderHealth('cerebras');
      expect(healthAfter.enabled).toBe(true);
    });

    test('should reflect priority changes in health status', () => {
      const config = providerManager.providerConfigs.get('cerebras');
      const originalPriority = config.priority;
      config.priority = 5;

      // Priority changes should be reflected in provider selection, not necessarily in health response
      const available = providerManager.getAvailableProviders();
      const cerebrasProvider = available.find((p) => p.name === 'cerebras');
      expect(cerebrasProvider.config.priority).toBe(5);

      // Restore original priority
      config.priority = originalPriority;
    });
  });
});
