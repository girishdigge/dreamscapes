// tests/integration/dream-generation-workflow.test.js
// End-to-end tests for complete dream generation workflow

const request = require('supertest');
const express = require('express');
const ProviderManager = require('../../providers/ProviderManager');
const { ValidationPipeline } = require('../../engine');
const { getCacheService } = require('../../services/cacheService');
const PromptEngine = require('../../engine/PromptEngine');
const {
  MockCerebrasProvider,
  MockOpenAIProvider,
} = require('../mocks/MockProviders');

// Create test app
function createTestApp() {
  const app = express();
  app.use(express.json());

  // Initialize components
  const providerManager = new ProviderManager({
    providers: {
      cerebras: { enabled: true, priority: 1 },
      openai: { enabled: true, priority: 2 },
    },
    fallback: { enabled: true, maxRetries: 2 },
  });

  const validationPipeline = new ValidationPipeline();
  const promptEngine = new PromptEngine();
  let cacheService = null;

  // Register mock providers
  providerManager.registerProvider('cerebras', new MockCerebrasProvider());
  providerManager.registerProvider('openai', new MockOpenAIProvider());

  // Initialize cache service
  const initCache = async () => {
    try {
      cacheService = getCacheService();
      await cacheService.initialize();
    } catch (error) {
      console.warn('Cache initialization failed:', error.message);
    }
  };

  // Main parse endpoint
  app.post('/parse', async (req, res) => {
    try {
      const { text, style = 'ethereal', options = {} } = req.body;

      if (!text || typeof text !== 'string' || text.trim().length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Text is required',
        });
      }

      const startTime = Date.now();

      // Check cache first
      let cachedResponse = null;
      if (cacheService && cacheService.isAvailable()) {
        try {
          cachedResponse = await cacheService.getCachedDream(text, {
            style,
            ...options,
          });
          if (cachedResponse) {
            return res.json({
              success: true,
              data: cachedResponse,
              metadata: {
                source: 'cache',
                processingTimeMs: Date.now() - startTime,
                cacheHit: true,
              },
            });
          }
        } catch (cacheError) {
          console.warn('Cache lookup failed:', cacheError.message);
        }
      }

      // Build prompt
      const prompt = promptEngine.buildDreamPrompt(text, style, options);

      // Generate dream using provider manager
      const aiResponse = await providerManager.generateDream(prompt, options);

      if (!aiResponse.success) {
        return res.status(502).json({
          success: false,
          error: 'AI generation failed',
          fallback: true,
        });
      }

      // Validate and repair response
      const validationResult = await validationPipeline.validateAndRepair(
        aiResponse,
        'dreamResponse',
        {
          originalPrompt: text,
          provider: aiResponse.metadata.source,
          style: style,
        }
      );

      let finalContent = validationResult.finalContent;

      // Add metadata
      finalContent.metadata = {
        ...finalContent.metadata,
        generatedAt: new Date().toISOString(),
        processingTimeMs: Date.now() - startTime,
        originalText: text,
        requestedStyle: style,
        options,
        validation: {
          valid: validationResult.validation?.valid || false,
          repairApplied: !!validationResult.repair,
          qualityScore: validationResult.metrics?.qualityScore || 0,
        },
      };

      // Cache the response
      if (cacheService && cacheService.isAvailable()) {
        try {
          await cacheService.cacheDreamResponse(text, finalContent, {
            style,
            quality: options.quality || 'standard',
            provider: aiResponse.metadata.source,
            ...options,
          });
        } catch (cacheError) {
          console.warn('Failed to cache response:', cacheError.message);
        }
      }

      res.json({
        success: true,
        data: finalContent,
        metadata: {
          source: aiResponse.metadata.source,
          processingTimeMs: Date.now() - startTime,
          cacheHit: false,
          validation: finalContent.metadata.validation,
        },
      });
    } catch (error) {
      console.error('Parse endpoint error:', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  });

  // Health endpoint
  app.get('/health', (req, res) => {
    res.json({
      service: 'dreamscapes-mcp-gateway',
      status: 'healthy',
      timestamp: new Date().toISOString(),
    });
  });

  // Status endpoint
  app.get('/status', async (req, res) => {
    const status = {
      service: 'dreamscapes-mcp-gateway',
      timestamp: new Date().toISOString(),
      providers: {},
    };

    const providers = providerManager.getRegisteredProviders();
    for (const providerName of providers) {
      try {
        const provider = providerManager.getProvider(providerName);
        await provider.testConnection();
        status.providers[providerName] = { status: 'healthy' };
      } catch (error) {
        status.providers[providerName] = {
          status: 'unhealthy',
          error: error.message,
        };
      }
    }

    res.json(status);
  });

  // Metrics endpoint
  app.get('/metrics', (req, res) => {
    const metrics = providerManager.getAllMetrics();
    const validationMetrics = validationPipeline.getComprehensiveMetrics();
    const cacheStats = cacheService ? cacheService.getStats() : null;

    res.json({
      providers: metrics,
      validation: validationMetrics,
      cache: cacheStats,
      timestamp: new Date().toISOString(),
    });
  });

  return { app, providerManager, validationPipeline, cacheService, initCache };
}

