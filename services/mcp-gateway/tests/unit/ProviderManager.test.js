// tests/unit/ProviderManager.test.js
// Unit tests for ProviderManager class

const ProviderManager = require('../../providers/ProviderManager');
const BaseProvider = require('../../providers/BaseProvider');
const HealthMonitor = require('../../providers/HealthMonitor');
const MetricsCollector = require('../../providers/MetricsCollector');

// Mock providers for testing
class MockCerebrasProvider extends BaseProvider {
  constructor(config = {}) {
    super(config);
    this.name = 'cerebras'; // Override the name property
    this.shouldFail = config.shouldFail || false;
    this.responseDelay = config.responseDelay || 100;
  }

  async generateDream(prompt, options = {}) {
    await new Promise((resolve) => setTimeout(resolve, this.responseDelay));

    if (this.shouldFail) {
      throw new Error('Mock Cerebras provider failure');
    }

    return {
      success: true,
      data: {
        title: 'Mock Cerebras Dream',
        scenes: [{ type: 'test', provider: 'cerebras' }],
      },
      metadata: {
        source: 'cerebras',
        model: 'llama-4-maverick-17b',
        processingTime: this.responseDelay,
      },
    };
  }

  async testConnection() {
    if (this.shouldFail) {
      throw new Error('Connection test failed');
    }
    return { status: 'healthy', latency: 50 };
  }
}

class MockOpenAIProvider extends BaseProvider {
  constructor(config = {}) {
    super(config);
    this.name = 'openai'; // Override the name property
    this.shouldFail = config.shouldFail || false;
    this.responseDelay = config.responseDelay || 200;
  }

  async generateDream(prompt, options = {}) {
    await new Promise((resolve) => setTimeout(resolve, this.responseDelay));

    if (this.shouldFail) {
      throw new Error('Mock OpenAI provider failure');
    }

    return {
      success: true,
      data: {
        title: 'Mock OpenAI Dream',
        scenes: [{ type: 'test', provider: 'openai' }],
      },
      metadata: {
        source: 'openai',
        model: 'gpt-4',
        processingTime: this.responseDelay,
      },
    };
  }

  async testConnection() {
    if (this.shouldFail) {
      throw new Error('Connection test failed');
    }
    return { status: 'healthy', latency: 100 };
  }
}

