// providers/ProviderRegistry.js
// Provider Registry for discovery and configuration management

const fs = require('fs').promises;
const path = require('path');

/**
 * Provider Registry - Handles provider discovery and configuration
 */
class ProviderRegistry {
  constructor(configPath = null) {
    this.configPath =
      configPath || path.join(__dirname, '../config/providers.json');
    this.providers = new Map();
    this.configurations = new Map();
    this.discoveryPaths = [
      path.join(__dirname, './'),
      path.join(__dirname, '../services/'),
    ];
  }

  /**
   * Initialize registry by loading configurations and discovering providers
   */
  async initialize() {
    try {
      await this.loadConfigurations();
      await this.discoverProviders();
      console.log('Provider registry initialized successfully');
    } catch (error) {
      console.error('Failed to initialize provider registry:', error.message);
      throw error;
    }
  }

  /**
   * Load provider configurations from file
   */
  async loadConfigurations() {
    try {
      const configData = await fs.readFile(this.configPath, 'utf8');
      const config = JSON.parse(configData);

      for (const [name, providerConfig] of Object.entries(
        config.providers || {}
      )) {
        this.configurations.set(name, providerConfig);
      }

      console.log(
        `Loaded configurations for ${this.configurations.size} providers`
      );
    } catch (error) {
      if (error.code === 'ENOENT') {
        console.log('No provider configuration file found, using defaults');
        await this.createDefaultConfiguration();
      } else {
        throw error;
      }
    }
  }

  /**
   * Create default provider configuration
   */
  async createDefaultConfiguration() {
    const defaultConfig = {
      providers: {
        cerebras: {
          enabled: true,
          priority: 10,
          className: 'CerebrasProvider',
          modulePath: './CerebrasProvider.js',
          limits: {
            requestsPerMinute: 100,
            tokensPerMinute: 50000,
            maxConcurrent: 5,
          },
          fallback: {
            enabled: true,
            retryAttempts: 3,
            backoffMultiplier: 2,
          },
          sdk: {
            model: 'llama-3.3-70b',
            streaming: true,
            maxTokens: 32768,
            temperature: 0.6,
            topP: 0.9,
          },
        },
        openai: {
          enabled: true,
          priority: 8,
          className: 'OpenAIProvider',
          modulePath: './OpenAIProvider.js',
          limits: {
            requestsPerMinute: 60,
            tokensPerMinute: 40000,
            maxConcurrent: 3,
          },
          fallback: {
            enabled: true,
            retryAttempts: 2,
            backoffMultiplier: 1.5,
          },
        },
        llama: {
          enabled: false,
          priority: 5,
          className: 'LlamaProvider',
          modulePath: './LlamaProvider.js',
          limits: {
            requestsPerMinute: 30,
            tokensPerMinute: 20000,
            maxConcurrent: 2,
          },
          fallback: {
            enabled: true,
            retryAttempts: 1,
            backoffMultiplier: 1,
          },
        },
      },
    };

    // Ensure config directory exists
    const configDir = path.dirname(this.configPath);
    await fs.mkdir(configDir, { recursive: true });

    // Write default configuration
    await fs.writeFile(this.configPath, JSON.stringify(defaultConfig, null, 2));

    // Load the default configuration
    for (const [name, config] of Object.entries(defaultConfig.providers)) {
      this.configurations.set(name, config);
    }

    console.log('Created default provider configuration');
  }

  /**
   * Discover available provider classes
   */
  async discoverProviders() {
    const discovered = new Map();

    for (const discoveryPath of this.discoveryPaths) {
      try {
        const files = await fs.readdir(discoveryPath);

        for (const file of files) {
          if (file.endsWith('Provider.js') && file !== 'BaseProvider.js') {
            const providerName = file.replace('Provider.js', '').toLowerCase();
            const modulePath = path.join(discoveryPath, file);

            try {
              // Check if file exists and is readable
              await fs.access(modulePath);
              discovered.set(providerName, {
                name: providerName,
                className: file.replace('.js', ''),
                modulePath: modulePath,
                discovered: true,
              });
            } catch (error) {
              console.warn(`Cannot access provider file: ${modulePath}`);
            }
          }
        }
      } catch (error) {
        console.warn(`Cannot read discovery path: ${discoveryPath}`);
      }
    }

    this.providers = discovered;
    console.log(
      `Discovered ${discovered.size} provider classes:`,
      Array.from(discovered.keys())
    );
  }

  /**
   * Get provider configuration
   */
  getProviderConfig(name) {
    return this.configurations.get(name.toLowerCase());
  }

