// tests/integration/end-to-end-workflow.test.js
// End-to-end integration tests for complete provider interaction workflows
// Requirements: 1.4, 1.5, 3.4, 5.2, 5.3

const request = require('supertest');
const express = require('express');
const ProviderManager = require('../../providers/ProviderManager');
const {
  extractContentSafely,
  parseDreamResponse,
} = require('../../utils/responseParser');
const {
  MockCerebrasProvider,
  MockOpenAIProvider,
  MockFailingProvider,
  MockSlowProvider,
  MockUnreliableProvider,
} = require('../mocks/MockProviders');

// Create a test Express app
function createTestApp(providerManager) {
  const app = express();
  app.use(express.json());

  // Dream generation endpoint
  app.post('/api/dreams/generate', async (req, res) => {
    try {
      const { prompt, options = {} } = req.body;

      if (!prompt) {
        return res.status(400).json({ error: 'Prompt is required' });
      }

      const result = await providerManager.executeWithFallback(
        async (provider, providerName, context) => {
          const response = await provider.generateDream(
            prompt,
            options,
            context
          );
          const content = extractContentSafely(
            response,
            providerName,
            'generateDream'
          );

          if (!content) {
            throw new Error('Failed to extract content from response');
          }

          const parsedContent = await parseDreamResponse(content, providerName);

          return {
            success: true,
            data: parsedContent,
            metadata: {
              provider: providerName,
              processingTime: Date.now() - (context?.startTime || Date.now()),
              contentLength: content.length,
            },
          };
        },
        null,
        {
          preserveContext: true,
          context: {
            startTime: Date.now(),
            requestId: req.headers['x-request-id'] || 'test-request',
            userAgent: req.headers['user-agent'],
          },
        }
      );

      res.json(result);
    } catch (error) {
      res.status(500).json({
        error: 'Dream generation failed',
        message: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  });

  // Health check endpoint
  app.get('/api/health', (req, res) => {
    try {
      const health = providerManager.getProviderHealth();
      res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        providers: health,
      });
    } catch (error) {
      res.status(500).json({
        status: 'error',
        message: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  });

  // Provider-specific health endpoint
  app.get('/api/health/:provider', (req, res) => {
    try {
      const { provider } = req.params;
      const health = providerManager.getProviderHealth(provider);
      res.json({
        provider,
        health,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      res.status(500).json({
        error: 'Health check failed',
        message: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  });

  return app;
}

describe('End-to-End Workflow Integration Tests', () => {
  let providerManager;
  let app;

  beforeEach(() => {
    providerManager = new ProviderManager({
      enableEnhancedMonitoring: false,
      healthCheckInterval: 2000,
      maxRetryAttempts: 3,
      backoffMultiplier: 2,
      circuitBreakerThreshold: 3,
      circuitBreakerTimeout: 5000,
      enableProviderSwitching: true,
      preserveContext: true,
    });

    app = createTestApp(providerManager);
  });

  afterEach(async () => {
    if (providerManager) {
      await providerManager.shutdown();
    }
  });

  describe('Complete Dream Generation Workflow', () => {
    test('should handle successful dream generation end-to-end', async () => {
      const cerebrasProvider = new MockCerebrasProvider();
      const openaiProvider = new MockOpenAIProvider();

      // Configure realistic responses
      cerebrasProvider.generateDream = async function (prompt, options = {}) {
        return {
          choices: [
            {
              message: {
                content: JSON.stringify({
                  id: 'dream-' + Date.now(),
                  title: 'Ethereal Garden',
                  description: 'A mystical garden with floating islands',
                  structures: [
                    {
                      type: 'floating_island',
                      position: { x: 0, y: 100, z: 0 },
                      properties: { size: 'large', vegetation: 'lush' },
                    },
                  ],
                  entities: [
                    {
                      type: 'butterfly',
                      position: { x: 10, y: 105, z: 5 },
                      properties: { color: 'iridescent', size: 'small' },
                    },
                  ],
                  cinematography: {
                    lighting: 'soft_ethereal',
                    mood: 'peaceful',
                    camera_angle: 'wide_shot',
                    atmosphere: 'misty',
                  },
                }),
              },
            },
          ],
        };
      };

      providerManager.registerProvider('cerebras', cerebrasProvider);
      providerManager.registerProvider('openai', openaiProvider);

      const response = await request(app)
        .post('/api/dreams/generate')
        .send({
          prompt: 'I dreamed of a mystical garden with floating islands',
          options: {
            style: 'ethereal',
            mood: 'peaceful',
          },
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeTruthy();
      expect(response.body.data.structures).toBeDefined();
      expect(response.body.data.entities).toBeDefined();
      expect(response.body.data.cinematography).toBeDefined();
      expect(response.body.metadata.provider).toBeTruthy();
      expect(response.body.metadata.processingTime).toBeGreaterThan(0);
    });

    test('should handle provider fallback in complete workflow', async () => {
      const failingProvider = new MockFailingProvider();
      const workingProvider = new MockCerebrasProvider();

      // Configure working provider with realistic response
      workingProvider.generateDream = async function (prompt, options = {}) {
        return {
          choices: [
            {
              message: {
                content: JSON.stringify({
                  id: 'fallback-dream-' + Date.now(),
                  title: 'Fallback Dream',
                  description: 'A dream generated by fallback provider',
                  structures: [
                    {
                      type: 'castle',
                      position: { x: 0, y: 0, z: 0 },
                      properties: { style: 'medieval', condition: 'ancient' },
                    },
                  ],
                  entities: [],
                  cinematography: {
                    lighting: 'dramatic',
                    mood: 'mysterious',
                  },
                }),
              },
            },
          ],
        };
      };

      providerManager.registerProvider('failing', failingProvider);
      providerManager.registerProvider('working', workingProvider);

      const response = await request(app)
        .post('/api/dreams/generate')
        .send({
          prompt: 'I dreamed of an ancient castle',
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.metadata.provider).toBe('working');
      expect(response.body.data.title).toBe('Fallback Dream');
    });

    test('should handle malformed responses with recovery', async () => {
      const malformedProvider = new MockCerebrasProvider();
      const backupProvider = new MockOpenAIProvider();

      // Configure malformed response
      malformedProvider.generateDream = async function (prompt, options = {}) {
        return {
          choices: [
            {
              message: {
                content: '{"structures": [{"type": "broken"', // Malformed JSON
              },
            },
          ],
        };
      };

      // Configure backup with valid response
      backupProvider.generateDream = async function (prompt, options = {}) {
        return {
          choices: [
            {
              message: {
                content: JSON.stringify({
                  id: 'backup-dream',
                  title: 'Backup Dream',
                  description: 'A dream from backup provider',
                  structures: [{ type: 'house' }],
                  entities: [],
                  cinematography: { lighting: 'natural' },
                }),
              },
            },
          ],
        };
      };

      providerManager.registerProvider('malformed', malformedProvider);
      providerManager.registerProvider('backup', backupProvider);

      const response = await request(app)
        .post('/api/dreams/generate')
        .send({
          prompt: 'I dreamed of a simple house',
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.metadata.provider).toBe('backup');
      expect(response.body.data.title).toBe('Backup Dream');
    });
  });

  describe('Health Monitoring Workflow', () => {
    test('should provide comprehensive health status', async () => {
      const healthyProvider = new MockCerebrasProvider();
      const unhealthyProvider = new MockFailingProvider();

      providerManager.registerProvider('healthy', healthyProvider);
      providerManager.registerProvider('unhealthy', unhealthyProvider);

      // Generate some activity to establish health metrics
      try {
        await request(app)
          .post('/api/dreams/generate')
          .send({ prompt: 'Health test dream' });
      } catch (error) {
        // Some requests may fail, that's expected
      }

      const response = await request(app).get('/api/health').expect(200);

      expect(response.body.status).toBe('ok');
      expect(response.body.providers).toBeTruthy();
      expect(response.body.providers.summary).toBeTruthy();
      expect(response.body.providers.providers.healthy).toBeTruthy();
      expect(response.body.providers.providers.unhealthy).toBeTruthy();
    });

    test('should provide provider-specific health information', async () => {
      const testProvider = new MockCerebrasProvider();
      providerManager.registerProvider('test', testProvider);

      const response = await request(app).get('/api/health/test').expect(200);

      expect(response.body.provider).toBe('test');
      expect(response.body.health).toBeTruthy();
      expect(response.body.health.status).toBeDefined();
      expect(response.body.health.metrics).toBeDefined();
    });

    test('should handle health check for non-existent provider', async () => {
      const response = await request(app)
        .get('/api/health/nonexistent')
        .expect(200);

      expect(response.body.health.status).toBe('unknown');
      expect(response.body.health.error).toContain('Provider not found');
    });
  });

  describe('Error Handling Workflow', () => {
    test('should handle missing prompt gracefully', async () => {
      const provider = new MockCerebrasProvider();
      providerManager.registerProvider('test', provider);

      const response = await request(app)
        .post('/api/dreams/generate')
        .send({})
        .expect(400);

      expect(response.body.error).toBe('Prompt is required');
    });

    test('should handle all providers failing', async () => {
      const failingProvider1 = new MockFailingProvider();
      const failingProvider2 = new MockFailingProvider();

      providerManager.registerProvider('failing1', failingProvider1);
      providerManager.registerProvider('failing2', failingProvider2);

      const response = await request(app)
        .post('/api/dreams/generate')
        .send({
          prompt: 'This will fail',
        })
        .expect(500);

      expect(response.body.error).toBe('Dream generation failed');
      expect(response.body.message).toContain('All providers failed');
    });

    test('should handle timeout scenarios gracefully', async () => {
      const slowProvider = new MockSlowProvider({ responseDelay: 10000 });
      providerManager.registerProvider('slow', slowProvider);

      const response = await request(app)
        .post('/api/dreams/generate')
        .send({
          prompt: 'This will timeout',
        })
        .timeout(5000) // 5 second timeout
        .expect(500);

      expect(response.body.error).toBe('Dream generation failed');
    });
  });

  describe('Concurrent Request Workflow', () => {
    test('should handle multiple concurrent requests', async () => {
      const provider1 = new MockCerebrasProvider({ responseDelay: 200 });
      const provider2 = new MockOpenAIProvider({ responseDelay: 300 });

      // Configure realistic responses
      provider1.generateDream = async function (prompt, options = {}) {
        await new Promise((resolve) => setTimeout(resolve, this.responseDelay));
        return {
          choices: [
            {
              message: {
                content: JSON.stringify({
                  id: 'concurrent-dream-1',
                  title: 'Concurrent Dream 1',
                  structures: [{ type: 'tower' }],
                  entities: [],
                  cinematography: { lighting: 'bright' },
                }),
              },
            },
          ],
        };
      };

      provider2.generateDream = async function (prompt, options = {}) {
        await new Promise((resolve) => setTimeout(resolve, this.responseDelay));
        return {
          choices: [
            {
              message: {
                content: JSON.stringify({
                  id: 'concurrent-dream-2',
                  title: 'Concurrent Dream 2',
                  structures: [{ type: 'bridge' }],
                  entities: [],
                  cinematography: { lighting: 'soft' },
                }),
              },
            },
          ],
        };
      };

      providerManager.registerProvider('provider1', provider1);
      providerManager.registerProvider('provider2', provider2);

      const promises = [];
      const requestCount = 10;

      for (let i = 0; i < requestCount; i++) {
        promises.push(
          request(app)
            .post('/api/dreams/generate')
            .send({
              prompt: `Concurrent dream request ${i}`,
              options: { requestId: i },
            })
        );
      }

      const responses = await Promise.all(promises);

      // All requests should succeed
      expect(responses).toHaveLength(requestCount);
      responses.forEach((response, index) => {
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data).toBeTruthy();
      });

      // Should use both providers
      const providerCounts = {};
      responses.forEach((response) => {
        const provider = response.body.metadata.provider;
        providerCounts[provider] = (providerCounts[provider] || 0) + 1;
      });

      expect(Object.keys(providerCounts).length).toBeGreaterThan(1);
    });

    test('should maintain performance under load with failures', async () => {
      const unreliableProvider = new MockUnreliableProvider({
        failureRate: 0.6,
      });
      const reliableProvider = new MockCerebrasProvider({ responseDelay: 100 });

      // Configure reliable provider response
      reliableProvider.generateDream = async function (prompt, options = {}) {
        await new Promise((resolve) => setTimeout(resolve, this.responseDelay));
        return {
          choices: [
            {
              message: {
                content: JSON.stringify({
                  id: 'reliable-dream',
                  title: 'Reliable Dream',
                  structures: [{ type: 'stable_structure' }],
                  entities: [],
                  cinematography: { lighting: 'consistent' },
                }),
              },
            },
          ],
        };
      };

      providerManager.registerProvider('unreliable', unreliableProvider);
      providerManager.registerProvider('reliable', reliableProvider);

      const promises = [];
      const requestCount = 15;
      const startTime = Date.now();

      for (let i = 0; i < requestCount; i++) {
        promises.push(
          request(app)
            .post('/api/dreams/generate')
            .send({
              prompt: `Load test dream ${i}`,
            })
        );
      }

      const responses = await Promise.all(promises);
      const totalTime = Date.now() - startTime;

      // Most requests should succeed
      const successfulResponses = responses.filter((r) => r.status === 200);
      expect(successfulResponses.length).toBeGreaterThan(requestCount * 0.8);

      // Should complete in reasonable time
      expect(totalTime).toBeLessThan(10000); // 10 seconds max

      // Most successful responses should come from reliable provider
      const reliableCount = successfulResponses.filter(
        (r) => r.body.metadata?.provider === 'reliable'
      ).length;
      expect(reliableCount).toBeGreaterThan(successfulResponses.length * 0.7);
    });
  });

  describe('Context Preservation Workflow', () => {
    test('should preserve request context through provider switching', async () => {
      const contextFailProvider = new MockCerebrasProvider({
        shouldFail: true,
      });
      const contextSuccessProvider = new MockOpenAIProvider();

      let capturedContext = null;

      // Override success provider to capture context
      const originalGenerate = contextSuccessProvider.generateDream;
      contextSuccessProvider.generateDream = async function (
        prompt,
        options,
        context
      ) {
        capturedContext = context;
        return {
          choices: [
            {
              message: {
                content: JSON.stringify({
                  id: 'context-preserved-dream',
                  title: 'Context Preserved Dream',
                  structures: [{ type: 'context_structure' }],
                  entities: [],
                  cinematography: { lighting: 'contextual' },
                  metadata: {
                    preservedContext: !!context,
                    previousProvider: context?.previousProvider,
                  },
                }),
              },
            },
          ],
        };
      };

      providerManager.registerProvider('fail', contextFailProvider);
      providerManager.registerProvider('success', contextSuccessProvider);

      const response = await request(app)
        .post('/api/dreams/generate')
        .set('x-request-id', 'context-test-123')
        .set('user-agent', 'integration-test-agent')
        .send({
          prompt: 'Context preservation test dream',
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.metadata.provider).toBe('success');
      expect(capturedContext).toBeTruthy();
      expect(capturedContext.requestId).toBe('context-test-123');
      expect(capturedContext.userAgent).toBe('integration-test-agent');
      expect(capturedContext.previousProvider).toBe('fail');
    });
  });
});