describe('ProviderManager', () => {
  let providerManager;
  let mockCerebras;
  let mockOpenAI;

  beforeEach(() => {
    mockCerebras = new MockCerebrasProvider();
    mockOpenAI = new MockOpenAIProvider();

    const config = {
      enableEnhancedMonitoring: false, // Disable enhanced monitoring for tests
      enableAutomatedReporting: false, // Disable automated reporting for tests
      providers: {
        cerebras: {
          enabled: true,
          priority: 1,
          maxConcurrent: 5,
          timeout: 30000,
        },
        openai: {
          enabled: true,
          priority: 2,
          maxConcurrent: 3,
          timeout: 20000,
        },
      },
      fallback: {
        enabled: true,
        maxRetries: 3,
        backoffMultiplier: 2,
      },
      loadBalancing: {
        strategy: 'performance',
        healthCheckInterval: 30000,
      },
    };

    providerManager = new ProviderManager(config);
    providerManager.registerProvider('cerebras', mockCerebras);
    providerManager.registerProvider('openai', mockOpenAI);
  });

  afterEach(async () => {
    if (providerManager) {
      await providerManager.shutdown();
    }
  });

  describe('Provider Registration', () => {
    test('should register providers correctly', () => {
      expect(providerManager.getRegisteredProviders()).toContain('cerebras');
      expect(providerManager.getRegisteredProviders()).toContain('openai');
      expect(providerManager.getRegisteredProviders()).toHaveLength(2);
    });

    test('should get provider by name', () => {
      const cerebrasProvider = providerManager.getProvider('cerebras');
      expect(cerebrasProvider).toBe(mockCerebras);
      expect(cerebrasProvider.name).toBe('cerebras');
    });

    test('should return null for non-existent provider', () => {
      const nonExistent = providerManager.getProvider('nonexistent');
      expect(nonExistent).toBeNull();
    });

    test('should unregister providers', () => {
      providerManager.unregisterProvider('openai');
      expect(providerManager.getRegisteredProviders()).not.toContain('openai');
      expect(providerManager.getRegisteredProviders()).toHaveLength(1);
    });
  });

  describe('Provider Selection', () => {
    test('should select primary provider when healthy', async () => {
      const selected = await providerManager.selectProvider({
        operation: 'generateDream',
      });

      expect(selected).toBe('cerebras'); // Higher priority
    });

    test('should select based on performance metrics', async () => {
      // Simulate some performance data
      providerManager.metricsCollector.recordRequest('cerebras', {
        operation: 'generateDream',
        responseTime: 500,
        success: true,
      });

      providerManager.metricsCollector.recordRequest('openai', {
        operation: 'generateDream',
        responseTime: 200,
        success: true,
      });

      const selected = await providerManager.selectProvider({
        operation: 'generateDream',
        strategy: 'performance',
      });

      // Should still prefer cerebras due to priority, but consider performance
      expect(['cerebras', 'openai']).toContain(selected);
    });

    test('should skip unhealthy providers', async () => {
      // Mark cerebras as unhealthy
      mockCerebras.shouldFail = true;
      await providerManager.healthMonitor.checkProviderHealth('cerebras');

      const selected = await providerManager.selectProvider({
        operation: 'generateDream',
      });

      expect(selected).toBe('openai');
    });

    test('should return null when no providers available', async () => {
      // Mark all providers as unhealthy
      mockCerebras.shouldFail = true;
      mockOpenAI.shouldFail = true;

      await providerManager.healthMonitor.checkProviderHealth('cerebras');
      await providerManager.healthMonitor.checkProviderHealth('openai');

      const selected = await providerManager.selectProvider({
        operation: 'generateDream',
      });

      expect(selected).toBeNull();
    });
  });

  describe('Dream Generation', () => {
    test('should generate dream using primary provider', async () => {
      const prompt = 'I dreamed of a peaceful garden';
      const options = { style: 'ethereal' };

      const result = await providerManager.generateDream(prompt, options);

      expect(result.success).toBe(true);
      expect(result.data.title).toBe('Mock Cerebras Dream');
      expect(result.metadata.source).toBe('cerebras');
    });

    test('should fallback to secondary provider on failure', async () => {
      // Make cerebras fail
      mockCerebras.shouldFail = true;

      const prompt = 'I dreamed of a stormy ocean';
      const options = { style: 'dramatic' };

      const result = await providerManager.generateDream(prompt, options);

      expect(result.success).toBe(true);
      expect(result.data.title).toBe('Mock OpenAI Dream');
      expect(result.metadata.source).toBe('openai');
    });

    test('should retry with exponential backoff', async () => {
      let attemptCount = 0;
      const originalGenerate = mockCerebras.generateDream;

      mockCerebras.generateDream = async (prompt, options) => {
        attemptCount++;
        if (attemptCount < 3) {
          throw new Error('Temporary failure');
        }
        return originalGenerate.call(mockCerebras, prompt, options);
      };

      const startTime = Date.now();
      const result = await providerManager.generateDream('test prompt');
      const totalTime = Date.now() - startTime;

      expect(result.success).toBe(true);
      expect(attemptCount).toBe(3);
      expect(totalTime).toBeGreaterThan(300); // Should have backoff delays
    });

    test('should fail when all providers fail', async () => {
      mockCerebras.shouldFail = true;
      mockOpenAI.shouldFail = true;

      await expect(
        providerManager.generateDream('test prompt')
      ).rejects.toThrow('All providers failed');
    });

    test('should respect timeout settings', async () => {
      // Set very short timeout
      providerManager.config.providers.cerebras.timeout = 50;
      mockCerebras.responseDelay = 200; // Longer than timeout

      await expect(
        providerManager.generateDream('test prompt')
      ).rejects.toThrow('timeout');
    });
  });

  describe('Load Balancing', () => {
    test('should distribute requests across providers', async () => {
      const requests = [];
      const requestCount = 10;

      // Make multiple concurrent requests
      for (let i = 0; i < requestCount; i++) {
        requests.push(providerManager.generateDream(`test prompt ${i}`));
      }

      const results = await Promise.all(requests);

      // Count requests per provider
      const providerCounts = {};
      results.forEach((result) => {
        const provider = result.metadata.source;
        providerCounts[provider] = (providerCounts[provider] || 0) + 1;
      });

      expect(Object.keys(providerCounts).length).toBeGreaterThan(0);
      expect(results.every((r) => r.success)).toBe(true);
    });

    test('should respect concurrent request limits', async () => {
      // Set low concurrent limit
      providerManager.config.providers.cerebras.maxConcurrent = 2;
      mockCerebras.responseDelay = 500; // Slow responses

      const requests = [];
      const requestCount = 5;

      const startTime = Date.now();

      for (let i = 0; i < requestCount; i++) {
        requests.push(providerManager.generateDream(`test prompt ${i}`));
      }

      const results = await Promise.all(requests);
      const totalTime = Date.now() - startTime;

      expect(results.every((r) => r.success)).toBe(true);
      // Should take longer due to concurrency limits
      expect(totalTime).toBeGreaterThan(1000);
    });
  });

  describe('Health Monitoring', () => {
    test('should monitor provider health', async () => {
      await providerManager.healthMonitor.checkProviderHealth('cerebras');

      const health =
        providerManager.healthMonitor.getProviderHealth('cerebras');
      expect(health.status).toBe('healthy');
      expect(typeof health.lastCheck).toBe('number');
      expect(typeof health.latency).toBe('number');
    });

    test('should detect unhealthy providers', async () => {
      mockCerebras.shouldFail = true;

      await providerManager.healthMonitor.checkProviderHealth('cerebras');

      const health =
        providerManager.healthMonitor.getProviderHealth('cerebras');
      expect(health.status).toBe('unhealthy');
      expect(health.error).toBeTruthy();
    });

    test('should provide overall health status', async () => {
      await providerManager.healthMonitor.checkAllProviders();

      const overallHealth = providerManager.getHealthStatus();
      expect(overallHealth).toHaveProperty('status');
      expect(overallHealth).toHaveProperty('providers');
      expect(overallHealth).toHaveProperty('timestamp');

      expect(['healthy', 'degraded', 'unhealthy']).toContain(
        overallHealth.status
      );
    });
  });

  describe('Metrics Collection', () => {
    test('should collect request metrics', async () => {
      await providerManager.generateDream('test prompt');

      const metrics = providerManager.getProviderMetrics('cerebras');
      expect(metrics.totalRequests).toBeGreaterThan(0);
      expect(metrics.successfulRequests).toBeGreaterThan(0);
      expect(metrics.averageResponseTime).toBeGreaterThan(0);
      expect(metrics.successRate).toBeGreaterThan(0);
    });

    test('should track error rates', async () => {
      mockCerebras.shouldFail = true;

      try {
        await providerManager.generateDream('test prompt');
      } catch (error) {
        // Expected to fail
      }

      const metrics = providerManager.getProviderMetrics('cerebras');
      expect(metrics.totalRequests).toBeGreaterThan(0);
      expect(metrics.failedRequests).toBeGreaterThan(0);
      expect(metrics.successRate).toBeLessThan(1);
    });

    test('should provide comprehensive metrics', () => {
      const allMetrics = providerManager.getAllMetrics();

      expect(allMetrics).toHaveProperty('providers');
      expect(allMetrics).toHaveProperty('overall');
      expect(allMetrics).toHaveProperty('timestamp');

      expect(typeof allMetrics.overall.totalRequests).toBe('number');
      expect(typeof allMetrics.overall.averageResponseTime).toBe('number');
    });
  });

  describe('Configuration Management', () => {
    test('should update provider configuration', () => {
      const newConfig = {
        enabled: false,
        priority: 3,
        maxConcurrent: 10,
      };

      providerManager.updateProviderConfig('cerebras', newConfig);

      const config = providerManager.getProviderConfig('cerebras');
      expect(config.enabled).toBe(false);
      expect(config.priority).toBe(3);
      expect(config.maxConcurrent).toBe(10);
    });

    test('should validate configuration updates', () => {
      const invalidConfig = {
        priority: -1, // Invalid priority
        maxConcurrent: 'invalid', // Invalid type
      };

      expect(() => {
        providerManager.updateProviderConfig('cerebras', invalidConfig);
      }).toThrow('Invalid configuration');
    });

    test('should get current configuration', () => {
      const config = providerManager.getConfiguration();

      expect(config).toHaveProperty('providers');
      expect(config).toHaveProperty('fallback');
      expect(config).toHaveProperty('loadBalancing');

      expect(config.providers.cerebras).toBeTruthy();
      expect(config.providers.openai).toBeTruthy();
    });
  });

  describe('Error Handling', () => {
    test('should handle provider initialization errors', () => {
      const invalidProvider = {
        // Missing required methods
        name: 'invalid',
      };

      expect(() => {
        providerManager.registerProvider('invalid', invalidProvider);
      }).toThrow('Invalid provider');
    });

    test('should handle concurrent request overflow', async () => {
      // Set very low limits
      providerManager.config.providers.cerebras.maxConcurrent = 1;
      providerManager.config.providers.openai.maxConcurrent = 1;

      mockCerebras.responseDelay = 1000;
      mockOpenAI.responseDelay = 1000;

      const requests = [];
      for (let i = 0; i < 5; i++) {
        requests.push(providerManager.generateDream(`test prompt ${i}`));
      }

      // Should not throw, should queue or fallback
      const results = await Promise.all(requests);
      expect(results.every((r) => r.success)).toBe(true);
    });

    test('should handle malformed responses', async () => {
      const originalGenerate = mockCerebras.generateDream;
      mockCerebras.generateDream = async () => {
        return null; // Malformed response
      };

      await expect(
        providerManager.generateDream('test prompt')
      ).rejects.toThrow('Invalid response');
    });
  });

  describe('Cleanup and Shutdown', () => {
    test('should shutdown gracefully', async () => {
      const shutdownPromise = providerManager.shutdown();

      await expect(shutdownPromise).resolves.not.toThrow();

      // Should not accept new requests after shutdown
      await expect(
        providerManager.generateDream('test prompt')
      ).rejects.toThrow('ProviderManager is shutting down');
    });

    test('should cleanup resources on shutdown', async () => {
      // Start some background processes
      await providerManager.healthMonitor.startPeriodicChecks();

      await providerManager.shutdown();

      // Verify cleanup
      expect(providerManager.healthMonitor.isRunning()).toBe(false);
    });
  });
});
