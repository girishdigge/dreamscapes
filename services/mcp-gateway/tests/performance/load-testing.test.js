// tests/performance/load-testing.test.js
// Performance benchmarking and load testing

const ProviderManager = require('../../providers/ProviderManager');
const { ValidationPipeline } = require('../../engine');
const PromptEngine = require('../../engine/PromptEngine');
const { getCacheService } = require('../../services/cacheService');
const {
  MockCerebrasProvider,
  MockOpenAIProvider,
  MockProviderRegistry,
} = require('../mocks/MockProviders');

describe('Performance and Load Testing', () => {
  let providerManager;
  let validationPipeline;
  let promptEngine;
  let cacheService;

  beforeAll(async () => {
    // Initialize components with performance-optimized config
    const config = {
      providers: {
        cerebras: {
          enabled: true,
          priority: 1,
          maxConcurrent: 10,
          timeout: 5000,
        },
        openai: {
          enabled: true,
          priority: 2,
          maxConcurrent: 8,
          timeout: 4000,
        },
      },
      fallback: {
        enabled: true,
        maxRetries: 2,
        backoffMultiplier: 1.5,
        initialBackoffMs: 50,
      },
      loadBalancing: {
        strategy: 'performance',
        healthCheckInterval: 5000,
      },
    };

    providerManager = new ProviderManager(config);
    validationPipeline = new ValidationPipeline({
      validation: { strictMode: false },
      repair: { maxRepairAttempts: 2 },
    });
    promptEngine = new PromptEngine({
      templates: { enableCaching: true },
      optimization: { enableAnalytics: true },
    });

    // Initialize cache service
    try {
      cacheService = getCacheService();
      await cacheService.initialize();
    } catch (error) {
      console.warn('Cache service initialization failed:', error.message);
    }

    // Register fast mock providers
    providerManager.registerProvider(
      'cerebras',
      new MockCerebrasProvider({ responseDelay: 50 })
    );
    providerManager.registerProvider(
      'openai',
      new MockOpenAIProvider({ responseDelay: 75 })
    );
  });

  afterAll(async () => {
    if (providerManager) {
      await providerManager.shutdown();
    }
    if (cacheService) {
      await cacheService.cleanup();
    }
  });

  describe('Single Request Performance', () => {
    test('should generate dreams within acceptable time limits', async () => {
      const testCases = [
        { text: 'I dreamed of a garden', expectedMaxTime: 200 },
        {
          text: 'I dreamed of a complex magical forest with ancient trees and mystical creatures',
          expectedMaxTime: 300,
        },
        {
          text: 'I dreamed of a futuristic cyberpunk city with neon lights and flying vehicles',
          expectedMaxTime: 300,
        },
      ];

      for (const testCase of testCases) {
        const startTime = Date.now();

        const prompt = promptEngine.buildDreamPrompt(testCase.text, 'ethereal');
        const result = await providerManager.generateDream(prompt);

        const responseTime = Date.now() - startTime;

        expect(result.success).toBe(true);
        expect(responseTime).toBeLessThan(testCase.expectedMaxTime);

        console.log(
          `Single request: "${testCase.text.substring(
            0,
            30
          )}..." - ${responseTime}ms`
        );
      }
    });

    test('should validate and repair within time limits', async () => {
      const mockResponse = {
        success: true,
        data: {
          title: 'Test Dream',
          description: 'A test dream for performance testing',
          scenes: [
            {
              type: 'environment',
              description: 'Test scene',
              mood: 'test',
              objects: [{ type: 'tree', position: { x: 0, y: 0, z: 0 } }],
            },
          ],
          style: 'ethereal',
        },
      };

      const startTime = Date.now();

      const result = await validationPipeline.validateAndRepair(
        mockResponse,
        'dreamResponse',
        { originalPrompt: 'test', style: 'ethereal' }
      );

      const validationTime = Date.now() - startTime;

      expect(result.success).toBe(true);
      expect(validationTime).toBeLessThan(100); // Should be very fast

      console.log(`Validation time: ${validationTime}ms`);
    });

    test('should cache operations be fast', async () => {
      if (!cacheService || !cacheService.isAvailable()) {
        console.log('Skipping cache performance test - cache not available');
        return;
      }

      const testData = {
        title: 'Cache Performance Test',
        description: 'Testing cache performance',
        scenes: [{ type: 'test', description: 'test scene' }],
      };

      // Cache write performance
      const writeStartTime = Date.now();
      await cacheService.cacheDreamResponse('cache test prompt', testData);
      const writeTime = Date.now() - writeStartTime;

      // Cache read performance
      const readStartTime = Date.now();
      const cachedData = await cacheService.getCachedDream('cache test prompt');
      const readTime = Date.now() - readStartTime;

      expect(cachedData).toBeTruthy();
      expect(writeTime).toBeLessThan(50);
      expect(readTime).toBeLessThan(20);

      console.log(`Cache write: ${writeTime}ms, Cache read: ${readTime}ms`);
    });
  });

  describe('Concurrent Request Performance', () => {
    test('should handle moderate concurrent load', async () => {
      const concurrentRequests = 20;
      const promises = [];

      const startTime = Date.now();

      for (let i = 0; i < concurrentRequests; i++) {
        const prompt = promptEngine.buildDreamPrompt(
          `I dreamed of scenario ${i}`,
          'ethereal'
        );
        promises.push(providerManager.generateDream(prompt));
      }

      const results = await Promise.all(promises);
      const totalTime = Date.now() - startTime;
      const avgTimePerRequest = totalTime / concurrentRequests;

      expect(results.every((r) => r.success)).toBe(true);
      expect(totalTime).toBeLessThan(3000); // Should complete within 3 seconds
      expect(avgTimePerRequest).toBeLessThan(200); // Average should be reasonable

      console.log(
        `Concurrent load (${concurrentRequests}): Total ${totalTime}ms, Avg ${avgTimePerRequest.toFixed(
          1
        )}ms per request`
      );

      // Verify load distribution
      const sources = results.map((r) => r.metadata.source);
      const sourceCounts = sources.reduce((acc, source) => {
        acc[source] = (acc[source] || 0) + 1;
        return acc;
      }, {});

      console.log('Load distribution:', sourceCounts);
      expect(Object.keys(sourceCounts).length).toBeGreaterThan(1); // Should use multiple providers
    });

    test('should handle high concurrent load', async () => {
      const concurrentRequests = 50;
      const promises = [];

      const startTime = Date.now();

      for (let i = 0; i < concurrentRequests; i++) {
        const prompt = promptEngine.buildDreamPrompt(
          `High load dream ${i}`,
          'ethereal'
        );
        promises.push(providerManager.generateDream(prompt));
      }

      const results = await Promise.all(promises);
      const totalTime = Date.now() - startTime;
      const avgTimePerRequest = totalTime / concurrentRequests;

      expect(results.every((r) => r.success)).toBe(true);
      expect(totalTime).toBeLessThan(8000); // Should complete within 8 seconds
      expect(avgTimePerRequest).toBeLessThan(300);

      console.log(
        `High concurrent load (${concurrentRequests}): Total ${totalTime}ms, Avg ${avgTimePerRequest.toFixed(
          1
        )}ms per request`
      );

      // Check for any performance degradation
      const responseTimes = results.map((r) => r.metadata.processingTime || 0);
      const maxResponseTime = Math.max(...responseTimes);
      const minResponseTime = Math.min(...responseTimes);
      const responseTimeVariance = maxResponseTime - minResponseTime;

      console.log(
        `Response time range: ${minResponseTime}ms - ${maxResponseTime}ms (variance: ${responseTimeVariance}ms)`
      );
      expect(responseTimeVariance).toBeLessThan(1000); // Variance shouldn't be too high
    });

    test('should maintain performance under sustained load', async () => {
      const batchSize = 15;
      const numberOfBatches = 5;
      const batchResults = [];

      for (let batch = 0; batch < numberOfBatches; batch++) {
        const promises = [];
        const batchStartTime = Date.now();

        for (let i = 0; i < batchSize; i++) {
          const prompt = promptEngine.buildDreamPrompt(
            `Sustained load batch ${batch} item ${i}`,
            'ethereal'
          );
          promises.push(providerManager.generateDream(prompt));
        }

        const results = await Promise.all(promises);
        const batchTime = Date.now() - batchStartTime;
        const avgBatchTime = batchTime / batchSize;

        batchResults.push({
          batch,
          totalTime: batchTime,
          avgTime: avgBatchTime,
          successRate: results.filter((r) => r.success).length / results.length,
        });

        expect(results.every((r) => r.success)).toBe(true);
        expect(batchTime).toBeLessThan(5000);

        console.log(
          `Batch ${
            batch + 1
          }/${numberOfBatches}: ${batchTime}ms total, ${avgBatchTime.toFixed(
            1
          )}ms avg`
        );

        // Small delay between batches
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      // Analyze performance consistency
      const avgTimes = batchResults.map((b) => b.avgTime);
      const overallAvg =
        avgTimes.reduce((sum, time) => sum + time, 0) / avgTimes.length;
      const maxAvg = Math.max(...avgTimes);
      const minAvg = Math.min(...avgTimes);

      console.log(
        `Sustained load summary: Overall avg ${overallAvg.toFixed(
          1
        )}ms, Range ${minAvg.toFixed(1)}ms - ${maxAvg.toFixed(1)}ms`
      );

      // Performance shouldn't degrade significantly over time
      expect(maxAvg).toBeLessThan(overallAvg * 1.5);
      expect(batchResults.every((b) => b.successRate === 1)).toBe(true);
    });
  });

  describe('Memory and Resource Usage', () => {
    test('should not leak memory during extended operation', async () => {
      const initialMemory = process.memoryUsage();
      const iterations = 100;

      for (let i = 0; i < iterations; i++) {
        const prompt = promptEngine.buildDreamPrompt(
          `Memory test ${i}`,
          'ethereal'
        );
        const result = await providerManager.generateDream(prompt);
        expect(result.success).toBe(true);

        // Periodic garbage collection hint
        if (i % 20 === 0 && global.gc) {
          global.gc();
        }
      }

      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
      const memoryIncreasePerOp = memoryIncrease / iterations;

      console.log(
        `Memory usage: Initial ${(initialMemory.heapUsed / 1024 / 1024).toFixed(
          1
        )}MB, Final ${(finalMemory.heapUsed / 1024 / 1024).toFixed(1)}MB`
      );
      console.log(
        `Memory increase: ${(memoryIncrease / 1024 / 1024).toFixed(
          1
        )}MB total, ${(memoryIncreasePerOp / 1024).toFixed(1)}KB per operation`
      );

      // Memory increase should be reasonable (less than 100KB per operation)
      expect(memoryIncreasePerOp).toBeLessThan(100 * 1024);
    });

    test('should handle resource cleanup properly', async () => {
      const testProviderManager = new ProviderManager({
        providers: {
          test1: { enabled: true, priority: 1 },
          test2: { enabled: true, priority: 2 },
        },
      });

      testProviderManager.registerProvider('test1', new MockCerebrasProvider());
      testProviderManager.registerProvider('test2', new MockOpenAIProvider());

      // Generate some activity
      for (let i = 0; i < 10; i++) {
        const prompt = promptEngine.buildDreamPrompt(
          `Cleanup test ${i}`,
          'ethereal'
        );
        await testProviderManager.generateDream(prompt);
      }

      // Shutdown should complete quickly and cleanly
      const shutdownStart = Date.now();
      await testProviderManager.shutdown();
      const shutdownTime = Date.now() - shutdownStart;

      expect(shutdownTime).toBeLessThan(1000); // Should shutdown within 1 second
      console.log(`Shutdown time: ${shutdownTime}ms`);

      // Should reject new requests after shutdown
      await expect(
        testProviderManager.generateDream('post-shutdown test')
      ).rejects.toThrow();
    });
  });

  describe('Cache Performance Impact', () => {
    test('should show significant performance improvement with cache hits', async () => {
      if (!cacheService || !cacheService.isAvailable()) {
        console.log('Skipping cache performance test - cache not available');
        return;
      }

      const testPrompt = 'I dreamed of a performance comparison scenario';

      // First request (cache miss)
      const missStartTime = Date.now();
      const prompt = promptEngine.buildDreamPrompt(testPrompt, 'ethereal');
      const result1 = await providerManager.generateDream(prompt);
      const missTime = Date.now() - missStartTime;

      expect(result1.success).toBe(true);

      // Cache the result
      await cacheService.cacheDreamResponse(testPrompt, result1, {
        style: 'ethereal',
      });

      // Second request (cache hit)
      const hitStartTime = Date.now();
      const cachedResult = await cacheService.getCachedDream(testPrompt, {
        style: 'ethereal',
      });
      const hitTime = Date.now() - hitStartTime;

      expect(cachedResult).toBeTruthy();
      expect(hitTime).toBeLessThan(missTime / 5); // Cache should be at least 5x faster

      console.log(
        `Cache performance: Miss ${missTime}ms, Hit ${hitTime}ms (${(
          missTime / hitTime
        ).toFixed(1)}x faster)`
      );
    });

    test('should handle cache performance under load', async () => {
      if (!cacheService || !cacheService.isAvailable()) {
        console.log('Skipping cache load test - cache not available');
        return;
      }

      const cacheablePrompts = [
        'I dreamed of a garden',
        'I dreamed of an ocean',
        'I dreamed of a mountain',
        'I dreamed of a forest',
        'I dreamed of a desert',
      ];

      // Pre-populate cache
      for (const promptText of cacheablePrompts) {
        const prompt = promptEngine.buildDreamPrompt(promptText, 'ethereal');
        const result = await providerManager.generateDream(prompt);
        await cacheService.cacheDreamResponse(promptText, result, {
          style: 'ethereal',
        });
      }

      // Test concurrent cache hits
      const promises = [];
      const startTime = Date.now();

      for (let i = 0; i < 50; i++) {
        const promptText = cacheablePrompts[i % cacheablePrompts.length];
        promises.push(
          cacheService.getCachedDream(promptText, { style: 'ethereal' })
        );
      }

      const results = await Promise.all(promises);
      const totalTime = Date.now() - startTime;
      const avgTime = totalTime / results.length;

      expect(results.every((r) => r !== null)).toBe(true);
      expect(avgTime).toBeLessThan(10); // Should be very fast
      expect(totalTime).toBeLessThan(200); // Total should be fast

      console.log(
        `Cache load test: 50 concurrent hits in ${totalTime}ms (${avgTime.toFixed(
          1
        )}ms avg)`
      );
    });
  });

  describe('Stress Testing', () => {
    test('should handle extreme concurrent load gracefully', async () => {
      const extremeLoad = 100;
      const promises = [];
      const startTime = Date.now();

      // Create a mix of different request types
      for (let i = 0; i < extremeLoad; i++) {
        const style = ['ethereal', 'cyberpunk', 'surreal'][i % 3];
        const prompt = promptEngine.buildDreamPrompt(
          `Extreme load test ${i}`,
          style
        );
        promises.push(
          providerManager.generateDream(prompt).catch((error) => ({
            success: false,
            error: error.message,
            index: i,
          }))
        );
      }

      const results = await Promise.all(promises);
      const totalTime = Date.now() - startTime;
      const successfulResults = results.filter((r) => r.success);
      const failedResults = results.filter((r) => !r.success);
      const successRate = successfulResults.length / results.length;

      console.log(`Extreme load test (${extremeLoad} requests):`);
      console.log(`  Total time: ${totalTime}ms`);
      console.log(`  Success rate: ${(successRate * 100).toFixed(1)}%`);
      console.log(
        `  Successful: ${successfulResults.length}, Failed: ${failedResults.length}`
      );
      console.log(
        `  Avg time per request: ${(totalTime / extremeLoad).toFixed(1)}ms`
      );

      // Should maintain reasonable success rate even under extreme load
      expect(successRate).toBeGreaterThan(0.8); // At least 80% success rate
      expect(totalTime).toBeLessThan(20000); // Should complete within 20 seconds

      if (failedResults.length > 0) {
        console.log(
          'Sample failures:',
          failedResults.slice(0, 3).map((r) => r.error)
        );
      }
    });

    test('should recover from provider overload', async () => {
      // Simulate provider overload by setting very low concurrency limits
      const originalCerebrasConfig = providerManager.config.providers.cerebras;
      const originalOpenAIConfig = providerManager.config.providers.openai;

      providerManager.config.providers.cerebras.maxConcurrent = 1;
      providerManager.config.providers.openai.maxConcurrent = 1;

      const overloadRequests = 20;
      const promises = [];

      for (let i = 0; i < overloadRequests; i++) {
        const prompt = promptEngine.buildDreamPrompt(
          `Overload recovery test ${i}`,
          'ethereal'
        );
        promises.push(providerManager.generateDream(prompt));
      }

      const startTime = Date.now();
      const results = await Promise.all(promises);
      const totalTime = Date.now() - startTime;

      // Restore original config
      providerManager.config.providers.cerebras = originalCerebrasConfig;
      providerManager.config.providers.openai = originalOpenAIConfig;

      expect(results.every((r) => r.success)).toBe(true);
      console.log(
        `Overload recovery: ${overloadRequests} requests in ${totalTime}ms with limited concurrency`
      );

      // Should take longer due to concurrency limits but still succeed
      expect(totalTime).toBeGreaterThan(1000); // Should be slower
      expect(totalTime).toBeLessThan(15000); // But not too slow
    });
  });

  describe('Performance Regression Detection', () => {
    test('should maintain baseline performance metrics', async () => {
      const baselineMetrics = {
        singleRequestMaxTime: 300,
        concurrentRequestsMaxTime: 3000,
        cacheHitMaxTime: 20,
        validationMaxTime: 100,
      };

      // Single request test
      const singleStart = Date.now();
      const prompt = promptEngine.buildDreamPrompt(
        'Performance baseline test',
        'ethereal'
      );
      const singleResult = await providerManager.generateDream(prompt);
      const singleTime = Date.now() - singleStart;

      expect(singleResult.success).toBe(true);
      expect(singleTime).toBeLessThan(baselineMetrics.singleRequestMaxTime);

      // Concurrent requests test
      const concurrentPromises = [];
      const concurrentStart = Date.now();

      for (let i = 0; i < 10; i++) {
        const concurrentPrompt = promptEngine.buildDreamPrompt(
          `Concurrent baseline ${i}`,
          'ethereal'
        );
        concurrentPromises.push(
          providerManager.generateDream(concurrentPrompt)
        );
      }

      const concurrentResults = await Promise.all(concurrentPromises);
      const concurrentTime = Date.now() - concurrentStart;

      expect(concurrentResults.every((r) => r.success)).toBe(true);
      expect(concurrentTime).toBeLessThan(
        baselineMetrics.concurrentRequestsMaxTime
      );

      // Validation test
      const validationStart = Date.now();
      await validationPipeline.validateAndRepair(singleResult, 'dreamResponse');
      const validationTime = Date.now() - validationStart;

      expect(validationTime).toBeLessThan(baselineMetrics.validationMaxTime);

      console.log('Performance baseline results:');
      console.log(
        `  Single request: ${singleTime}ms (baseline: ${baselineMetrics.singleRequestMaxTime}ms)`
      );
      console.log(
        `  Concurrent requests: ${concurrentTime}ms (baseline: ${baselineMetrics.concurrentRequestsMaxTime}ms)`
      );
      console.log(
        `  Validation: ${validationTime}ms (baseline: ${baselineMetrics.validationMaxTime}ms)`
      );
    });
  });
});
