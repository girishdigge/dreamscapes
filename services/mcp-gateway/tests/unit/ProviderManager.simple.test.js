// tests/unit/ProviderManager.simple.test.js
// Simplified unit tests for ProviderManager class

const ProviderManager = require('../../providers/ProviderManager');
const BaseProvider = require('../../providers/BaseProvider');

// Simple mock provider for testing
class SimpleMockProvider extends BaseProvider {
  constructor(name, config = {}) {
    super(config);
    this.name = name;
    this.shouldFail = config.shouldFail || false;
    this.responseDelay = config.responseDelay || 100;
  }

  async generateDream(prompt, options = {}) {
    await new Promise((resolve) => setTimeout(resolve, this.responseDelay));

    if (this.shouldFail) {
      throw new Error(`Mock ${this.name} provider failure`);
    }

    return {
      success: true,
      data: {
        title: `Mock ${this.name} Dream`,
        scenes: [{ type: 'test', provider: this.name }],
      },
      metadata: {
        source: this.name,
        processingTime: this.responseDelay,
      },
    };
  }

  async testConnection() {
    if (this.shouldFail) {
      throw new Error('Connection test failed');
    }
    return { status: 'healthy', latency: 50 };
  }
}

describe('ProviderManager - Basic Functionality', () => {
  let providerManager;
  let mockCerebras;
  let mockOpenAI;

  beforeEach(() => {
    // Create simple mock providers
    mockCerebras = new SimpleMockProvider('cerebras');
    mockOpenAI = new SimpleMockProvider('openai');

    // Create ProviderManager with minimal config
    const config = {
      enableEnhancedMonitoring: false,
      enableAutomatedReporting: false,
      healthCheckInterval: 60000, // Longer interval for tests
    };

    providerManager = new ProviderManager(config);
  });

  afterEach(async () => {
    if (providerManager) {
      await providerManager.shutdown();
    }
  });

  describe('Provider Registration', () => {
    test('should register providers correctly', () => {
      providerManager.registerProvider('cerebras', mockCerebras);
      providerManager.registerProvider('openai', mockOpenAI);

      expect(providerManager.getRegisteredProviders()).toContain('cerebras');
      expect(providerManager.getRegisteredProviders()).toContain('openai');
      expect(providerManager.getRegisteredProviders()).toHaveLength(2);
    });

    test('should get provider by name', () => {
      providerManager.registerProvider('cerebras', mockCerebras);

      const cerebrasProvider = providerManager.getProvider('cerebras');
      expect(cerebrasProvider).toBe(mockCerebras);
      expect(cerebrasProvider.name).toBe('cerebras');
    });

    test('should return null for non-existent provider', () => {
      const nonExistent = providerManager.getProvider('nonexistent');
      expect(nonExistent).toBeNull();
    });

    test('should unregister providers', () => {
      providerManager.registerProvider('cerebras', mockCerebras);
      providerManager.registerProvider('openai', mockOpenAI);

      providerManager.unregisterProvider('openai');
      expect(providerManager.getRegisteredProviders()).not.toContain('openai');
      expect(providerManager.getRegisteredProviders()).toHaveLength(1);
    });
  });

  describe('Basic Health Status', () => {
    test('should provide health status', () => {
      providerManager.registerProvider('cerebras', mockCerebras);

      const healthStatus = providerManager.getHealthStatus();
      expect(healthStatus).toHaveProperty('status');
    });

    test('should handle provider initialization errors', () => {
      expect(() => {
        providerManager.registerProvider('invalid', null);
      }).toThrow();
    });
  });

  describe('Basic Metrics', () => {
    test('should provide basic metrics', () => {
      providerManager.registerProvider('cerebras', mockCerebras);

      const metrics = providerManager.getProviderMetrics('cerebras');
      expect(metrics).toBeDefined();
    });
  });
});
