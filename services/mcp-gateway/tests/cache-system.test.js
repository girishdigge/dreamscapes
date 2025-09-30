// tests/cache-system.test.js
// Test suite for enhanced caching system

const { CacheService } = require('../services/cacheService');
const ResponseCache = require('../engine/ResponseCache');
const CacheManager = require('../utils/CacheManager');

describe('Enhanced Caching System', () => {
  let cacheService;
  let responseCache;
  let cacheManager;

  beforeAll(async () => {
    // Use in-memory cache for testing
    const testConfig = {
      redisUrl: null, // Force fallback to in-memory
      defaultTtl: 60,
      maxCacheSize: 100,
      enableSemanticSimilarity: true,
      similarityThreshold: 0.8,
    };

    cacheService = new CacheService(testConfig);
    await cacheService.initialize();

    responseCache = cacheService.responseCache;
    cacheManager = cacheService.cacheManager;
  });

  afterAll(async () => {
    if (cacheService) {
      await cacheService.cleanup();
    }
  });

  describe('ResponseCache', () => {
    test('should generate consistent cache keys for same input', () => {
      const prompt = 'I dreamed of a peaceful garden';
      const options = { style: 'ethereal', quality: 'standard' };

      const key1 = responseCache.generateCacheKey(prompt, options);
      const key2 = responseCache.generateCacheKey(prompt, options);

      expect(key1).toBe(key2);
      expect(key1).toMatch(/^dream:[a-f0-9]{32}$/);
    });

    test('should generate different keys for different inputs', () => {
      const prompt1 = 'I dreamed of a peaceful garden';
      const prompt2 = 'I dreamed of a stormy ocean';
      const options = { style: 'ethereal' };

      const key1 = responseCache.generateCacheKey(prompt1, options);
      const key2 = responseCache.generateCacheKey(prompt2, options);

      expect(key1).not.toBe(key2);
    });

    test('should normalize prompts correctly', () => {
      const prompt1 = 'I dreamed of a PEACEFUL garden!!!';
      const prompt2 = 'i dreamed of a peaceful garden';

      const normalized1 = responseCache.normalizePrompt(prompt1);
      const normalized2 = responseCache.normalizePrompt(prompt2);

      expect(normalized1).toBe(normalized2);
      expect(normalized1).toBe('i dreamed of a peaceful garden');
    });

    test('should store and retrieve cached responses', async () => {
      const prompt = 'I dreamed of a magical forest';
      const options = { style: 'ethereal', quality: 'high' };
      const response = {
        success: true,
        data: {
          title: 'Magical Forest Dream',
          scenes: [{ type: 'forest', mood: 'magical' }],
        },
        metadata: {
          source: 'cerebras',
          quality: 'high',
          confidence: 0.9,
        },
      };

      const cacheKey = responseCache.generateCacheKey(prompt, options);

      // Store response
      const stored = await responseCache.set(cacheKey, response);
      expect(stored).toBe(true);

      // Retrieve response
      const retrieved = await responseCache.get(cacheKey, {
        prompt,
        ...options,
      });
      expect(retrieved).toBeTruthy();
      expect(retrieved.data.title).toBe('Magical Forest Dream');
      expect(retrieved.cacheMetadata).toBeTruthy();
      expect(retrieved.cacheMetadata.quality).toBe('high');
    });

    test('should calculate similarity correctly', () => {
      const text1 = 'peaceful garden with flowers';
      const text2 = 'garden with peaceful flowers';
      const text3 = 'stormy ocean with waves';

      const similarity1 = responseCache.calculateSimilarity(text1, text2);
      const similarity2 = responseCache.calculateSimilarity(text1, text3);

      expect(similarity1).toBeGreaterThan(similarity2);
      expect(similarity1).toBeGreaterThan(0.5);
      expect(similarity2).toBeLessThan(0.5);
    });

    test('should track popular patterns', () => {
      const prompt1 = 'I dreamed of a peaceful garden with flowers';
      const prompt2 = 'I dreamed of a peaceful garden with trees';
      const prompt3 = 'I dreamed of a stormy ocean';

      responseCache.trackPopularPattern(prompt1, 'standard');
      responseCache.trackPopularPattern(prompt2, 'standard');
      responseCache.trackPopularPattern(prompt1, 'standard'); // Duplicate
      responseCache.trackPopularPattern(prompt3, 'high');

      const topPatterns = responseCache.getTopPatterns(5);
      expect(topPatterns.length).toBeGreaterThan(0);
      expect(topPatterns[0]).toContain('peaceful garden');
    });

    test('should provide comprehensive stats', () => {
      const stats = responseCache.getStats();

      expect(stats).toHaveProperty('hits');
      expect(stats).toHaveProperty('misses');
      expect(stats).toHaveProperty('sets');
      expect(stats).toHaveProperty('hit_rate');
      expect(stats).toHaveProperty('miss_rate');
      expect(stats).toHaveProperty('backend');
      expect(stats).toHaveProperty('popular_patterns');
      expect(stats).toHaveProperty('top_patterns');

      expect(stats.backend).toBe('memory');
      expect(typeof stats.hit_rate).toBe('number');
      expect(typeof stats.miss_rate).toBe('number');
    });
  });

  describe('CacheManager', () => {
    test('should process user feedback correctly', async () => {
      const dreamId = 'test-dream-123';
      const feedback = { rating: 0.2, comment: 'Poor quality' };

      // This should trigger cache invalidation due to low rating
      await cacheManager.processFeedback(dreamId, feedback);

      // Verify the feedback was processed (no errors thrown)
      expect(true).toBe(true);
    });

    test('should handle content updates', async () => {
      const updateType = 'model_update';
      const context = { affectedPattern: 'dream:test*' };

      await cacheManager.processContentUpdate(updateType, context);

      // Verify the update was processed (no errors thrown)
      expect(true).toBe(true);
    });

    test('should generate analytics report', async () => {
      const report = await cacheManager.generateAnalyticsReport();

      expect(report).toBeTruthy();
      expect(report).toHaveProperty('timestamp');
      expect(report).toHaveProperty('cache_performance');
      expect(report).toHaveProperty('storage_info');
      expect(report).toHaveProperty('content_analysis');
      expect(report).toHaveProperty('operational_metrics');
      expect(report).toHaveProperty('recommendations');

      expect(report.cache_performance).toHaveProperty('hit_rate');
      expect(report.cache_performance).toHaveProperty('efficiency_rating');
      expect(report.storage_info).toHaveProperty('backend');
      expect(Array.isArray(report.recommendations)).toBe(true);
    });

    test('should provide health status', async () => {
      const health = await cacheManager.getHealthStatus();

      expect(health).toBeTruthy();
      expect(health).toHaveProperty('status');
      expect(health).toHaveProperty('issues');
      expect(health).toHaveProperty('metrics');

      expect(['healthy', 'warning', 'degraded', 'error']).toContain(
        health.status
      );
      expect(Array.isArray(health.issues)).toBe(true);
      expect(typeof health.metrics).toBe('object');
    });

    test('should perform smart cleanup', async () => {
      // Add some test entries first
      const testEntries = [
        { key: 'test1', value: { data: 'test1' }, quality: 'draft' },
        { key: 'test2', value: { data: 'test2' }, quality: 'standard' },
        { key: 'test3', value: { data: 'test3' }, quality: 'high' },
      ];

      for (const entry of testEntries) {
        await responseCache.set(entry.key, entry.value);
      }

      const cleanedCount = await cacheManager.performSmartCleanup();
      expect(typeof cleanedCount).toBe('number');
      expect(cleanedCount).toBeGreaterThanOrEqual(0);
    });
  });

  describe('CacheService Integration', () => {
    test('should initialize successfully', () => {
      expect(cacheService.initialized).toBe(true);
      expect(cacheService.isAvailable()).toBe(true);
    });

    test('should cache and retrieve dream responses', async () => {
      const prompt = 'I dreamed of a cyberpunk city';
      const response = {
        success: true,
        data: {
          title: 'Cyberpunk City Dream',
          scenes: [{ type: 'city', style: 'cyberpunk' }],
        },
        metadata: {
          source: 'cerebras',
          quality: 'standard',
          confidence: 0.8,
        },
      };
      const options = { style: 'cyberpunk', quality: 'standard' };

      // Cache the response
      const cached = await cacheService.cacheDreamResponse(
        prompt,
        response,
        options
      );
      expect(cached).toBe(true);

      // Retrieve the cached response
      const retrieved = await cacheService.getCachedDream(prompt, options);
      expect(retrieved).toBeTruthy();
      expect(retrieved.data.title).toBe('Cyberpunk City Dream');
      expect(retrieved.originalPrompt).toBe(prompt);
    });

    test('should return null for cache miss', async () => {
      const prompt =
        'I dreamed of something completely unique and never cached';
      const options = { style: 'unique', quality: 'standard' };

      const retrieved = await cacheService.getCachedDream(prompt, options);
      expect(retrieved).toBeNull();
    });

    test('should calculate appropriate TTL', () => {
      const response1 = { metadata: { quality: 'draft', confidence: 0.3 } };
      const response2 = {
        metadata: { quality: 'cinematic', confidence: 0.95 },
      };
      const options = {};

      const ttl1 = cacheService.calculateTtl(response1, options);
      const ttl2 = cacheService.calculateTtl(response2, options);

      expect(ttl2).toBeGreaterThan(ttl1);
    });

    test('should provide comprehensive stats', () => {
      const stats = cacheService.getStats();

      expect(stats).toHaveProperty('initialized');
      expect(stats).toHaveProperty('config');
      expect(stats.initialized).toBe(true);
      expect(stats.config).toHaveProperty('semantic_similarity');
      expect(stats.config).toHaveProperty('default_ttl');
    });

    test('should handle cache warming', async () => {
      const patterns = [
        'I dreamed of a peaceful garden',
        'I dreamed of a stormy ocean',
        'I dreamed of a magical forest',
      ];

      const results = await cacheService.warmCache(patterns);

      expect(results).toHaveProperty('success');
      expect(results).toHaveProperty('failed');
      expect(results).toHaveProperty('skipped');
      expect(typeof results.success).toBe('number');
      expect(typeof results.failed).toBe('number');
      expect(typeof results.skipped).toBe('number');
    });

    test('should handle feedback processing', async () => {
      const dreamId = 'integration-test-dream';
      const feedback = { rating: 0.8, comment: 'Good quality' };

      // Should not throw an error
      await cacheService.processFeedback(dreamId, feedback);
      expect(true).toBe(true);
    });

    test('should handle content updates', async () => {
      const updateType = 'prompt_template_update';
      const context = { template: 'dream_parse' };

      // Should not throw an error
      await cacheService.handleContentUpdate(updateType, context);
      expect(true).toBe(true);
    });

    test('should invalidate cache', async () => {
      // Add a test entry first
      const prompt = 'Test invalidation prompt';
      const response = { data: { test: true }, metadata: { source: 'test' } };

      await cacheService.cacheDreamResponse(prompt, response);

      // Invalidate all cache
      const success = await cacheService.invalidateCache('*');
      expect(success).toBe(true);

      // Verify entry is gone
      const retrieved = await cacheService.getCachedDream(prompt, {});
      expect(retrieved).toBeNull();
    });
  });

  describe('Error Handling', () => {
    test('should handle Redis connection failures gracefully', async () => {
      const failingConfig = {
        redisUrl: 'redis://nonexistent:6379',
        defaultTtl: 60,
        maxCacheSize: 100,
      };

      const failingService = new CacheService(failingConfig);

      // Should not throw, should fall back to in-memory
      await failingService.initialize();

      expect(failingService.responseCache.client).toBeNull();
      expect(failingService.responseCache.fallbackCache).toBeTruthy();

      await failingService.cleanup();
    });

    test('should handle malformed cache data', async () => {
      // Manually insert malformed data
      responseCache.fallbackCache.set('malformed', 'not-json');

      // Should handle gracefully
      const retrieved = await responseCache.get('malformed');
      expect(retrieved).toBeNull();
    });

    test('should handle cache service not initialized', async () => {
      const uninitializedService = new CacheService();

      expect(uninitializedService.isAvailable()).toBe(false);

      const cached = await uninitializedService.cacheDreamResponse('test', {});
      expect(cached).toBe(false);

      const retrieved = await uninitializedService.getCachedDream('test');
      expect(retrieved).toBeNull();
    });
  });
});

