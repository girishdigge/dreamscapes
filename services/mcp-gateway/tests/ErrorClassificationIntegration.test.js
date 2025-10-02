// tests/ErrorClassificationIntegration.test.js
// Integration tests for ErrorClassificationIntegration

const ErrorClassificationIntegration = require('../utils/ErrorClassificationIntegration');

describe('ErrorClassificationIntegration', () => {
  let integration;

  beforeEach(() => {
    integration = new ErrorClassificationIntegration({
      enableDetailedLogging: false, // Disable logging for tests
      enableRecoveryExecution: true,
      enableMetricsCollection: true,
    });
  });

  describe('Error Handling Integration', () => {
    test('should handle response parsing errors with recovery', async () => {
      const error = new Error('response?.substring is not a function');
      const context = {
        provider: 'cerebras',
        operation: 'generateDream',
        attemptNumber: 1,
      };

      const result = await integration.handleError(error, context);

      expect(result.success).toBe(false);
      expect(result.classification.type).toBe('response_parsing');
      expect(result.classification.severity).toBe('high');
      expect(result.recovery.attempted).toBe(true);
      expect(result.suggestions.length).toBeGreaterThan(0);
    });

    test('should handle provider method errors without recovery', async () => {
      const error = new Error(
        'this.providerManager.getProviderHealth is not a function'
      );
      const context = {
        provider: 'system',
        operation: 'healthCheck',
        attemptNumber: 1,
      };

      const result = await integration.handleError(error, context);

      expect(result.success).toBe(false);
      expect(result.classification.type).toBe('provider_method');
      expect(result.classification.severity).toBe('critical');
      expect(result.classification.recoverable).toBe(false);
      expect(result.recovery.attempted).toBe(false);
    });

    test('should handle network errors with retry recovery', async () => {
      const error = new Error('Connection refused');
      error.code = 'ECONNREFUSED';
      const context = {
        provider: 'openai',
        operation: 'generateDream',
        attemptNumber: 1,
      };

      const result = await integration.handleError(error, context);

      expect(result.success).toBe(false);
      expect(result.classification.type).toBe('network_error');
      expect(result.classification.severity).toBe('medium');
      expect(result.recovery.attempted).toBe(true);
      expect(result.recovery.success).toBe(true);
    });

    test('should handle rate limit errors with backoff', async () => {
      const error = new Error('Too many requests');
      error.status = 429;
      const context = {
        provider: 'openai',
        operation: 'generateDream',
        responseHeaders: { 'retry-after': '60' },
      };

      const result = await integration.handleError(error, context);

      expect(result.success).toBe(false);
      expect(result.classification.type).toBe('rate_limit');
      expect(result.recovery.attempted).toBe(true);
      expect(result.suggestions).toContain('Wait before retrying the request');
    });

    test('should not attempt recovery when max attempts exceeded', async () => {
      const error = new Error('Connection failed');
      error.code = 'ECONNREFUSED';
      const context = {
        provider: 'openai',
        operation: 'generateDream',
        attemptNumber: 5,
        maxAttempts: 3,
      };

      const result = await integration.handleError(error, context);

      expect(result.recovery.attempted).toBe(false);
      expect(result.recovery.reason).toContain('Recovery not attempted');
    });

    test('should handle authentication errors without recovery', async () => {
      const error = new Error('Invalid API key');
      error.status = 401;
      const context = {
        provider: 'openai',
        operation: 'generateDream',
      };

      const result = await integration.handleError(error, context);

      expect(result.classification.type).toBe('authentication');
      expect(result.classification.recoverable).toBe(false);
      expect(result.recovery.attempted).toBe(false);
      expect(result.suggestions).toContain(
        'Verify API keys are valid and not expired'
      );
    });
  });

  describe('Recovery Strategy Execution', () => {
    test('should execute enhanced parsing recovery', async () => {
      const action = { type: 'enhance_parsing', timeout: 5000 };
      const context = { provider: 'cerebras', operation: 'generateDream' };

      const result = await integration.executeRecoveryAction(action, context);

      expect(result.success).toBe(true);
      expect(result.message).toContain('Enhanced parsing applied');
    });

    test('should execute provider switching recovery', async () => {
      const action = { type: 'switch_provider', timeout: 5000 };
      const context = { provider: 'cerebras', operation: 'generateDream' };

      const result = await integration.executeRecoveryAction(action, context);

      expect(result.success).toBe(true);
      expect(result.message).toContain('Provider switching initiated');
    });

    test('should execute exponential backoff retry', async () => {
      const action = { type: 'exponential_backoff_retry', timeout: 2000 };
      const context = { provider: 'openai', operation: 'generateDream' };

      const result = await integration.executeRecoveryAction(action, context);

      expect(result.success).toBe(true);
      expect(result.backoffTime).toBe(2000);
    });

    test('should handle unknown recovery actions', async () => {
      const action = { type: 'unknown_action', timeout: 1000 };
      const context = { provider: 'test', operation: 'test' };

      const result = await integration.executeRecoveryAction(action, context);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Unknown recovery action');
    });
  });

  describe('Metrics Collection', () => {
    test('should collect error handling metrics', async () => {
      const error1 = new Error('response?.substring is not a function');
      const error2 = new Error('Connection refused');
      error2.code = 'ECONNREFUSED';

      await integration.handleError(error1, {
        provider: 'cerebras',
        operation: 'generateDream',
      });
      await integration.handleError(error2, {
        provider: 'openai',
        operation: 'generateDream',
      });

      const metrics = integration.getMetrics();

      expect(metrics.totalErrors).toBe(2);
      expect(metrics.classifiedErrors).toBe(2);
      expect(metrics.recoveryAttempts).toBeGreaterThan(0);
      expect(metrics.classificationRate).toBe(100);
      expect(metrics.errorsByType['response_parsing']).toBe(1);
      expect(metrics.errorsByType['network_error']).toBe(1);
    });

    test('should track provider-specific metrics', async () => {
      const error = new Error('Provider error');
      error.status = 500;

      await integration.handleError(error, {
        provider: 'cerebras',
        operation: 'generateDream',
      });
      await integration.handleError(error, {
        provider: 'openai',
        operation: 'generateDream',
      });

      const metrics = integration.getMetrics();

      expect(metrics.errorsByProvider['cerebras']).toBe(1);
      expect(metrics.errorsByProvider['openai']).toBe(1);
    });

    test('should reset metrics correctly', async () => {
      const error = new Error('Test error');
      await integration.handleError(error, {
        provider: 'test',
        operation: 'test',
      });

      let metrics = integration.getMetrics();
      expect(metrics.totalErrors).toBe(1);

      integration.resetMetrics();
      metrics = integration.getMetrics();
      expect(metrics.totalErrors).toBe(0);
    });
  });

  describe('Error Suggestions', () => {
    test('should generate appropriate suggestions for response parsing errors', async () => {
      const error = new Error('Cannot read property of undefined');
      const context = { provider: 'cerebras', operation: 'generateDream' };

      const result = await integration.handleError(error, context);

      expect(result.suggestions).toContain(
        'Check response format from AI provider'
      );
      expect(result.suggestions).toContain(
        'Use enhanced response parsing utilities'
      );
    });

    test('should generate appropriate suggestions for network errors', async () => {
      const error = new Error('Network error');
      error.code = 'ECONNREFUSED';
      const context = { provider: 'openai', operation: 'generateDream' };

      const result = await integration.handleError(error, context);

      expect(result.suggestions).toContain('Check network connectivity');
      expect(result.suggestions).toContain(
        'Verify AI service endpoints are reachable'
      );
    });

    test('should include recovery-specific suggestions', async () => {
      const error = new Error('Connection timeout');
      error.name = 'TimeoutError';
      const context = { provider: 'cerebras', operation: 'generateDream' };

      const result = await integration.handleError(error, context);

      expect(result.recovery.attempted).toBe(true);
      if (result.recovery.success) {
        expect(
          result.suggestions.some((s) => s.includes('Recovery successful'))
        ).toBe(true);
      }
    });
  });

  describe('Configuration Options', () => {
    test('should respect enableRecoveryExecution setting', async () => {
      const integrationNoRecovery = new ErrorClassificationIntegration({
        enableRecoveryExecution: false,
      });

      const error = new Error('Connection failed');
      error.code = 'ECONNREFUSED';
      const context = { provider: 'openai', operation: 'generateDream' };

      const result = await integrationNoRecovery.handleError(error, context);

      expect(result.recovery.attempted).toBe(false);
    });

    test('should respect enableMetricsCollection setting', async () => {
      const integrationNoMetrics = new ErrorClassificationIntegration({
        enableMetricsCollection: false,
      });

      const error = new Error('Test error');
      await integrationNoMetrics.handleError(error, {
        provider: 'test',
        operation: 'test',
      });

      const metrics = integrationNoMetrics.getMetrics();
      expect(metrics.totalErrors).toBe(0); // Should not collect metrics
    });
  });

  describe('Fallback Error Handling', () => {
    test('should provide basic error response when classification fails', async () => {
      // Mock the classifier to throw an error
      integration.classifier.classifyError = jest.fn(() => {
        throw new Error('Classification failed');
      });

      const error = new Error('Test error');
      const context = { provider: 'test', operation: 'test' };

      const result = await integration.handleError(error, context);

      expect(result.success).toBe(false);
      expect(result.classification.type).toBe('unknown');
      expect(result.recovery.reason).toContain('Classification failed');
    });
  });

  describe('Integration with Classification System', () => {
    test('should provide access to classification statistics', () => {
      const stats = integration.getClassificationStatistics();

      expect(stats).toHaveProperty('errorPatterns');
      expect(stats).toHaveProperty('severityRules');
      expect(stats).toHaveProperty('recoveryStrategies');
      expect(stats).toHaveProperty('config');
    });

    test('should handle complex error scenarios', async () => {
      const error = new Error('response?.substring is not a function');
      const context = {
        provider: 'cerebras',
        operation: 'generateDream',
        attemptNumber: 2,
        consecutiveFailures: 1,
        responseTime: 8000,
        responseData: 'Some response data',
      };

      const result = await integration.handleError(error, context);

      expect(result.classification.type).toBe('response_parsing');
      expect(result.context.attemptNumber).toBe(2);
      expect(result.metadata).toHaveProperty('classificationTime');
      expect(result.metadata).toHaveProperty('estimatedRecoveryTime');
    });
  });
});
