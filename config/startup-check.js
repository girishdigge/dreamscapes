#!/usr/bin/env node

/**
 * Startup Configuration Check
 * Validates configuration and performs startup checks for Dreamscapes services
 */

const configLoader = require('./config-loader');
const { validateConfiguration } = require('./validate-config');

/**
 * Perform startup checks
 */
async function performStartupChecks() {
  console.log('🚀 Starting Dreamscapes AI Provider Integration...');

  try {
    // Load and validate configuration
    const config = configLoader.load();
    console.log(
      `✅ Configuration loaded for environment: ${configLoader.environment}`
    );

    // Check API connectivity
    await checkAPIConnectivity(config);

    // Check Redis connectivity
    await checkRedisConnectivity(config);

    // Validate provider configuration
    validateProviderConfiguration(config);

    console.log('✅ All startup checks passed successfully');
    return true;
  } catch (error) {
    console.error('❌ Startup checks failed:', error.message);
    process.exit(1);
  }
}

/**
 * Check API connectivity
 */
async function checkAPIConnectivity(config) {
  console.log('🔍 Checking API connectivity...');

  // Check Cerebras API
  if (config.CEREBRAS_API_KEY) {
    try {
      const response = await fetch(
        `${config.CEREBRAS_API_URL || 'https://api.cerebras.ai/v1'}/models`,
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${config.CEREBRAS_API_KEY}`,
            'Content-Type': 'application/json',
          },
          timeout: 10000,
        }
      );

      if (response.ok) {
        console.log('✅ Cerebras API connectivity verified');
      } else {
        console.warn(
          '⚠️  Cerebras API returned non-200 status:',
          response.status
        );
      }
    } catch (error) {
      console.warn(
        '⚠️  Cerebras API connectivity check failed:',
        error.message
      );
    }
  } else {
    console.warn('⚠️  Cerebras API key not configured');
  }

  // Check OpenAI API
  if (config.OPENAI_API_KEY) {
    try {
      const response = await fetch('https://api.openai.com/v1/models', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${config.OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        timeout: 10000,
      });

      if (response.ok) {
        console.log('✅ OpenAI API connectivity verified');
      } else {
        console.warn(
          '⚠️  OpenAI API returned non-200 status:',
          response.status
        );
      }
    } catch (error) {
      console.warn('⚠️  OpenAI API connectivity check failed:', error.message);
    }
  } else {
    console.warn('⚠️  OpenAI API key not configured');
  }
}

/**
 * Check Redis connectivity
 */
async function checkRedisConnectivity(config) {
  console.log('🔍 Checking Redis connectivity...');

  try {
    const redis = require('redis');
    const client = redis.createClient({
      url: config.REDIS_URL || 'redis://localhost:6379',
    });

    await client.connect();
    await client.ping();
    await client.disconnect();

    console.log('✅ Redis connectivity verified');
  } catch (error) {
    console.warn('⚠️  Redis connectivity check failed:', error.message);
  }
}

/**
 * Validate provider configuration
 */
function validateProviderConfiguration(config) {
  console.log('🔍 Validating provider configuration...');

  const cerebrasConfig = configLoader.getCerebrasConfig();
  const openaiConfig = configLoader.getOpenAIConfig();
  const providerConfig = configLoader.getProviderConfig();

  // Validate Cerebras configuration
  if (!cerebrasConfig.apiKey) {
    throw new Error('Cerebras API key is required');
  }

  if (cerebrasConfig.temperature < 0 || cerebrasConfig.temperature > 2) {
    throw new Error('Cerebras temperature must be between 0 and 2');
  }

  if (cerebrasConfig.topP < 0 || cerebrasConfig.topP > 1) {
    throw new Error('Cerebras top_p must be between 0 and 1');
  }

  // Validate fallback configuration
  if (providerConfig.fallbackEnabled && !openaiConfig.apiKey) {
    console.warn('⚠️  Fallback enabled but OpenAI API key not configured');
  }

  // Validate timeout configuration
  if (providerConfig.timeout < 1000) {
    throw new Error('Provider timeout must be at least 1000ms');
  }

  console.log('✅ Provider configuration validated');
}

/**
 * Display configuration summary
 */
function displayConfigurationSummary() {
  const cerebrasConfig = configLoader.getCerebrasConfig();
  const providerConfig = configLoader.getProviderConfig();
  const cacheConfig = configLoader.getCacheConfig();
  const monitoringConfig = configLoader.getMonitoringConfig();

  console.log('\n📋 Configuration Summary:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`Environment: ${configLoader.environment}`);
  console.log(`Cerebras Model: ${cerebrasConfig.model}`);
  console.log(`Temperature: ${cerebrasConfig.temperature}`);
  console.log(`Max Tokens: ${cerebrasConfig.maxTokens}`);
  console.log(`Streaming: ${cerebrasConfig.stream ? 'enabled' : 'disabled'}`);
  console.log(
    `Fallback: ${providerConfig.fallbackEnabled ? 'enabled' : 'disabled'}`
  );
  console.log(`Cache Size: ${cacheConfig.maxSize}`);
  console.log(`Cache TTL: ${cacheConfig.defaultTTL}s`);
  console.log(
    `Semantic Similarity: ${
      cacheConfig.enableSemanticSimilarity ? 'enabled' : 'disabled'
    }`
  );
  console.log(
    `Monitoring: ${monitoringConfig.enabled ? 'enabled' : 'disabled'}`
  );
  console.log(`Log Level: ${monitoringConfig.logLevel}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

// Run startup checks if called directly
if (require.main === module) {
  performStartupChecks()
    .then(() => {
      displayConfigurationSummary();
      console.log('🎉 Dreamscapes AI Provider Integration is ready!');
    })
    .catch((error) => {
      console.error('💥 Startup failed:', error.message);
      process.exit(1);
    });
}

module.exports = {
  performStartupChecks,
  checkAPIConnectivity,
  checkRedisConnectivity,
  validateProviderConfiguration,
  displayConfigurationSummary,
};
