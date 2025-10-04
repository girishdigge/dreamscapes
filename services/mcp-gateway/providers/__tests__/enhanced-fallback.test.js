// Enhanced fallback and retry mechanisms test
const ProviderManager = require('../ProviderManager');

// Mock provider for testing
class MockProvider {
  constructor(name, behavior = {}) {
    this.name = name;
    this.behavior = behavior;
    this.callCount = 0;
  }

  async generateDream(prompt, options = {}) {
    this.callCount++;

    if (
      this.behavior.failUntilAttempt &&
      this.callCount < this.behavior.failUntilAttempt
    ) {
      const error = new Error(this.behavior.errorMessage || 'Mock failure');
      error.code = this.behavior.errorCode || 'MOCK_ERROR';
      throw error;
    }

    if (this.behavior.alwaysFail) {
      const error = new Error(this.behavior.errorMessage || 'Mock failure');
      error.code = this.behavior.errorCode || 'MOCK_ERROR';
      throw error;
    }

    // Simulate response time
    if (this.behavior.responseTime) {
      await new Promise((resolve) =>
        setTimeout(resolve, this.behavior.responseTime)
      );
    }

    return {
      success: true,
      data: {
        id: `dream-${this.name}-${this.callCount}`,
        title: `Test Dream from ${this.name}`,
        description: prompt,
      },
      tokens: {
        input: 100,
        output: 200,
        total: 300,
      },
    };
  }

  async testConnection() {
    if (this.behavior.connectionFails) {
      throw new Error('Connection test failed');
    }
    return { status: 'ok' };
  }
}

