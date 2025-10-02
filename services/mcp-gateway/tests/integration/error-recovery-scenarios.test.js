// tests/integration/error-recovery-scenarios.test.js
// Integration tests for error recovery and provider switching scenarios
// Requirements: 1.4, 1.5, 5.2, 5.3

const ProviderManager = require('../../providers/ProviderManager');
const { extractContentSafely } = require('../../utils/responseParser');
const {
  MockCerebrasProvider,
  MockOpenAIProvider,
  MockFailingProvider,
  MockSlowProvider,
  MockUnreliableProvider,
} = require('../mocks/MockProviders');

describe('Error Recovery Scenarios Integration Tests', () => {
  let providerManager;

  beforeEach(() => {
    providerManager = new ProviderManager({
      enableEnhancedMonitoring: false,
      healthCheckInterval: 1000,
      maxRetryAttempts: 3,
      backoffMultiplier: 2,
      circuitBreakerThreshold: 3,
      circuitBreakerTimeout: 2000, // Shorter for tests
      enableProviderSwitching: true,
      preserveContext: true,
    });
  });

  afterEach(async () => {
    if (providerManager) {
      await providerManager.shutdown();
    }
  });

  describe('Response Parsing Error Recovery', () => {
    test('should recover from substring parsing errors', async () => {
      const problematicProvider = new MockCerebrasProvider();
      const backupProvider = new MockOpenAIProvider();

      // Override to return response that would cause substring error
      problematicProvider.generateDream = async function (
        prompt,
        options = {}
      ) {
        return {
          choices: [
            {
              message: {
                content: {
                  // This object would cause "substring is not a function" error
                  toString: () =>
                    JSON.stringify({
                      structures: [{ type: 'problematic' }],
                      entities: [],
                      cinematography: {},
                    }),
                },
              },
            },
          ],
        };
      };

      providerManager.registerProvider('problematic', problematicProvider);
      providerManager.registerProvider('backup', backupProvider);

      const result = await providerManager.executeWithFallback(
        async (provider, providerName) => {
          const response = await provider.generateDream('substring error test');
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

      // Should either handle the problematic response or fallback to backup
      expect(result).toBeTruthy();
      expect(result.content).toBeTruthy();
      expect(['problematic', 'backup']).toContain(result.provider);
    });

    test('should handle circular reference objects in responses', async () => {
      const circularProvider = new MockCerebrasProvider();
      const cleanProvider = new MockOpenAIProvider();

      // Override to return response with circular references
      circularProvider.generateDream = async function (prompt, options = {}) {
        const response = {
          choices: [
            {
              message: {
                content: JSON.stringify({
                  structures: [{ type: 'circular' }],
                  entities: [],
                  cinematography: {},
                }),
              },
            },
          ],
        };

        // Create circular reference
        response.self = response;
        response.choices[0].parent = response;

        return response;
      };

      providerManager.registerProvider('circular', circularProvider);
      providerManager.registerProvider('clean', cleanProvider);

      const result = await providerManager.executeWithFallback(
        async (provider, providerName) => {
          const response = await provider.generateDream(
            'circular reference test'
          );
          return {
            content: extractContentSafely(response, providerName),
            provider: providerName,
          };
        }
      );

      expect(result).toBeTruthy();
      expect(result.content).toBeTruthy();

      // Should handle circular references gracefully
      const parsed = JSON.parse(result.content);
      expect(parsed.structures[0].type).toBe('circular');
    });

    test('should recover from JSON parsing errors with fallback strategies', async () => {
      const malformedProvider = new MockCerebrasProvider();
      const validProvider = new MockOpenAIProvider();

      let attemptCount = 0;
      malformedProvider.generateDream = async function (prompt, options = {}) {
        attemptCount++;

        // Return progressively more malformed JSON
        const malformedResponses = [
          '{"structures": [{"type": "broken"', // Missing closing braces
          '{"structures": [{"type": "broken"}], "entities": [', // Incomplete array
          '{"structures": [{"type": "broken"}], "entities": [], "cinematography": {', // Incomplete object
        ];

        return {
          choices: [
            {
              message: {
                content:
                  malformedResponses[
                    Math.min(attemptCount - 1, malformedResponses.length - 1)
                  ],
              },
            },
          ],
        };
      };

      providerManager.registerProvider('malformed', malformedProvider);
      providerManager.registerProvider('valid', validProvider);

      const result = await providerManager.executeWithFallback(
        async (provider, providerName) => {
          const response = await provider.generateDream('malformed json test');
          const content = extractContentSafely(response, providerName);

          // Validate that we got valid JSON
          try {
            JSON.parse(content);
            return {
              content,
              provider: providerName,
              isValidJson: true,
            };
          } catch (jsonError) {
            // If JSON is invalid, throw error to trigger fallback
            throw new Error('Invalid JSON response');
          }
        }
      );

      expect(result).toBeTruthy();
      expect(result.isValidJson).toBe(true);
      // Should eventually succeed with valid provider
      expect(result.provider).toBe('valid');
    });
  });

  describe('Provider Health Recovery', () => {
    test('should detect and recover from provider health issues', async () => {
      const recoveringProvider = new MockUnreliableProvider({
        failureRate: 1.0,
      });
      const stableProvider = new MockCerebrasProvider();

      providerManager.registerProvider('recovering', recoveringProvider);
      providerManager.registerProvider('stable', stableProvider);

      // Initial requests should fail with recovering provider
      const initialResults = [];
      for (let i = 0; i < 3; i++) {
        const result = await providerManager.executeWithFallback(
          async (provider, providerName) => {
            const response = await provider.generateDream(`initial test ${i}`);
            return {
              content: extractContentSafely(response, providerName),
              provider: providerName,
            };
          }
        );
        initialResults.push(result);
      }

      // Should use stable provider
      expect(initialResults.every((r) => r.provider === 'stable')).toBe(true);

      // Fix the recovering provider
      recoveringProvider.setFailureRate(0);

      // Wait a bit for health to potentially recover
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // New requests should potentially use recovering provider again
      const recoveryResults = [];
      for (let i = 0; i < 5; i++) {
        const result = await providerManager.executeWithFallback(
          async (provider, providerName) => {
            const response = await provider.generateDream(`recovery test ${i}`);
            return {
              content: extractContentSafely(response, providerName),
              provider: providerName,
            };
          }
        );
        recoveryResults.push(result);
      }

      // Should use both providers now
      const providerCounts = {};
      recoveryResults.forEach((result) => {
        providerCounts[result.provider] =
          (providerCounts[result.provider] || 0) + 1;
      });

      expect(Object.keys(providerCounts).length).toBeGreaterThan(1);
    });

    test('should handle provider recovery during high load', async () => {
      const intermittentProvider = new MockUnreliableProvider({
        failureRate: 0.8,
      });
      const reliableProvider = new MockOpenAIProvider();

      providerManager.registerProvider('intermittent', intermittentProvider);
      providerManager.registerProvider('reliable', reliableProvider);

      // Generate high concurrent load
      const promises = [];
      const requestCount = 20;

      for (let i = 0; i < requestCount; i++) {
        promises.push(
          providerManager.executeWithFallback(
            async (provider, providerName) => {
              const response = await provider.generateDream(
                `high load test ${i}`
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

      // All requests should succeed
      expect(results).toHaveLength(requestCount);
      expect(results.every((r) => r.content)).toBe(true);

      // Should primarily use reliable provider
      const reliableCount = results.filter(
        (r) => r.provider === 'reliable'
      ).length;
      expect(reliableCount).toBeGreaterThan(requestCount * 0.7);
    });
  });

  describe('Context Preservation During Recovery', () => {
    test('should preserve request context during provider switching', async () => {
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
        return originalGenerate.call(this, prompt, options);
      };

      providerManager.registerProvider('fail', contextFailProvider);
      providerManager.registerProvider('success', contextSuccessProvider);

      const originalContext = {
        userId: 'test-user-123',
        sessionId: 'session-456',
        requestMetadata: {
          timestamp: Date.now(),
          source: 'integration-test',
        },
      };

      const result = await providerManager.executeWithFallback(
        async (provider, providerName, context) => {
          const response = await provider.generateDream(
            'context preservation test',
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
          context: originalContext,
        }
      );

      expect(result.provider).toBe('success');
      expect(capturedContext).toBeTruthy();
      expect(capturedContext.userId).toBe('test-user-123');
      expect(capturedContext.sessionId).toBe('session-456');
      expect(capturedContext.previousProvider).toBe('fail');
      expect(capturedContext.switchReason).toBeTruthy();
    });

    test('should maintain operation continuity across provider failures', async () => {
      const provider1 = new MockCerebrasProvider({ shouldFail: true });
      const provider2 = new MockOpenAIProvider({ shouldFail: true });
      const provider3 = new MockUnreliableProvider({ failureRate: 0 }); // Working provider

      providerManager.registerProvider('provider1', provider1);
      providerManager.registerProvider('provider2', provider2);
      providerManager.registerProvider('provider3', provider3);

      const operationId = 'operation-' + Date.now();
      let operationSteps = [];

      const result = await providerManager.executeWithFallback(
        async (provider, providerName, context) => {
          operationSteps.push({
            step: operationSteps.length + 1,
            provider: providerName,
            operationId: context?.operationId || operationId,
            timestamp: Date.now(),
          });

          const response = await provider.generateDream(
            'continuity test',
            {},
            context
          );
          return {
            content: extractContentSafely(response, providerName),
            provider: providerName,
            operationSteps,
          };
        },
        null,
        {
          preserveContext: true,
          context: { operationId },
        }
      );

      expect(result.provider).toBe('provider3');
      expect(result.operationSteps).toHaveLength(3); // Should have tried all 3 providers
      expect(
        result.operationSteps.every((step) => step.operationId === operationId)
      ).toBe(true);
    });
  });

  describe('Complex Error Scenarios', () => {
    test('should handle cascading provider failures', async () => {
      const provider1 = new MockSlowProvider({ responseDelay: 8000 }); // Timeout
      const provider2 = new MockCerebrasProvider();
      const provider3 = new MockOpenAIProvider();

      // Make provider2 fail after provider1 times out
      let provider1TimedOut = false;
      const originalProvider2Generate = provider2.generateDream;
      provider2.generateDream = async function (prompt, options, context) {
        if (provider1TimedOut) {
          throw new Error('Cascading failure from provider1 timeout');
        }
        return originalProvider2Generate.call(this, prompt, options);
      };

      providerManager.registerProvider('slow', provider1);
      providerManager.registerProvider('cascading', provider2);
      providerManager.registerProvider('stable', provider3);

      const startTime = Date.now();

      const result = await providerManager.executeWithFallback(
        async (provider, providerName, context) => {
          if (providerName === 'slow') {
            // Simulate timeout detection
            setTimeout(() => {
              provider1TimedOut = true;
            }, 5000);
          }

          const response = await provider.generateDream(
            'cascading failure test',
            {},
            context
          );
          return {
            content: extractContentSafely(response, providerName),
            provider: providerName,
          };
        },
        null,
        { timeout: 6000 }
      );

      const duration = Date.now() - startTime;

      expect(result.provider).toBe('stable');
      expect(duration).toBeLessThan(8000); // Should not wait for slow provider
    });

    test('should handle mixed synchronous and asynchronous errors', async () => {
      const syncErrorProvider = new MockCerebrasProvider();
      const asyncErrorProvider = new MockOpenAIProvider();
      const workingProvider = new MockUnreliableProvider({ failureRate: 0 });

      // Synchronous error
      syncErrorProvider.generateDream = function (prompt, options) {
        throw new Error('Synchronous error');
      };

      // Asynchronous error
      asyncErrorProvider.generateDream = async function (prompt, options) {
        await new Promise((resolve) => setTimeout(resolve, 100));
        throw new Error('Asynchronous error');
      };

      providerManager.registerProvider('sync_error', syncErrorProvider);
      providerManager.registerProvider('async_error', asyncErrorProvider);
      providerManager.registerProvider('working', workingProvider);

      const result = await providerManager.executeWithFallback(
        async (provider, providerName) => {
          const response = await provider.generateDream('mixed error test');
          return {
            content: extractContentSafely(response, providerName),
            provider: providerName,
          };
        }
      );

      expect(result.provider).toBe('working');
      expect(result.content).toBeTruthy();
    });

    test('should handle provider errors during response processing', async () => {
      const processingErrorProvider = new MockCerebrasProvider();
      const cleanProvider = new MockOpenAIProvider();

      // Override to return response that causes processing error
      processingErrorProvider.generateDream = async function (prompt, options) {
        return {
          choices: [
            {
              message: {
                get content() {
                  throw new Error('Error during content access');
                },
              },
            },
          ],
        };
      };

      providerManager.registerProvider(
        'processing_error',
        processingErrorProvider
      );
      providerManager.registerProvider('clean', cleanProvider);

      const result = await providerManager.executeWithFallback(
        async (provider, providerName) => {
          const response = await provider.generateDream(
            'processing error test'
          );
          const content = extractContentSafely(response, providerName);

          if (!content) {
            throw new Error('Failed to process response');
          }

          return {
            content,
            provider: providerName,
          };
        }
      );

      expect(result.provider).toBe('clean');
      expect(result.content).toBeTruthy();
    });
  });

  describe('Recovery Performance and Reliability', () => {
    test('should maintain acceptable performance during error recovery', async () => {
      const slowFailingProvider = new MockSlowProvider({
        responseDelay: 3000,
        shouldFail: true,
      });
      const fastWorkingProvider = new MockCerebrasProvider({
        responseDelay: 100,
      });

      providerManager.registerProvider('slow_failing', slowFailingProvider);
      providerManager.registerProvider('fast_working', fastWorkingProvider);

      const promises = [];
      const requestCount = 10;

      const startTime = Date.now();

      for (let i = 0; i < requestCount; i++) {
        promises.push(
          providerManager.executeWithFallback(
            async (provider, providerName) => {
              const response = await provider.generateDream(
                `performance test ${i}`
              );
              return {
                content: extractContentSafely(response, providerName),
                provider: providerName,
                requestId: i,
              };
            },
            null,
            { timeout: 2000 } // Short timeout to force quick fallback
          )
        );
      }

      const results = await Promise.all(promises);
      const totalTime = Date.now() - startTime;

      // All should succeed
      expect(results).toHaveLength(requestCount);
      expect(results.every((r) => r.content)).toBe(true);

      // Should complete quickly due to fast fallback
      expect(totalTime).toBeLessThan(5000); // 5 seconds max for 10 requests

      // Should use fast provider
      expect(results.every((r) => r.provider === 'fast_working')).toBe(true);
    });

    test('should handle error recovery under memory pressure', async () => {
      const memoryIntensiveProvider = new MockCerebrasProvider();
      const lightweightProvider = new MockOpenAIProvider();

      // Simulate memory-intensive operations that might fail
      memoryIntensiveProvider.generateDream = async function (prompt, options) {
        // Simulate memory pressure by creating large objects
        const largeData = new Array(100000).fill('memory-intensive-data');

        // Randomly fail due to "memory pressure"
        if (Math.random() < 0.7) {
          throw new Error('Out of memory');
        }

        return {
          choices: [
            {
              message: {
                content: JSON.stringify({
                  structures: [
                    { type: 'memory-intensive', data: largeData.slice(0, 10) },
                  ],
                  entities: [],
                  cinematography: {},
                }),
              },
            },
          ],
        };
      };

      providerManager.registerProvider(
        'memory_intensive',
        memoryIntensiveProvider
      );
      providerManager.registerProvider('lightweight', lightweightProvider);

      const promises = [];
      for (let i = 0; i < 15; i++) {
        promises.push(
          providerManager.executeWithFallback(
            async (provider, providerName) => {
              const response = await provider.generateDream(
                `memory pressure test ${i}`
              );
              return {
                content: extractContentSafely(response, providerName),
                provider: providerName,
              };
            }
          )
        );
      }

      const results = await Promise.all(promises);

      // All should succeed
      expect(results.every((r) => r.content)).toBe(true);

      // Should primarily use lightweight provider due to memory failures
      const lightweightCount = results.filter(
        (r) => r.provider === 'lightweight'
      ).length;
      expect(lightweightCount).toBeGreaterThan(results.length * 0.6);
    });
  });
});