  /**
   * Get all provider configurations
   */
  getAllConfigurations() {
    return Object.fromEntries(this.configurations);
  }

  /**
   * Get discovered provider info
   */
  getProviderInfo(name) {
    return this.providers.get(name.toLowerCase());
  }

  /**
   * Get all discovered providers
   */
  getAllProviders() {
    return Object.fromEntries(this.providers);
  }

  /**
   * Get enabled providers with their configurations
   */
  getEnabledProviders() {
    const enabled = new Map();

    for (const [name, config] of this.configurations) {
      if (config.enabled) {
        const providerInfo = this.providers.get(name);
        if (providerInfo) {
          enabled.set(name, {
            ...providerInfo,
            config,
          });
        }
      }
    }

    return Object.fromEntries(enabled);
  }

  /**
   * Update provider configuration
   */
  async updateProviderConfig(name, updates) {
    const currentConfig = this.configurations.get(name.toLowerCase());
    if (!currentConfig) {
      throw new Error(`Provider configuration not found: ${name}`);
    }

    const updatedConfig = { ...currentConfig, ...updates };
    this.configurations.set(name.toLowerCase(), updatedConfig);

    // Save to file
    await this.saveConfigurations();

    console.log(`Updated configuration for provider: ${name}`);
  }

  /**
   * Add new provider configuration
   */
  async addProviderConfig(name, config) {
    this.configurations.set(name.toLowerCase(), config);
    await this.saveConfigurations();
    console.log(`Added configuration for provider: ${name}`);
  }

  /**
   * Remove provider configuration
   */
  async removeProviderConfig(name) {
    this.configurations.delete(name.toLowerCase());
    await this.saveConfigurations();
    console.log(`Removed configuration for provider: ${name}`);
  }

  /**
   * Save configurations to file
   */
  async saveConfigurations() {
    const config = {
      providers: Object.fromEntries(this.configurations),
    };

    await fs.writeFile(this.configPath, JSON.stringify(config, null, 2));
  }

  /**
   * Validate provider configuration
   */
  validateProviderConfig(config) {
    const required = ['enabled', 'priority', 'limits'];
    const missing = required.filter((field) => !(field in config));

    if (missing.length > 0) {
      throw new Error(
        `Missing required configuration fields: ${missing.join(', ')}`
      );
    }

    if (typeof config.enabled !== 'boolean') {
      throw new Error('enabled must be a boolean');
    }

    if (typeof config.priority !== 'number' || config.priority < 0) {
      throw new Error('priority must be a non-negative number');
    }

    if (!config.limits || typeof config.limits !== 'object') {
      throw new Error('limits must be an object');
    }

    const requiredLimits = [
      'requestsPerMinute',
      'tokensPerMinute',
      'maxConcurrent',
    ];
    const missingLimits = requiredLimits.filter(
      (field) => !(field in config.limits)
    );

    if (missingLimits.length > 0) {
      throw new Error(
        `Missing required limit fields: ${missingLimits.join(', ')}`
      );
    }

    return true;
  }

  /**
   * Create provider instance from configuration
   */
  async createProviderInstance(name) {
    const config = this.getProviderConfig(name);
    const providerInfo = this.getProviderInfo(name);

    if (!config) {
      throw new Error(`No configuration found for provider: ${name}`);
    }

    if (!providerInfo) {
      throw new Error(`Provider class not found: ${name}`);
    }

    try {
      // Dynamically import the provider class
      const ProviderClass = require(providerInfo.modulePath);

      // Create instance with configuration
      const instance = new ProviderClass(config);

      console.log(`Created instance of ${name} provider`);
      return instance;
    } catch (error) {
      console.error(
        `Failed to create provider instance: ${name}`,
        error.message
      );
      throw error;
    }
  }

  /**
   * Get registry statistics
   */
  getStats() {
    const totalProviders = this.providers.size;
    const totalConfigurations = this.configurations.size;
    const enabledCount = Array.from(this.configurations.values()).filter(
      (config) => config.enabled
    ).length;

    return {
      totalProviders,
      totalConfigurations,
      enabledProviders: enabledCount,
      disabledProviders: totalConfigurations - enabledCount,
      discoveredProviders: Array.from(this.providers.keys()),
      configuredProviders: Array.from(this.configurations.keys()),
    };
  }

  /**
   * Refresh registry (reload configurations and rediscover providers)
   */
  async refresh() {
    console.log('Refreshing provider registry...');
    this.providers.clear();
    this.configurations.clear();
    await this.initialize();
  }
}

module.exports = ProviderRegistry;
