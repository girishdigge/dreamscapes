// services/mcp-gateway/tests/integration/response-parsing-fixes.test.js
// Integration tests for response parsing fixes

const request = require('supertest');
const express = require('express');
const { extractContentSafely } = require('../../utils/responseParser');
const ProviderManager = require('../../providers/ProviderManager');

// Mock providers for testing
class MockCerebrasProvider {
  constructor(responseType = 'normal') {
    this.responseType = responseType;
  }

  async generateDream(prompt, options = {}) {
    switch (this.responseType) {
      case 'object_response':
        return {
          choices: [
            {
              message: {
                content:
                  '{"structures": [{"type": "tower"}], "entities": [], "cinematography": {}}',
              },
            },
          ],
        };

      case 'streaming_response':
        return {
          content:
            '{"structures": [{"type": "castle"}], "entities": [], "cinematography": {}}',
        };

      case 'string_response':
        return '{"structures": [{"type": "house"}], "entities": [], "cinematography": {}}';

      case 'malformed_response':
        return {
          choices: [
            {
              message: {
                content: '{"structures": [{"type": "broken"',
              },
            },
          ],
        };

      default:
        return '{"structures": [], "entities": [], "cinematography": {}}';
    }
  }

  async testConnection() {
    return true;
  }
}

class MockOpenAIProvider {
  constructor(responseType = 'normal') {
    this.responseType = responseType;
  }

  async generateDream(prompt, options = {}) {
    switch (this.responseType) {
      case 'chat_completion':
        return {
          id: 'chatcmpl-123',
          choices: [
            {
              message: {
                content:
                  '{"structures": [{"type": "mansion"}], "entities": [], "cinematography": {}}',
              },
            },
          ],
        };

      case 'legacy_completion':
        return {
          choices: [
            {
              text: '{"structures": [{"type": "cabin"}], "entities": [], "cinematography": {}}',
            },
          ],
        };

      default:
        return '{"structures": [], "entities": [], "cinematography": {}}';
    }
  }

  async testConnection() {
    return true;
  }
}

