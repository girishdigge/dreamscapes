// tests/unit/CerebrasService.test.js
// Unit tests for enhanced CerebrasService with official SDK

const CerebrasService = require('../../services/CerebrasService');

// Mock the Cerebras SDK
jest.mock('@cerebras/cerebras_cloud_sdk', () => {
  return {
    Cerebras: jest.fn().mockImplementation(() => ({
      chat: {
        completions: {
          create: jest.fn(),
        },
      },
    })),
  };
});

const { Cerebras } = require('@cerebras/cerebras_cloud_sdk');

describe('CerebrasService', () => {
  let cerebrasService;
  let mockCerebrasClient;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Create mock client
    mockCerebrasClient = {
      chat: {
        completions: {
          create: jest.fn(),
        },
      },
    };

    Cerebras.mockImplementation(() => mockCerebrasClient);

    // Initialize service
    const config = {
      apiKey: 'test-api-key',
      model: 'llama-4-maverick-17b-128e-instruct',
      temperature: 0.6,
      topP: 0.9,
      maxTokens: 32768,
      timeout: 30000,
      enableStreaming: true,
      connectionPool: {
        maxConnections: 10,
        keepAlive: true,
      },
    };

    cerebrasService = new CerebrasService(config);
  });

  describe('Initialization', () => {
    test('should initialize with correct configuration', () => {
      expect(Cerebras).toHaveBeenCalledWith({
        apiKey: 'test-api-key',
      });
      expect(cerebrasService.config.model).toBe(
        'llama-4-maverick-17b-128e-instruct'
      );
      expect(cerebrasService.config.temperature).toBe(0.6);
      expect(cerebrasService.config.maxTokens).toBe(32768);
    });

    test('should use default configuration when not provided', () => {
      const defaultService = new CerebrasService({ apiKey: 'test-key' });

      expect(defaultService.config.model).toBe(
        'llama-4-maverick-17b-128e-instruct'
      );
      expect(defaultService.config.temperature).toBe(0.6);
      expect(defaultService.config.topP).toBe(0.9);
    });

    test('should throw error without API key', () => {
      expect(() => {
        new CerebrasService({});
      }).toThrow('Cerebras API key is required');
    });
  });

  describe('Dream Generation', () => {
    test('should generate dream successfully', async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              content: JSON.stringify({
                title: 'Peaceful Garden Dream',
                description: 'A serene garden with flowing water',
                scenes: [
                  {
                    type: 'environment',
                    description: 'Garden scene',
                    mood: 'peaceful',
                    lighting: 'soft',
                    objects: [{ type: 'tree', position: { x: 0, y: 0, z: 0 } }],
                  },
                ],
                style: 'ethereal',
              }),
            },
          },
        ],
        usage: {
          prompt_tokens: 150,
          completion_tokens: 300,
          total_tokens: 450,
        },
      };

      mockCerebrasClient.chat.completions.create.mockResolvedValue(
        mockResponse
      );

      const prompt = 'I dreamed of a peaceful garden';
      const options = { style: 'ethereal' };

      const result = await cerebrasService.generateDream(prompt, options);

      expect(mockCerebrasClient.chat.completions.create).toHaveBeenCalledWith({
        model: 'llama-4-maverick-17b-128e-instruct',
        messages: [
          {
            role: 'user',
            content: expect.stringContaining(prompt),
          },
        ],
        temperature: 0.6,
        top_p: 0.9,
        max_completion_tokens: 32768,
        stream: false,
      });

      expect(result).toContain('Peaceful Garden Dream');
      expect(result).toContain('garden');
      expect(result).toContain('peaceful');
    });

    test('should handle streaming responses', async () => {
      const mockStreamChunks = [
        {
          choices: [
            {
              delta: {
                content: '{"title": "Stream',
              },
            },
          ],
        },
        {
          choices: [
            {
              delta: {
                content: 'ing Dream", "description": "A test dream"}',
              },
            },
          ],
        },
      ];

      // Mock async iterator
      const mockStream = {
        [Symbol.asyncIterator]: async function* () {
          for (const chunk of mockStreamChunks) {
            yield chunk;
          }
        },
      };

      mockCerebrasClient.chat.completions.create.mockResolvedValue(mockStream);

      const result = await cerebrasService.generateDreamStream('test prompt', {
        streaming: true,
      });

      expect(mockCerebrasClient.chat.completions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          stream: true,
        })
      );

      expect(result).toContain('Streaming Dream');
      expect(result).toContain('test dream');
    });

    test('should handle API errors gracefully', async () => {
      const apiError = new Error('API rate limit exceeded');
      apiError.status = 429;

      mockCerebrasClient.chat.completions.create.mockRejectedValue(apiError);

      await expect(
        cerebrasService.generateDream('test prompt')
      ).rejects.toThrow('API rate limit exceeded');
    });

    test('should retry on transient errors', async () => {
      const transientError = new Error('Network timeout');
      transientError.status = 503;

      mockCerebrasClient.chat.completions.create
        .mockRejectedValueOnce(transientError)
        .mockRejectedValueOnce(transientError)
        .mockResolvedValue({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  title: 'Retry Success',
                  description: 'Successfully retried',
                  scenes: [],
                  style: 'ethereal',
                }),
              },
            },
          ],
        });

      const result = await cerebrasService.generateDream('test prompt');

      expect(mockCerebrasClient.chat.completions.create).toHaveBeenCalledTimes(
        3
      );
      expect(result).toContain('Retry Success');
    });

    test('should respect timeout settings', async () => {
      const timeoutService = new CerebrasService({
        apiKey: 'test-key',
        timeout: 100, // Very short timeout
      });

      mockCerebrasClient.chat.completions.create.mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 200))
      );

      await expect(timeoutService.generateDream('test prompt')).rejects.toThrow(
        'timeout'
      );
    });

    test('should handle malformed JSON responses', async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              content: 'This is not valid JSON {broken',
            },
          },
        ],
      };

      mockCerebrasClient.chat.completions.create.mockResolvedValue(
        mockResponse
      );

      await expect(
        cerebrasService.generateDream('test prompt')
      ).rejects.toThrow('Invalid JSON response');
    });

    test('should validate response structure', async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              content: JSON.stringify({
                // Missing required fields
                title: 'Test Dream',
                // Missing description, scenes, style
              }),
            },
          },
        ],
      };

      mockCerebrasClient.chat.completions.create.mockResolvedValue(
        mockResponse
      );

      await expect(
        cerebrasService.generateDream('test prompt')
      ).rejects.toThrow('Invalid response structure');
    });
  });

  describe('Connection Management', () => {
    test('should test connection successfully', async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              content: 'Connection test successful',
            },
          },
        ],
      };

      mockCerebrasClient.chat.completions.create.mockResolvedValue(
        mockResponse
      );

      const result = await cerebrasService.testConnection();

      expect(result.status).toBe('healthy');
      expect(typeof result.latency).toBe('number');
      expect(result.latency).toBeGreaterThan(0);
    });

    test('should detect connection failures', async () => {
      const connectionError = new Error('Connection refused');
      connectionError.code = 'ECONNREFUSED';

      mockCerebrasClient.chat.completions.create.mockRejectedValue(
        connectionError
      );

      const result = await cerebrasService.testConnection();

      expect(result.status).toBe('unhealthy');
      expect(result.error).toContain('Connection refused');
    });

    test('should manage connection pool', () => {
      const pool = cerebrasService.getConnectionPool();

      expect(pool).toHaveProperty('maxConnections');
      expect(pool).toHaveProperty('activeConnections');
      expect(pool).toHaveProperty('keepAlive');
      expect(pool.maxConnections).toBe(10);
    });

    test('should handle connection pool exhaustion', async () => {
      // Mock connection pool at capacity
      cerebrasService.connectionPool.activeConnections = 10;
      cerebrasService.connectionPool.maxConnections = 10;

      const result = await cerebrasService.generateDream('test prompt');

      // Should queue the request or handle gracefully
      expect(result).toBeTruthy();
    });
  });

  describe('Request Optimization', () => {
    test('should batch multiple requests', async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              content: JSON.stringify({
                title: 'Batch Dream',
                description: 'Batched request',
                scenes: [],
                style: 'ethereal',
              }),
            },
          },
        ],
      };

      mockCerebrasClient.chat.completions.create.mockResolvedValue(
        mockResponse
      );

      const requests = [
        'I dreamed of a forest',
        'I dreamed of an ocean',
        'I dreamed of mountains',
      ];

      const results = await cerebrasService.batchGenerateDreams(requests);

      expect(results).toHaveLength(3);
      expect(results.every((r) => r.includes('Batch Dream'))).toBe(true);

      // Should optimize API calls (fewer than individual requests)
      expect(
        mockCerebrasClient.chat.completions.create.mock.calls.length
      ).toBeLessThanOrEqual(requests.length);
    });

    test('should implement request caching', async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              content: JSON.stringify({
                title: 'Cached Dream',
                description: 'This should be cached',
                scenes: [],
                style: 'ethereal',
              }),
            },
          },
        ],
      };

      mockCerebrasClient.chat.completions.create.mockResolvedValue(
        mockResponse
      );

      const prompt = 'I dreamed of a unique scenario';

      // First request
      const result1 = await cerebrasService.generateDream(prompt);

      // Second identical request (should use cache)
      const result2 = await cerebrasService.generateDream(prompt);

      expect(result1).toBe(result2);
      expect(mockCerebrasClient.chat.completions.create).toHaveBeenCalledTimes(
        1
      );
    });

    test('should optimize prompt length for model', () => {
      const veryLongPrompt = 'I dreamed of '.repeat(1000) + 'a garden';

      const optimizedPrompt = cerebrasService.optimizePrompt(veryLongPrompt);

      expect(optimizedPrompt.length).toBeLessThan(veryLongPrompt.length);
      expect(optimizedPrompt).toContain('garden');
    });
  });

  describe('Error Recovery', () => {
    test('should implement circuit breaker pattern', async () => {
      const error = new Error('Service unavailable');
      error.status = 503;

      // Fail multiple times to trigger circuit breaker
      for (let i = 0; i < 5; i++) {
        mockCerebrasClient.chat.completions.create.mockRejectedValueOnce(error);
      }

      // Multiple failures should trigger circuit breaker
      for (let i = 0; i < 5; i++) {
        try {
          await cerebrasService.generateDream('test prompt');
        } catch (e) {
          // Expected to fail
        }
      }

      // Next request should fail fast (circuit breaker open)
      const startTime = Date.now();
      try {
        await cerebrasService.generateDream('test prompt');
      } catch (e) {
        const duration = Date.now() - startTime;
        expect(duration).toBeLessThan(100); // Should fail fast
        expect(e.message).toContain('Circuit breaker');
      }
    });

    test('should recover from circuit breaker state', async () => {
      // Trigger circuit breaker
      const error = new Error('Service unavailable');
      for (let i = 0; i < 5; i++) {
        mockCerebrasClient.chat.completions.create.mockRejectedValueOnce(error);
        try {
          await cerebrasService.generateDream('test prompt');
        } catch (e) {
          // Expected
        }
      }

      // Wait for circuit breaker timeout
      await new Promise((resolve) => setTimeout(resolve, 1100));

      // Mock successful response
      mockCerebrasClient.chat.completions.create.mockResolvedValue({
        choices: [
          {
            message: {
              content: JSON.stringify({
                title: 'Recovery Dream',
                description: 'Circuit breaker recovered',
                scenes: [],
                style: 'ethereal',
              }),
            },
          },
        ],
      });

      const result = await cerebrasService.generateDream('test prompt');
      expect(result).toContain('Recovery Dream');
    });

    test('should handle rate limiting with backoff', async () => {
      const rateLimitError = new Error('Rate limit exceeded');
      rateLimitError.status = 429;
      rateLimitError.headers = { 'retry-after': '2' };

      mockCerebrasClient.chat.completions.create
        .mockRejectedValueOnce(rateLimitError)
        .mockResolvedValue({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  title: 'Rate Limited Dream',
                  description: 'Successfully handled rate limit',
                  scenes: [],
                  style: 'ethereal',
                }),
              },
            },
          ],
        });

      const startTime = Date.now();
      const result = await cerebrasService.generateDream('test prompt');
      const duration = Date.now() - startTime;

      expect(result).toContain('Rate Limited Dream');
      expect(duration).toBeGreaterThan(2000); // Should have waited
    });
  });

  describe('Performance Monitoring', () => {
    test('should track request metrics', async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              content: JSON.stringify({
                title: 'Metrics Dream',
                description: 'For metrics tracking',
                scenes: [],
                style: 'ethereal',
              }),
            },
          },
        ],
        usage: {
          prompt_tokens: 100,
          completion_tokens: 200,
          total_tokens: 300,
        },
      };

      mockCerebrasClient.chat.completions.create.mockResolvedValue(
        mockResponse
      );

      await cerebrasService.generateDream('test prompt');

      const metrics = cerebrasService.getMetrics();

      expect(metrics.totalRequests).toBe(1);
      expect(metrics.successfulRequests).toBe(1);
      expect(metrics.totalTokens).toBe(300);
      expect(metrics.averageResponseTime).toBeGreaterThan(0);
    });

    test('should track error metrics', async () => {
      const error = new Error('Test error');
      mockCerebrasClient.chat.completions.create.mockRejectedValue(error);

      try {
        await cerebrasService.generateDream('test prompt');
      } catch (e) {
        // Expected
      }

      const metrics = cerebrasService.getMetrics();

      expect(metrics.totalRequests).toBe(1);
      expect(metrics.failedRequests).toBe(1);
      expect(metrics.errorRate).toBe(1);
    });

    test('should provide performance analytics', () => {
      const analytics = cerebrasService.getPerformanceAnalytics();

      expect(analytics).toHaveProperty('responseTimePercentiles');
      expect(analytics).toHaveProperty('tokenUsageStats');
      expect(analytics).toHaveProperty('errorBreakdown');
      expect(analytics).toHaveProperty('throughputMetrics');
    });
  });

  describe('Configuration Management', () => {
    test('should update configuration dynamically', () => {
      const newConfig = {
        temperature: 0.8,
        maxTokens: 16384,
        timeout: 60000,
      };

      cerebrasService.updateConfig(newConfig);

      expect(cerebrasService.config.temperature).toBe(0.8);
      expect(cerebrasService.config.maxTokens).toBe(16384);
      expect(cerebrasService.config.timeout).toBe(60000);
    });

    test('should validate configuration updates', () => {
      const invalidConfig = {
        temperature: 2.0, // Invalid (> 1.0)
        maxTokens: -100, // Invalid (negative)
      };

      expect(() => {
        cerebrasService.updateConfig(invalidConfig);
      }).toThrow('Invalid configuration');
    });

    test('should get current configuration', () => {
      const config = cerebrasService.getConfig();

      expect(config).toHaveProperty('model');
      expect(config).toHaveProperty('temperature');
      expect(config).toHaveProperty('maxTokens');
      expect(config).toHaveProperty('timeout');
    });
  });

  describe('Cleanup and Resource Management', () => {
    test('should cleanup resources on shutdown', async () => {
      await cerebrasService.shutdown();

      expect(cerebrasService.isShuttingDown).toBe(true);

      // Should reject new requests after shutdown
      await expect(
        cerebrasService.generateDream('test prompt')
      ).rejects.toThrow('Service is shutting down');
    });

    test('should handle graceful shutdown with pending requests', async () => {
      // Start a long-running request
      mockCerebrasClient.chat.completions.create.mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 1000))
      );

      const requestPromise = cerebrasService.generateDream('test prompt');

      // Initiate shutdown
      const shutdownPromise = cerebrasService.shutdown();

      // Both should complete without errors
      await expect(
        Promise.all([requestPromise, shutdownPromise])
      ).resolves.toBeTruthy();
    });

    test('should clear caches on shutdown', async () => {
      // Generate some cached content
      const mockResponse = {
        choices: [
          {
            message: {
              content: JSON.stringify({
                title: 'Cached Dream',
                description: 'To be cleared',
                scenes: [],
                style: 'ethereal',
              }),
            },
          },
        ],
      };

      mockCerebrasClient.chat.completions.create.mockResolvedValue(
        mockResponse
      );
      await cerebrasService.generateDream('test prompt');

      // Shutdown should clear caches
      await cerebrasService.shutdown();

      const cacheStats = cerebrasService.getCacheStats();
      expect(cacheStats.size).toBe(0);
    });
  });
});