describe('Enhanced Fallback and Retry Mechanisms', () => {
  let providerManager;
  let mockProvider1, mockProvider2, mockProvider3;

  beforeEach(() => {
    providerManager = new ProviderManager({
      maxRetryAttempts: 3,
      backoffMultiplier: 2,
      circuitBreakerThreshold: 3,
      circuitBreakerTimeout: 5000,
      enableEnhancedMonitoring: false, // Disable for testing
    });

    mockProvider1 = new MockProvider('provider1');
    mockProvider2 = new MockProvider('provider2');
    mockProvider3 = new MockProvider('provider3');

    providerManager.registerProvider('provider1', mockProvider1, {
      priority: 3,
    });
    providerManager.registerProvider('provider2', mockProvider2, {
      priority: 2,
    });
    providerManager.registerProvider('provider3', mockProvider3, {
      priority: 1,
    });
  });

  afterEach(() => {
    providerManager.stopHealthMonitoring();
  });

  describe('Enhanced Exponential Backoff', () => {
    test('should use enhanced backoff with jitter for retries', async () => {
      mockProvider1.behavior = {
        failUntilAttempt: 3,
        errorMessage: 'Temporary failure',
      };

      const startTime = Date.now();

      const result = await providerManager.executeWithFallback(
        (provider) => provider.generateDream('test prompt'),
        ['provider1']
      );

      const totalTime = Date.now() - startTime;

      expect(result.success).toBe(true);
      expect(mockProvider1.callCount).toBe(3);
      // Should have some backoff delay (at least 1 second for 2 retries)
      expect(totalTime).toBeGreaterThan(1000);
    });

    test('should use different backoff times for different error types', async () => {
      // Test rate limit error (should have longer backoff)
      mockProvider1.behavior = {
        failUntilAttempt: 2,
        errorMessage: 'Rate limit exceeded',
        errorCode: 'RATE_LIMIT',
      };

      const startTime = Date.now();

      const result = await providerManager.executeWithFallback(
        (provider) => provider.generateDream('test prompt'),
        ['provider1']
      );

      const totalTime = Date.now() - startTime;

      expect(result.success).toBe(true);
      expect(mockProvider1.callCount).toBe(2);
      // Rate limit errors should have longer backoff
      expect(totalTime).toBeGreaterThan(500);
    });
  });

  describe('Enhanced Circuit Breaker', () => {
    test('should open circuit breaker after threshold failures', async () => {
      mockProvider1.behavior = {
        alwaysFail: true,
        errorMessage: 'Persistent failure',
      };

      // Make enough requests to trip the circuit breaker
      for (let i = 0; i < 4; i++) {
        try {
          await providerManager.executeWithFallback(
            (provider) => provider.generateDream('test prompt'),
            ['provider1'],
            { maxAttempts: 1 }
          );
        } catch (error) {
          // Expected to fail
        }
      }

      const circuitBreakerStatus = providerManager.getCircuitBreakerStatus();
      expect(circuitBreakerStatus.provider1.state).toBe('OPEN');
      expect(
        circuitBreakerStatus.provider1.consecutiveFailures
      ).toBeGreaterThanOrEqual(3);
    });

    test('should transition to half-open after timeout', async () => {
      mockProvider1.behavior = {
        alwaysFail: true,
        errorMessage: 'Persistent failure',
      };

      // Trip the circuit breaker
      for (let i = 0; i < 4; i++) {
        try {
          await providerManager.executeWithFallback(
            (provider) => provider.generateDream('test prompt'),
            ['provider1'],
            { maxAttempts: 1 }
          );
        } catch (error) {
          // Expected to fail
        }
      }

      expect(providerManager.getCircuitBreakerStatus().provider1.state).toBe(
        'OPEN'
      );

      // Wait for circuit breaker timeout (using shorter timeout for test)
      providerManager.circuitBreakers.get('provider1').timeout = 100;
      await new Promise((resolve) => setTimeout(resolve, 150));

      // Next request should transition to half-open
      mockProvider1.behavior = { alwaysFail: false }; // Allow success

      const result = await providerManager.executeWithFallback(
        (provider) => provider.generateDream('test prompt'),
        ['provider1']
      );

      expect(result.success).toBe(true);
      expect(providerManager.getCircuitBreakerStatus().provider1.state).toBe(
        'CLOSED'
      );
    });

    test('should reset circuit breaker manually', async () => {
      mockProvider1.behavior = {
        alwaysFail: true,
        errorMessage: 'Persistent failure',
      };

      // Trip the circuit breaker
      for (let i = 0; i < 4; i++) {
        try {
          await providerManager.executeWithFallback(
            (provider) => provider.generateDream('test prompt'),
            ['provider1'],
            { maxAttempts: 1 }
          );
        } catch (error) {
          // Expected to fail
        }
      }

      expect(providerManager.getCircuitBreakerStatus().provider1.state).toBe(
        'OPEN'
      );

      // Reset circuit breaker
      providerManager.resetCircuitBreaker('provider1');

      expect(providerManager.getCircuitBreakerStatus().provider1.state).toBe(
        'CLOSED'
      );
      expect(
        providerManager.getCircuitBreakerStatus().provider1.consecutiveFailures
      ).toBe(0);
    });
  });

  describe('Context Preservation', () => {
    test('should preserve context when switching providers', async () => {
      mockProvider1.behavior = {
        alwaysFail: true,
        errorMessage: 'Provider 1 failure',
      };
      mockProvider2.behavior = { alwaysFail: false }; // Will succeed

      let capturedContext = null;

      const result = await providerManager.executeWithFallback(
        (provider, providerName, context) => {
          if (providerName === 'provider2') {
            capturedContext = context;
          }
          return provider.generateDream('test prompt');
        },
        ['provider1', 'provider2'],
        {
          context: { originalRequest: 'test data' },
          preserveContext: true,
        }
      );

      expect(result.success).toBe(true);
      expect(capturedContext).toBeDefined();
      expect(capturedContext.originalRequest).toBe('test data');
      expect(capturedContext.previousProvider).toBeDefined();
      expect(capturedContext.switchReason).toBeDefined();
      expect(capturedContext.attemptNumber).toBeGreaterThan(1);
    });

    test('should track failure history for context', async () => {
      mockProvider1.behavior = {
        failUntilAttempt: 3,
        errorMessage: 'Temporary failure',
        errorCode: 'TIMEOUT',
      };

      await providerManager.executeWithFallback(
        (provider) => provider.generateDream('test prompt'),
        ['provider1']
      );

      const failureHistory =
        providerManager.getRecentFailureHistory('provider1');
      expect(failureHistory.length).toBe(2); // 2 failures before success
      expect(failureHistory[0].errorType).toBe('timeout');
      expect(failureHistory[0].attempt).toBeDefined();
    });
  });

  describe('Intelligent Provider Selection', () => {
    test('should order providers by priority and recent performance', async () => {
      // Make provider1 fail a few times to lower its score
      mockProvider1.behavior = {
        failUntilAttempt: 2,
        errorMessage: 'Temporary failure',
      };

      try {
        await providerManager.executeWithFallback(
          (provider) => provider.generateDream('test prompt'),
          ['provider1'],
          { maxAttempts: 1 }
        );
      } catch (error) {
        // Expected to fail
      }

      // Now test provider selection
      const fallbackList =
        await providerManager.getEnhancedProviderFallbackList();

      // Should still prioritize by configured priority, but adjust for recent failures
      expect(fallbackList.length).toBeGreaterThan(0);
      expect(fallbackList[0].name).toBeDefined();
      expect(fallbackList[0].priority).toBeDefined();
      expect(fallbackList[0].maxRetries).toBeDefined();
    });

    test('should adjust retry limits based on recent performance', async () => {
      // Make provider1 fail multiple times
      mockProvider1.behavior = {
        alwaysFail: true,
        errorMessage: 'Persistent failure',
      };

      for (let i = 0; i < 6; i++) {
        try {
          await providerManager.executeWithFallback(
            (provider) => provider.generateDream('test prompt'),
            ['provider1'],
            { maxAttempts: 1 }
          );
        } catch (error) {
          // Expected to fail
        }
      }

      const maxRetries = providerManager.getProviderMaxRetries('provider1');
      const baseRetries = providerManager.config.maxRetryAttempts;

      // Should reduce retries for problematic provider
      expect(maxRetries).toBeLessThan(baseRetries);
    });
  });

  describe('Error Classification and Handling', () => {
    test('should classify error severity correctly', async () => {
      const testCases = [
        { message: 'Authentication failed', expectedSeverity: 'critical' },
        { message: 'Rate limit exceeded', expectedSeverity: 'high' },
        { message: 'Connection timeout', expectedSeverity: 'low' },
        { message: 'Unknown error', expectedSeverity: 'medium' },
      ];

      for (const testCase of testCases) {
        const error = new Error(testCase.message);
        const severity = providerManager.classifyErrorSeverity(error);
        expect(severity).toBe(testCase.expectedSeverity);
      }
    });

    test('should not retry critical errors', async () => {
      mockProvider1.behavior = {
        alwaysFail: true,
        errorMessage: 'Authentication failed',
        errorCode: 'AUTH_ERROR',
      };

      try {
        await providerManager.executeWithFallback(
          (provider) => provider.generateDream('test prompt'),
          ['provider1']
        );
      } catch (error) {
        expect(error.message).toContain('Authentication failed');
      }

      // Should not have retried due to critical error
      expect(mockProvider1.callCount).toBe(1);
    });
  });

  describe('Comprehensive Failure Reporting', () => {
    test('should generate detailed failure report', async () => {
      mockProvider1.behavior = {
        alwaysFail: true,
        errorMessage: 'Provider 1 failure',
      };
      mockProvider2.behavior = {
        alwaysFail: true,
        errorMessage: 'Provider 2 failure',
      };
      mockProvider3.behavior = {
        alwaysFail: true,
        errorMessage: 'Provider 3 failure',
      };

      try {
        await providerManager.executeWithFallback(
          (provider) => provider.generateDream('test prompt'),
          ['provider1', 'provider2', 'provider3']
        );
      } catch (error) {
        expect(error.message).toContain('All providers failed');
        expect(error.message).toContain('attempts');
        expect(error.message).toContain('Provider 3 failure'); // Last error
      }

      const stats = providerManager.getFallbackStatistics();
      expect(stats.providers.provider1.metrics.failures).toBeGreaterThan(0);
      expect(stats.providers.provider2.metrics.failures).toBeGreaterThan(0);
      expect(stats.providers.provider3.metrics.failures).toBeGreaterThan(0);
    });
  });
});
