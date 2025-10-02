// tests/integration/provider-interactions.test.js
// Comprehensive integration tests for provider interactions
// Requirements: 1.4, 1.5, 3.4, 5.2, 5.3

const ProviderManager = require('../../providers/ProviderManager');
const { extractContentSafely } = require('../../utils/responseParser');
const {
  MockCerebrasProvider,
  MockOpenAIProvider,
  MockFailingProvider,
  MockSlowProvider,
  MockUnreliableProvider,
  createMockProvider,
  MockProviderRegistry,
} = require('../mocks/MockProviders');

describe('Provider Interactions Integration Tests', () => {
  let providerManager;
  let mockRegistry;

  beforeEach(() => {
    // Initialize provider manager with test configuration
    providerManager = new ProviderManager({
      enableEnhancedMonitoring: false, // Disable for tests
      healthCheckInterval: 1000,
      maxRetryAttempts: 3,
      backoffMultiplier: 2,
      circuitBreakerThreshold: 3,
      circuitBreakerTimeout: 5000,
      enableProviderSwitching: true,
      preserveContext: true,
    });

    // Initialize mock provider registry
    mockRegistry = new MockProviderRegistry();
  });

  afterEach(async () => {
    if (providerManager) {
      await providerManager.shutdown();
    }
    if (mockRegistry) {
      mockRegistry.clear();
    }
  });

  describe('Mock Provider Response Scenarios', () => {
    describe('Cerebras Response Formats', () => {
      test('should handle Cerebras object response format', async () => {
        const mockProvider = new MockCerebrasProvider();

        // Override to return object response format
        mockProvider.generateDream = async function (prompt, options = {}) {
          return {
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    structures: [{ type: 'tower', height: 100 }],
                    entities: [
                      { type: 'wizard', position: { x: 0, y: 0, z: 0 } },
                    ],
                    cinematography: { lighting: 'ethereal', mood: 'mystical' },
                  }),
                },
              },
            ],
          };
        };

        providerManager.registerProvider('cerebras', mockProvider);

        const result = await providerManager.executeWithFallback(
          async (provider) => {
            const response = await provider.generateDream('test prompt');
            return extractContentSafely(response, 'cerebras', 'generateDream');
          }
        );

        expect(result).toBeTruthy();
        expect(typeof result).toBe('string');

        // Verify content can be parsed as JSON
        const parsed = JSON.parse(result);
        expect(parsed.structures).toBeDefined();
        expect(parsed.entities).toBeDefined();
        expect(parsed.cinematography).toBeDefined();
      });

      test('should handle Cerebras streaming response format', async () => {
        const mockProvider = new MockCerebrasProvider();

        // Override to return streaming response format
        mockProvider.generateDream = async function (prompt, options = {}) {
          return {
            content: JSON.stringify({
              structures: [{ type: 'castle', walls: 4 }],
              entities: [],
              cinematography: { style: 'medieval' },
            }),
          };
        };

        providerManager.registerProvider('cerebras', mockProvider);

        const result = await providerManager.executeWithFallback(
          async (provider) => {
            const response = await provider.generateDream('streaming test');
            return extractContentSafely(response, 'cerebras', 'generateDream');
          }
        );

        expect(result).toBeTruthy();
        const parsed = JSON.parse(result);
        expect(parsed.structures[0].type).toBe('castle');
      });

      test('should handle malformed Cerebras responses gracefully', async () => {
        const mockProvider = new MockCerebrasProvider();

        // Override to return malformed response
        mockProvider.generateDream = async function (prompt, options = {}) {
          return {
            choices: [
              {
                message: {
                  content: '{"structures": [{"type": "broken"', // Missing closing braces
                },
              },
            ],
          };
        };

        providerManager.registerProvider('cerebras', mockProvider);

        const result = await providerManager.executeWithFallback(
          async (provider) => {
            const response = await provider.generateDream('malformed test');
            return extractContentSafely(response, 'cerebras', 'generateDream');
          }
        );

        // Should handle gracefully and return something (even if partial)
        expect(result).toBeTruthy();
        expect(typeof result).toBe('string');
      });
    });

    describe('OpenAI Response Formats', () => {
      test('should handle OpenAI chat completion format', async () => {
        const mockProvider = new MockOpenAIProvider();

        // Override to return chat completion format
        mockProvider.generateDream = async function (prompt, options = {}) {
          return {
            id: 'chatcmpl-123',
            object: 'chat.completion',
            choices: [
              {
                index: 0,
                message: {
                  role: 'assistant',
                  content: JSON.stringify({
                    structures: [{ type: 'mansion', rooms: 20 }],
                    entities: [{ type: 'butler', name: 'Alfred' }],
                    cinematography: { lighting: 'warm', atmosphere: 'cozy' },
                  }),
                },
                finish_reason: 'stop',
              },
            ],
            usage: {
              prompt_tokens: 50,
              completion_tokens: 100,
              total_tokens: 150,
            },
          };
        };

        providerManager.registerProvider('openai', mockProvider);

        const result = await providerManager.executeWithFallback(
          async (provider) => {
            const response = await provider.generateDream('openai test');
            return extractContentSafely(response, 'openai', 'generateDream');
          }
        );

        expect(result).toBeTruthy();
        const parsed = JSON.parse(result);
        expect(parsed.structures[0].type).toBe('mansion');
        expect(parsed.entities[0].name).toBe('Alfred');
      });

      test('should handle OpenAI legacy completion format', async () => {
        const mockProvider = new MockOpenAIProvider();

        // Override to return legacy completion format
        mockProvider.generateDream = async function (prompt, options = {}) {
          return {
            id: 'cmpl-123',
            object: 'text_completion',
            choices: [
              {
                text: JSON.stringify({
                  structures: [{ type: 'cabin', location: 'forest' }],
                  entities: [],
                  cinematography: { mood: 'rustic' },
                }),
                index: 0,
                finish_reason: 'stop',
              },
            ],
          };
        };

        providerManager.registerProvider('openai', mockProvider);

        const result = await providerManager.executeWithFallback(
          async (provider) => {
            const response = await provider.generateDream('legacy test');
            return extractContentSafely(response, 'openai', 'generateDream');
          }
        );

        expect(result).toBeTruthy();
        const parsed = JSON.parse(result);
        expect(parsed.structures[0].type).toBe('cabin');
      });
    });

    describe('Mixed Response Format Scenarios', () => {
      test('should handle providers returning different response formats', async () => {
        const cerebrasProvider = new MockCerebrasProvider();
        const openaiProvider = new MockOpenAIProvider();

        // Configure different response formats
        cerebrasProvider.generateDream = async function () {
          return { content: '{"type": "cerebras_format"}' };
        };

        openaiProvider.generateDream = async function () {
          return {
            choices: [{ message: { content: '{"type": "openai_format"}' } }],
          };
        };

        providerManager.registerProvider('cerebras', cerebrasProvider);
        providerManager.registerProvider('openai', openaiProvider);

        // Test both providers
        const cerebrasResult = await providerManager.executeWithFallback(
          async (provider) => {
            const response = await provider.generateDream('test');
            return extractContentSafely(response, 'cerebras');
          },
          ['cerebras']
        );

        const openaiResult = await providerManager.executeWithFallback(
          async (provider) => {
            const response = await provider.generateDream('test');
            return extractContentSafely(response, 'openai');
          },
          ['openai']
        );

        expect(JSON.parse(cerebrasResult).type).toBe('cerebras_format');
        expect(JSON.parse(openaiResult).type).toBe('openai_format');
      });
    });
  });

  describe('End-to-End Request Processing with Error Conditions', () => {
    describe('Network Error Scenarios', () => {
      test('should handle network timeout errors', async () => {
        const slowProvider = new MockSlowProvider({ responseDelay: 10000 });
        const fastProvider = new MockOpenAIProvider({ responseDelay: 100 });

        providerManager.registerProvider('slow', slowProvider);
        providerManager.registerProvider('fast', fastProvider);

        const startTime = Date.now();

        const result = await providerManager.executeWithFallback(
          async (provider, providerName) => {
            const response = await provider.generateDream('timeout test');
            return {
              content: extractContentSafely(response, providerName),
              provider: providerName,
            };
          },
          null,
          { timeout: 5000 } // 5 second timeout
        );

        const duration = Date.now() - startTime;

        expect(result).toBeTruthy();
        expect(result.provider).toBe('fast'); // Should fallback to fast provider
        expect(duration).toBeLessThan(8000); // Should not wait for slow provider
      });

      test('should handle connection refused errors', async () => {
        const failingProvider = new MockFailingProvider();
        const workingProvider = new MockCerebrasProvider();

        // Override to simulate connection refused
        failingProvider.generateDream = async function () {
          const error = new Error('Connection refused');
          error.code = 'ECONNREFUSED';
          throw error;
        };

        providerManager.registerProvider('failing', failingProvider);
        providerManager.registerProvider('working', workingProvider);

        const result = await providerManager.executeWithFallback(
          async (provider, providerName) => {
            const response = await provider.generateDream('connection test');
            return {
              content: extractContentSafely(response, providerName),
              provider: providerName,
            };
          }
        );

        expect(result.provider).toBe('working');
        expect(result.content).toBeTruthy();
      });
    });

    describe('Authentication Error Scenarios', () => {
      test('should handle API key authentication errors', async () => {
        const authFailProvider = new MockCerebrasProvider();
        const validProvider = new MockOpenAIProvider();

        // Override to simulate auth failure
        authFailProvider.generateDream = async function () {
          const error = new Error('Invalid API key');
          error.status = 401;
          error.code = 'UNAUTHORIZED';
          throw error;
        };

        providerManager.registerProvider('auth_fail', authFailProvider);
        providerManager.registerProvider('valid', validProvider);

        const result = await providerManager.executeWithFallback(
          async (provider, providerName) => {
            const response = await provider.generateDream('auth test');
            return {
              content: extractContentSafely(response, providerName),
              provider: providerName,
            };
          }
        );

        expect(result.provider).toBe('valid');
        expect(result.content).toBeTruthy();
      });
    });

    describe('Rate Limiting Scenarios', () => {
      test('should handle rate limit errors with backoff', async () => {
        const rateLimitedProvider = new MockUnreliableProvider();
        const backupProvider = new MockCerebrasProvider();

        let attemptCount = 0;
        rateLimitedProvider.generateDream = async function () {
          attemptCount++;
          if (attemptCount <= 2) {
            const error = new Error('Rate limit exceeded');
            error.status = 429;
            error.retryAfter = 1; // 1 second
            throw error;
          }
          // Succeed on third attempt
          return {
            content: '{"success": true, "attempt": ' + attemptCount + '}',
          };
        };

        providerManager.registerProvider('rate_limited', rateLimitedProvider);
        providerManager.registerProvider('backup', backupProvider);

        const startTime = Date.now();

        const result = await providerManager.executeWithFallback(
          async (provider, providerName) => {
            const response = await provider.generateDream('rate limit test');
            return {
              content: extractContentSafely(response, providerName),
              provider: providerName,
              attempts: attemptCount,
            };
          }
        );

        const duration = Date.now() - startTime;

        expect(result).toBeTruthy();
        expect(duration).toBeGreaterThan(1000); // Should have backoff delay

        // Could succeed with rate_limited after retries or fallback to backup
        expect(['rate_limited', 'backup']).toContain(result.provider);
      });
    });

    describe('Response Parsing Error Scenarios', () => {
      test('should handle completely invalid response formats', async () => {
        const invalidProvider = new MockCerebrasProvider();
        const validProvider = new MockOpenAIProvider();

        // Override to return completely invalid response
        invalidProvider.generateDream = async function () {
          return Buffer.from('binary data that cannot be parsed');
        };

        providerManager.registerProvider('invalid', invalidProvider);
        providerManager.registerProvider('valid', validProvider);

        const result = await providerManager.executeWithFallback(
          async (provider, providerName) => {
            const response = await provider.generateDream(
              'invalid response test'
            );
            const content = extractContentSafely(response, providerName);

            if (!content) {
              throw new Error('Failed to extract content');
            }

            return {
              content,
              provider: providerName,
            };
          }
        );

        expect(result.provider).toBe('valid');
        expect(result.content).toBeTruthy();
      });

      test('should handle partial JSON responses', async () => {
        const partialProvider = new MockCerebrasProvider();

        // Override to return partial JSON
        partialProvider.generateDream = async function () {
          return {
            choices: [
              {
                message: {
                  content: '{"structures": [{"type": "incomplete"',
                },
              },
            ],
          };
        };

        providerManager.registerProvider('partial', partialProvider);

        const result = await providerManager.executeWithFallback(
          async (provider, providerName) => {
            const response = await provider.generateDream('partial json test');
            return extractContentSafely(response, providerName);
          }
        );

        // Should handle gracefully and return something
        expect(result).toBeTruthy();
        expect(typeof result).toBe('string');
      });
    });
  });

  describe('Fallback Behavior and Provider Switching Validation', () => {
    describe('Sequential Fallback Scenarios', () => {
      test('should fallback through multiple providers in priority order', async () => {
        const provider1 = createMockProvider('cerebras', {
          shouldFail: true,
          priority: 1,
        });
        const provider2 = createMockProvider('openai', {
          shouldFail: true,
          priority: 2,
        });
        const provider3 = createMockProvider('llama', {
          shouldFail: false,
          priority: 3,
        });

        providerManager.registerProvider('cerebras', provider1);
        providerManager.registerProvider('openai', provider2);
        providerManager.registerProvider('llama', provider3);

        const result = await providerManager.executeWithFallback(
          async (provider, providerName) => {
            const response = await provider.generateDream('fallback test');
            return {
              content: extractContentSafely(response, providerName),
              provider: providerName,
            };
          }
        );

        expect(result.provider).toBe('llama');
        expect(result.content).toBeTruthy();

        // Verify failure counts
        expect(provider1.getMetrics().failedRequests).toBe(1);
        expect(provider2.getMetrics().failedRequests).toBe(1);
        expect(provider3.getMetrics().successfulRequests).toBe(1);
      });

      test('should preserve context during provider switching', async () => {
        const contextTrackingProvider1 = new MockCerebrasProvider({
          shouldFail: true,
        });
        const contextTrackingProvider2 = new MockOpenAIProvider();

        let receivedContext = null;

        // Override provider2 to capture context
        const originalGenerate = contextTrackingProvider2.generateDream;
        contextTrackingProvider2.generateDream = async function (
          prompt,
          options,
          context
        ) {
          receivedContext = context;
          return originalGenerate.call(this, prompt, options);
        };

        providerManager.registerProvider('cerebras', contextTrackingProvider1);
        providerManager.registerProvider('openai', contextTrackingProvider2);

        const result = await providerManager.executeWithFallback(
          async (provider, providerName, context) => {
            const response = await provider.generateDream(
              'context test',
              {},
              context
            );
            return {
              content: extractContentSafely(response, providerName),
              provider: providerName,
            };
          },
          null,
          {
            preserveContext: true,
            context: { originalPrompt: 'context test', userId: 'test-user' },
          }
        );

        expect(result.provider).toBe('openai');
        expect(receivedContext).toBeTruthy();
        expect(receivedContext.previousProvider).toBe('cerebras');
        expect(receivedContext.originalPrompt).toBe('context test');
      });
    });

    describe('Circuit Breaker Integration', () => {
      test('should open circuit breaker after consecutive failures', async () => {
        const unreliableProvider = new MockUnreliableProvider({
          failureRate: 1.0,
        });
        const reliableProvider = new MockCerebrasProvider();

        providerManager.registerProvider('unreliable', unreliableProvider);
        providerManager.registerProvider('reliable', reliableProvider);

        // Generate enough failures to trigger circuit breaker
        const failurePromises = [];
        for (let i = 0; i < 5; i++) {
          failurePromises.push(
            providerManager
              .executeWithFallback(async (provider, providerName) => {
                const response = await provider.generateDream(
                  `failure test ${i}`
                );
                return {
                  content: extractContentSafely(response, providerName),
                  provider: providerName,
                };
              })
              .catch(() => ({ provider: 'failed', content: null }))
          );
        }

        const failureResults = await Promise.all(failurePromises);

        // Most should have fallen back to reliable provider
        const reliableCount = failureResults.filter(
          (r) => r.provider === 'reliable'
        ).length;
        expect(reliableCount).toBeGreaterThan(2);

        // Next request should skip unreliable provider entirely due to circuit breaker
        const startTime = Date.now();
        const finalResult = await providerManager.executeWithFallback(
          async (provider, providerName) => {
            const response = await provider.generateDream(
              'circuit breaker test'
            );
            return {
              content: extractContentSafely(response, providerName),
              provider: providerName,
            };
          }
        );
        const duration = Date.now() - startTime;

        expect(finalResult.provider).toBe('reliable');
        expect(duration).toBeLessThan(1000); // Should be fast (no retry attempts on unreliable)
      });

      test('should recover from circuit breaker state', async () => {
        const recoveringProvider = new MockUnreliableProvider({
          failureRate: 1.0,
        });
        const backupProvider = new MockOpenAIProvider();

        providerManager.registerProvider('recovering', recoveringProvider);
        providerManager.registerProvider('backup', backupProvider);

        // Trigger circuit breaker
        for (let i = 0; i < 3; i++) {
          try {
            await providerManager.executeWithFallback(
              async (provider) => {
                const response = await provider.generateDream(
                  `trigger failure ${i}`
                );
                return extractContentSafely(response, 'recovering');
              },
              ['recovering']
            );
          } catch (error) {
            // Expected failures
          }
        }

        // Wait for circuit breaker timeout and fix the provider
        await new Promise((resolve) => setTimeout(resolve, 6000)); // Wait for circuit breaker timeout
        recoveringProvider.setFailureRate(0); // Fix the provider

        // Should now succeed with recovering provider
        const result = await providerManager.executeWithFallback(
          async (provider, providerName) => {
            const response = await provider.generateDream('recovery test');
            return {
              content: extractContentSafely(response, providerName),
              provider: providerName,
            };
          }
        );

        expect(result.provider).toBe('recovering');
        expect(result.content).toBeTruthy();
      }, 10000); // Increase timeout for this test
    });

    describe('Load Balancing During Fallback', () => {
      test('should distribute load across healthy providers during partial failures', async () => {
        const provider1 = new MockCerebrasProvider({ failureRate: 0.5 }); // 50% failure
        const provider2 = new MockOpenAIProvider({ failureRate: 0.3 }); // 30% failure
        const provider3 = createMockProvider('llama', { failureRate: 0.1 }); // 10% failure

        providerManager.registerProvider('cerebras', provider1);
        providerManager.registerProvider('openai', provider2);
        providerManager.registerProvider('llama', provider3);

        const promises = [];
        const requestCount = 20;

        for (let i = 0; i < requestCount; i++) {
          promises.push(
            providerManager
              .executeWithFallback(async (provider, providerName) => {
                const response = await provider.generateDream(
                  `load balance test ${i}`
                );
                return {
                  content: extractContentSafely(response, providerName),
                  provider: providerName,
                };
              })
              .catch(() => ({ provider: 'failed', content: null }))
          );
        }

        const results = await Promise.all(promises);
        const successfulResults = results.filter(
          (r) => r.provider !== 'failed'
        );

        expect(successfulResults.length).toBeGreaterThan(requestCount * 0.7); // At least 70% success

        // Count distribution
        const providerCounts = {};
        successfulResults.forEach((result) => {
          providerCounts[result.provider] =
            (providerCounts[result.provider] || 0) + 1;
        });

        // Should use multiple providers
        expect(Object.keys(providerCounts).length).toBeGreaterThan(1);

        // Llama (most reliable) should get the most requests
        expect(providerCounts.llama || 0).toBeGreaterThan(0);
      });
    });

    describe('Complex Error Recovery Scenarios', () => {
      test('should handle mixed error types and recovery strategies', async () => {
        const timeoutProvider = new MockSlowProvider({ responseDelay: 8000 });
        const authFailProvider = new MockCerebrasProvider();
        const rateLimitProvider = new MockUnreliableProvider();
        const reliableProvider = new MockOpenAIProvider();

        // Configure specific error types
        authFailProvider.generateDream = async function () {
          const error = new Error('Unauthorized');
          error.status = 401;
          throw error;
        };

        let rateLimitAttempts = 0;
        rateLimitProvider.generateDream = async function () {
          rateLimitAttempts++;
          if (rateLimitAttempts <= 2) {
            const error = new Error('Rate limit exceeded');
            error.status = 429;
            throw error;
          }
          return { content: '{"recovered": true}' };
        };

        providerManager.registerProvider('timeout', timeoutProvider);
        providerManager.registerProvider('auth_fail', authFailProvider);
        providerManager.registerProvider('rate_limit', rateLimitProvider);
        providerManager.registerProvider('reliable', reliableProvider);

        const promises = [];
        for (let i = 0; i < 10; i++) {
          promises.push(
            providerManager.executeWithFallback(
              async (provider, providerName) => {
                const response = await provider.generateDream(
                  `mixed error test ${i}`
                );
                return {
                  content: extractContentSafely(response, providerName),
                  provider: providerName,
                };
              },
              null,
              { timeout: 5000 }
            )
          );
        }

        const results = await Promise.all(promises);

        // All requests should succeed (through fallback)
        expect(results.every((r) => r.content)).toBe(true);

        // Should primarily use reliable provider, with some rate_limit recovery
        const providerCounts = {};
        results.forEach((result) => {
          providerCounts[result.provider] =
            (providerCounts[result.provider] || 0) + 1;
        });

        expect(providerCounts.reliable).toBeGreaterThan(5);
        expect(providerCounts.timeout || 0).toBe(0); // Should timeout
        expect(providerCounts.auth_fail || 0).toBe(0); // Should not retry auth failures
      });
    });

    describe('Concurrent Request Handling with Fallback', () => {
      test('should handle high concurrent load with provider failures', async () => {
        const unreliableProvider1 = new MockUnreliableProvider({
          failureRate: 0.7,
        });
        const unreliableProvider2 = new MockUnreliableProvider({
          failureRate: 0.6,
        });
        const reliableProvider = new MockCerebrasProvider({
          responseDelay: 50,
        });

        providerManager.registerProvider('unreliable1', unreliableProvider1);
        providerManager.registerProvider('unreliable2', unreliableProvider2);
        providerManager.registerProvider('reliable', reliableProvider);

        const promises = [];
        const requestCount = 50;

        const startTime = Date.now();

        for (let i = 0; i < requestCount; i++) {
          promises.push(
            providerManager.executeWithFallback(
              async (provider, providerName) => {
                const response = await provider.generateDream(
                  `concurrent test ${i}`
                );
                return {
                  content: extractContentSafely(response, providerName),
                  provider: providerName,
                  requestId: i,
                };
              }
            )
          );
        }

        const results = await Promise.all(promises);
        const totalTime = Date.now() - startTime;

        // All requests should succeed
        expect(results).toHaveLength(requestCount);
        expect(results.every((r) => r.content)).toBe(true);

        // Should complete in reasonable time despite failures
        expect(totalTime).toBeLessThan(10000); // 10 seconds max

        // Most should come from reliable provider
        const reliableCount = results.filter(
          (r) => r.provider === 'reliable'
        ).length;
        expect(reliableCount).toBeGreaterThan(requestCount * 0.6); // At least 60%
      });
    });
  });

  describe('Health Monitoring Integration', () => {
    test('should track provider health during fallback scenarios', async () => {
      const healthyProvider = new MockCerebrasProvider();
      const unhealthyProvider = new MockFailingProvider();

      providerManager.registerProvider('healthy', healthyProvider);
      providerManager.registerProvider('unhealthy', unhealthyProvider);

      // Generate some requests to establish health metrics
      const promises = [];
      for (let i = 0; i < 5; i++) {
        promises.push(
          providerManager.executeWithFallback(
            async (provider, providerName) => {
              const response = await provider.generateDream(`health test ${i}`);
              return {
                content: extractContentSafely(response, providerName),
                provider: providerName,
              };
            }
          )
        );
      }

      const results = await Promise.all(promises);

      // Check health status
      const healthyStatus = providerManager.getProviderHealth('healthy');
      const unhealthyStatus = providerManager.getProviderHealth('unhealthy');

      expect(healthyStatus.isHealthy).toBe(true);
      expect(healthyStatus.metrics.successRate).toBeGreaterThan(0);

      expect(unhealthyStatus.isHealthy).toBe(false);
      expect(unhealthyStatus.consecutiveFailures).toBeGreaterThan(0);

      // All results should come from healthy provider
      expect(results.every((r) => r.provider === 'healthy')).toBe(true);
    });

    test('should provide comprehensive health summary', async () => {
      const provider1 = new MockCerebrasProvider();
      const provider2 = new MockOpenAIProvider();
      const provider3 = new MockFailingProvider();

      providerManager.registerProvider('cerebras', provider1);
      providerManager.registerProvider('openai', provider2);
      providerManager.registerProvider('failing', provider3);

      // Generate some activity
      for (let i = 0; i < 3; i++) {
        try {
          await providerManager.executeWithFallback(
            async (provider, providerName) => {
              const response = await provider.generateDream(
                `summary test ${i}`
              );
              return extractContentSafely(response, providerName);
            }
          );
        } catch (error) {
          // Some may fail, that's expected
        }
      }

      const healthSummary = providerManager.getProviderHealth();

      expect(healthSummary.summary.total).toBe(3);
      expect(healthSummary.summary.healthy).toBeGreaterThan(0);
      expect(healthSummary.summary.unhealthy).toBeGreaterThan(0);
      expect(healthSummary.providers.cerebras).toBeDefined();
      expect(healthSummary.providers.openai).toBeDefined();
      expect(healthSummary.providers.failing).toBeDefined();
    });
  });
});
