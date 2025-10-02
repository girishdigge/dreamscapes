// tests/ErrorClassificationSystem.test.js
// Unit tests for ErrorClassificationSystem

const ErrorClassificationSystem = require('../utils/ErrorClassificationSystem');

describe('ErrorClassificationSystem', () => {
  let classifier;

  beforeEach(() => {
    classifier = new ErrorClassificationSystem({
      maxRetryAttempts: 3,
      exponentialBackoffBase: 1000,
      circuitBreakerThreshold: 5,
    });
  });

  describe('Error Type Classification', () => {
    test('should classify response parsing errors correctly', () => {
      const error = new Error('response?.substring is not a function');
      const context = { provider: 'cerebras', operation: 'generateDream' };

      const classification = classifier.classifyError(error, context);

      expect(classification.type).toBe('response_parsing');
      expect(classification.severity).toBe('high');
      expect(classification.recoverable).toBe(true);
      expect(classification.retryable).toBe(true);
    });

    test('should classify provider method errors correctly', () => {
      const error = new Error(
        'this.providerManager.getProviderHealth is not a function'
      );
      const context = { provider: 'system', operation: 'healthCheck' };

      const classification = classifier.classifyError(error, context);

      expect(classification.type).toBe('provider_method');
      expect(classification.severity).toBe('critical');
      expect(classification.recoverable).toBe(false);
      expect(classification.retryable).toBe(false);
    });

    test('should classify network errors correctly', () => {
      const error = new Error('Connection refused');
      error.code = 'ECONNREFUSED';
      const context = { provider: 'openai', operation: 'generateDream' };

      const classification = classifier.classifyError(error, context);

      expect(classification.type).toBe('network_error');
      expect(classification.severity).toBe('medium');
      expect(classification.recoverable).toBe(true);
      expect(classification.retryable).toBe(true);
    });

    test('should classify timeout errors correctly', () => {
      const error = new Error('Request timed out');
      error.name = 'TimeoutError';
      const context = {
        provider: 'cerebras',
        operation: 'generateDream',
        responseTime: 15000,
      };

      const classification = classifier.classifyError(error, context);

      expect(classification.type).toBe('timeout');
      expect(classification.severity).toBe('medium');
      expect(classification.recoverable).toBe(true);
      expect(classification.retryable).toBe(true);
    });

    test('should classify rate limit errors correctly', () => {
      const error = new Error('Too many requests');
      error.status = 429;
      const context = { provider: 'openai', operation: 'generateDream' };

      const classification = classifier.classifyError(error, context);

      expect(classification.type).toBe('rate_limit');
      expect(classification.severity).toBe('medium');
      expect(classification.recoverable).toBe(true);
      expect(classification.retryable).toBe(true);
    });

    test('should classify authentication errors correctly', () => {
      const error = new Error('Invalid API key');
      error.status = 401;
      const context = { provider: 'openai', operation: 'generateDream' };

      const classification = classifier.classifyError(error, context);

      expect(classification.type).toBe('authentication');
      expect(classification.severity).toBe('high');
      expect(classification.recoverable).toBe(false);
      expect(classification.retryable).toBe(false);
    });

    test('should classify provider errors correctly', () => {
      const error = new Error('Internal server error');
      error.status = 500;
      const context = { provider: 'cerebras', operation: 'generateDream' };

      const classification = classifier.classifyError(error, context);

      expect(classification.type).toBe('provider_error');
      expect(classification.severity).toBe('medium');
      expect(classification.recoverable).toBe(true);
      expect(classification.retryable).toBe(true);
    });

    test('should classify configuration errors correctly', () => {
      const error = new Error('Missing API key configuration');
      const context = { provider: 'openai', operation: 'initialize' };

      const classification = classifier.classifyError(error, context);

      expect(classification.type).toBe('configuration');
      expect(classification.severity).toBe('critical');
      expect(classification.recoverable).toBe(false);
      expect(classification.retryable).toBe(false);
    });

    test('should classify unknown errors with fallback', () => {
      const error = new Error('Some unknown error');
      const context = { provider: 'unknown', operation: 'unknown' };

      const classification = classifier.classifyError(error, context);

      expect(classification.type).toBe('unknown');
      expect(classification.severity).toBe('low');
      expect(classification.recoverable).toBe(true);
      expect(classification.retryable).toBe(true);
    });
  });

  describe('Severity Assessment', () => {
    test('should assess critical severity for system-breaking errors', () => {
      const error = new Error(
        'this.providerManager.getProviderHealth is not a function'
      );
      const context = { provider: 'system', operation: 'healthCheck' };

      const classification = classifier.classifyError(error, context);

      expect(classification.severity).toBe('critical');
    });

    test('should assess critical severity for all providers failing', () => {
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
        consecutiveFailures: 6,
      };

      const classification = classifier.classifyError(error, context);

      expect(classification.severity).toBe('critical');
    });

    test('should assess high severity for response parsing errors', () => {
      const error = new Error('Cannot read property of undefined');
      const context = { provider: 'cerebras', operation: 'generateDream' };

      const classification = classifier.classifyError(error, context);

      expect(classification.severity).toBe('high');
    });

    test('should assess medium severity for network errors', () => {
      const error = new Error('Connection failed');
      error.code = 'ECONNREFUSED';
      const context = { provider: 'openai', operation: 'generateDream' };

      const classification = classifier.classifyError(error, context);

      expect(classification.severity).toBe('medium');
    });
  });

  describe('Recovery Strategy Generation', () => {
    test('should generate appropriate recovery strategy for response parsing errors', () => {
      const error = new Error('response?.substring is not a function');
      const context = { provider: 'cerebras', operation: 'generateDream' };

      const classification = classifier.classifyError(error, context);

      expect(classification.recoveryStrategy.actions).toHaveLength(2);
      expect(classification.recoveryStrategy.actions[0].type).toBe(
        'enhance_parsing'
      );
      expect(classification.recoveryStrategy.actions[1].type).toBe(
        'switch_provider'
      );
      expect(classification.recoveryStrategy.priority).toBe(2); // high severity
    });

    test('should generate appropriate recovery strategy for provider method errors', () => {
      const error = new Error(
        'this.providerManager.getProviderHealth is not a function'
      );
      const context = { provider: 'system', operation: 'healthCheck' };

      const classification = classifier.classifyError(error, context);

      expect(classification.recoveryStrategy.actions).toHaveLength(1);
      expect(classification.recoveryStrategy.actions[0].type).toBe(
        'implement_method'
      );
      expect(classification.recoveryStrategy.priority).toBe(1); // critical severity
    });

    test('should generate retry strategy for network errors', () => {
      const error = new Error('Connection refused');
      error.code = 'ECONNREFUSED';
      const context = {
        provider: 'openai',
        operation: 'generateDream',
        attemptNumber: 1,
      };

      const classification = classifier.classifyError(error, context);

      expect(classification.recoveryStrategy.actions).toHaveLength(1);
      expect(classification.recoveryStrategy.actions[0].type).toBe(
        'exponential_backoff_retry'
      );
      expect(classification.recoveryStrategy.actions[0].maxAttempts).toBe(3);
    });

    test('should generate rate limit backoff strategy', () => {
      const error = new Error('Too many requests');
      error.status = 429;
      const context = {
        provider: 'openai',
        operation: 'generateDream',
        responseHeaders: { 'retry-after': '60' },
      };

      const classification = classifier.classifyError(error, context);

      expect(classification.recoveryStrategy.actions).toHaveLength(1);
      expect(classification.recoveryStrategy.actions[0].type).toBe(
        'rate_limit_backoff'
      );
      expect(classification.recoveryStrategy.actions[0].timeout).toBe(60000);
    });

    test('should generate circuit breaker strategy for repeated failures', () => {
      const error = new Error('Provider error');
      const context = {
        provider: 'cerebras',
        operation: 'generateDream',
        consecutiveFailures: 5,
      };

      const classification = classifier.classifyError(error, context);

      expect(classification.recoveryStrategy.actions[0].type).toBe(
        'circuit_breaker'
      );
    });

    test('should include fallback options for critical errors', () => {
      const error = new Error(
        'this.providerManager.getProviderHealth is not a function'
      );
      const context = { provider: 'system', operation: 'healthCheck' };

      const classification = classifier.classifyError(error, context);

      expect(
        classification.recoveryStrategy.fallbackOptions.length
      ).toBeGreaterThan(0);
      expect(classification.recoveryStrategy.fallbackOptions[0].type).toBe(
        'provider_fallback'
      );
    });
  });

  describe('Retryability Assessment', () => {
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

    test('should mark errors as non-retryable when max attempts exceeded', () => {
      const error = new Error('Connection failed');
      error.code = 'ECONNREFUSED';
      const context = {
        provider: 'openai',
        operation: 'generateDream',
        attemptNumber: 4,
      };

      const classification = classifier.classifyError(error, context);

      expect(classification.retryable).toBe(false);
    });
  });

  describe('Context Sanitization', () => {
    test('should sanitize sensitive information from context', () => {
      const error = new Error('Test error');
      const context = {
        provider: 'openai',
        operation: 'generateDream',
        apiKey: 'secret-key',
        credentials: 'secret-creds',
        authorization: 'Bearer token',
        responseData: 'some response data',
      };

      const classification = classifier.classifyError(error, context);

      expect(classification.context.apiKey).toBeUndefined();
      expect(classification.context.credentials).toBeUndefined();
      expect(classification.context.authorization).toBeUndefined();
      expect(classification.context.responseData).toBe('some response data');
    });

    test('should truncate large response data', () => {
      const error = new Error('Test error');
      const largeResponse = 'x'.repeat(2000);
      const context = {
        provider: 'openai',
        operation: 'generateDream',
        responseData: largeResponse,
      };

      const classification = classifier.classifyError(error, context);

      expect(classification.context.responseData.length).toBeLessThan(
        largeResponse.length
      );
      expect(classification.context.responseData).toContain('[truncated]');
    });
  });

  describe('Backoff Calculation', () => {
    test('should calculate exponential backoff correctly', () => {
      const backoff1 = classifier.calculateBackoffTime(1);
      const backoff2 = classifier.calculateBackoffTime(2);
      const backoff3 = classifier.calculateBackoffTime(3);

      expect(backoff1).toBe(1000); // 1000 * 2^0
      expect(backoff2).toBe(2000); // 1000 * 2^1
      expect(backoff3).toBe(4000); // 1000 * 2^2
    });

    test('should cap backoff time at maximum', () => {
      const backoff = classifier.calculateBackoffTime(10);

      expect(backoff).toBe(30000); // Capped at 30 seconds
    });
  });

  describe('Error Detection Helpers', () => {
    test('should detect network errors correctly', () => {
      const networkError1 = new Error('Connection refused');
      networkError1.code = 'ECONNREFUSED';

      const networkError2 = new Error('Network error occurred');

      expect(classifier.isNetworkError(networkError1)).toBe(true);
      expect(classifier.isNetworkError(networkError2)).toBe(true);
    });

    test('should detect timeout errors correctly', () => {
      const timeoutError1 = new Error('Request timed out');
      timeoutError1.name = 'TimeoutError';

      const timeoutError2 = new Error('Operation timeout');
      timeoutError2.code = 'ETIMEDOUT';

      expect(classifier.isTimeoutError(timeoutError1)).toBe(true);
      expect(classifier.isTimeoutError(timeoutError2)).toBe(true);
    });

    test('should detect rate limit errors correctly', () => {
      const rateLimitError1 = new Error('Too many requests');
      rateLimitError1.status = 429;

      const rateLimitError2 = new Error('Rate limit exceeded');

      expect(classifier.isRateLimitError(rateLimitError1)).toBe(true);
      expect(classifier.isRateLimitError(rateLimitError2)).toBe(true);
    });

    test('should detect parsing errors correctly', () => {
      const parsingError1 = new Error('response?.substring is not a function');
      const parsingError2 = new Error('Cannot read property of undefined');
      const parsingError3 = new Error('JSON.parse error');

      expect(classifier.isParsingError(parsingError1)).toBe(true);
      expect(classifier.isParsingError(parsingError2)).toBe(true);
      expect(classifier.isParsingError(parsingError3)).toBe(true);
    });
  });

  describe('Fallback Classification', () => {
    test('should create fallback classification when classification fails', () => {
      // Mock the classifyError method to throw an error
      const originalClassifyError = classifier.classifyError;
      classifier.extractErrorInfo = jest.fn(() => {
        throw new Error('Classification failed');
      });

      const error = new Error('Test error');
      const context = { provider: 'test', operation: 'test' };

      const classification = classifier.classifyError(error, context);

      expect(classification.type).toBe('unknown');
      expect(classification.severity).toBe('high');
      expect(classification.fallbackClassification).toBe(true);

      // Restore original method
      classifier.extractErrorInfo = originalClassifyError.extractErrorInfo;
    });
  });

  describe('Custom Configuration', () => {
    test('should allow custom error patterns', () => {
      classifier.addErrorPattern('custom_error', /custom pattern/i);

      const stats = classifier.getClassificationStatistics();
      expect(stats.errorPatterns).toBeGreaterThan(0);
    });

    test('should allow custom severity rules', () => {
      classifier.setSeverityRule('custom_error', 'critical');

      const stats = classifier.getClassificationStatistics();
      expect(stats.severityRules).toBeGreaterThan(0);
    });

    test('should allow custom recovery strategies', () => {
      classifier.setRecoveryStrategy('custom_error', {
        primaryAction: 'custom_action',
        fallbackAction: 'custom_fallback',
        maxAttempts: 5,
      });

      const stats = classifier.getClassificationStatistics();
      expect(stats.recoveryStrategies).toBeGreaterThan(0);
    });
  });
});