describe('Response Parsing Fixes Integration Tests', () => {
  let providerManager;

  beforeEach(() => {
    providerManager = new ProviderManager({
      enableEnhancedMonitoring: false, // Disable for tests
    });
  });

  afterEach(async () => {
    if (providerManager) {
      await providerManager.shutdown();
    }
  });

  describe('extractContentSafely function', () => {
    it('should safely extract content from Cerebras object response', () => {
      const response = {
        choices: [
          {
            message: {
              content: 'Test content from Cerebras',
            },
          },
        ],
      };

      const result = extractContentSafely(response, 'cerebras');
      expect(result).toBe('Test content from Cerebras');
    });

    it('should safely extract content from OpenAI object response', () => {
      const response = {
        choices: [
          {
            message: {
              content: 'Test content from OpenAI',
            },
          },
        ],
      };

      const result = extractContentSafely(response, 'openai');
      expect(result).toBe('Test content from OpenAI');
    });

    it('should handle string responses directly', () => {
      const response = 'Direct string response';
      const result = extractContentSafely(response, 'unknown');
      expect(result).toBe('Direct string response');
    });

    it('should handle null/undefined responses gracefully', () => {
      expect(extractContentSafely(null, 'test')).toBeNull();
      expect(extractContentSafely(undefined, 'test')).toBeNull();
    });

    it('should handle malformed responses without throwing errors', () => {
      const malformedResponse = {
        choices: [
          {
            message: null,
          },
        ],
      };

      expect(() =>
        extractContentSafely(malformedResponse, 'test')
      ).not.toThrow();
      const result = extractContentSafely(malformedResponse, 'test');
      expect(result).toBeNull();
    });
  });

  describe('ProviderManager getProviderHealth method', () => {
    it('should have getProviderHealth method', () => {
      expect(typeof providerManager.getProviderHealth).toBe('function');
    });

    it('should return health for specific provider', () => {
      // Register a mock provider
      const mockProvider = new MockCerebrasProvider();
      providerManager.registerProvider('cerebras', mockProvider);

      const health = providerManager.getProviderHealth('cerebras');

      expect(health).toBeTruthy();
      expect(health.status).toBeDefined();
      expect(health.isHealthy).toBeDefined();
      expect(health.metrics).toBeDefined();
      expect(health.timestamp).toBeDefined();
    });

    it('should return health for all providers when no specific provider requested', () => {
      // Register multiple mock providers
      providerManager.registerProvider('cerebras', new MockCerebrasProvider());
      providerManager.registerProvider('openai', new MockOpenAIProvider());

      const health = providerManager.getProviderHealth();

      expect(health.providers).toBeTruthy();
      expect(health.summary).toBeTruthy();
      expect(health.summary.total).toBe(2);
      expect(health.providers.cerebras).toBeTruthy();
      expect(health.providers.openai).toBeTruthy();
    });

    it('should handle requests for non-existent providers', () => {
      const health = providerManager.getProviderHealth('nonexistent');

      expect(health.status).toBe('unknown');
      expect(health.error).toContain('Provider not found');
    });
  });

  describe('Provider response handling', () => {
    it('should handle Cerebras object responses without substring errors', async () => {
      const provider = new MockCerebrasProvider('object_response');
      const response = await provider.generateDream('test prompt');

      // This should not throw "substring is not a function" error
      expect(() => extractContentSafely(response, 'cerebras')).not.toThrow();

      const content = extractContentSafely(response, 'cerebras');
      expect(content).toContain('tower');
    });

    it('should handle Cerebras streaming responses', async () => {
      const provider = new MockCerebrasProvider('streaming_response');
      const response = await provider.generateDream('test prompt');

      const content = extractContentSafely(response, 'cerebras');
      expect(content).toContain('castle');
    });

    it('should handle OpenAI chat completion responses', async () => {
      const provider = new MockOpenAIProvider('chat_completion');
      const response = await provider.generateDream('test prompt');

      const content = extractContentSafely(response, 'openai');
      expect(content).toContain('mansion');
    });

    it('should handle malformed responses gracefully', async () => {
      const provider = new MockCerebrasProvider('malformed_response');
      const response = await provider.generateDream('test prompt');

      // Should not throw errors even with malformed JSON
      expect(() => extractContentSafely(response, 'cerebras')).not.toThrow();

      const content = extractContentSafely(response, 'cerebras');
      expect(content).toBeTruthy(); // Should still extract something
    });
  });

  describe('End-to-end response processing', () => {
    it('should process complete workflow without errors', async () => {
      // Register providers
      providerManager.registerProvider(
        'cerebras',
        new MockCerebrasProvider('object_response')
      );
      providerManager.registerProvider(
        'openai',
        new MockOpenAIProvider('chat_completion')
      );

      // Test provider selection and health
      const selectedProvider = await providerManager.selectProvider();
      expect(selectedProvider).toBeTruthy();
      expect(selectedProvider.provider).toBeTruthy();

      // Test response generation
      const response = await selectedProvider.provider.generateDream(
        'test prompt'
      );
      expect(response).toBeTruthy();

      // Test safe content extraction
      const content = extractContentSafely(response, selectedProvider.name);
      expect(content).toBeTruthy();

      // Test health monitoring
      const health = providerManager.getProviderHealth(selectedProvider.name);
      expect(health.status).toBeDefined();
    });

    it('should handle provider fallback scenarios', async () => {
      // Register providers with different response types
      providerManager.registerProvider(
        'cerebras',
        new MockCerebrasProvider('malformed_response')
      );
      providerManager.registerProvider(
        'openai',
        new MockOpenAIProvider('chat_completion')
      );

      // Test that system can handle malformed responses and fallback
      const providers = providerManager.getAvailableProviders();
      expect(providers.length).toBeGreaterThan(0);

      // Test each provider's response handling
      for (const providerInfo of providers) {
        const response = await providerInfo.provider.generateDream(
          'test prompt'
        );

        // Should not throw errors regardless of response format
        expect(() =>
          extractContentSafely(response, providerInfo.name)
        ).not.toThrow();
      }
    });
  });

  describe('Error recovery scenarios', () => {
    it('should recover from parsing errors', () => {
      const problematicResponse = {
        choices: [
          {
            message: {
              content: 'Valid content',
            },
          },
        ],
        // Add a property that might cause issues
        get problematicProperty() {
          throw new Error('Simulated error');
        },
      };

      // Should still extract content despite the problematic property
      const content = extractContentSafely(problematicResponse, 'test');
      expect(content).toBe('Valid content');
    });

    it('should handle circular reference objects', () => {
      const circularResponse = {
        choices: [
          {
            message: {
              content: 'Content with circular ref',
            },
          },
        ],
      };

      // Create circular reference
      circularResponse.self = circularResponse;

      // Should handle circular references gracefully
      expect(() =>
        extractContentSafely(circularResponse, 'test')
      ).not.toThrow();
      const content = extractContentSafely(circularResponse, 'test');
      expect(content).toBe('Content with circular ref');
    });
  });

  describe('Performance and reliability', () => {
    it('should handle large responses efficiently', () => {
      const largeContent = 'x'.repeat(50000); // 50KB content
      const response = {
        choices: [
          {
            message: {
              content: largeContent,
            },
          },
        ],
      };

      const startTime = Date.now();
      const content = extractContentSafely(response, 'test');
      const processingTime = Date.now() - startTime;

      expect(content).toBe(largeContent);
      expect(processingTime).toBeLessThan(1000); // Should process within 1 second
    });

    it('should handle multiple concurrent parsing requests', async () => {
      const responses = Array.from({ length: 10 }, (_, i) => ({
        choices: [
          {
            message: {
              content: `Content ${i}`,
            },
          },
        ],
      }));

      const promises = responses.map((response, i) =>
        Promise.resolve(extractContentSafely(response, `provider${i}`))
      );

      const results = await Promise.all(promises);

      expect(results).toHaveLength(10);
      results.forEach((result, i) => {
        expect(result).toBe(`Content ${i}`);
      });
    });
  });
});