// Performance tests
describe('Cache Performance', () => {
  let cacheService;

  beforeAll(async () => {
    cacheService = new CacheService({
      redisUrl: null,
      defaultTtl: 60,
      maxCacheSize: 1000,
      enableSemanticSimilarity: true,
    });
    await cacheService.initialize();
  });

  afterAll(async () => {
    if (cacheService) {
      await cacheService.cleanup();
    }
  });

  test('should handle high volume cache operations', async () => {
    const startTime = Date.now();
    const operations = [];

    // Generate 100 cache operations
    for (let i = 0; i < 100; i++) {
      const prompt = `Test dream ${i} with unique content`;
      const response = {
        data: { id: i, content: `Dream ${i}` },
        metadata: { source: 'test', quality: 'standard' },
      };

      operations.push(cacheService.cacheDreamResponse(prompt, response));
    }

    await Promise.all(operations);
    const cacheTime = Date.now() - startTime;

    // Retrieve operations
    const retrieveStart = Date.now();
    const retrieveOps = [];

    for (let i = 0; i < 100; i++) {
      const prompt = `Test dream ${i} with unique content`;
      retrieveOps.push(cacheService.getCachedDream(prompt));
    }

    const results = await Promise.all(retrieveOps);
    const retrieveTime = Date.now() - retrieveStart;

    // Verify all were cached and retrieved
    const successfulRetrieves = results.filter((r) => r !== null).length;

    expect(successfulRetrieves).toBe(100);
    expect(cacheTime).toBeLessThan(5000); // Should complete within 5 seconds
    expect(retrieveTime).toBeLessThan(1000); // Retrieval should be fast

    console.log(
      `Cache performance: ${cacheTime}ms for 100 sets, ${retrieveTime}ms for 100 gets`
    );
  });

  test('should maintain performance with semantic similarity enabled', async () => {
    const basePrompt = 'I dreamed of a beautiful garden with flowers';
    const variations = [
      'I dreamed of a lovely garden with blooming flowers',
      'I dreamed of a gorgeous garden filled with flowers',
      'I dreamed of a wonderful garden containing flowers',
      'I dreamed of a peaceful garden with colorful flowers',
    ];

    // Cache the base response
    const baseResponse = {
      data: { type: 'garden', mood: 'peaceful' },
      metadata: { source: 'test', quality: 'standard' },
    };

    await cacheService.cacheDreamResponse(basePrompt, baseResponse);

    // Test semantic similarity retrieval performance
    const startTime = Date.now();
    const results = [];

    for (const variation of variations) {
      const result = await cacheService.getCachedDream(variation, {
        prompt: variation,
      });
      results.push(result);
    }

    const totalTime = Date.now() - startTime;

    // At least some should find the similar cached content
    const hits = results.filter((r) => r !== null).length;

    expect(totalTime).toBeLessThan(1000); // Should complete within 1 second
    console.log(
      `Semantic similarity performance: ${totalTime}ms for ${variations.length} lookups, ${hits} hits`
    );
  });
});
