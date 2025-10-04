/**
 * Configuration Loader for Dreamscapes AI Provider Integration
 * Loads and manages environment-specific configurations with validation
 */

const fs = require('fs');
const path = require('path');
const { validateConfiguration } = require('./validate-config');

class ConfigLoader {
  constructor() {
    this.config = {};
    this.environment = process.env.NODE_ENV || 'development';
    this.loaded = false;
  }

  /**
   * Load configuration for the current environment
   */
  load(environment = this.environment) {
    if (this.loaded && this.environment === environment) {
      return this.config;
    }

    this.environment = environment;

    // Load base configuration from process.env
    this.config = { ...process.env };

    // Load environment-specific configuration
    const envConfigPath = path.join(__dirname, `${environment}.env`);
    if (fs.existsSync(envConfigPath)) {
      const envConfig = this.parseEnvFile(envConfigPath);
      this.config = { ...this.config, ...envConfig };
    }

    // Apply environment variable substitution
    this.config = this.substituteVariables(this.config);

    // Validate configuration
    try {
      validateConfiguration(environment);
    } catch (error) {
      console.error('Configuration validation failed:', error.message);
      throw error;
    }

    this.loaded = true;
    return this.config;
  }

  /**
   * Parse environment file
   */
  parseEnvFile(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    const config = {};

    content.split('\n').forEach((line) => {
      line = line.trim();
      if (line && !line.startsWith('#')) {
        const equalIndex = line.indexOf('=');
        if (equalIndex > 0) {
          const key = line.substring(0, equalIndex).trim();
          const value = line
            .substring(equalIndex + 1)
            .trim()
            .replace(/^["']|["']$/g, '');
          config[key] = value;
        }
      }
    });

    return config;
  }

  /**
   * Substitute environment variables in configuration values
   */
  substituteVariables(config) {
    const substituted = {};

    Object.entries(config).forEach(([key, value]) => {
      if (typeof value === 'string') {
        // Replace ${VAR_NAME} with actual environment variable values
        substituted[key] = value.replace(/\$\{([^}]+)\}/g, (match, varName) => {
          return process.env[varName] || config[varName] || match;
        });
      } else {
        substituted[key] = value;
      }
    });

    return substituted;
  }

  /**
   * Get configuration value with optional default
   */
  get(key, defaultValue = undefined) {
    if (!this.loaded) {
      this.load();
    }
    return this.config[key] !== undefined ? this.config[key] : defaultValue;
  }

  /**
   * Get typed configuration value
   */
  getBoolean(key, defaultValue = false) {
    const value = this.get(key);
    if (value === undefined) return defaultValue;
    return value === 'true' || value === '1' || value === 'yes';
  }

  getNumber(key, defaultValue = 0) {
    const value = this.get(key);
    if (value === undefined) return defaultValue;
    const parsed = Number(value);
    return isNaN(parsed) ? defaultValue : parsed;
  }

  getArray(key, separator = ',', defaultValue = []) {
    const value = this.get(key);
    if (value === undefined) return defaultValue;
    return value
      .split(separator)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  /**
   * Get provider-specific configuration
   */
  getCerebrasConfig() {
    return {
      apiKey: this.get('CEREBRAS_API_KEY'),
      apiUrl: this.get('CEREBRAS_API_URL', 'https://api.cerebras.ai/v1'),
      model: this.get('CEREBRAS_MODEL', 'llama-3.3-70b'),
      temperature: this.getNumber('CEREBRAS_TEMPERATURE', 0.6),
      topP: this.getNumber('CEREBRAS_TOP_P', 0.9),
      maxTokens: this.getNumber('CEREBRAS_MAX_TOKENS', 32768),
      stream: this.getBoolean('CEREBRAS_STREAM', true),
    };
  }

  getOpenAIConfig() {
    return {
      apiKey: this.get('OPENAI_API_KEY'),
      model: this.get('OPENAI_MODEL', 'gpt-4'),
    };
  }

  getProviderConfig() {
    return {
      fallbackEnabled: this.getBoolean('PROVIDER_FALLBACK_ENABLED', true),
      retryAttempts: this.getNumber('PROVIDER_RETRY_ATTEMPTS', 3),
      retryDelay: this.getNumber('PROVIDER_RETRY_DELAY', 1000),
      timeout: this.getNumber('PROVIDER_TIMEOUT', 30000),
      circuitBreakerThreshold: this.getNumber(
        'PROVIDER_CIRCUIT_BREAKER_THRESHOLD',
        5
      ),
    };
  }

  getCacheConfig() {
    return {
      url: this.get('REDIS_URL', 'redis://localhost:6379'),
      defaultTTL: this.getNumber('CACHE_DEFAULT_TTL', 3600),
      maxSize: this.getNumber('CACHE_MAX_SIZE', 10000),
      enableSemanticSimilarity: this.getBoolean(
        'CACHE_ENABLE_SEMANTIC_SIMILARITY',
        true
      ),
      qualityThreshold: this.getNumber('CACHE_QUALITY_THRESHOLD', 0.8),
    };
  }

  getMonitoringConfig() {
    return {
      enabled: this.getBoolean('ENABLE_METRICS', true),
      interval: this.getNumber('METRICS_INTERVAL', 60000),
      logLevel: this.get('LOG_LEVEL', 'info'),
    };
  }

  /**
   * Get all configuration as object
   */
  getAll() {
    if (!this.loaded) {
      this.load();
    }
    return { ...this.config };
  }

  /**
   * Reload configuration
   */
  reload(environment = this.environment) {
    this.loaded = false;
    return this.load(environment);
  }

  /**
   * Check if running in specific environment
   */
  isDevelopment() {
    return this.environment === 'development';
  }

  isStaging() {
    return this.environment === 'staging';
  }

  isProduction() {
    return this.environment === 'production';
  }
}

// Export singleton instance
const configLoader = new ConfigLoader();

module.exports = configLoader;