describe('Dream Generation Workflow E2E', () => {
  let app, providerManager, validationPipeline, cacheService, initCache;

  beforeAll(async () => {
    const testApp = createTestApp();
    app = testApp.app;
    providerManager = testApp.providerManager;
    validationPipeline = testApp.validationPipeline;
    cacheService = testApp.cacheService;
    initCache = testApp.initCache;

    await initCache();
  });

  afterAll(async () => {
    if (providerManager) {
      await providerManager.shutdown();
    }
    if (cacheService) {
      await cacheService.cleanup();
    }
  });

  describe('Basic Dream Generation', () => {
    test('should generate dream from simple text', async () => {
      const response = await request(app)
        .post('/parse')
        .send({
          text: 'I dreamed of a peaceful garden with flowers',
          style: 'ethereal',
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeTruthy();
      expect(response.body.data.data.title).toBeTruthy();
      expect(response.body.data.data.description).toBeTruthy();
      expect(response.body.data.data.scenes).toBeInstanceOf(Array);
      expect(response.body.data.data.scenes.length).toBeGreaterThan(0);
      expect(response.body.data.data.style).toBe('ethereal');
      expect(response.body.metadata.source).toMatch(/cerebras|openai/);
      expect(response.body.metadata.cacheHit).toBe(false);
    });

    test('should handle complex dream descriptions', async () => {
      const complexDream = `I dreamed I was walking through a vast library where books flew like birds, 
        their pages rustling in the wind. The shelves stretched infinitely upward, and words fell like rain, 
        forming puddles of stories on the marble floor. Ancient tomes glowed with inner light, and I could 
        hear whispers of forgotten tales echoing through the corridors.`;

      const response = await request(app)
        .post('/parse')
        .send({
          text: complexDream,
          style: 'surreal',
          options: {
            quality: 'high',
            temperature: 0.8,
          },
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.data.title).toContain('Library');
      expect(response.body.data.data.description.length).toBeGreaterThan(50);
      expect(response.body.data.data.scenes.length).toBeGreaterThan(0);
      expect(response.body.data.data.style).toBe('surreal');

      // Should contain elements from the original description
      const content = JSON.stringify(response.body.data.data);
      expect(content.toLowerCase()).toMatch(/library|book|page|shelf/);
    });

    test('should handle different styles', async () => {
      const styles = ['ethereal', 'cyberpunk', 'surreal', 'cinematic'];
      const baseText = 'I dreamed of a futuristic city';

      for (const style of styles) {
        const response = await request(app)
          .post('/parse')
          .send({
            text: baseText,
            style: style,
          })
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.data.style).toBe(style);
      }
    });
  });

  describe('Validation and Repair Integration', () => {
    test('should validate and repair malformed responses', async () => {
      // Mock a provider that returns incomplete data
      const brokenProvider = new MockCerebrasProvider();
      const originalGenerate = brokenProvider.generateDream;

      brokenProvider.generateDream = async function (prompt, options) {
        const result = await originalGenerate.call(this, prompt, options);
        // Break the response by removing required fields
        delete result.data.title;
        delete result.data.style;
        result.data.scenes = []; // Empty scenes
        return result;
      };

      providerManager.registerProvider('cerebras', brokenProvider);

      const response = await request(app)
        .post('/parse')
        .send({
          text: 'I dreamed of a mountain lake',
          style: 'ethereal',
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.data.title).toBeTruthy(); // Should be repaired
      expect(response.body.data.data.style).toBeTruthy(); // Should be repaired
      expect(response.body.data.data.scenes.length).toBeGreaterThan(0); // Should be repaired
      expect(response.body.metadata.validation.repairApplied).toBe(true);
    });

    test('should provide quality assessment', async () => {
      const response = await request(app)
        .post('/parse')
        .send({
          text: 'I dreamed of a detailed magical forest with ancient trees, mystical creatures, and glowing mushrooms',
          style: 'ethereal',
          options: { quality: 'high' },
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.metadata.validation).toBeTruthy();
      expect(response.body.metadata.validation.qualityScore).toBeGreaterThan(0);
    });
  });

  describe('Caching Integration', () => {
    test('should cache and retrieve responses', async () => {
      const dreamText = 'I dreamed of a unique scenario for caching test';

      // First request - should generate and cache
      const response1 = await request(app)
        .post('/parse')
        .send({
          text: dreamText,
          style: 'ethereal',
        })
        .expect(200);

      expect(response1.body.success).toBe(true);
      expect(response1.body.metadata.cacheHit).toBe(false);

      // Second identical request - should hit cache
      const response2 = await request(app)
        .post('/parse')
        .send({
          text: dreamText,
          style: 'ethereal',
        })
        .expect(200);

      expect(response2.body.success).toBe(true);
      expect(response2.body.metadata.cacheHit).toBe(true);
      expect(response2.body.metadata.processingTimeMs).toBeLessThan(100);
    });

    test('should handle cache misses for different parameters', async () => {
      const dreamText = 'I dreamed of a scenario for cache miss test';

      // Request with style A
      const response1 = await request(app)
        .post('/parse')
        .send({
          text: dreamText,
          style: 'ethereal',
        })
        .expect(200);

      // Request with style B - should be cache miss
      const response2 = await request(app)
        .post('/parse')
        .send({
          text: dreamText,
          style: 'cyberpunk',
        })
        .expect(200);

      expect(response1.body.metadata.cacheHit).toBe(false);
      expect(response2.body.metadata.cacheHit).toBe(false);
      expect(response1.body.data.data.style).toBe('ethereal');
      expect(response2.body.data.data.style).toBe('cyberpunk');
    });
  });

  describe('Provider Fallback Integration', () => {
    test('should fallback when primary provider fails', async () => {
      // Make cerebras fail
      const cerebras = providerManager.getProvider('cerebras');
      cerebras.setFailureRate(1.0);

      const response = await request(app)
        .post('/parse')
        .send({
          text: 'I dreamed of a fallback test scenario',
          style: 'ethereal',
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.metadata.source).toBe('openai'); // Should fallback to OpenAI

      // Reset cerebras
      cerebras.setFailureRate(0);
    });

    test('should handle all providers failing', async () => {
      // Make all providers fail
      const cerebras = providerManager.getProvider('cerebras');
      const openai = providerManager.getProvider('openai');

      cerebras.setFailureRate(1.0);
      openai.setFailureRate(1.0);

      const response = await request(app)
        .post('/parse')
        .send({
          text: 'I dreamed of a total failure scenario',
          style: 'ethereal',
        })
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBeTruthy();

      // Reset providers
      cerebras.setFailureRate(0);
      openai.setFailureRate(0);
    });
  });

  describe('Performance and Load Testing', () => {
    test('should handle concurrent requests', async () => {
      const promises = [];
      const requestCount = 20;

      for (let i = 0; i < requestCount; i++) {
        promises.push(
          request(app)
            .post('/parse')
            .send({
              text: `I dreamed of a concurrent scenario ${i}`,
              style: 'ethereal',
            })
        );
      }

      const startTime = Date.now();
      const responses = await Promise.all(promises);
      const totalTime = Date.now() - startTime;

      expect(responses.every((r) => r.status === 200)).toBe(true);
      expect(responses.every((r) => r.body.success)).toBe(true);
      expect(totalTime).toBeLessThan(10000); // Should complete within 10 seconds

      // Verify load distribution
      const sources = responses.map((r) => r.body.metadata.source);
      const uniqueSources = new Set(sources);
      expect(uniqueSources.size).toBeGreaterThan(0);
    });

    test('should maintain performance under load', async () => {
      const batchSize = 10;
      const batches = 3;
      const results = [];

      for (let batch = 0; batch < batches; batch++) {
        const promises = [];

        for (let i = 0; i < batchSize; i++) {
          promises.push(
            request(app)
              .post('/parse')
              .send({
                text: `I dreamed of a performance test scenario batch ${batch} item ${i}`,
                style: 'ethereal',
              })
          );
        }

        const startTime = Date.now();
        const batchResponses = await Promise.all(promises);
        const batchTime = Date.now() - startTime;

        results.push({
          batch,
          responses: batchResponses,
          time: batchTime,
        });

        expect(batchResponses.every((r) => r.status === 200)).toBe(true);
        expect(batchTime).toBeLessThan(5000); // Each batch should complete within 5 seconds
      }

      // Performance should not degrade significantly across batches
      const times = results.map((r) => r.time);
      const avgTime = times.reduce((sum, time) => sum + time, 0) / times.length;
      const maxTime = Math.max(...times);

      expect(maxTime).toBeLessThan(avgTime * 2); // Max time shouldn't be more than 2x average
    });
  });

  describe('Error Handling', () => {
    test('should handle invalid input', async () => {
      const invalidInputs = [
        { text: '', style: 'ethereal' },
        { text: null, style: 'ethereal' },
        { text: '   ', style: 'ethereal' },
        { style: 'ethereal' }, // Missing text
      ];

      for (const input of invalidInputs) {
        const response = await request(app)
          .post('/parse')
          .send(input)
          .expect(400);

        expect(response.body.success).toBe(false);
        expect(response.body.error).toContain('Text is required');
      }
    });

    test('should handle malformed JSON', async () => {
      const response = await request(app)
        .post('/parse')
        .send('invalid json')
        .expect(400);

      expect(response.body).toBeTruthy();
    });

    test('should provide meaningful error messages', async () => {
      // Test with extremely long input that might cause issues
      const veryLongText = 'I dreamed of '.repeat(10000) + 'a garden';

      const response = await request(app).post('/parse').send({
        text: veryLongText,
        style: 'ethereal',
      });

      // Should either succeed or fail gracefully with meaningful error
      if (response.status !== 200) {
        expect(response.body.error).toBeTruthy();
        expect(typeof response.body.error).toBe('string');
      }
    });
  });

  describe('Health and Status Monitoring', () => {
    test('should provide health status', async () => {
      const response = await request(app).get('/health').expect(200);

      expect(response.body.service).toBe('dreamscapes-mcp-gateway');
      expect(response.body.status).toBe('healthy');
      expect(response.body.timestamp).toBeTruthy();
    });

    test('should provide provider status', async () => {
      const response = await request(app).get('/status').expect(200);

      expect(response.body.service).toBe('dreamscapes-mcp-gateway');
      expect(response.body.providers).toBeTruthy();
      expect(response.body.providers.cerebras).toBeTruthy();
      expect(response.body.providers.openai).toBeTruthy();
      expect(response.body.providers.cerebras.status).toBe('healthy');
      expect(response.body.providers.openai.status).toBe('healthy');
    });

    test('should provide comprehensive metrics', async () => {
      // Generate some activity first
      await request(app).post('/parse').send({
        text: 'I dreamed of a metrics test',
        style: 'ethereal',
      });

      const response = await request(app).get('/metrics').expect(200);

      expect(response.body.providers).toBeTruthy();
      expect(response.body.validation).toBeTruthy();
      expect(response.body.timestamp).toBeTruthy();

      // Should have provider metrics
      expect(response.body.providers.overall).toBeTruthy();
      expect(response.body.providers.overall.totalRequests).toBeGreaterThan(0);

      // Should have validation metrics
      expect(response.body.validation.validation).toBeTruthy();
      expect(
        response.body.validation.validation.totalValidations
      ).toBeGreaterThan(0);
    });
  });

  describe('Quality Assurance', () => {
    test('should maintain consistent output quality', async () => {
      const testPrompts = [
        'I dreamed of a peaceful garden with flowing water',
        'I dreamed of a futuristic city with flying cars',
        'I dreamed of an underwater kingdom with coral castles',
        'I dreamed of a magical forest with talking animals',
        'I dreamed of a desert oasis under starry skies',
      ];

      const responses = [];

      for (const prompt of testPrompts) {
        const response = await request(app)
          .post('/parse')
          .send({
            text: prompt,
            style: 'ethereal',
            options: { quality: 'high' },
          })
          .expect(200);

        responses.push(response.body);
      }

      // All responses should be successful
      expect(responses.every((r) => r.success)).toBe(true);

      // All should have required structure
      responses.forEach((response) => {
        expect(response.data.data.title).toBeTruthy();
        expect(response.data.data.description).toBeTruthy();
        expect(response.data.data.scenes).toBeInstanceOf(Array);
        expect(response.data.data.scenes.length).toBeGreaterThan(0);
        expect(response.data.data.style).toBe('ethereal');
      });

      // Quality scores should be reasonable
      const qualityScores = responses
        .map((r) => r.metadata.validation?.qualityScore)
        .filter((score) => typeof score === 'number');

      if (qualityScores.length > 0) {
        const avgQuality =
          qualityScores.reduce((sum, score) => sum + score, 0) /
          qualityScores.length;
        expect(avgQuality).toBeGreaterThan(0.5);
      }
    });

    test('should handle edge cases gracefully', async () => {
      const edgeCases = [
        'dream',
        'I dreamed.',
        'I dreamed of something indescribable and beyond words.',
        'I dreamed of a dream within a dream within a dream.',
        'I dreamed of 🌟✨🦄🌈🎭🎪🎨🎵🎭🌙',
      ];

      for (const edgeCase of edgeCases) {
        const response = await request(app).post('/parse').send({
          text: edgeCase,
          style: 'ethereal',
        });

        // Should either succeed or fail gracefully
        if (response.status === 200) {
          expect(response.body.success).toBe(true);
          expect(response.body.data.data.title).toBeTruthy();
        } else {
          expect(response.body.error).toBeTruthy();
        }
      }
    });
  });
});
