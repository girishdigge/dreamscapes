// tests/integration/provider-fallback.test.js
// Integration tests for provider fallback and error handling

const ProviderManager = require('../../providers/ProviderManager');
const {
  MockCerebrasProvider,
  MockOpenAIProvider,
  MockFailingProvider,
  MockSlowProvider,
  MockUnreliableProvider,
} = require('../mocks/MockProviders');

describe('Provider Fallback Integration', () => {
  let providerManager;

  beforeEach(() => {
    const config = {
      providers: {
        cerebras: {
          enabled: true,
          priority: 1,
          maxConcurrent: 5,
          timeout: 5000,
        },
        openai: {
          enabled: true,
          priority: 2,
          maxConcurrent: 3,
          timeout: 4000,
        },
        llama: {
          enabled: true,
          priority: 3,
          maxConcurrent: 2,
          timeout: 6000,
        },
      },
      fallback: {
        enabled: true,
        maxRetries: 3,
        backoffMultiplier: 2,
        initialBackoffMs: 100,
      },
      loadBalancing: {
        strategy: 'priority',
        healthCheckInterval: 1000,
      },
    };

    providerManager = new ProviderManager(config);
  });

  afterEach(async () => {
    if (providerManager) {
      await providerManager.shutdown();
    }
  });

  describe('Basic Fallback Scenarios', () => {
    test('should fallback from primary to secondary provider', async () => {
      const cerebras = new MockCerebrasProvider({ shouldFail: true });
      const openai = new MockOpenAIProvider();

      providerManager.registerProvider('cerebras', cerebras);
      providerManager.registerProvider('openai', openai);

      const result = await providerManager.generateDream(
        'I dreamed of a garden'
      );

      expect(result.success).toBe(true);
      expect(result.metadata.source).toBe('openai');
      expect(cerebras.getMetrics().failedRequests).toBe(1);
      expect(openai.getMetrics().successfulRequests).toBe(1);
    });

    test('should fallback through multiple providers', async () => {
      const cerebras = new MockCerebrasProvider({ shouldFail: true });
      const openai = new MockOpenAIProvider({ shouldFail: true });
      const llama = new MockCerebrasProvider(); // Working provider

      providerManager.registerProvider('cerebras', cerebras);
      providerManager.registerProvider('openai', openai);
      providerManager.registerProvider('llama', llama);

      const result = await providerManager.generateDream(
        'I dreamed of a forest'
      );

      expect(result.success).toBe(true);
      expect(result.metadata.source).toBe('llama');
      expect(cerebras.getMetrics().failedRequests).toBe(1);
      expect(openai.getMetrics().failedRequests).toBe(1);
      expect(llama.getMetrics().successfulRequests).toBe(1);
    });

    test('should fail when all providers fail', async () => {
      const cerebras = new MockFailingProvider();
      const openai = new MockFailingProvider();

      providerManager.registerProvider('cerebras', cerebras);
      providerManager.registerProvider('openai', openai);

      await expect(
        providerManager.generateDream('I dreamed of a mountain')
      ).rejects.toThrow('All providers failed');
    });
  });

  describe('Retry Logic Integration', () => {
    test('should retry with exponential backoff', async () => {
      let attemptCount = 0;
      const cerebras = new MockCerebrasProvider();

      // Override to fail first 2 attempts, succeed on 3rd
      const originalGenerate = cerebras.generateDream;
      cerebras.generateDream = async function (prompt, options) {
        attemptCount++;
        if (attemptCount < 3) {
          throw new Error('Temporary failure');
        }
        return originalGenerate.call(this, prompt, options);
      };

      providerManager.registerProvider('cerebras', cerebras);

      const startTime = Date.now();
      const result = await providerManager.generateDream('I dreamed of a lake');
      const totalTime = Date.now() - startTime;

      expect(result.success).toBe(true);
      expect(attemptCount).toBe(3);
      expect(totalTime).toBeGreaterThan(300); // Should have backoff delays (100ms + 200ms)
    });

    test('should respect max retry limit', async () => {
      const cerebras = new MockFailingProvider();
      providerManager.registerProvider('cerebras', cerebras);

      const startTime = Date.now();

      await expect(
        providerManager.generateDream('I dreamed of a desert')
      ).rejects.toThrow();

      const totalTime = Date.now() - startTime;

      // Should have tried 3 times with backoff delays
      expect(totalTime).toBeGreaterThan(600); // 100 + 200 + 400 = 700ms minimum
      expect(cerebras.getMetrics().failedRequests).toBe(3);
    });

    test('should not retry on non-retryable errors', async () => {
      const cerebras = new MockCerebrasProvider();

      cerebras.generateDream = async function () {
        const error = new Error('Authentication failed');
        error.code = 'AUTH_ERROR';
        error.retryable = false;
        throw error;
      };

      providerManager.registerProvider('cerebras', cerebras);

      await expect(
        providerManager.generateDream('I dreamed of a city')
      ).rejects.toThrow('Authentication failed');

      // Should only attempt once
      expect(cerebras.getMetrics().totalRequests).toBe(1);
    });
  });

  describe('Timeout Handling', () => {
    test('should timeout slow providers and fallback', async () => {
      const slowCerebras = new MockSlowProvider({ responseDelay: 6000 }); // Exceeds 5s timeout
      const fastOpenAI = new MockOpenAIProvider({ responseDelay: 100 });

      providerManager.registerProvider('cerebras', slowCerebras);
      providerManager.registerProvider('openai', fastOpenAI);

      const startTime = Date.now();
      const result = await providerManager.generateDream(
        'I dreamed of a river'
      );
      const totalTime = Date.now() - startTime;

      expect(result.success).toBe(true);
      expect(result.metadata.source).toBe('openai');
      expect(totalTime).toBeLessThan(6000); // Should not wait for slow provider
    });

    test('should handle concurrent timeout scenarios', async () => {
      const slowProvider1 = new MockSlowProvider({ responseDelay: 6000 });
      const slowProvider2 = new MockSlowProvider({ responseDelay: 6000 });
      const fastProvider = new MockOpenAIProvider({ responseDelay: 100 });

      providerManager.registerProvider('cerebras', slowProvider1);
      providerManager.registerProvider('openai', slowProvider2);
      providerManager.registerProvider('llama', fastProvider);

      const promises = [];
      for (let i = 0; i < 5; i++) {
        promises.push(providerManager.generateDream(`Dream ${i}`));
      }

      const startTime = Date.now();
      const results = await Promise.all(promises);
      const totalTime = Date.now() - startTime;

      expect(results.every((r) => r.success)).toBe(true);
      expect(results.every((r) => r.metadata.source === 'llama')).toBe(true);
      expect(totalTime).toBeLessThan(2000); // Should complete quickly
    });
  });

  describe('Circuit Breaker Integration', () => {
    test('should open circuit breaker after consecutive failures', async () => {
      const unreliableProvider = new MockUnreliableProvider({
        failureRate: 1.0,
      });
      const reliableProvider = new MockOpenAIProvider();

      providerManager.registerProvider('cerebras', unreliableProvider);
      providerManager.registerProvider('openai', reliableProvider);

      // Generate enough failures to trigger circuit breaker
      for (let i = 0; i < 5; i++) {
        try {
          await providerManager.generateDream(`Dream ${i}`);
        } catch (error) {
          // Expected failures
        }
      }

      // Next request should skip the failing provider entirely
      const startTime = Date.now();
      const result = await providerManager.generateDream('Final dream');
      const responseTime = Date.now() - startTime;

      expect(result.success).toBe(true);
      expect(result.metadata.source).toBe('openai');
      expect(responseTime).toBeLessThan(500); // Should be fast (no retry attempts)
    });

    test('should recover from circuit breaker state', async () => {
      const recoveringProvider = new MockUnreliableProvider({
        failureRate: 1.0,
      });
      providerManager.registerProvider('cerebras', recoveringProvider);

      // Trigger circuit breaker
      for (let i = 0; i < 5; i++) {
        try {
          await providerManager.generateDream(`Failing dream ${i}`);
        } catch (error) {
          // Expected
        }
      }

      // Wait for circuit breaker timeout and fix the provider
      await new Promise((resolve) => setTimeout(resolve, 1100));
      recoveringProvider.setFailureRate(0); // Fix the provider

      // Should now succeed
      const result = await providerManager.generateDream('Recovery dream');
      expect(result.success).toBe(true);
      expect(result.metadata.source).toBe('cerebras');
    });
  });

  describe('Load Balancing Integration', () => {
    test('should distribute load across healthy providers', async () => {
      const cerebras = new MockCerebrasProvider({ responseDelay: 100 });
      const openai = new MockOpenAIProvider({ responseDelay: 100 });
      const llama = new MockCerebrasProvider({ responseDelay: 100 });

      providerManager.registerProvider('cerebras', cerebras);
      providerManager.registerProvider('openai', openai);
      providerManager.registerProvider('llama', llama);

      // Update config to use round-robin load balancing
      providerManager.config.loadBalancing.strategy = 'round-robin';

      const promises = [];
      for (let i = 0; i < 12; i++) {
        promises.push(providerManager.generateDream(`Dream ${i}`));
      }

      const results = await Promise.all(promises);

      // Count requests per provider
      const providerCounts = {};
      results.forEach((result) => {
        const provider = result.metadata.source;
        providerCounts[provider] = (providerCounts[provider] || 0) + 1;
      });

      // Should be roughly evenly distributed
      expect(Object.keys(providerCounts).length).toBe(3);
      Object.values(providerCounts).forEach((count) => {
        expect(count).toBeGreaterThan(2);
        expect(count).toBeLessThan(6);
      });
    });

    test('should adapt to provider performance', async () => {
      const fastProvider = new MockCerebrasProvider({ responseDelay: 50 });
      const slowProvider = new MockOpenAIProvider({ responseDelay: 500 });

      providerManager.registerProvider('cerebras', fastProvider);
      providerManager.registerProvider('openai', slowProvider);

      // Update config to use performance-based load balancing
      providerManager.config.loadBalancing.strategy = 'performance';

      // Generate some initial requests to establish performance metrics
      for (let i = 0; i < 10; i++) {
        await providerManager.generateDream(`Warmup dream ${i}`);
      }

      // Now generate more requests
      const promises = [];
      for (let i = 0; i < 20; i++) {
        promises.push(providerManager.generateDream(`Performance dream ${i}`));
      }

      const results = await Promise.all(promises);

      // Count requests per provider
      const providerCounts = {};
      results.forEach((result) => {
        const provider = result.metadata.source;
        providerCounts[provider] = (providerCounts[provider] || 0) + 1;
      });

      // Fast provider should get more requests
      expect(providerCounts.cerebras).toBeGreaterThan(providerCounts.openai);
    });
  });

  describe('Health Monitoring Integration', () => {
    test('should detect and exclude unhealthy providers', async () => {
      const healthyProvider = new MockCerebrasProvider();
      const unhealthyProvider = new MockOpenAIProvider();

      unhealthyProvider.setHealthy(false);

      providerManager.registerProvider('cerebras', healthyProvider);
      providerManager.registerProvider('openai', unhealthyProvider);

      // Start health monitoring
      await providerManager.healthMonitor.startPeriodicChecks();

      // Wait for health check
      await new Promise((resolve) => setTimeout(resolve, 1200));

      const result = await providerManager.generateDream('Health test dream');

      expect(result.success).toBe(true);
      expect(result.metadata.source).toBe('cerebras');

      // Stop health monitoring
      await providerManager.healthMonitor.stopPeriodicChecks();
    });

    test('should recover unhealthy providers', async () => {
      const recoveringProvider = new MockOpenAIProvider();
      recoveringProvider.setHealthy(false);

      providerManager.registerProvider('openai', recoveringProvider);

      // Start health monitoring
      await providerManager.healthMonitor.startPeriodicChecks();

      // Wait for initial health check
      await new Promise((resolve) => setTimeout(resolve, 1200));

      // Provider should be marked unhealthy
      let health = providerManager.healthMonitor.getProviderHealth('openai');
      expect(health.status).toBe('unhealthy');

      // Fix the provider
      recoveringProvider.setHealthy(true);

      // Wait for recovery health check
      await new Promise((resolve) => setTimeout(resolve, 1200));

      // Provider should be marked healthy again
      health = providerManager.healthMonitor.getProviderHealth('openai');
      expect(health.status).toBe('healthy');

      await providerManager.healthMonitor.stopPeriodicChecks();
    });
  });

  describe('Concurrent Request Handling', () => {
    test('should handle high concurrent load', async () => {
      const provider1 = new MockCerebrasProvider({ responseDelay: 100 });
      const provider2 = new MockOpenAIProvider({ responseDelay: 100 });

      providerManager.registerProvider('cerebras', provider1);
      providerManager.registerProvider('openai', provider2);

      const promises = [];
      const requestCount = 50;

      const startTime = Date.now();

      for (let i = 0; i < requestCount; i++) {
        promises.push(providerManager.generateDream(`Concurrent dream ${i}`));
      }

      const results = await Promise.all(promises);
      const totalTime = Date.now() - startTime;

      expect(results).toHaveLength(requestCount);
      expect(results.every((r) => r.success)).toBe(true);
      expect(totalTime).toBeLessThan(5000); // Should complete within reasonable time

      // Verify load distribution
      const providerCounts = {};
      results.forEach((result) => {
        const provider = result.metadata.source;
        providerCounts[provider] = (providerCounts[provider] || 0) + 1;
      });

      expect(Object.keys(providerCounts).length).toBeGreaterThan(1);
    });

    test('should respect concurrency limits', async () => {
      const limitedProvider = new MockCerebrasProvider({
        responseDelay: 500,
        maxConcurrent: 2,
      });

      providerManager.registerProvider('cerebras', limitedProvider);
      providerManager.config.providers.cerebras.maxConcurrent = 2;

      const promises = [];
      const requestCount = 6;

      const startTime = Date.now();

      for (let i = 0; i < requestCount; i++) {
        promises.push(providerManager.generateDream(`Limited dream ${i}`));
      }

      const results = await Promise.all(promises);
      const totalTime = Date.now() - startTime;

      expect(results.every((r) => r.success)).toBe(true);
      // Should take longer due to concurrency limits (3 batches of 2)
      expect(totalTime).toBeGreaterThan(1400); // At least 3 * 500ms
    });
  });

  describe('Error Recovery Integration', () => {
    test('should handle mixed error scenarios', async () => {
      const timeoutProvider = new MockSlowProvider({ responseDelay: 6000 });
      const rateLimitProvider = new MockUnreliableProvider({
        failureRate: 0.5,
      });
      const reliableProvider = new MockOpenAIProvider({ responseDelay: 100 });

      providerManager.registerProvider('cerebras', timeoutProvider);
      providerManager.registerProvider('openai', rateLimitProvider);
      providerManager.registerProvider('llama', reliableProvider);

      const promises = [];
      for (let i = 0; i < 20; i++) {
        promises.push(providerManager.generateDream(`Mixed error dream ${i}`));
      }

      const results = await Promise.all(promises);

      expect(results.every((r) => r.success)).toBe(true);

      // Most should come from the reliable provider
      const reliableCount = results.filter(
        (r) => r.metadata.source === 'llama'
      ).length;
      expect(reliableCount).toBeGreaterThan(15);
    });

    test('should maintain service availability during provider outages', async () => {
      const provider1 = new MockCerebrasProvider();
      const provider2 = new MockOpenAIProvider();
      const provider3 = new MockCerebrasProvider();

      providerManager.registerProvider('cerebras', provider1);
      providerManager.registerProvider('openai', provider2);
      providerManager.registerProvider('llama', provider3);

      // Start with all providers healthy
      let results = [];
      for (let i = 0; i < 5; i++) {
        const result = await providerManager.generateDream(
          `Initial dream ${i}`
        );
        results.push(result);
      }
      expect(results.every((r) => r.success)).toBe(true);

      // Simulate provider1 outage
      provider1.setFailureRate(1.0);

      results = [];
      for (let i = 0; i < 5; i++) {
        const result = await providerManager.generateDream(`Outage dream ${i}`);
        results.push(result);
      }
      expect(results.every((r) => r.success)).toBe(true);
      expect(results.every((r) => r.metadata.source !== 'cerebras')).toBe(true);

      // Simulate provider2 also failing
      provider2.setFailureRate(1.0);

      results = [];
      for (let i = 0; i < 5; i++) {
        const result = await providerManager.generateDream(
          `Double outage dream ${i}`
        );
        results.push(result);
      }
      expect(results.every((r) => r.success)).toBe(true);
      expect(results.every((r) => r.metadata.source === 'llama')).toBe(true);

      // Recover provider1
      provider1.setFailureRate(0);

      results = [];
      for (let i = 0; i < 10; i++) {
        const result = await providerManager.generateDream(
          `Recovery dream ${i}`
        );
        results.push(result);
      }
      expect(results.every((r) => r.success)).toBe(true);

      // Should use both working providers
      const sources = new Set(results.map((r) => r.metadata.source));
      expect(sources.has('cerebras')).toBe(true);
      expect(sources.has('llama')).toBe(true);
    });
  });
});
