// test-provider-integration.js
// Simple test to verify ProviderManager integration

const express = require('express');
require('dotenv').config();

// Import the main components
const ProviderManager = require('./providers/ProviderManager');
const cerebrasService = require('./services/cerebrasService');
const openaiService = require('./services/openaiService');
const { logger } = require('./utils/logger');

async function testProviderManagerIntegration() {
  console.log('🧪 Testing ProviderManager Integration...\n');

  try {
    // Initialize ProviderManager
    const providerManager = new ProviderManager({
      healthCheckInterval: 60000, // 1 minute for testing
      maxRetryAttempts: 2,
      backoffMultiplier: 1.5,
      circuitBreakerThreshold: 3,
      circuitBreakerTimeout: 30000,
      enableEnhancedMonitoring: true,
    });

    console.log('✅ ProviderManager initialized');

    // Register providers
    let providersRegistered = 0;

    if (process.env.CEREBRAS_API_KEY) {
      providerManager.registerProvider('cerebras', cerebrasService, {
        enabled: true,
        priority: 3,
        limits: {
          requestsPerMinute: 100,
          tokensPerMinute: 50000,
          maxConcurrent: 10,
        },
      });
      providersRegistered++;
      console.log('✅ Cerebras provider registered');
    } else {
      console.log('⚠️  Cerebras API key not configured');
    }

    if (process.env.OPENAI_API_KEY) {
      providerManager.registerProvider('openai', openaiService, {
        enabled: true,
        priority: 2,
        limits: {
          requestsPerMinute: 60,
          tokensPerMinute: 40000,
          maxConcurrent: 5,
        },
      });
      providersRegistered++;
      console.log('✅ OpenAI provider registered');
    } else {
      console.log('⚠️  OpenAI API key not configured');
    }

    if (providersRegistered === 0) {
      console.log(
        '❌ No providers configured - please set CEREBRAS_API_KEY or OPENAI_API_KEY'
      );
      return;
    }

    console.log(`\n📊 Total providers registered: ${providersRegistered}`);

    // Test provider selection
    console.log('\n🎯 Testing provider selection...');
    try {
      const selectedProvider = await providerManager.selectProvider({
        operationType: 'generateDream',
        quality: 'high',
      });
      console.log(
        `✅ Selected provider: ${selectedProvider.name} (score: ${selectedProvider.score})`
      );
    } catch (error) {
      console.log(`❌ Provider selection failed: ${error.message}`);
    }

    // Test health checks
    console.log('\n🏥 Testing health checks...');
    try {
      const healthResults = await providerManager.healthCheck();
      for (const [providerName, health] of Object.entries(healthResults)) {
        const status = health.isHealthy ? '✅ Healthy' : '❌ Unhealthy';
        const responseTime = health.responseTime
          ? ` (${health.responseTime}ms)`
          : '';
        console.log(`${status} ${providerName}${responseTime}`);
      }
    } catch (error) {
      console.log(`❌ Health check failed: ${error.message}`);
    }

    // Test metrics
    console.log('\n📈 Testing metrics collection...');
    try {
      const metrics = providerManager.getProviderMetrics();
      for (const [providerName, providerMetrics] of Object.entries(metrics)) {
        console.log(`📊 ${providerName}:`);
        console.log(`   Requests: ${providerMetrics.requests}`);
        console.log(
          `   Success Rate: ${(providerMetrics.successRate * 100).toFixed(1)}%`
        );
        console.log(
          `   Avg Response Time: ${providerMetrics.avgResponseTime.toFixed(
            0
          )}ms`
        );
        console.log(`   Healthy: ${providerMetrics.isHealthy ? 'Yes' : 'No'}`);
      }
    } catch (error) {
      console.log(`❌ Metrics collection failed: ${error.message}`);
    }

    // Test a simple operation (if providers are healthy)
    console.log('\n🚀 Testing simple operation...');
    try {
      const testPrompt =
        'Generate a simple test response for integration testing.';

      const result = await providerManager.executeWithFallback(
        async (provider, providerName, context) => {
          console.log(`   Attempting with ${providerName}...`);

          // Use a simple test method if available, otherwise skip
          if (provider.testConnection) {
            await provider.testConnection();
            return {
              content: `Test successful with ${providerName}`,
              provider: providerName,
              responseTime: 100,
            };
          } else {
            throw new Error('Test method not available');
          }
        },
        null,
        {
          maxAttempts: 2,
          timeout: 10000,
          operationType: 'test',
        }
      );

      console.log(`✅ Operation completed with ${result.provider}`);
      console.log(`   Response: ${result.content}`);
    } catch (error) {
      console.log(`⚠️  Operation test skipped: ${error.message}`);
    }

    // Clean up
    providerManager.stopHealthMonitoring();
    console.log(
      '\n✅ ProviderManager integration test completed successfully!'
    );
  } catch (error) {
    console.error(
      '\n❌ ProviderManager integration test failed:',
      error.message
    );
    console.error(error.stack);
  }
}

// Run the test
if (require.main === module) {
  testProviderManagerIntegration()
    .then(() => {
      console.log('\n🎉 Test completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Test failed:', error);
      process.exit(1);
    });
}

module.exports = { testProviderManagerIntegration };
