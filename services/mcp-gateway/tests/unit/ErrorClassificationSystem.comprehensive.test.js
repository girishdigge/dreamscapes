// services/mcp-gateway/tests/unit/ErrorClassificationSystem.comprehensive.test.js
// Comprehensive unit tests for ErrorClassificationSystem covering all requirements

const ErrorClassificationSystem = require('../../utils/ErrorClassificationSystem');

describe('ErrorClassificationSystem - Comprehensive Tests', () => {
  let classifier;

  beforeEach(() => {
    classifier = new ErrorClassificationSystem({
      maxRetryAttempts: 3,
      exponentialBackoffBase: 1000,
      circuitBreakerThreshold: 5,
      criticalErrorThreshold: 5,
      highSeverityResponseTime: 10000,
      mediumSeverityResponseTime: 5000,
      enableProviderSwitching: true,
      enableFallbackGeneration: true,
    });
  });

  describe('Error Classification and Recovery Strategies (Requirement 4.1, 5.1)', () => {
    describe('Response Parsing Error Classification', () => {
      test('should classify substring error correctly', () => {
        const error = new Error('response?.substring is not a function');
        const context = {
          provider: 'cerebras',
          operation: 'generateDream',
          responseData: { content: 'some content' },
        };

        const classification = classifier.classifyError(error, context);

        expect(classification.type).toBe('response_parsing');
        expect(classification.severity).toBe('high');
        expect(classification.recoverable).toBe(true);
        expect(classification.retryable).toBe(true);
        expect(classification.recoveryStrategy.actions).toHaveLength(2);
        expect(classification.recoveryStrategy.actions[0].type).toBe(
          'enhance_parsing'
        );
        expect(classification.recoveryStrategy.actions[1].type).toBe(
          'switch_provider'
        );
      });

      test('should classify property access errors correctly', () => {
        const errors = [
          "Cannot read property 'content' of undefined",
          "Cannot read properties of undefined (reading 'content')",
          "Cannot read property 'substring' of null",
        ];

        errors.forEach((errorMessage) => {
          const error = new Error(errorMessage);
          const context = { provider: 'openai', operation: 'generateDream' };

          const classification = classifier.classifyError(error, context);

          expect(classification.type).toBe('response_parsing');
          expect(classification.severity).toBe('high');
          expect(classification.recoverable).toBe(true);
          expect(classification.retryable).toBe(true);
        });
      });

      test('should classify JSON parsing errors correctly', () => {
        const error = new Error('Unexpected token } in JSON at position 45');
        error.name = 'SyntaxError';
        const context = {
          provider: 'cerebras',
          operation: 'generateDream',
          originalResponse: '{"invalid": json}',
        };

        const classification = classifier.classifyError(error, context);

        expect(classification.type).toBe('response_parsing');
        expect(classification.severity).toBe('high');
        expect(classification.recoverable).toBe(true);
      });

      test('should generate appropriate recovery strategy for parsing errors', () => {
        const error = new Error('response?.substring is not a function');
        const context = {
          provider: 'cerebras',
          operation: 'generateDream',
          attemptNumber: 1,
        };

        const classification = classifier.classifyError(error, context);

        expect(classification.recoveryStrategy.actions).toHaveLength(2);
        expect(classification.recoveryStrategy.actions[0]).toEqual({
          type: 'enhance_parsing',
          description:
            'Apply enhanced response parsing with multiple strategies',
          timeout: 5000,
        });
        expect(classification.recoveryStrategy.actions[1]).toEqual({
          type: 'switch_provider',
          description: 'Switch to alternative provider',
          timeout: 10000,
        });
        expect(classification.recoveryStrategy.priority).toBe(2); // high severity
      });
    });

    describe('Provider Method Error Classification', () => {
      test('should classify getProviderHealth error correctly', () => {
        const error = new Error(
          'this.providerManager.getProviderHealth is not a function'
        );
        const context = {
          provider: 'system',
          operation: 'healthCheck',
          requestId: 'req-123',
        };

        const classification = classifier.classifyError(error, context);

        expect(classification.type).toBe('provider_method');
        expect(classification.severity).toBe('critical');
        expect(classification.recoverable).toBe(false);
        expect(classification.retryable).toBe(false);
        expect(classification.recoveryStrategy.actions).toHaveLength(1);
        expect(classification.recoveryStrategy.actions[0].type).toBe(
          'implement_method'
        );
      });

      test('should classify other method errors correctly', () => {
        const methodErrors = [
          'this.provider.generateDream is not a function',
          'undefined method called',
          'provider.testConnection is not a function',
        ];

        methodErrors.forEach((errorMessage) => {
          const error = new Error(errorMessage);
          const context = { provider: 'test', operation: 'test' };

          const classification = classifier.classifyError(error, context);

          // Some method errors may be classified differently based on the specific message
          if (errorMessage.includes('is not a function')) {
            expect(classification.type).toBe('provider_method');
          } else {
            expect(['provider_method', 'unknown']).toContain(
              classification.type
            );
          }
          expect(classification.recoverable).toBe(false);
          expect(classification.retryable).toBe(false);
        });
      });
    });

    describe('Network Error Classification', () => {
      test('should classify connection errors correctly', () => {
        const networkErrors = [
          { message: 'Connection refused', code: 'ECONNREFUSED' },
          { message: 'Host not found', code: 'ENOTFOUND' },
          { message: 'Connection reset', code: 'ECONNRESET' },
          { message: 'Network timeout', code: 'ETIMEDOUT' },
          { message: 'Network error occurred' },
        ];

        networkErrors.forEach(({ message, code }) => {
          const error = new Error(message);
          if (code) error.code = code;
          const context = {
            provider: 'openai',
            operation: 'generateDream',
            attemptNumber: 1,
          };

          const classification = classifier.classifyError(error, context);

          expect(classification.type).toBe('network_error');
          expect(classification.severity).toBe('medium');
          expect(classification.recoverable).toBe(true);
          expect(classification.retryable).toBe(true);
        });
      });

      test('should generate retry strategy for network errors', () => {
        const error = new Error('Connection refused');
        error.code = 'ECONNREFUSED';
        const context = {
          provider: 'cerebras',
          operation: 'generateDream',
          attemptNumber: 2,
        };

        const classification = classifier.classifyError(error, context);

        expect(classification.recoveryStrategy.actions).toHaveLength(1);
        expect(classification.recoveryStrategy.actions[0]).toEqual({
          type: 'exponential_backoff_retry',
          description: 'Retry with exponential backoff',
          timeout: 2000, // 1000 * 2^(2-1)
          maxAttempts: 3,
        });
      });
    });

    describe('Timeout Error Classification', () => {
      test('should classify timeout errors correctly', () => {
        const timeoutErrors = [
          { message: 'Request timed out', name: 'TimeoutError' },
          { message: 'Operation timeout', code: 'ETIMEDOUT' },
          { message: 'Connection timed out' },
        ];

        timeoutErrors.forEach(({ message, name, code }) => {
          const error = new Error(message);
          if (name) error.name = name;
          if (code) error.code = code;
          const context = {
            provider: 'openai',
            operation: 'generateDream',
            responseTime: 15000,
          };

          const classification = classifier.classifyError(error, context);

          expect(classification.type).toBe('timeout');
          expect(classification.severity).toBe('medium');
          expect(classification.recoverable).toBe(true);
          expect(classification.retryable).toBe(true);
        });
      });
    });

    describe('Rate Limit Error Classification', () => {
      test('should classify rate limit errors correctly', () => {
        const rateLimitErrors = [
          { message: 'Too many requests', status: 429 },
          { message: 'Rate limit exceeded' },
          { message: 'API quota exceeded' },
        ];

        rateLimitErrors.forEach(({ message, status }) => {
          const error = new Error(message);
          if (status) error.status = status;
          const context = {
            provider: 'openai',
            operation: 'generateDream',
            responseHeaders: { 'retry-after': '60' },
          };

          const classification = classifier.classifyError(error, context);

          expect(classification.type).toBe('rate_limit');
          expect(classification.severity).toBe('medium');
          expect(classification.recoverable).toBe(true);
          expect(classification.retryable).toBe(true);
        });
      });

      test('should generate rate limit backoff strategy', () => {
        const error = new Error('Too many requests');
        error.status = 429;
        const context = {
          provider: 'openai',
          operation: 'generateDream',
          responseHeaders: { 'retry-after': '120' },
        };

        const classification = classifier.classifyError(error, context);

        expect(classification.recoveryStrategy.actions).toHaveLength(1);
        expect(classification.recoveryStrategy.actions[0]).toEqual({
          type: 'rate_limit_backoff',
          description: 'Wait for rate limit reset',
          timeout: 120000, // 120 seconds in milliseconds
        });
      });

      test('should use default timeout when retry-after header missing', () => {
        const error = new Error('Rate limit exceeded');
        const context = {
          provider: 'cerebras',
          operation: 'generateDream',
        };

        const classification = classifier.classifyError(error, context);

        expect(classification.recoveryStrategy.actions[0].timeout).toBe(60000); // Default 60 seconds
      });
    });

    describe('Authentication Error Classification', () => {
      test('should classify authentication errors correctly', () => {
        const authErrors = [
          { message: 'Invalid API key', status: 401 },
          { message: 'Unauthorized access', status: 401 },
          { message: 'Forbidden', status: 403 },
          { message: 'Authentication failed' },
        ];

        authErrors.forEach(({ message, status }) => {
          const error = new Error(message);
          if (status) error.status = status;
          const context = { provider: 'openai', operation: 'generateDream' };

          const classification = classifier.classifyError(error, context);

          expect(classification.type).toBe('authentication');
          expect(classification.severity).toBe('high');
          expect(classification.recoverable).toBe(false);
          expect(classification.retryable).toBe(false);
        });
      });

      test('should generate credential refresh strategy for auth errors', () => {
        const error = new Error('Invalid API key');
        error.status = 401;
        const context = { provider: 'openai', operation: 'generateDream' };

        const classification = classifier.classifyError(error, context);

        expect(classification.recoveryStrategy.actions).toHaveLength(1);
        expect(classification.recoveryStrategy.actions[0]).toEqual({
          type: 'refresh_credentials',
          description: 'Attempt to refresh authentication credentials',
          timeout: 5000,
        });
      });
    });

    describe('Provider Error Classification', () => {
      test('should classify server errors correctly', () => {
        const serverErrors = [500, 502, 503, 504, 599];

        serverErrors.forEach((status) => {
          const error = new Error('Internal server error');
          error.status = status;
          const context = {
            provider: 'cerebras',
            operation: 'generateDream',
            responseTime: 3000,
          };

          const classification = classifier.classifyError(error, context);

          expect(classification.type).toBe('provider_error');
          expect(classification.severity).toBe('medium');
          expect(classification.recoverable).toBe(true);
          expect(classification.retryable).toBe(true);
        });
      });

      test('should generate provider switching strategy for server errors', () => {
        const error = new Error('Service unavailable');
        error.status = 503;
        const context = {
          provider: 'cerebras',
          operation: 'generateDream',
          attemptNumber: 1,
        };

        const classification = classifier.classifyError(error, context);

        expect(classification.recoveryStrategy.actions).toHaveLength(2);
        expect(classification.recoveryStrategy.actions[0].type).toBe(
          'switch_provider'
        );
        expect(classification.recoveryStrategy.actions[1].type).toBe(
          'retry_with_backoff'
        );
      });
    });

    describe('Configuration Error Classification', () => {
      test('should classify configuration errors correctly', () => {
        const configErrors = [
          'Missing API key configuration',
          'Invalid configuration provided',
          'Required config parameter missing',
        ];

        configErrors.forEach((message) => {
          const error = new Error(message);
          const context = { provider: 'openai', operation: 'initialize' };

          const classification = classifier.classifyError(error, context);

          expect(classification.type).toBe('configuration');
          expect(classification.severity).toBe('critical');
          expect(classification.recoverable).toBe(false);
          expect(classification.retryable).toBe(false);
        });
      });

      test('should generate config validation strategy', () => {
        const error = new Error('Missing required configuration');
        const context = { provider: 'cerebras', operation: 'initialize' };

        const classification = classifier.classifyError(error, context);

        expect(classification.recoveryStrategy.actions).toHaveLength(1);
        expect(classification.recoveryStrategy.actions[0]).toEqual({
          type: 'validate_config',
          description: 'Validate and repair configuration',
          timeout: 2000,
        });
      });
    });
  });

  describe('Severity Assessment (Requirement 4.1)', () => {
    describe('Critical Severity Conditions', () => {
      test('should assess critical severity for system-breaking errors', () => {
        const error = new Error(
          'this.providerManager.getProviderHealth is not a function'
        );
        const context = { provider: 'system', operation: 'healthCheck' };

        const classification = classifier.classifyError(error, context);

        expect(classification.severity).toBe('critical');
        expect(classification.recoveryStrategy.priority).toBe(1);
      });

      test('should assess critical severity when all providers fail', () => {
        const error = new Error('Provider error');
        const context = {
          provider: 'openai',
          operation: 'generateDream',
          allProvidersFailed: true,
        };

        const classification = classifier.classifyError(error, context);

        expect(classification.severity).toBe('critical');
      });

      test('should assess critical severity for consecutive failures exceeding threshold', () => {
        const error = new Error('Provider error');
        const context = {
          provider: 'cerebras',
          operation: 'generateDream',
          consecutiveFailures: 6, // Exceeds threshold of 5
        };

        const classification = classifier.classifyError(error, context);

        expect(classification.severity).toBe('critical');
      });

      test('should assess critical severity for critical configuration errors', () => {
        const error = new Error('Missing required API key');
        const context = { provider: 'openai', operation: 'initialize' };

        const classification = classifier.classifyError(error, context);

        expect(classification.severity).toBe('critical');
      });
    });

    describe('High Severity Conditions', () => {
      test('should assess high severity for response parsing errors', () => {
        const error = new Error('Cannot read property of undefined');
        const context = { provider: 'cerebras', operation: 'generateDream' };

        const classification = classifier.classifyError(error, context);

        expect(classification.severity).toBe('high');
      });

      test('should assess high severity for provider errors with high response time', () => {
        const error = new Error('Internal server error');
        error.status = 500;
        const context = {
          provider: 'openai',
          operation: 'generateDream',
          responseTime: 12000, // Exceeds highSeverityResponseTime
        };

        const classification = classifier.classifyError(error, context);

        expect(classification.severity).toBe('high');
      });

      test('should assess high severity for authentication failures', () => {
        const error = new Error('Invalid credentials');
        error.status = 401;
        const context = { provider: 'openai', operation: 'generateDream' };

        const classification = classifier.classifyError(error, context);

        expect(classification.severity).toBe('high');
      });

      test('should assess high severity for multiple consecutive failures', () => {
        const error = new Error('Network error');
        const context = {
          provider: 'cerebras',
          operation: 'generateDream',
          consecutiveFailures: 3,
        };

        const classification = classifier.classifyError(error, context);

        expect(classification.severity).toBe('high');
      });
    });

    describe('Medium Severity Conditions', () => {
      test('should assess medium severity for network errors', () => {
        const error = new Error('Connection failed');
        error.code = 'ECONNREFUSED';
        const context = { provider: 'openai', operation: 'generateDream' };

        const classification = classifier.classifyError(error, context);

        expect(classification.severity).toBe('medium');
      });

      test('should assess medium severity for timeout errors', () => {
        const error = new Error('Request timed out');
        error.name = 'TimeoutError';
        const context = { provider: 'cerebras', operation: 'generateDream' };

        const classification = classifier.classifyError(error, context);

        expect(classification.severity).toBe('medium');
      });

      test('should assess medium severity for rate limiting', () => {
        const error = new Error('Too many requests');
        error.status = 429;
        const context = { provider: 'openai', operation: 'generateDream' };

        const classification = classifier.classifyError(error, context);

        expect(classification.severity).toBe('medium');
      });
    });

    describe('Low Severity Conditions', () => {
      test('should assess low severity for validation errors', () => {
        const error = new Error('Invalid request format');
        error.status = 400;
        const context = { provider: 'cerebras', operation: 'generateDream' };

        const classification = classifier.classifyError(error, context);

        expect(classification.severity).toBe('low');
      });

      test('should assess low severity for unknown errors', () => {
        const error = new Error('Some unknown error');
        const context = { provider: 'unknown', operation: 'unknown' };

        const classification = classifier.classifyError(error, context);

        expect(classification.severity).toBe('low');
      });
    });
  });

  describe('Recovery Strategy Generation (Requirement 5.1)', () => {
    describe('Strategy Priority and Timing', () => {
      test('should assign correct priority based on severity', () => {
        const severityTests = [
          { severity: 'critical', expectedPriority: 1 },
          { severity: 'high', expectedPriority: 2 },
          { severity: 'medium', expectedPriority: 3 },
          { severity: 'low', expectedPriority: 4 },
        ];

        severityTests.forEach(({ severity, expectedPriority }) => {
          const priority = classifier.getStrategyPriority(severity);
          expect(priority).toBe(expectedPriority);
        });
      });

      test('should estimate recovery time based on error type and severity', () => {
        const estimates = [
          { type: 'response_parsing', severity: 'high', expected: 7500 }, // 5000 * 1.5
          { type: 'network_error', severity: 'medium', expected: 10000 }, // 10000 * 1
          { type: 'rate_limit', severity: 'critical', expected: 120000 }, // 60000 * 2
          { type: 'unknown', severity: 'low', expected: 5000 }, // 10000 * 0.5
        ];

        estimates.forEach(({ type, severity, expected }) => {
          const estimate = classifier.estimateRecoveryTime(type, severity);
          expect(estimate).toBe(expected);
        });
      });
    });

    describe('Fallback Options', () => {
      test('should include fallback options for critical errors', () => {
        const error = new Error(
          'this.providerManager.getProviderHealth is not a function'
        );
        const context = { provider: 'system', operation: 'healthCheck' };

        const classification = classifier.classifyError(error, context);

        expect(
          classification.recoveryStrategy.fallbackOptions.length
        ).toBeGreaterThan(0);
        expect(classification.recoveryStrategy.fallbackOptions[0]).toEqual({
          type: 'provider_fallback',
          description: 'Use alternative provider',
          priority: 1,
        });
        expect(classification.recoveryStrategy.fallbackOptions[1]).toEqual({
          type: 'local_fallback',
          description: 'Use local fallback generation',
          priority: 2,
        });
      });

      test('should include fallback options for high severity errors', () => {
        const error = new Error('response?.substring is not a function');
        const context = { provider: 'cerebras', operation: 'generateDream' };

        const classification = classifier.classifyError(error, context);

        expect(
          classification.recoveryStrategy.fallbackOptions.length
        ).toBeGreaterThan(0);
      });

      test('should not include fallback options for low severity errors', () => {
        const error = new Error('Validation error');
        error.status = 400;
        const context = { provider: 'cerebras', operation: 'generateDream' };

        const classification = classifier.classifyError(error, context);

        expect(classification.recoveryStrategy.fallbackOptions).toHaveLength(0);
      });
    });

    describe('Circuit Breaker Integration', () => {
      test('should add circuit breaker action for repeated failures', () => {
        const error = new Error('Provider error');
        const context = {
          provider: 'cerebras',
          operation: 'generateDream',
          consecutiveFailures: 5, // Equals threshold
        };

        const classification = classifier.classifyError(error, context);

        expect(classification.recoveryStrategy.actions[0]).toEqual({
          type: 'circuit_breaker',
          description: 'Activate circuit breaker for provider',
          timeout: 1000,
        });
      });

      test('should not add circuit breaker action for low failure count', () => {
        const error = new Error('Provider error');
        const context = {
          provider: 'cerebras',
          operation: 'generateDream',
          consecutiveFailures: 2, // Below threshold
        };

        const classification = classifier.classifyError(error, context);

        const circuitBreakerActions =
          classification.recoveryStrategy.actions.filter(
            (action) => action.type === 'circuit_breaker'
          );
        expect(circuitBreakerActions).toHaveLength(0);
      });
    });
  });

  describe('Retryability Assessment', () => {
    describe('Non-Retryable Conditions', () => {
      test('should mark configuration errors as non-retryable', () => {
        const error = new Error('Missing API key');
        const context = { provider: 'openai', operation: 'initialize' };

        const classification = classifier.classifyError(error, context);

        expect(classification.retryable).toBe(false);
      });

      test('should mark authentication errors as non-retryable', () => {
        const error = new Error('Invalid credentials');
        error.status = 401;
        const context = { provider: 'openai', operation: 'generateDream' };

        const classification = classifier.classifyError(error, context);

        expect(classification.retryable).toBe(false);
      });

      test('should mark validation errors as non-retryable', () => {
        const error = new Error('Invalid request format');
        error.status = 400;
        const context = { provider: 'cerebras', operation: 'generateDream' };

        const classification = classifier.classifyError(error, context);

        expect(classification.retryable).toBe(false);
      });

      test('should mark provider method errors as non-retryable', () => {
        const error = new Error('this.provider.method is not a function');
        const context = { provider: 'test', operation: 'test' };

        const classification = classifier.classifyError(error, context);

        expect(classification.retryable).toBe(false);
      });

      test('should mark errors as non-retryable when max attempts exceeded', () => {
        const error = new Error('Network error');
        error.code = 'ECONNREFUSED';
        const context = {
          provider: 'openai',
          operation: 'generateDream',
          attemptNumber: 4, // Exceeds maxRetryAttempts of 3
        };

        const classification = classifier.classifyError(error, context);

        expect(classification.retryable).toBe(false);
      });
    });

    describe('Retryable Conditions', () => {
      test('should mark network errors as retryable', () => {
        const error = new Error('Connection failed');
        error.code = 'ECONNREFUSED';
        const context = {
          provider: 'openai',
          operation: 'generateDream',
          attemptNumber: 1,
        };

        const classification = classifier.classifyError(error, context);

        expect(classification.retryable).toBe(true);
      });

      test('should mark timeout errors as retryable', () => {
        const error = new Error('Request timed out');
        error.name = 'TimeoutError';
        const context = {
          provider: 'cerebras',
          operation: 'generateDream',
          attemptNumber: 2,
        };

        const classification = classifier.classifyError(error, context);

        expect(classification.retryable).toBe(true);
      });

      test('should mark rate limit errors as retryable', () => {
        const error = new Error('Too many requests');
        error.status = 429;
        const context = {
          provider: 'openai',
          operation: 'generateDream',
          attemptNumber: 1,
        };

        const classification = classifier.classifyError(error, context);

        expect(classification.retryable).toBe(true);
      });

      test('should mark provider errors as retryable', () => {
        const error = new Error('Internal server error');
        error.status = 500;
        const context = {
          provider: 'cerebras',
          operation: 'generateDream',
          attemptNumber: 1,
        };

        const classification = classifier.classifyError(error, context);

        expect(classification.retryable).toBe(true);
      });

      test('should mark response parsing errors as retryable', () => {
        const error = new Error('response?.substring is not a function');
        const context = {
          provider: 'cerebras',
          operation: 'generateDream',
          attemptNumber: 1,
        };

        const classification = classifier.classifyError(error, context);

        expect(classification.retryable).toBe(true);
      });

      test('should mark unknown errors as retryable by default', () => {
        const error = new Error('Some unknown error');
        const context = {
          provider: 'unknown',
          operation: 'unknown',
          attemptNumber: 1,
        };

        const classification = classifier.classifyError(error, context);

        expect(classification.retryable).toBe(true);
      });
    });
  });

  describe('Backoff Calculation', () => {
    test('should calculate exponential backoff correctly', () => {
      const testCases = [
        { attempt: 1, expected: 1000 }, // 1000 * 2^0
        { attempt: 2, expected: 2000 }, // 1000 * 2^1
        { attempt: 3, expected: 4000 }, // 1000 * 2^2
        { attempt: 4, expected: 8000 }, // 1000 * 2^3
        { attempt: 5, expected: 16000 }, // 1000 * 2^4
      ];

      testCases.forEach(({ attempt, expected }) => {
        const backoff = classifier.calculateBackoffTime(attempt);
        expect(backoff).toBe(expected);
      });
    });

    test('should cap backoff time at maximum', () => {
      const longBackoff = classifier.calculateBackoffTime(10);
      expect(longBackoff).toBe(30000); // Capped at 30 seconds
    });

    test('should handle edge cases in backoff calculation', () => {
      expect(classifier.calculateBackoffTime(0)).toBe(500); // 1000 * 2^(-1)
      expect(classifier.calculateBackoffTime(-1)).toBe(250); // 1000 * 2^(-2)
    });
  });

  describe('Context Sanitization', () => {
    test('should remove sensitive information from context', () => {
      const error = new Error('Test error');
      const context = {
        provider: 'openai',
        operation: 'generateDream',
        apiKey: 'sk-secret-key-123',
        credentials: 'secret-credentials',
        authorization: 'Bearer secret-token',
        responseData: 'safe response data',
        requestId: 'req-123',
      };

      const classification = classifier.classifyError(error, context);

      expect(classification.context.apiKey).toBeUndefined();
      expect(classification.context.credentials).toBeUndefined();
      expect(classification.context.authorization).toBeUndefined();
      expect(classification.context.responseData).toBe('safe response data');
      expect(classification.context.requestId).toBe('req-123');
    });

    test('should truncate large response data', () => {
      const error = new Error('Test error');
      const largeResponse = 'x'.repeat(2000);
      const context = {
        provider: 'cerebras',
        operation: 'generateDream',
        responseData: largeResponse,
      };

      const classification = classifier.classifyError(error, context);

      expect(classification.context.responseData.length).toBeLessThan(
        largeResponse.length
      );
      expect(classification.context.responseData).toContain('[truncated]');
      expect(classification.context.responseData.length).toBeLessThanOrEqual(
        1013
      ); // 1000 + '[truncated]'.length
    });

    test('should handle null and undefined values in context', () => {
      const error = new Error('Test error');
      const context = {
        provider: 'test',
        operation: null,
        responseData: undefined,
        validField: 'valid value',
      };

      const classification = classifier.classifyError(error, context);

      expect(classification.context.provider).toBe('test');
      expect(classification.context.operation).toBeNull();
      expect(classification.context.responseData).toBeUndefined();
      expect(classification.context.validField).toBe('valid value');
    });
  });

  describe('Error Detection Helpers', () => {
    test('should detect network errors correctly', () => {
      const networkTests = [
        {
          error: new Error('Connection refused'),
          code: 'ECONNREFUSED',
          expected: true,
        },
        {
          error: new Error('Host not found'),
          code: 'ENOTFOUND',
          expected: true,
        },
        {
          error: new Error('Connection reset'),
          code: 'ECONNRESET',
          expected: true,
        },
        {
          error: new Error('Network timeout'),
          code: 'ETIMEDOUT',
          expected: true,
        },
        { error: new Error('Network error occurred'), expected: true },
        { error: new Error('Connection failed'), expected: true },
        { error: new Error('Regular error'), expected: false },
      ];

      networkTests.forEach(({ error, code, expected }) => {
        if (code) error.code = code;
        expect(classifier.isNetworkError(error)).toBe(expected);
      });
    });

    test('should detect timeout errors correctly', () => {
      const timeoutTests = [
        {
          error: new Error('Request timed out'),
          name: 'TimeoutError',
          expected: true,
        },
        {
          error: new Error('Operation timeout'),
          code: 'ETIMEDOUT',
          expected: true,
        },
        { error: new Error('Connection timed out'), expected: true },
        { error: new Error('Request timeout'), expected: true },
        { error: new Error('Regular error'), expected: false },
      ];

      timeoutTests.forEach(({ error, name, code, expected }) => {
        if (name) error.name = name;
        if (code) error.code = code;
        expect(classifier.isTimeoutError(error)).toBe(expected);
      });
    });

    test('should detect rate limit errors correctly', () => {
      const rateLimitTests = [
        { error: new Error('Too many requests'), status: 429, expected: true },
        { error: new Error('Rate limit exceeded'), expected: true },
        { error: new Error('API quota exceeded'), expected: true },
        { error: new Error('Regular error'), expected: false },
      ];

      rateLimitTests.forEach(({ error, status, expected }) => {
        if (status) error.status = status;
        expect(classifier.isRateLimitError(error)).toBe(expected);
      });
    });

    test('should detect parsing errors correctly', () => {
      const parsingTests = [
        {
          error: new Error('response?.substring is not a function'),
          expected: true,
        },
        {
          error: new Error("Cannot read property 'content' of undefined"),
          expected: true,
        },
        {
          error: new Error('Cannot read properties of undefined'),
          expected: true,
        },
        { error: new Error('JSON.parse error'), expected: true },
        { error: new Error('Unexpected token in JSON'), expected: true },
        { error: new Error('Parsing failed'), expected: true },
        {
          error: new Error('SyntaxError'),
          name: 'SyntaxError',
          expected: true,
        },
        { error: new Error('Regular error'), expected: false },
      ];

      parsingTests.forEach(({ error, name, expected }) => {
        if (name) error.name = name;
        expect(classifier.isParsingError(error)).toBe(expected);
      });
    });
  });

  describe('Rate Limit Timeout Extraction', () => {
    test('should extract timeout from retry-after header', () => {
      const context = {
        responseHeaders: { 'retry-after': '120' },
      };

      const timeout = classifier.extractRateLimitTimeout(context);
      expect(timeout).toBe(120000); // 120 seconds in milliseconds
    });

    test('should extract timeout from x-ratelimit-reset header', () => {
      const context = {
        responseHeaders: { 'x-ratelimit-reset': '60' },
      };

      const timeout = classifier.extractRateLimitTimeout(context);
      expect(timeout).toBe(60000); // 60 seconds in milliseconds
    });

    test('should return null when no rate limit headers present', () => {
      const context = {
        responseHeaders: { 'content-type': 'application/json' },
      };

      const timeout = classifier.extractRateLimitTimeout(context);
      expect(timeout).toBeNull();
    });

    test('should return null when no headers present', () => {
      const context = {};

      const timeout = classifier.extractRateLimitTimeout(context);
      expect(timeout).toBeNull();
    });
  });

  describe('Fallback Classification', () => {
    test('should create fallback classification when main classification fails', () => {
      // Mock extractErrorInfo to throw an error
      const originalExtractErrorInfo = classifier.extractErrorInfo;
      classifier.extractErrorInfo = jest.fn(() => {
        throw new Error('Classification system failure');
      });

      const error = new Error('Test error');
      const context = { provider: 'test', operation: 'test' };

      const classification = classifier.classifyError(error, context);

      expect(classification.type).toBe('unknown');
      expect(classification.severity).toBe('high');
      expect(classification.recoverable).toBe(true);
      expect(classification.retryable).toBe(true);
      expect(classification.fallbackClassification).toBe(true);
      expect(classification.recoveryStrategy.actions).toHaveLength(1);
      expect(classification.recoveryStrategy.actions[0].type).toBe(
        'generic_retry'
      );

      // Restore original method
      classifier.extractErrorInfo = originalExtractErrorInfo;
    });

    test('should include original error information in fallback', () => {
      const originalExtractErrorInfo = classifier.extractErrorInfo;
      classifier.extractErrorInfo = jest.fn(() => {
        throw new Error('Classification failure');
      });

      const error = new Error('Original test error');
      error.name = 'TestError';
      const context = {
        provider: 'test_provider',
        operation: 'test_operation',
      };

      const classification = classifier.classifyError(error, context);

      expect(classification.errorInfo.message).toBe('Original test error');
      expect(classification.errorInfo.name).toBe('TestError');
      expect(classification.errorInfo.provider).toBe('test_provider');
      expect(classification.errorInfo.operation).toBe('test_operation');

      classifier.extractErrorInfo = originalExtractErrorInfo;
    });
  });

  describe('Custom Configuration and Extensibility', () => {
    test('should allow adding custom error patterns', () => {
      classifier.addErrorPattern('custom_error', /custom pattern/i);

      const stats = classifier.getClassificationStatistics();
      expect(stats.errorPatterns).toBeGreaterThan(0);

      // Verify the pattern was added
      const customPatterns = classifier.errorPatterns.get('custom_error');
      expect(customPatterns).toContain(/custom pattern/i);
    });

    test('should allow setting custom severity rules', () => {
      classifier.setSeverityRule('custom_error', 'critical');

      const stats = classifier.getClassificationStatistics();
      expect(stats.severityRules).toBeGreaterThan(0);

      // Verify the rule was set
      const severity = classifier.severityRules.get('custom_error');
      expect(severity).toBe('critical');
    });

    test('should allow setting custom recovery strategies', () => {
      const customStrategy = {
        primaryAction: 'custom_action',
        fallbackAction: 'custom_fallback',
        maxAttempts: 5,
      };

      classifier.setRecoveryStrategy('custom_error', customStrategy);

      const stats = classifier.getClassificationStatistics();
      expect(stats.recoveryStrategies).toBeGreaterThan(0);

      // Verify the strategy was set
      const strategy = classifier.recoveryStrategies.get('custom_error');
      expect(strategy).toEqual(customStrategy);
    });

    test('should provide classification statistics', () => {
      const stats = classifier.getClassificationStatistics();

      expect(stats).toHaveProperty('errorPatterns');
      expect(stats).toHaveProperty('severityRules');
      expect(stats).toHaveProperty('recoveryStrategies');
      expect(stats).toHaveProperty('config');

      expect(typeof stats.errorPatterns).toBe('number');
      expect(typeof stats.severityRules).toBe('number');
      expect(typeof stats.recoveryStrategies).toBe('number');
      expect(typeof stats.config).toBe('object');
    });
  });

  describe('Performance and Edge Cases', () => {
    test('should handle classification of many errors efficiently', () => {
      const errors = Array.from(
        { length: 100 },
        (_, i) => new Error(`Test error ${i}`)
      );

      const startTime = Date.now();

      const classifications = errors.map((error) =>
        classifier.classifyError(error, { provider: 'test', operation: 'test' })
      );

      const processingTime = Date.now() - startTime;

      expect(classifications).toHaveLength(100);
      expect(classifications.every((c) => c.type === 'unknown')).toBe(true);
      expect(processingTime).toBeLessThan(1000); // Should process within 1 second
    });

    test('should handle errors with circular references in context', () => {
      const circularContext = { provider: 'test' };
      circularContext.self = circularContext;

      const error = new Error('Test error');

      expect(() => {
        classifier.classifyError(error, circularContext);
      }).not.toThrow();
    });

    test('should handle errors with very long messages', () => {
      const longMessage = 'x'.repeat(10000);
      const error = new Error(longMessage);
      const context = { provider: 'test', operation: 'test' };

      const classification = classifier.classifyError(error, context);

      expect(classification.success).not.toBe(false);
      expect(classification.errorInfo.message).toBe(longMessage);
    });
  });
});
